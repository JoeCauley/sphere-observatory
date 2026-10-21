const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','flight','surface-walk','places'])require('../'+f+'.js');
global.window=globalThis;require('../volume.js');require('../atmosphere.js');delete global.window;
const E=SphereMeadowEcology,P=SpherePlaces,K=SpherePacks;
const base=K.activate({...M.defaultState(),collection:true,routeShades:false,starStation:false,multipleWounds:false,playing:false,time:120,autoSpeed:false,speed:.017});
assert.equal(E.createProfile(base).densityBladesPerM2,250,'the shared profile default remains at the established target');
const choices=P.arrivals(base,'watershed-meadow');assert(choices.some(choice=>choice.id==='meadow-study'&&choice.label==='Meadow study · on foot'),'study is an ordinary named arrival');
(async()=>{
 const study=await P.destination(base,'watershed-meadow','meadow-study','day','clear');
 assert.equal(study.meadow.schema,1);assert.equal(study.meadow.representationRevision,3);assert.equal(study.meadow.profileId,E.PROFILE_ID);assert.equal(study.meadow.coverageId,E.COVERAGE_ID);assert.deepEqual(study.meadow.anchor,E.DOMAIN.anchor);assert.equal(study.meadow.densityBladesPerM2,290);assert.equal(study.meadow.densityPreset,'near-290-blades-m2');assert.equal(study.meadow.qualityPreset,'proof');
 const roundTrip=M.validate(M.sceneRecord(study).state);for(const key of ['schema','representationRevision','placementRevision','profileId','coverageId','seed','anchor','ecologicalRevision','densityBladesPerM2','densityPreset','qualityPreset','appearancePreset','windPhaseSeconds','windAnchorSceneTime','windSceneSecondsPerSecond'])assert.deepEqual(roundTrip.meadow[key],study.meadow[key],`versioned profile field ${key} survives scene validation`);
 const q=SphereWatershed.direction(...E.DOMAIN.anchor,study),field=SphereGeography.query(q,{state:study,representation:'walking'});assert.equal(field.ecology.coverage,1);assert.equal(field.ecology.effectiveVegetationRole,'meadow');assert.equal(field.ecology.grassDensityBladesPerM2,290);assert(field.ecology.treeSuppressed);assert(Number.isFinite(field.ecology.wetness));assert.equal(field.groundPalette.id,E.GROUND_PALETTE.id);
 const outside=SphereWatershed.direction(E.DOMAIN.anchor[0]+E.DOMAIN.half+1,E.DOMAIN.anchor[1],study);assert.equal(E.coverageAt(outside,study).coverage,0);assert.equal(SphereGeography.query(outside,{state:study}).ecology.grassDensityBladesPerM2,0);
 const water=E.query(q,study,{base:{...field,exclusionMasks:{...field.exclusionMasks,water:true}}});assert.equal(water.ecology.grassDensityBladesPerM2,0);assert.equal(water.ecology.treeSuppressed,false);
 const legacy={...base,meadow:{enabled:true,rootsPerSubcell:4,windClock:7,pausedClock:7}};const legacyClean=M.validate(legacy);assert.equal(legacyClean.meadow.representationRevision,undefined);assert.equal((await P.destination(legacyClean,'watershed-meadow','ground')).meadow.enabled,true,'legacy meadow remains available to legacy arrivals');
 assert.deepEqual([study.meadow.residentResourceRevision,study.meadow.packetRevision,study.meadow.selectionRevision],[2,2,2]);
 assert.throws(()=>M.validate({...study,meadow:{...study.meadow,representationRevision:2}}),/Unsupported meadow representation|fixed-chart/);
 console.log(JSON.stringify({status:'PASS',arrival:'meadow-study',representationRevision:study.meadow.representationRevision,densityPreset:study.meadow.densityPreset,coverage:field.ecology.coverage,density:field.ecology.grassDensityBladesPerM2,legacy:'preserved'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
