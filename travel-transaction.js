/* One serialized owner of destination resources and scene commits. */
(function(root){
'use strict';
const dependencies=['radius','starRadius','layoutVersion','collection','axisLat','axisLon','waistWidth','transitionKm','era','seed','biome','regionOrder','breachEnabled','breachLat','breachLon','breachDiameter','breachRoughness','multipleWounds','shellThickness','shadeEnabled','shadeAltitude','shadeDiameter','shadeOffset','shadeSpeed','shadeDamage','routeShades','shadeShape','shadeTrim','cycleScale','shadeGeometryRevision','terrainRevision','provinceRevision','provinceSeed','provinceAnchor','packAddress','geometryDetail','wreckage','spaceEnvironment'];
const arrivalKeys=['position','forward','up','siteId','siteAnchor','siteRevision','siteElevation','terrainAnchor','walkMode','walkSurface','walkPosition','walkVelocity','shadeAttachment','projection','surfaceLock','geometryDetail','provinceRevision','provinceSeed','provinceAnchor','packAddress','routeShades','wreckage','spaceEnvironment','meadow'];
const readinessKeys=['fov','quality','textureDetail','richMaterials','localShadows','weatherQuality','clouds','weatherStrength','placeScene','placeWeather','viewMode','antialias','shadowSamples','stationSamples','shineField'];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function create({getState,validate,prepare,commit,hold=()=>{},requiresHold=()=>true,ready=()=>true,releaseResources=()=>{},blocked=()=>false,publish=()=>{},clock=()=>performance.now(),getViewContext=()=>null,prepareViewContext=(_core,context)=>context,releaseViewContext=()=>{},verifyCommitReconciliation=null}){
 if(typeof commit!=='function'||commit.constructor.name==='AsyncFunction')throw Object.assign(Error('The single arrival commit must be a statically synchronous host callback.'),{code:'ASYNC_COMMIT'});
 if(verifyCommitReconciliation!==null&&(typeof verifyCommitReconciliation!=='function'||verifyCommitReconciliation.constructor.name==='AsyncFunction'))throw Object.assign(Error('Commit reconciliation requires a statically synchronous host witness verifier.'),{code:'INVALID_RECONCILIATION'});
 let generation=0,active=null,tail=Promise.resolve(),lastRequest=null,status={state:'ready'},held=false,uncertainCommit=null;
 function report(state,detail={}){status={state,...detail};publish(status);}
 function cancel(reason='Travel cancelled.',invalidateQueued=true){if(invalidateQueued)generation++;if(active&&!active.committed){active.reason=reason;active.controller.abort();}}
 function checkWorld(){if(!active||active.committed)return;const current=getState(),key=dependencies.find(k=>!equal(active.initial[k],current[k]));if(key)cancel('Travel cancelled because '+key+' changed in World.',false);}
 function check(job){checkWorld();if(job.controller.signal.aborted||job.id!==generation)throw Object.assign(Error(job.reason||'A newer trip replaced this request.'),{name:'AbortError'});}
 function merge(candidate,current,request){
  const next=request.type==='saved'?structuredClone(candidate):structuredClone(current);
  if(request.type!=='saved')for(const k of [...arrivalKeys,...(request.overrides||[])])if(k in candidate)next[k]=structuredClone(candidate[k]);
  if(request.type!=='saved'){const previous={...next,time:candidate.time};next.time=current.time;if(next.shadeAttachment!==null)root.SphereInspection.transport(previous,next);}
  next.playing=current.playing;next.autoSpeed=current.autoSpeed;next.speed=current.speed;return next;
 }
 function retainUncertain(job,spec,error,started){
  job.committed=true;
  if(!uncertainCommit)uncertainCommit={job,spec,preparedViewContext:job.preparedViewContext,departure:job.departure,departureViewContext:job.departureViewContext,next:job.next};
  // Authority may already have moved. Keep the exact opaque context; neither
  // a rollback nor a release can safely be inferred from this callback result.
  job.preparedViewContext=null;held=true;
  try{hold(true);}catch(_){}
  const detail={id:job.id,title:spec.title,error:error.message,committed:true,commitOutcome:'UNCERTAIN',recoveryRequired:true,legacyAutosaveAllowed:false,held:true,elapsedMs:clock()-started};
  status={state:'committed-uncertain',...detail};try{publish(status);}catch(_){}
  return {...status};
 }
 function reconcileCommit(witness){
  if(!uncertainCommit||!verifyCommitReconciliation)throw Object.assign(Error('An authenticated host reconciliation for the retained uncertain commit is required.'),{code:'COMMIT_UNCERTAIN'});
  const retained=uncertainCommit,summary=Object.freeze({requestId:retained.job.id,departure:structuredClone(retained.departure),departureViewContext:structuredClone(retained.departureViewContext),candidate:structuredClone(retained.next),preparedViewContext:retained.preparedViewContext});
  const result=verifyCommitReconciliation(witness,summary);
  if(!result||typeof result.then==='function'||Object.getPrototypeOf(result)!==Object.prototype||Object.keys(result).sort().join('|')!=='requestId|resourcesOwnedByHost|state'||result.requestId!==retained.job.id||!['arrived','failed'].includes(result.state)||result.resourcesOwnedByHost!==true||uncertainCommit!==retained)throw Object.assign(Error('The host did not authenticate an exact synchronous commit outcome and resource ownership.'),{code:'COMMIT_UNCERTAIN'});
  // The authentic host owns every retained/transferred lease after this proof.
  // No generic release or state mutation occurs here.
  uncertainCommit=null;held=false;hold(false);report(result.state,{id:retained.job.id,title:retained.spec.title,committed:result.state==='arrived',commitOutcome:result.state==='arrived'?'COMMITTED':'RECONCILED_FAILED',recoveryRequired:false,legacyAutosaveAllowed:true,reconciled:true});return {...status};
 }
 function request(spec){
  spec={...spec,viewContext:structuredClone(spec.viewContext??null)};
  if(uncertainCommit)return Promise.resolve({...status});
  lastRequest=spec;if(blocked()){report('failed',{title:spec.title,error:'Finish the current capture or loading operation before travelling.'});return Promise.resolve(status);}
  cancel('A newer trip replaced this request.',false);const id=++generation;
  const run=async()=>{
   if(uncertainCommit)return {...status};
   if(id!==generation)return {state:'cancelled'};
   const job={id,initial:structuredClone(getState()),initialViewContext:structuredClone(getViewContext()),controller:new AbortController(),committed:false,commitInvoked:false,preparedViewContext:null};active=job;const started=clock();
   held=requiresHold(job.initial,spec);hold(held);report('preparing',{id,title:spec.title||'Selected destination',phase:held?'Preparing arrival · current support is held safely':'Preparing arrival'});
   try{
    releaseResources({viewContext:job.initialViewContext,prospective:false});check(job);const candidate=await spec.resolve(structuredClone(job.initial),job.controller.signal);check(job);
    if(!candidate)throw Error('The selected destination is unavailable.');const candidateViewContext=structuredClone(spec.viewContext??null);let next=merge(candidate,getState(),spec);
    // Reprepare when live settings affect readiness, without replacing them.
    for(;;){next=validate(next);next.playing=getState().playing;
     if(job.preparedViewContext!==null){releaseViewContext(job.preparedViewContext,{committed:false});job.preparedViewContext=null;}
     job.preparedViewContext=await prepareViewContext(next,candidateViewContext,{signal:job.controller.signal,requestId:id,prospective:true});check(job);
     await prepare(next,{signal:job.controller.signal,viewContext:job.preparedViewContext,onProgress:p=>{if(active===job)report('preparing',{id,title:spec.title,phase:p.phase});}});check(job);
     const latest=merge(candidate,getState(),spec);
     if(readinessKeys.some(k=>!equal(next[k],latest[k]))||!ready(latest,{viewContext:job.preparedViewContext})){next=latest;continue;}
     next=validate(latest);next.playing=getState().playing;break;
    }
    check(job);const departure=structuredClone(getState()),departureViewContext=structuredClone(getViewContext());
    // No await between final validation, controller activation and history commit.
    job.departure=departure;job.departureViewContext=departureViewContext;job.next=structuredClone(next);job.commitInvoked=true;
    const outcome=commit(next,{...spec,departure,candidate,departureViewContext,initialViewContext:job.initialViewContext,preparedViewContext:job.preparedViewContext});
    if(outcome&&typeof outcome.then==='function')return retainUncertain(job,spec,Error('Arrival callback returned a thenable after authority may have transferred.'),started);
    job.committed=true;job.preparedViewContext=null;
    held=false;hold(false);report('arrived',{id,title:spec.title,elapsedMs:clock()-started});return status;
   }catch(error){
    if(job.commitInvoked)return retainUncertain(job,spec,error,started);
    // Reacquire departure support before resuming its controller. The frozen
    // image remains visible while bounded caches are reused for preparation.
    let recoveryError=null;if(!held){held=true;hold(true);}
    try{if(job.preparedViewContext!==null){releaseViewContext(job.preparedViewContext,{committed:false});job.preparedViewContext=null;}const currentViewContext=structuredClone(getViewContext());releaseResources({viewContext:currentViewContext,prospective:false});job.preparedViewContext=await prepareViewContext(getState(),currentViewContext,{requestId:id,prospective:false});await prepare(getState(),{viewContext:job.preparedViewContext,onProgress:p=>{if(active===job)report('preparing',{id,title:spec.title,phase:'Restoring current view · '+p.phase});}});releaseViewContext(job.preparedViewContext,{currentRestored:true,committed:false});job.preparedViewContext=null;held=false;hold(false);}catch(e){recoveryError=e;}
    report(recoveryError?'failed':error.name==='AbortError'?'cancelled':'failed',{id,title:spec.title,error:error.message,recoveryError:recoveryError?.message,held,elapsedMs:clock()-started});return status;
   }finally{if(job.preparedViewContext!==null){releaseViewContext(job.preparedViewContext,{committed:false});job.preparedViewContext=null;}if(active===job)active=null;}
  };
  const result=tail.then(run);tail=result.catch(()=>{});return result;
 }
 return {request,cancel,checkWorld,reconcileCommit,retry:()=>lastRequest?request(lastRequest):Promise.resolve(status),get status(){return {...status};},get active(){return !!active;},get held(){return held;},get commitUncertain(){return !!uncertainCommit;},get legacyAutosaveAllowed(){return !uncertainCommit;},get pending(){return tail;}};
}
root.SphereTravelTransaction={create,dependencies,arrivalKeys,readinessKeys};
})(typeof window==='undefined'?globalThis:window);
