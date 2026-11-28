import {packId,version,room,origin,sidewalk,objectId,chairPosition} from './address.mjs';
import {chairControls} from './chair-control.mjs';
import {factoryChair,currentChair} from './furnishing.mjs';
import {floorAt,blocks,eyeHeight} from './block.mjs';
import {createRenderer} from './render.mjs';
import {advance,heightAt} from '../../kit/flight.js';

const $=id=>document.getElementById(id),canvas=$('street'),renderer=createRenderer(canvas);
const world=frameElement?.dataset.worldKey,instance=frameElement?.dataset.locationId??packId;
const key='sphere-biome:'+packId+':'+version+(instance===packId?'':':'+instance);
const storage=world?parent.SphereBiomeLibrary.saveStorage(world):localStorage;
const id=objectId(world??'preview',instance),params=new URLSearchParams(location.search);
const endpoint=world?'/api/furnishings?'+new URLSearchParams({world,instance,...room}):null;
let record=factoryChair(id),chair=chairPosition('A'),lastLight={time:0,direct:1};
const ready=Promise.withResolvers(),arrived=Promise.withResolvers();
const listeners=new AbortController(),opts={signal:listeners.signal};
let pose={...sidewalk},bookmark={...sidewalk},script=null,held=null,last=0,raf=0,disposed=false,drag=null,noticeUntil=0;
const keys=new Set(),valid=p=>p&&['eastM','northM','altitudeM','yaw','pitch'].every(k=>Number.isFinite(p[k]))&&['walk','flight'].includes(p.mode);
try{
  const s=JSON.parse(storage.getItem(key));
  if(s?.schema===1){if(valid(s.pose))pose={...s.pose};if(valid(s.bookmark))bookmark={...s.bookmark};}
}catch{}
if(params.get('arrival')==='ground')pose={...sidewalk};
const entry=frameElement?.surfaceEntry;
if(entry?.geographic&&valid(entry.pose))pose={...entry.pose};
function say(message){$('notice').textContent=message;noticeUntil=performance.now()+3500;}
function adopt(value){record=currentChair(record,value);const p=record.pose;chair={x:origin.x+p.x,y:origin.y+p.y,z:origin.z+p.z,yaw:p.yaw};}
async function readChair(){if(!endpoint)return;const r=await fetch(endpoint,{cache:'no-store',signal:listeners.signal});if(!r.ok)throw Error('Could not open the furnishing record ('+r.status+').');adopt((await r.json()).chair);}
function save(){
  if(entry?.active===false)return false;
  try{storage.setItem(key,JSON.stringify({schema:1,pose:script?.keep??held??pose,bookmark}));return true;}catch{return false;}
}
function floor(x,z){return floorAt(renderer.floors,x,z);}
function blocked(x,z,y){return blocks(renderer.colliders,x,z,y,operating.collision());}
function clearFootprint(){
  if(pose.mode!=='walk'||!blocked(pose.eastM,pose.northM,pose.altitudeM-eyeHeight))return;
  // A concurrent placement or a cancelled carry can restore a seat under the traveler.
  for(let radius=.18;radius<=1.81;radius+=.18)for(let i=0;i<16;i++){
    const a=i*Math.PI/8,x=pose.eastM+Math.sin(a)*radius,z=pose.northM+Math.cos(a)*radius,h=floor(x,z);
    if(Math.abs(h+eyeHeight-pose.altitudeM)<.20&&!blocked(x,z,h)){pose={...pose,eastM:x,northM:z,altitudeM:h+eyeHeight};return;}
  }
}
const operating=chairControls({panel:$('chairAction'),button:$('chairButton'),cancelButton:$('cancelChair'),hint:$('chairHint'),canvas,endpoint,
  pose:()=>pose,record:()=>record,position:()=>chair,adopt,refresh:readChair,say,onRelease:clearFootprint,signal:listeners.signal});
