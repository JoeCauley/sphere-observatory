const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const G=SphereGround,S=SphereSites,base={...M.defaultState(),collection:true,routeShades:false,starStation:false,multipleWounds:false,siteId:'biome-5',siteRevision:2};
assert.throws(()=>M.validate({...base,siteAnchor:[0,1,0],walkPosition:[1e30,0,0]}),/terrain frame/);
let maxRebaseError=0,probes=0,propVertices=0,maxPropError=0;
for(const anchor of [[0,1,0],[0,-1,0],M.norm([1e-10,.1,-1]),M.norm([-1e-10,.1,-1]),M.norm([.2,.3,.9])]){
 const s={...base,siteAnchor:anchor},old=G.frame(s),q=M.norm(old.world([7.1,0,.4])),next={...s,terrainAnchor:q},fresh=G.frame(next),p=old.local(M.mul(q,s.radius)),[x,z]=G.owner(p[0],p[2]),a=G.build(s,x,z),b=G.build(next,0,0);
 for(const offset of [[.01,.01],[.035,.1],[.1,.2],[.12,.07]]){
  const point=M.norm(fresh.world([offset[0],0,offset[1]])),start=M.mul(point,s.radius-1),down=point;
  const distance=mesh=>{const hit={},d=S.rayBVH(mesh.local(start),mesh.basis.map(v=>M.dot(down,v)),mesh.bvh,2,hit);return hit.normal?d:Infinity;},da=distance(a),db=distance(b);
  if(!Number.isFinite(da)||!Number.isFinite(db))continue;maxRebaseError=Math.max(maxRebaseError,Math.abs(da-db));probes++;
 }
 for(const id of a.ground.props){const ai=a.ground.props.indexOf(id),bi=b.ground.props.indexOf(id);if(bi<0)continue;const offsets=[a.count-(a.ground.props.length-ai)*30,b.count-(b.ground.props.length-bi)*30];for(let v=0;v<30;v++){const points=[a,b].map((mesh,index)=>mesh.world(Array.from(mesh.vertices.slice((offsets[index]+v)*11,(offsets[index]+v)*11+3))));maxPropError=Math.max(maxPropError,M.length(M.sub(...points)));propVertices++;}}
 assert.equal(new Set(a.ground.props).size,a.ground.props.length);
 assert.equal(new Set(b.ground.props).size,b.ground.props.length);
}
assert(propVertices>0);assert(maxPropError<.000001,'Props must keep their geographic orientation through rebasing');assert(probes>=10);assert(maxRebaseError<.000001,'Reoriented support must agree within 1 mm');
// Fine and coarse rings consume exactly the same uploaded inner border.
const s={...base,siteAnchor:M.norm([.2,.3,.9])};s.position=G.frame(s).world([.4,.1,.4]);const groups=G.neighbourhood(s);let borderVertices=0;
for(const fine of groups.filter(m=>m.chunk.cells===G.FINE))for(const coarse of groups.filter(m=>m.chunk.cells===G.COARSE)){
 const dx=coarse.chunk.x-fine.chunk.x,dz=coarse.chunk.z-fine.chunk.z;if(Math.abs(dx)+Math.abs(dz)!==1)continue;
 const axis=dx?0:2,border=(dx>0?fine.chunk.x+1:dx<0?fine.chunk.x:dz>0?fine.chunk.z+1:fine.chunk.z)*G.SIZE;
 const edge=mesh=>{const out=new Set();for(let i=0;i<mesh.vertices.length;i+=11)if(mesh.vertices[i+axis]===Math.fround(border)&&mesh.vertices[i+9]>=0)out.add(Array.from(mesh.vertices.slice(i,i+3)).join(','));return out;},a=edge(fine),b=edge(coarse);
 for(const p of a){assert(b.has(p),'A fine/coarse join cannot have unmatched vertices');borderVertices++;}
}
assert(borderVertices>500);console.log(JSON.stringify({status:'PASS',probes,maxRebaseErrorMetres:maxRebaseError*1000,borderVertices,propVertices,maxPropErrorMetres:maxPropError*1000}));
