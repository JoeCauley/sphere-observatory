'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const f1=read('tests/fixtures/meadow-canopy-f1.json'),f2=read('tests/fixtures/meadow-canopy-f2.json'),m1=read('tests/fixtures/meadow-f-motion-v1.json'),m2=read('tests/fixtures/meadow-f-motion-v2.json');
for(const key of ['location','settings','poses','mask','acceptance','conditions','supplemental','acceptancePoseSource','baseline'])assert.deepEqual(f2[key],f1[key],key+' successor acceptance contract changed');
for(const key of ['cameraProtocol','conditions','framesPerSecond','sequence'])assert.deepEqual(m2[key],m1[key],key+' successor motion contract changed');
assert.equal(f2.successorOf.sha256,hash(f2.successorOf.fixture));assert.equal(m2.successorOf.sha256,hash(m2.successorOf.fixture));
assert.deepEqual(f2.profile,{...f1.profile,appearancePreset:'meadow-proof-f2',appearanceRevision:4,canopyRevision:2,materialRevision:3});assert.equal(f2.fixtureRevision,2);assert.equal(m2.fixtureRevision,2);assert.equal(m2.source,'tests/fixtures/meadow-canopy-f2.json');
console.log(JSON.stringify({status:'PASS',historicalF1ByteHashesPreserved:true,successorAcceptanceInputsUnchanged:true,successorMotionInputsUnchanged:true,F1:f1.profile,F2:f2.profile}));
