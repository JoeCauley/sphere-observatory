import {R,clamp,mix,smooth,address as meadowAddress} from '../../infinite-meadow/1.0.0/coordinates.js';
import {initialState as meadowInitial,parseState as meadowParse,EYE,skimMinimumClearance} from '../../infinite-meadow/1.0.0/model.js';
import {ART,selection} from '../../infinite-industry/1.0.0/facility.js';
import {flightSpeed,moveOnSupport} from '../../runtime/v1/navigation.js';
import {SHARED_WORLD_REVISION} from './reference.js';

export {EYE};
export const ADDRESS_REVISION='meadow-industry-address-v1',SITE='meadow-industry';
export const clearance=(pose,reference)=>pose.altitudeM-reference.support(pose.eastM,pose.northM,pose.altitudeM-EYE)-EYE;
export function initialState(reference,arrival='meadow'){
 const state={...meadowInitial(),sharedWorldRevision:SHARED_WORLD_REVISION,industryRevision:ART,config:structuredClone(reference.facility.config),routing:'distribution',processTime:0,processPlaying:true,transition:1};
 state.pose=arrival==='flight'?reference.approachPose():reference.home(arrival);
 return state;
}
export function address(pose){return {...meadowAddress(pose),siteId:SITE,worldRevision:ADDRESS_REVISION};}
export function saveState(state){return {...structuredClone(state),pose:{address:address(state.pose),yaw:state.pose.yaw,pitch:state.pose.pitch,mode:state.pose.mode}};}
export function parseState(raw,reference){
 const state=typeof raw==='string'?JSON.parse(raw):structuredClone(raw),a=state?.pose?.address;
 if(state?.sharedWorldRevision!==SHARED_WORLD_REVISION||state.industryRevision!==ART||JSON.stringify(state.config)!==JSON.stringify(selection()))throw Error('Unsupported shared geography, facility or appearance');
 if(a?.schema!==1||a.siteId!==SITE||a.worldRevision!==ADDRESS_REVISION)throw Error('Unsupported shared world address');
 if(!['distribution','recovery'].includes(state.routing)||!Number.isFinite(state.processTime)||state.processTime<0||state.processTime>1e9||typeof state.processPlaying!=='boolean'||!Number.isFinite(state.transition)||state.transition<0||state.transition>1)throw Error('Invalid shared process state');
 const skim=state.skimEnabled;
 state.pose.address={...a,siteId:'rolling-meadow-study-03',worldRevision:'scale-study-v03'};
 // The original environment validator remains authoritative; shared skim height is checked against shared support below.
 state.skimEnabled=false;
 const parsed=meadowParse(JSON.stringify(state));parsed.skimEnabled=skim;
 if(typeof skim!=='boolean'||skim&&(parsed.pose.mode!=='flight'||clearance(parsed.pose,reference)>120))throw Error('Invalid shared grass-skimming settings');
 const p=parsed.pose,floor=reference.support(p.eastM,p.northM,p.altitudeM-EYE);
 if(p.altitudeM<floor+EYE-.002||reference.blocked(p.eastM,p.northM,p.altitudeM,p.mode==='walk')||p.mode==='walk'&&Math.abs(p.altitudeM-floor-EYE)>.01)throw Error('Saved viewpoint is outside shared support');
 return parsed;
}
export function supported(pose,reference){return {...pose,altitudeM:Math.max(pose.altitudeM,reference.support(pose.eastM,pose.northM,pose.altitudeM-EYE)+EYE)};}
export function takeoff(state){
 if(state.pose.mode!=='walk')return null;
 state.pose.mode='flight';state.skimEnabled=false;
 return {elapsed:0,fromAltitudeM:state.pose.altitudeM,fromPitch:state.pose.pitch,lastPitch:state.pose.pitch,targetPitch:Math.atan(.24)};
}
export function stepTakeoff(state,lift,dt,reference){
 lift.elapsed=Math.min(2,lift.elapsed+dt);const t=smooth(lift.elapsed/2);
 state.pose.altitudeM=Math.max(reference.support(state.pose.eastM,state.pose.northM,state.pose.altitudeM-EYE)+EYE,lift.fromAltitudeM+45*t);
 if(Math.abs(state.pose.pitch-lift.lastPitch)<1e-10){state.pose.pitch=mix(lift.fromPitch,lift.targetPitch,t);lift.lastPitch=state.pose.pitch;}
 return lift.elapsed<2-1e-9;
}
export function landOnFoot(state,reference){
 const p=state.pose;if(clearance(p,reference)>=8||reference.blocked(p.eastM,p.northM,p.altitudeM,true))return false;
 p.mode='walk';state.skimEnabled=false;p.altitudeM=reference.support(p.eastM,p.northM,p.altitudeM-EYE)+EYE;return true;
}
export function startSkimming(state,reference){
 const p=state.pose;if(clearance(p,reference)>120||reference.blocked(p.eastM,p.northM,p.altitudeM,false))return false;
 state.skimEnabled=true;p.mode='flight';state.skimClearanceM=clamp(state.skimClearanceM,skimMinimumClearance(state),80);
 p.altitudeM=reference.support(p.eastM,p.northM,p.altitudeM-EYE)+EYE+state.skimClearanceM;return true;
}
export function move(state,keys,dt,reference,motion={speedMps:0}){
 if(!(dt>=0&&Number.isFinite(dt)))throw Error('Invalid movement interval');
 if(!state.skimEnabled||state.pose.mode==='walk')return moveOnSupport(state,keys,dt,reference,motion);
 // Original Meadow skimming controls, with the same shared support as ordinary walking/flight.
 const p=state.pose,boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
 const dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),dz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),dy=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
 state.skimClearanceM=clamp(state.skimClearanceM+dy*dt*(boost?6:3),skimMinimumClearance(state),80);
 const target=dx||dz?state.skimSpeedMps*(boost?1.5:1):0,speed=motion.speedMps+(target-motion.speedMps)*(1-Math.exp(-dt*2.5));motion.speedMps=speed;
 let vx=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),vz=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw);const length=Math.hypot(vx,vz)||1;vx/=length;vz/=length;
 const x=vx*speed*dt,z=vz*speed*dt,steps=Math.max(1,Math.ceil(Math.hypot(x,z)/.2));let colliding=false;
 for(let i=0;i<steps;i++){
  const nx=clamp(p.eastM+x/steps,-Math.PI*R,Math.PI*R),nz=clamp(p.northM+z/steps,-Math.PI*R*.5,Math.PI*R*.5);
  if(!reference.blocked(nx,p.northM,p.altitudeM,false))p.eastM=nx;else colliding=true;
  if(!reference.blocked(p.eastM,nz,p.altitudeM,false))p.northM=nz;else colliding=true;
  p.altitudeM=reference.support(p.eastM,p.northM,p.altitudeM-EYE)+EYE+state.skimClearanceM;
 }
 return {speedMps:speed,colliding,landed:false,steps,clearanceM:clearance(p,reference)};
}
