'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{IDBFactory}=require('fake-indexeddb');
const F=require('./fixtures/biome-service/allocator-fixture-helper.cjs'),Main=require('../biome-service/main-install.v2.js'),S=require('../biome-service/storage.js');
async function main(){
 await F.host();
 const profiles=JSON.parse(await fs.readFile(path.join(F.repo,'biome-service/main-install-profiles.v2.json'),'utf8')),core={...global.SphereMath.defaultState(),collection:true},indexedDB=new IDBFactory(),origin='http://127.0.0.1:8876';
 const fetchBytes=async(url,{maximumBytes}={})=>{const u=new URL(url);assert.equal(u.origin,origin);const bytes=new Uint8Array(await fs.readFile(path.join(F.repo,decodeURIComponent(u.pathname))));assert(bytes.length<=maximumBytes);return bytes;};
 const make=()=>Main.create({origin,profiles,indexedDB,fetchBytes,onPhase:phase=>console.log(phase)});
 let service=await make();
 const initial=await service.run(core);assert.equal(initial.installationCount,0);assert.equal(initial.head,null);assert.equal(initial.available.length,1);assert.equal(initial.available[0].available,true);
 const digest=initial.available[0].payloadDigest;
 await assert.rejects(()=>service.run(core,digest,{signal:AbortSignal.abort()}),e=>e.code==='CANCELLED');assert.equal((await service.run(core)).installationCount,0);
 const installed=await service.run(core,digest);assert.equal(installed.status,'INSTALLED');assert.equal(installed.installationCount,1);assert.equal(installed.regionCount,1);assert(installed.cellCount>0);assert.equal(installed.installations[0].regions[0].trackRelation,'within');assert.equal(installed.receipt.durable,true);
 const charged=service.inspect();assert(!charged.budget.owners.some(o=>o.name==='biome-allocator'));assert.equal(charged.binding.liveAllocators,0);assert.equal(charged.binding.ownership.handoffCount,1);assert(charged.binding.ownership.lastHandoff.budgetAtOverlap.owners.some(o=>o.name==='biome-allocator'));assert(!charged.binding.ownership.lastHandoff.budgetAfterRetirement.owners.some(o=>o.name==='biome-allocator'));assert(charged.budget.peakBytes<33554432);service.dispose();assert.equal(service.inspect().budget.heldBytes,0);
 service=await make();const reopened=await service.run(core);for(const key of ['worldId','head','installations','installationCount','regionCount','cellCount'])assert.deepEqual(reopened[key],installed[key],key);
 const before=service.inspect().storage.writes,repeat=await service.run(core,digest);assert.equal(repeat.status,'ALREADY_INSTALLED');assert.deepEqual(repeat.head,installed.head);assert.deepEqual(repeat.installations,installed.installations);assert.equal(service.inspect().storage.writes,before);
 await assert.rejects(()=>service.run({...core,seed:core.seed+1}),e=>e.code==='WORLD_PROFILE_CHANGED');service.dispose();assert.equal(service.inspect().budget.heldBytes,0);
 const actual=await S.open({indexedDB});assert.equal((await actual.getAllKeys('worldHeads')).length,1);assert.equal((await actual.getAll('worldBindings')).filter(b=>b.body.revision===1).length,1);actual.close();
 console.log(JSON.stringify({status:'PASS_COMPONENT_ONLY',worldId:installed.worldId,head:installed.head,cells:installed.cellCount,metadataPeakBytes:charged.budget.peakBytes,storage:charged.storage,checks:['empty catalogue projection','pre-cancel no publication','real native fixture source verification','automatic within-track allocation','atomic publication','durable completion paid during source/recipient overlap','completed allocator retired before publication','owner disposal reaches zero','new owner durable readback','repeat has zero writes','world change refuses'],browserProof:'SEPARATE_ORDINARY_MAIN_REQUIRED'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