function settle(p){
  const g=floor(p.eastM,p.northM);
  return {...p,altitudeM:p.mode==='walk'?g+eyeHeight:Math.max(p.altitudeM,g+eyeHeight)};
}
function move(dx,dz,dy=0){
  // Sweep in short steps so a long input frame cannot jump a jamb or a chair.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz,dy)/.16));
  for(let i=0;i<steps;i++){
    const walking=pose.mode==='walk',feet=pose.altitudeM-eyeHeight;
    const test=(x,z)=>{const surface=floor(x,z);return (!walking||surface-feet<.31)&&!blocked(x,z,walking?surface:feet);};
    const x=pose.eastM+dx/steps;if(test(x,pose.northM))pose.eastM=x;
    const z=pose.northM+dz/steps;if(test(pose.eastM,z))pose.northM=z;
    const ground=floor(pose.eastM,pose.northM);
    if(walking)pose.altitudeM=ground+eyeHeight;
    else{const h=Math.max(ground+eyeHeight,pose.altitudeM+dy/steps);if(!blocked(pose.eastM,pose.northM,h-eyeHeight))pose.altitudeM=h;}
  }
}
function landOrLift(){
  if(script?.held)return;
  if(pose.mode==='flight'){
    const f=floor(pose.eastM,pose.northM);
    if(pose.altitudeM-f>14||blocked(pose.eastM,pose.northM,f))return say('Descend with Q to an open landing place.');
    pose=settle({...pose,mode:'walk'});
  }else{
    if(blocked(pose.eastM,pose.northM,pose.altitudeM+1))return say('Step into the open street to lift off.');
    pose={...pose,mode:'flight',altitudeM:pose.altitudeM+2};
  }
  held=null;
}
function interrupt(){if(script?.held)return false;if(script){const done=script.done;script=null;done('taken-over');}held=null;return true;}
function ascend({toAltitudeM=25000,handoff=false}={}){
  operating.cancel();
  if(!script&&pose.altitudeM>=toAltitudeM*.999)return Promise.resolve('revealed');
  if(script)return script.promise;
  const task=Promise.withResolvers(),from={...pose},to={...pose,mode:'flight',pitch:handoff?-Math.PI/2:-1.1,altitudeM:toAltitudeM};
  pose.mode='flight';script={from,to,keep:held??from,t:0,seconds:3.5,done:task.resolve,promise:task.promise,held:false};return task.promise;
}
function begin(){if(script)script.held=false;return arrived.promise;}
function flightStep(dt){
  const s=script;if(s.held)return;
  const {pos,alt,done}=advance(s,dt);
  pose={...s.to,altitudeM:heightAt(s.from.altitudeM,s.to.altitudeM,alt),pitch:s.from.pitch+(s.to.pitch-s.from.pitch)*pos};
  if(done){pose={...s.to};held=s.keep;script=null;s.done(s.arriving?'arrived':'revealed');}
}
function step(dt){
  if(script)return flightStep(dt);
  const h=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),v=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  pose.yaw+=(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*1.55*dt;
  const y=Number(keys.has('KeyE'))-Number(keys.has('KeyQ')),flight=pose.mode==='flight';
  if(!h&&!v&&(!flight||!y))return;
  const speed=(flight?Math.max(6,pose.altitudeM*.7):(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.2:2.45))*dt/Math.max(1,Math.hypot(h,v));
  const a=pose.yaw,forward=v*(flight?Math.cos(pose.pitch):1);
  move((Math.sin(a)*forward+Math.cos(a)*h)*speed,(-Math.cos(a)*forward+Math.sin(a)*h)*speed,flight?(v*Math.sin(pose.pitch)+y)*speed:0);
}
function frame(t){
  if(disposed)return;
  const dt=last?Math.min(.09,Math.max(0,(t-last)/1000)):0;last=t;step(dt);
  lastLight=world?parent.SphereStageFrame.surfaceLight(window,pose)??lastLight:lastLight;
  operating.sync();renderer.draw(pose,operating.preview()??chair,lastLight,operating.carrying());
  if(world)parent.SphereFieldCamera?.submit(canvas);
  const walking=pose.mode==='walk';
  if($('mode').textContent!==(walking?'On foot':'In flight')){
    $('mode').textContent=walking?'On foot':'In flight';$('guide').textContent=walking?'WASD walk · Drag to look · Shift hurry':'WASD fly · Q descend · F land';
    $('mobility').textContent=walking?'Lift off · Space':'Land · F';
  }
  if(noticeUntil&&t>noticeUntil){$('notice').textContent='';noticeUntil=0;}
  ready.resolve();raf=requestAnimationFrame(frame);
}
function inspect(){return {...renderer.inspect(),scripted:!!script,held:!!script?.held,veil:0,chair:structuredClone(record),light:{...lastLight},carrying:operating.carrying(),preview:operating.preview()};}
function dispose(){
  if(disposed)return;save();disposed=true;
  listeners.abort();cancelAnimationFrame(raf);if(script){script.done('taken-over');script=null;}
  keys.clear();renderer.dispose();
}
window.SphereBiome={id:packId,version,contract:'sphere-biome/1',ready:ready.promise,arrived:arrived.promise,
  pose:()=>({...pose}),air:()=>({profile:'city-thin',haze:[{baseM:0,topM:900,perKm:.12}],blind:null}),inspect,ascend,begin,save,dispose};
