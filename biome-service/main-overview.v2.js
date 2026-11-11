/* Main-owned overview of an authentic published binding. This slot does not
 * claim local terrain, collision readiness, or full native qualification. */
(function(root){
'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('./records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('./metadata-budget.js'):null),B=root.SphereBiomeBindingBuilder||(node?require('./binding-builder.v2.js'):null),H=root.SphereBiomeHostWorld||(node?require('./host-world.js'):null),O=root.SphereBiomeOverviewIndex||(node?require('./native/overview-index.js'):null),Shader=root.SphereBiomeOverviewShader||(node?require('./native/overview-shader.js'):null),Recipe=root.SphereBiomeNativeFixtureRecipe||(node?require('./native/fixture-recipe.js'):null);
const Shared=root.SphereBiomeServiceResources||(node?require('./service-resources.v1.js'):null);
const REVISION='main-published-overview-v2-shared-resources',owners=new WeakSet(),contextOwners=new WeakMap(),MAX_GPU=10485760,ROW_BYTES=O.SIDE*16,MAX_NODES_PER_SLICE=128;
function fail(code,message,details={}){throw R.error(code,message,details,'main-overview');}
function check(signal){if(signal?.aborted)fail('CANCELLED','Installed overview preparation cancelled');}
function equal(a,b){return R.canonicalJSON(a)===R.canonicalJSON(b);}
async function create({renderer,bindingOwner,metadataOwner,serviceResources,releaseStore,profile,readSource,scheduleYield,shaderSource=root.SphereShaders}={}){
 if(!B.isOwner(bindingOwner)||!Q.isOwner(metadataOwner)||!renderer?.gl||!renderer?.canvas||renderer.canvas.getContext('webgl2')!==renderer.gl||!releaseStore?.getRelease||typeof readSource!=='function'||typeof scheduleYield!=='function')fail('FOREIGN_OWNER','Actual Main context, binding and common metadata owners are required');
 if(typeof root.SphereRenderer==='function'&&!(renderer instanceof root.SphereRenderer))fail('FOREIGN_OWNER','The slot must belong to the actual Main renderer');
 if(!Shared.isOwner(serviceResources)||!serviceResources.usesMetadataOwner(metadataOwner))fail('FOREIGN_OWNER','Overview must share the actual service resource owner');
 const gl=renderer.gl;let compiled,programLease,closed=false,busy=false,current=null,gpuHeld=0,gpuPeak=0,frames=0,lastWorldMatch=true,uploads=0,prepareSlices=0,lastFrame=null;
 if(contextOwners.has(gl))fail('OWNER_IN_USE','This Main context already has an overview owner or pending admission');const creation=Object.freeze({});contextOwners.set(gl,creation);
 const stages=new Set(),tickets=new WeakMap();
 function live(){if(closed)fail('OWNER_DISPOSED','Installed overview owner is disposed');if(gl.isContextLost())fail('CONTEXT_LOST','Main graphics context is lost');}
 function reserveGpu(bytes){const shared=serviceResources.reserveGpu(bytes,{owner:'main-overview',phase:'physical-tree-or-upload'});gpuHeld+=bytes;gpuPeak=Math.max(gpuPeak,gpuHeld);let open=true;return {release(){if(!open)return;open=false;gpuHeld-=bytes;shared.release();}};}
 function settleGpu(){if(!gl.isContextLost()){gl.finish();if(gl.getError()!==gl.NO_ERROR)fail('GPU_RETIREMENT_UNCERTAIN','Main must retain overview charges until GPU completion is established');}}
 function releaseTree(state){
  if(state.dead)return;if(state.texture||state.gpu||state.uploadGpu)settleGpu();if(state.texture&&!gl.isContextLost()){gl.deleteTexture(state.texture);if(gl.getError()!==gl.NO_ERROR||gl.isTexture(state.texture))fail('GPU_RETIREMENT_UNCERTAIN','Deleted overview texture remains unresolved');}state.texture=null;
  if(state.source){if(state.source.bytes.buffer.byteLength)state.source.bytes.buffer.transfer(0);state.source.release();state.source=null;}
  if(state.row){if(state.row.buffer.byteLength)state.row.buffer.transfer(0);state.row=null;}
  for(const key of ['gpu','uploadGpu','working','metadata'])if(state[key]){state[key].release();state[key]=null;}
  state.ctx=state.colors=state.descriptors=state.assignments=null;state.dead=true;stages.delete(state);if(state.ticket)tickets.delete(state.ticket);
 }
 try{
  if(!profile||!Array.isArray(profile.sourcePaths)||!shaderSource?.vertex||!shaderSource?.fragment)fail('SOURCE_PROFILE_MISMATCH','Pinned actual Main shader source is required');
  for(const path of profile.sourcePaths){check();await readSource(path);}
  const fragment=Shader.assemble(shaderSource.fragment),vertex=shaderSource.vertex;
  if(await R.sha256(new TextEncoder().encode(vertex))!==profile.vertexSha256||await R.sha256(new TextEncoder().encode(fragment))!==profile.fragmentSha256)fail('SOURCE_PROFILE_MISMATCH','Actual Main overview shader differs from the pinned assembled source');
  programLease=metadataOwner.reserve((new TextEncoder().encode(vertex).byteLength+new TextEncoder().encode(fragment).byteLength)*4+65536,{owner:'main-overview',phase:'retained-program-source'});
  live();compiled=Shader.createProgram(gl,shaderSource);
  if(compiled.fragment!==fragment)fail('SOURCE_PROFILE_MISMATCH','Compiled Main shader source differs');
 }catch(error){compiled?.dispose();programLease?.release();contextOwners.delete(gl);throw error;}
 async function prepare(bindingHandle,{signal}={}){
  live();check(signal);if(busy)fail('PREPARATION_BUSY','One installed overview owns preparation');busy=true;
  let source,working,metadata,gpu,uploadGpu,texture,state,row;
  try{
   const ctx=bindingOwner.inspectBinding(bindingHandle),binding=ctx.bindingEnvelope,assignments=binding.body.assignments.slice().sort((a,b)=>a.regionId<b.regionId?-1:a.regionId>b.regionId?1:0);
   const colors=[],descriptors=[];for(const a of assignments){check(signal);const release=await releaseStore.getRelease(a.releaseDigest),verified=await R.verifyRelease(new Uint8Array(release.rawManifest),release.release,release.resources),manifest=verified.manifest;
    if(verified.release.payloadDigest!==a.releaseDigest||manifest.packId!==a.packId||manifest.semanticGeneratorId!==a.semanticGeneratorId||!equal(manifest.provider,a.provider))fail('RESOURCE_CORRUPT','Overview recipe differs from its exact assignment');
    const asset=manifest.assets.find(v=>v.id===manifest.recipeAssetId),recipe=Recipe.validateRecipe(R.parse(release.resources.get(asset.path)),manifest);colors.push(recipe.material.albedo);descriptors.push({regionId:a.regionId,packId:manifest.packId,name:manifest.name,version:manifest.version,releaseDigest:a.releaseDigest});
   }
   const observation=ctx.indexApi.inspect(ctx.indexHandle),d=observation.descriptor;
   if(observation.disposed||d.assignmentCount!==assignments.length||d.nodeCount<7||d.nodeCount>O.NODES)fail('INVALID_INDEX','Actual binding and verified ownership index differ');
   metadata=metadataOwner.reserve(R.canonicalBytes({bindingDigest:binding.digest,colors,descriptors,descriptor:d}).byteLength*8+32768,{owner:'main-overview',phase:'retained-ownership-and-appearance'});
   working=metadataOwner.reserve(ROW_BYTES*4+32768,{owner:'main-overview',phase:'bounded-index-upload-row'});
   source=ctx.indexApi.copyBytes(ctx.indexHandle);const bytes=source.bytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
   if(bytes.length!==40+d.nodeCount*16||String.fromCharCode(...bytes.subarray(0,4))!=='SPBX'||view.getUint32(4,true)!==1||view.getUint32(8,true)!==d.nodeCount||view.getUint32(12,true)!==d.assignmentCount)fail('INVALID_INDEX','Exact verified SPBX bytes differ');
   const roots=Array.from({length:6},(_,i)=>view.getUint32(16+i*4,true)),rowCount=Math.ceil(d.nodeCount/O.SIDE);
   // The shader still addresses 512-wide rows and supports all 262144 nodes.
   // Allocate every required row, including reserved node zero and all actual
   // verified references; unused maximum-capacity rows are not materialized.
   const textureBytes=rowCount*ROW_BYTES;gpu=reserveGpu(textureBytes);uploadGpu=reserveGpu(textureBytes);
   live();texture=gl.createTexture();if(!texture)fail('RESOURCE_LIMIT','Main ownership texture allocation refused');
   const priorActive=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+Shader.TEXTURE_UNIT);const prior=gl.getParameter(gl.TEXTURE_BINDING_2D);
   try{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32UI,O.SIDE,rowCount,0,gl.RGBA_INTEGER,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(gl.getError()!==gl.NO_ERROR)fail('GPU_ALLOCATION_FAILED','Main ownership texture was not admitted by GL');}
   finally{gl.bindTexture(gl.TEXTURE_2D,prior);gl.activeTexture(priorActive);}
   row=new Uint32Array(O.SIDE*4);
   for(let y=0;y<rowCount;y++){
    row.fill(0);await scheduleYield();prepareSlices++;live();check(signal);
    const first=y*O.SIDE,last=Math.min(d.nodeCount,first+O.SIDE);
    for(let start=first;start<last;start+=MAX_NODES_PER_SLICE){
     const end=Math.min(last,start+MAX_NODES_PER_SLICE);for(let n=start;n<end;n++)for(let k=0;k<4;k++)row[(n-first)*4+k]=view.getUint32(40+n*16+k*4,true);
     await scheduleYield();prepareSlices++;live();check(signal);
    }
    const active=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+Shader.TEXTURE_UNIT);const priorTexture=gl.getParameter(gl.TEXTURE_BINDING_2D);
    try{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,y,O.SIDE,1,gl.RGBA_INTEGER,gl.UNSIGNED_INT,row);if(gl.getError()!==gl.NO_ERROR)fail('GPU_UPLOAD_FAILED','Main ownership row upload failed');uploads+=ROW_BYTES;}
    finally{gl.bindTexture(gl.TEXTURE_2D,priorTexture);gl.activeTexture(active);}
   }
   settleGpu();uploadGpu.release();uploadGpu=null;check(signal);
   source.bytes.buffer.transfer(0);source.release();source=null;row.buffer.transfer(0);row=null;working.release();working=null;
   const ticket=Object.freeze({});state={ticket,bindingDigest:binding.digest,worldId:binding.body.worldId,ctx,assignments,colors,descriptors,texture,roots,nodeCount:d.nodeCount,textureRows:rowCount,textureBytes,indexDigest:d.digest,assignmentCount:d.assignmentCount,metadata,gpu,dead:false};stages.add(state);tickets.set(ticket,state);metadata=gpu=texture=null;return ticket;
  }catch(error){
   // A failed native retirement keeps its physical handles and all outstanding
   // reservations reachable for explicit disposal retry or observed loss.
   const failed={source,working,metadata,gpu,uploadGpu,texture,row,dead:false};stages.add(failed);try{releaseTree(failed);}catch(cleanupError){error.cleanupError=cleanupError;}throw error;
  }finally{busy=false;}
 }
 function commit(ticket){live();const stage=tickets.get(ticket);if(!stage||!stages.has(stage)||stage.dead||stage===current)fail('FOREIGN_OWNER','A freshly staged exact overview is required');if(renderer.disposalStarted)fail('OWNER_DISPOSED','Main renderer is closing');const previous=current;root.SphereLocation?.setInstalledBiomeOwner(owner);try{renderer.setBiomeOverview(owner);}catch(error){if(!previous)root.SphereLocation?.clearInstalledBiomeOwner(owner);throw error;}current=stage;if(previous)releaseTree(previous);}
 function discard(ticket){const stage=tickets.get(ticket);if(!stage||!stages.has(stage))fail('FOREIGN_OWNER','Only an authentic overview stage may be discarded');if(stage===current)return false;releaseTree(stage);return true;}
 function matches(core){if(!current||current.dead)return false;try{current.ctx.hostAdapter.addressFromCorePose(core,current.ctx.snapshot,{movementProfile:'manual'});return true;}catch(error){if(error.code==='HOST_WORLD_MISMATCH')return false;throw error;}}
 function programFor(core){live();lastWorldMatch=matches(core);return lastWorldMatch?compiled:null;}
 function withFrame(core,uniforms,draw){
  live();if(!current||!matches(core)||uniforms!==compiled.uniforms||gl.getParameter(gl.CURRENT_PROGRAM)!==compiled.program)fail('NATIVE_PROGRAM_MISMATCH','Main must draw the same exact installed overview program/world');
  const frameLease=metadataOwner.reserve(16384,{owner:'main-overview',phase:'synchronous-overview-frame'});
  try{const frame=Shader.frame(core,current.colors),value=Shader.withBound(gl,uniforms,frame,current,draw);if(gl.getError()!==gl.NO_ERROR)fail('GPU_DRAW_FAILED','Main reported an error during the installed overview draw');frames++;const observer=current.ctx.hostAdapter.addressFromCorePose(core,current.ctx.snapshot,{movementProfile:'manual'});lastFrame={bindingDigest:current.bindingDigest,indexDigest:current.indexDigest,address:observer.address,ownership:current.ctx.indexApi.lookup(current.ctx.indexHandle,observer.address),position:core.position.slice(),forward:core.forward.slice(),up:core.up.slice(),selectedTime:core.time,frame:frames,scope:'ACTUAL_HOST_DRAW_SUBMISSION_NOT_NATIVE_PIXEL_BOUND_PROOF'};return value;}finally{frameLease.release();}
 }
 function location(core){
  live();if(!matches(core))return null;const observer=current.ctx.hostAdapter.addressFromCorePose(core,current.ctx.snapshot,{movementProfile:'manual'});if(observer.altitudeM<0)return null;
  const found=current.ctx.indexApi.lookup(current.ctx.indexHandle,observer.address);if(found.kind!=='assignment')return null;const d=current.descriptors.find(v=>v.regionId===found.regionId);if(!d)fail('RESOURCE_CORRUPT','Exact installed location descriptor is missing');
  return {id:'installed-'+d.regionId,title:d.name,region:'Installed biome · '+d.version,frame:'shell',worldId:current.worldId,bindingDigest:current.bindingDigest,regionId:d.regionId,packId:d.packId,releaseDigest:d.releaseDigest,address:observer.address};
 }
 function destination(core,regionId){
  live();if(!matches(core))fail('WORLD_PROFILE_CHANGED','Installed overview belongs to another retained world');const a=current.assignments.find(v=>v.regionId===regionId);if(!a)fail('MISSING_ASSIGNMENT','The region is not installed in this exact binding');
  const radiusM=current.ctx.snapshot.validatedStaticWorldParameters.radius*1000,area=a.core.cells.length*4*Math.PI*radiusM*radiusM/(6*4**a.core.level),altitudeM=Math.min(radiusM*.25,Math.max(1000000,Math.sqrt(area)*2));
  const pose=current.ctx.hostAdapter.corePoseFromAddress({address:a.frame.origin,altitudeM,forward:a.frame.inward.map(v=>-v),up:a.frame.north,selectedTime:core.time,movementProfile:'manual'},current.ctx.snapshot);
  return {...R.clone(core),position:pose.position,forward:pose.forward,up:pose.up,playing:false,walkMode:false,walkSurface:false,walkPosition:null,shadeAttachment:null,siteId:'',siteAnchor:null};
 }
 function inspect(){return {revision:REVISION,closed,busy,bindingDigest:current?.bindingDigest??null,worldId:current?.worldId??null,indexDigest:current?.indexDigest??null,assignmentCount:current?.assignmentCount??0,nodeCount:current?.nodeCount??0,textureRows:current?.textureRows??0,textureBytes:current?.textureBytes??0,maximumNodeCapacity:O.NODES,frames,lastWorldMatch,lastFrame:lastFrame?R.clone(lastFrame):null,gpuHeldBytes:gpuHeld,gpuPeakBytes:gpuPeak,gpuLimitBytes:MAX_GPU,sharedResources:serviceResources.inspect(),uploadedBytes:uploads,prepareSlices,pendingStages:[...stages].filter(v=>v!==current).length,maximumNodesPerSlice:MAX_NODES_PER_SLICE,maximumUploadBytesPerFrame:ROW_BYTES,qualification:'ACTUAL_MAIN_OVERVIEW_INTEGRATION_ONLY_LOCAL_AND_NATIVE_PIXEL_BOUNDS_UNQUALIFIED',nativeHeap:'UNMEASURED'};}
 function dispose(){if(closed)return;if(busy)fail('PREPARATION_BUSY','Settle overview preparation before disposal');renderer.clearBiomeOverview(owner);root.SphereLocation?.clearInstalledBiomeOwner(owner);for(const state of [...stages])releaseTree(state);settleGpu();if(!gl.isContextLost()){if(gl.getParameter(gl.CURRENT_PROGRAM)===compiled.program)gl.useProgram(renderer.modernProgram);compiled.dispose();if(gl.getError()!==gl.NO_ERROR||gl.isProgram(compiled.program))fail('GPU_RETIREMENT_UNCERTAIN','Overview program disposal remains unresolved');}programLease.release();current=null;lastFrame=null;closed=true;contextOwners.delete(gl);}
 const owner=Object.freeze({usesRenderer:value=>value===renderer,usesMetadataOwner:value=>value===metadataOwner,prepare,commit,discard,programFor,withFrame,destination,location,inspect,dispose});owners.add(owner);contextOwners.set(gl,owner);return owner;
}
const api=Object.freeze({REVISION,MAX_GPU,ROW_BYTES,create,isOwner:value=>owners.has(value)});root.SphereBiomeMainOverview=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
