import {entrance,eye,initial,restore,nearValve,waterStep} from './model.js';
import {solidAt} from './geometry.js';
import {createRenderer} from './render.js';
import {veilAt,createVeil} from '../../kit/veil.js';
import {ascentShape,arrivalShape,advance,heightAt} from '../../kit/flight.js';

const id='border-outfall',version='1.0.0',key='sphere-biome:'+id+':'+version;
const $=id=>document.getElementById(id),canvas=$('world'),say=text=>{$('status').textContent=text;};
const air={haze:[],blind:{baseM:4000,topM:5200,edgeM:350}};
const storage=window.frameElement?.dataset.worldKey ? parent.SphereBiomeLibrary.saveStorage(window.frameElement.dataset.worldKey) : localStorage;
let state=initial(),hadSave=false,rejected=false;
try{const raw=storage.getItem(key);if(raw){state=restore(JSON.parse(raw));hadSave=true;}}catch{rejected=true;say('The stored viewpoint could not be read. Your original save has been kept.');}
let renderer;
try{renderer=createRenderer(canvas);}catch(error){$('error').textContent=error.message;throw error;}
const veil=createVeil(document,air.blind);
const url=new URL(location.href),entry=url.searchParams.get('arrival'),hold=url.searchParams.get('hold')==='1',from=url.searchParams.get('fromM');
if(entry){for(const k of ['arrival','hold','fromM'])url.searchParams.delete(k);history.replaceState(null,'',url);}
let frame=0,raf=0,last=0,lastSave=0,turn=Number(state.open),disposed=false,drag=null,script=null,kept=null;
const keys=new Set();let readyDone,arrivedDone;
const ready=new Promise(r=>{readyDone=r;}),arrived=new Promise(r=>{arrivedDone=r;});
const manualPose=()=>({...((script?.keep)??kept??state.pose)});
function save(){
  if(rejected)return false;
  try{storage.setItem(key,JSON.stringify({schema:1,pose:manualPose(),bookmark:state.bookmark,open:state.open,levels:state.levels}));return true;}catch{return false;}
}
function manual(){
  if(script?.held || script&&!script.interruptible)return false;
  if(script){const done=script.done;script=null;done('taken-over');}
  kept=null;return true;
}
function toggleValve(){
  if(!nearValve(state.pose)||!manual())return;
  state.open=!state.open;save();
  say(state.open?'The bypass is open. Water is entering the first section.':'The bypass is shut. Water downstream is still moving.');
}
$('action').onclick=()=>{toggleValve();canvas.focus();};
$('save').onclick=()=>{state.bookmark=manualPose();if(save())say('Viewpoint and bypass saved.');canvas.focus();};
$('back').onclick=()=>{if(manual()){state.pose={...state.bookmark};say('Back at your saved viewpoint.');}canvas.focus();};
$('hide').onclick=()=>{$('panel').hidden=true;$('show').hidden=false;canvas.focus();};
$('show').onclick=()=>{$('panel').hidden=false;$('show').hidden=true;canvas.focus();};
$('leavePack').onclick=()=>{if(window===top)location.href='../../../';};
canvas.addEventListener('pointerdown',e=>{if(!manual())return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus();});
canvas.addEventListener('pointermove',e=>{if(!drag)return;state.pose.yaw+=(e.clientX-drag[0])*.003;state.pose.pitch=Math.max(-1.5,Math.min(1.5,state.pose.pitch-(e.clientY-drag[1])*.003));drag=[e.clientX,e.clientY];});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('lostpointercapture',()=>drag=null);
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','KeyZ','KeyX','Space','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',e=>{
  if(!movement.has(e.code)||e.target?.closest?.('button,input,select')&&e.code==='Space')return;
  e.preventDefault();if(!manual())return;keys.add(e.code);if(e.repeat)return;
  const p=state.pose;
  if(e.code==='Space'&&p.mode==='walk'){p.mode='flight';p.altitudeM+=.35;}
  if(e.code==='KeyF'&&p.mode==='flight'&&p.altitudeM<9&&!solidAt(renderer.colliders,p.eastM,eye,p.northM)){p.mode='walk';p.altitudeM=eye;}
  if(e.code==='KeyE'&&p.mode==='walk')toggleValve();
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();drag=null;});
const approach=()=>({...entrance(),eastM:-3.8,northM:-23,altitudeM:4.6,pitch:-.075,mode:'flight'});
function segment(from,to,seconds,shape=null){return {from:{...from},to:{...to},t:0,seconds,shape};}
function run(steps,options){return new Promise(done=>{const keep=manualPose();kept=null;script={keep,steps,done,held:!!options.held,result:options.result,restoreMode:options.restoreMode,interruptible:!!options.interruptible};state.pose={...steps[0].from,mode:'flight'};});}
// Waypoints along the cross-gallery and the dry aisle. The same route works in
// reverse for a traveler returning to a saved valve or viewpoint under the roof.
function exitAisle(p){
  if(p.northM<=-.1 || p.altitudeM>=8.2)return [];
  const via=p.northM>34?[{...p,northM:38.2},{...p,eastM:-1.5,northM:38.2}]:[{...p,eastM:-1.5}];
  return [...via,{...p,eastM:-1.5,northM:-10}];
}
function aisleSegment(from,to){
  return segment(from,to,Math.max(.25,Math.hypot(to.eastM-from.eastM,to.northM-from.northM)/8));
}
function ascent(options={}){
  if(script)return Promise.resolve('taken-over');
  const target=Math.min(1500000,Math.max(10,+options.toAltitudeM||3000)),p={...state.pose};
  if(p.altitudeM>=target*.99)return Promise.resolve('revealed');
  const steps=[];let start=p;
  for(const next of exitAisle(p)){steps.push(aisleSegment(start,next));start=next;}
  const to={...start,altitudeM:target,pitch:options.handoff?-1.50:-1.46,yaw:start.yaw+.6,mode:'flight'};
  steps.push(segment(start,to,8,ascentShape(Math.max(.1,start.altitudeM),target,air.blind)));
  return run(steps,{interruptible:true,result:'revealed'});
}
if(entry==='air'){
  const target=hadSave?{...state.pose}:approach(), exit=exitAisle(target);
  const outside=exit.length?exit[exit.length-1]:target;
  const height=from==='blind'?(air.blind.baseM+air.blind.topM)/2:Math.max(15,+from||1100);
  const start={...outside,altitudeM:height,northM:outside.northM-Math.min(72,Math.max(0,-outside.northM)),pitch:-1.49};
  const steps=[segment(start,outside,8,arrivalShape(height,outside.altitudeM,air.blind))];
  if(exit.length){
    let prev=outside;
    for(const next of [...exit.slice(0,-1).reverse(),target]){steps.push(aisleSegment(prev,next));prev=next;}
  }
  run(steps,{held:hold,result:'arrived',restoreMode:hadSave&&target.mode}).then(arrivedDone);
}else{if(entry==='ground')state.pose=entrance();arrivedDone('ground');}
function tick(t){
  if(disposed)return;const dt=Math.min(.10,Math.max(0,(t-(last||t))*.001));last=t;const p=state.pose;
  if(script&&!script.held){
    const seg=script.steps[0],f=advance(seg,dt);for(const k of ['eastM','northM','yaw','pitch'])p[k]=seg.from[k]+(seg.to[k]-seg.from[k])*f.pos;
    p.mode='flight';p.altitudeM=heightAt(seg.from.altitudeM,seg.to.altitudeM,f.alt);
    if(f.done){Object.assign(p,seg.to,{mode:'flight'});script.steps.shift();if(!script.steps.length){const ended=script;kept=ended.keep;script=null;if(ended.restoreMode)p.mode=ended.restoreMode;ended.done(ended.result);}}
  }else if(!script){
    const dir=(a,b)=>Number(keys.has(a))-Number(keys.has(b)),fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
    p.yaw+=dir('KeyX','KeyZ')*dt*.95;
    const speed=(p.mode==='walk'?(fast?7:3.3):(fast?22:8)*Math.max(1,p.altitudeM/55))*dt;
    let x=dir('KeyD','KeyA'),z=dir('KeyW','KeyS');const len=Math.max(1,Math.hypot(x,z));x/=len;z/=len;
    const c=Math.cos(p.yaw),s=Math.sin(p.yaw),fly=p.mode==='flight',dz=z*(fly?Math.cos(p.pitch):1);
    const dx=(x*c+dz*s)*speed,dn=(-x*s+dz*c)*speed,dy=fly?(dir('KeyE','KeyQ')+z*Math.sin(p.pitch))*speed:0;
    const steps=Math.max(1,Math.min(60,Math.ceil(Math.hypot(dx,dn,dy)/.35)));
    for(let i=0;i<steps;i++){const e=p.eastM+dx/steps,n=p.northM+dn/steps,a=Math.max(eye,Math.min(1500000,p.altitudeM+dy/steps));
      if(!solidAt(renderer.colliders,e,p.altitudeM,p.northM))p.eastM=e;
      if(!solidAt(renderer.colliders,p.eastM,p.altitudeM,n))p.northM=n;
      if(fly&&!solidAt(renderer.colliders,p.eastM,a,p.northM))p.altitudeM=a;}
  }
  waterStep(state,dt);turn+=(Number(state.open)-turn)*(1-Math.exp(-dt*4));
  renderer.draw(state,t*.001,turn);veil.draw(p.altitudeM,t);if(++frame===3)readyDone(true);
  $('action').hidden=!!script||!nearValve(p);$('action').textContent=(state.open?'Close':'Open')+' bypass valve · E';$('mode').textContent=p.mode==='walk'?'ON FOOT':'FLIGHT';
  if(t-lastSave>2500){save();lastSave=t;}raf=requestAnimationFrame(tick);
}
function dispose(){if(disposed)return;disposed=true;save();cancelAnimationFrame(raf);keys.clear();veil.dispose();renderer.dispose();}
window.SphereBiome={id,version,contract:'sphere-biome/1',ready,arrived,pose:()=>({...state.pose}),air:()=>structuredClone(air),ascend:ascent,
  begin:()=>{if(script?.held)script.held=false;return arrived;},save,dispose,
  inspect:()=>({frames:frame,held:!!script?.held,scripted:!!script,veil:veilAt(air.blind,state.pose.altitudeM),valveOpen:state.open,levels:[...state.levels]})};
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
raf=requestAnimationFrame(tick);
