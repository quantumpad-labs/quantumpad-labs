"use client";

import Link from "next/link";
import NextImage from "next/image";
import { preload } from "react-dom";
import { BrandLogo, HardwareLogo } from "./brand-logo";
import { FeatureGlyph } from "./feature-widgets";
import { useEffect, useRef, useState } from "react";
import { api, money, useApp } from "./shell";
import { field, fieldTexture } from "@/lib/earth-field";
import { earthSurface } from "@/lib/earth-surface";
import { earthRegions, buildOfferUrl, regionFor, regionInventory } from "@/lib/earth-regions";
import type { Offer } from "@/lib/types";

const destinations = [
  ["Launch", [["Launchpad", "/launchpad"], ["Quantum lab", "/quantum"]]],
  ["Compute", [["Markets", "/markets"], ["Playground", "/playground"], ["Build a machine", "/build"], ["Workloads", "/workloads"], ["Providers", "/providers"], ["Compute index", "/compute-index"]]],
  ["Workspace", [["Dashboard", "/dashboard"], ["Jobs & clusters", "/jobs"], ["Saved machines", "/saved"], ["Watchlist", "/watchlist"], ["Alerts", "/alerts"]]],
  ["Tools", [["Calculator", "/calculator"], ["Model estimator", "/estimator"], ["Price dispersion", "/arbitrage"], ["Developer API", "/developers"], ["Settings & connections", "/settings"]]],
] as const;
import {QuantumHomeHero} from "./quantum-home";
type Point = [number, number];

