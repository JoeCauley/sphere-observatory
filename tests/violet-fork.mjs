import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {surveyViolet} from '../packs/violet-labyrinth/1.0.0/survey.mjs';
import {project} from '../packs/kit/surface-route.js';
import {districtFor,mineralFrontage} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtPoint,districtLocation,shellDisplacement,wallDistance} from '../packs/border-transport/0.10.0/district.mjs';
import {pointOnEdge} from '../packs/border-transport/0.10.0/edges.mjs';
import {mainPose,packPose,footprint} from '../geographic-flight.js';
const require=createRequire(import.meta.url);
for(const f of ['math','collection','biomes','world-palette','world','field-sites','flight','surface-walk'])require('../'+f+'.js');
const W=SphereWorld,M=SphereMath,A=SphereAtlas,F=SphereVioletForest,G=SphereGround,S=SphereSites;
const ids=[];
for(const seed of [713,714,713]){
 const s={...M.defaultState(),seed,collection:true,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2};
 const {plot,direction,occurrence:o}=surveyViolet(s),g=F.referenceGrove(s),fork=F.referenceFork(s);
 const item={id:'violet-labyrinth',plotId:plot.id,plot:plot.index,direction,occurrence:o},lib={matchesWorld:()=>true,installed:()=>[item]};
 assert.equal(g.anchor,direction);assert.equal(F.referenceFork(s),fork);assert(fork.arms.every(path=>path.length>30));
 assert.equal(o.surveyPose.altitudeM,11355);assert(g.spires.length>300);
 if(seed===713){
  const d=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',s.radius*1000);d.mineralFrontage=mineralFrontage(s,W);
  const border={id:'border-transport',edge:{id:'station'},transport:d},both={matchesWorld:()=>true,installed:()=>[item,border]};
  // The sloping frontage leaves the historic approach clear, while an actual
  // roof sightline still hands control to Border at landing height.
  for(let i=0;i<=80;i++){
   const probe=mainPose(s,item,{...o.surveyPose,eastM:o.fork.local.eastM*i/80,northM:o.fork.local.northM*i/80},A,W);
   const ll=W.coordinates(M.norm(probe.position),s),p=districtPoint(d,ll.lat,ll.lon);
   assert(wallDistance(d,p.eastM,p.northM)>0);
   assert.equal(footprint(probe,both,A,W)?.id,item.id);
  }
  const f=d.mineralFrontage,center=pointOnEdge(f.edge,f.alongM,f.side*(f.innerM-150));
  const p=districtPoint(d,center.latitude,center.longitude),local=project(o,center.latitude,center.longitude,s.radius*1000);
  const probe=mainPose(s,item,{...o.surveyPose,...local},A,W);
  assert(wallDistance(d,p.eastM,p.northM)<0,'The roof probe is on the remaining shoulder');
  assert.equal(footprint(probe,both,A,W)?.id,item.id);
  const low={...probe,position:M.mul(M.norm(probe.position),s.radius-1.7467)};
  assert.equal(footprint(low,both,A,W)?.id,border.id);
  for(const yaw of [0,.73,1.81,3.1])for(const [forward,right] of [[500,0],[0,500],[400,-300]]){
   const step=shellDisplacement(d,{...p,yaw},forward,right),dest=districtLocation(d,p.eastM+step.eastM,p.northM+step.northM);
   const physical=project(center,dest.latitude,dest.longitude,s.radius*1000);
   assert(Math.abs(Math.hypot(physical.eastM,physical.northM)-500)<.004,'Remote chart preserves physical speed');
  }
 }
 const original=M.norm(M.add(M.add(M.mul(g.basis[0],.65),M.mul(g.basis[2],.76)),M.mul(direction,.046)));
 const cam=mainPose(s,item,o.surveyPose,A,W);assert(M.dot(original,cam.forward)>.999999);
 const at=mainPose(s,item,{...o.surveyPose,...o.fork.local,altitudeM:1.72,mode:'walk'},A,W);
 assert.equal(footprint(at,lib,A,W)?.id,item.id);assert(W.sample(fork.q,s).biome===9);
 const p=packPose(at,item,A,W,{exactAltitude:true});assert(Math.hypot(p.eastM-o.fork.local.eastM,p.northM-o.fork.local.northM)<.0005);
 assert(Math.max(...F.veins(fork.q,s).map(Math.abs))<.000001);
 for(const [a,arm] of fork.arms.entries())for(const v of arm){
  const residual=F.veins(F.fieldRay(g,...v),s)[a===0?0:1];assert(Math.abs(residual)<.000025);
 }
 Object.assign(at,{siteId:'biome-9',siteRevision:2,terrainRevision:2,siteAnchor:fork.q,terrainAnchor:fork.q,geometryDetail:true});
 const tiles=G.neighbourhood(at),fragment=tiles.find(t=>t.ground.props.some(id=>String(id).startsWith(fork.id+'/arm/')));
 assert(fragment,'At least one fork face must be resident');
 const p0=fork.arms[0][0],p1=fork.arms[0][1],dx=p1[0]-p0[0],dz=p1[1]-p0[1],len=Math.hypot(dx,dz);
 const center=F.fieldRay(g,(p0[0]+p1[0])/2,(p0[1]+p1[1])/2),q=F.fieldRay(g,(p0[0]+p1[0])/2-dz/len*.030,(p0[1]+p1[1])/2+dx/len*.030);
 const frame=G.frame(at),a=frame.local(M.mul(center,s.radius)),b=frame.local(M.mul(q,s.radius)),v=M.norm([b[0]-a[0],0,b[2]-a[2]]);
 const h=G.height(at,frame,a[0],a[2]),hit=SphereLanding.probe(at,frame.world([a[0],h+.0017,a[2]]),frame.basis.reduce((d,b,i)=>M.add(d,M.mul(b,v[i])),[0,0,0]),.029);
 assert(hit.distance<.029,'A 1.7 m high lateral ray from the seam should meet its flanking mineral face');
 assert(G.info.bytes<=G.info.budget);ids.push(fork.id);console.log('PASS',seed,plot.id,fork.id,'nearest face',Math.round(hit.distance*1000),'m,',G.info.bytes,'bytes');
}
assert.notEqual(ids[0],ids[1]);assert.equal(ids[0],ids[2]);
// A moving Shade can change the nearest sunlit destination. The surveyed rock and the adjacent roof are fixed.
const solar={...M.defaultState(),seed:713,collection:true,time:47280,routeShades:true};
assert.notDeepEqual(W.locateBiome(9,solar),W.locateBiome(9,solar,{sunlit:false}));
F.referenceGrove({...solar,seed:714});
assert.deepEqual(F.referenceGrove(solar).anchor,W.locateBiome(9,solar,{sunlit:false}));
assert.equal(F.referenceFork(solar).id,ids[0]);
assert.deepEqual(mineralFrontage(solar,W),mineralFrontage({...solar,time:0},W));

