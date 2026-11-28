import {borderEnvironment} from './environment.mjs';
import {classes} from './station.mjs';
import {districtFor} from './survey.mjs';
import {nearestStationByWall} from './station-distance.mjs';
import {shellDisplacement,nearestSite,wallAddress,outsideDistrict,hallHalfM,roofSlabM,rightSign,apronRunM,serviceGalleryDepthM} from './district.mjs';
import {stationRecord} from './atlas.mjs';
import {boardingPose,support,move,walker,recoverWallPose} from './motion.mjs';
import {reachableValve} from './maintenance.mjs';
import {makeView} from './view.mjs';
import {makeFrontageWindow} from '../../kit/frontage-window.mjs';
import {stationMouth} from '../../kit/border-frontage.mjs';
import {makeMeadowDoor} from './meadow-door.mjs';
import {inFreightOpening,freightObstruction} from './freight-bay.mjs';

const id='border-transport',version='0.10.0',saveKey='sphere-biome:border-transport:0.10';
const distanceFormat=new Intl.NumberFormat('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const km=metres=>distanceFormat.format(metres/1000);
const el=s=>document.getElementById(s),canvas=el('scene'),host=window.parent===window?null:window.parent;
const library=host?.SphereBiomeLibrary,world=frameElement?.dataset.worldKey,entry=frameElement?.surfaceEntry;
const installation=library?.entry(frameElement?.dataset.locationId??id);
const district=installation?.transport??districtFor('sphere-0000000000000017','r10c0','r11c0',149597870700);
const hand=rightSign(district);
const storage=library?.saveStorage(world)??localStorage,fileBacked=library?.persistence==='file';
const qs=new URLSearchParams(location.search),arrival=qs.get('arrival')==='air';
const stage=host?.SphereStageFrame;
const view=makeView(canvas,{capture:false,cavityBackdrop:!!host,district,land:s=>stage?.stationLand?.(district,s),
  habitats:s=>stage?.stationHabitats?.(district,s),pictureDestination:stage?.stationMeadowBridge,invalidatePictures:()=>{paint=null;},
  createHabitat:stage ? (gl,link)=>makeFrontageWindow(gl,link,host,installation,()=>{paint=null;}) : null,
  createDoor:stage?.stationMeadowBridge ? gl=>makeMeadowDoor(gl,s=>stage.stationMeadowBridge(s,true),()=>{paint=null;},stage.meadowWindTime) : null});
const keys=new Set(),events=new AbortController();
const signal=events.signal,previews=new Map();
let station,record,site,group=walker,pose,manual,frames=0,raf=0,last=0,time=0,lastWorldTime=null,rate=1;
let saved=null,script=null,held=arrival&&qs.get('hold')==='1',dead=false,writing=false,arrivalDone,firstDraw,rejectDraw;
let draws=0,paint=null,direct=1,lightAt=-Infinity;
let issue='',message='',previousText='',lastHUD=0,drag=null,hudDirty=true,lockedPending=null;
const ready=new Promise((resolve,reject)=>{firstDraw=resolve;rejectDraw=reject;}),arrived=new Promise(r=>arrivalDone=r);
const text=(s,v)=>{if(s.textContent!==v)s.textContent=v;};
const finite=p=>p&&['eastM','northM','altitudeM','yaw','pitch'].every(k=>Number.isFinite(p[k]))&&['walk','flight'].includes(p.mode);
const districtSaveKey=installation?.id && installation.id!==id ? saveKey+'/'+installation.edge.id : saveKey;
try{saved=JSON.parse(storage.getItem(districtSaveKey));if(saved?.schema!==1||!finite(saved.pose))saved=null;}catch{}
const traveler=id=>id==='service'?walker:classes.find(c=>c.id===id)??walker;
if(entry?.group)group=traveler(entry.group);
else if(saved&&!entry&&!arrival)group=traveler(saved.group);
for(const c of classes){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;el('class').append(o);}
el('class').value=group.id;
host?.addEventListener('sphere-biomes-changed',()=>{view.refreshBridge();paint=null;},{signal});
if(stage)el('pace').value=String(stage.surfacePace??1);
el('pace').onchange=()=>stage?.setSurfacePace?.(Number(el('pace').value));
function resident(s){
  const key=s.address.key;
  if(!previews.has(key)){
    const request=stationRecord(s.address,false,fileBacked).catch(e=>{previews.delete(key);throw e;});
    previews.set(key,request);
    // Atlas owns durable discovery. Retain only the active survey and its
    // incoming neighbour, independent of the number of stations visited.
    for(const other of previews.keys())if(other!==key && other!==site?.address.key)previews.delete(other);
  }
  return previews.get(key);
}
function adopt(s,r){
  site=s;record=r;station=r.station;view.load(station);hudDirty=true;
}
function checkpoint(p){manual={pose:{...p},group:group.id};}
function save(){
  if(!manual || (entry && !entry.active))return false;
  try{storage.setItem(districtSaveKey,JSON.stringify({schema:1,verifiedPassage:true,...manual}));return true;}catch{return false;}
}
function active(){return !entry || entry.active;}
function inHall(p){
  return Math.abs(p.eastM-site.x)<hallHalfM && Math.abs(p.northM)<=station.widthM/2 && p.altitudeM<=station.roofM+roofSlabM+group.eye+.1;
}
async function lock(p){
  writing=true;
  try{
    const r=await stationRecord(site.address,true,fileBacked);
    if(dead)return;
    // Normally the winning Atlas record is identical to the preview. Retain the GPU buffers.
    if(JSON.stringify(r.station)===JSON.stringify(station))r.station=station;
    previews.set(site.address.key,Promise.resolve(r));adopt(site,r);issue='';lockedPending=null;
    pose=p;checkpoint(p);save();
  }catch(e){issue=e.message;lockedPending=p;}finally{writing=false;hudDirty=true;}
}
function accept(p){
  if(dead || writing || issue)return;
  const next=nearestSite(district,p.eastM);
  if(next!==site){
    writing=true;resident(next).then(r=>{if(!dead){adopt(next,r);pose=p;checkpoint(p);}}).catch(e=>{issue=e.message;}).finally(()=>{writing=false;hudDirty=true;});
    return;
  }
  if(!record.locked && active() && inHall(p)){void lock(p);return;}
  pose=p;checkpoint(p);
}
function apron(){
  return Math.abs(pose.eastM-site.x)<hallHalfM && Math.abs(pose.northM)>=station.widthM/2+1 &&
    Math.abs(pose.northM)<station.widthM/2+1500 && pose.altitudeM<group.eye+8;
}
function board(){
  if(!apron()||script||held||writing)return;
  group=traveler(el('class').value);
  pose=boardingPose(station,group,pose.northM>0);checkpoint(pose);save();hudDirty=true;canvas.focus();
}
function toggleMode(){
  if(held||script||writing)return;
  if(pose.mode==='walk')accept({...pose,mode:'flight'});
  else{
    const x=pose.eastM-site.x,z=pose.northM+station.widthM/2,foot=pose.altitudeM-group.eye;
    const top=station.roofM+roofSlabM,roof=outsideDistrict(district,pose.eastM,pose.northM)<=0 &&
      !inFreightOpening(x,pose.northM,group.body[0]/2,group.body[2]/2) && foot>=top-.05;
    const floor=roof?top:support(station,x,z,foot,group,5);
    if(Math.abs(foot-floor)<5)accept({...pose,mode:'walk',altitudeM:floor+group.eye});
    else message='Descend to within 5 m of a floor to walk';
  }
  hudDirty=true;canvas.focus();
}
function settle(result){
  const old=script;script=null;held=false;
  if(old?.arrival){history.replaceState(null,'',location.pathname);arrivalDone(result);}
  old?.resolve?.(result);hudDirty=true;
}
function ascend({toAltitudeM=24000}={}){
  if(!Number.isFinite(toAltitudeM))return Promise.reject(Error('Invalid altitude'));
  if(script)settle('taken-over');
  if(Math.abs(pose.altitudeM-toAltitudeM)<.1 && pose.pitch<=-1.4)return Promise.resolve('revealed');
  const start={...pose},egress=[];
  const open=inFreightOpening(pose.eastM-site.x,pose.northM,group.body[0]/2,group.body[2]/2);
  if(open && freightObstruction(station,pose,{...pose,altitudeM:toAltitudeM},group)){
    message='Move clear of the crane bridge for lift-off.';hudDirty=true;return Promise.resolve('taken-over');
  }
  if(!open && outsideDistrict(district,pose.eastM,pose.northM)<0 && pose.altitudeM<station.roofM){
    const x=pose.eastM-site.x,z=pose.northM+station.widthM/2,foot=pose.altitudeM-group.eye;
    const look=station.lookout;
    const onLookout=look&&x>=look.west-1&&x<=look.east+1&&z>=look.near&&z<=look.far&&Math.abs(foot-look.y)<2;
    const r=onLookout?station.routes[0]:station.routes.find(r=>Math.abs(x-r.nearDoor[0])+group.body[0]/2<=r.door[0]/2);
    if(!r || Math.abs(foot-support(station,x,z,foot,group,2))>2){
      message='Move onto a crossing deck or through an open end for lift-off.';hudDirty=true;return Promise.resolve('taken-over');
    }
    const east=site.x+r.nearDoor[0],side=pose.northM>0?1:-1;
    if(onLookout)egress.push([east,pose.northM]);
    egress.push([onLookout?east:pose.eastM,side*(station.widthM/2+group.body[2]/2+5)]);
  }
  pose={...pose,mode:egress.length?'walk':'flight'};
  return new Promise(resolve=>{script={start,end:{...pose,mode:'flight',altitudeM:toAltitudeM,pitch:-1.49},elapsed:0,egress,resolve};});
}
function begin(){if(held){held=false;hudDirty=true;}return arrived;}
const airRules=library?.pack(id)?.atmosphereRules,nearM=airRules?.nearM??18000,farM=airRules?.farM??24000;
const nearScale=32,nearMark=Math.log1p(nearM/nearScale),farMark=nearMark+1.25;
function altitudeMark(h){
  if(h<=nearM)return Math.log1p(Math.max(0,h)/nearScale);
  if(h<farM)return nearMark+1.25*(h-nearM)/(farM-nearM);
  return farMark+Math.log1p((h-farM)/110000);
}
function altitudeAt(mark){
  if(mark<=nearMark)return nearScale*Math.expm1(mark);
  if(mark<farMark)return nearM+(farM-nearM)*(mark-nearMark)/1.25;
  return farM+110000*Math.expm1(mark-farMark);
}
function approach(end,height){
  const above=Math.max(0,height-end.altitudeM),run=6000*above/(above+1500);
  return {...end,northM:end.northM-run,altitudeM:height,pitch:-Math.atan2(above,run+15)};
}
function updateScript(dt){
  if(!script||held)return;
  if(script.egress?.length){
    const [east,north]=script.egress[0],dx=east-pose.eastM,dz=north-pose.northM,distance=Math.hypot(dx,dz);
    const fraction=distance?Math.min(1,dt*11000/distance):1;
    const result=move(station,district,pose,group,dx*fraction,dz*fraction,0,time,0);
    pose=result.pose;
    if(result.blocked){message='Departure held at '+result.blocked.toLowerCase()+'.';settle('taken-over');return;}
    if(fraction===1)script.egress.shift();
    if(!script.egress.length){pose={...pose,mode:'flight'};script.start={...pose};
      script.end={...pose,altitudeM:script.end.altitudeM,pitch:-1.49};}
    return;
  }
  const {start,end}=script;
  if(script.duration===undefined){
    script.from=altitudeMark(start.altitudeM);script.to=altitudeMark(end.altitudeM);
    script.duration=Math.max(2,Math.abs(script.to-script.from)*1.7);
  }
  script.elapsed+=dt;const t=Math.min(1,script.elapsed/script.duration),k=t*t*(3-2*t);
  const h=t===1?end.altitudeM:altitudeAt(script.from+(script.to-script.from)*k);
  // Look back at the station while it is still visible; reserve time for the regional overlap in both directions.
  const span=Math.max(1,Math.min(9000,Math.abs(end.altitudeM-start.altitudeM)));
  let turn=end.altitudeM>start.altitudeM?(h-start.altitudeM)/span:1-(h-end.altitudeM)/span;
  turn=Math.max(0,Math.min(1,turn));turn=turn*turn*(3-2*turn);
  pose={...pose,altitudeM:h,pitch:start.pitch+(end.pitch-start.pitch)*turn};
  for(const field of ['eastM','northM','yaw'])pose[field]=start[field]+(end[field]-start[field])*k;
  if(script.arrival)pose=approach(end,h);
  if(t>=1)settle(script.arrival?'arrived':'revealed');
}
function valveFace(){
  if(!active() || held || script || writing || issue)return null;
  return reachableValve(station,pose,group.id);
}
function operateValve(){
  const face=valveFace();
  if(!face)return;
  view.drains.toggle(face,Date.now()/1000);
  hudDirty=true;canvas.focus();
}
el('bypass').onclick=operateValve;
function renderHUD(now){
  if(!hudDirty && now-lastHUD<220)return;
  hudDirty=false;lastHUD=now;
  const state=view.bridgeError?'Station doorway unavailable':issue?'Atlas unavailable · '+issue:writing?'Recording or loading station':message|| (record.locked?'Atlas recorded':'Survey preview');
  const onLink=(Math.abs(pose.eastM-site.x)>hallHalfM || Math.abs(pose.northM)>site.widthM/2) &&
    outsideDistrict(district,pose.eastM,pose.northM)<=0;
  const environment=borderEnvironment(district,station,pose);
  let location;
  if(onLink){
    const address=wallAddress(district,pose.eastM,pose.northM),nearest=nearestStationByWall(district,address);
    const bay=nearest.site.bay;
    location='Border maintenance wall · '+address.edge.id+' · '+km(address.alongM)+' km from edge midpoint · Bay '+(bay>0?'+':'')+bay+' · '+km(nearest.distanceM)+' km by wall';
  }else location=station.layout+' · bay '+site.bay+' · '+group.name+' · '+pose.altitudeM.toFixed(1)+' m · '+state;
  const face=valveFace();
  el('bypass').hidden=!face;
  el('drainLevels').hidden=!face;
  if(face){
    const circuit=view.drains.read(face,Date.now()/1000);
    text(el('bypass'),(circuit.open?'Close':'Open')+' drainage bypass · R');
    text(el('drainLevels'),['Intake','Sump','Outlet'].map((name,i)=>name+' '+Math.round(circuit.levels[i]*100)+'%').join(' · '));
  }
  let direction='';
  if(stage && !onLink && pose.altitudeM<station.roofM && Math.abs(Math.abs(pose.northM)-station.widthM/2)<500){
    const mouth=stationMouth(station,pose.eastM-site.x,pose.northM+station.widthM/2);
    const outside=stage.stationFrontages(district,station,mouth.route)[mouth.side];
    if(outside.name)direction=mouth.lateral<=12?mouth.route.id+' opening to '+outside.name:outside.name+' face';
  }
  const label=[location,direction,environment.zone,environment.air].filter(Boolean).join(' · ');
  if(label!==previousText){text(el('readout'),label);previousText=label;}
  el('class').disabled=held||!!script||!apron()||writing;el('class').value=group.id;
  text(el('mode'),pose.mode==='walk'?'Fly':'Walk');el('retry').hidden=!issue && !view.bridgeError;
}
function frame(now){
  if(dead)return;
  const dt=Math.max(0,Math.min(.12,(now-(last||now))/1000));last=now;
  if(stage?.stationFrameHeld?.(window)){raf=requestAnimationFrame(frame);return;}
  const previous=pose;
  const worldClock=host?.SphereApp?.sceneSeconds;
  time=Number.isFinite(worldClock)?worldClock:time+dt;
  if(dt>0 && lastWorldTime!==null)rate=Math.min(1e6,Math.abs(time-lastWorldTime)/dt);
  lastWorldTime=time;
  if(script)updateScript(dt);
  else if(!held&&!writing&&!issue && active()){
    let yaw=pose.yaw+(Number(keys.has('ArrowRight')||keys.has('KeyX'))-Number(keys.has('ArrowLeft')||keys.has('KeyZ')))*hand*dt*Math.PI/4;
    const pitch=Math.max(-1.49,Math.min(1.49,pose.pitch+((+keys.has('ArrowUp'))-(+keys.has('ArrowDown')))*dt));
    const p={...pose,yaw,pitch},f=(+keys.has('KeyW'))-(+keys.has('KeyS')),s=hand*((+keys.has('KeyD'))-(+keys.has('KeyA')));
    const v=pose.mode==='flight'?(+keys.has('KeyE'))-(+keys.has('KeyQ')):0;
    if(f||s||v){
      const boost=keys.has('ShiftLeft')||keys.has('ShiftRight'),pace=Number(el('pace').value);
      const walkSpeed=group.id==='service'?(boost?6:2.8):group.speed*(boost?4:1);
      const roof=station.roofM+roofSlabM;
      const overRoof=p.altitudeM>=roof && outsideDistrict(district,p.eastM,p.northM)<=0 &&
        !inFreightOpening(p.eastM-site.x,p.northM,group.body[0]/2,group.body[2]/2);
      const clearanceM=Math.max(0,p.altitudeM-group.eye-(overRoof?roof:0));
      const base=p.mode==='walk'?walkSpeed:Math.min(1800,8+clearanceM*.4)*(boost?4:1);
      const speed=stage?.movementSpeed?.(base,dt,p.mode==='flight'?{boost,clearanceM}:null)??base*pace;
      const cp=p.mode==='flight'?Math.cos(pitch):1;
      const amt=speed*dt/Math.max(1,Math.hypot(f*cp,s,v+(p.mode==='flight'?f*Math.sin(pitch):0)));
      const step=shellDisplacement(district,p,f*cp*amt,s*amt);
      const result=move(station,district,p,group,step.eastM,step.northM,
        (v+(p.mode==='flight'?f*Math.sin(pitch):0))*amt,time,rate*group.speed/speed);
      message=result.blocked;accept(result.pose);
    }else if(yaw!==pose.yaw||pitch!==pose.pitch || (!record.locked&&inHall(p)))accept(p);
  }
  if(previous!==pose && !script && (previous.eastM!==pose.eastM || previous.northM!==pose.northM || previous.altitudeM!==pose.altitudeM)){
    stage?.observeStationStep?.(window,previous,previous,pose,station);
    if(stage?.stationFrameHeld?.(window)){raf=requestAnimationFrame(frame);return;}
  }
  if(now-lightAt>=120){
    direct=host?.SphereStageFrame?.surfaceLight(window,pose)?.direct??1;lightAt=now;
  }
  const vacuum=!!host && borderEnvironment(district,station,pose).air==='vacuum';
  if(vacuum || (pose.mode==='flight' && pose.altitudeM>=nearM))stage?.presentStation?.(window);
  const size=host?.SphereApp?.previewViewport(canvas.getBoundingClientRect(),now,false);
  const width=size?.width??canvas.clientWidth,height=size?.height??canvas.clientHeight;
  const nearPlant=Math.abs(pose.eastM-site.x-station.routes[0].nearDoor[0])<85 &&
    Math.abs(Math.abs(pose.northM)-station.widthM/2)<85 && pose.altitudeM<15;
  const hydraulic=nearPlant?view.drains.read(pose.northM>0?'far':'near',Date.now()/1000).levels.reduce((sum,v)=>sum+v,0):0;
  const visible=!!firstDraw || draws<2 || !frameElement || frameElement.style.opacity!=='0';
  const windTime=view.bridgeAnimationTime;
  if(visible && (host?.SphereFieldCamera?.need(canvas) || !paint || paint.pose!==pose || paint.time!==time || paint.direct!==direct || paint.station!==station ||
      paint.windTime!==windTime || paint.hydraulic!==hydraulic || paint.width!==width || paint.height!==height || view.habitatNeedsFrame || script || draws<2)){
    // Preserve Main's horizontal lens through a hand-flown geographic entry, including resizes.
    const camera=size?{width,height}:{};
    // The open roof and freight well see the shell above the district horizon.
    if(vacuum)Object.assign(camera,{vacuum:true,groundWeight:1,airWeight:0});
    if(entry?.horizontalFov && height>0)camera.focal=width/height/Math.tan(entry.horizontalFov*Math.PI/360);
    view.draw(station,[pose.eastM-site.x,pose.altitudeM,pose.northM+station.widthM/2],pose.yaw,pose.pitch,time,false,direct,camera);
    stage?.presentCamera?.(window,pose,canvas.width/canvas.height,camera.focal??1.428148);
    host?.SphereFieldCamera?.submit(canvas);
    draws++;paint={pose,time,direct,station,width,height,hydraulic,windTime};
  }
  renderHUD(now);frames++;
  if(firstDraw && draws && !view.bridgePending && !view.picturePreparation){
    if(view.bridgeError || view.farPictures?.failed)rejectDraw(Error('Station doorway unavailable: '+(view.bridgeError || 'could not capture the visible opening')));
    else firstDraw();
    firstDraw=null;
  }
  raf=requestAnimationFrame(frame);
}
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','Space','ShiftLeft','ShiftRight','KeyZ','KeyX','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
addEventListener('keydown',e=>{
  if(e.code==='KeyR' && !e.repeat && valveFace()){e.preventDefault();operateValve();return;}
  if(!movement.has(e.code)||e.target.tagName==='SELECT')return;
  e.preventDefault();if(held)return;
  if(script)settle('taken-over');keys.add(e.code);
  if(!e.repeat && pose && ((e.code==='KeyF' && pose.mode==='flight') || (pose.mode==='walk' && ['Space','KeyE'].includes(e.code) && keys.has('Space') && keys.has('KeyE'))))toggleMode();
},{signal});
addEventListener('keyup',e=>keys.delete(e.code),{signal});
addEventListener('blur',()=>{keys.clear();save();},{signal});
canvas.addEventListener('pointerdown',e=>{if(held)return;canvas.focus();drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);},{signal});
canvas.addEventListener('pointermove',e=>{if(!drag||script||held||writing||issue)return;
  pose={...pose,yaw:pose.yaw+(e.clientX-drag[0])*.004*hand,pitch:Math.max(-1.49,Math.min(1.49,pose.pitch-(e.clientY-drag[1])*.004))};
  drag=[e.clientX,e.clientY];checkpoint(pose);
},{signal});
canvas.addEventListener('lostpointercapture',()=>{drag=null;},{signal});
for(const button of document.querySelectorAll('[data-key]')){
  button.onpointerdown=e=>{if(held)return;if(script)settle('taken-over');button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);};
  button.onlostpointercapture=()=>keys.delete(button.dataset.key);
}
el('class').onchange=board;el('mode').onclick=toggleMode;
el('retry').onclick=()=>{issue='';hudDirty=true;if(view.bridgeError)view.retryBridge();if(lockedPending)void lock(lockedPending);else if(!station)start().catch(failed);};
function dispose(){if(dead)return;save();dead=true;cancelAnimationFrame(raf);if(script)settle('taken-over');events.abort();view.dispose();}
addEventListener('pagehide',dispose,{once:true,signal});
window.SphereBiome={id,version,contract:'sphere-biome/1',ready,arrived,begin,ascend,save,dispose,pose:()=>({...pose}),air:()=>({haze:[],blind:null}),
  environment:()=>pose && station?borderEnvironment(district,station,pose):null,roofBackdropWeight:()=>view.roofBackdropWeight,
  frontage:(atDoor=false, reach=serviceGalleryDepthM)=>{
    const mouth=stationMouth(station,pose.eastM-site.x,pose.northM+station.widthM/2);
    if(atDoor && (mouth.lateral>1 || pose.altitudeM>mouth.socket[1]+mouth.route.door[1] ||
        mouth.depth>reach || mouth.depth < -apronRunM))return null;
    return stage?.stationFrontages(district,station,mouth.route)[mouth.side];
  },
  inspect:()=>({frames,draws,veil:0,scripted:!!script,held,station:station?.address.key,layout:station?.layout,locked:record?.locked??false,
    bridge:view.bridge,habitatWindow:view.habitatWindow,
    maintenance:valveFace()?{face:valveFace(),...view.drains.read(valveFace(),Date.now()/1000)}:null,
    wall:view.wall,geometryBytes:view.geometryBytes,group:group.id,time,uploads:view.uploads,residentStations:previews.size,pace:Number(el('pace').value),blocked:message,error:issue})};
