import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import atlas from '../sphere-atlas.js';
import {ownerAt} from '../surface-passages.js';
import {footprint,mainPose} from '../geographic-flight.js';
import {roofM,farEdgeM,rampEastM,rampRunM,rampAt} from '../packs/kit/border-profile.js';
import {borderSolids,moveBody,resolvePose} from '../packs/border-transport/0.10.0/outfall/border.js';
import {shellMesh} from '../packs/border-transport/0.10.0/outfall/shell-mesh.js';
const require=createRequire(import.meta.url),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','flight','surface-walk'])require('../'+f+'.js');
const W=globalThis.SphereWorld,S=globalThis.SphereSites,G=globalThis.SphereGround;
const s={...M.defaultState(),collection:true,seed:713,routeShades:false,starStation:false,multipleWounds:false};
const home=atlas.byId('r12c35'),m={id:'infinite-meadow',plot:home.index,plotId:home.id};
const b={id:'border-transport/outfall',edge:atlas.northEdge(home.id)};
const far=atlas.byId(b.edge.far),region={id:'sideways-city',plot:far.index,plotId:far.id,footprint:{shape:'rectangle',east:1,north:1}};
const at=p=>mainPose(s,b,p,atlas,W);
const lib=items=>({matchesWorld:()=>true,installed:()=>items.filter(i=>i.detailInstalled!==false)});
const p={eastM:rampEastM,northM:-rampRunM,altitudeM:1.7,yaw:0,pitch:0,mode:'walk'};
const take=(dz)=>moveBody(p,borderSolids,0,0,dz,rampAt);
for(const side of [1,-1]){
  for(let i=0;i<rampRunM*2;i++)take(side*.5);
  assert.equal(p.mode,'walk');assert(Math.abs(p.altitudeM-roofM-1.7)<1e-6);
  take(side*farEdgeM/2);
  assert.equal(footprint(at(p),lib([m,b,region]),atlas,W).id,b.id);
  const recovered=resolvePose(structuredClone(p),borderSolids,rampAt);assert.deepEqual(recovered,p);
  take(side*farEdgeM/2);
  for(let i=0;i<rampRunM*2;i++)take(side*.5);
  assert.equal(p.mode,'walk');assert(Math.abs(p.altitudeM-1.7)<.0001);
}
for(const detailInstalled of [true,false]){
  const city={...region,detailInstalled},pose={...p,eastM:410,northM:farEdgeM+3100,altitudeM:1700,mode:'flight'};
  const state=at(pose),q=M.norm(state.position);
  assert.equal(footprint(state,lib([m,b,city]),atlas,W)?.id,detailInstalled?city.id:undefined);
  assert.equal(ownerAt(q,state,[m,b,city],atlas,W).id,city.id);assert.equal(ownerAt(q,state,[m,b,city],atlas,W).pack,detailInstalled);
}
const ellipse={...region,footprint:{shape:'ellipse',east:.72,north:.55}};
assert.equal(atlas.regionAt([ellipse],far.latitude,far.longitude),ellipse);
assert.equal(atlas.regionAt([ellipse],far.latitude+far.halfHeight*.5,far.longitude+.6*Math.PI/far.columns),null);
for(const center of [0,63000,-63504]){
  const vertices=shellMesh(center,-180);let base=0;
  for(let i=0;i<vertices.length;i+=11)if(vertices[i+9]===0){
    assert.equal(vertices[i+10],1);assert(Number.isFinite(vertices[i]) && Number.isFinite(vertices[i+2]));
    if(vertices[i+1]===0 && vertices[i+2]===0)base++;
  }
  assert(base>0);
}
console.log('PASS both maintenance ramps and 1,000 km of roof on foot, roof bookmark, finite wall foundations, optional far scenery and unequal Atlas bounds');
s.siteId='biome-9';s.siteRevision=2;s.siteAnchor=W.locateBiome(9,s);s.terrainAnchor=s.siteAnchor;s.position=M.mul(s.siteAnchor,s.radius-.002);
const forest=globalThis.SphereVioletForest,grove=forest.referenceGrove(s),heights=grove.spires.map(v=>v.height*1000);
assert.equal(heights.length,320);assert(Math.abs(Math.min(...heights)-21.1907)<.001);assert(Math.abs(Math.max(...heights)-111.723)<.001);
const tiles=G.neighbourhood(s).filter(t=>t.chunk.cells===G.FINE),byId=new Map();
for(const tile of tiles)for(const id of tile.ground.props)if(String(id).includes('/reference/')){assert(!byId.has(id));byId.set(id,tile);}
const covered=grove.spires.filter(v=>tiles.some(t=>{const [x,,z]=t.local(M.mul(v.q,s.radius)),[l,f,r,g]=t.ground.bounds;return x>=l&&x<r&&z>=f&&z<g;}));
assert.equal(byId.size,covered.length);assert(byId.size>=250);
const tree=covered.find(v=>v.height>.09),tile=byId.get(tree.id),[x,,z]=tile.local(M.mul(tree.q,s.radius));
const floor=G.ground(s,x-.023,z),hit={};const distance=S.rayBVH([x-.06,floor+.015,z],[1,0,0],tile.bvh,.12,hit);
assert(hit.normal && distance>.04 && distance<.06);
const crown={};const drop=S.rayBVH([x,floor+.2,z],[0,-1,0],tile.bvh,.3,crown);
assert(crown.normal && Math.abs((.2-drop)-tree.height)<.001);
const key=tree.id;
forest.referenceGrove({...s,seed:714});assert.deepEqual(forest.referenceGrove(s).spires.find(t=>t.id===key),tree);
assert(G.info.bytes<=G.info.budget);
console.log('PASS seed 713 reference grove,',byId.size,'resident original spires, horizontal shaft collision, crown height and reproducible identity;',G.info.bytes,'bytes resident');
