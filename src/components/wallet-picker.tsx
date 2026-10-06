"use client";
import {useEffect,useRef,useState} from "react";
import type {EIP1193Provider} from "viem";

export type WalletProvider=EIP1193Provider & {on?:(event:string,handler:(value:any)=>void)=>void;removeListener?:(event:string,handler:(value:any)=>void)=>void};
type Discovered={id:string;name:string;icon:string;provider:WalletProvider;rdns:string};
const brands=[
  {name:"MetaMask",id:"metaMaskWallet",rdns:"io.metamask",url:"https://metamask.io/download/",flag:"isMetaMask"},
  {name:"Rabby",id:"rabbyWallet",rdns:"io.rabby",url:"https://rabby.io/",flag:"isRabby"},
  {name:"Coinbase Wallet",id:"coinbaseWallet",rdns:"com.coinbase.wallet",url:"https://www.coinbase.com/wallet",flag:"isCoinbaseWallet"},
  {name:"Rainbow",id:"rainbowWallet",rdns:"me.rainbow",url:"https://rainbow.me/",flag:"isRainbow"},
  {name:"Trust Wallet",id:"trustWallet",rdns:"com.trustwallet.app",url:"https://trustwallet.com/",flag:"isTrust"},
  {name:"OKX Wallet",id:"okxWallet",rdns:"com.okex.wallet",url:"https://www.okx.com/web3",flag:"isOkxWallet"},
  {name:"Phantom",id:"phantomWallet",rdns:"app.phantom",url:"https://phantom.com/",flag:"isPhantom"},
  {name:"Zerion",id:"zerionWallet",rdns:"io.zerion.wallet",url:"https://zerion.io/wallet",flag:"isZerion"},
];

export function WalletPicker({busy,error,onSelect,onClose}:{busy:boolean;error:string;onSelect:(provider:WalletProvider)=>Promise<void>;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [wallets,setWallets]=useState<Discovered[]>([]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.showModal();
    const add=(item:Discovered)=>setWallets(current=>current.some(w=>w.provider===item.provider||w.id===item.id)?current:[...current,item]);
    const announce=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(!detail?.provider?.request||typeof detail.info?.uuid!=="string"||typeof detail.info?.name!=="string")return;
      const icon=typeof detail.info.icon==="string"&&/^data:image\/(svg\+xml|png|webp|jpeg)[;,]/.test(detail.info.icon)?detail.info.icon:"";
      add({id:detail.info.uuid,name:detail.info.name.slice(0,80),rdns:detail.info.rdns,icon,provider:detail.provider});
    };
    window.addEventListener("eip6963:announceProvider",announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const timer=setTimeout(()=>{
      const w=window as any;
      const candidates=[...(w.ethereum?.providers??[]),w.ethereum,w.rabby,w.coinbaseWalletExtension,w.okxwallet,w.phantom?.ethereum].filter(Boolean);
      candidates.forEach((provider,index)=>{
        const brand=brands.find(b=>b.flag!=="isMetaMask"&&provider[b.flag])??brands.find(b=>provider[b.flag]);
        add({id:"legacy:"+index,name:brand?.name??"Browser wallet",rdns:brand?.rdns??"",icon:brand?`/wallets/${brand.id}.svg`:"",provider});
      });
    },200);
    return()=>{clearTimeout(timer);window.removeEventListener("eip6963:announceProvider",announce);dialog.current?.close();previous?.focus();};
  },[]);
  return <dialog className="wallet-picker" ref={dialog} aria-labelledby="wallet-picker-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===dialog.current&&!busy)onClose();}}>
    <header><div><small>QuantumPad / WALLET CONNECTION</small><h2 id="wallet-picker-title">Choose your wallet</h2></div><button disabled={busy} onClick={onClose} aria-label="Close wallet chooser">×</button></header>
    <p>Connect an EVM account, then sign in on Robinhood Chain. Authentication does not request payment.</p>
    {error&&<p role="alert" className="wallet-connect-error">{error}</p>}
    {wallets.length>0&&<section aria-label="Installed wallets"><h3>Detected in this browser</h3><div className="wallet-picker-grid">{wallets.map(w=>{const brand=brands.find(b=>b.rdns===w.rdns);const icon=brand?`/wallets/${brand.id}.svg`:w.icon;return <button key={w.id} disabled={busy} onClick={()=>void onSelect(w.provider)}>{icon?<img src={icon} alt="" width="36" height="36"/>:<span className="wallet-fallback">◇</span>}<span>{w.name}<small>{busy?"Waiting for wallet…":"Connect installed wallet"}</small></span></button>;})}</div></section>}
    <section aria-label="Supported wallets"><h3>{wallets.length?"Get another wallet":"Get a wallet to connect"}</h3><div className="wallet-picker-grid">{brands.map(b=>{const installed=wallets.find(w=>w.rdns===b.rdns);return installed?<button key={b.id} disabled={busy} onClick={()=>void onSelect(installed.provider)}><img src={`/wallets/${b.id}.svg`} alt="" width="36" height="36"/><span>{b.name}<small>Connect</small></span></button>:<a key={b.id} href={b.url} target="_blank" rel="noreferrer"><img src={`/wallets/${b.id}.svg`} alt="" width="36" height="36"/><span>{b.name}<small>Official download ↗</small></span></a>;})}</div></section>
    <p className="wallet-picker-note">Use the browser extension or the wallet’s in-app browser. Phantom must use its Ethereum account. Hardware wallets can connect through a supported extension.</p>
  </dialog>;
}
