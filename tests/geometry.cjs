const assert=require('node:assert/strict'),M=require('../math.js');let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function near(a,b,epsilon=1e-7){assert.ok(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`);}
test('Half-radius inward and outward distances',()=>{const p=[0,0,M.AU/2];near(M.shellDistance(p,[0,0,1],M.AU),M.AU/2);near(M.shellDistance(p,[0,0,-1],M.AU),M.AU*1.5);});
test('One-km clearance survives near-shell cancellation',()=>{const p=[0,0,M.AU-1];near(M.shellDistance(p,[0,0,1],M.AU),1,1e-8);near(M.shellDistance(p,[1,0,0],M.AU),Math.sqrt(2*M.AU-1),1e-7);});
test('Random ray hits lie on the shell',()=>{for(let i=1;i<2000;i++){const p=M.mul(M.norm([Math.sin(i),Math.cos(i*1.23),Math.cos(i*.7)]),M.AU*(.01+(i%99)/100));const d=M.norm([Math.cos(i*2),Math.sin(i*.17),Math.sin(i*.77)]),t=M.shellDistance(p,d,M.AU);assert.ok(t>0);near(M.length(M.add(p,M.mul(d,t))),M.AU,1e-5);}});
test('Star apparent diameter matches solar geometry',()=>{near(2*M.degrees(Math.asin(M.SUN/M.AU)),.5329062144923113,1e-12);near(2*M.degrees(Math.asin(M.SUN/(M.AU/2))),1.0658239545844213,1e-12);});
test('Breach cap has the specified great-circle diameter',()=>{const s=M.defaultState(),n=M.axis(s.breachLat,s.breachLon),a=s.breachDiameter/(2*s.radius),t=M.basis(n).r;assert.ok(M.inBreach(M.rotate(n,t,a*.999),s));assert.ok(!M.inBreach(M.rotate(n,t,a*1.001),s));});
test('A breach really opens to space',()=>{const s=M.defaultState(),n=M.axis(s.breachLat,s.breachLon),p=M.mul(n,s.radius/2);s.shadeEnabled=false;assert.equal(M.trace(p,n,s).kind,'Open space');s.breachEnabled=false;assert.equal(M.trace(p,n,s).kind,'Inner surface');});
test('The central star occludes the far wall',()=>{const s=M.defaultState();s.shadeEnabled=false;const h=M.trace(s.position,[0,0,-1],s);assert.equal(h.kind,'Star');near(h.distance,M.AU/2-M.SUN);});
test('Shade blocks, exposes, and partially exposes the finite star',()=>{const s=M.defaultState(),p=[0,0,M.AU-300];s.shadeOffset=0;near(M.sunVisibility(p,s,2048),0);s.shadeOffset=2;near(M.sunVisibility(p,s,2048),1);s.shadeOffset=1;const f=M.sunVisibility(p,s,4096);assert.ok(f>.48&&f<.52,String(f));});
test('No false shade when it is behind the observer',()=>{const s=M.defaultState(),p=[0,0,M.AU/2];near(M.sunVisibility(p,s),1);});
test('Planar disk notch and ray parallel to plane',()=>{const p={center:[0,0,10],radius:2,damage:1};assert.ok(!M.plateContains(-1.72,.36,p));assert.equal(M.plateDistance([0,0,0],[1,0,0],p),Infinity);near(M.plateDistance([0,0,0],[0,0,1],p),10);});
test('Perspective edge angle equals half horizontal FOV',()=>{const b=M.basis([0,0,1]);near(M.degrees(Math.acos(M.dot(M.ray(1,0,16/9,140,b),b.f))),70,1e-10);});
test('Camera basis remains orthonormal after rotations',()=>{let f=[0,0,1],u=[0,1,0];for(let i=0;i<1000;i++){const b=M.basis(f,u);f=M.rotate(b.f,b.u,.001);u=M.rotate(b.u,b.r,.0001);}const b=M.basis(f,u);near(M.dot(b.f,b.u),0,1e-12);near(M.length(b.r),1,1e-12);});
test('Scene settings round-trip and reject invalid camera data',()=>{const s=M.defaultState();assert.deepEqual(M.validate(M.sceneRecord(s).state),s);assert.throws(()=>M.validate({...s,radius:NaN}));assert.throws(()=>M.validate({...s,position:[0,0,0]}));assert.throws(()=>M.validate({...s,position:[0,0,s.radius+1]}));assert.throws(()=>M.validate({...s,shadeAltitude:s.radius}));});
console.log(`${count} geometry checks passed.`);
