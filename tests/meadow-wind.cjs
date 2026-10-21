'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),M=require('../math.js'),W=require('../meadow-wind.js');
for(const f of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','meadow-canopy','instanced-environment','grass-stream','meadow-field','session-state'])require('../'+f+'.js');
const Ec=SphereMeadowEcology,F=SphereMeadowCanopy,G=SphereGrass;
const s=SpherePacks.activate({...M.defaultState(),seed:713,time:2468,playing:false});
s.meadow=Ec.createProfile(s,{appearanceRevision:4,appearancePreset:'meadow-proof-f2',windTimelineRevision:1,worker:false,densityBladesPerM2:25});
assert.equal(s.meadow.windStrength,W.DEFAULT_STRENGTH);assert.equal(s.meadow.windSceneSecondsPerSecond,60);
W.playback(s,true);s.time+=120;assert.equal(W.phase(s),2470);
// Simulation has advanced beyond the last displayed preview: freeze that view.
W.playback(s,false,2469.75);assert.equal(W.phase(s),2469.75);assert.equal(SphereMeadow.windClock(s,{capture:true}),2469.75);
for(let i=0;i<4;i++){W.playback(s,false);assert.equal(W.phase(s),2469.75);}
W.playback(s,true);s.time+=60;assert.equal(W.phase(s),2470.75);
W.rate(s,600);assert.equal(W.phase(s),2470.75);s.time+=600;assert.equal(W.phase(s),2471.75);
W.rate(s,.1);s.time+=.1;assert(Math.abs(W.phase(s)-2472.75)<1e-9);
const recorded=M.sceneRecord(s).state,reloaded=M.validate(recorded),session=SphereSessionCodec.decode(SphereSessionCodec.encode(s)).state;
for(const copy of [recorded,reloaded,session]){assert.equal(W.phase(copy),W.phase(s));assert.equal(copy.meadow.windAnchorSceneTime,s.meadow.windAnchorSceneTime);assert.equal(copy.meadow.windPhaseSeconds,s.meadow.windPhaseSeconds);assert.equal(copy.meadow.windSceneSecondsPerSecond,.1);}
const value=W.phase(reloaded);reloaded.time+=1;W.scrub(reloaded);assert(Math.abs(W.phase(reloaded)-(value+10))<1e-9);W.playback(reloaded,true);assert(Math.abs(W.phase(reloaded)-(value+10))<1e-9);
for(const key of ['windPhaseSeconds','windAnchorSceneTime','windSceneSecondsPerSecond','windResolvedPhaseSeconds','windVisualSpeed','windStrength'])for(const invalid of [NaN,Infinity,'1'])assert.throws(()=>M.validate({...s,meadow:{...s.meadow,[key]:invalid}}),/Invalid meadow wind/);
for(const key of ['windSceneSecondsPerSecond','windVisualSpeed'])for(const invalid of [0,-1])assert.throws(()=>M.validate({...s,meadow:{...s.meadow,[key]:invalid}}),/Invalid meadow wind/);
for(const rate of [0,-1,NaN,Infinity])assert.throws(()=>M.validate({...s,timeRate:rate}),/Invalid value for timeRate/);
assert.throws(()=>M.validate({...s,meadow:{...s.meadow,windTimelineRevision:2}}),/Unsupported meadow wind timeline/);
assert.throws(()=>M.validate({...s,meadow:{...s.meadow,windStrength:.39}}),/Invalid meadow wind/);
const old={...s,meadow:{...s.meadow}};delete old.meadow.windTimelineRevision;assert.equal(SphereMeadow.windClock({...old,playing:false}),old.meadow.windPhaseSeconds);assert.equal(SphereMeadow.windClock({...old,playing:true,time:old.time+60}),old.meadow.windPhaseSeconds+(old.time+60-old.meadow.windAnchorSceneTime)/old.meadow.windSceneSecondsPerSecond);
const legacy={time:23,playing:false,meadow:{windClock:99,pausedClock:17}};assert.equal(SphereMeadow.windClock(legacy),17);assert.equal(SphereMeadow.windClock({...legacy,playing:true}),23);assert.deepEqual(W.snapshot(legacy),legacy);
assert.equal(F.WIND_GLSL,W.GLSL);
const a=W.field([8,4],10),near=W.field([8.001,4],10),later=W.field([8,4],11);assert(Math.hypot(...a.vector.map((v,i)=>v-near.vector[i]))<.001);assert.notDeepEqual(a.vector,later.vector);
// Root and packed resource identity remain invariant with phase/rate/rebase.
const q=Ec.chartDirection(s,4,4);s.position=M.mul(q,s.radius-.0017);
const frame=G.frameForMeadowChart(s),cell={x:16,z:16,size:8,chartBounds:[0,0,8,8],key:G.meadowCellKey({x:16,z:16},s),canopyTier:'detail'};
const build=state=>G.prepareResidentCell(F.buildResidentCell({state,cell,frame,areaSteps:4}),{releaseSource:true,releasePlacementObjects:true});
const first=build(s),changed=build({...s,time:s.time+1000,terrainAnchor:M.norm([1,1,1]),meadow:{...s.meadow,windPhaseSeconds:12,windResolvedPhaseSeconds:90}});
assert.deepEqual(first.residentBuffer,changed.residentBuffer);assert.deepEqual(first.residentGroups,changed.residentGroups);
const hash=crypto.createHash('sha256').update(first.residentBuffer).digest('hex');
const result={status:'PASS',timelineRevision:1,defaultStrength:W.DEFAULT_STRENGTH,maximumStrength:W.MAX_STRENGTH,units:{phase:'seconds',coordinates:'geographic metres',strength:'fraction of stem height'},pauseRepeatedResume:true,rateChanges:[60,600,.1],scrub:true,sceneSessionRoundTrip:true,invalidValuesRejected:true,legacyClocksPreserved:true,sharedSpatialField:true,stablePackedRoots:{sha256:hash,bytes:first.residentBuffer.byteLength}};
if(process.env.IB075_G_OUTPUT){fs.mkdirSync(process.env.IB075_G_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.IB075_G_OUTPUT,'g-contracts.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
