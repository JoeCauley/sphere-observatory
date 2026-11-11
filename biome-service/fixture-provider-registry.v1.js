/* Trusted compiled extension catalogue. Imported releases cannot add code or
 * choose a browser program. The shared service receives only admitted entries. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('./records.js'):null),D=root.SphereBiomeNativeFixtureDefinition||(node?require('./native/fixture-definition.js'):null),owners=new WeakSet();
const ENTRIES=Object.freeze([
 {id:'fixture-heightfield-v1',namespace:'SphereBiomeFixtureTrackMeadow',path:'native/providers/fixture-track-meadow'},
 {id:'fixture-structures-v1',namespace:'SphereBiomeFixtureOpenIndustry',path:'native/providers/fixture-open-industry'}
].map(Object.freeze));
function fail(code,message,details={}){throw R.error(code,message,details,'fixture-provider-registry');}
function entryFor(profile){const entry=ENTRIES.find(e=>e.id===profile?.body?.id);if(!entry||profile.body.entryPath!=='biome-service/'+entry.path+'.js')fail('UNSUPPORTED_PROVIDER','Provider is absent from the trusted compiled extension catalogue');return entry;}
function sourceRows(profiles){if(!Array.isArray(profiles)||!profiles.length||profiles.length>ENTRIES.length)fail('UNSUPPORTED_PROVIDER','A bounded explicit extension set is required');const rows=new Map();for(const spec of profiles){entryFor(spec.provider);for(const row of [...spec.provider.body.closure,...spec.codec.body.closure]){const prior=rows.get(row.path);if(prior&&(prior.bytes!==row.bytes||prior.sha256!==row.sha256))fail('SOURCE_PROFILE_MISMATCH','Admitted extensions disagree about shared source bytes',{path:row.path});rows.set(row.path,row);}}return [...rows.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
function nodeFactory(id){if(id==='fixture-heightfield-v1')return require('./native/providers/fixture-track-meadow.js');if(id==='fixture-structures-v1')return require('./native/providers/fixture-open-industry.js');fail('UNSUPPORTED_PROVIDER','Unknown compiled provider');}
async function create(profiles,{realm=root}={}){
 sourceRows(profiles);const entries=new Map(),staticFactories=new Map(),staticCodecs=new Map(),providerProfiles=[],codecProfiles=[],backends=new Set();
 for(const spec of profiles){await R.verifyEnvelope(spec.provider);await R.verifyEnvelope(spec.codec);const descriptor=entryFor(spec.provider),factory=realm[descriptor.namespace]||(node&&realm===root?nodeFactory(descriptor.id):null);if(!D.isFactory(factory))fail('HOST_EXTENSION_UNAVAILABLE','An admitted compiled extension is unavailable',{namespace:descriptor.namespace});if(entries.has(factory.extensionId))fail('UNSUPPORTED_PROVIDER','Repeated compiled extension identity');const configured=factory.configure(spec.provider);if(!D.isConfigured(configured)||R.canonicalJSON(spec.codec.body.provider)!==R.canonicalJSON(configured.reference))fail('UNSUPPORTED_PROVIDER','Support codec and compiled provider identities differ');
  const item=Object.freeze({factory,configured,provider:spec.provider,codec:spec.codec});entries.set(factory.extensionId,item);staticFactories.set(factory.extensionId,configured);staticCodecs.set(spec.codec.body.id,{reference:{id:spec.codec.body.id,digest:spec.codec.digest,providerDigest:spec.provider.digest},...factory.codec});providerProfiles.push(spec.provider);codecProfiles.push(spec.codec);backends.add(factory.backendProfile);
 }
 function select(manifest){const item=entries.get(manifest?.provider?.id);if(!item||R.canonicalJSON(item.configured.reference)!==R.canonicalJSON(manifest.provider))fail('UNSUPPORTED_PROVIDER','Exact manifest provider is not admitted by this host extension set');return item;}
 const owner=Object.freeze({select,boundaryOptions:()=>({providerProfiles:[...providerProfiles],staticFactories:new Map(staticFactories),codecProfiles:[...codecProfiles],staticCodecs:new Map(staticCodecs),backendProfiles:[...backends]}),inspect:()=>({providers:providerProfiles.map(v=>({id:v.body.id,digest:v.digest})),codecs:codecProfiles.map(v=>({id:v.body.id,digest:v.digest}))})});owners.add(owner);return owner;
}
const api=Object.freeze({ENTRIES,entryFor,sourceRows,create,isOwner:value=>owners.has(value)});root.SphereBiomeFixtureProviderRegistry=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
