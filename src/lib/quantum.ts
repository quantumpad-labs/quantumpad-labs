/** Small, bounded statevector engine. q0 is the least-significant bit. */
export type Gate = { kind: "H" | "X" | "Y" | "Z" | "S" | "T" | "RX" | "RY" | "RZ" | "CX"; target: number; control?: number; angle?: number };
export type Circuit = { qubits: number; gates: Gate[] };
export const presets: Record<string, Circuit> = {
  bell: { qubits: 2, gates: [{kind:"H",target:0},{kind:"CX",control:0,target:1}] },
  ghz: { qubits: 3, gates: [{kind:"H",target:0},{kind:"CX",control:0,target:1},{kind:"CX",control:1,target:2}] },
  interference: { qubits: 1, gates: [{kind:"H",target:0},{kind:"Z",target:0},{kind:"H",target:0}] },
  grover: { qubits: 2, gates: [{kind:"H",target:0},{kind:"H",target:1},{kind:"H",target:1},{kind:"CX",control:0,target:1},{kind:"H",target:1},{kind:"H",target:0},{kind:"H",target:1},{kind:"X",target:0},{kind:"X",target:1},{kind:"H",target:1},{kind:"CX",control:0,target:1},{kind:"H",target:1},{kind:"X",target:0},{kind:"X",target:1},{kind:"H",target:0},{kind:"H",target:1}] },
};
export function validateCircuit(c: Circuit) {
  if (!Number.isInteger(c.qubits) || c.qubits < 1 || c.qubits > 8 || !Array.isArray(c.gates) || c.gates.length > 64) throw new Error("Use 1–8 qubits and at most 64 gates.");
  for (const g of c.gates) {
    if (!g || !["H","X","Y","Z","S","T","RX","RY","RZ","CX"].includes(g.kind) || !Number.isInteger(g.target) || g.target < 0 || g.target >= c.qubits) throw new Error("Invalid gate or target.");
    if (g.kind === "CX" && (!Number.isInteger(g.control) || g.control! < 0 || g.control! >= c.qubits || g.control === g.target)) throw new Error("CX needs two different qubits.");
    if (["RX","RY","RZ"].includes(g.kind) && (!Number.isFinite(g.angle) || Math.abs(g.angle!) > 100 * Math.PI)) throw new Error("Invalid rotation angle.");
  }
}
type Complex = [number, number];
export function simulate(c: Circuit) {
  validateCircuit(c);
  const n = 2 ** c.qubits, re = new Float64Array(n), im = new Float64Array(n); re[0] = 1;
  for (const g of c.gates) {
    const mask = 1 << g.target;
    if (g.kind === "CX") { for (let i=0;i<n;i++) if (!(i & mask) && (i & (1 << g.control!))) { const j=i|mask; [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; } continue; }
    const a=(g.angle??0)/2, co=Math.cos(a), si=Math.sin(a), h=Math.SQRT1_2;
    const matrices: Record<string, Complex[]> = {
      H:[[h,0],[h,0],[h,0],[-h,0]], X:[[0,0],[1,0],[1,0],[0,0]], Y:[[0,0],[0,-1],[0,1],[0,0]], Z:[[1,0],[0,0],[0,0],[-1,0]],
      S:[[1,0],[0,0],[0,0],[0,1]], T:[[1,0],[0,0],[0,0],[h,h]], RX:[[co,0],[0,-si],[0,-si],[co,0]], RY:[[co,0],[-si,0],[si,0],[co,0]], RZ:[[co,-si],[0,0],[0,0],[co,si]],
    };
    const [u,v,w,z]=matrices[g.kind];
    for(let i=0;i<n;i++) if(!(i&mask)) { const j=i|mask, ar=re[i],ai=im[i],br=re[j],bi=im[j];
      re[i]=u[0]*ar-u[1]*ai+v[0]*br-v[1]*bi; im[i]=u[0]*ai+u[1]*ar+v[0]*bi+v[1]*br;
      re[j]=w[0]*ar-w[1]*ai+z[0]*br-z[1]*bi; im[j]=w[0]*ai+w[1]*ar+z[0]*bi+z[1]*br;
    }
  }
  const probabilities=Array.from(re,(r,i)=>r*r+im[i]*im[i]);
  const bloch=Array.from({length:c.qubits},(_,q)=>{ let x=0,y=0,z=0; for(let i=0;i<n;i++) if(!(i&(1<<q))) {const j=i|(1<<q);x+=2*(re[i]*re[j]+im[i]*im[j]);y+=2*(re[i]*im[j]-im[i]*re[j]);z+=probabilities[i]-probabilities[j];} return {x,y,z,purity:(1+x*x+y*y+z*z)/2}; });
  return {probabilities,bloch};
}
export function sample(probabilities: number[], shots: number, readoutError=0, random= Math.random) {
  if(!Number.isInteger(shots)||shots<1||shots>8192||!Number.isFinite(readoutError)||readoutError<0||readoutError>.25) throw new Error("Invalid sampling settings.");
  const counts=Array(probabilities.length).fill(0) as number[];
  const qubits=Math.log2(probabilities.length);
  for(let s=0;s<shots;s++) {let r=random(),i=0;while(i<probabilities.length-1&&r>=probabilities[i])r-=probabilities[i++];for(let q=0;q<qubits;q++)if(random()<readoutError)i^=1<<q;counts[i]++;}
  return counts;
}
export function qasm(c:Circuit) {
  validateCircuit(c);
  return ['OPENQASM 2.0;','include "qelib1.inc";',`qreg q[${c.qubits}];`,`creg c[${c.qubits}];`,...c.gates.map(g=>g.kind==="CX"?`cx q[${g.control}],q[${g.target}];`:`${g.kind.toLowerCase()}${g.kind.startsWith("R")?`(${g.angle})`:""} q[${g.target}];`),'measure q -> c;'].join('\n');
}
export function hybridSweep(kind:"qaoa"|"vqe") {
  const history: {step:number;value:number;best:number}[]=[]; let best=kind==="vqe"?Infinity:-Infinity, bestCircuit:Circuit=presets.bell, parameters:number[]=[];
  const steps=kind==="vqe"?65:17*17;
  for(let i=0;i<steps;i++) {
    let c:Circuit, value:number, args:number[];
    if(kind==="vqe") {const theta=i/64*2*Math.PI;c={qubits:1,gates:[{kind:"RY",target:0,angle:theta}]};const b=simulate(c).bloch[0];value=b.z+.5*b.x;args=[theta];}
    else {const gamma=Math.floor(i/17)/16*Math.PI,beta=(i%17)/16*Math.PI/2;c={qubits:2,gates:[{kind:"H",target:0},{kind:"H",target:1},{kind:"CX",control:0,target:1},{kind:"RZ",target:1,angle:-gamma},{kind:"CX",control:0,target:1},{kind:"RX",target:0,angle:2*beta},{kind:"RX",target:1,angle:2*beta}]};const p=simulate(c).probabilities;value=p[1]+p[2];args=[gamma,beta];}
    if(kind==="vqe"?value<best:value>best){best=value;bestCircuit=c;parameters=args;}history.push({step:i,value,best});
  }
  return {kind,history,best,circuit:bestCircuit,parameters};
}
export type QuantumResult = {schema:"exaflop.quantum.result.v1";provider:string;backend:string;jobId:string;status:string;qubits:number;counts:Record<string,number>;observedAt:string;circuit:Circuit};
export function parseResult(value:unknown): QuantumResult {
  const r=value as QuantumResult;
  if(!r || r.schema!=="exaflop.quantum.result.v1" || ![r.provider,r.backend,r.jobId,r.status,r.observedAt].every(v=>typeof v==="string"&&v.length<=300)||!Number.isInteger(r.qubits)||r.qubits<1||r.qubits>8||!r.counts||Array.isArray(r.counts)||typeof r.counts!=="object")throw new Error("Choose an QuantumPad quantum result JSON from the runner.");
  validateCircuit(r.circuit);if(r.circuit.qubits!==r.qubits)throw new Error("Circuit and result qubits differ.");
  const entries=Object.entries(r.counts);if(entries.length>256||!entries.length||entries.some(([k,v])=>!new RegExp(`^[01]{${r.qubits}}$`).test(k)||!Number.isSafeInteger(v)||v<0)||entries.reduce((s,[,v])=>s+v,0)>8192||entries.reduce((s,[,v])=>s+v,0)<1)throw new Error("Invalid counts (maximum 8,192 shots).");
  return r;
}
