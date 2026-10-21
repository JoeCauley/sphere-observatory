const assert=require('node:assert/strict'),M=require('../math.js');
for(const file of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','instanced-environment','grass-stream','meadow-field','flight','surface-walk'])require('../'+file+'.js');
global.window=globalThis;require('../volume.js');require('../atmosphere.js');delete global.window;require('../places.js');
const fProfile=require('./fixtures/meadow-canopy-f2.json').profile;const Ecology=SphereMeadowEcology,Grass=SphereGrass,Inst=SphereInstancedEnvironment,fixture=require('./fixtures/meadow-art-e2.json');
const sub=(a,b)=>M.sub(a,b),mul=(a,k)=>M.mul(a,k),length=v=>M.length(v);
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),visualFixture=require('./fixtures/meadow-e-visual-exit-v2.json'),baseline=require('./fixtures/meadow-benchmark-v1.json');
const readBaseline=file=>fs.readFileSync(path.resolve(__dirname,'..',file));
assert.equal(visualFixture.fixtureRevision,2);
for(const [file,hash] of [[visualFixture.baseline.fixture,visualFixture.baseline.sha256],[visualFixture.baseline.artFixture,visualFixture.baseline.artSha256],[visualFixture.baseline.priorReviewedRun,visualFixture.baseline.priorReviewedRunSha256]])assert.equal(crypto.createHash('sha256').update(readBaseline(file)).digest('hex'),hash,`historical fixture/evidence changed: ${file}`);
for(const key of ['location','settings','mask','expectedBaselineFailures'])assert.deepEqual(visualFixture[key],baseline[key],`${key} must retain the A contract`);
for(const name of ['normal','grazing','boundary'])assert.deepEqual(visualFixture.poses[name],baseline.poses[name],`${name} cannot be reframed`);
assert.deepEqual(visualFixture.poses.close,JSON.parse(readBaseline(visualFixture.baseline.priorReviewedRun)).poseResults.close.cameraPose,'close must retain the reviewed ordinary-arrival pose');
assert.equal(visualFixture.views.close,fixture.views.close);assert.deepEqual(visualFixture.profile,fixture.profile);
assert.deepEqual(visualFixture.poses.downward,{...baseline.poses.downward,forward:baseline.poses.downward.forward.map(v=>-v)},'only downward forward may change');
assert.deepEqual(visualFixture.acceptance.terrainDepthRangeMetres,fixture.canopy.terrainDepthRangeMetres);assert.deepEqual(visualFixture.acceptance.densityRangeBladesPerM2,fixture.density.tuningRange);
assert(M.dot(visualFixture.poses.downward.forward,baseline.poses.normal.up)<-.999999,'downward must look against the independently frozen terrain-up vector');

function stateAt(appearanceRevision){
 const base=SpherePacks.activate({...M.defaultState(),collection:true,multipleWounds:false,seed:713,provinceSeed:713,time:2468,playing:false}),state={...base,terrainRevision:2,geographyRevision:1,time:2468,playing:false};
 state.meadow=Ecology.createProfile(state,{densityBladesPerM2:25,appearanceRevision,appearancePreset:appearanceRevision===1?'meadow-proof-v1':'meadow-proof-v2',worker:false});
 const anchor=SphereWatershed.direction(...Ecology.DOMAIN.anchor,state),q=Ecology.chartDirection(state,0,0);
 Object.assign(state,{position:mul(q,state.radius-.0017),terrainAnchor:anchor,siteAnchor:anchor,siteId:'biome-0',siteRevision:2,siteElevation:0,walkMode:false,walkPosition:null});return state;
}

