/* Retained verified release bytes. No method here publishes geographic heads. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const DIGEST=/^[0-9a-f]{64}$/,TOKEN=/^[a-z][a-z0-9-]{2,127}$/;
const MAX_RELEASES=64,MAX_RESOURCE=67108864,MAX_EXPANDED=268435456;
const scope=Object.freeze(['resources','releases','releaseStatus','operations']);
function fail(code,message,details={}){throw R.error(code,message,details,'release-store');}
function check(signal){if(signal?.aborted)fail('CANCELLED','Release verification was cancelled');}
function rawCopy(value){return Uint8Array.from(R.bytes(value));}
function bounded(value,maximum,label){if(typeof value==='string')fail('INVALID_DESCRIPTOR','Retained '+label+' must use exact raw bytes');const raw=R.bytes(value);if(raw.byteLength>maximum)fail('BUDGET_EXCEEDED',label+' exceeds retained byte quota',{bytes:raw.byteLength,maximum});return raw;}
function retainedMetadata(resource){
 const allowed=['digest','bytes','releaseOwners','publishedOwners','cache','kind','rawSha256','stagingOwners','staged','rebuildable'];if(!resource||Object.getPrototypeOf(resource)!==Object.prototype||Object.keys(resource).some(k=>!allowed.includes(k))||!DIGEST.test(resource.digest)||!(resource.bytes instanceof ArrayBuffer)||resource.bytes.byteLength>MAX_RESOURCE||typeof resource.cache!=='boolean'||resource.kind!==undefined&&resource.kind!=='raw'||resource.rawSha256!==undefined&&resource.rawSha256!==resource.digest)fail('RESOURCE_CORRUPT','Retained release assets require exact immutable raw resource metadata');
 const result={digest:resource.digest,kind:'raw',rawSha256:resource.digest,cache:resource.cache};for(const [key,pattern,maximum]of [['releaseOwners',DIGEST,64],['publishedOwners',/^(?:binding|session):[0-9a-f]{64}$/,Infinity],['stagingOwners',/^staging:[a-z0-9][a-z0-9-]{2,127}$/,Infinity]]){const values=resource[key]??(key==='stagingOwners'?[]:null);if(!Array.isArray(values)||values.length>maximum)fail('RESOURCE_CORRUPT','Unknown retained '+key);let previous='';for(const owner of values){if(typeof owner!=='string'||!pattern.test(owner)||owner<=previous)fail('RESOURCE_CORRUPT','Unknown sorted retained '+key);previous=owner;}result[key]=values.slice();}
 for(const key of ['staged','rebuildable']){if(resource[key]!==undefined&&typeof resource[key]!=='boolean')fail('RESOURCE_CORRUPT','Unknown retained resource provenance');if(resource[key]!==undefined)result[key]=resource[key];}if(R.canonicalBytes(result,{maxBytes:16777216}).byteLength*8>33554432)fail('RESOURCE_LIMIT','Complete resource owner metadata exceeds service admission');return result;
}
function statusMetadata(status,d){if(!status||status.payloadDigest!==d||!Number.isSafeInteger(status.revision)||status.revision<0||typeof status.retired!=='boolean'||Object.keys(status).some(k=>!['payloadDigest','revision','retired','pins'].includes(k)))fail('RESOURCE_CORRUPT','Unknown retained release lifecycle record');if(status.pins===undefined)return;const pins=status.pins;if(!pins||Object.getPrototypeOf(pins)!==Object.prototype||Object.keys(pins).length!==4||!['bindingDigests','sessionDigests','regionIds','reservations'].every(k=>Object.hasOwn(pins,k)&&Array.isArray(pins[k])))fail('RESOURCE_CORRUPT','Unknown complete retained pins');for(const [key,pattern]of [['bindingDigests',DIGEST],['sessionDigests',DIGEST],['regionIds',TOKEN]]){let previous='';for(const value of pins[key]){if(typeof value!=='string'||!pattern.test(value)||value<=previous)fail('RESOURCE_CORRUPT','Unknown ordered retained pins');previous=value;}}let previous='';const regions=new Set();for(const p of pins.reservations){if(!p||Object.keys(p).length!==5||!['worldId','bindingDigest','regionId','assignmentDigest','guardWidthM'].every(k=>Object.hasOwn(p,k))||!TOKEN.test(p.worldId)||!DIGEST.test(p.bindingDigest)||!TOKEN.test(p.regionId)||!DIGEST.test(p.assignmentDigest)||!pins.bindingDigests.includes(p.bindingDigest)||!Number.isFinite(p.guardWidthM)||Object.is(p.guardWidthM,-0)||p.guardWidthM<0||p.guardWidthM>1000000000)fail('RESOURCE_CORRUPT','Unknown complete retained reservation');const k=p.worldId+'\n'+p.bindingDigest+'\n'+p.regionId;if(k<=previous)fail('RESOURCE_CORRUPT','Retained reservations are not ordered');previous=k;regions.add(p.regionId);}if(R.canonicalJSON([...regions].sort())!==R.canonicalJSON(pins.regionIds))fail('RESOURCE_CORRUPT','Retained reservation projection differs');if(R.canonicalBytes(pins,{maxBytes:16777216}).byteLength*8>33554432)fail('RESOURCE_LIMIT','Complete retained pins exceed service admission');}
function create({storage,negotiateProvider}={}){
 if(!storage||typeof storage.transaction!=='function'||typeof negotiateProvider!=='function')fail('INVALID_DESCRIPTOR','Verified store requires storage and exact host admission');
 async function getRelease(payloadDigest,{signal,includeResources=true}={}){
  if(!DIGEST.test(payloadDigest))fail('INVALID_DESCRIPTOR','Invalid exact release identity');check(signal);
  const data=await storage.get('releases',payloadDigest,{signal});if(!data)fail('RESOURCE_MISSING','Exact release is unavailable',{payloadDigest});
  const raw=rawCopy(bounded(data.rawManifest,1048576,'manifest')),resources=new Map(),descriptor=await R.verifyRelease(raw,data.release);
  if(includeResources)for(const asset of descriptor.manifest.assets){check(signal);const resource=await storage.get('resources',asset.sha256,{signal});if(!resource)fail('RESOURCE_MISSING','Retained release resource is unavailable',{payloadDigest,path:asset.path,digest:asset.sha256});const metadata=retainedMetadata(resource);if(metadata.digest!==asset.sha256)fail('RESOURCE_CORRUPT','Retained resource key differs');const bytes=bounded(resource.bytes,MAX_RESOURCE,'resource');if(bytes.length!==asset.bytes)fail('RESOURCE_CORRUPT','Retained resource length differs',{path:asset.path});resources.set(asset.path,rawCopy(bytes));}
  const checked=await R.verifyRelease(raw,data.release,includeResources?resources:undefined);check(signal);
  if(checked.release.payloadDigest!==payloadDigest||R.canonicalJSON(checked.manifest)!==R.canonicalJSON(data.manifest))fail('RESOURCE_CORRUPT','Stored release identity differs',{payloadDigest});
  return {payloadDigest,manifest:R.deepFreeze(checked.manifest),release:R.deepFreeze(R.clone(data.release)),rawManifest:raw,resources,verification:R.deepFreeze(R.clone(data.verification)),resourcesVerified:checked.resourcesVerified};
 }
 async function listReleases({signal}={}){
  const keys=await storage.getAllKeys('releases',{signal}),result=[];if(keys.length>MAX_RELEASES)fail('BUDGET_EXCEEDED','Retained release catalogue exceeds version-one capacity');
  for(const key of keys){check(signal);const retained=await getRelease(key,{signal,includeResources:false}),status=await storage.get('releaseStatus',key,{signal});result.push(R.deepFreeze({payloadDigest:retained.payloadDigest,manifestSummary:{format:'sphere-biome-release-summary/1',packId:retained.manifest.packId,version:retained.manifest.version,name:retained.manifest.name},status:status||null,installed:false}));}
  return result.sort((a,b)=>a.manifestSummary.packId<b.manifestSummary.packId?-1:a.manifestSummary.packId>b.manifestSummary.packId?1:a.payloadDigest<b.payloadDigest?-1:1);
 }
 async function dependencies(manifest,signal){
  const resolved=new Map(),visiting=new Set();
  async function visit(reference){
   check(signal);if(visiting.has(reference.payloadDigest))fail('INVALID_DESCRIPTOR','Exact resource dependencies form a cycle',{payloadDigest:reference.payloadDigest});
   const previous=resolved.get(reference.payloadDigest);if(previous){if(previous.manifest.packId!==reference.packId)fail('RESOURCE_CORRUPT','Dependency pack ID differs');return;}
   if(resolved.size+visiting.size>=MAX_RELEASES)fail('BUDGET_EXCEEDED','Dependency closure exceeds release capacity');
   visiting.add(reference.payloadDigest);let release=await getRelease(reference.payloadDigest,{signal,includeResources:false});
   if(release.manifest.packId!==reference.packId)fail('RESOURCE_CORRUPT','Exact resource dependency has another pack ID',{payloadDigest:reference.payloadDigest,expected:reference.packId,actual:release.manifest.packId});
   // Do not accumulate every dependency's resource buffers or full manifest.
   // Verify one resource at a time, retaining only exact graph identities.
   for(const asset of release.manifest.assets){check(signal);const bytes=await getResource(asset.sha256,{signal});if(bytes.length!==asset.bytes)fail('RESOURCE_CORRUPT','Dependency resource length differs',{payloadDigest:reference.payloadDigest,path:asset.path});}
   const next=R.clone(release.manifest.dependencies),identity={manifest:{packId:release.manifest.packId},release:{manifestSha256:release.release.manifestSha256},resources:release.manifest.assets.map(asset=>asset.sha256)};release=null;
   for(const dep of next)await visit(dep);visiting.delete(reference.payloadDigest);resolved.set(reference.payloadDigest,identity);
  }
  for(const dep of manifest.dependencies)await visit(dep);return resolved;
 }
 async function commitVerified(input,{operationId,idempotencyKey,signal}={}){
  check(signal);if(!TOKEN.test(operationId)||!TOKEN.test(idempotencyKey))fail('INVALID_DESCRIPTOR','An ingestion operation needs bounded persistent identities');
  // Take ownership before hashes yield. Never retain a caller's mutable buffers.
  const rawInput=bounded(input.rawManifest,1048576,'manifest'),release=R.parse(R.canonicalBytes(input.release,{maxBytes:65536}),{schemaName:'release',maxBytes:65536}),resources=new Map();
  if(!(input.resources instanceof Map)||input.resources.size>4096)fail('INVALID_DESCRIPTOR','Invalid retained resource map');
  let expanded=0;for(const [name,bytes]of input.resources){R.validatePath(name);const view=bounded(bytes,MAX_RESOURCE,'resource');expanded+=view.length;if(expanded>MAX_EXPANDED)fail('BUDGET_EXCEEDED','Release exceeds expanded resource limit');}
  const raw=rawCopy(rawInput);for(const [name,bytes]of input.resources)resources.set(name,rawCopy(bytes));
  const verified=await R.verifyRelease(raw,release,resources);check(signal);if(!verified.resourcesVerified)fail('RESOURCE_CORRUPT','Release resources were not completely verified');
  const compatible=negotiateProvider(verified.manifest);if(!compatible||typeof compatible.then==='function')fail('UNSUPPORTED_PROVIDER','Exact host admission must complete synchronously before storage');
  const closure=await dependencies(verified.manifest,signal);check(signal);
  const payloadDigest=verified.release.payloadDigest,manifest=R.deepFreeze(R.clone(verified.manifest));
  if(manifest.dependencies.some(dep=>dep.payloadDigest===payloadDigest))fail('INVALID_DESCRIPTOR','A release cannot depend on itself');
  const verification=R.deepFreeze({format:'sphere-biome-release-verification/1',payloadDigest,manifestSha256:release.manifestSha256,resourcesVerified:true,dependencyDigests:[...closure.keys()].sort(),provider:R.clone(compatible),expandedResourceBytes:expanded,worldPublished:false});
  // No hashing, network, worker or await occurs within this publication-free tx.
  return storage.transaction(scope,'readwrite',ctx=>{
   const releases=ctx.store('releases'),operations=ctx.store('operations'),resourceStore=ctx.store('resources'),statuses=ctx.store('releaseStatus');
   const pending={count:0,values:{}},read=(key,request)=>{pending.count++;ctx.request(request,value=>{pending.values[key]=value;if(--pending.count===0)decide();});};
   read('operation',operations.get(operationId));read('retry',operations.index('idempotencyKey').get(idempotencyKey));read('same',releases.get(payloadDigest));read('status',statuses.get(payloadDigest));read('version',releases.index('packVersion').get([manifest.packId,manifest.version]));read('count',releases.count());
   for(const [digest]of closure)read('dependency:'+digest,releases.get(digest));
   const dependencyResources=new Set([...closure.values()].flatMap(value=>value.resources));for(const digest of dependencyResources)read('dependency-resource:'+digest,resourceStore.getKey(digest));
   const byDigest=new Map();for(const asset of manifest.assets){if(!byDigest.has(asset.sha256)){byDigest.set(asset.sha256,{asset,bytes:resources.get(asset.path)});read('resource:'+asset.sha256,resourceStore.get(asset.sha256));}}
   function decide(){
    const v=pending.values,retry=v.retry||v.operation;
    if(v.operation&&v.operation.idempotencyKey!==idempotencyKey)fail('VERSION_CONFLICT','Operation ID belongs to another persistent request key',{operationId,idempotencyKey});
    if(retry){if(retry.format!=='sphere-biome-ingest-operation/1'||retry.idempotencyKey!==idempotencyKey||retry.payloadDigest!==payloadDigest)fail('VERSION_CONFLICT','Operation identity was already used for different verified bytes',{operationId,idempotencyKey});if(!v.same)fail('RESOURCE_MISSING','The retained ingestion receipt has lost its exact release',{payloadDigest});if(retry.receipt?.payloadDigest!==payloadDigest||retry.receipt?.durableVerified!==true||retry.receipt?.worldPublished!==false)fail('RESOURCE_CORRUPT','Retained ingestion receipt differs');}
    if(v.version&&v.version.payloadDigest!==payloadDigest)fail('VERSION_CONFLICT','Pack ID and display version already identify different exact bytes',{packId:manifest.packId,version:manifest.version,retainedDigest:v.version.payloadDigest,attemptedDigest:payloadDigest});
    if(!v.same&&v.count>=MAX_RELEASES)fail('BUDGET_EXCEEDED','Installed release record capacity is exhausted',{limit:MAX_RELEASES});
    for(const [digest,dep]of closure){const current=v['dependency:'+digest];if(!current||current.payloadDigest!==digest||current.manifest.packId!==dep.manifest.packId||current.release.manifestSha256!==dep.release.manifestSha256)fail('RESOURCE_MISSING','Dependency changed before retained release write',{payloadDigest:digest});}
    for(const digest of dependencyResources)if(v['dependency-resource:'+digest]!==digest)fail('RESOURCE_MISSING','Exact dependency resource disappeared before retained release write',{digest});
    if(v.same&&(!v.status||v.status.payloadDigest!==payloadDigest||v.same.payloadDigest!==payloadDigest||v.same.packId!==manifest.packId||v.same.version!==manifest.version||R.canonicalJSON(v.same.release)!==R.canonicalJSON(release)||v.same.rawManifest.byteLength!==raw.length||!sameBytes(new Uint8Array(v.same.rawManifest),raw)||R.canonicalJSON(v.same.manifest)!==R.canonicalJSON(manifest)))fail('RESOURCE_CORRUPT','Existing exact release record differs');
    if(v.status)statusMetadata(v.status,payloadDigest);
    for(const [digest,item]of byDigest){const previous=v['resource:'+digest];if(v.same&&!previous)fail('RESOURCE_MISSING','Retained exact release has lost a resource',{digest});if(previous){retainedMetadata(previous);if(previous.digest!==digest||previous.bytes.byteLength!==item.bytes.length||!sameBytes(new Uint8Array(previous.bytes),item.bytes))fail('RESOURCE_CORRUPT','Existing verified resource bytes differ',{digest});}}
    if(retry){ctx.setResult(R.deepFreeze({...retry.receipt,idempotent:true}));return;}
    for(const [digest,item]of byDigest){const previous=v['resource:'+digest],metadata=previous?retainedMetadata(previous):{digest,kind:'raw',rawSha256:digest,releaseOwners:[],publishedOwners:[],stagingOwners:[],cache:false};if(!metadata.releaseOwners.includes(payloadDigest))metadata.releaseOwners.push(payloadDigest);metadata.releaseOwners.sort();if(metadata.releaseOwners.length>MAX_RELEASES)fail('RESOURCE_LIMIT','Resource release-owner capacity exceeded');resourceStore.put({...metadata,bytes:previous?previous.bytes:item.bytes.buffer},digest);}
    if(!v.same){releases.add({payloadDigest,packId:manifest.packId,version:manifest.version,rawManifest:raw.buffer,manifest,release,verification,dependencyDigests:[...closure.keys()].sort()},payloadDigest);statuses.add({payloadDigest,revision:0,retired:false,pins:{bindingDigests:[],sessionDigests:[],regionIds:[],reservations:[]}},payloadDigest);}
    const receipt={format:'sphere-biome-ingest-receipt/1',operationId,idempotencyKey,payloadDigest,durableVerified:true,worldPublished:false,idempotent:!!v.same};
    operations.add({format:'sphere-biome-ingest-operation/1',operationId,idempotencyKey,payloadDigest,receipt},operationId);ctx.setResult(R.deepFreeze(receipt));
   }
  },{signal});
 }
 async function getResource(digest,{signal}={}){if(!DIGEST.test(digest))fail('INVALID_DESCRIPTOR','Invalid exact resource digest');const resource=await storage.get('resources',digest,{signal});if(!resource)fail('RESOURCE_MISSING','Exact retained resource is unavailable',{digest});const metadata=retainedMetadata(resource);if(metadata.digest!==digest)fail('RESOURCE_CORRUPT','Retained resource key differs');const bytes=rawCopy(bounded(resource.bytes,MAX_RESOURCE,'resource'));if(await R.sha256(bytes)!==digest)fail('RESOURCE_CORRUPT','Retained resource digest differs',{digest});check(signal);return bytes;}
 return Object.freeze({commitVerified,getRelease,listReleases,getResource,getStatus:(digest,options)=>storage.get('releaseStatus',digest,options),getOperation:(id,options)=>storage.get('operations',id,options)});
}
function sameBytes(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index]);}
const api=Object.freeze({create,MAX_RELEASES,MAX_RESOURCE,MAX_EXPANDED});root.SphereBiomeReleaseStore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
