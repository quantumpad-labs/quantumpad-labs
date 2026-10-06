import {createPublicClient,http,keccak256} from "viem";
import {chain} from "../src/lib/chain";
import {uniswap,routerAbi} from "../src/lib/launch-finance";
async function main(){
  const client=createPublicClient({chain,transport:http(undefined,{timeout:15000,retryCount:0})});
  const [id,code,factory,weth]=await Promise.all([client.getChainId(),client.getCode({address:uniswap.router}),client.readContract({address:uniswap.router,abi:routerAbi,functionName:"factory"}),client.readContract({address:uniswap.router,abi:routerAbi,functionName:"WETH"})]);
  if(id!==uniswap.chainId||!code||code==="0x"||factory.toLowerCase()!==uniswap.factory)throw new Error("Router or chain mismatch");
  const [factoryCode,wethCode]=await Promise.all([client.getCode({address:factory}),client.getCode({address:weth})]);
  if(!factoryCode||factoryCode==="0x"||!wethCode||wethCode==="0x")throw new Error("Missing factory/WETH code");
  console.log(JSON.stringify({chainId:id,router:uniswap.router,factory,weth,routerCodeHash:keccak256(code)},null,2));
}
main().catch(e=>{console.error(e.shortMessage??e.message);process.exitCode=1;});
