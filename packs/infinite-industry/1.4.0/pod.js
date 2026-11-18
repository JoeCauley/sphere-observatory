// Pods: the rules that decide what the builders made, and where.
//
// Nobody knows what the builders manufactured. So a pod is described by what can be said about
// any product without knowing its purpose: whether it is liquid or solid, how hot it is kept,
// the shape and size it leaves in, and the scale it is made at. Everything here is a pure
// function of place: nothing is stored, and the same place always gives the same pod.
//
// THE RULES
//  1. A pod is seven hexes: a core and a ring of six. Pods interlock: seven-hex pods tile the
//     plane with nothing between them when their cores stand on the lattice spanned by (2,1) and
//     (-1,3) in hex steps.
//  2. Industry is laid out in districts, DISTRICT_M across. A district has one scale and one
//     angle, so every pod in it meshes with its neighbours. Scale and angle change between
//     districts, and where two districts meet there is a boulevard: pods that would cross the
//     line are not built.
//  3. The home district is scale 1, angle 0; its pod at the origin is the home pod, liquid and
//     ambient, and that pod's core is the water works (II-001), unchanged.
//  4. Temperature follows a three-colouring of the pod lattice, so two pods that share an edge
//     never run at the same temperature.
//  5. Phase, product shape and product size come from the pod's own hash.
//  6. The ring holds one of each role (intake, process, forming, conditioning, storage, dispatch)
//     in an order that is the pod's own; the core finishes the product.
//  7. Every hex keeps six clear lanes from its centre to the middle of each edge, so every hex can
//     be walked into from every neighbour, in its own pod or the next.
//  8. Liquids move in pipes and solids on belts, carried overhead, so nothing that moves product
//     blocks anyone on foot.
//  9. What is drawn and what stops you are the same list of solids.
import {hash32} from '../../infinite-meadow/1.0.0/coordinates.js';
import {hexCenter,NEIGHBORS} from './boundaries.js';

export const POD_REVISION='industry-pods-v2',DISTRICT_M=4800,BOULEVARD_M=60,HEX_M=150;
export const SCALES=[.75,1,1.25,1.5],TEMPERATURES=['ambient','hot','cold'],PHASES=['liquid','solid'];
export const SHAPES={solid:['bar','slab','sphere','ring'],liquid:['column','sphere','bullet']},SIZES=['small','medium','large'];
export const ROLES=['intake','process','forming','conditioning','storage','dispatch'];
export const LANE_HALF_M=4,LANE_MARGIN_M=6.5,CARRY_M=5.6;

const mod=(n,m)=>((n%m)+m)%m,S3=Math.sqrt(3),S7=Math.sqrt(7);
// Which of a pod's seven hexes a hex is: (q - 2r) mod 7 is 0 on every core and different on each ring hex.
const SLOT=[0,1,5,6,3,2,4];   // class -> index in hexes(): 0 core, 1..6 the ring in NEIGHBORS order
// Fractional and nearest cell of a flat-sided axial hex grid of the given width.
const axial=(x,z,width)=>{const r=z/(width*S3*.5);return [x/width-r*.5,r];};
export function hexAt(x,z,width){
 const [q,r]=axial(x,z,width);let cx=q,cz=r,cy=-q-r,rx=Math.round(cx),ry=Math.round(cy),rz=Math.round(cz);
 const dx=Math.abs(rx-cx),dy=Math.abs(ry-cy),dz=Math.abs(rz-cz);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy<=dz)rz=-rx-ry;
 return [rx||0,rz||0];
}
const districts=new Map();
export function district(I,J,seed=9187){
 const id=`${seed}:${I},${J}`;let d=districts.get(id);if(d)return d;
 const key=`${POD_REVISION}:${id}`,pick=(name,n)=>(hash32(`${key}:${name}`)>>>9)%n,home=I===0&&J===0;
 const scale=home?1:SCALES[pick('scale',SCALES.length)],rot=home?0:pick('angle',60)*Math.PI/180,center=hexCenter(I,J,DISTRICT_M),hexM=HEX_M*scale;
 d={I,J,seed,key,home,center,scale,hexM,rot,cos:Math.cos(rot),sin:Math.sin(rot),shift:home?0:pick('temperature',3),podPitchM:S7*hexM,podRadiusM:hexM*(1+1/S3),
  toLocal(e,n){const x=e-center[0],z=n-center[1];return [x*d.cos+z*d.sin,-x*d.sin+z*d.cos];},
  toWorld(x,z){return [center[0]+x*d.cos-z*d.sin,center[1]+x*d.sin+z*d.cos];}};
 if(districts.size>64)districts.clear();districts.set(id,d);return d;
}
// Is a pod with its core on this hex wholly inside its district, clear of the boulevard?
function built(d,cq,cr){const c=hexCenter(cq,cr,d.hexM),x=c[0]*d.cos-c[1]*d.sin,z=c[0]*d.sin+c[1]*d.cos,reach=DISTRICT_M/2-d.podRadiusM-BOULEVARD_M/2;
 for(let e=0;e<3;e++)if(Math.abs(x*Math.cos(e*Math.PI/3)+z*Math.sin(e*Math.PI/3))>reach)return false;return true;}
