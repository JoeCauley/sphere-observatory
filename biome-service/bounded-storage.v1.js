/* Transaction lifetime admission. Shared source buffers retain one identity;
 * every write also retains its own database-copy reservation until settlement. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const REVISION='storage-buffer-identity-v1',WORKSPACE=8*1048576,MAX_ROW=1048576;
function fail(message,details={}){throw R.error('RESOURCE_LIMIT',message,details,'main-install-storage');}
function measure(value){
 const buffers=new Set(),ancestors=new Set();let nodes=0;
 function visit(v,depth){
  if(++nodes>1048576||depth>128)fail('Storage row exceeds structural admission');
  if(v===undefined||v===null)return 8;
  if(v instanceof ArrayBuffer||ArrayBuffer.isView(v)){buffers.add(v instanceof ArrayBuffer?v:v.buffer);return 64;}
  if(typeof v==='object'){
   if(ancestors.has(v))fail('Cyclic storage rows are unsupported');ancestors.add(v);
   const n=Array.isArray(v)?32+v.reduce((n,x)=>n+8+visit(x,depth+1),0):48+Object.entries(v).reduce((n,[k,x])=>n+64+k.length*2+visit(x,depth+1),0);
   ancestors.delete(v);return n;
  }
  return typeof v==='string'?24+v.length*2:8;
 }
 const metadataBytes=visit(value,0),bufferBytes=[...buffers].reduce((n,b)=>n+b.byteLength,0);
 return {metadataBytes,bufferBytes,buffers,bytes:metadataBytes+bufferBytes};
}
function create(storage,reserveMetadata){
 let maximumRowBytes=0,transactionPeakBytes=0,reads=0,writes=0,sourceBufferBytes=0,writeCopyBytes=0,bufferAliasUses=0,activeTransactions=0;
 function bound(value){const m=measure(value);if(m.bytes>MAX_ROW)fail('Main install storage row exceeds its admitted working slot',{bytes:m.bytes,maximum:MAX_ROW});maximumRowBytes=Math.max(maximumRowBytes,m.bytes);return m;}
 const wrapped={...storage,async transaction(stores,mode,body,options){
  const leases=[],sources=new Set();let bytes=0;activeTransactions++;
  function own(value,write=false){
   const m=bound(value);let fresh=0,aliases=0;
   for(const buffer of m.buffers)if(!sources.has(buffer))fresh+=buffer.byteLength;else aliases++;
   // Two source capacities cover the delivered buffer and read-side backing.
   // Each write reserves two further capacities for its native serialized copy.
   // Object/string/callback metadata retains the preceding fourfold bound.
   // No capacity is refunded before transaction completion or abort.
   const copies=write?m.bufferBytes:0,charge=m.metadataBytes*4+fresh*2+copies*2+m.buffers.size*256;
   const lease=reserveMetadata(charge,{owner:'main-install-storage',phase:'transaction-buffer-identity'});
   leases.push(lease);for(const buffer of m.buffers)sources.add(buffer);
   sourceBufferBytes+=fresh;writeCopyBytes+=copies;bufferAliasUses+=aliases;
   bytes+=charge;transactionPeakBytes=Math.max(transactionPeakBytes,bytes);return value;
  }
  try{return await storage.transaction(stores,mode,ctx=>{
   const map=new Map(),store=name=>{if(map.has(name))return map.get(name);const actual=ctx.store(name),proxy=new Proxy(actual,{get(target,key){const value=target[key];if(typeof value!=='function')return value;if(['put','add'].includes(key))return(v,...rest)=>{own(v,true);writes++;return value.call(target,v,...rest);};return value.bind(target);}});map.set(name,proxy);return proxy;};
   return body({...ctx,store,request:(request,callback)=>ctx.request(request,v=>{reads++;return callback(own(v));}),setResult:v=>ctx.setResult(own(v))});
  },options);}finally{
   // The backing storage promise settles only after complete/abort. Clear the
   // accountant's aliases while their charges remain held, then release them.
   sources.clear();for(const lease of leases)lease.release();leases.length=0;activeTransactions--;
  }
 }};
 for(const name of ['get','getAll','getAllKeys'])wrapped[name]=async(...args)=>{const value=await storage[name](...args);reads++;bound(value);return value;};
 return {storage:Object.freeze(wrapped),inspect:()=>({revision:REVISION,maximumRowBytes,maximumAllowedRowBytes:MAX_ROW,transactionPeakBytes,reads,writes,workspaceReservationBytes:WORKSPACE,sourceBufferBytes,writeCopyBytes,bufferAliasUses,activeTransactions,reservationLifetime:'UNTIL_TRANSACTION_COMPLETE_OR_ABORT',nativeHeap:'UNMEASURED'})};
}
const api=Object.freeze({REVISION,WORKSPACE,MAX_ROW,measure,create});root.SphereBiomeBoundedStorage=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