window.addEventListener('pagehide',dispose,{once:true});
canvas.addEventListener('pointerdown',e=>{if(script?.held)return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus();},opts);
canvas.addEventListener('pointermove',e=>{if(!drag||!interrupt())return;pose.yaw+=(e.clientX-drag[0])*.004;pose.pitch=Math.min(1.48,Math.max(-1.48,pose.pitch-(e.clientY-drag[1])*.004));drag=[e.clientX,e.clientY];},opts);
canvas.addEventListener('lostpointercapture',()=>{drag=null;},opts);
window.addEventListener('keydown',e=>{
  if(pose.mode==='walk'&&!script&&['KeyE','Escape'].includes(e.code)){
    e.preventDefault();if(!e.repeat){if(e.code==='Escape')operating.cancel();else void operating.activate();}return;
  }
  if(!['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Space','KeyF','KeyE','KeyQ'].includes(e.code))return;
  if(e.target instanceof HTMLButtonElement&&e.code==='Space')return;
  e.preventDefault();if(!interrupt())return;keys.add(e.code);
  if(!e.repeat&&(e.code==='Space'&&pose.mode==='walk'||e.code==='KeyF'&&pose.mode==='flight'))landOrLift();
},opts);
window.addEventListener('keyup',e=>keys.delete(e.code),opts);
window.addEventListener('blur',()=>{keys.clear();drag=null;},opts);
$('save').onclick=()=>{bookmark={...pose};say(save()?'Camera saved.':'Camera save unavailable.');$('camera').open=false;canvas.focus();};
$('recall').onclick=()=>{if(!script){operating.cancel();held=null;pose=settle(bookmark);clearFootprint();say('Saved camera restored.');}$('camera').open=false;canvas.focus();};
$('mobility').onclick=()=>{landOrLift();$('camera').open=false;canvas.focus();};
$('leavePack').onclick=()=>{location.assign(new URL('../../../',import.meta.url));};
try{
  await readChair();
  pose=settle(pose);clearFootprint();
  if(params.get('arrival')==='air'){
    const keep={...pose},to={...pose,mode:'flight',altitudeM:Math.max(3.4,pose.altitudeM)},from={...to,altitudeM:Number(params.get('fromM'))||1500000,pitch:-Math.PI/2};
    pose=from;script={from,to,keep,t:0,seconds:3.5,held:params.get('hold')==='1',done:arrived.resolve,promise:arrived.promise,arriving:true};
  }else arrived.resolve('ground');
  if(params.has('arrival')){const url=new URL(location.href);for(const k of ['arrival','fromM','hold'])url.searchParams.delete(k);history.replaceState(null,'',url);}
  raf=requestAnimationFrame(frame);
}catch(error){$('notice').textContent=error.message;ready.reject(error);}
