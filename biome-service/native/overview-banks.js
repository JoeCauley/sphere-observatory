/* Fixed ownership banks. The shared host alone owns physical resources. */
(function(root){
'use strict';
const O=root.SphereBiomeOverviewIndex||(typeof module!=='undefined'?require('./overview-index.js'):null);
const R=root.SphereBiomeNativeResources||(typeof module!=='undefined'?require('./resource-leases.js'):null);
const G=root.SphereBiomeSharedGpuBackend||(typeof module!=='undefined'?require('./shared-gpu-backend.js'):null);
function fail(code,message){throw Object.assign(Error(message),{code,phase:'overview-banks'});}
function synchronous(callback){if(typeof callback!=='function'||callback.constructor.name==='AsyncFunction')fail('INVALID_CALLBACK','A synchronous host renderer slot is required');}
function create({host,backend,indexApi}){
 if(!R.isHost(host)||!G.isOwner(backend)||!indexApi||['inspect','copyBytes'].some(k=>typeof indexApi[k]!=='function')||typeof host.inspectResource!=='function'||typeof host.uploadGpuTextureBounded!=='function')fail('INVALID_OWNER','Actual shared resource/backend owners and verified index adapter are required');
 const owner=host.createServiceOwner(),credits=host.createCredits(owner,{uploadQuantum:16}),states=new WeakMap(),banks=new Set();let current=null,closed=false,closing=false,generation=0;
 function alive(){if(closed||closing)fail('DISPOSED','Ownership banks are disposed or closing');if(host.inspect().contextLost)fail('CONTEXT_LOST','Shared renderer context is lost');}
 function state(token,allowRetired=false){alive();const s=states.get(token);if(!s||s.dead||s.generation!==generation||(!allowRetired&&s.retired))fail('STALE_RESOURCE','Ownership bank is unavailable');return s;}
 function closeSource(s){if(s.source){const bytes=s.source.bytes;try{if(bytes.buffer.byteLength)bytes.buffer.transfer(0);}finally{s.source.release();s.source=null;s.view=null;}}}
 function releaseStaging(s){closeSource(s);if(s.staging!==null){owner.release(s.staging);s.staging=null;}}
 function prepare(handle){
  alive();const startedGeneration=generation,observation=indexApi.inspect(handle);alive();if(observation.disposed)fail('INDEX_DISPOSED','Verified index is disposed');
  // This exact copy stays charged by the verified index owner until detached.
  const source=indexApi.copyBytes(handle);let staging=null,gpu=null,s;
  try{
   alive();if(generation!==startedGeneration)fail('STALE_RESOURCE','Context changed during ownership copy');const bytes=source.bytes;if(!(bytes instanceof Uint8Array)||bytes.length<40)fail('INVALID_INDEX','Verified SPBX byte resource is required');
   const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),nodeCount=view.getUint32(8,true),assignmentCount=view.getUint32(12,true),d=observation.descriptor;
   if(String.fromCharCode(...bytes.subarray(0,4))!=='SPBX'||view.getUint32(4,true)!==1||nodeCount<7||nodeCount>O.NODES||assignmentCount>128||bytes.length!==40+nodeCount*16||d.nodeCount!==nodeCount||d.assignmentCount!==assignmentCount)fail('INVALID_INDEX','Exact verified descriptor differs');
   const roots=Object.freeze(Array.from({length:6},(_,i)=>view.getUint32(16+i*4,true)));
   staging=owner.allocateCpu(nodeCount*16,{memoryClass:'transient',phase:'staging'});
   // Reservation precedes the single physical texture creation, including faults.
   gpu=host.allocateGpuWithFactory(owner,'gpu-texture',O.TREE_BYTES,backend.createOwnershipTexture,{memoryClass:'resident',phase:'new'});alive();if(generation!==startedGeneration)fail('STALE_RESOURCE','Context changed during physical creation');
   const token=Object.freeze({});s={token,source,view,staging,gpu,roots,nodeCount,assignmentCount,digest:d.digest,packedNodes:0,uploadedNodes:0,retired:false,dead:false,generation};states.set(token,s);banks.add(s);return token;
  }catch(error){if(gpu!==null)owner.release(gpu);if(staging!==null)owner.release(staging);try{if(source.bytes.buffer.byteLength)source.bytes.buffer.transfer(0);}finally{source.release();}throw error;}
 }
 function pump(token){
  const s=state(token);if(s.staging===null)return Object.freeze({ready:true,uploadedBytes:0,totalUploadedBytes:s.uploadedNodes*16});
  let uploadedBytes=0;const reader=owner.borrowCpu(s.staging);
  try{
   const words=new Uint32Array(reader.value.buffer,reader.value.byteOffset,reader.value.byteLength/4);
   if(s.packedNodes<s.nodeCount){const count=credits.takePrepareCredits(s.nodeCount-s.packedNodes);for(let n=0;n<count;n++){const node=s.packedNodes++;for(let k=0;k<4;k++)words[node*4+k]=s.view.getUint32(40+node*16+k*4,true);}if(s.packedNodes===s.nodeCount)closeSource(s);}
   while(s.uploadedNodes<s.packedNodes){
    const node=s.uploadedNodes,x=node%O.SIDE,y=Math.floor(node/O.SIDE),wanted=Math.min(O.SIDE-x,s.packedNodes-node)*16;
    const used=host.uploadGpuTextureBounded(s.gpu,wanted,16,(records,granted)=>backend.writeOwnership(records[0].value,x,y,words.subarray(node*4,node*4+granted/4)));
    state(token);if(used===0)break;s.uploadedNodes+=used/16;uploadedBytes+=used;
   }
  }finally{reader.close();}
  state(token);const ready=s.uploadedNodes===s.nodeCount;if(ready)releaseStaging(s);
  return Object.freeze({ready,uploadedBytes,totalUploadedBytes:s.uploadedNodes*16});
 }
 function checkReady(token){const s=state(token);if(s.staging!==null||s.uploadedNodes!==s.nodeCount||!host.inspectResource(s.gpu).usable)fail('NOT_READY','Exact ownership coverage is incomplete');return s;}
 function activate(token,expectedCurrent=null){const s=checkReady(token);if(current!==expectedCurrent)fail('STALE_CURRENT','Overview identity changed before synchronous arrival');const previous=current;current=token;if(previous&&previous!==token)retire(previous);return s.digest;}
 function use(token,callback){synchronous(callback);const s=checkReady(token),result=host.withGpuUse([s.gpu],records=>callback(Object.freeze({texture:backend.textureForHost(records[0].value),roots:s.roots,digest:s.digest,assignmentCount:s.assignmentCount})));state(token);return result;}
 function retireState(s){if(s.retired)return;s.retired=true;if(current===s.token)current=null;releaseStaging(s);owner.release(s.gpu);}
 function retire(token){retireState(state(token,true));}
 function collect(){
  // No polling or deletion here: the existing host drain owns retirement work.
  for(const s of banks)if(s.retired&&!host.inspectResource(s.gpu).physicallyRetained){s.dead=true;banks.delete(s);}
  return banks.size;
 }
 function contextLost(){if(!host.inspect().contextLost)fail('CONTEXT_STILL_ALIVE','The shared host must invalidate its actual context first');generation++;current=null;for(const s of banks){releaseStaging(s);if(!s.retired)owner.release(s.gpu);s.retired=true;}collect();}
 function inspect(){collect();return Object.freeze({banks:banks.size,current:current!==null,generation,serviceResources:owner.inspect(),gpuDriverBytes:'UNMEASURED',nativeFloatProfile:'UNQUALIFIED'});}
 return Object.freeze({prepare,pump,checkReady:token=>{const s=checkReady(token);return Object.freeze({digest:s.digest,assignmentCount:s.assignmentCount,roots:s.roots});},activate,use,retire,collect,contextLost,inspect,dispose(){if(closed)return;closing=true;for(const s of banks)retireState(s);collect();if(banks.size)fail('RESOURCE_BUSY','Actual physical ownership is still retained');closed=true;}});
}
const api=Object.freeze({create});root.SphereBiomeOverviewBanks=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
