/* Completed search -> durable records + a separately charged binding recipient. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null),S=root.SphereBiomeVerifiedRecordStore||(typeof module!=='undefined'?require('./verified-record-store.js'):null),Q=root.SphereBiomeMetadataBudget||(typeof module!=='undefined'?require('./metadata-budget.js'):null),X=root.SphereBiomeSpatialIndex||(typeof module!=='undefined'?require('./spatial-index.js'):null);
const REVISION='durable-allocation-completion-v1';
function fail(code,message,details={}){throw R.error(code,message,details,'allocation-handoff');}
function abort(signal){if(signal?.aborted)fail('CANCELLED','Completed allocation handoff was cancelled');}
function equal(a,b){return R.canonicalJSON(a)===R.canonicalJSON(b);}
function verifyCheckpoint(checkpoint,result){
 const b=checkpoint?.body,s=b?.state;
 if(checkpoint?.digest!==result.checkpointRef.digest||b?.format!=='sphere-biome-allocation-checkpoint/1'||b.allocatorProfileDigest!==result.proposal.body.allocatorProfileDigest||s?.status!=='COMPLETE'||s.inputDigest!==result.proposal.body.inputDigest||s.completed?.proposalDigest!==result.proposal.digest||s.completed?.auditDigest!==result.auditEnvelope.digest||!equal(s.assignments,result.assignments)||!equal(s.work,result.work))fail('INVALID_HANDOFF','Durable completed checkpoint does not identify this exact result');
}
async function transfer({source,stagingStore,checkpointRepository,metadataOwner,reserveRecipient,stagingKey,signal,retire,sourceStatistics}={}){
 if(!source?.planner||!source.result||!S.isOwner(stagingStore)||!Q.isOwner(metadataOwner)||!checkpointRepository?.head||!checkpointRepository?.get||typeof reserveRecipient!=='function'||typeof retire!=='function')fail('UNSUPPORTED_CONTRACT','Handoff requires authentic record/budget owners and the private completed planner');
 abort(signal);
 const sender=source.planner.inspect();
 if(sender.running||sender.disposed||sender.activeReservationLeases||sender.issuedCheckpoints||sender.retainedProofs||sender.retainedAudits)fail('OWNER_IN_USE','Only a settled planner with external durable proof/checkpoint owners can retire');
 let outcome=source.result;
 if(outcome.status!=='COMPLETE')fail('INVALID_HANDOFF','Only completed allocation work can transfer');
 const checkpointRef={digest:outcome.checkpoint.digest,byteLength:R.canonicalBytes(outcome.checkpoint).byteLength};
 let expected={proposal:outcome.proposal,auditEnvelope:outcome.auditEnvelope,assignments:outcome.assignments,work:outcome.work,checkpointRef};
 verifyCheckpoint(outcome.checkpoint,expected);
 let working,recipient,retired=false;
 try{
  working=reserveRecipient(checkpointRef.byteLength*8+16384,'handoff-checkpoint-overlap');
  // Both the sender and receiver are paid before any ownership changes. The
  // fixed allowance covers the bounded receipt and its two budget observations.
  const recipientBytes=X.metadataBytes({proposal:outcome.proposal,auditEnvelope:outcome.auditEnvelope,assignments:outcome.assignments,work:outcome.work,accounting:outcome.accounting,checkpointRef})+32768;
  recipient=reserveRecipient(recipientBytes,'durable-completion-recipient');
  if(await checkpointRepository.head(outcome.proposal.body.inputDigest)!==checkpointRef.digest)fail('INVALID_HANDOFF','Durable completion is not the latest checkpoint head');
  let checkpoint=await checkpointRepository.get(checkpointRef.digest);
  if(!equal(checkpoint,outcome.checkpoint))fail('RESOURCE_CORRUPT','Durable checkpoint bytes differ from the completed search');
  const proposal=await stagingStore.getEnvelope(outcome.proposal.digest,{signal}),auditEnvelope=await stagingStore.getEnvelope(outcome.auditEnvelope.digest,{signal});
  if(!equal(proposal,outcome.proposal)||!equal(auditEnvelope,outcome.auditEnvelope))fail('RESOURCE_CORRUPT','Durable proposal or audit differs from the completed search');
  await stagingStore.putEnvelope(checkpoint,{stagingKey,signal});
  let staged=await stagingStore.getEnvelope(checkpointRef.digest,{signal});
  if(!equal(staged,checkpoint))fail('RESOURCE_CORRUPT','Prepared readers cannot recover the exact completed checkpoint');
  const handoffEnvelope=await R.envelope({format:'sphere-biome-allocation-handoff/1',revision:REVISION,inputDigest:proposal.body.inputDigest,allocatorProfileDigest:proposal.body.allocatorProfileDigest,checkpointDigest:checkpointRef.digest,proposalDigest:proposal.digest,auditDigest:auditEnvelope.digest,stagingKey,proofReader:'verified-record-store',retryOwner:'checkpoint-store',recipientOwner:'binding-allocation-ticket',recordedBeforeSenderRetirement:true});
  await stagingStore.putEnvelope(handoffEnvelope,{stagingKey,signal});
  const saved=await stagingStore.getEnvelope(handoffEnvelope.digest,{signal});
  if(!equal(saved,handoffEnvelope))fail('RESOURCE_CORRUPT','Durable handoff identity did not retain');
  const compact=R.deepFreeze({status:'COMPLETE',proposal,auditEnvelope,assignments:proposal.body.assignments,work:R.clone(outcome.work),accounting:R.clone(outcome.accounting),checkpointRef,handoffEnvelope,usable:false,published:false});
  const senderStatistics=sourceStatistics?.()??null,budgetAtOverlap=metadataOwner.inspect();
  abort(signal);
  // No receiver borrows the sender's result or checkpoint graph. Drop the
  // working copies before retiring the private search owner. Proof reads below
  // this boundary use S; retries rebuild a planner from CP's durable head.
  checkpoint=null;staged=null;outcome=null;expected=null;
  source.result=null;
  retire();retired=true;
  if(source.planner!==null||source.result!==null)fail('OWNER_IN_USE','The retired sender still has a private caller reference');
  working.release();working=null;
  const receipt=R.deepFreeze({revision:REVISION,inputDigest:proposal.body.inputDigest,checkpointDigest:checkpointRef.digest,proposalDigest:proposal.digest,auditDigest:auditEnvelope.digest,handoffDigest:handoffEnvelope.digest,durableOwner:'IndexedDB:installPlans/checkpoint + resources',recipientOwner:'binding-allocation-ticket',recipientReservationBytes:recipientBytes,senderStatistics,senderRetired:true,remainingSearchReaders:0,budgetAtOverlap,budgetAfterRetirement:metadataOwner.inspect(),physicalMemory:'UNMEASURED'});
  const lease=recipient;recipient=null;return Object.freeze({result:compact,receipt,lease});
 }finally{
  working?.release();recipient?.release();
  // Failed validation/cancellation leaves the original planner in its builder
  // map. A successful retirement leaves only durable records and the receiver.
  if(!retired&&source.planner===null)fail('INVALID_HANDOFF','Sender disappeared before a successful handoff');
 }
}
const api=Object.freeze({REVISION,verifyCheckpoint,transfer});root.SphereBiomeAllocationHandoff=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
