import {terrain} from '../../infinite-meadow/1.0.0/landscape.js';
import {landmarks,home as meadowHome,EYE} from '../../infinite-meadow/1.0.0/model.js';
import {createFacility,selection,DATUM_M} from '../../infinite-industry/1.0.0/facility.js';
import {approachPose,canInteract,interact} from '../../infinite-industry/1.0.0/model.js';

export const SHARED_WORLD_REVISION='meadow-industry-shared-v1';
export const INDUSTRY_CENTER=Object.freeze([384,0]);
export const INDUSTRY_FLAT_RADIUS_M=120,INDUSTRY_APRON_M=128,INDUSTRY_OUTER_RADIUS_M=248;

// `at` is camera-relative, like the unchanged Meadow coverGround input.
export const GLSL_SHARED_GROUND=`
uniform vec2 uIndustryRelative;
float sharedIndustryBlend(vec2 at){
 float r=length(at-uIndustryRelative);
 if(r>=248.0)return 0.0;
 if(r<=120.0)return 1.0;
 float t=(r-120.0)/128.0;
 return 1.0-t*t*(3.0-2.0*t);
}
float sharedMeadowCoverage(vec2 at){return 1.0-sharedIndustryBlend(at);}
float sharedGroundHeight(vec2 at,float meadowHeight){
 float b=sharedIndustryBlend(at);
 if(b<=0.0)return meadowHeight;
 if(b>=1.0)return 48.0;
 return meadowHeight+(48.0-meadowHeight)*b;
}
`;

function freezeTree(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const key of Object.keys(value))freezeTree(value[key]);
  Object.freeze(value);
 }
 return value;
}
function translatePosition(p){return [p[0]+INDUSTRY_CENTER[0],p[1],p[2]+INDUSTRY_CENTER[1]];}
function translatedFacility(){
 const original=createFacility(selection()),shift=([e,n])=>[e+INDUSTRY_CENTER[0],n+INDUSTRY_CENTER[1]];
 const toWorld=(x,z)=>shift(original.toWorld(x,z));
 const toLocal=(e,n)=>original.toLocal(e-INDUSTRY_CENTER[0],n-INDUSTRY_CENTER[1]);
 const interfaces=structuredClone(original.interfaces);
 for(const face of interfaces){
  // Keep the original interface IDs/local hex identity; placement is a separate transform.
  if(face.boundary?.position)face.boundary.position=translatePosition(face.boundary.position);
  if(face.boundary?.pipe?.position)face.boundary.pipe.position=translatePosition(face.boundary.pipe.position);
 }
 const arrival={...original.arrival,eastM:original.arrival.eastM+INDUSTRY_CENTER[0],northM:original.arrival.northM+INDUSTRY_CENTER[1]};
 const control={...original.control,eastM:original.control.eastM+INDUSTRY_CENTER[0],northM:original.control.northM+INDUSTRY_CENTER[1]};
 return freezeTree({...original,center:shift(original.center),toWorld,toLocal,interfaces,arrival,control,
  placement:{revision:SHARED_WORLD_REVISION,translationM:[...INDUSTRY_CENTER]},
  zones:original.zones.map(zone=>({...zone,worldCenter:shift(zone.worldCenter)})),
  support:(e,n,foot)=>original.support(e-INDUSTRY_CENTER[0],n-INDUSTRY_CENTER[1],foot),
  blocked:(e,n,eye,walking)=>original.blocked(e-INDUSTRY_CENTER[0],n-INDUSTRY_CENTER[1],eye,walking)});
}
export function createReference(){
 const facility=translatedFacility();
 const distance=(e,n)=>Math.hypot(e-INDUSTRY_CENTER[0],n-INDUSTRY_CENTER[1]);
 const industryBlend=(e,n)=>{
  const r=distance(e,n);
  if(r>=INDUSTRY_OUTER_RADIUS_M)return 0;
  if(r<=INDUSTRY_FLAT_RADIUS_M)return 1;
  const t=(r-INDUSTRY_FLAT_RADIUS_M)/INDUSTRY_APRON_M;
  return 1-t*t*(3-2*t);
 };
 const groundHeight=(e,n)=>{
  const b=industryBlend(e,n);
  if(b===0)return terrain(e,n);
  if(b===1)return DATUM_M;
  const meadow=terrain(e,n);return meadow+(DATUM_M-meadow)*b;
 };
 const support=(e,n,foot=0)=>{
  let floor=groundHeight(e,n);
  if(distance(e,n)<=INDUSTRY_FLAT_RADIUS_M)floor=Math.max(floor,facility.support(e,n,foot));
  for(const l of landmarks)if(Math.hypot(e-l.eastM,n-l.northM)<l.radiusM+.3)floor=Math.max(floor,terrain(l.eastM,l.northM)+l.heightM);
  return floor;
 };
 const blocked=(e,n,eye,walking)=>{
  for(const l of landmarks)if(Math.hypot(e-l.eastM,n-l.northM)<l.radiusM+.3&&(walking||eye<terrain(l.eastM,l.northM)+l.heightM+EYE))return true;
  return distance(e,n)<=INDUSTRY_FLAT_RADIUS_M&&facility.blocked(e,n,eye,walking);
 };
 let graphicsKey=null,graphicsSample=null,graphicsRevision=0;
 const sampleGraphics=state=>{
  // These are the actual dynamic inputs to geographic wind and Industry movingGeometry.
  const key=[state.windTime,state.processTime,state.routing,state.transition].join('|');
  if(key!==graphicsKey){graphicsKey=key;graphicsSample=Object.freeze({revision:++graphicsRevision,referenceRevision:SHARED_WORLD_REVISION,windTime:state.windTime,processTime:state.processTime,routing:state.routing,transition:state.transition});}
  return graphicsSample;
 };
 return Object.freeze({revision:SHARED_WORLD_REVISION,facility,groundHeight,support,blocked,industryBlend,
  meadowCoverage:(e,n)=>1-industryBlend(e,n),
  regionAt:(e,n)=>{const r=distance(e,n);return r<=120?'industry':r<248?'transition':'meadow';},
  home:(arrival='meadow')=>arrival==='industry'?{...facility.arrival}:{...meadowHome(),yaw:Math.PI/2},
  approachPose:()=>approachPose(facility),
  canInteract:state=>canInteract(state,facility),interact:state=>interact(state,facility),sampleGraphics,
  inspect:()=>({revision:SHARED_WORLD_REVISION,industryCenter:[...INDUSTRY_CENTER],flatRadiusM:120,apronM:128,outerRadiusM:248,graphicsSamples:graphicsRevision})});
}
