const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');const C=globalThis.SphereCollection;
// Bounds hold for every phase; sampling a few times would not establish noncollision.
let lastOuter=0;
for(const r of C.routes){const alpha=Math.PI/(2*r.count),a=r.radius*Math.tan(alpha),worstBound=Math.SQRT2*a,outer=Math.hypot(r.radius,worstBound);
 assert(r.radius>lastOuter,'Radial envelopes overlap');assert(outer<1,'Square corner touches inhabited shell');assert(2*r.radius*Math.sin(Math.PI/r.count)>2*worstBound,'Conservative neighbor bounds overlap');lastOuter=outer;
}
for(const shape of ['disk','square','cap','trimmed']){
 const s={...M.defaultState(),collection:true,era:'before',shadeShape:shape,starStation:false};assert.equal(M.validate(M.sceneRecord(s).state).shadeShape,shape);
 const pl=C.plates(s)[0];assert(Math.abs(C.diskDistance([0,0,0],pl.normal,pl)-M.length(pl.center))<1e-12);
 const corner=M.add(pl.center,M.add(M.mul(pl.right,pl.size*.9),M.mul(pl.up,pl.size*.9))),ray=M.norm(corner);
 assert.equal(Number.isFinite(C.diskDistance([0,0,0],ray,pl)),shape==='square');
 const outer=C.plates(s).find(p=>p.id===16);assert.equal(C.visibility(M.mul(outer.center,s.radius),s,7,16),shape==='trimmed'?1:0,'Side trimming removes this off-belt eclipse');
 const later={...s,time:12*3600},laterPlate=C.plates(later).find(p=>p.id===16);assert.equal(C.visibility(M.mul(laterPlate.center,s.radius),later,7,16),1,'Known clear interval must be lit');
}
assert.throws(()=>M.validate({...M.defaultState(),shadeShape:'invalid'}));
const t={...M.defaultState(),collection:true,era:'before',shadeShape:'trimmed',shadeTrim:.65};
const plate=C.plates(t)[0];
const hit=(x,y)=>Number.isFinite(C.diskDistance([0,0,0],M.norm(M.add(plate.center,M.add(M.mul(plate.right,plate.size*x),M.mul(plate.up,plate.size*y)))),plate));
assert(hit(.64,0));assert(!hit(.66,0));assert(hit(0,.99));assert(!hit(0,1.01));
for(const [key,values] of Object.entries({shadeTrim:[0,1.1,NaN],antialias:[1,4],shadowSamples:[0,8]}))for(const v of values)assert.throws(()=>M.validate({...t,[key]:v}));
assert.equal(M.validate(M.sceneRecord({...t,antialias:2,shadowSamples:19}).state).shadeTrim,.65);
console.log('PASS trimmed side cuts, retained leading/trailing ends, settings validation;  all-phase conservative clearance for four shapes, square corners, cap rays, known eclipses and clear intervals, shape round-trip');
