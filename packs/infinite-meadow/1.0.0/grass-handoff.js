import {clumpRoot} from './grass-scatter.js';
import {integerHash,splitCell,transitionField} from './grass-stage.js';
import {clamp} from './coordinates.js';

export const BASE_PITCH=1.4;
export function lineageAnchor(p){const x=Math.floor(p.eastM/BASE_PITCH),z=Math.floor(p.northM/BASE_PITCH);return {origin:[x*BASE_PITCH-p.eastM,z*BASE_PITCH-p.northM],x:splitCell(x),z:splitCell(z)};}
// Every coarser population retains a subset of exactly the same fine blades.
// Cell permutation distributes the far tier's extra eight blades geographically.
export function lineageRoot(eastCell,northCell,blade,level){
  if(![0,1,2].includes(level)||!Number.isInteger(blade)||blade<0||blade>=[72,48,24][level])throw RangeError('Invalid lineage blade');
  const slots=1<<(2*level),e=splitCell(eastCell),n=splitCell(northCell);
  const permutation=integerHash(e.low^Math.imul(n.low,0x9e3779b9)^e.high^n.high)&(slots-1),slot=(blade%slots)^permutation;
  const x=(slot&1)|((slot&4)>>1),z=((slot&2)>>1)|((slot&8)>>2),index=Math.floor(blade/slots);
  const fineCell=[eastCell*(1<<level)+x,northCell*(1<<level)+z];
  return {...clumpRoot(...fineCell,index,BASE_PITCH),fineCell,index};
}
function blend(distance,east,north,start,end,seed){let t=clamp((distance-start)/(end-start),0,1);const variation=.70*transitionField(east,north)+.30*(2*integerHash((seed+29)>>>0)/4294967296-1);t+=.90*variation*t*(1-t);return t*t*(3-2*t);}
export function handoffAt(distance,east,north,seed){
  const intro=blend(distance,east,north,14,44,seed),middle=blend(distance,east,north,36,84,seed),far=blend(distance,east,north,88,170,seed),surface=blend(distance,east,north,170,348,seed);
  const weights=[intro*(1-middle),middle*(1-far),far*(1-surface)],windows=weights.map((weight,i)=>[weights.slice(0,i).reduce((a,b)=>a+b,0),weights.slice(0,i+1).reduce((a,b)=>a+b,0)]);
  return {weights,windows,widthScale:Math.pow(2,1.5*(middle+far))};
}
export const LINEAGE_GLSL=`
uniform int uLevel;uniform uvec2 uAnchorLow;
uvec2 lineageCell(uvec2 cell,uvec2 high,uint blade,out uvec2 fineHigh,out uint index){
 uint level=uint(uLevel),slots=1u<<(2u*level);
 uint permutation=coverHash(cell.x^cell.y*0x9e3779b9u^high.x^high.y)&(slots-1u),slot=(blade%slots)^permutation;
 uvec2 offset=uvec2((slot&1u)|((slot&4u)>>1u),((slot&2u)>>1u)|((slot&8u)>>2u));
 uvec2 base=cell<<level;fineHigh=high<<level;
 if(level>0u)fineHigh+=cell>>(32u-level);
 uvec2 fine=base+offset;fineHigh+=uvec2(fine.x<base.x?1u:0u,fine.y<base.y?1u:0u);
 index=blade/slots;return fine;
}
vec3 handoffWeights(vec2 at,uint seed,out float widthScale){
 float intro=canopyBlend(at,14.,44.,seed),middle=canopyBlend(at,36.,84.,seed),far=canopyBlend(at,88.,170.,seed),surface=canopyBlend(at,170.,348.,seed);
 widthScale=exp2(1.5*(middle+far));
 return vec3(intro*(1.-middle),middle*(1.-far),far*(1.-surface));
}
`;
