import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sharedEdge,edgesOf} from '../packs/border-transport/0.10.0/edges.mjs';
import {borderFrontage,stationMouth} from '../packs/kit/border-frontage.mjs';
import {occupiedLot} from '../packs/kit/station-exterior.mjs';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {generateStation} from '../packs/border-transport/0.10.0/station.mjs';

const atlas=globalThis.SphereAtlas,radius=149597870700,home=atlas.byId('r10c0');
const west=sharedEdge(home.id,'r10c'+(home.columns-1),radius);
const north=edgesOf(home,radius).find(edge=>edge.axis==='parallel'&&edge.latitude>home.latitude);
const nativeAt=()=>({biome:1,color:[.13,.28,.14]});
const def={id:'sun-fern',border:{profile:'meadow'},overview:{albedo:[.16,.42,.15]}};
const item={id:'sun-fern-west',packId:def.id,plot:home.index,plotId:home.id,footprint:{shape:'rectangle',east:1,north:.76}};
const front=(edge,side,items,native=nativeAt)=>borderFrontage(edge,side,0,24004,items,id=>id===def.id?def:null,native);
const westSide=west.plots.indexOf(home.id);
const owned=front(west,westSide,[item]),opposite=front(west,1-westSide,[item]);
assert.deepEqual([owned.instanceId,owned.canEnterPack,owned.profile],[item.id,true,'meadow']);
assert.deepEqual(owned.albedo,def.overview.albedo);assert.equal(atlas.plotAt(owned.latitude,owned.longitude).id,home.id);
assert.deepEqual([opposite.instanceId,opposite.profile],[null,'jungle']);
assert.equal(front(north,north.plots.indexOf(home.id),[item]).instanceId,null,'Partial footprint reaches the date line and leaves the northern frontage native');
assert.equal(front(north,north.plots.indexOf(home.id),[{...item,footprint:undefined}]).instanceId,item.id,'Legacy full plots');
const dormant=front(west,westSide,[{...item,detailInstalled:false}]);
assert.equal(dormant.canEnterPack,false);assert.deepEqual(dormant.albedo,owned.albedo);
const occ={...item,occurrence:{latitude:owned.latitude,longitude:owned.longitude,biome:1,angularRadius:1e-7}};
assert.equal(front(west,westSide,[occ]).instanceId,item.id);
assert.equal(front(west,westSide,[occ],()=>({biome:9,color:[.3,.2,.4]})).instanceId,null);
const cap=edgesOf(atlas.byId('r0c1'),radius).find(e=>e.plots.includes('polar-south'));
assert.equal(atlas.plotAt(front(cap,0,[]).latitude,front(cap,0,[]).longitude).id,cap.plots[0]);
assert.equal(atlas.plotAt(front(cap,1,[]).latitude,front(cap,1,[]).longitude),null);
assert.throws(()=>borderFrontage(west,0,west.lengthM,1,[],()=>null,nativeAt),RangeError);
for(const [seed,packId] of [[713,'sun-fern'],[714,'river-glass']]){
  const key='sphere-'+createHash('sha256').update(JSON.stringify({seed})).digest('hex').slice(0,16);
  const district=districtFor(key,...west.plots,radius,undefined,[0]);
  const station=generateStation(district.origin),solids=JSON.stringify(station);
  for(const route of station.routes)for(const side of [0,1]){
    const [x,,z]=side?route.farDoor:route.nearDoor;
    for(const inward of [-8,0,15,38]){
      const mouth=stationMouth(station,x+route.door[0]*.4,z+(side?-1:1)*inward);
      assert.equal(mouth.route,route);assert.equal(mouth.side,side);assert(Math.abs(mouth.depth-inward)<1e-12);
    }
  }
  const definition={...def,id:packId,border:{profile:'pumice',exterior:'./marker.mjs'}};
  const placement={...item,id:packId+'-west',packId};
  const at=(along,items)=>borderFrontage(west,westSide,along,station.widthM/2+4,items,()=>definition,nativeAt);
  const centre=at(0,[placement]),far=at(west.lengthM*.47,[placement]);
  assert.deepEqual([centre.instanceId,centre.profile,centre.exterior],[placement.id,'plain','./marker.mjs']);
  assert.equal(far.instanceId,null,'Two stretches of the same face have different owners');
  const regional=at(0,[{...placement,detailInstalled:false}]),removed=at(0,[]);
  assert.deepEqual([regional.instanceId,regional.canEnterPack,regional.exterior],[placement.id,false,null]);
  assert.deepEqual([removed.instanceId,removed.nativeBiome,removed.albedo],[null,1,nativeAt().color]);
  assert.equal(JSON.stringify(generateStation(district.origin)),solids);
}
const field={eastM:0,northM:0,bounds:[0,0,12000,24000],axes:[1,0,0,1],doors:[2600],clearances:[7],apronRunM:3500};
assert(occupiedLot(field,2700,23988,16));
assert(occupiedLot(field,2660,24120,70),'A lot corner intersects the paved service approach');
assert(!occupiedLot(field,2700,24120,70));
console.log('PASS exact footprint, arbitrary pack instance, native occurrence, regional-only, date-line and polar frontages.');
