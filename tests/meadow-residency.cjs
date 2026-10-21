const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../math.js');
for(const file of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','instanced-environment','grass-stream','meadow-field'])require('../'+file+'.js');
const Ecology=SphereMeadowEcology,Grass=SphereGrass,Inst=SphereInstancedEnvironment,Meadow=SphereMeadow;
const add=(a,b)=>M.add(a,b),sub=(a,b)=>M.sub(a,b),mul=(a,k)=>M.mul(a,k),length=v=>M.length(v);

function stateAt(x=4,z=4,density=25){
 const base=SpherePacks.activate({...M.defaultState(),collection:true,multipleWounds:false,seed:713,provinceSeed:713});
 const state={...base,terrainRevision:2,geographyRevision:1,time:2468,playing:false};
 state.meadow=Ecology.createProfile(state,{densityBladesPerM2:density,worker:false});
 const anchor=SphereWatershed.direction(...Ecology.DOMAIN.anchor,state),q=Ecology.chartDirection(state,x,z);
 state.position=mul(q,state.radius-.0017);state.terrainAnchor=anchor;state.siteAnchor=anchor;state.siteId='biome-0';state.siteRevision=2;state.siteElevation=0;state.walkMode=false;state.walkPosition=null;
 return state;
}
function reportCell(manager,state,radiusMetres=.1){return manager.request(state,{radiusMetres});}
function preparedVariant(source,change){
 const instances=source.instances.map(instance=>({...instance,origin:instance.origin.slice(),quaternion:instance.quaternion.slice(),colour:instance.colour.slice()}));
 change(instances[0]);
 return Grass.prepareResidentCell({...source,instances,instanceBuffer:Inst.packInstances(instances),residentBuffer:null,residentGroups:null,residentResourceRevision:0,residentContentHash:null});
}

const manager=new Grass.FixedChartGrassManager({boundedPreparation:true,worker:false,maxPrepareCellsPerFrame:1,areaSteps:4});
let state=stateAt(),first=reportCell(manager,state),firstPopulation=first.population;
assert.equal(first.coordinateSpace,'resident-chart');assert.equal(first.cells.length,1);assert.equal(firstPopulation.residentCells.length,0);assert.equal(firstPopulation.pendingResidentCells.length,1);
assert.equal(manager.info.lastPreparedCellsPerRequest,1,'synchronous preparation is limited to one cell per request');
assert.equal(manager.commitResident(firstPopulation.residentTargetSignature),true,'the prepared initial cell can be atomically presented');
first=reportCell(manager,state);const resident=first.population.residentCells[0],originalBuffer=resident.residentBuffer,firstHash=resident.residentContentHash,hashRecomputes=manager.info.residentHashRecomputes,prepared=manager.info.preparedCells;
for(let frame=0;frame<12;frame++){state={...state,time:state.time+1,playing:true};const repeated=reportCell(manager,state);assert.equal(repeated.population,firstPopulation,'settled requests reuse the population object');assert.equal(repeated.population.residentCells[0].residentBuffer,originalBuffer,'settled requests reuse the packed cell buffer');}
assert.equal(manager.info.preparedCells,prepared,'stationary frames do not prepare more cells');assert.equal(manager.info.residentHashRecomputes,hashRecomputes,'stationary frames do not hash resident records');assert.equal(manager.info.residentPopulationAllocations,1);

const invalidationInstance=Inst.createInstance({prototypeId:'grass-blade-0',origin:resident.center.slice(),scale:.0008,colour:[.3,.55,.2,1],phase:.2,seed:31,boundsRadius:.002});
const invalidationSource={...resident,instances:[invalidationInstance],roots:[],instanceBuffer:Inst.packInstances([invalidationInstance]),residentBuffer:null,residentGroups:null,residentResourceRevision:0,residentContentHash:null};
const colorVariant=preparedVariant(invalidationSource,instance=>{instance.colour[0]=instance.colour[0]>.5?.2:.9;}),orientationVariant=preparedVariant(invalidationSource,instance=>{instance.quaternion=[0,0,Math.sin(.41),Math.cos(.41)];});
assert.notEqual(colorVariant.residentContentHash,firstHash,'packed color changes invalidate the cell content key');assert.notEqual(orientationVariant.residentContentHash,firstHash,'packed orientation changes invalidate the cell content key');
const prototypes=Grass.grassPrototypes();let minimumBoundMargin=Infinity,minimumCellCullingMargin=Infinity,maximumPrototypeEnvelopeKm=0,maximumWindBendKm=0,maximumChildOffsetKm=0,maximumPrototypeRadiusFactor=0;
for(const prototype of prototypes)for(let i=0;i<prototype.lods[0].vertices.length;i+=6)maximumPrototypeRadiusFactor=Math.max(maximumPrototypeRadiusFactor,length(prototype.lods[0].vertices.slice(i,i+3)));
assert(Grass.MAX_GRASS_PROTOTYPE_RADIUS_FACTOR+1e-12>=maximumPrototypeRadiusFactor,'resident bound contains the full prototype from its root origin');
assert(Grass.MAX_WIND_BEND_FRACTION+1e-12>=Inst.MAX_RESIDENT_WIND_STRENGTH*Math.hypot(1.45,.65),'resident bend bound contains the clamped shader displacement');
for(const patch of manager.cache.values()){const stats=patch.residentStats;maximumPrototypeEnvelopeKm=Math.max(maximumPrototypeEnvelopeKm,stats.maximumPrototypeEnvelopeKm);assert(stats.maximumPrototypeEnvelopeKm+1e-12>=stats.maximumInstanceScale*maximumPrototypeRadiusFactor,'measured prototype vertex extent is contained by the instance bound');assert.equal(patch.instances,null,'resident cell releases per-blade instance objects');assert.equal(patch.roots,null,'resident cell releases placement root objects');assert.equal(patch.instanceBuffer,null,'resident cell releases its source aggregate');minimumBoundMargin=Math.min(minimumBoundMargin,stats.minimumInstanceBoundMarginKm);minimumCellCullingMargin=Math.min(minimumCellCullingMargin,stats.minimumCellCullingMarginKm);maximumWindBendKm=Math.max(maximumWindBendKm,stats.maximumWindBendKm);maximumChildOffsetKm=Math.max(maximumChildOffsetKm,stats.maximumChildOffsetKm);assert(stats.minimumInstanceBoundMarginKm>=-1e-12,'instance sphere contains prototype, maximum bend and child support margin');assert(stats.minimumCellCullingMarginKm>=0,'cell culling sphere contains every supported child');}

const movedState=stateAt(12.1,4),moved=reportCell(manager,movedState),movedPopulation=moved.population;
assert.equal(moved.cells.length,1);assert.equal(movedPopulation.residentCells[0].key,resident.key,'old presentation stays active while a replacement is prepared');assert.equal(movedPopulation.pendingResidentCells.length,1);assert.notEqual(movedPopulation.pendingResidentCells[0].key,resident.key);
assert.equal(manager.info.lastPreparedCellsPerRequest,1);assert.equal(manager.commitResident(movedPopulation.residentTargetSignature),true);const movedReady=reportCell(manager,movedState);
assert.equal(movedReady.population.residentCells[0].key,moved.cells[0].key,'movement commits only the new cell');
const movedBuffer=movedReady.population.residentCells[0].residentBuffer,turnState={...movedState,forward:mul(movedState.up,-1),up:movedState.forward},rebaseState={...movedState,terrainAnchor:Ecology.chartDirection(movedState,16,8)};
const turned=reportCell(manager,turnState),rebased=reportCell(manager,rebaseState);
assert.equal(turned.population.residentCells[0].residentBuffer,movedBuffer,'turning changes only the view');assert.equal(rebased.population.residentCells[0].residentBuffer,movedBuffer,'rebase keeps fixed chart buffers immutable');
assert.equal(rebased.population.frameBasis,firstPopulation.frameBasis,'rebase does not replace the resident coordinate basis');

class DeferredWorker{constructor(){this.messages=[];this.terminated=false;DeferredWorker.last=this;}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}}
const oldWorker=global.Worker;global.Worker=DeferredWorker;
const asyncManager=new Grass.FixedChartGrassManager({boundedPreparation:true,worker:true,areaSteps:4}),oldState=stateAt(4,4),newState=stateAt(12.1,4);
asyncManager.request(oldState,{radiusMetres:.1});const oldMessage=DeferredWorker.last.messages[0];assert(oldMessage?.resident);asyncManager.request(oldState,{radiusMetres:.1});assert.equal(DeferredWorker.last.messages.length,1,'repeated requests do not duplicate worker jobs');
asyncManager.request(newState,{radiusMetres:.1});const supportWhilePreparing=SphereMeadowSupport.query(newState,12.1,4);assert(supportWhilePreparing,'terrain support stays available during replacement preparation');const stalePatch=Grass.prepareResidentCell(Grass.buildMeadowCell({...oldMessage,areaSteps:4}),{releaseSource:true,releasePlacementObjects:true});asyncManager.receive({generation:oldMessage.generation,patch:stalePatch});
assert.equal(asyncManager.info.staleCompletions,1);assert.equal(asyncManager.cache.has(oldMessage.cell.key),false,'stale work cannot populate the current chart request');
asyncManager.request(newState,{radiusMetres:.1});const currentMessage=DeferredWorker.last.messages[1];assert(currentMessage?.resident);const currentPatch=Grass.prepareResidentCell(Grass.buildMeadowCell({...currentMessage,areaSteps:4}),{releaseSource:true,releasePlacementObjects:true});asyncManager.receive({generation:currentMessage.generation,patch:currentPatch});
assert(asyncManager.cache.has(currentMessage.cell.key),'current worker completion becomes resident');assert.equal(asyncManager.info.queue,0);
const supportSentinel={pinned:true};global.SphereGround=supportSentinel;asyncManager.dispose();assert.equal(global.SphereGround,supportSentinel,'vegetation disposal leaves terrain support owned by the ground system');assert.equal(DeferredWorker.last.terminated,true);global.Worker=oldWorker;

