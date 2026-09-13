const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');require('../surface-arrival.js');require('../pointer-navigation.js');
const C=SphereCollection,W=SphereWorld,P=SpherePointer,base={...M.defaultState(),collection:true,routeShades:false,geometryDetail:false},close=(a,b,e=1e-7)=>assert(M.length(M.sub(a,b))<e,JSON.stringify({a,b}));
for(let id=0;id<10;id++){const q=W.locateBiome(id,base),s={...base,position:M.mul(q,base.radius-100),forward:q,up:M.basis(q).u},ray=M.ray(.36,-.16,16/9,s.fov,M.basis(q,s.up)),picked=P.pick(s,ray),arrival=P.arrive(s,picked);assert.equal(picked.type,'shell');assert.equal(W.sample(picked.selected,s).id,id);close(M.norm(arrival.state.position),picked.selected);close(arrival.state.forward,picked.selected);assert.equal(arrival.state.speed,s.speed);}
for(const [index,w] of C.wounds.entries()){
 const s={...base,position:M.mul(w.axis,base.radius-10000),forward:w.axis,up:M.basis(w.axis).u},picked=P.pick(s,w.axis),arrival=P.arrive(s,picked);assert.equal(arrival.state.siteId,'exterior-0');close(arrival.state.siteAnchor,w.axis);
 // From the spill, the near shell crossing is empty. Select the visible far
 // surface or object through it, rather than jumping back to this same spill.
 const outside={...arrival.state,geometryDetail:false};
 for(const offset of [.15,.3]){
  const ray=M.norm(M.add(M.mul(w.axis,-1),M.mul(w.tangent,offset))),visible=M.trace(outside.position,ray,outside),target=P.pick(outside,ray),departed=P.arrive(outside,target);
  assert.equal(visible.kind,'Inner surface');assert.equal(target.type,'shell');close(target.selected,M.norm(visible.point));
  assert.equal(departed.kind,'ground');assert.equal(departed.state.siteId,'');assert.equal(departed.state.siteAnchor,null);close(M.norm(departed.state.position),M.norm(visible.point));
 }
 const starRay=M.norm(M.mul(outside.position,-1));assert.equal(M.trace(outside.position,starRay,outside).kind,'Star');assert.equal(P.pick(outside,starRay).type,'star');
 const shades={...outside,routeShades:true},plate=C.plates(shades).find(p=>!p.damage),shadeRay=M.norm(M.sub(M.mul(plate.center,shades.radius),shades.position));
 assert.equal(M.trace(shades.position,shadeRay,shades).kind,'Shade');assert.equal(P.pick(shades,shadeRay).type,'shade');
 const other=C.wounds[(index+1)%C.wounds.length],openRay=M.norm(M.sub(M.mul(other.axis,outside.radius),outside.position));
 assert.equal(M.trace(outside.position,openRay,outside).kind,'Open space');assert.equal(P.pick(outside,openRay),null,'Looking through two empty apertures must not pin the entry Wound');
}
const solid= W.locateBiome(2,base),outer={...base,position:M.mul(solid,base.radius+2500)},near=P.pick(outer,M.mul(solid,-1));close(near.selected,solid);
for(const shape of ['disk','cap','trimmed','square'])for(const side of [-1,1]){const s={...base,routeShades:true,shadeShape:shape},plate=C.plates(s).find(p=>!p.damage),point=M.mul(plate.center,s.radius);s.position=M.add(point,M.mul(plate.normal,side*.05));s.forward=M.mul(plate.normal,-side);s.up=plate.up;const picked=P.pick(s,s.forward);assert.equal(picked.type,'shade',shape+' '+side);assert.equal(picked.plate,plate.id);
 const later={...s,time:s.time+240},moved=C.plates(later).find(p=>p.id===plate.id),arrival=P.arrive(later,picked);assert.equal(arrival.state.shadeAttachment,plate.id);close(arrival.state.position,M.add(M.mul(moved.center,s.radius),M.mul(moved.normal,side*.05)),.000001);}
const s={...base,geometryDetail:true,siteId:'biome-5',siteAnchor:W.locateBiome(5,base)},mesh=SphereSites.site(s);s.position=mesh.world([0,.2,0]);s.forward=M.mul(mesh.basis[1],-1);s.up=mesh.basis[2];const picked=P.pick(s,s.forward),arrival=P.arrive(s,picked);assert.equal(picked.type,'geometry');assert.equal(arrival.state.siteId,s.siteId);assert(M.dot(M.sub(arrival.state.position,picked.point),picked.normal)>0);assert(M.length(M.sub(arrival.state.position,picked.point))<=.2);
const starState={...base,position:[base.starRadius*20,0,0],forward:[-1,0,0],up:[0,1,0]},star=P.pick(starState,starState.forward);assert.equal(star.type,'star');const starArrival=P.arrive(starState,star).state;assert(M.length(starArrival.position)>base.starRadius*1.02);close(M.norm(starArrival.position),[1,0,0]);
console.log('PASS ten marked regions; six Wound entries and exits to far shell, star, Shades and open space; solid exterior; both faces of four moving Shade shapes; visible terrain');
