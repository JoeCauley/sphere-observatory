'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../biome-service/records.js'),P=require('../biome-service/provider-profiles.js');
const repo=path.resolve(__dirname,'..'),results=[];
const check=(name,details={})=>results.push({name,status:'PASS',...details});
const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);};
(async()=>{
 const sourcePath='tests/fixtures/biome-service/admission-probe.js',source=fs.readFileSync(path.join(repo,sourcePath));
 const body={format:P.PROFILE,id:'abi-admission-probe-v1',abi:P.ABI,backendProfile:'webgl2-static-surface-v1',entryPath:sourcePath,
  closure:[{path:sourcePath,bytes:source.length,sha256:await R.sha256(source)}],recipeSchemaIds:['design-fixture-recipe-v1'],
  capabilities:['surface.heightfield','representation.overview','representation.surface','representation.detail','movement.flight','movement.walk','surface.mesh-collision'],
  representationProfiles:['fixture-overview-v1','fixture-surface-v1','fixture-detail-v1'],fallbackProfiles:['fixture-coarse-solid-v1'],revealProfiles:[],
  stateCodecs:[{stateSchemaId:'fixture-state-v1',codecId:'fixture-state-codec-v1',maximumStateBytes:65536}]};
 const profile=await P.makeProfile(body),reference={id:body.id,abi:body.abi,digest:profile.digest,backendProfile:body.backendProfile};
 let creates=0;const factories=new Map([[body.id,{reference,create:(recipe,services)=>{creates++;return require('./fixtures/biome-service/admission-probe.js').create(recipe,services);}}]]);
 const readSource=async name=>{assert.equal(name,sourcePath);return source;},host={backendProfiles:[body.backendProfile]};
 const admission=await P.admit([profile],factories,readSource,host);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/biome-service/design-examples/fixture-open-industry/manifest.json'),'utf8'));
 const designManifest=structuredClone(manifest);manifest.provider=reference;
 manifest.capabilities.optional=['wind.geographic'];
 const compatible=admission.negotiate(manifest);assert.deepEqual(compatible.unavailableOptional,['wind.geographic']);assert.deepEqual(compatible.availableOptional,[]);
 assert.equal(creates,0);const probe=admission.create(manifest,Object.freeze({purpose:'unit identity probe'}),Object.freeze({}));assert.equal(creates,1);assert.equal(probe.recipe.purpose,'unit identity probe');
 check('Exact trusted source closure and factory identity negotiate; optional absence is reported',{profileDigest:profile.digest,sourceSha256:body.closure[0].sha256,sourceBytes:source.length});
 await reject(()=>P.admit([profile],factories,async()=>Buffer.from('corrupt'),host),'RESOURCE_CORRUPT');
 await reject(()=>P.admit([{...profile,digest:'0'.repeat(64)}],factories,readSource,host),'RESOURCE_CORRUPT');
 await reject(()=>P.admit([profile],new Map(),readSource,host),'UNSUPPORTED_PROVIDER');
 await reject(()=>P.admit([profile],factories,readSource,{backendProfiles:[]}),'UNSUPPORTED_PROVIDER');
 await reject(()=>P.admit([profile,profile],factories,readSource,host),'INVALID_DESCRIPTOR');
 for(const edit of [b=>b.closure.push(b.closure[0]),b=>b.entryPath='https://untrusted/run.js',b=>b.closure[0].path='../run.js',b=>b.closure[0].bytes=2**54,b=>b.stateCodecs[0].maximumStateBytes=1048577,b=>b.extra='unknown',b=>b.stateCodecs.push(b.stateCodecs[0])]){
  const bad=structuredClone(body);edit(bad);assert.throws(()=>P.validateProfile(bad),e=>e.code==='INVALID_DESCRIPTOR');
 }
 check('Modified closure bytes, envelopes, factories, backends and invalid profile data refuse',{negativeCases:12});
 for(const [edit,code] of [
  [m=>m.provider.digest='0'.repeat(64),'UNSUPPORTED_PROVIDER'],[m=>m.provider.id='absent-provider','UNSUPPORTED_PROVIDER'],[m=>m.provider.abi='sphere-biome-provider/9','INVALID_DESCRIPTOR'],
  [m=>m.provider.backendProfile='unknown-backend','UNSUPPORTED_PROVIDER'],[m=>m.recipeSchemaId='unknown-recipe','UNSUPPORTED_PROVIDER'],[m=>m.capabilities.required.push('fluid.general'),'UNSUPPORTED_CAPABILITY'],
  [m=>m.representations[0].profileId='unknown-overview','UNSUPPORTED_PROVIDER'],[m=>m.fallback.profileId='unknown-fallback','UNSUPPORTED_PROVIDER'],
  [m=>m.persistence.codecId='unknown-codec','UNSUPPORTED_PROVIDER'],[m=>m.persistence.maximumStateBytes=65537,'UNSUPPORTED_PROVIDER'],
  [m=>{m.presentation={mode:'duck-blind',heightM:100000,revealProfileId:'unknown-reveal',lighting:'host-mediated'};m.capabilities.required.push('presentation.duck-blind');},'UNSUPPORTED_CAPABILITY'],
  [m=>m.capabilities.required.push('presentation.duck-blind'),'INVALID_DESCRIPTOR']]){
  const bad=structuredClone(manifest);edit(bad);assert.throws(()=>admission.negotiate(bad),e=>e.code===code);
 }
 assert.throws(()=>admission.negotiate(designManifest),e=>e.code==='UNSUPPORTED_PROVIDER');assert.equal(creates,1);
 check('Every exact selector and required feature is checked before factory invocation; design placeholders refuse',{negativeCases:13,factoryInvocations:creates});
 const empty=await P.admit([],new Map(),async()=>{throw Error('must not read');},host);assert.deepEqual(empty.list(),[]);assert.throws(()=>empty.negotiate(manifest),e=>e.code==='UNSUPPORTED_PROVIDER');
 const captured=admission.list()[0];assert(Object.isFrozen(captured));assert.throws(()=>{captured.digest='0'.repeat(64);});
 body.capabilities.push('fluid.general');assert.throws(()=>admission.negotiate({...manifest,capabilities:{required:[...manifest.capabilities.required,'fluid.general'],optional:[]}}),e=>e.code==='UNSUPPORTED_CAPABILITY');
 check('An empty generic catalogue requires no Meadow; admitted profiles are immutable copies');
 let getterCalls=0;const accessor={...profile.body};Object.defineProperty(accessor,'id',{enumerable:true,get(){getterCalls++;return body.id;}});
 assert.throws(()=>P.validateProfile(accessor),e=>e.code==='INVALID_DESCRIPTOR');assert.equal(getterCalls,0);
 const borrowed=structuredClone(profile),borrowedHost=structuredClone(host),borrowedRef={...reference};let releaseRead;
 const gate=new Promise(resolve=>{releaseRead=resolve;});const pending=P.admit([borrowed],new Map([[body.id,{reference:borrowedRef,create:factories.get(body.id).create}]]),async()=>{await gate;return source;},borrowedHost);
 borrowed.digest='0'.repeat(64);borrowed.body.capabilities.push('fluid.general');borrowedHost.backendProfiles=[];borrowedRef.digest='0'.repeat(64);releaseRead();
 const held=await pending;assert.deepEqual(held.list(),[reference]);assert.throws(()=>held.negotiate({...manifest,capabilities:{required:[...manifest.capabilities.required,'fluid.general'],optional:[]}}),e=>e.code==='UNSUPPORTED_CAPABILITY');
 check('Admission snapshots metadata and factories before asynchronous verification; accessors never execute');
 const report={format:'sphere-biome-component-test/1',scope:'BPS-P01 exact provider admission unit checks only; no native fixture or rendering claim',status:'PASS',checks:results.length,results};
 const output=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'provider-profile-tests.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.writeFileSync(path.join(output,'admission-probe-profile.json'),JSON.stringify(profile,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
