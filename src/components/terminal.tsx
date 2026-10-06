"use client";
import Link from "next/link";
import { BrandLogo, HardwareLogo, WorkloadBrand } from "./brand-logo";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  Globe2,
  Layers3,
  Plus,
  Search,
  Server,
  SlidersHorizontal,
  Star,
  Zap,
} from "lucide-react";
import { useApp, api, money } from "./shell";
import { Rack, HistoryChart } from "./visuals";
import { hardware, templates } from "@/lib/catalog";
import type { Offer } from "@/lib/types";
import { Builder, Estimator } from "./builder";
import { Account, JobDetail, Developers, Settings } from "./workspace";
import { Playground } from "./playground";
import { FeatureIcon, MetricIcon, MarketWidgets } from "./feature-widgets";
import dynamic from "next/dynamic";
const Quantum = dynamic(() => import("./quantum").then(module => module.Quantum), { loading: () => <div className="page" role="status">Loading Quantum Lab…</div> });
const Launchpad = dynamic(() => import("./launchpad").then(module => module.Launchpad), { loading: () => <div className="page" role="status">Loading Launchpad…</div> });
import {QuantumHomeSections} from "./quantum-home";
import { ComputeEarth } from "./compute-earth";
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <>
    <div className="page-heading">
      <FeatureIcon/>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
    <MarketWidgets/>
    </>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Server size={26} strokeWidth={1} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="button secondary" href={href}>
          {label ?? "View connections"} <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}
