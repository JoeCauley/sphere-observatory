/* Root target ownership component. Root targets share the genuine resource host with providers.
 * Immutable allocations never become legacy renderer field aliases. */
(function(root){'use strict';
const node=typeof module!=='undefined',Records=root.SphereBiomeRecords||(node?require('../records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('../metadata-budget.js'):null),R=root.SphereBiomeNativeResources||(node?require('./resource-leases.js'):null),G=root.SphereBiomeSharedGpuBackend||(node?require('./shared-gpu-backend.js'):null),Sources=root.SphereBiomeNativeSourceAdmission||(node?require('./source-admission.js'):null);
const admitted=new WeakSet(),LAYOUTS=Object.freeze({
 'linear-stencil-v1':Object.freeze({color:'RGBA16F',depth:'DEPTH24_STENCIL8',mask:null,bytesPerPixel:12}),
 'linear-stencil-mask-v1':Object.freeze({color:'RGBA16F',depth:'DEPTH24_STENCIL8',mask:'R8',bytesPerPixel:13}),
 'display-stencil-v1':Object.freeze({color:'RGBA8',depth:'DEPTH24_STENCIL8',mask:null,bytesPerPixel:8})
});
const SOURCE_PATHS=Object.freeze(['biome-service/metadata-budget.js','biome-service/native/overview-index.js','biome-service/native/positions-backend.js','biome-service/native/resource-leases.js','biome-service/native/root-target-backend.js','biome-service/native/shared-gpu-backend.js','biome-service/native/source-admission.js','biome-service/records.js','biome-service/schema-validators.js','world-address.js','world-topology.js'].sort());
function fail(code,message){throw Records.error(code,message,{},'root-target-backend');}
function check(ok,code,message){if(!ok)fail(code,message);}
function integer(value,name){check(Number.isSafeInteger(value)&&value>0&&!Object.is(value,-0),'INVALID_DESCRIPTOR',name+' must be a positive exact integer');return value;}
async function create({gl,program,sharedGpuBackend,metadataOwner,profileEnvelope,readSource,verifyPrepared,verifyBundle,scheduleYield,sourceOwner}={}){
 check(Q?.isOwner(metadataOwner)&&G?.isOwner(sharedGpuBackend)&&sharedGpuBackend.usesDrawObjects(program,gl),'FOREIGN_OWNER','Authentic shared metadata and GPU owners of the same linked program/context are required');
 check(typeof verifyPrepared==='function','INVALID_DESCRIPTOR','Root must retain its existing authentic preparation verifier');
 const retained=await Sources.admit({profileEnvelope,readSource,metadataOwner,sourceOwner,owner:'biome-root-target',phase:'source-admission',extraBytes:32768});
 let resourceHost=null,services=null,disposed=false,lost=false,uncertain=false,generation=0,current=null,sourceReleased=false;
 const sets=new Set(),tokens=new WeakMap(),physical=new WeakMap();
 function live(){check(!disposed&&!resourceHost?.inspect().disposed,'DISPOSED','Root target owner is disposed');check(!lost&&!gl.isContextLost(),'CONTEXT_LOST','Main context is lost');check(!uncertain,'COMMITTED_UNCERTAIN','Unresolved root target bindings remain held until actual context loss');check(sharedGpuBackend.usesDrawObjects(program,gl),'NATIVE_PROGRAM_MISMATCH','The original root draw objects changed or shared GPU authority is unresolved');}
 function settleSource(){if(disposed&&resourceHost&&resourceHost.inspect().physicalResources===0&&!sourceReleased){retained.charge.release();sourceReleased=true;}}
 function deletePhysical(s){
  if(s.deleted)return;check(!uncertain||gl.isContextLost(),'COMMITTED_UNCERTAIN','Unresolved root target objects remain fully charged until authentic context loss');
  if(!lost&&s.generation===generation&&!gl.isContextLost()){
   // Track each deletion independently. A backend fault retains the remaining
   // physical objects and the full original charge until a later drain.
   for(const name of ['mask','depth','color'])if(s[name]){gl.deleteTexture(s[name]);checkedGL();s[name]=null;}
   if(s.framebuffer){gl.deleteFramebuffer(s.framebuffer);checkedGL();s.framebuffer=null;}
  }else{s.mask=s.depth=s.color=s.framebuffer=null;}
  s.deleted=true;s.charge.release();sets.delete(s);
 }
 const backend=Object.freeze({
  createGpu:(...args)=>sharedGpuBackend.backend.createGpu(...args),
  // Preserve the real failed allocation identity through this decoration.
  // R keeps its bytes charged until actual loss proves safe reclamation.
  claimFailedCreation:error=>sharedGpuBackend.backend.claimFailedCreation(error),
  destroyGpu(record){const s=physical.get(record);if(s)deletePhysical(s);else sharedGpuBackend.backend.destroyGpu(record);},
  writeGpu:(...args)=>sharedGpuBackend.backend.writeGpu(...args),createFence:(...args)=>sharedGpuBackend.backend.createFence(...args),pollFence:(...args)=>sharedGpuBackend.backend.pollFence(...args),destroyFence:(...args)=>sharedGpuBackend.backend.destroyFence(...args),submit:(...args)=>sharedGpuBackend.backend.submit(...args),
  verifyContextLoss(){check(gl.isContextLost()===true,'CONTEXT_LOSS_NOT_OBSERVED','Actual physical context loss must precede all resource-host invalidation');return true;},
  loseContext(){check(gl.isContextLost(),'CONTEXT_LOSS_NOT_OBSERVED','Physical loss must precede root target backend invalidation');sharedGpuBackend.backend.loseContext();lost=true;uncertain=false;generation++;},
  restoreContext(){sharedGpuBackend.backend.restoreContext();lost=false;}
 });
 try{
  const p=retained.profile.body;
  check(p.format==='sphere-biome-root-target-profile/1'&&p.id==='root-target-v1'&&p.backend==='sphere-biome-shared-gpu/1'&&Records.canonicalJSON(p.layouts)===Records.canonicalJSON(LAYOUTS),'SOURCE_PROFILE_MISMATCH','Fixed root target layout/profile differs');
  check(p.closure.map(item=>item.path).join('|')===SOURCE_PATHS.join('|'),'SOURCE_PROFILE_MISMATCH','Complete exact root target dependency closure differs');
  check(G.isOwner(sharedGpuBackend)&&sharedGpuBackend.usesDrawObjects(program,gl)&&!gl.isContextLost(),'CONTEXT_LOST','Main GPU owner changed during source admission');
  resourceHost=R.createHost({limits:p.limits,backend,verifyPrepared,verifyBundle,scheduleYield});services=resourceHost.createHostTargetOwner();
 }catch(error){retained.charge.release();throw error;}
 function state(key,allowReleased=false){const s=tokens.get(key);check(s&&(allowReleased||!s.released),'STALE_RELEASE','Unknown, foreign or released target');return s;}
 function checkedGL(){check(gl.getError()===gl.NO_ERROR,'RESOURCE_LIMIT','Root target WebGL allocation/binding failed');}
 function savedBindings(){return {draw:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),read:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),active:gl.getParameter(gl.ACTIVE_TEXTURE),texture:gl.getParameter(gl.TEXTURE_BINDING_2D)};}
 function restoreExact(tasks,verify){let first=null;for(const task of tasks)try{task();}catch(error){first??=error;}if(gl.isContextLost())fail('CONTEXT_LOST','Actual context was lost during root target restoration');try{checkedGL();verify();checkedGL();}catch(error){first??=error;}if(first){uncertain=true;fail('COMMITTED_UNCERTAIN','Exact root target bindings could not be restored');}}
 function bindingTasks(v){return [()=>gl.activeTexture(v.active),()=>gl.bindTexture(gl.TEXTURE_2D,v.texture),()=>gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,v.draw),()=>gl.bindFramebuffer(gl.READ_FRAMEBUFFER,v.read)];}
 function verifyBindings(v){check(gl.getParameter(gl.ACTIVE_TEXTURE)===v.active&&gl.getParameter(gl.TEXTURE_BINDING_2D)===v.texture&&gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===v.draw&&gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)===v.read,'RESTORE_FAILED','Prior root target binding identities differ');}
 function restoreBindings(v){restoreExact(bindingTasks(v),()=>verifyBindings(v));}
 function ownedCallback(callback,value){const result=callback(value);if(result&&typeof result.then==='function'){uncertain=true;fail('COMMITTED_UNCERTAIN','Unexpected asynchronous root target callback has no physical completion proof');}return result;}
 function drop(s){if(s.released)return false;s.released=true;if(current===s)current=null;const observation=resourceHost.inspectResource(s.resource);if(observation.leaseActive)services.release(s.resource);return true;}
 function prepare({width,height,layout}={}, {signal}={}){
  live();check(!signal?.aborted,'CANCELLED','Root target allocation cancelled');integer(width,'Target width');integer(height,'Target height');const shape=LAYOUTS[layout];check(shape,'UNSUPPORTED_PROFILE','Unknown fixed root target layout');
  // Conservative fixed target-owned query, creation and full restoration/verification work.
  services.consumeWork(128);const max=gl.getParameter(gl.MAX_TEXTURE_SIZE);check(Number.isSafeInteger(max)&&width<=max&&height<=max,'RESOURCE_LIMIT','Target dimensions exceed actual texture limit');
  if(shape.color==='RGBA16F')check(!!gl.getExtension('EXT_color_buffer_float'),'UNSUPPORTED_PROFILE','Actual half-float render target capability required');
  const bytes=width*height*shape.bytesPerPixel;check(Number.isSafeInteger(bytes)&&bytes>0,'RESOURCE_LIMIT','Target allocation byte arithmetic exceeds exact limits');
  const charge=metadataOwner.reserve(8192,{owner:'biome-root-target',phase:'target-set'}),s={width,height,layout,bytes,shape,charge,framebuffer:null,color:null,depth:null,mask:null,generation,deleted:false,released:false,resource:null,key:null};sets.add(s);
  let physicalReturned=false;
  try{
   // Charge root shared work before the fixed allocation sequence. Physical
   // image bytes are admitted by R before this factory can allocate anything.
   // The complete fixed sequence was precharged before its first GL query.
   const resource=resourceHost.allocateGpuWithFactory(services,'gpu-texture',bytes,()=>{
    const saved=savedBindings();
    let record;
    try{
     check(!signal?.aborted,'CANCELLED','Root target allocation cancelled');
     s.framebuffer=gl.createFramebuffer();check(s.framebuffer,'RESOURCE_LIMIT','Framebuffer creation failed');gl.bindFramebuffer(gl.FRAMEBUFFER,s.framebuffer);
     function attachment(name,format,point,filter){s[name]=gl.createTexture();check(s[name],'RESOURCE_LIMIT','Attachment creation failed');gl.bindTexture(gl.TEXTURE_2D,s[name]);gl.texStorage2D(gl.TEXTURE_2D,1,gl[format],width,height);for(const [key,value]of [[gl.TEXTURE_MIN_FILTER,filter],[gl.TEXTURE_MAG_FILTER,filter],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);gl.framebufferTexture2D(gl.FRAMEBUFFER,point,gl.TEXTURE_2D,s[name],0);checkedGL();}
     attachment('color',shape.color,gl.COLOR_ATTACHMENT0,shape.color==='RGBA16F'?gl.LINEAR:gl.NEAREST);
     attachment('depth',shape.depth,gl.DEPTH_STENCIL_ATTACHMENT,gl.NEAREST);
     if(shape.mask)attachment('mask',shape.mask,gl.COLOR_ATTACHMENT1,gl.NEAREST);
     gl.drawBuffers(shape.mask?[gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]:[gl.COLOR_ATTACHMENT0]);
     check(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'RESOURCE_LIMIT','Root target framebuffer is incomplete');checkedGL();
     live();check(!signal?.aborted,'CANCELLED','Root target cancelled during allocation');
    }catch(error){s.failure=error;}
    // Return the charged record even after partial allocation fails. Only R's
    // retirement path can relinquish ownership, so a deletion fault retains
    // the full reservation instead of orphaning partially created GL objects.
    try{restoreBindings(saved);}catch(error){if(error?.code==='COMMITTED_UNCERTAIN'||error?.code==='CONTEXT_LOST')s.failure=error;else s.failure??=error;}
    record=Object.freeze({byteLength:bytes});physical.set(record,s);physicalReturned=true;return record;
   },{phase:'staging',layout:'opaque',memoryClass:'resident'});
   s.resource=resource;if(s.failure){drop(s);throw s.failure;}s.key=Object.freeze({});tokens.set(s.key,s);return s.key;
  }catch(error){if(!physicalReturned)deletePhysical(s);throw error;}
 }
 function activate(key,expectedCurrent=null){live();const s=state(key);check((current?.key??null)===expectedCurrent,'STALE_CURRENT','Root target changed before resize commit');check(resourceHost.inspectResource(s.resource).usable&&!s.deleted&&s.generation===generation,'NOT_READY','Prospective target is not usable');if(current===s)return key;const previous=current;current=s;if(previous)drop(previous);return key;}
 function withTarget(key,callback){
  live();const s=state(key);check(typeof callback==='function'&&callback.constructor.name!=='AsyncFunction','BACKEND_CONTRACT','Root draw callback must be statically synchronous');
  services.consumeWork(64);return resourceHost.withGpuUse([s.resource],()=>{
   const saved=savedBindings(),viewport=gl.getParameter(gl.VIEWPORT);
   try{gl.bindFramebuffer(gl.FRAMEBUFFER,s.framebuffer);gl.viewport(0,0,s.width,s.height);checkedGL();return ownedCallback(callback,Object.freeze({width:s.width,height:s.height,layout:s.layout,bytes:s.bytes}));}
   finally{restoreExact([()=>gl.viewport(...viewport),...bindingTasks(saved)],()=>{verifyBindings(saved);const actual=gl.getParameter(gl.VIEWPORT);check(actual.length===viewport.length&&actual.every((value,index)=>Object.is(value,viewport[index])),'RESTORE_FAILED','Prior root viewport differs');});}
  });
 }
 function withSamplers(key,callback){
  live();const s=state(key);check(typeof callback==='function'&&callback.constructor.name!=='AsyncFunction','BACKEND_CONTRACT','Root sampler callback must be statically synchronous');
  services.consumeWork(64);check(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==s.framebuffer,'TARGET_FEEDBACK','A target cannot be sampled while attached for drawing');
  return resourceHost.withGpuUse([s.resource],()=>{
   const active=gl.getParameter(gl.ACTIVE_TEXTURE),saved=[];
   try{for(const [unit,name]of [[1,'color'],[6,'depth'],[13,'mask']])if(s[name]){gl.activeTexture(gl.TEXTURE0+unit);saved.push([unit,gl.getParameter(gl.TEXTURE_BINDING_2D)]);gl.bindTexture(gl.TEXTURE_2D,s[name]);}checkedGL();return ownedCallback(callback,Object.freeze({colorUnit:1,depthUnit:6,maskUnit:s.mask?13:null,width:s.width,height:s.height}));}
   finally{restoreExact([...saved.flatMap(([unit,binding])=>[()=>gl.activeTexture(gl.TEXTURE0+unit),()=>gl.bindTexture(gl.TEXTURE_2D,binding)]),()=>gl.activeTexture(active)],()=>{let matches=true;try{for(const [unit,binding]of saved){gl.activeTexture(gl.TEXTURE0+unit);matches=gl.getParameter(gl.TEXTURE_BINDING_2D)===binding&&matches;}}finally{gl.activeTexture(active);}check(matches&&gl.getParameter(gl.ACTIVE_TEXTURE)===active,'RESTORE_FAILED','Prior root target sampler bindings differ');});}
  });
 }
 function release(key){const s=state(key,true);drop(s);settleSource();return observe(key);}
 function observe(key){const s=state(key,true);return Object.freeze({width:s.width,height:s.height,layout:s.layout,bytes:s.bytes,active:current===s,released:s.released,physicallyRetained:!s.deleted,resource:resourceHost.inspectResource(s.resource)});}
 function inspect(){settleSource();return Object.freeze({scope:'ROOT_TARGET_COMPONENT',current:current?observe(current.key):null,targetSets:sets.size,disposed,uncertain:uncertain||sharedGpuBackend.inspect().uncertain,sourceReleased,resources:resourceHost.inspect(),logicalGpuImages:'EXACT_DECLARED_SIZED_FORMATS',framebufferDriverOverhead:'UNMEASURED',baselineTargets:'NOT_ADMITTED',mainAAAndDepth:'NOT_RUN',mainAppearance:'NOT_RUN',nativeMainReadiness:'NOT_RUN',driverPeak:'UNMEASURED'});}
 function dispose(){check(!(uncertain||sharedGpuBackend.inspect().uncertain)||gl.isContextLost(),'COMMITTED_UNCERTAIN','Unresolved root target authority must remain held until authentic loss');if(!disposed){check(![...sets].some(s=>s.resource&&resourceHost.inspectResource(s.resource).unsafeSubmission&&resourceHost.inspectResource(s.resource).contextUsable),'COMMITTED_UNCERTAIN','Unexpected asynchronous root target use must be invalidated by actual context loss before disposal');disposed=true;current=null;resourceHost.dispose();for(const s of sets)s.released=true;}resourceHost.beginSlice();resourceHost.drain();settleSource();return inspect();}
 const api=Object.freeze({resourceHost,profileEnvelope:retained.profile,usesMetadataOwner:value=>value===metadataOwner,usesSourceOwner:value=>value===sourceOwner,checkAvailable(){live();return true;},prepare,activate,withTarget,withSamplers,release,observe,inspect,
  beginFrame(){live();resourceHost.beginFrame();},beginSlice(){resourceHost.beginSlice();},drain(){resourceHost.drain();settleSource();return inspect();},
  contextLost(){check(gl.isContextLost()===true,'CONTEXT_LOSS_NOT_OBSERVED','Actual WebGL context loss must precede ownership invalidation');if(lost)return inspect();current=null;resourceHost.loseContext();for(const s of sets)if(s.resource)drop(s);settleSource();return inspect();},
  contextRestored(){check(!disposed&&lost,'INVALID_INPUT','Actual lost root context required');resourceHost.restoreContext();},dispose});admitted.add(api);return api;
}
const api=Object.freeze({create,isOwner:value=>admitted.has(value),LAYOUTS,SOURCE_PATHS});root.SphereBiomeRootTargetBackend=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
