import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import https from "node:https";
import { db, put, ServiceError } from "./db";
export type Webhook = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  encryptedSecret: string;
  createdAt: string;
};
export const eventTypes = [
  "job.started",
  "job.completed",
  "job.failed",
  "job.stopped",
  "quote.expired",
  "spend.threshold",
  "alert.triggered",
];
const denied = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as [string, number][])
  denied.addSubnet(net, prefix, "ipv4");
export function publicAddress(address: string) {
  return isIP(address) === 4 && !denied.check(address, "ipv4");
}
export function webhookUrl(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) ||
    url.hostname === "localhost"
  )
    throw new ServiceError(
      "Use an HTTPS hostname on port 443 without embedded credentials.",
    );
  return url;
}
function key() {
  const k = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!k || !/^[0-9a-f]{64}$/i.test(k))
    throw new ServiceError(
      "Webhook encryption is not configured on the server.",
      503,
    );
  return Buffer.from(k, "hex");
}
export function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split(".").map((s) => Buffer.from(s, "base64"));
  const c = createDecipheriv("aes-256-gcm", key(), iv);
  c.setAuthTag(tag);
  return Buffer.concat([c.update(data), c.final()]).toString("utf8");
}
export function signature(secret: string, timestamp: string, payload: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}
async function deliver(hook: Webhook, payload: string) {
  const url = webhookUrl(hook.url);
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Non-public webhook destination.");
  const target = addresses[0];
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = signature(decrypt(hook.encryptedSecret), timestamp, payload);
  // Pin validated DNS result to the TLS request. Do not follow redirects or re-resolve DNS.
  return new Promise<void>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        lookup: ((_host: any, _options: any, callback: any) =>
          callback(null, target.address, 4)) as any,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-Exaflop-Timestamp": timestamp,
          "X-Exaflop-Signature": `v1=${sig}`,
        },
        timeout: 5000,
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          res.statusCode && res.statusCode >= 200 && res.statusCode < 300
            ? resolve()
            : reject(new Error("Webhook rejected.")),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("Webhook timeout.")));
    req.on("error", reject);
    req.end(payload);
  });
}
export async function dispatchWebhooks(deadline = Date.now() + 20000) {
  if (!process.env.WEBHOOK_ENCRYPTION_KEY) return { delivered: 0 };
  const hooks =
    await db()`select owner,body from records where kind='webhook' and body->>'enabled'='true' limit 50`;
  let delivered = 0;
  let attempted = 0;
  for (const row of hooks) {
    if (Date.now() >= deadline || attempted >= 10) break;
    const hook = row.body as Webhook;
    const events =
      await db()`select * from events where owner=${row.owner} and created_at>now()-interval '1 day' order by created_at desc limit 30`;
    for (const e of events) {
      if (Date.now() >= deadline || attempted >= 10) break;
      if (!hook.events.includes(e.type) || attempted >= 10) continue;
      const id = `${hook.id}:${e.id}`;
      const existing =
        await db()`select body from records where kind='delivery' and id=${id}`;
      if (existing[0]?.body.delivered || existing[0]?.body.attempts >= 5)
        continue;
      attempted++;
      const body = {
        id: e.id,
        type: e.type,
        createdAt: e.created_at,
        data: e.payload,
      };
      try {
        await deliver(hook, JSON.stringify(body));
        await put("delivery", id, row.owner, {
          delivered: true,
          attempts: (existing[0]?.body.attempts ?? 0) + 1,
          lastAttempt: new Date().toISOString(),
        });
        delivered++;
      } catch {
        await put("delivery", id, row.owner, {
          delivered: false,
          attempts: (existing[0]?.body.attempts ?? 0) + 1,
          lastAttempt: new Date().toISOString(),
        });
      }
    }
  }
  return { delivered };
}
