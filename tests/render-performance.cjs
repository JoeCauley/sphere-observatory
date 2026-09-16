const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','asset-plan'])require('../'+f+'.js');
const W=SphereWorld,B=SphereShadeEdges,C=SphereCollection,base={...M.defaultState(),collection:true};
// Independent pre-optimization contour search. Cached samples must preserve
// the exact chosen wound, parameter and distance, including at the tips.
function reference(q,s){let best={distance:Infinity};for(let index=0;index<C.wounds.length;index++){let t=0,score=Infinity;for(let j=0;j<192;j++){const v=M.length(M.sub(q,W.boundaryPoint(index,j*2*Math.PI/192)));if(v<score){score=v;t=j*2*Math.PI/192;}}let lo=t-2*Math.PI/192,hi=t+2*Math.PI/192;for(let k=0;k<56;k++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(M.length(M.sub(q,W.boundaryPoint(index,a)))<M.length(M.sub(q,W.boundaryPoint(index,b))))hi=b;else lo=a;}t=(lo+hi)/2;const point=W.boundaryPoint(index,t),distance=Math.atan2(M.length(M.cross(q,point)),M.dot(q,point))*s.radius;if(distance<best.distance)best={index,t,point,distance};}return best;}
let rims=0;for(let id=0;id<6;id++)for(const t of [0,.7,Math.PI/2,Math.PI,4.9])for(const offset of [-.00001,0,.00001]){const f=W.rimFrame(base,id,t),q=M.norm(M.add(f.point,M.mul(f.inland,offset)));assert.deepEqual(W.nearestRim(q,base),reference(q,base));rims++;}
// Analytic line projection is the actual nearest point on the metric segment,
// including clamped endpoints, skinny plates, and both sides of every hole.
let lines=0;for(const shape of ['square','trimmed','cap']){const s={...base,shadeShape:shape},p=C.plates(s)[0];for(const c of B.curves(p).filter(c=>c.line))for(const uv of [[-.9,.8],[0,0],[1.2,-1.1]]){const t=B.nearest(c,uv,p.across),q=c.at(t),d=((q[0]-uv[0])*p.across)**2+(q[1]-uv[1])**2;assert(t>=0&&t<=1);for(const dt of [-.00001,.00001]){const other=c.at(M.clamp(t+dt,0,1)),test=((other[0]-uv[0])*p.across)**2+(other[1]-uv[1])**2;assert(d<=test+1e-14);}lines++;}}
const sandbox={window:{},SphereMath:M};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../geometry-renderer.js'),'utf8'),sandbox);const visible=sandbox.window.SphereGeometryVisible;
let seed=83,checks=0;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<3000;i++){const camera={...base,position:[M.AU,0,0],fov:35+random()*110},basis=M.basis(M.norm([random()-.5,random()-.5,random()-.5])),mb=M.basis(M.norm([random()-.5,random()-.5,random()-.5])),size=[random()*4,random()*4,random()*4],mesh={count:36,origin:M.add(camera.position,[random()*40-20,random()*40-20,random()*40-20]),basis:[mb.r,mb.u,mb.f],bvh:{min:size.map(x=>-x),max:size}},aspect=.5+random()*2,tan=Math.tan(M.radians(camera.fov)*.5);
 const corners=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){let p=M.sub(mesh.origin,camera.position);for(const [axis,sign]of [[0,x],[1,y],[2,z]])p=M.add(p,M.mul(mesh.basis[axis],size[axis]*sign));corners.push(p);}
 const planes=[basis.f,M.add(M.mul(basis.f,tan),basis.r),M.sub(M.mul(basis.f,tan),basis.r),M.add(M.mul(basis.f,tan/aspect),basis.u),M.sub(M.mul(basis.f,tan/aspect),basis.u)];
 const rejected=planes.some(p=>corners.every(q=>M.dot(p,q)<-.000001));assert.equal(visible(mesh,camera,basis,aspect),!rejected);checks++;
}
// Reuse is value-based; mutating the original camera or a quality setting must
// invalidate it. Repeated readiness/draw requests perform no new trace calls.
const q=W.locateBiome(0,base),s={...base,position:M.mul(q,base.radius-.01),forward:q,up:M.basis(q).u};let traces=0;const trace=M.trace;M.trace=(...a)=>{traces++;return trace(...a);};const first=SphereAssets.plan(s);assert(traces>0);traces=0;assert.strictEqual(SphereAssets.plan(structuredClone(s)),first);assert.equal(traces,0);s.position[0]+=.001;assert.notStrictEqual(SphereAssets.plan(s),first);assert(traces>0);s.textureDetail=false;assert.equal(SphereAssets.plan(s).heroes.length,0);M.trace=trace;
// Floating point cancellation at an AU-sized camera must not repeatedly
// cancel terrain construction when walking along a chunk boundary.
const reservations=[],terrain={SphereMath:M,SphereWorld:W,SphereSites:SphereSites,SphereCollection:C,Worker:class{postMessage(p){reservations.push(p);}terminate(){}}};vm.createContext(terrain);vm.runInContext(fs.readFileSync(require.resolve('../ground-chunks.js'),'utf8'),terrain);
const ground=terrain.SphereGround,walking={...base,siteRevision:2,siteId:'biome-8',siteAnchor:M.norm([.2,.3,.9]),walkMode:true},frame=ground.frame(walking);
for(let i=0;i<100;i++){walking.position=frame.world([(i%2?1:-1)*1e-8,.01,.2]);ground.request(walking);}
assert.equal(reservations.length,1,'Sub-millimetre frame roundoff must share one reservation');
walking.position=frame.world([-.001,.01,.2]);ground.request(walking);assert.equal(reservations.length,2,'A real boundary crossing still requests its neighbour');
assert.deepEqual(Array.from(ground.owner(-1e-9,.2)),[-1,0],'Geographic ownership stays exact');
require('../simulation-timing.js');
for(const refresh of [60,120,144])for(const fps of [15,30,60])for(const phase of [-Infinity,.75]){let previous=phase,draws=0;for(let frame=0;frame<refresh*20;frame++){const now=frame*1000/refresh+Math.sin(frame*1.7)*.09;if(now-previous<1000/fps-.8)continue;previous=SphereTiming.previewStamp(previous,now,fps);assert(previous<=now,'Completed draws never advance into the future');draws++;}assert(Math.abs(draws-fps*20)<=1,`${fps} fps cadence at ${refresh} Hz: ${draws} draws`);}
console.log('PASS',rims,'exact contour searches,',lines,'analytic boundary projections,',checks,'conservative rotated-box culling checks, value-based asset invalidation, stable terrain reservations and jittered display cadence');
