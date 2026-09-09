const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');const C=globalThis.SphereCollection;
let s={...M.defaultState(),collection:true};
for(const era of ['before','after']){s.era=era;const restored=M.validate(M.sceneRecord(s).state);assert.deepEqual(restored,s);assert.equal(C.plates(s).length,era==='before'?18:12);}
for(const w of C.wounds){assert(C.missing(w.axis,s));assert(!C.missing(w.axis,{...s,era:'before'}));const p=M.mul(w.axis,s.radius*.95);assert.equal(M.trace(p,w.axis,s).kind,'Open space');assert.equal(M.trace(p,w.axis,{...s,era:'before'}).kind,'Inner surface');}
const before=C.plates({...s,era:'before'}),after=C.plates(s);for(const p of after){assert.deepEqual(p.center,before.find(q=>q.id===p.id).center);assert(Math.abs(M.length(p.normal)-1)<1e-12);assert(Math.abs(M.dot(p.normal,p.right))<1e-12);}
for(const r of C.routes){const period=r.hours*r.count*3600;const a=C.plates({...s,era:'before',time:0}).filter(p=>p.band===C.routes.indexOf(r)),b=C.plates({...s,era:'before',time:period}).filter(p=>p.band===C.routes.indexOf(r));a.forEach((p,i)=>assert(M.length(M.sub(p.center,b[i].center))<1e-12));}
assert.deepEqual(C.region(M.axis(8,14),s),C.region(M.axis(8,14),{...s,era:'before'}));
assert.deepEqual(C.cavity({...s,luminosity:0}),[0,0,0]);
assert(C.cavity({...s,era:'before',routeShades:false}).every(v=>v>0&&Number.isFinite(v)));
assert.throws(()=>M.validate({...s,cycleScale:NaN}));assert.throws(()=>M.validate({...s,era:'during'}));
console.log('PASS collection round-trip, counts, six real openings, surviving identity, route periods, stable regions, light response and validation');
