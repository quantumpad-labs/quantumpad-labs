import { encodeDeployData, parseUnits, type Abi } from "viem";
import artifact from "@/generated/genesis-token.json";
import type { LaunchRecord } from "./launchpad";
export const genesisAbi=artifact.abi as Abi;
export const genesisBytecode=artifact.bytecode as `0x${string}`;
export function deploymentData(record:LaunchRecord) {
  return encodeDeployData({abi:genesisAbi,bytecode:genesisBytecode,args:[record.manifest.project.name,record.manifest.project.symbol,parseUnits(record.manifest.project.supply,18),record.digest]});
}
export function deploymentMatches(record:LaunchRecord,transaction:{from:string;to:string|null;input:string;value:bigint},receipt:{status:string;contractAddress?:string|null}) {
  return receipt.status==="success"&&!!receipt.contractAddress&&transaction.to===null&&transaction.from.toLowerCase()===record.owner.toLowerCase()&&transaction.value===0n&&transaction.input.toLowerCase()===deploymentData(record).toLowerCase();
}

