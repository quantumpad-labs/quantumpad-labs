import { randomUUID } from "node:crypto";
import { db, get, list, ServiceError } from "./db";
import { encrypt, decrypt } from "./webhooks";
import { adapters, inventory } from "./providers";

type Connection = {
  id: string;
  provider: "vast";
  encryptedKey: string;
  createdAt: string;
};
export function sealCredential(owner: string, provider: string, key: string) {
  return encrypt(
    JSON.stringify({ purpose: "provider-key", owner, provider, key }),
  );
}
export function openCredential(
  value: string,
  owner: string,
  provider: string,
): string {
  const data = JSON.parse(decrypt(value));
  if (
    data.purpose !== "provider-key" ||
    data.owner !== owner ||
    data.provider !== provider ||
    typeof data.key !== "string"
  )
    throw new ServiceError(
      "Provider credential scope does not match this account.",
      403,
    );
  return data.key;
}
export async function connections(owner: string) {
  return (await list<Connection>("connection", owner)).map(
    ({ encryptedKey, ...c }) => c,
  );
}
export async function credential(owner: string, id: string, provider: string) {
  const c = await get<Connection>("connection", id, owner);
  if (!c || c.provider !== provider)
    throw new ServiceError(
      "Reconnect this provider before launching. Existing jobs must be reconciled in the provider console.",
      409,
    );
  return openCredential(c.encryptedKey, owner, provider);
}
export async function saveConnection(owner: string, key: string) {
  // Validation performs a read-only provider request. Never rent to validate a key.
  const vast = adapters.find((a) => a.id === "vast")!;
  await vast.validateAccount!(key);
  await vast.listOffers(key);
  const c: Connection = {
    id: randomUUID(),
    provider: "vast",
    encryptedKey: sealCredential(owner, "vast", key),
    createdAt: new Date().toISOString(),
  };
  await db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext(${owner}))`;
    const active =
      await sql`select id from records where kind='job' and owner=${owner} and body->>'credentialId' is not null and body->>'endedAt' is null limit 1`;
    if (active.length)
      throw new ServiceError(
        "Finish or reconcile your active rentals before replacing their provider key.",
        409,
      );
    await sql`delete from records where kind='connection' and owner=${owner} and body->>'provider'='vast'`;
    await sql`insert into records(kind,id,owner,body) values('connection',${c.id},${owner},${sql.json(c)})`;
  });
  return { id: c.id, provider: c.provider, createdAt: c.createdAt };
}
export async function disconnect(owner: string, id: string) {
  await db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext(${owner}))`;
    const active =
      await sql`select id from records where kind='job' and owner=${owner} and body->>'credentialId'=${id} and body->>'endedAt' is null limit 1`;
    if (active.length)
      throw new ServiceError(
        "Stop or reconcile active rentals before disconnecting their key.",
        409,
      );
    await sql`delete from records where kind='connection' and owner=${owner} and id=${id}`;
  });
}
export async function ownerInventory(
  owner: string,
  force = false,
): Promise<Awaited<ReturnType<typeof inventory>>> {
  const data = await inventory(force);
  const c = (await list<Connection>("connection", owner)).find(
    (c) => c.provider === "vast",
  );
  if (!c) return data;
  const vast = adapters.find((a) => a.id === "vast")!;
  const offers = await vast.listOffers(
    openCredential(c.encryptedKey, owner, "vast"),
  );
  return {
    ...data,
    offers: [
      ...data.offers.filter((o) => o.provider !== "vast"),
      ...offers.map((o) => ({
        ...o,
        metadata: { ...o.metadata, credentialId: c.id },
      })),
    ],
  };
}
