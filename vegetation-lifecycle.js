/* HR-04 frame-boundary coverage. Providers retain geographic/content ownership;
 * the controller never generates plants or changes terrain/collision support. */
(function(root){
'use strict';
const V=root.SphereVegetationService||(typeof require==='function'?require('./vegetation-service.js'):null);
const nativeForEach=Array.prototype.forEach;
const clock=()=>typeof performance==='undefined'?Date.now():performance.now(),regions=r=>r.block.regions||[r.block.chartBoundsMetres];
// Internal coverage identity only. Ordinary one-metre chart cells have an
// exact compact grid address; retain the original key for every other bound.
function key(b){const x=b[0],z=b[1];return b.length===4&&Number.isInteger(x)&&Number.isInteger(z)&&x>=-128&&x<128&&z>=-128&&z<128&&b[2]===x+1&&b[3]===z+1?(z+128)*256+x+128:b.join(',');}
const cacheFields=new Set(['x','z','size','offsetX','offsetZ','blockMetres','jobMetres','areaSteps','tier','priority']);
// Only ordinary own-data requests can skip normalization. In particular, the
// original spread must still run once: unrelated getters and symbols may have
// effects, and a proxy's actual spread values may differ from its descriptors.
function cacheEligible(input){if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)return false;for(const field of Reflect.ownKeys(input)){const descriptor=Object.getOwnPropertyDescriptor(input,field);if(typeof field!=='string'||!cacheFields.has(field)||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return false;}return Object.hasOwn(input,'x')&&Object.hasOwn(input,'z')&&Object.hasOwn(input,'blockMetres');}
// This object was just created by the local spread. Its properties are data
// properties, but its actual keys still need checking after a Proxy's spread.
function cacheSnapshotEligible(snapshot){return Reflect.ownKeys(snapshot).every(field=>typeof field==='string'&&cacheFields.has(field))&&Object.hasOwn(snapshot,'x')&&Object.hasOwn(snapshot,'z')&&Object.hasOwn(snapshot,'blockMetres');}
// Call only with the plain spread snapshot or the controller's normalized
// internal input. Checking primitives before serialization never calls toJSON.
function inputKey(input,tier){const values=[input.x,input.z,input.size??8,input.offsetX??0,input.offsetZ??0,input.blockMetres,input.jobMetres??input.blockMetres,input.areaSteps??16];if(values.some(value=>typeof value!=='number'||!Number.isFinite(value)))return null;return JSON.stringify([...values,tier]);}
class ProgressiveVegetation{
 constructor(service,providerId,{workerFactory,workerUrl,maxPending=service.limits.maxWorkers*2,maxPreparationMs=1.5,maxReferences=4096,footprintMetres=4,onError}={}){
  if(!service.current.has(providerId)||service.lifecycle)throw Error('Invalid progressive vegetation owner');
  service.providers.get(providerId).validateCoverage?.(service.current.get(providerId).value);
  if(!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>service.limits.maxQueue||!Number.isFinite(maxPreparationMs)||maxPreparationMs<=0||!Number.isSafeInteger(maxReferences)||maxReferences<1||!Number.isFinite(footprintMetres)||footprintMetres<4)throw Error('Invalid progressive preparation bounds');
  this.service=service;this.providerId=providerId;this.options={workerFactory,workerUrl,maxPending,maxPreparationMs,maxReferences,footprintMetres,onError};this.owner='vegetation-coverage:'+providerId;this.grid=new Uint8Array(256*256);this.gridBits=new Uint32Array(256*8);this.requests=new Map();this.requestByInput=new Map();this.target=new Map();this.failed=new Map();this.committed=null;this.pending=null;this.closed=false;this.version=0;this.serializedBytes=0;
  this.footprintRows=new Uint32Array(256*8);this.footprintBits=new Uint32Array(256*8);this.footprintCached=false;
  this.generatedDemand=null;this.generatedDemandCache=root.SphereVegetationSelection?.cpuCaches?.().generatedDemandKeys||null;
  this.stats={commits:0,partialCommits:0,sharedAllocations:0,failedPreparations:0,cancelledRequests:0,admissionDenied:0,splitJobs:0,compactedAllocations:0,coldWaitFrames:0,preparationFrames:0,maximumCombinedPreparationMs:0,reusedDemandRequests:0,normalizedDemandRequests:0};this.frame={};service.lifecycle=this;service.retainCpuOwner(this.owner,this.coverageBackingBytes);this.createPool();
 }
 createPool(){this.workerTotals??={};if(this.pool)for(const [k,v]of Object.entries(this.pool.stats))this.workerTotals[k]=(this.workerTotals[k]||0)+v;this.factoryFailed=false;const Pool=root.SphereVegetationWorkerPool?.VegetationWorkerPool||(typeof require==='function'?require('./vegetation-worker-pool.js').VegetationWorkerPool:null);this.pool=new Pool(this.service,{workerFactory:this.options.workerFactory,workerUrl:this.options.workerUrl,deferReceipts:true,onResult:(result,job)=>{if(!result.ok)this.fail(job,result.reason);},onError:(error,job)=>{if(!job)this.factoryFailed=true;this.fail(job,String(error));this.options.onError?.(error,job);}});}
 get workerInfo(){const stats={...this.workerTotals};for(const [k,v]of Object.entries(this.pool.stats))stats[k]=(stats[k]||0)+v;return {...stats,retainedReceipts:this.pool.receipts.length};}
 fail(job,reason){this.stats.failedPreparations++;this.admittedVersion=-1;if(job)this.failed.set(job.block.id,reason);}
 measurePreparation(action){const started=clock();try{return action();}finally{this.pendingPreparationMs=(this.pendingPreparationMs||0)+clock()-started;}}
 setDemand(demand={}){return this.measurePreparation(()=>this.updateDemand(demand));}
 updateDemand({fallback=[],detail=[]}={}){
  if(this.closed)throw Error('Progressive vegetation disposed');if(!Array.isArray(fallback)||!Array.isArray(detail)||fallback.length+detail.length>4096)throw Error('Invalid bounded coverage demand');
  const context=this.service.current.get(this.providerId),provider=this.service.providers.get(this.providerId),config=context.value,requests=new Map(),previous=this.requestGeneration===context.id?this.requestByInput:null;
  const previousOrder=this.requests.values();let unchanged=previous!==null&&this.requests.size===fallback.length+detail.length;
  for(const [tier,inputs]of [['clump',fallback],['detail',detail]])for(const input of inputs){const generatedKey=root.SphereVegetationSelection?.generatedDemandKey?.(input,tier)??null,eligible=generatedKey!==null||cacheEligible(input),supplied={...input,tier},cacheKey=generatedKey??(eligible&&cacheSnapshotEligible(supplied)?inputKey(supplied,tier):null),old=cacheKey===null?null:previous?.get(cacheKey),block=old?.block||V.immutable(provider.normalizeBlock(supplied,config));if(block.blockMetres!==1)throw Error('Coverage adapter requires canonical one-metre blocks');if(requests.has(block.id))throw Error('Duplicate coverage request');const priority=input.priority??(tier==='clump'?0:2);if(!Number.isSafeInteger(priority)||priority<0||priority>3)throw Error('Invalid coverage priority');const request=old&&old.priority===priority&&old.regionIds?old:{input:old?.input||{x:block.x,z:block.z,offsetX:block.offsetX,offsetZ:block.offsetZ,blockMetres:block.blockMetres,jobMetres:block.jobMetres,areaSteps:block.areaSteps,tier},block,priority,inputKey:cacheKey,regionIds:old?.regionIds||block.regions.map(key)};if(old)this.stats.reusedDemandRequests++;else this.stats.normalizedDemandRequests++;requests.set(block.id,request);if(previousOrder.next().value!==request)unchanged=false;}
  if(unchanged&&this.requestGeneration===this.service.current.get(this.providerId).id)return false;
  const serialized=JSON.stringify([...requests.values()].map(r=>({...r.input,priority:r.priority}))),bytes=new TextEncoder().encode(serialized).byteLength;if(requests.size>4096||bytes>524288)throw Error('Coverage metadata exceeds bound');
  if(serialized===this.serialized&&this.requestGeneration===this.service.current.get(this.providerId).id)return false;
  const target=new Map();for(const request of requests.values()){const {block,regionIds}=request;for(let i=0;i<block.regions.length;i++){const bounds=block.regions[i],id=regionIds[i];if(block.tier==='clump'){if(target.has(id))throw Error('Overlapping fallback ownership');target.set(id,{bounds,fallback:block.id,detail:null});}else{const region=target.get(id);if(!region||region.detail)throw Error('Detail requires unique fallback coverage');region.detail=block.id;}}}
  // Explicit metadata reservation, separately reported from the exact grid.
  // This allowance is not a claim of complete HR-07 object/worker attribution.
  this.service.retainCpuOwner(this.owner,this.coverageBackingBytes+bytes*8);this.serialized=serialized;this.serializedBytes=bytes;this.requestGeneration=context.id;this.requests=requests;this.refreshRequestIndex();this.orderedRequests=[...requests.values()].sort((a,b)=>a.priority-b.priority);this.target=target;this.version++;this.candidateCache=null;this.admittedVersion=-1;
  // Finish the bounded snapshot already being built. Replacing it on every
  // half-metre demand change starves reference commits during ordinary walking.
  // Its packets stay pinned until commit; readiness still compares the latest
  // demand version, and the following snapshot adopts the latest window.
  const pinned=new Set(this.pending?.handles.map(h=>h.reservationToken));
  for(const r of [...this.service.allocations.values()])if(r.provider.id===this.providerId&&!requests.has(r.block.id)&&!pinned.has(r.token)&&r.status!=='active'&&r.status!=='retired'){this.pool.cancel(r.token);this.stats.cancelledRequests++;}
  for(const id of [...this.failed.keys()])if(!requests.has(id))this.failed.delete(id);return true;
 }
 retryFailed(){return this.measurePreparation(()=>{this.failed.clear();this.factoryFailed=false;this.pool.factoryFailed=false;this.admittedVersion=-1;});}
 refreshRequestIndex(){this.requestByInput.clear();for(const request of this.requests.values())this.requestByInput.set(request.inputKey??inputKey(request.input,request.block.tier),request);}
 admit(){if(this.admittedVersion===this.version&&!this.factoryFailed)return;const context=this.service.current.get(this.providerId),existing=new Map();let pending=0,allAdmitted=true;for(const r of this.service.allocations.values()){if(['queued','preparing','cancelled'].includes(r.status))pending++;if(r.context===context&&!['cancelled','retired'].includes(r.status))existing.set(r.block.id,r);}
  this.blockedRequest=null;for(const request of this.orderedRequests||[]){const old=existing.get(request.block.id);if(old){if(old.status==='queued')this.service.prioritize(old.token,request.priority);continue;}if(this.failed.has(request.block.id))continue;if(pending>=this.options.maxPending){allAdmitted=false;break;}const result=this.service.reserve(this.providerId,request.input,{priority:request.priority});if(!result.ok){this.stats.admissionDenied++;this.lastDenial=result.reason;this.blockedRequest=request;allAdmitted=false;break;}pending++;}if(allAdmitted&&!this.factoryFailed){this.admittedVersion=this.version;this.lastDenial=null;}if(!this.factoryFailed)this.pool.pump();
 }
 recoverFragmentation(backend,budget){
  if(this.lastDenial!=='slot fragmentation'||!this.blockedRequest)return;
  // Never move an allocation with current/pending references or GPU readers.
  // Compaction copies only a bounded packet; unstaged packets move logically.
  const moves=this.service.compactGpuAllocations({maxRecords:4096,maxBytes:Math.min(budget.remaining,4096*backend.recordUploadStride)});
  if(moves.length){budget.remaining-=moves.reduce((n,m)=>n+m.physicalUploadBytes,0);this.stats.compactedAllocations+=moves.length;this.pending=null;this.candidateCache=null;this.candidateStamp=null;this.admittedVersion=-1;return;}
  const request=this.blockedRequest,size=request.block.jobMetres;if(size<=1)return;
  // Splitting changes storage rectangles only. The original 8 m sampler and
  // half-open root ownership generate identical packed plants in each child.
  const provider=this.service.providers.get(this.providerId),config=this.service.current.get(this.providerId).value,children=[];
  for(let z=0;z<size;z+=size/2)for(let x=0;x<size;x+=size/2){const input={...request.input,jobMetres:size/2,offsetX:request.block.offsetX+x,offsetZ:request.block.offsetZ+z},block=V.immutable(provider.normalizeBlock(input,config));children.push({input,block,priority:request.priority});}
  const requests=new Map(this.requests);requests.delete(request.block.id);for(const child of children)requests.set(child.block.id,child);
  const bytes=new TextEncoder().encode(JSON.stringify([...requests.values()].map(r=>({...r.input,priority:r.priority})))).byteLength;
  if(requests.size>4096||bytes>524288)return;
  try{this.service.retainCpuOwner(this.owner,this.coverageBackingBytes+bytes*8);}catch{return;}
  this.requests=requests;this.refreshRequestIndex();this.serializedBytes=bytes;this.orderedRequests=[...requests.values()].sort((a,b)=>a.priority-b.priority);
  for(const child of children)for(const bounds of child.block.regions){const region=this.target.get(key(bounds));region[request.block.tier==='clump'?'fallback':'detail']=child.block.id;}
  this.stats.splitJobs++;this.version++;this.pending=null;this.candidateCache=null;this.candidateStamp=null;backend.pendingSelection=null;this.admittedVersion=-1;
 }
 candidate(){const ready=new Map(),context=this.service.current.get(this.providerId);this.footprintCached=false;this.grid.fill(0);this.gridBits.fill(0);
  for(const r of this.service.allocations.values()){if(r.context!==context||!this.service.prepared(this.service.handle(r)))continue;const regionIds=this.requests.get(r.block.id)?.regionIds,boundsList=regions(r),each=boundsList.forEach;
   // Read the original method once. Foreign methods keep their original call,
   // receiver and callback behavior; the native path retains ToLength, sparse
   // HasProperty/Get order and the first winning insertion order.
   if(each!==nativeForEach){Reflect.apply(each,boundsList,[(bounds,index)=>{const id=regionIds?.[index]??key(bounds),wanted=this.target.get(id);if(!wanted)return;const preferred=r.block.id===wanted.detail?3:r.block.id===wanted.fallback?2:r.status==='active'?1:0;if(preferred&&preferred>(ready.get(id)?.preferred||0))ready.set(id,{r,index,bounds,preferred});}]);continue;}
   const numericLength=+boundsList.length,length=Number.isNaN(numericLength)||numericLength<=0?0:Math.min(Math.floor(numericLength),Number.MAX_SAFE_INTEGER);
   for(let index=0;index<length;index++){if(!(index in boundsList))continue;const bounds=boundsList[index],id=regionIds?.[index]??key(bounds),wanted=this.target.get(id);if(!wanted)continue;const preferred=r.block.id===wanted.detail?3:r.block.id===wanted.fallback?2:r.status==='active'?1:0;if(preferred&&preferred>(ready.get(id)?.preferred||0))ready.set(id,{r,index,bounds,preferred});}}
  // A changed window must be able to release allocations wholly outside its
  // demand before preparing every new edge. Keep all already supported overlap;
  // newly uncovered regions retain the provider's terrain fallback and cannot
  // report usable or foreground-ready coverage. Initial arrival still waits for
  // its complete coarse window.
  if(ready.size!==this.target.size&&(!this.committed||!ready.size||!['records limit','detailedRecords limit','gpuSlots limit','slot fragmentation','queue/allocation limit','CPU credit limit'].includes(this.lastDenial)))return null;
  for(const item of ready.values())if(item.r.block.tier==='detail'){const b=item.bounds,x=b[0]+128,z=b[1]+128;this.grid[z*256+x]=1;this.gridBits[z*8+(x>>>5)]|=1<<(x&31);}
  this.buildFootprintCache();const assignments=new Map(),handles=[],detailRegions=[];
  for(const [id,item]of ready){const {r,index,bounds}=item;let assignment=assignments.get(r.token);if(!assignment){assignment={selected:new Set(),detailAvailable:new Set()};assignments.set(r.token,assignment);handles.push(this.service.handle(r));}assignment.selected.add(index);
   // Numeric IDs were validated from these exact canonical one-metre bounds.
   // Use that already established address; foreign bounds keep the old test.
   const supported=this.footprintCached&&typeof id==='number'?!!(this.footprintBits[id>>>5]&(1<<(id&31))):this.footprintReady(bounds);if(supported)assignment.detailAvailable.add(index);if(r.block.tier==='detail')detailRegions.push(id);}
  let foregroundReady=ready.size===this.target.size;if(foregroundReady)for(const [id,r]of this.target)if(r.detail&&ready.get(id)?.r.block.id!==r.detail){foregroundReady=false;break;}
  return {version:this.version,handles,assignments,regions:ready,detailRegions,foregroundReady,requestedRegions:this.target.size};
 }
 get coverageBackingBytes(){return this.closed?0:this.grid.byteLength+this.gridBits.byteLength+this.footprintRows.byteLength+this.footprintBits.byteLength;}
 buildFootprintCache(){
  this.footprintCached=false;if(this.options.footprintMetres!==4)return;
  // Exact 9 by 9 erosion of the existing one-metre grid. Missing chart cells
  // are zero, including neighbouring words and rows beyond the chart edge.
  for(let z=0;z<256;z++)for(let word=0;word<8;word++){const at=z*8+word,current=this.gridBits[at],left=word?this.gridBits[at-1]:0,right=word<7?this.gridBits[at+1]:0;let bits=current;for(let shift=1;shift<=4;shift++){bits&=(current>>>shift)|(right<<(32-shift));bits&=(current<<shift)|(left>>>(32-shift));}this.footprintRows[at]=bits;}
  this.footprintBits.fill(0);for(let z=4;z<252;z++)for(let word=0;word<8;word++){let bits=0xffffffff;for(let row=z-4;row<=z+4;row++)bits&=this.footprintRows[row*8+word];this.footprintBits[z*8+word]=bits;}
  this.footprintCached=true;
 }
 footprintReady(b){const pad=this.options.footprintMetres;if(this.footprintCached&&pad===4&&typeof key(b)==='number'){const x=b[0]+128,z=b[1]+128;return !!(this.footprintBits[z*8+(x>>>5)]&(1<<(x&31)));}const x0=Math.floor(b[0]-pad)+128,z0=Math.floor(b[1]-pad)+128,x1=Math.ceil(b[2]+pad)+128,z1=Math.ceil(b[3]+pad)+128;if(x0<0||z0<0||x1>256||z1>256)return false;const first=x0>>>5,last=(x1-1)>>>5;for(let z=z0;z<z1;z++)for(let word=first;word<=last;word++){const lo=word===first?x0&31:0,hi=word===last?((x1-1)&31)+1:32,mask=((0xffffffff<<lo)&(0xffffffff>>>(32-hi)))>>>0;if((this.gridBits[z*8+word]&mask)>>>0!==mask)return false;}return true;}
 prepare(backend,budget,prototypes,camera,ensurePrototypes){
  const started=clock(),callbackPreparationMs=this.pool.callbackPreparationMs,externalPreparationMs=this.pendingPreparationMs||0,deadline=started+Math.max(0,this.options.maxPreparationMs-callbackPreparationMs-externalPreparationMs);this.pool.callbackPreparationMs=0;this.pendingPreparationMs=0;this.frame={startedAt:started,receiptCpuMs:0,callbackPreparationMs,externalPreparationMs,committed:false,coldWait:false};backend.pollFences();this.service.collectRetired();
  if(camera.demandConflict){this.frame.demandConflict=camera.demandConflict;return {active:this.committed?.handles||[],referencesReady:!!this.committed,complete:false};}
  const receiptStarted=clock();this.pool.drain({maxResults:1});this.frame.receiptCpuMs=clock()-receiptStarted;this.admit();this.recoverFragmentation(backend,budget);
  let staged=null;const context=this.service.current.get(this.providerId);for(const r of this.service.allocations.values())if(r.context===context&&r.status==='CPU ready'&&(!staged||r.priority<staged.priority))staged=r;
  // Receipt validation and packet staging are individually bounded operations.
  // Leave room for a full staging operation instead of starting it just before
  // the deadline after a heavy receipt. Neither cost is removed from timing.
  if(staged&&(camera.productionSelection||clock()<deadline-Math.min(1,this.options.maxPreparationMs*2/3))){const r=staged;try{this.service.stageGpu(this.service.handle(r),budget);}catch(error){this.fail({block:r.block},String(error));this.pool.cancel(r.token);}}
  if(!this.pending){const stamp=this.version+':'+backend.totals.stageCompletions;if(this.candidateStamp!==stamp&&(camera.productionSelection||clock()<deadline)){this.candidateCache=this.candidate();this.candidateStamp=stamp;}if(this.candidateStamp===stamp&&this.candidateCache)this.pending={...this.candidateCache};}
  const candidate=this.pending;
  if(candidate&&backend.prepareSelection(camera,budget)){const viewKey=camera.productionSelection?root.SphereVegetationSelection.createView(camera).key:null;
   if(!candidate.plan||camera.productionSelection&&candidate.plan.query?.key!==viewKey&&(!backend.pendingSelection||backend.pendingSelection.blocked)){candidate.plan=backend.plan(candidate.handles,prototypes,camera.productionSelection?camera:{...camera,culling:false},{staged:true,coverage:candidate.assignments});if(this.candidateCache?.version===candidate.version)this.candidateCache.plan=candidate.plan;}
   if(candidate.plan.key===backend.selectionKey&&this.committed?.version===candidate.version){this.pending=null;backend.pendingSelection=null;backend.lastConflict=null;this.frame.stationaryReferenceReuse=true;return {active:this.committed.handles,referencesReady:true,complete:this.committed.foregroundReady};}
   // The geographic transaction is stable while references upload. View changes
   // are planned again after commit; a conservative uncropped plan prevents a
   // turn during staging from exposing an unsubmitted part of explicit coverage.
   // Production selection finishes its bounded snapshot without starving on
   // continuous movement, then schedules the current view. Readiness records
   // the view lag separately; submitted density is never trimmed to a cap.
   if(ensurePrototypes(candidate.plan,budget)&&backend.select(candidate.plan,budget,{maxReferences:this.options.maxReferences,deadline})){
    if(!this.service.commit(candidate.handles))throw Error('Coverage committed without complete GPU references');
    const changed=!this.committed||this.committed.version!==candidate.version||this.committed.plan.key!==candidate.plan.key;if(changed){const previous=new Set(this.committed?.handles.map(h=>h.reservationToken));for(const h of candidate.handles)if(previous.has(h.reservationToken))this.stats.sharedAllocations++;this.stats.commits++;if(!candidate.foregroundReady)this.stats.partialCommits++;this.frame.committed=true;}this.committed=candidate;this.pending=null;
    const used=new Set(candidate.handles.map(h=>h.reservationToken));for(const r of [...this.service.allocations.values()])if(r.provider.id===this.providerId&&r.status==='active'&&!used.has(r.token)&&!this.requests.has(r.block.id))this.service.retire(this.service.handle(r));
   }
  }else if(!this.committed||this.committed.version!==this.version){this.stats.coldWaitFrames++;this.frame.coldWait=true;}
  const viewReady=camera.productionSelection?this.committed?.plan.query?.key===root.SphereVegetationSelection.createView(camera).key:!!this.committed&&!this.committed.plan.query;
  this.frame.viewReady=viewReady;this.frame.selectionConflict=backend.lastConflict||null;
  return {active:this.committed?.handles||[],referencesReady:!!this.committed,complete:!!this.committed&&this.committed.version===this.version&&this.committed.foregroundReady&&viewReady&&!backend.lastConflict};
 }
 finishPreparation(ms){ms+=(this.frame.callbackPreparationMs||0)+(this.frame.externalPreparationMs||0);this.frame.combinedPreparationMs=ms;this.stats.preparationFrames++;this.stats.maximumCombinedPreparationMs=Math.max(this.stats.maximumCombinedPreparationMs,ms);return ms;}
 reconfigure(state,options={}){return this.measurePreparation(()=>this.updateConfiguration(state,options));}
 updateConfiguration(state,{sceneKey=this.service.sceneKey}={}){this.pool.dispose();this.service.setScene(sceneKey);this.service.configure(this.providerId,state);this.requests.clear();this.requestByInput.clear();this.orderedRequests=[];this.target.clear();this.failed.clear();this.committed=null;this.pending=null;this.candidateCache=null;this.generatedDemand=null;this.admittedVersion=-1;this.serialized=null;this.serializedBytes=0;this.grid.fill(0);this.gridBits.fill(0);this.footprintRows.fill(0);this.footprintBits.fill(0);this.footprintCached=false;this.version++;this.service.retainCpuOwner(this.owner,this.coverageBackingBytes);this.createPool();}
 get info(){const committed=this.committed,states={requested:0,preparing:0,'CPU ready':0,'GPU staged':0,active:0,retired:0,cancelled:0};for(const r of this.service.allocations.values())if(r.provider.id===this.providerId)states[r.status==='queued'?'requested':r.status]++;
  const activatedRegions=committed?[...committed.assignments.values()].reduce((n,a)=>n+a.selected.size,0):0;return {revision:1,states,requestedRegions:this.target.size,committedRegions:committed?.regions.size||0,detailedRegions:committed?.detailRegions.length||0,foregroundReady:!!committed&&committed.version===this.version&&committed.foregroundReady,usableCoverage:!!committed&&committed.version===this.version&&committed.regions.size===this.target.size,uncoveredCommittedRegions:committed?committed.requestedRegions-committed.regions.size:0,duplicateActivatedRegions:committed?activatedRegions-committed.regions.size:0,footprintGuardMetres:this.options.footprintMetres,gridBackingBytes:this.closed?0:this.grid.byteLength,footprintBackingBytes:this.closed?0:this.gridBits.byteLength+this.footprintRows.byteLength+this.footprintBits.byteLength,footprintCacheBackingBytes:this.closed?0:this.footprintRows.byteLength+this.footprintBits.byteLength,metadataSerializedBytes:this.serializedBytes,metadataReservationBytes:this.serializedBytes*8,failedBlocks:[...this.failed].map(([block,reason])=>({block,reason})),frame:{...this.frame},stats:{...this.stats},worker:this.workerInfo,lastAdmissionDenial:this.lastDenial||null,terrainSupport:'Independent; unchanged',cpuAttribution:'OWNERSHIP INVENTORY COMPLETE; heap bound measured outside frame timing'};
 }
 dispose(){if(this.closed)return;this.pool.dispose();for(const r of [...this.service.allocations.values()])if(r.provider.id===this.providerId)this.service.cancel(r.token);this.service.releaseCpuOwner(this.owner);this.grid=null;this.gridBits=null;this.footprintRows=null;this.footprintBits=null;this.footprintCached=false;this.serialized=null;this.serializedBytes=0;this.requests.clear();this.requestByInput.clear();this.target.clear();this.failed.clear();this.committed=null;this.pending=null;this.candidateCache=null;this.generatedDemand=null;this.generatedDemandCache=null;this.blockedRequest=null;this.orderedRequests=[];this.service.lifecycle=null;this.closed=true;}
}
const api={REVISION:2,ProgressiveVegetation};root.SphereVegetationLifecycle=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
