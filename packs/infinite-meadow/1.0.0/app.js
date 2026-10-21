import {clamp,address,toGlobal} from './coordinates.js';
import {initialState,saveState,parseState,terrain,clearance,move,takeoff,stepTakeoff,landOnFoot,startSkimming,flightSpeed,sceneLight,guidedRoute,finishRoute,meadowRoute,landscapeRoute,grassEdgeRoute,routePose,blindBands,GROUND_DATUM,COMFORT_TURN_RAD_S} from './model.js';
import {Renderer} from './renderer.js';
import {GrassStage} from './grass-stage.js';
import {startLevelCruise,stepLevelCruise,stopLevelCruise,LEVEL_MIN_ALTITUDE_M,TERRAIN_UPPER_BOUND_M} from './level-cruise.js';
export function mountPack(host){
const $=id=>document.getElementById(id),canvas=$('world');
const lease=host.trackContext(canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true}));
let state=initialState(),bookmark=structuredClone(state),route=null,routeTime=0,direction=1,paused=false,stage='Meadow ready · walk freely';
const keys=new Set(),tappedKeys=new Set(),residency=new GrassStage({ground:terrain}),metrics=[],events=[],trace=[],demands=[];
const measurements=[];
function clearKeys(){keys.clear();tappedKeys.clear();flightMotion.cruise=false;if(!quiet)stopLevelCruise(flightMotion);}
let frame=0,last=0,lastPose={...state.pose},hudLast=0,tracing=false,quiet=null,quietStats=null,recording=null,recordedChunks=[],bookmarkCheck=null,returnCheck=null;
let lift=null;const flightMotion={speedMps:0,cruise:false,level:null};
function event(type,detail={}){events.push({type,frame,timestamp:performance.now(),pose:{...state.pose},...detail});if(events.length>512)events.shift();}
const status=text=>$('status').textContent=text;
function download(blob,name){const a=document.createElement('a');a.href=host.objectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();host.delay(()=>host.revokeURL(a.href),60000);}
function syncUI(){$('density').value=state.grassDensity;$('reach').value=state.grassReach;$('daylight').value=state.daylight;$('comfort').checked=state.comfortMotion;$('concealment').checked=state.concealment;$('blindHeight').value=state.blindHeightM/1000;$('blindLabel').textContent=(state.blindHeightM/1000)+' km · provisional';$('pause').textContent=paused?'Resume journey':'Pause journey';$('grassbox').checked=state.grassbox;$('wind').checked=state.windPlaying;$('grassHeight').value=state.grassHeightScale;$('grassWidth').value=state.grassWidthScale;$('skimSpeed').value=state.skimSpeedMps*3.6;$('skimSpeedValue').value=Math.round(state.skimSpeedMps*3.6);}
function persist(){host.storage.write({state:JSON.parse(saveState(state)),bookmark:JSON.parse(saveState(bookmark))});}
host.storage.useValidator(s=>JSON.parse(saveState(parseState(JSON.stringify(s)))));
try{const saved=host.storage.read();if(saved){state=parseState(JSON.stringify(saved.state));bookmark=parseState(JSON.stringify(saved.bookmark));stage='Saved meadow restored';}}catch(e){status('Save rejected: '+e.message);}
let renderer;try{renderer=new Renderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent='The meadow could not start.\n'+e.message;throw e;}
function resize(){const dpr=Math.min(1,window.devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
resize();host.listen(window,'resize',resize);syncUI();
async function frameSnapshot(){const gl=renderer.gl,bytes=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);const digest=await crypto.subtle.digest('SHA-256',bytes);return {bytes,hash:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};}
async function captureBookmark(){residency.update(state.pose,state.grassDensity,state.grassReach);renderer.draw(state,residency,{timing:false});const check={state:saveState(state),digest:residency.digest(),width:canvas.width,height:canvas.height,snapshot:await frameSnapshot()};bookmarkCheck=check;return check;}
function startJourney(){
  if(quiet){status('Finish the quiet measurement before lifting off');return;}
  if(clearance(state.pose)>8){status('Descend near the meadow with Q, or return to your saved place');return;}
  state.skimEnabled=false;bookmark=structuredClone(state);captureBookmark();route=guidedRoute(bookmark);routeTime=0;direction=1;paused=false;clearKeys();tracing=true;trace.length=0;demands.length=0;returnCheck=null;
  lift=null;flightMotion.speedMps=0;
  event('journey-start',{duration:route.duration,blind:blindBands(state),saved:JSON.parse(saveState(bookmark))});status('Lift-off from your chosen place · accelerated flight');
}
function manual(preserveKeys=false){route=null;lift=null;paused=false;stopLevelCruise(flightMotion);if(clearance(state.pose)>120)state.skimEnabled=false;syncUI();if(!preserveKeys)clearKeys();flightMotion.speedMps=0;tracing=false;stage='Your meadow · explore freely';status('Manual control · WASD travels · Q/E lowers/raises · Z/X turns');canvas.focus();}
function toggleSkimming(){
  if(quiet||route){status('Finish the current journey or measurement before skimming');return;}
  stopLevelCruise(flightMotion);
  if(state.skimEnabled){state.skimEnabled=false;flightMotion.cruise=false;status('Free flight · T returns to grass skimming');event('skim-off');}
  else{if(!startSkimming(state)){status('Start skimming within 120 m of the hills, clear of the structures');return;}lift=null;flightMotion.speedMps=0;clearKeys();status('Grass skimming · WASD steers · Q/E adjusts height · Shift faster · F lands');event('skim-on',{speedMps:state.skimSpeedMps,clearanceM:state.skimClearanceM});}
  syncUI();canvas.focus();
}
$('skim').onclick=toggleSkimming;
$('cruise').onclick=()=>{if(quiet||route)return;if(!state.skimEnabled)toggleSkimming();if(!state.skimEnabled)return;flightMotion.cruise=!flightMotion.cruise;if(flightMotion.cruise){tracing=true;trace.length=0;demands.length=0;event('skim-cruise-start');}else event('skim-cruise-stop');status(flightMotion.cruise?'Cruising above the grass · look freely · Q/E trims height · stop with Cruise or F':'Cruise stopped · WASD flies manually');canvas.focus();};
function toggleLevelCruise(){
  if(quiet||route){status('Finish the current journey or measurement before level cruising');return;}
  if(flightMotion.level){stopLevelCruise(flightMotion);stage='Level cruise stopped · free flight';event('level-cruise-stop');status('Level cruise stopped · WASD flies manually');}
  else{clearKeys();lift=null;paused=false;startLevelCruise(state,flightMotion);tracing=true;trace.length=0;demands.length=0;stage=flightMotion.level.entrySeconds?'Climbing above the highest hills':'Level cruise · straight course';event('level-cruise-start',{...flightMotion.level,terrainUpperBoundM:TERRAIN_UPPER_BOUND_M});status('Level cruise · look freely · Shift faster · L stops · WASD or Q/E takes control');}
  syncUI();canvas.focus();
}
$('levelCruise').onclick=toggleLevelCruise;
$('skimSpeed').oninput=()=>{state.skimSpeedMps=Number($('skimSpeed').value)/3.6;$('skimSpeedValue').value=Math.round(state.skimSpeedMps*3.6);event('skim-speed',{value:state.skimSpeedMps});};
function liftOff(){
  if(quiet){status('Finish the quiet measurement before lifting off');return;}
  if(state.pose.mode!=='walk'){status('Already flying · W goes where you look · Q descends');canvas.focus();return;}
  manual(true);lift=takeoff(state);flightMotion.speedMps=8;keys.delete('Space');stage='Lifting off · free flight';event('free-lift-off',{heightM:45,durationSeconds:2});status('Lifting off · W flies where you look · E climbs · Q descends');
}
function toggleFlight(){
  if(flightMotion.level)manual();
  if(state.pose.mode==='walk'){liftOff();return;}
  if(landOnFoot(state)){manual();stage='On foot · your meadow';status('On foot · WASD walks · Shift runs');event('manual-land');}
  else status('Descend near the meadow with Q to land');
}
function returnSaved(){
  if(quiet){status('Finish the quiet measurement before returning');return;}
  const full=guidedRoute(bookmark),b=blindBands(state),from={...state.pose},returnStages=full.stages.slice(6);
  if(from.altitudeM>b.viewM){const aligned={...from,eastM:bookmark.pose.eastM,northM:bookmark.pose.northM,pitch:-.55,yaw:bookmark.pose.yaw};returnStages[0].from=from;returnStages[0].to=aligned;returnStages[1].from=aligned;}
  else{const duration=clamp(Math.hypot(from.eastM-bookmark.pose.eastM,from.northM-bookmark.pose.northM,from.altitudeM-bookmark.pose.altitudeM)/Math.max(3,from.altitudeM*.1),4,36);returnStages.splice(0,returnStages.length,{name:'Return to your saved place',duration,from,to:{...bookmark.pose},logHeight:false,walk:false});}
  route=finishRoute(returnStages,bookmark);lift=null;flightMotion.speedMps=0;routeTime=0;direction=1;paused=false;clearKeys();event('return-start',{duration:route.duration});
}
$('journey').onclick=startJourney;
$('lift').onclick=liftOff;
$('walk').onclick=()=>{if(quiet)return;if(clearance(state.pose)>2){status('Descend to the meadow before walking');return;}state.skimEnabled=false;bookmark=structuredClone(state);captureBookmark();route=meadowRoute(bookmark);routeTime=0;direction=1;paused=false;clearKeys();tracing=true;trace.length=0;event('meadow-walk-start');status('Gentle walk past the structures · take control whenever you like');};
$('manual').onclick=()=>{if(!quiet)manual();};
$('survey').onclick=()=>{if(quiet||clearance(state.pose)>8){status('Start the landscape survey near the meadow');return;}state.skimEnabled=false;bookmark=structuredClone(state);captureBookmark();route=landscapeRoute(bookmark);routeTime=0;direction=1;paused=false;clearKeys();tracing=true;trace.length=0;demands.length=0;event('survey-start');status('Landscape survey · accelerated local flight');};
$('edgeReview').onclick=()=>{if(quiet||clearance(state.pose)>8){status('Start the grass review near the meadow');return;}state.skimEnabled=false;bookmark=structuredClone(state);captureBookmark();route=grassEdgeRoute(bookmark);routeTime=0;direction=1;paused=false;lift=null;clearKeys();tracing=true;trace.length=0;demands.length=0;event('grass-edge-review-start',{duration:route.duration});status('Grass transition review · low flight and return');};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume journey':'Pause journey';event('pause',{paused});};
$('reverse').onclick=()=>{if(route){direction*=-1;paused=false;$('pause').textContent='Pause journey';event('reverse',{direction});status('Reversing continuously from this point');}else status('Start a journey to reverse its path');};
$('save').onclick=async()=>{bookmark=structuredClone(state);persist();await captureBookmark();status('This place and its light are saved');event('save');};
$('return').onclick=returnSaved;
$('home').onclick=()=>{if(quiet){status('Finish the current measurement before returning home');return;}state=initialState();bookmark=structuredClone(state);route=null;lift=null;flightMotion.speedMps=0;paused=false;clearKeys();tracing=false;syncUI();stage='Starting meadow · ready to walk';status('Starting study meadow restored');};
$('plain').onclick=()=>{if(quiet){status('Finish the current measurement before visiting the plain');return;}manual();state.pose={...state.pose,eastM:400,northM:-112,altitudeM:terrain(400,-112)+1.7,yaw:0,pitch:-.07,mode:'walk'};bookmark=structuredClone(state);bookmarkCheck=null;returnCheck=null;syncUI();stage='Open plain · ready to walk';event('visit-open-plain');status('Open plain · walk here, or lift off to explore the surrounding hills');};
$('grassbox').onchange=()=>{state.grassbox=$('grassbox').checked;event('grassbox',{value:state.grassbox});};
$('wind').onchange=()=>{state.windPlaying=$('wind').checked;event('wind-play',{value:state.windPlaying});};
$('grassHeight').oninput=()=>{state.grassHeightScale=Number($('grassHeight').value);event('grass-height',{value:state.grassHeightScale});};
$('grassWidth').oninput=()=>{state.grassWidthScale=Number($('grassWidth').value);event('grass-width',{value:state.grassWidthScale});};
$('reach').onchange=()=>{state.grassReach=$('reach').value;event('grass-reach',{value:state.grassReach});};
$('density').onchange=()=>{state.grassDensity=$('density').value;event('density',{value:state.grassDensity});};
$('daylight').oninput=()=>{state.daylight=Number($('daylight').value);event('daylight',{value:state.daylight});};
$('day').onclick=()=>{state.daylight=1;syncUI();status('Daylight · the light stays in place');};
$('dusk').onclick=()=>{state.daylight=.18;syncUI();status('Dusk under the Blind · full illumination returns above it');};
$('night').onclick=()=>{state.daylight=0;syncUI();status('Night under the Blind · simulated canopy stars · full light above');};
$('comfort').onchange=()=>{if(route){syncUI();status('Change camera comfort between journeys');return;}state.comfortMotion=$('comfort').checked;event('comfort',{value:state.comfortMotion});};
$('concealment').onchange=()=>{state.concealment=$('concealment').checked;event('concealment',{value:state.concealment});};
$('blindHeight').onchange=()=>{if(route){syncUI();status('Change the height between journeys');return;}const value=Number($('blindHeight').value)*1000;if(value<20000||value>200000||!Number.isFinite(value)){syncUI();status('Choose a study height from 20 to 200 km');return;}state.blindHeightM=value;syncUI();event('blind-height',{value});};
$('trample').onclick=()=>{if(clearance(state.pose)<2){state.disturbance={eastM:state.pose.eastM,northM:state.pose.northM,radiusM:3};event('disturbance');status('A 3 m patch of grass is flattened and will persist on return');}else status('Trample while on the ground');};
$('downloadSave').onclick=()=>download(new Blob([host.storage.encode({state:JSON.parse(saveState(state)),bookmark:JSON.parse(saveState(bookmark))})],{type:'application/json'}),'sphere-infinite-meadow-1.0.0-save.json');
$('importSave').onclick=()=>{if(quiet){status('Finish the current measurement before importing a save');return;}$('saveFile').click();};
$('saveFile').onchange=async()=>{try{const file=$('saveFile').files[0];if(!file)return;if(file.size>1000000)throw Error('Save exceeds 1 MB');const imported=host.storage.decode(await file.text(),{allowLegacy:true});const s=parseState(JSON.stringify(imported.state)),nextBookmark=parseState(JSON.stringify(imported.bookmark));state=s;bookmark=nextBookmark;bookmarkCheck=null;returnCheck=null;route=null;lift=null;paused=false;tracing=false;flightMotion.speedMps=0;clearKeys();persist();syncUI();stage='Saved meadow · explore freely';event('explicit-scene-load');status('Saved meadow loaded');}catch(e){status('Import rejected: '+e.message);}finally{$('saveFile').value='';}};
function panelHidden(hide){document.querySelector('.panel').hidden=hide;$('show').hidden=!hide;}
$('hide').onclick=()=>panelHidden(true);$('show').onclick=()=>panelHidden(false);
function evidence(){return {schema:1,date:new Date().toISOString(),scope:'Infinite Meadow pack 1.0.0 in the browser Observatory; short observations are not production H1 certification',pack:host.inspect(),inspection:$('grassLayers').value,state:JSON.parse(saveState(state)),bookmark:JSON.parse(saveState(bookmark)),lighting:sceneLight(state),flight:{lifting:!!lift,speedMps:flightMotion.speedMps,skimming:state.skimEnabled,cruising:flightMotion.cruise,levelCruise:flightMotion.level?{...flightMotion.level}:null,levelMinimumAltitudeM:LEVEL_MIN_ALTITUDE_M,terrainUpperBoundM:TERRAIN_UPPER_BOUND_M},renderer:renderer.info,residency:residency.counters(),viewport:{width:canvas.width,height:canvas.height},blind:blindBands(state),frame,returnCheck,quietStats,measurements,events:[...events],demands:[...demands],frames:[...trace],missing:{wholeProcessGpuMemory:null,osPresentation:null,scientificOptics:'Visual study with stage magic and accelerated travel',productionCapacity:'Not certified'}};}
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(evidence(),null,2)],{type:'application/json'}),link=$('evidenceLink');if(link.href.startsWith('blob:'))host.revokeURL(link.href);link.href=host.objectURL(blob);link.hidden=false;status('Evidence ready · download the file below');};
$('inspect').onclick=()=>{$('evidenceText').hidden=!$('evidenceText').hidden;if(!$('evidenceText').hidden){const e=evidence();$('evidenceText').value=JSON.stringify({...e,quietStats:e.quietStats?{...e.quietStats,rows:undefined}:null,measurements:e.measurements.map(s=>({...s,rows:undefined})),frameRecords:e.frames.length,demandRecords:e.demands.length,frames:undefined,demands:undefined,lastFrame:e.frames.at(-1)},null,2);}};
function startMeasurement(kind='stationary'){
  if($('grassLayers').value!=='all'){status('Choose Full meadow before measuring');return;}
  if(recording||route||lift||quiet){status('Finish recording, flight or the current measurement first');return;}
  if(!['stationary','level'].includes(kind)&&clearance(state.pose)>8){status('Start this measurement near the meadow');return;}
  stopLevelCruise(flightMotion);quiet={kind,start:performance.now(),rendererStart:renderer.frame,pose:saveState(state),original:structuredClone(state),rows:[],elapsed:0};clearKeys();tracing=false;flightMotion.speedMps=0;
  if(kind==='level')startLevelCruise(state,flightMotion);
  else if(kind!=='stationary'){state.skimEnabled=false;state.pose.mode=kind==='walking'?'walk':'flight';state.pose.pitch=kind==='walking'?-.12:kind==='skimming'?-.04:-.25;state.pose.altitudeM=terrain(state.pose.eastM,state.pose.northM)+(kind==='walking'?1.7:31.7);if(kind==='skimming')startSkimming(state);}
  status(`${kind==='stationary'?'Quiet sample':kind==='walking'?'Meadow walk':kind==='level'?'Level cruise':kind==='skimming'?'Fast grass skim':'Low flight'} · 900 drawn frames · no recording`);event('measurement-start',{kind});
}
$('quiet').onclick=()=>startMeasurement();$('walkingSample').onclick=()=>startMeasurement('walking');$('flyingSample').onclick=()=>startMeasurement('flying');$('skimSample').onclick=()=>startMeasurement('skimming');
$('levelSample').onclick=()=>startMeasurement('level');
function finishQuiet(){
  const rows=quiet.rows,seen=new Set(),valid=rows.flatMap(r=>r.gpuResolved).filter(r=>{if(r.ms===null||r.disjoint||r.frame<=quiet.rendererStart||r.frame>rows.at(-1).rendererFrame||seen.has(r.frame))return false;seen.add(r.frame);return true;}),p95=values=>{const v=values.sort((a,b)=>a-b);return v.length?v[Math.floor((v.length-1)*.95)]:null;};
  quietStats={scope:'Local Biome Pack observation without recording; not production H1',kind:quiet.kind,viewport:{width:canvas.width,height:canvas.height},sampleState:JSON.parse(quiet.pose),frames:rows.length,elapsedMs:performance.now()-quiet.start,drawsPerSecond:1000*(rows.length-1)/rows.slice(1).reduce((s,r)=>s+r.intervalMs,0),prepareP95Ms:p95(rows.map(r=>r.prepareMs)),prepareMaxMs:Math.max(...rows.map(r=>r.prepareMs)),renderCpuP95Ms:p95(rows.map(r=>r.renderCpuMs)),gpuP95Ms:p95(valid.map(r=>r.ms)),gpuSamples:valid.length,uploadBytes:rows.reduce((s,r)=>s+r.uploadBytes,0),descriptorBytes:rows.reduce((s,r)=>s+r.descriptorBytes,0),completeFrames:rows.filter(r=>r.ready===r.required).length,stageEyeErrorMaxM:Math.max(...rows.map(r=>Math.hypot(r.grassCenter.eastM-r.pose.eastM,r.grassCenter.northM-r.pose.northM,r.heroCenter.eastM-r.pose.eastM,r.heroCenter.northM-r.pose.northM))),distanceM:rows.reduce((s,r,i)=>s+(i?r.movementM:0),0),cellChanges:rows.filter((r,i)=>i&&r.stageVersion!==rows[i-1].stageVersion).length,savedPoseUnchanged:saveState(state)===quiet.pose,rows};
  const original=quiet.original;quiet=null;state=original;stopLevelCruise(flightMotion);flightMotion.speedMps=0;syncUI();quietStats.restoredStateExact=saveState(state)===saveState(original);measurements.push(quietStats);if(measurements.length>6)measurements.shift();
  status(`Sample complete · ${quietStats.drawsPerSecond.toFixed(1)} draws/s · ${quietStats.gpuP95Ms?.toFixed(2)??'—'} ms GPU p95`);event('measurement-complete',{kind:quietStats.kind});
}
async function startRecording(){
  if(quiet){status('Finish quiet measurement before recording');return;}
  recordedChunks=[];const stream=host.media(canvas.captureStream(30)),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm;codecs=vp8';
  recording=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});recording.ondataavailable=e=>{if(e.data.size)recordedChunks.push(e.data);};recording.start(1000);$('record').textContent='Stop recording';status('Recording the meadow view · requested 30 fps');event('capture-start',{mime});
}
async function stopRecording(){
  const r=recording;if(!r)return;await new Promise(resolve=>{r.onstop=resolve;r.stop();});host.stopMedia(r.stream);recording=null;
  const previousURL=$('recordingLink').href;if(previousURL.startsWith('blob:'))host.revokeURL(previousURL);
  const blob=new Blob(recordedChunks,{type:r.mimeType}),url=host.objectURL(blob);recordedChunks=[];
  $('recordingLink').href=url;$('recordingLink').hidden=false;$('recordingPreview').src=url;$('recordingPreview').hidden=false;$('record').textContent='Record journey';event('capture-end',{bytes:blob.size});status('Recording ready to watch or download');
}
$('record').onclick=()=>recording?stopRecording():startRecording();
$('atlas').onclick=()=>{const image=$('atlasPreview');image.hidden=!image.hidden;if(!image.hidden)image.src=renderer.atlasCanvas.toDataURL('image/png');};
host.listen(window,'keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.code==='KeyH'&&!e.repeat){panelHidden(!document.querySelector('.panel').hidden);return;}
  if(e.code==='KeyT'&&!e.repeat){e.preventDefault();toggleSkimming();return;}
  if(e.code==='KeyL'&&!e.repeat){e.preventDefault();toggleLevelCruise();return;}
  const navigation=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyZ','KeyX','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  if(!navigation.includes(e.code)&&!['Space','KeyF','ShiftLeft','ShiftRight'].includes(e.code))return;
  e.preventDefault();if(quiet)return;
  if(flightMotion.level&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE'].includes(e.code))manual(true);
  // Retain quick taps until the next movement frame, even if keyup arrives first.
  if(route&&navigation.includes(e.code))manual(true);keys.add(e.code);if(navigation.includes(e.code))tappedKeys.add(e.code);
  if((e.code==='KeyE'||e.code==='Space')&&keys.has('KeyE')&&keys.has('Space')){liftOff();return;}
  if(e.code==='KeyF'&&!e.repeat){if(route)manual();toggleFlight();}
});
host.listen(window,'keyup',e=>keys.delete(e.code));host.listen(window,'blur',()=>{clearKeys();drag=null;});host.listen(document,'visibilitychange',()=>{clearKeys();drag=null;last=0;});
let drag=null;host.listen(canvas,'pointerdown',e=>{if(route&&!quiet)manual();drag=[e.clientX,e.clientY];canvas.focus();canvas.setPointerCapture(e.pointerId);});host.listen(canvas,'pointerup',()=>drag=null);host.listen(canvas,'lostpointercapture',()=>drag=null);
host.listen(canvas,'pointermove',e=>{if(!drag||route||quiet)return;const sensitivity=(state.comfortMotion&&state.pose.altitudeM>blindBands(state).startM) ? .0015 : .004;state.pose.yaw+=(e.clientX-drag[0])*sensitivity;state.pose.pitch=clamp(state.pose.pitch-(e.clientY-drag[1])*sensitivity,-1.5,1.5);drag=[e.clientX,e.clientY];});
function formatM(x){if(x>=1e9)return(x/1e9).toFixed(2)+' million km';if(x>=1e6)return(x/1e6).toFixed(2)+' thousand km';if(x>=1000)return(x/1000).toFixed(2)+' km';return x.toFixed(2)+' m';}
function hud(t,m){if(t-hudLast<125)return;hudLast=t;$('height').textContent=formatM(state.pose.altitudeM-GROUND_DATUM);const a=address(state.pose);$('address').textContent=`E ${a.east.cell}:${a.east.localM.toFixed(3)} · N ${a.north.cell}:${a.north.localM.toFixed(3)}`;
  const travel=state.pose.mode==='walk'?'on foot':route?(paused?'guided · paused':'guided flight'):flightMotion.level?(flightMotion.speedMps*3.6).toFixed(0)+' km/h · level cruise':state.skimEnabled?(flightMotion.speedMps*3.6).toFixed(0)+' km/h · skimming':(flightMotion.speedMps||flightSpeed(state.pose)).toFixed(1)+' m/s';$('clearance').textContent=formatM(clearance(state.pose)+1.7)+' · '+travel;$('lift').disabled=state.pose.mode==='flight'||!!quiet;$('lift').textContent=lift?'Lifting off…':state.pose.mode==='flight'?'Flying · Q to descend':'Lift off · Space + E';
  $('skim').disabled=$('cruise').disabled=!!quiet||!!route;$('skim').textContent=state.skimEnabled?'Free flight · T':'Skim grass · T';$('cruise').textContent=flightMotion.cruise?'Stop cruising':'Cruise';
  $('levelCruise').disabled=!!quiet||!!route;$('levelCruise').textContent=flightMotion.level?'Stop level cruise · L':'Level cruise · L';
  $('flightHelp').innerHTML=state.skimEnabled?'WASD steers · Q/E adjusts height<br>Shift faster · T free flight · F lands':'WASD fly · Q/E down/up · Z/X turn<br>Shift faster · T skims · F lands';
  $('footerHelp').textContent=state.skimEnabled?'WASD travel · Q/E trim height · Shift faster · drag / arrows look · T free flight · F land':'Space + E lift off · T skim grass · WASD travel · Q/E down/up · Shift faster · drag / arrows look · F walk';
  if(flightMotion.level){$('flightHelp').innerHTML='Straight course above the highest hills<br>Look freely · Shift faster · L stops';$('footerHelp').textContent='Level cruise · fixed height and heading · drag / arrows look · Shift faster · L stops · WASD or Q/E takes control';}
  $('tier').textContent=clearance(state.pose)<90?'Rolling ground · lit grass':clearance(state.pose)<140?'Grass → meadow surface':m.reveal<.01?'Ordinary sky':'Sphere · finite-depth structures';
  $('ready').textContent=residency.ready?(residency.required.length?`${residency.tiles.size}/${residency.required.length} cells · ${residency.counters().tufts} tufts`:'Distant view ready'):'NOT READY · '+residency.failure;
  $('stage').textContent=stage;$('mode').textContent=quiet?'MEASURING':route?(paused?'PAUSED':direction>0?'JOURNEY':'REVERSED'):flightMotion.level?'LEVEL':state.skimEnabled?'SKIM':state.pose.mode.toUpperCase();$('progress').style.width=(route?routeTime/route.duration*100:0)+'%';
  const recent=metrics.slice(-60),sum=recent.reduce((s,v)=>s+v.intervalMs,0);$('performance').textContent=`${sum?(1000*recent.length/sum).toFixed(0):'—'} draws/s · ${m.drawCalls} calls`;
}
async function compareReturn(saved){const before=bookmarkCheck;if(!before)return;const match={exactState:saveState(state)===saveState(saved),tileDigestMatches:residency.digest()===before.digest,sameViewport:canvas.width===before.width&&canvas.height===before.height};const after=await frameSnapshot();let changedPixels=0,maxChannelDifference=0,totalDifference=0;
  if(match.sameViewport)for(let i=0;i<after.bytes.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(after.bytes[i+c]-before.snapshot.bytes[i+c]);changed||=d!==0;maxChannelDifference=Math.max(maxChannelDifference,d);totalDifference+=d;}if(changed)changedPixels++;}
  returnCheck={...match,pixelsMatch:after.hash===before.snapshot.hash,beforePixels:before.snapshot.hash,afterPixels:after.hash,pixelDifference:match.sameViewport?{changedPixels,maxChannelDifference,meanChannelDifference:totalDifference/after.bytes.length}:null};event('return-comparison',returnCheck);}
