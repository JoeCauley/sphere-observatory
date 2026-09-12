const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');require('../flight.js');
const C=SphereCollection,W=SphereWorld,S=SphereSites,F=SphereFlight,s={...M.defaultState(),collection:true,geometryDetail:false,routeShades:false,starStation:false};
const near=(a,b,e=1e-6)=>assert(Math.abs(a-b)<e,`${a} differs from ${b}`);
assert.throws(()=>M.validate({...s,weatherQuality:.5}));assert.throws(()=>M.validate({...s,cavityHaze:2}));
let footprints=0;
for(const waistWidth of [10,20,38])for(const axisLat of [-90,0,63,90])for(const axisLon of [-180,17,180])for(const time of [0,123456,864000]){
 const state={...s,waistWidth,axisLat,axisLon,time,routeShades:true,era:'before',shadeShape:'square'},width=M.radians(waistWidth),plates=C.plates(state);
 for(const p of plates){near(W.coordinates(p.normal,state).lat,width*(p.band-1)*2/3,1e-12);near(M.dot(p.right,p.normal),0,1e-12);
  for(const x of [-1,0,1])for(const y of [-1,0,1]){const q=M.norm(M.add(p.center,M.add(M.mul(p.right,x*p.size*p.across),M.mul(p.up,y*p.size)))),lat=W.coordinates(q,state).lat;
   assert(lat>=-width+p.band*2*width/3&&lat<=-width+(p.band+1)*2*width/3,`Shade ${p.id} leaves its ribbon: ${M.degrees(lat)}`);footprints++;}
 }
 // Orientation does not change radial envelope separation. Adjacent shades
 // are separated even using the original, larger bounding spheres.
 for(let b=0;b<3;b++){const r=C.routes[b],size=r.radius*Math.tan(Math.PI/(2*r.count)),lat=width*(b-1)*2/3;
  assert(2*r.radius*Math.cos(lat)*Math.sin(Math.PI/r.count)>2*Math.SQRT2*size);
  assert(Math.hypot(r.radius,Math.SQRT2*size)<(C.routes[b+1]?.radius||1));}
}
for(const q of [W.frame(s).axis,W.direction(0,.8,s)]){
 const state={...s,multipleWounds:false,position:M.mul(q,s.radius-3)};
 for(const distance of [2.999,50,s.radius]){const result=F.move(state,q,distance);assert(result.blocked);near(s.radius-M.length(result.position),F.CLEARANCE,2e-6);}
 const outside={...state,position:M.mul(q,s.radius+3)},hit=F.move(outside,M.mul(q,-1),100);assert(hit.blocked);near(M.length(hit.position)-s.radius,F.CLEARANCE,2e-6);
 const away=F.move(state,M.mul(q,-1),10);assert(!away.blocked);near(s.radius-M.length(away.position),13);
}
const q=C.wounds[0].axis,inside={...s,position:M.mul(q,s.radius-3)},outside={...s,position:M.mul(q,s.radius+3)};
assert(!F.move(inside,q,100).blocked,'A Wound must allow outward flight');assert(!F.move(outside,M.mul(q,-1),100).blocked,'A Wound must allow inward flight');
const longDirection=M.norm(M.add(M.mul(q,-1),M.mul(C.wounds[0].tangent,.08))),far=F.move({...s,position:M.mul(q,s.radius*1.02)},longDirection,s.radius*3);
assert(far.blocked,'A long segment entering a Wound must stop at the opposite wall');assert(M.length(far.position)<s.radius);
const state={...s,geometryDetail:true,siteId:'biome-2',siteAnchor:W.locateBiome(2,s)},mesh=S.site(state);state.position=mesh.world([0,.15,0]);const landed=F.move(state,M.mul(mesh.basis[1],-1),10);assert(landed.blocked);near(mesh.local(landed.position)[1],S.ground(mesh,0,0)+.0005+F.CLEARANCE,.000002);
const normal=W.frame(s).axis,tangent=W.frame(s).right,low={...s,multipleWounds:false,position:M.mul(normal,s.radius-F.CLEARANCE)};
const gliding=F.move(low,M.norm(M.add(tangent,M.mul(normal,.4))),.1);assert(gliding.blocked);assert(M.length(M.sub(gliding.position,low.position))>.08);near(s.radius-M.length(gliding.position),F.CLEARANCE,.000002);
const shadeState={...s,routeShades:true,era:'before',shadeShape:'cap'},plate=C.plates(shadeState)[0];shadeState.position=M.add(M.mul(plate.center,s.radius),M.mul(plate.normal,.010));
for(let j=0;j<20;j++){const stopped=F.move(shadeState,M.mul(plate.normal,-1),.1);assert(stopped.blocked);shadeState.position=stopped.position;}near(M.length(shadeState.position)-M.length(plate.center)*s.radius,F.CLEARANCE,.000003);
console.log(`PASS ${footprints} Shade footprint probes, full-cycle route clearance, swept shell collision in both directions, Wound passage and far-wall collision, local terrain landing.`);