function Home() {
  const { providers, markets } = useApp();
  const connected = providers.filter((p) => p.status === "connected").length;
  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="short-line" /> THE GLOBAL COMPUTE TERMINAL
          </div>
          <h1>
            The market for
            <br />
            machine <span>power.</span>
          </h1>
          <p>
            Search, compare and deploy high-performance
            <br className="desktop-br" /> compute. One terminal. Infinite
            possibility.
          </p>
          <div className="hero-buttons">
            <Link className="button primary" href="/playground">
              Try live compute <ArrowUpRight size={17} />
            </Link>
            <Link className="button secondary" href="/build">
              <Cpu size={16} /> Build a supercomputer
            </Link>
          </div>
          <div className="hero-foot">
            <span>GPU · HPC · AI</span>
            <i />
            <span>
              BUILT ON ROBINHOOD CHAIN <ArrowUpRight size={11} />
            </span>
          </div>
        </div>
        <Rack hero quantity={32} />
        <span className="hero-coordinates">
          EXF / COMPUTE FABRIC
          <br />
          DISTRIBUTED BY DESIGN
        </span>
      </section>
      <div className="stat-strip">
        <div>
          <span>OBSERVED OFFERS</span>
          <strong>
            {markets.reduce((n, m) => n + m.offers, 0).toLocaleString()}
            <small>ACROSS CONNECTED PROVIDERS</small>
          </strong>
        </div>
        <div>
          <span>PROVIDER CONNECTIONS</span>
          <strong>
            {String(connected).padStart(2, "0")}
            <small>
              {connected ? "LIVE API CONNECTIONS" : "AWAITING CREDENTIALS"}
            </small>
          </strong>
        </div>
        <div>
          <span>HARDWARE MARKETS</span>
          <strong>
            12<small>GPU & CPU CLASSES</small>
          </strong>
        </div>
        <div>
          <span>SETTLEMENT NETWORK</span>
          <strong className="network-stat">
            <span className="status-dot" />
            Robinhood<small>WALLET AUTHORIZATION</small>
          </strong>
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / THE MARKET</span>
            <h2>Power, at market price.</h2>
          </div>
          <Link className="text-link" href="/markets">
            All markets <ArrowUpRight size={15} />
          </Link>
        </div>
        <MarketTable compact />
      </section>
      <div className="home-lower">
        <section className="builder-teaser panel">
          <div className="eyebrow">02 / YOUR NEXT SUPERCOMPUTER</div>
          <h2>
            Small idea.
            <br />
            Extraordinary scale.
          </h2>
          <p>
            From a single GPU to your next cluster.
            <br />
            Configure the machine your work deserves.
          </p>
          <Link href="/build" className="button primary">
            Build your machine <ArrowUpRight size={16} />
          </Link>
          <div className="mini-nodes">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={i < 7 ? "on" : ""}>
                <Cpu size={22} strokeWidth={1} />
              </span>
            ))}
          </div>
        </section>
        <section className="provider-teaser panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">03 / THE NETWORK</span>
              <h2>
                One terminal.
                <br />A world of compute.
              </h2>
            </div>
            <Globe2 size={35} strokeWidth={0.8} />
          </div>
          {providers.slice(0, 3).map((p) => (
            <Link
              className="provider-row"
              href={`/providers/${p.id}`}
              key={p.id}
            >
              <BrandLogo brand={p.id}/>
              <b>{p.name}</b>
              <span
                className={`badge ${p.status === "connected" ? "green" : ""}`}
              >
                {p.status === "connected"
                  ? "Connected"
                  : "Credentials required"}
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
          <Link href="/providers" className="text-link">
            Explore provider network <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <section className="developer-banner">
        <div className="terminal-symbol">&gt;_</div>
        <div>
          <span className="eyebrow">BUILT FOR BUILDERS. READY FOR AGENTS.</span>
          <h2>Your next API call could be a supercomputer.</h2>
          <p>
            Discover capacity, request quotes and orchestrate jobs with explicit
            spending policies.
          </p>
        </div>
        <Link className="button secondary" href="/developers">
          Read the docs <ArrowUpRight size={16} />
        </Link>
      </section>
      <div className="how">
        <span className="eyebrow">FROM IDEA TO EXECUTION</span>
        {[
          "Discover your compute",
          "Configure your workload",
          "Review and authorize",
          "Launch and monitor",
        ].map((v, i) => (
          <div key={v}>
            <span>0{i + 1}</span>
            {v}
            <ArrowRight size={15} />
          </div>
        ))}
      </div>
    </div>
  );
}
function MarketTable({
  compact = false,
  watchOnly = false,
}: {
  compact?: boolean;
  watchOnly?: boolean;
}) {
  const { markets, loading, watch, toggleWatch } = useApp();
  const [filter, setFilter] = useState("");
  const [vendor, setVendor] = useState("All hardware");
  const rows = hardware
    .filter(
      (h) =>
        (!watchOnly || watch.includes(h.id)) &&
        (vendor === "All hardware" || h.vendor === vendor) &&
        h.name.toLowerCase().includes(filter.toLowerCase()),
    )
    .slice(0, compact ? 6 : 20);
  return (
    <div className="market-table panel">
      <div className="table-toolbar">
        <div className="tabs">
          {["All hardware", "NVIDIA", "AMD"].map((v) => (
            <button
              key={v}
              className={vendor === v ? "selected" : ""}
              onClick={() => setVendor(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <label className="table-search">
          <Search size={14} />
          <input
            placeholder="Find hardware…"
            aria-label="Find hardware"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th aria-label="Watchlist" />
              <th>
                HARDWARE <ArrowDown size={10} />
              </th>
              <th>FROM / GPU-HR</th>
              <th>MEDIAN / GPU-HR</th>
              <th>VRAM¹</th>
              <th>PROVIDERS</th>
              <th>MARKET STATUS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const m = markets.find((m) => m.hardware === h.id);
              return (
                <tr key={h.id}>
                  <td>
                    <button
                      className={`icon-button watch ${watch.includes(h.id) ? "watched" : ""}`}
                      aria-label={`${watch.includes(h.id) ? "Unwatch" : "Watch"} ${h.id}`}
                      onClick={() => toggleWatch(h.id)}
                    >
                      <Star size={14} />
                    </button>
                  </td>
                  <td>
                    <Link className="hardware-cell" href={`/markets/${h.id}`}>
                      <HardwareLogo id={h.id}/>
                      <span>
                        <b>{h.name}</b>
                        <small>
                          {h.family}{" "}
                          <span> / {h.id === "CPU-HPC" ? "CPU" : "GPU"}</span>
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td className="price">{money(m?.min)}</td>
                  <td className="mono muted">{money(m?.median)}</td>
                  <td className="mono">{h.memory ? `${h.memory} GB` : "—"}</td>
                  <td className="mono muted">{m?.providers ?? 0}</td>
                  <td>
                    <span
                      className={`market-status ${m?.offers ? "available" : ""}`}
                    >
                      <i />
                      {loading
                        ? "Connecting"
                        : m?.offers
                          ? `${m.offers} offers`
                          : "Awaiting data"}
                    </span>
                  </td>
                  <td>
                    <Link
                      aria-label={`Explore ${h.id}`}
                      className="row-arrow"
                      href={`/markets/${h.id}`}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          title="Nothing here yet"
          description="Follow a hardware market using the star icon."
          href="/markets"
          label="Explore markets"
        />
      )}
      <div className="table-note">
        <span>
          <span className="status-dot" />{" "}
          {markets.some((m) => m.offers)
            ? "Provider observations · refreshed every 60s"
            : "No connected inventory feeds · prices appear after connection"}
        </span>
        <span>¹ Reference variant. Offer specifications take precedence.</span>
      </div>
    </div>
  );
}
function Markets({
  detail,
  watchOnly = false,
}: {
  detail?: string;
  watchOnly?: boolean;
}) {
  const { markets, watch, toggleWatch } = useApp();
  const h = hardware.find((h) => h.id.toLowerCase() === detail?.toLowerCase());
  const m = markets.find((m) => m.hardware === h?.id);
  if (detail && !h)
    return (
      <div className="page">
        <Empty
          title="Unknown hardware market"
          description="Choose a supported hardware family."
          href="/markets"
          label="All markets"
        />
      </div>
    );
  return (
    <div className="page">
      <PageHead
        eyebrow={watchOnly ? "YOUR MARKET SIGNALS" : "COMPUTE / GLOBAL MARKETS"}
        title={
          h ? h.name : watchOnly ? "Your watchlist." : "The compute market."
        }
        description={
          h
            ? `${h.family} architecture · ${h.use}. Compare actual provider offers.`
            : "Discover hardware, compare observed prices and find your next machine."
        }
        action={
          h ? (
            <Link className="button primary" href={`/build?gpu=${h.id}`}>
              Rent compute <ArrowUpRight size={16} />
            </Link>
          ) : (
            <Link className="button secondary" href="/build">
              <Cpu size={16} />
              Build a machine
            </Link>
          )
        }
      />
      {h ? (
        <>
          <div className="metrics">
            <Metric
              label="LOWEST OBSERVED"
              value={money(m?.min)}
              sub="USD / GPU-hour"
            />
            <Metric
              label="MEDIAN OBSERVED"
              value={money(m?.median)}
              sub="Across provider observations"
            />
            <Metric
              label="AVAILABLE GPUS"
              value={m?.gpus?.toLocaleString() ?? "—"}
              sub="Only explicitly reported capacity"
            />
            <Metric
              label="PRICE DISPERSION"
              value={
                m?.dispersion == null ? "—" : `${m.dispersion.toFixed(1)}%`
              }
              sub="Range divided by median"
            />
          </div>
          <PriceHistory hardwareId={h.id} />
          <div className="section-heading">
            <h2>Available offers</h2>
            <button
              className="button secondary"
              onClick={() => toggleWatch(h.id)}
            >
              <Star size={14} />
              {watch.includes(h.id) ? "Following" : "Watch hardware"}
            </button>
          </div>
          <Offers hardwareId={h.id} />
          <div className="info-grid">
            <div className="panel info">
              <h3>Hardware profile</h3>
              <dl>
                <dt>Architecture</dt>
                <dd>{h.family}</dd>
                <dt>Reference memory</dt>
                <dd>{h.memory} GB</dd>
                <dt>Use cases</dt>
                <dd>{h.use}</dd>
                <dt>Benchmarks</dt>
                <dd>Available only when reported by the provider</dd>
              </dl>
            </div>
            <div className="panel info">
              <h3>Related machines</h3>
              {hardware
                .filter((v) => v.id !== h.id && v.vendor === h.vendor)
                .slice(0, 3)
                .map((v) => (
                  <Link
                    key={v.id}
                    className="list-link"
                    href={`/markets/${v.id}`}
                  >
                    {v.name}
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <SearchBox />
          <MarketTable watchOnly={watchOnly} />
        </>
      )}
    </div>
  );
}
export function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="metric">
      <span><MetricIcon label={label}/>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
function SearchBox() {
  const { notify } = useApp();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true);
    try {
      setResult(await api("search", { query }));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="natural-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Search size={20} />
        <input
          aria-label="Natural language compute search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you need to compute? Try ‘8 H100s for 24 hours’"
        />
        <button className="button primary" disabled={busy || !query.trim()}>
          {busy ? "Searching…" : "Find compute"}
          <ArrowRight size={15} />
        </button>
      </form>
      {result && (
        <div className="search-result">
          <span>
            Parsed: {result.input.quantity} ×{" "}
            {result.input.hardware ?? "any GPU"} · {result.input.durationHours}{" "}
            hours · {result.input.strategy}{" "}
            {result.input.minVram ? `· ≥${result.input.minVram} GB VRAM` : ""}
          </span>
          <b>{result.offers.length} matching offers</b>
          <Link
            href={`/build?gpu=${result.input.hardware ?? "H100"}&quantity=${result.input.quantity}&duration=${result.input.durationHours}`}
            className="text-link"
          >
            Open in builder ↗
          </Link>
        </div>
      )}
    </div>
  );
}
export function Offers({
  hardwareId,
  providerId,
}: {
  hardwareId?: string;
  providerId?: string;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState<string[]>([]);
  useEffect(() => {
    api(
      `offers?${hardwareId ? `hardware=${encodeURIComponent(hardwareId)}` : ""}`,
    )
      .then((r) =>
        setOffers(
          r.offers.filter(
            (o: Offer) => !providerId || o.provider === providerId,
          ),
        ),
      )
      .catch((e) => setError(e.message));
  }, [hardwareId, providerId]);
  return (
    <>
      <div className="panel offers-panel">
        {error ? (
          <Empty title="Inventory unavailable" description={error} />
        ) : !offers.length ? (
          <Empty
            title="Waiting for a market connection"
            description="Provider credentials unlock current prices and capacity. No inventory or historical prices are simulated."
            href="/settings"
            label="View provider connections"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>COMPARE</th>
                  <th>PROVIDER / HARDWARE</th>
                  <th>REGION</th>
                  <th>GPU COUNT</th>
                  <th>NODE / HR</th>
                  <th>AVAILABILITY</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        aria-label={`Compare ${o.provider} ${o.id}`}
                        type="checkbox"
                        checked={compare.includes(o.id)}
                        disabled={
                          !compare.includes(o.id) && compare.length >= 4
                        }
                        onChange={() =>
                          setCompare((c) =>
                            c.includes(o.id)
                              ? c.filter((i) => i !== o.id)
                              : [...c, o.id],
                          )
                        }
                      />
                    </td>
                    <td>
                      <span className="brand-inline"><BrandLogo brand={o.provider} compact/><b>{o.provider}</b></span>
                      <small className="block muted">{o.gpuName}</small>
                    </td>
                    <td>{o.region}</td>
                    <td>{o.gpuCount}</td>
                    <td className="price">{money(o.price)}</td>
                    <td>{o.availability}</td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/build?gpu=${o.hardware}&quantity=${o.gpuCount}`}
                      >
                        Configure ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {compare.length > 0 && (
        <div className="compare-tray">
          <div className="section-heading">
            <h3>Compare {compare.length} machines</h3>
            <button onClick={() => setCompare([])}>Clear</button>
          </div>
          <div className="comparison-grid">
            {offers
              .filter((o) => compare.includes(o.id))
              .map((o) => (
                <div key={o.id}>
                  <b>
                    <BrandLogo brand={o.provider} compact/> {o.provider} · {o.gpuName}
                  </b>
                  <dl>
                    <dt>Whole node / hour</dt>
                    <dd>{money(o.price)}</dd>
                    <dt>VRAM / GPU</dt>
                    <dd>{o.vram ?? "Unknown"} GB</dd>
                    <dt>RAM / Disk</dt>
                    <dd>
                      {o.ram ?? "—"} / {o.disk ?? "—"} GB
                    </dd>
                    <dt>Region</dt>
                    <dd>{o.region}</dd>
                    <dt>Provisioning</dt>
                    <dd>{o.deployable ? "Supported" : "Discovery only"}</dd>
                    <dt>Bandwidth</dt>
                    <dd>{o.bandwidth ?? "Unknown"} Mbps</dd>
                    <dt>Minimum rental</dt>
                    <dd>{o.minimumHours ?? "Not reported"}</dd>
                  </dl>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
export function PriceHistory({ hardwareId }: { hardwareId?: string }) {
  const [points, setPoints] = useState<any[]>([]);
  const [period, setPeriod] = useState("ALL");
  const [error, setError] = useState("");
  useEffect(() => {
    api(`history${hardwareId ? `?hardware=${hardwareId}` : ""}`)
      .then((d) => setPoints(d.observations))
      .catch((e) => setError(e.message));
  }, [hardwareId]);
  const durations: Record<string, number> = {
    "1H": 3600000,
    "24H": 86400000,
    "7D": 604800000,
    "30D": 2592000000,
    "90D": 7776000000,
  };
  const span = points.length ? Date.now() - Date.parse(points[0].timestamp) : 0;
  const visible =
    period === "ALL"
      ? points
      : points.filter(
          (p) => Date.parse(p.timestamp) > Date.now() - durations[period],
        );
  return (
    <div className="panel price-history">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PRICE DISCOVERY</span>
          <h3>
            {hardwareId ?? "GPU"} observed median{" "}
            <span className="muted">/ USD per GPU-hour</span>
          </h3>
        </div>
        <div className="tabs">
          {[...Object.keys(durations), "ALL"]
            .filter((p) => p === "ALL" || span >= durations[p])
            .map((p) => (
              <button
                key={p}
                className={period === p ? "selected" : ""}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
        </div>
      </div>
      {error ? (
        <Empty title="History unavailable" description={error} />
      ) : (
        <HistoryChart points={visible} />
      )}
      <div className="table-note">
        Actual observations only. Missing periods are not interpolated into a
        historical market.
      </div>
    </div>
  );
}
function Providers({ detail }: { detail?: string }) {
  const { providers } = useApp();
  const provider = providers.find((p) => p.id === detail);
  return (
    <div className="page">
      <PageHead
        eyebrow="COMPUTE / PROVIDER NETWORK"
        title={provider?.name ?? "A world of machine power."}
        description="A transparent view of our provider connections, capabilities and coverage."
      />
      {provider ? (
        <>
          <div className="panel provider-detail">
            <span
              className={`badge ${provider.status === "connected" ? "green" : ""}`}
            >
              {provider.status.replaceAll("_", " ")}
            </span>
            <div className="brand-heading"><BrandLogo brand={provider.id}/><h2>{provider.name}</h2></div>
            <p>{provider.detail}</p>
            <div className="capabilities">
              {provider.capabilities.map((c) => (
                <span key={c}>
                  <Check size={13} />
                  {c}
                </span>
              ))}
            </div>
            <a
              href={provider.docs}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Official API documentation ↗
            </a>
          </div>
          <Offers providerId={provider.id} />
        </>
      ) : (
        <div className="provider-grid">
          {providers.map((p) => (
            <Link
              href={`/providers/${p.id}`}
              className="panel provider-card"
              key={p.id}
            >
              <div className="section-heading">
                <BrandLogo brand={p.id}/>
                <ArrowUpRight size={18} />
              </div>
              <h2>{p.name}</h2>
              <span
                className={`badge ${p.status === "connected" ? "green" : ""}`}
              >
                {p.status === "research"
                  ? "Not integrated"
                  : p.status.replaceAll("_", " ")}
              </span>
              <p>{p.detail}</p>
              <div className="provider-card-footer">
                <span>{p.offers} current offers</span>
                <span>
                  {p.capabilities.length ? "API ADAPTER" : "RESEARCHED"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
function Index({ arbitrage = false }: { arbitrage?: boolean }) {
  const { markets } = useApp();
  return (
    <div className="page">
      <PageHead
        eyebrow={
          arbitrage
            ? "ANALYTICS / PRICE DISPERSION"
            : "ANALYTICS / QuantumPad INDEX"
        }
        title={
          arbitrage ? "The price of perspective." : "A pulse on machine power."
        }
        description={
          arbitrage
            ? "Compare observed prices across regions and providers. Informational compute analytics."
            : "An evolving record of GPU pricing. Every point begins with a real observation."
        }
      />
      <div className="metrics">
        {markets.slice(0, 4).map((m) => (
          <Metric
            key={m.hardware}
            label={`${m.hardware} INDEX`}
            value={money(m.median)}
            sub={`${m.providers} providers · ${m.offers} observations`}
          />
        ))}
      </div>
      <PriceHistory />
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>MARKET</th>
              <th>LOWEST</th>
              <th>MEDIAN</th>
              <th>AVERAGE</th>
              <th>DISPERSION</th>
              <th>REGIONS</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.hardware}>
                <td>
                  <Link href={`/markets/${m.hardware}`}>{m.hardware} ↗</Link>
                </td>
                <td>{money(m.min)}</td>
                <td>{money(m.median)}</td>
                <td>{money(m.average)}</td>
                <td>
                  {m.dispersion == null ? "—" : `${m.dispersion.toFixed(1)}%`}
                </td>
                <td>{m.regions.join(", ") || "No observations"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel info methodology">
        <span className="eyebrow">TRANSPARENT BY DESIGN</span>
        <h2>How the index is calculated.</h2>
        <p>
          Each hardware index is the median of available provider observations,
          normalized to USD per GPU-hour. Whole-node prices are divided by GPU
          count. Provider-specific storage, taxes and network fees may differ.
        </p>
        <p>
          The aggregate is the equal-weight median of hardware medians; it is
          composition-sensitive and not an investable asset. No historical
          changes are shown before observations exist. Capacity remains unknown
          unless a provider explicitly reports it.
        </p>
      </div>
    </div>
  );
}
function Workloads() {
  return (
    <div className="page">
      <PageHead
        eyebrow="DEPLOY / WORKLOAD LIBRARY"
        title="Bring the idea. We’ll find the machine."
        description="Start from a container preset, then customize your hardware and runtime."
      />
      <div className="workload-grid">
        {templates.map((t) => (
          <Link
            href={`/build?template=${t.id}&gpu=${t.gpu}`}
            key={t.id}
            className="panel workload-card"
          >
            <div className="template-art">
              <WorkloadBrand id={t.id}/>
              <div className="art-grid" />
            </div>
            <div className="workload-content">
              <span className="eyebrow">{t.tag}</span>
              <h2>{t.name}</h2>
              <p>{t.description}</p>
              <div>
                <span className="badge">{t.gpu}</span>
                <span className="text-link">
                  Configure <ArrowUpRight size={15} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="muted footnote">
        Presets select an environment. Model downloads, training code, datasets
        and access tokens remain your responsibility. Review container images
        before deployment.
      </p>
    </div>
  );
}
export function Terminal({
  section,
  detail,
}: {
  section: string;
  detail?: string;
}) {
  if (section === "home") return <><ComputeEarth launchFocus/><QuantumHomeSections/></>;
  if (section === "index") return <>
    <ComputeEarth />
    <section id="compute-index" className="workspace-shell earth-analytics" aria-label="Compute pricing history"><Index /></section>
  </>;
  if (section === "launchpad") return <Launchpad detail={detail} />;
  if (section === "quantum") return <Quantum />;
  if (section === "playground") return <Playground />;
  if (section === "markets" || section === "watchlist")
    return <Markets detail={detail} watchOnly={section === "watchlist"} />;
  if (section === "build" || section === "calculator")
    return <Builder calculator={section === "calculator"} />;
  if (section === "estimator") return <Estimator />;
  if (section === "providers") return <Providers detail={detail} />;
  if (section === "arbitrage") return <Index arbitrage />;
  if (section === "workloads") return <Workloads />;
  if (section === "developers") return <Developers />;
  if (section === "settings") return <Settings />;
  if (section === "jobs" && detail) return <JobDetail id={detail} />;
  return <Account section={section} />;
}
