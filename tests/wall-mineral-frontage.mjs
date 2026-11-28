import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {districtFor,mineralFrontage} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtPoint,wallDistance,linkHalfM} from '../packs/border-transport/0.10.0/district.mjs';
import {pointOnEdge} from '../packs/border-transport/0.10.0/edges.mjs';
import {wallCamera,wallWindow} from '../packs/border-transport/0.10.0/wall-stream.mjs';
const require=createRequire(import.meta.url);
for(const f of ['math','collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const W=globalThis.SphereWorld,M=globalThis.SphereMath,s={...M.defaultState(),seed:713,collection:true};
const d=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',s.radius*1000);
d.mineralFrontage=mineralFrontage(s,W);const f=d.mineralFrontage;
assert.equal(f.edge.id,'r8c31/r9c31');
const gap=(along,across)=>{const g=pointOnEdge(f.edge,f.alongM+along,across);
 const p=districtPoint(d,g.latitude,g.longitude);return wallDistance(d,p.eastM,p.northM);};
for(const a of [-9000,-4801,-4799,-3000,-1601,-1599,0,1599,1601,3000,4799,4801,9000]){
 assert(gap(a,-f.side*(linkHalfM-80))<0,'continuous roof shoulder at '+a);
 assert.equal(gap(a,0)>0, Math.abs(a)<f.halfM-2*f.innerM);
}
for(const along of [-8100,-4500,-3000,0,3000,4500,8100]){
 const edge=f.innerM+.5*Math.max(0,Math.abs(along)-f.halfM);
 assert(gap(along,f.side*(edge-4))<0 && gap(along,f.side*(edge+4))>0,'Shoulder and collision agree at '+along);
}
const grove=SphereVioletForest.referenceGrove(s);
for(const spire of grove.spires){
 const g=W.coordinates(spire.q,s),p=districtPoint(d,g.lat,g.lon);
 assert(wallDistance(d,p.eastM,p.northM)>spire.radius*1000);
}
const at=districtPoint(d,f.latitude,f.longitude),quads=[];
const tile=wallWindow(d,at.eastM,at.northM,{quad:(...q)=>quads.push(q)});
assert(tile.edges.includes(f.edge.id));assert(quads.length>0);
const axes={right:[1,0,0],up:[0,1,0],forward:[0,0,1]};
const eye=wallCamera(d,tile,at.eastM,at.northM,0,axes,0,false).eye;
function lateralDistance(a,b){
 const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((eye[0]-a[0])*dx+(eye[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(eye[0]-a[0]-t*dx,eye[2]-a[2]-t*dz);
}
const roofEdges=quads.filter(([a,b,c,e])=>[a,b,c,e].every(v=>Math.abs(v[1]-eye[1]-1745)<8));
const closest=Math.min(...roofEdges.flatMap(quad=>quad.slice(0,4).map((v,i)=>lateralDistance(v,quad[(i+1)%4]))));
assert(Math.abs(closest-f.halfM)<.1,'Rendered recess is '+closest+' m from the original grove in physical metres');
console.log('Nearest visible roof from the original grove',closest.toFixed(3),'m');
console.log('PASS the reference clearing, all '+grove.spires.length+' spires, and a continuous '+(linkHalfM+f.innerM).toFixed(0)+' m roof past the mineral frontage.');
