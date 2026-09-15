const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','flight','travel-control','inspection-camera','session-state'])require('../'+f+'.js');
const C=SphereCollection,E=SphereEdges,B=SphereShadeEdges,S=SphereSites,F=SphereFlight,I=SphereInspection;
let faces=0,arrivals=0,coldEdges=0;const timings=[];
for(const shape of ['disk','square','cap','trimmed'])for(const era of ['before','after']){
 const s={...M.defaultState(),collection:true,shadeShape:shape,era,siteId:'',geometryDetail:false,playing:false},p=C.plates(s).find(p=>p.id===4);
 assert.equal(s.shadeGeometryRevision,3);assert.equal(p.damage,0);
 for(const uv of [[0,0],[.3,-.2],[-.25,.4]]){
  const at=E.plateVector(E.canonicalPoint(s,p,...uv),p),normal=shape==='cap'||shape==='trimmed'?M.norm(at):p.normal;
  for(const side of [-1,1]){
   const offset=side<0?-.035:.215,position=M.add(at,M.mul(normal,offset)),direction=M.mul(normal,-side),distance=C.diskDistance(M.mul(position,1/s.radius),direction,p)*s.radius;
   assert(Math.abs(distance-.035)<.0000001,'Both faces exist across the interior without local meshes');
   const stopped=F.contact(s,position,direction,1);assert.equal(stopped.kind,'Shade');assert(Math.abs(stopped.distance-.033)<.0000001);
   const attached={...s,position,siteId:'shade-4',shadeAttachment:4,siteAnchor:p.normal};assert(Math.abs(I.surface(attached).altitude-.035)<.0000001);
   for(const revision of [1,2]){const old=C.plates({...s,shadeGeometryRevision:revision}).find(p=>p.id===4);assert.equal(old.thickness,0);const t=C.diskDistance(M.mul(position,1/s.radius),direction,old)*s.radius;assert(Math.abs(t-Math.abs(offset))<.0000001);}
   faces++;
  }
 }
 // The arrival actually straddles solid and void, including intact Shade 4.
 const f=B.arrivalFrame(s,p),at=E.plateVector(f.origin,p),inside=E.plateVector(f.inward,p),up=E.plateVector(f.up,p);
 for(const [offset,solid]of [[-.1,false],[.1,true]]){const uv=B.uvAt(s,p,M.add(at,M.mul(inside,offset)));assert.equal(B.solid(p,...uv),solid);}
 arrivals++;
 s.geometryDetail=true;s.position=M.add(M.add(at,M.mul(inside,-.3)),M.mul(up,-.09));s.forward=inside;s.up=up;
 E.setView(1280);const full=E.shadeMeshes(s);assert(full.some(m=>m.lod==='near'));assert(full.every(m=>m.sectionRevision===3));
 // A worker that never replies cannot leave a readable perimeter open.
 if(!global.SphereEdgeStreaming){global.window=global;global.Worker=class{postMessage(){}terminate(){}};require('../edge-streaming.js');}
 const stream=SphereEdgeStreaming;stream.dispose();const start=performance.now(),coarse=stream.geometry(s);timings.push(performance.now()-start);
 assert(coarse.length>0);assert(coarse.every(m=>m.lod==='far'));
 const ray=M.add(M.add(M.add(at,M.mul(inside,-.3)),M.mul(up,-.09)),M.mul(E.plateVector(f.tangent,p),.031));
 assert(coarse.some(m=>S.rayBVH(m.local(ray),m.basis.map(b=>M.dot(inside,b)),m.bvh,1)<1),'Cold wall has immediate collision');
 assert(stream.info.collisionAndVertexMiB<192&&stream.info.cache<1200);
 coldEdges++;stream.dispose();
}
// Damage openings remain through-open on both continuous faces.
for(const shape of ['disk','square','cap','trimmed']){const s={...M.defaultState(),collection:true,shadeShape:shape},p=C.plates(s)[0],at=E.plateVector(E.canonicalPoint(s,p,-.27,0),p),n=shape==='cap'||shape==='trimmed'?M.norm(at):p.normal;for(const side of [-1,1])assert.equal(C.diskDistance(M.mul(M.add(at,M.mul(n,side<0?-.035:.215)),1/s.radius),M.mul(n,-side),p),Infinity);}
const old={...M.defaultState(),collection:true,shadeGeometryRevision:1},codec=SphereSessionCodec;
const untrimmed={...M.defaultState(),collection:true,shadeShape:'trimmed',shadeTrim:1,era:'before'},uncut=C.plates(untrimmed).find(p=>p.id===4);
assert.deepEqual(B.curves(uncut).map(c=>c.id),['perimeter'],'Full-width trimmed caps have one closed curve, not collapsed side cuts');assert(B.arrivalFrame(untrimmed,uncut).origin.every(Number.isFinite));
assert.equal(codec.decode(JSON.stringify({format:'sphere-session',version:1,state:old})).state.shadeGeometryRevision,3);
assert.equal(codec.decode(codec.encode(old)).state.shadeGeometryRevision,1,'Explicit legacy choices survive subsequent sessions');
assert.equal(M.validate(M.sceneRecord(old).state).shadeGeometryRevision,1,'Portable historical scenes remain historical');
const parent=C.plates(old).find(p=>p.id===4),trapped={...old,position:M.add(M.mul(parent.center,old.radius),M.mul(parent.normal,.035))},rescued=codec.decode(JSON.stringify({format:'sphere-session',version:1,state:trapped})).state;
assert(Math.abs(M.length(M.sub(rescued.position,trapped.position))-.18)<.0000001,'Only a camera trapped by the added body is moved out on upgrade');
assert.deepEqual(codec.decode(codec.encode(trapped)).state.position,trapped.position,'An explicit legacy session remains at its exact saved position');
console.log(JSON.stringify({status:'PASS',faces,arrivals,coldEdges,coldEnvelopeMs:{max:Math.max(...timings),mean:timings.reduce((a,b)=>a+b)/timings.length}}));
