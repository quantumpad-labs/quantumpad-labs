import test from "node:test";
import assert from "node:assert/strict";
import {encodeEventTopics,encodeAbiParameters,decodeAbiParameters,parseAbiParameters,encodeFunctionData,decodeFunctionData,zeroAddress} from "viem";
import {verifyCurveReceipt,curveProtocol,quoteCurve,curveFactoryAbi,launchArguments,launchMetadata,verifyCurveProtocol} from "../src/lib/curve-launch";
import {v4SwapArguments,launchPool} from "../src/lib/launch-v4";
import {emptyDraft,draftSchema,type LaunchRecord} from "../src/lib/launchpad";
const reserves={quote:10000n,tokens:1000000n,sellable:900000n,fee:100n,tax:0n,snipe:0n};
test("curve quotes apply integer fees on the correct side",()=>{
 assert.deepEqual(quoteCurve(100n,true,reserves),{out:9802n,spent:100n,refund:0n,rateOutput:9802n});
 assert.equal(quoteCurve(10000n,false,reserves).out,99n);
 assert.equal(quoteCurve(100n,true,{...reserves,snipe:9900n}).out,99n);
 assert.throws(()=>quoteCurve(0n,true,reserves));
 assert.throws(()=>quoteCurve(100n,true,{...reserves,sellable:0n}));
});
test("graduation partial fills refund unused ETH and preserve quoted rate",()=>{
 assert.deepEqual(quoteCurve(100n,true,{...reserves,sellable:1000n}),{out:1000n,spent:12n,refund:88n,rateOutput:8333n});
});
const project={...emptyDraft,name:"Quantum Test",symbol:"QTEST",description:"A reproducible software release with genesis evidence.",mode:"software" as const,repository:"https://example.com/repo",demo:"https://example.com/demo",version:"v1"};
test("legacy drafts remain unchanged; integrated settings are validated",()=>{
 assert.equal(draftSchema.parse(project).market,undefined);
 assert.equal(draftSchema.safeParse({...project,market:{kind:"curve",configId:-1,economics:"0x",fee:"-1"}}).success,false);
});
test("factory calldata commits exact case-sensitive metadata and genesis digest",()=>{
 const digest=`0x${"42".repeat(32)}` as const;
 const record:LaunchRecord={id:"00000000-0000-4000-8000-000000000001",owner:"0x1111111111111111111111111111111111111111",digest,createdAt:"2026-10-06",manifest:{schema:"exaflop.genesis.v1",chainId:4663,creator:"0x1111111111111111111111111111111111111111",createdAt:"2026-10-06",project:{...project,market:{kind:"curve",configId:0,economics:digest,fee:"500000000000000"}},allocation:"100% to bonding curve; reserved allocation to locked liquidity",provenance:"creator-submitted; not independently verified",renderer:"orbital-v1"}};
 const encoded=encodeFunctionData({abi:curveFactoryAbi,functionName:"launchToken",args:launchArguments(record,digest)});
 const decoded=decodeFunctionData({abi:curveFactoryAbi,data:encoded});assert.equal(decoded.functionName,"launchToken");
 if(decoded.functionName!=="launchToken")throw Error("Wrong method");
 assert.equal(decoded.args[0].name,"Quantum Test");assert.equal(decoded.args[0].salt,digest);assert.equal(decoded.args[0].creatorTaxBps,0);assert.equal(decoded.args[0].buybackEnabled,false);assert.equal(decoded.args[2],zeroAddress);
 assert.ok(launchMetadata(record).description.includes(digest));
 const token="0x2222222222222222222222222222222222222222",curve="0x3333333333333333333333333333333333333333";
 const log={address:curveProtocol.factory,topics:encodeEventTopics({abi:curveFactoryAbi,eventName:"TokenLaunched",args:{token,curve,deployer:record.owner as any}}),data:encodeAbiParameters(parseAbiParameters("address,uint256,uint256"),[zeroAddress,0n,42n])};
 const tx={from:record.owner as any,to:curveProtocol.factory,input:encoded,value:500000000000000n};const receipt={status:"success" as const,logs:[log] as any};
 assert.equal(verifyCurveReceipt(record,tx,receipt).curve,curve);
 assert.throws(()=>verifyCurveReceipt(record,{...tx,value:0n},receipt),/fee mismatch/);
 assert.throws(()=>verifyCurveReceipt(record,{...tx,from:token},receipt),/creator/);
 assert.throws(()=>verifyCurveReceipt(record,tx,{...receipt,status:"reverted"}),/mismatch/);
 assert.throws(()=>verifyCurveReceipt(record,tx,{...receipt,logs:[{...log,address:token}] as any}),/event missing/);
 assert.throws(()=>verifyCurveReceipt(record,{...tx,input:encoded.slice(0,-2)+"ff" as any},receipt),/metadata/);

 assert.notEqual(encoded,encodeFunctionData({abi:curveFactoryAbi,functionName:"launchToken",args:launchArguments({...record,manifest:{...record.manifest,project:{...record.manifest.project,name:"QUANTUM TEST"}}},digest)}));
});
test("v4 actions use bounded settlement, minimum output and explicit native refund",()=>{
 const pool=launchPool("0x1111111111111111111111111111111111111111",0,200);
 const [commands,inputs,deadline]=v4SwapArguments(pool,true,1000n,900n,1234n);
 assert.equal(commands,"0x1004");assert.equal(deadline,1234n);
 const [actions,params]=decodeAbiParameters(parseAbiParameters("bytes,bytes[]"),inputs[0]);assert.equal(actions,"0x060c0f");
 assert.deepEqual(decodeAbiParameters(parseAbiParameters("address,uint256"),params[1]),[zeroAddress,1000n]);
 assert.deepEqual(decodeAbiParameters(parseAbiParameters("address,uint256"),params[2]),[pool.currency1,900n]);
 assert.deepEqual(decodeAbiParameters(parseAbiParameters("address,address,uint256"),inputs[1]),[zeroAddress,"0x0000000000000000000000000000000000000001",0n]);
 assert.throws(()=>v4SwapArguments(pool,true,100n,0n,1234n));
 assert.throws(()=>v4SwapArguments(pool,true,2n**128n,1n,1234n));
});
test("changed factory code or wrong network blocks launch actions",async()=>{
 await assert.rejects(()=>verifyCurveProtocol({getChainId:async()=>1,getCode:async()=>"0x1234"} as any),/verification failed/);
 await assert.rejects(()=>verifyCurveProtocol({getChainId:async()=>4663,getCode:async()=>"0x1234"} as any),/verification failed/);
});
