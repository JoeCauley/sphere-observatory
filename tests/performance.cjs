const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');const C=globalThis.SphereCollection;
// Independent, uncullled union of all blockers, using the original source-ray construction.
function reference(p,s,samples){const pn=M.mul(p,1/s.radius),b=M.basis(M.mul(p,-1)),rad=Math.tan(Math.asin(s.starRadius/M.length(p)));let lit=0;
 for(let i=0;i<samples;i++){const a=i*2.39996323,r=Math.sqrt((i+.5)/samples)*rad,d=M.norm(M.add(b.f,M.add(M.mul(b.r,r*Math.cos(a)),M.mul(b.u,r*Math.sin(a))))),st=M.sphereDistance(pn,d,[0,0,0],s.starRadius/s.radius);if(C.plates(s).every(pl=>C.diskDistance(pn,d,pl)>=st)&&C.ringDistance(pn,d,s)>=st)lit++;}return lit/samples;}
let probes=0;
for(const shadeShape of ['disk','square','cap','trimmed'])for(const era of ['before','after'])for(const starStation of [true,false]){
 const s={...M.defaultState(),collection:true,shadeShape,era,starStation,time:54321};
 for(let i=0;i<24;i++){const y=1-2*(i+.5)/24,a=i*2.39996323,q=[Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)],p=M.mul(q,s.radius*(i%2?.95:.35));assert.equal(C.visibility(p,s,64),reference(p,s,64),JSON.stringify({shadeShape,era,starStation,i}));probes++;}
}
console.log('PASS conservative source-cone culling matches all-blocker reference:',probes,'probes');
require('../biomes.js');require('../preview-quality.js');const B=globalThis.SphereBiomes;
assert.equal(B.catalog.length,10);assert.equal(new Set(B.catalog.map(b=>b.id)).size,10);
for(let id=-1;id<10;id++){const s={...M.defaultState(),biome:id};assert.deepEqual(M.validate(s),s);if(id>=0)assert.equal(B.region([0,0,1],s),id);}
assert.throws(()=>M.validate({...M.defaultState(),biome:10}));assert.throws(()=>M.validate({...M.defaultState(),biome:NaN}));assert.throws(()=>M.validate({...M.defaultState(),textureDetail:'true'}));
for(const distance of [0,1,6,10,18,60,100,180,600,1000,1800,1e8]){const w=B.weights(distance);assert(w.every(x=>x>=0&&x<=1));const before=B.weights(distance-.0001),after=B.weights(distance+.0001);assert(w.every((_,i)=>Math.abs(before[i]-after[i])<.0001));}
assert.deepEqual(B.weights(2000),[0,0,0]);assert.deepEqual(B.weights(1),[1,1,1]);assert.deepEqual(B.weights(1,1000),[0,0,0]);
// A fixed world point retains UV phase through metre-scale rebasing, at AU radii.
const q=M.norm([.3,.4,.5]),r=M.AU,target=M.mul(q,r);let previous;
for(const offset of [0,.001,.01]){const n=M.norm(M.add(target,[offset,0,0])),anchor=B.anchors(n,r),delta=M.sub(target,M.mul(n,r)),uv=anchor.map((a,i)=>((a+delta[i%3]/B.scales[Math.floor(i/3)])%2+2)%2);if(previous)assert(uv.every((v,i)=>Math.min(Math.abs(v-previous[i]),2-Math.abs(v-previous[i]))<1e-7));previous=uv;}
const controller=new SpherePreviewQuality();for(let i=0;i<100;i++)controller.update(40,16.67,i*20);assert(controller.scale<1&&controller.scale>=.5);for(let i=0;i<600;i++)controller.update(2,16.67,3000+i*20);assert.equal(controller.scale,1);
for(const f of [[1,0,0],[0,1,0],[0,0,1]]){const b=M.basis(f,f);assert(Math.abs(M.length(b.u)-1)<1e-12);assert(Math.abs(M.dot(b.u,b.f))<1e-12);}
console.log('PASS ten biome states, input validation, continuous distance/footprint LOD, metre-stable anchors, adaptive recovery and vertical bases');
