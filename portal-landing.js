// Survey the same surfaces and solids the destination pack will give the walker.
import {project} from './packs/kit/surface-route.js';
import {ground,solid,EYE} from './packs/sideways-city/1.0.0/ground.js';
import {createFacility,DATUM_M} from './packs/infinite-industry/1.4.1/facility.js';
import {walkingContent} from './packs/infinite-industry/1.4.1/plant.js';
import {EYE_M} from './packs/runtime/v1/navigation.js';
import {ownerAt,passageAt,tunnelLength} from './surface-passages.js';

let industry;
export function canStand(q,id,state,items,{atlas,world},marginM=0){
  if(id!=='sideways-city' && id!=='infinite-industry')return true;
  const item=items.find(item=>item.id===id),plot=item && atlas.byId(item.plotId);
  if(item?.detailInstalled===false)return true;
  if(!plot)return false;
  const coord=world.coordinates(q,state),at=project(plot,coord.lat,coord.lon,state.radius*1000);
  function open(e,n){
    if(id==='sideways-city')return !solid(e,n,ground(e,n)+EYE);
    industry??=walkingContent(createFacility());
    const eye=industry.support(e,n,DATUM_M)+EYE_M;
    return !industry.blocked(e,n,eye,true);
  }
  if(!open(at.eastM,at.northM))return false;
  if(!marginM)return true;
  return [[marginM,0],[-marginM,0],[0,marginM],[0,-marginM]].every(([e,n])=>open(at.eastM+e,at.northM+n));
}

export function surveyGate(gate,state,items,env){
  const id=gate.far.id;
  if(canStand(gate.far.q,id,state,items,env,.8))return gate;
  const q=gate.near.q,f=gate.near.forward;
  const side=[q[1]*f[2]-q[2]*f[1],q[2]*f[0]-q[0]*f[2],q[0]*f[1]-q[1]*f[0]];
  // Fan straight chords about the fixed near mouth. A two-metre step resolves a doorway.
  for(let offset=2;offset<=512;offset+=2){
    for(const sign of [-1,1]){
      const forward=f.map((v,i)=>v+sign*offset/tunnelLength*side[i]);
      const candidate=passageAt(q,forward,state.radius);
      if(ownerAt(candidate.far.q,state,items,env.atlas,env.world).id!==id)continue;
      if(canStand(candidate.far.q,id,state,items,env,.8)){
        return {...candidate,near:{...gate.near,...candidate.near},far:{...gate.far,...candidate.far},surveyOffsetM:sign*offset};
      }
    }
  }
  throw Error('No clear doorway was found in '+gate.far.name+' within 512 metres of the proposed outlet.');
}
