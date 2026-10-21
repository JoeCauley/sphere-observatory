/* Generated discovery data and exact verified-release projections. No geography or menu routes. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const FORMAT='sphere-biome-catalogue/1',MAX_ENTRIES=256,MAX_CATALOGUE_BYTES=262144;
const MAX_METADATA_CACHE_BYTES=4194304;
function fail(code,message,details={}){throw new R.ServiceError(code,message,details,'registry');}
function keys(value,names){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));}
function pathValid(value){return typeof value==='string'&&value.length<=240&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)&&value.split('/').every(part=>part&&part!=='.'&&part!=='..');}
function digest(value){return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);}
// Conservative logical ownership reservation, distinct from native heap measurements.
function metadataBytes(value){if(value===null)return 8;if(typeof value==='string')return 24+value.length*2;if(typeof value==='number')return 8;if(typeof value==='boolean')return 4;if(Array.isArray(value))return 32+value.length*8+value.reduce((sum,item)=>sum+metadataBytes(item),0);if(value&&typeof value==='object')return 48+Object.entries(value).reduce((sum,[key,item])=>sum+32+key.length*2+metadataBytes(item),0);fail('INVALID_REGISTRY','Unsupported metadata reservation value');}
function validateCatalogue(value){
 value=R.clone(value);if(!keys(value,['format','entries'])||value.format!==FORMAT||!Array.isArray(value.entries)||value.entries.length>MAX_ENTRIES)fail('INVALID_CATALOGUE','Invalid bounded generated catalogue');
 const releases=new Set(),versions=new Map(),paths=new Set();
 for(const entry of value.entries){
  const names=['packId','version','payloadDigest','manifestPath','manifestBytes','manifestSha256','releasePath','releaseBytes','releaseSha256'];
  if(!keys(entry,names)||typeof entry.packId!=='string'||!/^[a-z][a-z0-9-]{2,127}$/.test(entry.packId)||typeof entry.version!=='string'||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(entry.version)||entry.version.length>64||![entry.payloadDigest,entry.manifestSha256,entry.releaseSha256].every(digest)||!pathValid(entry.manifestPath)||!entry.manifestPath.endsWith('/manifest.json')||entry.releasePath!==entry.manifestPath.slice(0,-'manifest.json'.length)+'release.json'||!Number.isSafeInteger(entry.manifestBytes)||entry.manifestBytes<1||entry.manifestBytes>1048576||!Number.isSafeInteger(entry.releaseBytes)||entry.releaseBytes<1||entry.releaseBytes>65536)fail('INVALID_CATALOGUE','Invalid exact catalogue release reference');
  const version=entry.packId+'@'+entry.version;if(releases.has(entry.payloadDigest)||versions.has(version)||paths.has(entry.manifestPath.toLowerCase()))fail('INVALID_CATALOGUE','Repeated or conflicting catalogue identity');releases.add(entry.payloadDigest);versions.set(version,entry.payloadDigest);paths.add(entry.manifestPath.toLowerCase());
 }
 return R.deepFreeze(value);
}
function permittedURL(path,origin,allowedPrefixes){
 if(!pathValid(path)||!allowedPrefixes.some(prefix=>path.startsWith(prefix)))fail('UNPERMITTED_SOURCE','Catalogue path is outside the admitted same-origin roots',{path});
 const base=new URL(origin);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)fail('UNPERMITTED_SOURCE','An exact HTTP origin is required');
 const url=new URL(path,base);if(url.origin!==base.origin||url.search||url.hash||url.pathname!=='/'+path)fail('UNPERMITTED_SOURCE','Catalogue reference is not a literal same-origin path');return url.href;
}
async function fetchBounded(url,{maximumBytes,signal}={}){
 const response=await fetch(url,{signal,credentials:'same-origin',redirect:'error',cache:'no-store'});if(!response.ok||response.url&&response.url!==url||response.redirected)fail('MISSING_RESOURCE','Exact same-origin resource is unavailable',{url,status:response.status});
 const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maximumBytes))fail('RESOURCE_QUOTA_EXCEEDED','Resource length exceeds the declared read quota');
 if(!response.body){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>maximumBytes)fail('RESOURCE_QUOTA_EXCEEDED','Resource exceeds the read quota');return bytes;}
 const reader=response.body.getReader(),chunks=[];let total=0;try{for(;;){if(signal?.aborted)throw new DOMException('Inspection cancelled','AbortError');const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>maximumBytes){await reader.cancel();fail('RESOURCE_QUOTA_EXCEEDED','Resource exceeds the read quota');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
function create({origin,allowedPrefixes=['packs/'],fetchBytes=fetchBounded,ingestion,store,negotiateProvider,knownTrackIds,reserveMetadata}={}){
 if(!Array.isArray(allowedPrefixes)||!allowedPrefixes.length||allowedPrefixes.some(prefix=>typeof prefix!=='string'||!prefix.endsWith('/')||!pathValid(prefix.slice(0,-1)))||typeof fetchBytes!=='function'||!ingestion||typeof ingestion.inspectPackage!=='function'||!store||typeof store.getRelease!=='function'||typeof store.listReleases!=='function'||typeof store.commitVerified!=='function'||typeof negotiateProvider!=='function')fail('INVALID_REGISTRY','Explicit verified store, ingestion and host provider admission are required');
 if(reserveMetadata!==undefined&&typeof reserveMetadata!=='function')fail('INVALID_REGISTRY','Shared metadata admission hook must be synchronous');
 permittedURL(allowedPrefixes[0]+'catalogue.v1.json',origin,allowedPrefixes);const admittedRoots=Object.freeze([...allowedPrefixes]),entries=new Map(),descriptors=new Map();let rows=Object.freeze([]),catalogueLoaded=false,refreshGeneration=0,metadataHeldBytes=0,metadataPeakBytes=0,projectionLeases=[],closed=false;
 function reserve(bytes,phase){if(!Number.isSafeInteger(bytes)||bytes<0||metadataHeldBytes+bytes>MAX_METADATA_CACHE_BYTES)fail('METADATA_BUDGET_EXCEEDED','Registry current, candidate and retained metadata exceed the cache reservation',{requestedBytes:bytes,heldBytes:metadataHeldBytes,limit:MAX_METADATA_CACHE_BYTES});let shared=null;if(reserveMetadata){shared=reserveMetadata(bytes,{owner:'biome-registry',phase});if(!shared||typeof shared.release!=='function'||typeof shared.then==='function')fail('INVALID_REGISTRY','Shared metadata hook must return a synchronous releasable lease');}metadataHeldBytes+=bytes;metadataPeakBytes=Math.max(metadataPeakBytes,metadataHeldBytes);let released=false;return {release(){if(released)return;released=true;metadataHeldBytes-=bytes;shared?.release();}};}
 function groupedLease(leases){let released=false;return {release(){if(released)return;released=true;for(const lease of leases)lease.release();}};}
 function retire(value){value.retired=true;if(value.users===0)value.lease.release();}
 function aborted(signal){if(closed)fail('SERVICE_DISPOSED','Registry has been disposed');if(signal?.aborted)throw new DOMException('Inspection cancelled','AbortError');}
 async function read(path,maximumBytes,signal){aborted(signal);const received=await fetchBytes(permittedURL(path,origin,admittedRoots),{maximumBytes,signal});if(!(received instanceof Uint8Array)||received.byteLength>maximumBytes)fail('RESOURCE_QUOTA_EXCEEDED','Transport exceeded the bounded byte contract',{path});aborted(signal);return Uint8Array.from(received);}
 async function exactRead(path,size,hash,signal){const bytes=await read(path,size,signal);if(bytes.length!==size||await R.sha256(bytes)!==hash)fail('RESOURCE_CORRUPT','Catalogue reference bytes changed',{path});aborted(signal);return bytes;}
 async function descriptor(entry,signal){
  const leases=[reserve(entry.manifestBytes+entry.releaseBytes,'descriptor-pending-bytes')];let retained=false;
  try{
   const fetched=await Promise.allSettled([exactRead(entry.manifestPath,entry.manifestBytes,entry.manifestSha256,signal),exactRead(entry.releasePath,entry.releaseBytes,entry.releaseSha256,signal)]);
   for(const result of fetched)if(result.status==='rejected')throw result.reason;const [rawManifest,rawRelease]=fetched.map(result=>result.value);
   const manifest=R.parse(rawManifest,{schemaName:'manifest'}),release=R.parse(rawRelease,{schemaName:'release'});
   // Parsing is synchronous. Account its complete candidate before another await;
   // this reservation model is not a measurement of parser or native heap peaks.
   leases.push(reserve(metadataBytes(manifest)+metadataBytes(release),'descriptor-pending-records'));R.validateManifest(manifest,{knownTrackIds});await R.verifyRelease(rawManifest,release);
   if(manifest.packId!==entry.packId||manifest.version!==entry.version||release.payloadDigest!==entry.payloadDigest)fail('RESOURCE_CORRUPT','Catalogue identity differs from the exact descriptor');
   const held={value:{manifest:R.deepFreeze(manifest),release:R.deepFreeze(release),rawManifest,rawRelease},lease:groupedLease(leases),users:0,retired:false};retained=true;return held;
  }finally{if(!retained)for(const lease of leases)lease.release();}
 }
 async function refreshCatalogue(cataloguePath='packs/catalogue.v1.json',{signal}={}){
  const generation=++refreshGeneration;
  const nextEntries=new Map(),nextDescriptors=new Map(),nextRows=[],newProjectionLeases=[],newDescriptorLeases=[],borrowedDescriptors=[];let committed=false;
  try{
  const pendingCatalogue=reserve(MAX_CATALOGUE_BYTES,'catalogue-pending-bytes');newProjectionLeases.push(pendingCatalogue);let rawCatalogue;
  try{rawCatalogue=await read(cataloguePath,MAX_CATALOGUE_BYTES,signal);}catch(error){pendingCatalogue.release();throw error;}
  newProjectionLeases.push(reserve(rawCatalogue.length,'catalogue-retained-bytes'));pendingCatalogue.release();const parsed=validateCatalogue(R.parse(rawCatalogue));newProjectionLeases.push(reserve(metadataBytes(parsed),'catalogue-candidate'));const retainedReleases=await store.listReleases();
  for(const entry of parsed.entries){
   aborted(signal);permittedURL(entry.manifestPath,origin,admittedRoots);permittedURL(entry.releasePath,origin,admittedRoots);nextEntries.set(entry.payloadDigest,entry);
   let row={packId:entry.packId,version:entry.version,payloadDigest:entry.payloadDigest,name:entry.packId,available:false,status:'UNAVAILABLE',reason:null,descriptorVerified:false,verifiedRelease:retainedReleases.some(release=>release.payloadDigest===entry.payloadDigest),installed:false};
   try{let held=descriptors.get(entry.payloadDigest);if(held){held.users++;borrowedDescriptors.push(held);if(held.value.rawManifest.length!==entry.manifestBytes||held.value.release.manifestSha256!==entry.manifestSha256||held.value.rawRelease.length!==entry.releaseBytes||await R.sha256(held.value.rawRelease)!==entry.releaseSha256)fail('RESOURCE_CORRUPT','Catalogue pins changed for a retained descriptor');}if(!held){held=await descriptor(entry,signal);newDescriptorLeases.push(held);}nextDescriptors.set(entry.payloadDigest,held);const value=held.value;row.name=value.manifest.name;row.description=value.manifest.description;row.descriptorVerified=true;
    const compatibility=negotiateProvider(value.manifest);if(!compatibility||typeof compatibility.then==='function')fail('UNSUPPORTED_PROVIDER','Exact native provider admission must complete synchronously');row.capabilities=R.clone(compatibility);const lifecycle=typeof store.getStatus==='function'?await store.getStatus(entry.payloadDigest):null;
    if(retainedReleases.some(release=>(release.manifestSummary||release.manifest)?.packId===entry.packId&&(release.manifestSummary||release.manifest)?.version===entry.version&&release.payloadDigest!==entry.payloadDigest))row.reason='VERSION_CONFLICT';else if(lifecycle?.retired===true||lifecycle?.state==='retired'||lifecycle?.status==='retired'){row.reason='RELEASE_RETIRED';}else{row.available=true;row.status='AVAILABLE';}
   }catch(error){if(error.name==='AbortError')throw error;row.reason=error.code||'UNAVAILABLE_CONTENT';row.message=error.message;}
   newProjectionLeases.push(reserve(metadataBytes(row),'catalogue-row-candidate'));nextRows.push(R.deepFreeze(row));
  }
  aborted(signal);if(generation!==refreshGeneration)fail('STALE_REQUEST','A newer catalogue refresh superseded this result');for(const [key,value]of descriptors)if(nextDescriptors.get(key)!==value)retire(value);for(const lease of projectionLeases)lease.release();entries.clear();descriptors.clear();for(const [key,value]of nextEntries)entries.set(key,value);for(const [key,value]of nextDescriptors)descriptors.set(key,value);projectionLeases=newProjectionLeases;rows=Object.freeze(nextRows);catalogueLoaded=true;committed=true;return listAvailable();
  }finally{if(!committed){for(const lease of newProjectionLeases)lease.release();for(const held of newDescriptorLeases)retire(held);}for(const held of borrowedDescriptors){held.users--;if(held.retired&&held.users===0)held.lease.release();}}
 }
 function listAvailable(){return rows.map(row=>R.deepFreeze(R.clone(row)));}
 async function resolveDependency(reference){
  let found;try{found=await store.getRelease(reference.payloadDigest);}catch(error){if(error.code==='RESOURCE_MISSING')fail('MISSING_DEPENDENCY','Exact verified dependency is unavailable',reference);throw error;}if(!found||found.manifest?.packId!==reference.packId||found.payloadDigest!==reference.payloadDigest)fail('MISSING_DEPENDENCY','Exact verified dependency is unavailable',reference);return {...found,verification:{...found.verification,resources:found.resourcesVerified===true||found.verification?.resourcesVerified===true||found.verification?.resources===true}};
 }
 async function inspectRelease(source,{signal}={}){
  aborted(signal);let pinned=null,pinnedLease=null,request=source;
  try{
  if(source&&typeof source==='object'&&Object.getOwnPropertyDescriptor(source,'kind')?.value==='catalogue-release'){const reference=R.clone(source);if(!keys(reference,['kind','payloadDigest'])||!digest(reference.payloadDigest))fail('UNPERMITTED_SOURCE','Invalid exact catalogue release reference');source=reference.payloadDigest;}
  if(typeof source==='string'){
   if(!digest(source)||!catalogueLoaded||!entries.has(source))fail('UNKNOWN_RELEASE','Release is absent from the exact generated catalogue');pinned=R.clone(entries.get(source));pinnedLease=reserve(metadataBytes(pinned),'inspection-catalogue-reference');
   const held=descriptors.get(source);if(!held)fail('UNAVAILABLE_CONTENT','Catalogue descriptor has not been verified');held.users++;
   try{const value=held.value;negotiateProvider(value.manifest);const resources=new Map(),directory=pinned.manifestPath.slice(0,-'manifest.json'.length);for(const asset of value.manifest.assets){aborted(signal);resources.set(asset.path,await exactRead(directory+asset.path,asset.bytes,asset.sha256,signal));}request={kind:'directory-bytes',rawManifest:Uint8Array.from(value.rawManifest),rawRelease:Uint8Array.from(value.rawRelease),resources};}finally{held.users--;if(held.retired&&held.users===0)held.lease.release();}
  }
  const result=await ingestion.inspectPackage(request,{signal,knownTrackIds,negotiateProvider,resolveDependency,origin});aborted(signal);
  if(!result||!digest(result.payloadDigest)||result.payloadDigest!==result.release?.payloadDigest||result.manifest?.format!=='sphere-biome-pack/1'||!(result.rawManifest instanceof Uint8Array)||!(result.resources instanceof Map)||result.verification?.resources!==true||result.verification?.provider!==true||result.verification?.dependencies!==true)fail('INVALID_VERIFICATION','Ingestion did not return a complete verified byte record');
  if(pinned&&(result.payloadDigest!==pinned.payloadDigest||result.manifest.packId!==pinned.packId||result.manifest.version!==pinned.version))fail('RESOURCE_CORRUPT','Ingested release differs from its exact catalogue identity');return result;
  }finally{pinnedLease?.release();}
 }
 async function registerRelease(source,{operationId,idempotencyKey,signal}={}){const result=await inspectRelease(source,{signal});aborted(signal);const receipt=await store.commitVerified(result,{operationId,idempotencyKey,signal});return receipt;}
 async function listVerified(){const stored=await store.listReleases(),out=[];if(!Array.isArray(stored)||stored.length>64)fail('INVALID_VERIFICATION','Stored release projection exceeds the registry limit');for(const entry of stored){const summary=entry?.manifestSummary||entry?.manifest;if(!entry||!digest(entry.payloadDigest)||!summary||!['sphere-biome-pack/1','sphere-biome-release-summary/1'].includes(summary.format)||typeof summary.packId!=='string'||!/^[a-z][a-z0-9-]{2,127}$/.test(summary.packId)||typeof summary.version!=='string'||summary.version.length>64||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(summary.version)||typeof summary.name!=='string'||summary.name.length>160)fail('INVALID_VERIFICATION','Stored release projection lacks a bounded exact summary');const status=typeof store.getStatus==='function'?await store.getStatus(entry.payloadDigest):null;out.push(R.deepFreeze({packId:summary.packId,version:summary.version,name:summary.name,payloadDigest:entry.payloadDigest,state:'VERIFIED',lifecycle:R.clone(status??null),installed:false}));}return out;}
 return Object.freeze({refreshCatalogue,listAvailable,inspectRelease,registerRelease,listVerified,resolveDependency,inspect:()=>({catalogueLoaded,entries:entries.size,verifiedDescriptors:descriptors.size,metadataHeldBytes,metadataPeakBytes,metadataCacheLimitBytes:MAX_METADATA_CACHE_BYTES,metadataMeasurement:'CONSERVATIVE_LOGICAL_RESERVATION_NOT_NATIVE_HEAP',installedProjection:'UNIMPLEMENTED_UNTIL_BINDING_PUBLICATION'}),dispose(){closed=true;refreshGeneration++;for(const held of descriptors.values())retire(held);for(const lease of projectionLeases)lease.release();projectionLeases=[];descriptors.clear();entries.clear();rows=Object.freeze([]);}});
}
const api={FORMAT,MAX_ENTRIES,MAX_CATALOGUE_BYTES,MAX_METADATA_CACHE_BYTES,metadataBytes,validateCatalogue,permittedURL,fetchBounded,create};root.SphereBiomeRegistry=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
