const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','wreckage','flight','surface-walk'])require('../'+f+'.js');
const W=SphereWorld,S=SphereSites,E=SphereEdges,C=SphereCollection,L=SphereLanding;
const base={...M.defaultState(),collection:true,era:'after',multipleWounds:true,routeShades:false,starStation:false,siteRevision:1,siteElevation:0};
const vertexKey=p=>p.map(Math.fround).join(','),positions=mesh=>{const out=new Set();for(let i=0;i<mesh.vertices.length;i+=11)out.add(vertexKey(Array.from(mesh.vertices.slice(i,i+3))));return out;};
function fixture(index,t,radius=M.AU,id=5,offset=.020){const s={...base,radius,siteId:'biome-'+id},f=W.rimFrame(s,index,t);s.siteAnchor=M.norm(M.add(f.point,M.mul(f.inland,offset/radius)));s.position=M.mul(s.siteAnchor,radius-.1);s.forward=M.mul(f.inland,-1);s.up=M.mul(s.siteAnchor,-1);return {s,f,mesh:S.site(s)};}
let fixtures=0,topVertices=0,probes=0,props=0,maxVoidErrorKm=0,maxChordErrorKm=0;
for(const radius of [M.AU*.1,M.AU,M.AU*2])for(let index=0;index<6;index++)for(const t of [0,.7,Math.PI/2,Math.PI,Math.PI*1.5]){
 const {s,f,mesh}=fixture(index,t,radius,index%2?2:5),rim=mesh.ground.rim;assert(rim&&rim.segments.length,'The patch intersects this Wound');
 assert(mesh.vertices.every(Number.isFinite)&&rim.wall.vertices.every(Number.isFinite));
 const floorVertices=positions(mesh),wallVertices=positions(rim.wall),w=C.wounds[index];
 for(const seg of rim.segments)for(const p of [seg.a,seg.b]){assert(floorVertices.has(vertexKey(p)));assert(wallVertices.has(vertexKey(p)),'Floor and wall must share the exact uploaded top vertex');topVertices++;}
 for(const seg of rim.segments){const midpoint=M.mul(M.add(seg.a,seg.b),.5),error=Math.abs(C.woundDistance(M.norm(mesh.world(midpoint)),w)-1)*w.width*radius;maxChordErrorKm=Math.max(maxChordErrorKm,error);assert(error<.000001,'A seam chord remains within 1 mm of the analytic contour');}
 // Probe triangle interiors, not only the clipping vertices. This catches a
 // retained overhanging triangle while allowing <1 mm contour chord error.
 for(let i=0;i<mesh.vertices.length;i+=33){if(mesh.vertices[i+9]!==Number(s.siteId.slice(6)))continue;
  const p=[0,0,0];for(const offset of [0,11,22])for(let k=0;k<3;k++)p[k]+=mesh.vertices[i+offset+k]/3;
  const q=M.norm(mesh.world(p)),error=(1-C.woundDistance(q,w))*w.width*radius;maxVoidErrorKm=Math.max(maxVoidErrorKm,error);assert(error<.000001,'Terrain triangle cannot extend into the opening');
 }
 for(const inland of [-.030,-.005,.005,.030])for(const along of [-.7,0,.7]){
  const q=M.norm(M.add(f.point,M.mul(M.add(M.mul(f.inland,inland),M.mul(f.tangent,along)),1/radius))),p=mesh.local(M.mul(q,radius));
  const h=S.ground(mesh,p[0],p[2]);assert.equal(Number.isFinite(h),inland>0,'The clipped height query must not invent support in void');probes++;
 }
 for(const b of mesh.boxes){const c=Math.cos(b.angle),sn=Math.sin(b.angle);for(const x of [-b.half[0],b.half[0]])for(const z of [-b.half[2],b.half[2]]){const p=[b.center[0]+c*x-sn*z,0,b.center[2]+sn*x+c*z];assert(mesh.ground.solid(p),'Full prop footprint remains inland');props++;}}
 fixtures++;
}
const {s,mesh}=fixture(0,.7,M.AU,2),rim=mesh.ground.rim;
const heights=rim.segments.flatMap(seg=>[seg.a[1],seg.b[1]]);assert(Math.max(...heights)-Math.min(...heights)>.005,'The lip follows varied terrain rather than flattening it');
for(const width of [640,3840])for(const coarse of [false,true]){
 const jobs=E.plan(s,width,{coarse,deterministic:true}),meshes=[...jobs].filter(([key])=>key.startsWith('rim:')).map(([,build])=>build());
 for(const end of rim.ends){const joined=meshes.filter(m=>m.origin===mesh.origin&&m.basis===mesh.basis),vertices=new Set(joined.flatMap(m=>[...positions(m)]));assert(joined.length);for(const p of end.profile)assert(vertices.has(vertexKey(p)),'Coarse/fine rim uses the exact local end profile');}
 const workerState=structuredClone({...s,_groundRimCut:E.rimCut(s)}),workerJobs=E.plan(workerState,width,{coarse,deterministic:true});assert.deepEqual([...workerJobs.keys()],[...jobs.keys()]);
 for(const [key,build]of jobs)if(key.startsWith('rim:'))assert.deepEqual(workerJobs.get(key)().vertices,build().vertices,'Worker and capture rim recipes agree');
}
const intact=S.site({...s,multipleWounds:false});assert(!intact.ground.rim);assert(!S.site({...s,era:'before'}).ground.rim);assert.equal(S.site(s),mesh,'Toggling Wounds must not reuse the intact patch');
// A real lip permits unsupported movement; the old square patch limit remains.
const walking=fixture(0,Math.PI/2,M.AU,5,.001),walk=walking.s;L.enter(walk,walk.position);
for(let i=0;i<180;i++)S.step(walk,new Set(),1/60);
walk.forward=M.mul(walking.f.inland,-1);walk.up=M.basis(walk.forward,walking.mesh.basis[1]).u;
for(let i=0;i<120;i++)S.step(walk,new Set(['KeyW']),1/60);
assert(M.inBreach(M.norm(walk.position),walk),'Walking crosses the real edge instead of hitting an invisible wall');
assert.equal(S.ground(walking.mesh,walk.walkPosition[0],walk.walkPosition[2]),-Infinity);
// Move beyond the real fractured wall's projecting ledges before testing a
// clear fall. Immediately beside the lip those visible ledges can catch us.
const clear=M.norm(M.add(walking.f.point,M.mul(walking.f.inland,-.8/walk.radius)));
walk.position=M.mul(clear,walk.radius-.02);walk.walkPosition=walking.mesh.local(walk.position);walk.walkVelocity=0;
const fallStart=walk.position.slice();for(let i=0;i<600&&walk.walkMode;i++)S.step(walk,new Set(),1/60);
assert(!walk.walkMode,'Falling clear of the rim returns to free flight');assert(M.length(M.sub(walk.position,fallStart))>.1);M.validate(walk);
console.log(`PASS ${fixtures} Wound fixtures, ${topVertices} exact uploaded seam vertices, ${probes} support probes, ${props} prop corners; max contour chord error ${(maxChordErrorKm*1e6).toFixed(4)} mm, triangle intrusion ${(maxVoidErrorKm*1e6).toFixed(4)} mm; varying lip heights, coarse/fine and worker parity, era/cache changes and walking off the lip.`);
