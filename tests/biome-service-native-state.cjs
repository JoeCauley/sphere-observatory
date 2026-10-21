'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const H=require('./fixtures/biome-service/native-fixture-helper.cjs'),R=H.R;
const output=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT||process.argv[2];if(!path.isAbsolute(output))throw Error('Fresh absolute output required');
let groups=0,refusals=0;const results=[];
function check(name,fn){fn();groups++;results.push({name,status:'PASS'});}
async function reject(name,fn,code){let caught;try{await fn();}catch(error){caught=error;}assert.equal(caught?.code,code);refusals++;results.push({name,status:'PASS',refusal:code});}
async function main(){await fs.mkdir(output,{recursive:false});
 for(const family of ['open-industry','track-meadow']){
  const recipe=JSON.parse(await fs.readFile(H.fixtureRoot+'/fixture-'+family+'.recipe.json','utf8'));
  const input={format:'sphere-native-fixture-state/1',schemaId:'fixture-state-v1',semanticGeneratorId:recipe.semanticGeneratorId,revision:1,featureFlags:[]};
  const retained=R.clone(input),f=await H.setup({family,persistentState:input});
  try{
   check(family+' exact creation-state codec',()=>assert.equal(R.canonicalJSON(f.instance.snapshotPersistentState()),R.canonicalJSON(retained)));
   input.revision=999;input.featureFlags.push('caller-mutated');
   check(family+' creation caller mutation isolation',()=>assert.equal(R.canonicalJSON(f.instance.snapshotPersistentState()),R.canonicalJSON(retained)));
   const handle=await f.builder.resolveBinding(f.binding.digest),binding=f.builder.inspectBinding(handle),state=await R.envelope({format:'sphere-biome-provider-state/1',regionId:f.assignment.regionId,releaseDigest:f.release.payloadDigest,stateSchemaId:f.manifest.persistence.stateSchemaId,revision:7,data:retained});
   await f.records.putEnvelope(state,{stagingKey:'staging:state-outer-revision7'});
   const ref={regionId:f.assignment.regionId,releaseDigest:f.release.payloadDigest,stateSchemaId:f.manifest.persistence.stateSchemaId,revision:7,digest:state.digest},resolved=await binding.validateProviderState(ref,f.assignment);
   check(family+' exact retained outer revision7',()=>{assert.equal(resolved.digest,state.digest);assert.equal(resolved.body.revision,7);assert.equal(R.canonicalJSON(resolved.body.data),R.canonicalJSON(f.instance.snapshotPersistentState()));});
   await reject(family+' wrong retained outer revision',()=>binding.validateProviderState({...ref,revision:8},f.assignment),'INVALID_PROVIDER_STATE');
   const services=f.resourceHost.createProvider(f.manifest.budgets),qBefore=f.metadataOwner.inspect().heldBytes;
   let token=null;
   try{
    token=f.bridge.issueServices({manifest:f.manifest,semanticContext:f.semanticContext,providerServices:services,persistentState:{...retained,revision:2}});
    const factory=require(H.repo+'/biome-service/native/providers/fixture-'+family+'.js');
    await reject(family+' compiled invalid creation-state',()=>factory.configure(f.profile).create(f.recipe,token),'INVALID_PROVIDER_STATE');
   }finally{if(token)f.bridge.releaseServices(token);services.dispose();}
   check(family+' rejected creation-state holder cleanup',()=>assert.equal(f.metadataOwner.inspect().heldBytes,qBefore));
   const services2=f.resourceHost.createProvider(f.manifest.budgets);let invoked=0;
   try{
    const bad={...retained};Object.defineProperty(bad,'revision',{enumerable:true,get(){invoked++;return 1;}});
    await reject(family+' state accessor refusal before invocation',()=>f.bridge.issueServices({manifest:f.manifest,semanticContext:f.semanticContext,providerServices:services2,persistentState:bad}),'INVALID_DESCRIPTOR');
    check(family+' state accessor not invoked',()=>assert.equal(invoked,0));
    check(family+' state accessor holder cleanup',()=>assert.equal(f.metadataOwner.inspect().heldBytes,qBefore));
   }finally{services2.dispose();}
  }finally{f.close();}
  check(family+' final provider state ownership zero',()=>assert.equal(f.metadataOwner.inspect().heldBytes,0));
 }
 const files=['biome-service/native/provider-host.js','biome-service/native/source-admission.js','tests/fixtures/biome-service/native-fixture-helper.cjs','tests/biome-service-native-state.cjs'];
 const manifest=[];for(const file of files){const b=new Uint8Array(await fs.readFile(path.join(H.repo,file)));manifest.push({path:path.join(H.repo,file),sha256:await R.sha256(b),bytes:b.length});}
 const report={format:'sphere-native-state-handoff-component-result/1',status:'PASS_SCOPED_COMPONENT',groups,refusals,results,manifest,scope:{actualMainRestore:'NOT_RUN',coordinatorPreparedContextReuse:'NOT_RUN',gpu:'INSTRUMENTED_BUFFER_BACKEND_NOT_GPU',physicalHeap:'UNMEASURED',sourceAdmission:'ACTUAL_REPOSITORY_COMPONENT_ONLY',providerABI:'sphere-biome-provider/1 unchanged; state supplied through creation host services'}};
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,groups,refusals,output}));
}
main().catch(async error=>{const report={status:'FAIL',groups,refusals,error:{code:error.code,message:error.message,stack:error.stack},results};try{await fs.writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}catch{}console.error(error);process.exitCode=1;});
