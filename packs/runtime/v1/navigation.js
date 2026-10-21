// API-1 support adapter for the accepted Meadow movement conventions.
// Same axes, walking speeds, flight curve and substeps; content owns support.
import {clamp,mix,R} from '../../infinite-meadow/1.0.0/coordinates.js';
const knots=[[0,8],[20,18],[100,75],[1000,800],[10000,9000],[100000,110000],[1000000,1400000],[10000000,18000000],[100000000,240000000],[1000000000,2700000000],[10000000000,10000000000]];
export const EYE_M=1.7;
export function flightSpeed(clearance,boost=false){
 const d=Math.max(0,clearance+EYE_M);let i=1;while(i<knots.length&&d>knots[i][0])i++;
 if(i===knots.length)return 1e10;
 const [a,va]=knots[i-1],[b,vb]=knots[i],t=(Math.log1p(d/1000)-Math.log1p(a/1000))/(Math.log1p(b/1000)-Math.log1p(a/1000));
 return Math.min(1e10,Math.exp(mix(Math.log(va),Math.log(vb),t))*(1-.25*(1-clamp(d/1e6,0,1)))*(boost?1.5:1));
}
export function moveOnSupport(state,keys,dt,content,motion={speedMps:0}){
 const p=state.pose,walking=p.mode==='walk',boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
 const dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),dz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),dy=walking?0:(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
 const before=content.support(p.eastM,p.northM,p.altitudeM-EYE_M),clearance=p.altitudeM-before-EYE_M;
 const target=walking?(boost?6:2.8):flightSpeed(clearance,boost),speed=walking?target:motion.speedMps>0?Math.min(target,motion.speedMps+(target-motion.speedMps)*(1-Math.exp(-dt*3)),motion.speedMps*Math.exp(dt*3)):target;
 motion.speedMps=speed;const cp=walking?1:Math.cos(p.pitch),sp=walking?0:Math.sin(p.pitch);
 let vx=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw)*cp,vz=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw)*cp,vy=dy-dz*sp;
 const length=Math.hypot(vx,vz,vy)||1;vx/=length;vz/=length;vy/=length;
 const x=vx*speed*dt,z=vz*speed*dt,y=vy*speed*dt;
 const steps=walking?Math.max(1,Math.ceil(Math.hypot(x,z)/.2)):clearance<140?Math.max(1,Math.ceil(Math.hypot(x,z,y)/.2)):1;
 let colliding=false,landed=false;
 for(let i=0;i<steps;i++){
  const attempt=(nx,nz)=>{const floor=content.support(nx,nz,p.altitudeM-EYE_M);if(content.blocked(nx,nz,p.altitudeM,walking)||walking&&floor>p.altitudeM-EYE_M+.23){colliding=true;return false;}return true;};
  const nx=clamp(p.eastM+x/steps,-Math.PI*R,Math.PI*R),nz=clamp(p.northM+z/steps,-Math.PI*R*.5,Math.PI*R*.5);
  if(attempt(nx,p.northM))p.eastM=nx;if(attempt(p.eastM,nz))p.northM=nz;
  const floor=content.support(p.eastM,p.northM,p.altitudeM-EYE_M)+EYE_M;
  const next=p.altitudeM+y/steps;if(!walking&&next<=floor&&vy<0)landed=true;
  if(!walking&&content.blocked(p.eastM,p.northM,next,false)){colliding=true;}else p.altitudeM=walking?floor:clamp(next,floor,R*.8);
 }
 if(landed){p.mode='walk';p.altitudeM=content.support(p.eastM,p.northM,p.altitudeM-EYE_M)+EYE_M;motion.speedMps=0;}
 return {speedMps:speed,colliding,landed,steps,clearanceM:p.altitudeM-content.support(p.eastM,p.northM,p.altitudeM-EYE_M)-EYE_M};
}
