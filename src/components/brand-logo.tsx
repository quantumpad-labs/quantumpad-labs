import { Atom, Cpu } from "lucide-react";
import sources from "../../public/brands/sources.json";
import { hardware } from "@/lib/catalog";

const names: Record<string,string> = {nvidia:"NVIDIA",amd:"AMD",runpod:"Runpod",vast:"Vast.ai",lambda:"Lambda",akash:"Akash Network",hyperstack:"Hyperstack",salad:"SaladCloud",tensordock:"TensorDock",io:"io.net",fluidstack:"Fluidstack",coreweave:"CoreWeave",golem:"Golem",pytorch:"PyTorch",tensorflow:"TensorFlow",jupyter:"Jupyter",blender:"Blender",docker:"Docker",googlecolab:"Google Colab",huggingface:"Hugging Face",vllm:"vLLM"};

/** Local, source-recorded assets. Generic compute never implies a vendor. */
export function BrandLogo({brand,compact=false}:{brand:string;compact?:boolean}) {
  const id=brand.toLowerCase();
  const asset=sources[id as keyof typeof sources];
  return <span className={`brand-logo brand-${id} ${compact?"brand-compact":""}`}>
    {asset ? <img src={`/brands/${asset.file}`} width={32} height={32} alt={`${names[id]??brand} logo`} decoding="async"/> : <Cpu size={22} strokeWidth={1.2} aria-label="Generic compute"/>}
  </span>;
}
export function HardwareLogo({id,compact=false}:{id:string;compact?:boolean}) {
  return <BrandLogo brand={hardware.find(h=>h.id===id)?.vendor??"compute"} compact={compact}/>;
}
export function WorkloadBrand({id}:{id:string}) {
  if(id === "quantum") return <span className="workload-brand"><Atom size={48} strokeWidth={1.1}/><small>Quantum simulation</small></span>;
  const brands:Record<string,string>={inference:"vllm",finetune:"pytorch",diffusion:"pytorch",jupyter:"jupyter",blender:"blender",custom:"docker",tensorflow:"tensorflow",quant:"jupyter"};
  const brand=brands[id]??"docker";
  return <span className="workload-brand"><BrandLogo brand={brand}/><small>{names[brand]}</small></span>;
}
