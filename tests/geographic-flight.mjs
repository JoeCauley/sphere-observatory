import assert from 'node:assert/strict';
import atlas from '../sphere-atlas.js';
import {packPose,mainPose,footprint,enterKm,leaveKm,meadowStations,stationToMeadowPose,meadowToStationPose,stationBasis,supportsLowAddress} from '../geographic-flight.js';
import {chartFor,project,unproject,toMeadow} from '../packs/kit/surface-route.js';
import {apronHeight} from '../packs/kit/meadow-border.js';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import * as districtRules from '../packs/border-transport/0.10.0/district.mjs';
import M from '../math.js';
import '../collection.js';
import '../biomes.js';
import '../world-palette.js';
import '../world.js';
import '../field-sites.js';
import {terrain,setStations,stationApron} from '../packs/infinite-meadow/1.3.0/landscape.js';

const radius=149597870.7, close=(a,b,tol)=>assert(Math.abs(a-b)<tol,`${a} vs ${b}`);
const world={
  smooth:globalThis.SphereWorld.smooth,
  direction:(lat,lon)=>[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)],
  coordinates:q=>({lat:Math.asin(q[1]),lon:Math.atan2(q[2],q[0])})
};
const meadow={id:'infinite-meadow',plotId:'r10c0'},city={id:'sideways-city',plotId:'r13c0'},industry={id:'infinite-industry',plotId:'r7c21'};
for(const item of [meadow,city,industry])item.plot=atlas.byId(item.plotId).index;
const outfall={id:'border-transport/outfall',edge:atlas.northEdge(meadow.plotId)};
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
// The same local handwheel can sit above or below the reference shell in different worlds.
for(const plot of ['r10c0','r12c35']){
  const wheel={eastM:.1,northM:11.25,altitudeM:1.7,yaw:.8,pitch:-.14,mode:'walk'};
  const facility={id:'border-transport/outfall',edge:atlas.northEdge(plot)};
  const camera=mainPose(state,facility,wheel,atlas,world);
  const altitudeKm=radius-Math.hypot(...camera.position);
  assert.equal(altitudeKm<0,plot==='r12c35');
  const wheelLibrary={...lib,installed:()=>[facility]};
  assert(supportsLowAddress(camera,wheelLibrary,atlas,world));
  const buried=mainPose(state,facility,{...wheel,altitudeM:-10},atlas,world);
  assert(!supportsLowAddress(buried,wheelLibrary,atlas,world));
  const inConcrete=mainPose(state,facility,{...wheel,eastM:12},atlas,world);
  assert(!supportsLowAddress(inConcrete,wheelLibrary,atlas,world),'The Outfall wall is solid next to its gallery');
  const actual=packPose(camera,facility,atlas,world,{exactAltitude:true});
  for(const axis of ['eastM','northM','altitudeM'])close(actual[axis],wheel[axis],.001);
}
const chart=chartFor(atlas.byId(meadow.plotId),outfall.edge,radius),datum=terrain(chart.eastM,chart.northM);
for(const x of [-27000,0,900000]){
  for(const z of [-2800,-2400,-160]){
    const m=toMeadow({eastM:x,northM:z,altitudeM:1.7,yaw:.4},chart,datum);
    close(apronHeight(chart,datum,x,z),terrain(m.eastM,m.northM)-datum,1e-7);
  }
  close(apronHeight(chart,datum,x,-18),0,1e-8);
}
const level=terrain(0,0);
const meadowLibrary={...lib,installed:()=>[meadow]};
const hollow={eastM:1250,northM:1880,yaw:.5,pitch:0,mode:'walk'};
hollow.altitudeM=terrain(hollow.eastM,hollow.northM)-level+1.7;
assert(hollow.altitudeM<1.7);
assert(supportsLowAddress(mainPose(state,meadow,hollow,atlas,world),meadowLibrary,atlas,world));
assert(!supportsLowAddress(mainPose(state,meadow,{...hollow,altitudeM:hollow.altitudeM-1},atlas,world),meadowLibrary,atlas,world));
for(const sphereRadius of [radius*1000,24000000])for(const far of ['r10c1','r11c0']){
  const home=atlas.byId(meadow.plotId),district=districtFor('sphere-0000000000000017',home.id,far,sphereRadius);
  const rows=meadowStations(district,home);
  setStations(rows,level);
  const row=rows.find(row=>row.site.bay===0),site=row.site;
  const seed=districtRules.stationHash(site.address.key);
  for(const [index,[width,head]] of districtRules.doorSizes.entries()){
    const centre=site.x+districtRules.doorOffset(seed,index);
    const z=-site.widthM/2+8,half=index===0?5.5:width/2,ceiling=index===0?7.3:head;
    for(const height of [1.7,90.7].filter(h=>h<ceiling))for(const side of [-1,1]){
      const probe=(inset,departing,y=height)=>districtRules.outsideStationScene(district,centre+side*(half-inset),z,y,departing);
      assert(probe(-.1,false)<=0 && probe(.2,true)<=0,'A side-step back over the jamb stays in the station');
      assert(probe(1,true)>0 && probe(.2,false)>0,'A traveller clear of the jamb can enter Meadow and look back');
      assert(probe(1,true,ceiling-.1)<=0 && probe(1,false,ceiling-.1)>0,'A small climb does not alternate owners at the door head');
      let inStation=true;const changes=[];
      const path=[.7,-.1,.1,-.1,.1,-.1,.1,-.1,.1,-.1,.7,1.2];
      for(const [frame,inset] of path.entries()){
        const next=probe(inset,inStation)<=0;
        if(next!==inStation)changes.push(frame);
        inStation=next;
      }
      assert.deepEqual(changes,[0,1,10],'Ownership is stable while sidestepping within the jamb margin');
      const original={eastM:centre+side*(half-1),northM:z,altitudeM:height,yaw:Math.PI+side*.72,pitch:-.35,mode:height===1.7?'walk':'flight'};
      const returned=meadowToStationPose(row,stationToMeadowPose(row,original));
      for(const axis of ['eastM','northM','altitudeM','pitch'])close(returned[axis],original[axis],.0002);
      close(Math.sin(returned.yaw-original.yaw),0,1e-12);
      assert.equal(returned.mode,original.mode);
    }
  }
  const stationItem={id:'border-transport',edge:{near:home.id},transport:district};
  const library={...lib,installed:()=>[stationItem,meadow]};
  for(const [i,left] of rows.slice(0,-1).entries()){
    const right=rows[i+1],centre=(left.site.x+right.site.x)/2;
    for(const [offset,expected] of [[-8,left],[8,right]]){
      const roofPose={eastM:centre+offset,northM:-districtRules.linkHalfM-1,
        altitudeM:expected.site.roofM+districtRules.roofSlabM+1.7,yaw:1.61,pitch:-.09,mode:'flight'};
      const outside=stationToMeadowPose(expected,roofPose);
      const location=rows[0].locate(outside.eastM,outside.northM);
      const owner=districtRules.nearestSite(district,location.eastM);
      assert.equal(owner,expected.site,'The matched roof camera follows the same nearest bay along a connector');
      const back=meadowToStationPose(expected,outside);
      for(const axis of ['eastM','northM','altitudeM','yaw','pitch'])close(back[axis],roofPose[axis],.001);
    }
  }
  const buried=mainPose({...state,radius:sphereRadius/1000},stationItem,
    {eastM:200000,northM:12000,altitudeM:-1000000,yaw:0,pitch:0,mode:'flight'},atlas,world);
  assert(!supportsLowAddress(buried,library,atlas,world),'No traveler below the terminal station slab');
  for(const walkMode of [false,true])for(const side of [-1,1])for(const gap of [-.25,.25,6,400]){
    const site=district.sites[0], location=districtRules.districtLocation(district,site.x,side*(site.widthM/2+gap));
    const s={...view(location.latitude,location.longitude,.1),radius:sphereRadius/1000,walkMode};
    assert.equal(footprint(s,library,atlas,world)?.id===stationItem.id,gap<0);
  }
  for(const bay of district.sites)for(const side of [-1,1])for(const outside of [8,14,32,3600]){
    const x=-2600,z=side*(bay.widthM/2+outside),geo=districtRules.districtLocation(district,bay.x+x,z);
    const p=project(home,geo.latitude,geo.longitude,sphereRadius);
    const apron=stationApron(p.eastM,p.northM,4000);
    close(apron.x,x,.002);close(apron.z,z,.002);
    if(outside<3500)close(terrain(p.eastM,p.northM),level,.001);
    const local={eastM:bay.x+x,northM:z,altitudeM:24000,yaw:.72,pitch:-1.08,mode:'flight'};
    const camera=mainPose({...state,radius:sphereRadius/1000},{id:'border-transport',edge:{near:home.id},transport:district},local,atlas,world);
    const basis=stationBasis(camera,district,local,world);
    close(basis.forward[0],Math.sin(local.yaw)*Math.cos(local.pitch),.0001);
    close(basis.forward[1],Math.sin(local.pitch),.0001);
    close(basis.forward[2],Math.cos(local.yaw)*Math.cos(local.pitch),.0001);
  }
}
setStations([],level);
// A station grades native ground on either side and in either Atlas orientation.
const ground=globalThis.SphereGround,nativeWorld=globalThis.SphereWorld;
const native={...M.defaultState(),siteId:'biome-2',siteRevision:2,terrainRevision:2};
for(const far of ['r10c1','r11c0']){
  const district=districtFor('sphere-0000000000000017','r10c0',far,native.radius*1000);
  const survey={district,parameters:{seed:native.seed}};
  ground.setApronSurvey(survey,districtRules);
  const ordinary=districtRules.districtLocation(district,94000,districtRules.linkHalfM+4);
  const frontage=nativeWorld.direction(ordinary.latitude,ordinary.longitude,native);
  assert(!ground.nearApron(frontage,native,5000),'The ordinary wall has no station apron');
  assert(ground.nearFrontage(frontage,native,5),'Horizontal flight near the ordinary wall needs local terrain');
  assert(!ground.nearFrontage(frontage,{...native,seed:native.seed+1},5));
  ground.setApronSurvey(null);
  for(const site of district.sites)for(const side of [-1,1])for(const lateral of [false,true]){
    for(const offset of [-40,0,48,120]){
      const x=site.x+(lateral?side*(districtRules.hallHalfM+offset):1300);
      const z=lateral?districtRules.linkHalfM+180:side*(site.widthM/2+districtRules.apronRunM+offset);
      const {latitude,longitude}=districtRules.districtLocation(district,x,z);
      close(districtRules.apronDistance(district,latitude,longitude),offset,.001);
      native.siteAnchor=nativeWorld.direction(latitude,longitude,native);
      const f=ground.frame(native),original=ground.geographic(native.siteAnchor,native);
      ground.setApronSurvey(null);
      const nativeKey=ground.renderKey(native);
      ground.setApronSurvey(survey,districtRules);
      const expected=original*nativeWorld.smooth(0,districtRules.apronBlendM,offset);
      close(ground.height(native,f,0,0),expected,1e-7);
      assert.notEqual(ground.renderKey(native),nativeKey);
      const foreign={...native,seed:native.seed+1};
      close(ground.height(foreign,f,0,0),ground.geographic(native.siteAnchor,foreign),1e-7);
      ground.setApronSurvey(null);
      assert.equal(ground.renderKey(native),nativeKey);
      close(ground.height(native,f,0,0),original,1e-7);
    }
  }
}
assert.equal(footprint(view(Math.PI/2,0,1),lib,atlas,world),null);
assert.equal(footprint(view(0,Math.PI,1),lib,atlas,world),null);
assert.equal(footprint(view(.01,.02,1),{...lib,matchesWorld:()=>false},atlas,world),null);
console.log('PASS atlas and pack poses, off-centre round trips, service borders and the Meadow ground across both handoff lines');
