const assert=require('node:assert/strict'),M=require('../math.js');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');
const E=SphereEdges,S=SphereSites,s={...M.defaultState(),shadeGeometryRevision:1,collection:true,siteId:'shade-0'};
s.siteAnchor=SphereCollection.plates(s)[0].normal;s.position=S.shadeSection(s).world([-.3,.2,.75]);E.setView(1280);
const fine=E.plan(s,1280),coarse=E.plan(s,1280,{coarse:true}),key=[...fine.keys()].find(k=>k.endsWith(':near')),far=key.replace(/:near$/,':far');
assert(coarse.has(far));const mesh=fine.get(key)(),packed=S.packBVH(mesh.triangles);
let rays=0,hits=0;
for(let x=-.2;x<2;x+=.07)for(let z=-2;z<2;z+=.11){const p=[x,.5,z],d=[0,-1,0],a={},b={},original=S.rayBVH(p,d,mesh.bvh,Infinity,a),worker=S.rayBVH(p,d,packed,Infinity,b);assert.equal(worker,original);if(Number.isFinite(worker)){hits++;assert(M.length(M.sub(a.normal,b.normal))<1e-12);}rays++;}
assert(hits>100);
const direct=E.shadeMeshes(s).find(m=>m.streamKey===key);assert.deepEqual(direct.vertices,mesh.vertices,'Worker recipe and synchronous geometry are byte-identical');
global.window=global;let instance;
global.Worker=class{constructor(){instance=this;this.messages=[];}postMessage(data){this.messages.push(data);}terminate(){}};
require('../edge-streaming.js');const stream=SphereEdgeStreaming;
assert.equal(stream.geometry(s).length,0);let request=instance.messages.at(-1);assert(request.keys.includes(key));
const deliver=(k,build,generation=request.generation)=>{const mesh=build();mesh.bvh=S.packBVH(mesh.triangles);delete mesh.triangles;mesh.streamKey=k;instance.onmessage({data:{generation,key:k,mesh,buildMs:1}});};
deliver(far,coarse.get(far));stream.pump(()=>false);assert(!stream.geometry(s).some(m=>m.streamKey===far),'Partial GPU uploads are not collidable or visible');stream.pump(()=>true);
assert(stream.geometry(s).some(m=>m.streamKey===far),'Coarse coverage is visible before fine geometry');
deliver(key,fine.get(key));stream.pump(()=>false);assert(stream.geometry(s).some(m=>m.streamKey===far),'Coarse remains during fine upload');stream.pump(()=>true);
const upgraded=stream.geometry(s);assert(upgraded.some(m=>m.streamKey===key));assert(!upgraded.some(m=>m.streamKey===far),'Replacement never double draws its coarse surface');
const moved={...s,position:S.shadeSection(s).world([-.3,.2,500])};stream.geometry(moved);const cancelled=stream.info.cancelled;deliver(key,fine.get(key));assert.equal(stream.info.cancelled,cancelled+1);assert.equal(stream.info.ready,0,'Obsolete responses cannot enter residency');
stream.cancel();assert.equal(stream.info.queue,0);assert(!stream.needsFrame);stream.dispose();
console.log(`PASS ${rays} worker BVH rays (${hits} hits), geometry byte parity, coarse replacement, partial-upload collision exclusion, stale response cancellation and queue clearing.`);

// A delayed worker still needs both local Wound wall ends sealed. Resource
// pressure may drop distant work, but cannot evict these tiny active profiles.
const ground={...M.defaultState(),shadeGeometryRevision:1,collection:true,siteId:'biome-5',siteRevision:1,siteElevation:0,routeShades:false},frame=SphereWorld.rimFrame(ground,0,.7);
ground.siteAnchor=M.norm(M.add(frame.point,M.mul(frame.inland,.02/ground.radius)));ground.position=M.mul(ground.siteAnchor,ground.radius-.04);E.setView(1280);
const guards=stream.geometry(ground);assert(guards.length>=2&&guards.length<=4);assert(guards.every(m=>m.count<1000),'Cold seam neighbours are small bounded meshes');
request=instance.messages.at(-1);const cut=E.rimCut(ground);assert.deepEqual(request.state._groundRimCut,cut,'Worker receives the exact main-thread profiles');
const rimJobs=new Map([...E.plan(ground,1280,{coarse:true}),...E.plan(ground,1280)]),heavyKey=request.keys.find(key=>key.startsWith('rim:')),heavy=rimJobs.get(heavyKey)();heavy.bvh=S.packBVH(heavy.triangles);delete heavy.triangles;heavy.streamKey=heavyKey;
heavy.count=3000001;instance.onmessage({data:{generation:request.generation,key:heavyKey,mesh:heavy,buildMs:1}});stream.pump(()=>true);
const pressured=stream.geometry(ground);for(const guard of guards)assert(pressured.includes(guard),'Active seam guards survive the hard vertex cap');assert(stream.info.budgetLimited>0);
const departed={...ground,position:M.mul(ground.siteAnchor,ground.radius-S.localRange(ground)-1)},restored=stream.geometry(departed);assert.equal(E.rimCut(departed),null);
assert(restored.some(m=>m.rim&&cut.cuts.some(([a,b])=>m.rim.a<=a&&m.rim.b>=b)),'Leaving the patch fills its old cut interval before the worker replies');
stream.cancel();stream.dispose();console.log('PASS cold Wound seam guards, exact worker profiles and protected ends under vertex-budget pressure.');
