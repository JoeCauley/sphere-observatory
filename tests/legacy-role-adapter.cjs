const assert=require('node:assert/strict');
const A=require('../world-address.js'),T=require('../world-topology.js'),M=require('../math.js');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../biome-packs.js');require('../world.js');require('../watershed-network.js');require('../field-sites.js');
const Roles=require('../legacy-role-adapter.js');
require('../watershed-province.js');require('../world-geography.js');

const expected={
 'Water recovery':'water-recovery',
 'Reserve storage':'reserve-storage',
 'Fabrication':'fabrication',
 'Thermal transfer':'thermal-transfer'
};
for(const [display,slug] of Object.entries(expected)){
 const adapted=Roles.adapt(display);assert.deepEqual(adapted,{slug,displayName:display});assert.equal(Roles.displayName(slug),display);
 const address=A.shell({worldSeed:713,geographyRevision:1,terrainRevision:2,artRevision:2,assetRevision:1,heroRevision:null,direction:[.2,.3,.9327379],level:8});
 assert.equal(A.featureId('district',address,slug),`district:713:1:s${address.face}.${address.level}.${address.x}.${address.y}:${slug}`);
}
assert.throws(()=>Roles.adapt('Water recovery '),/Unknown legacy Watershed role/);
const state=SphereWatershed.activate({...M.defaultState(),collection:true,era:'after'}),groups=SphereWatershed.geometry(state);
assert(groups.length>=5,'Full Watershed geometry must include the four service-role groups');
const stations=SphereWatershed.model(state.provinceSeed).stations;
assert.deepEqual([...new Set(stations.map(s=>s.role))].sort(),Object.values(expected).sort());
for(const station of stations){const field=SphereGeography.query(SphereWatershed.direction(station.x,station.z,state),{state,representation:'district'});assert.equal(field.serviceRole,station.role);assert.equal(field.serviceRoleDisplay,station.displayRole);}
console.log(JSON.stringify({status:'PASS',roles:Object.keys(expected).length,geometryGroups:groups.length,stableSlugs:Object.values(expected)}));
