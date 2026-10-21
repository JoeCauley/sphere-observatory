'use strict';

// Composed P04 metadata tests. Direct database mutation here represents retained
// data already missing/corrupt before preflight; it is not an admitted writer.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const syncFs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const H=require('./fixtures/biome-service/p04-binding-helper.cjs');
const R=H.R;
const V=require('../biome-service/view-envelope.js');
const P=require('../biome-service/publication.js');
const X=require('../biome-service/spatial-index.js');
const repository=path.join(__dirname,'..');

function sourceSnapshot(){
 const rows=[];
 function add(relative){const bytes=syncFs.readFileSync(path.join(repository,relative));rows.push({path:relative.replace(/\\/g,'/'),bytes:bytes.length,sha256:sha(bytes)});}
 function walk(relative){for(const item of syncFs.readdirSync(path.join(repository,relative),{withFileTypes:true})){const child=path.join(relative,item.name);if(item.isDirectory())walk(child);else if(/\.(js|cjs|json|html)$/.test(item.name))add(child);}}
 walk('biome-service');walk('tests/fixtures/biome-service');
 for(const name of syncFs.readdirSync(repository))if(/\.js$/.test(name))add(name);
 for(const name of syncFs.readdirSync(__dirname))if(/^biome-service.*\.(cjs|js|html)$/.test(name))add(path.join('tests',name));
 add('package.json');add('package-lock.json');add('node_modules/fake-indexeddb/package.json');
 return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function serial(value){
 if(value instanceof ArrayBuffer)return {format:'sphere-test-exact-bytes-summary/1',byteLength:value.byteLength,sha256:sha(new Uint8Array(value))};
 if(ArrayBuffer.isView(value))return {format:'sphere-test-exact-bytes-summary/1',byteLength:value.byteLength,sha256:sha(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
 if(Array.isArray(value))return value.map(serial);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,serial(item)]));
 return value;
}
async function snapshot(storage){
 const stores={};
 for(const store of storage.stores){const keys=await storage.getAllKeys(store),rows=[];for(const key of keys)rows.push({key,value:serial(await storage.get(store,key))});stores[store]=rows;}
 return stores;
}
async function pointers(storage,worldId){return {worldHead:await storage.get('worldHeads',worldId),sessionHeads:await storage.getAll('sessionHeads')};}
async function open(suffix,indexedDB){
 const env=await H.setup({suffix,...(indexedDB?{indexedDB}:{})});
 const views=V.create({math:global.SphereMath,bindingOwner:env.builder});
 const publisher=P.create({storage:env.storage,builderOwner:env.builder,viewCodec:views,recordStore:env.records});
 let closed=false;
 return {env,views,publisher,close(){if(closed)return;publisher.dispose();views.dispose();env.close();closed=true;}};
}
async function departure(owner,operationId){
 const coreScene=global.SphereMath.validate({...global.SphereMath.defaultState(),collection:true,playing:false});
 const view=await owner.views.prepare({format:V.FORMAT,coreScene,biomeView:null});
 await owner.publisher.stageView(view.digest,{stagingKey:'staging:'+operationId});
 return view;
}
async function planned(owner,{payload,operationId,requestKey,sessionId,previousBindingEnvelope,expectedHead=null,expectedSessionHead=null}){
 const view=await departure(owner,operationId);
 const allocationTicket=await owner.env.builder.planAllocation({...owner.env.input,operationId,requestKey,releaseDigest:payload.payloadDigest,...(previousBindingEnvelope?{previousBindingEnvelope}:{})});
 assert(!allocationTicket.status,'Source-qualified allocation did not produce an authentic ticket');
 return {view,prepare:()=>owner.env.builder.prepare({allocationTicket,expectedHead,callerSession:{sessionId,expectedHead:expectedSessionHead},departureViewRef:{digest:view.digest},viewOwner:owner.views})};
}
async function targets(owner,summary,payload){
 const plan=await owner.env.records.getEnvelope(summary.planDigest);
 const binding=await owner.env.records.getEnvelope(summary.bindingDigest);
 const assignment=binding.body.assignments.find(a=>a.releaseDigest===payload.payloadDigest);
 assert(assignment,'Prepared exact release has no assignment');
 const selected=[{name:'index',digest:binding.body.index.digest,kind:'raw'},{name:'proof',digest:assignment.area.certificateDigest,kind:'record-envelope'},{name:'recipe',digest:payload.manifest.assets[0].sha256,kind:'raw'}];
 for(const target of selected){
  if(target.name==='proof'){
   const aggregate=await owner.env.records.getEnvelope(plan.body.proofs.area);
   assert(plan.body.requiredResourceDigests.includes(aggregate.digest),'Plan does not pin its exact area aggregate');
   assert.equal(aggregate.body.kind,'area');assert(aggregate.body.childRecordDigests.includes(target.digest),'Area aggregate lost its named original certificate');
   let found;
   for(const ref of aggregate.body.bundles){const bundle=await owner.env.records.getEnvelope(ref.digest);assert.equal(bundle.body.kind,'area');assert.equal(bundle.body.entries.length,ref.entryCount);for(const entry of bundle.body.entries)if(entry.certificate.digest===target.digest){assert(!found,'Named original certificate occurs twice in area bundles');assert.equal(entry.assignmentDigest,(await R.envelope(assignment)).digest);await R.verifyEnvelope(entry.certificate);const original=await owner.env.records.getEnvelope(target.digest);assert.deepEqual(original,entry.certificate,'Bundle certificate is not the exact original child record');found={aggregateDigest:aggregate.digest,bundleDigest:bundle.digest,childDigest:original.digest};}}
   assert(found,'Exact child proof cannot resolve through the pinned aggregate/bundle');target.pinnedVia=found;
  }else assert(plan.body.requiredResourceDigests.includes(target.digest),'Prepared plan does not pin '+target.name);
  const row=await owner.env.storage.get('resources',target.digest);assert(row&&row.kind===target.kind&&row.bytes.byteLength>0,'Exact '+target.name+' resource is absent/wrong-kind before fault');
 }
 return {plan,binding,selected};
}
async function damage(storage,target,mode){
 const original=await storage.get('resources',target.digest);
 assert(original&&original.bytes instanceof ArrayBuffer&&original.bytes.byteLength>0);
 let changed;
 await storage.transaction(['resources'],'readwrite',ctx=>{
  if(mode==='missing')ctx.store('resources').delete(target.digest);
  else{const bytes=new Uint8Array(original.bytes.slice(0));bytes[0]^=1;changed={...original,bytes:bytes.buffer};ctx.store('resources').put(changed,target.digest);}
 });
 return {original,changed};
}
async function restore(storage,target,original){await storage.transaction(['resources'],'readwrite',ctx=>ctx.store('resources').put(original,target.digest));}

