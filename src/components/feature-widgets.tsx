"use client";
import Link from "next/link";
import { BrandLogo, HardwareLogo } from "./brand-logo";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Rocket, Atom, Activity, ArrowUpRight, Bell, Box, Braces, ChartNoAxesCombined, Check, ChevronDown, Code2, Cpu, Database, Globe2, Layers3, Network, Play, Radio, Server, Settings2, SlidersHorizontal, Star, Wallet, WandSparkles } from "lucide-react";
import { money, useApp } from "./shell";

const featureIcons = { launchpad: Rocket, quantum: Atom, playground: Play, markets: ChartNoAxesCombined, build: Cpu, workloads: Layers3, providers: Globe2, index: Activity, dashboard: Box, jobs: Server, saved: Database, watchlist: Star, alerts: Bell, calculator: SlidersHorizontal, estimator: Cpu, arbitrage: ChartNoAxesCombined, developers: Code2, settings: Settings2 };
export function FeatureGlyph({href}:{href:string}) {
  const Icon = featureIcons[href.split("/")[1] as keyof typeof featureIcons] ?? Globe2;
  return <Icon size={15} strokeWidth={1.3} aria-hidden="true"/>;
}
export function FeatureIcon() {
  const section = usePathname().split("/")[1] as keyof typeof featureIcons;
  const Icon = featureIcons[section] ?? Globe2;
  return <span className="feature-emblem" aria-hidden="true"><Icon size={30} strokeWidth={1.2}/><span className="emblem-orbit"/></span>;
}
const workloadIcons = { inference: Network, finetune: Layers3, diffusion: WandSparkles, jupyter: Braces, blender: Box, custom: Code2, tensorflow: Cpu, quant: ChartNoAxesCombined };
export function WorkloadIcon({id}:{id:string}) {
  const Icon = workloadIcons[id as keyof typeof workloadIcons] ?? Cpu;
  return <span className="workload-emblem" aria-hidden="true"><Icon size={38} strokeWidth={1.2}/></span>;
}
export function MetricIcon({label}:{label:string}) {
  const Icon = /price|cost|spend|reserved|balance/i.test(label) ? Wallet : /gpu|hardware|vram/i.test(label) ? Cpu : /provider|region/i.test(label) ? Globe2 : /job|node|offer/i.test(label) ? Server : Activity;
  return <Icon size={16} strokeWidth={1.3} aria-hidden="true"/>;
}

export function MarketWidgets() {
  const { markets, providers, loading, watch, toggleWatch, refresh } = useApp();
  const path = usePathname();
  const [hardware, setHardware] = useState("H100");
  const selected = markets.find(m => m.hardware === hardware);
  const total = markets.reduce((sum,m) => sum + m.offers,0);
  const connected = providers.filter(p => p.status === "connected");
  const bars = markets.filter(m => m.offers > 0).sort((a,b)=>b.offers-a.offers).slice(0,5);
  const max = Math.max(1,...bars.map(m=>m.offers));
  return <details className="market-pulse" key={path} open={["/markets","/providers","/compute-index","/dashboard"].includes(path)}>
    <summary><Radio size={15} strokeWidth={1.3}/><span>Market pulse</span><small>{loading ? "Loading observations" : `${total} market offers · ${connected.length} connected provider${connected.length === 1 ? "" : "s"}`}</small><ChevronDown size={14}/></summary>
    <div className="data-widgets">
      <section className="data-widget inventory-widget" aria-label="Market offer distribution">
        <div className="widget-heading"><span><Server size={15}/> Market mix</span><Link href="/markets" aria-label="Explore compute markets"><ArrowUpRight size={17}/></Link></div>
        <div className="widget-count">{loading ? "—" : total}<small>tracked offers</small></div>
        {bars.length ? <div className="offer-bars">{bars.map(m=><Link href={`/markets/${m.hardware}`} key={m.hardware} aria-label={`${m.hardware}: ${m.offers} market offers`}><span>{m.hardware}</span><span className="offer-bar-track"><i style={{width:`${m.offers/max*100}%`}}/></span><b>{m.offers}</b></Link>)}</div> : <p>{loading ? "Reading provider catalogs…" : "No observations yet. Refresh the catalog or review connections."}</p>}
        <p className="widget-scope">Tracked hardware; unavailable offers excluded.</p>
      </section>
      <section className="data-widget quote-widget" aria-label="Hardware price explorer">
        <div className="widget-heading"><span><HardwareLogo id={hardware} compact/> Price lens</span><button onClick={()=>toggleWatch(hardware)} aria-label={`${watch.includes(hardware)?"Unwatch":"Watch"} ${hardware}`} aria-pressed={watch.includes(hardware)}><Star size={16} fill={watch.includes(hardware)?"currentColor":"none"}/></button></div>
        <select aria-label="Price lens hardware" value={hardware} onChange={e=>setHardware(e.target.value)}>{Array.from(new Set(["H100","H200","B200","A100","RTX4090",...markets.map(m=>m.hardware)])).map(h=><option key={h}>{h}</option>)}</select>
        <div className="widget-price">{money(selected?.min)}<small>/ GPU-hour</small></div>
        <p>{selected?.offers ? `${selected.offers} offers · median ${money(selected.median)}` : "No current price observation"}</p>
        <Link href={`/markets/${hardware}`} className="widget-link">Compare offers <ArrowUpRight size={14}/></Link>
      </section>
      <section className="data-widget signal-widget" aria-label="Provider connection summary">
        <div className="widget-heading"><span><Globe2 size={15}/> Provider signal</span><button onClick={refresh} aria-label="Refresh market pulse"><Radio size={16}/></button></div>
        <div className="signal-readout"><span className="signal-orbit" aria-hidden="true"><Globe2 size={44} strokeWidth={.8}/><i/></span><div><strong>{loading ? "—" : connected.length}<small> / {providers.length}</small></strong><p>catalogs connected</p></div></div>
        <div className="provider-signals">{providers.slice(0,4).map(p=><Link key={p.id} href={`/providers/${p.id}`}><span className={p.status === "connected" ? "signal-connected" : "signal-offline"}>{p.status === "connected" ? <Check size={12}/> : <Settings2 size={12}/>}</span><BrandLogo brand={p.id} compact/>{p.name}<small>{p.status === "connected" ? `${p.offers} in catalog` : "View setup"}</small></Link>)}</div>
        <Link href="/settings" className="widget-link">Manage connections <ArrowUpRight size={14}/></Link>
      </section>
    </div>
  </details>;
}
