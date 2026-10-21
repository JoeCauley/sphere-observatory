import {clamp} from '../../infinite-meadow/1.0.0/coordinates.js';
import {moveOnSupport,EYE_M} from '../../runtime/v1/navigation.js';
import {ZonePreparation} from '../../runtime/v1/preparation.js';
import {createFacility,DATUM_M} from './facility.js';
import {initialState,saveState,parseState,address,interact,canInteract,approachPose,boundedPitch} from './model.js';
import {IndustryRenderer} from './renderer.js';
const quantile=(a,p)=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?b[Math.min(b.length-1,Math.floor(b.length*p))]:null;};
const stats=values=>({median:quantile(values,.5),p95:quantile(values,.95),worst:values.filter(Number.isFinite).length?Math.max(...values.filter(Number.isFinite)):null});
export function mountPack(host){
 const $=id=>document.getElementById(id),canvas=$('world'),lease=host.trackContext(canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true}));
 let state=initialState(),bookmark=structuredClone(state),saveRejected=null;const facility=createFacility(state.config),keys=new Set(),motion={speedMps:0};
 host.storage.useValidator(s=>saveState(parseState(s)));
 try{const saved=host.storage.read();if(saved){state=parseState(saved.state);bookmark=parseState(saved.bookmark);}}catch(e){saveRejected=e.message;}
 const entryURL=new URL(location.href),arrival=entryURL.searchParams.get('arrival');if(arrival==='flight')state.pose=approachPose(facility);else if(arrival==='ground')state.pose={...facility.arrival};
 // Arrival is a one-time visit command. Reload must continue the checkpoint.
 if(arrival){entryURL.searchParams.delete('arrival');history.replaceState(null,'',entryURL.href);}
 const preparation=new ZonePreparation(new URL('prepare-worker.js',import.meta.url),{build:state.config,maxResident:4,maxPacketBytes:2097152});
 let renderer;try{renderer=new IndustryRenderer(canvas,facility,preparation,lease);}catch(e){preparation.dispose();throw e;}
 let disposed=false,last=0,frame=0,hudTime=0,drag=null,tour=null,overview=null,liftTime=0,measurement=null,recording=null,recordingURL=null;
 const metrics=[],events=[],trace=[],measurements=[],glErrors=[];
 const event=(type,detail={})=>{events.push({type,frame,pose:{...state.pose},...detail});if(events.length>512)events.shift();};
 const status=text=>$('status').textContent=text;
 const persist=()=>{if(saveRejected)throw Error('The previous save needs an explicit repair or import: '+saveRejected);host.storage.write({state:saveState(state),bookmark:saveState(bookmark)});};
 // A rejected save is never replaced on exit. A portable new save remains possible.
 function snapshot(){if(saveRejected)throw Error('Previous Industry save rejected: '+saveRejected);return {state:saveState(state),bookmark:saveState(bookmark)};}
 const clearKeys=()=>{keys.clear();drag=null;motion.speedMps=0;};
 function download(blob,name){const a=document.createElement('a'),url=host.objectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();host.delay(()=>host.revokeURL(url),1000);}
 function resize(){const dpr=Math.min(1,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}resize();host.listen(window,'resize',resize);
 function ui(){
  const at=canInteract(state,facility);$('context').hidden=!at;$('operate').textContent=state.routing==='distribution'?'Divert to recovery · R':'Restore distribution · R';$('consequence').textContent=state.routing==='distribution'?'Treated water continues to the storage vessels.':'Water returns through the recovery raceway. The distribution branch is closed.';
  $('outputStage').textContent=state.routing==='distribution'?'03  Storage → distribution':'03  Recovery → intake';$('pauseProcess').checked=!state.processPlaying;$('lift').disabled=state.pose.mode!=='walk';$('land').disabled=state.pose.mode!=='flight';$('mode').textContent=measurement?'MEASURING':state.pose.mode.toUpperCase();
 }
 function operate(){if(measurement)return;if(interact(state,facility)){event('water-routing',{routing:state.routing});status(state.routing==='recovery'?'The valve redirects treated water into recovery. Follow the lower return pipe.':'The valve restores storage and distribution.');try{persist();}catch(e){status(e.message);}ui();}else status('Approach the routing wheel inside the treatment hall.');}
 $('operate').onclick=operate;
 const localPoint=(x,z,h=0)=>{const [eastM,northM]=facility.toWorld(x,z);return {eastM,northM,altitudeM:DATUM_M+h+EYE_M};};
 function lookAt(x,z,h=8){const target=localPoint(x,z,h),p=state.pose;p.yaw=Math.atan2(target.eastM-p.eastM,-(target.northM-p.northM));p.pitch=boundedPitch(Math.atan2(target.altitudeM-p.altitudeM,Math.hypot(target.eastM-p.eastM,target.northM-p.northM)));}
 const route=[
  {x:0,z:42},{x:0,z:30,stop:'approach',label:'The treatment hall. Two clarifiers to its left; storage to its right.',look:[0,-6,10]},
  {x:0,z:6,stop:'hall',label:'Six pressure filters transform the incoming water. The routing wheel is ahead to the right.',look:[-10,-15,7]},
  {x:4,z:12,stop:'control',label:'Operate the routing wheel with R. Watch the recovery raceway and return pipe.',look:[4,14,0]},
  {x:0,z:12},{x:0,z:28},{x:20,z:34},{x:26,z:34},{x:26,z:-6},
  {x:15,z:-6},{x:15,z:19,stop:'elevated',label:'The gallery reveals the recovery raceway and its return connection.',look:[42,42,3]},
  {x:15,z:-6},{x:26,z:-6},{x:26,z:34},{x:26,z:59},{x:58,z:59},{x:58,z:0},{x:85,z:0,stop:'boundary',label:'A shared water and pedestrian corridor reaches the neighboring hex boundary.',look:[65,5,5]},
  {x:58,z:0},{x:58,z:59},{x:0,z:59},{x:-64,z:59},{x:-64,z:0},{x:-85,z:0,stop:'intake-boundary',label:'The matching intake corridor brings water to the two clarifiers.',look:[-65,5,5]},
  {x:-64,z:0},{x:-64,z:59},{x:0,z:59},{x:0,z:64,stop:'returned',label:'Back at the arrival court. Lift off or continue investigating.',look:[0,-6,12]}
 ];
 function startTour(){if(measurement)return;if(tour){tour.paused=false;$('tour').textContent='Walking the process…';canvas.focus();return;}if(state.pose.mode!=='walk'){status('Descend near the arrival court and land before starting the walking inspection.');return;}
  overview=null;liftTime=0;clearKeys();tour={index:0,paused:false,blockedSeconds:0};$('pauseTour').hidden=false;$('tour').textContent='Walking the process…';event('walking-inspection-start');canvas.focus();}
 $('tour').onclick=startTour;$('pauseTour').onclick=()=>{if(tour){tour.paused=!tour.paused;$('pauseTour').textContent=tour.paused?'Resume inspection':'Pause inspection';$('tour').textContent=tour.paused?'Continue inspection':'Walking the process…';}};
 function manual(){if(tour||overview){event('manual-control');tour=overview=null;$('tour').textContent='Walk the process';$('pauseTour').hidden=true;}liftTime=0;}
 function lift(){if(measurement)return;manual();if(state.pose.mode==='walk'){state.pose.mode='flight';liftTime=2;event('lift-off');status('Lifting off · Q descends, E climbs, F lands.');canvas.focus();}}
 function land(){if(measurement)return;const p=state.pose,h=facility.support(p.eastM,p.northM,p.altitudeM-EYE_M);if(p.altitudeM-h-EYE_M<8&&!facility.blocked(p.eastM,p.northM,h+EYE_M,true)){manual();p.mode='walk';p.altitudeM=h+EYE_M;event('land');status('On foot · WASD walks, Space + E lifts off.');}else status('Descend with Q until you are close to solid ground.');}
 $('lift').onclick=lift;$('land').onclick=land;
 $('overview').onclick=()=>{if(measurement)return;manual();const local=facility.toLocal(state.pose.eastM,state.pose.northM);if(Math.abs(local[0])<20&&local[1]>-35&&local[1]<22&&state.pose.altitudeM<DATUM_M+28){status('Leave the covered hall before lifting off for an overview.');return;}state.pose.mode='flight';const target=localPoint(350,300,240);overview={phase:'climb',target};event('facility-overview-start');canvas.focus();};
 $('save').onclick=()=>{if(measurement)return;bookmark=structuredClone(state);saveRejected=null;try{persist();status('Your viewpoint and water routing are saved.');event('saved-place');}catch(e){status(e.message);}};
 $('returnSaved').onclick=()=>{if(measurement)return;manual();state=structuredClone(bookmark);clearKeys();event('saved-place-return');status('Returned to the same saved place and process state.');ui();};
 $('downloadSave').onclick=()=>download(new Blob([host.storage.encode({state:saveState(state),bookmark:saveState(bookmark)})],{type:'application/json'}),'Sphere-Infinite-Industry-1.0.0-save.json');
 $('importSave').onclick=()=>$('saveFile').click();$('saveFile').onchange=async e=>{try{if(measurement)throw Error('Finish the measurement first');const file=e.target.files[0];if(!file||file.size>1000000)throw Error('Save exceeds 1 MB');const payload=host.storage.decode(await file.text()),current=parseState(payload.state),saved=parseState(payload.bookmark);manual();state=current;bookmark=saved;saveRejected=null;persist();ui();status('Industrial place imported.');}catch(e){status('Import rejected: '+e.message);}finally{$('saveFile').value='';}};
 $('pauseProcess').onchange=()=>{if(measurement)return;state.processPlaying=!$('pauseProcess').checked;ui();};
 function hide(){const hidden=!$('panel').hidden;$('panel').hidden=hidden;$('show').hidden=!hidden;$('hide').hidden=hidden;canvas.focus();}$('hide').onclick=hide;$('show').onclick=hide;
 function report(rows,label){return {label,frames:rows.length,viewport:{width:canvas.width,height:canvas.height},frameTimeMs:stats(rows.map(r=>r.intervalMs)),renderCpuMs:stats(rows.map(r=>r.renderCpuMs)),prepareMainMs:stats(rows.map(r=>r.prepareMs)),workerBuildMs:stats(rows.map(r=>r.workerBuildMs)),uploadCpuMs:stats(rows.map(r=>r.uploadCpuMs)),collisionMs:stats(rows.map(r=>r.collisionMs)),gpuMs:stats(rows.flatMap(r=>r.gpuResolved.filter(g=>!g.disjoint).map(g=>g.ms))),drawCalls:stats(rows.map(r=>r.drawCalls)),visibleTriangles:stats(rows.map(r=>r.triangles)),peakGeometryBytes:Math.max(0,...rows.map(r=>r.gpuBufferBytes)),peakTextureBytes:0,webglErrors:[...glErrors],context:renderer.info};}
 $('measure').onclick=()=>{if(measurement||recording){status('Finish recording before measuring.');return;}clearKeys();if(tour)tour.paused=true;overview=null;liftTime=0;measurement={rows:[]};$('measure').disabled=true;status('Measuring 900 quiet frames at this viewpoint.');};
 function inspect(){return {identity:host.inspect().identity,state:saveState(state),layout:facility.config,process:facility.process,interfaces:facility.interfaces,collisionReady:true,preparation:preparation.inspect(),renderer:renderer.info,resources:lease.inspect(),metrics:metrics.slice(-900),events:[...events],trace:[...trace],measurements:[...measurements],walkingInspection:tour?{index:tour.index,paused:tour.paused,stop:route[tour.index-1]?.stop??null}:null,webglErrors:[...glErrors],saveRejected};}
 window.SphereIndustry={inspect};
 $('exportEvidence').onclick=()=>download(new Blob([JSON.stringify(inspect(),null,2)],{type:'application/json'}),'Sphere-Infinite-Industry-II001-evidence.json');
 function finishRecording(){if(!recording)return;const active=recording;recording=null;$('record').textContent='Record walking route';active.stop();}
 $('record').onclick=()=>{if(measurement)return;if(recording){finishRecording();return;}if(!canvas.captureStream||typeof MediaRecorder==='undefined'){status('Recording unavailable in this browser.');return;}
  if(recordingURL){host.revokeURL(recordingURL);recordingURL=null;$('recordingLink').hidden=true;}
  const stream=host.media(canvas.captureStream(30)),chunks=[],mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m)),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{host.stopMedia(stream);if(disposed)return;recordingURL=host.objectURL(new Blob(chunks,{type:mime}));$('recordingLink').href=recordingURL;$('recordingLink').hidden=false;event('walking-recording-complete');status('The actual walking route is ready to download.');};
  recording=recorder;recorder.start(1000);trace.length=0;event('walking-recording-start');$('record').textContent='Stop recording';status('Recording the rendered facility. Walk freely or start the process inspection.');
 };
 host.listen(window,'keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;if(e.code==='KeyH'&&!e.repeat){hide();return;}if(e.code==='KeyR'&&!e.repeat){operate();return;}if(e.code==='KeyF'&&!e.repeat){land();return;}if(e.code==='KeyE'&&keys.has('Space')){lift();return;}
  if(['Space','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyZ','KeyX','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();if(!measurement&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE'].includes(e.code))manual();keys.add(e.code);if(e.code==='Space'&&keys.has('KeyE'))lift();canvas.focus();}});
 host.listen(window,'keyup',e=>keys.delete(e.code));host.listen(window,'blur',clearKeys);host.listen(document,'visibilitychange',()=>{clearKeys();last=0;});
 host.listen(canvas,'pointerdown',e=>{if(e.button!==0)return;drag=[e.clientX,e.clientY];canvas.focus();canvas.setPointerCapture(e.pointerId);});host.listen(canvas,'pointerup',()=>drag=null);host.listen(canvas,'lostpointercapture',()=>drag=null);
 host.listen(canvas,'pointermove',e=>{if(!drag||measurement)return;state.pose.yaw+=(e.clientX-drag[0])*.004;state.pose.pitch=boundedPitch(state.pose.pitch-(e.clientY-drag[1])*.004);drag=[e.clientX,e.clientY];});
 function walkTour(dt){const t=route[tour.index],target=localPoint(t.x,t.z),p=state.pose,dx=target.eastM-p.eastM,dz=target.northM-p.northM,d=Math.hypot(dx,dz);if(d<.2){tour.index++;tour.blockedSeconds=0;if(t.stop){tour.paused=true;lookAt(...t.look);$('tourStage').textContent=t.label;$('tour').textContent=t.stop==='returned'?'Walk the process again':'Continue inspection';$('pauseTour').textContent='Resume inspection';event('walking-inspection-stop',{stop:t.stop,index:tour.index});}if(tour.index===route.length){tour=null;$('pauseTour').hidden=true;event('walking-inspection-complete');}return {colliding:false};}
  p.yaw=Math.atan2(dx,-dz);p.pitch=.015;const moved=moveOnSupport(state,new Set(['KeyW','ShiftLeft']),Math.min(dt,d/6),facility,motion);tour.blockedSeconds=moved.colliding?tour.blockedSeconds+dt:0;if(tour.blockedSeconds>3){tour.paused=true;status('Inspection paused at an obstacle. Take manual control to investigate.');event('inspection-obstacle');}return moved;}
 function flyOverview(dt){const p=state.pose,o=overview;if(o.phase==='climb'){const moved=moveOnSupport(state,new Set(['KeyE']),dt,facility,motion);if(p.altitudeM>=DATUM_M+245)o.phase='travel';return moved;}
  const dx=o.target.eastM-p.eastM,dz=o.target.northM-p.northM,d=Math.hypot(dx,dz);if(d<3){overview=null;lookAt(0,-5,8);event('facility-overview-ready');status('The same water works, seen from flight. Q descends; F lands near a floor.');return {colliding:false};}
  p.yaw=Math.atan2(dx,-dz);p.pitch=0;return moveOnSupport(state,new Set(['KeyW']),Math.min(dt,d/Math.max(motion.speedMps,1)),facility,motion);
 }
 function tick(t){if(disposed)return;host.frame(tick);const rawDt=last?(t-last)/1000:1/60,dt=Math.min(.1,rawDt);last=t;frame++;
  const collisionStart=performance.now();let moved={colliding:false};
  if(!measurement){if(state.processPlaying)state.processTime+=dt;state.transition=Math.min(1,state.transition+dt*.22);
   const turn=Math.PI/4*dt;state.pose.yaw+=((keys.has('ArrowRight')||keys.has('KeyX')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyZ')?1:0))*turn;state.pose.pitch=boundedPitch(state.pose.pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*turn);
   if(tour&&!tour.paused)moved=walkTour(dt);else if(overview)moved=flyOverview(dt);else if(liftTime>0){liftTime-=dt;moved=moveOnSupport(state,new Set(['KeyE']),dt,facility,motion);}else moved=moveOnSupport(state,keys,dt,facility,motion);
  }
  const collisionMs=performance.now()-collisionStart,prepareStart=performance.now(),sharedFrame=host.stage.follow(state.pose,state.processTime);
  const wanted=facility.zones.map(z=>({id:z.id,d:Math.hypot(z.worldCenter[0]-state.pose.eastM,z.worldCenter[1]-state.pose.northM)-z.radius})).filter(z=>z.d<100&&state.pose.altitudeM<DATUM_M+100).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).map(z=>z.id);preparation.update(wanted);
  const prepareMs=performance.now()-prepareStart,gl=renderer.gl,ext=renderer.ext,query=ext&&renderer.queries.length<8?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
  const m=renderer.drawIndustry(state,sharedFrame);if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);renderer.queries.push({query,frame:renderer.frame});}
  if(frame%120===0){let code;while((code=gl.getError())!==gl.NO_ERROR){glErrors.push({frame,code});if(glErrors.length>32)throw Error('WebGL errors in industrial scene');}}
  const row={frame,intervalMs:rawDt*1000,collisionMs,prepareMs,motionPreparationMs:m.motionPreparationMs,workerBuildMs:preparation.lastBuildMs,renderCpuMs:m.renderCpuMs,uploadCpuMs:m.uploadCpuMs,gpuResolved:m.gpuResolved??[],drawCalls:m.drawCalls,triangles:m.triangles,gpuBufferBytes:m.gpuBytes,gpuTextureBytes:0,uploadBytes:m.uploadBytes,lod:m.lod,residentZones:m.residentZones,origin:sharedFrame.origin,pose:{...state.pose},collision:!!moved.colliding,ready:true};
  metrics.push(row);if(metrics.length>900)metrics.shift();if((recording||tour)&&trace.length<18000)trace.push(row);
  if(measurement){measurement.rows.push(row);if(measurement.rows.length===900){const r=report(measurement.rows,'quiet viewpoint');measurements.push(r);measurement=null;$('measure').disabled=false;$('measurement').hidden=false;$('measurement').textContent=JSON.stringify(r,null,2);status('900 quiet frames recorded. Download inspection evidence for the full measurements.');event('quiet-measurement-complete',{frames:900});}}
  if(t-hudTime>150){hudTime=t;ui();const a=address(state.pose);$('address').textContent=`Water works 0,0 · E ${a.east.cell}:${a.east.localM.toFixed(2)} · N ${a.north.cell}:${a.north.localM.toFixed(2)}`;$('readiness').textContent=`${m.lod} · ${m.residentZones}/4 detailed zones · collision ready`;$('performance').textContent=`${(1000/(quantile(metrics.slice(-60).map(r=>r.intervalMs),.5)||16.7)).toFixed(0)} draws/s · ${m.drawCalls} calls`;}
 }
 host.frame(tick);ui();status(saveRejected?'Previous save rejected: '+saveRejected:arrival==='flight'?'Arrived above the water works · Q descends, F lands.':'Walk the process, then follow what changes.');event('arrived',{arrival:arrival??'saved',restored:state.processTime>0});
 return {snapshot,dispose(){disposed=true;clearKeys();tour=overview=measurement=null;preparation.dispose();if(recording){recording.ondataavailable=recording.onstop=null;if(recording.state!=='inactive')recording.stop();recording=null;}renderer.dispose();metrics.length=events.length=trace.length=0;delete window.SphereIndustry;}};
}
