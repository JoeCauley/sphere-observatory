/* Fixed root source admission. Authentic shared metadata reservations precede
 * every owned clone, serialization, parse and asynchronous source copy. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('../metadata-budget.js'):null),HASH=/^[0-9a-f]{64}$/;
const MAX_PROFILE_BYTES=262144,MAX_PROFILE_NODES=4096;
const sourceOwners=new WeakMap();
function fail(code,message,details={}){throw R.error(code,message,details,'native-source-admission');}
function exact(value,keys){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');}
function owner(value){if(!Q?.isOwner(value))fail('FOREIGN_OWNER','The authentic common metadata owner is required');return value;}
function reserve(metadataOwner,bytes,label,phase){return owner(metadataOwner).reserve(bytes,{owner:label,phase});}
// Fixed ceilings are reserved before inspecting or serializing caller data.
// The bounded walk prevents oversized arrays from reaching canonical builders.
// Data descriptors are inspected; accessors are never invoked.
function shape(value,{maxBytes,maxNodes,maxDepth=32}){
 let nodes=0;const active=new Set();
 function visit(item,depth){if(depth>maxDepth||++nodes>maxNodes)fail('RESOURCE_LIMIT','Owned metadata node/depth ceiling exceeded');if(item===null||typeof item==='boolean'||typeof item==='number')return;if(typeof item==='string'){if(item.length>maxBytes)fail('RESOURCE_LIMIT','Owned metadata string ceiling exceeded');return;}if(typeof item!=='object')fail('INVALID_DESCRIPTOR','Owned metadata must contain ordinary data');if(active.has(item))fail('INVALID_DESCRIPTOR','Cyclic owned metadata');const array=Array.isArray(item),prototype=Object.getPrototypeOf(item);if(!array&&prototype!==Object.prototype&&prototype!==null)fail('INVALID_DESCRIPTOR','Owned metadata must contain ordinary records');if(array&&item.length>maxNodes-nodes)fail('RESOURCE_LIMIT','Owned array node ceiling exceeded');active.add(item);let enumerable=0;for(const key in item){if(!Object.hasOwn(item,key))continue;if(++enumerable>maxNodes||key.length>maxBytes)fail('RESOURCE_LIMIT','Owned record key ceiling exceeded');const descriptor=Object.getOwnPropertyDescriptor(item,key);if(!descriptor||!('value'in descriptor))fail('INVALID_DESCRIPTOR','Owned metadata accessors refuse');visit(descriptor.value,depth+1);}const keys=Reflect.ownKeys(item);if(keys.length!==enumerable+(array?1:0)||keys.some(key=>typeof key!=='string'))fail('INVALID_DESCRIPTOR','Owned metadata symbols/hidden properties refuse');if(array&&enumerable!==item.length)fail('INVALID_DESCRIPTOR','Owned array holes refuse');active.delete(item);}
 visit(value,0);return nodes;
}
function ownRecord(value,{metadataOwner,label='biome-native-root',phase='owned-record',maxBytes=MAX_PROFILE_BYTES,maxNodes=MAX_PROFILE_NODES,build=false}={}){
 owner(metadataOwner);if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576||!Number.isSafeInteger(maxNodes)||maxNodes<1||maxNodes>16384)fail('INVALID_DESCRIPTOR','Fixed metadata record ceilings required');const temporary=reserve(metadataOwner,maxBytes*12+maxNodes*512+4096,label,phase+'-scratch');let retained=null;
 try{if(build){if(typeof value!=='function'||value.constructor.name==='AsyncFunction')fail('INVALID_CALLBACK','Fixed owned record builder must be synchronous');value=value();if(value?.then)fail('INVALID_CALLBACK','Owned record builder returned a thenable');}const nodes=shape(value,{maxBytes,maxNodes}),text=R.canonicalJSON(value,{maxBytes,maxNodes,maxDepth:32}),bytes=new TextEncoder().encode(text),owned=R.deepFreeze(R.parse(bytes,{maxBytes,maxNodes,maxDepth:32,allowUnsafeNumbers:true}));retained=reserve(metadataOwner,bytes.byteLength*8+nodes*256+4096,label,phase);return Object.freeze({value:owned,charge:retained,bytes:bytes.byteLength,nodes});}catch(error){retained?.release();throw error;}finally{temporary.release();}
}
function parseRecord(bytes,{metadataOwner,label='biome-native-root',phase='parsed-record',maxBytes=262144,maxNodes=4096}={}){
 owner(metadataOwner);if(!(bytes instanceof Uint8Array)||bytes.byteLength>maxBytes||maxBytes>1048576||maxNodes>16384)fail('RESOURCE_LIMIT','Bounded retained record bytes required');const temporary=reserve(metadataOwner,maxBytes*12+maxNodes*512+4096,label,phase+'-scratch');let retained=null;
 try{const value=R.deepFreeze(R.parse(bytes,{maxBytes,maxNodes,maxDepth:32,allowUnsafeNumbers:true})),nodes=shape(value,{maxBytes,maxNodes});retained=reserve(metadataOwner,bytes.byteLength*8+nodes*256+4096,label,phase);return Object.freeze({value,charge:retained,bytes:bytes.byteLength,nodes});}catch(error){retained?.release();throw error;}finally{temporary.release();}
}
function createSourceOwner({metadataOwner}={}){
 owner(metadataOwner);const base=reserve(metadataOwner,8192,'biome-native-source-owner','source-owner'),entries=new Map(),borrowers=new Map();let busy=false,disposed=false,sourceBytes=0,logicalReferences=0;
 function live(){if(disposed)fail('OWNER_DISPOSED','Shared verified source owner disposed');}
 function drop(entry){logicalReferences--;if(--entry.references===0){sourceBytes-=entry.bytes.byteLength;if(entry.bytes.buffer.byteLength)entry.bytes.buffer.transfer(0);entry.charge.release();entries.delete(entry.key);}}
 async function acquire(rows,readSource,label,phase){
  live();if(busy)fail('PREPARATION_BUSY','One shared source verification may own its bounded scratch at a time');busy=true;const held=[];
  try{for(const row of rows){
   live();const key=row.path+':'+row.bytes+':'+row.sha256;let entry=entries.get(key),charge=null;
   // The same four-byte-per-source-byte bound is retained physically once.
   // Its private immutable copy and serial fetch/hash scratch never escape.
   if(!entry)charge=reserve(metadataOwner,row.bytes*4+4096,'biome-native-source-owner','source-copy');
   try{const incoming=await readSource(row.path);live();if(!(incoming instanceof Uint8Array)||!(incoming.buffer instanceof ArrayBuffer)||incoming.byteLength!==row.bytes)fail('SOURCE_PROFILE_MISMATCH','Actual shared source bytes differ',{path:row.path});const bytes=Uint8Array.from(incoming);if(await R.sha256(bytes)!==row.sha256)fail('SOURCE_PROFILE_MISMATCH','Actual shared source bytes differ',{path:row.path});live();
    if(!entry){entry={key,bytes,charge,references:0};entries.set(key,entry);sourceBytes+=bytes.byteLength;charge=null;}else bytes.buffer.transfer(0);
    entry.references++;logicalReferences++;held.push(entry);
   }finally{charge?.release();}
  }
  const charge=reserve(metadataOwner,4096,'biome-native-source-owner','source-reader'),token=Object.freeze({});borrowers.set(token,{held,charge});let open=true;
  return Object.freeze({release(){if(!open)return;open=false;const b=borrowers.get(token);borrowers.delete(token);for(const e of b.held)drop(e);b.charge.release();}});
  }catch(error){for(const e of held.reverse())drop(e);throw error;}finally{busy=false;}
 }
 const api=Object.freeze({usesMetadataOwner:value=>value===metadataOwner,inspect:()=>Object.freeze({sourceCopies:entries.size,sourceBytes,logicalReferences,borrowers:borrowers.size,admitting:busy,disposed,ownership:'PRIVATE_SOURCE_BYTES_AND_COMPLETE_LOGICAL_READERS',nativeHeap:'UNMEASURED'}),dispose(){if(disposed)return;if(busy)fail('PREPARATION_BUSY','Shared source verification must settle');if(borrowers.size)fail('OWNER_IN_USE','Root/provider/source readers must release before disposal');if(entries.size)fail('OWNER_IN_USE','Private source copies remain retained');base.release();disposed=true;}});
 sourceOwners.set(api,{metadataOwner,acquire});return api;
}
async function admit({profileEnvelope,readSource,metadataOwner,sourceOwner,owner:label,phase,extraBytes=0}={}){
 if(typeof readSource!=='function'||typeof label!=='string'||typeof phase!=='string'||!Number.isSafeInteger(extraBytes)||extraBytes<0)fail('INVALID_DESCRIPTOR','Root source admission requires fixed source/metadata inputs');owner(metadataOwner);const held=ownRecord(profileEnvelope,{metadataOwner,label,phase:phase+'-profile'}),profile=held.value;let charge=null;
 let sourceBorrow=null;
 try{if(!Array.isArray(profile.body?.closure)||!profile.body.closure.length||profile.body.closure.length>256)fail('INVALID_DESCRIPTOR','Complete bounded exact source closure required');let previous='',sourceBytes=0;for(const item of profile.body.closure){if(!exact(item,['path','bytes','sha256'])||typeof item.path!=='string'||item.path.length>256||item.path<=previous||!Number.isSafeInteger(item.bytes)||item.bytes<1||!HASH.test(item.sha256))fail('INVALID_DESCRIPTOR','Exact source closure must be ordered and unique');previous=item.path;sourceBytes+=item.bytes;if(sourceBytes>16777216)fail('RESOURCE_LIMIT','Root source closure exceeds admission');}const shared=sourceOwner===undefined?null:sourceOwners.get(sourceOwner);if(sourceOwner!==undefined&&(!shared||shared.metadataOwner!==metadataOwner))fail('FOREIGN_OWNER','The shared source owner must use this exact common metadata owner');const retainedBytes=(shared?0:sourceBytes*4)+held.bytes*8+held.nodes*256+4096+extraBytes;if(!Number.isSafeInteger(retainedBytes))fail('RESOURCE_LIMIT','Unknown root metadata charge');charge=reserve(metadataOwner,retainedBytes,label,phase);await R.verifyEnvelope(profile);if(shared)sourceBorrow=await shared.acquire(profile.body.closure,readSource,label,phase);else for(const item of profile.body.closure){const incoming=await readSource(item.path);if(!(incoming instanceof Uint8Array)||!(incoming.buffer instanceof ArrayBuffer)||incoming.byteLength!==item.bytes)fail('SOURCE_PROFILE_MISMATCH','Actual root source bytes differ',{path:item.path});const bytes=Uint8Array.from(incoming);if(await R.sha256(bytes)!==item.sha256)fail('SOURCE_PROFILE_MISMATCH','Actual root source bytes differ',{path:item.path});}held.charge.release();const local=charge,borrow=sourceBorrow;let open=true;const release=()=>{if(open){open=false;borrow?.release();local.release();}};return Object.freeze({profile,charge:Object.freeze({release}),sourceBytes,retainedBytes,sourceOwner:sourceOwner??null});}catch(error){sourceBorrow?.release();charge?.release();held.charge.release();throw error;}
}
const api=Object.freeze({admit,createSourceOwner,isSourceOwner:value=>sourceOwners.has(value),ownRecord,buildRecord:(builder,options)=>ownRecord(builder,{...options,build:true}),parseRecord,reserve,MAX_PROFILE_BYTES,MAX_PROFILE_NODES});root.SphereBiomeNativeSourceAdmission=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
