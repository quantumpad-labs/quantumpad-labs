import { z } from "zod";
import type { Offer, ProviderStatus } from "./types";
import { hardwareId } from "./catalog";
const nullable = z.number().nullable();
const offerSchema = z.object({
  id: z.string(),
  provider: z.string(),
  providerOfferId: z.string(),
  hardware: z.string(),
  gpuName: z.string(),
  gpuCount: z.number().int().positive(),
  vram: nullable,
  cpu: nullable,
  ram: nullable,
  disk: nullable,
  region: z.string(),
  price: z.number().finite().positive(),
  currency: z.literal("USD"),
  availability: z.enum(["available", "unknown", "unavailable"]),
  availableNodes: nullable,
  reliability: nullable,
  verified: z.boolean().nullable(),
  bandwidth: nullable,
  benchmark: nullable,
  deployable: z.boolean(),
  observedAt: z.string(),
  billingUnit: z.literal("node-hour"),
  minimumHours: nullable,
  source: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type Raw = Record<string, any>;
const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const base = (provider: string): Partial<Offer> => ({
  provider,
  currency: "USD",
  billingUnit: "node-hour",
  observedAt: new Date().toISOString(),
  cpu: null,
  ram: null,
  disk: null,
  vram: null,
  availableNodes: null,
  reliability: null,
  verified: null,
  bandwidth: null,
  benchmark: null,
  minimumHours: null,
  deployable: false,
});
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
  ) {
    super(
      `${provider} returned HTTP ${status}. Check provider credentials and account access.`,
    );
  }
}
async function request(
  url: string,
  key: string,
  method = "GET",
  body?: unknown,
) {
  const r = await fetch(url, {
    method,
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!r.ok) throw new ProviderError(new URL(url).hostname, r.status);
  if (r.status === 204) return {};
  const data = await r.json();
  if (data.success === false)
    throw new ProviderError(new URL(url).hostname, 422);
  return data;
}
export interface ComputeProviderAdapter {
  id: string;
  name: string;
  env: string;
  publicDiscovery?: boolean;
  docs: string;
  capabilities: string[];
  validateAccount?(key: string): Promise<void>;
  listOffers(key?: string): Promise<Offer[]>;
  createJob?(
    offer: Offer,
    input: {
      image: string;
      command: string;
      env: Record<string, string>;
      disk: number;
      name: string;
    },
    key?: string,
  ): Promise<string>;
  getJob?(
    id: string,
    key?: string,
  ): Promise<{
    state: string;
    metrics: Record<string, number | null>;
    logs: string | null;
  }>;
  stopJob?(id: string, key?: string): Promise<void>;
}
function valid(items: unknown[]): Offer[] {
  return items.flatMap((x) => {
    const r = offerSchema.safeParse(x);
    return r.success ? [r.data] : [];
  });
}
export function vastEnvironment(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => `-e '${`${key}=${value}`.replaceAll("'", "'\\''")}'`)
    .join(" ");
}
export function normalizeVast(raw: Raw[]): Offer[] {
  return valid(
    raw.map((o) => ({
      ...base("vast"),
      id: `vast:${o.id}`,
      providerOfferId: String(o.id),
      hardware: hardwareId(String(o.gpu_name)),
      gpuName: o.gpu_name,
      gpuCount: o.num_gpus,
      vram: n(o.gpu_ram) === null ? null : Number(o.gpu_ram) / 1024,
      cpu: n(o.cpu_cores_effective),
      ram: n(o.cpu_ram) === null ? null : Number(o.cpu_ram) / 1024,
      disk: n(o.disk_space),
      region: o.geolocation || "Unspecified",
      price: o.dph_total,
      availability: o.rentable && !o.rented ? "available" : "unavailable",
      availableNodes: 1,
      reliability: n(o.reliability2 ?? o.reliability),
      verified: o.verification === "verified",
      bandwidth: n(o.inet_down),
      benchmark: n(o.dlperf),
      deployable: n(o.storage_cost) !== null && o.storage_cost >= 0,
      source: "https://docs.vast.ai/api-reference/search/search-offers",
      metadata: { storageCost: n(o.storage_cost) },
    })),
  );
}
const vast: ComputeProviderAdapter = {
  id: "vast",
  name: "Vast.ai",
  env: "VAST_API_KEY",
  docs: "https://docs.vast.ai",
  capabilities: [
    "Live offers",
    "Container provisioning",
    "Job state",
    "Terminate",
  ],
  async validateAccount(key) {
    const account = await request(
      "https://console.vast.ai/api/v0/users/current",
      key,
    );
    if (!account.id) throw new ProviderError("Vast.ai account validation", 401);
  },
  async listOffers(key) {
    const r = await request(
      "https://console.vast.ai/api/v0/bundles/",
      key ?? process.env.VAST_API_KEY!,
      "POST",
      {
        limit: 200,
        type: "on-demand",
        verified: { eq: true },
        rentable: { eq: true },
        rented: { eq: false },
      },
    );
    return normalizeVast(Array.isArray(r.offers) ? r.offers : []);
  },
  async createJob(o, i, key) {
    const r = await request(
      `https://console.vast.ai/api/v0/asks/${encodeURIComponent(o.providerOfferId)}/`,
      key ?? process.env.VAST_API_KEY!,
      "PUT",
      {
        client_id: "me",
        image: i.image,
        disk: i.disk,
        label: i.name,
        runtype: "ssh",
        onstart: i.command,
        env: vastEnvironment(i.env),
      },
    );
    if (!r.new_contract)
      throw new Error(
        "Provider did not return an instance ID; reconciliation required.",
      );
    return String(r.new_contract);
  },
  async getJob(id, key) {
    const r = await request(
      `https://console.vast.ai/api/v0/instances/${encodeURIComponent(id)}/`,
      key ?? process.env.VAST_API_KEY!,
    );
    const o = Array.isArray(r.instances) ? r.instances[0] : (r.instances ?? r);
    const states: Record<string, string> = {
      running: "RUNNING",
      loading: "BOOTING",
      created: "PROVISIONING",
      exited: "STOPPING",
      offline: "STOPPING",
    };
    return {
      state: states[o.actual_status] ?? "RECONCILIATION_REQUIRED",
      metrics: {
        gpuUtilization: n(o.gpu_util),
        gpuTemperature: n(o.gpu_temp),
        cpuUtilization: n(o.cpu_util),
        ramUsage: n(o.mem_usage),
      },
      logs: null,
    };
  },
  async stopJob(id, key) {
    await request(
      `https://console.vast.ai/api/v0/instances/${encodeURIComponent(id)}/`,
      key ?? process.env.VAST_API_KEY!,
      "DELETE",
    );
  },
};
const runpod: ComputeProviderAdapter = {
  id: "runpod",
  name: "Runpod",
  env: "RUNPOD_API_KEY",
  publicDiscovery: true,
  docs: "https://docs.runpod.io",
  capabilities: ["Public GPU catalog", "Stock status", "Discovery only"],
  async listOffers() {
    const r = await request("https://api.runpod.io/graphql", process.env.RUNPOD_API_KEY!, "POST", {
      query: "query { dataCenters { id location gpuAvailability(input:{gpuCount:1,secureCloud:true}) { gpuTypeId available } } gpuTypes { id displayName memoryInGb lowestPrice(input:{gpuCount:1,secureCloud:true}) { stockStatus uninterruptablePrice availableGpuCounts } } }",
    });
    if(r.errors) throw new Error("RunPod catalog query failed.");
    const gpus: Raw[] = r.data?.gpuTypes ?? [];
    const globalOffers = valid(gpus.filter(g=>g.lowestPrice?.uninterruptablePrice>0).map(g=>({
      ...base("runpod"),id: 'runpod:'+g.id,providerOfferId:g.id,hardware:hardwareId(g.displayName),gpuName:g.displayName,
      gpuCount:1,vram:g.memoryInGb,region:"Auto (secure cloud)",price:g.lowestPrice.uninterruptablePrice,
      availability:["High","Medium","Low"].includes(g.lowestPrice.stockStatus)?"available":"unknown",
      deployable:false,source:"https://graphql-spec.runpod.io/",metadata:{priceScope:"GPU catalog price; storage excluded",availableGpuCounts:g.lowestPrice.availableGpuCounts},
    })));
    const pairs: {gpu:Raw;dc:Raw}[]=[];
    for(const dc of r.data?.dataCenters??[]) for(const stock of dc.gpuAvailability??[]){
      const gpu=gpus.find(g=>g.id===stock.gpuTypeId);
      if(stock.available===true&&gpu&&typeof dc.id==="string"&&typeof dc.location==="string")pairs.push({gpu,dc});
    }
    // Resolve prices in bounded batches, scoped to the same datacenter as stock.
    const regional: Offer[]=[];
    for(let offset=0;offset<pairs.length;offset+=60){
      const chunks=[pairs.slice(offset,offset+20),pairs.slice(offset+20,offset+40),pairs.slice(offset+40,offset+60)].filter(c=>c.length);
      const results=await Promise.allSettled(chunks.map(async chunk=>{
        const query="query { "+chunk.map(({gpu,dc},i)=>'p'+i+':gpuTypes(input:{id:'+JSON.stringify(gpu.id)+'}) { lowestPrice(input:{gpuCount:1,secureCloud:true,dataCenterId:'+JSON.stringify(dc.id)+'}) { stockStatus uninterruptablePrice availableGpuCounts } }').join(' ')+" }";
        const priced=await request("https://api.runpod.io/graphql",process.env.RUNPOD_API_KEY!,"POST",{query});
        return valid(chunk.flatMap(({gpu,dc},i)=>{
          const price=priced.data?.['p'+i]?.[0]?.lowestPrice;
          if(!price||!(price.uninterruptablePrice>0)||!["High","Medium","Low"].includes(price.stockStatus))return [];
          return [{...base("runpod"),id:'runpod:'+gpu.id+':'+dc.id,providerOfferId:gpu.id,hardware:hardwareId(gpu.displayName),gpuName:gpu.displayName,gpuCount:1,vram:gpu.memoryInGb,
            region:dc.id+' · '+dc.location,price:price.uninterruptablePrice,availability:"available",deployable:false,source:"https://graphql-spec.runpod.io/",
            metadata:{dataCenterId:dc.id,country:dc.location,priceScope:"Datacenter-specific GPU price; storage excluded",availableGpuCounts:price.availableGpuCounts}}];
        }));
      }));
      for(const result of results)if(result.status==="fulfilled")regional.push(...result.value);
    }
    const locatedGpuIds=new Set(regional.map(o=>o.providerOfferId));
    return [...regional,...globalOffers.filter(o=>!locatedGpuIds.has(o.providerOfferId))];
  },
  async createJob(o, i) {
    const r = await request(
      "https://rest.runpod.io/v1/pods",
      process.env.RUNPOD_API_KEY!,
      "POST",
      {
        name: i.name,
        imageName: i.image,
        gpuTypeIds: [o.providerOfferId],
        gpuCount: o.gpuCount,
        cloudType: "SECURE",
        computeType: "GPU",
        interruptible: false,
        containerDiskInGb: i.disk,
        volumeInGb: 0,
        dockerStartCmd: i.command ? ["sh", "-lc", i.command] : [],
        env: i.env,
        ports: [],
      },
    );
    if (!r.id)
      throw new Error(
        "Provider did not return a pod ID; reconciliation required.",
      );
    return r.id;
  },
  async getJob(id) {
    const r = await request(
      `https://rest.runpod.io/v1/pods/${encodeURIComponent(id)}`,
      process.env.RUNPOD_API_KEY!,
    );
    return {
      state:
        r.desiredStatus === "RUNNING"
          ? "BOOTING"
          : r.desiredStatus === "EXITED"
            ? "STOPPING"
            : "PROVISIONING",
      metrics: {
        gpuUtilization: null,
        gpuTemperature: null,
        cpuUtilization: null,
        ramUsage: null,
      },
      logs: null,
    };
  },
  async stopJob(id) {
    await request(
      `https://rest.runpod.io/v1/pods/${encodeURIComponent(id)}`,
      process.env.RUNPOD_API_KEY!,
      "DELETE",
    );
  },
};
const lambda: ComputeProviderAdapter = {
  id: "lambda",
  name: "Lambda",
  env: "LAMBDA_API_KEY",
  docs: "https://docs.lambda.ai/api/cloud",
  capabilities: ["Live pricing", "Regional capacity", "Machine specifications"],
  async listOffers() {
    const r = await request(
      "https://cloud.lambda.ai/api/v1/instance-types",
      process.env.LAMBDA_API_KEY!,
    );
    return valid(
      Object.values(r.data ?? {}).flatMap((v: any) => {
        const t = v.instance_type;
        return (v.regions_with_capacity_available ?? []).map((region: Raw) => ({
          ...base("lambda"),
          id: `lambda:${t.name}:${region.name}`,
          providerOfferId: t.name,
          hardware: hardwareId(t.gpu_description),
          gpuName: t.gpu_description,
          gpuCount: t.specs.gpus,
          cpu: t.specs.vcpus,
          ram: t.specs.memory_gib,
          disk: t.specs.storage_gib,
          vram: Number(t.gpu_description.match(/(\d+)\s*GB/i)?.[1]) || null,
          region: region.name,
          price: t.price_cents_per_hour / 100,
          availability: "available",
          source: "https://docs.lambda.ai/api/cloud",
        }));
      }),
    );
  },
};
export const adapters = [vast, runpod, lambda];
export const researchProviders = [
  {
    id: "akash",
    name: "Akash Network",
    docs: "https://akash.network/docs/api-documentation/rest-api/providers-api/",
    detail:
      "Deployment bids and Cosmos escrow require a separate lease workflow.",
  },
  {
    id: "hyperstack",
    name: "Hyperstack",
    docs: "https://docs.hyperstack.cloud",
    detail:
      "Flavor and pricebook API available. Account-specific integration not enabled.",
  },
  {
    id: "salad",
    name: "SaladCloud",
    docs: "https://docs.salad.com",
    detail: "Container groups use organization and project-scoped APIs.",
  },
  {
    id: "tensordock",
    name: "TensorDock",
    docs: "https://docs.tensordock.com",
    detail: "Account API access and deployment validation required.",
  },
  {
    id: "io",
    name: "io.net",
    docs: "https://docs.io.net",
    detail: "Cluster access requires an authenticated account; not connected.",
  },
  {
    id: "fluidstack",
    name: "Fluidstack",
    docs: "https://www.fluidstack.io",
    detail: "Enterprise capacity requires a commercial agreement.",
  },
  {
    id: "coreweave",
    name: "CoreWeave",
    docs: "https://docs.coreweave.com",
    detail: "Account-scoped Kubernetes access required.",
  },
  {
    id: "golem",
    name: "Golem",
    docs: "https://docs.golem.network",
    detail:
      "Requestor runtime and GLM payment driver required; separate execution model.",
  },
];
let cache: { at: number; offers: Offer[]; providers: ProviderStatus[] } | null =
  null;
