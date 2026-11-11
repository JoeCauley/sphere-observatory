'use strict';
// Cross-version owner controls use an actual original fixture, binding and K.
// The positive preparation-v2 path is separately exercised in ordinary Main GL.
const assert=require('node:assert/strict'),F=require('./fixtures/biome-service/native-fixture-helper.cjs');
async function main(){
 const f=await F.setup({family:'track-meadow'}),Kernel=require('../biome-service/native/surface-kernel.v2.js'),Provider=require('../biome-service/native/provider-host.v2.js'),Field=require('../biome-service/native/local-field.v2.js'),Binding=require('../biome-service/binding-builder.v2.js');
 assert.equal(Binding.isOwner(f.builder),false);
 await assert.rejects(()=>Kernel.create({bindingOwner:f.builder,hostProfileEnvelope:f.world.adapter.profileEnvelope,readSource:f.readSource,releaseStore:f.releaseStore,metadataOwner:f.metadataOwner}),e=>e.code==='UNVERIFIED_BINDING');
 await assert.rejects(()=>Kernel.create({bindingOwner:{...f.builder},hostProfileEnvelope:f.world.adapter.profileEnvelope,readSource:f.readSource,releaseStore:f.releaseStore,metadataOwner:f.metadataOwner}),e=>e.code==='UNVERIFIED_BINDING');
 assert.throws(()=>Provider.createBridge({kernel:f.kernel,resourceHost:f.resourceHost,metadataOwner:f.metadataOwner}),e=>e.code==='FOREIGN_OWNER');
 await assert.rejects(()=>Field.create({}),e=>e.code==='FOREIGN_OWNER');
 const original=f.kernel.sample(f.semanticContext,[{xM:-96,yM:-32},{xM:0,yM:96},{xM:96,yM:-32}]);assert.deepEqual(original.map(v=>v.heightM),[2,3,4]);
 const factory=F.load('biome-service/native/providers/fixture-track-meadow.js'),changed=F.R.clone(f.recipe);factory.validateRecipe(f.recipe,f.manifest);changed.terrain.landmarks[0].xM+=4;assert.throws(()=>factory.validateRecipe(changed,f.manifest),e=>e.code==='INVALID_RECIPE');
 f.close();assert.equal(f.metadataOwner.inspect().heldBytes,0);
 console.log(JSON.stringify({status:'PASS',checks:7,scope:'Genuine original owners cannot be relabeled as v2; forged binding, changed fixed recipe and raw local field refuse; original semantic heights and complete disposal preserved; positive native Main evidence separate'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
