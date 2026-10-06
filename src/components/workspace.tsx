"use client";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  Download,
  KeyRound,
  Plus,
  Server,
  ShieldCheck,
  Square,
  Trash2,
  Wallet,
} from "lucide-react";
import { createWalletClient, custom, type EIP1193Provider } from "viem";
import { useApp, api, money } from "./shell";
import { PageHead, Empty, Metric } from "./terminal";
import { Rack } from "./visuals";
import { WebhookPanel } from "./webhook-panel";
import { ProviderConnect } from "./provider-connect";
import { chain } from "@/lib/chain";
import { hardware } from "@/lib/catalog";
import type { Job } from "@/lib/types";
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function Account({ section }: { section: string }) {
  const { owner, connect, notify } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [alertType, setAlertType] = useState("PRICE_BELOW");
  const [gpu, setGpu] = useState("H100");
  const [threshold, setThreshold] = useState(2);
  const [busy, setBusy] = useState(false);
  const reload = () => {
    if (!owner) return;
    const endpoint =
      section === "saved"
        ? "machines"
        : section === "alerts"
          ? "alerts"
          : "jobs";
    api(endpoint)
      .then((d) => {
        setJobs(d.jobs ?? []);
        setMachines(d.machines ?? []);
        setAlerts(d.alerts ?? []);
        setEvents(d.events ?? []);
        setError("");
      })
      .catch((e) => setError(e.message));
  };
  useEffect(reload, [owner, section]);
  async function createAlert() {
    setBusy(true);
    try {
      await api("alerts", {
        type: alertType,
        hardware: gpu,
        threshold,
        enabled: true,
      });
      reload();
      notify(
        "Alert created. In-app notifications appear after a scheduler evaluation.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord(kind: string, id: string) {
    try {
      await api(`${kind}/${id}`, undefined, "DELETE");
      reload();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const titles: Record<string, string> = {
    dashboard: "Your compute, in perspective.",
    jobs: "Your operations center.",
    saved: "Good machines. Ready to return.",
    alerts: "Stay ahead of your next job.",
  };
  const active = jobs.filter((j) => !j.endedAt);
  const cost = jobs.reduce(
    (s, j) =>
      s +
      (j.startedAt
        ? Math.max(
            0,
            ((j.endedAt ? Date.parse(j.endedAt) : Date.now()) -
              Date.parse(j.startedAt)) /
              3600000,
          ) * j.hourly
        : 0),
    0,
  );
  const hours = jobs.reduce(
    (s, j) =>
      s +
      (j.startedAt
        ? Math.max(
            0,
            ((j.endedAt ? Date.parse(j.endedAt) : Date.now()) -
              Date.parse(j.startedAt)) /
              3600000,
          ) * j.gpuCount
        : 0),
    0,
  );
  return (
    <div className="page">
      <PageHead
        eyebrow={`WORKSPACE / ${section.toUpperCase()}`}
        title={titles[section] ?? "Your workspace."}
        description="Your wallet is your identity. Your workloads remain yours."
        action={
          <Link className="button primary" href="/build">
            <Plus size={16} />
            New machine
          </Link>
        }
      />
      {!owner ? (
        <div className="panel wallet-empty">
          <Wallet size={32} strokeWidth={1} />
          <h2>A workspace for your machine power.</h2>
          <p>
            Connect your wallet and sign in to view jobs, saved machines and
            alerts. Signing in does not authorize a payment.
          </p>
          <button className="button primary" onClick={connect}>
            Connect wallet <ArrowUpRight size={16} />
          </button>
        </div>
      ) : error ? (
        <div className="panel">
          <Empty title="Workspace unavailable" description={error} />
        </div>
      ) : section === "saved" ? (
        <div className="provider-grid">
          {machines.length ? (
            machines.map((m) => (
              <div className="panel saved-card" key={m.id}>
                <Server size={28} strokeWidth={1} />
                <h2>{m.name}</h2>
                <p>
                  {m.configuration.quantity} × {m.configuration.hardware} ·{" "}
                  {m.configuration.durationHours} hours
                </p>
                <div className="button-row">
                  <Link
                    className="button secondary"
                    href={`/build?machine=${m.id}`}
                  >
                    Edit / quote again ↗
                  </Link>
                  <button
                    aria-label={`Delete ${m.name}`}
                    onClick={() => deleteRecord("machines", m.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <button
                  className="text-link"
                  onClick={async () => {
                    try {
                      await api("machines", {
                        name: `${m.name} copy`,
                        configuration: m.configuration,
                      });
                      reload();
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Duplicate configuration
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="Your first machine is waiting"
              description="Build a configuration and save it to your wallet."
              href="/build"
              label="Build a machine"
            />
          )}
        </div>
      ) : section === "alerts" ? (
        <>
          <div className="panel config-body">
            <h2>Create a market alert</h2>
            <div className="alert-form">
              <label>
                TRIGGER
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                >
                  <option value="PRICE_BELOW">
                    Price below · USD / GPU-hour
                  </option>
                  <option value="HARDWARE_AVAILABLE">Hardware available</option>
                  <option value="CAPACITY_ABOVE">Capacity above · GPUs</option>
                </select>
              </label>
              <label>
                HARDWARE
                <select value={gpu} onChange={(e) => setGpu(e.target.value)}>
                  {hardware.map((h) => (
                    <option key={h.id}>{h.id}</option>
                  ))}
                </select>
              </label>
              <label>
                THRESHOLD
                <input
                  type="number"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  disabled={alertType === "HARDWARE_AVAILABLE"}
                />
              </label>
              <button
                className="button primary"
                onClick={createAlert}
                disabled={busy}
              >
                Create alert
              </button>
            </div>
          </div>
          <div className="panel config-body">
            <h2>Alert rules</h2>
            {alerts.map((a) => (
              <div className="list-link" key={a.id}>
                <span>
                  {a.hardware} · {a.type.replaceAll("_", " ")} · {a.threshold}
                </span>
                <button
                  aria-label="Delete alert"
                  onClick={() => deleteRecord("alerts", a.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {!alerts.length && (
              <p className="muted">No alert rules configured.</p>
            )}
            <h2>Notifications</h2>
            {events.map((e) => (
              <div className="list-link" key={e.id}>
                <span>
                  <b>{e.type}</b>
                  <small className="block muted">
                    {JSON.stringify(e.payload)}
                  </small>
                </span>
                <time>{new Date(e.created_at).toLocaleString()}</time>
              </div>
            ))}
            {!events.length && (
              <p className="muted">
                Job lifecycle events and triggered market alerts will appear
                here.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {section === "dashboard" && (
            <>
              <div className="metrics">
                <Metric
                  label="ESTIMATED COMPUTE SPEND"
                  value={money(cost)}
                  sub="Usage estimate, not a provider invoice"
                />
                <Metric
                  label="ACTIVE JOBS"
                  value={String(active.length)}
                  sub="Unfinished job records"
                />
                <Metric
                  label="GPU HOURS"
                  value={hours.toFixed(2)}
                  sub="Based on recorded runtime"
                />
                <Metric
                  label="CURRENT BURN RATE"
                  value={money(active.reduce((s, j) => s + j.hourly, 0))}
                  sub="USD / hour, estimated"
                />
              </div>
              <div className="info-grid">
                <Distribution
                  title="Hardware distribution"
                  values={jobs.map((j) => j.hardware)}
                />
                <Distribution
                  title="Provider distribution"
                  values={jobs.map((j) => j.provider)}
                />
              </div>
            </>
          )}
          <div className="panel">
            {!jobs.length ? (
              <Empty
                title="No jobs in orbit. Yet."
                description="Your real compute jobs will appear here after an authorized provider launch."
                href="/build"
                label="Configure your first machine"
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>JOB</th>
                      <th>HARDWARE</th>
                      <th>PROVIDER</th>
                      <th>STATE</th>
                      <th>COST / HOUR</th>
                      <th>STARTED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <Link className="text-link" href={`/jobs/${j.id}`}>
                            {j.id.slice(0, 8)} ↗
                          </Link>
                        </td>
                        <td>
                          {j.gpuCount} × {j.hardware}
                        </td>
                        <td><span className="brand-inline"><BrandLogo brand={j.provider} compact/>{j.provider}</span></td>
                        <td>
                          <span className="badge">{j.state}</span>
                        </td>
                        <td>{money(j.hourly)}</td>
                        <td>
                          {j.startedAt
                            ? new Date(j.startedAt).toLocaleString()
                            : "Pending"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function Distribution({ title, values }: { title: string; values: string[] }) {
  const groups = values.reduce<Record<string, number>>(
    (o, v) => ({ ...o, [v]: (o[v] ?? 0) + 1 }),
    {},
  );
  return (
    <div className="panel info">
      <h3>{title}</h3>
      {Object.entries(groups).map(([k, v]) => (
        <div className="distribution" key={k}>
          <span>{k}</span>
          <div>
            <i style={{ width: `${(v / values.length) * 100}%` }} />
          </div>
          <b>{v}</b>
        </div>
      ))}
      {!values.length && (
        <p className="muted">Your job history will populate this chart.</p>
      )}
    </div>
  );
}
export function JobDetail({ id }: { id: string }) {
  const { owner, connect, notify } = useApp();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pendingTx, setPendingTx] = useState<`0x${string}` | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState("Logs have not been requested.");
  const reload = () =>
    api(`jobs/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (!owner) return;
    reload();
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [id, owner]);
  async function stop() {
    setBusy(true);
    try {
      await api(`jobs/${id}/stop`, {});
      setConfirm(false);
      await reload();
      notify("Provider termination completed.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function attest() {
    setBusy(true);
    try {
      const r = await api(`jobs/${id}/receipt`);
      const eth = (window as unknown as { ethereum: EIP1193Provider }).ethereum;
      const client = createWalletClient({ chain, transport: custom(eth) });
      await client.switchChain({ id: chain.id });
      const [address] = await client.requestAddresses();
      if (address.toLowerCase() !== owner)
        throw new Error("Select the job owner wallet.");
      const tx =
        pendingTx ??
        (await client.sendTransaction({
          account: address,
          to: address,
          value: BigInt(0),
          data: r.receiptHash,
        }));
      setPendingTx(tx);
      notify(
        `Receipt transaction submitted: ${tx}. Confirmation may take a moment.`,
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await api(`jobs/${id}/attest`, { transactionHash: tx });
      setPendingTx(null);
      await reload();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!owner)
    return (
      <div className="page">
        <Empty
          title="Private control room"
          description="Sign in with the wallet that owns this job."
        />
        <button className="button primary" onClick={connect}>
          Connect wallet
        </button>
      </div>
    );
  if (error)
    return (
      <div className="page">
        <Empty title="Unable to load job" description={error} />
      </div>
    );
  if (!data)
    return (
      <div className="page">
        <p className="muted">Loading control room…</p>
      </div>
    );
  const j = data.job as Job;
  return (
    <div className="page">
      <PageHead
        eyebrow={`CONTROL ROOM / ${j.id.slice(0, 8)}`}
        title={`${j.gpuCount} × ${j.hardware}`}
        description={`${j.provider} · ${j.region} · ${j.state}`}
        action={<span className="badge green">{j.state}</span>}
      />
      {j.error && <div className="notice">{j.error}</div>}
      <div className="panel config-body">
        <h2>Access your machine</h2>
        <p className="muted">
          Open the provider console and select instance{" "}
          {j.providerJobId ?? `exaflop-${j.id}`} for SSH, terminal access and
          provider logs. Add your SSH public key in that account if needed.
        </p>
        <a
          className="button secondary"
          href={
            j.provider === "vast"
              ? "https://console.vast.ai/instances/"
              : "https://console.runpod.io/"
          }
          target="_blank"
          rel="noreferrer"
        >
          Open provider console <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="metrics">
        <Metric
          label="ESTIMATED HOURLY COST"
          value={money(j.hourly)}
          sub="Provider-side USD billing"
        />
        <Metric
          label="REQUESTED RUNTIME"
          value={`${j.durationHours} h`}
          sub="Scheduler-enforced termination"
        />
        <Metric
          label="PAYMENT STATE"
          value="Provider billed"
          sub="No onchain payment collected"
        />
        <Metric
          label="PROVIDER INSTANCE"
          value={j.providerJobId ?? "Pending"}
          sub="Real provider-issued identifier"
        />
      </div>
      <div className="panel">
        <Rack quantity={j.gpuCount} />
      </div>
      <div className="telemetry-grid">
        {[
          "gpuUtilization",
          "gpuTemperature",
          "cpuUtilization",
          "ramUsage",
          "vramUtilization",
          "powerUsage",
          "diskUsage",
          "network",
        ].map((m) => (
          <div className="panel info" key={m}>
            <span className="eyebrow">
              {m.replace(/([A-Z])/g, " $1").toUpperCase()}
            </span>
            <h2>{data.metrics[m] ?? "—"}</h2>
            {data.metrics[m] == null && (
              <small className="muted">Metric unavailable from provider</small>
            )}
          </div>
        ))}
      </div>
      <div className="panel config-body">
        <div className="section-heading">
          <h2>Job logs</h2>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                const r = await api(`jobs/${id}/logs`);
                setLogs(r.logs ?? r.message);
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Fetch logs
          </button>
        </div>
        <pre>{logs}</pre>
      </div>
      <div className="button-row">
        <button
          className="button danger"
          disabled={!!j.endedAt}
          onClick={() => setConfirm(true)}
        >
          <Square size={14} />
          Stop job
        </button>
        <button
          className="button secondary"
          disabled={!j.endedAt}
          onClick={async () => {
            try {
              download(`exaflop-${j.id}.json`, await api(`jobs/${id}/receipt`));
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          <Download size={14} />
          Download receipt
        </button>
        <button
          className="button secondary"
          disabled={!j.endedAt || busy}
          onClick={attest}
        >
          <ShieldCheck size={14} />
          {pendingTx
            ? "Verify submitted attestation"
            : "Attest receipt onchain"}
        </button>
        {j.transactionHash && (
          <a
            href={`${chain.blockExplorers.default.url}/tx/${j.transactionHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            View onchain ↗
          </a>
        )}
      </div>
      <p className="footnote muted">
        Attestation writes the receipt hash in a zero-value transaction to your
        own address. Your wallet requests gas approval. This is a Job Receipt
        Attestation, not cryptographic proof of GPU execution.
      </p>
      {confirm && (
        <div className="panel stop-confirm">
          <h3>Terminate this provider instance?</h3>
          <p>
            This ends the compute rental and can permanently delete instance
            storage. Save your outputs first.
          </p>
          <div className="button-row">
            <button className="button danger" disabled={busy} onClick={stop}>
              {busy ? "Terminating…" : "Confirm termination"}
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Keep running
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
const endpoints = [
  ["GET", "/api/my/offers", "Your wallet’s private connected-provider offers"],
  [
    "GET / POST",
    "/api/connections",
    "Wallet session only: list or connect provider keys",
  ],
  ["DELETE", "/api/connections/:id", "Disconnect after active rentals finish"],
  ["GET", "/api/markets", "Normalized market observations"],
  ["GET", "/api/hardware", "Hardware reference catalog"],
  ["GET", "/api/providers", "Provider connection status"],
  [
    "GET",
    "/api/offers",
    "Ranked offers; hardware, quantity, durationHours, strategy filters",
  ],
  ["POST", "/api/search", "Deterministic natural-language search"],
  ["GET", "/api/history", "Persisted price observations"],
  ["GET", "/api/index", "Informational hardware price indices"],
  [
    "POST",
    "/api/quotes",
    "Request a quote with offerId, durationHours and disk",
  ],
  ["GET", "/api/quotes/:id", "Read an owned quote"],
  ["POST", "/api/jobs", "Explicitly confirmed launch; quoteId and workload"],
  ["GET", "/api/jobs/:id", "Owned job state and supported telemetry"],
  ["POST", "/api/jobs/:id/stop", "Terminate the provider instance"],
  ["GET", "/api/jobs/:id/logs", "Provider logs, or explicit unavailability"],
  ["GET", "/api/jobs/:id/receipt", "Canonical receipt for an ended job"],
  ["GET", "/api/events", "Authenticated job and alert events"],
];
export function Developers() {
  const { owner, connect, notify } = useApp();
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (owner)
      api("keys")
        .then((r) => setKeys(r.keys))
        .catch((e) => notify(e.message));
  }, [owner, notify]);
  const snippet = `import { Exaflop } from './exaflop-client';\n\nconst exaflop = new Exaflop({\n  baseUrl: 'https://your-exaflop-domain',\n  apiKey: process.env.EXAFLOP_API_KEY!\n});\n\nconst { offers } = await exaflop.offers({\n  hardware: 'H100', quantity: 8,\n  durationHours: 10, strategy: 'cheapest'\n});\n\nconst quote = await exaflop.quote({\n  offerId: offers[0].id, durationHours: 10, disk: 20\n});\n// Review the quote and explicitly authorize provider billing.\nconst job = await exaflop.createJob({\n  quoteId: quote.id, confirmed: true,\n  workload: { image: 'nvidia/cuda:12.6.3-runtime-ubuntu24.04',\n    command: 'nvidia-smi', disk: 20, env: {} }\n});`;
  async function create() {
    setBusy(true);
    try {
      const r = await api("keys", { name });
      setNewKey(r.key);
      setKeys((await api("keys")).keys);
      setName("");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <PageHead
        eyebrow="BUILD / DEVELOPER PLATFORM"
        title="Compute is an API call away."
        description="A consistent interface to fragmented compute. Built for developers and constrained agents."
      />
      <div className="developer-layout">
        <div className="panel code-panel">
          <div className="code-head">
            <span>quickstart.ts</span>
            <button
              className="icon-button"
              aria-label="Copy code"
              onClick={() =>
                navigator.clipboard
                  .writeText(snippet)
                  .then(() => notify("Example copied."))
              }
            >
              <Copy size={15} />
            </button>
          </div>
          <pre>
            <code>{snippet}</code>
          </pre>
        </div>
        <div className="panel info">
          <span className="eyebrow">AGENT COMPUTE</span>
          <h2>
            Autonomy.
            <br />
            With boundaries.
          </h2>
          <p>
            API keys inherit your wallet identity. Job launches require an
            enabled policy, explicit confirmation, operator authorization and a
            fresh quote.
          </p>
          <ul>
            <li>Maximum cost per job and per day</li>
            <li>GPU, provider and regional allowlists</li>
            <li>Maximum authorized duration</li>
            <li>Atomic budget reservations</li>
            <li>Hashed, revocable API keys</li>
          </ul>
          <Link href="/settings" className="button secondary">
            Configure agent policy ↗
          </Link>
          <p className="footnote">
            Write authentication: Authorization: Bearer exf_… · 60
            requests/min/key. Never expose API keys in browser bundles.
          </p>
        </div>
      </div>
      <WebhookPanel />
      <section className="panel config-body">
        <div className="section-heading">
          <h2>Developer keys</h2>
          <KeyRound size={20} />
        </div>
        {!owner ? (
          <button className="button primary" onClick={connect}>
            Connect wallet to manage keys
          </button>
        ) : (
          <>
            <div className="inline-form">
              <input
                aria-label="API key name"
                placeholder="Key name, e.g. research-agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="button primary"
                disabled={!name.trim() || busy}
                onClick={create}
              >
                Create key <Plus size={15} />
              </button>
            </div>
            {newKey && (
              <div className="key-reveal">
                <b>Copy once. This key will not be shown again.</b>
                <code>{newKey}</code>
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(newKey)
                      .then(() => notify("Key copied."))
                  }
                >
                  Copy key
                </button>
                <button onClick={() => setNewKey("")}>Dismiss</button>
              </div>
            )}
            {keys.map((k) => (
              <div className="list-link" key={k.id}>
                <span>
                  {k.name} <code>{k.prefix}…</code>
                </span>
                <button
                  disabled={k.revoked}
                  onClick={async () => {
                    try {
                      await api(`keys/${k.id}`, {});
                      setKeys((await api("keys")).keys);
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  {k.revoked ? "Revoked" : "Revoke"}
                </button>
              </div>
            ))}
          </>
        )}
      </section>
      <div className="section-heading">
        <h2>API reference</h2>
        <span className="badge">JSON / HTTPS</span>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>METHOD</th>
              <th>ENDPOINT</th>
              <th>DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map(([m, p, d]) => (
              <tr key={m + p}>
                <td>
                  <span className={`method ${m === "GET" ? "get" : ""}`}>
                    {m}
                  </span>
                </td>
                <td>
                  <code>{p}</code>
                </td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="info-grid">
        <div className="panel info">
          <h3>Errors & idempotency</h3>
          <p>
            400 invalid input · 401 authentication required · 403 policy denied
            · 409 stale quote · 429 rate limit · 503 dependency unavailable.
            Quotes are consumed at most once. Ambiguous provider outcomes
            require reconciliation; do not blindly repeat a launch.
          </p>
        </div>
        <div className="panel info">
          <h3>Event delivery</h3>
          <p>
            Poll GET /api/events or register a signed webhook above. Delivery
            retries up to five times and is at least once; deduplicate event
            IDs. Configure the server scheduler and encryption key first.
          </p>
        </div>
      </div>
    </div>
  );
}
export function Settings() {
  const { providers, owner, connect, notify } = useApp();
  const [health, setHealth] = useState<any>(null);
  const [policy, setPolicy] = useState<any>({
    enabled: false,
    maxCostPerJob: 10,
    maxDailyCost: 25,
    maxDuration: 4,
    allowedGpus: ["H100", "A100", "L40S"],
    allowedProviders: ["vast"],
    allowedRegions: [],
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("health")
      .then(setHealth)
      .catch(() => {});
    if (owner)
      api("policy")
        .then(setPolicy)
        .catch((e) => notify(e.message));
  }, [owner, notify]);
  return (
    <div className="page">
      <PageHead
        eyebrow="WORKSPACE / SETTINGS"
        title="Connections & control."
        description="Credentials stay on the server. Authorization stays with you."
      />
      <div className="info-grid">
        <div className="panel info">
          <div className="eyebrow">IDENTITY</div>
          <h2>Robinhood Chain</h2>
          <dl>
            <dt>Network</dt>
            <dd>{chain.name}</dd>
            <dt>Chain ID</dt>
            <dd>{chain.id}</dd>
            <dt>Currency</dt>
            <dd>ETH</dd>
            <dt>Authenticated wallet</dt>
            <dd className="address">{owner || "Not signed in"}</dd>
          </dl>
          <button className="button secondary" onClick={connect}>
            <Wallet size={15} />
            {owner ? "Reconnect" : "Connect wallet"}
          </button>
          <a
            className="text-link"
            href="https://docs.robinhood.com/chain/connecting/"
            target="_blank"
            rel="noreferrer"
          >
            Official network details ↗
          </a>
        </div>
        <div className="panel info">
          <div className="eyebrow">INFRASTRUCTURE</div>
          <h2>Service readiness</h2>
          <dl>
            <dt>Database configured</dt>
            <dd>{health?.database ? "Yes" : "No"}</dd>
            <dt>Self-service rentals</dt>
            <dd>
              {health?.selfService
                ? "Enabled · your provider account"
                : "Not enabled"}
            </dd>
            <dt>Runtime scheduler</dt>
            <dd>
              {health?.schedulerHealthy
                ? "Healthy · every minute"
                : "Awaiting healthy heartbeat"}
            </dd>
            <dt>Payment architecture</dt>
            <dd>Provider-side billing</dd>
            <dt>Receipt layer</dt>
            <dd>Optional onchain hash</dd>
          </dl>
          <p className="muted">
            Connect your funded Vast.ai account below. Each rental needs your
            explicit confirmation and a healthy runtime scheduler.
          </p>
        </div>
      </div>
      <ProviderConnect />
      <section className="panel config-body">
        <h2>Public market connections</h2>
        {providers
          .filter((p) => p.status !== "research")
          .map((p) => (
            <div className="connection-row" key={p.id}>
              <div>
                <b className="brand-inline"><BrandLogo brand={p.id} compact/>{p.name}</b>
                <p>{p.detail}</p>
              </div>
              <span
                className={`badge ${p.status === "connected" ? "green" : ""}`}
              >
                {p.status.replaceAll("_", " ")}
              </span>
              <a
                href={p.docs}
                target="_blank"
                rel="noreferrer"
                aria-label={`${p.name} documentation`}
              >
                <ArrowUpRight size={17} />
              </a>
            </div>
          ))}
      </section>
      <section className="panel config-body">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RENTAL LIMITS & AGENT AUTHORIZATION</span>
            <h2>Define the operating envelope.</h2>
          </div>
          <ShieldCheck size={24} strokeWidth={1} />
        </div>
        {!owner ? (
          <button className="button primary" onClick={connect}>
            Sign in to configure policy
          </button>
        ) : (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={policy.enabled}
                onChange={(e) =>
                  setPolicy({ ...policy, enabled: e.target.checked })
                }
              />
              Authorize developer API keys to launch within this policy
            </label>
            <div className="form-grid three">
              {[
                ["maxCostPerJob", "MAX COST / JOB · USD"],
                ["maxDailyCost", "MAX DAILY COST · USD"],
                ["maxDuration", "MAX DURATION · HOURS"],
              ].map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    value={policy[k]}
                    onChange={(e) =>
                      setPolicy({ ...policy, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="form-grid three">
              {[
                ["allowedGpus", "ALLOWED GPUS"],
                ["allowedProviders", "ALLOWED PROVIDERS"],
                ["allowedRegions", "ALLOWED REGIONS · EMPTY = ANY"],
              ].map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    value={policy[k].join(", ")}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        [k]: e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="muted footnote">
              Daily limits reserve the full quoted estimate at launch, using UTC
              days. Provider extras and scheduler delays can exceed estimated
              spend; these limits are not a prepaid balance. The operator must
              separately allowlist your wallet.
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setPolicy(await api("policy", policy));
                  notify("Agent policy saved.");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save authorization policy <Check size={15} />
            </button>
          </>
        )}
      </section>
    </div>
  );
}
