import {cameraState,readCamera,nativeHost} from './native-habitat.mjs';
import {project,unproject} from './surface-route.js';
import {districtPoint,districtLocation,nearestSite} from '../border-transport/0.10.0/district.mjs';
import {districtFor} from '../border-transport/0.10.0/survey.mjs';
import {generateStation} from '../border-transport/0.10.0/station.mjs';
import {constrainExterior,recoverWallPose,walker as pedestrian} from '../border-transport/0.10.0/motion.mjs';
import {surveyForestWalk} from '../super-jungle/1.0.0/forest-walk.mjs';
import {surveyJungle} from '../super-jungle/1.0.0/survey.mjs';

import {surveyViolet} from '../violet-labyrinth/1.0.0/survey.mjs';

const id=document.body.dataset.habitat,version='1.0.0',canvas=document.getElementById('landscape'),label=document.getElementById('pilotStatus');
const context=canvas.getContext('2d',{alpha:false}),keys=new Set(),entry=frameElement?.surfaceEntry,params=new URLSearchParams(location.search);
const events=new AbortController(),signal=events.signal;
let key='sphere-biome:'+id+':'+version;
let host,release,storage,item,district,station,forest,pose,manual,walker,frames=0,raf=0,previous=0,drag=null,dead=false,preparing=false;
let script=null,held=params.get('arrival')==='air'&&params.get('hold')==='1',arrive,first,fail,dirty=true,lastPaint='';
const ready=new Promise((r,j)=>{first=r;fail=j;}),arrived=new Promise(r=>{arrive=r;});
function borderPoint(p){
  const ll=unproject(item.occurrence,p.eastM,p.northM,district.origin.radiusM);
  return {...districtPoint(district,ll.latitude,ll.longitude),altitudeM:p.altitudeM};
}
function habitatPoint(p,safe){
  const ll=districtLocation(district,safe.eastM,safe.northM);
  return {...p,...project(item.occurrence,ll.latitude,ll.longitude,district.origin.radiusM),altitudeM:safe.altitudeM};
}
function stateAt(p){const s=cameraState(host,item,p);s.fov=entry?.horizontalFov??s.fov;return s;}
function nativeView(){
  const s=stateAt(pose);
  if(pose.mode==='walk'&&walker){
    Object.assign(s,{walkMode:true,walkSurface:true,walkPosition:walker.walkPosition.slice(),walkVelocity:0,
      position:walker.position.slice(),terrainAnchor:walker.terrainAnchor,siteAnchor:walker.siteAnchor,surfaceLock:true});
  }
  return s;
}
function floor(s){
  const f=host.SphereGround.frame(s),local=f.local(s.position);
  return host.SphereGround.height(s,f,local[0],local[2])*1000;
}
function enterWalk(p){
  const s=stateAt(p),position=s.position.slice(),mesh=host.SphereSites.site(s);
  // The highest vertical hit can be a canopy. A walker returns to the
  // support directly beneath the saved feet, including below an overhang.
  const local=mesh.local(position),eye=host.SphereSites.EYE,step=.00045;
  const foot=mesh.world([local[0],local[1]-eye+step,local[2]]);
  const hit=host.SphereLanding.probe(s,foot,host.SphereMath.mul(mesh.basis[1],-1),.002);
  host.SphereLanding.enter(s,position,{activate:false,grounded:true});host.SphereLanding.activate(s);
  if(Number.isFinite(hit.distance)){
    local[1]+=step-hit.distance+.00002;s.position=mesh.world(local);s.walkPosition=host.SphereSites.site(s).local(s.position);
  }
  walker=s;
  return readCamera(host,item,s,'walk');
}
function finish(result){
  if(!script)return;const old=script;script=null;held=false;
  if(old.arrival){history.replaceState(null,'',location.pathname);arrive(result);}
  old.resolve?.(result);dirty=true;
}
function save(){
  if(!manual||!storage||entry?.active===false)return false;
  try{storage.setItem(key,JSON.stringify({schema:1,occurrence:item.occurrence.id,pose:manual}));return true;}catch{return false;}
}
function ascend({toAltitudeM}={}){
  if(!Number.isFinite(toAltitudeM))return Promise.reject(Error('Invalid handoff altitude'));
  if(Math.abs(pose.altitudeM-toAltitudeM)<.02&&pose.pitch<=-1.4)return Promise.resolve('revealed');
  if(script)finish('taken-over');walker=null;
  return new Promise(resolve=>{script={start:{...pose},end:{...pose,altitudeM:toAltitudeM,pitch:-1.49,mode:'flight'},elapsed:0,duration:4,resolve};pose={...pose,mode:'flight'};});
}
function move(dt){
  let yaw=pose.yaw+((+keys.has('ArrowRight'))-(+keys.has('ArrowLeft')))*dt*.85;
  let pitch=Math.max(-1.49,Math.min(1.49,pose.pitch+((+keys.has('ArrowUp'))-(+keys.has('ArrowDown')))*dt));
  if(drag?.dx||drag?.dy){yaw+=drag.dx*.004;pitch=Math.max(-1.49,Math.min(1.49,pitch-drag.dy*.004));drag.dx=drag.dy=0;}
  const start=pose,p={...pose,yaw,pitch};
  if(p.mode==='walk'){
    if(!walker)enterWalk(p);
    const facing=stateAt(p);walker.forward=facing.forward;walker.up=facing.up;walker.time=facing.time;
    host.SphereLanding.step(walker,keys,dt);
    pose={...readCamera(host,item,walker,'walk'),yaw,pitch};
  }else{
    const f=(+keys.has('KeyW'))-(+keys.has('KeyS')),side=(+keys.has('KeyD'))-(+keys.has('KeyA')),
      climb=(+keys.has('KeyE'))-(+keys.has('KeyQ')),boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const cp=Math.cos(pitch),amount=dt/Math.max(1,Math.hypot(side,f*cp,climb+f*Math.sin(pitch)));
    if(f||side||climb){
      const old=stateAt(start),clearanceM=Math.max(0,p.altitudeM-floor(old));
      const speed=host.SphereStageFrame.movementSpeed(Math.min(1800,9+.4*clearanceM)*(boost?4:1),dt,{boost,clearanceM});
      p.eastM+=(f*cp*Math.sin(yaw)+side*Math.cos(yaw))*speed*amount;
      p.northM+=(-f*cp*Math.cos(yaw)+side*Math.sin(yaw))*speed*amount;
      p.altitudeM+=(climb+f*Math.sin(pitch))*speed*amount;
      const to=stateAt(p),delta=host.SphereMath.sub(to.position,old.position),distance=host.SphereMath.length(delta);
      if(distance>0&&clearanceM<180){
        const contact=host.SphereLanding.probe(old,old.position,host.SphereMath.mul(delta,1/distance),distance+.0003);
        if(contact.distance<distance+.00028){
          const fraction=Math.max(0,(contact.distance-.0003)/distance);
          for(const field of ['eastM','northM','altitudeM'])p[field]=start[field]+(p[field]-start[field])*fraction;
        }
      }
      p.altitudeM=Math.max(p.altitudeM,floor(stateAt(p))+1.7);
    }
    pose=p;
  }
  if(district?.sites.length && (start.eastM!==pose.eastM||start.northM!==pose.northM||start.altitudeM!==pose.altitudeM)){
    const from=borderPoint(start),to=borderPoint(pose),site=nearestSite(district,to.eastM);
    if(station?.address.key!==site.address.key)station=generateStation(site.address);
    const safe=constrainExterior(station,district,from,to);
    if(safe!==to){
      pose=habitatPoint(pose,safe);
      if(pose.mode==='walk')pose=enterWalk(pose);
    }
  }
  if(keys.size||yaw!==start.yaw||pitch!==start.pitch)manual={...pose};
}
function tick(time){
 if(dead)return;
 try{
  const dt=Math.max(0,Math.min(.075,(time-(previous||time))/1000));previous=time;
  // Keep the departure image while the shared renderer prepares another
  // surface camera, including a return to an Atlas mark.
  if(host.SphereStageFrame.habitatFrameHeld?.(window)){raf=requestAnimationFrame(tick);return;}
  if(script&&!held){
    script.elapsed+=dt;const t=Math.min(1,script.elapsed/script.duration),e=t*t*(3-2*t);
    pose={...script.start,mode:'flight'};
    for(const k of ['altitudeM','yaw','pitch','eastM','northM'])pose[k]=script.start[k]+(script.end[k]-script.start[k])*e;
    if(t===1)finish(script.arrival?'arrived':'revealed');
  }else if(!script&&!held&&entry?.active!==false&&(pose.mode==='walk'||keys.size||drag))move(dt);
  const app=host.SphereApp;
  const moving=!!(script||keys.size||drag||app.playing);
  const {width,height,adaptiveScale}=app.previewViewport(canvas.getBoundingClientRect(),time,moving);
  const stamp=[pose.mode,pose.eastM,pose.northM,pose.altitudeM,pose.yaw,pose.pitch,app.sceneSeconds,app.viewRevision,width,height].join('/');
  if(dirty||stamp!==lastPaint||app.renderer.needsFrame||host.SphereFieldCamera?.need(canvas)){
    const s=stateAt(pose);
    if(pose.mode==='walk'&&walker){s.walkMode=true;s.walkSurface=true;s.siteAnchor=walker.siteAnchor;s.terrainAnchor=walker.terrainAnchor;s.walkPosition=walker.walkPosition;}
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const source=host.SphereStageFrame.drawHabitat(s,width,height,!!district,adaptiveScale);
    context.drawImage(source,0,0,width,height);host.SphereFieldCamera?.submit(canvas);dirty=false;lastPaint=stamp;
  }
  const o=item.occurrence,fall=forest?.fallen;
  const distance=point=>Math.hypot(pose.eastM-point.eastM,pose.northM-point.northM);
  const nearFall=fall&&distance(fall.local)<distance(o.tree.local);
  const landmark=nearFall?fall.local:(o.tree??o.fork)?.local;
  const range=landmark?Math.hypot(pose.eastM-landmark.eastM,pose.northM-landmark.northM):0;
  const text=held?'Holding above the survey':(pose.mode==='walk'?'On foot':'Flight')+' · '+(nearFall?'Fallen giant':o.tree?'Buttressed tree':'Mineral fork')+' · '+(range>=1000?(range/1000).toFixed(1)+' km':Math.round(range)+' m');
  if(label.textContent!==text)label.textContent=text;
  frames++;if(first){first();first=null;}
  raf=requestAnimationFrame(tick);
 }catch(e){label.textContent=e.message;fail(e);console.error(e);}
}
function launch(){
  if(!pose||held||!keys.has('Space')||!keys.has('KeyE')||pose.mode!=='walk')return;
  if(walker)host.SphereLanding.release(walker);
  walker=null;pose={...pose,mode:'flight',altitudeM:pose.altitudeM+.3};manual={...pose};dirty=true;
}
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight']);
addEventListener('keydown',e=>{
  if(!movement.has(e.code))return;e.preventDefault();if(held||!pose)return;
  host.SphereStageFrame.resumeHabitatInput?.(window);
  if(script)finish('taken-over');keys.add(e.code);launch();
  if(!e.repeat&&e.code==='KeyF'&&pose.mode==='flight'&&pose.altitudeM-floor(stateAt(pose))<7){pose=enterWalk(pose);manual={...pose};}
},{signal});
addEventListener('keyup',e=>keys.delete(e.code),{signal});
addEventListener('blur',()=>{keys.clear();save();},{signal});
canvas.addEventListener('pointerdown',e=>{if(held)return;host?.SphereStageFrame.resumeHabitatInput?.(window);canvas.focus();drag={x:e.clientX,y:e.clientY,dx:0,dy:0};canvas.setPointerCapture(e.pointerId);},{signal});
canvas.addEventListener('pointermove',e=>{if(!drag)return;drag.dx+=e.clientX-drag.x;drag.dy+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;},{signal});
canvas.addEventListener('lostpointercapture',()=>{if(drag&&pose){pose.yaw+=drag.dx*.004;pose.pitch=Math.max(-1.49,Math.min(1.49,pose.pitch-drag.dy*.004));manual={...pose};}drag=null;},{signal});
function dispose(){if(dead)return;dead=true;save();cancelAnimationFrame(raf);if(script)finish('taken-over');events.abort();release?.();canvas.width=canvas.height=1;}
addEventListener('pagehide',dispose,{once:true,signal});
window.SphereBiome={id,version,contract:'sphere-biome/1',ready,arrived,begin(){held=false;return arrived;},ascend,save,dispose,nativeView,pose:()=>({...pose}),
  air:()=>({haze:[],blind:null}),inspect:()=>({frames,veil:0,held,scripted:!!script,occurrence:item?.occurrence?.id,tree:item?.occurrence?.tree?.id,fallen:forest?.fallen.id,fork:item?.occurrence?.fork?.id,
    preparingGround:preparing && !!(host.SphereApp.renderer.geometryPreparation || host.SphereGround?.needsFrame),
    chunks:host?.SphereGround?.info?.chunks,bytes:host?.SphereGround?.info?.bytes})};
