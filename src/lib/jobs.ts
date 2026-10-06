import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, get, put, ServiceError } from "./db";
import { hash } from "./auth";
import { adapters } from "./providers";
import { credential, ownerInventory } from "./connections";
import type { Job, Quote } from "./types";
export const policySchema = z.object({
  maxCostPerJob: z.number().min(0).max(100000).default(10),
  maxDailyCost: z.number().min(0).max(100000).default(25),
  maxDuration: z.number().positive().max(168).default(4),
  allowedGpus: z.array(z.string()).default(["H100", "A100", "L40S"]),
  allowedProviders: z.array(z.string()).default(["vast"]),
  allowedRegions: z.array(z.string()).default([]),
  enabled: z.boolean().default(false),
});
export type Policy = z.infer<typeof policySchema>;
export const defaultPolicy = policySchema.parse({});
export const workloadSchema = z.object({
  image: z
    .string()
    .min(3)
    .max(240)
    .regex(/^[a-zA-Z0-9./_:@-]+$/),
  command: z.string().max(4096).default(""),
  env: z
    .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string().max(8192))
    .default({}),
  disk: z.number().int().min(10).max(2000).default(20),
});
export async function event(owner: string, type: string, payload: object) {
  await db()`insert into events(id,owner,type,payload) values(${randomUUID()},${owner},${type},${db().json(payload as any)})`;
}
export function checkPolicy(policy: Policy, quote: Quote, spent: number) {
  if (!policy.enabled)
    throw new ServiceError(
      "Enable and configure agent authorization before using an API key to launch.",
      403,
    );
  if (
    quote.total > policy.maxCostPerJob ||
    spent + quote.total > policy.maxDailyCost ||
    quote.durationHours > policy.maxDuration ||
    !policy.allowedGpus.includes(quote.offer.hardware) ||
    !policy.allowedProviders.includes(quote.offer.provider) ||
    (policy.allowedRegions.length &&
      !policy.allowedRegions.includes(quote.offer.region))
  )
    throw new ServiceError(
      "This quote exceeds the authorized spending or hardware policy.",
      403,
    );
}
export async function launch(
  owner: string,
  agent: boolean,
  quoteId: string,
  workload: z.infer<typeof workloadSchema>,
  confirmed: boolean,
) {
  if (!confirmed)
    throw new ServiceError("Explicit cost confirmation is required.");
  const quote = await get<Quote>("quote", quoteId, owner);
  if (!quote) throw new ServiceError("Quote not found.", 404);
  const credentialId =
    typeof quote.offer.metadata?.credentialId === "string"
      ? quote.offer.metadata.credentialId
      : undefined;
  const providerKey = credentialId
    ? await credential(owner, credentialId, quote.offer.provider)
    : undefined;
  const allow = (process.env.PROVISIONING_WALLETS ?? "")
    .toLowerCase()
    .split(",")
    .map((v) => v.trim());
  if (
    credentialId
      ? process.env.ENABLE_SELF_SERVICE !== "true"
      : process.env.ENABLE_PROVISIONING !== "true" || !allow.includes(owner)
  )
    throw new ServiceError(
      "Connect your own funded Vast.ai account in Settings to launch. Operator-funded rentals require separate authorization.",
      403,
    );
  if (process.env.SCHEDULER_ENABLED !== "true")
    throw new ServiceError(
      "A runtime enforcement scheduler must be configured before provisioning.",
      503,
    );
  const heartbeat = await get<{ lastRun: string }>(
    "system",
    "scheduler",
    "system",
  );
  if (!heartbeat || Date.now() - Date.parse(heartbeat.lastRun) > 180000)
    throw new ServiceError(
      "Runtime enforcement scheduler is not healthy. A successful run within three minutes is required.",
      503,
    );
  if (Date.parse(quote.expiresAt) < Date.now())
    throw new ServiceError("Quote expired. Request a fresh quote.", 409);
  const adapter = adapters.find((a) => a.id === quote.offer.provider);
  if (!adapter?.createJob || !quote.offer.deployable)
    throw new ServiceError(
      "This provider offer is discovery-only; provisioning is not enabled.",
      422,
    );
  const fresh = (await ownerInventory(owner, true)).offers.find(
    (o) => o.id === quote.offer.id,
  );
  if (
    !fresh ||
    !fresh.deployable ||
    fresh.availability !== "available" ||
    fresh.price > quote.offer.price ||
    fresh.price +
      (Number(fresh.metadata?.storageCost ?? 0) * workload.disk) / 720 >
      quote.hourly
  )
    throw new ServiceError(
      "Capacity or pricing changed. Request a new quote.",
      409,
    );
  if (workload.disk > (fresh.disk ?? 0))
    throw new ServiceError("Requested disk exceeds available capacity.");
  // Serialize reservations per owner; the quote is consumed once even across concurrent processes.
  const job = await db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext(${owner}))`;
    if (credentialId) {
      const current =
        await sql`select id from records where kind='connection' and id=${credentialId} and owner=${owner}`;
      if (!current.length)
        throw new ServiceError(
          "Provider connection changed. Request a fresh quote.",
          409,
        );
    }
    const prior =
      await sql`select body from records where kind='job' and owner=${owner} and body->>'quoteId'=${quoteId}`;
    if (prior.length) return prior[0].body as Job;
    // The minute worker handles at most 25 jobs. Admit fewer than that across all wallets.
    await sql`select pg_advisory_xact_lock(hashtext('exaflop:launch-capacity'))`;
    const active =
      await sql`select count(*) as total from records where kind='job' and body->>'endedAt' is null`;
    if (Number(active[0].total) >= 20)
      throw new ServiceError(
        "The managed rental queue is full. Use provider checkout or retry after a rental finishes.",
        503,
      );
    const locked =
      await sql`select body from records where kind='quote' and id=${quoteId} and owner=${owner} for update`;
    if (!locked.length || locked[0].body.status !== "QUOTE")
      throw new ServiceError("Quote already consumed.", 409);
    if (Date.parse(locked[0].body.expiresAt) < Date.now())
      throw new ServiceError("Quote expired while reserving capacity.", 409);
    const used =
      await sql`select coalesce(sum((body->>'reserved')::numeric),0) as total from records where kind='job' and owner=${owner} and (created_at>=date_trunc('day',now()) or body->>'endedAt' is null or (body->>'endedAt')::timestamptz>=date_trunc('day',now()))`;
    if (agent || credentialId) {
      const p =
        await sql`select body from records where kind='policy' and id=${owner} and owner=${owner}`;
      const policy = p[0]?.body ?? defaultPolicy;
      checkPolicy(
        agent ? policy : { ...policy, enabled: true },
        quote,
        Number(used[0].total),
      );
    }
    const job: Job = {
      id: randomUUID(),
      ...(credentialId ? { credentialId } : {}),
      owner,
      quoteId,
      provider: quote.offer.provider,
      providerJobId: null,
      hardware: quote.offer.hardware,
      gpuCount: quote.offer.gpuCount,
      region: quote.offer.region,
      hourly: quote.hourly,
      reserved: quote.total,
      durationHours: quote.durationHours,
      state: "PROVISIONING",
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      workloadHash: hash(
        JSON.stringify({ image: workload.image, command: workload.command }),
      ),
      image: workload.image,
    };
    await sql`insert into records(kind,id,owner,body) values('job',${job.id},${owner},${sql.json(job as any)})`;
    await sql`update records set body=jsonb_set(body,'{status}','"CONSUMED"') where kind='quote' and id=${quoteId}`;
    return job;
  });
  if (job.providerJobId || job.state !== "PROVISIONING") return job;
  // Claim dispatch once. Never automatically retry an ambiguous provider creation response.
  const claim =
    await db()`update records set body=jsonb_set(body,'{state}','"BOOTING"') where kind='job' and id=${job.id} and body->>'state'='PROVISIONING' returning id`;
  if (!claim.length) return await get<Job>("job", job.id, owner);
  job.state = "BOOTING";
  try {
    job.providerJobId = await adapter.createJob(
      fresh,
      {
        ...workload,
        name: `exaflop-${job.id}`,
      },
      providerKey,
    );
    job.startedAt = new Date().toISOString();
    await put("job", job.id, owner, job);
    await event(owner, "job.started", { jobId: job.id });
  } catch {
    job.state = "RECONCILIATION_REQUIRED";
    job.error =
      "Provider creation outcome is uncertain. Check the provider console for exaflop-" +
      job.id +
      " before attempting another launch.";
    await put("job", job.id, owner, job);
    await event(owner, "job.failed", { jobId: job.id, message: job.error });
  }
  return job;
}
export function receipt(job: Job) {
  const end = job.endedAt;
  const hours =
    job.startedAt && end
      ? Math.max(0, (Date.parse(end) - Date.parse(job.startedAt)) / 3600000)
      : null;
  const r = {
    version: 1,
    jobId: job.id,
    provider: job.provider,
    providerJobIdHash: hash(job.providerJobId ?? ""),
    hardware: job.hardware,
    gpuCount: job.gpuCount,
    start: job.startedAt,
    end,
    gpuHours: hours === null ? null : hours * job.gpuCount,
    estimatedCostUsd: hours === null ? null : hours * job.hourly,
    wallet: job.owner,
    workloadHash: job.workloadHash,
    billing:
      "Provider-side USD billing. Estimate excludes network egress and other provider charges.",
    attestation: "Job Receipt Attestation; not proof of physical execution.",
  };
  return {
    ...r,
    receiptHash: `0x${hash(JSON.stringify(r))}`,
    transactionHash: job.transactionHash ?? null,
  };
}
export async function stop(job: Job) {
  if (!job.providerJobId)
    throw new ServiceError(
      "Provider job ID is unavailable; reconcile in the provider console.",
      409,
    );
  if (job.endedAt) return job;
  const a = adapters.find((a) => a.id === job.provider);
  if (!a?.stopJob)
    throw new ServiceError("Provider does not support termination.", 422);
  const claim = randomUUID();
  const claimed =
    await db()`update records set body=body || ${db().json({ state: "STOPPING", stopClaim: claim, stopRequestedAt: new Date().toISOString() })} where kind='job' and id=${job.id} and owner=${job.owner} and body->>'endedAt' is null and (body->>'stopClaim' is null or (body->>'stopRequestedAt')::timestamptz<now()-interval '2 minutes') returning id`;
  if (!claimed.length) return (await get<Job>("job", job.id, job.owner)) ?? job;
  try {
    const key = job.credentialId
      ? await credential(job.owner, job.credentialId, job.provider)
      : undefined;
    await a.stopJob(job.providerJobId, key);
    const finished =
      await db()`update records set body=(body-'stopClaim'-'stopRequestedAt') || ${db().json({ state: "COMPLETED", endedAt: new Date().toISOString() })} where kind='job' and id=${job.id} and owner=${job.owner} and body->>'stopClaim'=${claim} and body->>'endedAt' is null returning body`;
    if (finished.length) {
      await event(job.owner, "job.stopped", { jobId: job.id });
      return finished[0].body as Job;
    }
    return (await get<Job>("job", job.id, job.owner)) ?? job;
  } catch (error) {
    await db()`update records set body=body-'stopClaim' where kind='job' and id=${job.id} and owner=${job.owner} and body->>'stopClaim'=${claim}`;
    throw error;
  }
}
export async function sync(job: Job) {
  if (!job.providerJobId || job.endedAt)
    return { job, metrics: {}, logs: null };
  const a = adapters.find((a) => a.id === job.provider);
  const key = job.credentialId
    ? await credential(job.owner, job.credentialId, job.provider)
    : undefined;
  const data = await a?.getJob?.(job.providerJobId, key);
  if (data) {
    job.state = data.state;
    if (["COMPLETED", "FAILED"].includes(job.state)) {
      job.endedAt = new Date().toISOString();
    }
    // A poll started before termination must never resurrect a finished job.
    const changed =
      await db()`update records set body=${db().json(job as any)} where kind='job' and id=${job.id} and owner=${job.owner} and body->>'endedAt' is null and body->>'state'!='STOPPING' returning id`;
    if (!changed.length) {
      const current = await get<Job>("job", job.id, job.owner);
      return { job: current ?? job, metrics: data.metrics, logs: data.logs };
    }
    if (job.endedAt) {
      await event(
        job.owner,
        job.state === "COMPLETED" ? "job.completed" : "job.failed",
        { jobId: job.id },
      );
    }
  }
  return { job, metrics: data?.metrics ?? {}, logs: data?.logs ?? null };
}
