import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import atlas from '../sphere-atlas.js';
import {canStand,surveyGate} from '../portal-landing.js';
import {footprint} from '../geographic-flight.js';
import {passageAt,ownerAt} from '../surface-passages.js';
import {circuits,runCircuit,blockedCityDoor,blockedWallCourse,circuitWorld,circuitPlots} from './support/surface-circuits.mjs';
import {circleThrough,clearsDistrict,planWalk} from '../surface-circuit.js';
import {surveyJungleGrove} from '../packs/super-jungle/1.0.0/survey.mjs';
import {surveyViolet} from '../packs/violet-labyrinth/1.0.0/survey.mjs';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtLocation} from '../packs/border-transport/0.10.0/district.mjs';
const require=createRequire(import.meta.url),math=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const env={math,collection:globalThis.SphereCollection,world:globalThis.SphereWorld,atlas};
const state={...math.defaultState(),...env.world.defaults,collection:true,era:'after',multipleWounds:true};
const catalogue=require('../packs/biome-library.json').packs;
function installations(s,worldKey,placements){
  const d=districtFor(worldKey,'r12c35','r12c36',s.radius*1000);
  const items=catalogue.map(p=>{
    if(p.placement.habitat!=null){
      // The public catalogue installs the native detail packs before Border.
      const f=p.placement.habitat===9?surveyViolet(s):surveyJungleGrove(s,globalThis,null,{eastM:-8000,northM:12000});
      assert(f,p.name+' must have a surveyed address');
      return {id:p.id,name:p.name,plot:f.plot.index,plotId:f.plot.id,occurrence:f.occurrence};
    }
    if(p.placement.facility==='transport'){
      return {id:p.id,name:p.name,edge:{near:d.origin.plots[0],far:d.origin.plots[1],...d.origin},transport:d};
    }
    const placement=placements[p.id],plot=atlas.byId(placement.plotId);
    return {id:p.id,name:p.name,plot:plot.index,...placement};
  });
  const gallery=catalogue.find(p=>p.id==='border-transport').facilities.outfall;
  items.push({id:gallery.id,name:gallery.name,edge:atlas.northEdge('r12c35')});
  return items;
}
const items=installations(state,'sphere-0000000000000017',{
  ...circuitPlots,'sideways-city':{plotId:'r10c20'}
});
const routeSeed=process.env.SPHERE_WALK_SEED===undefined?undefined:Number(process.env.SPHERE_WALK_SEED);
if(routeSeed!==undefined && !Number.isSafeInteger(routeSeed))throw Error('SPHERE_WALK_SEED must be an integer');
const city=atlas.byId(blockedCityDoor.plotId),actual=items.map(i=>i.id==='sideways-city'?{...i,plot:city.index,plotId:city.id}:i);
const gate=passageAt(blockedCityDoor.q,blockedCityDoor.forward,state.radius);
Object.assign(gate.far,ownerAt(gate.far.q,state,actual,atlas,env.world));
assert.equal(gate.far.id,'sideways-city');assert(!canStand(gate.far.q,gate.far.id,state,actual,env));
const normal=math.norm(math.cross(blockedCityDoor.q,blockedCityDoor.forward)),origin=math.norm(math.cross(env.world.frame(state).axis,normal));
assert.equal(planWalk({origin,forward:math.norm(math.cross(normal,origin)),normal},state,actual,env),null,'A straight great-circle walk cannot bend around the City building');
const clear=surveyGate(gate,state,actual,env);assert(canStand(clear.far.q,clear.far.id,state,actual,env,.8));
assert.deepEqual(clear.near.q,gate.near.q);assert(Math.abs(clear.surveyOffsetM)<=512&&clear.surveyOffsetM!==0);
assert(Math.abs(state.radius*Math.hypot(...clear.far.q.map((v,i)=>v-clear.near.q[i]))-1000)<1e-6);
console.log('PASS surveyed a blocked City outlet onto open ground at a lateral offset of',clear.surveyOffsetM,'m, preserving the 1,000 km straight tunnel.');
const d=items.find(i=>i.transport).transport;
assert.equal(planWalk(circleThrough(d.origin.latitude,d.origin.longitude,.9,state,env.world),state,items,env),null,'A Builder district requires its surveyed crossings');
// A meridional district has real gaps between its wide halls. A straight
// course may clear the entire site while crossing the old 244 km exclusion.
const surveyed=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',state.radius*1000);
function alongTrunk(offsetM){
  const a=districtLocation(surveyed,0,offsetM),b=districtLocation(surveyed,1000,offsetM);
  const normal=math.norm(math.cross(env.world.direction(a.latitude,a.longitude,state),env.world.direction(b.latitude,b.longitude,state)));
  return {normal};
}
assert(clearsDistrict(alongTrunk(32000),surveyed,state,env.world),'A course outside every hall clears the district');
assert(!clearsDistrict(alongTrunk(27000),surveyed,state,env.world),'The wider neighboring hall blocks this course');
const link=districtLocation(surveyed,100000,0);
assert(!clearsDistrict(circleThrough(link.latitude,link.longitude,Math.PI/2,state,env.world),surveyed,state,env.world),'The trunk between two halls is solid');
const eye={...state,position:blockedWallCourse.mouth.map(v=>v*(state.radius-.0017))};
assert(footprint(eye,{matchesWorld:()=>true,locations:()=>items},atlas,env.world)?.transport);
assert.equal(planWalk(blockedWallCourse,state,items,env),null,'A native habitat boundary inside the Atlas wall has no walk-through portal');
const survey={...state,...circuitWorld};
const surveyedItems=installations(survey,'sphere-2055755fe373aee3',{
  ...circuitPlots,'sideways-city':{plotId:'r13c0',footprint:catalogue.find(p=>p.id==='sideways-city').placement.footprint}
});
const routes=circuits(survey,surveyedItems,env,routeSeed);
const results=routes.map(plan=>runCircuit(plan,survey,surveyedItems,env));
const wound=env.collection.wounds[0],hit=env.world.coordinates(wound.axis,state);
assert.equal(planWalk(circleThrough(hit.lat,hit.lon,.7,state,env.world),state,items,env),null);
console.log('PASS',results.length,'complete great circles,',results.reduce((s,r)=>s+r.tunnel,0),'straight through-tunnels, surveyed Outfall and plot packs alongside the new district, all Main surface regions, largest closure error',Math.max(...results.map(r=>r.closureM)).toFixed(6),'m. Wound crossing rejected.');
