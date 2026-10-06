import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createPublicClient, http } from "viem";
import { db, get, list, put, remove, ServiceError } from "@/lib/db";
import {
  identity,
  origin,
  challenge,
  authenticate,
  secret,
  hash,
  rate,
} from "@/lib/auth";
import { inventory, ProviderError } from "@/lib/providers";
import {
  connections,
  saveConnection,
  disconnect,
  ownerInventory,
} from "@/lib/connections";
import { withChanges } from "@/lib/history";
import { hardware } from "@/lib/catalog";
import { markets, parseSearch, rankOffers, median } from "@/lib/engine";
import {
  launch,
  stop,
  sync,
  receipt,
  policySchema,
  defaultPolicy,
  workloadSchema,
} from "@/lib/jobs";
import { cron } from "@/lib/cron";
import { chain } from "@/lib/chain";
import type { Job, Quote } from "@/lib/types";
import { encrypt, webhookUrl, eventTypes, type Webhook } from "@/lib/webhooks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const searchSchema = z.object({
  hardware: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(1024).default(1),
  durationHours: z.coerce.number().min(0.1).max(168).default(1),
  region: z.string().optional(),
  minVram: z.coerce.number().min(0).optional(),
  minRam: z.coerce.number().min(0).optional(),
  minCpu: z.coerce.number().min(0).optional(),
  disk: z.coerce.number().min(0).optional(),
  budget: z.coerce.number().positive().optional(),
  strategy: z
    .enum([
      "cheapest",
      "fastest",
      "balanced",
      "low-latency",
      "max-performance",
      "reliable",
      "available-now",
    ])
    .default("balanced"),
  workload: z.string().optional(),
});
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await ctx.params).path;
    const route = p.join("/");
    const write = req.method === "POST";
    if (write) origin(req);
    if (Number(req.headers.get("content-length") ?? 0) > 65536)
      throw new ServiceError("Request body too large.", 413);
    let body: any = {};
    if (write) {
      const raw = await req.text();
      if (raw.length > 65536)
        throw new ServiceError("Request body too large.", 413);
      body = JSON.parse(raw || "{}");
    }
    if (route === "health") {
      const heartbeat = process.env.DATABASE_URL
        ? await get<{ lastRun: string }>("system", "scheduler", "system")
        : undefined;
      return json({
        service: "QuantumPad",
        database: !!process.env.DATABASE_URL,
        provisioning: process.env.ENABLE_PROVISIONING === "true",
        selfService: process.env.ENABLE_SELF_SERVICE === "true",
        schedulerHealthy:
          !!heartbeat && Date.now() - Date.parse(heartbeat.lastRun) < 180000,
        schedulerLastRun: heartbeat?.lastRun ?? null,
        chainId: chain.id,
      });
    }
    if (route === "hardware") return json({ hardware });
    if (["markets", "providers", "offers", "index"].includes(route)) {
      const data = await inventory();
      const ms = await withChanges(markets(data.offers));
      if (route === "providers") return json({ providers: data.providers });
      if (route === "markets")
        return json({
          markets: ms,
          providers: data.providers,
          observedAt: new Date(data.at).toISOString(),
        });
      if (route === "offers") {
        const input = searchSchema.parse(
          Object.fromEntries(req.nextUrl.searchParams),
        );
        return json({
          offers: rankOffers(data.offers, input),
          providers: data.providers,
          input,
        });
      }
      return json({
        markets: ms,
        value: median(ms.flatMap((m) => (m.median === null ? [] : [m.median]))),
        unit: "USD / GPU-hour",
        methodology:
          "Equal-weight median of observed hardware medians. Composition changes affect the aggregate; this is not a financial instrument.",
        observedAt: new Date(data.at).toISOString(),
      });
    }
    if (route === "search") {
      const text = z
        .string()
        .max(1000)
        .parse(body.query ?? req.nextUrl.searchParams.get("q") ?? "");
      const parsed = parseSearch(text);
      return json({
        input: parsed,
        offers: rankOffers((await inventory()).offers, parsed),
      });
    }
    if (route === "history") {
      if (!process.env.DATABASE_URL)
        return json({ observations: [], status: "storage_not_configured" });
      const h = req.nextUrl.searchParams.get("hardware");
      const rows = h
        ? await db()`select observed_at as timestamp,percentile_cont(0.5) within group(order by price/gpu_count) as price,sum(nodes*gpu_count) as capacity from observations where hardware=${h} group by observed_at order by observed_at desc limit 5000`
        : await db()`select observed_at as timestamp,percentile_cont(0.5) within group(order by price/gpu_count) as price from observations group by observed_at order by observed_at desc limit 5000`;
      return json({ observations: rows.reverse(), status: "ready" });
    }
    if (route === "cron") {
      if (
        !process.env.CRON_SECRET ||
        req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
      )
        throw new ServiceError("Unauthorized scheduler.", 401);
      return json(await cron());
    }
    if (route === "auth/challenge" && write)
      return json(await challenge(z.string().parse(body.address), req));
    if (route === "auth/verify" && write) {
      const b = z
        .object({
          nonce: z.string().length(64),
          signature: z.string().regex(/^0x[0-9a-f]+$/i),
        })
        .parse(body);
      const a = await authenticate(b.nonce, b.signature as `0x${string}`);
      const res = json({ owner: a.owner });
      res.cookies.set("exaflop_session", a.token, {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      });
      return res;
    }
    if (route === "auth/logout" && write) {
      const token = req.cookies.get("exaflop_session")?.value;
      if (token && process.env.DATABASE_URL)
        await db()`delete from sessions where hash=${hash(token)}`;
      const r = json({ ok: true });
      r.cookies.delete("exaflop_session");
      return r;
    }
    const who = await identity(
      req,
      ["keys", "policy", "webhooks", "connections"].includes(p[0]),
    );
    const owner = who.owner;
    if (route === "me") return json({ owner });
    if (p[0] === "connections") {
      if (p[1] && req.method === "DELETE") {
        await disconnect(owner, p[1]);
        return json({ ok: true });
      }
      if (write) {
        await rate(`connection:${owner}`, 5);
        const input = z
          .object({
            provider: z.literal("vast"),
            key: z
              .string()
              .trim()
              .min(16)
              .max(512)
              .regex(/^[A-Za-z0-9_.-]+$/),
            confirmed: z.literal(true),
          })
          .parse(body);
        return json(await saveConnection(owner, input.key), 201);
      }
      return json({ connections: await connections(owner) });
    }
    if (route === "my/offers") {
      const input = searchSchema.parse(
        Object.fromEntries(req.nextUrl.searchParams),
      );
      return json({
        offers: rankOffers((await ownerInventory(owner)).offers, input),
        input,
      });
    }
    if (p[0] === "quotes") {
      if (write && p.length === 1) {
        await rate(`quote:${owner}`, 20);
        const input = z
          .object({
            offerId: z.string().max(256),
            durationHours: z.number().min(0.1).max(168),
            disk: z.number().int().min(10).max(2000).default(20),
          })
          .parse(body);
        const o = (await ownerInventory(owner, true)).offers.find(
          (o) => o.id === input.offerId,
        );
        if (!o || o.availability === "unavailable")
          throw new ServiceError("Offer is no longer available.", 409);
        const storage =
          o.provider === "vast"
            ? (Number(o.metadata?.storageCost ?? 0) * input.disk) / 720
            : 0;
        const q: Quote = {
          id: randomUUID(),
          owner,
          offer: { ...o, metadata: { ...o.metadata, quotedDisk: input.disk } },
          hourly: o.price + storage,
          total: (o.price + storage) * input.durationHours,
          durationHours: input.durationHours,
          expiresAt: new Date(Date.now() + 120000).toISOString(),
          createdAt: new Date().toISOString(),
          status: "QUOTE",
        };
        await put("quote", q.id, owner, q);
        return json(q, 201);
      }
      const q = await get("quote", p[1], owner);
      if (!q) throw new ServiceError("Quote not found.", 404);
      return json(q);
    }
    if (p[0] === "jobs") {
      if (p.length === 1) {
        if (!write) return json({ jobs: await list<Job>("job", owner) });
        const input = z
          .object({
            quoteId: z.string().uuid(),
            confirmed: z.literal(true),
            workload: workloadSchema,
          })
          .parse(body);
        const q = await get<Quote>("quote", input.quoteId, owner);
        if (q && q.offer.metadata?.quotedDisk !== input.workload.disk)
          throw new ServiceError(
            "Storage changed; request a fresh quote.",
            409,
          );
        return json(
          await launch(
            owner,
            who.agent,
            input.quoteId,
            input.workload,
            input.confirmed,
          ),
          201,
        );
      }
      const job = await get<Job>("job", p[1], owner);
      if (!job) throw new ServiceError("Job not found.", 404);
      if (p[2] === "stop" && write) return json(await stop(job));
      if (p[2] === "receipt") {
        if (!job.endedAt)
          throw new ServiceError(
            "Receipt is available after the job ends.",
            409,
          );
        return json(receipt(job));
      }
      if (p[2] === "attest" && write) {
        if (!job.endedAt)
          throw new ServiceError("Only completed jobs can be attested.");
        const tx = z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/)
          .parse(body.transactionHash) as `0x${string}`;
        const client = createPublicClient({
          chain,
          transport: http(
            process.env.ROBINHOOD_RPC_URL ?? chain.rpcUrls.default.http[0],
          ),
        });
        const [transaction, confirmation] = await Promise.all([
          client.getTransaction({ hash: tx }),
          client.getTransactionReceipt({ hash: tx }),
        ]);
        if (
          confirmation.status !== "success" ||
          transaction.from.toLowerCase() !== owner ||
          transaction.to?.toLowerCase() !== owner ||
          transaction.value !== BigInt(0) ||
          transaction.input !== receipt(job).receiptHash
        )
          throw new ServiceError(
            "Transaction does not match the canonical receipt.",
            422,
          );
        job.transactionHash = tx;
        await put("job", job.id, owner, job);
        return json(receipt(job));
      }
      const state = await sync(job);
      if (p[2] === "logs")
        return json({
          logs: state.logs,
          status: state.logs ? "available" : "unavailable",
          message:
            "Logs are not exposed by the configured provider adapter. Use the provider console.",
        });
      return json(state);
    }
    if (p[0] === "keys") {
      if (p[1] && write) {
        await db()`update api_keys set revoked=true where id=${p[1]} and owner=${owner}`;
        return json({ ok: true });
      }
      if (write) {
        const name = z.string().min(1).max(80).parse(body.name);
        const token = `exf_${secret()}`;
        await db()`insert into api_keys(id,owner,name,hash,prefix) values(${randomUUID()},${owner},${name},${hash(token)},${token.slice(0, 12)})`;
        return json({ key: token }, 201);
      }
      return json({
        keys: await db()`select id,name,prefix,created_at,revoked from api_keys where owner=${owner} order by created_at desc`,
      });
    }
    if (route === "policy") {
      if (write) {
        const policy = policySchema.parse(body);
        await put("policy", owner, owner, policy);
        return json(policy);
      }
      return json((await get("policy", owner, owner)) ?? defaultPolicy);
    }
    if (p[0] === "machines") {
      if (p[1] && req.method === "GET") {
        const machine = await get("machine", p[1], owner);
        if (!machine) throw new ServiceError("Machine not found.", 404);
        return json(machine);
      }
      if (p[1] && req.method === "DELETE") {
        await remove("machine", p[1], owner);
        return json({ ok: true });
      }
      if (write) {
        const data = z
          .object({
            id: z.string().uuid().optional(),
            name: z.string().min(1).max(80),
            configuration: searchSchema,
          })
          .parse(body);
        const machine = { ...data, id: data.id ?? randomUUID() };
        await put("machine", machine.id, owner, machine);
        return json(machine, 201);
      }
      return json({ machines: await list("machine", owner) });
    }
    if (p[0] === "alerts") {
      if (p[1] && req.method === "DELETE") {
        await remove("alert", p[1], owner);
        return json({ ok: true });
      }
      if (write) {
        const a = z
          .object({
            type: z.enum([
              "HARDWARE_AVAILABLE",
              "PRICE_BELOW",
              "CAPACITY_ABOVE",
            ]),
            hardware: z.string().max(40),
            threshold: z.number().min(0),
            enabled: z.boolean().default(true),
          })
          .parse(body);
        const alert = { ...a, id: randomUUID() };
        await put("alert", alert.id, owner, alert);
        return json(alert, 201);
      }
      const [alerts, events] = await Promise.all([
        list("alert", owner),
        db()`select id,type,payload,created_at from events where owner=${owner} order by created_at desc limit 100`,
      ]);
      return json({ alerts, events });
    }
    if (p[0] === "webhooks") {
      if (p[1] && req.method === "DELETE") {
        await remove("webhook", p[1], owner);
        return json({ ok: true });
      }
      if (write) {
        const input = z
          .object({
            url: z.string().url().max(2048),
            events: z.array(z.enum(eventTypes as [string, ...string[]])).min(1),
          })
          .parse(body);
        webhookUrl(input.url);
        const signingSecret = secret();
        const hook: Webhook = {
          id: randomUUID(),
          url: input.url,
          events: input.events,
          enabled: true,
          encryptedSecret: encrypt(signingSecret),
          createdAt: new Date().toISOString(),
        };
        await put("webhook", hook.id, owner, hook);
        return json({ id: hook.id, secret: signingSecret }, 201);
      }
      const hooks = await list<Webhook>("webhook", owner);
      return json({
        webhooks: hooks.map(({ encryptedSecret, ...hook }) => hook),
      });
    }
    if (route === "events")
      return json({
        events:
          await db()`select id,type,payload,created_at from events where owner=${owner} order by created_at desc limit 100`,
      });
    throw new ServiceError("Endpoint not found.", 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: "Invalid request",
          details: e.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        400,
      );
    if (e instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
    if (e instanceof ProviderError)
      return json(
        { error: e.message },
        e.status === 401 || e.status === 403 ? 400 : 502,
      );
    if (e instanceof ServiceError) return json({ error: e.message }, e.status);
    console.error(
      "QuantumPad request failed:",
      e instanceof Error ? e.name : "Unknown",
    );
    return json(
      {
        error:
          "The service could not complete this request. Check database configuration or provider availability.",
      },
      503,
    );
  }
}
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
