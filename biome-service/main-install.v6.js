/* Main's install/location route. Rendering an installed provider is a separate owner. */
(function(root){
'use strict';
const get=(name,path)=>root[name]||(typeof module!=='undefined'?require(path):null);
const R=get('SphereBiomeRecords','./records.js'),Q=get('SphereBiomeMetadataBudget','./metadata-budget.js'),H=get('SphereBiomeHostWorld','./host-world.js'),N=get('SphereBiomeNumericProfile','./numeric-profile.js'),P=get('SphereBiomeProviderProfiles','./provider-profiles.js'),C=get('SphereBiomeCommonBoundary','./commonboundary-adapter.js'),B=typeof module!=='undefined'?require('./binding-builder.v2.js'):root.SphereBiomeBindingBuilder,L=get('SphereBiomeAllocator','./allocator.js'),S=get('SphereBiomeStorage','./storage.js'),RS=get('SphereBiomeReleaseStore','./release-store.js'),V=get('SphereBiomeVerifiedRecordStore','./verified-record-store.js'),CP=get('SphereBiomeCheckpointStore','./checkpoint-store.js'),View=get('SphereBiomeViewEnvelope','./view-envelope.js'),Pub=typeof module!=='undefined'?require('./publication.v2.js'):root.SphereBiomePublication,Registry=get('SphereBiomeRegistry','./registry.js'),Policy=get('SphereBiomePolicy','./policy.js'),Ingestion=get('SphereBiomeIngestion','./ingestion-worker.js'),Factory=get('SphereBiomeFixtureTrackMeadow','./native/providers/fixture-track-meadow.js');
const IO=get('SphereBiomeBoundedStorage','./bounded-storage.v1.js');
const Overview=typeof module!=='undefined'?require('./main-overview.v2.js'):root.SphereBiomeMainOverview;
const Shared=get('SphereBiomeServiceResources','./service-resources.v1.js');
let Local=typeof module!=='undefined'?null:root.SphereBiomeMainLocalSupportV2;
const FORMAT='sphere-main-install-location/1',WORKSPACE=IO.WORKSPACE,MAX_ROW=IO.MAX_ROW,MAX_SOURCE=2*1048576;
function fail(code,message,details={}){throw R.error(code,message,details,'main-install');}
function size(value){if(value===undefined||value===null)return 8;if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))return value.byteLength; if(Array.isArray(value))return 32+value.reduce((n,v)=>n+8+size(v),0);if(typeof value==='object')return 48+Object.entries(value).reduce((n,[k,v])=>n+64+k.length*2+size(v),0);return typeof value==='string'?24+value.length*2:8;}
// This slot covers bounded readback, source verification, IDB callback copies and
// orchestration records through all awaits. Component retained owners charge Q separately.
// At most two bounded transport responses, or one serialized storage transaction,
// run here at once. Results stay covered until the complete route is disposed.
function boundedStorage(storage,reserveMetadata){
 return IO.create(storage,reserveMetadata);
}
async function create({origin,profiles,fetchBytes=Registry.fetchBounded,indexedDB=root.indexedDB,storageName=S.NAME,onPhase=()=>{}}={}){
 const budget=Q.create(),workspace=budget.reserve(WORKSPACE,{owner:'main-install',phase:'bounded-working-slot'}),reserveMetadata=(bytes,details)=>budget.reserve(bytes,details);
 const serviceResources=Shared.create({metadataOwner:budget});
 let rawStorage,storage,io,host,capture,policy,allocatorProfile,builder,nativeBuilder,boundary,records,checkpoints,view,publisher,registry,releaseStore,overview,local,lastLocalRetirement=null,closed=false,busy=false,last=null;
 const sourceEntries=new Map([...profiles.provider.body.closure,...profiles.hostClosure,...profiles.serviceClosure].map(e=>[e.path,e]));
 async function readSource(path){const entry=sourceEntries.get(path);if(!entry||entry.bytes>MAX_SOURCE)fail('SOURCE_PROFILE_MISMATCH','Source is absent from the pinned bounded install closure',{path});const bytes=await fetchBytes(new URL(path,origin+'/').href,{maximumBytes:entry.bytes});if(bytes.length!==entry.bytes||await R.sha256(bytes)!==entry.sha256)fail('SOURCE_PROFILE_MISMATCH','Installed service source differs from its admitted release',{path});return bytes;}
 function phase(name){onPhase(name);}
 async function initialize(coreScene){
  phase('Verifying the current world and service');
  const numericQualification=await N.capture(),profileEnvelope=await R.envelope({format:H.PROFILE_FORMAT,id:H.PROFILE_ID,addressProfile:H.ADDRESS_PROFILE,numericProfile:H.NUMERIC_PROFILE,numericQualification,timeProfile:'sphere-clock-v1',staticParameterKeys:[...H.STATIC_KEYS],moduleOrder:[...H.MODULE_ORDER],closure:profiles.hostClosure,mandatoryExclusionProfiles:['wound-apertures-v1','authored-sites-v1','polar-ports-v1'],capabilities:['host.static-world','host.shell-address','host.fixed-frame','host.legacy-surface','host.physical-light']});
  host=await H.create({profileEnvelope,readSource});capture=await host.captureCurrentWorld(coreScene);policy=await Policy.pilot(host,capture);
  const configured=Factory.configure(profiles.provider);boundary=await C.create({providerProfiles:[profiles.provider],staticFactories:new Map([[Factory.extensionId,configured]]),codecProfiles:[profiles.codec],staticCodecs:new Map([[profiles.codec.body.id,{reference:{id:profiles.codec.body.id,digest:profiles.codec.digest,providerDigest:profiles.provider.digest},...Factory.codec}]]),readSource,backendProfiles:[Factory.backendProfile]});
  rawStorage=await S.open({indexedDB,name:storageName});io=boundedStorage(rawStorage,reserveMetadata);storage=io.storage;
  releaseStore=RS.create({storage,negotiateProvider:boundary.negotiate});records=V.create({storage});checkpoints=CP.create({storage});
  allocatorProfile=await L.buildProfile(readSource,{numericQualification});builder=await B.create({hostAdapter:host,releaseStore,stagingStore:records,boundaryAdapter:boundary,allocatorProfileEnvelope:allocatorProfile,readSource,metadataOwner:budget,checkpointRepository:checkpoints});
  view=View.create({math:root.SphereMath,bindingOwner:builder,reserveMetadata:(bytes,phase)=>reserveMetadata(bytes,{owner:'main-install-view',phase})});publisher=Pub.create({storage,builderOwner:builder,viewCodec:view,recordStore:records,reserveMetadata});
  registry=Registry.create({origin,fetchBytes,ingestion:Ingestion,store:releaseStore,negotiateProvider:boundary.negotiate,knownTrackIds:host.retainedInputs(capture.snapshot).tracks.body.tracks.map(t=>t.id),reserveMetadata});
  await registry.refreshCatalogue();
 }
 async function location(){
  const worldId=capture.snapshot.worldId,head=await storage.get('worldHeads',worldId)??null;
  let binding=null,installations=[];
  if(head){phase('Reading the published location');const handle=await builder.resolveBinding(head.bindingDigest);binding=builder.inspectBinding(handle).bindingEnvelope;
   if(binding.body.worldId!==worldId||binding.body.registryDigest!==head.registryDigest||binding.body.revision!==head.revision)fail('RESOURCE_CORRUPT','Published world head and binding differ');
   const releases=new Map();for(const a of binding.body.assignments){if(!releases.has(a.releaseDigest)){const release=await storage.get('releases',a.releaseDigest);releases.set(a.releaseDigest,release.manifest);}}
   installations=[...releases].map(([payloadDigest,manifest])=>({packId:manifest.packId,name:manifest.name,version:manifest.version,payloadDigest,regions:binding.body.assignments.filter(a=>a.releaseDigest===payloadDigest).map(a=>({regionId:a.regionId,requestKey:a.requestKey,trackRelation:manifest.placement.trackRelation,eligibleTrackIds:a.eligibility.trackIds??[],anchor:a.frame.origin,cells:a.core.cells,level:a.core.level,eligibility:a.eligibility}))}));
  }
  return {format:FORMAT,worldId,hostWorldDigest:capture.hostWorldEnvelope.digest,head,installationCount:installations.length,regionCount:binding?.body.assignments.length??0,cellCount:binding?.body.assignments.reduce((n,a)=>n+a.core.cells.length,0)??0,installations};
 }
 async function run(coreScene,payloadDigest,{signal}={}){
  if(closed||busy)fail('PREPARATION_BUSY','Main installation owner is closed or already busy');busy=true;
  try{
   if(!host)await initialize(coreScene);
   else if((await host.captureCurrentWorld(coreScene)).snapshot.worldId!==capture.snapshot.worldId)fail('WORLD_PROFILE_CHANGED','World settings changed. Reopen Main to use its current world.');
   if(signal?.aborted)fail('CANCELLED','Main install cancelled');
   const before=await location(),available=registry.listAvailable();
   if(payloadDigest===undefined){last={...before,status:'READY',available};return R.deepFreeze(R.clone(last));}
   const row=available.find(r=>r.payloadDigest===payloadDigest);if(!row?.available)fail('UNAVAILABLE_CONTENT','This exact catalogue release is unavailable');
   if(before.installations.some(i=>i.payloadDigest===payloadDigest)){last={...before,status:'ALREADY_INSTALLED',available};return R.deepFreeze(R.clone(last));}
   const requestKey='install-'+(await R.sha256(new TextEncoder().encode(before.worldId+'\n'+payloadDigest))).slice(0,40),operationId=requestKey,sessionId='main-install-'+before.worldId.slice(6);
   phase('Verifying the exact release');await registry.registerRelease({kind:'catalogue-release',payloadDigest},{operationId:'verify-'+payloadDigest.slice(0,40),idempotencyKey:'verify-'+payloadDigest.slice(0,40),signal});
   const departure=await view.prepare({format:View.FORMAT,coreScene,biomeView:null},{signal});await publisher.stageView(departure.digest,{stagingKey:'staging:'+operationId,signal});
   phase('Assigning an eligible shade-track location');
   const previousBindingEnvelope=before.head?builder.inspectBinding(await builder.resolveBinding(before.head.bindingDigest)).bindingEnvelope:null;
   const allocationTicket=await builder.planAllocation({snapshot:capture.snapshot,hostWorldEnvelope:capture.hostWorldEnvelope,policyEnvelope:policy,operationId,requestKey,releaseDigest:payloadDigest,...(previousBindingEnvelope?{previousBindingEnvelope}:{})},{signal});
   if(allocationTicket.status)fail(allocationTicket.status,'Allocation did not complete',allocationTicket);
   phase('Preparing the verified world binding');const ticket=await builder.prepare({allocationTicket,expectedHead:before.head,callerSession:{sessionId,expectedHead:null},departureViewRef:{digest:departure.digest},viewOwner:view},{signal});
   phase('Publishing the installation');const receipt=await publisher.publishPrepared(ticket,{signal});
   const after=await location();last={...after,status:'INSTALLED',available,receipt};return R.deepFreeze(R.clone(last));
  }finally{busy=false;}
 }
 async function syncRenderer(renderer,coreScene,{signal}={}){
  if(closed||busy||!host)fail('PREPARATION_BUSY','Initialize and settle installation before renderer preparation');busy=true;let stage;
  try{
   if((await host.captureCurrentWorld(coreScene)).snapshot.worldId!==capture.snapshot.worldId)fail('WORLD_PROFILE_CHANGED','Renderer world differs from this installation owner');
   const head=await storage.get('worldHeads',capture.snapshot.worldId,{signal});if(!head)return null;
   if(overview?.inspect().bindingDigest===head.bindingDigest)return overview.inspect();
   phase('Preparing the installed world overview');
   overview??=await Overview.create({renderer,bindingOwner:builder,metadataOwner:budget,serviceResources,releaseStore,profile:profiles.overview,readSource,scheduleYield:()=>new Promise(root.requestAnimationFrame)});
   stage=await overview.prepare(await builder.resolveBinding(head.bindingDigest,{signal}),{signal});
   const retained=await storage.get('worldHeads',capture.snapshot.worldId,{signal});if(R.canonicalJSON(retained)!==R.canonicalJSON(head))fail('STALE_WORLD_HEAD','Published binding changed while its overview was prepared');
   overview.commit(stage);stage=null;return overview.inspect();
  }finally{try{if(stage)overview.discard(stage);}finally{busy=false;}}
 }
 function overviewDestination(coreScene,regionId){if(closed||busy||!overview)fail('NOT_READY','Installed overview is not ready');return overview.destination(coreScene,regionId);}
 async function resolveNative(coreScene,regionId,{signal}={}){
  if(!host||(await host.captureCurrentWorld(coreScene)).snapshot.worldId!==capture.snapshot.worldId)fail('WORLD_PROFILE_CHANGED','Native preparation requires this exact installed world');
  const head=await storage.get('worldHeads',capture.snapshot.worldId,{signal});if(!head)fail('MISSING_ASSIGNMENT','Install a biome before native preparation');
  nativeBuilder=builder;
  const handle=await nativeBuilder.resolveBinding(head.bindingDigest,{signal}),context=nativeBuilder.inspectBinding(handle),published=builder.inspectBinding(await builder.resolveBinding(head.bindingDigest,{signal}));
  if(R.canonicalJSON(context.bindingEnvelope)!==R.canonicalJSON(published.bindingEnvelope))fail('RESOURCE_CORRUPT','Native and installer owners resolved different immutable bindings');
  const assignment=context.bindingEnvelope.body.assignments.find(v=>v.regionId===regionId);if(!assignment)fail('MISSING_ASSIGNMENT','Exact native region is absent');return {head,context,assignment};
 }
 async function verifyNativeBinding(coreScene,regionId,options={}){if(closed||busy)fail('PREPARATION_BUSY','Main owner is busy');busy=true;try{const {head,context,assignment}=await resolveNative(coreScene,regionId,options);return {bindingDigest:head.bindingDigest,regionId:assignment.regionId,releaseDigest:assignment.releaseDigest,indexDigest:context.bindingEnvelope.body.index.digest,bindingProfile:builder.profileEnvelope.body.id,metadata:budget.inspect()};}finally{busy=false;}}
 async function prepareLocal(renderer,coreScene,regionId,{signal}={}){
  if(closed||busy)fail('PREPARATION_BUSY','Main owner is busy');busy=true;
  try{phase('Preparing the installed local terrain');const {head,context}=await resolveNative(coreScene,regionId,{signal});
   Local??=get('SphereBiomeMainLocalSupportV2','./main-local-support.v2.js');local??=await Local.create({renderer,bindingOwner:nativeBuilder,metadataOwner:budget,serviceResources,releaseStore,hostProfileEnvelope:host.profileEnvelope,profiles,readSource,scheduleYield:()=>new Promise(root.requestAnimationFrame),onPhase:phase});
   const result=await local.prepare({bindingDigest:head.bindingDigest,regionId,coreScene,context,signal});
   if(R.canonicalJSON(await storage.get('worldHeads',capture.snapshot.worldId,{signal}))!==R.canonicalJSON(head))fail('STALE_WORLD_HEAD','Published binding changed during native preparation');
   return result;
  }finally{busy=false;}
 }
 async function releaseLocal(options={}){if(closed||busy)fail('PREPARATION_BUSY','Settle Main before releasing native preparation');busy=true;try{if(local){await local.retire(options);lastLocalRetirement=local.inspect();local=null;}return inspect();}finally{busy=false;}}
 function inspect(){return {budget:budget.inspect(),storage:io?.inspect()??null,binding:builder?.inspect()??null,nativeBinding:nativeBuilder?.inspect()??null,publication:publisher?.inspect()??null,overview:overview?.inspect()??null,local:local?.inspect()??null,lastLocalRetirement:lastLocalRetirement?R.clone(lastLocalRetirement):null,serviceResources:serviceResources.inspect()};}
 function dispose(){if(busy)fail('PREPARATION_BUSY','Settle the install before disposal');if(closed)return;local?.dispose();overview?.dispose();registry?.dispose();publisher?.dispose();view?.dispose();builder?.dispose();rawStorage?.close();serviceResources.dispose();workspace.release();budget.dispose();closed=true;}
 return Object.freeze({run,syncRenderer,overviewDestination,verifyNativeBinding,prepareLocal,releaseLocal,inspect,dispose});
}
const api=Object.freeze({FORMAT,WORKSPACE,MAX_ROW,MAX_SOURCE,size,boundedStorage,create});root.SphereMainInstall=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
