/** Authenticated API actions in an isolated schema. No real wallet or paid provider actions. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

async function main() {
  const source = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!source) throw new Error("Database required for isolated API checks.");
  const schema = `actions_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(source, { max: 1, onnotice: () => {} });
  const url = new URL(source);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.APP_ORIGIN = "https://quantumpad.online";
  process.env.ENABLE_PROVISIONING = "false";
  const { db } = await import("../src/lib/db");
  const { GET, POST, DELETE } = await import("../src/app/api/[...path]/route");
  async function call(path: string, body?: unknown, cookie?: string, method = body === undefined ? "GET" : "POST", origin = process.env.APP_ORIGIN!) {
    const req = new NextRequest(`https://quantumpad.online/api/${path}`, {
      method, headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const response = await ({ GET, POST, DELETE }[method as "GET" | "POST" | "DELETE"])(req, { params: Promise.resolve({ path: path.split("/") }) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  try {
    await admin.unsafe(`create schema ${schema}`);
    assert.equal((await db()`select current_schema() as schema`)[0].schema, schema);
    await db().unsafe(await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"));
    const cookies: string[] = [];
    const accounts = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())];
    for (const account of accounts) {
      const challenge = await call("auth/challenge", { address: account.address });
      assert.equal(challenge.status, 200);
      assert.ok(challenge.data.message.startsWith("quantumpad.online wants you to sign in"));
      const signature = await account.signMessage({ message: challenge.data.message });
      const verified = await call("auth/verify", { nonce: challenge.data.nonce, signature });
      assert.equal(verified.status, 200);
      assert.ok(verified.cookie);
      cookies.push(verified.cookie!);
      assert.equal((await call("me", undefined, verified.cookie)).data.owner, account.address.toLowerCase());
      assert.equal((await call("auth/verify", { nonce: challenge.data.nonce, signature })).status, 401);
    }
    console.log("PASS real test-key signatures, custom-domain sign-in, cookies, restored sessions and nonce replay rejection");
    const machine = await call("machines", { name: "Isolated action check", configuration: { hardware: "H100", quantity: 1, durationHours: 1 } }, cookies[0]);
    assert.equal(machine.status, 201);
    assert.equal((await call(`machines/${machine.data.id}`, undefined, cookies[0])).status, 200);
    assert.equal((await call(`machines/${machine.data.id}`, undefined, cookies[1])).status, 404);
    assert.equal((await call("machines", undefined, cookies[1])).data.machines.length, 0);
    assert.equal((await call("machines", { name: "Blocked" }, cookies[0], "POST", "https://evil.example")).status, 403);
    const alert = await call("alerts", { type: "PRICE_BELOW", hardware: "H100", threshold: 2 }, cookies[0]);
    assert.equal(alert.status, 201);
    assert.equal((await call("alerts", undefined, cookies[0])).data.alerts.length, 1);
    assert.equal((await call(`alerts/${alert.data.id}`, undefined, cookies[0], "DELETE")).status, 200);
    assert.equal((await call("alerts", undefined, cookies[0])).data.alerts.length, 0);
    assert.equal((await call(`machines/${machine.data.id}`, undefined, cookies[0], "DELETE")).status, 200);
    assert.equal((await call("machines", undefined, cookies[0])).data.machines.length, 0);
    console.log("PASS save/read/delete machines and alerts, wallet isolation and cross-origin rejection");
    for (const path of ["jobs", "connections", "policy", "keys", "events"]) {
      assert.equal((await call(path, undefined, cookies[0])).status, 200, path);
      assert.equal((await call(path)).status, 401, `${path} must require authentication`);
    }
    const key = await call("keys", { name: "Isolated key" }, cookies[0]);
    assert.equal(key.status, 201);
    assert.equal((await call("keys", undefined, cookies[0])).data.keys.length, 1);
    assert.equal((await call("auth/logout", {}, cookies[0])).status, 200);
    assert.equal((await call("me", undefined, cookies[0])).status, 401);
    assert.equal((await call("me", undefined, cookies[1])).status, 200);
    console.log("PASS protected action endpoints, API-key creation and account-scoped logout");
  } finally {
    await db().end();
    await admin.unsafe(`drop schema if exists ${schema} cascade`);
    await admin.end();
  }
}
main().catch(error => { console.error("Isolated actions check failed:", error.message); process.exitCode = 1; });
