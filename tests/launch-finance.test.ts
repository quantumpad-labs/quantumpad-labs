import {test} from "node:test";
import assert from "node:assert/strict";
import ganache from "ganache";
import {createPublicClient,createWalletClient,custom,encodeDeployData,parseEther,type Abi,type Address,type EIP1193Provider} from "viem";
import tokenArtifact from "../src/generated/genesis-token.json";
import saleArtifact from "../src/generated/genesis-sale.json";
import factoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import wethArtifact from "@uniswap/v2-periphery/build/WETH9.json";
import {saleAbi,saleTermsSchema,tokenAbi,routerAbi,factoryAbi} from "../src/lib/launch-finance";

async function setup(){
  const provider=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:3},chain:{chainId:1337}});
  const transport=custom(provider as unknown as EIP1193Provider),client=createPublicClient({transport,cacheTime:0}),wallet=createWalletClient({transport});
  const [creator,buyer,other]=await wallet.getAddresses();
  async function deploy(artifact:{abi:unknown;bytecode:string},args:unknown[]){const data=encodeDeployData({abi:artifact.abi as Abi,bytecode:(artifact.bytecode.startsWith("0x")?artifact.bytecode:`0x${artifact.bytecode}`) as `0x${string}`,args});const hash=await wallet.sendTransaction({account:creator,chain:null,data,gas:await client.estimateGas({account:creator,data})});return (await client.waitForTransactionReceipt({hash})).contractAddress!;}
  async function send(account:Address,address:Address,abi:Abi,functionName:string,args:unknown[]=[],value=0n){const {request}=await client.simulateContract({account,address,abi,functionName,args,value});const gas=await client.estimateContractGas({account,address,abi,functionName,args,value});const hash=await wallet.writeContract({...request,chain:null,gas:gas*120n/100n+80000n} as any);const r=await client.waitForTransactionReceipt({hash});assert.equal(r.status,"success");return r;}
  const read=(address:Address,abi:Abi,functionName:string,args:unknown[]=[])=>client.readContract({address,abi,functionName,args});
  const token=await deploy(tokenArtifact,["Lifecycle test","TEST",parseEther("1000000"),"0x"+"1".repeat(64)]);
  const move=async(seconds:number)=>{await provider.request({method:"evm_increaseTime",params:[seconds]});await provider.request({method:"evm_mine",params:[]});};
  return {provider,client,creator,buyer,other,deploy,send,read,token,move};
}
test("sale terms reject malformed inputs without throwing",()=>{for(const value of ["abc","-1","1e3","", "0"]){assert.equal(saleTermsSchema.safeParse({tokensPerEth:value,softCap:"1",hardCap:"2",start:100,end:200}).success,false);assert.equal(saleTermsSchema.safeParse({tokensPerEth:"100",softCap:value,hardCap:"2",start:100,end:200}).success,false);}});
test("successful sale escrows ETH, reserves claims and prevents duplicate withdrawals",async()=>{
  const s=await setup();try{
    const now=Number((await s.client.getBlock()).timestamp);
    const sale=await s.deploy(saleArtifact,[s.token,1000n,parseEther("1"),parseEther("2"),BigInt(now+100),BigInt(now+1000)]);
    await assert.rejects(s.send(s.buyer,sale,saleAbi,"buy",[],parseEther("1")));
    await s.send(s.creator,s.token,tokenAbi,"approve",[sale,parseEther("2000")]);await s.send(s.creator,sale,saleAbi,"fund");
    await assert.rejects(s.send(s.creator,sale,saleAbi,"withdrawProceeds"));
    await s.move(101);await s.send(s.buyer,sale,saleAbi,"buy",[],parseEther("1"));
    assert.equal(await s.client.getBalance({address:sale}),parseEther("1"));
    await assert.rejects(s.send(s.buyer,sale,saleAbi,"buy",[],parseEther("2")));
    await assert.rejects(s.send(s.creator,sale,saleAbi,"cancelBeforeStart"));
    await assert.rejects(s.send(s.buyer,sale,saleAbi,"refund"));
    await s.move(1000);await s.send(s.other,sale,saleAbi,"finalize");assert.equal(await s.read(sale,saleAbi,"successful"),true);
    await assert.rejects(s.send(s.other,sale,saleAbi,"withdrawProceeds"));
    await s.send(s.creator,sale,saleAbi,"recoverUnsoldTokens");assert.equal(await s.read(s.token,tokenAbi,"balanceOf",[sale]),parseEther("1000"));
    await s.send(s.creator,sale,saleAbi,"withdrawProceeds");assert.equal(await s.client.getBalance({address:sale}),0n);
    await assert.rejects(s.send(s.creator,sale,saleAbi,"withdrawProceeds"));
    await s.send(s.buyer,sale,saleAbi,"claimTokens");assert.equal(await s.read(s.token,tokenAbi,"balanceOf",[s.buyer]),parseEther("1000"));
    await assert.rejects(s.send(s.buyer,sale,saleAbi,"claimTokens"));
  }finally{await s.provider.disconnect();}
});
test("failed sale refunds buyers and cancelled sale cannot reopen",async()=>{
  const s=await setup();try{
    const now=Number((await s.client.getBlock()).timestamp);
    const sale=await s.deploy(saleArtifact,[s.token,1000n,parseEther("2"),parseEther("3"),BigInt(now+100),BigInt(now+1000)]);
    await s.send(s.creator,s.token,tokenAbi,"approve",[sale,parseEther("3000")]);await s.send(s.creator,sale,saleAbi,"fund");await s.move(101);
    await s.send(s.buyer,sale,saleAbi,"buy",[],parseEther("1"));await s.move(1000);await s.send(s.other,sale,saleAbi,"finalize");
    assert.equal(await s.read(sale,saleAbi,"successful"),false);await assert.rejects(s.send(s.creator,sale,saleAbi,"withdrawProceeds"));await assert.rejects(s.send(s.buyer,sale,saleAbi,"claimTokens"));
    await s.send(s.creator,sale,saleAbi,"recoverUnsoldTokens");await s.send(s.buyer,sale,saleAbi,"refund");assert.equal(await s.client.getBalance({address:sale}),0n);await assert.rejects(s.send(s.buyer,sale,saleAbi,"refund"));
    const later=Number((await s.client.getBlock()).timestamp);const cancelled=await s.deploy(saleArtifact,[s.token,10n,parseEther("1"),parseEther("2"),BigInt(later+100),BigInt(later+1000)]);
    await assert.rejects(s.send(s.other,cancelled,saleAbi,"cancelBeforeStart"));await s.send(s.creator,cancelled,saleAbi,"cancelBeforeStart");await assert.rejects(s.send(s.creator,cancelled,saleAbi,"fund"));
  }finally{await s.provider.disconnect();}
});
test("official Uniswap v2 contracts support local pool creation, buy, sell and LP withdrawal",async()=>{
  const s=await setup();try{
    const factory=await s.deploy(factoryArtifact,[s.creator]),weth=await s.deploy(wethArtifact,[]),router=await s.deploy(routerArtifact,[factory,weth]);
    const deadline=(await s.client.getBlock()).timestamp+3600n;
    await s.send(s.creator,s.token,tokenAbi,"approve",[router,parseEther("10000")]);
    await s.send(s.creator,router,routerAbi,"addLiquidityETH",[s.token,parseEther("10000"),parseEther("9900"),parseEther("9.9"),s.creator,deadline],parseEther("10"));
    const pair=await s.read(factory,factoryAbi,"getPair",[s.token,weth]) as Address;
    const out=await s.read(router,routerAbi,"getAmountsOut",[parseEther("1"),[weth,s.token]]) as bigint[];
    await assert.rejects(s.send(s.buyer,router,routerAbi,"swapExactETHForTokens",[out[1]*2n,[weth,s.token],s.buyer,deadline],parseEther("1")));
    await s.send(s.buyer,router,routerAbi,"swapExactETHForTokens",[out[1]*99n/100n,[weth,s.token],s.buyer,deadline],parseEther("1"));
    const bought=await s.read(s.token,tokenAbi,"balanceOf",[s.buyer]) as bigint;assert.ok(bought>0n);
    await s.send(s.buyer,s.token,tokenAbi,"approve",[router,bought]);
    const sellOut=await s.read(router,routerAbi,"getAmountsOut",[bought,[s.token,weth]]) as bigint[];
    await s.send(s.buyer,router,routerAbi,"swapExactTokensForETH",[bought,sellOut[1]*99n/100n,[s.token,weth],s.buyer,deadline]);assert.equal(await s.read(s.token,tokenAbi,"balanceOf",[s.buyer]),0n);
    const shares=await s.read(pair,tokenAbi,"balanceOf",[s.creator]) as bigint;await s.send(s.creator,pair,tokenAbi,"approve",[router,shares]);
    await s.send(s.creator,router,routerAbi,"removeLiquidityETH",[s.token,shares,1n,1n,s.creator,deadline]);assert.equal(await s.read(pair,tokenAbi,"balanceOf",[s.creator]),0n);
  }finally{await s.provider.disconnect();}
});