let inventoryPending: Promise<{at:number;offers:Offer[];providers:ProviderStatus[]}> | null = null;
export function inventory(force = false) {
  if(inventoryPending)return inventoryPending;
  inventoryPending=loadInventory(force).finally(()=>{inventoryPending=null;});
  return inventoryPending;
}
async function loadInventory(force = false) {
  if (!force && cache && Date.now() - cache.at < 60000) return cache;
  const results = await Promise.all(
    adapters.map(async (a) => {
      let offers: Offer[] = [];
      let status: ProviderStatus["status"] = "credentials_required";
      let detail = `Set ${a.env} on the server to connect.`;
      if (process.env[a.env] || a.publicDiscovery)
        try {
          offers = await a.listOffers();
          status = "connected";
          detail = `${offers.length} normalized observations. ${a.id === "runpod" ? "Public catalog connection. GPU pricing only; provisioning requires a complete location and storage quote." : ""}`;
        } catch (e) {
          status = "error";
          detail =
            e instanceof ProviderError
              ? e.message
              : "Provider request failed. Retry later or check account access.";
        }
      return {
        offers,
        status: {
          id: a.id,
          name: a.name,
          status,
          detail,
          docs: a.docs,
          capabilities: a.capabilities,
          offers: offers.length,
        },
      };
    }),
  );
  cache = {
    at: Date.now(),
    offers: results.flatMap((r) => r.offers),
    providers: [
      ...results.map((r) => r.status),
      ...researchProviders.map((p) => ({
        ...p,
        status: "research" as const,
        capabilities: [],
        offers: 0,
      })),
    ],
  };
  return cache;
}
