const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');require('../edge-stream.js');
const W=SphereWorld,C=SphereCollection,E=SphereEdges,s={...M.defaultState(),collection:true,era:'after',multipleWounds:true};
let probes=0,maxDistanceError=0;
for(const radius of [1e7,M.AU,1e9])for(let index=0;index<6;index++)for(const angle of [0,.72,Math.PI/2,2.86]){
 const state={...s,radius},f=W.rimFrame(state,index,angle);let previous=1;
 for(const km of [0,.001,.1,1,20,60,120,200,240,300]){const q=M.add(M.mul(f.point,Math.cos(km/radius)),M.mul(f.inland,Math.sin(km/radius))),distance=W.woundDistance(q,state),damage=W.woundBlend(distance);
  assert(Number.isFinite(distance));assert(Math.abs(distance-km)<Math.max(.00002,km*.015),`Wound ${index}, r=${radius}, ${km}: distance ${distance}`);maxDistanceError=Math.max(maxDistanceError,Math.abs(distance-km));assert(damage<=previous+1e-10);previous=damage;
  for(let biome=0;biome<10;biome++){const region=W.sample(q,{...state,biome});assert.equal(region.id,biome);assert.equal(region.a,biome);assert.equal(region.b,biome);assert.equal(region.damage,damage);assert.equal(W.sample(q,{...state,biome,era:'before'}).damage,0);assert.equal(W.sample(q,{...state,biome,multipleWounds:false}).damage,0);probes++;}
 }
 // Independent nearest-boundary search validates the local distance conversion.
 const q=M.add(M.mul(f.point,Math.cos(120/radius)),M.mul(f.inland,Math.sin(120/radius))),nearest=W.nearestRim(q,state);assert(Math.abs(nearest.distance-W.woundDistance(q,state))<1.8);
 // Moving the camera has no influence on the CPU field.
 const a=W.sample(q,{...state,position:M.mul(q,radius-1)}),b=W.sample(q,{...state,position:M.mul(f.point,radius-200)});assert.deepEqual(a,b);
}
// Across-vector coordinate poles must not create false bands far from a Wound.
for(const w of C.wounds){const q=M.cross(w.axis,w.tangent);assert.equal(W.woundBlend(W.woundDistance(q,s)),0);assert.equal(W.woundBlend(W.woundDistance(M.mul(q,-1),s)),0);}
assert.equal(W.woundBlend(0),1);assert.equal(W.woundBlend(240),0);assert.equal(W.woundBlend(Infinity),0);
console.log('PASS',probes,'biome/damage probes across six Wounds and three radii, monotonic damage, undamaged eras, fixed world coordinates and coordinate poles; max local distance error',maxDistanceError,'km.');
