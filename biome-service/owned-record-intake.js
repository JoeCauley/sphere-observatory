/* Charged byte intake component. It owns no world, session or publication.
 * Parser quotas retain the existing record contract; live shared Q may refuse
 * actual coexisting record costs. No caller object enumeration occurs here. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('./records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('./metadata-budget.js'):null);
const MAX_BYTES=16777216,MAX_NODES=2097152,MAX_DEPTH=64,FORMAT='sphere-owned-record-intake/1';
const typed=Object.getPrototypeOf(Uint8Array.prototype),byteLength=Object.getOwnPropertyDescriptor(typed,'byteLength').get,buffer=Object.getOwnPropertyDescriptor(typed,'buffer').get,set=typed.set;
const owners=new WeakSet(),handles=new WeakMap(),views=new WeakMap();
function fail(code,message,details={}){throw R.error(code,message,details,'owned-record-intake');}
function rawLength(value){
 if(!ArrayBuffer.isView(value))fail('INVALID_BYTE_INPUT','An actual Uint8Array is required');
 // Native getters do not dispatch caller own accessors or iterator/species.
 if(Object.getPrototypeOf(value)!==Uint8Array.prototype&&!(node&&typeof Buffer!=='undefined'&&Buffer.isBuffer(value)))fail('INVALID_BYTE_INPUT','Only ordinary bytes are admitted');
 let n,b;try{n=byteLength.call(value);b=buffer.call(value);}catch(_){fail('INVALID_BYTE_INPUT','An actual byte view is required');}
 if(!(b instanceof ArrayBuffer))fail('INVALID_BYTE_INPUT','Shared or foreign byte storage is unsupported');
 if(!Number.isSafeInteger(n)||n<1||n>MAX_BYTES)fail('RESOURCE_LIMIT','The existing record byte quota is required',{bytes:n,maxBytes:MAX_BYTES});return n;
}
function nodeCeiling(bytes){
 // Every parsed value after the first is introduced by a container delimiter,
 // comma or colon outside strings. This overcounts keys/empty containers;
 // capping at the unchanged parser ceiling does not narrow a valid record.
 let quoted=false,escaped=false,count=1;
 for(let i=0;i<bytes.length;i++){
  const c=bytes[i];if(quoted){if(escaped)escaped=false;else if(c===92)escaped=true;else if(c===34)quoted=false;}
  else if(c===34)quoted=true;else if(c===123||c===91||c===44||c===58)count=Math.min(MAX_NODES,count+1);
 }
 return count;
}
function create({metadataOwner}={}){
 if(!Q.isOwner(metadataOwner))fail('FOREIGN_OWNER','Authentic common metadata admission is required');
 const base=metadataOwner.reserve(8192,{owner:'biome-owned-record-intake',phase:'owner-and-reader-tables'}),live=new Set();let disposed=false,busy=false;
 function alive(){if(disposed)fail('OWNER_DISPOSED','Record intake owner disposed');}
 function item(handle){alive();const value=handles.get(handle);if(!value||value.owner!==owner||value.released||value.retiring)fail('STALE_LEASE','Unknown or retired intake handle');return value;}
 function finish(value){if(value.readers||value.released)return;value.released=true;live.delete(value.handle);value.value=null;value.bytes=null;value.parseCharge.release();value.copyCharge.release();}
 function admitBytes(input){
  alive();if(busy)fail('PREPARATION_BUSY','The synchronous byte intake is already in progress');busy=true;
  let copyCharge=null,parseCharge=null,decodeCharge=null,buildCharge=null;try{
   const n=rawLength(input);
   // The raw buffer and worst-case decoded UTF16 scratch are separately charged
   // before allocation or scanning. Parser/canonical output is charged next,
   // before either builder executes. All temporary and retained charges coexist through construction; only temporary scratch releases afterward.
   copyCharge=metadataOwner.reserve(n+4096,{owner:'biome-owned-record-intake',phase:'retained-raw-copy'});decodeCharge=metadataOwner.reserve(n*2+8192,{owner:'biome-owned-record-intake',phase:'temporary-decoder'});
   const bytes=new Uint8Array(n);set.call(bytes,input);
   const nodes=nodeCeiling(bytes),ownedBytes=n*4+nodes*256+8192;
   parseCharge=metadataOwner.reserve(ownedBytes,{owner:'biome-owned-record-intake',phase:'retained-parsed-record'});buildCharge=metadataOwner.reserve(n*4+nodes*64+8192,{owner:'biome-owned-record-intake',phase:'temporary-parse-canonical'});
   const value=R.parse(bytes,{maxBytes:MAX_BYTES,maxNodes:MAX_NODES,maxDepth:MAX_DEPTH,allowUnsafeNumbers:true});
   // The serializer validates data numbers, Unicode and prototype shape.
   // Keep the exact decoded record and exact received bytes; canonical bytes
   // are checked under the same held scratch, then discarded as rebuildable.
   const canonical=R.canonicalBytes(value,{maxBytes:MAX_BYTES,maxNodes:MAX_NODES,maxDepth:MAX_DEPTH});
   const handle=Object.freeze({}),record={owner,handle,value:R.deepFreeze(value),bytes,copyCharge,parseCharge,readers:0,retiring:false,released:false,receivedBytes:n,canonicalBytes:canonical.length,nodeUpperBound:nodes,chargedRequestedBytes:n+4096+ownedBytes,admissionScratchBytes:n*6+nodes*64+16384};
   handles.set(handle,record);live.add(handle);copyCharge=null;parseCharge=null;return handle;
  }finally{buildCharge?.release();decodeCharge?.release();parseCharge?.release();copyCharge?.release();busy=false;}
 }
 function borrow(handle){
  const value=item(handle),charge=metadataOwner.reserve(1024,{owner:'biome-owned-record-intake',phase:'active-record-reader'});value.readers++;const token=Object.freeze({});views.set(token,{record:value,charge,open:true});
  return Object.freeze({get value(){const v=views.get(token);if(!v?.open)fail('STALE_LEASE','Record borrow is closed');return v.record.value;},close(){const v=views.get(token);if(!v?.open)return false;v.open=false;v.record.readers--;v.charge.release();if(v.record.retiring)finish(v.record);return true;}});
 }
 async function verifyEnvelope(handle){const held=borrow(handle);let scratch=null;try{const value=handles.get(handle);scratch=metadataOwner.reserve(value.receivedBytes*8+value.nodeUpperBound*256+8192,{owner:'biome-owned-record-intake',phase:'active-envelope-verification'});await R.verifyEnvelope(held.value);return Object.freeze({verified:true,digest:held.value.digest});}finally{scratch?.release();held.close();}}
 function release(handle){alive();const value=handles.get(handle);if(!value||value.owner!==owner||value.released)fail('STALE_LEASE','Unknown or released intake handle');if(value.retiring)return false;value.retiring=true;finish(value);return true;}
 function inspect(handle){const value=item(handle);return Object.freeze({format:FORMAT,receivedBytes:value.receivedBytes,canonicalBytes:value.canonicalBytes,nodeUpperBound:value.nodeUpperBound,chargedRequestedBytes:value.chargedRequestedBytes,admissionScratchBytes:value.admissionScratchBytes,readers:value.readers,limits:Object.freeze({maxBytes:MAX_BYTES,maxNodes:MAX_NODES,maxDepth:MAX_DEPTH}),scope:'ADAPTIVE_LOGICAL_SHARED_Q_COMPONENT',nativeHeap:'UNMEASURED'});}
 function dispose(){if(disposed)return;if(busy||[...live].some(handle=>handles.get(handle).readers))fail('OWNER_IN_USE','Record intake readers must close before disposal');for(const handle of [...live])release(handle);base.release();disposed=true;}
 const owner=Object.freeze({admitBytes,borrow,verifyEnvelope,release,inspect,dispose,usesMetadataOwner:value=>value===metadataOwner});owners.add(owner);return owner;
}
const api=Object.freeze({FORMAT,MAX_BYTES,MAX_NODES,MAX_DEPTH,create,isOwner:value=>owners.has(value)});root.SphereBiomeOwnedRecordIntake=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
