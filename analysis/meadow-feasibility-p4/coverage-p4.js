/* Isolated P4: resumable receipt work, deadline-aware reference quanta and
 * conservative view envelopes. Current render pose, packed plants, shader
 * rank, support, resource credits and upload/fence ownership are preserved. */
(function(root){'use strict';
const V=root.SphereVegetationService,S=root.SphereVegetationSelection,M=root.SphereMath;
const now=()=>performance.now(),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(a,b))));
function envelope(camera,zeroRanks){
 const native=S.createView(camera,zeroRanks),position=camera.relativeOrigin.slice(),f=camera.basis.f.slice(),r=camera.basis.r.slice(),u=camera.basis.u.slice(),tan=Math.tan(camera.fov*Math.PI/360),vt=Math.tan(Math.atan(tan/camera.aspect)+10*Math.PI/180),ht=Math.tan(Math.min(Math.PI/2-Math.PI/360,camera.fov*Math.PI/360+S.TURN_GUARD_RADIANS)),pad=.001;
 const planes=[f,...[1,-1].map(sign=>f.map((v,k)=>v*ht+sign*r[k])),...[1,-1].map(sign=>f.map((v,k)=>v*vt+sign*u[k]))].map(p=>{const n=Math.hypot(...p);return p.map(v=>v/n);});
 const scale=native.scale,error=S.LOD_ERROR_KM, distance=p=>Math.hypot(...p.map((v,k)=>v-position[k]))*scale;
 const query={...native,key:'p4-envelope-v2:'+native.key,planes,position,marginMetres:pad*1000,verticalGuardDegrees:10,
  sphere(center,radius){if(camera.culling===false)return 1;let inside=true;const d=center.map((v,k)=>v-position[k]);for(const p of planes){const v=dot(p,d);if(v+radius+pad<0)return -1;if(v-radius+pad<0)inside=false;}return inside?1:0;},distance,
  classify(bounds,tier,detailAvailable,visibility){visibility??=this.sphere(bounds.center,bounds.radius);if(visibility<0)return -1;const d=distance(bounds.center),radius=bounds.radius*scale,lo=Math.max(0,d-radius),hi=d+radius,p=pad*scale;
   if(tier==='detail'){if(lo>.020+p+error)return zeroRanks?.detailCount?0:-1;return visibility===1&&hi<.020+p-error?1:0;}
   if(lo>.072+p+error||detailAvailable&&hi<.012-p-error)return zeroRanks?.coarseCount?0:-1;return visibility===1&&hi<.072+p-error&&(!detailAvailable||lo>.012-p+error)?1:0;
  },
  accepts(view,record,tier,detailAvailable){const base=record*32,d=[view.getFloat32(base,true)-position[0],view.getFloat32(base+4,true)-position[1],view.getFloat32(base+8,true)-position[2]],dist=Math.hypot(...d)*scale,p=pad*scale;
   const contributes=tier==='detail'?dist<=.020+p+error:dist<=.072+p+error&&(!detailAvailable||dist>=.012-p-error);
   if(!contributes&&!(zeroRanks?.mask[view.getUint16(base+30,true)]&(tier==='detail'?1:2)))return false;if(camera.culling!==false)for(const plane of planes)if(dot(plane,d)+S.ENVELOPE_KM+pad<0)return false;return true;
  },
  validity(current){const moved=Math.hypot(...current.relativeOrigin.map((v,k)=>v-position[k])),same=current.fov===camera.fov&&current.aspect===camera.aspect&&current.internalWidth===camera.internalWidth&&current.culling===camera.culling;
   const rays=[];for(const x of [-1,1])for(const y of [-1,1])rays.push(current.basis.f.map((v,k)=>v+x*current.basis.r[k]*tan+y*current.basis.u[k]*tan/current.aspect));
   const minimumRayDot=Math.min(...planes.flatMap(p=>rays.map(ray=>dot(p,ray)))),e=S.ENVELOPE_KM,tx=e*(Math.sqrt(1+tan*tan)-tan),ty=e*(Math.sqrt(1+(tan/current.aspect)**2)-tan/current.aspect),delta=current.relativeOrigin.map((v,k)=>v-position[k]),near=[];
   for(const x of [-1,1])for(const y of [-1,1])near.push(delta.map((v,k)=>v-e*current.basis.f[k]+x*tx*current.basis.r[k]+y*ty*current.basis.u[k]));const minimumNearDot=Math.min(...planes.flatMap(p=>near.map(v=>dot(p,v))));
   // A clipped, expanded frustum has these four near vertices and four
   // unbounded corner rays. Containment checks both; a key match is insufficient.
   const frustumContained=current.culling===false||minimumRayDot>=1e-9&&minimumNearDot>=-e-pad+1e-9;
   return {valid:same&&moved<=pad-1e-9&&frustumContained,movedMetres:moved*1000,minimumRayDot,minimumNearDot,sameLens:same,forwardTurnDegrees:angle(f,current.basis.f)*180/Math.PI,upTurnDegrees:angle(u,current.basis.u)*180/Math.PI};
  },
 };
 return query;
}
class Controller extends root.SphereMeadowSubmissionP3.Controller{
 constructor(renderer){super(renderer);this.budgetMs=2;this.variant='exact';this.tasks=new Map();this.latestEnvelope=null;this.statsP4={receiptSlices:0,receiptChecks:0,receiptMismatches:0,completedReceipts:0,envelopes:0,coverageChecks:0,viewReuse:0,maximumReceiptSliceMs:0,referenceSlices:0};const owner=this,L=this.lifecycle,B=this.backend;
  this.originalPrepare=L.prepare;L.prepare=function(...args){return owner.enabled?owner.prepare(...args):owner.originalPrepare.apply(this,args);};
  this.originalDrain=L.pool.drain;L.pool.drain=function(options){return owner.enabled?owner.drain(options):owner.originalDrain.call(this,options);};
  this.originalSelectProgressive=B.selectProgressive;
  // Preserve the original bank transaction. Remove mandatory over-budget work,
  // and make the inner record/filter/compare loop check time every 256 records.
  let source=B.selectProgressive.toString().replace('selectProgressive(','function(').replace('Math.min(65536,maxReferences):0','0:0').replace('range.count-pending.instance,maxReferences-work','range.count-pending.instance,maxReferences-work,256').replace('pending.count,start+maxReferences-work,start+Math.floor(budget.remaining/4)','pending.count,start+maxReferences-work,start+Math.floor(budget.remaining/4),start+256');
  const sliced=Function('integer','DETAIL_BIT','root','return ('+source+');')((v,name,min=0)=>{if(!Number.isSafeInteger(v)||v<min)throw Error('Invalid '+name);return v;},0x80000000,root);
  B.selectProgressive=function(...args){owner.statsP4.referenceSlices++;if(owner.enabled&&args[0].p4Incomplete)return false;return owner.enabled?sliced.apply(this,args):owner.originalSelectProgressive.apply(this,args);};
  this.stageTasks=new Map();this.originalStage=B.stage;const stageBody=B.stage.toString().replace('stage(', 'function(').replace("if(this.progressive&&V.packetHash(packet)!==packet.contentHash)throw Error('Corrupt packet before GPU staging');",'');
  const stageVerified=Function('integer','sameLifetime','GPU_RECORD_BYTES','return ('+stageBody+');')((v,name,min=0)=>{if(!Number.isSafeInteger(v)||v<min)throw Error('Invalid '+name);return v;},(a,b)=>a.reservationToken===b.reservationToken&&a.slotStart===b.slotStart&&a.slotGeneration===b.slotGeneration&&a.requestGeneration===b.requestGeneration&&a.sceneKey===b.sceneKey&&a.providerId===b.providerId,40);
  B.stage=function(handle,packet,budget){if(!owner.enabled||this.staged.has(handle.reservationToken))return owner.originalStage.call(this,handle,packet,budget);let task=owner.stageTasks.get(handle.reservationToken);if(!task||task.packet!==packet){task={packet,iterator:root.SphereMeadowResumableP4.packetHashSteps(packet)};owner.stageTasks.set(handle.reservationToken,task);}if(!this.valid(handle))throw Error('Obsolete GPU staging handle');while(now()<owner.stageDeadline){const step=task.iterator.next();owner.statsP4.stageHashSlices=(owner.statsP4.stageHashSlices||0)+1;if(!step.done)continue;owner.stageTasks.delete(handle.reservationToken);if(step.value!==packet.contentHash)throw Error('Corrupt packet before GPU staging');owner.statsP4.stageHashChecks=(owner.statsP4.stageHashChecks||0)+1;return stageVerified.call(this,handle,packet,budget);}return false;};
  // The existing ordered plan is resumed across frames. Pending candidate
  // handles remain pinned by the native lifecycle for the whole transaction.
  const planBody=root.SphereMeadowSubmissionP3.Controller.prototype.plan.toString().replace('plan(', 'function*(').replace('for(const handle of handles){','for(const handle of handles){yield {phase:"plan-packet"};').replace('for(let r=0;r<packet.regions.length;r++){','for(let r=0;r<packet.regions.length;r++){if((r&7)===0)yield {phase:"plan-region"};');
  this.planSteps=Function('V','S','E','life','planProjection','return ('+planBody+');')(V,S,root.SphereInstancedEnvironment,h=>[h.reservationToken,h.slotStart,h.slotGeneration,h.requestGeneration,h.sceneKey].join('|'),()=>{throw Error('Use separate P4 oracle');});
  this.service.cpuInventory.retain('meadow-p4-resumable',this,{lifetime:'isolated controller',release:'owned renderer disposal'});this.service.retainCpuOwner('meadow-p4-resumable-core',8192);
  this.demandCache=new Map();this.registeredDemands=new WeakSet();this.originalDemand=S.demand;const manager=renderer.meadow,request=manager.requestProduction,update=L.updateDemand;
  manager.requestProduction=function(state,options){if(!owner.enabled||!owner.variant.startsWith('geographic'))return request.call(this,state,options);const original=S.demand;S.demand=(...args)=>owner.geographicDemand(...args);try{return request.call(this,state,options);}finally{S.demand=original;}};
  L.updateDemand=function(demand){if(owner.enabled&&owner.registeredDemands.has(demand)&&owner.lastAppliedDemand===demand&&owner.lastAppliedSplit===this.stats.splitJobs)return false;const result=update.call(this,demand);if(owner.registeredDemands.has(demand)){owner.lastAppliedDemand=demand;owner.lastAppliedSplit=this.stats.splitJobs;}return result;};
  this.service.retainCpuOwner('meadow-p4-geographic-cache',0);
 }
 select(enabled,{audit=false,budgetMs=2,variant='exact'}={}){super.select(enabled,{audit:false,variant:'typed'});this.auditP4=audit;this.budgetMs=budgetMs;this.variant=variant;if(![2,4,6].includes(budgetMs))throw Error('P4 requires declared budget arm');this.lifecycle.options.maxPreparationMs=Math.max(.25,budgetMs-.5);this.lifecycle.options.maxPending=variant==='parallel'||variant.startsWith('geographic')?3:1;}
 geographicDemand(state,local,width,options={}){const native=this.originalDemand(state,local,width,{...options,previous:this.nativeRequiredDemand,immutableInputs:true});this.nativeRequiredDemand=native;this.requiredCache??=new Map();let required=this.requiredCache.get(native.key);if(!required){const mask=new Uint8Array(65536),list=[];for(const tier of ['fallback','detail'])for(const q of native[tier]){const x=-128+q.x*8+q.offsetX,z=-128+q.z*8+q.offsetZ;for(let dz=0;dz<q.jobMetres;dz++)for(let dx=0;dx<q.jobMetres;dx++){const id=(z+dz+128)*256+x+dx+128;if(!mask[id])list.push(id);mask[id]|=tier==='detail'?2:1;}}required={key:native.key,mask,ids:Uint16Array.from(list),size:list.length};this.requiredCache.set(native.key,required);while(this.requiredCache.size>4)this.requiredCache.delete(this.requiredCache.keys().next().value);}this.requiredTarget=required;this.service.retainCpuOwner('meadow-p4-required-cache',[...this.requiredCache.values()].reduce((n,t)=>n+t.mask.byteLength+t.ids.byteLength,0));const scale=Math.tan(state.fov*Math.PI/360)/.83909963*1920/width,axes=[0,2].map(axis=>{const boundary=Math.round(local[axis]*2000)/2000;return Math.abs(local[axis]-boundary)<1e-7?[boundary-1e-7,boundary+1e-7]:[local[axis]];}),positions=axes[0].flatMap(x=>axes[1].map(z=>[x,z])),keys=positions.map(([x,z])=>JSON.stringify([[Math.floor(x*2000),Math.floor(z*2000)],scale])),key='p4-geographic-union:'+keys.sort().join('|');
  if(this.demandSplit!==this.lifecycle.stats.splitJobs){this.demandCache.clear();this.demandSplit=this.lifecycle.stats.splitJobs;}
  if(this.demandCache.has(key))return this.demandCache.get(key);
  const sources=positions.map(([x,z])=>this.originalDemand(state,[x,local[1],z],width,options));if(sources.some(d=>d.conflict))return sources.find(d=>d.conflict);
  const id=i=>JSON.stringify([i.x,i.z,i.offsetX,i.offsetZ,i.jobMetres]),order=i=>(i.z*8+i.offsetZ)*256+i.x*8+i.offsetX,merge=tier=>{const items=new Map();for(const source of sources)for(const input of source[tier]){const old=items.get(id(input));if(!old||input.priority<old.priority)items.set(id(input),input);}return Object.freeze([...items.values()].sort((a,b)=>order(a)-order(b)));};
  const result=Object.freeze({...sources[0],fallback:merge('fallback'),detail:merge('detail'),key,sourceKeys:sources.map(d=>d.key),supersetPolicy:'Exact union of adjacent native half-metre windows on each horizontal axis only within 0.1 mm of a shared boundary; actual camera and all packed roots unchanged'});this.registeredDemands.add(result);this.demandCache.set(key,result);while(this.demandCache.size>4)this.demandCache.delete(this.demandCache.keys().next().value);
  this.service.retainCpuOwner('meadow-p4-geographic-cache',[...this.demandCache.values()].reduce((n,d)=>n+(d.fallback.length+d.detail.length)*256,0));return result;
 }
 plan(handles,prototypes,camera,options={}){if(!this.enabled)return super.plan(handles,prototypes,camera,options);
  if(this.planTask&&this.planTask.handles!==handles)this.planTask=null;if(!this.planTask)this.planTask={handles,query:this.latestEnvelope,iterator:this.planSteps.call(this,handles,prototypes,camera,options)};const task=this.planTask;
  while(now()<this.planDeadline){const step=task.iterator.next();if(!step.done)continue;this.planTask=null;return step.value;}
  return {p4Incomplete:true,commands:[],handles,key:'p4-incomplete-plan',query:null,visible:0,culled:0};
 }
 shadowReceipt(job,packet){const s=this.service,r=s.allocations.get(job.reservationToken),copy=Object.assign(Object.create(Object.getPrototypeOf(s)),s,{allocations:new Map([[r.token,{...r,credit:{...r.credit}}]]),usage:{...s.usage},peaks:{...s.peaks},counters:{...s.counters},timings:{...s.timings},queue:s.queue.slice(),gpuBackend:null,allocator:Object.assign(Object.create(Object.getPrototypeOf(s.allocator)),s.allocator,{free:s.allocator.free.map(r=>({...r})),live:new Map(s.allocator.live)})});return V.VegetationService.prototype.receive.call(copy,job,structuredClone(packet));}
 createTask(receipt){const {entry}=receipt,job=entry.busy;let packet=receipt.data,metrics=null;
  if(packet.kind==='vegetation-result'){const allowed=['compactRevision','visitedCandidates','roots','records','stagingBytes','selectorBytes','outputBytes','hashScratchBytes','peakTypedBytes','retainedPlacementObjects','regionCount','cacheEntries','cacheHits','cacheMisses','cacheEvictions','generationMs'];if(!packet.metrics||Object.keys(packet.metrics).some(k=>!allowed.includes(k)||!Number.isFinite(packet.metrics[k])||packet.metrics[k]<0))throw Error('Malformed compact worker metrics');metrics={...packet.metrics,workerPrepareMs:packet.packet?.prepareMs};packet=packet.packet;}
  const oracle=this.auditP4?this.shadowReceipt(job,packet):null,bytes=packet.records?.byteLength||0;return {entry,receipt,job,packet,bytes,metrics,oracle,iterator:root.SphereMeadowResumableP4.receiveSteps.call(this.service,job,packet),cpuMs:0};
 }
 drain(){const pool=this.lifecycle.pool,deadline=this.receiptDeadline;let finished=0;
  for(const [entry,task]of this.tasks)if(!pool.workers.includes(entry)||entry.busy!==task.job||entry.receipt!==task.receipt)this.tasks.delete(entry);
  while(now()<deadline){let task=this.tasks.values().next().value;
   if(!task){const receipt=pool.receipts.shift();if(!receipt)break;if(!pool.workers.includes(receipt.entry)||!receipt.entry.busy)continue;try{task=this.createTask(receipt);this.tasks.set(task.entry,task);}catch(e){pool.fail(receipt.entry,e);continue;}}
   const started=now();let step;try{step=task.iterator.next();}catch(e){this.tasks.delete(task.entry);pool.fail(task.entry,e);continue;}const ms=now()-started;task.cpuMs+=ms;this.statsP4.receiptSlices++;this.statsP4.maximumReceiptSliceMs=Math.max(this.statsP4.maximumReceiptSliceMs,ms);task.phase=step.value?.phase;
   if(!step.done)continue;const result=step.value;this.tasks.delete(task.entry);task.entry.receipt=null;
   if(this.auditP4){this.statsP4.receiptChecks++;if(JSON.stringify(result)!==JSON.stringify(task.oracle)){this.statsP4.receiptMismatches++;throw Error('P4 resumed receipt differs from native oracle');}}
   if(!result.ok)pool.stats.discardedBytes+=task.bytes;pool.stats.maximumReceivedPacketBytes=Math.max(pool.stats.maximumReceivedPacketBytes||0,task.bytes);if(task.metrics)task.metrics.dispatchToReadyMs=now()-task.entry.startedAt;task.entry.busy=null;pool.options.onResult?.(result,task.job,task.metrics);pool.stats.receiptValidationMs+=task.cpuMs;pool.pump();finished++;this.statsP4.completedReceipts++;
  }
  return finished;
 }
 geographicProof(){const L=this.lifecycle,c=L.committed,target=this.variant.startsWith('geographic')?this.requiredTarget||L.target:L.target;if(!c)return {complete:false,missingRegions:target.size,missingDetailedRegions:0};if(this.proofCommitted===c&&this.proofTarget===target)return this.lastGeographicProof;let missingRegions=0,missingDetailedRegions=0;
  const visit=(id,detail)=>{const item=c.regions.get(id);if(!item){missingRegions++;if(detail)missingDetailedRegions++;}else if(detail&&item.r.block.tier!=='detail')missingDetailedRegions++;};if(target.ids)for(const id of target.ids)visit(id,!!(target.mask[id]&2));else for(const [id,wanted]of target)visit(id,!!wanted.detail);
  this.statsP4.coverageChecks++;this.proofCommitted=c;this.proofTarget=target;return this.lastGeographicProof={complete:missingRegions===0&&missingDetailedRegions===0,missingRegions,missingDetailedRegions,requestedRegions:target.size,committedRegions:c.regions.size,currentRequiredKey:target.key||null,supersetRequestedRegions:L.target.size,supersetForegroundReady:L.info.foregroundReady,proof:'Every cell in the exact current native demand has committed canonical records; every current native detail cell has committed detailed records. Extra buffer readiness is separate.'};
 }
 prepare(backend,budget,prototypes,camera,ensurePrototypes){const started=now(),L=this.lifecycle;this.receiptDeadline=started+Math.max(0,(this.budgetMs-.5)*.4-(L.pendingPreparationMs||0)-(L.pool.callbackPreparationMs||0));this.stageDeadline=started+Math.max(0,(this.budgetMs-.5)*.65-(L.pendingPreparationMs||0)-(L.pool.callbackPreparationMs||0));this.planDeadline=started+Math.max(0,this.budgetMs-.5-(L.pendingPreparationMs||0)-(L.pool.callbackPreparationMs||0));
  for(const [token]of this.stageTasks)if(!this.service.allocations.has(token))this.stageTasks.delete(token);
  const validity=this.latestEnvelope?.validity(camera);if(!this.latestEnvelope||!validity.valid||validity.movedMetres>.3||validity.forwardTurnDegrees>4||validity.upTurnDegrees>2){this.latestEnvelope=envelope(camera,backend.zeroRanks);this.statsP4.envelopes++;}
  const selected=this.planTask?.query||this.latestEnvelope,originalView=S.createView;S.createView=()=>selected;let result;try{result=this.originalPrepare.call(L,backend,budget,prototypes,camera,ensurePrototypes);}finally{S.createView=originalView;}
  const actual=L.committed?.plan.query,proof=actual?.validity?.(camera)||{valid:false},geographic=this.geographicProof();L.frame.exactSnapshotViewReady=L.frame.viewReady===true||L.frame.stationaryReferenceReuse===true;L.frame.nativeVersionReady=L.committed?.version===L.version;L.frame.viewEnvelopeProof=proof;L.frame.geographicProof=geographic;L.frame.viewReady=proof.valid;if(proof.valid)this.statsP4.viewReuse++;result.complete=!!result.referencesReady&&proof.valid&&geographic.complete&&!backend.lastConflict;return result;
 }
 get info(){return {...super.info,profile:'meadow-feasibility-p4',budgetMs:this.budgetMs,variant:this.variant,statsP4:this.statsP4,receiptTasks:this.tasks.size,receiptPhases:[...this.tasks.values()].map(t=>({phase:t.phase,block:t.job.block.id,bytes:t.bytes})),geographicCacheWindows:this.demandCache.size,latestGeographicProof:this.lastGeographicProof||null,scope:'Resumable native receipt checks and SHA; bounded reference quanta; conservative render-frustum containment proof and current geographic target containment. Geographic variant is a declared native demand superset. Isolated prototype, not acceptance.'};}
}
root.SphereMeadowCoverageP4={Controller,envelope};
})(window);
