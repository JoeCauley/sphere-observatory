/* Complete paused view snapshots. The legacy core and binding sidecar stay separate. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const FORMAT='sphere-observatory-view/1',MAX_BYTES=16777216,STATE_BYTES=1048576,MAX_METADATA=33554432;
const ID=/^[a-z][a-z0-9-]{2,127}$/,DIGEST=/^[0-9a-f]{64}$/,MOVEMENT=Object.freeze(['manual','terrain-following','level-flight','walking']);
const owners=new WeakSet();
function fail(code,message,details={}){throw R.error(code,message,details,'view');}
function keys(value,required,optional=[]){return value&&Object.getPrototypeOf(value)===Object.prototype&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));}
function check(signal){if(signal?.aborted)fail('CANCELLED','Complete view verification was cancelled');}
function vector(value){return Array.isArray(value)&&value.length===3&&value.every(v=>Number.isFinite(v)&&!Object.is(v,-0))&&Math.abs(Math.hypot(...value)-1)<=1e-12;}
function equal(a,b){return R.canonicalJSON(a)===R.canonicalJSON(b);}
function validateStateRef(ref){if(!keys(ref,['regionId','releaseDigest','stateSchemaId','revision','digest'])||!ID.test(ref.regionId)||!ID.test(ref.stateSchemaId)||!DIGEST.test(ref.releaseDigest)||!DIGEST.test(ref.digest)||!Number.isSafeInteger(ref.revision)||ref.revision<0)fail('INVALID_VIEW','Invalid exact provider state reference');}
function create({math=root.SphereMath||(typeof module!=='undefined'?require('../math.js'):null),bindingOwner,reserveMetadata}={}){
 if(!math?.validate||!math?.defaultState)fail('UNSUPPORTED_CORE_CODEC','The actual existing core codec is required');
 const issued=new Map();let currentOwnedMetadataBytes=0,peakOwnedMetadataBytes=0,closed=false,openBorrows=0;
 function open(){if(closed)fail('DISPOSED','The complete view codec is disposed');}
 function reserve(bytes,label){open();if(currentOwnedMetadataBytes+bytes>MAX_METADATA)fail('RESOURCE_LIMIT','Complete view ownership exceeds service metadata admission',{currentOwnedMetadataBytes,bytes,limit:MAX_METADATA});const external=reserveMetadata?.(bytes,label);if(reserveMetadata&&typeof external?.release!=='function')fail('RESOURCE_LIMIT','The shared metadata owner refused complete view admission');currentOwnedMetadataBytes+=bytes;peakOwnedMetadataBytes=Math.max(peakOwnedMetadataBytes,currentOwnedMetadataBytes);let released=false;return {release(){if(released)return;released=true;currentOwnedMetadataBytes-=bytes;external?.release();}};}
 function ownInput(input){open();let canonical;try{canonical=R.canonicalBytes(input,{maxBytes:MAX_BYTES});}catch(error){if(input?.coreScene)fail('INVALID_CORE_SCENE','Complete view has invalid persistent values',{reason:error.message});throw error;}const lease=reserve(canonical.byteLength*8+4096,'complete-view-working');try{return {input:R.parse(canonical,{maxBytes:MAX_BYTES,allowUnsafeNumbers:true}),lease};}catch(error){lease.release();throw error;}}
 function validateCore(core){
  open();let owned;try{owned=R.clone(core);}catch(error){fail('INVALID_CORE_SCENE','Complete core has invalid persistent values',{reason:error.message});}if(!owned||Object.getPrototypeOf(owned)!==Object.prototype||!['version','position','forward','up','time','radius','seed','playing'].every(key=>Object.hasOwn(owned,key)))fail('INVALID_CORE_SCENE','A complete existing core snapshot is required');
  let validated;try{validated=math.validate(owned);}catch(error){fail('INVALID_CORE_SCENE','Existing core codec refused the complete view',{reason:error.message});}
  if(!equal(Object.keys(owned).sort(),Object.keys(validated).sort()))fail('INVALID_CORE_SCENE','Core snapshot has missing or unknown codec fields');
  for(const key of Object.keys(validated)){
   if(['forward','up'].includes(key)){if(!vector(owned[key])||Math.hypot(...owned[key].map((v,i)=>v-validated[key][i]))>1e-12)fail('INVALID_CORE_SCENE','Core orientation is not a validated unit basis');}
   else if(!equal(owned[key],validated[key]))fail('INVALID_CORE_SCENE','Core codec would replace or clamp a retained value',{field:key});
  }
  if(owned.playing!==false||Math.abs(owned.forward.reduce((sum,v,i)=>sum+v*owned.up[i],0))>1e-10)fail('INVALID_CORE_SCENE','Saved core views require paused, orthogonal orientation');
  return R.deepFreeze(owned);
 }
 async function validateOwnedBody(input,{signal}={}){
  // Own every persistent field before any dependency or hash can yield.
  const body=R.clone(input);check(signal);
  if(!keys(body,['format','coreScene','biomeView'])||body.format!==FORMAT)fail('INVALID_VIEW','Unsupported complete view envelope');
  body.coreScene=validateCore(body.coreScene);R.canonicalBytes(body,{maxBytes:MAX_BYTES});
  if(body.biomeView===null)return R.deepFreeze(body);
  const view=body.biomeView;
  if(!keys(view,['worldId','bindingDigest','observer','providerStateRefs'],['regionRef','boundaryRef'])||!ID.test(view.worldId)||!DIGEST.test(view.bindingDigest)||!Array.isArray(view.providerStateRefs)||view.providerStateRefs.length>128)fail('INVALID_VIEW','Invalid binding-aware sidecar');
  const observer=view.observer;
  if(!keys(observer,['address','altitudeM','forward','up','movementProfile','selectedTime','presentationState','hostWindSnapshot'])||!Number.isFinite(observer.altitudeM)||!Number.isFinite(observer.selectedTime)||!vector(observer.forward)||!vector(observer.up)||!MOVEMENT.includes(observer.movementProfile)||Math.abs(observer.forward.reduce((sum,v,i)=>sum+v*observer.up[i],0))>1e-10)fail('INVALID_VIEW','Invalid exact observer');
  if(!equal(observer.forward,body.coreScene.forward)||!equal(observer.up,body.coreScene.up)||observer.selectedTime!==body.coreScene.time)fail('INVALID_VIEW','Observer and core time/orientation differ');
  const B=root.SphereBiomeBindingBuilder||(typeof module!=='undefined'?require('./binding-builder.js'):null),X=root.SphereBiomeSpatialIndex||(typeof module!=='undefined'?require('./spatial-index.js'):null);
  if(!B?.isOwner(bindingOwner))fail('MISSING_BINDING','No authentic admitted binding resolver is available');
  const bindingHandle=await bindingOwner.resolveBinding(view.bindingDigest,{signal}),context=bindingOwner.inspectBinding(bindingHandle);check(signal);
  if(!context?.hostAdapter?.metadata||!context.snapshot||!context.bindingEnvelope||!context.indexApi?.lookup||!context.indexHandle)fail('UNVERIFIED_BINDING','Complete view needs an independently verified binding/index owner');
  const binding=await R.verifyEnvelope(context.bindingEnvelope);R.validateBinding(binding);check(signal);
  if(context.bindingEnvelope.digest!==view.bindingDigest||binding.worldId!==view.worldId||binding.worldId!==context.snapshot.worldId)fail('INVALID_VIEW','Resolved binding identity differs');
  if(context.indexApi!==X||!equal(X.inspect(context.indexHandle).descriptor,binding.index))fail('UNVERIFIED_BINDING','Exact CPU ownership and binding index differ');
  const adapter=context.hostAdapter,snapshot=context.snapshot;
  const canonical=adapter.canonicalizeShellAddress(observer.address,snapshot);
  if(!equal(canonical,observer.address))fail('INVALID_VIEW','Observer does not own its canonical seam address');
  adapter.metadata(snapshot);R.validateAddress(observer.address,{metadata:adapter.metadata(snapshot),requireRuntime:true,canonicalize:address=>adapter.canonicalizeShellAddress(address,snapshot)});
  const reconstructed=adapter.corePoseFromAddress(observer,snapshot);
  if(Math.hypot(...reconstructed.position.map((v,i)=>v-body.coreScene.position[i]))*1000>.001)fail('INVALID_VIEW','Observer/core position exceeds the unchanged one-millimetre tolerance');
  // This also verifies all retained static core inputs against the opaque host.
  adapter.addressFromCorePose(body.coreScene,snapshot,{level:observer.address.level,movementProfile:observer.movementProfile});
  const ownership=context.indexApi.lookup(context.indexHandle,observer.address),regionId=ownership?.regionId??null,assignment=binding.assignments.find(a=>a.regionId===regionId);
  if(view.regionRef!==undefined){const ref=view.regionRef;if(!keys(ref,['regionId','assignmentDigest','releaseDigest'])||!ID.test(ref.regionId)||!DIGEST.test(ref.assignmentDigest)||!DIGEST.test(ref.releaseDigest)||!assignment||ref.regionId!==assignment.regionId||ref.releaseDigest!==assignment.releaseDigest||ref.assignmentDigest!==(await R.envelope(assignment)).digest)fail('INVALID_VIEW','Region reference differs from exact CPU ownership');}
  else if(assignment)fail('INVALID_VIEW','An assigned observer lacks its exact region reference');
  if(view.boundaryRef!==undefined){const ref=view.boundaryRef,boundary=binding.boundaries.find(b=>b.id===ref?.boundaryId);if(!keys(ref,['boundaryId','certificateDigest'])||!ID.test(ref.boundaryId)||!DIGEST.test(ref.certificateDigest)||!boundary||boundary.certificateDigest!==ref.certificateDigest||assignment&&!assignment.boundaryIds.includes(ref.boundaryId)||!assignment&&boundary.rightRegionId!=='base-surface'||typeof context.boundaryAt!=='function'||(await context.boundaryAt(observer.address,{signal}))?.id!==ref.boundaryId)fail('INVALID_VIEW','Boundary reference lacks exact retained participation and geometric membership');}
  const stateRegions=new Set();
  for(const ref of view.providerStateRefs){validateStateRef(ref);if(stateRegions.has(ref.regionId))fail('INVALID_VIEW','Provider state regions are repeated');stateRegions.add(ref.regionId);const target=binding.assignments.find(a=>a.regionId===ref.regionId);if(!target||target.releaseDigest!==ref.releaseDigest||target.stateSchemaId!==ref.stateSchemaId)fail('INVALID_VIEW','Provider state belongs to another exact assignment');if(typeof context.validateProviderState!=='function')fail('MISSING_PROVIDER_STATE','No admitted provider state codec is available');const retained=await context.validateProviderState(ref,target,{signal});check(signal);const state=await R.verifyEnvelope(retained);if(retained.digest!==ref.digest||state.format!=='sphere-biome-provider-state/1'||!keys(state,['format','regionId','releaseDigest','stateSchemaId','revision','data'])||['regionId','releaseDigest','stateSchemaId','revision'].some(key=>state[key]!==ref[key]))fail('INVALID_VIEW','Resolved provider state identity differs');R.canonicalBytes(state.data,{maxBytes:STATE_BYTES});}
  if(typeof context.validatePresentation!=='function'||!equal(await context.validatePresentation(observer.presentationState,{assignment,signal}),observer.presentationState))fail('UNSUPPORTED_PRESENTATION','Presentation lacks its exact admitted provider codec');
  if(observer.hostWindSnapshot!==null&&(typeof context.validateWindSnapshot!=='function'||!equal(await context.validateWindSnapshot(observer.hostWindSnapshot,{snapshot,observer,signal}),observer.hostWindSnapshot)))fail('UNSUPPORTED_HOST_WIND','Wind snapshot lacks an admitted geographic profile');
  check(signal);return R.deepFreeze(body);
 }
 function retain(envelope,working){open();const old=issued.get(envelope.digest);if(old){working.release();return old.envelope;}const byteLength=R.canonicalBytes(envelope,{maxBytes:MAX_BYTES}).byteLength,lease=reserve(byteLength*8+4096,'complete-view-retained');issued.set(envelope.digest,{envelope,lease,byteLength,borrows:0});working.release();return envelope;}
 async function validateBody(input,options={}){const owned=ownInput(input);try{return await validateOwnedBody(owned.input,options);}finally{owned.lease.release();}}
 async function prepare(body,options={}){const owned=ownInput(body);try{const verified=await validateOwnedBody(owned.input,options),envelope=await R.envelope(verified);check(options.signal);return retain(envelope,owned.lease);}finally{owned.lease.release();}}
 async function verify(input,options={}){const owned=ownInput(input);try{const body=await R.verifyEnvelope(owned.input),verified=await validateOwnedBody(body,options);check(options.signal);return retain(R.deepFreeze({digest:owned.input.digest,body:verified}),owned.lease);}finally{owned.lease.release();}}
 function verified(digest){open();if(!DIGEST.test(digest)||!issued.has(digest))fail('UNVERIFIED_VIEW','The complete view has not passed this codec');return issued.get(digest).envelope;}
 function borrowVerified(digest){open();const envelope=verified(digest),retained=issued.get(digest);retained.borrows++;openBorrows++;let live=true;return Object.freeze({envelope,byteLength:retained.byteLength,close(){if(!live)return;live=false;retained.borrows--;openBorrows--;}});}
 function release(digest){open();const retained=issued.get(digest);if(!retained)return false;if(retained.borrows)fail('OWNER_IN_USE','A verified view is held by an active borrower');issued.delete(digest);retained.lease.release();return true;}
 function pausedCore(core){const owned=R.clone(core);owned.playing=false;return validateCore(owned);}
 const api=Object.freeze({validateCore,validateBody,prepare,verify,verified,borrowVerified,pausedCore,release,inspect:()=>({verifiedViews:issued.size,openBorrows,currentOwnedMetadataBytes,peakOwnedMetadataBytes,nativeHeap:'UNMEASURED'}),dispose(){if(closed)return;if(openBorrows)fail('OWNER_IN_USE','Verified view borrowers must close before disposal');closed=true;for(const retained of issued.values())retained.lease.release();issued.clear();}});owners.add(api);return api;
}
const api=Object.freeze({FORMAT,MAX_BYTES,STATE_BYTES,MAX_METADATA,MOVEMENT,create,isOwner:value=>owners.has(value)});root.SphereBiomeViewEnvelope=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
