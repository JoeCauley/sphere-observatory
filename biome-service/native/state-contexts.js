/* Exact retained provider state and coexisting prepared contexts. This owner
 * supplies no fragment, whole-view, travel, session ACK or main readiness. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('../metadata-budget.js'):null),Sources=root.SphereBiomeNativeSourceAdmission||(node?require('./source-admission.js'):null),B=root.SphereBiomeBindingBuilder||(node?require('../binding-builder.js'):null),K=root.SphereBiomeNativeSurfaceKernel||(node?require('./surface-kernel.js'):null),PH=root.SphereBiomeNativeProviderHost||(node?require('./provider-host.js'):null),Resources=root.SphereBiomeNativeResources||(node?require('./resource-leases.js'):null),P=root.SphereBiomeProviderProfiles||(node?require('../provider-profiles.js'):null),D=root.SphereBiomeNativeFixtureDefinition||(node?require('./fixture-definition.js'):null);
const owners=new WeakSet(),FORMAT='sphere-biome-state-context-profile/1',MAX_CONTEXTS=128,MAX_LEASES=256;
function fail(code,message){throw R.error(code,message,{},'native-state-contexts');}
function data(value){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).some(k=>typeof k!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))fail('INVALID_REQUEST','Ordinary data properties required');return value;}
function abort(signal){if(signal?.aborted)fail('CANCELLED','Retained-state context request cancelled');}
async function create({bindingOwner,kernel,providerOwner,resourceHost,metadataOwner,providerProfiles,factories,releaseStore,profileEnvelope,readSource,sourceOwner}={}){
 if(!B.isOwner(bindingOwner)||!K.isOwner(kernel)||!kernel.isMetadataOwner(metadataOwner)||!PH.isOwner(providerOwner?.bridge)||!Resources.isHost(resourceHost)||!Q.isOwner(metadataOwner)||!(factories instanceof Map)||typeof readSource!=='function'||!releaseStore?.getRelease||!releaseStore?.getResource)fail('FOREIGN_OWNER','Actual binding, kernel, provider bridge, resources and shared metadata required');
 const factorySnapshot=new Map(Map.prototype.entries.call(factories));
 if(!factorySnapshot.size||factorySnapshot.size>64||[...factorySnapshot.values()].some(factory=>!D.isConfigured(factory)))fail('FOREIGN_OWNER','Only authentic statically compiled configurations are accepted');
 const configuration=Sources.ownRecord({providerProfiles},{metadataOwner,label:'biome-state-contexts',phase:'provider-profiles',maxBytes:262144,maxNodes:16384});
 let admission,source;
 try{source=await Sources.admit({profileEnvelope,readSource,metadataOwner,sourceOwner,owner:'biome-state-contexts',phase:'source-admission',extraBytes:2097152});const p=source.profile.body;if(p.format!==FORMAT||p.id!=='root-state-context-v1'||p.maximumContexts!==MAX_CONTEXTS||p.maximumLeases!==MAX_LEASES||Object.keys(p).sort().join('|')!==['closure','format','id','maximumContexts','maximumLeases'].join('|'))fail('SOURCE_PROFILE_MISMATCH','Exact fixed state-context source profile required');
  const sourceRows=new Map(p.closure.map(row=>[row.path,row])),direct=['biome-service/native/state-contexts.js','biome-service/records.js','biome-service/metadata-budget.js','biome-service/native/source-admission.js','biome-service/binding-builder.js','biome-service/native/surface-kernel.js','biome-service/native/provider-host.js','biome-service/native/resource-leases.js','biome-service/provider-profiles.js','biome-service/native/fixture-definition.js'];
  if(direct.some(path=>!sourceRows.has(path)))fail('SOURCE_PROFILE_MISMATCH','Complete fixed state-owner dependency closure required');
  for(const profile of configuration.value.providerProfiles)for(const row of profile.body.closure){const actual=sourceRows.get(row.path);if(!actual||actual.bytes!==row.bytes||actual.sha256!==row.sha256)fail('SOURCE_PROFILE_MISMATCH','State owner and every compiled provider must pin one coherent exact dependency closure');}
  admission=await P.admit(configuration.value.providerProfiles,factorySnapshot,readSource,{backendProfiles:[...new Set(configuration.value.providerProfiles.map(p=>p.body.backendProfile))]});}catch(error){source?.charge.release();throw error;}finally{configuration.charge.release();}
 const bridge=providerOwner.bridge,contexts=new Map(),leases=new Map(),prepared=new Map(),readers=new Map(),observations=new Map();let disposed=false,acquiring=false;
 function live(){if(disposed)fail('OWNER_DISPOSED','Retained-state owner disposed');if(resourceHost.inspect().contextLost)fail('CONTEXT_LOST','Provider resource context lost');}
 function observe(value){const h=Sources.ownRecord(value,{metadataOwner,label:'biome-state-contexts',phase:'observation',maxBytes:262144,maxNodes:8192});observations.set(h.value,h);return h.value;}
 function releaseObservation(value){const h=observations.get(value);if(!h)fail('FOREIGN_OWNER','Unknown state-context observation');observations.delete(value);h.charge.release();}
 function get(token){live();const s=leases.get(token);if(!s)fail('STALE_LEASE','Unknown or released state-context lease');return s;}
 function destroy(entry){entry.instance.dispose();bridge.releaseServices(entry.services);entry.providerServices.dispose();kernel.releaseContext(entry.semanticContext);entry.holder.charge.release();contexts.delete(entry.key);}
 async function acquire(input){
  live();if(acquiring)fail('PREPARATION_BUSY','One state context creation/validation at a time');if(leases.size>=MAX_LEASES)fail('RESOURCE_LIMIT','Retained-state lease cap reached');acquiring=true;
  let request=null,bindingHandle,signal,recipeToken=null,semanticContext=null,providerServices=null,services=null,instance=null,holder=null,createdEntry=null;
  try{
   request=Sources.buildRecord(()=>{data(input);bindingHandle=input.bindingHandle;signal=input.signal;return {regionId:input.regionId,stateRef:input.stateRef??null};},{metadataOwner,label:'biome-state-contexts',phase:'request',maxBytes:16384,maxNodes:128});abort(signal);
   const binding=bindingOwner.inspectBinding(bindingHandle),assignment=binding.bindingEnvelope.body.assignments.find(a=>a.regionId===request.value.regionId);
   if(!assignment)fail('MISSING_ASSIGNMENT','Exact requested assignment is absent');if(!request.value.stateRef)fail('MISSING_PROVIDER_STATE','An active/prepared region must retain exact state; no default substitution');
   // Validate both immutable bytes and outer revision before every cache hit.
   const state=await binding.validateProviderState(request.value.stateRef,assignment,{signal});live();abort(signal);
   const key=binding.bindingEnvelope.digest+':'+assignment.regionId+':'+state.digest;
   let entry=contexts.get(key);
   if(!entry){
    if(contexts.size>=MAX_CONTEXTS)fail('RESOURCE_LIMIT','Retained-state context cap reached');
    const release=await releaseStore.getRelease(assignment.releaseDigest);live();abort(signal);
    if(!release||release.payloadDigest!==assignment.releaseDigest||release.manifest.packId!==assignment.packId||R.canonicalJSON(release.manifest.provider)!==R.canonicalJSON(assignment.provider))fail('MISSING_RELEASE','Exact assigned release unavailable');
    const recipeAsset=release.manifest.assets.find(asset=>asset.id===release.manifest.recipeAssetId);if(!recipeAsset)fail('MISSING_RESOURCE','Exact recipe inventory missing');const resource=await releaseStore.getResource(recipeAsset.sha256);live();abort(signal);const bytes=resource?.bytes??resource;
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==recipeAsset.bytes||await R.sha256(bytes)!==recipeAsset.sha256)fail('RESOURCE_CORRUPT','Exact retained recipe bytes differ');live();abort(signal);
    const recipe=Sources.parseRecord(bytes,{metadataOwner,label:'biome-state-contexts',phase:'recipe',maxBytes:recipeAsset.bytes,maxNodes:8192});
    try{recipeToken=kernel.issueRecipe(recipe.value,release.manifest);semanticContext=await kernel.bind(binding.bindingEnvelope.digest,assignment.regionId,recipeToken,{signal});kernel.releaseRecipe(recipeToken);recipeToken=null;live();abort(signal);
     const context=kernel.inspectContext(semanticContext);if(context.bindingDigest!==binding.bindingEnvelope.digest||context.assignment.regionId!==assignment.regionId)fail('NATIVE_CONTEXT_MISMATCH','Prepared semantic context differs');
     providerServices=resourceHost.createProvider(release.manifest.budgets);services=bridge.issueServices({manifest:release.manifest,semanticContext,providerServices,persistentState:state.body.data});instance=admission.create(release.manifest,recipe.value,services);
     holder=Sources.ownRecord({stateEnvelope:state,manifest:release.manifest,contextDigest:context.contextEnvelope.digest},{metadataOwner,label:'biome-state-contexts',phase:'retained-context',maxBytes:262144,maxNodes:8192});
     entry={key,semanticContext,providerServices,services,instance,holder,references:0,pending:0};contexts.set(key,entry);createdEntry=entry;semanticContext=providerServices=services=instance=holder=null;
    }finally{recipe.charge.release();}
   }
   live();abort(signal);const charge=metadataOwner.reserve(4096,{owner:'biome-state-contexts',phase:'context-lease'}),token=Object.freeze({});entry.references++;leases.set(token,{entry,charge,prepared:new Set()});return token;
  }catch(error){if(createdEntry&&createdEntry.references===0)destroy(createdEntry);instance?.dispose();if(services)bridge.releaseServices(services);providerServices?.dispose();if(semanticContext)kernel.releaseContext(semanticContext);holder?.charge.release();if(recipeToken)kernel.releaseRecipe(recipeToken);throw error;}finally{acquiring=false;request?.charge.release();}
 }
 async function prepare(token,input,{signal}={}){
  const lease=get(token);abort(signal);if(lease.entry.pending)fail('PREPARATION_BUSY','This exact context already has pending support');lease.entry.pending++;
  let request=null,providerLease=null,charge=null;
  try{request=Sources.ownRecord(input,{metadataOwner,label:'biome-state-contexts',phase:'preparation-input',maxBytes:16384,maxNodes:128});const e=lease.entry,m=e.holder.value.manifest,requestToken=bridge.beginRequest(e.instance,request.value);providerLease=await e.instance.prepare(requestToken,e.semanticContext,{maxPrepareOpsPerSlice:m.budgets.maxPrepareOpsPerSlice,maxUploadBytesPerFrame:m.budgets.maxUploadBytesPerFrame},signal);live();abort(signal);charge=metadataOwner.reserve(4096,{owner:'biome-state-contexts',phase:'prepared-lease'});const key=Object.freeze({});prepared.set(key,{contextToken:token,lease,providerLease,charge,readers:0});lease.prepared.add(key);providerLease=charge=null;return key;}finally{lease.entry.pending--;if(providerLease)bridge.release(providerLease);charge?.release();request?.charge.release();}
 }
 function inspectState(token){const {entry}=get(token);return observe({key:entry.key,stateEnvelope:entry.holder.value.stateEnvelope,contextDigest:entry.holder.value.contextDigest,references:entry.references,qualification:'EXACT_STATE_CREATION_AND_CONTEXT_COMPONENT_ONLY'});}
 function inspectPrepared(key){live();const item=prepared.get(key);if(!item)fail('STALE_LEASE','Unknown prepared state-context lease');const report=bridge.inspectPrepared(item.providerLease);return observe({stateDigest:item.lease.entry.holder.value.stateEnvelope.digest,contextDigest:report.contextDigest,coverage:report.coverage,readiness:report.resource.readiness,qualification:'PREPARED_PROVIDER_COMPONENT_ONLY; NO_FRAGMENT_WHOLE_VIEW_MAIN_SESSION_ACK'});}
 // A fixed native consumer borrows actual PH/K handles, rather than copied
 // support data or a caller callback. Both preparation and state stay retained.
 function borrowPrepared(key){
  live();const item=prepared.get(key);if(!item)fail('STALE_LEASE','Unknown prepared state-context lease');if(readers.size>=MAX_LEASES)fail('RESOURCE_LIMIT','Prepared native reader cap reached');
  const charge=metadataOwner.reserve(4096,{owner:'biome-state-contexts',phase:'native-prepared-reader'});let reader;
  try{const e=item.lease.entry,value=Object.freeze({semanticContext:e.semanticContext,providerLease:item.providerLease,providerOwner,contextDigest:e.holder.value.contextDigest});
   reader=Object.freeze({get value(){live();if(!readers.has(reader))fail('STALE_LEASE','Prepared native reader is closed');const actual=bridge.inspectHostPrepared(item.providerLease);if(actual.semanticContext!==value.semanticContext||actual.contextDigest!==value.contextDigest)fail('NATIVE_CONTEXT_MISMATCH','Prepared native source context changed');return value;},close(){const r=readers.get(reader);if(!r)return false;readers.delete(reader);r.item.readers--;r.charge.release();return true;}});
   item.readers++;readers.set(reader,{item,charge});return reader;
  }catch(error){charge.release();throw error;}
 }
 function releasePrepared(key){const item=prepared.get(key);if(!item)fail('STALE_LEASE','Unknown prepared state-context lease');if(item.readers)fail('OWNER_IN_USE','Native prepared readers must close before support release');bridge.release(item.providerLease);item.charge.release();item.lease.prepared.delete(key);prepared.delete(key);}
 function release(token){const item=leases.get(token);if(!item)fail('STALE_LEASE','Unknown state-context lease');if(item.entry.pending||item.prepared.size)fail('OWNER_IN_USE','Prepared/pending support must close before its exact context');leases.delete(token);item.charge.release();if(--item.entry.references===0)destroy(item.entry);}
 function dispose(){if(disposed)return;if(acquiring||[...contexts.values()].some(e=>e.pending))fail('PREPARATION_BUSY','State context work must settle before disposal');if(leases.size||prepared.size||readers.size)fail('OWNER_IN_USE','Retained support/context readers must release first');for(const value of [...observations.keys()])releaseObservation(value);for(const entry of [...contexts.values()])destroy(entry);source.charge.release();disposed=true;}
 const owner=Object.freeze({profileEnvelope:source.profile,usesOwners:value=>value?.bindingOwner===bindingOwner&&value?.kernel===kernel&&value?.providerOwner===providerOwner&&value?.resourceHost===resourceHost&&value?.metadataOwner===metadataOwner&&value?.sourceOwner===sourceOwner,acquire,prepare,inspectState,inspectPrepared,borrowPrepared,releaseObservation,releasePrepared,release,dispose,inspect:()=>Object.freeze({contexts:contexts.size,leases:leases.size,prepared:prepared.size,preparedReaders:readers.size,observations:observations.size,acquiring,disposed,qualification:'STATE_CONTEXT_COMPONENT_ONLY',mainRestore:'NOT_RUN',nativeSessionAck:'UNQUALIFIED'})});owners.add(owner);return owner;
}
const api=Object.freeze({FORMAT,MAX_CONTEXTS,MAX_LEASES,create,isOwner:value=>owners.has(value)});root.SphereBiomeNativeStateContexts=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
