const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const G=SphereGround,W=SphereWorld,base={...M.defaultState(),collection:true,routeShades:false,starStation:false,multipleWounds:false,siteId:'biome-5',siteRevision:2};
base.siteAnchor=W.locateBiome(5,base);base.terrainAnchor=base.siteAnchor.slice();let first=G.frame(base);base.position=first.world([.4,.1,.4]);

// A rebase changes the chart, never the address of the place at its centre.
const place=M.norm(first.world([7.1,0,.4])),rebased={...base,terrainAnchor:place,position:M.mul(place,base.radius)},rebasedFrame=G.frame(rebased);
const oldAddress=G.addressAt(base,first,7.1,.4),newAddress=G.addressAt(rebased,rebasedFrame,0,0);
assert.equal(oldAddress.cellId,newAddress.cellId,'Render-frame rebasing cannot rename a geographic cell');
assert.notEqual(G.renderKey(base),G.renderKey(rebased),'Render frames remain distinct for active meshes');
const oldCell=G.geographicCell(base,first,7.1-.512,.4-.512,G.SIZE,G.SIZE),newCell=G.geographicCell(rebased,rebasedFrame,-.512,-.512,G.SIZE,G.SIZE);
assert.equal(G.cacheKey(base,{geography:oldCell,cells:G.FINE}),G.cacheKey(rebased,{geography:newCell,cells:G.FINE}),'Cache identity is independent of terrainAnchor');

// Reversal and a low-budget departure may discard resources, but return content
// is still generated from the same geographic identity and object stream.
G.dispose();const propHash=s=>G.neighbourhood(s).filter(m=>m.chunk.cells===G.FINE).flatMap(m=>m.ground.props).sort().join('|');
const start=G.neighbourhood(base),before=propHash(base);assert.equal(start.length,25);assert.equal(G.info.queue,0);
const reversed={...base,position:first.world([2.4,.1,.4])};G.neighbourhood(reversed);G.neighbourhood(base);assert.equal(propHash(base),before,'Rapid reversal cannot reroll stable objects');
G.setBudget(40*1048576);
const farAnchor=M.norm(first.world([8.4,0,.4])),farFrame=G.frame({...base,terrainAnchor:farAnchor}),far={...base,terrainAnchor:farAnchor,position:farFrame.world([.4,.1,.4])};G.neighbourhood(far);assert(G.info.evictions>0,'Forced low budget must evict by residency policy');assert(G.info.bytes<=G.info.budget);
const restored=G.neighbourhood(base);assert.equal(propHash(base),before,'Teleport away/back preserves object identity');assert.equal(G.info.queue,0);assert.equal(G.info.waits,0);assert.equal(G.info.stableIdentity,true);
console.log('PASS stable cell/cache identity across rebase, reversal, teleport and forced recency/support eviction',JSON.stringify({cache:G.info.cache,bytes:G.info.bytes,budget:G.info.budget,evictions:G.info.evictions}));
G.dispose();
