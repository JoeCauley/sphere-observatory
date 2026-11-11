/* Native preparation in Main's existing GL context. Transform/support evidence
 * is deliberately separate from admitted fragment fields and travel readiness. */
(function(root){
'use strict';
const node=typeof module!=='undefined',get=(name,path)=>root[name]||(node?require(path):null);
const R=get('SphereBiomeRecords','./records.js'),Q=get('SphereBiomeMetadataBudget','./metadata-budget.js'),B=(node?require('./binding-builder.v2.js'):root.SphereBiomeBindingBuilder),Shared=get('SphereBiomeServiceResources','./service-resources.v1.js'),K=get('SphereBiomeNativeSurfaceKernelV2','./native/surface-kernel.v2.js'),PH=get('SphereBiomeNativeProviderHostV2','./native/provider-host.v2.js'),Resources=get('SphereBiomeNativeResources','./native/resource-leases.js'),G=get('SphereBiomeSharedGpuBackend','./native/shared-gpu-backend.js'),PB=get('SphereBiomeNativeRootProgramBinding','./native/root-program-binding.js'),Field=get('SphereBiomeNativeLocalFieldV2','./native/local-field.v2.js'),Program=get('SphereBiomeNativeSurfaceProgram','./native/native-surface-program.js'),Sources=get('SphereBiomeNativeSourceAdmission','./native/source-admission.js'),Transform=get('SphereBiomeNativeLocalTransform','./native/local-transform.js'),Profiles=get('SphereBiomeProviderProfiles','./provider-profiles.js'),Extensions=get('SphereBiomeFixtureProviderRegistry','./fixture-provider-registry.v1.js');
const Model=get('SphereBiomeLocalStreamModelV4','./native/local-stream-model.v4.js'),StreamBackend=get('SphereBiomeLocalStreamBackendV3','./native/local-stream-backend.v3.js'),Stream=get('SphereBiomeMainLocalStreamV5','./main-local-stream.v5.js');
const Pool=get('SphereBiomeMainNativeProgramPool','./main-native-program-pool.v1.js'),Graph=get('SphereBiomeMainNativeFrameGraph','./main-native-frame-graph.v1.js');
const REVISION='main-native-paired-frame-v1',GPU_CAPACITY=4*1048576,owners=new WeakSet();
function fail(code,message,details={}){throw R.error(code,message,details,'main-local-support');}
function create({renderer,bindingOwner,metadataOwner,serviceResources,releaseStore,hostProfileEnvelope,profiles,extensions,readSource,scheduleYield,programPool,graphOwner,sharedKernel,frameId,onPhase=()=>{}}={}){
 if(!Pool.isOwner(programPool)||!programPool.usesRenderer(renderer)||!programPool.usesMetadataOwner(metadataOwner)||!Graph.isOwner(graphOwner)||!graphOwner.usesRenderer(renderer)||!graphOwner.usesMetadataOwner(metadataOwner)||!K.isOwner(sharedKernel)||!sharedKernel.isMetadataOwner(metadataOwner)||!Number.isSafeInteger(frameId)||frameId<1||!Extensions.isOwner(extensions)||!B.isOwner(bindingOwner)||!Q.isOwner(metadataOwner)||!Shared.isOwner(serviceResources)||!serviceResources.usesMetadataOwner(metadataOwner)||!renderer?.gl||renderer.canvas?.getContext('webgl2')!==renderer.gl||typeof readSource!=='function'||typeof scheduleYield!=='function')fail('FOREIGN_OWNER','Native preparation requires the actual Main, version-two binding and common resource owners');
 const gl=renderer.gl,graphLoan=graphOwner.retainFrame();let programLoan=null,initializationStarted=false;let busy=false,closed=false,retirementStarted=false,wrapper,gpuCapacity,kernel,gpu,streamBackend,stream,resources,bridgeRoot,instance,services,semanticContext,providerLease,sourceOwner,programBinding,programToken,field,receipt,program,vao,programCharge,shaders=[],last=null,preparedKey=null,yields=0,retirement=null,cpuChannel=null,cpuPending=null,cpuTurns=0,supportCacheCharge=null;
 function live(){graphLoan.check();if(closed)fail('OWNER_DISPOSED','Main native support owner is closed');if(gl.isContextLost())fail('CONTEXT_LOST','Main GL context is lost');}
 async function yieldOwned({signal}={}){if(signal?.aborted)fail('CANCELLED','Local native preparation cancelled');await scheduleYield();live();resources?.beginFrame();resources?.beginSlice();resources?.drain();yields++;if(signal?.aborted)fail('CANCELLED','Local native preparation cancelled');}
 async function yieldSliceOwned({signal}={}){
  if(signal?.aborted)fail('CANCELLED','Local CPU preparation cancelled');live();if(!root.MessageChannel){await yieldOwned({signal});return;}
  if(cpuPending)fail('PREPARATION_BUSY','One bounded CPU continuation per native owner');
  if(!cpuChannel){graphLoan.check();cpuChannel=new root.MessageChannel();cpuChannel.port1.onmessage=()=>{const resolve=cpuPending;cpuPending=null;resolve?.();};}
  await new Promise(resolve=>{cpuPending=resolve;cpuChannel.port2.postMessage(0);});live();if(signal?.aborted)fail('CANCELLED','Local CPU preparation cancelled');resources?.beginSlice();resources?.drain();cpuTurns++;
 }
 async function initialize(){
  if(resources)return;live();if(initializationStarted)fail('PREPARATION_FAILED','Retire the failed frame attempt before retry');initializationStarted=true;await programPool.initialize();programLoan=programPool.retainFrame();const assets=programPool.assets();program=assets.baseProgram;kernel=sharedKernel;vao=gl.createVertexArray();if(!vao)fail('GPU_ALLOCATION_FAILED','Native frame VAO allocation failed');const prior=gl.getParameter(gl.VERTEX_ARRAY_BINDING);try{gl.bindVertexArray(vao);if(!gl.isVertexArray(vao)||gl.getError()!==gl.NO_ERROR)fail('GPU_ALLOCATION_FAILED','Actual frame VAO was not admitted');}finally{gl.bindVertexArray(prior);}
  gpu=G.create({gl,program,vao,drawProfile:'host-world-surface-v1'});streamBackend=StreamBackend.create({gl,baseGpu:gpu,baseProgram:program});
  const nativeCapacity=GPU_CAPACITY;gpuCapacity=serviceResources.reserveGpu(nativeCapacity,{owner:'main-native-frame',phase:'complete-four-MiB-frame-resource-host'});
  resources=Resources.createHost({limits:{cpuResidentBytes:8*1048576,cpuTransientBytes:8*1048576,cpuTotalBytes:12*1048576,gpuBufferResidentBytes:nativeCapacity,gpuTextureResidentBytes:nativeCapacity,gpuTransientBytes:nativeCapacity,gpuTotalBytes:nativeCapacity,maxJobs:2,maxUploadBytesPerFrame:262144,maxPrepareOpsPerSlice:4096},backend:streamBackend.backend,createCpu:serviceResources.createCpu,detachCpu:serviceResources.detachCpu,verifyPrepared:record=>bridgeRoot?.bridge.verifyPrepared(record)===true,scheduleYield:yieldOwned});bridgeRoot=PH.createBridge({kernel,resourceHost:resources,metadataOwner});
 }
 function validatedProspective(core){
  const value=R.clone(core),checked=root.SphereMath.validate(value),keys=Object.keys(value).sort();if(value.playing!==false||R.canonicalJSON(keys)!==R.canonicalJSON(Object.keys(checked).sort()))fail('INVALID_VIEW','A complete validated paused Main scene is required');
  for(const key of keys){if(key==='forward'||key==='up'){if(!Array.isArray(value[key])||value[key].length!==3||value[key].some((v,k)=>!Number.isFinite(v)||Math.abs(v-checked[key][k])>8*Number.EPSILON))fail('INVALID_VIEW','The prospective camera basis is not already normalized');}else if(R.canonicalJSON(value[key])!==R.canonicalJSON(checked[key]))fail('INVALID_VIEW','The prospective scene contains an unvalidated field',{field:key});}
  // Validation may round a normalized basis again. Preserve the supplied exact
  // numbers for the independently proved frame; readiness remains bit-exact.
  return value;
 }
 async function prepare({bindingDigest,regionId,coreScene,context,signal,prospectiveCore,semanticPlan,eye,viewpoint}={}){
  // Ordinary travel validates its merged candidate once. A public check prepares
  // that same result; the travel hook supplies its already validated exact core.
  // Whole-frustum and Main-eye proofs still independently admit the complete pose.
  live();if(busy||retirementStarted)fail('PREPARATION_BUSY','Settle native preparation or retirement before reuse');const destinationCore=validatedProspective(prospectiveCore),requestedViewport={width:renderer.canvas.width,height:renderer.canvas.height},requestedLayout=renderer.frameLayout(destinationCore,requestedViewport.width,requestedViewport.height),key=R.canonicalJSON({bindingDigest,regionId,eye,core:destinationCore,viewport:requestedViewport,rasterLayout:requestedLayout});if(last&&preparedKey===key)return R.clone(last);if(preparedKey)fail('REPLACEMENT_UNPREPARED','Retire this bounded prototype before preparing another binding');busy=true;preparedKey=key;
  try{
   await initialize();stream??=Stream.create({renderer,kernel,providerOwner:bridgeRoot,resourceHost:resources,gpuBackend:gpu,streamBackend,metadataOwner,profiles,hostProfileEnvelope,readSource,programPool,scheduleYield:yieldOwned,yieldSlice:yieldSliceOwned,onPhase});await stream.initialize();if(signal?.aborted)fail('CANCELLED','Local preparation cancelled');
   const nativeContext=bindingOwner.inspectBinding(await bindingOwner.resolveBinding(bindingDigest,{signal}));
   if(R.canonicalJSON(nativeContext.bindingEnvelope)!==R.canonicalJSON(context.bindingEnvelope))fail('RESOURCE_CORRUPT','Native preparation requires the same exact published binding');
   const assignment=nativeContext.bindingEnvelope.body.assignments.find(v=>v.regionId===regionId);if(!assignment)fail('MISSING_ASSIGNMENT','Exact installed region is absent');
   if(!semanticPlan||semanticPlan.bindingDigest!==bindingDigest||semanticPlan.regionId!==regionId)fail('NATIVE_CONTEXT_MISMATCH','The shared exact semantic plan is required');const {manifest,recipe,selected}=semanticPlan,Factory=selected.factory;semanticContext=semanticPlan.semanticContext;const semantic=kernel.inspectContext(semanticContext);if(semantic.bindingDigest!==bindingDigest||semantic.assignment.regionId!==regionId)fail('NATIVE_CONTEXT_MISMATCH','Foreign shared semantic receipt');
   const configured=selected.configured,admission=await Profiles.admit([selected.provider],new Map([[Factory.extensionId,configured]]),readSource,{backendProfiles:[Factory.backendProfile]}),provider=resources.createProvider(manifest.budgets);
   admission.negotiate(manifest);services=bridgeRoot.bridge.issueServices({manifest,semanticContext,providerServices:provider});const hostFactory=PH.makeFactory({packId:manifest.packId,extensionId:Factory.extensionId,recipeSchemaId:Factory.recipeSchemaId,recipe,capabilities:Factory.supportedCapabilities,validatePresentation:Factory.codec.validatePresentation});const nativeConfigured=hostFactory.configure(selected.provider);if(R.canonicalJSON(nativeConfigured.reference)!==R.canonicalJSON(configured.reference))fail('UNSUPPORTED_PROVIDER','Versioned host adapter differs from the verified semantic provider');instance=nativeConfigured.create(recipe,services);
   const preparedCore=destinationCore,viewport=requestedViewport,coverageProof=Model.coverage({core:preparedCore,context:kernel.inspectContext(semanticContext),viewport,eye,minimumHeightM:0}),requiredRadiusM=coverageProof.requiredRadiusM;
   onPhase('Building the exact terrain and support triangles');const request=bridgeRoot.bridge.beginRequest(instance,{eye,requiredRadiusM,maximumCellM:4,tier:'detail'});providerLease=await instance.prepare(request,semanticContext,{maxPrepareOpsPerSlice:4096,maxUploadBytesPerFrame:262144},signal);
   const actual=bridgeRoot.bridge.inspectHostPrepared(providerLease),samples=[];
   for(const landmark of recipe.terrain.landmarks??[]){const point={xM:landmark.xM,yM:landmark.yM},semantic=kernel.sample(semanticContext,[point])[0],support=bridgeRoot.bridge.support(providerLease,point.xM,point.yM),errorM=Math.abs(support.heightM-semantic.heightM);if(errorM>.001||semantic.heightM!==landmark.peakM||support.supportFeatureId!==semantic.supportFeatureId)fail('SUPPORT_TOLERANCE','Actual retained landmark support differs from the assigned generator',{landmark:landmark.id,errorM});samples.push({id:landmark.id,...point,semanticHeightM:semantic.heightM,support,errorM});}
   stream??=Stream.create({renderer,kernel,providerOwner:bridgeRoot,resourceHost:resources,gpuBackend:gpu,streamBackend,metadataOwner,profiles,hostProfileEnvelope,readSource,programPool,scheduleYield:yieldOwned,yieldSlice:yieldSliceOwned,onPhase});
   const rasterLayout=renderer.frameLayout(preparedCore,viewport.width,viewport.height);
   const fullStream=await stream.prepare({semanticContext,providerLease,preparedCore,coverageProof,rasterLayout,signal});
   receipt=stream.admitView({core:preparedCore,rasterLayout});
   last={status:'NATIVE_LOCAL_FRAME_PREPARED',revision:REVISION,frameId,viewpoint,materialAssetPlanKey:fullStream.materialAssetPlanKey,bindingDigest,regionId,releaseDigest:assignment.releaseDigest,contextDigest:actual.contextDigest,indexDigest:actual.indexDigest,eye,requiredRadiusM,coverage:R.clone(actual.coverage),landmarks:samples,provider:manifest.provider,staticGeometry:{vertices:actual.geometry.vertices.length,indices:actual.geometry.indices.length,features:actual.geometry.features.map(f=>({id:f.id,solid:f.solid,firstIndex:f.firstIndex,indexCount:f.indexCount}))},passablePopulationCount:bridgeRoot.bridge.staticCollision(providerLease).passablePopulationCount,stream:fullStream,prospectiveCore:preparedCore,viewport,rasterLayout,wholeViewRefusal:null,visualCoverageReady:true,travelCommitted:false,scope:'EXACT_PREPARED_PAUSED_MAIN_LOCAL_VIEW_ONLY; ACTUAL_ARRIVAL_NOT_YET_COMMITTED'};
   return R.clone(last);
  }finally{busy=false;}
 }
 function inspect(){return {revision:REVISION,frameId,busy,closed,retirementStarted,preparedKey,yields,result:last?R.clone(last):null,resources:resources?.inspect()??null,field:field?.inspect()??null,stream:stream?.inspect()??null,gpu:gpu?.inspect()??null,retirement:retirement?R.clone(retirement):null,sharedResources:serviceResources.inspect(),active:!!stream?.inspect().active,qualification:last?.visualCoverageReady?'EXACT_NATIVE_LOCAL_FRAME_PREPARED':'NO_ADMITTED_LOCAL_FRAME'};}
 function dispose(){
  if(closed)return;if(busy)fail('PREPARATION_BUSY','Settle Main native preparation before disposal');retirementStarted=true;
  if(stream?.inspect().pendingSupportQueries)fail('RESOURCES_HELD','Settle the admitted support query before frame retirement');
  const materialState=stream?.inspect().material;if((materialState?.uncertain||materialState?.pendingRestore||materialState?.capturedFrame)&&!gl.isContextLost())fail('COMMITTED_UNCERTAIN','Unresolved Main uniform restoration retains every native resource and capacity');
  field?.dispose();receipt=null;field=null;
  stream?.releaseResources();
  if(providerLease){bridgeRoot.bridge.release(providerLease);providerLease=null;}instance?.dispose();instance=null;bridgeRoot?.bridge.dispose();bridgeRoot=null;kernel=null;
  if(resources){resources.dispose();if(!gl.isContextLost()){gl.finish();if(gl.getError()!==gl.NO_ERROR)fail('GPU_RETIREMENT_UNCERTAIN','Native host completion remains unresolved');}if(resources.inspect().physicalResources){resources.beginSlice();resources.drain();}const remaining=resources.inspect();if(remaining.physicalResources||remaining.cpuReaders||remaining.gpuReaders||remaining.logicalLeases||remaining.jobs)fail('RESOURCES_HELD','Retire all actual native buffers/readers/jobs before refunding the capacity',{remaining});retirement={nativeHost:remaining};resources=null;}
  if(gpu?.inspect().pendingFeedback||streamBackend?.inspect().pendingFeedback)fail('RESOURCES_HELD','Native transform objects retain the complete GPU capacity');
  stream?.dispose();stream=null;if(vao&&!gl.isContextLost()){gl.deleteVertexArray(vao);if(gl.isVertexArray(vao)||gl.getError()!==gl.NO_ERROR)fail('GPU_RETIREMENT_UNCERTAIN','Frame VAO still holds graphics bindings');}gpuCapacity?.release();gpuCapacity=null;
  if(cpuPending)fail('RESOURCES_HELD','Settle the bounded CPU continuation before disposal');cpuChannel?.port1.close();cpuChannel?.port2.close();cpuChannel=null;
  programLoan?.close();programLoan=null;retirement={...retirement,frameVaosRetired:true,sharedProgramLoanReleased:true,sharedGraphLoanReleased:true,cpuTurns};program=null;vao=null;graphLoan.close();last=null;closed=true;
 }
 async function retire({signal}={}){
  for(let attempt=0;attempt<8;attempt++){
   if(signal?.aborted)fail('CANCELLED','Native retirement cancelled with outstanding charges retained');
   try{dispose();retirement={...retirement,deferredCompletionTurns:attempt};return inspect();}catch(error){if(error.code!=='RESOURCES_HELD'||!resources?.inspect().retiringResources&&!stream?.inspect().pendingSupportQueries)throw error;}
   // WebGL fence status must become observable in a later browser task. The
   // entire child capacity, source/program and private graph stay funded.
   // Keep the funded channel and all capacities alive through an explicit
   // browser task as well as the animation callback before polling again.
   await yieldSliceOwned();await scheduleYield();
  }
  fail('RESOURCES_HELD','Native GPU completion is still pending; all outstanding capacities remain reserved');
 }
 function ready(core){if(!receipt||!stream)return false;const layout=renderer.frameLayout(core,renderer.canvas.width,renderer.canvas.height);return stream.matches(core,layout);}
 function activate(core){live();if(!ready(core))fail('STALE_LOCAL_VIEW','Exact prepared local frame required at synchronous arrival');stream.activate(receipt,core,renderer.frameLayout(core,renderer.canvas.width,renderer.canvas.height));last.travelCommitted=true;}
 function deactivate(){stream?.deactivate();}
 function draw(core,layout){return stream?.draw(core,layout)??false;}
 const owner=Object.freeze({usesRenderer:value=>value===renderer,usesMetadataOwner:value=>value===metadataOwner,ready,activate,deactivate,draw,castWorld:(...args)=>stream?.castWorld(...args)??null,isActive:()=>stream?.isActive()??false,matches:(core,layout)=>stream?.matches(core,layout)??false,frameInfo:()=>({frameId,eye:last?.eye??null,bindingDigest:last?.bindingDigest??null,regionId:last?.regionId??null,...stream?.frameInfo()}),prepare,inspect,dispose,retire});owners.add(owner);return owner;
}
const api=Object.freeze({REVISION,GPU_CAPACITY,create,isOwner:value=>owners.has(value)});root.SphereBiomeMainNativeFrame=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
