import {project} from '../../kit/surface-route.js';

export function surveyViolet(state,host=globalThis){
  const {SphereVioletForest:forest,SphereWorld:W,SphereAtlas:A}=host;
  const grove=forest.referenceGrove(state),fork=forest.referenceFork(state);
  if(!fork)return null;
  const at=q=>{const g=W.coordinates(q,state);return {latitude:g.lat,longitude:g.lon};};
  const center=at(grove.anchor),r=state.radius*1000;
  const local=q=>{const ll=at(q);return project(center,ll.latitude,ll.longitude,r);};
  const place=q=>({...at(q),local:local(q)});
  const arms=fork.arms.map(path=>[2,9,21,37].map(i=>local(forest.fieldRay(grove,...path[Math.min(i,path.length-1)]))));
  const forward=local(forest.fieldRay(grove,.65,.76));
  const occurrence={kind:'habitat',biome:9,id:'grove/'+fork.id,...center,
    angularRadius:Math.max(10000,Math.hypot(fork.x,fork.z)*1000+3800)/r,
    fork:{id:fork.id,...place(fork.q),direction:fork.q,arms},
    surveyPose:{eastM:0,northM:0,altitudeM:11355,yaw:Math.atan2(forward.eastM,-forward.northM),pitch:-Math.atan(.046),mode:'flight'}};
  return {plot:A.plotAt(center.latitude,center.longitude),direction:grove.anchor,occurrence};
}
