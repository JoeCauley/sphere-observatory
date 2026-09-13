const assert=require('node:assert/strict'),M=require('../math.js');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../surface-arrival.js');
const W=SphereWorld,C=SphereCollection,A=SphereArrival;let probes=0,blends=0;
for(const radius of [M.AU/10,M.AU,M.AU*2]){
 const s={...M.defaultState(),radius,collection:true,era:'after',multipleWounds:true,routeShades:false};
 const pick=(q,outside=false)=>A.select({...s,position:M.mul(q,radius+(outside?100:-100)),forward:M.mul(q,outside?-1:1)});
 for(let index=0;index<6;index++){
  for(const outside of [false,true]){const q=C.wounds[index].axis,r=pick(q,outside);assert.equal(r.kind,'breach');assert.equal(r.near.index,index);assert.equal(r.state.siteId,'exterior-0');assert(M.length(M.sub(r.state.siteAnchor,q))<1e-10);assert(Math.abs(M.length(r.state.position)-s.radius-2500)<.00001);M.validate(r.state);probes++;}
  for(const t of [0,.001,.5,Math.PI/2,Math.PI,Math.PI+.001,Math.PI*1.5,6.1]){
   const f=W.rimFrame(s,index,t);
   for(const offset of [-A.edgeRange(s)*1.001,-A.edgeRange(s)*.999,-3,3,1001])for(const outside of [false,true]){
    const q=M.norm(M.add(f.point,M.mul(f.inland,offset/radius))),r=pick(q,outside);
    assert.equal(r.near.index,index);assert.equal(r.kind,offset>0?'ground':offset<-A.edgeRange(s)?'breach':'edge');
    if(r.kind==='ground')assert(M.length(M.sub(M.norm(r.state.position),q))<1e-10,'Ground retains the selected address');
    if(r.kind==='breach'){assert.equal(r.state.siteId,'exterior-0');assert(M.length(M.sub(r.state.siteAnchor,q))<1e-10);assert(r.title.includes('Breach spill'));}
    if(r.kind==='edge'){const landing=M.norm(r.state.position);assert(M.inBreach(landing,s));assert(W.nearestRim(landing,s).distance<20);assert(radius-M.length(r.state.position)<10);assert.equal(r.state.siteId,'rim');assert(M.dot(r.state.forward,f.inland)>0);}
    assert.equal(r.state.shadeAttachment,null);M.validate(r.state);probes++;
   }
  }
  // Turn the habitat frame so this rim lies on each ribbon boundary.
  const f=W.rimFrame(s,index,1.1),q=M.norm(M.add(f.point,M.mul(f.inland,-3/radius)));
  for(const angle of [-s.waistWidth/3,s.waistWidth/3]){
   const axis=M.norm(M.add(M.mul(f.point,Math.sin(M.radians(angle))),M.mul(f.tangent,Math.cos(M.radians(angle))))),ll=M.latlon(axis);
   const shifted={...s,axisLat:ll[0],axisLon:ll[1],position:M.mul(q,radius-100),forward:q},r=A.select(shifted);
   assert.equal(r.kind,'edge');const frame=W.rimFrame(shifted,r.near.index,r.near.t),local=W.sample(M.norm(M.add(frame.point,M.mul(frame.inland,3/radius))),shifted);assert.equal(r.region.a,local.a);assert.equal(r.region.b,local.b);assert(Math.abs(r.region.blend-local.blend)<1e-8);if(local.a!==local.b&&local.blend>0&&local.blend<1)blends++;
  }
 }
 for(let index=0;index<6;index++){const frame=W.rimFrame(s,index,1.57),q=M.norm(M.add(frame.point,M.mul(frame.inland,-50000/radius))),distant={...s,position:M.mul(q,radius*.75),forward:q,up:M.basis(q).u};assert.equal(A.select(distant).kind,'edge','A visually near rim in an overview needs a local edge arrival');assert.equal(A.select({...distant,position:M.mul(C.wounds[index].axis,radius*.75),forward:C.wounds[index].axis}).kind,'breach');}
 const miss=A.select({...s,position:[radius*2,0,0],forward:[1,0,0]});assert.equal(miss,null);
}
assert(blends>0,'Arrival preserves regional blends at biome boundaries');
console.log(`PASS ${probes} arrivals across six Wounds, three radii, tips, banks, threshold sides, exterior/interior selections, and ${blends} biome transitions.`);