export function ComputeEarth({launchFocus=false}:{launchFocus?:boolean}) {
  preload("/earth-blue-marble.webp", { as: "image", fetchPriority: "high" });
  const { markets, providers, loading, refresh, connect, owner } = useApp();
  const canvas = useRef<HTMLCanvasElement>(null);
  const satelliteData = useRef<ImageData | null>(null);
  const rotation = useRef({ lon: 85, lat: 10 });
  const drag = useRef<Point | null>(null);
  const pins = useRef<Record<string, HTMLButtonElement | null>>({});
  const [surface, setSurface] = useState("satellite");
  const [region, setRegion] = useState("all");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerError, setOfferError] = useState("");
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [surfaceError, setSurfaceError] = useState(false);
  const [menu, setMenu] = useState(!launchFocus);
  const [grid, setGrid] = useState(true);
  const [motion, setMotion] = useState(true);
  const [projection, setProjection] = useState("globe");
  const [hardware, setHardware] = useState("All");
  const [mapError, setMapError] = useState(false);
  const [metric, setMetric] = useState("price");
  const [quotes, setQuotes] = useState(!launchFocus);
  const chooseRegion = (id: string) => {
    setRegion(id); setQuotes(true);
    const location = earthRegions.find(r => r.id === id);
    if(location) rotation.current = { lon: location.lon, lat: location.lat };
  };
  useEffect(() => {
    let active=true;
    async function load(){
      try { const result=await api<{offers:Offer[]}>("offers");if(active){setOffers(result.offers);setOfferError("");} }
      catch { if(active)setOfferError("Provider inventory could not be refreshed. Try again."); }
      finally { if(active)setOfferLoading(false); }
    }
    void load();const timer=setInterval(load,60000);
    return()=>{active=false;clearInterval(timer);};
  },[inventoryVersion]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let coast: Point[][] = [], frame = 0, disposed = false, tick = 0, lastPaint = 0;
    let texture: HTMLCanvasElement | null = null, textureKey = "";
    let satellite = satelliteData.current, satelliteFailed = false;
    const satelliteImage = new Image();
    satelliteImage.onload=()=>{
      if(disposed)return;
      const source=document.createElement("canvas");source.width=satelliteImage.naturalWidth;source.height=satelliteImage.naturalHeight;
      const sourceContext=source.getContext("2d")!;sourceContext.drawImage(satelliteImage,0,0);
      satellite=sourceContext.getImageData(0,0,source.width,source.height);satelliteData.current=satellite;textureKey="";setSurfaceError(false);
    };
    satelliteImage.onerror=()=>{if(!disposed){satelliteFailed=true;textureKey="";setSurfaceError(true);}};
    satelliteImage.fetchPriority="high";
    if(!satellite)satelliteImage.src="/earth-blue-marble.webp";
    const abort = new AbortController();
    fetch("/coastlines.geojson", { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error("Map unavailable");
      return r.json();
    }).then(data => { coast = data.features.flatMap((f: {geometry: {type: string; coordinates: Point[] | Point[][]}}) => f.geometry.type === "LineString" ? [f.geometry.coordinates as Point[]] : f.geometry.coordinates as Point[][]); }).catch(() => { if (!disposed) setMapError(true); });
    const draw = () => {
      if (disposed) return;
      if (document.hidden || performance.now() - lastPaint < (motion ? 33 : 100)) { frame = requestAnimationFrame(draw); return; }
      lastPaint = performance.now();
      const { width: w, height: h } = el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== Math.round(w*dpr) || el.height !== Math.round(h*dpr)) { el.width = Math.round(w*dpr); el.height = Math.round(h*dpr); }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,w,h);
      const r = Math.min(w * .46, h * .45);
      const cx = w * .5, cy = h * .5;
      const rad = Math.PI / 180, lat0 = rotation.current.lat * rad;
      const project = (lon: number, lat: number): [number, number, boolean] => {
        const a = ((lon - rotation.current.lon + 540) % 360 - 180) * rad, b = lat * rad;
        if (projection === "map") return [cx + a / Math.PI * r * 1.5, cy - b / Math.PI * r * 1.5, true];
        return [cx + r * Math.cos(b) * Math.sin(a), cy - r * (Math.cos(lat0)*Math.sin(b)-Math.sin(lat0)*Math.cos(b)*Math.cos(a)), Math.sin(lat0)*Math.sin(b)+Math.cos(lat0)*Math.cos(b)*Math.cos(a) > 0];
      };
      for(const location of earthRegions){
        const pin=pins.current[location.id];if(!pin)continue;
        const [x,y,visible]=project(location.lon,location.lat);
        pin.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
        pin.hidden=!visible;
      }
      if(projection==="globe"){
        const atmosphere=ctx.createRadialGradient(cx,cy,r*.98,cx,cy,r*1.055);
        atmosphere.addColorStop(0,"#49a2ef30");atmosphere.addColorStop(.4,"#277ac526");atmosphere.addColorStop(1,"#00000000");
        ctx.fillStyle=atmosphere;ctx.fillRect(cx-r*1.06,cy-r*1.06,r*2.12,r*2.12);
      }
      ctx.save();
      ctx.beginPath();
      if (projection === "globe") ctx.arc(cx,cy,r,0,Math.PI*2); else ctx.rect(cx-r*1.5,cy-r*.75,r*3,r*1.5);
      ctx.clip();
      const key = rotation.current.lon.toFixed(1)+':'+rotation.current.lat.toFixed(1)+':'+projection+':'+surface+':'+!!satellite+':'+!!drag.current;
      if(key!==textureKey){texture=surface==="satellite"&&satellite?earthSurface(satellite,rotation.current.lon,rotation.current.lat,projection==="map",drag.current||motion?360:800):surface==="flow"||satelliteFailed?fieldTexture(rotation.current.lon,rotation.current.lat,projection==="map"):null;textureKey=key;}
      if(!texture){ctx.fillStyle="#080c25";ctx.fillRect(0,0,w,h);}
      if(texture){if(projection==="map")ctx.drawImage(texture,cx-r*1.5,cy-r*.75,r*3,r*1.5);else ctx.drawImage(texture,cx-r,cy-r,r*2,r*2);}
      // Illustrative vector field: this is not weather or compute telemetry.
      for(let i=0;i<(surface==="flow"?3400:0);i++){
        let lon=(i*137.508)%360-180,lat=Math.asin((i/3400)*2-1)/rad;
        const phase=motion?((tick+i)%90)/90:.5;
        ctx.strokeStyle='rgba(210,244,221,'+(.12+Math.sin(phase*Math.PI)*.38)+')';
        ctx.lineWidth=.65;ctx.beginPath();let started=false;
        for(let j=0;j<16;j++){
          const [u,v]=field(lon,lat);lon+=u*.18;lat=Math.max(-89,Math.min(89,lat+v*.18));
          const p=project(lon,lat);if(j<phase*5)continue;
          if(p[2]){if(started)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);started=true;}else started=false;
        }ctx.stroke();
      }
      const line = (points: Point[], color: string) => {
        ctx.strokeStyle=color; ctx.lineWidth=.65; ctx.beginPath(); let prev: [number, number, boolean] | null=null;
        for(const [lon,lat] of points) { const p=project(lon,lat); if(p[2]) { if(prev && Math.abs(p[0]-prev[0])<r*.3) ctx.lineTo(p[0],p[1]); else ctx.moveTo(p[0],p[1]); prev=p; } else prev=null; } ctx.stroke();
      };
      if(grid) {
        for(let lat=-60;lat<=60;lat+=30) line(Array.from({length:361},(_,i)=>[i-180,lat]),"#7294ad35");
        for(let lon=-180;lon<180;lon+=30) line(Array.from({length:181},(_,i)=>[lon,i-90]),"#7294ad35");
      }
      if(surface==="flow")coast.forEach(points=>line(points,"#cee0e6b8"));
      ctx.restore();
      if(projection==="globe") {ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle="#8bbbd65c";ctx.lineWidth=1;ctx.stroke();}
      if(motion && !document.hidden) tick++;
      if(motion && surface==="satellite" && satellite && !drag.current) rotation.current.lon+=.15;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { disposed=true; satelliteImage.onload=null;satelliteImage.onerror=null;abort.abort(); cancelAnimationFrame(frame); };
  }, [grid, motion, projection, surface]);

  const shown = markets.filter(m => hardware === "All" || m.hardware === hardware);
  const sorted = [...shown].sort((a,b) => metric === "price" ? (a.min ?? Infinity)-(b.min ?? Infinity) : b.offers-a.offers);
  const rotate = (amount: number) => { rotation.current.lon += amount; };
  const inventory = regionInventory(offers, region, hardware);
  const localOffers = inventory.display;
  const regionName = earthRegions.find(r=>r.id===region)?.name ?? (region==="unmapped"?"Global provider catalog":"All regions");
  const markerLabel = (id:string) => {
    if(offerLoading)return "Loading…";
    if(offerError)return "Inventory unavailable";
    const data=regionInventory(offers,id,hardware);
    const count=data.display.length;
    return `${count} ${data.elsewhere?"offers elsewhere":data.fallback?"global catalog offers":`regional offer${count===1?"":"s"}`}`;
  };
  return <section className={`compute-earth ${launchFocus?"quantum-home-earth":""}`} aria-label={launchFocus?"QuantumPad launchpad and interactive Earth":"Global compute explorer"}>
    <canvas ref={canvas} className="earth-canvas" role="img" aria-label="Interactive Earth. Select a regional marker or use the Region control to explore compute offers."
      onPointerDown={e=>{drag.current=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!drag.current)return;rotation.current.lon-=(e.clientX-drag.current[0])*.3;rotation.current.lat=Math.max(-75,Math.min(75,rotation.current.lat+(e.clientY-drag.current[1])*.3));drag.current=[e.clientX,e.clientY];}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
       />
    <div className="earth-pins" aria-label="Regional compute selectors">{earthRegions.map(location=><button hidden key={location.id} ref={el=>{pins.current[location.id]=el;}} className="earth-pin" aria-pressed={region===location.id} aria-label={`Explore ${location.name} compute offers`} onClick={()=>chooseRegion(location.id)}><i/><span>{location.name}<small>{markerLabel(location.id)}</small></span></button>)}</div>
    <button className="earth-catalog-summary" onClick={()=>chooseRegion("all")}>{offerLoading?"Loading provider catalog…":offerError?"Catalog unavailable":`${offers.filter(o=>regionFor(o.region)).length} regional offers · explore compute ↗`}</button>
    {launchFocus&&<QuantumHomeHero/>}<header className="earth-heading"><span>THE MARKET FOR MACHINE POWER</span><h1>Compute. Everywhere.</h1><p>Explore GPU markets. Build your machine. Run real work.</p></header>
    {!launchFocus&&<div className="earth-shortcuts"><a href="#compute-index">Price history ↓</a><Link href="/playground">Try live compute ↗</Link><Link href="/build">Build a machine ↗</Link><button onClick={connect}>{owner ? `${owner.slice(0,6)}…${owner.slice(-4)}` : "Connect wallet"}</button></div>}
    {quotes && <aside className="earth-market" aria-label="Compute market observations">
      <div className="earth-panel-title">{regionName}<button aria-label="Close market panel" onClick={()=>setQuotes(false)}>×</button></div>
      <p className="earth-source">Regional selectors are geographic filters, not datacenter coordinates.</p>
      <label className="earth-hardware">Hardware <select value={hardware} onChange={e=>setHardware(e.target.value)}><option>All</option>{markets.map(m=><option key={m.hardware}>{m.hardware}</option>)}</select></label>
      {region!=="all" ? <div className="earth-region-results" aria-live="polite">
        <p>{offerLoading?"Loading provider inventory…":`${localOffers.length} ${inventory.elsewhere?"available elsewhere":inventory.fallback||region==="unmapped"?"global catalog":"regional"} offers`}</p>
        {inventory.elsewhere&&<p>No offers are currently confirmed in {regionName}. These are real offers in other regions; their actual locations are listed below. They do not represent local capacity.</p>}
        {(!inventory.elsewhere&&(inventory.fallback||region==="unmapped"))&&<p>These providers publish GPU prices without a confirmed location. Browse the global catalog below; choose and confirm a region at provider checkout. These offers are not confirmed in {region==="unmapped"?"any specific region":regionName}.</p>}
        {offerError&&<p role="alert">{offerError}</p>}
        {!offerLoading&&!offerError&&!localOffers.length&&<p>No catalog offers match this hardware filter. Try another GPU or check provider connections.</p>}
        {localOffers.map(o=><article key={o.id}><Link href={`/markets/${encodeURIComponent(o.hardware)}`}>{o.gpuCount} × {o.hardware}</Link><span>{money(o.price)} / node-hr</span><small className="brand-inline"><BrandLogo brand={o.provider} compact/>{o.provider} · {o.region} · {o.availability}</small><Link className="earth-offer-build" href={buildOfferUrl(o)}>{regionFor(o.region)?"Configure this hardware & region":"Configure GPU · choose location at checkout"} ↗</Link></article>)}
        <div className="earth-region-actions"><button onClick={()=>chooseRegion("unmapped")}>Global catalog ({offers.filter(o=>!regionFor(o.region)).length})</button><Link href="/providers">Provider connections ↗</Link><Link href="/playground">Try browser compute ↗</Link></div>
      </div> : <><div className="earth-market-head"><span>GPU</span><span>{metric === "price" ? "FROM / GPU-HR" : "OBSERVED OFFERS"}</span></div>
      {loading ? <p role="status">Loading market observations…</p> : sorted.length ? sorted.slice(0,6).map(m=><Link className="earth-market-row" key={m.hardware} href={`/markets/${m.hardware}`}><strong className="brand-inline"><HardwareLogo id={m.hardware} compact/>{m.hardware}</strong><span>{metric === "price" ? money(m.min) : m.offers.toLocaleString()}</span></Link>) : <p>No observations available. <Link href="/providers">Check providers ↗</Link></p>}
      </>}
      <p className="earth-source">{providers.filter(p=>p.status==="connected").length} connected providers · refreshes every minute<br/>Prices and availability require provider confirmation.</p>
    </aside>}
    <div className="earth-menu-area">
      {menu && <div id="earth-controls" className="earth-controls">
        <div className="earth-control-row"><span>Data</span><div>GPU market observations <button onClick={()=>{refresh();setInventoryVersion(v=>v+1);}}>Refresh ↻</button></div></div>
        <div className="earth-control-row"><span>Region</span><div><select aria-label="Explore compute region" value={region} onChange={e=>chooseRegion(e.target.value)}><option value="all">All regions</option>{earthRegions.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}<option value="unmapped">Global catalog / automatic</option></select></div></div>
        <div className="earth-control-row"><span>Earth</span><div><button aria-pressed={surface==="satellite"} onClick={()=>{setSurface("satellite");setMotion(false);}}>Satellite</button><button aria-pressed={surface==="flow"} onClick={()=>setSurface("flow")}>Illustrative flow</button></div></div>
        <div className="earth-control-row"><span>Source</span><div><Link href="/providers">Provider catalogs ↗</Link></div></div>
        <div className="earth-control-row"><span>Display</span><div>{[["price","Price"],["offers","Offers"]].map(([id,label])=><button key={id} aria-pressed={metric===id&&quotes} onClick={()=>{setMetric(id);setQuotes(true);}}>{label}</button>)}<button aria-pressed={!quotes} onClick={()=>setQuotes(false)}>Globe only</button></div></div>
        <div className="earth-control-row"><span>Control</span><div><button aria-pressed={grid} onClick={()=>setGrid(!grid)}>Grid</button><button aria-pressed={motion} onClick={()=>setMotion(!motion)}>{motion?"Pause":"Animate"}</button><button aria-label="Rotate globe west" onClick={()=>rotate(-30)}>←</button><button aria-label="Rotate globe east" onClick={()=>rotate(30)}>→</button><button onClick={()=>{rotation.current={lon:65,lat:15};}}>Reset</button></div></div>
        <div className="earth-control-row"><span>Projection</span><div><button aria-pressed={projection==="globe"} onClick={()=>setProjection("globe")}>Globe</button><button aria-pressed={projection==="map"} onClick={()=>setProjection("map")}>Map</button></div></div>
        <nav aria-label="All QuantumPad features">{destinations.map(([title,links])=><div className="earth-control-row earth-nav-row" key={title}><span>{title}</span><div>{links.map(([label,href])=><Link key={href} href={href}><FeatureGlyph href={href}/>{label}</Link>)}</div></div>)}</nav>
      </div>}
      <button className="earth-wordmark" aria-expanded={menu} aria-controls="earth-controls" onClick={()=>setMenu(!menu)}><NextImage src="/quantumpad-logo.png" alt="" width={28} height={28} style={{display:"inline-block",verticalAlign:"middle",marginRight:8}} />{launchFocus?"Earth controls":"quantumpad"} <span>≡</span></button>
    </div>
    <div className="earth-caption">Drag to rotate · select a region to explore compute<br/><span>{surface==="satellite"?(surfaceError?"Satellite image unavailable · showing illustrative fallback":"Historic satellite composite · not live imagery"):"Illustrative flow · not capacity or traffic"}</span><br/><a href="https://svs.gsfc.nasa.gov/2915/" target="_blank" rel="noreferrer">Imagery: NASA / GSFC · Blue Marble</a><br/><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">{mapError?"Coastlines unavailable":"Coastlines: Natural Earth"}</a></div>
  </section>;
}
