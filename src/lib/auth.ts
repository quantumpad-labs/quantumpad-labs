import { createHash, randomBytes } from "node:crypto";
import { verifyMessage } from "viem";
import { db, ServiceError } from "./db";
import { chain } from "./chain";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const secret = () => randomBytes(32).toString("hex");
export function origin(request: Request) {
  const parsed = new URL(request.url);
  const host = request.headers.get("host") ?? parsed.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    parsed.protocol.replace(":", "");
  const expected = new URL(process.env.APP_ORIGIN ?? `${protocol}://${host}`).origin;
  // These are the public domains attached to this Vercel project. Never trust
  // arbitrary *.vercel.app origins or reflect an unvalidated browser origin.
  const allowed = new Set([expected]);
  if (process.env.VERCEL === "1") {
    for (const site of ["https://quantumpad.online", "https://www.quantumpad.online", "https://exaflop.vercel.app"])
      allowed.add(site);
  }
  const received = request.headers.get("origin");
  if (received && !allowed.has(received))
    throw new ServiceError("Origin is not allowed.", 403);
  // The sign-in message must name the approved domain the user actually opened.
  return received ?? expected;
}
export async function rate(key: string, limit = 60) {
  const bucket = Math.floor(Date.now() / 60000);
  const rows =
    await db()`insert into rate_limits(key,bucket,count) values(${hash(key)},${bucket},1) on conflict(key,bucket) do update set count=rate_limits.count+1 returning count`;
  if (rows[0].count > limit)
    throw new ServiceError("Rate limit exceeded. Retry in one minute.", 429);
}
export async function identity(request: Request, sessionOnly = false) {
  origin(request);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (bearer && !sessionOnly) {
    const rows =
      await db()`select owner,id from api_keys where hash=${hash(bearer)} and revoked=false`;
    if (rows[0]) {
      await rate(`key:${rows[0].id}`);
      return { owner: String(rows[0].owner), agent: true };
    }
  }
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("exaflop_session="))
    ?.split("=")[1];
  if (token) {
    const rows =
      await db()`select owner from sessions where hash=${hash(token)} and expires_at>now()`;
    if (rows[0]) {
      await rate(`wallet:${rows[0].owner}`, 120);
      return { owner: String(rows[0].owner), agent: false };
    }
  }
  throw new ServiceError("Connect your wallet and sign in to continue.", 401);
}
export async function challenge(address: string, request: Request) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    throw new ServiceError("Invalid wallet address.");
  await rate(
    `challenge:${request.headers.get("x-forwarded-for") ?? address}`,
    10,
  );
  const nonce = secret();
  const issued = new Date();
  const expiry = new Date(Date.now() + 300000);
  const url = origin(request);
  const message = `${new URL(url).host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to QuantumPad. This does not authorize a payment.\n\nURI: ${url}\nVersion: 1\nChain ID: ${chain.id}\nNonce: ${nonce}\nIssued At: ${issued.toISOString()}\nExpiration Time: ${expiry.toISOString()}`;
  await db()`insert into challenges(nonce,address,message,expires_at) values(${nonce},${address.toLowerCase()},${message},${expiry})`;
  return { nonce, message };
}
export async function authenticate(nonce: string, signature: `0x${string}`) {
  const rows =
    await db()`select * from challenges where nonce=${nonce} and expires_at>now()`;
  const c = rows[0];
  if (
    !c ||
    !(await verifyMessage({
      address: c.address,
      message: c.message,
      signature,
    }))
  )
    throw new ServiceError("Invalid or expired signature.", 401);
  const consumed =
    await db()`delete from challenges where nonce=${nonce} returning nonce`;
  if (!consumed.length) throw new ServiceError("Challenge already used.", 401);
  const token = secret();
  await db()`insert into sessions(hash,owner,expires_at) values(${hash(token)},${c.address},${new Date(Date.now() + 86400000)})`;
  return { token, owner: c.address };
}
