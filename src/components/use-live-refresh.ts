"use client";
import {useCallback,useEffect,useRef} from "react";

// Only repeat read operations. Wallet actions and transaction quotes stay explicit.
export function useLiveRefresh(load:()=>Promise<unknown>, interval=30000){
 const latest=useRef(load),pending=useRef(false);
 useEffect(()=>{latest.current=load;});
 const refresh=useCallback(async()=>{
  if(pending.current)return;
  pending.current=true;
  try{await latest.current();}finally{pending.current=false;}
 },[]);
 useEffect(()=>{
  const resume=()=>{if(document.visibilityState!=="hidden"&&navigator.onLine)void refresh();};
  resume();
  const timer=window.setInterval(resume,interval);
  window.addEventListener("focus",resume);
  window.addEventListener("online",resume);
  document.addEventListener("visibilitychange",resume);
  return()=>{clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);};
 },[refresh,interval]);
 return refresh;
}
