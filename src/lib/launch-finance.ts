import { encodeDeployData, parseAbi, parseEther, type Abi } from "viem";
import { z } from "zod";
import artifact from "@/generated/genesis-sale.json";
import type { LaunchRecord } from "./launchpad";

const eth = z.string().regex(/^(0|[1-9]\d{0,6})(\.\d{1,18})?$/).refine(v=>{try{return parseEther(v)>0n&&parseEther(v)<=parseEther("1000000");}catch{return false;}},"Use a positive ETH amount up to 1 million.");
export const saleTermsSchema=z.object({
  tokensPerEth:z.string().regex(/^[1-9]\d{0,12}$/).refine(v=>/^[0-9]+$/.test(v)&&BigInt(v)<=1_000_000_000_000n),
  softCap:eth,hardCap:eth,start:z.number().int().positive().max(1e11),end:z.number().int().positive().max(1e11),
}).refine(t=>{try{return parseEther(t.softCap)<=parseEther(t.hardCap)&&t.end>t.start;}catch{return false;}},"Check caps and sale dates.");
export type SaleTerms=z.infer<typeof saleTermsSchema>;
export type SaleRegistration={address:`0x${string}`;transaction:`0x${string}`;terms:SaleTerms;verifiedAt:string};
export const saleAbi=artifact.abi as Abi;
export function saleDeploymentData(record:LaunchRecord,terms:SaleTerms){
  if(!record.deployment)throw new Error("Deploy and verify the token first.");
  return encodeDeployData({abi:saleAbi,bytecode:artifact.bytecode as `0x${string}`,args:[record.deployment.address,BigInt(terms.tokensPerEth),parseEther(terms.softCap),parseEther(terms.hardCap),BigInt(terms.start),BigInt(terms.end)]});
}
export const tokenAbi=parseAbi([
  "function approve(address spender,uint256 value) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);
// Official Uniswap deployment registry, checked 2026-10-06. Never accept user-supplied routers.
// https://developers.uniswap.org/docs/protocols/v2/deployments
export const uniswap={chainId:4663,router:"0x89e5db8b5aa49aa85ac63f691524311aeb649eba",factory:"0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",weth:"0x0bd7d308f8e1639fab988df18a8011f41eacad73",routerCodeHash:"0xbd55ea26b2f8d42a8ff151511cef92a326a9817686899fe96a8a8f81ee7fc55e"} as const;
export const routerAbi=parseAbi([
  "function factory() view returns(address)","function WETH() view returns(address)",
  "function getAmountsOut(uint256 amountIn,address[] path) view returns(uint256[])",
  "function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns(uint256 amountToken,uint256 amountETH,uint256 liquidity)",
  "function removeLiquidityETH(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) returns(uint256 amountToken,uint256 amountETH)",
  "function swapExactETHForTokens(uint256 amountOutMin,address[] path,address to,uint256 deadline) payable returns(uint256[])",
  "function swapExactTokensForETH(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns(uint256[])",
]);
export const factoryAbi=parseAbi(["function getPair(address,address) view returns(address)"]);
export const pairAbi=parseAbi(["function token0() view returns(address)","function getReserves() view returns(uint112 reserve0,uint112 reserve1,uint32 timestamp)"]);
