import {cameraBasis} from '../../infinite-meadow/1.0.0/coordinates.js';
import {createFacility,DATUM_M} from '../../infinite-industry/1.0.0/facility.js';

// These bounds belong to the pinned linear Industry mesh recipe, not to zone
// proximity metadata, simulation, support, shadow or panorama demand.
export const BOUNDS_REVISION='industry-display-bounds-v1';
const F32_EPSILON=2**-23,finite3=a=>a?.length===3&&Number.isFinite(a[0])&&Number.isFinite(a[1])&&Number.isFinite(a[2]);
const frozenBounds=(min,max)=>Object.freeze({revision:BOUNDS_REVISION,min:Object.freeze(min),max:Object.freeze(max)});
export function vertexBounds(vertices){
  if(!(vertices instanceof Float32Array)||!vertices.length||vertices.length%9)return null;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vertices.length;i+=9)for(let k=0;k<3;k++){
    const value=vertices[i+k];if(!Number.isFinite(value))return null;
    min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);
  }
  return frozenBounds(min,max);
}

export function motionBounds(config){
  if(config?.geographyRevision!=='industry-water-v1'||config.artRevision!=='builder-water-v1'||
    !Number.isFinite(config.acrossFlatsM)||config.acrossFlatsM<40||config.acrossFlatsM>1000||
    !Number.isInteger(config.orientation)||config.orientation<0||config.orientation>5)return null;
  try{
    const facility=createFacility(config),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    const include=(lo,hi)=>{if(!finite3(lo)||!finite3(hi))throw Error('Unknown motion envelope');for(let k=0;k<3;k++){min[k]=Math.min(min[k],lo[k]);max[k]=Math.max(max[k],hi[k]);}};
    // Every rotating arm endpoint lies in a radius-9.2 circle; its closed pipe
    // is within another .18 in every direction, for every angle/time.
    for(const z of [-15,13])include([-43-9.38,4.2-.18,z-9.38],[-43+9.38,4.2+.18,z+9.38]);
    // A flowing marker lies on a route segment, hence inside its endpoints'
    // coordinate extrema. Include all links for both routing states and all
    // phases, expanded by the .16 cylinder radius and .62..72 height offset.
    for(const link of facility.process.links)for(const p of link.route)include([p[0]-.16,p[1]+.62,p[2]-.16],[p[0]+.16,p[1]+.72,p[2]+.16]);
    // transition is validated in [0,1] by the unchanged state parser/integrator.
    include([42-8.95,.73-.045,42-5.9],[42+8.95,.73+.55+.045,42+5.9]);
    // Both routing wheel positions, conservatively including all intermediate
    // angles and the complete .095-radius closed pipe.
    include([4-.695,2.12-.095,14-.695],[4+.695,2.12+.095,14+.695]);
    const outMin=[Infinity,Infinity,Infinity],outMax=[-Infinity,-Infinity,-Infinity];
    for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
      const at=facility.toWorld(x,z),v=[at[0]-facility.center[0],y+DATUM_M,at[1]-facility.center[1]];
      if(!finite3(v))return null;for(let k=0;k<3;k++){outMin[k]=Math.min(outMin[k],v[k]);outMax[k]=Math.max(outMax[k],v[k]);}
    }
    // Enclose double-coordinate addition/subtraction and final float32 vertex
    // storage as well as the exact affine envelope. Large anchors enlarge the
    // box rather than authorizing a tighter rejection.
    const error=.001+32*Number.EPSILON*Math.max(1,...facility.center.map(Math.abs))+8*F32_EPSILON*Math.max(1,...outMin.map(Math.abs),...outMax.map(Math.abs));
    return frozenBounds(outMin.map(x=>x-error),outMax.map(x=>x+error));
  }catch{return null;}
}

export function cameraView(pose,width,height,origin,previous=null){
  const stamp=[pose?.eastM,pose?.altitudeM,pose?.northM,pose?.yaw,pose?.pitch,width,height,origin?.eastM,origin?.northM];
  if(!stamp.every(Number.isFinite)||width<1||height<1)return null;
  if(previous&&stamp.every((v,i)=>Object.is(v,previous.stamp[i])))return previous;
  const basis=cameraBasis(pose),f=basis.forward.map(Math.fround),r=basis.right.map(Math.fround),u=basis.up.map(Math.fround),aspect=Math.fround(width/height),scale=Math.fround(1.428148);
  if(!Number.isFinite(aspect)||aspect<=0)return null;
  // Match the frozen VS_MESH projection and float32 uniforms, with a two-pixel
  // guard. Do not impose a new far plane or an aggressive near-plane cutoff.
  const plane=(axis,factor,guard,sign)=>f.map((x,k)=>x*guard+sign*axis[k]*factor);
  const planes=[f,...[-1,1].map(s=>plane(r,scale/aspect,1+4/width,s)),...[-1,1].map(s=>plane(u,scale,1+4/height,s))];
  // Separate shader dots can cancel when combined into a plane. Bound their
  // rounding from the uncombined absolute terms, never the cancelled result.
  const weights=(axis,factor,guard)=>f.map((x,k)=>Math.abs(x)*guard+Math.abs(axis[k])*Math.abs(factor));
  const errorWeights=[f.map(Math.abs),...[-1,1].map(()=>weights(r,scale/aspect,1+4/width)),...[-1,1].map(()=>weights(u,scale,1+4/height))];
  return {stamp,planes,errorWeights,origin,camera:[Math.fround(pose.eastM-origin.eastM),Math.fround(pose.altitudeM),Math.fround(pose.northM-origin.northM)]};
}

export function boundsVisible(bounds,anchor,view){
  if(!bounds||!view||!finite3(bounds.min)||!finite3(bounds.max)||!Array.isArray(anchor)||anchor.length!==2||!anchor.every(Number.isFinite))return true;
  if(!view.planes?.length||!view.planes.every(finite3)||view.errorWeights?.length!==view.planes.length||!view.errorWeights.every(finite3)||!finite3(view.camera))return true;
  // buffer rebase casts source+anchor-origin to float32; the camera uniforms
  // are cast separately. Enclose those same monotone operations before testing.
  const delta=[anchor[0]-view.origin.eastM,0,anchor[1]-view.origin.northM];
  const min=bounds.min.map((x,k)=>(k===1?x:Math.fround(x+delta[k]))-view.camera[k]);
  const max=bounds.max.map((x,k)=>(k===1?x:Math.fround(x+delta[k]))-view.camera[k]);
  if(!finite3(min)||!finite3(max)||min.some((x,k)=>x>max[k]))return true;
  const centre=min.map((x,k)=>(x+max[k])*.5),half=min.map((x,k)=>(max[k]-x)*.5);
  return view.planes.every((p,i)=>{
    const magnitude=view.errorWeights[i].reduce((n,x,k)=>n+x*Math.max(Math.abs(min[k]),Math.abs(max[k])),0);
    const guard=.001+32*F32_EPSILON*magnitude;
    return p.reduce((n,x,k)=>n+x*centre[k]+Math.abs(x)*half[k],0)>=-guard;
  });
}
