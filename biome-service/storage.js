/* Origin-local service data. Transaction callbacks remain synchronous. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const NAME='sphere-biome-service-v1',VERSION=1;
const STORES=Object.freeze(['resources','releases','releaseStatus','hostWorlds','registrySnapshots','worldBindings','worldHeads','installPlans','sessions','sessionHeads','views','operations']);
function failure(cause){if(typeof cause?.code==='string')return cause;return R.error(cause?.name==='QuotaExceededError'?'STORAGE_QUOTA':'STORAGE_UNAVAILABLE',cause?.message||'Service storage is unavailable',{},'storage');}
function cancelled(){return R.error('CANCELLED','Service storage operation was cancelled',{},'storage');}
function check(signal){if(signal?.aborted)throw cancelled();}
async function open({indexedDB=root.indexedDB,name=NAME,signal}={}){
 check(signal);
 if(!indexedDB||typeof indexedDB.open!=='function')throw failure(new Error('IndexedDB is unavailable'));
 // A separate, explicitly named database is useful for isolated native tests.
 if(typeof name!=='string'||!/^sphere-biome-service-v1(?:-test-[a-z0-9-]{1,96})?$/.test(name))throw R.error('INVALID_DESCRIPTOR','Invalid service database name',{},'storage');
 const db=await new Promise((resolve,reject)=>{
  let done=false,request;const fail=e=>{if(!done){done=true;signal?.removeEventListener('abort',abort);reject(failure(e));}},abort=()=>fail(cancelled());
  signal?.addEventListener('abort',abort,{once:true});
  try{request=indexedDB.open(name,VERSION);}catch(e){fail(e);return;}
  request.onupgradeneeded=()=>{
   if(done){request.transaction.abort();return;}
   const target=request.result;
   for(const store of STORES)if(!target.objectStoreNames.contains(store))target.createObjectStore(store);
   const releases=request.transaction.objectStore('releases'),operations=request.transaction.objectStore('operations');
   if(!releases.indexNames.contains('packVersion'))releases.createIndex('packVersion',['packId','version'],{unique:true});
   if(!operations.indexNames.contains('idempotencyKey'))operations.createIndex('idempotencyKey','idempotencyKey',{unique:true});
  };
  request.onerror=()=>fail(request.error);request.onblocked=()=>fail(new Error('Another open database connection blocks this service version'));
  request.onsuccess=()=>{if(done){request.result.close();return;}done=true;signal?.removeEventListener('abort',abort);resolve(request.result);};
 });
 let closed=false;db.onversionchange=()=>{closed=true;db.close();};
 if(STORES.some(store=>!db.objectStoreNames.contains(store))||db.objectStoreNames.length!==STORES.length){db.close();throw failure(new Error('Service database schema does not match version one'));}
 try{
  const schema=db.transaction([...STORES],'readonly');for(const name of STORES){const store=schema.objectStore(name),expected=name==='releases'?['packVersion']:name==='operations'?['idempotencyKey']:[];
   if(store.keyPath!==null||store.autoIncrement||store.indexNames.length!==expected.length||expected.some(index=>!store.indexNames.contains(index)))throw Error('Service object-store/index identities differ');
   for(const indexName of expected){const index=store.index(indexName),keyPath=indexName==='packVersion'?['packId','version']:'idempotencyKey';if(!index.unique||index.multiEntry||JSON.stringify(index.keyPath)!==JSON.stringify(keyPath))throw Error('Service unique index identity differs');}
  }
 }catch(error){db.close();throw failure(error);}
 function transaction(stores,mode,body,{signal}={}){
  return new Promise((resolve,reject)=>{
   let tx,result,reason,settled=false;
   const rejectBefore=e=>{if(!settled){settled=true;reject(failure(e));}};
   try{
    check(signal);if(closed)throw new Error('Service database connection is closed');
    if(!Array.isArray(stores)||!stores.length||new Set(stores).size!==stores.length||stores.some(s=>!STORES.includes(s))||!['readonly','readwrite'].includes(mode)||typeof body!=='function')throw R.error('INVALID_DESCRIPTOR','Invalid service transaction scope',{},'storage');
    tx=db.transaction(stores,mode);
   }catch(e){rejectBefore(e);return;}
   const abort=e=>{if(settled)return;reason=failure(e);try{tx.abort();}catch(cause){rejectBefore(reason);}};
   const onAbort=()=>abort(cancelled());signal?.addEventListener('abort',onAbort,{once:true});
   tx.oncomplete=()=>{settled=true;signal?.removeEventListener('abort',onAbort);resolve(result);};
   tx.onabort=()=>{settled=true;signal?.removeEventListener('abort',onAbort);reject(reason||failure(tx.error||new Error('Service transaction aborted')));};
   tx.onerror=()=>{reason=reason||failure(tx.error);};
   const context=Object.freeze({store:name=>tx.objectStore(name),setResult:value=>{result=value;},abort,request:(request,onSuccess)=>{
    request.onerror=()=>{reason=reason||failure(request.error);};
    request.onsuccess=()=>{try{const returned=onSuccess(request.result);if(returned&&typeof returned.then==='function')abort(R.error('INVALID_DESCRIPTOR','A storage request callback cannot await unrelated work',{},'storage'));}catch(e){abort(e);}};
   }});
   try{const returned=body(context);if(returned&&typeof returned.then==='function')abort(R.error('INVALID_DESCRIPTOR','A service transaction body must be synchronous',{},'storage'));}catch(e){abort(e);}
  });
 }
 const get=(store,key,options)=>transaction([store],'readonly',ctx=>ctx.request(ctx.store(store).get(key),value=>ctx.setResult(value)),options);
 const getAll=(store,options)=>transaction([store],'readonly',ctx=>ctx.request(ctx.store(store).getAll(),value=>ctx.setResult(value)),options);
 const getAllKeys=(store,options)=>transaction([store],'readonly',ctx=>ctx.request(ctx.store(store).getAllKeys(),value=>ctx.setResult(value)),options);
 return Object.freeze({name,version:VERSION,stores:STORES,get,getAll,getAllKeys,transaction,close(){closed=true;db.close();}});
}
const api=Object.freeze({NAME,VERSION,STORES,open});root.SphereBiomeStorage=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
