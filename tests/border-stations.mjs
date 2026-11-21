import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {addressOf,generateStation,classes,atDistance,distanceOf,fits,freightAt,releaseIn,advanceWalker,surfaceAddress} from '../studies/border-crossing/station.mjs';
import {resolveStation} from '../studies/border-crossing/station-store.mjs';
import {createHash} from 'node:crypto';
import {freightMesh} from '../studies/border-crossing/view.mjs';
const atlas=globalThis.SphereAtlas,edge=atlas.northEdge('r10c0');
const world=n=>'sphere-'+n.toString(16).padStart(16,'0');
const make=(w,bay)=>addressOf(world(w),edge.near,edge.far,bay);
const layouts=new Set();
let surveys=0,routes=0,floorRoutes=0,clearances=0,maxGrade=0,waitingCases=0;
for(const w of [23,713,1651,38201])for(let i=-12;i<12;i++){
  const site=make(w,i),opposite=addressOf(world(w),edge.far,edge.near,i);
  assert.deepEqual(site,opposite);
  const s=generateStation(site);assert.deepEqual(s,generateStation(opposite));
  surveys++;layouts.add(s.layout);
  for(const [index,route] of s.routes.entries()){
    const body=classes[index],len=distanceOf(route),high=Math.max(...route.points.map(p=>p[1]));
    assert.deepEqual(atDistance(route,0).position,route.nearDoor);
    assert.deepEqual(atDistance(route,len+1).position,route.farDoor);
    assert.equal(route.farDoor[2]-route.nearDoor[2],s.widthM);
    for(const [i,socket] of [route.nearDoor,route.farDoor].entries()){
      const w=surfaceAddress(s,socket);assert.equal(atlas.plotAt(w.latitude,w.longitude).id,site.plots[i]);
    }
    assert(high+body.body[1]<s.roofM);
    for(let j=0;j<classes.length;j++){
      assert.equal(fits(route,...classes[j].body.slice(0,2)),j<=index);clearances++;
    }
    for(let k=1;k<route.points.length;k++){
      const p=route.points[k-1],q=route.points[k];
      const grade=Math.abs(p[1]-q[1])/Math.hypot(q[0]-p[0],q[2]-p[2]);
      assert(grade<=body.maxGrade);maxGrade=Math.max(maxGrade,grade);
    }
    const crown=atDistance(route,len/2).position[1];
    if(index<2)assert(crown-route.deckDepthM-s.traffic.heightM>=70,'Train fits under both bridges');
    if(index===2)assert(crown+route.door[1]<=-24,'Roof of heavy bore fits under structural slab');
    for(const dir of [1,-1]){
      let p={distanceM:dir>0?0:len,transferDirection:0},steps=0;
      let t=(w-1000)*127+i*137;
      while(Math.abs(p.distanceM-(dir>0?len:0))>.0001&&++steps<2000){
        const next=advanceWalker(s,route,p,dir,37,t);if(next.waiting)waitingCases++;
        if(index===3){
          const pos=atDistance(route,next.distanceM).position;
          if(Math.abs(pos[2]-s.widthM/2)<s.laneHalfM+body.body[2]/2){
            const car=freightAt(s,t+37);
            assert(Math.abs(pos[0]-car.x)>(body.body[0]+car.lengthM)/2,'Transverse and longitudinal loads overlap');
          }
        }
        p=next;t+=37;
      }
      assert(steps<2000);assert.equal(p.distanceM,dir>0?len:0);routes++;
    }
  }
  for(const dir of [1,-1]){
    const len=distanceOf(s.floorRoute),p=advanceWalker(s,s.floorRoute,{distanceM:dir>0?0:len,transferDirection:0},dir,90000,200);
    assert.equal(p.distanceM,dir>0?len:0);floorRoutes++;
  }
  assert(s.lookoutRoute.points.some(([x,y,z])=>x===s.lookout.x&&y===s.lookout.y&&z===s.lookout.z));
  assert(Math.min(s.lookout.east-s.lookout.x,s.lookout.far-s.lookout.z)>=classes[0].body[0]/2);
  const next=generateStation(make(w,i+1));
  const a=freightAt(s,12345),b=freightAt(next,12345);
  const absolute=(station,car)=>station.address.chainageM+car.x+car.train*car.spacingM;
  assert(Math.abs(absolute(s,a)-absolute(next,b))<1e-5);
}
assert.equal(layouts.size,3);assert(waitingCases>0);
assert.throws(()=>addressOf(world(23),'r10c1','r10c4',0));
const wrap=addressOf(world(23),'r10c0','r10c'+(atlas.columns(10)-1),0);
assert.equal(wrap.axis,'meridian');assert(Math.abs(Math.abs(wrap.longitude)-Math.PI)<1e-8);
const seam=generateStation(wrap);
for(const [i,socket] of [seam.routes[0].nearDoor,seam.routes[0].farDoor].entries()){
  const w=surfaceAddress(seam,socket);assert.equal(atlas.plotAt(w.latitude,w.longitude).id,wrap.plots[i]);
}
assert.throws(()=>make(23,Number.MAX_SAFE_INTEGER));
assert.throws(()=>make(23,.3));
assert.throws(()=>addressOf('unknown',edge.near,edge.far,0));
const base=generateStation(make(23,0)),trunk=base.routes[3];
const mesh=freightMesh(base.traffic),envelope=[0,0,0];
for(let i=0;i<mesh.length;i+=9){
  const [x,y,z]=mesh.slice(i,i+3);assert(y>=0);
  envelope[0]=Math.max(envelope[0],Math.abs(x)*2);envelope[1]=Math.max(envelope[1],y);envelope[2]=Math.max(envelope[2],Math.abs(z)*2);
}
assert.deepEqual(envelope,[base.traffic.lengthM,base.traffic.heightM,base.traffic.widthM],'Rendered freight fits its declared envelope');
const span=base.laneHalfM+classes[3].body[2]/2+50,entry=base.widthM/2-span;
const shut=trunk.nearDoor[0]/base.traffic.speedMps-base.traffic.phaseS;
const delay=releaseIn(base,shut,trunk);
assert(delay>0&&delay<base.traffic.periodS);
let w=advanceWalker(base,trunk,{distanceM:entry,transferDirection:0},1,delay/2,shut);
assert(w.waiting&&w.distanceM===entry);
w=advanceWalker(base,trunk,w,1,delay/2+10,shut+delay/2);
assert.equal(w.transferDirection,1);
const coast=advanceWalker(base,trunk,w,-1,10,shut+delay+10);
assert(coast.distanceM>w.distanceM,'Registered transfer keeps its direction until its tail is clear');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sphere-border-records-'));
try{
  const site=make(23,0);
  const preview=await resolveStation(dir,site);assert.equal(preview.locked,false);assert.deepEqual(await fs.readdir(dir),[]);
  const opposite=addressOf(world(23),edge.far,edge.near,0);
  const results=await Promise.all(Array.from({length:16},(_,i)=>resolveStation(dir,i%2?site:opposite,true)));
  assert.deepEqual(new Set(results.map(x=>JSON.stringify(x))).size,1);
  assert.equal((await fs.readdir(dir)).length,1);
  const revisited=await resolveStation(dir,opposite,true,()=>{throw Error('Stored geometry must survive generator changes');});
  assert.deepEqual(revisited,results[0]);assert.deepEqual(revisited.station,preview.station);
  const oldSite=make(713,0);
  assert.equal((await resolveStation(dir,oldSite)).locked,false);
  const historic={station:generateStation(oldSite),discoveredAt:'2026-11-20T12:00:00.000Z'};
  delete historic.station.address.radiusM;
  const flat=createHash('sha256').update(oldSite.key).digest('hex')+'.json';
  await fs.writeFile(path.join(dir,flat),JSON.stringify(historic));
  const recovered=await resolveStation(dir,oldSite,true,()=>{throw Error('Historical station was regenerated');});
  assert.deepEqual(recovered,{...historic,locked:true});
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log(JSON.stringify({stations:surveys,layouts:layouts.size,directedClassCrossings:routes,serviceFloorCrossings:floorRoutes,doorFitComparisons:clearances,maxGradePercent:+(100*maxGrade).toFixed(3),holdsObserved:waitingCases,concurrentDiscoverers:16}));
