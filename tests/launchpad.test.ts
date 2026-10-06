import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import ganache from "ganache";
import {createPublicClient,createWalletClient,custom,parseUnits,type EIP1193Provider} from "viem";
import {canonical,draftSchema,storedDraftSchema,readiness,emptyDraft,type LaunchRecord} from "../src/lib/launchpad";
import {genesisArt} from "../src/lib/genesis-art";
import {deploymentData,deploymentMatches,genesisAbi} from "../src/lib/genesis-contract";
import {presets} from "../src/lib/quantum";
test("hardware launch paths can publish without quantum attachments",()=>{
  for(const mode of ["hardware","cross-machine","silicon"] as const){
    const draft=draftSchema.parse({...emptyDraft,mode,name:"Quantum project",symbol:"QPR",description:"A quantum computing project with evidence not yet attached."});
    assert.deepEqual(readiness(draft),[]);
  }
  assert.equal(draftSchema.safeParse({...emptyDraft,name:"Quantum project",symbol:"QPR",description:"A quantum computing project with optional attachments.",evidence:[{provider:"ibm"}]}).success,false);
});
test("manifest serialization is stable across key order and sensitive to changed terms",()=>{assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));assert.notEqual(canonical({supply:"1"}),canonical({supply:"2"}));assert.equal(genesisArt("a".repeat(64)),genesisArt("a".repeat(64)));assert.notEqual(genesisArt("a".repeat(64)),genesisArt("b".repeat(64)));assert.throws(()=>genesisArt('<script>'));});
test("draft storage supports incomplete work; publishing validates supply and URLs",()=>{assert.ok(storedDraftSchema.safeParse(emptyDraft).success);assert.equal(draftSchema.safeParse(emptyDraft).success,false);const d={...emptyDraft,name:"Quantum tool",symbol:"QTL",description:"A reproducible quantum software experiment for researchers.",mode:"software",repository:"https://example.com/source",demo:"https://example.com/demo",version:"v1"};assert.ok(draftSchema.safeParse(d).success);assert.equal(draftSchema.safeParse({...d,supply:"1000000000001"}).success,false);assert.equal(draftSchema.safeParse({...d,demo:"javascript:alert(1)"}).success,false);assert.equal(draftSchema.safeParse({...d,repository:"https://key:secret@example.com"}).success,false);});
test("hardware path distinguishes claims and requires circuit-equivalent comparisons",()=>{const e={schema:"exaflop.quantum.result.v1" as const,provider:"ibm",backend:"device-a",jobId:"sample",status:"COMPLETED",observedAt:"2026-10-06",qubits:2,circuit:presets.bell,counts:{"00":512,"11":512}};const d={...emptyDraft,mode:"cross-machine" as const,evidence:[e,{...e,backend:"device-b"}]};assert.deepEqual(readiness(d),[]);assert.ok(readiness({...d,evidence:[e,e]}).length);assert.ok(readiness({...d,evidence:[e,{...e,backend:"device-b",circuit:{qubits:2,gates:[]}}]}).length);});
test("token deploys on a local EVM with fixed supply and immutable manifest hash",async()=>{
  const provider=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:2},chain:{chainId:1337}});
  try{
    const transport=custom(provider as unknown as EIP1193Provider),client=createPublicClient({transport}),wallet=createWalletClient({transport});
    const [creator,recipient]=await wallet.getAddresses();
    const manifest={schema:"exaflop.genesis.v1" as const,chainId:1337,creator:creator.toLowerCase(),createdAt:"2026-10-06T00:00:00.000Z",project:{...emptyDraft,name:"Test Genesis",symbol:"TGEN"},allocation:"100% to creator at deployment" as const,provenance:"creator-submitted; not independently verified" as const,renderer:"orbital-v1" as const};
    const record:LaunchRecord={id:"local-test",owner:creator.toLowerCase(),manifest,digest:`0x${createHash('sha256').update(canonical(manifest)).digest('hex')}`,createdAt:manifest.createdAt};
    const hash=await wallet.sendTransaction({account:creator,chain:null,gas:await client.estimateGas({account:creator,data:deploymentData(record)}),data:deploymentData(record)});const receipt=await client.waitForTransactionReceipt({hash});const tx=await client.getTransaction({hash});assert.ok(deploymentMatches(record,tx,receipt));assert.equal(deploymentMatches({...record,digest:`0x${'0'.repeat(64)}`},tx,receipt),false);assert.equal(deploymentMatches(record,{...tx,from:recipient},receipt),false);
    const address=receipt.contractAddress!;
    assert.equal(await client.readContract({address,abi:genesisAbi,functionName:"name"}),"Test Genesis");assert.equal(await client.readContract({address,abi:genesisAbi,functionName:"genesisHash"}),record.digest);
    assert.equal(await client.readContract({address,abi:genesisAbi,functionName:"totalSupply"}),parseUnits(emptyDraft.supply,18));
    const transfer=await wallet.writeContract({account:creator,chain:null,address,abi:genesisAbi,functionName:"transfer",args:[recipient,1n]});await client.waitForTransactionReceipt({hash:transfer});assert.equal(await client.readContract({address,abi:genesisAbi,functionName:"balanceOf",args:[recipient]}),1n);
    assert.equal(genesisAbi.some(i=>i.type==='function'&&['mint','pause','upgradeTo','owner'].includes(i.name)),false);
  }finally{await provider.disconnect();}
});

