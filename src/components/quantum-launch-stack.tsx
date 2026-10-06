import Link from "next/link";
import {Cpu,Workflow,ArrowUpRight} from "lucide-react";
import {BrandLogo} from "./brand-logo";

const hardware=[
 {name:"IBM Quantum",brand:"ibm",tag:"Superconducting QPU",text:"Give your genesis a hardware origin with a circuit, backend and job reference.",mode:"hardware"},
 {name:"Amazon Braket",brand:"amazonwebservices",tag:"Gate-based QPU",text:"Document a gate-based quantum experiment and attach its measurement results.",mode:"hardware"},
 {name:"Braket · neutral atoms",brand:"amazonwebservices",tag:"Custom workflow",text:"Bring a neutral-atom experiment with its own reproducible workflow and evidence.",mode:"hardware"},
 {name:"NVIDIA GPU",brand:"nvidia",tag:"Classical simulation",text:"Launch around GPU simulation work with a named device and reproducible results.",mode:"silicon"},
 {name:"CPU simulation",brand:"",tag:"Classical simulation",text:"Start with a classical simulator and publish the code and execution details.",mode:"software"},
 {name:"CPU / GPU + QPU",brand:"",tag:"Hybrid execution",text:"Connect classical processing and quantum execution in one documented project.",mode:"hybrid"},
];
const software=[
 {name:"Qiskit / Aer",brand:"qiskit",text:"Circuits and simulation",mode:"hardware"},
 {name:"PennyLane / Lightning",brand:"pennylane",text:"Differentiable quantum workflows",mode:"software"},
 {name:"PennyLane / Catalyst",brand:"pennylane",text:"Compiled hybrid workflows",mode:"hybrid"},
 {name:"NVIDIA cuQuantum",brand:"nvidia",text:"GPU simulation workflows",mode:"silicon"},
 {name:"Custom container",brand:"docker",text:"Your versioned execution environment",mode:"software"},
];
export function QuantumLaunchStack(){return <section id="launch-stack" className="home-launch-stack" aria-labelledby="launch-stack-heading">
 <div className="quantum-home-section-heading"><div><span className="eyebrow">QUANTUM COMPUTING / YOUR LAUNCH STACK</span><h2 id="launch-stack-heading">Choose your quantum computing stack.<br/>Make it part of your launch.</h2></div><Link href="/launchpad?create=hardware">Build your quantum launch <ArrowUpRight size={16}/></Link></div>
 <p className="stack-intro">Make quantum computing part of your token’s story. Choose quantum hardware, classical simulation or a hybrid workflow, then publish the software, execution details and evidence alongside your genesis record.</p>
 <h3 className="stack-label">01 / Hardware & execution</h3><div className="stack-hardware">{hardware.map(item=><Link href={`/launchpad?create=${item.mode}`} className="stack-card" key={item.name}><div className="stack-card-top">{item.brand?<BrandLogo brand={item.brand}/>:item.mode==="hybrid"?<Workflow size={30} strokeWidth={1.3}/>:<Cpu size={30} strokeWidth={1.3}/>}<ArrowUpRight size={16}/></div><span className="eyebrow">{item.tag}</span><h3>{item.name}</h3><p>{item.text}</p><span className="stack-action">Create with this launch path ↗</span></Link>)}</div>
 <h3 className="stack-label">02 / Software foundations</h3><div className="stack-software">{software.map(item=><Link href={`/launchpad?create=${item.mode}`} key={item.name}><BrandLogo brand={item.brand}/><div><strong>{item.name}</strong><span>{item.text}</span></div><ArrowUpRight size={15}/></Link>)}</div>
 <p className="stack-disclosure">Choose your exact stack in the launch editor. Qiskit/Aer preparation is available in Quantum Lab; hardware execution needs your provider access. PennyLane, Catalyst, cuQuantum, neutral-atom and custom containers use workflows you supply. Selecting a stack does not run it. Logos identify technologies, not partnerships; quantum evidence remains creator-submitted.</p>
 </section>;}
