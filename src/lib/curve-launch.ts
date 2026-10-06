import {parseAbi,zeroAddress,keccak256,encodeFunctionData,parseEventLogs,type PublicClient,type Hex,type Transaction,type TransactionReceipt} from "viem";
import type {LaunchRecord} from "./launchpad";

// pons v2, verified Robinhood Chain deployment. See docs/integrated-launch.md.
export const curveProtocol={chainId:4663,factory:"0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",codeHash:"0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84",escrow:"0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e"} as const;
export const curveFactoryAbi=parseAbi([
 "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
 "struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }",
 "struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }",
 "struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }",
 "function launchToken(TokenParams params,uint256 launchConfigId,address pairToken) payable returns(address token,address curve)",
 "function launchConfigCount() view returns(uint256)","function getLaunchConfig(uint256 id) view returns(LaunchConfig)",
 "function previewLaunchEconomics(uint256 launchConfigId,address pairToken) view returns(bytes32)",
 "function launchFee() view returns(uint256)","function canLaunch(address launcher) view returns(bool)",
 "function getLaunchedToken(address token) view returns(LaunchedToken)",
 "function graduate(address token)","function createGraduatedPool(address token)",
 "event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)",
]);
export const curveAbi=parseAbi([
 "function buy(uint256 quoteIn,uint256 minTokensOut,address recipient) payable returns(uint256)",
 "function sell(uint256 tokensIn,uint256 minQuoteOut,address recipient) returns(uint256)",
 "function getReserves() view returns(uint256 quoteReserve,uint256 tokenReserve)",
 "function sellableTokens() view returns(uint256)","function feeBps() view returns(uint256)","function creatorTaxBps() view returns(uint256)",
 "function currentSnipeTaxBps(address recipient) view returns(uint256)","function realQuoteReserve() view returns(uint256)",
 "function readyToGraduate() view returns(bool)","function quoteFeeBalance() view returns(uint256)","function creatorTaxBalance() view returns(uint256)",
 "function sweepFees(uint256 minBuybackTokensOut)",
]);
export const feeEscrowAbi=parseAbi(["function balanceOf(address) view returns(uint256)","function claim()"]);
export async function verifyCurveProtocol(client:PublicClient){
 const [id,code]=await Promise.all([client.getChainId(),client.getCode({address:curveProtocol.factory})]);
 if(id!==curveProtocol.chainId||!code||keccak256(code)!==curveProtocol.codeHash)throw new Error("Launch contract verification failed. Transactions are disabled.");
}
export function launchMetadata(record:LaunchRecord){
 const base="https://exaflop.vercel.app";
 return {name:record.manifest.project.name,symbol:record.manifest.project.symbol,
 logo:`${base}/api/launchpad?id=${record.id}&format=art`,
 description:`${record.manifest.project.description}\nEXAFLOP genesis SHA-256: ${record.digest}`,
 socials:{twitter:"",telegram:"",discord:"",website:`${base}/launchpad/${record.id}`,farcaster:""}};
}
export function launchArguments(record:LaunchRecord,economics:Hex){
 const route=record.manifest.project.market;
 if(!route||route.kind!=="curve")throw new Error("This record uses a different launch route.");
 return [{...launchMetadata(record),creatorFeeRecipient:record.owner as Hex,creatorTaxBps:0,buybackEnabled:false,expectedEconomics:economics,salt:record.digest},BigInt(route.configId),zeroAddress] as const;
}
export function verifyCurveReceipt(record:LaunchRecord,tx:Pick<Transaction,"from"|"to"|"input"|"value">,receipt:Pick<TransactionReceipt,"status"|"logs">){
 const market=record.manifest.project.market;
 if(!market||record.manifest.chainId!==curveProtocol.chainId||receipt.status!=="success"||tx.to?.toLowerCase()!==curveProtocol.factory.toLowerCase()||tx.from.toLowerCase()!==record.owner.toLowerCase()||tx.value!==BigInt(market.fee))throw new Error("Launch transaction creator, factory or fee mismatch.");
 if(tx.input.toLowerCase()!==encodeFunctionData({abi:curveFactoryAbi,functionName:"launchToken",args:launchArguments(record,market.economics as Hex)}).toLowerCase())throw new Error("Launch metadata or immutable economics do not match the genesis record.");
 const events=parseEventLogs({abi:curveFactoryAbi,eventName:"TokenLaunched",logs:receipt.logs.filter(l=>l.address.toLowerCase()===curveProtocol.factory.toLowerCase()),strict:true});
 const event=events.find(e=>e.args.deployer.toLowerCase()===record.owner.toLowerCase()&&e.args.launchConfigId===BigInt(market.configId)&&e.args.pairToken===zeroAddress);
 if(!event)throw new Error("Factory launch event missing.");
 return {address:event.args.token,curve:event.args.curve,factory:curveProtocol.factory};
}
export type CurveReserves={quote:bigint;tokens:bigint;sellable:bigint;fee:bigint;tax:bigint;snipe:bigint};
export function quoteCurve(input:bigint,buy:boolean,r:CurveReserves){
 if(input<=0n||r.quote<=0n||r.tokens<=0n)throw new Error("No executable amount or reserves.");
 if(buy){
  if(r.sellable<=0n)throw new Error("Curve complete; graduation is required.");
  const snipe=r.snipe>10000n-r.fee-r.tax-100n?10000n-r.fee-r.tax-100n:r.snipe;
  const net=input-input*r.fee/10000n-input*r.tax/10000n-input*snipe/10000n;
  let out=net*r.tokens/(r.quote+net),spent=input;
  if(out>r.sellable){out=r.sellable;const netRequired=out*r.quote/(r.tokens-out)+1n;const denominator=10000n-r.fee-r.tax-snipe;spent=(netRequired*10000n+denominator-1n)/denominator;if(spent>input)spent=input;}
  if(out<=0n)throw new Error("Amount is too small.");
  // minTokensOut is rate-normalized against requested input on partial fills.
  return {out,spent,refund:input-spent,rateOutput:out*input/spent};
 }
 const gross=input*r.quote/(r.tokens+input),out=gross-gross*r.fee/10000n-gross*r.tax/10000n;
 if(out<=0n)throw new Error("Amount is too small.");return {out,spent:input,refund:0n,rateOutput:out};
}
