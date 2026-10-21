'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),M=require('../math.js'),V=require('../vegetation-revisions.js'),F=require('./fixtures/meadow-hr00-contract-v1.json'),H=require('./fixtures/meadow-performance-h1.json');
require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../session-state.js');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
for(const [name,hash] of Object.entries(F.sources))assert.equal(sha(fs.readFileSync(path.join(__dirname,'fixtures',name))),hash,'Historical fixture drift: '+name);
assert.deepEqual(H.limits,F.limits);assert.deepEqual(V.CURRENT,F.current);assert.equal(require('../instanced-environment.js').STRIDE,F.recordStrideBytes);assert.equal(require('../grass-stream.js').RESIDENT_RESOURCE_REVISION,F.current.residentResourceRevision);
for(const c of F.cases){assert.equal(sha(JSON.stringify(M.validate(c.state))),c.validatedSha256,'Saved-scene behavior changed: '+c.id);const session=SphereSessionCodec.decode(JSON.stringify({format:'sphere-session',version:2,shadeBodyVersion:3,state:c.state}));assert.equal(sha(JSON.stringify(session.state)),c.sessionSha256,'Saved-session behavior changed: '+c.id);const portable=M.sceneRecord(c.state);assert.deepEqual(M.validate(portable.state),M.validate(SphereMeadowWind.snapshot(c.state)));}
const state=F.cases.find(c=>c.id==='F2-G2').state,explicit={...state,meadow:{...state.meadow,...V.CURRENT}};
assert.deepEqual(V.sceneRevisions(state.meadow),{},'Implicit old scenes do not acquire new serialized fields');
for(const field of V.REVISION_FIELDS){const clean=M.validate({...state,meadow:{...state.meadow,[field]:1}});for(const [key,value] of Object.entries(V.CURRENT))assert.equal(clean.meadow[key],value);for(const bad of [0,2,-1,1.5,'1',null,NaN,Infinity])assert.throws(()=>M.validate({...explicit,meadow:{...explicit.meadow,[field]:bad}}),/Unsupported vegetation/);}
for(const field of V.LIFETIME_FIELDS)assert.throws(()=>M.validate({...state,meadow:{...state.meadow,[field]:1}}),/cannot be saved/);
assert.throws(()=>M.validate({...state,meadow:{enabled:true,packetRevision:1}}),/fixed-chart/);
const restored=SphereSessionCodec.decode(SphereSessionCodec.encode(explicit)).state;for(const field of V.REVISION_FIELDS)assert.equal(restored.meadow[field],1);
const descriptor=V.describe(explicit),key=V.contentKey(descriptor),resourceKey=V.resourceKey(descriptor);
const moved={...explicit,position:explicit.position.map((x,i)=>x+(i===0?.001:0)),time:explicit.time+123,meadow:{...explicit.meadow,windResolvedPhaseSeconds:27}};
assert.equal(V.contentKey(V.describe(moved)),key,'Camera/time/phase must not rename content');assert.equal(V.resourceKey(V.describe(moved)),resourceKey);
const revised={...explicit,meadow:{...explicit.meadow,seed:explicit.meadow.seed+1}};assert.notEqual(V.contentKey(V.describe(revised)),key,'Changed plant seed must change content identity');
assert(Object.isFrozen(descriptor.content.anchor));assert(Object.isFrozen(descriptor.revisions));
for(const c of F.cases.slice(0,2))assert.equal(V.describe(c.state),null,'Legacy scenes keep the existing route');
assert.deepEqual(V.lifetime({requestGeneration:7,slotGeneration:3,renderFrame:91}),{requestGeneration:7,slotGeneration:3,renderFrame:91});
for(const field of V.LIFETIME_FIELDS)for(const bad of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>V.lifetime({requestGeneration:7,slotGeneration:3,renderFrame:91,[field]:bad}),/Invalid vegetation/);
assert.throws(()=>V.lifetime({requestGeneration:0,slotGeneration:0,renderFrame:0}),/slotGeneration/);
assert.throws(()=>V.resourceKey({...descriptor,revisions:{...descriptor.revisions,packetRevision:2}}),/Unsupported vegetation/);
console.log(JSON.stringify({status:'PASS',compatibilityCases:F.cases.length,fixturePins:Object.keys(F.sources).length,explicitRevisions:'round-trip PASS',unsupportedRevisions:'rejected',lifetimeFields:'separate',H:'IN PROGRESS',certification:'FAIL'}));
