// Surface distances use kilometres in Main and metres inside a pack.
export {tunnelStart,tunnelEnd,tunnelLength} from './packs/border-outfall/1.0.0/border.js';
import {tunnelLength} from './packs/border-outfall/1.0.0/border.js';

export function ownerAt(q,state,items,atlas,world) {
  const at=world.coordinates(q,state), plot=atlas.plotAt(at.lat,at.lon);
  const item=plot && items.find(value=>!value.edge && value.plot===plot.index);
  if(item)return {id:item.id,name:item.name,pack:true,plot:plot.id};
  const region=world.sample(q,state);
  return {id:'main-'+region.id,name:region.name,pack:false,plot:plot?.id??null};
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
