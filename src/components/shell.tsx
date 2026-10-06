"use client";
import Link from "next/link";
import NextImage from "next/image";
import { HardwareLogo } from "./brand-logo";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Activity,
  Atom,
  Rocket,
  ArrowUpRight,
  Box,
  ChartNoAxesCombined,
  Code2,
  Cpu,
  Globe2,
  Layers3,
  LayoutGrid,
  Search,
  Server,
  Settings2,
  SlidersHorizontal,
  Star,
  Wallet,
  X,
  Zap,
  Bell,
} from "lucide-react";
import { createWalletClient, custom } from "viem";
import { WalletPicker, type WalletProvider } from "./wallet-picker";
import { chain } from "@/lib/chain";
import { ensureWalletChain, walletAccountChanged, type WalletSession } from "@/lib/wallet-session";
import type { Market, ProviderStatus } from "@/lib/types";
export async function api<T = any>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    cache: "no-store",
    signal: !body && (!method || method === "GET") ? AbortSignal.timeout(20000) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
type AppState = {
  markets: Market[];
  providers: ProviderStatus[];
  loading: boolean;
  owner: string;
  wallet: string;
  walletProvider: WalletProvider | null;
  connect: () => Promise<WalletSession | null>;
  notify: (text: string) => void;
  refresh: () => void;
  watch: string[];
  toggleWatch: (id: string) => void;
};
const Context = createContext<AppState>(null!);
export const useApp = () => useContext(Context);
export const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(v);
const nav = [
  { label: "QuantumPad", href: "/", icon: LayoutGrid },
  { label: "Launchpad", href: "/launchpad", icon: Rocket },
  { label: "Quantum lab", href: "/quantum", icon: Atom },
  { label: "Live playground", href: "/playground", icon: Zap },
  { label: "Compute markets", href: "/markets", icon: ChartNoAxesCombined },
  { label: "Build a machine", href: "/build", icon: Cpu },
  { label: "Workloads", href: "/workloads", icon: Layers3 },
  { label: "Providers", href: "/providers", icon: Globe2 },
  { label: "Compute index", href: "/compute-index", icon: Activity },
];
const workspace = [
  { label: "My dashboard", href: "/dashboard", icon: Box },
  { label: "Jobs & clusters", href: "/jobs", icon: Server },
  { label: "Saved machines", href: "/saved", icon: Layers3 },
  { label: "Watchlist", href: "/watchlist", icon: Star },
  { label: "Alerts", href: "/alerts", icon: Bell },
];
const tools = [
  { label: "Settings & connections", href: "/settings", icon: Settings2 },
  { label: "Cost calculator", href: "/calculator", icon: SlidersHorizontal },
  { label: "Model estimator", href: "/estimator", icon: Cpu },
  { label: "Price dispersion", href: "/arbitrage", icon: ChartNoAxesCombined },
  { label: "Developer API", href: "/developers", icon: Code2 },
];
const navigationGroups = [
  { label: "QuantumPad", items: nav.slice(0,3) },
  { label: "Compute", items: nav.slice(3) },
  { label: "Workspace", items: workspace },
  { label: "Tools", items: tools },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isEarth = path === "/" || path === "/compute-index";
  const router = useRouter();
  const [market, setMarket] = useState<Market[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState("");
  const [wallet, setWallet] = useState("");
  const [toast, setToast] = useState("");
  const [watch, setWatch] = useState<string[]>([]);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [walletPicker,setWalletPicker]=useState(false);
  const [walletError,setWalletError]=useState("");
  const [activeProvider,setActiveProvider]=useState<WalletProvider|null>(null);
  const connectResolve=useRef<((session:WalletSession|null)=>void)|null>(null);
  const authVersion=useRef(0);
  const pendingLogout=useRef<Promise<unknown>>(Promise.resolve());
  const connectingRef=useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const notify = useCallback((s: string) => setToast(s), []);
  const marketRequest = useRef(false);
  const refresh = useCallback(() => {
    if (marketRequest.current) return;
    marketRequest.current = true;
    api("markets")
      .then((d) => {
        setMarket(d.markets);
        setProviders(d.providers);
      })
      .catch((e) => notify(e.message))
      .finally(() => { marketRequest.current = false; setLoading(false); });
  }, [notify]);
  useEffect(() => {
    refresh();
    const resume = () => { if(document.visibilityState !== "hidden" && navigator.onLine) refresh(); };
    const timer = setInterval(resume, 60000);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    try {
      const saved = JSON.parse(
        localStorage.getItem("exaflop:watch:v1") ?? "[]",
      );
      setWatch(
        Array.isArray(saved)
          ? saved.filter((v: unknown) => typeof v === "string")
          : [],
      );
    } catch {}
    return () => { clearInterval(timer); window.removeEventListener("focus", resume); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, [refresh]);
  useEffect(() => {
    const version = authVersion.current;
    api("health")
      .then((h) => {
        if (h.database)
          api("me")
            .then((a) => { if(version === authVersion.current) setOwner(a.owner); })
            .catch(() => {});
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (palette) dialog.current?.showModal();
    else dialog.current?.close();
  }, [palette]);
  useEffect(() => {
    setPalette(false);
  }, [path]);
  const connect = () => {
    setWalletError("");
    setWalletPicker(true);
    return new Promise<WalletSession|null>(resolve=>{connectResolve.current?.(null);connectResolve.current=resolve;});
  };
  const closeWalletPicker=()=>{setWalletPicker(false);connectResolve.current?.(null);connectResolve.current=null;};
  const connectProvider = async (ethereum: WalletProvider) => {
    if (connectingRef.current) return;
    connectingRef.current=true;
    authVersion.current++;
    setWalletError("");
    setConnecting(true);
    try {
      const client = createWalletClient({ chain, transport: custom(ethereum) });
      const [address] = await client.requestAddresses();
      if(!address)throw new Error("Select an Ethereum account in your wallet.");
      await ensureWalletChain(ethereum);
      await pendingLogout.current;
      const c = await api("auth/challenge", { address });
      const signature = await client.signMessage({
        account: address,
        message: c.message,
      });
      const a = await api("auth/verify", { nonce: c.nonce, signature });
      const [selected] = await client.getAddresses();
      if(selected?.toLowerCase()!==a.owner.toLowerCase()){
        pendingLogout.current=api("auth/logout", {}).catch(()=>{});
        throw new Error("Wallet account changed during sign-in. Connect the selected account again.");
      }
      setWallet(address);
      setActiveProvider(ethereum);
      setOwner(a.owner);
      connectResolve.current?.({owner:a.owner,provider:ethereum});
      connectResolve.current=null;
      closeWalletPicker();
      notify("Wallet authenticated. No payment was requested.");
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Wallet connection failed.");
      notify(e instanceof Error ? e.message : "Wallet connection failed.");
    } finally {
      connectingRef.current=false;
      setConnecting(false);
    }
  };
  useEffect(() => {
    const eth = activeProvider;
    if (!eth?.on) return;
    const changed = () => {
      if(connectingRef.current)return;
      authVersion.current++;
      setOwner("");
      setWallet("");
      setActiveProvider(null);
      pendingLogout.current=api("auth/logout", {}).catch(() => {});
    };
    const accountsChanged = (accounts: unknown) => {
      if(walletAccountChanged(accounts,owner))changed();
    };
    eth.on("accountsChanged", accountsChanged);
    eth.on("disconnect", changed);
    return () => {
      eth.removeListener?.("accountsChanged", accountsChanged);
      eth.removeListener?.("disconnect", changed);
    };
  }, [activeProvider,owner]);
  const toggleWatch = (id: string) =>
    setWatch((prev) => {
      const next = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id];
      localStorage.setItem("exaflop:watch:v1", JSON.stringify(next));
      return next;
    });
  return (
    <Context.Provider
      value={{
        markets: market,
        providers,
        loading,
        owner,
        wallet,
        walletProvider: activeProvider,
        connect,
        notify,
        refresh,
        watch,
        toggleWatch,
      }}
    >
      {walletPicker&&<WalletPicker busy={connecting} error={walletError} onSelect={connectProvider} onClose={closeWalletPicker}/>}
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className={`main-shell ${isEarth ? "atlas-shell" : "workspace-shell"}`}>
        <header className="topbar">
          <div className="workspace-identity">
            <Link href="/" className="earth-return" aria-label="QuantumPad home"><NextImage src="/quantumpad-logo.png" alt="" width={28} height={28} /> quantumpad</Link>
            <span className="workspace-divider" />
            <span className="workspace-location">{[...nav,...workspace,...tools].find(n=>n.href===path)?.label ?? path.split("/").filter(Boolean).at(-1)}</span>
          </div>
          <div className="top-actions">
            <button className="workspace-search" onClick={()=>setPalette(true)} aria-label="Search all features"><Search size={16}/><span>Search</span><kbd>⌘ K</kbd></button>
            <span className="network">
              <i /> {chain.name}
            </span>
            <button
              className="wallet-button"
              onClick={connect}
              disabled={connecting}
            >
              <Wallet size={15} />
              {connecting
                ? "Connecting…"
                : owner
                  ? `${owner.slice(0, 6)}…${owner.slice(-4)}`
                  : "Connect wallet"}
            </button>
          </div>
        </header>
        {!isEarth && <><nav className="product-nav" aria-label="Primary product navigation">{[...nav.slice(0,3), ...nav.filter(n=>["/playground","/markets","/compute-index"].includes(n.href)).map(n=>({...n,label:n.href==="/markets"?"Compute workspace":n.href==="/compute-index"?"Earth & compute index":n.label}))].map(n=><Link key={n.href} href={n.href} aria-current={path===n.href||(n.href!=="/"&&path.startsWith(n.href+"/"))?"page":undefined}><n.icon size={17}/>{n.label}</Link>)}<Link className="product-create" href="/launchpad?create=hardware">Create a launch <ArrowUpRight size={15}/></Link></nav><details className="secondary-navigation"><summary>Compute workspace & tools <span>Markets · machines · jobs · settings</span></summary><nav className="feature-map" aria-label="Supporting features">{navigationGroups.slice(1).map(({label,items})=><div className="feature-row" key={label}><span>{label}</span><div>{items.map(n=><Link key={n.href} href={n.href} aria-current={path===n.href||(n.href!=="/"&&path.startsWith(n.href+"/"))?"page":undefined}><n.icon size={14}/>{n.label}</Link>)}</div></div>)}</nav></details></>}
        {!path.startsWith("/launchpad")&&!path.startsWith("/quantum")&&<div className="ticker">
          <span className="ticker-label">
            <span className="status-dot" /> COMPUTE TICKER
          </span>
          {["H100", "H200", "B200", "A100", "MI300X"].map((h) => {
            const m = market.find((m) => m.hardware === h);
            return (
              <Link href={`/markets/${h}`} key={h}>
                <HardwareLogo id={h} compact/><b>{h}</b>
                <span>{money(m?.min)}</span>
                <small>{m?.min ? " / GPU-HR" : "NO OBSERVATIONS"}</small>
                {m?.change24h != null && (
                  <span className="ticker-change">
                    {m.change24h >= 0 ? "+" : ""}
                    {m.change24h.toFixed(1)}%
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        }
        <main id="content">{children}</main>
        <footer className="footer">
          <span>
            <span className="status-dot" />{" "}
            {providers.filter((p) => p.status === "connected").length} provider
            connections
          </span>
          <span>
            Prices in USD · Availability subject to provider confirmation
          </span>
          <Link href="/developers">SYSTEM DOCUMENTATION ↗</Link>
          <a href="https://x.com/qpadrobinhood" target="_blank" rel="noopener noreferrer" aria-label="QuantumPad on X: @qpadrobinhood">X · @qpadrobinhood ↗</a>
        </footer>
      </div>
      <dialog
        ref={dialog}
        className="palette"
        aria-label="Search all features"
        onCancel={() => setPalette(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setPalette(false);
        }}
      >
        <div className="palette-search">
          <Search size={20} />
          <input
            aria-label="Search commands"
            autoFocus
            placeholder="Where do you want to go?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-button"
            onClick={() => setPalette(false)}
            aria-label="Close commands"
          >
            <X size={18} />
          </button>
        </div>
        <div className="palette-results">
          {navigationGroups.map(group => {
            const matches = group.items.filter(n => n.label.toLowerCase().includes(query.toLowerCase()));
            return matches.length ? <section className="command-group" key={group.label} aria-label={group.label}>
              <h3>{group.label}</h3>
              {matches.map(n => <button key={n.href} onClick={() => {router.push(n.href);setPalette(false);setQuery("");}}>
                <span className="command-icon"><n.icon size={18} strokeWidth={1.4}/></span>
                <span>{n.label}<small>{n.href === "/" ? "Global compute explorer" : n.href.slice(1)}</small></span>
                <ArrowUpRight size={14}/>
              </button>)}
            </section> : null;
          })}
          {![...nav,...workspace,...tools].some(n=>n.label.toLowerCase().includes(query.toLowerCase())) && <p className="command-empty">No matching features. Try “markets”, “jobs”, or “settings”.</p>}
          <button
            onClick={() => {
              setPalette(false);
              connect();
            }}
          >
            <Wallet size={17} />
            Connect wallet
          </button>
        </div>
        <div className="command-footer"><span>Navigate your workspace</span><span><kbd>Tab</kbd> move <kbd>Esc</kbd> close</span></div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
