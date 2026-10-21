/* Isolated instance integration. Existing receipts, hashes, admission,
 * record uploads, fences, per-record query, commits and retirement still run
 * inside the real complete preparation scope. No result is inferred by
 * subtracting an oracle timer. Public production methods are untouched. */
(function(root){
'use strict';
const V=root.SphereVegetationService,S=root.SphereVegetationSelection,E=root.SphereInstancedEnvironment;
const life=h=>[h.reservationToken,h.slotStart,h.slotGeneration,h.requestGeneration,h.sceneKey].join('|');
class CompiledSubmission {
 constructor(population){
  this.population=population;this.lifecycle=population.lifecycle;this.service=population.service;this.backend=this.service.gpuBackend;
  if(!this.backend||!this.backend.progressive)throw Error('A real progressive GPU owner is required');
  this.planner=new SphereMeadowTilePlannerP1.TilePlanner();this.tables=new Map();this.enabled=false;this.audit=false;this.cpuOwner='meadow-compiled-submission-p2';
  this.service.retainCpuOwner(this.cpuOwner,this.planner.backingBytes);
  this.stats={candidateCalls:0,planCalls:0,tableCompiles:0,tableBytes:0,candidateChecks:0,planChecks:0,mismatches:[],maximumCompilerMs:0};
  const owner=this;
  this.originalCandidate=this.lifecycle.candidate;
  this.originalPlan=this.backend.plan;
  this.lifecycle.candidate=function(){return owner.enabled?owner.candidate():owner.originalCandidate.call(this);};
  this.backend.plan=function(...args){return owner.enabled?owner.plan(...args):owner.originalPlan.apply(this,args);};
 }
 candidate(){
  const started=performance.now(),L=this.lifecycle,P=this.planner,summary=P.sync(this.service,L);this.stats.candidateCalls++;this.service.retainCpuOwner(this.cpuOwner,P.backingBytes+this.stats.tableBytes);
  if(!summary.candidateEligible)return null;
  // Preserve the original Map's first insertion order, including replacement
  // of a weaker winner. This preserves handle, family and reference order.
  const ready=new Map();
  for(const record of this.service.allocations.values()){
   const entry=P.allocations.get(record.token);if(!entry)continue;
   for(let index=0;index<entry.regions.length;index++){
   const id=entry.regions[index],wanted=L.target.get(id);
   if(!wanted||ready.has(id))continue;
   const r=entry.record,preferred=r.block.id===wanted.detail?3:r.block.id===wanted.fallback?2:r.status==='active'?1:0;
   if(!preferred)continue;
   const winner=P.entries[P.winner[id]],wi=P.winnerIndex[id];if(!winner)throw Error('Missing compiled coverage winner');
   const wr=winner.record,wp=wr.block.id===wanted.detail?3:wr.block.id===wanted.fallback?2:wr.status==='active'?1:0;
   ready.set(id,{r:wr,index:wi,bounds:wr.block.regions[wi],preferred:wp});
   }
  }
  const assignments=new Map(),handles=[],detailRegions=[];
  for(const [id,item]of ready){const {r,index}=item;let a=assignments.get(r.token);if(!a){a={selected:new Set(),detailAvailable:new Set()};assignments.set(r.token,a);handles.push(this.service.handle(r));}a.selected.add(index);if(P.support[id])a.detailAvailable.add(index);if(r.block.tier==='detail')detailRegions.push(id);}
  const result={version:L.version,handles,assignments,regions:ready,detailRegions,foregroundReady:summary.foregroundReady,requestedRegions:L.target.size};
  this.stats.maximumCompilerMs=Math.max(this.stats.maximumCompilerMs,performance.now()-started);
  if(this.audit){const oracle=this.originalCandidate.call(L),comparison=P.compare(oracle);this.stats.candidateChecks++;if(!comparison.matched||JSON.stringify([...oracle.regions.keys()])!==JSON.stringify([...ready.keys()])||JSON.stringify(oracle.handles.map(life))!==JSON.stringify(handles.map(life))||oracle.foregroundReady!==result.foregroundReady){this.stats.mismatches.push({kind:'candidate',comparison});throw Error('Compiled candidate differs from the original ordered oracle');}}
  return result;
 }
 table(packet){
  let table=this.tables.get(packet);if(table)return table;
  const regions=packet.regions,groups=packet.groups,n=regions.length*groups.length,offsets=new Uint32Array(n),counts=new Uint32Array(n),cursor=groups.map(g=>g.byteOffset/32);
  for(let r=0;r<regions.length;r++)for(let g=0;g<groups.length;g++){const i=r*groups.length+g;offsets[i]=cursor[g];counts[i]=regions[r].counts[g];cursor[g]+=counts[i];}
  table={packet,offsets,counts,view:new DataView(packet.records.buffer,packet.records.byteOffset,packet.records.byteLength),keys:groups.map(g=>V.batchKey(g))};this.tables.set(packet,table);this.stats.tableCompiles++;
  // Tables are evicted when their validated packet loses its allocation.
  const retained=new Set([...this.service.allocations.values()].map(r=>r.packet));for(const old of this.tables.keys())if(!retained.has(old))this.tables.delete(old);
  this.stats.tableBytes=[...this.tables.values()].reduce((n,t)=>n+t.offsets.byteLength+t.counts.byteLength,0);this.service.retainCpuOwner(this.cpuOwner,this.planner.backingBytes+this.stats.tableBytes);
  return table;
 }
 plan(handles,prototypes,camera,{staged=false,coverage=null}={}){
  this.stats.planCalls++;const query=camera.productionSelection?S.createView(camera,this.backend.zeroRanks):null,byId=new Map(prototypes.map(p=>[p.id,p])),families=new Map(),signature=[];
  let visible=0,culled=0,rejectedRecords=0,boundaryRecords=0;
  for(const handle of handles){
   const packet=staged?this.service.prepared(handle):this.service.resolve(handle);if(!packet||!this.backend.has(handle))throw Error('Obsolete compiled submission handle');
   if(!Object.isFrozen(handle)||!Array.isArray(packet.regions))throw Error('P2 accepts validated canonical packet handles only');
   if(query&&query.sphere(packet.bounds.center,packet.bounds.radius)<0){culled+=packet.regions.length;rejectedRecords+=packet.recordCount;signature.push(life(handle)+':outside');continue;}
   const table=this.table(packet),assignment=coverage?.get(handle.reservationToken);let regionSignature='';
   for(let r=0;r<packet.regions.length;r++){
    const region=packet.regions[r],selected=!assignment||assignment.selected.has(r),visibility=query?query.sphere(region.center,region.radius):null,seen=selected&&(query?visibility>=0:E.visiblePatch(region,camera)),detailAvailable=assignment?assignment.detailAvailable.has(r):packet.groups.some((g,i)=>g.tier==='detail'&&region.counts[i]>0);
    regionSignature+='0123'[(seen?2:0)+(detailAvailable?1:0)];if(selected){if(seen)visible++;else culled++;}
    if(!seen)continue;
    for(let g=0;g<packet.groups.length;g++){
     const group=packet.groups[g],index=r*packet.groups.length+g,count=table.counts[index],firstSlot=handle.slotStart+table.offsets[index];if(!count)continue;
     const classification=query?query.classify(region,group.tier,detailAvailable,visibility):1;if(classification<0){rejectedRecords+=count;continue;}if(classification===0)boundaryRecords+=count;
     const prototype=byId.get(group.prototypeId);if(!prototype||!prototype.lods[group.geometryLod]||prototype.transparent)throw Error('Unsupported compiled prototype');
     const key=table.keys[g]+'|'+prototype.contentHash;let family=families.get(key);
     if(!family){family={key,group,prototype,lodIndex:group.geometryLod,ranges:[],validationHandles:[],count:0,detailCount:0,fallbackCount:0};families.set(key,family);}
     if(family.validationHandles.at(-1)!==handle)family.validationHandles.push(handle);
     family.ranges.push({handle,firstSlot,count,detailAvailable,...(classification===0?{filter:{view:table.view,firstRecord:firstSlot-handle.slotStart,tier:group.tier,query}}:{})});family.count+=count;if(detailAvailable)family.detailCount+=count;else family.fallbackCount+=count;
    }
   }
   signature.push(['packet',life(handle),regionSignature]);
  }
  const commands=[...families.values()].sort((a,b)=>a.key.localeCompare(b.key));
  const result={commands,visible,culled,handles:handles.slice(),query,selection:query?{revision:2,hierarchicalRejectedRecords:rejectedRecords,boundaryRecords,scannedRecords:0,rejectedBoundaryRecords:0,submittedDetailed:0,foregroundTrimmed:false}:null,key:(query?.key||'')+'#'+JSON.stringify(signature)+'#'+commands.map(c=>c.key).join(';')};
  if(this.audit){const oracle=this.originalPlan.call(this.backend,handles,prototypes,camera,{staged,coverage});this.stats.planChecks++;const projection=p=>JSON.stringify({key:p.key,visible:p.visible,culled:p.culled,selection:p.selection,commands:p.commands.map(c=>({key:c.key,count:c.count,detailCount:c.detailCount,fallbackCount:c.fallbackCount,validation:c.validationHandles.map(life),ranges:c.ranges.map(r=>[life(r.handle),r.firstSlot,r.count,r.detailAvailable,r.filter?.firstRecord,r.filter?.tier])}))});if(projection(result)!==projection(oracle)){this.stats.mismatches.push({kind:'plan'});throw Error('Compiled submission differs from original ordered oracle');}}
  return result;
 }
 select(enabled,{audit=false}={}){this.enabled=enabled;this.audit=audit;const L=this.lifecycle;L.candidateStamp=null;L.candidateCache=null;L.pending=null;this.backend.pendingSelection=null;}
 dispose(){this.select(false);this.lifecycle.candidate=this.originalCandidate;this.backend.plan=this.originalPlan;this.service.releaseCpuOwner(this.cpuOwner);this.tables.clear();this.planner=null;}
 get info(){return {profile:'meadow-submission-p2',revision:1,enabled:this.enabled,audit:this.audit,stats:this.stats,plannerBackingBytes:this.planner.backingBytes,tableBackingBytes:this.stats.tableBytes,scope:'Actual candidate and packet-range plan integration; existing receipt, selection filter, GPU bank and lifetime transactions retained. Warm compilation charged. JS ownership unmeasured.'};}
}
root.SphereMeadowSubmissionP2={CompiledSubmission};
})(window);
