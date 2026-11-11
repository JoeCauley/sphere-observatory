/* One host admission for service GPU capacities and actual CPU buffers.
 * A child GPU capacity stays funded until all of its physical work retires. */
(function(root){
'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('./records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('./metadata-budget.js'):null),owners=new WeakSet();
const REVISION='main-shared-service-resources-v1',GPU_LIMIT=10485760;
function fail(code,message,details={}){throw R.error(code,message,details,'service-resources');}
function create({metadataOwner}={}){
 if(!Q.isOwner(metadataOwner))fail('FOREIGN_OWNER','Service resources require the authentic common metadata owner');
 const base=metadataOwner.reserve(8192,{owner:'service-resources',phase:'owner'}),buffers=new Map(),capacities=new Set();let closed=false,gpuHeld=0,gpuPeak=0,cpuHeld=0,cpuPeak=0;
 function live(){if(closed)fail('OWNER_DISPOSED','Shared service resources are closed');}
 function bytes(value){if(!Number.isSafeInteger(value)||value<1)fail('INVALID_DESCRIPTOR','Exact positive resource bytes are required');return value;}
 function reserveGpu(count,{owner='service-gpu',phase='physical-capacity'}={}){
  live();bytes(count);if(gpuHeld+count>GPU_LIMIT)fail('RESOURCE_LIMIT','Service overview, provider, staging and replacement exceed the common GPU limit',{heldBytes:gpuHeld,requestedBytes:count,limitBytes:GPU_LIMIT,owner,phase});
  const metadata=metadataOwner.reserve(1024,{owner,phase:phase+'-record'}),token=Object.freeze({});capacities.add(token);gpuHeld+=count;gpuPeak=Math.max(gpuPeak,gpuHeld);let open=true;
  return Object.freeze({release(){if(!open)return false;open=false;capacities.delete(token);gpuHeld-=count;metadata.release();return true;}});
 }
 function createCpu(count){
  live();bytes(count);const lease=metadataOwner.reserve(count+1024,{owner:'service-cpu-buffer',phase:'before-physical-allocation'});let buffer;
  try{buffer=new ArrayBuffer(count);if(buffer.byteLength!==count)fail('CPU_BACKEND_CONTRACT','Physical buffer capacity differs');buffers.set(buffer,{lease,bytes:count});cpuHeld+=count;cpuPeak=Math.max(cpuPeak,cpuHeld);return buffer;}catch(error){lease.release();throw error;}
 }
 function detachCpu(buffer){
  live();const entry=buffers.get(buffer);if(!entry)fail('FOREIGN_OWNER','Unknown service CPU buffer');if(buffer.byteLength)buffer.transfer(0);if(buffer.byteLength!==0)fail('CPU_BACKEND_CONTRACT','CPU reservation cannot retire before actual detachment');buffers.delete(buffer);cpuHeld-=entry.bytes;entry.lease.release();
 }
 function inspect(){return {revision:REVISION,closed,gpuHeldBytes:gpuHeld,gpuPeakBytes:gpuPeak,gpuLimitBytes:GPU_LIMIT,gpuCapacities:capacities.size,cpuBufferHeldBytes:cpuHeld,cpuBufferPeakBytes:cpuPeak,cpuBuffers:buffers.size,accounting:'COMMON_LOGICAL_GPU_CAPACITIES_AND_ACTUAL_DETACHING_CPU_BUFFERS',nativeHeap:'UNMEASURED',driverMemory:'UNMEASURED'};}
 function dispose(){if(closed)return;if(buffers.size||capacities.size)fail('RESOURCES_HELD','Retire every child capacity and CPU buffer before the service resource owner',{cpuBuffers:buffers.size,gpuCapacities:capacities.size});base.release();closed=true;}
 const owner=Object.freeze({usesMetadataOwner:value=>value===metadataOwner,reserveGpu,createCpu,detachCpu,inspect,dispose});owners.add(owner);return owner;
}
const api=Object.freeze({REVISION,GPU_LIMIT,create,isOwner:value=>owners.has(value)});root.SphereBiomeServiceResources=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
