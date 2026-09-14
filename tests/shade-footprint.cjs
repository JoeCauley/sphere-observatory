const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const E=SphereEdges,B=SphereShadeEdges,C=SphereCollection;let triangles=0,outside=0,maxOutside=0;
for(const shape of ['disk','square','cap','trimmed'])for(const id of [0,7,8]){
 const s={...M.defaultState(),collection:true,era:'after',shadeShape:shape,siteId:'',siteAnchor:null},p=C.plates(s).find(p=>p.id===id),r=M.length(p.center)*s.radius;
 let u=-.27,v=-.28;for(let i=0;i<12;i++){u=-.27-.065*Math.sin(v*11)-.018*Math.sin(v*41);v=-.28-.052*Math.sin(u*17)-.011*Math.sin(u*57);}
 for(const uv of [[u+.013,v+.009],[1,0],[-.43,.13+.10*Math.sin(-.43*12)]]){
  s.position=E.plateVector(E.canonicalPoint(s,p,...uv),p);E.setView(640,{deterministic:true});
  for(const mesh of E.shadeMeshes(s))for(let i=0;i<mesh.vertices.length;i+=33){
   const a=[0,1,2].map(k=>mesh.canonicalOrigin[k]+(mesh.vertices[i+k]+mesh.vertices[i+11+k]+mesh.vertices[i+22+k])/3),ratio=shape==='cap'||shape==='trimmed'?r/a[1]:1,x=a[0]*ratio/(p.size*(p.across||1)*s.radius),z=a[2]*ratio/(p.size*s.radius),e=1e-12;
   const solid=B.solid(p,x,z)||B.solid(p,x+e,z)||B.solid(p,x-e,z)||B.solid(p,x,z+e)||B.solid(p,x,z-e);
   triangles++;if(!solid){outside++;if(outside<3)console.log({shape,id,boundary:mesh.boundaryId,x,z});}
  }
 }
}
assert(triangles>1000);assert.equal(outside,0,'Visible structure must not bridge the combined openings');console.log(JSON.stringify({status:'PASS',triangles,outside}));
