import assert from 'node:assert/strict';
import {sharedEdge,pointOnEdge,edgeCoordinates,addressAt,nearbyEdges} from '../packs/border-transport/0.10.0/edges.mjs';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtPoint,districtLocation,outsideDistrict,linkHalfM,nearestSite} from '../packs/border-transport/0.10.0/district.mjs';
import {wallWindow} from '../packs/border-transport/0.10.0/wall-stream.mjs';
import {generateStation} from '../packs/border-transport/0.10.0/station.mjs';
import {nearestStationByWall} from '../packs/border-transport/0.10.0/station-distance.mjs';
import {move,walker,exteriorMoveAllowed,recoverWallPose,constrainExterior} from '../packs/border-transport/0.10.0/motion.mjs';

const radius=149597870700,worlds=['sphere-ed6a59ab491a9a08','sphere-e83dd55a461c3b54'];
const pairs=[['r10c0','r10c1'],['r12c0','r12c'+(SphereAtlas.columns(12)-1)],['r12c0','r13c0']];
let samples=0,peak=0;
for(const world of worlds)for(const plots of pairs){
  const d=districtFor(world,...plots,radius),edge=sharedEdge(...plots,radius);
  assert.deepEqual(edge,sharedEdge(plots[1],plots[0],radius));
  for(const along of [-edge.lengthM*.49,-5000000,-275000,275000,5000000,edge.lengthM*.49]){
    const g=pointOnEdge(edge,along),p=districtPoint(d,g.latitude,g.longitude);
    for(const side of [-1,1]){
      const g2=pointOnEdge(edge,along,side*500),owner=addressAt(g2.latitude,g2.longitude,radius);
      assert.equal(owner.edge.id,edge.id);assert(Math.abs(owner.alongM-along)<.001);
      assert(Math.abs(owner.acrossM-side*500)<.001);samples++;
    }
    assert(outsideDistrict(d,p.eastM,p.northM)<0);
    const route=nearestStationByWall(d,addressAt(g.latitude,g.longitude,radius));
    const bay=nearestSite(d,along);
    assert.equal(route.site.address.key,bay.address.key);assert(Math.abs(route.distanceM-Math.abs(along-bay.x))<.002);
    assert(outsideDistrict({...d,sites:[]},p.eastM,p.northM)<0);
    const facets=wallWindow({...d,sites:[]},p.eastM,p.northM,{quad(){}});
    assert(facets.edges.includes(edge.id));assert(facets.segments>0&&facets.segments<550);
    peak=Math.max(peak,facets.segments);
    const s=generateStation(nearestSite(d,p.eastM).address);
    const eye={...p,altitudeM:1820,yaw:0,pitch:0,mode:'flight'};
    const land=move(s,d,eye,walker,0,0,-160,0).pose;
    assert(Math.abs(land.altitudeM-1746.7)<.01);
    const highSide=pointOnEdge(edge,along,linkHalfM+45),other=pointOnEdge(edge,along,-linkHalfM-45);
    const start={...districtPoint(d,highSide.latitude,highSide.longitude),altitudeM:121.7},
      end={...districtPoint(d,other.latitude,other.longitude),altitudeM:121.7};
    assert(!exteriorMoveAllowed(s,d,start,end));assert(!exteriorMoveAllowed(s,d,end,start));
  }
  const corner=pointOnEdge(edge,edge.lengthM/2),junction=nearbyEdges(corner.latitude,corner.longitude,radius,24000);
  assert(junction.length>=3 && junction.some(arm=>arm.axis!==edge.axis));
  for(const arm of junction){
    const end=edgeCoordinates(arm,corner.latitude,corner.longitude).alongM,inside=end-Math.sign(end)*8000;
    const g=pointOnEdge(arm,inside),p=districtPoint(d,g.latitude,g.longitude),back=districtLocation(d,p.eastM,p.northM);
    assert.equal(addressAt(back.latitude,back.longitude,radius).edge.id,arm.id);
    assert(outsideDistrict(d,p.eastM,p.northM)<0);
  }
}
console.log('Geographic wall passed',samples,'receiving-side probes, two worlds, meridian wrap, unequal rows and real junctions. Peak segments',peak);

const district=districtFor(worlds[0],'r10c0','r10c1',radius);
const violet=sharedEdge('r8c31','r9c31',radius);
const photo=addressAt(-13.333333268103*Math.PI/180,35.999566700657*Math.PI/180,radius);
const route=nearestStationByWall(district,photo);
assert.equal(route.site.bay,-1);assert(Math.abs(route.distanceM/1000-409245316.3)<.1);
for(const fraction of [-.5,.5]){
  const tip=pointOnEdge(violet,violet.lengthM*fraction);
  const arms=nearbyEdges(tip.latitude,tip.longitude,radius,5000),distance=arm=>
    nearestStationByWall(district,{edge:arm,alongM:edgeCoordinates(arm,tip.latitude,tip.longitude).alongM}).distanceM;
  for(const arm of arms)assert(Math.abs(distance(violet)-distance(arm))<.01,'Distance agrees at a real junction');
}
const along=photo.alongM,pose=(across,altitudeM=155)=>{
  const ll=pointOnEdge(violet,along,across);
  return {...districtPoint(district,ll.latitude,ll.longitude),altitudeM,mode:'flight',pitch:.1,yaw:.21};
};
const old=pose(linkHalfM-120),bay=generateStation(nearestSite(district,old.eastM).address);
const rescued=recoverWallPose(district,old,walker);
assert.equal(rescued.altitudeM,1746.7);assert.equal(rescued.eastM,old.eastM);
assert.equal(recoverWallPose(district,rescued,walker),rescued);
assert.equal(recoverWallPose(district,old,walker,null,true),old,'Lawful saved passage remains usable');
const habitat=recoverWallPose(district,old,walker,violet.plots[1]);
assert(outsideDistrict(district,habitat.eastM,habitat.northM)>1);
assert.equal(recoverWallPose(district,habitat,walker,violet.plots[1]),habitat);
const side=pose(linkHalfM+42),aim=pose(linkHalfM-120);
const contact=constrainExterior(bay,district,side,aim),loc=districtLocation(district,contact.eastM,contact.northM);
assert(outsideDistrict(district,contact.eastM,contact.northM)>0);
assert(Math.abs(edgeCoordinates(violet,loc.latitude,loc.longitude).alongM-along)<.1,'Head-on contact should not shove the pilot sideways');
console.log('PASS surveyed station distance, corner continuity, saved poses and remote wall contact');
