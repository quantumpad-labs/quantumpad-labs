"use client";
import { BrandLogo, HardwareLogo } from "./brand-logo";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Cpu,
  Layers3,
  Play,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useApp, api, money } from "./shell";
import { PageHead, Empty, Metric } from "./terminal";
import { Rack } from "./visuals";
import { CloudLaunch } from "./cloud-launch";
import { hardware, templates } from "@/lib/catalog";
import { estimateModel } from "@/lib/engine";
import type { Offer, Quote, Search } from "@/lib/types";
const strategies = [
  ["balanced", "Balanced"],
  ["cheapest", "Cheapest"],
  ["fastest", "Fastest"],
  ["low-latency", "Low latency"],
  ["max-performance", "Max performance"],
  ["reliable", "Reliable"],
  ["available-now", "Available now"],
];
export function Builder({ calculator = false }: { calculator?: boolean }) {
  const { owner, connect, notify } = useApp();
  const [config, setConfig] = useState<Search>({
    hardware: "H100",
    quantity: 1,
    durationHours: 1,
    region: "auto",
    strategy: "balanced",
    disk: 50,
    minRam: 0,
    minCpu: 0,
  });
  const [template, setTemplate] = useState("inference");
  const [image, setImage] = useState(templates[0].image);
  const [command, setCommand] = useState(templates[0].command);
  const [env, setEnv] = useState("");
  const [results, setResults] = useState<
    (Offer & { why: string; estimatedTotal: number })[] | null
  >(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [machineId, setMachineId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setResults(null);
    setQuote(null);
    setConfirmed(false);
  }, [owner]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const preset = templates.find((t) => t.id === p.get("template"));
    if (preset) {
      setTemplate(preset.id);
      setImage(preset.image);
      setCommand(preset.command);
    }
    setConfig((c) => ({
      ...c,
      hardware: p.get("gpu") ?? c.hardware,
      region: p.get("region")?.slice(0, 200) || c.region,
      quantity: Math.min(1024, Math.max(1, Number(p.get("quantity") ?? 1))),
      durationHours: Math.min(
        168,
        Math.max(0.1, Number(p.get("duration") ?? 1)),
      ),
    }));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("machine");
    if (id && owner)
      api(`machines/${id}`)
        .then((m) => {
          setConfig(m.configuration);
          setSaveName(m.name);
          setMachineId(m.id);
        })
        .catch((e) => notify(e.message));
  }, [owner, notify]);
  const update = (key: keyof Search, value: string | number) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setQuote(null);
    setResults(null);
    setConfirmed(false);
  };
  async function route() {
    setBusy(true);
    setQuote(null);
    try {
      const params = new URLSearchParams();
      Object.entries(config).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== 0) params.set(k, String(v));
      });
      const r = await api(`${owner ? "my/offers" : "offers"}?${params}`);
      setResults(r.offers);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function requestQuote(o: Offer) {
    if (!owner) {
      await connect();
      return;
    }
    setBusy(true);
    try {
      setQuote(
        await api("quotes", {
          offerId: o.id,
          durationHours: config.durationHours,
          disk: config.disk,
        }),
      );
      setConfirmed(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function boot() {
    if (!quote) return;
    setBusy(true);
    try {
      const variables: Record<string, string> = {};
      for (const line of env.split("\n").filter(Boolean)) {
        const split = line.indexOf("=");
        if (split < 1)
          throw new Error("Use KEY=value for each environment variable.");
        variables[line.slice(0, split).trim()] = line.slice(split + 1);
      }
      const job = await api("jobs", {
        quoteId: quote.id,
        confirmed,
        workload: { image, command, env: variables, disk: config.disk },
      });
      window.location.href = `/jobs/${job.id}`;
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!owner) {
      await connect();
      return;
    }
    setSaving(true);
    try {
      await api("machines", {
        id: machineId,
        name: saveName || `${config.quantity} × ${config.hardware}`,
        configuration: config,
      });
      notify("Machine saved to your wallet workspace.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const h = hardware.find((h) => h.id === config.hardware);
  const expired = quote && now > Date.parse(quote.expiresAt);
  return (
    <div className="page">
      <PageHead
        eyebrow={
          calculator
            ? "TOOLS / COST CALCULATOR"
            : "DEPLOY / SUPERCOMPUTER BUILDER"
        }
        title={
          calculator
            ? "Know the cost. Before the compute."
            : "Build your machine."
        }
        description="Configure your hardware. Find a real offer. Review every detail before launch."
        action={
          <span className="badge green">
            <ShieldCheck size={13} /> NO CHARGE UNTIL CONFIRMATION
          </span>
        }
      />
      <div className="builder-layout">
        <section className="panel configuration">
          <div className="panel-title">
            <span className="step">01</span>
            <h2>Machine configuration</h2>
            <SlidersHorizontal size={17} />
          </div>
          <div className="config-body">
            <label>
              ACCELERATOR
              <select
                value={config.hardware}
                onChange={(e) => update("hardware", e.target.value)}
              >
                {hardware.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.memory ? ` · ${h.memory} GB` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="quantity-heading">
              <label htmlFor="quantity">GPU QUANTITY</label>
              <strong>
                {config.quantity}
                <small>GPUs</small>
              </strong>
            </div>
            <input
              id="quantity"
              aria-label="GPU quantity"
              type="range"
              min="1"
              max="128"
              value={Math.min(config.quantity, 128)}
              onChange={(e) => update("quantity", Number(e.target.value))}
            />
            <div className="quantity-presets">
              {[1, 4, 8, 16, 32, 64, 128].map((n) => (
                <button
                  key={n}
                  className={config.quantity === n ? "selected" : ""}
                  onClick={() => update("quantity", n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label>
                EXACT QUANTITY
                <input
                  type="number"
                  min="1"
                  max="1024"
                  value={config.quantity}
                  onChange={(e) =>
                    update(
                      "quantity",
                      Math.min(1024, Math.max(1, Number(e.target.value))),
                    )
                  }
                />
              </label>
              <label>
                DURATION / HOURS
                <input
                  type="number"
                  min="0.1"
                  max="168"
                  value={config.durationHours}
                  onChange={(e) =>
                    update("durationHours", Number(e.target.value))
                  }
                />
              </label>
              <label>
                MIN CPU CORES
                <input
                  type="number"
                  min="0"
                  value={config.minCpu}
                  onChange={(e) => update("minCpu", Number(e.target.value))}
                />
              </label>
              <label>
                MIN RAM / GB
                <input
                  type="number"
                  min="0"
                  value={config.minRam}
                  onChange={(e) => update("minRam", Number(e.target.value))}
                />
              </label>
              <label>
                STORAGE / GB
                <input
                  type="number"
                  min="10"
                  max="2000"
                  value={config.disk}
                  onChange={(e) => update("disk", Number(e.target.value))}
                />
              </label>
              <label>
                BUDGET / USD
                <input
                  type="number"
                  min="1"
                  placeholder="No ceiling"
                  value={config.budget ?? ""}
                  onChange={(e) => {
                    setConfig((c) => ({
                      ...c,
                      budget: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    }));
                    setResults(null);
                    setQuote(null);
                  }}
                />
              </label>
            </div>
            <label>
              REGION
              <input
                value={config.region === "auto" ? "" : config.region}
                placeholder="Auto · any region"
                onChange={(e) => update("region", e.target.value || "auto")}
              />
            </label>
            <label>
              OPTIMIZATION STRATEGY
              <select
                value={config.strategy}
                onChange={(e) => update("strategy", e.target.value)}
              >
                {strategies.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button primary full"
              disabled={
                busy || config.durationHours <= 0 || config.durationHours > 168
              }
              onClick={route}
            >
              {busy ? "Searching providers…" : "Find compatible compute"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <div className="machine-preview">
          <div className="panel machine-visual">
            <div className="section-heading">
              <span className="eyebrow">YOUR SUPERCOMPUTER</span>
              <span className="badge">CONFIGURATION PREVIEW</span>
            </div>
            <h2>
              <HardwareLogo id={config.hardware ?? ""}/> {config.quantity} <span>×</span> {h?.name ?? config.hardware}
            </h2>
            <Rack quantity={config.quantity} />
            <div className="machine-summary">
              <div>
                <span>TOTAL REFERENCE VRAM</span>
                <strong>
                  {((h?.memory ?? 0) * config.quantity).toLocaleString()}
                  <small>GB</small>
                </strong>
              </div>
              <div>
                <span>REQUESTED RUNTIME</span>
                <strong>
                  {config.durationHours}
                  <small>HOURS</small>
                </strong>
              </div>
              <div>
                <span>EST. NODE COST / HR</span>
                <strong>{money(results?.[0]?.price)}</strong>
              </div>
            </div>
          </div>
          <div className="cluster-notice">
            <Layers3 size={18} />
            <p>
              <b>Capacity is a constraint, not a promise.</b> Racks visualize
              your requested configuration. Ranking only returns compatible
              whole-node offers. Multi-node training requires a
              provider-supported fabric; cross-provider GPUs are not pooled.
            </p>
          </div>
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 / SMART ROUTER</span>
            <h2>
              {results === null
                ? "Your options, explained."
                : `${results.length} compatible offers.`}
            </h2>
          </div>
          <span className="muted">Ranked by {config.strategy}</span>
        </div>
        {results === null ? (
          <div className="panel router-idle">
            <Cpu size={22} />
            <p>Set your requirements and search connected providers.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="panel">
            <Empty
              title="No compatible capacity found"
              description="Connect your own Vast.ai account to search exact rentable machines, or continue in a provider console to review current capacity."
              href="/settings#connect-provider"
              label="Connect your provider account"
            />
          </div>
        ) : (
          <div className="route-results">
            {results.slice(0, 10).map((o, i) => (
              <div className="panel route-result" key={o.id}>
                <span className="route-rank">0{i + 1}</span>
                <div>
                  <h3>
                    <BrandLogo brand={o.provider} compact/>{o.provider}{" "}
                    <span>
                      · {o.gpuCount} × {o.gpuName}
                    </span>
                  </h3>
                  <p>
                    {o.region} · {o.ram ?? "Unknown"} GB RAM ·{" "}
                    {o.disk ?? "Unknown"} GB disk
                  </p>
                  <small>
                    <Check size={12} />
                    {o.why}
                  </small>
                </div>
                <div className="route-price">
                  <strong>{money(o.estimatedTotal)}</strong>
                  <small>{money(o.price)} / node-hour</small>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => requestQuote(o)}
                >
                  {o.deployable ? "Get quote" : "View estimate"}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {!calculator && (
        <section className="panel workload-form">
          <div className="panel-title">
            <span className="step">03</span>
            <h2>Your workload</h2>
          </div>
          <div className="config-body">
            <div className="form-grid">
              <label>
                STARTER TEMPLATE
                <select
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    const t = templates.find((t) => t.id === e.target.value)!;
                    setImage(t.image);
                    setCommand(t.command);
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                DOCKER IMAGE
                <input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                />
              </label>
            </div>
            <label>
              START COMMAND
              <textarea
                rows={2}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
            </label>
            <label>
              ENVIRONMENT VARIABLES · SENT ONLY TO THE SERVER
              <textarea
                rows={3}
                spellCheck={false}
                autoComplete="off"
                placeholder="KEY=value"
                value={env}
                onChange={(e) => setEnv(e.target.value)}
              />
            </label>
            <p className="muted footnote">
              Tokens are forwarded to the provider over HTTPS and excluded from
              QuantumPad job records and receipts. Container images and commands
              execute on the rented machine. Presets may require additional
              dependencies.
            </p>
          </div>
        </section>
      )}
      {quote && (
        <section className="panel quote-panel">
          <div>
            <span className="eyebrow">04 / REVIEW & AUTHORIZE</span>
            <h2>
              {money(quote.total)}{" "}
              <span className="muted">estimated total</span>
            </h2>
            <p>
              {quote.offer.gpuCount} × {quote.offer.gpuName} ·{" "}
              {quote.durationHours} hours · {quote.offer.provider}
            </p>
            <span className={`badge ${expired ? "" : "green"}`}>
              {expired
                ? "EXPIRED"
                : `Quote expires in ${Math.max(0, Math.floor((Date.parse(quote.expiresAt) - now) / 1000))}s`}
            </span>
          </div>
          <div className="quote-confirm">
            <p>
              Provider billing is in USD through{" "}
              {quote.offer.metadata?.credentialId
                ? "your connected provider account"
                : "the operator’s provider account"}
              . Storage is estimated; bandwidth, taxes and provider extras are
              excluded. This is not a Robinhood Chain payment.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I explicitly authorize this estimated provider charge and
              understand additional usage fees may apply.
            </label>
            <button
              className="button primary full"
              onClick={boot}
              disabled={
                busy ||
                !confirmed ||
                !!expired ||
                !quote.offer.deployable ||
                calculator
              }
            >
              <Play size={15} />
              {quote.offer.deployable
                ? "Boot supercomputer"
                : "Use provider checkout below"}
            </button>
          </div>
        </section>
      )}
      <CloudLaunch config={config} image={image} command={command} />
      <div className="save-machine">
        <Save size={20} />
        <div>
          <b>A machine worth keeping.</b>
          <p>
            Save this configuration and get a fresh quote whenever you need it.
          </p>
        </div>
        <input
          aria-label="Machine name"
          placeholder={`${config.quantity} × ${config.hardware}`}
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button className="button secondary" disabled={saving} onClick={save}>
          Save machine
        </button>
      </div>
    </div>
  );
}
export function Estimator() {
  const [params, setParams] = useState(70);
  const [bits, setBits] = useState(4);
  const [context, setContext] = useState(8192);
  const [concurrency, setConcurrency] = useState(1);
  const [training, setTraining] = useState(false);
  const estimate = estimateModel(params, bits, context, concurrency, training);
  return (
    <div className="page">
      <PageHead
        eyebrow="TOOLS / MODEL-TO-COMPUTE"
        title="Find a home for your model."
        description="Estimate memory requirements before comparing real hardware offers."
      />
      <div className="estimator-layout">
        <div className="panel config-body">
          <h2>Model requirements</h2>
          <label>
            MODEL PRESET
            <select
              onChange={(e) => setParams(Number(e.target.value))}
              value={[7, 8, 70, 72, 123, 405].includes(params) ? params : 0}
            >
              <option value="7">Mistral / Qwen-class · 7B</option>
              <option value="8">Llama-class · 8B</option>
              <option value="70">Llama-class · 70B</option>
              <option value="72">Qwen-class · 72B</option>
              <option value="123">Mistral-class · 123B</option>
              <option value="405">Llama-class · 405B</option>
              <option value="0" disabled>
                Custom
              </option>
            </select>
          </label>
          <label>
            PARAMETERS / BILLIONS
            <input
              type="number"
              min="0.1"
              max="2000"
              value={params}
              onChange={(e) => setParams(Math.max(0.1, Number(e.target.value)))}
            />
          </label>
          <label>
            PRECISION
            <select
              value={bits}
              onChange={(e) => setBits(Number(e.target.value))}
            >
              {[4, 8, 16, 32].map((b) => (
                <option value={b} key={b}>
                  {b}-bit
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              CONTEXT LENGTH
              <input
                type="number"
                min="1"
                value={context}
                onChange={(e) =>
                  setContext(Math.max(1, Number(e.target.value)))
                }
              />
            </label>
            <label>
              CONCURRENCY
              <input
                type="number"
                min="1"
                value={concurrency}
                onChange={(e) =>
                  setConcurrency(Math.max(1, Number(e.target.value)))
                }
              />
            </label>
          </div>
          <label>
            WORKLOAD
            <select
              value={training ? "training" : "inference"}
              onChange={(e) => setTraining(e.target.value === "training")}
            >
              <option value="inference">Inference</option>
              <option value="training">Full training · heuristic</option>
            </select>
          </label>
        </div>
        <div>
          <div className="estimator-total panel">
            <span className="eyebrow">ESTIMATED VRAM REQUIRED</span>
            <strong>
              {estimate.required.toFixed(1)}
              <small>GiB</small>
            </strong>
            <div>
              <span>
                Weights <b>{estimate.weights.toFixed(1)} GiB</b>
              </span>
              <span>
                KV cache estimate <b>{estimate.kv.toFixed(1)} GiB</b>
              </span>
            </div>
          </div>
          <div className="panel info">
            <h3>Assumptions, in the open.</h3>
            <p>{estimate.assumptions}</p>
            <p>
              Recommendations include 15% headroom. This is a memory estimate,
              not a performance or deployability guarantee. Multi-GPU models
              require compatible software and interconnects.
            </p>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <h2>Hardware candidates</h2>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>HARDWARE</th>
              <th>REFERENCE VRAM</th>
              <th>MINIMUM GPUS</th>
              <th>WITH HEADROOM</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {estimate.recommendations.map((h) => (
              <tr key={h.id}>
                <td><span className="brand-inline"><HardwareLogo id={h.id} compact/>{h.name}</span></td>
                <td>{h.memory} GB</td>
                <td>{h.minimum}</td>
                <td>{h.recommended}</td>
                <td>
                  <Link
                    className="text-link"
                    href={`/build?gpu=${h.id}&quantity=${h.recommended}`}
                  >
                    Configure ↗
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
