const assert=require('node:assert/strict'),M=require('../math.js');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');require('../watershed-network.js');require('../watershed-province.js');require('../wreckage.js');require('../flight.js');require('../surface-walk.js');require('../surface-arrival.js');require('../session-state.js');
const S=SphereSites,C=SphereCollection,W=SphereWorld,P=SphereWatershed,L=SphereLanding,F=SphereFlight,E=SphereEdges;
const base={...M.defaultState(),collection:true,routeShades:false,starStation:false,playing:true};
let centres=0,landings=0,contacts=0;
for(let i=0;i<6;i++)for(const outside of [false,true]){
 const q=C.wounds[i].axis,s={...base,position:M.mul(q,base.radius+(outside?100:-100)),forward:M.mul(q,outside?-1:1)},arrival=SphereArrival.select(s);
 assert.equal(arrival.state.siteId,'exterior-0');assert(arrival.state.playing);
 const hit=S.trace(arrival.state.position,arrival.state.forward,arrival.state,M.trace);
 assert.equal(hit.kind,'Breach spill');assert(hit.distance<100,'Every selected opening must frame local spill geometry');assert(M.length(M.sub(arrival.state.siteAnchor,q))<1e-12);centres++;
}
function land(s,q,altitude=1100){
 s.position=M.mul(q,s.radius-altitude);s.forward=q;s.up=M.basis(q).u;
 const result=L.move(s,q,altitude+1);assert(result.landed);assert(s.walkMode&&s.walkSurface&&s.playing);
 assert(M.length(M.sub(s.siteAnchor,q))*s.radius<.000002,'High speed must not slide the landing address across the hillside');
 for(let i=0;i<180;i++)S.step(s,new Set(),1/60);
 const mesh=S.site(s),support=L.probe(s,s.position,M.mul(mesh.basis[1],-1),1);
 assert(Math.abs(support.distance-S.EYE)<.00008,'The eye must finish 1.7 m above visible support');
 assert(Math.abs(L.heightAboveGround(s)-S.EYE)<.00008);assert.equal(s.speed,base.speed,'Landing retains the manual flight preference');
 assert.equal(M.validate(s).walkMode,true);const saved=SphereSessionCodec.decode(SphereSessionCodec.encode(s)).state;
 assert.deepEqual(saved.siteAnchor,s.siteAnchor);assert.equal(saved.siteRevision,s.siteRevision);assert.equal(saved.siteElevation,s.siteElevation);assert.deepEqual(saved.walkPosition,s.walkPosition);
 const before=s.position.slice();for(let i=0;i<120;i++)S.step(s,new Set(['KeyW']),1/60);
 const travelled=M.length(M.sub(s.position,before));assert(travelled>.004&&travelled<.007,'Walking moves metres, not kilometres');
 const y=s.walkPosition[1];S.step(s,new Set(['Space']),.05);assert(s.walkPosition[1]>y);assert(s.playing,'Jumping cannot pause the simulation');
 landings++;return s;
}
for(const id of [0,2,3,4,5,7,8,9])land({...base},W.locateBiome(id,base));
const province=P.activate(base),q=P.direction(0,0,province),s=land(province,q);
assert.equal(s.provinceRevision,1);assert(s.siteElevation>.5);assert(Math.hypot(...P.local(s.siteAnchor,s))<.000002);
// Return to flight has hysteresis, so descending slightly does not immediately
// undo the user's action. A climb above 200 m arms the next landing.
L.release(s);s.position=M.add(s.position,M.mul(q,-.035));let result=L.move(s,q,.02);assert(!result.landed&&!s.walkMode);
s.position=M.mul(q,s.radius-s.siteElevation-.3);result=L.move(s,q,.4);assert(result.landed);
const disabled={...base,autoWalk:false,position:M.mul(q,base.radius-.2),forward:q};assert(!L.move(disabled,q,1).landed);
const hole=C.wounds[0].axis,open={...base,position:M.mul(hole,base.radius-.2),forward:hole};assert(!L.move(open,hole,1).landed);
const water=P.model().segments[0].a,wet=P.direction(...water,province),overWater={...P.activate(base),position:M.mul(wet,base.radius-P.model().level(...water)-.12),forward:wet};assert(!L.move(overWater,wet,.2).landed,'Open water retains flight');
// The actual existing garden floor is the walking support; no survey terrain,
// landing pad or generic trees may replace its architecture.
const terrace=P.view(P.activate(base),'terrace');terrace.playing=true;L.enter(terrace,terrace.position);
for(let i=0;i<180;i++)S.step(terrace,new Set(),1/60);
const ground=L.probe(terrace,terrace.position,M.mul(S.site(terrace).basis[1],-1),.01);assert.equal(ground.kind,'Watershed \u00b7 Water recovery');assert(Math.abs(ground.distance-S.EYE)<.00008);
// Slow, fast, repeated and oblique contacts on both analytic faces. Include
// damaged shapes, route phases and sizes without closing a fracture opening.
for(const shape of ['disk','square','cap','trimmed'])for(const era of ['before','after'])for(const time of [0,123456]){
 const state={...base,routeShades:true,geometryDetail:false,shadeShape:shape,era,time};
 for(const plate of C.plates(state))for(const [u,v]of [[0,0],[-.5,-.5],[.4,-.6]]){
  if(!C.diskContains(u*plate.size*plate.across,v*plate.size,plate))continue;
  const at=E.plateVector(E.canonicalPoint(state,plate,u,v),plate),normal=shape==='cap'||shape==='trimmed'?M.norm(at):plate.normal;
  for(const side of [-1,1])for(const gap of [.003,.1,1000]){state.position=M.add(at,M.mul(normal,side*gap));const stopped=F.move(state,M.mul(normal,-side),gap+1);assert(stopped.blocked);assert.equal(stopped.kind,'Shade');assert(Math.abs(M.dot(M.sub(stopped.position,at),normal)-side*F.CLEARANCE)<.000003);contacts++;}
 }
}
// Cold preview: no streamed triangles are available. The visible 12 m deck
// still needs collision, rather than letting the eye reach the basic skin.
global.SphereEdgeStreaming={geometry:()=>[],revision:0};
for(const shape of ['disk','square','cap','trimmed']){
 const state={...base,routeShades:true,siteId:'shade-0',shadeShape:shape},plate=C.plates(state)[0];state.siteAnchor=plate.normal;const mesh=S.shadeSection(state);
 for(const y of [.025,-.25]){state.position=mesh.world([.3,y,.1]);const dir=M.mul(mesh.basis[1],y>0?-1:1),stopped=F.move(state,dir,.5);assert(stopped.blocked);assert.equal(stopped.kind,'Shade · exposed service structure');if(y>0)assert(Math.abs(mesh.local(stopped.position)[1]-.014001)<.000004);else assert(mesh.local(stopped.position)[1]<-.14);}
 state.position=mesh.world([.3,.025,.1]);let worst=0;for(let i=0;i<12;i++){const start=performance.now();const stopped=F.move(state,M.mul(mesh.basis[1],-1),.1);worst=Math.max(worst,performance.now()-start);state.position=stopped.position;assert(mesh.local(state.position)[1]>.01399);}assert(worst<30,'Nearby collision chunks must be reused, not rebuilt every frame');
}
delete global.SphereEdgeStreaming;
// Exercise the new triangle walker against a real support mesh: a low step,
// a wall and a ceiling. These are independent collision shapes, not samples
// of the controller's own height function.
const oldGeometry=S.geometry;
try{
 const state={...base,multipleWounds:false,siteId:'biome-0',siteAnchor:W.locateBiome(0,base)},field=S.site(state),fixture=new S.Mesh(field.origin,field.basis,'Traversal fixture');
 fixture.quad([-.05,0,-.05],[-.05,0,.05],[.05,0,.05],[.05,0,-.05],[.2,.2,.2]);
 fixture.box([0,.00015,.004],[.008,.0003,.002],[.3,.3,.3]);
 fixture.box([0,.0015,.012],[.008,.003,.001],[.3,.3,.3]);
 fixture.box([-.014,.0021,0],[.008,.0002,.008],[.3,.3,.3]);fixture.finish();S.geometry=()=>[fixture];
 state.position=field.world([0,.01,0]);state.forward=field.basis[2];state.up=field.basis[1];L.enter(state,state.position);
 for(let i=0;i<180;i++)S.step(state,new Set(),1/60);
 for(let i=0;i<90;i++)S.step(state,new Set(['KeyW']),1/60);
 assert(state.walkPosition[2]>.0031&&state.walkPosition[2]<.005);assert(Math.abs(state.walkPosition[1]-(.0003+S.EYE))<.00008,'Step onto a separate 30 cm block');
 for(let i=0;i<350;i++)S.step(state,new Set(['KeyW']),1/60);
 assert(state.walkPosition[2]>.010&&state.walkPosition[2]<.0115,'Stop before a rendered wall');
 state.walkPosition=[-.014,S.EYE+.00002,0];state.position=field.world(state.walkPosition);state.walkVelocity=0;
 let maxEye=0;for(let i=0;i<120;i++){S.step(state,new Set(i===0?['Space']:[]),1/60);maxEye=Math.max(maxEye,state.walkPosition[1]);}
 assert(maxEye>.0018&&maxEye<.002,'A jump must not pass through the 2 m ceiling');assert(Math.abs(state.walkPosition[1]-S.EYE)<.00008);
}finally{S.geometry=oldGeometry;}
for(const invalid of [{siteRevision:2},{siteElevation:NaN},{autoWalk:1},{walkSurface:'true'}])assert.throws(()=>M.validate({...base,...invalid}));
console.log(`PASS ${centres} Breach spill arrivals, ${landings} anchored descents, garden support, walking/jump/restore, steps/walls/ceilings, flight hysteresis, open water/Wounds, ${contacts} two-sided Shade contacts and cold deck collision.`);
