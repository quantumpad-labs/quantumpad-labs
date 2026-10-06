import { randomUUID } from "node:crypto";
import { db, get, put } from "./db";
import { inventory } from "./providers";
import { event, stop, sync } from "./jobs";
import type { Job, Offer } from "./types";
import { dispatchWebhooks } from "./webhooks";
export type Alert = {
  id: string;
  type: string;
  hardware: string;
  threshold: number;
  enabled: boolean;
  lastTriggered?: string;
};
export async function ingest() {
  const data = await inventory(true);
  const timestamp = new Date().toISOString();
  const rows = data.offers.map((o) => ({
    observed_at: timestamp,
    provider: o.provider,
    offer_id: o.id,
    hardware: o.hardware,
    region: o.region,
    gpu_count: o.gpuCount,
    price: o.price,
    availability: o.availability,
    nodes: o.availableNodes,
  }));
  if (rows.length)
    await db()`insert into observations ${db()(rows)} on conflict do nothing`;
  return data;
}
export function alertMatches(a: Alert, offers: Offer[]) {
  const os = offers.filter(
    (o) => o.hardware === a.hardware && o.availability === "available",
  );
  return a.type === "PRICE_BELOW"
    ? os.some((o) => o.price / o.gpuCount < a.threshold)
    : a.type === "HARDWARE_AVAILABLE"
      ? os.length > 0
      : a.type === "CAPACITY_ABOVE"
        ? os.reduce((s, o) => s + (o.availableNodes ?? 0) * o.gpuCount, 0) >
          a.threshold
        : false;
}
export async function cron() {
  const token = randomUUID();
  const lock =
    await db()`insert into records(kind,id,owner,body) values('system','cron-lock','system',${db().json({ token, until: new Date(Date.now() + 90000).toISOString() })}) on conflict(kind,id) do update set body=excluded.body where (records.body->>'until')::timestamptz<now() returning id`;
  if (!lock.length)
    return { skipped: true, reason: "Previous scheduler run is active." };
  try {
    return await run();
  } finally {
    await db()`delete from records where kind='system' and id='cron-lock' and body->>'token'=${token}`;
  }
}
async function run() {
  const startedAt = Date.now();
  const results: string[] = [];
  const jobs =
    await db()`select body from records where kind='job' and body->>'endedAt' is null and body->>'providerJobId' is not null order by (body->>'startedAt')::timestamptz limit 25`;
  await Promise.all(
    jobs.map(async (row) => {
      const j = row.body as Job;
      try {
        if (
          j.startedAt &&
          Date.now() - Date.parse(j.startedAt) >= j.durationHours * 3600000
        )
          await stop(j);
        else await sync(j);
      } catch {
        results.push(`Job ${j.id} requires reconciliation.`);
      }
    }),
  );
  const lastIngest = await get<{ lastRun: string }>(
    "system",
    "market-ingest",
    "system",
  );
  const shouldIngest =
    !lastIngest || Date.now() - Date.parse(lastIngest.lastRun) >= 300000;
  const data = shouldIngest ? await ingest() : await inventory();
  if (shouldIngest && data.offers.length) {
    await put("system", "market-ingest", "system", {
      lastRun: new Date().toISOString(),
    });
    await db()`delete from observations where observed_at<now()-interval '30 days'`;
  }
  const alerts =
    await db()`select owner,body from records where kind='alert' and body->>'enabled'='true'`;
  for (const row of alerts) {
    const a = row.body as Alert;
    if (
      alertMatches(a, data.offers) &&
      (!a.lastTriggered || Date.now() - Date.parse(a.lastTriggered) > 3600000)
    ) {
      await event(row.owner, "alert.triggered", {
        alertId: a.id,
        type: a.type,
        hardware: a.hardware,
        threshold: a.threshold,
      });
      a.lastTriggered = new Date().toISOString();
      await put("alert", a.id, row.owner, a);
    }
  }
  const expired =
    await db()`update records set body=jsonb_set(body,'{status}','"EXPIRED"') where kind='quote' and body->>'status'='QUOTE' and (body->>'expiresAt')::timestamptz<now() returning owner,id`;
  for (const q of expired)
    await event(q.owner, "quote.expired", { quoteId: q.id });
  await db()`delete from rate_limits where bucket<${Math.floor(Date.now() / 60000) - 60}`;
  await db()`delete from challenges where expires_at<now()`;
  await db()`delete from sessions where expires_at<now()`;
  if (!results.length)
    await put("system", "scheduler", "system", {
      lastRun: new Date().toISOString(),
    });
  const webhooks = await dispatchWebhooks(startedAt + 45000);
  return {
    observations: shouldIngest ? data.offers.length : 0,
    jobs: jobs.length,
    errors: results,
    ...webhooks,
  };
}
