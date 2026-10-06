import {parseAbi,parseAbiParameters,encodeAbiParameters,keccak256,zeroAddress,type Address,type PublicClient} from "viem";
export const launchV4={
 router:"0x8876789976decbfcbbbe364623c63652db8c0904",routerHash:"0x2ce6aaaf9f4151f5e1cbf774668772f17f532ae11b15e9284fd0a072a8b0fbde",
 quoter:"0x8dc178efb8111bb0973dd9d722ebeff267c98f94",quoterHash:"0xd707b1da8cb165e5ea35a3b4450d971eb562ec171e23492aa117036b78a868f6",
 permit2:"0x000000000022D473030F116dDEE9F6B43aC78BA3",permit2Hash:"0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca",
 manager:"0x8366a39cc670b4001a1121b8f6a443a643e40951",hook:"0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
} as const;
export const v4RouterAbi=parseAbi(["function execute(bytes commands,bytes[] inputs,uint256 deadline) payable","function poolManager() view returns(address)"]);
export const v4QuoterAbi=parseAbi([
 "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
 "struct Quote { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
 "function quoteExactInputSingle(Quote params) returns(uint256 amountOut,uint256 gasEstimate)","function poolManager() view returns(address)",
]);
export const permit2Abi=parseAbi(["function approve(address token,address spender,uint160 amount,uint48 expiration)","function allowance(address owner,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)"]);
export const hookReadAbi=parseAbi(["function pendingFees(bytes32 poolId,address currency) view returns(uint256)","function pendingCreatorTax(bytes32 poolId,address currency) view returns(uint256)"]);
export function launchPool(token:Address,fee:number,tickSpacing:number){return {currency0:zeroAddress,currency1:token,fee,tickSpacing,hooks:launchV4.hook};}
export type LaunchPool=ReturnType<typeof launchPool>;
export function launchPoolId(pool:LaunchPool){return keccak256(encodeAbiParameters(parseAbiParameters("address,address,uint24,int24,address"),[pool.currency0,pool.currency1,pool.fee,pool.tickSpacing,pool.hooks]));}
export async function verifyLaunchV4(client:PublicClient){
 if(await client.getChainId()!==4663)throw new Error("Wrong pool trading network.");
 const checks=[[launchV4.router,launchV4.routerHash],[launchV4.quoter,launchV4.quoterHash],[launchV4.permit2,launchV4.permit2Hash]] as const;
 await Promise.all(checks.map(async([address,expected])=>{const code=await client.getCode({address});if(!code||keccak256(code)!==expected)throw new Error("Pool trading contract verification failed.");}));
 const managers=await Promise.all([client.readContract({address:launchV4.router,abi:v4RouterAbi,functionName:"poolManager"}),client.readContract({address:launchV4.quoter,abi:v4QuoterAbi,functionName:"poolManager"})]);
 if(managers.some(m=>m.toLowerCase()!==launchV4.manager))throw new Error("Pool manager mismatch.");
}
/** Verified router uses the newer minHopPriceX36 field. No fail-open commands. */
export function v4SwapArguments(pool:LaunchPool,buy:boolean,input:bigint,minimum:bigint,deadline:bigint){
 if(input<=0n||minimum<=0n||input>=2n**128n||minimum>=2n**128n)throw new Error("Swap amount outside supported bounds.");
 const swap=encodeAbiParameters(parseAbiParameters("((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)"),[{poolKey:pool,zeroForOne:buy,amountIn:input,amountOutMinimum:minimum,minHopPriceX36:0n,hookData:"0x"}]);
 const settle=encodeAbiParameters(parseAbiParameters("address,uint256"),[buy?pool.currency0:pool.currency1,input]);
 const take=encodeAbiParameters(parseAbiParameters("address,uint256"),[buy?pool.currency1:pool.currency0,minimum]);
 const actions=encodeAbiParameters(parseAbiParameters("bytes,bytes[]"),["0x060c0f",[swap,settle,take]]);
 // Return any unspent native input to the caller, using Universal Router MSG_SENDER.
 const refund=encodeAbiParameters(parseAbiParameters("address,address,uint256"),[zeroAddress,"0x0000000000000000000000000000000000000001",0n]);
 return ["0x1004",[actions,refund],deadline] as const;
}
