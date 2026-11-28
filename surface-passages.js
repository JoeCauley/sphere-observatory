// Surface distances use kilometres in Main and metres inside a pack.
export {tunnelStart,tunnelEnd,tunnelLength} from './packs/border-transport/0.10.0/outfall/border.js';
import {tunnelStart,tunnelLength} from './packs/border-transport/0.10.0/outfall/border.js';

export function ownerAt(q,state,items,atlas,world) {
  const at=world.coordinates(q,state), plot=atlas.plotAt(at.lat,at.lon);
  const item=atlas.regionAt(items,at.lat,at.lon,()=>world.sample(q,state).biome);
  if(item)return {id:item.id,name:item.name,pack:item.detailInstalled!==false,plot:plot.id,...(item.occurrence?{habitat:item.occurrence.biome}:{})};
  const region=world.sample(q,state);
  return {id:'main-'+region.id,name:region.name,pack:false,plot:plot?.id??null};
}
// Mounting nearby detail in its own native habitat requires no geographical passage.
export function continuousHabitat(a,b){
  return (a.habitat!=null&&(b.id==='main-'+a.habitat||b.habitat===a.habitat)) ||
    (b.habitat!=null&&a.id==='main-'+b.habitat);
}
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const unit=v=>{const n=Math.hypot(...v);if(!(n>1e-14))throw Error('A surface bearing is required.');return v.map(x=>x/n);};
export function along(q,forward,angle) {
  const tangent=unit(forward.map((v,i)=>v-dot(q,forward)*q[i]));
  const c=Math.cos(angle),s=Math.sin(angle);
  return {q:q.map((v,i)=>v*c+tangent[i]*s),forward:q.map((v,i)=>tangent[i]*c-v*s)};
}
export function passageAt(q,forward,radiusKm) {
  const half=tunnelLength/2000/radiusKm;
  if(!(half>0&&half<1))throw Error('This shell is too small for the through-tunnel.');
  const angle=2*Math.asin(half);
  return {near:along(q,forward,0),far:along(q,forward,angle),angle};
}
// Straight-tunnel positions are interpolated on the chord, including the slight radial departure from the shell.
export function passagePoint(gate,metres,radiusKm) {
  if(!Number.isFinite(metres)||metres<0||metres>tunnelLength)throw Error('Outside the through-tunnel.');
  const f=metres/tunnelLength;
  return gate.near.q.map((x,i)=>radiusKm*(x+(gate.far.q[i]-x)*f));
}

// The through-passage is a straight chord with a floor, a width and two mouths.
export function passageCamera(gate,pose,radiusKm){
  const alongM=pose.northM-tunnelStart;
  const centre=passagePoint(gate,Math.max(0,Math.min(tunnelLength,alongM)),radiusKm);
  const z=unit(gate.far.q.map((n,i)=>n-gate.near.q[i]));
  const up=unit(gate.near.q.map((n,i)=>-n-gate.far.q[i]));
  const x=[z[1]*up[2]-z[2]*up[1],z[2]*up[0]-z[0]*up[2],z[0]*up[1]-z[1]*up[0]];
  const extra=alongM-Math.max(0,Math.min(tunnelLength,alongM));
  const position=centre.map((n,i)=>n+(pose.eastM*x[i]+pose.altitudeM*up[i]+extra*z[i])/1000);
  const horizontal=z.map((n,i)=>n*Math.cos(pose.yaw)+x[i]*Math.sin(pose.yaw));
  return {position,forward:horizontal.map((n,i)=>n*Math.cos(pose.pitch)+up[i]*Math.sin(pose.pitch)),
    up:up.map((n,i)=>n*Math.cos(pose.pitch)-horizontal[i]*Math.sin(pose.pitch))};
}
