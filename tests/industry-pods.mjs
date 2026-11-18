// The offered Industry generator and every plant it builds. SPHERE_POD_VERSION selects an archived version.
// Pure functions: no browser. `npm run test:pods`.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const library=JSON.parse(readFileSync(new URL('../packs/biome-library.json',import.meta.url)));
const offered=library.packs.find(p=>p.id==='infinite-industry');
const version=process.env.SPHERE_POD_VERSION||offered.version;
const base=new URL('../packs/infinite-industry/'+version+'/',import.meta.url);
const {district,pod,hexes,locate,podsWithin,describe,LANE_HALF_M,DISTRICT_M,ROLES}=await import(new URL('pod.js',base));
const {plant}=await import(new URL('plant.js',base));
const results=[],check=(name,detail)=>{results.push({name,...detail});console.log('PASS '+name);};
const EDGES=[[1,0],[0,1],[1,-1],[-1,0],[0,-1],[-1,1]];   // pods that share an edge, in pod-lattice steps

const home=district(0,0),first=pod(home,0,0);
assert.equal(home.scale,1);assert.equal(home.rot,0);assert.equal(describe(first),'ambient liquid, medium column vessels, scale 1');assert(Math.hypot(...first.center)<1e-9);assert.equal(locate(3,-2).hex.waterWorks,true);
check('Rule 3: the home district is scale 1 at angle 0, the home pod is ambient liquid, and its core is the water works');

let points=0,podCount=0;const kinds=new Set(),districts=[];
for(const [I,J] of [[0,0],[1,0],[-1,1],[2,-3]]){const d=district(I,J);districts.push(`${I},${J}: scale ${d.scale}, angle ${Math.round(d.rot*180/Math.PI)}`);
 for(let i=0;i<4000;i++){const a=i*2.399963,rr=Math.sqrt((i+.5)/4000)*(DISTRICT_M/2-d.podRadiusM*2-80),e=d.center[0]+rr*Math.cos(a),n=d.center[1]+rr*Math.sin(a),at=locate(e,n);points++;
  assert(at.hex,'a place inside a district belongs to a pod');assert.equal(locate(at.hex.center[0],at.hex.center[1]).hex.id,at.hex.id);
  const [x,z]=at.hex.toLocal(e,n);for(let k=0;k<6;k++)assert(x*Math.cos(k*Math.PI/3)+z*Math.sin(k*Math.PI/3)<=d.hexM/2+1e-6);}
 for(let a=-6;a<=6;a++)for(let b=-6;b<=6;b++){const p=pod(d,a,b);if(!p)continue;podCount++;kinds.add(describe(p));
  for(const [x,y] of EDGES){const q=pod(d,a+x,b+y);if(q)assert.notEqual(q.temperature,p.temperature);}
  assert.deepEqual([...p.roles].sort(),[...ROLES].sort());assert.equal(hexes(p).length,7);}}
check('Rules 1, 2, 4, 6: pods interlock (every sampled place inside a district lies in exactly one hex of one pod, and that hex is found again from its centre), pods sharing an edge differ in temperature, every ring holds each role once',{points,pods:podCount,distinctPods:kinds.size,districts});
const around=podsWithin(0,0,1500);assert.equal(around[0].pod.key,first.key);assert(around.length>40);
check('Density: pods whose cores stand within 1,500 m of the water works',{pods:around.length});

