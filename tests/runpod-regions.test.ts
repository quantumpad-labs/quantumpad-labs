import test from "node:test";
import assert from "node:assert/strict";
import {adapters} from "../src/lib/providers";

test("RunPod pairs datacenter stock with scoped prices and preserves unlocated fallback",async()=>{
  const original=globalThis.fetch;const queries:string[]=[];
  globalThis.fetch=async(_url,init)=>{
    const {query}=JSON.parse(String(init?.body));queries.push(query);
    if(query.includes("dataCenters {"))return Response.json({data:{
      dataCenters:[{id:"EU-FR-1",location:"France",gpuAvailability:[{gpuTypeId:"g1",available:true}]},{id:"US-1",location:"United States",gpuAvailability:[{gpuTypeId:"g1",available:false}]}],
      gpuTypes:[{id:"g1",displayName:"H100",memoryInGb:80,lowestPrice:{uninterruptablePrice:1,stockStatus:"High"}},{id:"g2",displayName:"A100",memoryInGb:80,lowestPrice:{uninterruptablePrice:2,stockStatus:"High"}}],
    }});
    assert.match(query,/dataCenterId:"EU-FR-1"/);assert.doesNotMatch(query,/dataCenterId:"US-1"/);
    return Response.json({data:{p0:[{lowestPrice:{uninterruptablePrice:3.49,stockStatus:"Medium"}}]}});
  };
  try{
    const result=await adapters.find(a=>a.id==="runpod")!.listOffers();
    assert.equal(result.length,2);assert.equal(result[0].region,"EU-FR-1 · France");
    assert.equal(result[0].price,3.49);assert.equal(result[0].metadata?.dataCenterId,"EU-FR-1");
    assert.equal(result[0].deployable,false);assert.equal(result[1].region,"Auto (secure cloud)");
    assert.equal(queries.length,2);
  }finally{globalThis.fetch=original;}
});
