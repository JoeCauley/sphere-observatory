const assert=require('node:assert/strict');
const A=require('../world-address.js'),T=require('../world-topology.js'),G=require('../world-geography.js'),E=require('../instanced-environment.js'),Grass=require('../grass-stream.js');

const radius=10000000,anchor=[.4283555294795114,-.605653780282823,-.6705930500634892],state={seed:713,worldSeed:713,geographyRevision:2,terrainRevision:2,artRevision:1,assetRevision:1,radius,terrainAnchor:anchor,siteAnchor:anchor,position:anchor.map(v=>v*radius),time:17,grass:{enabled:true}};
const frame=Grass.frameForState(state);state.position=frame.origin.map((v,i)=>v+frame.basis[0][i]*.128+frame.basis[2][i]*.128);
const height=q=>.002+.0002*Math.sin(q[0]*17+q[2]*9);
const requests=Grass.patchRequests(state,frame,{radiusPatches:1});assert.equal(requests.length,9);assert.equal(new Set(requests.map(p=>p.key)).size,9);
const build=request=>Grass.buildPatch({state,request,frame,rootsPerSubcell:4,terrainHeight:height});
const first=build(requests[0]),second=build(requests[0]);
assert.deepEqual(first.roots.map(r=>[r.key,r.prototypeId,r.height,r.phase]),second.roots.map(r=>[r.key,r.prototypeId,r.height,r.phase]),'A patch must be cold-repeatable');
assert(first.roots.every(r=>r.field.source==='generated'),'Roots query the generated semantic field');
assert(first.roots.every(r=>r.localOrigin.every(Number.isFinite)&&r.normal.every(Number.isFinite)),'Roots have finite conforming terrain data');
assert(first.instances.every(i=>i.addressKey&&i.addressKey.includes('"schema":2')),'Instances carry canonical World Address identity');
assert.equal(first.instanceBytes,first.instances.length*E.STRIDE,'Worker packet uses the compact instanced record');

const ordered=requests.map(build).sort((a,b)=>a.key.localeCompare(b.key));
const reversed=requests.slice().reverse().map(build).sort((a,b)=>a.key.localeCompare(b.key));
assert.deepEqual(ordered.map(p=>p.roots.map(r=>r.key)),reversed.map(p=>p.roots.map(r=>r.key)),'Generation order cannot change root ownership');
assert.deepEqual(ordered.map(p=>p.roots.map(r=>r.phase)),reversed.map(p=>p.roots.map(r=>r.phase)),'Generation order cannot change wind phases');

const manager=new Grass.GrassStreamManager({worker:false,radiusPatches:1,rootsPerSubcell:4,terrainHeight:height});
const initial=manager.request(state),initialHash=manager.hash();assert.equal(initial.patches.length,9);assert(initialHash.length===16);
const far={...state,position:[.5,0,radius],terrainAnchor:[0,0,1]};manager.request(far);assert(manager.info.disposed>0,'Leaving a region releases grass patch resources');
const restored=manager.request(state);assert.equal(manager.hash(),initialHash,'Unload and revisit must reproduce grass');assert(restored.patches.length===9);
const east={...state,position:state.position.map((v,i)=>v+frame.basis[0][i]*.6)},eastHash=manager.request(east)&&manager.hash();const west={...state,position:state.position.map((v,i)=>v-frame.basis[0][i]*.6)};manager.request(west);manager.request(east);assert.equal(manager.hash(),eastHash,'Reversed traversal must preserve the destination cluster');
const rebasedFrame={...frame,origin:frame.origin.map((v,i)=>v+(i===0?.512:0))},rebased=Grass.buildPatch({state,request:requests[0],frame:rebasedFrame,rootsPerSubcell:4,terrainHeight:height});assert.deepEqual(first.roots.map(r=>[r.key,r.height,r.phase]),rebased.roots.map(r=>[r.key,r.height,r.phase]),'Render-frame rebasing must not rename or reroll roots');assert.notDeepEqual(first.roots.map(r=>r.localOrigin),rebased.roots.map(r=>r.localOrigin),'Rebased instances use the new local frame');
const reordered=new Grass.GrassStreamManager({worker:false,radiusPatches:1,rootsPerSubcell:4,terrainHeight:height});reordered.options.radiusPatches=1;const shuffled=Grass.patchRequests(state,frame,{radiusPatches:1}).sort(()=>-.5);for(const request of shuffled)reordered.cache.set(request.key,build(request));assert.equal(reordered.hash(),initialHash,'Different patch completion order must preserve the aggregate hash');

const prototypes=Grass.grassPrototypes();assert.equal(prototypes.length,3);assert(prototypes.every(p=>p.alphaTest&&p.wind&&p.lods.length===2));
console.log(JSON.stringify({status:'PASS',patches:9,roots:first.roots.length,prototypes:prototypes.length,bytes:first.instanceBytes,hash:initialHash,disposed:manager.info.disposed,semantic:'water/path/rock/slope/structure/damage/canopy'}));