async function start(){
  const initial=entry?.geographic&&finite(entry.pose)?entry.pose:saved?.pose;
  const s=nearestSite(district,arrival?0:initial?.eastM??0);adopt(s,await resident(s));
  const verified=entry?.geographic ? entry.verifiedPassage===true : saved?.verifiedPassage===true;
  pose=initial?recoverWallPose(district,{...initial},group,null,verified):boardingPose(station,group);
  if(pose.mode==='walk' && pose.altitudeM>=station.roofM+roofSlabM+group.eye-.1 &&
     inFreightOpening(pose.eastM-site.x,pose.northM,group.body[0]/2,group.body[2]/2))pose.mode='flight';
  checkpoint(pose);
  if(arrival && saved)manual.group=saved.group??classes[0].id;
  if(arrival){
    const pad=boardingPose(station,group);
    const end={...pad,northM:pad.northM-7.5,mode:'flight',altitudeM:group.eye+2,pitch:0};
    const start=approach(end,Number(qs.get('fromM'))||farM);
    pose={...start};script={start,end,elapsed:0,arrival:true};
  }else arrivalDone('arrived');
  raf=requestAnimationFrame(frame);
}
function failed(e){issue=e.message;el('retry').hidden=false;text(el('readout'),'Atlas unavailable · '+issue);}
start().catch(failed);

// Bay 0 doorway trial: place the walker exactly, through the same accept() path a step uses.
window.SphereBorderTrial={place:p=>accept({...pose,...p}),pose:()=>({...pose})};
