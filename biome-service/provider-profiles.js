/* Host-admitted code identities. Pack bytes never choose or import a factory. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const PROFILE='sphere-biome-provider-profile/1', ABI='sphere-biome-provider/1';
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{2,127}$/.test(v);
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const capability=v=>typeof v==='string'&&/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(v)&&v.length<=96;
function fail(code,message,details={}){const e=new Error(message);e.code=code;e.phase='provider-admission';e.details=details;throw e;}
function exactKeys(value,keys){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function pathValid(value){return typeof value==='string'&&value.length<=240&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)&&value.split('/').every(p=>p!==''&&p!=='.'&&p!=='..');}
function uniqueList(values,predicate,max=64){return Array.isArray(values)&&values.length<=max&&values.every(predicate)&&new Set(values).size===values.length;}
function immutable(value){if(value&&typeof value==='object'){for(const item of Object.values(value))immutable(item);Object.freeze(value);}return value;}
function validateProfile(body){
 body=R.clone(body);
 const keys=['format','id','abi','backendProfile','entryPath','closure','recipeSchemaIds','capabilities','representationProfiles','fallbackProfiles','revealProfiles','stateCodecs'];
 if(!exactKeys(body,keys)||body.format!==PROFILE||!id(body.id)||body.abi!==ABI||!id(body.backendProfile)||!pathValid(body.entryPath))fail('INVALID_DESCRIPTOR','Invalid host provider profile');
 for(const field of ['recipeSchemaIds','representationProfiles','fallbackProfiles','revealProfiles'])if(!uniqueList(body[field],id))fail('INVALID_DESCRIPTOR','Invalid '+field);
 if(!body.recipeSchemaIds.length||!body.representationProfiles.length||!body.fallbackProfiles.length||!uniqueList(body.capabilities,capability))fail('INVALID_DESCRIPTOR','Incomplete provider capability profile');
 if(!Array.isArray(body.closure)||!body.closure.length||body.closure.length>128)fail('INVALID_DESCRIPTOR','Invalid provider dependency closure');
 let last='',bytes=0;const paths=new Set();
 for(const item of body.closure){
  if(!exactKeys(item,['path','bytes','sha256'])||!pathValid(item.path)||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>4*1024*1024||!digest(item.sha256)||item.path<=last||paths.has(item.path.toLowerCase()))fail('INVALID_DESCRIPTOR','Provider closure must have exact, sorted, unique source identities');
  last=item.path;paths.add(item.path.toLowerCase());bytes+=item.bytes;
 }
 if(bytes>32*1024*1024||!body.closure.some(item=>item.path===body.entryPath))fail('INVALID_DESCRIPTOR','Provider entry must be inside its bounded dependency closure');
 if(!Array.isArray(body.stateCodecs)||!body.stateCodecs.length||body.stateCodecs.length>16)fail('INVALID_DESCRIPTOR','Invalid provider state codecs');
 const codecs=new Set();for(const codec of body.stateCodecs){
  if(!exactKeys(codec,['stateSchemaId','codecId','maximumStateBytes'])||!id(codec.stateSchemaId)||!id(codec.codecId)||!Number.isSafeInteger(codec.maximumStateBytes)||codec.maximumStateBytes<1||codec.maximumStateBytes>1048576||codecs.has(codec.stateSchemaId))fail('INVALID_DESCRIPTOR','Invalid or duplicate state codec');
  codecs.add(codec.stateSchemaId);
 }
 return immutable(JSON.parse(R.canonicalJSON(body)));
}
async function makeProfile(body){const checked=validateProfile(body);return R.envelope(checked);}
async function admit(envelopes,staticFactories,readSource,host){
 envelopes=R.clone(envelopes);host=R.clone(host);
 if(!Array.isArray(envelopes)||envelopes.length>64||!(staticFactories instanceof Map)||typeof readSource!=='function'||!host||!uniqueList(host.backendProfiles,id,16))fail('INVALID_DESCRIPTOR','Invalid host admission inputs');
 const factories=new Map();for(const [key,value]of staticFactories){
  if(!value||typeof value.create!=='function')fail('UNSUPPORTED_PROVIDER','Invalid reviewed native factory');
  factories.set(key,{reference:immutable(R.clone(value.reference)),create:value.create});
 }
 const admitted=new Map();
 for(const envelope of envelopes){
  if(!exactKeys(envelope,['digest','body'])||!digest(envelope.digest))fail('INVALID_DESCRIPTOR','Invalid provider envelope');
  const body=validateProfile(envelope.body),expected=await R.envelope(body);
  if(expected.digest!==envelope.digest)fail('RESOURCE_CORRUPT','Provider profile digest mismatch');
  if(admitted.has(body.id))fail('INVALID_DESCRIPTOR','Duplicate admitted provider ID');
  for(const item of body.closure){
   const received=await readSource(item.path);
   if(!(received instanceof Uint8Array)||received.byteLength!==item.bytes)fail('RESOURCE_CORRUPT','Host extension dependency identity mismatch',{path:item.path});
   const bytes=Uint8Array.from(received);
   if(await R.sha256(bytes)!==item.sha256)fail('RESOURCE_CORRUPT','Host extension dependency identity mismatch',{path:item.path});
  }
  const factory=factories.get(body.id);
  if(!factory||typeof factory.create!=='function'||!exactKeys(factory.reference,['id','abi','digest','backendProfile'])||factory.reference.id!==body.id||factory.reference.abi!==body.abi||factory.reference.digest!==envelope.digest||factory.reference.backendProfile!==body.backendProfile)fail('UNSUPPORTED_PROVIDER','Exact reviewed native factory is unavailable',{id:body.id,digest:envelope.digest});
  if(!host.backendProfiles.includes(body.backendProfile))fail('UNSUPPORTED_PROVIDER','Provider graphics backend is unavailable');
  admitted.set(body.id,{body,reference:immutable({...factory.reference}),create:factory.create});
 }
 function negotiate(manifest){
  manifest=R.clone(manifest);
  R.validateManifest(manifest);
  const entry=admitted.get(manifest.provider.id),ref=manifest.provider;
  if(!entry||Object.keys(entry.reference).some(k=>entry.reference[k]!==ref[k]))fail('UNSUPPORTED_PROVIDER','Pack requires an unavailable exact native provider',ref);
  const p=entry.body;
  if(!p.recipeSchemaIds.includes(manifest.recipeSchemaId))fail('UNSUPPORTED_PROVIDER','Provider recipe schema is unavailable');
  if(manifest.addressProfile!=='sphere-world-address-v2'||manifest.timeProfile!=='sphere-clock-v1')fail('UNSUPPORTED_CONTRACT','Provider requires a different host address or clock profile');
  const missing=manifest.capabilities.required.filter(v=>!p.capabilities.includes(v));
  if(missing.length)fail('UNSUPPORTED_CAPABILITY','Required provider capabilities are unavailable',{missing});
  for(const representation of manifest.representations)if(!p.representationProfiles.includes(representation.profileId))fail('UNSUPPORTED_PROVIDER','Representation profile is unavailable');
  if(!p.fallbackProfiles.includes(manifest.fallback.profileId))fail('UNSUPPORTED_PROVIDER','Solid fallback profile is unavailable');
  if(manifest.presentation.revealProfileId&&!p.revealProfiles.includes(manifest.presentation.revealProfileId))fail('UNSUPPORTED_CAPABILITY','Required presentation profile is unavailable');
  const codec=p.stateCodecs.find(c=>c.stateSchemaId===manifest.persistence.stateSchemaId&&c.codecId===manifest.persistence.codecId);
  if(!codec||manifest.persistence.maximumStateBytes>codec.maximumStateBytes)fail('UNSUPPORTED_PROVIDER','Provider persistent-state codec is unavailable');
  return immutable({provider:{...entry.reference},availableOptional:manifest.capabilities.optional.filter(v=>p.capabilities.includes(v)),unavailableOptional:manifest.capabilities.optional.filter(v=>!p.capabilities.includes(v))});
 }
 // No module URL or factory name supplied by a pack ever reaches this method.
 function create(manifest,validatedRecipe,hostServices){manifest=R.clone(manifest);negotiate(manifest);return admitted.get(manifest.provider.id).create(validatedRecipe,hostServices);}
 return Object.freeze({negotiate,create,list:()=>[...admitted.values()].map(e=>e.reference)});
}
const api={PROFILE,ABI,validateProfile,makeProfile,admit};root.SphereBiomeProviderProfiles=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
