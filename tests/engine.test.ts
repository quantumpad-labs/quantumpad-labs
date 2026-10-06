import test from "node:test";
import assert from "node:assert/strict";
import {
  median,
  markets,
  rankOffers,
  parseSearch,
  estimateModel,
} from "../src/lib/engine";
import { normalizeVast, inventory } from "../src/lib/providers";
import { checkPolicy, defaultPolicy, receipt } from "../src/lib/jobs";
import { alertMatches } from "../src/lib/cron";
import type { Offer, Quote, Job } from "../src/lib/types";
const offer: Offer = {
  id: "fixture:1",
  provider: "fixture",
  providerOfferId: "1",
  hardware: "H100",
  gpuName: "H100",
  gpuCount: 8,
  vram: 80,
  cpu: 64,
  ram: 512,
  disk: 1000,
  region: "US",
  price: 16,
  currency: "USD",
  availability: "available",
  availableNodes: null,
  reliability: null,
  verified: null,
  bandwidth: null,
  benchmark: null,
  deployable: false,
  observedAt: "2026-10-03T00:00:00.000Z",
  billingUnit: "node-hour",
  minimumHours: null,
  source: "test fixture only",
};
test("median handles empty, even and odd sets without mutating input", () => {
  const a = [3, 1, 2];
  assert.equal(median(a), 2);
  assert.deepEqual(a, [3, 1, 2]);
  assert.equal(median([2, 4]), 3);
  assert.equal(median([]), null);
});
test("market prices normalize whole node prices to GPU hours", () => {
  const m = markets([offer, { ...offer, id: "fixture:2", price: 24 }]).find(
    (m) => m.hardware === "H100",
  )!;
  assert.equal(m.min, 2);
  assert.equal(m.median, 2.5);
  assert.equal(m.gpus, null);
  assert.equal(m.nodes, null);
  assert.equal(m.dispersion, 40);
});
test("market does not invent missing observations", () => {
  assert.equal(markets([])[0].min, null);
  assert.equal(markets([])[0].gpus, null);
});
test("router charges for the entire node when requesting fewer GPUs", () => {
  const result = rankOffers([offer], {
    quantity: 4,
    durationHours: 10,
    strategy: "cheapest",
  });
  assert.equal(result[0].estimatedTotal, 160);
});
test("router never pools unrelated nodes to satisfy a cluster request", () => {
  assert.equal(
    rankOffers([offer, { ...offer, id: "fixture:2" }], {
      quantity: 16,
      durationHours: 1,
      strategy: "balanced",
    }).length,
    0,
  );
});
test("router rejects unknown memory and region mismatches", () => {
  assert.equal(
    rankOffers([{ ...offer, ram: null }], {
      quantity: 1,
      durationHours: 1,
      strategy: "balanced",
      minRam: 1,
    }).length,
    0,
  );
  assert.equal(
    rankOffers([offer], {
      quantity: 1,
      durationHours: 1,
      strategy: "low-latency",
      region: "EU",
    }).length,
    0,
  );
});
test("router applies duration-adjusted budget and availability", () => {
  assert.equal(
    rankOffers([offer], {
      quantity: 1,
      durationHours: 10,
      strategy: "cheapest",
      budget: 100,
    }).length,
    0,
  );
  assert.equal(
    rankOffers([{ ...offer, availability: "unavailable" }], {
      quantity: 1,
      durationHours: 1,
      strategy: "cheapest",
    }).length,
    0,
  );
});
test("natural language parses quantity, hardware, duration and memory", () => {
  const p = parseSearch("I need 8 H100s for 24 hours");
  assert.equal(p.quantity, 8);
  assert.equal(p.hardware, "H100");
  assert.equal(p.durationHours, 24);
  assert.equal(parseSearch("Find 4 GPUs with at least 80GB VRAM").minVram, 80);
  assert.equal(
    parseSearch("Cheapest GPU that can run a 70B model").strategy,
    "cheapest",
  );
});
test("model estimate grows with context and concurrency", () => {
  assert.ok(
    estimateModel(70, 4, 8192, 2, false).required >
      estimateModel(70, 4, 8192, 1, false).required,
  );
  assert.ok(
    estimateModel(70, 16, 8192, 1, true).required >
      estimateModel(70, 16, 8192, 1, false).required,
  );
});
test("Vast normalization validates malformed prices and converts MiB memory", () => {
  const valid = {
    id: 1,
    gpu_name: "NVIDIA H100",
    num_gpus: 8,
    gpu_ram: 81920,
    cpu_ram: 524288,
    dph_total: 16,
    rentable: true,
    rented: false,
  };
  const result = normalizeVast([
    valid,
    { ...valid, id: 2, dph_total: -1 },
    { ...valid, id: 3, dph_total: NaN },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].vram, 80);
  assert.equal(result[0].ram, 512);
  assert.equal(result[0].hardware, "H100");
});
const quote: Quote = {
  id: "q",
  owner: "wallet",
  offer: { ...offer, provider: "vast" },
  durationHours: 2,
  hourly: 16,
  total: 32,
  expiresAt: "2026-10-03T01:00:00Z",
  createdAt: "2026-10-03T00:00:00Z",
  status: "QUOTE",
};
test("agent policy requires explicit enablement and reserves daily budget", () => {
  assert.throws(() => checkPolicy(defaultPolicy, quote, 0));
  const policy = {
    ...defaultPolicy,
    enabled: true,
    maxCostPerJob: 40,
    maxDailyCost: 50,
  };
  assert.doesNotThrow(() => checkPolicy(policy, quote, 0));
  assert.throws(() => checkPolicy(policy, quote, 20));
  assert.throws(() =>
    checkPolicy({ ...policy, allowedGpus: ["A100"] }, quote, 0),
  );
  assert.throws(() =>
    checkPolicy({ ...policy, allowedRegions: ["EU"] }, quote, 0),
  );
});
test("canonical receipt is deterministic and excludes command and secrets", () => {
  const j: Job = {
    id: "job",
    owner: "wallet",
    quoteId: "q",
    provider: "vast",
    providerJobId: "private-provider-id",
    hardware: "H100",
    gpuCount: 8,
    region: "US",
    hourly: 16,
    reserved: 32,
    durationHours: 2,
    state: "COMPLETED",
    createdAt: "2026-10-03T00:00:00Z",
    startedAt: "2026-10-03T00:00:00Z",
    endedAt: "2026-10-03T02:00:00Z",
    workloadHash: "abc",
    image: "private-image",
  };
  const a = receipt(j);
  assert.equal(a.receiptHash, receipt(j).receiptHash);
  assert.equal(a.estimatedCostUsd, 32);
  assert.equal(a.gpuHours, 16);
  assert.ok(!JSON.stringify(a).includes("private-provider-id"));
  assert.ok(!JSON.stringify(a).includes("private-image"));
});
test("capacity alert does not infer capacity from offer count", () => {
  assert.equal(
    alertMatches(
      {
        id: "a",
        type: "CAPACITY_ABOVE",
        hardware: "H100",
        threshold: 1,
        enabled: true,
      },
      [offer],
    ),
    false,
  );
  assert.equal(
    alertMatches(
      {
        id: "a",
        type: "PRICE_BELOW",
        hardware: "H100",
        threshold: 3,
        enabled: true,
      },
      [offer],
    ),
    true,
  );
});
test("public catalog can connect while private providers require credentials", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: { gpuTypes: [] } }), { status: 200 });
  const saved = [
    process.env.VAST_API_KEY,
    process.env.RUNPOD_API_KEY,
    process.env.LAMBDA_API_KEY,
  ];
  delete process.env.VAST_API_KEY;
  delete process.env.RUNPOD_API_KEY;
  delete process.env.LAMBDA_API_KEY;
  try {
    const result = await inventory(true);
    assert.equal(result.offers.length, 0);
    assert.equal(
      result.providers.filter((p) => p.status === "credentials_required")
        .length,
      2,
    );
    assert.equal(
      result.providers.find((p) => p.id === "runpod")?.status,
      "connected",
    );
  } finally {
    globalThis.fetch = originalFetch;
    ["VAST_API_KEY", "RUNPOD_API_KEY", "LAMBDA_API_KEY"].forEach((k, i) => {
      if (saved[i]) process.env[k] = saved[i];
    });
  }
});
