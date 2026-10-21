/* Common logical admission for every metadata owner and replacement. Native
 * heap and driver measurements remain independent qualification outputs. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const MAX_BYTES=33554432,MAX_RESERVATIONS=4096,BASE_BYTES=4096,owners=new WeakSet(),holds=new WeakMap();
function fail(code,message,details={}){throw R.error(code,message,details,'metadata-budget');}
function create(){
 let disposed=false,heldBytes=BASE_BYTES,peakBytes=BASE_BYTES,requestedBytes=0;const live=new Set(),totals=new Map();
 function reserve(bytes,details={}){
  if(disposed)fail('OWNER_DISPOSED','Metadata admission owner is disposed');
  if(!Number.isSafeInteger(bytes)||bytes<0||Object.is(bytes,-0)||!details||!['string','object'].includes(typeof details)||Array.isArray(details)||typeof details==='object'&&Object.getPrototypeOf(details)!==Object.prototype)fail('INVALID_DESCRIPTOR','A finite exact metadata reservation is required');
  // Read only the two scalar labels. Accessors must never run while ownership
  // admission is in progress: one could dispose this owner before its charge.
  function scalar(key,fallback){const descriptor=Object.getOwnPropertyDescriptor(details,key);if(descriptor===undefined)return fallback;if(!Object.hasOwn(descriptor,'value'))fail('INVALID_DESCRIPTOR','Metadata ownership labels require own data properties');return descriptor.value;}
  const label=typeof details==='string'?details:scalar('owner','unspecified'),phase=typeof details==='string'?details:scalar('phase','working');
  if(typeof label!=='string'||!/^[-a-zA-Z0-9 _./:]{1,128}$/.test(label)||typeof phase!=='string'||!/^[-a-zA-Z0-9 _./:]{1,128}$/.test(phase))fail('INVALID_DESCRIPTOR','Metadata ownership labels must be bounded ASCII');
  // A Proxy's prototype/descriptor traps can run arbitrary caller code even
  // though ordinary accessors above are refused. Recheck before admission.
  if(disposed)fail('OWNER_DISPOSED','Metadata admission owner was disposed during input validation');
  const chargedBytes=bytes+512+(label.length+phase.length)*2;
  if(live.size>=MAX_RESERVATIONS||heldBytes+chargedBytes>MAX_BYTES)fail('RESOURCE_LIMIT','Service metadata current, staging, replacement and ownership records exceed admission',{heldBytes,requestedBytes:bytes,chargedBytes,limitBytes:MAX_BYTES,liveReservations:live.size,maximumReservations:MAX_RESERVATIONS,owner:label,phase});
  const token=Object.freeze({});holds.set(token,{owner,bytes,chargedBytes,label,phase,released:false});live.add(token);
  requestedBytes+=bytes;heldBytes+=chargedBytes;peakBytes=Math.max(peakBytes,heldBytes);totals.set(label,(totals.get(label)||0)+chargedBytes);
  return Object.freeze({release:()=>release(token)});
 }
 function release(token){const data=holds.get(token);if(!data||data.owner!==owner)fail('STALE_LEASE','Unknown metadata reservation');if(data.released)return false;data.released=true;live.delete(token);requestedBytes-=data.bytes;heldBytes-=data.chargedBytes;const remaining=totals.get(data.label)-data.chargedBytes;if(remaining)totals.set(data.label,remaining);else totals.delete(data.label);return true;}
 function inspect(){return R.deepFreeze({heldBytes,requestedBytes,bookkeepingBytes:heldBytes-requestedBytes,peakBytes,limitBytes:MAX_BYTES,liveReservations:live.size,maximumReservations:MAX_RESERVATIONS,owners:[...totals].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,bytes])=>({name,bytes})),scope:'CONSERVATIVE_LOGICAL_METADATA_ADMISSION',nativeHeap:'UNMEASURED'});}
 function dispose(){if(disposed)return;if(live.size)fail('RESOURCES_HELD','Metadata users must release every old/new/staging/retiring reservation before owner disposal',{heldBytes,liveReservations:live.size});disposed=true;heldBytes=0;}
 const owner=Object.freeze({reserve,inspect,dispose});owners.add(owner);return owner;
}
const api=Object.freeze({MAX_BYTES,MAX_RESERVATIONS,BASE_BYTES,create,isOwner:value=>owners.has(value)});root.SphereBiomeMetadataBudget=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
