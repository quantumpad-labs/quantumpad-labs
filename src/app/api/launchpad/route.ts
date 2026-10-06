import { randomUUID } from "node:crypto";
import { createPublicClient,http,formatEther,zeroAddress } from "viem";
import {curveFactoryAbi,curveProtocol,verifyCurveProtocol,verifyCurveReceipt} from "@/lib/curve-launch";
import {genesisArt} from "@/lib/genesis-art";
import { z } from "zod";
import { db,get,ServiceError } from "@/lib/db";
import { identity,hash,rate } from "@/lib/auth";
import { canonical,draftSchema,readiness,type Manifest,type LaunchRecord } from "@/lib/launchpad";
import { deploymentMatches } from "@/lib/genesis-contract";
import { chain } from "@/lib/chain";
import { saleTermsSchema,saleDeploymentData } from "@/lib/launch-finance";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
function failure(error:unknown){if(error instanceof ServiceError)return reply({error:error.message},error.status);if(error instanceof z.ZodError)return reply({error:error.issues.map(i=>i.message).join(" ")},400);return reply({error:"Launchpad request could not complete. Retry or check the connection."},503);}
export async function GET(request:Request){try{
  if(!process.env.DATABASE_URL)return reply({launches:[],available:false});
  const id=new URL(request.url).searchParams.get("id");
  if(id){z.string().uuid().parse(id);const launch=await get<LaunchRecord>("launchpad",id);if(!launch)throw new ServiceError("Launch not found.",404);const format=new URL(request.url).searchParams.get("format");if(format==="art")return new Response(genesisArt(launch.digest),{headers:{"Content-Type":"image/svg+xml","Content-Security-Policy":"default-src 'none'; sandbox","Cache-Control":"public, max-age=86400"}});if(format==="manifest")return reply(launch.manifest);return reply({launch,available:true});}
  const rows=await db()`select body from records where kind='launchpad' order by created_at desc limit 60`;
  return reply({launches:rows.map(r=>r.body),available:true});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
  const {owner}=await identity(request,true);await rate(`launchpad:${owner}`,12);
  if(Number(request.headers.get("content-length")??0)>65536)throw new ServiceError("Maximum request size is 64 KB.",413);
  const raw=await request.text();if(raw.length>65536)throw new ServiceError("Maximum request size is 64 KB.",413);
  let body;try{body=JSON.parse(raw);}catch{throw new ServiceError("Invalid JSON.");}
  if(body.action==="publish"){
    const project=draftSchema.parse(body.project);const errors=readiness(project);if(errors.length)throw new ServiceError(errors.join(" "));
    const id=body.id?z.string().uuid().parse(body.id):randomUUID();
    const existing=await get<LaunchRecord>("launchpad",id);
    if(existing){if(existing.owner!==owner||canonical(existing.manifest.project)!==canonical(project))throw new ServiceError("This project ID is already committed. Create a new draft for changes.",409);return reply({launch:existing});}
    const createdAt=new Date().toISOString();
    if(project.market){const client=createPublicClient({chain,transport:http(process.env.ROBINHOOD_RPC_URL??chain.rpcUrls.default.http[0])});await verifyCurveProtocol(client);const [config,economics,fee]=await Promise.all([client.readContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"getLaunchConfig",args:[BigInt(project.market.configId)]}),client.readContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"previewLaunchEconomics",args:[BigInt(project.market.configId),zeroAddress]}),client.readContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"launchFee"})]);if(!config.enabled||formatEther(config.supply)!==project.supply||economics!==project.market.economics||fee.toString()!==project.market.fee)throw new ServiceError("Launch terms changed. Refresh the preset before publishing.",409);}
    const manifest:Manifest={schema:"exaflop.genesis.v1",chainId:chain.id,creator:owner,createdAt,project,allocation:project.market?"100% to bonding curve; reserved allocation to locked liquidity":"100% to creator at deployment",provenance:"creator-submitted; not independently verified",renderer:"orbital-v1"};
    const record:LaunchRecord={id,owner,manifest,digest:`0x${hash(canonical(manifest))}`,createdAt};
    const inserted=await db()`insert into records(kind,id,owner,body) values('launchpad',${id},${owner},${db().json(record as any)}) on conflict(kind,id) do nothing returning body`;
    if(!inserted.length){const current=await get<LaunchRecord>("launchpad",id);if(current?.owner===owner&&canonical(current.manifest.project)===canonical(project))return reply({launch:current});throw new ServiceError("Project ID already committed.",409);}
    return reply({launch:record},201);
  }
  if(body.action==="register-sale"){
    const id=z.string().uuid().parse(body.id);
    const transaction=z.string().regex(/^0x[0-9a-fA-F]{64}$/).parse(body.transaction) as `0x${string}`;
    const terms=saleTermsSchema.parse(body.terms);
    const record=await get<LaunchRecord>("launchpad",id,owner);
    if(record?.manifest.project.market)throw new ServiceError("Curve launches use their own liquidity and fee escrow.");
    if(record&&record.manifest.chainId!==chain.id)throw new ServiceError("Launch network mismatch.");
    if(!record?.deployment)throw new ServiceError("Verify your token deployment first.",404);
    if(record.sale){if(record.sale.transaction.toLowerCase()!==transaction.toLowerCase())throw new ServiceError("Sale already registered.",409);return reply({launch:record});}
    const client=createPublicClient({chain,transport:http(process.env.ROBINHOOD_RPC_URL??chain.rpcUrls.default.http[0],{timeout:15000,retryCount:0})});
    const [tx,receipt,actualChain]=await Promise.all([client.getTransaction({hash:transaction}),client.getTransactionReceipt({hash:transaction}),client.getChainId()]);
    if(actualChain!==chain.id||receipt.status!=="success"||!receipt.contractAddress||tx.to!==null||tx.from.toLowerCase()!==owner||tx.value!==0n||tx.input.toLowerCase()!==saleDeploymentData(record,terms).toLowerCase())throw new ServiceError("Sale deployment does not match its creator, token or immutable terms.");
    if(await client.getBlockNumber()<receipt.blockNumber+2n)throw new ServiceError("Waiting for three block confirmations.",409);
    const sale={address:receipt.contractAddress,transaction,terms,verifiedAt:new Date().toISOString()};
    const rows=await db()`update records set body=jsonb_set(body,'{sale}',${db().json(sale)}) where kind='launchpad' and id=${id} and owner=${owner} and body->'sale' is null returning body`;
    return reply({launch:rows[0]?.body??await get<LaunchRecord>("launchpad",id,owner)});
  }
  if(body.action==="register"){
    const id=z.string().uuid().parse(body.id);const transaction=z.string().regex(/^0x[0-9a-fA-F]{64}$/).parse(body.transaction) as `0x${string}`;
    const record=await get<LaunchRecord>("launchpad",id,owner);if(!record)throw new ServiceError("Launch not found for this wallet.",404);
    if(record.manifest.chainId!==chain.id)throw new ServiceError("Launch network mismatch.");
    if(record.deployment){if(record.deployment.transaction.toLowerCase()!==transaction.toLowerCase())throw new ServiceError("This launch already has a verified deployment.",409);return reply({launch:record});}
    const client=createPublicClient({chain,transport:http(process.env.ROBINHOOD_RPC_URL??chain.rpcUrls.default.http[0],{timeout:15000,retryCount:0})});
    const [tx,receipt,actualChain]=await Promise.all([client.getTransaction({hash:transaction}),client.getTransactionReceipt({hash:transaction}),client.getChainId()]);
    let curveDeployment:{address:`0x${string}`;curve:`0x${string}`;factory:`0x${string}`}|undefined;
    if(record.manifest.project.market){
      await verifyCurveProtocol(client);
      if(actualChain!==chain.id)throw new ServiceError("Launch network mismatch.");
      try{curveDeployment=verifyCurveReceipt(record,tx,receipt);}catch(e){throw new ServiceError((e as Error).message);}

    }else if(actualChain!==chain.id||!deploymentMatches(record,tx,receipt))throw new ServiceError("Transaction does not match this wallet, token supply, contract code and genesis hash.");
    const block=await client.getBlockNumber();if(block<receipt.blockNumber+2n)throw new ServiceError("Waiting for three block confirmations. Retry verification shortly.",409);
    const deployment={address:receipt.contractAddress!,...curveDeployment,transaction,block:receipt.blockNumber.toString(),verifiedAt:new Date().toISOString()};
    const updated=await db()`update records set body=jsonb_set(body,'{deployment}',${db().json(deployment)}) where kind='launchpad' and id=${id} and owner=${owner} and body->'deployment' is null returning body`;
    return reply({launch:updated[0]?.body??await get<LaunchRecord>("launchpad",id,owner)});
  }
  throw new ServiceError("Unknown launchpad action.");
}catch(e){return failure(e);}}