async function main(){
 const output=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;
 assert(output&&path.isAbsolute(output),'Set a fresh absolute SPHERE_BIOME_SERVICE_TEST_OUTPUT; this test retains its attempts');
 await fs.mkdir(output,{recursive:false});
 const write=(relative,value)=>fs.writeFile(path.join(output,relative),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const sourceBefore=sourceSnapshot();await write('source-before.json',sourceBefore);
 const report={format:'sphere-biome-publication-dependency-component-tests/1',startedUtc:new Date().toISOString(),status:'RUNNING',groups:[],refusals:[],cases:[],databaseIdentities:[],qualification:{nativeIndexedDB:'NOT_RUN',nativeMultiTab:'NOT_RUN',nativeProvider:'NONNATIVE_NUMERICAL_COMPONENT',mainRenderer:'NOT_RUN',fullConformance:'NOT_RUN',sessionPersistence:'NOT_RUN_POINTER_CAS_TOKEN_ONLY',quietTiming:'UNMEASURED',nativeHeap:'UNMEASURED'},environment:{node:process.version,v8:process.versions.v8,engine:'fake-indexeddb',version:JSON.parse(syncFs.readFileSync(path.join(repository,'node_modules/fake-indexeddb/package.json'),'utf8')).version},scope:'Actual admitted host/allocation/binding/view/publication/resource owners in isolated fake IndexedDB. Missing/corrupt bytes exist before preflight. No native installation, session restore, hostile writer gap or performance claim.'};
 const owners=new Set();
 async function opened(suffix,indexedDB){const owner=await open(suffix,indexedDB);owners.add(owner);report.databaseIdentities.push({databaseName:owner.env.databaseName,worldId:owner.env.input.snapshot.worldId,hostWorldDigest:owner.env.input.hostWorldEnvelope.digest,hostProfileDigest:owner.env.world.adapter.profileEnvelope.digest,preparationProfileDigest:owner.env.builder.profileEnvelope.digest});return owner;}
 async function refusal(name,run,expected){let observed;await assert.rejects(run,error=>{observed={code:error.code||error.name,message:error.message};return observed.code===expected;});report.refusals.push({name,expectedCode:expected,...observed,status:'PASS'});return observed;}
 function pass(name,details={}){report.groups.push({name,status:'PASS',...details});}
 try{
  const first=await opened('publication-dependencies-precommit-'+Date.now());
  const initial=await first.env.payload({packId:'dependency-base-pack'}),firstPlan=await planned(first,{payload:initial,operationId:'dependencies-base-install',requestKey:'dependencies-base-request',sessionId:'dependencies-base-session'}),initialReceipt=await first.publisher.publishPrepared(await firstPlan.prepare());
  await first.publisher.acknowledgeActivation('dependencies-base-session',initialReceipt.operationId);
  const oldBinding=await first.env.storage.get('worldBindings',initialReceipt.newHead.bindingDigest),nextPayload=await first.env.payload({packId:'dependency-next-pack'});
  // A non-null independently retained compare token exercises the separate
  // session-head CAS. It deliberately does not pretend to be a P07 session.
  const token=await R.envelope({format:'sphere-biome-test-session-cas-token/1',bindingDigest:oldBinding.digest,value:4}),expectedSessionHead={sessionDigest:token.digest,stateRevision:4};
  await first.env.storage.transaction(['sessions','sessionHeads'],'readwrite',ctx=>{ctx.store('sessions').put(token,'dependencies-caller:4');ctx.store('sessionHeads').put(expectedSessionHead,'dependencies-caller');});
  const candidate=await planned(first,{payload:nextPayload,operationId:'dependencies-next-install',requestKey:'dependencies-next-request',sessionId:'dependencies-caller',previousBindingEnvelope:oldBinding,expectedHead:initialReceipt.newHead,expectedSessionHead});
  for(const name of ['proof','index','recipe'])for(const mode of ['missing','corrupt']){
   const ticket=await candidate.prepare(),summary=first.env.builder.inspectPrepared(ticket),resolved=await targets(first,summary,nextPayload),target=resolved.selected.find(item=>item.name===name),prefix='precommit-'+name+'-'+mode;
   const originalPointers=await pointers(first.env.storage,first.env.input.snapshot.worldId),{original,changed}=await damage(first.env.storage,target,mode),before=await snapshot(first.env.storage);
   await write(prefix+'-before.json',before);await fs.writeFile(path.join(output,prefix+'-resource-before.bin'),new Uint8Array(original.bytes),{flag:'wx'});if(changed)await fs.writeFile(path.join(output,prefix+'-resource-corrupt.bin'),new Uint8Array(changed.bytes),{flag:'wx'});
   const error=await refusal(prefix,()=>first.publisher.publishPrepared(ticket),mode==='missing'?'RESOURCE_MISSING':'RESOURCE_CORRUPT');
   const after=await snapshot(first.env.storage);await write(prefix+'-after.json',after);assert.deepEqual(after,before,'Refusal modified a retained store');assert.deepEqual(await pointers(first.env.storage,first.env.input.snapshot.worldId),originalPointers,'Refusal changed world/session pointers');assert.equal(await first.env.storage.get('operations','dependencies-next-install'),undefined,'Failed publication wrote a journal');assert.equal(await first.env.storage.get('worldBindings',summary.bindingDigest),undefined,'Failed publication exposed a proposed binding');assert.equal(first.publisher.inspect().heldBytes,0,'Preflight refusal leaked publication metadata');assert.equal(first.env.builder.inspect().borrowedPrepared,0,'Preflight refusal leaked its authentic ticket borrow');
   await write(prefix+'-evidence.json',{target,mode,summary,error,originalPointers,allStoresExactBeforeAfter:true,resourceReplacementWritten:false,originalBytesSha256:sha(new Uint8Array(original.bytes))});report.cases.push({phase:'prepared-existing-world',name,mode,target,error,allStoresExactBeforeAfter:true,worldAndSessionHeadsExact:true,status:'PASS'});
   await restore(first.env.storage,target,original);
  }
  pass('Authentic existing-world publication refuses six exact staged proof/index/recipe faults without changing any retained store or separate world/session heads',{cases:6});
  const good=await first.publisher.publishPrepared(await candidate.prepare());assert.equal(good.newHead.revision,2);const combined=await first.env.storage.get('worldBindings',good.newHead.bindingDigest);for(const assignment of oldBinding.body.assignments)assert.deepEqual(combined.body.assignments.find(a=>a.regionId===assignment.regionId),assignment);pass('Restoring exact fixture before-images permits the original authentic prepared request without replacing prior assignments');
  first.close();assert.equal(X.inspectAggregate().heldBytes,0);

  const suffix='publication-dependencies-recovery-'+Date.now(),committing=await opened(suffix),payload=await committing.env.payload({packId:'dependency-recovery-pack'}),operationId='dependencies-recovery-install',requestKey='dependencies-recovery-request',sessionId='dependencies-recovery-session',prepared=await planned(committing,{payload,operationId,requestKey,sessionId}),ticket=await prepared.prepare(),summary=committing.env.builder.inspectPrepared(ticket),resolved=await targets(committing,summary,payload),receipt=await committing.publisher.publishPrepared(ticket),factory=committing.env.indexedDB,committedWorldId=committing.env.input.snapshot.worldId,committedHostDigest=committing.env.input.hostWorldEnvelope.digest;
  await write('committed-recovery-inputs.json',{receipt,plan:resolved.plan,binding:resolved.binding,targets:resolved.selected,hostWorldEnvelope:committing.env.input.hostWorldEnvelope,policyEnvelope:committing.env.input.policyEnvelope});committing.close();assert.equal(X.inspectAggregate().heldBytes,0,'Committing owners remained resident after close');
  for(const name of ['proof','index','recipe'])for(const mode of ['missing','corrupt']){
   const reopened=await opened(suffix,factory);assert.equal(reopened.env.input.snapshot.worldId,committedWorldId);assert.equal(reopened.env.input.hostWorldEnvelope.digest,committedHostDigest);
   const target=resolved.selected.find(item=>item.name===name),prefix='recovery-'+name+'-'+mode,originalPointers=await pointers(reopened.env.storage,committedWorldId),{original,changed}=await damage(reopened.env.storage,target,mode),before=await snapshot(reopened.env.storage);
   await write(prefix+'-before.json',before);await fs.writeFile(path.join(output,prefix+'-resource-before.bin'),new Uint8Array(original.bytes),{flag:'wx'});if(changed)await fs.writeFile(path.join(output,prefix+'-resource-corrupt.bin'),new Uint8Array(changed.bytes),{flag:'wx'});
   const error=await refusal(prefix,()=>reopened.publisher.recoverPending(sessionId),mode==='missing'?'RESOURCE_MISSING':'RESOURCE_CORRUPT');
   const after=await snapshot(reopened.env.storage);await write(prefix+'-after.json',after);assert.deepEqual(after,before,'Failed recovery regenerated/replaced a retained record');assert.deepEqual(await pointers(reopened.env.storage,committedWorldId),originalPointers,'Failed recovery changed world/session heads or activation intent');assert.equal(originalPointers.worldHead.bindingDigest,receipt.newHead.bindingDigest);assert.equal((await reopened.env.storage.get('sessionHeads','activation-pending:'+sessionId)).status,'pending','Failed recovery acknowledged activation');
   await write(prefix+'-evidence.json',{target,mode,error,receipt,originalPointers,allStoresExactBeforeAfter:true,resourceReplacementWritten:false,automaticActivationAcknowledged:false});report.cases.push({phase:'committed-owner-reopen',name,mode,target,error,allStoresExactBeforeAfter:true,worldAndSessionHeadsExact:true,status:'PASS'});
   await restore(reopened.env.storage,target,original);reopened.close();assert.equal(X.inspectAggregate().heldBytes,0,'Refused recovery retained disposed owner resources');
  }
  pass('Fresh owners on the same retained database refuse six committed proof/index/recipe faults without regeneration, journal replacement or activation acknowledgement',{cases:6});
  const recovered=await opened(suffix,factory),recovery=await recovered.publisher.recoverPending(sessionId);assert.equal(recovery.intent.bindingDigest,receipt.newHead.bindingDigest);assert.equal(recovery.receipt.planDigest,receipt.planDigest);assert.equal(recovery.automaticCruise,false);assert.equal(recovered.env.builder.inspectBinding(recovery.bindingHandle).bindingEnvelope.digest,receipt.newHead.bindingDigest);await write('exact-restored-recovery.json',{intent:recovery.intent,receipt:recovery.receipt,departureViewDigest:recovery.departureView.digest,automaticCruise:recovery.automaticCruise});recovered.close();assert.equal(X.inspectAggregate().heldBytes,0);pass('Exact before-image restoration and another owner reopen recover the original committed identity with automatic cruise stopped');
  pass('Every authentic preparation/recovery owner and index is disposed without retained component charge');
  const sourceAfter=sourceSnapshot();await write('source-after.json',sourceAfter);assert.deepEqual(sourceAfter,sourceBefore,'Source changed during composed dependency tests; retain and rerun the failed attempt');report.sourceIntegrity={status:'PASS',entries:sourceBefore.length};report.status='PASS';report.completedUtc=new Date().toISOString();await write('publication-dependency-tests.json',report);await write('source-manifest.json',sourceBefore);console.log(JSON.stringify({status:'PASS',groups:report.groups.length,faultCases:report.cases.length,refusals:report.refusals.length,sourceEntries:sourceBefore.length}));
 }catch(error){report.status='FAIL';report.completedUtc=new Date().toISOString();report.error={name:error.name,code:error.code,message:error.message,stack:error.stack};report.sourceAfter=sourceSnapshot();await write('failed-attempt.json',report);throw error;}
 finally{for(const owner of owners)owner.close();}
}

main().catch(error=>{console.error(error.stack);process.exitCode=1;});
