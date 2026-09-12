const assert=require('node:assert/strict'),M=require('../math.js');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');require('../inspection-camera.js');
const W=SphereWorld,E=SphereEdges,I=SphereInspection,C=SphereCollection,S=SphereSites,base={...M.defaultState(),collection:true,routeShades:true};
let transported=0,edgeProbes=0;
for(const shape of ['disk','square','cap','trimmed'])for(const id of [0,7,8]){
 const s={...base,shadeShape:shape,siteId:'shade-'+id,shadeAttachment:id},p=C.plates(s).find(p=>p.id===id);s.siteAnchor=p.normal;const frame=S.shadeSection(s);s.position=frame.world([-.3,.2,.75]);s.forward=M.norm(M.sub(frame.world([.5,0,0]),s.position));s.up=M.basis(s.forward,frame.basis[1]).u;
 const original=structuredClone(s),coordinates=state=>{const p=I.plate(state),offset=M.sub(state.position,M.mul(p.center,state.radius));return [p.right,p.normal,p.up].map(b=>M.dot(offset,b));},reference=coordinates(s);
 for(const t of [1,600,86399,-9600,0,1e8,0]){I.setTime(s,t);const local=coordinates(s);assert(M.length(M.sub(local,reference))<.0000002,'Moving the Shade must preserve camera coordinates to sub-millimetre accuracy');assert(Math.abs(M.dot(s.forward,s.up))<1e-12);transported++;}
 assert(M.length(M.sub(original.position,s.position))<.0000002);const restored=M.validate(M.sceneRecord(s).state);assert.equal(restored.shadeAttachment,id);
 const changed={...s,shadeShape:shape==='disk'?'cap':'disk'},localBefore=S.shadeSection(s).local(s.position);assert(I.transport(s,changed));assert(M.length(M.sub(S.shadeSection(changed).local(changed.position),localBefore))<.0000002,'Shape changes preserve the local inspection');
 s.shadeAttachment=null;const detached=s.position.slice();I.setTime(s,3000);assert.deepEqual(s.position,detached);
}
for(let index=0;index<6;index++)for(const t of [.02,.48,1.57,2.6,3.9,5.98]){
 const f=W.rimFrame(base,index,t),s={...base,position:M.add(M.mul(f.point,base.radius-3),M.mul(f.inland,-2))},ctx=E.rimContext(s);assert(ctx&&ctx.index===index);
 for(const along of [-50,-1,0,1,50])for(const offset of [-.002,.002]){
  const derivative=M.length(M.sub(W.boundaryPoint(index,t+1e-7),W.boundaryPoint(index,t-1e-7)))*s.radius/2e-7,frame=W.rimFrame(s,index,t+along/derivative),point=M.mul(M.norm(M.add(frame.point,M.mul(frame.inland,offset/s.radius))),s.radius),margin=E.rimMargin(M.sub(point,ctx.origin),ctx,s);
  assert.equal(margin>0,offset>0,'Millimetre-relative edge classification on either side of each Wound');edgeProbes++;
 }
}
E.setView(1920);const f=W.rimFrame(base),s={...base,siteId:'rim',siteAnchor:f.point,position:M.add(M.mul(f.point,base.radius-5),M.mul(f.inland,-8)),fov:86};
let first=E.rimMeshes(s);assert(first.length>10&&first.length<600);assert(first.every(m=>m.vertices.every(Number.isFinite)));assert(first.some(m=>M.length(M.sub(m.origin,s.position))>10000),'Thickness stays modeled well beyond the former short patch');
const keys=new Set(first.map(m=>m.streamKey));s.position=M.add(s.position,M.mul(f.tangent,.1));const moved=E.rimMeshes(s);assert(moved.filter(m=>keys.has(m.streamKey)).length/moved.length>.9,'Small travel must retain the great majority of buffers');
const range=E.readableRange(.02,s);E.setView(3840);assert.equal(E.readableRange(.02,s),range*2,'Output resolution controls readability');
const low={...base,position:M.mul(W.frame(base).axis,base.radius-.5),surfaceLock:true},up=M.mul(M.norm(low.position),-1);low.forward=M.norm(M.add(W.frame(base).right,M.mul(up,-.3)));low.up=M.rotate(M.basis(low.forward,up).u,low.forward,.7);const pitch=M.dot(low.forward,up);assert(I.level(low));assert(Math.abs(M.dot(low.forward,up)-pitch)<1e-12);assert(M.length(M.sub(low.up,M.basis(low.forward,up).u))<1e-12);
low.surfaceLock=false;low.up=M.rotate(low.up,low.forward,.7);const rolled=low.up.slice();assert(!I.level(low));assert.deepEqual(low.up,rolled);low.surfaceLock=true;low.forward=up.slice();assert(!I.level(low),'Vertical views retain a stable roll');
assert.throws(()=>M.validate({...base,shadeAttachment:1.5}));assert.equal(M.validate({...base,shadeAttachment:0}).shadeAttachment,null);
console.log(`PASS ${transported} moving-frame transports, ${edgeProbes} close boundary probes, deterministic stream retention, resolution-dependent LOD, scene restore, detach, level lock and vertical stability.`);

E.setView(1200,{deterministic:true});const shade={...base,siteId:'shade-0',siteAnchor:C.plates(base)[0].normal};shade.position=S.shadeSection(shade).world([-.3,.2,.75]);const firstCapture=E.shadeMeshes(shade).map(m=>m.streamKey);E.setView(3840);E.shadeMeshes(shade);E.setView(1200,{deterministic:true});assert.deepEqual(E.shadeMeshes(shade).map(m=>m.streamKey),firstCapture,'Capture LOD is independent of preview history');
