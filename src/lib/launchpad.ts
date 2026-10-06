import { z } from "zod";
import type { SaleRegistration } from "./launch-finance";
import { parseResult, type QuantumResult } from "./quantum";

export const launchModes = [
  {id:"hardware",name:"Hardware Genesis",tag:"QPU EXPERIMENT",description:"Attach a hardware-run record and derive a reproducible visual identity from its evidence."},
  {id:"cross-machine",name:"Cross-Machine Genesis",tag:"TWO BACKENDS",description:"Publish the same circuit on two different backends, with both measurement records."},
  {id:"silicon",name:"Simulator vs Silicon",tag:"SIMULATION + QPU",description:"Pair a classical simulation with a hardware run and compare their results."},
  {id:"software",name:"Software Launch",tag:"BUILDERS",description:"Launch with a pinned software release, source repository, and a usable demo."},
  {id:"benchmark",name:"Benchmark Launch",tag:"REPRODUCIBLE WORK",description:"Publish a workload, execution stack, methodology and reproducible evidence."},
  {id:"hybrid",name:"Hybrid Engine",tag:"CLASSICAL + QUANTUM",description:"Connect a versioned hybrid application with classical compute and a quantum backend."},
  {id:"compute-funded",name:"Compute Roadmap",tag:"BUDGET DISCLOSURE",description:"Publish a compute budget and milestones alongside your launch. Spending and delivery remain unenforced."},
] as const;
export const softwareStacks=["Qiskit / Aer","PennyLane / Lightning","PennyLane / Catalyst","NVIDIA cuQuantum","Custom container"] as const;
export const hardwareStacks=["IBM Quantum · superconducting","Amazon Braket · gate-based QPU","Amazon Braket · neutral-atom (custom workflow)","NVIDIA GPU · classical simulation","CPU · classical simulation","Hybrid CPU/GPU + QPU"] as const;
const https=z.string().max(2000).refine(v=>{if(!v)return true;try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}},"Use an HTTPS URL without credentials.");
export const draftSchema=z.object({
  market:z.object({kind:z.literal("curve"),configId:z.number().int().min(0).max(10000),economics:z.string().regex(/^0x[0-9a-fA-F]{64}$/),fee:z.string().regex(/^[0-9]{1,30}$/)}).optional(),
  name:z.string().trim().min(2).max(64).regex(/^[\x20-\x7E]+$/,"Use printable ASCII for the token name."),
  symbol:z.string().trim().regex(/^[A-Z][A-Z0-9]{1,11}$/,"Symbol must be 2–12 uppercase letters/numbers."),
  supply:z.string().regex(/^[1-9][0-9]{0,12}$/).refine(v=>/^[0-9]+$/.test(v)&&BigInt(v)<=1_000_000_000_000n,"Maximum supply is 1 trillion whole tokens."),
  description:z.string().trim().min(30).max(2000),
  mode:z.enum(["hardware","cross-machine","silicon","software","benchmark","hybrid","compute-funded"]),
  hardware:z.enum(hardwareStacks),software:z.enum(softwareStacks),
  backend:z.string().trim().max(200),repository:https,demo:https,
  version:z.string().trim().max(160),methodology:z.string().trim().max(3000),
  computeBudget:z.number().finite().min(0).max(1_000_000),milestones:z.string().trim().max(2000),
  evidence:z.array(z.unknown()).max(2).transform((items,ctx)=>{try{return items.map(item=>cleanEvidence(parseResult(item)));}catch(e){ctx.addIssue({code:"custom",message:(e as Error).message});return z.NEVER;}}),
});
export type LaunchDraft=z.infer<typeof draftSchema>;
export const storedDraftSchema=draftSchema.extend({name:z.string().max(64),symbol:z.string().max(12),supply:z.string().max(13),description:z.string().max(2000),repository:z.string().max(2000),demo:z.string().max(2000)});
export type Manifest={schema:"exaflop.genesis.v1";chainId:number;creator:string;createdAt:string;project:LaunchDraft;allocation:"100% to creator at deployment"|"100% to bonding curve; reserved allocation to locked liquidity";provenance:"creator-submitted; not independently verified";renderer:"orbital-v1"};
export type LaunchRecord={id:string;owner:string;manifest:Manifest;digest:`0x${string}`;createdAt:string;sale?:SaleRegistration;deployment?:{address:`0x${string}`;transaction:`0x${string}`;block:string;verifiedAt:string;curve?:`0x${string}`;factory?:`0x${string}`}};
export const emptyDraft:LaunchDraft={name:"",symbol:"",supply:"1000000",description:"",mode:"hardware",hardware:hardwareStacks[0],software:softwareStacks[0],backend:"",repository:"",demo:"",version:"",methodology:"",computeBudget:0,milestones:"",evidence:[]};
export function canonical(value:unknown):string {
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(",")}}`;
}
export function readiness(d:LaunchDraft):string[] {
  const issues:string[]=[];
  const hardware=d.evidence.filter(e=>["ibm","braket"].includes(e.provider.toLowerCase()));
  const simulated=d.evidence.filter(e=>/simulator|local|gpu|aer/i.test(e.provider));
  // Evidence is optional for publication; validate comparisons only when both records exist.
  if(d.mode==="cross-machine"&&hardware.length===2){
    if(hardware[0].backend===hardware[1].backend)issues.push("Attached cross-machine records must use two different backends. Remove a record to launch without a comparison.");
    else if(canonical(hardware[0].circuit)!==canonical(hardware[1].circuit))issues.push("Cross-machine records must use the same circuit.");
  }
  if(d.mode==="silicon"&&simulated.length&&hardware.length){
    if(canonical(simulated[0].circuit)!==canonical(hardware[0].circuit))issues.push("Simulation and hardware records must use the same circuit.");
  }
  if(["software","hybrid"].includes(d.mode)&&(!d.repository||!d.demo||!d.version))issues.push("Add the repository, demo URL, and pinned software version.");
  if(d.mode==="benchmark"&&(!d.repository||!d.version||d.methodology.length<40))issues.push("Add source, version and a reproducible benchmark methodology (40+ characters).");
  if(d.mode==="compute-funded"&&(d.computeBudget<=0||d.milestones.length<30))issues.push("Describe a proposed compute budget and milestones. These are unenforced disclosures.");
  return issues;
}
export function cleanEvidence(result:QuantumResult):QuantumResult {return {schema:result.schema,provider:result.provider,backend:result.backend,jobId:result.jobId,status:result.status,qubits:result.qubits,counts:result.counts,observedAt:result.observedAt,circuit:{qubits:result.circuit.qubits,gates:result.circuit.gates.map(g=>({kind:g.kind,target:g.target,...(g.kind==="CX"?{control:g.control}:{}),...(g.kind.startsWith("R")?{angle:g.angle}:{})}))}};}
