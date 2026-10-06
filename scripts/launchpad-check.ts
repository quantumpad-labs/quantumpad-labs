/** Isolated database + local EVM. Never broadcasts to a public chain. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import ganache from "ganache";
import {createPublicClient,createWalletClient,http} from "viem";
import {chain} from "../src/lib/chain";
import {deploymentData} from "../src/lib/genesis-contract";
import {saleDeploymentData} from "../src/lib/launch-finance";

async function main() {
  const source=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
  if(!source)throw new Error("Database required");
  const admin=postgres(source,{max:1,connect_timeout:10});
  const schema=`launch_test_${randomUUID().replaceAll("-","")}`;
  const url=new URL(source);url.searchParams.set("options",`-c search_path=${schema}`);
  process.env.DATABASE_URL=url.toString();process.env.APP_ORIGIN="http://localhost:3100";
  const {db}=await import("../src/lib/db");
  const {hash}=await import("../src/lib/auth");
  const {GET,POST}=await import("../src/app/api/launchpad/route");
  const {emptyDraft,canonical}=await import("../src/lib/launchpad");
  const evm=ganache.server({logging:{quiet:true},chain:{chainId:chain.id}});
  try {
    await evm.listen(0,"127.0.0.1");
    const port=(evm.address() as {port:number}).port;
    process.env.ROBINHOOD_RPC_URL=`http://127.0.0.1:${port}`;
    const transport=http(process.env.ROBINHOOD_RPC_URL),client=createPublicClient({transport,cacheTime:0}),wallet=createWalletClient({transport});
    const [creator]=await wallet.getAddresses();
    const deploy=async(data:`0x${string}`)=>{const hash=await wallet.sendTransaction({account:creator,chain:null,data,gas:(await client.estimateGas({account:creator,data}))*130n/100n});await client.waitForTransactionReceipt({hash});await evm.provider.request({method:"evm_mine",params:[]});await evm.provider.request({method:"evm_mine",params:[]});return hash;};
    await admin.unsafe(`create schema ${schema}`);
    await db().unsafe(await readFile(new URL("../migrations/001_initial.sql",import.meta.url),"utf8"));
    const owner=creator.toLowerCase(),token=randomUUID();
    await db()`insert into sessions(hash,owner,expires_at) values(${hash(token)},${owner},${new Date(Date.now()+300000)})`;
    const request=(body:unknown,cookie=true)=>new Request("http://localhost:3100/api/launchpad",{method:"POST",headers:{"content-type":"application/json",origin:"http://localhost:3100",...(cookie?{cookie:`exaflop_session=${token}`}:{})},body:JSON.stringify(body)});
    assert.equal((await POST(request({action:"publish"},false))).status,401);
    const project={...emptyDraft,name:"Integration only",symbol:"TEST",mode:"software",description:"Temporary isolated database publication check.",repository:"https://example.com/source",demo:"https://example.com/demo",version:"v1"};
    const payload={action:"publish",id:randomUUID(),project};
    const response=await POST(request(payload));assert.equal(response.status,201,await response.clone().text());
    const {launch}=await response.json();assert.equal(launch.digest,`0x${hash(canonical(launch.manifest))}`);
    assert.equal((await POST(request(payload))).status,200);
    assert.equal((await POST(request({...payload,project:{...project,supply:"2"}}))).status,409);
    const directory=await (await GET(new Request("http://localhost:3100/api/launchpad"))).json();assert.equal(directory.launches.length,1);
    assert.equal((await GET(new Request(`http://localhost:3100/api/launchpad?id=${payload.id}`))).status,200);
    assert.equal((await POST(request({action:"register",id:randomUUID(),transaction:"0x"+"a".repeat(64)}))).status,404);
    const tokenTx=await deploy(deploymentData(launch));
    const registered=await POST(request({action:"register",id:payload.id,transaction:tokenTx}));assert.equal(registered.status,200,await registered.clone().text());
    const deployed=(await registered.json()).launch;
    const now=Number((await client.getBlock()).timestamp),terms={tokensPerEth:"1000",softCap:"1",hardCap:"2",start:now+3600,end:now+86400};
    const saleTx=await deploy(saleDeploymentData(deployed,terms));
    const registration={action:"register-sale",id:payload.id,transaction:saleTx,terms};
    assert.equal((await POST(request({...registration,terms:{...terms,hardCap:"3"}}))).status,400);
    const saleResponse=await POST(request(registration));assert.equal(saleResponse.status,200,await saleResponse.clone().text());
    assert.equal((await saleResponse.json()).launch.sale.transaction,saleTx);
    assert.equal((await POST(request(registration))).status,200);
    assert.equal((await POST(request({...registration,transaction:tokenTx}))).status,409);
    console.log("Launchpad checks passed: publication, ownership, real local token/sale deployment verification, mismatched terms and idempotency.");
  }finally{await db().end();await admin.unsafe(`drop schema if exists ${schema} cascade`);await admin.end();await evm.close();}
}
main().catch(e=>{console.error("Launchpad check failed:",e.code??e.message);process.exitCode=1;});
