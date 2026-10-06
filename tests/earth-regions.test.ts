import test from "node:test";
import assert from "node:assert/strict";
import { regionFor, regionalOffers, buildOfferUrl, regionInventory } from "../src/lib/earth-regions";
import type { Offer } from "../src/lib/types";

test("maps explicit locations and provider region codes without inventing coordinates",()=>{
  assert.equal(regionFor("us-east-1"),"north-america");
  assert.equal(regionFor("Germany, Frankfurt"),"europe");
  assert.equal(regionFor("ap-southeast-1"),"asia");
  assert.equal(regionFor("South Africa"),"africa");
  assert.equal(regionFor("Auto (secure cloud)"),null);
  assert.equal(regionFor("Unspecified"),null);
  assert.equal(regionFor("California"),null);
  assert.equal(regionFor("unknown-region-1"),null);
});

test("regional selection filters hardware and ranks GPU-normalized prices",()=>{
  const offers=[
    {id:"1",region:"US",hardware:"H100",price:8,gpuCount:8},
    {id:"2",region:"US",hardware:"H100",price:2,gpuCount:1},
    {id:"3",region:"DE",hardware:"H100",price:1,gpuCount:1},
    {id:"4",region:"Auto (secure cloud)",hardware:"H100",price:1,gpuCount:1},
    {id:"5",region:"US",hardware:"A100",price:1,gpuCount:1},
  ] as Offer[];
  assert.deepEqual(regionalOffers(offers,"north-america","H100").map(o=>o.id),["1","2"]);
  assert.deepEqual(regionalOffers(offers,"unmapped").map(o=>o.id),["4"]);
});

test("builder links preserve exact provider location and whole-node GPU quantity",()=>{
  const url=new URL(buildOfferUrl({hardware:"H100",region:"Germany, Frankfurt & region 1",gpuCount:8}),"https://example.com");
  assert.equal(url.pathname,"/build");
  assert.equal(url.searchParams.get("region"),"Germany, Frankfurt & region 1");
  assert.equal(url.searchParams.get("gpu"),"H100");
  assert.equal(url.searchParams.get("quantity"),"8");
});

test("automatic RunPod catalog stays discoverable from each region without claiming regional stock",()=>{
  const offers=[{id:"runpod:1",region:"Auto (secure cloud)",hardware:"H100",price:2,gpuCount:1}] as Offer[];
  for(const region of ["asia","europe","north-america","africa","oceania","south-america"]){
    const result=regionInventory(offers,region);
    assert.equal(result.located.length,0);
    assert.equal(result.display.length,1);
    assert.equal(result.fallback,true);
  }
  assert.equal(regionInventory(offers,"asia","A100").display.length,0);
  assert.equal(new URL(buildOfferUrl(offers[0]),"https://example.com").searchParams.get("region"),"auto");
});

test("empty regions expose real alternatives without changing their actual location",()=>{
 const offers=[{id:"us:1",region:"US",hardware:"H100",price:2,gpuCount:1}] as Offer[];
 const result=regionInventory(offers,"africa");
 assert.equal(result.located.length,0);
 assert.equal(result.elsewhere,true);
 assert.equal(result.display[0].region,"US");
 assert.equal(regionInventory(offers,"north-america").fallback,false);
 assert.equal(regionInventory(offers,"africa","A100").display.length,0);
 assert.equal(regionInventory([],"africa").display.length,0);
 assert.equal(regionInventory(offers,"unmapped").display.length,0);
});
