const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const S=SphereSites,E=SphereEdges,W=SphereWorld;
let probes=0,maxNormal=0;
for(const era of ['before','after'])for(let id=0;id<10;id++){
 const s={...M.defaultState(),collection:true,era,routeShades:false,multipleWounds:false,siteId:'biome-'+id,siteRevision:1,siteElevation:0};s.siteAnchor=W.locateBiome(id,s);s.position=M.mul(s.siteAnchor,s.radius-.1);const mesh=S.site(s);
 for(let i=0;i<mesh.vertices.length;i+=11){const p=[...mesh.vertices.subarray(i,i+3)];if(Math.max(Math.abs(p[0]),Math.abs(p[2]))<1.19999||mesh.vertices[i+9]!==id)continue;
  assert(Math.abs(M.length(mesh.world(p))-s.radius)<1e-6,'Opaque border meets the analytic shell');const n=[...mesh.vertices.subarray(i+3,i+6)],world=mesh.basis.reduce((v,b,j)=>M.add(v,M.mul(b,n[j])),[0,0,0]),error=M.length(M.add(world,M.norm(mesh.world(p))));maxNormal=Math.max(maxNormal,error);assert(error<.00001,'Lighting normals also meet the coarse shell');probes++;
 }
 for(const width of [640,3840]){E.setView(width);assert(.12*E.focal(s)/S.localRange(s)<=.4500001,'Retirement remains below half an output pixel');}
}
console.log(JSON.stringify({status:'PASS',probes,maxNormal}));
