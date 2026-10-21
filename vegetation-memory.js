/* HR-07 ownership census. Byte credits are admission policy, never heap proof.
 * A census is diagnostic work and is deliberately outside frame timing. */
(function(root){
'use strict';
const REVISION=1,ids=new WeakMap();let serial=0;
const finite=n=>Number.isSafeInteger(n)&&n>=0;
class MemoryInventory{
 constructor(service){this.service=service;this.roots=new Map();}
 retain(owner,value,{lifetime='service',release='owner disposal'}={}){
  if(typeof owner!=='string'||!owner||owner.length>256||!value||typeof value!=='object')throw Error('Invalid CPU inventory owner');
  if(!this.roots.has(owner)&&this.roots.size>=32)throw Error('CPU inventory root capacity exceeded');this.roots.set(owner,{value,lifetime,release});
 }
 release(owner){this.roots.delete(owner);}
 clear(){this.roots.clear();}
 get unknownOwners(){const s=this.service,l=s.lifecycle,b=s.gpuBackend;return [...s.cpuOwners.keys()].filter(owner=>owner!==l?.owner&&!(owner==='vegetation-native-zero-ranks'&&b?.zeroRanks)&&!this.roots.has(owner));}
 snapshot(){
  const s=this.service,b=s.gpuBackend,l=s.lifecycle,pool=l?.pool,entries=[],buffers=new Map(),skipped=new Set(['service','gl','owningPass','worker','pool','memory','cpuInventory']);
  const add=(owner,value,lifetime,release)=>{if(value)entries.push({owner,value,lifetime,release});};
  for(const r of s.allocations.values())add('allocation:'+r.token,{block:r.block,packet:r.packet,credit:r.credit,slot:r.slot},r.status,r.status==='preparing'||r.status==='cancelled'?'producer completion or termination':'retirement after last-use fence');
  for(const c of s.contexts.values())add('configuration:'+c.id,c,'configuration and worker leases','last allocation and worker lease released');
  add('allocator-and-queue',{free:s.allocator.free,slots:s.allocator.live,queue:s.queue,counters:s.counters,timings:s.timings},'service','service disposal');
  if(l)add('coverage',l,'coverage transaction','replacement or lifecycle disposal');
  if(pool)for(const w of pool.workers)add(w.owner,{job:w.busy,receipt:w.receipt?.data,configured:w.configured,leases:w.leases,memoryReport:w.memoryReport},w.receipt?'received packet':'worker control','receipt transfer, worker termination or pool disposal');
  if(b&&!b.closed)add('gpu-backend-cpu',b,b.disposing?'last-use retirement':'persistent backend','backend fence completion and disposal');
  // Renderer resources outlive a service. Disposal must not make its surviving
  // shared prototype arrays disappear from the ownership census.
  if(b?.owningPass&&!this.roots.has('renderer-prototype-cache'))add('renderer-prototype-cache',b.owningPass.residentPrototypeRecords,'renderer cache','renderer-pass disposal');
  if(b?.owningPass&&!this.roots.has('renderer-other-vegetation'))add('renderer-retained-resources',{records:b.owningPass.records,residentCells:b.owningPass.residentCellRecords},'renderer cache','renderer-pass disposal');
  for(const retiring of b?.owningPass?.vegetationBackends||[])if(retiring!==b&&!retiring.closed)add('retiring-service:'+retiring.service.issuer,{backend:retiring,allocations:retiring.service.allocations,contexts:retiring.service.contexts},'last-use retirement','retiring backend fence completion');
  for(const [owner,e]of this.roots)add(owner,e.value,e.lifetime,e.release);
  add('canopy-module-caches',root.SphereMeadowCanopy?.cpuBuffers?.(),'browser isolate module cache','owning browser isolate termination');
  add('selection-demand-weak-cache',root.SphereVegetationSelection?.cpuCaches?.(),'module weak-key metadata; live immutable demand owns entries','demand/key collection; module container at isolate termination');
  const owners=[];
  for(const e of entries){const seen=new Set(),owned=new Set();let objects=0,stringCodeUnits=0;
   const visit=value=>{
    if(typeof value==='string'){stringCodeUnits+=value.length;return;}
    if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
    const backing=ArrayBuffer.isView(value)?value.buffer:value instanceof ArrayBuffer||typeof SharedArrayBuffer!=='undefined'&&value instanceof SharedArrayBuffer?value:null;
    if(backing){let item=buffers.get(backing);if(!item){let id=ids.get(backing);if(!id){id=++serial;ids.set(backing,id);}item={id,bytes:backing.byteLength,shared:typeof SharedArrayBuffer!=='undefined'&&backing instanceof SharedArrayBuffer,owners:[]};buffers.set(backing,item);}if(!owned.has(backing)){owned.add(backing);item.owners.push(e.owner);}return;}
    // Host resources have GPU/native lifetimes, not CPU ArrayBuffer payloads.
    const tag=Object.prototype.toString.call(value);if(!['[object Object]','[object Array]','[object Map]','[object Set]'].includes(tag))return;
    objects++;
    if(value instanceof Map){for(const [k,v]of value){visit(k);visit(v);}return;}
    if(value instanceof Set){for(const v of value)visit(v);return;}
    for(const [k,d]of Object.entries(Object.getOwnPropertyDescriptors(value)))if(!skipped.has(k)&&'value'in d)visit(d.value);
   };visit(e.value);
   owners.push({owner:e.owner,lifetime:e.lifetime,release:e.release,backingBytes:[...owned].reduce((n,v)=>n+v.byteLength,0),backings:owned.size,metadataObjects:objects,stringCodeUnits,metadataSize:'Measured heap required; object counts and serialization are not byte bounds'});
  }
  const ledger=[...buffers.values()],exactBackingBytes=ledger.reduce((n,v)=>n+v.bytes,0),pending=[...s.allocations.values()].filter(r=>!r.packet),receivedBytes=pool?.receipts.reduce((n,r)=>n+((r.data.packet||r.data).records?.buffer.byteLength||0),0)||0;
  const reservations={pendingPayloadAndMetadataBytes:pending.reduce((n,r)=>n+r.credit.cpuBytes+r.credit.packetBytes,0),workerScratchBytes:pending.reduce((n,r)=>n+r.credit.scratchBytes,0),configurationCreditBytes:s.usage.configurationBytes,externalCreditBytes:[...s.cpuOwners.values()].reduce((n,v)=>n+v,0)};
  const populations=new Map(),regional=new Map();let duplicatePopulationBytes=0,duplicateRecords=0,retainedRecords=0,unresolvedDuplicateGroups=0;
  for(const r of s.allocations.values())if(r.packet){const p=r.packet;retainedRecords+=p.recordCount;const k=r.context.contentKey+'|'+r.block.id,old=populations.get(k);if(old&&old!==p.records.buffer){duplicatePopulationBytes+=p.records.buffer.byteLength;duplicateRecords+=p.recordCount;continue;}populations.set(k,p.records.buffer);
   // Compact detail packets also contain canonical clumps. Their fallback
   // packet has a different block ID but stores those same planted records.
   const bounds=r.block.regions||[r.block.chartBoundsMetres],regions=p.regions||[{counts:p.groups.map(g=>g.count)}];
   for(let i=0;i<regions.length;i++)for(let g=0;g<p.groups.length;g++){const group=p.groups[g],count=regions[i].counts[g];if(!count)continue;if(!bounds[i]){unresolvedDuplicateGroups++;continue;}const key=[r.context.configurationHash,r.block.parent,group.prototypeId,group.prototypeRevision,group.tier,group.tier==='detail'?r.block.areaSteps:0,bounds[i].join(',')].join('|'),prior=regional.get(key);if(prior){if(prior.count===count&&prior.backing!==p.records.buffer){duplicateRecords+=count;duplicatePopulationBytes+=count*32;}else if(prior.count!==count)unresolvedDuplicateGroups++;}else regional.set(key,{count,backing:p.records.buffer});}
  }
  const unknownOwners=this.unknownOwners;
  return {revision:REVISION,inventoryComplete:unknownOwners.length===0,unknownOwners,heapStatus:'UNMEASURED',exactBackingBytes,sharedBackingAliases:ledger.reduce((n,v)=>n+Math.max(0,v.owners.length-1),0),buffers:ledger,owners,receivedPacketBytes:receivedBytes,reservations,unmaterializedTransitionCreditBytes:reservations.pendingPayloadAndMetadataBytes+reservations.workerScratchBytes,duplicatePopulationBytes,duplicateRecords,uniqueValidatedRecords:retainedRecords-duplicateRecords,duplicatePopulationScope:'Validated canonical provider/configuration/prototype/group regions; all physical copies retain their full byte charge',unresolvedDuplicateGroups,workers:(pool?.workers||[]).map(w=>({owner:w.owner,busy:!!w.busy,received:!!w.receipt,configurationLeases:[...w.leases],report:w.memoryReport||null})),scope:'Explicit main-thread backing allocations; complete JS metadata and worker heaps require external measurement'};
 }
}
function assessHeap(inventory,{main,mainArrayBufferBytes,workers,expectedWorkers,sourceSha256}={}){
 const incomplete=reason=>({revision:REVISION,status:'INCOMPLETE',upperBoundBytes:null,reason});
 if(!inventory?.inventoryComplete||!main||!finite(main.usedSize)||!finite(main.backingStorageSize)||!finite(mainArrayBufferBytes)||mainArrayBufferBytes>main.backingStorageSize||inventory.exactBackingBytes>mainArrayBufferBytes)return incomplete('Missing or inconsistent main heap/backing attribution');
 if(!Array.isArray(workers)||!finite(expectedWorkers)||workers.length!==expectedWorkers||workers.some(w=>!finite(w.usage?.usedSize)||!finite(w.usage?.backingStorageSize)))return incomplete('Every live worker heap and backing store is required');
 if(typeof sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(sourceSha256))return incomplete('Exact runtime source identity is required');
 // Charge ALL main JS metadata/code, ALL non-ArrayBuffer external storage, and
 // ALL worker heaps/code/backing stores to vegetation. Only explicitly measured
 // unrelated main ArrayBuffers are excluded. Alias backing is charged once.
 const mainNonArrayBufferBytes=main.backingStorageSize-mainArrayBufferBytes,workerHeapBytes=workers.reduce((n,w)=>n+w.usage.usedSize+w.usage.backingStorageSize,0),retainedUpperBoundBytes=main.usedSize+mainNonArrayBufferBytes+inventory.exactBackingBytes+workerHeapBytes,transitionUpperBoundBytes=retainedUpperBoundBytes+inventory.unmaterializedTransitionCreditBytes;
 return {revision:REVISION,status:transitionUpperBoundBytes<=64*1048576?'PASS':'FAIL',sourceSha256,upperBoundBytes:transitionUpperBoundBytes,retainedUpperBoundBytes,transitionUpperBoundBytes,mainJavaScriptHeapBytes:main.usedSize,mainNonArrayBufferBytes,mainOwnedBackingBytes:inventory.exactBackingBytes,workerHeapBytes,unmaterializedTransitionCreditBytes:inventory.unmaterializedTransitionCreditBytes,limitBytes:64*1048576,method:'Entire main JS heap and non-ArrayBuffer external storage, unique owned main backing, entire live worker heaps/backing, plus all pending producer credits; diagnostic sample, not a portable engine object-size assumption'};
}
const api={REVISION,MemoryInventory,assessHeap};root.SphereVegetationMemory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
