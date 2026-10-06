import postgres from "postgres";
let client: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL)
    throw new ServiceError(
      "Persistent storage is not configured. Set DATABASE_URL and run the migration.",
      503,
    );
  return (client ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  }));
}
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function list<T>(kind: string, owner: string) {
  return (
    await db()`select body from records where kind=${kind} and owner=${owner} order by created_at desc limit 500`
  ).map((r) => r.body as T);
}
export async function get<T>(kind: string, id: string, owner?: string) {
  const rows =
    owner === undefined
      ? await db()`select body from records where kind=${kind} and id=${id}`
      : await db()`select body from records where kind=${kind} and id=${id} and owner=${owner}`;
  return rows[0]?.body as T | undefined;
}
export async function put(
  kind: string,
  id: string,
  owner: string,
  body: object,
) {
  await db()`insert into records (kind,id,owner,body) values (${kind},${id},${owner},${db().json(body as any)}) on conflict(kind,id) do update set body=excluded.body where records.owner=excluded.owner`;
}
export async function remove(kind: string, id: string, owner: string) {
  await db()`delete from records where kind=${kind} and id=${id} and owner=${owner}`;
}
