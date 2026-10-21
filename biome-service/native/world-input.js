/* Exact byte intake for prospective native worlds. It holds the input and the
 * genuine complete-view/support parents together; it owns no arrival commit. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('../metadata-budget.js'):null),Intake=root.SphereBiomeOwnedRecordIntake||(node?require('../owned-record-intake.js'):null),N=root.SphereBiomeNativeHostCoordinator||(node?require('./host-coordinator.js'):null),Sources=root.SphereBiomeNativeSourceAdmission||(node?require('./source-admission.js'):null);
const FORMAT='sphere-biome-native-world-input-profile/1',INPUT_FORMAT='sphere-biome-prospective-input/1',MAX_VIEWS=128,owners=new WeakSet(),DIRECT=Object.freeze(['biome-service/metadata-budget.js','biome-service/native/host-coordinator.js','biome-service/native/source-admission.js','biome-service/native/world-input.js','biome-service/owned-record-intake.js','biome-service/records.js']);
function fail(code,message){throw R.error(code,message,{},'native-world-input');}
function data(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))||keys&&Object.keys(value).sort().join('|')!==keys.slice().sort().join('|'))fail('INVALID_REQUEST','Exact ordinary data fields required');return value;}
function abort(signal){if(signal?.aborted)fail('CANCELLED','Prospective world input cancelled');}
async function create(options){
 data(options,['nativeOwner','metadataOwner','sourceOwner','profileEnvelope','readSource']);
 const {nativeOwner,metadataOwner,sourceOwner,profileEnvelope,readSource}=options;
 if(!Q?.isOwner(metadataOwner)||!Intake||!N?.isOwner(nativeOwner)||!nativeOwner.usesMetadataOwner?.(metadataOwner)||!nativeOwner.usesSourceOwner?.(sourceOwner)||!Sources?.isSourceOwner(sourceOwner)||!sourceOwner.usesMetadataOwner(metadataOwner)||typeof readSource!=='function')fail('FOREIGN_OWNER','The authentic common metadata, source and native coordinator owners are required');
 if(nativeOwner.inspect().disposed)fail('OWNER_DISPOSED','The complete-view coordinator is disposed');
 const source=await Sources.admit({profileEnvelope,readSource,metadataOwner,sourceOwner,owner:'biome-native-world-input',phase:'source-admission',extraBytes:65536});
 let intake;
 try{
  const p=data(source.profile.body,['format','id','coordinatorProfileRef','recordLimits','maximumViews','closure']);
  data(p.coordinatorProfileRef,['id','digest']);data(p.recordLimits,['maxBytes','maxNodes','maxDepth']);
  if(p.format!==FORMAT||p.id!=='root-native-world-input-v1'||p.maximumViews!==MAX_VIEWS||p.coordinatorProfileRef.id!==nativeOwner.profileEnvelope.body.id||p.coordinatorProfileRef.digest!==nativeOwner.profileEnvelope.digest||p.recordLimits.maxBytes!==Intake.MAX_BYTES||p.recordLimits.maxNodes!==Intake.MAX_NODES||p.recordLimits.maxDepth!==Intake.MAX_DEPTH)fail('SOURCE_PROFILE_MISMATCH','Exact coordinator and unchanged record limits required');
  const rows=new Map(p.closure.map(row=>[row.path,row]));
  for(const path of DIRECT)if(!rows.has(path))fail('SOURCE_PROFILE_MISMATCH','The complete owned-input dependency closure is required');
  for(const row of nativeOwner.profileEnvelope.body.closure){const own=rows.get(row.path);if(!own||own.bytes!==row.bytes||own.sha256!==row.sha256)fail('SOURCE_PROFILE_MISMATCH','Input and coordinator must pin one coherent complete source closure');}
  intake=Intake.create({metadataOwner});
 }catch(error){source.charge.release();throw error;}
 const leases=new Map(),observations=new Map(),readers=new Set();let busy=false,disposed=false;
 function alive(){if(disposed)fail('OWNER_DISPOSED','Prospective world input owner disposed');}
 function get(key){alive();const s=leases.get(key);if(!s)fail('STALE_LEASE','Unknown or released owned native input');return s;}
 async function prepareViewBytes(bytes,{signal}={}){
  alive();abort(signal);if(busy)fail('PREPARATION_BUSY','One owned native input is preparing');if(leases.size>=MAX_VIEWS)fail('RESOURCE_LIMIT','Owned prospective view cap reached');busy=true;
  let handle,reader,nativeLease,charge;
  try{
   // No enumeration, getter, serializer or copy of caller objects. Native
   // typed-array getters determine length; authentic Q precedes byte copying.
   handle=intake.admitBytes(bytes);reader=intake.borrow(handle);
   const input=data(reader.value,['format','viewEnvelope','demand','targetRequest']);
   if(input.format!==INPUT_FORMAT)fail('INVALID_REQUEST','Exact prospective input format required');
   charge=metadataOwner.reserve(4096,{owner:'biome-native-world-input',phase:'prospective-input-handle'});
   nativeLease=await nativeOwner.prepareView({viewEnvelope:input.viewEnvelope,demand:input.demand,targetRequest:input.targetRequest,signal});
   alive();abort(signal);const key=Object.freeze({});
   leases.set(key,{handle,reader,nativeLease,charge,readers:0});return key;
  }catch(error){
   // If genuine native cleanup refuses, preserve both owners for an explicit
   // retry. Never turn uncertain support release into successful disposal.
   if(nativeLease){try{nativeOwner.release(nativeLease);}catch(cleanupError){const key=Object.freeze({});leases.set(key,{handle,reader,nativeLease,charge,readers:0,cleanupPending:true});error.cleanupPending=key;throw error;}}
   reader?.close();if(handle)intake.release(handle);charge?.release();throw error;
  }finally{busy=false;}
 }
 function borrowView(key){
  const s=get(key),input=intake.borrow(s.handle);let native;
  try{native=nativeOwner.borrow(s.nativeLease);let open=true;const reader=Object.freeze({get value(){if(!open)fail('STALE_LEASE','Owned native input reader is closed');get(key);return input.value;},close(){if(!open)return false;nativeOwner.closeBorrow(native);input.close();s.readers--;readers.delete(reader);open=false;return true;}});s.readers++;readers.add(reader);return reader;}
  catch(error){if(native)nativeOwner.closeBorrow(native);input.close();throw error;}
 }
 function borrowPreparedMember(key,regionId){
  const s=get(key),input=intake.borrow(s.handle);let child;
  try{child=nativeOwner.borrowPreparedMember(s.nativeLease,regionId);let open=true;const reader=Object.freeze({get value(){if(!open)fail('STALE_LEASE','Owned prepared member reader is closed');get(key);return child.value;},close(){if(!open)return false;child.close();input.close();s.readers--;readers.delete(reader);open=false;return true;}});s.readers++;readers.add(reader);return reader;}
  catch(error){child?.close();input.close();throw error;}
 }
 function inspectPrepared(key){
  const s=get(key),parent=borrowView(key);let report;
  try{report=nativeOwner.inspectPrepared(s.nativeLease);if(report.viewEnvelope.digest!==parent.value.viewEnvelope.digest)fail('RESOURCE_CORRUPT','Native complete view differs from the exact received input');observations.set(report,parent);return report;}
  catch(error){if(report)nativeOwner.releaseObservation(report);parent.close();throw error;}
 }
 function releaseObservation(report){alive();const parent=observations.get(report);if(!parent)fail('FOREIGN_OWNER','Unknown owned-input observation');nativeOwner.releaseObservation(report);parent.close();observations.delete(report);}
 function withTarget(key,callback){const s=get(key);return nativeOwner.withTarget(s.nativeLease,callback);}
 function prepareArrival(key){const s=get(key);return nativeOwner.prepareArrival(s.nativeLease);}
 function release(key){
  const s=get(key);if(s.readers)fail('OWNER_IN_USE','Owned input, complete-view and prepared readers must close before release');
  nativeOwner.release(s.nativeLease);s.reader.close();intake.release(s.handle);s.charge.release();leases.delete(key);return true;
 }
 function cancel(){alive();nativeOwner.cancel();}
 function dispose(){if(disposed)return;if(busy)fail('PREPARATION_BUSY','Owned input preparation must settle');if(leases.size||readers.size||observations.size)fail('OWNER_IN_USE','Owned prospective inputs and all native readers must release first');intake.dispose();source.charge.release();disposed=true;}
 const owner=Object.freeze({profileEnvelope:source.profile,usesMetadataOwner:value=>value===metadataOwner,usesSourceOwner:value=>value===sourceOwner,prepareViewBytes,inspectPrepared,releaseObservation,borrowView,borrowPreparedMember,withTarget,prepareArrival,release,cancel,dispose,inspect:()=>Object.freeze({views:leases.size,readers:readers.size,observations:observations.size,busy,disposed,input:'AUTHENTIC_PRECHARGED_BYTES_WITH_RETAINED_NATIVE_PARENTS',wholeView:'UNQUALIFIED',fragmentField:'UNQUALIFIED',mainRenderer:'NOT_RUN',nativeSessionAck:'UNQUALIFIED',nativeHeap:'UNMEASURED'})});owners.add(owner);return owner;
}
const api=Object.freeze({FORMAT,INPUT_FORMAT,MAX_VIEWS,DIRECT,create,isOwner:value=>owners.has(value)});root.SphereBiomeNativeWorldInput=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
