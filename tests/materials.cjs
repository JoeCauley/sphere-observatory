const assert=require('node:assert/strict'),M=require('../math.js');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../field-sites.js');require('../local-shadows.js');
const S=SphereSites,base={...M.defaultState(),collection:true},near=(a,b,e=1e-6)=>assert(Math.abs(a-b)<e,`${a} differs from ${b}`);
let checks=0;
for(const radius of [1e7,M.AU,1e9])for(const normal of [[0,0,1],M.norm([1,2,-3]),[0,1,0]]){
 const origin=M.mul(normal,radius-1),basis=S.shellFrame(normal),mesh=new S.Mesh(origin,basis,'shadow fixture');mesh.box([0,.01,0],[.12,.02,.12],[.1,.1,.1]);mesh.box([0,.1,0],[.04,.02,.04],[.1,.1,.1]);mesh.finish();
 const s={...base,radius,position:mesh.world([0,.25,.15]),forward:M.norm(M.sub(origin,mesh.world([0,.25,.15])))},plan=SphereShadowPlan(s,[mesh],2048);
 assert(plan);near(M.dot(plan.ray,plan.right),0,1e-12);near(M.dot(plan.ray,plan.up),0,1e-12);near(M.length(plan.ray),1,1e-12);
 for(const c of plan.cascades){assert(c.casters.includes(mesh));assert(M.length(c.relative)<20);const axes=[plan.right,plan.up,plan.ray],local=[.011,.006,-.017],world=mesh.world(local),offset=axes.map(a=>M.dot(M.sub(mesh.origin,c.centre),a));
  const gpuLike=axes.map((a,i)=>offset[i]+mesh.basis.reduce((t,b,j)=>t+local[j]*M.dot(b,a),0));const reference=axes.map(a=>M.dot(M.sub(world,c.centre),a));gpuLike.forEach((v,i)=>near(v,reference[i],2e-7));checks++;
 }
 assert.equal(SphereShadowPlan({...s,position:mesh.world([0,1000,0])},[mesh]),null);
}
for(const quality of [0,1,2])for(const richMaterials of [false,true]){const s={...base,localShadows:quality,richMaterials},saved=M.validate(M.sceneRecord(s).state);assert.equal(saved.localShadows,quality);assert.equal(saved.richMaterials,richMaterials);}
for(const localShadows of [-1,.5,3,NaN])assert.throws(()=>M.validate({...base,localShadows}));assert.throws(()=>M.validate({...base,richMaterials:'yes'}));
console.log(`PASS ${checks} local shadow transforms across radii/orientations, caster inclusion, bounded range, quality validation and material scene restoration.`);
