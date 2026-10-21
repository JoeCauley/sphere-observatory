import {loadRegistry} from './registry-loader.js';
import {createReference} from './reference.js';
import {initialState,saveState,parseState,move,clearance,takeoff,stepTakeoff,landOnFoot} from './navigation.js';
import {SharedWorldRenderer} from './renderer.js';
import {SharedWorldHost,readCheckpoint,writeCheckpoint,arrivalCommand,zoneDemand,bearingTo,elapsedSteps} from './host.js';
import {GrassStage} from '../../infinite-meadow/1.0.0/grass-stage.js';
import {ZonePreparation} from '../../runtime/v1/preparation.js';
import {renderOrigin,clamp} from '../../infinite-meadow/1.0.0/coordinates.js';
import {EYE} from '../../infinite-meadow/1.0.0/model.js';

export function mountSharedWorld(host,reference){
 const $=id=>host.document.getElementById(id),canvas=host.canvas,win=host.window;
 let state=initialState(reference,'meadow'),bookmark=structuredClone(state),saveRejected=null,saveAvailable=true,hadCheckpoint=false;
 try{const saved=readCheckpoint(win.localStorage,parseState,reference);if(saved){state=saved.state;bookmark=saved.bookmark;hadCheckpoint=true;}}
 catch(error){saveRejected=error.message;}
 const command=arrivalCommand(win.location.search);
 host.selectedPackId=command.pack==='industry'?'infinite-industry':'infinite-meadow';
 if(command.arrival!=='saved'||!hadCheckpoint){
  state=initialState(reference,command.pack);
  if(command.arrival==='flight'){
   if(command.pack==='industry')state.pose={...reference.approachPose()};
   else{state.pose.mode='flight';state.pose.altitudeM+=65;state.pose.pitch=-.15;}
  }
  if(command.pack==='meadow'&&command.arrival!=='flight')state.pose.yaw=bearingTo(state.pose,reference.facility.arrival.eastM,reference.facility.arrival.northM).yaw;
  if(!hadCheckpoint)bookmark=structuredClone(state);
 }
 if(command.arrival!=='saved'){
  const url=new URL(win.location.href);url.searchParams.delete('arrival');win.history.replaceState(null,'',url.href);
 }
 const keys=new Set(),motion={speedMps:0},residency=new GrassStage({ground:reference.groundHeight});
 let preparation=null,renderer=null,disposed=false,lift=null,drag=null,lastTime=null,hudTime=-Infinity,checkpointTime=0,frame=0;
 let lastMetrics=null,grassKey=null,wantedKey=null,lastZone=null,lastStableZone=null,walkedDistanceM=0,flownDistanceM=0,crossingCount=0;
 const events=[],trace=[],contextEvents=[],crossings=[];let lastResources=null,cleanup=null,detailsTime=-Infinity,lastCheckpoint={attempted:false,success:false},graphicsSample=null;
 const elapsed={acceptedSeconds:0,droppedSeconds:0,droppedCallbacks:0,simulationSteps:0,last:null};
 const region=()=>{const value=reference.regionAt(state.pose.eastM,state.pose.northM);return typeof value==='string'?value:value.id??value.region??value.packId;};
 const record=(type,detail={})=>{events.push({type,frame,timeMs:performance.now(),pose:{...state.pose},...detail});if(events.length>128)events.shift();};
 const status=text=>{$('status').textContent=text;};
 function clearInput(){keys.clear();drag=null;motion.speedMps=0;lastTime=null;}
 function persist(explicit=false){
  if(saveRejected&&!explicit){lastCheckpoint={attempted:false,success:false,reason:'Previous shared save rejected; explicit replacement required'};return false;}
  try{writeCheckpoint(win.localStorage,state,bookmark,saveState);saveAvailable=true;if(explicit)saveRejected=null;lastCheckpoint={attempted:true,success:true,frame};return true;}
  catch(error){lastCheckpoint={attempted:true,success:false,reason:error.message,frame};saveAvailable=false;if(explicit)status('Could not save this place: '+error.message);return false;}
 }
 const controller={
  inspect(){return {identity:{worldId:'meadow-industry',worldVersion:'1.0.0',packIds:['infinite-meadow','infinite-industry'],versions:['1.1.0','1.1.0'],contentVersions:['1.0.0','1.0.0']},...host.inspect(),pose:{...state.pose},currentRegion:region(),frame,walkedDistanceM,flownDistanceM,crossingCount,crossings:structuredClone(crossings),state:saveState(state),events:structuredClone(events),trace:structuredClone(trace),contextEvents:structuredClone(contextEvents),elapsed:structuredClone(elapsed),graphicsSample,preparation:preparation?.inspect()??null,grass:residency.counters(),renderer:renderer?structuredClone(renderer.info):null,lastFrame:lastMetrics?structuredClone(lastMetrics):null,save:{available:saveAvailable,rejected:saveRejected,separateFromStandalone:true,checkpointResult:{...lastCheckpoint}},reference:reference.inspect?.()??{industryCenter:[...reference.facility.center]},verifiedInputs:host.registry.verification,cleanup,lastResources};},
  checkpoint:()=>persist(),
  refreshDetails(){const report=controller.inspect();$('worldDetails').textContent=JSON.stringify({status:report.status,worldId:report.worldId,worldVersion:report.worldVersion,packIds:report.packIds,contextCount:report.contextCount,canvasCount:report.canvasCount,pose:report.pose,currentRegion:report.currentRegion,crossingCount,crossings:report.crossings,walkedMeters:walkedDistanceM,flownMeters:flownDistanceM,frame,elapsed:report.elapsed,graphicsSample:report.graphicsSample,reference:report.reference,stage:report.stage,resources:report.resources,preparation:report.preparation,renderer:report.renderer,lastFrame:lastMetrics,contextEvents:report.contextEvents,errors:report.error?[report.error]:[],errorObservation:'Shader compile/link errors and native context events; no diagnostic GL polling',verifiedInputs:report.verifiedInputs,save:report.save,cleanup:report.cleanup,hostCleanup:host.lastCleanup,previousRelease:report.previousRelease,qualification:'Functional shared-world preview; formal P05 remains open'},null,2);},
  cleanupEvidence:()=>({...cleanup,checkpointResult:{...lastCheckpoint}}),
  dispose(){
   if(disposed)return;persist();disposed=true;clearInput();preparation?.dispose();
   let rendererDisposed=false;try{renderer?.dispose();rendererDisposed=true;}finally{lastResources=host.lease?.inspect()??null;residency.tiles.clear();residency.required.length=0;cleanup={workerDisposed:preparation?.disposed??true,grassTiles:residency.tiles.size,rendererDisposed};}
  }
 };
 // Publish the cleanup root before constructing either content provider.
 host.controller=controller;
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
 const lease=host.trackContext(gl);
 host.listen(canvas,'webglcontextlost',event=>{
  event.preventDefault();contextEvents.push({type:'lost',frame,time:performance.now()});record('graphics-context-lost');
  host.fail(Error('The graphics context was interrupted. Your last saved place is kept.'));
 });
 host.listen(canvas,'webglcontextrestored',()=>{contextEvents.push({type:'restored',frame,time:performance.now()});status('Graphics recovered. Reload to rebuild the shared world.');});
 preparation=new ZonePreparation(new URL('../../infinite-industry/1.0.0/prepare-worker.js',import.meta.url),{build:reference.facility.config,maxResident:4,maxPacketBytes:2097152});
 renderer=new SharedWorldRenderer(canvas,reference,preparation,lease);
 if(renderer.gl!==gl)throw Error('The two packs must share the same graphics context');
 function resize(){const dpr=Math.min(1,win.devicePixelRatio||1),width=Math.max(1,Math.round(win.innerWidth*dpr)),height=Math.max(1,Math.round(win.innerHeight*dpr));renderer.resize(width,height);}
 resize();host.listen(win,'resize',resize);
 function togglePanel(){const hidden=!$('panel').hidden;$('panel').hidden=hidden;$('show').hidden=!hidden;canvas.focus();}
 function liftOff(){if(state.pose.mode==='walk'){lift=takeoff(state,reference);record('lift-off');status('In flight · Q descends, E climbs. F lands near the ground.');canvas.focus();}}
 function land(){if(landOnFoot(state,reference)){lift=null;motion.speedMps=0;record('landed');status('On foot. WASD walks; Shift moves faster.');canvas.focus();}else status('Descend with Q until you are close to a clear floor.');}
 function operate(){if(reference.interact(state)){record('water-route',{routing:state.routing});status(state.routing==='recovery'?'Water now returns through recovery.':'Water now flows to storage and distribution.');persist();}else status('Approach the routing wheel inside the treatment hall, then press R.');}
 host.listen($('fly'),'click',liftOff);host.listen($('land'),'click',land);host.listen($('operate'),'click',operate);
 host.listen($('hide'),'click',togglePanel);host.listen($('show'),'click',togglePanel);
 host.listen($('worldDetailsPanel'),'toggle',()=>controller.refreshDetails());
 host.listen($('faceDestination'),'click',()=>{const current=region(),atIndustry=current==='industry'||current==='infinite-industry',target=reference.home(atIndustry?'meadow':'industry');state.pose.yaw=bearingTo(state.pose,target.eastM,target.northM).yaw;state.pose.pitch=-.03;record('face-destination',{target:atIndustry?'meadow':'industry'});canvas.focus();});
 host.listen($('save'),'click',()=>{bookmark=structuredClone(state);if(persist(true)){record('saved-place');status('This shared place, viewpoint and water route are saved.');}canvas.focus();});
 host.listen($('returnSaved'),'click',()=>{state=parseState(saveState(bookmark),reference);lift=null;lastZone=null;lastStableZone=null;clearInput();record('returned-to-saved-place');status('Returned to your saved place in the same world.');canvas.focus();});
 host.listen($('pauseWorld'),'change',()=>{const playing=!$('pauseWorld').checked;state.windPlaying=playing;state.processPlaying=playing;record('world-clock',{playing});canvas.focus();});
 const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyZ','KeyX']);
 host.listen(win,'keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target?.tagName??''))return;
  if(!event.repeat){if(event.code==='KeyH'){event.preventDefault();togglePanel();return;}if(event.code==='KeyR'){event.preventDefault();operate();return;}if(event.code==='KeyF'){event.preventDefault();land();return;}if(event.code==='Space'){event.preventDefault();liftOff();return;}}
  if(movementKeys.has(event.code)){event.preventDefault();keys.add(event.code);canvas.focus();}
 });
 host.listen(win,'keyup',event=>keys.delete(event.code));host.listen(win,'blur',clearInput);
 host.listen(host.document,'visibilitychange',clearInput);
 host.listen(canvas,'pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY};canvas.focus();canvas.setPointerCapture(event.pointerId);});
 host.listen(canvas,'pointerup',()=>{drag=null;});host.listen(canvas,'lostpointercapture',()=>{drag=null;});
 host.listen(canvas,'pointermove',event=>{if(!drag)return;state.pose.yaw+=(event.clientX-drag.x)*.004;state.pose.pitch=clamp(state.pose.pitch-(event.clientY-drag.y)*.004,-1.5,1.5);drag={x:event.clientX,y:event.clientY};});
 host.listen(win,'pagehide',()=>{persist();host.dispose('pagehide');});
 host.listen(win,'pageshow',event=>{if(event.persisted)win.location.reload();});
 host.listen($('leave'),'click',()=>{persist();host.dispose('return-to-sphere');});
 function ui(){
  const current=region(),inIndustry=current==='industry'||current==='infinite-industry';
  $('currentPack').textContent=inIndustry?'Infinite Industry':current==='transition'?'Meadow → Industry':'Infinite Meadow';
  const target=reference.home(inIndustry?'meadow':'industry'),bearing=bearingTo(state.pose,target.eastM,target.northM);
  $('destination').textContent=(inIndustry?'Meadow':'Industry')+' · '+bearing.direction;
  $('faceDestination').textContent=inIndustry?'Face Meadow':'Face Industry';
  $('distance').textContent=(bearing.distanceM<1000?bearing.distanceM.toFixed(0)+' m':(bearing.distanceM/1000).toFixed(1)+' km')+' away';
  $('directionArrow').style.transform=`rotate(${bearing.relative*180/Math.PI}deg)`;
  $('position').textContent=`E ${state.pose.eastM.toFixed(1)} m · N ${state.pose.northM.toFixed(1)} m · ${Math.max(0,clearance(state.pose,reference)).toFixed(1)} m above ground`;
  $('mode').textContent=state.pose.mode==='walk'?'ON FOOT':'IN FLIGHT';$('fly').disabled=state.pose.mode!=='walk';$('land').disabled=state.pose.mode!=='flight';
  const at=reference.canInteract(state);$('interaction').hidden=!at;$('operate').textContent=state.routing==='distribution'?'Divert to recovery · R':'Restore distribution · R';
  $('waterRoute').textContent=state.routing==='distribution'?'Treated water flows to storage and distribution.':'The recovery raceway returns water to intake.';
  $('pauseWorld').checked=!state.windPlaying&&!state.processPlaying;
  const prep=preparation.inspect();$('readiness').textContent=`One shared scene · ${prep.residentZones}/4 detailed Industry zones · ${residency.tiles.size} Meadow cells`;
 }
 function advance(dt){
   const old={...state.pose};if(state.windPlaying)state.windTime+=dt;if(state.processPlaying)state.processTime+=dt;state.transition=Math.min(1,state.transition+dt*.22);
   const turn=Math.PI/4*dt;state.pose.yaw+=((keys.has('ArrowRight')||keys.has('KeyX')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyZ')?1:0))*turn;
   state.pose.pitch=clamp(state.pose.pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*turn,-1.5,1.5);
   if(lift){if(!stepTakeoff(state,lift,dt,reference))lift=null;}else move(state,keys,dt,reference,motion);
   const distance=Math.hypot(state.pose.eastM-old.eastM,state.pose.northM-old.northM);if(old.mode==='walk')walkedDistanceM+=distance;else flownDistanceM+=distance;
   const current=region();if(current!==lastZone){record('region-entered',{region:current,previous:lastZone});lastZone=current;}
   const stable=current==='infinite-industry'?'industry':current==='infinite-meadow'?'meadow':current;
   if(stable==='meadow'||stable==='industry'){if(lastStableZone&&lastStableZone!==stable){crossingCount++;const crossing={from:lastStableZone,to:stable,crossingCount,frame,timeMs:performance.now(),mode:state.pose.mode,pose:{...state.pose}};crossings.push(crossing);if(crossings.length>32)crossings.shift();record('pack-crossing',crossing);status(stable==='industry'?'You entered Infinite Industry. The meadow is still behind you.':'Back in Infinite Meadow. The water works remain in the same place.');}lastStableZone=stable;}
 }
 function tick(time){
  if(disposed)return;const schedule=elapsedSteps(lastTime,time);lastTime=time;frame++;
  if(!host.document.hidden){
   elapsed.last=schedule;elapsed.acceptedSeconds+=schedule.acceptedSeconds;elapsed.droppedSeconds+=schedule.droppedSeconds;if(schedule.droppedSeconds>0)elapsed.droppedCallbacks++;
   for(let step=0;step<schedule.steps;step++){advance(schedule.stepSeconds);elapsed.simulationSteps++;}
   if(schedule.steps===0)advance(0);
   const newGrassKey=[Math.floor(state.pose.eastM/16),Math.floor(state.pose.northM/16),state.grassDensity,state.grassReach,state.pose.altitudeM-reference.groundHeight(state.pose.eastM,state.pose.northM)-EYE<140].join('|');
   if(newGrassKey!==grassKey){residency.update(state.pose,state.grassDensity,state.grassReach);grassKey=newGrassKey;}
   const wanted=zoneDemand(reference.facility,state.pose),newWantedKey=wanted.join('|');
   if(newWantedKey!==wantedKey||(!preparation.pending&&wanted.slice(0,4).some(id=>!preparation.resident.has(id)))){preparation.update(wanted);wantedKey=newWantedKey;}
   const sharedFrame=host.stage.follow(state.pose,state.windTime);sharedFrame.origin=renderOrigin(state.pose);
   graphicsSample=reference.sampleGraphics(state);
   lastMetrics=renderer.drawShared({...state,windTime:graphicsSample.windTime,processTime:graphicsSample.processTime,routing:graphicsSample.routing,transition:graphicsSample.transition},residency,sharedFrame);
   if(frame%30===0){trace.push({frame,pose:{...state.pose},region:region(),walkedDistanceM,flownDistanceM});if(trace.length>1200)trace.shift();}
   if(time-checkpointTime>5000){checkpointTime=time;persist();}
  }else lastTime=null;
  if(time-hudTime>150){hudTime=time;ui();}
  if(time-detailsTime>1000){detailsTime=time;controller.refreshDetails();}
  host.frame(tick);
 }
 controller.start=()=>{ui();$('loading').hidden=true;record('shared-world-start',{arrival:command.arrival,pack:command.pack,restored:hadCheckpoint});controller.refreshDetails();status(saveRejected?'Previous shared save could not be read. Save explicitly to replace it.':hadCheckpoint&&command.arrival==='saved'?'Resumed your saved shared viewpoint. WASD moves; drag to look.':'W walks toward Industry. Shift moves faster; drag to look.');canvas.focus();host.frame(tick);};
 return controller;
}

async function boot(){
 let host=null;
 try{const registry=await loadRegistry(),reference=createReference();host=new SharedWorldHost(document.getElementById('world'),registry);const controller=mountSharedWorld(host,reference);host.ready(controller);Object.defineProperty(window,'SphereSharedWorld',{configurable:true,value:Object.freeze({inspect:()=>controller.inspect()})});controller.start();}
 catch(error){if(host)host.fail(error);else{const loading=document.getElementById('loading');loading.hidden=false;loading.textContent='Could not open the shared world: '+error.message;}console.error(error);}
}
if(typeof document!=='undefined')boot();
