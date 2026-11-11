'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{IDBFactory}=require('fake-indexeddb');
const H=require('./fixtures/biome-service/p04-binding-helper-v2.cjs'),B=H.B,V=require('../biome-service/view-envelope.js'),P=require('../biome-service/publication.v2.js');
const groups=[],observations=[];const pass=(name,details={})=>groups.push({name,status:'PASS',...details});
async function owners(env){const view=V.create({math:global.SphereMath,bindingOwner:env.builder,reserveMetadata:(n,phase)=>env.metadataOwner.reserve(n,{owner:'handoff-test-view',phase})}),publisher=P.create({storage:env.storage,builderOwner:env.builder,viewCodec:view,recordStore:env.records,reserveMetadata:(n,details)=>env.metadataOwner.reserve(n,details)});const departure=await view.prepare({format:V.FORMAT,coreScene:global.SphereMath.validate({...global.SphereMath.defaultState(),collection:true,playing:false}),biomeView:null});return {view,publisher,departure,close(){publisher.dispose();view.dispose();env.close();}};}
async function allocation(env,payload,operationId,options={}){return env.builder.planAllocation({...env.input,operationId,requestKey:operationId+'-request',releaseDigest:payload.payloadDigest},options);}
async function prepare(env,o,ticket,operationId,options={}){await o.publisher.stageView(o.departure.digest,{stagingKey:'staging:'+operationId});return env.builder.prepare({allocationTicket:ticket,expectedHead:null,callerSession:{sessionId:operationId+'-session',expectedHead:null},departureViewRef:{digest:o.departure.digest},viewOwner:o.view},options);}
async function run(){
 const output=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;if(output){if(!path.isAbsolute(output))throw Error('Absolute fresh evidence path required');await fs.mkdir(output,{recursive:false});}
 let completeHeadReads=0;
 const env=await H.setup({suffix:'handoff-negative-'+Date.now(),checkpointTransform:cp=>({...cp,async head(input){const d=await cp.head(input);if(d&&(await cp.get(d)).body.state.status==='COMPLETE'&&++completeHeadReads===2)return '0'.repeat(64);return d;}})}),o=await owners(env);
 try{
  const release=await env.payload({packId:'handoff-recipient-pack'}),operationId='handoff-recipient-install';
  await assert.rejects(()=>allocation(env,release,operationId),e=>e.code==='INVALID_HANDOFF');
  assert.equal(env.builder.inspect().liveAllocators,1);assert.equal(env.builder.inspect().ownership.handoffCount,0);assert(env.metadataOwner.inspect().owners.some(x=>x.name==='biome-allocator'));assert.equal(await env.storage.get('worldHeads',env.input.snapshot.worldId),undefined);
  pass('Wrong durable head refuses handoff while the source remains charged and no world is published');
  const ticket=await allocation(env,release,operationId),ownership=env.builder.inspect().ownership,receipt=ownership.lastHandoff;
  assert.equal(env.builder.inspect().liveAllocators,0);assert.equal(env.builder.inspect().livePlannerControls,0);assert.equal(receipt.senderRetired,true);assert(receipt.senderStatistics.heldRequestedBytes>0);assert(receipt.budgetAtOverlap.owners.some(x=>x.name==='biome-allocator'));assert(!receipt.budgetAfterRetirement.owners.some(x=>x.name==='biome-allocator'));assert(receipt.budgetAtOverlap.owners.some(x=>x.name==='biome-binding-builder'));assert(receipt.budgetAtOverlap.peakBytes<=33554432);observations.push(receipt);
  pass('A correct exact retry pays recipient and checkpoint overlap before retiring every allocator lease');
  const baseline=env.metadataOwner.inspect().heldBytes;
  await assert.rejects(()=>prepare(env,o,ticket,operationId,{signal:AbortSignal.abort()}),e=>e.code==='CANCELLED');
  assert.equal(env.metadataOwner.inspect().heldBytes,baseline);assert.equal(env.builder.inspect().liveAllocators,0);
  pass('Cancellation after the handoff releases checkpoint read work while preserving the recipient');
  const prepared=await prepare(env,o,ticket,operationId);
  await assert.rejects(()=>o.publisher.publishPrepared(prepared,{signal:AbortSignal.abort()}),e=>e.code==='CANCELLED');assert.equal(await env.storage.get('worldHeads',env.input.snapshot.worldId),undefined);
  const committed=await o.publisher.publishPrepared(prepared);assert.equal(committed.durable,true);const exact=await env.storage.get('worldBindings',committed.newHead.bindingDigest);assert.equal(exact.body.assignments.length,1);
  pass('Preparation reads durable proofs after sender retirement; pre-publication cancellation leaves a retryable ticket');
  const retryTicket=await allocation(env,release,operationId),retryPrepared=await prepare(env,o,retryTicket,operationId),retry=await o.publisher.publishPrepared(retryPrepared);assert.equal(retry.idempotent,true);assert.deepEqual(retry.newHead,committed.newHead);assert.equal((await env.storage.getAllKeys('worldHeads')).length,1);
  pass('A newly constructed allocator recovers the exact completed checkpoint and retry publishes no duplicate');
 }finally{o.close();assert.equal(env.metadataOwner.inspect().heldBytes,0);}
 pass('All failed-source, recipient, index and view reservations close to zero');
 const indexedDB=new IDBFactory(),suffix='handoff-cancel-'+Date.now(),cancel=new AbortController();let checkpointDigest=null,completeReads=0;
 const cancelledEnv=await H.setup({suffix,indexedDB,checkpointTransform:cp=>({...cp,async head(input){const d=await cp.head(input);if(d&&(await cp.get(d)).body.state.status==='COMPLETE'&&++completeReads===2){checkpointDigest=d;cancel.abort();}return d;}})});
 try{const release=await cancelledEnv.payload({packId:'handoff-cancel-pack'});await assert.rejects(()=>allocation(cancelledEnv,release,'handoff-cancel-install',{signal:cancel.signal}),e=>e.code==='CANCELLED');assert(checkpointDigest);assert.equal(cancelledEnv.builder.inspect().ownership.handoffCount,0);assert.equal(cancelledEnv.builder.inspect().liveAllocators,1);assert(cancelledEnv.metadataOwner.inspect().owners.some(x=>x.name==='biome-allocator'));assert.equal(await cancelledEnv.storage.get('worldHeads',cancelledEnv.input.snapshot.worldId),undefined);pass('Cancellation during handoff keeps the completed source paid until disposal and preserves its durable checkpoint');}finally{cancelledEnv.close();assert.equal(cancelledEnv.metadataOwner.inspect().heldBytes,0);}
 const resumed=await H.setup({suffix,indexedDB});try{const release=await resumed.payload({packId:'handoff-cancel-pack'});await allocation(resumed,release,'handoff-cancel-install');assert.equal(resumed.builder.inspect().ownership.lastHandoff.checkpointDigest,checkpointDigest);assert.equal(resumed.builder.inspect().liveAllocators,0);pass('A new owner retries a cancelled handoff from the unchanged durable result');}finally{resumed.close();assert.equal(resumed.metadataOwner.inspect().heldBytes,0);}
 assert.equal(require('../biome-service/spatial-index.js').inspectAggregate().heldBytes,0);
 const report={format:'sphere-allocation-handoff-tests/1',status:'PASS',groups,observations,physicalMemory:'UNMEASURED',scope:'AUTHENTIC_V2_BINDING_RECORD_CHECKPOINT_AND_BUDGET_OWNERS_WITH_ISOLATED_FAKE_INDEXEDDB_NO_BROWSER_PROOF'};if(output)await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,groups:groups.length}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
