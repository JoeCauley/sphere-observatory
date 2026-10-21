import {R,clamp,mix,smooth,address,fromAddress,unitHash,canonicalShell} from './coordinates.js';
import {terrain,terrainPhases} from './landscape.js';
import {LEVEL_MIN_ALTITUDE_M} from './level-cruise.js';
export {terrain,terrainPhases} from './landscape.js';

export const SCENE_TIME=2468, EYE=1.7, BASE_TUFTS_PER_TILE=2304, TUFTS_PER_TILE=4096, TILE_M=16;
export const COMFORT_TURN_RAD_S=Math.PI/30;
export const landmarks=[
  {id:'home-cairn',eastM:6,northM:-5,heightM:3.8,radiusM:1.2,color:[.32,.34,.28]},
  {id:'way-cairn',eastM:-8,northM:-27,heightM:2.6,radiusM:1.5,color:[.27,.30,.25]},
  {id:'builder-survey-post',eastM:12,northM:-42,heightM:8,radiusM:.65,color:[.22,.27,.23]}
];

// One deterministic support surface for the mesh, grass roots and walking.
export function terrainNormal(east,north){
  const dx=(terrain(east+.25,north)-terrain(east-.25,north))/.5;
  const dz=(terrain(east,north+.25)-terrain(east,north-.25))/.5;
  const length=Math.hypot(dx,1,dz);return [-dx/length,1/length,-dz/length];
}
export const GROUND_DATUM=terrain(0,0);
export function blindBands(state){
  const h=state.blindHeightM;
  return {groundDatumM:GROUND_DATUM,centerM:GROUND_DATUM+h,
    startM:GROUND_DATUM+h*.9,endM:GROUND_DATUM+h*1.1,
    deckM:GROUND_DATUM+h*1.15,viewM:GROUND_DATUM+h*1.25};
}
export function sceneLight(state){
  const b=blindBands(state),reveal=state.concealment?smooth((state.pose.altitudeM-b.startM)/(b.endM-b.startM)):1;
  return {reveal,canopyDaylight:state.daylight,interiorDaylight:mix(state.daylight,1,reveal)};
}
export const clearance=p=>p.altitudeM-terrain(p.eastM,p.northM)-EYE;
export function home(){return {eastM:0,northM:0,altitudeM:GROUND_DATUM+EYE,yaw:0,pitch:-.07,mode:'walk'};}
export function initialState(){return {schema:1,worldRevision:'scale-study-v05',vegetationRevision:'grass-stage-v12',seed:713,pose:home(),sceneTime:SCENE_TIME,windTime:0,windPlaying:true,grassbox:true,grassReach:'wide',grassHeightScale:1,grassWidthScale:1.15,skimEnabled:false,skimSpeedMps:50,skimClearanceM:2,weather:'frozen-clear',daylight:1,exposure:1,concealment:true,blindHeightM:100000,grassDensity:'lush',comfortMotion:true,variant:'aggregate',disturbance:null,objects:{'home-cairn':'intact','way-cairn':'intact','builder-survey-post':'intact'}};}
export function saveState(state){return JSON.stringify({...state,pose:{address:address(state.pose),yaw:state.pose.yaw,pitch:state.pose.pitch,mode:state.pose.mode}});}
export function parseState(text){
  const s=JSON.parse(text);
  if(s?.schema!==1||s.worldRevision!=='scale-study-v05'||s.seed!==713)throw Error('Incompatible study save: this landscape has its own revision');
  const p=fromAddress(s.pose?.address);
  if(Math.abs(p.eastM)>Math.PI*R||Math.abs(p.northM)>Math.PI*.5*R||p.altitudeM<0||p.altitudeM>R*.8)throw Error('Position outside study envelope');
  if(!Number.isFinite(s.pose.yaw)||!Number.isFinite(s.pose.pitch)||Math.abs(s.pose.yaw)>1e4||Math.abs(s.pose.pitch)>1.55||!['walk','flight'].includes(s.pose.mode))throw Error('Invalid orientation or mode');
  if(!['aggregate','sparse-clumps'].includes(s.variant)||typeof s.concealment!=='boolean'||!Number.isFinite(s.daylight)||s.daylight<0||s.daylight>1||s.exposure!==1||s.sceneTime!==SCENE_TIME||!Number.isFinite(s.windTime)||s.windTime<0||s.windTime>1e9||s.weather!=='frozen-clear')throw Error('Invalid study environment');
  if(!Number.isFinite(s.blindHeightM)||s.blindHeightM<20000||s.blindHeightM>200000)throw Error('Blind study height must be 20–200 km');
  if(!['full','dense','lush'].includes(s.grassDensity))throw Error('Unknown grass density');
  for(const [key,value] of Object.entries({vegetationRevision:'grass-stage-v12',windPlaying:true,grassbox:true,grassReach:'wide',grassHeightScale:1,grassWidthScale:1.15,skimEnabled:false,skimSpeedMps:50,skimClearanceM:2}))if(s[key]===undefined)s[key]=value;
  if(['grass-stage-v05','grass-stage-v06','grass-stage-v07','grass-stage-v08','grass-stage-v09','grass-stage-v10','grass-stage-v11'].includes(s.vegetationRevision))s.vegetationRevision='grass-stage-v12';
  if(s.vegetationRevision!=='grass-stage-v12'||!['wide','original'].includes(s.grassReach)||typeof s.windPlaying!=='boolean'||typeof s.grassbox!=='boolean'||!Number.isFinite(s.grassHeightScale)||s.grassHeightScale<.5||s.grassHeightScale>1.6||!Number.isFinite(s.grassWidthScale)||s.grassWidthScale<.5||s.grassWidthScale>2.5)throw Error('Invalid cover settings');
  if(typeof s.skimEnabled!=='boolean'||!Number.isFinite(s.skimSpeedMps)||s.skimSpeedMps<60/3.6||s.skimSpeedMps>200||!Number.isFinite(s.skimClearanceM)||s.skimClearanceM<.8||s.skimClearanceM>80||s.skimEnabled&&(s.pose.mode!=='flight'||clearance({...p,...s.pose})>120))throw Error('Invalid grass-skimming settings');
  if(s.comfortMotion===undefined)s.comfortMotion=true;
  if(typeof s.comfortMotion!=='boolean')throw Error('Invalid camera-comfort setting');
  if(JSON.stringify(s.objects)!==JSON.stringify(initialState().objects))throw Error('Unsupported landmark state');
  if(s.disturbance!==null&&(!Number.isFinite(s.disturbance?.eastM)||!Number.isFinite(s.disturbance?.northM)||s.disturbance.radiusM!==3))throw Error('Invalid disturbance');
  s.pose={...p,yaw:s.pose.yaw,pitch:s.pose.pitch,mode:s.pose.mode};
  // Level cruise protects the eye from ground, while permitting grass tips.
  // Ordinary walking and free flight retain their original body-clearance rule.
  if(clearance(s.pose)<-.002&&!(s.pose.mode==='flight'&&s.pose.altitudeM>=LEVEL_MIN_ALTITUDE_M))throw Error('Saved pose is below support');
  return s;
}
export function supported(p){return {...p,altitudeM:Math.max(p.altitudeM,terrain(p.eastM,p.northM)+EYE)};}
const blocked=(x,z)=>landmarks.some(l=>Math.hypot(x-l.eastM,z-l.northM)<l.radiusM+.3);
// Observatory travel-control.js curve, converted from kilometres to metres.
const flightKnots=[[0,8],[20,18],[100,75],[1000,800],[10000,9000],[100000,110000],[1000000,1400000],[10000000,18000000],[100000000,240000000],[1000000000,2700000000],[10000000000,10000000000]];
export function flightSpeed(p,boost=false,state=null){
  if(state?.skimEnabled)return state.skimSpeedMps*(boost?1.5:1);
  const distance=Math.max(0,clearance(p)+EYE);let i=1;while(i<flightKnots.length&&distance>flightKnots[i][0])i++;
  if(i===flightKnots.length)return 1e10;
  const [a,va]=flightKnots[i-1],[b,vb]=flightKnots[i],t=(Math.log1p(distance/1000)-Math.log1p(a/1000))/(Math.log1p(b/1000)-Math.log1p(a/1000));
  const meadowScale=1-.25*(1-clamp(distance/1e6,0,1));
  return Math.min(1e10,Math.exp(mix(Math.log(va),Math.log(vb),t))*meadowScale*(boost?1.5:1));
}
export function takeoff(state){
  if(state.pose.mode!=='walk')return null;
  state.pose.mode='flight';
  state.skimEnabled=false;
  return {elapsed:0,fromAltitudeM:state.pose.altitudeM,fromPitch:state.pose.pitch,lastPitch:state.pose.pitch,targetPitch:Math.atan(.24)};
}
export function landOnFoot(state){
  const p=state.pose;if(clearance(p)>=8||blocked(p.eastM,p.northM))return false;
  p.mode='walk';state.skimEnabled=false;p.altitudeM=terrain(p.eastM,p.northM)+EYE;return true;
}
export function startSkimming(state){
  if(clearance(state.pose)>120||blocked(state.pose.eastM,state.pose.northM))return false;
  state.skimEnabled=true;state.pose.mode='flight';
  state.skimClearanceM=clamp(state.skimClearanceM,skimMinimumClearance(state),80);
  state.pose.altitudeM=terrain(state.pose.eastM,state.pose.northM)+EYE+state.skimClearanceM;
  return true;
}
export const skimMinimumClearance=state=>Math.max(.8,(state.grassDensity==='lush'?1.65:.8)*state.grassHeightScale+.45-EYE);
export function stepTakeoff(state,lift,dt){
  lift.elapsed=Math.min(2,lift.elapsed+dt);const t=smooth(lift.elapsed/2);
  state.pose.altitudeM=Math.max(terrain(state.pose.eastM,state.pose.northM)+EYE,lift.fromAltitudeM+45*t);
  if(Math.abs(state.pose.pitch-lift.lastPitch)<1e-10){state.pose.pitch=mix(lift.fromPitch,lift.targetPitch,t);lift.lastPitch=state.pose.pitch;}
  return lift.elapsed<2-1e-9;
}
export function move(state,keys,dt,motion=null){
  const p=state.pose,walking=p.mode==='walk',skimming=!walking&&state.skimEnabled,boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
  let dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),dz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),dy=walking?0:((keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0));
  if(skimming){state.skimClearanceM=clamp(state.skimClearanceM+dy*dt*(boost?6:3),skimMinimumClearance(state),80);dy=0;}
  const target=walking?(boost?6:2.8):skimming?((dx||dz)?flightSpeed(p,boost,state):0):flightSpeed(p,boost);
  const speed=skimming&&motion?motion.speedMps+(target-motion.speedMps)*(1-Math.exp(-dt*2.5)):walking||!motion?target:motion.speedMps>0?Math.min(target,motion.speedMps+(target-motion.speedMps)*(1-Math.exp(-dt*3)),motion.speedMps*Math.exp(dt*3)):target;
  if(motion)motion.speedMps=speed;
  const cp=walking||skimming?1:Math.cos(p.pitch),sp=walking||skimming?0:Math.sin(p.pitch);
  let vx=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw)*cp,vz=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw)*cp,vy=dy-dz*sp;
  const length=Math.hypot(vx,vz,vy)||1;vx/=length;vz/=length;vy/=length;
  const x=vx*speed*dt,z=vz*speed*dt,y=vy*speed*dt;
  const steps=walking?Math.max(1,Math.ceil(Math.hypot(x,z)/.2)):clearance(p)<140?Math.max(1,Math.ceil(Math.hypot(x,z))):1;
  let colliding=false,landed=false;
  for(let i=0;i<steps;i++){
    const nx=clamp(p.eastM+x/steps,-Math.PI*R,Math.PI*R),nz=clamp(p.northM+z/steps,-Math.PI*R*.5,Math.PI*R*.5);
    const obstacle=(east,north)=>landmarks.some(l=>Math.hypot(east-l.eastM,north-l.northM)<l.radiusM+.3&&(walking||p.altitudeM<terrain(l.eastM,l.northM)+l.heightM+EYE));
    if(!obstacle(nx,p.northM))p.eastM=nx;else colliding=true;
    if(!obstacle(p.eastM,nz))p.northM=nz;else colliding=true;
    const groundFloor=terrain(p.eastM,p.northM)+EYE;
    const floor=walking?groundFloor:landmarks.reduce((height,l)=>Math.hypot(p.eastM-l.eastM,p.northM-l.northM)<l.radiusM+.3?Math.max(height,terrain(l.eastM,l.northM)+l.heightM+EYE):height,groundFloor);
    if(!walking&&p.altitudeM+y/steps<=floor&&vy<0){if(floor===groundFloor)landed=true;else colliding=true;}
    p.altitudeM=walking?floor:skimming?Math.max(floor,groundFloor+state.skimClearanceM):clamp(p.altitudeM+y/steps,floor,R*.8);
  }
  if(landed){p.mode='walk';state.skimEnabled=false;p.altitudeM=terrain(p.eastM,p.northM)+EYE;if(motion)motion.speedMps=0;}
  return {speedMps:speed,colliding,landed,clearanceM:clearance(p)};
}
export function tuftTile(tx,tz,density='dense'){
  const count=density==='dense'?TUFTS_PER_TILE:BASE_TUFTS_PER_TILE;
  const key=`study-v03:713:${density}:16m:${tx}:${tz}`,seedKey=`study-v02:713:16m:${tx}:${tz}`,data=new Float64Array(count*7);
  for(let i=0;i<count;i++){
    const extra=i>=BASE_TUFTS_PER_TILE,j=extra?i-BASE_TUFTS_PER_TILE:i;
    // The original 48×48 roots remain unchanged; dense mode adds a second seed set.
    const id=extra?`${seedKey}:extra:${j}`:`${seedKey}:${j}`;
    const x=tx*16+(extra?((j%43)+.15+.7*unitHash(id+'x'))*16/43:((j%48)+.15+.7*unitHash(id+'x'))/3);
    const z=tz*16+(extra?(Math.floor(j/43)+.15+.7*unitHash(id+'z'))*16/43:(Math.floor(j/48)+.15+.7*unitHash(id+'z'))/3);
    data.set([x,terrain(x,z),z,.42+.38*unitHash(id+'h'),.018+.020*unitHash(id+'w'),unitHash(id+'a')*Math.PI*2,unitHash(id+'c')],i*7);
  }
  let hash=2166136261;for(const b of new Uint8Array(data.buffer))hash=Math.imul(hash^b,16777619);
  return {key,tx,tz,data,contentHash:(hash>>>0).toString(16).padStart(8,'0'),identity:canonicalShell({eastM:tx*16,northM:tz*16,altitudeM:0})};
}
export class Residency {
  constructor(){this.tiles=new Map;this.required=[];this.version=0;this.demandKey='';this.generated=0;this.evicted=0;this.ready=false;this.failure=null;}
  update(p,density='dense'){
    const active=clearance(p)<140,tx=Math.floor(p.eastM/16),tz=Math.floor(p.northM/16),key=active?`${tx}/${tz}/${density}`:'coarse';
    if(key===this.demandKey)return false;
    this.demandKey=key;this.version++;this.required=[];
    if(active)for(let z=tz-4;z<=tz+4;z++)for(let x=tx-4;x<=tx+4;x++)this.required.push(`study-v03:713:${density}:16m:${x}:${z}`);
    const requiredSet=new Set(this.required);
    for(const key of this.tiles.keys())if(!requiredSet.has(key)){this.tiles.delete(key);this.evicted++;}
    try{for(const key of this.required)if(!this.tiles.has(key)){const parts=key.split(':');const t=tuftTile(Number(parts.at(-2)),Number(parts.at(-1)),density);this.tiles.set(key,t);this.generated++;}this.failure=null;}catch(e){this.failure=e.message;}
    this.ready=this.required.every(k=>this.tiles.has(k));return true;
  }
  digest(){return [...this.tiles].sort(([a],[b])=>a.localeCompare(b)).map(([k,t])=>`${k}/${t.contentHash}`).join('|');}
  counters(){const bytes=[...this.tiles.values()].reduce((sum,t)=>sum+t.data.byteLength,0);return {version:this.version,demand:this.demandKey,required:this.required.length,ready:this.required.filter(k=>this.tiles.has(k)).length,tiles:this.tiles.size,tufts:bytes/56,typedBytes:bytes,pending:0,workers:0,generated:this.generated,evicted:this.evicted,failure:this.failure};}
}
const stage=(name,duration,from,to,options={})=>({name,duration,from,to,logHeight:false,walk:false,...options});
export function guidedRoute(bookmark=initialState(),pace=1){
  const start={...bookmark.pose},b=blindBands(bookmark);
  const low={...start,altitudeM:GROUND_DATUM+bookmark.blindHeightM*.8,mode:'flight',pitch:.12};
  const reveal={...low,altitudeM:b.viewM,pitch:1.04,yaw:.45};
  const high={...reveal,eastM:R*.03,northM:R*.012,altitudeM:R*.25,pitch:1.05,yaw:.9};
  const back={...high,eastM:start.eastM,northM:start.northM,pitch:-.55,yaw:start.yaw};
  const approach={...reveal,pitch:-.2,yaw:start.yaw},under={...low,pitch:-.09,yaw:start.yaw};
  const land={...start,altitudeM:terrain(start.eastM,start.northM)+30,mode:'flight',pitch:start.pitch};
  const r=[stage('Lift from your meadow',6,start,{...start,altitudeM:800,mode:'flight',pitch:-.18}),
    stage('Rise beneath the ordinary sky',8,{...start,altitudeM:800,mode:'flight',pitch:-.18},low,{logHeight:true}),
    stage('Cross Duck Blind outward',9,low,reveal),stage('Above the Blind · look into the Sphere',6,reveal,reveal),
    stage('Travel into the Sphere',22,reveal,high,{logHeight:true}),stage('Large-scale view',6,high,high),
    stage('Return above your meadow',10,high,back),stage('Descend toward Duck Blind',22,back,approach,{logHeight:true}),
    stage('Cross Duck Blind inward',9,approach,under),stage('Descend beneath the ordinary sky',8,under,land,{logHeight:true}),
    stage('Land at your saved pose',6,land,start)];
  return finishRoute(r,bookmark,pace);
}
export function finishRoute(stages,bookmark,pace=1){
  let elapsed=0,heading=stages[0].from.yaw;
  for(const s of stages){
    s.from={...s.from,yaw:heading};const delta=s.to.yaw-heading;
    s.to={...s.to,yaw:heading+Math.atan2(Math.sin(delta),Math.cos(delta))};heading=s.to.yaw;
    const angle=Math.hypot(s.to.yaw-s.from.yaw,s.to.pitch-s.from.pitch);
    s.duration=Math.max(s.duration/pace,bookmark.comfortMotion&&!s.walk?1.5*angle/COMFORT_TURN_RAD_S:0);s.start=elapsed;elapsed+=s.duration;s.end=elapsed;
  }
  return {stages,duration:elapsed,bookmark:structuredClone(bookmark),pace};
}
export function meadowRoute(bookmark=initialState()){
  const p=bookmark.pose,points=[p,{...p,eastM:p.eastM-11,northM:p.northM-14,yaw:-.32},
    {...p,eastM:p.eastM-18,northM:p.northM-35,yaw:.85},{...p,eastM:p.eastM+2,northM:p.northM-47,yaw:1.4},
    {...p,eastM:p.eastM+20,northM:p.northM-22,yaw:2.8},
    {...p,eastM:p.eastM+20,northM:p.northM,yaw:4.71},{...p,yaw:Math.PI*2+p.yaw}];
  const stages=points.slice(1).map((to,i)=>stage('Walking the rolling meadow',Math.hypot(to.eastM-points[i].eastM,to.northM-points[i].northM)/2.8,points[i],to,{walk:true}));
  return finishRoute(stages,bookmark,1);
}
export function landscapeRoute(bookmark=initialState()){
  const p={...bookmark.pose},up={...p,mode:'flight',altitudeM:320,pitch:-.28};
  const east={...up,eastM:p.eastM+4500,northM:p.northM-1700,yaw:.8};
  const west={...up,eastM:p.eastM-3500,northM:p.northM-4100,yaw:-1.4};
  return finishRoute([stage('Rise above the grass',3,p,up),stage('Survey east · moving meadow bubble',9,up,east),
    stage('Survey west · moving meadow bubble',10,east,west),stage('Return across the rolling land',9,west,up),stage('Land at your saved place',4,up,p)],bookmark);
}
export function grassEdgeRoute(bookmark=initialState()){
 const p={...bookmark.pose},lifted={...p,mode:'flight',altitudeM:terrain(p.eastM,p.northM)+13.7,pitch:-.35};
 const first={...lifted,northM:p.northM-55,altitudeM:terrain(p.eastM,p.northM-55)+13.7};
 const second={...first,eastM:p.eastM+32,northM:p.northM-105,altitudeM:terrain(p.eastM+32,p.northM-105)+25.7,pitch:-.50};
 const high={...second,altitudeM:terrain(second.eastM,second.northM)+46.7,pitch:-.60};
 return finishRoute([
   stage('Lift to the grass transition',5,p,lifted,{supportClearance:[0,12]}),
   stage('Glide across the softer grass edge',12,lifted,first,{supportClearance:[12,12]}),
   stage('Follow the moving stage over the hills',12,first,second,{supportClearance:[12,24]}),
   stage('Look down through the overlapping grass',4,second,high,{supportClearance:[24,45]}),
   stage('Return to your saved meadow',8,high,p,{supportClearance:[45,0]})
 ],bookmark);
}
export function routePose(route,time){
  const s=route.stages.find(s=>time<=s.end)??route.stages.at(-1),t=s.walk?clamp((time-s.start)/s.duration,0,1):smooth((time-s.start)/s.duration),p={...s.from};
  for(const k of ['eastM','northM','yaw','pitch'])p[k]=mix(s.from[k],s.to[k],t);
  p.altitudeM=s.logHeight?Math.exp(mix(Math.log(s.from.altitudeM),Math.log(s.to.altitudeM),t)):mix(s.from.altitudeM,s.to.altitudeM,t);
  p.mode=s.walk?'walk':'flight';if(s.walk)p.altitudeM=terrain(p.eastM,p.northM)+EYE;
  if(s.supportClearance)p.altitudeM=terrain(p.eastM,p.northM)+EYE+mix(...s.supportClearance,t);
  if(time>=route.duration)return {pose:{...route.bookmark.pose},stage:'Returned to your saved meadow',complete:true};
  return {pose:supported(p),stage:s.name,complete:false};
}