const pods=new Map();
// The pod whose core is a + b steps along the pod lattice of a district. Null where the boulevard is.
export function pod(d,a,b){
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b))throw Error('Invalid pod address');
 const key=`${d.key}:${a},${b}`;if(pods.has(key))return pods.get(key);
 const cq=2*a-b,cr=a+3*b;let p=null;
 if(built(d,cq,cr)){const pick=(name,n)=>(hash32(`${key}:${name}`)>>>9)%n,home=d.home&&a===0&&b===0,phase=home?'liquid':PHASES[pick('phase',2)];
  const roles=ROLES.slice();for(let i=5;i>0;i--){const j=pick('role'+i,i+1);[roles[i],roles[j]]=[roles[j],roles[i]];}
  p={revision:POD_REVISION,district:d,a,b,cq,cr,home,key,center:d.toWorld(...hexCenter(cq,cr,d.hexM)),scale:d.scale,hexM:d.hexM,rot:d.rot,phase,temperature:TEMPERATURES[mod(a-b+d.shift,3)],shape:SHAPES[phase][home?0:pick('shape',SHAPES[phase].length)],size:home?'medium':SIZES[pick('size',3)],roles};}
 if(pods.size>20000)pods.clear();pods.set(key,p);return p;
}
// The seven hexes of a pod. index 0 is the core; 1 to 6 the ring, in NEIGHBORS order.
export function hexes(p){
 if(p.hexes)return p.hexes;const d=p.district;
 return p.hexes=[{index:0,q:0,r:0,role:'core'},...NEIGHBORS.map(([q,r],k)=>({index:k+1,q,r,role:p.roles[k]}))].map(h=>{const center=d.toWorld(...hexCenter(p.cq+h.q,p.cr+h.r,p.hexM));
  return {...h,pod:p,id:`${p.key}:${h.q},${h.r}`,center,rot:p.rot,waterWorks:p.home&&h.index===0,toLocal:(e,n)=>{const x=e-center[0],z=n-center[1];return [x*d.cos+z*d.sin,-x*d.sin+z*d.cos];}};});
}
// What stands at a place: its district, and the pod and hex if it is not on a boulevard.
export function locate(east,north,seed=9187){
 const [I,J]=hexAt(east,north,DISTRICT_M),d=district(I,J,seed),[x,z]=d.toLocal(east,north),[q,r]=hexAt(x,z,d.hexM),slot=SLOT[mod(q-2*r,7)];
 const [oq,or]=slot?NEIGHBORS[slot-1]:[0,0],cq=q-oq,cr=r-or,p=pod(d,(3*cq+cr)/7,(2*cr-cq)/7);
 return {district:d,pod:p,hex:p?hexes(p)[slot]:null};
}
// Every built pod whose core is within reach of a place, nearest first, across district lines.
export function podsWithin(east,north,reachM,seed=9187){
 const [I,J]=hexAt(east,north,DISTRICT_M),found=[];
 for(const [di,dj] of [[0,0],...NEIGHBORS]){const d=district(I+di,J+dj,seed);if(Math.hypot(east-d.center[0],north-d.center[1])>DISTRICT_M*.58+reachM)continue;
  const [x,z]=d.toLocal(east,north),[q,r]=axial(x,z,d.hexM),a0=Math.round((3*q+r)/7),b0=Math.round((2*r-q)/7),K=Math.ceil(reachM/d.podPitchM)+1;
  for(let a=a0-K;a<=a0+K;a++)for(let b=b0-K;b<=b0+K;b++){const p=pod(d,a,b);if(!p)continue;const distance=Math.hypot(east-p.center[0],north-p.center[1]);if(distance<=reachM)found.push({pod:p,distance});}}
 return found.sort((m,n)=>m.distance-n.distance);
}
export const describe=p=>`${p.temperature} ${p.phase}, ${p.size} ${p.shape}${p.phase==='liquid'?' vessels':'s'}, scale ${p.scale}`;
