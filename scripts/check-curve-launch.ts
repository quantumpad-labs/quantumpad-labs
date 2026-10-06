import {createPublicClient,http,parseEther,zeroAddress,encodeFunctionData,decodeFunctionResult,type Hex} from "viem";
import {curveFactoryAbi,curveProtocol,verifyCurveProtocol,launchArguments,curveAbi,feeEscrowAbi} from "../src/lib/curve-launch";
import {verifyLaunchV4,launchV4,launchPool,v4SwapArguments,v4RouterAbi,v4QuoterAbi,permit2Abi} from "../src/lib/launch-v4";
import {tokenAbi} from "../src/lib/launch-finance";
import {emptyDraft,type LaunchRecord} from "../src/lib/launchpad";
async function main(){
 const client=createPublicClient({transport:http("https://rpc.mainnet.chain.robinhood.com",{timeout:30000})});
 await Promise.all([verifyCurveProtocol(client),verifyLaunchV4(client)]);
 const [config,economics,fee]=await Promise.all([client.readContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"getLaunchConfig",args:[0n]}),client.readContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"previewLaunchEconomics",args:[0n,zeroAddress]}),client.readContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"launchFee"})]);
 const owner="0x1111111111111111111111111111111111111111";
 const record:LaunchRecord={id:"00000000-0000-4000-8000-000000000001",owner,digest:`0x${"42".repeat(32)}` as Hex,createdAt:"2026-10-06T00:00:00Z",manifest:{schema:"exaflop.genesis.v1",chainId:4663,creator:owner,createdAt:"2026-10-06T00:00:00Z",allocation:"100% to bonding curve; reserved allocation to locked liquidity",provenance:"creator-submitted; not independently verified",renderer:"orbital-v1",project:{...emptyDraft,name:"EXAFLOP call simulation",symbol:"SIM",description:"Read-only simulation; this token is never broadcast or deployed.",market:{kind:"curve",configId:0,economics,fee:fee.toString()}}}};
 const simulation=await client.simulateContract({address:curveProtocol.factory,abi:curveFactoryAbi,functionName:"launchToken",args:launchArguments(record,economics),value:fee,account:owner,stateOverride:[{address:owner,balance:parseEther("100")}]});

 const [token,curve]=simulation.result, pool=launchPool(token,config.poolFee,config.tickSpacing);
 const call=(to:Hex,abi:any,functionName:string,args:any[]=[],value=0n)=>({from:owner,to,data:encodeFunctionData({abi,functionName,args}),value:'0x'+value.toString(16),gas:'0x1c9c380'});
 const calls=[
  call(curveProtocol.factory,curveFactoryAbi,'launchToken',[...launchArguments(record,economics)],fee),
  call(curve,curveAbi,'buy',[parseEther('0.1'),1n,owner],parseEther('0.1')),
  call(token,tokenAbi,'approve',[curve,parseEther('1')]),
  call(curve,curveAbi,'sell',[parseEther('1'),1n,owner]),
  call(curve,curveAbi,'buy',[parseEther('10'),1n,owner],parseEther('10')),
  call(curveProtocol.factory,curveFactoryAbi,'createGraduatedPool',[token]),
  call(curveProtocol.factory,curveFactoryAbi,'getLaunchedToken',[token]),
  call(launchV4.quoter,v4QuoterAbi,'quoteExactInputSingle',[{poolKey:pool,zeroForOne:true,exactAmount:parseEther('0.01'),hookData:'0x'}]),
  call(launchV4.router,v4RouterAbi,'execute',[...v4SwapArguments(pool,true,parseEther('0.01'),1n,9999999999n)],parseEther('0.01')),
  call(token,tokenAbi,'approve',[launchV4.permit2,parseEther('1')]),
  call(launchV4.permit2,permit2Abi,'approve',[token,launchV4.router,parseEther('1'),9999999999]),
  call(launchV4.router,v4RouterAbi,'execute',[...v4SwapArguments(pool,false,parseEther('1'),1n,9999999999n)]),
 ];
 calls.splice(4,0,call(curve,curveAbi,"sweepFees",[0n]),call(curveProtocol.escrow,feeEscrowAbi,"claim"));
 const bundle:any=await client.request({method:'eth_simulateV1',params:[{blockStateCalls:[{stateOverrides:{[owner]:{balance:'0x56bc75e2d63100000'}},calls}],validation:false,traceTransfers:false},'latest']} as any);
 const results=bundle[0].calls;
 for(let i=0;i<results.length;i++)if(results[i].status!=='0x1')throw new Error('Simulation step '+i+' failed: '+JSON.stringify(results[i].error));
 const graduated=decodeFunctionResult({abi:curveFactoryAbi,functionName:'getLaunchedToken',data:results[8].returnData});
 if(graduated.phase!==2)throw new Error('Graduation did not reach locked liquidity.');
 const poolQuote=decodeFunctionResult({abi:v4QuoterAbi,functionName:'quoteExactInputSingle',data:results[9].returnData});
 console.log(JSON.stringify({verified:true,chainId:4663,launchFee:fee.toString(),supply:config.supply.toString(),steps:['launch','curve buy','exact approval','curve sell','distribute fees','claim fees','graduation buy','complete graduation','verify locked pool','v4 quote','v4 buy','Permit2 token approval','bounded router approval','v4 sell'],passed:results.length,poolQuote:poolQuote[0].toString(),note:'Read-only eth_call / eth_simulateV1 with temporary balance overrides. No signature or broadcast.'},null,2));
}
main().catch(e=>{console.error(e.shortMessage??e.message);process.exitCode=1;});
