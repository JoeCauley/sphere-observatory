const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','watershed-network','watershed-province','watershed-neighbourhood','flight','surface-walk','session-state'])require('../'+f+'.js');
const P=SphereWatershed,N=SphereNeighbourhood,K=SpherePacks,base={...M.defaultState(),collection:true},legacy=P.activate(base),s=K.activate(legacy);
assert.equal(legacy.packAddress,null);assert.equal(M.validate({...legacy,packAddress:undefined}).packAddress,null);
assert.deepEqual(P.geometry(s),P.geometry(legacy),'Pack must reuse the exact core meshes');
assert.deepEqual(M.validate(M.sceneRecord(s).state),s);assert.deepEqual(SphereSessionCodec.decode(SphereSessionCodec.encode(s,{})).state.packAddress,s.packAddress);
for(const patch of [{schema:2},{packId:'unknown'},{geographyRevision:2},{artRevision:2},{seed:714},{anchor:[1,0,0]}])assert.throws(()=>M.validate({...s,packAddress:{...s.packAddress,...patch}}));
for(const q of [s.provinceAnchor,P.direction(100,100,s)])assert.deepEqual(P.sample(q,s),P.sample(q,legacy));
for(const patch of [{time:1234567},{era:'before'},{axisLat:-20,axisLon:179}])assert.deepEqual(K.activate({...s,...patch}).packAddress,s.packAddress,'A saved pack address survives clock, era and atlas orientation changes');
let joins=0,segments=0;
for(const seed of [0,1,42,713,714,9981,2147483647]){
 const p=N.model(seed);assert(p.edges.length<=K.get('watershed').budget.graphSegments);segments+=p.edges.length;
 const source=SphereWatershed.model(seed).segments.filter(e=>Math.max(...e.b.map(Math.abs))>=319.999);
 assert.equal(p.junctions.length,source.length);
 for(const j of p.junctions){const e=p.edges.find(e=>e.from===j.node);assert.deepEqual(e.a,j.source);assert.equal(e.widthA,j.sourceWidth);assert(N.sampleLocal(...e.a,seed).river);joins++;}
 const adjacency=new Map();for(const e of p.edges){assert.notEqual(e.from,e.to);assert(e.widthB>=e.widthA,'Receiving rivers must not narrow downstream');for(const [a,b] of [[e.from,e.to],[e.to,e.from]]){if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a).push(b);}}
 const seen=new Set(),todo=[0];while(todo.length){const a=todo.pop();if(seen.has(a))continue;seen.add(a);todo.push(...(adjacency.get(a)||[]));}assert.equal(seen.size,p.nodes.length,'All receiving reaches must connect');
 // Shared node widths give matching water and bank-route intervals at joins.
 for(const e of p.edges){const a=p.nodes[e.from],b=p.nodes[e.to];assert.equal(e.widthA,a.width);assert.equal(e.widthB,b.width);assert(N.sampleLocal(...e.points[6],seed).river);}
 const snapshot=JSON.stringify(p.edges);N.model(seed+1);assert.equal(JSON.stringify(N.model(seed).edges),snapshot);
}
for(const anchor of [[0,1,0],[0,-1,0],M.axis(0,179.999),M.axis(0,-179.999)])for(const radius of [1e8,M.AU,3e8]){
 const state=M.validate({...s,radius,position:M.mul(anchor,radius-1000),provinceAnchor:anchor,packAddress:{...s.packAddress,anchor}});
 for(const [x,z] of [[900,0],[-20000,17000],[29400,8800]]){const q=P.direction(x,z,state),p=P.local(q,state);assert(Math.hypot(p[0]-x,p[1]-z)<1e-6);assert.equal(N.sample(q,state).water,N.sampleLocal(x,z,state.provinceSeed).water);}
 assert.equal(N.sample(M.mul(anchor,-1),state),null);
}
assert.equal(P.sample(P.direction(1000,1000,legacy),legacy),null);assert(P.sample(P.direction(1000,1000,s),s));
const graph=N.model(713),e=graph.edges.at(-1),q=P.direction(...e.points[6],s),f={...s,position:M.mul(q,s.radius-.12),forward:q,up:M.basis(q).u};assert.equal(SphereLanding.move(f,q,.1).landed,undefined,'Open regional river must retain flight');
assert(N.info.addresses<=2);assert(N.info.graphBytes<=K.get('watershed').budget.graphKiB*1024);assert.equal(N.info.textureBytes,0);
console.log(`PASS pack migration, exact core reuse, saved addresses, ${joins} original outlets, ${segments} graph edges, connected drainage/routes, polar and longitude addresses, deterministic eviction and water traversal`);
