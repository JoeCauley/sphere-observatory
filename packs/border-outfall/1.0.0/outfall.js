import {entrance,eye,initial,restore,nearValve,waterStep} from './model.js';
import {onBorder} from '../../kit/border-profile.js';
import {leaveNorthM,chartFor,toMeadow} from '../../kit/surface-route.js';
import {apronHeight,borderUniforms} from '../../kit/meadow-border.js';
import {initialState as newMeadow,parseState as readMeadow,terrain} from '../../infinite-meadow/1.3.0/model.js';
import '../../../sphere-atlas.js';
import {supportAt,moveBody,resolvePose,tunnelStart,tunnelEnd,tunnelLength,tunnelHeight} from './border.js';
import {createRenderer} from './render.js';
import {veilAt,createVeil} from '../../kit/veil.js';
import {ascentShape,arrivalShape,advance,heightAt} from '../../kit/flight.js';

const id='border-outfall',version='1.0.0',key='sphere-biome:'+id+':'+version;
const $=id=>document.getElementById(id),canvas=$('world'),say=text=>{$('status').textContent=text;};
const air={profile:'outfall-salt',haze:[{baseM:0,topM:1200,perKm:.12}],blind:null};
const storage=window.frameElement?.dataset.worldKey ? parent.SphereBiomeLibrary.saveStorage(window.frameElement.dataset.worldKey) : localStorage;
let state=initial(),hadSave=false,rejected=false;
try{const raw=storage.getItem(key);if(raw){state=restore(JSON.parse(raw));hadSave=true;}}catch{rejected=true;say('The stored viewpoint could not be read. Your original save has been kept.');}
let renderer;
try{renderer=createRenderer(canvas);}catch(error){$('error').textContent=error.message;throw error;}
const stageHost=window.frameElement?.dataset.worldKey?parent.SphereStageFrame:null;
const surfaceEntry=window.frameElement?.surfaceEntry;
const tunnelGate=surfaceEntry?.passage||stageHost?.servicePassage?.(window);
// Only the service installation exposes the grassy apron. An enclosed passage
// can draw its first frame without fetching the Meadow renderer and grass workers.
let MeadowRenderer,GrassStage;
if(!surfaceEntry?.passage){
  const [fieldModule,grassModule]=await Promise.all([
    import('../../infinite-meadow/1.3.0/renderer.js'),import('../../infinite-meadow/1.3.0/grass-stage.js')
  ]);
  MeadowRenderer=fieldModule.Renderer;GrassStage=grassModule.GrassStage;
}
const address=stageHost?.surfaceAddress?.(),atlas=window.SphereAtlas;
const home=address?.home||atlas.byId('r10c0'),edge=address?.edge||atlas.northEdge(home.id);
const chart=chartFor(home,edge,address?.radiusKm||149597870.7),datum=terrain(chart.eastM,chart.northM);
const floorAt=(east,north)=>apronHeight(chart,datum,east,north);
let field=null,coverStage=null,meadow=newMeadow(),solar=null;
try{const record=JSON.parse(storage.getItem('sphere-pack:infinite-meadow:1.3.0'));if(record?.state)meadow=readMeadow(JSON.stringify(record.state));}catch{}
const drawApron=(p,elapsed)=>{
  if(!field){field=new MeadowRenderer(canvas,stageHost?{atlasShader:parent.SphereBiomeSurface.glsl(parent.SphereAtlas),backdrop:p=>stageHost.surfaceBackdrop(window,p)}:{});field.lightAt=()=>stageHost?.surfaceLight(window,state.pose);}
  coverStage??=new GrassStage({ground:terrain});
  meadow.pose=toMeadow(p,chart,datum);if(meadow.windPlaying && surfaceEntry?.active!==false)meadow.windTime+=Math.min(.1,elapsed);
  field.borderMap=borderUniforms(chart,p);field.gateDatum=datum;
  coverStage.update(meadow.pose,meadow.grassDensity,meadow.grassReach);
  field.draw(meadow,coverStage,{timing:false});
};
let approachCruise=null,crossing=false,crossingFailed=false;
if(surfaceEntry?.geographic){state.pose={...surfaceEntry.pose};}
else if(surfaceEntry?.edge && stageHost?.surfaceAddress?.()?.edge.id===surfaceEntry.edge){
  state.pose={...surfaceEntry.pose};
  if(Number.isFinite(surfaceEntry.windTime))meadow.windTime=surfaceEntry.windTime;
  if(surfaceEntry.cruise)approachCruise={...surfaceEntry.cruise};
  say('Approaching the Outfall along the Meadow surface.');
}
resolvePose(state.pose,renderer.colliders,floorAt);
const veil=createVeil(document,air.blind,air.profile);
const url=new URL(location.href),entry=url.searchParams.get('arrival'),hold=url.searchParams.get('hold')==='1',from=url.searchParams.get('fromM');
if(entry){for(const k of ['arrival','hold','fromM'])url.searchParams.delete(k);history.replaceState(null,'',url);}
let frame=0,raf=0,last=0,lastSave=0,turn=Number(state.open),disposed=false,drag=null,script=null,kept=null;
const keys=new Set();let readyDone,arrivedDone;
const ready=new Promise(r=>{readyDone=r;}),arrived=new Promise(r=>{arrivedDone=r;});
const manualPose=()=>({...((script?.keep)??kept??state.pose)});
function save(){
  if(rejected||surfaceEntry?.active===false)return false;
  if(surfaceEntry?.passage){stageHost?.savePassage(window,manualPose());return true;}
  try{storage.setItem(key,JSON.stringify({schema:1,pose:manualPose(),bookmark:state.bookmark,open:state.open,levels:state.levels}));return true;}catch{return false;}
}
function manual(){
  if(crossing || surfaceEntry?.active===false || script?.held || script&&!script.interruptible)return false;
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
$('back').onclick=()=>{if(manual()){state.pose={...state.bookmark};resolvePose(state.pose,renderer.colliders,floorAt);approachCruise=null;say('Back at your saved viewpoint.');}canvas.focus();};
$('hide').onclick=()=>{$('panel').hidden=true;$('show').hidden=false;canvas.focus();};
$('show').onclick=()=>{$('panel').hidden=false;$('show').hidden=true;canvas.focus();};
$('leavePack').onclick=()=>{if(window===top)location.href='../../../';};
canvas.addEventListener('pointerdown',e=>{if(!manual())return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus();});
canvas.addEventListener('pointermove',e=>{if(!drag)return;state.pose.yaw+=(e.clientX-drag[0])*.003;state.pose.pitch=Math.max(-1.5,Math.min(1.5,state.pose.pitch-(e.clientY-drag[1])*.003));drag=[e.clientX,e.clientY];});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('lostpointercapture',()=>drag=null);
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyL','KeyF','KeyZ','KeyX','Space','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',e=>{
  if(!movement.has(e.code)||e.target?.closest?.('button,input,select')&&e.code==='Space')return;
  e.preventDefault();if(!manual())return;keys.add(e.code);if(e.repeat)return;
  const p=state.pose;
  if(['KeyL','KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyF','Space'].includes(e.code))approachCruise=null;
  if(e.code==='Space'&&p.mode==='walk'){p.mode='flight';p.altitudeM+=.35;}
  if(e.code==='KeyF'&&p.mode==='flight'&&p.altitudeM-supportAt(renderer.colliders,p,floorAt)<8){p.mode='walk';p.altitudeM=supportAt(renderer.colliders,p,floorAt);}
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
  approachCruise=null;
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
  const height=from==='blind'&&air.blind?(air.blind.baseM+air.blind.topM)/2:Math.max(15,+from||1100);
  const start={...outside,altitudeM:height,northM:outside.northM-Math.min(72,Math.max(0,-outside.northM)),pitch:-1.49};
  const steps=[segment(start,outside,8,arrivalShape(height,outside.altitudeM,air.blind))];
  if(exit.length){
    let prev=outside;
    for(const next of [...exit.slice(0,-1).reverse(),target]){steps.push(aisleSegment(prev,next));prev=next;}
  }
  run(steps,{held:hold,result:'arrived',restoreMode:hadSave&&target.mode}).then(arrivedDone);
}else{if(entry==='ground')state.pose=entrance();arrivedDone('ground');}
function portalSide(before,p){
  if(p.mode!=='walk'||crossing||Math.abs(p.eastM)>3.3||p.altitudeM>tunnelHeight)return null;
  if(p.northM>=tunnelEnd && before<tunnelEnd)return 'far';
  if(surfaceEntry?.passage && p.northM<=tunnelStart && before>tunnelStart)return 'near';
  return null;
}
async function takePassage(side){
  if(crossing || !stageHost?.canCrossSurface(window))return false;
  crossing=true;
  const ok=await stageHost.leavePassage(window,side);
  if(!ok){crossing=false;state.pose.northM=side==='far'?tunnelEnd-.5:tunnelStart+.5;say('Crossing paused. Walk forward to retry.');}
  return ok;
}
// The walk test scales elapsed walking time on the same swept, dry aisle used by the keyboard.
async function walkTunnel(seconds,direction=1){
  const p=state.pose;
  if(!Number.isFinite(seconds)||seconds<0||![1,-1].includes(direction)||p.mode!=='walk'||crossing||script ||
    p.northM<tunnelStart-1||p.northM>tunnelEnd+1||Math.abs(p.eastM)>3.2)return false;
  const before=p.northM,delta=Math.min(tunnelLength+2,seconds*3.3)*direction;
  moveBody(p,renderer.colliders,0,0,delta,floorAt);
  const side=portalSide(before,p);
  return side?takePassage(side):Math.abs((p.northM-before)-delta)<.001;
}
function tick(t){
  if(disposed)return;const elapsed=Math.max(0,(t-(last||t))*.001),dt=Math.min(.10,elapsed);last=t;const p=state.pose;
  if(script&&!script.held){
    const seg=script.steps[0],f=advance(seg,dt);for(const k of ['eastM','northM','yaw','pitch'])p[k]=seg.from[k]+(seg.to[k]-seg.from[k])*f.pos;
    p.mode='flight';p.altitudeM=heightAt(seg.from.altitudeM,seg.to.altitudeM,f.alt);
    if(f.done){Object.assign(p,seg.to,{mode:'flight'});script.steps.shift();if(!script.steps.length){const ended=script;kept=ended.keep;script=null;if(ended.restoreMode)p.mode=ended.restoreMode;ended.done(ended.result);}}
  }else if(!script && !crossing && surfaceEntry?.active!==false){
    const dir=(a,b)=>Number(keys.has(a))-Number(keys.has(b)),fast=keys.has('ShiftLeft')||keys.has('ShiftRight');
    p.yaw+=dir('KeyX','KeyZ')*dt*.95;
    const speed=(p.mode==='walk'?(fast?7:3.3):(fast?22:8)*Math.max(1,p.altitudeM/55))*dt;
    let x=dir('KeyD','KeyA'),z=dir('KeyW','KeyS');const len=Math.max(1,Math.hypot(x,z));x/=len;z/=len;
    const c=Math.cos(p.yaw),s=Math.sin(p.yaw),fly=p.mode==='flight',dz=z*(fly?Math.cos(p.pitch):1);
    const dx=(x*c+dz*s)*speed,dn=(-x*s+dz*c)*speed,dy=fly?(dir('KeyE','KeyQ')+z*Math.sin(p.pitch))*speed:0;
    const wasNorth=p.northM;
    if(approachCruise){
      const heading=approachCruise.heading, rate=approachCruise.baseMps*(fast?1.5:1);
      const east=Math.sin(heading),north=Math.cos(heading);
      let travel=rate*elapsed;
      // The level course aimed at the door ends over its approach path.
      const door=north>0 && Math.abs(p.eastM-east*(p.northM+18)/north)<6;
      if(door)travel=Math.min(travel,Math.max(0,(-18-p.northM)/north));
      const oldX=p.eastM,oldZ=p.northM;
      moveBody(p,renderer.colliders,east*travel,0,north*travel,floorAt);
      if(travel<rate*elapsed || Math.hypot(p.eastM-oldX,p.northM-oldZ)<travel-.001){
        approachCruise=null;say('Level cruise stopped at the wall. Q descends. Press F near a surface to land.');
      }
    }else{
      const inTunnel=p.mode==='walk' && p.altitudeM<tunnelHeight && p.northM>=tunnelStart && p.northM<=tunnelEnd && Math.abs(p.eastM)<3.5;
      const clock=inTunnel?Number($('walkClock').value):1;
      const along=clock>1 ? Math.max(tunnelStart-p.northM-.01,Math.min(tunnelEnd-p.northM+.01,dn*clock)) : dn;
      moveBody(p,renderer.colliders,dx*clock,dy,along,floorAt);
    }
    const side=portalSide(wasNorth,p);
    if(side)void takePassage(side);
    if(!surfaceEntry?.passage && !crossingFailed && p.northM<=leaveNorthM && !onBorder(p,chart.halfWidthM,2800) && p.northM<wasNorth && p.altitudeM<1600){
      const address=stageHost?.surfaceAddress?.();
      if(address && stageHost.canCrossSurface?.(window)){
        crossing=true;
        stageHost.crossSurface(window,{edge:address.edge.id,pose:{...p},cruise:null,windTime:meadow.windTime}).then(ok=>{
          if(!ok){crossing=false;crossingFailed=true;say('The Meadow crossing paused. Turn back toward the wall and try again.');}
        });
      }
    }
    if(p.northM>leaveNorthM)crossingFailed=false;
  }
  waterStep(state,dt);turn+=(Number(state.open)-turn)*(1-Math.exp(-dt*4));
  const apron=!surfaceEntry?.passage && (p.northM<0 || (p.northM<34 && Math.abs(p.eastM)<7));
  solar=stageHost?.surfaceLight(window,p)??{direct:1};
  if(apron){renderer.resize();drawApron(p,elapsed);}
  renderer.draw(state,t*.001,turn,{daylight:solar.direct,radiusM:(address?.radiusKm??149597870.7)*1000,overMeadow:apron,resize:!apron,nearTint:tunnelGate?.near.tint,farTint:tunnelGate?.far.tint});veil.draw(p.altitudeM,t);if(++frame===3)readyDone(true);
  $('action').hidden=!!script||!nearValve(p);$('action').textContent=(state.open?'Close':'Open')+' bypass valve · E';$('mode').textContent=p.mode==='walk'?'ON FOOT':approachCruise?'LEVEL CRUISE':'FLIGHT';
  const inPassage=Math.abs(p.eastM)<=3.5 && p.altitudeM<tunnelHeight && p.northM>=tunnelStart-9 && p.northM<=tunnelEnd;
  $('walkClockField').hidden=p.mode!=='walk'||!inPassage;
  if(inPassage && p.northM>=tunnelStart && !crossing){
    const km=Math.max(0,(tunnelEnd-p.northM)/1000).toFixed(1),label=km+' km to '+(tunnelGate?.far.name||'the far portal');
    if($('status').textContent!==label)say(label);
  }
  if(surfaceEntry?.active!==false && t-lastSave>2500){save();lastSave=t;}raf=requestAnimationFrame(tick);
}
function dispose(){if(disposed)return;disposed=true;save();cancelAnimationFrame(raf);keys.clear();veil.dispose();field?.dispose();renderer.dispose();}
window.SphereBiome={id,version,contract:'sphere-biome/1',ready,arrived,pose:()=>({...state.pose}),air:()=>structuredClone(air),ascend:ascent,
  walkTunnel,begin:()=>{if(script?.held)script.held=false;return arrived;},save,dispose,
  inspect:()=>({frames:frame,light:solar,levelCruising:!!approachCruise,meadowTiles:coverStage?.tiles.size??0,meadowWind:meadow.windTime,held:!!script?.held,scripted:!!script,veil:veilAt(air.blind,state.pose.altitudeM),valveOpen:state.open,levels:[...state.levels]})};
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
raf=requestAnimationFrame(tick);
