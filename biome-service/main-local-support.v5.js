/* Native preparation in Main's existing GL context. Transform/support evidence
 * is deliberately separate from admitted fragment fields and travel readiness. */
(function(root){
'use strict';
const node=typeof module!=='undefined',get=(name,path)=>root[name]||(node?require(path):null);
const R=get('SphereBiomeRecords','./records.js'),Q=get('SphereBiomeMetadataBudget','./metadata-budget.js'),B=(node?require('./binding-builder.v2.js'):root.SphereBiomeBindingBuilder),Shared=get('SphereBiomeServiceResources','./service-resources.v1.js'),K=get('SphereBiomeNativeSurfaceKernelV2','./native/surface-kernel.v2.js'),PH=get('SphereBiomeNativeProviderHostV2','./native/provider-host.v2.js'),Resources=get('SphereBiomeNativeResources','./native/resource-leases.js'),G=get('SphereBiomeSharedGpuBackend','./native/shared-gpu-backend.js'),PB=get('SphereBiomeNativeRootProgramBinding','./native/root-program-binding.js'),Field=get('SphereBiomeNativeLocalFieldV2','./native/local-field.v2.js'),Program=get('SphereBiomeNativeSurfaceProgram','./native/native-surface-program.js'),Sources=get('SphereBiomeNativeSourceAdmission','./native/source-admission.js'),Transform=get('SphereBiomeNativeLocalTransform','./native/local-transform.js'),Profiles=get('SphereBiomeProviderProfiles','./provider-profiles.js'),Extensions=get('SphereBiomeFixtureProviderRegistry','./fixture-provider-registry.v1.js');
const Model=get('SphereBiomeLocalStreamModelV2','./native/local-stream-model.v2.js'),StreamBackend=get('SphereBiomeLocalStreamBackendV2','./native/local-stream-backend.v2.js'),Stream=get('SphereBiomeMainLocalStreamV4','./main-local-stream.v4.js');
const REVISION='main-native-queryable-support-v5',GPU_CAPACITY=4*1048576,WRAPPER_BYTES=2097152,owners=new WeakSet();
function fail(code,message,details={}){throw R.error(code,message,details,'main-local-support');}
function create({renderer,bindingOwner,metadataOwner,serviceResources,releaseStore,hostProfileEnvelope,profiles,extensions,readSource,scheduleYield,onPhase=()=>{}}={}){
 if(!Extensions.isOwner(extensions)||!B.isOwner(bindingOwner)||!Q.isOwner(metadataOwner)||!Shared.isOwner(serviceResources)||!serviceResources.usesMetadataOwner(metadataOwner)||!renderer?.gl||renderer.canvas?.getContext('webgl2')!==renderer.gl||typeof readSource!=='function'||typeof scheduleYield!=='function')fail('FOREIGN_OWNER','Native preparation requires the actual Main, version-two binding and common resource owners');
 const gl=renderer.gl;let busy=false,closed=false,retirementStarted=false,wrapper,gpuCapacity,kernel,gpu,streamBackend,stream,resources,bridgeRoot,instance,services,semanticContext,providerLease,sourceOwner,programBinding,programToken,field,receipt,program,vao,programCharge,shaders=[],last=null,preparedKey=null,yields=0,retirement=null,cpuChannel=null,cpuPending=null,cpuTurns=0,supportCacheCharge=null;
 function live(){if(closed)fail('OWNER_DISPOSED','Main native support owner is closed');if(gl.isContextLost())fail('CONTEXT_LOST','Main GL context is lost');}
 async function yieldOwned({signal}={}){if(signal?.aborted)fail('CANCELLED','Local native preparation cancelled');await scheduleYield();live();resources?.beginFrame();resources?.beginSlice();resources?.drain();yields++;if(signal?.aborted)fail('CANCELLED','Local native preparation cancelled');}
 async function yieldSliceOwned({signal}={}){
  if(signal?.aborted)fail('CANCELLED','Local CPU preparation cancelled');live();if(!root.MessageChannel){await yieldOwned({signal});return;}
  if(cpuPending)fail('PREPARATION_BUSY','One bounded CPU continuation per native owner');
  if(!cpuChannel){if(!wrapper)fail('RESOURCE_LIMIT','Prospectively funded native graph required before CPU channel creation');cpuChannel=new root.MessageChannel();cpuChannel.port1.onmessage=()=>{const resolve=cpuPending;cpuPending=null;resolve?.();};}
  await new Promise(resolve=>{cpuPending=resolve;cpuChannel.port2.postMessage(0);});live();if(signal?.aborted)fail('CANCELLED','Local CPU preparation cancelled');resources?.beginSlice();resources?.drain();cpuTurns++;
 }
 async function initialize(){
  if(resources)return;live();
  // This bounded host owns one provider, one prepared patch, two native probe
  // buffers at a time, and at most the native module's 65535 vertices. It does
  // not claim to measure JS engine or driver heap.
  wrapper??=metadataOwner.reserve(WRAPPER_BYTES,{owner:'main-native-support',phase:'bounded-private-resource-graph'});
  kernel??=await K.create({bindingOwner,hostProfileEnvelope,readSource,releaseStore,metadataOwner});
  const p=profiles.local;if(!p||!Array.isArray(p.sourcePaths))fail('SOURCE_PROFILE_MISMATCH','Pinned complete native source paths are required');
  const vertex=Program.VERTEX,fragment=Program.surfaceFragment(root.SphereShaders.fragment);
  if(await R.sha256(new TextEncoder().encode(vertex))!==p.vertexSha256||await R.sha256(new TextEncoder().encode(fragment))!==p.fragmentSha256)fail('SOURCE_PROFILE_MISMATCH','Actual native shader assembly differs from its source profile');
  programCharge??=metadataOwner.reserve((vertex.length+fragment.length)*8+131072,{owner:'main-native-support',phase:'program-source-and-uniform-reflection'});
  const compile=(type,source)=>{const shader=gl.createShader(type);if(!shader)fail('GPU_ALLOCATION_FAILED','Native shader allocation failed');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))fail('SHADER_COMPILE_FAILED',gl.getShaderInfoLog(shader));return shader;};
  program=gl.createProgram();if(!program)fail('GPU_ALLOCATION_FAILED','Native program allocation failed');gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
  gl.transformFeedbackVaryings(program,['vEyePosition','vBpsProjectedPosition'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))fail('SHADER_LINK_FAILED',gl.getProgramInfoLog(program));
  vao=gl.createVertexArray();if(!vao)fail('GPU_ALLOCATION_FAILED','Native scratch VAO allocation failed');
  const priorVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);try{gl.bindVertexArray(vao);if(!gl.isVertexArray(vao)||gl.getError()!==gl.NO_ERROR)fail('GPU_ALLOCATION_FAILED','Native scratch VAO was not admitted');}finally{gl.bindVertexArray(priorVao);}
  gpu=G.create({gl,program,vao,drawProfile:'host-world-surface-v1'});
  streamBackend=StreamBackend.create({gl,baseGpu:gpu,baseProgram:program});
  // Reserve the entire child capacity prospectively. Native R checks every
  // allocation, direct factory, staging and retirement against this capacity.
  // The loan outlives R and every fence; no second independent GPU allowance.
  const nativeCapacity=Math.min(GPU_CAPACITY,serviceResources.inspect().gpuLimitBytes-serviceResources.inspect().gpuHeldBytes);gpuCapacity=serviceResources.reserveGpu(nativeCapacity,{owner:'main-native-support',phase:'entire-native-resource-host-capacity'});
  resources=Resources.createHost({limits:{cpuResidentBytes:8*1048576,cpuTransientBytes:8*1048576,cpuTotalBytes:12*1048576,gpuBufferResidentBytes:nativeCapacity,gpuTextureResidentBytes:nativeCapacity,gpuTransientBytes:nativeCapacity,gpuTotalBytes:nativeCapacity,maxJobs:2,maxUploadBytesPerFrame:262144,maxPrepareOpsPerSlice:4096},backend:streamBackend.backend,createCpu:serviceResources.createCpu,detachCpu:serviceResources.detachCpu,verifyPrepared:record=>bridgeRoot?.bridge.verifyPrepared(record)===true,scheduleYield:yieldOwned});
  bridgeRoot=PH.createBridge({kernel,resourceHost:resources,metadataOwner});
 }
 async function initializeField(){
  if(field)return;const p=profiles.local,rows=new Map([...Extensions.sourceRows(profiles.extensions),...profiles.hostClosure,...profiles.serviceClosure].map(row=>[row.path,row]));
  const closure=p.sourcePaths.map(path=>{const row=rows.get(path);if(!row)fail('SOURCE_PROFILE_MISMATCH','A native source path is missing',{path});return row;});
  sourceOwner??=Sources.createSourceOwner({metadataOwner});
  const programProfile=await R.envelope({format:PB.FORMAT,id:'main-native-surface-program-v1',hostProfileRef:hostProfileEnvelope?{id:hostProfileEnvelope.body.id,digest:hostProfileEnvelope.digest}:null,closure,programs:[{role:'surface',vertexSha256:p.vertexSha256,fragmentSha256:p.fragmentSha256}]});
  programBinding??=await PB.create({gl,profileEnvelope:programProfile,readSource,metadataOwner,sourceOwner});
  programToken??=await programBinding.admit({role:'surface',program,vertexSource:Program.VERTEX,fragmentSource:Program.surfaceFragment(root.SphereShaders.fragment)});
  const profileEnvelope=await R.envelope({format:Field.FORMAT,id:'main-native-local-transform-v1',hostProfileRef:programProfile.body.hostProfileRef,programProfileRef:{id:programProfile.body.id,digest:programProfile.digest},vertexSha256:p.vertexSha256,fragmentSha256:p.fragmentSha256,transformProfile:Transform.PROFILE,qualification:'transform-only-v1',closure});
  field=await Field.create({gl,program,programToken,programBinding,kernel,resourceHost:resources,gpuBackend:gpu,metadataOwner,profileEnvelope,readSource,scheduleYield:yieldOwned,sourceOwner});
 }
 function destination(coreScene,context,regionId){
  const assignment=context.bindingEnvelope.body.assignments.find(v=>v.regionId===regionId);if(!assignment)fail('MISSING_ASSIGNMENT','Exact published local region required');const pose=context.hostAdapter.corePoseFromAddress({address:assignment.frame.origin,altitudeM:160,forward:assignment.frame.inward.map(v=>-v),up:assignment.frame.north,selectedTime:coreScene.time,movementProfile:'manual'},context.snapshot);
  return root.SphereMath.validate({...R.clone(coreScene),position:pose.position,forward:pose.forward,up:pose.up,playing:false,walkMode:false,walkSurface:false,walkPosition:null,shadeAttachment:null,siteId:'',siteAnchor:null});
 }
 function validatedProspective(core){
  const value=R.clone(core),checked=root.SphereMath.validate(value),keys=Object.keys(value).sort();if(value.playing!==false||R.canonicalJSON(keys)!==R.canonicalJSON(Object.keys(checked).sort()))fail('INVALID_VIEW','A complete validated paused Main scene is required');
  for(const key of keys){if(key==='forward'||key==='up'){if(!Array.isArray(value[key])||value[key].length!==3||value[key].some((v,k)=>!Number.isFinite(v)||Math.abs(v-checked[key][k])>8*Number.EPSILON))fail('INVALID_VIEW','The prospective camera basis is not already normalized');}else if(R.canonicalJSON(value[key])!==R.canonicalJSON(checked[key]))fail('INVALID_VIEW','The prospective scene contains an unvalidated field',{field:key});}
  // Validation may round a normalized basis again. Preserve the supplied exact
  // numbers for the independently proved frame; readiness remains bit-exact.
  return value;
 }
 async function prepare({bindingDigest,regionId,coreScene,context,signal,prospectiveCore}={}){
  // Ordinary travel validates its merged candidate once. A public check prepares
  // that same result; the travel hook supplies its already validated exact core.
  // Whole-frustum and Main-eye proofs still independently admit the complete pose.
  live();if(busy||retirementStarted)fail('PREPARATION_BUSY','Settle native preparation or retirement before reuse');const destinationCore=validatedProspective(prospectiveCore===undefined?root.SphereMath.validate(destination(coreScene,context,regionId)):prospectiveCore),requestedViewport={width:renderer.canvas.width,height:renderer.canvas.height},requestedLayout=renderer.frameLayout(destinationCore,requestedViewport.width,requestedViewport.height),key=R.canonicalJSON({bindingDigest,regionId,core:destinationCore,viewport:requestedViewport,rasterLayout:requestedLayout});if(last&&preparedKey===key)return R.clone(last);if(preparedKey)fail('REPLACEMENT_UNPREPARED','Retire this bounded prototype before preparing another binding');busy=true;preparedKey=key;
  try{
   await initialize();stream??=Stream.create({renderer,kernel,providerOwner:bridgeRoot,resourceHost:resources,gpuBackend:gpu,streamBackend,metadataOwner,profiles,hostProfileEnvelope,readSource,scheduleYield:yieldOwned,yieldSlice:yieldSliceOwned,onPhase});await stream.initialize();if(signal?.aborted)fail('CANCELLED','Local preparation cancelled');
   const nativeContext=bindingOwner.inspectBinding(await bindingOwner.resolveBinding(bindingDigest,{signal}));
   if(R.canonicalJSON(nativeContext.bindingEnvelope)!==R.canonicalJSON(context.bindingEnvelope))fail('RESOURCE_CORRUPT','Native preparation requires the same exact published binding');
   const assignment=nativeContext.bindingEnvelope.body.assignments.find(v=>v.regionId===regionId);if(!assignment)fail('MISSING_ASSIGNMENT','Exact installed region is absent');
   const release=await releaseStore.getRelease(assignment.releaseDigest),verified=await R.verifyRelease(new Uint8Array(release.rawManifest),release.release,release.resources),manifest=verified.manifest,asset=manifest.assets.find(v=>v.id===manifest.recipeAssetId),recipe=R.parse(release.resources.get(asset.path));
   if(verified.release.payloadDigest!==assignment.releaseDigest)fail('RESOURCE_CORRUPT','The retained release differs from the exact assigned release');
   const selected=extensions.select(manifest),Factory=selected.factory;
   Factory.validateRecipe(recipe,manifest);const recipeToken=kernel.issueRecipe(recipe,manifest);semanticContext=await kernel.bind(bindingDigest,regionId,recipeToken);
   const configured=selected.configured,admission=await Profiles.admit([selected.provider],new Map([[Factory.extensionId,configured]]),readSource,{backendProfiles:[Factory.backendProfile]}),provider=resources.createProvider(manifest.budgets);
   admission.negotiate(manifest);services=bridgeRoot.bridge.issueServices({manifest,semanticContext,providerServices:provider});const hostFactory=PH.makeFactory({packId:manifest.packId,extensionId:Factory.extensionId,recipeSchemaId:Factory.recipeSchemaId,recipe,capabilities:Factory.supportedCapabilities,validatePresentation:Factory.codec.validatePresentation});const nativeConfigured=hostFactory.configure(selected.provider);if(R.canonicalJSON(nativeConfigured.reference)!==R.canonicalJSON(configured.reference))fail('UNSUPPORTED_PROVIDER','Versioned host adapter differs from the verified semantic provider');instance=nativeConfigured.create(recipe,services);
   const eye={xM:0,yM:0,heightM:160},preparedCore=destinationCore,viewport=requestedViewport,coverageProof=Model.coverage({core:preparedCore,context:kernel.inspectContext(semanticContext),viewport,eye,minimumHeightM:0}),requiredRadiusM=coverageProof.requiredRadiusM;
   onPhase('Building the exact terrain and support triangles');const request=bridgeRoot.bridge.beginRequest(instance,{eye,requiredRadiusM,maximumCellM:4,tier:'detail'});providerLease=await instance.prepare(request,semanticContext,{maxPrepareOpsPerSlice:4096,maxUploadBytesPerFrame:262144},signal);
   const actual=bridgeRoot.bridge.inspectHostPrepared(providerLease),samples=[];
   for(const landmark of recipe.terrain.landmarks??[]){const point={xM:landmark.xM,yM:landmark.yM},semantic=kernel.sample(semanticContext,[point])[0],support=bridgeRoot.bridge.support(providerLease,point.xM,point.yM),errorM=Math.abs(support.heightM-semantic.heightM);if(errorM>.001||semantic.heightM!==landmark.peakM||support.supportFeatureId!==semantic.supportFeatureId)fail('SUPPORT_TOLERANCE','Actual retained landmark support differs from the assigned generator',{landmark:landmark.id,errorM});samples.push({id:landmark.id,...point,semanticHeightM:semantic.heightM,support,errorM});}
   stream??=Stream.create({renderer,kernel,providerOwner:bridgeRoot,resourceHost:resources,gpuBackend:gpu,streamBackend,metadataOwner,profiles,hostProfileEnvelope,readSource,scheduleYield:yieldOwned,yieldSlice:yieldSliceOwned,onPhase});
   const rasterLayout=renderer.frameLayout(preparedCore,viewport.width,viewport.height);
   const fullStream=await stream.prepare({semanticContext,providerLease,preparedCore,coverageProof,rasterLayout,signal});
   receipt=stream.admitView({core:preparedCore,rasterLayout});
   last={status:'NATIVE_LOCAL_FRAME_PREPARED',revision:REVISION,bindingDigest,regionId,releaseDigest:assignment.releaseDigest,contextDigest:actual.contextDigest,indexDigest:actual.indexDigest,eye,requiredRadiusM,coverage:R.clone(actual.coverage),landmarks:samples,provider:manifest.provider,staticGeometry:{vertices:actual.geometry.vertices.length,indices:actual.geometry.indices.length,features:actual.geometry.features.map(f=>({id:f.id,solid:f.solid,firstIndex:f.firstIndex,indexCount:f.indexCount}))},passablePopulationCount:bridgeRoot.bridge.staticCollision(providerLease).passablePopulationCount,stream:fullStream,prospectiveCore:preparedCore,viewport,rasterLayout,wholeViewRefusal:null,visualCoverageReady:true,travelCommitted:false,scope:'EXACT_PREPARED_PAUSED_MAIN_LOCAL_VIEW_ONLY; ACTUAL_ARRIVAL_NOT_YET_COMMITTED'};
   return R.clone(last);
  }finally{busy=false;}
 }
 function inspect(){return {revision:REVISION,busy,closed,retirementStarted,preparedKey,yields,result:last?R.clone(last):null,resources:resources?.inspect()??null,field:field?.inspect()??null,stream:stream?.inspect()??null,gpu:gpu?.inspect()??null,retirement:retirement?R.clone(retirement):null,sharedResources:serviceResources.inspect(),active:!!stream?.inspect().active,qualification:last?.visualCoverageReady?'EXACT_NATIVE_LOCAL_FRAME_PREPARED':'NO_ADMITTED_LOCAL_FRAME'};}
 function dispose(){
  if(closed)return;if(busy)fail('PREPARATION_BUSY','Settle Main native preparation before disposal');retirementStarted=true;
  if(stream?.inspect().pendingSupportQueries||root.SphereMainSurfaceSlot?.pendingFor(owner))fail('RESOURCES_HELD','Settle the admitted support query and answer before native retirement');
  root.SphereMainSurfaceSlot?.clear(owner);if(supportCacheCharge)fail('RESOURCES_HELD','Release the funded Main support cache before native retirement');
  const materialState=stream?.inspect().material;if((materialState?.uncertain||materialState?.pendingRestore||materialState?.capturedFrame)&&!gl.isContextLost())fail('COMMITTED_UNCERTAIN','Unresolved Main uniform restoration retains every native resource and capacity');
  field?.dispose();receipt=null;field=null;
  stream?.releaseResources();
  if(providerLease){bridgeRoot.bridge.release(providerLease);providerLease=null;}instance?.dispose();instance=null;bridgeRoot?.bridge.dispose();bridgeRoot=null;kernel?.dispose();kernel=null;
  if(resources){resources.dispose();if(!gl.isContextLost()){gl.finish();if(gl.getError()!==gl.NO_ERROR)fail('GPU_RETIREMENT_UNCERTAIN','Native host completion remains unresolved');}if(resources.inspect().physicalResources){resources.beginSlice();resources.drain();}const remaining=resources.inspect();if(remaining.physicalResources||remaining.cpuReaders||remaining.gpuReaders||remaining.logicalLeases||remaining.jobs)fail('RESOURCES_HELD','Retire all actual native buffers/readers/jobs before refunding the capacity',{remaining});retirement={nativeHost:remaining};resources=null;}
  if(gpu?.inspect().pendingFeedback||streamBackend?.inspect().pendingFeedback)fail('RESOURCES_HELD','Native transform objects retain the complete GPU capacity');gpuCapacity?.release();gpuCapacity=null;
  stream?.dispose();stream=null;
  programBinding?.dispose();programBinding=null;sourceOwner?.dispose();sourceOwner=null;
  if(!gl.isContextLost()){if(program){if(gl.getParameter(gl.CURRENT_PROGRAM)===program)gl.useProgram(renderer.modernProgram);gl.deleteProgram(program);if(gl.isProgram(program))fail('GPU_RETIREMENT_UNCERTAIN','Native program remains physically held');}for(const shader of shaders)gl.deleteShader(shader);if(vao){gl.deleteVertexArray(vao);if(gl.isVertexArray(vao))fail('GPU_RETIREMENT_UNCERTAIN','Native VAO remains physically held');}if(gl.getError()!==gl.NO_ERROR)fail('GPU_RETIREMENT_UNCERTAIN','Native program retirement remains unresolved');}
  if(cpuPending)fail('RESOURCES_HELD','Settle the bounded CPU continuation before disposal');cpuChannel?.port1.close();cpuChannel?.port2.close();cpuChannel=null;
  retirement={...retirement,physicalProgramRetired:true,physicalVaoRetired:true,sourceOwnerRetired:true,cpuTurns};program=null;shaders=[];vao=null;programCharge?.release();programCharge=null;wrapper?.release();wrapper=null;last=null;closed=true;
 }
 async function retire({signal}={}){
  for(let attempt=0;attempt<8;attempt++){
   if(signal?.aborted)fail('CANCELLED','Native retirement cancelled with outstanding charges retained');
   try{dispose();retirement={...retirement,deferredCompletionTurns:attempt};return inspect();}catch(error){if(error.code!=='RESOURCES_HELD'||!resources?.inspect().retiringResources&&!stream?.inspect().pendingSupportQueries&&!root.SphereMainSurfaceSlot?.pendingFor(owner))throw error;}
   // WebGL fence status must become observable in a later browser task. The
   // entire child capacity, source/program and private graph stay funded.
   await scheduleYield();
  }
  fail('RESOURCES_HELD','Native GPU completion is still pending; all outstanding capacities remain reserved');
 }
 function ready(core){if(!receipt||!stream)return false;const layout=renderer.frameLayout(core,renderer.canvas.width,renderer.canvas.height);return stream.matches(core,layout);}
 function activate(core){live();if(!ready(core))fail('STALE_LOCAL_VIEW','Exact prepared local frame required at synchronous arrival');stream.activate(receipt,core,renderer.frameLayout(core,renderer.canvas.width,renderer.canvas.height));last.travelCommitted=true;}
 function deactivate(){stream?.deactivate();}
 function draw(core,layout){return stream?.draw(core,layout)??false;}
 function fundSupportCache(bytes){live();if(bytes!==524288||supportCacheCharge)fail('RESOURCE_LIMIT','One fixed funded Main support cache required');const charge=metadataOwner.reserve(bytes,{owner:'main-surface-query-cache',phase:'bounded-four-answer-cache'});supportCacheCharge=charge;return Object.freeze({release:()=>{if(supportCacheCharge!==charge)return false;supportCacheCharge=null;return charge.release();}});}
 const owner=Object.freeze({usesRenderer:value=>value===renderer,usesMetadataOwner:value=>value===metadataOwner,fundSupportCache,destination,ready,activate,deactivate,draw,castWorld:(...args)=>stream?.castWorld(...args)??null,isActive:()=>stream?.isActive()??false,matches:(core,layout)=>stream?.matches(core,layout)??false,frameInfo:()=>({bindingDigest:last?.bindingDigest??null,regionId:last?.regionId??null,...stream?.frameInfo()}),prepare,inspect,dispose,retire});owners.add(owner);return owner;
}
const api=Object.freeze({REVISION,GPU_CAPACITY,WRAPPER_BYTES,create,isOwner:value=>owners.has(value)});root.SphereBiomeMainLocalSupportV5=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
