import assert from 'node:assert/strict';
import atlas from '../sphere-atlas.js';
import {chartFor,course,toBorder,toMeadow,enterNorthM} from '../packs/kit/surface-route.js';
import {initialState} from '../packs/infinite-meadow/1.3.0/model.js';
import {startLevelCruise,stepLevelCruise} from '../packs/infinite-meadow/1.3.0/level-cruise.js';
import {makeGallery} from '../packs/border-outfall/1.0.0/geometry.js';
import {solidAt,moveBody,supportAt,resolvePose,wallHeight} from '../packs/border-outfall/1.0.0/border.js';
import {entrance,eye,nearValve} from '../packs/border-outfall/1.0.0/model.js';

const radius=149597870.7;
const close=(a,b,tol=.0001)=>assert(Math.abs(a-b)<tol,`${a} vs ${b}`);
for(const homeId of ['r10c0','r12c35','r9c52']){
  const home=atlas.byId(homeId),edge=atlas.northEdge(homeId);
  const chart=chartFor(home,edge,radius),state=initialState(),motion={speedMps:0};
  const target=course(state.pose,chart);
  const angle=2*Math.asin(Math.sqrt(Math.sin((edge.latitude-home.latitude)/2)**2+
    Math.cos(edge.latitude)*Math.cos(home.latitude)*Math.sin((edge.longitude-home.longitude)/2)**2));
  close(target.distanceM,radius*1000*angle);
  close(course(state.pose,chartFor(home,edge,radius/2)).distanceM,target.distanceM/2);
  assert.equal(chartFor(home,{...edge,near:'wrong'},radius),null);
  state.pose.yaw=target.heading;
  const start={...state.pose};startLevelCruise(state,motion);
  assert.equal(state.pose.eastM,start.eastM);assert.equal(state.pose.northM,start.northM);
  const speed=state.skimSpeedMps,elapsed=target.distanceM/speed+motion.level.entrySeconds+1/2.5;
  // Advance the same integrator the animation calls, in successive simulated days.
  let remaining=elapsed;
  while(remaining>0){const dt=Math.min(86400,remaining);stepLevelCruise(state,motion,new Set(),dt);remaining-=dt;}
  const local=toBorder(state.pose,chart,7);
  close(local.eastM,0,.05);close(local.northM,0,.05);
  const away={...local,eastM:-7132.913,northM:enterNorthM-51.24,altitudeM:67,yaw:-1.27};
  const returned=toBorder(toMeadow(away,chart,7),chart,7);
  for(const f of ['eastM','northM','altitudeM','yaw'])close(away[f],returned[f]);
  console.log('PASS actual Level Cruise',homeId,'to',edge.far,(target.distanceM/1000).toFixed(2),'km at',speed*3.6,'km/h');
}

const {colliders}=makeGallery();
for(const x of [-15000000,-100000,-1004,-950,-650,-600,0,600,650,950,1004,100000,15000000]){
  const p={...entrance(),eastM:x,northM:38,altitudeM:eye};
  assert(!solidAt(colliders,x,eye,38));close(supportAt(colliders,p),eye);
  moveBody(p,colliders,0,-1000,0);close(p.altitudeM,eye);
  if(Math.abs(x)>6){
    moveBody(p,colliders,0,0,-1e5);close(p.northM,34.22);
    p.northM=-12;moveBody(p,colliders,0,0,1e5);assert(p.northM<=-.22);
    p.mode='flight';p.altitudeM=25000;p.northM=19;moveBody(p,colliders,0,-1e5,0);
    close(p.altitudeM,wallHeight+eye);close(supportAt(colliders,p),wallHeight+eye);
    const legacy={...p,mode:'walk',altitudeM:eye,northM:11};
    resolvePose(legacy,colliders);assert(!solidAt(colliders,legacy.eastM,legacy.altitudeM,legacy.northM));
  }
}
const doorway=entrance();moveBody(doorway,colliders,0,0,30);close(doorway.northM,12);
moveBody(doorway,colliders,2.5,0,0);assert(nearValve(doorway));
const rib={...entrance(),eastM:18*2000,northM:-5};
moveBody(rib,colliders,0,0,50000);close(rib.northM,-1.825-.22);
console.log('PASS service opening, valve reach, transverse floor, repeated ribs, swept collisions, roof landing and legacy saves');
