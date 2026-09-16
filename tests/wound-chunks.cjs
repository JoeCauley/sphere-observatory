const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const G=SphereGround,S=SphereSites,W=SphereWorld,C=SphereCollection;
const base={...M.defaultState(),collection:true,era:'after',multipleWounds:true,routeShades:false,siteRevision:2,siteId:'biome-5'};
let triangles=0,emptyChunks=0,rimChunks=0,maxIntrusion=0;
for(const [index,t] of [[0,0],[0,.7],[0,Math.PI/2],[1,.7],[2,.7],[3,.7],[4,.7],[5,.7]]){
 const s={...base},f=W.rimFrame(s,index,t);s.siteAnchor=M.norm(M.add(f.point,M.mul(f.inland,.02/s.radius)));s.position=M.mul(s.siteAnchor,s.radius-.045);
 G.dispose();const groups=G.neighbourhood(s);assert.equal(groups.length,25);assert(G.rimCut(s)?.ends.length>=2);
 let localEmpty=0;
 for(const mesh of groups){
  const [x,z,xx,zz]=mesh.ground.bounds,centre=[(x+xx)/2,0,(z+zz)/2],q=M.norm(mesh.world(centre)),near=W.nearestRim(q,s),inside=C.missing(q,s);
  if(inside&&near.distance>Math.hypot(xx-x,zz-z)/2+.01){assert.equal(mesh.count,0,'A wholly missing chunk must not emit floating floor triangles');assert.equal(mesh.ground.props.length,0);assert.equal(G.ground(s,centre[0],centre[2]),-Infinity,'Void has no invisible collision floor');localEmpty++;}
  rimChunks+=!!mesh.ground.rim;
  for(let i=0;i<mesh.vertices.length;i+=33){if(mesh.vertices[i+9]<0)continue;
   const p=[0,0,0];for(const offset of [0,11,22])for(let k=0;k<3;k++)p[k]+=mesh.vertices[i+offset+k]/3;
   const error=(1-C.woundDistance(M.norm(mesh.world(p)),C.wounds[index]))*C.wounds[index].width*s.radius;
   maxIntrusion=Math.max(maxIntrusion,error);assert(error<.000001,'Fine and coarse triangle interiors must remain outside the Wound');triangles++;
  }
 }
 assert(localEmpty>0);emptyChunks+=localEmpty;
 // Re-entering the same neighbourhood must keep its clipped ownership.
 assert.deepEqual(G.neighbourhood(s),groups);
}
// The older local-patch generator shares the fast path; preserve its empty
// floor and prop rejection as well as intact-era ground at the same address.
for(const revision of [0,1]){
 const s={...base,siteRevision:revision},f=W.rimFrame(s,0,.7);s.siteAnchor=M.norm(M.add(f.point,M.mul(f.inland,-10/s.radius)));s.position=M.mul(s.siteAnchor,s.radius-.045);
 const missing=S.site(s);assert.equal(missing.count,0);assert.equal(S.ground(missing,0,0),-Infinity);
 const intact=S.site({...s,era:'before'});assert(intact.count>0);assert(Number.isFinite(S.ground(intact,0,0)));
}
G.dispose();console.log(JSON.stringify({status:'PASS',fixtures:8,triangles,emptyChunks,rimChunks,maxIntrusionKm:maxIntrusion}));
