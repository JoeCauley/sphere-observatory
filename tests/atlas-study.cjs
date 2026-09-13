const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../watershed-network.js');require('../atlas-study-model.js');
const A=SphereAtlasStudy,s={...M.defaultState(),collection:true},before=JSON.stringify(s);let probes=0;
for(const seed of [713,827,341,902]){
 const p=A.province(seed);let outflow=0;
 for(let i=0;i<p.parent.length;i++){const parent=p.parent[i];assert(p.filled[i]>=p.height[i]);if(parent<0)outflow+=p.flow[i];else{assert(p.filled[parent]<p.filled[i],'Drainage must descend without cycles');assert(p.flow[parent]>p.flow[i]);}probes++;}
 assert.equal(outflow,p.n*p.n,'Every catchment cell contributes to a boundary outlet');assert(p.rivers.length>100);assert(p.sites.length>3);assert(p.focus.u>.075&&p.focus.u<.925&&p.focus.v>.235&&p.focus.v<.765,'Close footprint must fit the province viewport');
 assert.deepEqual(A.province(seed).flow,p.flow,'The drainage graph is repeatable');
}
for(const region of ['forest','industrial','boundary','wound-a','wound-b'])assert(Math.abs(M.length(A.address(s,region))-1)<1e-12);
assert.equal(SphereWorld.sample(A.address(s,'wound-a'),s).id,0);assert.equal(SphereWorld.sample(A.address(s,'wound-b'),s).id,3);
for(const candidate of A.candidates)for(let lat=-1.5;lat<=1.5;lat+=.1)for(let lon=-3;lon<3;lon+=.2){const f=A.macro(candidate.id,lat,lon,s);assert(f.color.every(x=>Number.isFinite(x)&&x>=0));}
assert.equal(JSON.stringify(s),before);assert.equal(M.validate(M.sceneRecord(s).state).layoutVersion,2);
console.log(`PASS ${probes} drainage cells: strict downhill routing, conserved catchment area, deterministic seeds, shared zoom footprints and unchanged scene layout.`);
