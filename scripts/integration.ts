import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { db } from "../src/lib/db";
import { hash } from "../src/lib/auth";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3001";
const accounts = [
  privateKeyToAccount(generatePrivateKey()),
  privateKeyToAccount(generatePrivateKey()),
];
const owners = accounts.map((a) => a.address.toLowerCase());
async function call(
  path: string,
  body?: unknown,
  cookie?: string,
  token?: string,
) {
  const r = await fetch(`${base}/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function main() {
  try {
    const cookies: string[] = [];
    for (const account of accounts) {
      const c = await call("auth/challenge", { address: account.address });
      assert.equal(c.status, 200);
      const signature = await account.signMessage({ message: c.data.message });
      const v = await call("auth/verify", { nonce: c.data.nonce, signature });
      assert.equal(v.status, 200);
      assert.ok(v.cookie);
      cookies.push(v.cookie!);
      assert.equal(
        (await call("auth/verify", { nonce: c.data.nonce, signature })).status,
        401,
      );
    }
    console.log("PASS wallet signatures, single-use challenges and sessions");
    const machine = await call(
      "machines",
      {
        name: "EXAFLOP integration test — temporary",
        configuration: {
          hardware: "H100",
          quantity: 1,
          durationHours: 1,
          strategy: "cheapest",
        },
      },
      cookies[0],
    );
    assert.equal(machine.status, 201);
    assert.equal(
      (await call("machines", undefined, cookies[0])).data.machines.length,
      1,
    );
    assert.equal(
      (await call("machines", undefined, cookies[1])).data.machines.length,
      0,
    );
    console.log("PASS PostgreSQL persistence and wallet isolation");
    const key = await call(
      "keys",
      { name: "temporary integration key" },
      cookies[0],
    );
    assert.equal(key.status, 201);
    const rows = await db()`select * from api_keys where owner=${owners[0]}`;
    assert.equal(rows[0].hash, hash(key.data.key));
    assert.notEqual(rows[0].hash, key.data.key);
    assert.equal(
      (await call("me", undefined, undefined, key.data.key)).status,
      200,
    );
    assert.equal(
      (await call("policy", { enabled: true }, undefined, key.data.key)).status,
      401,
    );
    console.log("PASS hashed API keys and session-only policy management");
    assert.equal(
      (await call("connections", undefined, undefined, key.data.key)).status,
      401,
    );
    assert.deepEqual(
      (await call("connections", undefined, cookies[0])).data.connections,
      [],
    );
    assert.equal(
      (
        await call(
          "connections",
          { provider: "vast", key: "not-a-real-provider-key" },
          cookies[0],
        )
      ).status,
      400,
    );
    assert.equal((await call("my/offers", undefined, cookies[0])).status, 200);
    console.log(
      "PASS session-only provider connections, explicit billing authorization and private discovery",
    );
    const offers = await call("offers");
    assert.equal(offers.status, 200);
    const offer = offers.data.offers.find((o: any) => o.provider === "runpod");
    assert.ok(offer, "Public catalog must return a real observation");
    const quote = await call(
      "quotes",
      { offerId: offer.id, durationHours: 1, disk: 20 },
      cookies[0],
    );
    assert.equal(quote.status, 201);
    assert.equal(
      (await call(`quotes/${quote.data.id}`, undefined, cookies[1])).status,
      404,
    );
    assert.equal(
      (
        await call(
          "jobs",
          {
            quoteId: quote.data.id,
            confirmed: true,
            workload: {
              image: "nvidia/cuda:12.6.3-runtime-ubuntu24.04",
              command: "nvidia-smi",
              disk: 20,
              env: {},
            },
          },
          cookies[0],
        )
      ).status,
      403,
    );
    console.log(
      "PASS real offer quotes, quote ownership and disabled provisioning guard",
    );
    const foreign = await fetch(`${base}/api/machines`, {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        Cookie: cookies[0],
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(foreign.status, 403);
    assert.equal((await call("cron")).status, 401);
    console.log("PASS cross-origin write and scheduler authentication guards");
    const revoked = await call(`keys/${rows[0].id}`, {}, cookies[0]);
    assert.equal(revoked.status, 200);
    assert.equal(
      (await call("me", undefined, undefined, key.data.key)).status,
      401,
    );
    console.log("PASS API key revocation");
    const hist = await call("history");
    assert.equal(hist.status, 200);
    assert.ok(hist.data.observations.length > 0);
    console.log("PASS persisted real price history");
  } finally {
    for (const owner of owners) {
      await db()`delete from records where owner=${owner}`;
      await db()`delete from api_keys where owner=${owner}`;
      await db()`delete from sessions where owner=${owner}`;
      await db()`delete from challenges where address=${owner}`;
      await db()`delete from events where owner=${owner}`;
    }
    await db().end();
    console.log("Temporary test-owned records removed.");
  }
}
main().catch((e) => {
  console.error("Integration test failed:", e.message);
  process.exitCode = 1;
});
