/** Isolated database schema + mocked provider HTTP. Never rents paid capacity. */
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

async function main() {
  const source = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!source) throw new Error("Database URL required.");
  const admin = postgres(source, { max: 1 });
  const schema = `exaflop_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(source);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.ENABLE_SELF_SERVICE = "true";
  process.env.SCHEDULER_ENABLED = "true";
  process.env.ENABLE_PROVISIONING = "false";
  process.env.WEBHOOK_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  delete process.env.VAST_API_KEY;
  delete process.env.LAMBDA_API_KEY;
  const { db, put, get } = await import("../src/lib/db");
  const {
    saveConnection,
    credential,
    disconnect,
    ownerInventory,
    connections,
  } = await import("../src/lib/connections");
  const { launch, stop, workloadSchema } = await import("../src/lib/jobs");
  const { cron } = await import("../src/lib/cron");
  const originalFetch = globalThis.fetch;
  let creates = 0,
    deletes = 0;
  const testKey = "test-only-vast-key-not-a-real-credential";
  globalThis.fetch = async (input, init) => {
    const target = String(input);
    if (target === "https://api.runpod.io/graphql")
      return Response.json({ data: { gpuTypes: [] } });
    assert.ok(
      target.startsWith("https://console.vast.ai/api/v0/"),
      "Unexpected external URL; test blocks all real provider operations.",
    );
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      `Bearer ${testKey}`,
    );
    if (target.includes("users/current")) return Response.json({ id: 123 });
    if (target.includes("bundles"))
      return Response.json({
        offers: [
          {
            id: 101,
            gpu_name: "H100",
            num_gpus: 1,
            gpu_ram: 81920,
            cpu_cores_effective: 8,
            cpu_ram: 65536,
            disk_space: 100,
            dph_total: 1,
            rentable: true,
            rented: false,
            storage_cost: 0.1,
            geolocation: "US",
            verification: "verified",
          },
        ],
      });
    if (target.includes("asks/")) {
      creates++;
      const body = JSON.parse(String(init?.body));
      assert.equal(typeof body.env, "string");
      return Response.json({ new_contract: 777 });
    }
    if (init?.method === "DELETE") {
      deletes++;
      return Response.json({ success: true });
    }
    return Response.json({ instances: { actual_status: "running" } });
  };
  try {
    await admin.unsafe(`create schema "${schema}"`);
    await db().unsafe(
      await readFile(
        new URL("../migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (await db()`select current_schema() as schema`)[0].schema,
      schema,
    );
    const owner = "test-owner-a",
      other = "test-owner-b";
    const c = await saveConnection(owner, testKey);
    assert.ok(!JSON.stringify(await connections(owner)).includes(testKey));
    await assert.rejects(() => credential(other, c.id, "vast"));
    const offers = (await ownerInventory(owner)).offers;
    assert.equal(offers[0].metadata?.credentialId, c.id);
    assert.equal((await ownerInventory(other)).offers.length, 0);
    console.log(
      "PASS encrypted keys, wallet isolation, private inventory and read-only validation",
    );
    const quote = {
      id: randomUUID(),
      owner,
      offer: offers[0],
      hourly: 1.01,
      total: 1.01,
      durationHours: 1,
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      createdAt: new Date().toISOString(),
      status: "QUOTE",
    };
    await put("quote", quote.id, owner, quote);
    const workload = workloadSchema.parse({
      image: "test/image",
      command: "test",
      env: { A: "safe value" },
      disk: 20,
    });
    await assert.rejects(
      () => launch(owner, false, quote.id, workload, true),
      /scheduler is not healthy/,
    );
    await put("system", "scheduler", "system", {
      lastRun: new Date().toISOString(),
    });
    await assert.rejects(
      () => launch(other, false, quote.id, workload, true),
      /Quote not found/,
    );
    const launched = await Promise.all([
      launch(owner, false, quote.id, workload, true),
      launch(owner, false, quote.id, workload, true),
    ]);
    assert.equal(creates, 1);
    assert.equal(launched[0]!.id, launched[1]!.id);
    let job = await get<any>("job", launched[0]!.id, owner);
    assert.equal(job.credentialId, c.id);
    await assert.rejects(() => disconnect(owner, c.id), /active rentals/);
    await assert.rejects(
      () => saveConnection(owner, testKey),
      /active rentals/,
    );
    console.log(
      "PASS healthy scheduler gate, quote ownership, exactly-once dispatch and active-key protection",
    );
    const expensive = { ...quote, id: randomUUID(), total: 100 };
    await put("quote", expensive.id, owner, expensive);
    await assert.rejects(
      () => launch(owner, false, expensive.id, workload, true),
      /exceeds/,
    );
    await assert.rejects(
      () => launch(owner, true, expensive.id, workload, true),
      /Enable and configure/,
    );
    job.startedAt = new Date(Date.now() - 7200000).toISOString();
    await put("job", job.id, owner, job);
    await cron();
    job = await get<any>("job", job.id, owner);
    assert.equal(job.state, "COMPLETED");
    assert.ok(job.endedAt);
    assert.equal(deletes, 1);
    await stop(job);
    assert.equal(deletes, 1);
    await disconnect(owner, c.id);
    assert.equal((await connections(owner)).length, 0);
    console.log(
      "PASS manual and agent budget guards, deadline termination, idempotent stop and key removal",
    );
  } finally {
    globalThis.fetch = originalFetch;
    await db().end();
    // Drop only this invocation's generated, verified test schema.
    assert.match(schema, /^exaflop_test_[a-f0-9]{32}$/);
    await admin.unsafe(`drop schema if exists "${schema}" cascade`);
    await admin.end();
    console.log(
      "Isolated test schema removed. No provider capacity was rented.",
    );
  }
}
main().catch((error) => {
  console.error("Self-service validation failed:", error.message);
  process.exitCode = 1;
});
