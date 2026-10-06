"use client";
import {useCallback,useEffect,useState} from "react";
import type {LaunchRecord} from "@/lib/launchpad";

export function useLaunchDirectory(enabled=true){
 const [records,setRecords]=useState<LaunchRecord[]>([]);
 const [loading,setLoading]=useState(enabled),[refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState(""),[checkedAt,setCheckedAt]=useState<Date|null>(null);
 const [revision,setRevision]=useState(0);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  if(!enabled)return;
  let active=true,inFlight=false;
  const controller=new AbortController();
  async function load(){
   if(inFlight||document.visibilityState==="hidden")return;
   inFlight=true;setRefreshing(true);
   try{
    const response=await fetch("/api/launchpad",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    const data=await response.json();
    if(!response.ok||!data.available)throw new Error("Launch directory unavailable. Retrying automatically.");
    if(active){setRecords(data.launches);setError("");setCheckedAt(new Date());}
   }catch(e){if(active)setError(e instanceof Error?e.message:"Launch refresh failed.");}
   finally{inFlight=false;if(active){setLoading(false);setRefreshing(false);}}
  }
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  const resume=()=>void load();
  window.addEventListener("focus",resume);
  window.addEventListener("online",resume);
  document.addEventListener("visibilitychange",resume);
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);};
 },[enabled,revision]);
 return {records,loading,refreshing,error,checkedAt,refresh};
}
export function LaunchRefresh({directory}:{directory:ReturnType<typeof useLaunchDirectory>}){
 return <div className="launch-refresh"><span>{directory.checkedAt?`Checked ${directory.checkedAt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"Checking launches…"} · Updates every 30s</span><button className="button secondary" onClick={directory.refresh} disabled={directory.refreshing}>{directory.refreshing?"Refreshing…":"Refresh launches"}</button>{directory.error&&<span role="status">{directory.error}{directory.records.length>0?" Showing last successful results.":""}</span>}</div>;
}