async function start(){
  ({host,release}=await nativeHost());
  const lib=host.SphereBiomeLibrary;await lib.ready;
  const realHost=parent!==window&&parent===host,base=host.SphereApp.getState();
  item=realHost?lib.entry(frameElement?.dataset.locationId??id):null;
  district=lib.entry('border-transport')?.transport;
  if(!item){
    const state={...base,collection:true,seed:713,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2};
    host.SphereApp.setState(state);
    district=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',state.radius*1000);
    const violet=id==='violet-labyrinth',f=violet?surveyViolet(state,host):surveyJungle(state,district,'r10c0',host);
    if(!f)throw Error('The native landmark could not be surveyed.');
    item={id,name:violet?'Violet Labyrinth':'Super Jungle',plotId:f.plot.id,direction:f.direction,occurrence:f.occurrence};
    if(!violet)item.jungleStand=surveyForestWalk(state,f.occurrence,host,district);
  }
  if(item.id!==id)key=lib.sceneInfo(item.id).saveKey;
  storage=realHost?lib.saveStorage(frameElement?.dataset.worldKey):localStorage;
  let saved;try{const data=JSON.parse(storage.getItem(key));if(data?.occurrence===item.occurrence.id)saved=data.pose;}catch{}
  const gap=item.occurrence.gap?.local??{eastM:0,northM:0},target=item.occurrence.tree?.local??gap;
  pose={...gap,yaw:Math.atan2(target.eastM-gap.eastM,gap.northM-target.northM),pitch:.04,mode:'walk',altitudeM:1.7};
  pose.altitudeM=floor(stateAt(pose))+1.7;
  if(item.occurrence.surveyPose)pose={...item.occurrence.surveyPose};
  if(saved)pose=saved;if(entry?.geographic)pose={...entry.pose};
  if(district?.sites.length && (saved || entry?.geographic)){
    const from=borderPoint(pose),safe=recoverWallPose(district,from,pedestrian,item.plotId);
    if(safe!==from){
      pose=habitatPoint(pose,safe);
      if(pose.mode==='walk')pose.altitudeM=Math.max(floor(stateAt(pose))+1.7,pose.altitudeM);
    }
  }
  manual={...pose};
  if(params.get('arrival')==='air'){
    const end={...pose,mode:'flight',altitudeM:Math.max(floor(stateAt(pose))+5,pose.altitudeM)};
    const height=Number(params.get('fromM'))||24000;
    pose={...end,altitudeM:height,pitch:-1.49};
    script={arrival:true,start:{...pose},end,elapsed:0,duration:4};
  }else arrive('arrived');
  const s=stateAt(pose);forest=item.occurrence.tree?host.SphereGround.forestStand(s):null;preparing=true;
  try {
    if(entry?.geographic && host.SphereStageFrame.surfaceGroundHeld)
      host.SphereGround.request(s,{releaseDeparture:true});
    await host.SphereApp.renderer.prepare(s,{signal,onProgress:update=>{label.textContent=update.phase;}});
  }
  finally {preparing=false;}
  if(dead)return;
  if(pose.mode==='walk')pose=enterWalk(pose);
  raf=requestAnimationFrame(tick);
}
start().catch(e=>{if(dead)return;label.textContent=e.message;fail(e);console.error(e);});