const disposable=new Grass.FixedChartGrassManager({boundedPreparation:true,worker:false,areaSteps:4});reportCell(disposable,stateAt());assert(disposable.cache.size>0);disposable.dispose();assert.equal(disposable.cache.size,0);assert.equal(disposable.activePatches.length,0);assert.equal(disposable.pendingPatches.length,0);
const retainedCellBytesBeforeDispose=manager.info.retainedTypedArrayBytes;manager.dispose();assert.equal(manager.info.retainedTypedArrayBytes,0);
const result={status:'PASS',fixture:'IB-075-D resident Meadow lifecycle CPU fixture',host:{platform:process.platform,architecture:process.arch,node:process.version},revisions:{placement:2,support:1,residentResource:Grass.RESIDENT_RESOURCE_REVISION},stationary:{frames:12,preparedCellsDuringFrames:0,hashRecomputesDuringFrames:0,populationAllocations:1,packedBufferIdentityStable:true},movement:{cellsPreparedPerRequest:1,oldPresentationHeldUntilCommit:true,turnUploadsExpected:0,rebaseUploadsExpected:0},cancellation:{repeatedRequestDeduplicated:true,staleCompletions:asyncManager.info.staleCompletions||1,cancelledTargetRequests:asyncManager.info.cancelled,supportWhilePreparing:!!supportWhilePreparing,currentGenerationOnly:true},cacheInvalidation:{colourChanged:true,orientationChanged:true},bounds:{minimumInstanceMarginKm:minimumBoundMargin,minimumCellCullingMarginKm:minimumCellCullingMargin,maximumPrototypeRadiusFactor,maxResidentWindStrength:Inst.MAX_RESIDENT_WIND_STRENGTH,maximumWindBendFraction:Grass.MAX_WIND_BEND_FRACTION,maximumPrototypeEnvelopeKm,maximumWindBendKm,maximumChildOffsetKm,maximumChildOffsetBudgetKm:Grass.MEADOW_CHILD_SPREAD_METRES*.001,cullingSphereContainsEveryInstance:true},retained:{initialCellBytes:originalBuffer.byteLength,retainedCellBytesBeforeDispose,perBladeObjectsRetained:0,sourceAggregateReleased:true,managerDisposed:true,terrainSupportPreserved:true}};
console.log(JSON.stringify(result));
const output=path.resolve(process.env.IB075_TEST_OUTPUT||path.join(__dirname,'../work','ib075-d-'+new Date().toISOString().replace(/[:.]/g,'-')));fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'d-residency-cpu.json'),JSON.stringify(result,null,2)+'\n');
