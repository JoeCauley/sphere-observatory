/* Versioned compiled-table shadow planner. Ordinary validated one-metre
 * production packets only. No production method or commit path is replaced.
 * Records, GPU banks, worker receipts and lifetime fences remain owned by the
 * existing service; this module only chooses geographic coverage winners. */
(function(root){
'use strict';
const CELLS=65536,MAX_ALLOCS=2048,MAX_EDGES=65536;
function cell(bounds){
 if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isInteger)||bounds[0]<-128||bounds[0]>=128||bounds[1]<-128||bounds[1]>=128||bounds[2]!==bounds[0]+1||bounds[3]!==bounds[1]+1)throw Error('P1 compiler requires canonical one-metre bounds');
 return (bounds[1]+128)*256+bounds[0]+128;
}
class TilePlanner{
 constructor(){
  this.head=new Int32Array(CELLS);this.head.fill(-1);
  this.next=new Int32Array(MAX_EDGES);this.edgeOwner=new Uint16Array(MAX_EDGES);this.edgeRegion=new Uint16Array(MAX_EDGES);this.edgeIndex=new Uint16Array(MAX_EDGES);
  this.fallback=new Uint32Array(CELLS);this.detail=new Uint32Array(CELLS);
  this.winner=new Uint16Array(CELLS);this.winnerIndex=new Uint16Array(CELLS);
  this.dirty=new Uint8Array(CELLS);this.queue=new Uint16Array(CELLS);this.queueLength=0;
  this.grid=new Uint8Array(CELLS);this.support=new Uint8Array(CELLS);this.supportDirty=new Uint8Array(CELLS);this.supportQueue=new Uint16Array(CELLS);this.supportLength=0;
  this.rows=new Uint32Array(256*8);this.bits=new Uint32Array(256*8);
  this.ids=new Map();this.nextId=1;this.allocations=new Map();this.entries=new Array(MAX_ALLOCS);this.freeAlloc=[];this.allocEnd=1;this.freeEdges=[];this.edgeEnd=0;
  this.requests=new Map();this.version=-1;this.context=null;this.targetCount=0;this.readyCount=0;this.unreadyDetail=0;
  this.stats={syncs:0,compiledRegions:0,dirtyVisits:0,winnerChanges:0,detailChanges:0,requestChanges:0,retired:0};
 }
 id(key){if(!this.ids.has(key)){if(this.nextId>=8192)throw Error('Bounded block identity table exhausted; rebuild/eviction unimplemented');this.ids.set(key,this.nextId++);}return this.ids.get(key);}
 mark(i){if(!this.dirty[i]){this.dirty[i]=1;this.queue[this.queueLength++]=i;}}
 markSupport(i){const x=i&255,z=i>>>8;for(let dz=Math.max(4,z-4);dz<=Math.min(251,z+4);dz++)for(let dx=Math.max(4,x-4);dx<=Math.min(251,x+4);dx++){const j=dz*256+dx;if(!this.supportDirty[j]){this.supportDirty[j]=1;this.supportQueue[this.supportLength++]=j;}}}
 compileRegions(block){if(block.regions.length>65535)throw Error('Region capacity exceeded');return Uint16Array.from(block.regions,cell);}
 remove(entry){
  for(const edge of entry.edges){const region=this.edgeRegion[edge];let p=-1,at=this.head[region];while(at!==edge){if(at<0)throw Error('Corrupt P1 incidence list');p=at;at=this.next[at];}if(p<0)this.head[region]=this.next[edge];else this.next[p]=this.next[edge];this.freeEdges.push(edge);this.mark(region);}
  this.allocations.delete(entry.token);this.entries[entry.slot]=null;this.freeAlloc.push(entry.slot);this.stats.retired++;
 }
 add(record,handle){
  const regions=this.compileRegions(record.block),slot=this.freeAlloc.length?this.freeAlloc.pop():this.allocEnd++;
  if(slot>=MAX_ALLOCS||this.edgeEnd+regions.length-this.freeEdges.length>MAX_EDGES)throw Error('P1 physical metadata capacity exceeded; no trimming');
  const entry={slot,token:record.token,id:this.id(record.block.id),record,handle,regions,edges:new Uint32Array(regions.length),active:record.status==='active',isDetail:record.block.tier==='detail',order:this.order};
  for(let index=0;index<regions.length;index++){const region=regions[index],edge=this.freeEdges.length?this.freeEdges.pop():this.edgeEnd++;entry.edges[index]=edge;this.edgeRegion[edge]=region;this.edgeOwner[edge]=slot;this.edgeIndex[edge]=index;this.next[edge]=this.head[region];this.head[region]=edge;this.mark(region);}
  this.entries[slot]=entry;this.allocations.set(record.token,entry);this.stats.compiledRegions+=regions.length;
 }
 sync(service,lifecycle){
  const started=performance.now(),context=service.current.get(lifecycle.providerId);
  if(this.context&&this.context!==context)throw Error('New resource generation requires a fresh P1 planner');
  this.context=context;this.stats.syncs++;this.order=0;const seen=new Set();
  for(const record of service.allocations.values()){
   this.order++;const handle=service.handle(record);if(record.context!==context||!service.prepared(handle))continue;
   seen.add(record.token);let entry=this.allocations.get(record.token);
   if(entry&&(entry.record.packet!==record.packet||entry.handle.slotGeneration!==handle.slotGeneration||entry.handle.requestGeneration!==handle.requestGeneration||entry.handle.slotStart!==handle.slotStart)){this.remove(entry);entry=null;}
   if(!entry)this.add(record,handle);
   else if(entry.active!==(record.status==='active')){entry.active=record.status==='active';for(const region of entry.regions)this.mark(region);}
   entry=this.allocations.get(record.token);entry.order=this.order;
  }
  for(const entry of this.allocations.values())if(!seen.has(entry.token))this.remove(entry);
  if(this.version!==lifecycle.version){
   const desired=lifecycle.requests;
   for(const [key,entry]of this.requests)if(!desired.has(key)){
    const target=entry.detail?this.detail:this.fallback;for(const region of entry.regions)if(target[region]===entry.id){if(!entry.detail)this.targetCount--;target[region]=0;this.mark(region);}this.requests.delete(key);this.stats.requestChanges++;
   }
   for(const request of desired.values())if(!this.requests.has(request.block.id)){
    const entry={id:this.id(request.block.id),detail:request.block.tier==='detail',regions:this.compileRegions(request.block)},target=entry.detail?this.detail:this.fallback;
    for(const region of entry.regions){if(target[region]&&target[region]!==entry.id)throw Error('Duplicate P1 requested coverage');if(!entry.detail&&!target[region])this.targetCount++;target[region]=entry.id;this.mark(region);}this.requests.set(request.block.id,entry);this.stats.requestChanges++;
   }
   this.version=lifecycle.version;
  }
  const dirtyRegions=this.queueLength;let winnerChanges=0,detailChanges=0;
  for(let n=0;n<this.queueLength;n++){
   const region=this.queue[n],wantedFallback=this.fallback[region],wantedDetail=this.detail[region],old=this.winner[region],oldEntry=this.entries[old];
   let winner=0,index=0,best=0,order=Infinity;
   if(wantedFallback)for(let edge=this.head[region];edge>=0;edge=this.next[edge]){
    const entry=this.entries[this.edgeOwner[edge]],preference=entry.id===wantedDetail?3:entry.id===wantedFallback?2:entry.active?1:0;
    if(preference>best||preference&&preference===best&&entry.order<order){winner=entry.slot;index=this.edgeIndex[edge];best=preference;order=entry.order;}
   }
   // Counts use the current typed winner tables; recomputed totals below avoid
   // depending on a released allocation object or an obsolete request.
   if(old!==winner||this.winnerIndex[region]!==index){winnerChanges++;this.winner[region]=winner;this.winnerIndex[region]=index;}
   const detail=winner&&this.entries[winner].isDetail?1:0;
   if(this.grid[region]!==detail){this.grid[region]=detail;const word=(region>>>8)*8+((region&255)>>>5),mask=1<<(region&31);if(detail)this.bits[word]|=mask;else this.bits[word]&=~mask;this.markSupport(region);detailChanges++;}
   this.dirty[region]=0;
  }
  this.queueLength=0;
  // Recompute only the 9x9 support centres affected by changed detailed cells.
  for(let n=0;n<this.supportLength;n++){const region=this.supportQueue[n],x=region&255,z=region>>>8;let complete=true;for(let dz=z-4;dz<=z+4&&complete;dz++)for(let dx=x-4;dx<=x+4;dx++)if(!this.grid[dz*256+dx]){complete=false;break;}this.support[region]=complete?1:0;this.supportDirty[region]=0;}
  this.supportLength=0;
  // Aggregate counts are a cheap numeric scan, with no per-region allocations.
  let ready=0,unreadyDetail=0;
  for(let i=0;i<CELLS;i++)if(this.fallback[i]){const winner=this.winner[i];if(winner)ready++;if(this.detail[i]&&(!winner||this.entries[winner].id!==this.detail[i]))unreadyDetail++;}
  this.readyCount=ready;this.unreadyDetail=unreadyDetail;
  this.stats.dirtyVisits+=dirtyRegions;this.stats.winnerChanges+=winnerChanges;this.stats.detailChanges+=detailChanges;
  const eligible=ready===this.targetCount||lifecycle.committed&&ready>0&&['records limit','detailedRecords limit','gpuSlots limit','slot fragmentation','queue/allocation limit','CPU credit limit'].includes(lifecycle.lastDenial);
  return {elapsedMs:performance.now()-started,dirtyRegions,winnerChanges,detailChanges,targetCount:this.targetCount,readyCount:ready,foregroundReady:ready===this.targetCount&&unreadyDetail===0,candidateEligible:!!eligible,backingBytes:this.backingBytes};
 }
 get backingBytes(){let total=0;for(const value of Object.values(this))if(ArrayBuffer.isView(value))total+=value.byteLength;for(const entry of this.allocations.values())total+=entry.regions.byteLength+entry.edges.byteLength;for(const entry of this.requests.values())total+=entry.regions.byteLength;return total;}
 compare(candidate){
  if(!candidate)return {candidateNull:true,readyCount:this.readyCount};
  let wrongOwner=0,wrongIndex=0,wrongSupport=0,extra=0,missing=0;
  for(let i=0;i<CELLS;i++){const actual=candidate.regions.get(i),slot=this.winner[i],entry=this.entries[slot];if(!actual&&slot){extra++;continue;}if(actual&&!slot){missing++;continue;}if(!actual)continue;
   if(actual.r.token!==entry.token)wrongOwner++;if(actual.index!==this.winnerIndex[i])wrongIndex++;
   const detailAvailable=candidate.assignments.get(actual.r.token).detailAvailable.has(actual.index);if(detailAvailable!==!!this.support[i])wrongSupport++;
  }
  return {candidateNull:false,wrongOwner,wrongIndex,wrongSupport,extra,missing,matched:!wrongOwner&&!wrongIndex&&!wrongSupport&&!extra&&!missing};
 }
}
const api={profile:'meadow-tile-planner-p1',revision:2,TilePlanner,limits:{cells:CELLS,allocations:MAX_ALLOCS,edges:MAX_EDGES,internedBlocks:8191},scope:'Compiled-table coverage shadow; revision 2 bounds interned block history; no GPU submission, service replacement or acceptance'};
root.SphereMeadowTilePlannerP1=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