function tick(t){
  host.frame(tick);const start=performance.now(),rawDt=last?(t-last)/1000:1/60,dt=Math.min(.1,rawDt);last=t;frame++;let completed=null;const frameKeys=new Set([...keys,...tappedKeys]);tappedKeys.clear();if(state.skimEnabled&&flightMotion.cruise)frameKeys.add('KeyW');
  if(!quiet){if(state.windPlaying)state.windTime+=dt;if(lift){if(!stepTakeoff(state,lift,dt)){lift=null;stage='Free flight · skim the hills';event('free-lift-complete');}}
  else if(route&&!paused){routeTime=clamp(routeTime+dt*direction,0,route.duration);const next=routePose(route,routeTime);state.pose=next.pose;stage=next.stage;
    if((next.complete&&direction>0)||(routeTime===0&&direction<0)){completed=route.bookmark;state=structuredClone(completed);route=null;event('journey-complete',{exactState:saveState(state)===saveState(completed)});persist();syncUI();status('Back at the same place, with the same light and grass');}
  }else if(!route){const turn=(state.comfortMotion&&state.pose.altitudeM>blindBands(state).startM?COMFORT_TURN_RAD_S:Math.PI/4)*dt;state.pose.yaw+=((frameKeys.has('ArrowRight')||frameKeys.has('KeyX')?1:0)-(frameKeys.has('ArrowLeft')||frameKeys.has('KeyZ')?1:0))*turn;state.pose.pitch=clamp(state.pose.pitch+((frameKeys.has('ArrowUp')?1:0)-(frameKeys.has('ArrowDown')?1:0))*turn,-1.5,1.5);const moved=flightMotion.level?stepLevelCruise(state,flightMotion,frameKeys,dt):move(state,frameKeys,dt,flightMotion);if(flightMotion.level)stage=moved.phase==='climbing'?'Climbing above the highest hills':'Level cruise · straight course';if(moved.phase==='envelope-limit'){stage='Level cruise stopped at the study boundary';status('Study coordinate limit reached · take control to turn back');event('level-envelope-stop');}if(moved.landed){stage='On foot · your meadow';status('Landed here · WASD walks · Space + E lifts off');event('free-land');}}}
  if(quiet&&quiet.kind!=='stationary'){quiet.elapsed+=dt;if(state.windPlaying)state.windTime+=dt;state.pose.yaw=quiet.original.pose.yaw+.20*Math.sin(quiet.elapsed*.35);if(quiet.kind==='level')stepLevelCruise(state,flightMotion,new Set(),dt);else move(state,new Set(quiet.kind==='skimming'?['KeyW','ShiftLeft']:['KeyW']),dt,flightMotion);if(quiet.kind==='flying')state.pose.altitudeM=terrain(state.pose.eastM,state.pose.northM)+31.7;stage=quiet.kind==='walking'?'Measuring meadow walk':quiet.kind==='level'?'Measuring level cruise':quiet.kind==='skimming'?'Measuring fast grass skim':'Measuring low flight';}
  const prepareStart=performance.now(),sharedFrame=host.stage.follow(state.pose,state.windTime),changed=residency.update(sharedFrame.eye,state.grassDensity,state.grassReach),prepareMs=performance.now()-prepareStart;
  if(changed&&tracing&&demands.length<2048)demands.push({version:residency.version,frame,required:[...residency.required],hashes:[...residency.tiles.values()].map(v=>[v.key,v.contentHash])});
  if(!residency.ready){paused=true;status('Movement paused while detail is unavailable: '+residency.failure);}
  const m=renderer.draw(state,residency,{inspection:$('grassLayers').value});if(completed)compareReturn(completed);
  const counts=residency.counters();const row={frame,rendererFrame:m.rendererFrame,stageVersion:residency.version,timestamp:t,intervalMs:rawDt*1000,prepareMs,renderCpuMs:m.renderCpuMs,gpuMs:m.gpuMs,gpuSampleFrame:m.gpuSampleFrame,gpuDisjoint:m.gpuDisjoint,gpuResolved:m.gpuResolved,drawCalls:m.drawCalls,uploadBytes:m.uploadBytes,descriptorBytes:m.descriptorBytes,gpuBufferBytes:m.gpuBytes,gpuTextureBytes:m.gpuTextureBytes,grassboxInstances:m.grassboxInstances,grassboxBlades:m.grassboxBlades,grassCenter:m.grassCenter,windTime:state.windTime,originId:m.originId,reveal:m.reveal,interiorDaylight:m.interiorDaylight,terrainAlpha:m.terrainAlpha,heroCenter:m.heroCenter,terrainRadiusM:m.terrainRadiusM,pose:{...state.pose},global:toGlobal(state.pose),address:address(state.pose),required:residency.required.length,ready:counts.ready,retainedTufts:counts.tufts,submittedTufts:m.instanceCount,collisionClearanceM:clearance(state.pose),speedMps:flightMotion.speedMps,skimming:state.skimEnabled,skimTargetClearanceM:state.skimClearanceM,movementM:Math.hypot(state.pose.eastM-lastPose.eastM,state.pose.northM-lastPose.northM,state.pose.altitudeM-lastPose.altitudeM),stage};
  row.levelCruising=!!flightMotion.level;row.levelHeadingRad=flightMotion.level?.headingRad??null;row.levelAltitudeM=flightMotion.level?.altitudeM??null;row.levelPhase=flightMotion.level?(flightMotion.level.elapsedS<flightMotion.level.entrySeconds?'climbing':'level'):null;row.groundEyeClearanceM=clearance(state.pose)+1.7;
  if(tracing&&trace.length<12000)trace.push(row);metrics.push(row);if(metrics.length>900)metrics.shift();if(quiet){quiet.rows.push(row);if(quiet.rows.length===900)finishQuiet();}lastPose={...state.pose};hud(t,m);
}
host.frame(tick);status('Walk the meadow, then lift off from wherever you stop');



return {snapshot:()=>({state:JSON.parse(saveState(quiet?.original??state)),bookmark:JSON.parse(saveState(bookmark))}),dispose(){clearKeys();route=null;lift=null;quiet=null;if(recording){recording.ondataavailable=null;if(recording.state!=='inactive')recording.stop();for(const track of recording.stream.getTracks())track.stop();recording=null;}for(const id of ['recordingLink','evidenceLink']){const href=$(id).href;if(href.startsWith('blob:'))host.revokeURL(href);}residency.tiles.clear();residency.required.length=0;metrics.length=events.length=trace.length=demands.length=measurements.length=0;renderer.queries.length=0;}};
}
