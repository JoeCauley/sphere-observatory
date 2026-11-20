import assert from 'node:assert/strict';
import atlas from '../sphere-atlas.js';
import {packPose,mainPose,footprint,enterKm,leaveKm} from '../geographic-flight.js';
import {chartFor,project,unproject,toMeadow} from '../packs/kit/surface-route.js';
import {apronHeight} from '../packs/kit/meadow-border.js';
import {terrain} from '../packs/infinite-meadow/1.3.0/landscape.js';

const radius=149597870.7, close=(a,b,tol)=>assert(Math.abs(a-b)<tol,`${a} vs ${b}`);
const world={
  direction:(lat,lon)=>[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)],
  coordinates:q=>({lat:Math.asin(q[1]),lon:Math.atan2(q[2],q[0])})
};
const meadow={id:'infinite-meadow',plotId:'r10c0'},city={id:'sideways-city',plotId:'r13c0'},industry={id:'infinite-industry',plotId:'r7c21'};
for(const item of [meadow,city,industry])item.plot=atlas.byId(item.plotId).index;
const outfall={id:'border-outfall',edge:atlas.northEdge(meadow.plotId)};
const lib={matchesWorld:()=>true,installed:()=>[meadow,city,industry,outfall]};
const state={radius,collection:true,layoutVersion:2,shadeAttachment:null,walkMode:false};
assert(leaveKm>enterKm);
function view(lat,lon,h){
  const q=world.direction(lat,lon);
  return {...state,position:q.map(n=>n*(radius-h)),forward:[-Math.sin(lon),0,Math.cos(lon)],up:q.map(n=>-n)};
}
for(const item of lib.installed()){
  const home=atlas.byId(item.edge?.near??item.plotId);
  for(const xy of [[0,0],[218400,-1505600],[-3e7,2.5e7]]){
    const at=unproject(home,...xy,radius*1000),p=project(home,at.latitude,at.longitude,radius*1000);
    close(p.eastM,xy[0],.0002);close(p.northM,xy[1],.0002);
  }
  const at=item.edge?{latitude:item.edge.latitude,longitude:item.edge.longitude}:{latitude:home.latitude+home.halfHeight*.16,longitude:home.longitude+.01};
  const s=view(at.latitude,at.longitude,13);
  assert.equal(footprint(s,lib,atlas,world)?.id,item.id);
  const p=packPose(s,item,atlas,world),back=mainPose(s,item,p,atlas,world);
  back.position.forEach((n,i)=>close(n,s.position[i],.0001));
  back.forward.forEach((n,i)=>close(n,s.forward[i],.0001));
  if(!item.edge)close(p.altitudeM,13000,.001);
}
const chart=chartFor(atlas.byId(meadow.plotId),outfall.edge,radius),datum=terrain(chart.eastM,chart.northM);
for(const x of [-27000,0,900000]){
  for(const z of [-2800,-2400,-160]){
    const m=toMeadow({eastM:x,northM:z,altitudeM:1.7,yaw:.4},chart,datum);
    close(apronHeight(chart,datum,x,z),terrain(m.eastM,m.northM)-datum,1e-7);
  }
  close(apronHeight(chart,datum,x,-18),0,1e-8);
}
assert.equal(footprint(view(Math.PI/2,0,1),lib,atlas,world),null);
assert.equal(footprint(view(0,Math.PI,1),lib,atlas,world),null);
assert.equal(footprint(view(.01,.02,1),{...lib,matchesWorld:()=>false},atlas,world),null);
console.log('PASS atlas and pack poses, off-centre round trips, service borders and the Meadow ground across both handoff lines');
