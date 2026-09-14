const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','watershed-network','watershed-province','wreckage','flight','surface-walk','travel-control'])require('../'+f+'.js');
const S=SphereSites,T=SphereTravel,W=SphereWorld,C=SphereCollection,E=SphereEdges,base={...M.defaultState(),collection:true,routeShades:false,starStation:false,geometryDetail:false};
assert.equal(base.fov,80);assert.equal(base.exposure,.2);assert.equal(base.autoSpeed,true);
// Independent triangle fixtures exercise face interiors, corners, edges, both
// sides, and identical packed/unpacked acceleration structures.
const mesh=new S.Mesh([0,0,0],[[1,0,0],[0,1,0],[0,0,1]]);mesh.tri([0,0,0],[2,0,0],[0,2,0],[1,1,1]);mesh.finish();const packed=S.packBVH(mesh.triangles);
for(const [point,expected]of [[[.5,.5,3],3],[[.5,.5,-3],3],[[2,2,0],Math.sqrt(2)],[[-1,-1,0],Math.sqrt(2)],[[1,0,0],0],[[1,-2,2],Math.sqrt(8)]])for(const tree of [mesh.bvh,packed]){const hit=S.nearestBVH(point,tree);assert(Math.abs(hit.distance-expected)<1e-12);assert(hit.point);assert(!S.nearestBVH(point,tree,expected*.5).point);}
let woundProbes=0,shadeProbes=0;
for(let index=0;index<6;index++)for(const t of [0,.7,Math.PI/2])for(const altitude of [.04,-6,-12.04]){
 const f=W.rimFrame(base,index,t),up=M.mul(f.point,-1);
 for(const lateral of [-.1,-.01,0,.01,.1]){const p=M.add(M.mul(f.point,base.radius-altitude),M.mul(f.inland,lateral)),s={...base,position:p,forward:f.tangent,up},near=T.surroundings(s,up);
  assert(Number.isFinite(near.nearest));assert(near.nearest<.15);
  const rotated=T.surroundings({...s,forward:up,up:f.tangent},up);assert.equal(near.nearest,rotated.nearest,'Turning cannot change nearest clearance');
  if(C.missing(M.norm(p),s)){const radial=altitude>=0?altitude:Math.max(0,-altitude-base.shellThickness),expected=Math.hypot(lateral,radial);assert(Math.abs(near.nearest-expected)<base.radius*(Math.PI/48)*(2/3)**56+.000002,JSON.stringify({index,t,altitude,lateral,near:near.nearest,expected}));}
  woundProbes++;
 }
}
// Intact perimeters and damaged banks are available before choosing a Shade or
// loading a worker, on both faces and all four analytic shapes.
for(const shape of ['disk','square','cap','trimmed'])for(const era of ['before','after']){
 const s={...base,routeShades:true,shadeShape:shape,era};
 for(const p of C.plates(s))for(const side of [-1,1]){
  // Discover a boundary from the independent solid/void predicate used by
  // collision; the test does not reproduce the speed helper's curve formulae.
  const v=p.damage?.2:0,solid=u=>C.diskContains(u*p.size*p.across,v*p.size,p);let interval=null;
  if(p.damage){for(let i=1;i<=256;i++){const a=-.6+(i-1)*1.2/256,b=-.6+i*1.2/256;if(solid(a)&&!solid(b))interval=[a,b];}}
  else interval=[0,1.1];assert(interval,'A solid-to-void fixture bank must exist');
  let [a,b]=interval;for(let i=0;i<50;i++){const mid=(a+b)/2;if(solid(mid))a=mid;else b=mid;}const uv=[(a+b)/2,v];
  const at=E.plateVector(E.canonicalPoint(s,p,...uv),p),n=shape==='cap'||shape==='trimmed'?M.norm(at):p.normal;
  const tangent=M.norm(M.sub(p.right,M.mul(n,M.dot(p.right,n))));const values=[];for(const offset of [-.02,0,.02]){s.position=M.add(M.add(at,M.mul(n,side*.04)),M.mul(tangent,offset));const hit=T.shadeClearance(s,p);assert(hit.distance>=.03999&&hit.distance<.06,JSON.stringify({shape,era,id:p.id,side,offset,hit}));values.push(hit.distance);shadeProbes++;}
  assert(Math.max(...values)-Math.min(...values)<.006,'Crossing a bank keeps the perpendicular gradient');
 }
}
// Interior samples must retain height clearance on solid skin and gain
// lateral clearance inside actual authored holes, without selecting a Shade.
let voidSamples=0,solidSamples=0;
for(const shape of ['disk','square','cap','trimmed']){const s={...base,routeShades:true,shadeShape:shape,era:'after'};for(const p of C.plates(s).filter(p=>p.damage))for(let j=-6;j<=6;j++)for(let i=-6;i<=6;i++){
 const u=i*.1,v=j*.1,at=E.plateVector(E.canonicalPoint(s,p,u,v),p),n=shape==='cap'||shape==='trimmed'?M.norm(at):p.normal;s.position=M.add(at,M.mul(n,.04));const hit=T.shadeClearance(s,p),solid=C.diskContains(u*p.size*p.across,v*p.size,p);
 if(solid){assert(Math.abs(hit.distance-.04)<.000002);solidSamples++;}else{assert(hit.distance>.041);voidSamples++;}
}}
assert(voidSamples>200&&solidSamples>200);
// Real varying lip: leaving the visible support must not lose its closest
// triangle. This also measures the warm query cost without generating new LODs.
const f=W.rimFrame(base,0,.7),up=M.mul(f.point,-1),s={...base,siteId:'biome-2',siteRevision:1,siteAnchor:M.norm(M.add(M.mul(f.point,base.radius),M.mul(f.inland,.02))),position:M.mul(f.point,base.radius-.04),forward:f.tangent,up};const field=S.site(s),rim=field.ground.rim,edge=rim.segments[Math.floor(rim.segments.length/2)],top=M.mul(M.add(edge.a,edge.b),.5),points=[];
for(const x of [-.02,-.002,0,.002,.02]){const p=M.add(top,[0,.004,x]),hit=S.nearestBVH(p,field.bvh);assert(hit.distance<.022);points.push(hit.distance);}
const times=[];for(let i=0;i<120;i++){const start=performance.now();S.nearestBVH(M.add(top,[0,.004,Math.sin(i)*.02]),field.bvh,1);times.push(performance.now()-start);}times.sort((a,b)=>a-b);
// Even if all geometry disappears, eased acceleration is relative to the old
// speed; approaching a surface still brakes immediately. Manual remains exact.
const q=W.locateBiome(2,base),near={...base,position:M.mul(q,base.radius-.01)},far={...base,position:[0,0,0]};T.reset();const slow=T.speed(near,M.mul(q,-1),1/60),next=T.speed(far,q,1/60);assert(next<=slow*Math.exp(.05)+1e-12);assert(T.speed(near,q,1/60)<=T.curve(.011)*1.2);assert.equal(T.speed({...near,autoSpeed:false,speed:123},q,1/60),123);
console.log(JSON.stringify({status:'PASS',woundProbes,shadeProbes,voidSamples,solidSamples,lipTriangleDistances:points,warmNearestMs:{median:times[60],p95:times[114],max:times[119]}}));
