import type { Offer, Market, Search } from "./types";
import { hardware, hardwareId } from "./catalog";
export const median = (a: number[]) => {
  const s = [...a].sort((a, b) => a - b);
  return s.length
    ? (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2
    : null;
};
export function markets(offers: Offer[]): Market[] {
  return hardware.map((h) => {
    const os = offers.filter(
      (o) => o.hardware === h.id && o.availability !== "unavailable",
    );
    const ps = os.map((o) => o.price / o.gpuCount);
    const med = median(ps);
    return {
      hardware: h.id,
      min: ps.length ? Math.min(...ps) : null,
      median: med,
      average: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null,
      offers: os.length,
      gpus:
        os.length && os.every((o) => o.availableNodes !== null)
          ? os.reduce((n, o) => n + o.gpuCount * o.availableNodes!, 0)
          : null,
      nodes:
        os.length && os.every((o) => o.availableNodes !== null)
          ? os.reduce((n, o) => n + o.availableNodes!, 0)
          : null,
      providers: new Set(os.map((o) => o.provider)).size,
      regions: [...new Set(os.map((o) => o.region))],
      dispersion: med
        ? ((Math.max(...ps) - Math.min(...ps)) / med) * 100
        : null,
    };
  });
}
export function parseSearch(text: string): Search {
  const h = hardware.find((h) =>
    text.toUpperCase().replace(/[ -]/g, "").includes(h.id.replace("-", "")),
  );
  const quantity = Number(
    text.match(
      /(\d+)\s*(?:[×x]\s*)?(?:H100|H200|B100|B200|A100|MI300X|MI325X|L40S|L4|RTX\s*4090|RTX\s*5090|GPUs?)/i,
    )?.[1] ?? 1,
  );
  const model = Number(
    text.match(/(\d+)\s*B\s*(?:model|parameter)/i)?.[1] ?? 0,
  );
  return {
    hardware: h?.id,
    quantity: Math.max(1, Math.min(1024, quantity)),
    durationHours: Number(
      text.match(/(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i)?.[1] ?? 1,
    ),
    minVram:
      Number(
        text.match(/(?:at least\s*)?(\d+)\s*GB\s*(?:VRAM|memory)/i)?.[1] ?? 0,
      ) || (model ? Math.ceil(model * 0.5 * 1.2) : undefined),
    strategy: /cheapest|cheap/i.test(text) ? "cheapest" : "balanced",
    workload: /blender|render/i.test(text)
      ? "blender"
      : /train|fine.?tun/i.test(text)
        ? "finetune"
        : "inference",
  };
}
export function rankOffers(offers: Offer[], input: Search) {
  return offers
    .filter(
      (o) =>
        (!input.hardware || o.hardware === hardwareId(input.hardware)) &&
        o.gpuCount >= input.quantity &&
        (!input.minVram || (o.vram !== null && o.vram >= input.minVram)) &&
        (!input.minRam || (o.ram !== null && o.ram >= input.minRam)) &&
        (!input.minCpu || (o.cpu !== null && o.cpu >= input.minCpu)) &&
        (!input.disk || (o.disk !== null && o.disk >= input.disk)) &&
        (!input.region ||
          input.region === "auto" ||
          o.region.toLowerCase().includes(input.region.toLowerCase())) &&
        (!input.budget || o.price * input.durationHours <= input.budget) &&
        o.availability !== "unavailable",
    )
    .map((o) => {
      let score = o.price;
      let why = "Lowest estimated whole-node cost among compatible offers.";
      if (input.strategy === "reliable") {
        score = o.reliability === null ? 1e9 : 1 - o.reliability;
        why =
          o.reliability === null
            ? "Provider does not publish a reliability score."
            : `Provider-reported reliability ${(o.reliability * 100).toFixed(2)}%.`;
      }
      if (["fastest", "max-performance"].includes(input.strategy)) {
        score = o.benchmark ? -o.benchmark : 1e9;
        why = o.benchmark
          ? "Ranked by provider-reported benchmark; scores may not be comparable across providers."
          : "No comparable benchmark is available; performance ranking is unresolved.";
      }
      if (input.strategy === "balanced") {
        score = o.benchmark ? o.price / o.benchmark : o.price;
        why = o.benchmark
          ? "Cost relative to provider-reported benchmark."
          : "No comparable benchmark; ranked by compatible whole-node cost.";
      }
      if (input.strategy === "low-latency")
        why =
          "Filtered to your chosen region. Network latency has not been measured.";
      if (input.strategy === "available-now") {
        score = o.availability === "available" ? o.price : 1e9;
        why =
          "Prioritizes provider-reported availability; capacity is rechecked before launch.";
      }
      return {
        ...o,
        score,
        why,
        estimatedTotal: o.price * input.durationHours,
      };
    })
    .sort((a, b) => a.score - b.score);
}
export function estimateModel(
  parameters: number,
  bits: number,
  context: number,
  concurrency: number,
  training: boolean,
) {
  const weights = (parameters * 1e9 * bits) / 8 / 2 ** 30;
  const overhead = training ? 6 : 1.2;
  const kv = context * concurrency * 0.000125 * (parameters / 7);
  const required = weights * overhead + kv + 2;
  return {
    required,
    weights,
    kv,
    assumptions:
      "Weights + 20% inference overhead (6× for training) + heuristic KV cache + 2 GiB runtime. KV depends on architecture, layers and batching; validate against your model.",
    recommendations: hardware
      .filter((h) => h.memory)
      .map((h) => ({
        ...h,
        minimum: Math.ceil(required / h.memory),
        recommended: Math.ceil(required / (h.memory * 0.85)),
      }))
      .sort((a, b) => a.recommended - b.recommended),
  };
}