let plants=0;const worst={near:0,middle:0,far:0,skyline:0,horizon:0};
for(const [I,J] of [[0,0],[-1,1],[0,1]]){const d=district(I,J);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const p=pod(d,a,b);if(!p)continue;for(const h of hexes(p)){if(h.waterWorks)continue;const pl=plant(h),s=p.scale,half=75*s;plants++;
 for(let e=0;e<6;e++){const A=e*Math.PI/3;for(let dd=0;dd<=half;dd+=.5*s)for(const o of [-(LANE_HALF_M-.4)*s,0,(LANE_HALF_M-.4)*s])
  assert(!pl.blocked(dd*Math.cos(A)-o*Math.sin(A),dd*Math.sin(A)+o*Math.cos(A),1.7),`lane ${e} blocked at ${dd/s} in a ${h.role} hex (${describe(p)})`);}
 for(const o of pl.solids){const x=o.k==='pipe'?(o.a[0]+o.b[0])/2:o.x,z=o.k==='pipe'?(o.a[2]+o.b[2])/2:o.z;for(let e=0;e<6;e++)assert(x*Math.cos(e*Math.PI/3)+z*Math.sin(e*Math.PI/3)<=half+.01,'a solid stands outside its hex');}
 const big=pl.solids.find(o=>o.k==='cyl'&&o.r>2*s&&o.y===0);if(big)assert(pl.blocked(big.x,big.z,1.7));
 for(const lod of Object.keys(worst)){const v=pl.vertices(lod);assert(v.length%27===0&&v.every(Number.isFinite));worst[lod]=Math.max(worst[lod],v.byteLength);}
 assert.equal(JSON.stringify(plant(h).solids),JSON.stringify(pl.solids));}}}
check('Rules 7 and 9 over every plant of 27 pods in three districts: all six lanes clear on foot across their width, nothing outside its hex, large solids stop a walker, five levels of detail build, the same hex gives the same plant',{plants,worstMeshBytes:worst});

if(version==='1.4.1'){
 const cases=[];
 for(const [east,north,reach] of [[0,0,9000],[-6200,-4100,9000],[DISTRICT_M/2,0,7800],[300,-350,1500]]){
  // Independent enumeration: a fixed, deliberately wide rectangle of whole districts and pods.
  const expected=new Set();
  for(let I=-8;I<=8;I++)for(let J=-8;J<=8;J++){
   const d=district(I,J);
   if(Math.hypot(d.center[0]-east,d.center[1]-north)>reach+DISTRICT_M)continue;
   for(let a=-18;a<=18;a++)for(let b=-18;b<=18;b++){
    const p=pod(d,a,b);
    if(p&&Math.hypot(p.center[0]-east,p.center[1]-north)<=reach)expected.add(p.key);
   }
  }
  const found=podsWithin(east,north,reach),keys=new Set(found.map(v=>v.pod.key));
  assert.deepEqual(keys,expected);assert.equal(found.length,keys.size);
  assert(found.every((e,i)=>!i||e.distance>=found[i-1].distance));
  if(east===0&&north===0){assert.equal(found.length,1383);assert(keys.has(pod(district(1,1),0,0).key));}
  cases.push({east,north,reach,cores:found.length});
 }
 check('Requested discs agree with an independent wide search and contain each core once',{cases});
 const {escapeFromCover,roofAbove}=await import(new URL('ascent.js',base));
 const {createFacility,DATUM_M}=await import(new URL('facility.js',base)),facility=createFacility();
 const shaded=pod(district(1,1),0,0),hex=hexes(shaded)[0],roof=p=>plant(p);
 assert(!roofAbove(facility,roof,...hex.center,DATUM_M+1.7),'open plaza has no roof');
 assert(roofAbove(facility,roof,7138.267928,4102.578459,DATUM_M+1.7),'documented 20 m hall roof');
 assert(roofAbove(facility,roof,...facility.toWorld(0,-6),DATUM_M+1.7),'water works hall retains its covered exit');
 const feet={eastM:0,northM:0,altitudeM:1.7};
 assert.equal(escapeFromCover(feet,()=>false,()=>false),null);
 assert.equal(escapeFromCover(feet,(x,z)=>Math.hypot(x,z)<3,()=>true),false);
 check('Open sky, the two hall roofs, and a blocked exit are distinct',{});
}

console.log(JSON.stringify({pass:true,checks:results.length,results}));
