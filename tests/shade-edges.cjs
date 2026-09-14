const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','flight'])require('../'+f+'.js');
const E=SphereEdges,B=SphereShadeEdges,C=SphereCollection,S=SphereSites;
assert.equal(M.validate({...M.defaultState(),shadeGeometryRevision:undefined}).shadeGeometryRevision,1);
let approaches=0,triangles=0,curves=0;const times=[];
for(const shape of ['disk','square','cap','trimmed'])for(const era of ['before','after'])for(const id of [0,7,8]){
 const s={...M.defaultState(),collection:true,shadeShape:shape,era,siteId:'',siteAnchor:null,shadeAttachment:null,geometryDetail:true},p=C.plates(s).find(p=>p.id===id);
 const boundaries=B.curves(p);curves+=boundaries.length;
 // Every authored curve must either separate the combined solid/void region,
 // or be suppressed where another cut removed both sides.
 for(const c of boundaries)for(const fraction of [.1,.5,.9]){const t=c.lo+(c.hi-c.lo)*fraction,f=B.frame(s,p,c,t);if(!f)continue;assert(f.inward.every(Number.isFinite));}
 for(const c of boundaries.filter(c=>['perimeter','east','east-trim','long-1','cross-1','loss-bank'].includes(c.id))){let t=null;for(let i=1;i<20;i++){const v=c.lo+(c.hi-c.lo)*i/20;if(B.frame(s,p,c,v)){t=v;break;}}if(t===null)continue;
  const f=B.frame(s,p,c,t),at=E.plateVector(f.origin,p),up=E.plateVector(f.up,p),inward=E.plateVector(f.inward,p);
  for(const side of [-1,1]){s.position=M.add(M.add(at,M.mul(up,side*.04)),M.mul(inward,-.1));s.forward=inward;s.up=up;E.setView(640,{deterministic:true});const start=performance.now(),meshes=E.shadeMeshes(s);times.push(performance.now()-start);assert(meshes.length,'Unselected boundary is discovered from either face');assert(meshes.every(m=>m.parentId===p.id&&m.vertices.every(Number.isFinite)));
   const rayStart=M.add(at,M.mul(up,-.08)),origin=M.add(rayStart,M.mul(inward,-.1)),hit=SphereFlight.contact({...s,position:origin},origin,inward,.2);assert(Number.isFinite(hit.distance),'Visible side wall blocks a lateral approach');assert(hit.distance<.15,'Broken openings expose the recessed 45 m backing or braces');
   const keys=meshes.map(m=>m.streamKey);assert.deepEqual(E.shadeMeshes({...s,forward:M.mul(inward,-1)}).map(m=>m.streamKey),keys,'Head turns do not change residency');
   const jobs=E.plan(s,640,{deterministic:true}),first=meshes.find(m=>m.boundaryId===c.id);assert(first);assert.deepEqual(jobs.get(first.streamKey)().vertices,first.vertices,'Worker/capture recipe equality');triangles+=meshes.reduce((sum,m)=>sum+m.count/3,0);approaches++;
  }
 }
}
// One parent-local buffer must follow its actual parent after arbitrary scrubs,
// even when Places selects no Shade. Rotation must never be cached by siteId.
const s={...M.defaultState(),collection:true,era:'before',shadeShape:'square'},p=C.plates(s)[0],at=E.canonicalPoint(s,p,1,0);s.position=E.plateVector(M.add(at,[.1,0,0]),p);E.setView(640);const original=E.shadeMeshes(s),first=original[0];
for(const time of [10,86400,-600,0]){const next={...s,time},p2=C.plates(next)[0];next.position=E.plateVector(M.add(at,[.1,0,0]),p2);const moved=E.shadeMeshes(next).find(m=>m.streamKey===first.streamKey);assert(moved);assert(M.length(M.sub(moved.origin,E.plateVector(moved.canonicalOrigin,p2)))<1e-7);}
times.sort((a,b)=>a-b);console.log(JSON.stringify({status:'PASS',approaches,curves,triangles,buildMs:{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)}}));
