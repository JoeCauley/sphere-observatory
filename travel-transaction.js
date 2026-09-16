/* One serialized owner of destination resources and scene commits. */
(function(root){
'use strict';
const dependencies=['radius','starRadius','layoutVersion','collection','axisLat','axisLon','waistWidth','transitionKm','era','seed','biome','regionOrder','breachEnabled','breachLat','breachLon','breachDiameter','breachRoughness','multipleWounds','shellThickness','shadeEnabled','shadeAltitude','shadeDiameter','shadeOffset','shadeSpeed','shadeDamage','routeShades','shadeShape','shadeTrim','cycleScale','shadeGeometryRevision','terrainRevision','provinceRevision','provinceSeed','provinceAnchor','packAddress','geometryDetail','wreckage','spaceEnvironment'];
const arrivalKeys=['position','forward','up','siteId','siteAnchor','siteRevision','siteElevation','terrainAnchor','walkMode','walkSurface','walkPosition','walkVelocity','shadeAttachment','projection','surfaceLock','geometryDetail','provinceRevision','provinceSeed','provinceAnchor','packAddress','routeShades','wreckage','spaceEnvironment'];
const readinessKeys=['fov','quality','textureDetail','richMaterials','localShadows','weatherQuality','clouds','weatherStrength','placeScene','placeWeather','viewMode','antialias','shadowSamples','stationSamples','shineField'];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function create({getState,validate,prepare,commit,hold=()=>{},requiresHold=()=>true,ready=()=>true,releaseResources=()=>{},blocked=()=>false,publish=()=>{},clock=()=>performance.now()}){
 let generation=0,active=null,tail=Promise.resolve(),lastRequest=null,status={state:'ready'},held=false;
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
 function request(spec){
  lastRequest=spec;if(blocked()){report('failed',{title:spec.title,error:'Finish the current capture or loading operation before travelling.'});return Promise.resolve(status);}
  cancel('A newer trip replaced this request.',false);const id=++generation;
  const run=async()=>{
   if(id!==generation)return {state:'cancelled'};
   const job={id,initial:getState(),controller:new AbortController(),committed:false};active=job;const started=clock();
   held=requiresHold(job.initial,spec);hold(held);report('preparing',{id,title:spec.title||'Selected destination',phase:held?'Preparing arrival · current support is held safely':'Preparing arrival'});
   try{
    releaseResources();check(job);const candidate=await spec.resolve(structuredClone(job.initial),job.controller.signal);check(job);
    if(!candidate)throw Error('The selected destination is unavailable.');let next=merge(candidate,getState(),spec);
    // Reprepare when live settings affect readiness, without replacing them.
    for(;;){next=validate(next);next.playing=getState().playing;
     await prepare(next,{signal:job.controller.signal,onProgress:p=>{if(active===job)report('preparing',{id,title:spec.title,phase:p.phase});}});check(job);
     const latest=merge(candidate,getState(),spec);
     if(readinessKeys.some(k=>!equal(next[k],latest[k]))||!ready(latest)){next=latest;continue;}
     next=validate(latest);next.playing=getState().playing;break;
    }
    check(job);const departure=getState();
    // No await between final validation, controller activation and history commit.
    commit(next,{...spec,departure,candidate});job.committed=true;
    held=false;hold(false);report('arrived',{id,title:spec.title,elapsedMs:clock()-started});return status;
   }catch(error){
    // Reacquire departure support before resuming its controller. The frozen
    // image remains visible while bounded caches are reused for preparation.
    let recoveryError=null;if(!held){held=true;hold(true);}
    try{releaseResources();await prepare(getState(),{onProgress:p=>{if(active===job)report('preparing',{id,title:spec.title,phase:'Restoring current view · '+p.phase});}});held=false;hold(false);}catch(e){recoveryError=e;}
    report(recoveryError?'failed':error.name==='AbortError'?'cancelled':'failed',{id,title:spec.title,error:error.message,recoveryError:recoveryError?.message,held,elapsedMs:clock()-started});return status;
   }finally{if(active===job)active=null;}
  };
  const result=tail.then(run);tail=result.catch(()=>{});return result;
 }
 return {request,cancel,checkWorld,retry:()=>lastRequest?request(lastRequest):Promise.resolve(status),get status(){return {...status};},get active(){return !!active;},get held(){return held;},get pending(){return tail;}};
}
root.SphereTravelTransaction={create,dependencies,arrivalKeys,readinessKeys};
})(typeof window==='undefined'?globalThis:window);