(async()=>{
 const base=stateAt(2),arrival=await SpherePlaces.destination({...base,meadow:null},'watershed-meadow','meadow-study','day','clear');
 assert.equal(arrival.meadow.densityPreset,fixture.profile.densityPreset);assert.equal(arrival.meadow.densityBladesPerM2,fixture.profile.densityBladesPerM2);
 assert.equal(arrival.meadow.appearancePreset,fProfile.appearancePreset);assert.equal(arrival.meadow.appearanceRevision,fProfile.appearanceRevision);
 assert.equal(arrival.meadow.canopyRevision,fProfile.canopyRevision);assert.equal(arrival.meadow.materialRevision,fProfile.materialRevision);
 assert.equal(arrival.meadow.representationRevision,fixture.profile.representationRevision);assert.equal(arrival.meadow.placementRevision,fixture.profile.placementRevision);
 assert.equal(Grass.RESIDENT_RESOURCE_REVISION,fixture.profile.residentResourceRevision);assert.equal(SphereMeadowSupport.REVISION,fixture.profile.supportContractRevision);

 const oldPrototypes=Grass.meadowArtPrototypes({appearanceRevision:1}),artPrototypes=Grass.meadowArtPrototypes({appearanceRevision:2});
 const residentCamera={basis:{f:[0,0,1],r:[1,0,0],u:[0,1,0]},fov:80,aspect:16/9,relativeOrigin:[0,0,0]};
 assert(Inst.visiblePatch({center:[0,0,0],boundsRadius:.01},residentCamera),'resident cell culling uses the resident boundsRadius envelope');
 assert(!Inst.visiblePatch({center:[0,0,-.02],boundsRadius:.001},residentCamera),'resident cells behind the camera remain culled');
 assert(oldPrototypes.every(p=>p.id.startsWith('grass-blade-')),'appearance revision 1 keeps the legacy blade prototypes');
 assert(oldPrototypes.every(p=>p.lods[0].vertices.length===48&&p.lods[0].indexCount===12),'legacy prototype geometry remains the original two unsegmented ribbons');
 assert.equal(artPrototypes.length,3);assert(artPrototypes.every(p=>p.id.startsWith('meadow-tapered-ribbon-v2-')));
 const baseWidthsMm=artPrototypes.map(p=>{
  const v=p.lods[0].vertices,baseWidth=Math.abs(v[6]-v[0]),tipLeft=10*6,tipRight=11*6,tipWidth=Math.abs(v[tipRight]-v[tipLeft]);
  assert.equal(p.lods[0].indexCount,fixture.blade.verticalSegments*24,'five segments form front/back strips on two perpendicular planes');
  assert.equal(new Set(Array.from({length:v.length/6},(_,i)=>Number(v[i*6+1].toFixed(4)))).size,fixture.blade.verticalSegments+1,'blade ribbon has six vertical vertex rows');
  assert(Math.abs(tipWidth/baseWidth-fixture.blade.tipWidthFraction)<1e-6,'the ribbon narrows to a pointed tip');
  for(let i=0;i<v.length;i+=6){assert(v.subarray(i,i+6).every(Number.isFinite));assert(Math.abs(length(v.subarray(i+3,i+6))-1)<1e-5,'all curved ribbon normals are unit length');}
  return {minimum:baseWidth*.35*1000,maximum:baseWidth*1.1*1000,tipFraction:tipWidth/baseWidth,tipCenter:(v[tipLeft]+v[tipRight])*.5};
 });
 assert(baseWidthsMm[0].minimum>=fixture.blade.baseWidthMillimetres[0]&&baseWidthsMm[2].maximum<=fixture.blade.baseWidthMillimetres[1]);
 assert(baseWidthsMm[0].tipCenter>0&&baseWidthsMm[1].tipCenter<0&&baseWidthsMm[2].tipCenter>0,'width variants carry controlled rest curvature');
 assert(Inst.VERTEX.includes('localNormal.x-=')&&Inst.VERTEX.includes('localNormal.z-='),'wind deformation applies the inverse-transpose slope to blade normals');

 const oldState=stateAt(1),newState=stateAt(2),cell={x:16,z:16,size:Grass.MEADOW_CELL_SIZE_METRES},oldCell=Grass.buildMeadowCell({state:oldState,cell:{...cell},areaSteps:4}),newCell=Grass.buildMeadowCell({state:newState,cell:{...cell},areaSteps:4});
 const oldIds=oldCell.instances.map(i=>i.addressKey),newIds=newCell.instances.map(i=>i.addressKey);
 assert.deepEqual(newIds,oldIds,'the new appearance leaves stable placement revision-2 identities unchanged');
 assert.notEqual(newCell.key,oldCell.key,'appearance revisions partition prepared cell content without renaming blade addresses');
 assert(newCell.instances.every(i=>i.placementRevision===2&&i.prototypeId.startsWith('meadow-tapered-ribbon-v2-')));
 assert(oldCell.instances.every(i=>i.placementRevision===2&&i.prototypeId.startsWith('grass-blade-')));
 const heights=newCell.instances.map(i=>i.scale*1000),aboveOne=heights.filter(h=>h>1).length/heights.length;
 assert(Math.min(...heights)>=fixture.blade.heightMetres[0]&&Math.max(...heights)<=fixture.blade.heightMetres[1]+1e-9);
 assert(aboveOne<fixture.blade.maximumFractionAboveOneMetre,'blades approaching 1.1 m remain a restrained minority');
 assert.notDeepEqual(newCell.instances.map(i=>i.scale),oldCell.instances.map(i=>i.scale),'appearance revision 2 has independently versioned plant proportions');
 const resident=Grass.prepareResidentCell(newCell,{releaseSource:true,releasePlacementObjects:true});
 assert.equal(resident.residentResourceRevision,fixture.profile.residentResourceRevision);assert(resident.residentGroups.every(g=>g.prototypeId.startsWith('meadow-tapered-ribbon-v2-')));
 assert.equal(resident.placementRevision,2);assert.equal(SphereMeadowSupport.REVISION,1);

 console.log(JSON.stringify({status:'PASS',visualExitFixture:{id:visualFixture.id,revision:visualFixture.fixtureRevision,historicalAUnchanged:true,onlyDownwardOrientationChanged:true},appearance:{preset:arrival.meadow.appearancePreset,revision:arrival.meadow.appearanceRevision,representationRevision:arrival.meadow.representationRevision,placementRevision:arrival.meadow.placementRevision,residentResourceRevision:resident.residentResourceRevision},geometry:{verticalSegments:fixture.blade.verticalSegments,vertexRows:fixture.blade.verticalSegments+1,trianglesPerBlade:artPrototypes[0].lods[0].indexCount/3,baseWidthMm:baseWidthsMm,heightMetres:[Math.min(...heights),Math.max(...heights)],fractionAboveOneMetre:aboveOne},stablePlacement:{blades:oldIds.length,stableIds:true,changedArtScales:true,appearance1Legacy:true}}));
})().catch(error=>{console.error(error);process.exitCode=1;});
