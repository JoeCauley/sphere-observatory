const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','watershed-network','watershed-province','wreckage','flight','surface-walk','travel-control','surface-arrival','places'])require('../'+f+'.js');
const T=SphereTravel,L=SphereLanding,S=SphereSites,W=SphereWorld,P=SpherePlaces;
global.window=globalThis;require('../volume.js');require('../atmosphere.js');delete global.window;
const base={...M.defaultState(),collection:true,routeShades:false,starStation:false};
assert(base.autoSpeed);assert(M.validate(base).autoSpeed);assert.equal(M.validate({...base,autoSpeed:false}).autoSpeed,false);
for(const value of ['yes',1,null])assert.throws(()=>M.validate({...base,autoSpeed:value}));
for(const key of ['placeScene','placeWeather'])assert.throws(()=>M.validate({...base,[key]:'anything'}));
let previous=0;for(let x=-6;x<=8;x+=.025){const v=T.curve(10**x);assert(v>=previous);assert(v<=T.maxSpeed);previous=v;}
assert.equal(T.curve(1e8),T.maxSpeed);
const q=W.locateBiome(2,base),up=M.mul(q,-1),s={...base,position:M.mul(q,base.radius-1100),forward:q,up:M.basis(q).u,speed:1234,playing:true};
const landed=L.move(s,q,1101);assert(landed.landed);for(let i=0;i<180;i++)S.step(s,new Set(),1/60);
const start=s.position.slice();assert(T.takeoff(s));assert(!s.walkMode&&s.playing);assert.equal(s.speed,1234);
for(let i=0;i<120;i++)assert(T.stepTakeoff(s,1/60));assert(!T.lifting);assert(Math.abs(M.length(M.sub(s.position,start))-.045)<.00001);
assert(!T.takeoff(s));assert.equal(s.speed,1234,'The manual setting survives landing and lift-off');
assert.equal(T.speed({...s,autoSpeed:false},up,.05),1234);assert.equal(T.speed({...s,autoSpeed:false},up,.05,true),6170);
const samples=[];for(const altitude of [.02,.1,1,10,100,1000,10000,100000,1e6,1e7]){const a={...base,geometryDetail:false,position:M.mul(q,base.radius-altitude),forward:up};T.reset();const away=T.speed(a,up,.05);T.reset();const toward=T.speed(a,q,.05);samples.push({altitude,away,toward});assert(Math.abs(away-toward)<away*.2,'Departure and approach share the distance gradient');}
for(let i=1;i<samples.length;i++)assert(samples[i].away>samples[i-1].away);
// A long approach crosses no surface even with a previously very high speed.
T.reset();const high={...base,geometryDetail:false,position:M.mul(q,base.radius-1e7)};T.speed(high,q,.05);
const close={...base,geometryDetail:false,position:M.mul(q,base.radius-.02)};assert(T.speed(close,q,.05)<.05);
// Fly a chord across the cavity, missing the star, from a 45 m departure to
// the opposite region. This exercises the real speed/collision/landing chain.
const trip={...base,geometryDetail:false},axis=M.basis(q).r;let other=M.rotate(q,axis,2);
for(let i=0;M.inBreach(other,trip)&&i<20;i++)other=M.rotate(q,axis,1.8+i*.05);
trip.position=M.mul(q,trip.radius-.045);trip.forward=M.norm(M.sub(M.mul(other,trip.radius),trip.position));trip.up=M.basis(trip.forward,M.mul(q,-1)).u;
T.reset();let frames=0,peak=0;
while(frames<8000&&!trip.walkMode){if(frames>200&&trip.radius-M.length(trip.position)<5)trip.geometryDetail=true;const v=T.speed(trip,trip.forward,.05);peak=Math.max(peak,v);const move=L.move(trip,trip.forward,v*.05);trip.position=move.position;T.level(trip,.05);frames++;}
assert(trip.walkMode);assert(peak>T.maxSpeed*.99);assert(frames<2000);assert(M.length(M.sub(M.norm(trip.position),other))*trip.radius<.2);
for(let i=0;i<180;i++)S.step(trip,new Set(),1/60);assert(Math.abs(M.dot(trip.forward,S.site(trip).basis[1]))<.1,'Arrival levels the look toward the new horizon');
// Free survey passes continuously through the star, including the exact
// centre. Both directions retain their requested step, speed and clock state.
for(const sign of [-1,1])for(const playing of [false,true]){
 const transit={...base,playing,autoSpeed:true,geometryDetail:false,position:[base.starRadius*1.2*sign,0,0],forward:[-sign,0,0]};
 T.reset();assert.equal(T.speed(transit,transit.forward,.05),T.maxSpeed,'The star must not apply an approach brake');
 for(const fraction of [.4,.4,.4,.4,.4,.4]){const previous=transit.position.slice(),distance=base.starRadius*fraction,result=L.move(transit,transit.forward,distance);transit.position=result.position;assert(!result.blocked);assert(Math.abs(M.length(M.sub(previous,transit.position))-distance)<1e-7);M.validate(transit);assert.equal(transit.playing,playing);assert(Number.isFinite(M.sunVisibility(transit.position,transit,19)));}
 assert(transit.position[0]*sign<-base.starRadius);
}
const centre={...base,position:[0,0,0]};assert.deepEqual(M.validate(centre).position,[0,0,0]);assert.equal(M.sunVisibility(centre.position,centre),1);assert.notEqual(M.trace(centre.position,[1,0,0],centre).kind,'Star');
// An exact antipode has the same x/z in the original patch's tangent frame.
// Arrival must create the far biome's patch, rather than reusing that old one.
const diameter={...base,geometryDetail:true},origin=W.locateBiome(8,base),departure=M.mul(origin,-1);diameter.position=M.mul(origin,diameter.radius-.08);diameter.forward=M.basis(origin).r;diameter.up=departure;L.enter(diameter,diameter.position);const oldAnchor=diameter.siteAnchor.slice();L.release(diameter);diameter.position=M.mul(origin,diameter.radius-.045);T.reset();let diameterFrames=0;
while(diameterFrames<3000&&!diameter.walkMode){const velocity=T.speed(diameter,departure,.05),result=L.move(diameter,departure,velocity*.05);diameter.position=result.position;T.level(diameter,.05);diameterFrames++;}
assert(diameter.walkMode);assert(M.dot(oldAnchor,diameter.siteAnchor)<-.999999999);assert.equal(diameter.siteId,'biome-2');assert(Math.abs(diameter.walkPosition[1])<1);
for(let i=0;i<180;i++)S.step(diameter,new Set(),1/60);assert(Math.abs(L.heightAboveGround(diameter)-S.EYE)<.00008,'A diametric trip settles onto its actual destination');
const categories=P.categories.map(c=>c.id);assert.equal(new Set(categories).size,6);
for(const entry of P.catalogue(base)){assert(categories.includes(entry.category));assert(entry.description);}
assert.equal(P.atmosphereKm,384400*2/3);
(async()=>{
 let visits=0;
 for(const id of ['biome-0','biome-2','works-0','works-1','works-2','port-0','port-1','shade-0','wound-0'])for(const height of ['ground','clouds','atmosphere']){
  const next=await P.destination({...base,playing:true},id,height,'darkness','storm');M.validate(next);assert(next.playing);assert.equal(next.placeScene,'darkness');assert.equal(next.placeWeather,'storm');assert.equal(next.speed,base.speed);
  if(id.startsWith('wound'))assert.equal(next.siteId,'exterior-0');
  else if(height==='ground'&&!id.startsWith('shade'))assert(next.walkMode);
  else if(!id.startsWith('shade'))assert(Math.abs(next.radius-M.length(next.position)-(height==='atmosphere'?P.atmosphereKm:P.cloudAltitude(id==='biome-0'?0:id==='biome-2'?2:5)))<.0001);
  visits++;
 }
 console.log('PASS auto/manual speed, symmetric gradient, takeoff, '+(frames*.05).toFixed(1)+' s cavity crossing, saved preferences, catalogue and '+visits+' Place arrivals');
})().catch(e=>{console.error(e);process.exitCode=1;});
