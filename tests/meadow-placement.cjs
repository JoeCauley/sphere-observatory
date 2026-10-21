const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../math.js');
for(const file of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','instanced-environment','grass-stream'])require('../'+file+'.js');
const E=SphereMeadowEcology,S=SphereMeadowSupport,Grass=SphereGrass,Inst=SphereInstancedEnvironment,fixture=require('./fixtures/meadow-placement-c1.json');
const add=(a,b)=>M.add(a,b),sub=(a,b)=>M.sub(a,b),mul=(a,k)=>M.mul(a,k),length=v=>M.length(v);

function stateAt(x=0,z=0,density=250){
 const base=SpherePacks.activate({...M.defaultState(),collection:true,multipleWounds:false,seed:713,provinceSeed:713});
 const state={...base,terrainRevision:2,geographyRevision:1,time:2468,playing:false};
 state.meadow=E.createProfile(state,{densityBladesPerM2:density,worker:false});
 const anchor=SphereWatershed.direction(...E.DOMAIN.anchor,state),q=E.chartDirection(state,x,z);
 state.position=mul(q,state.radius-.0017);state.terrainAnchor=anchor;state.siteAnchor=anchor;state.siteId='biome-0';state.siteRevision=2;state.siteElevation=0;state.walkMode=false;state.walkPosition=null;
 return state;
}
function maxPackedError(patches,frame){
 let max=0;
 for(const patch of patches){const view=new DataView(patch.instanceBuffer.buffer,patch.instanceBuffer.byteOffset,patch.instanceBuffer.byteLength);
  patch.instances.forEach((instance,index)=>{const base=index*Inst.STRIDE,local=[0,1,2].map(i=>view.getFloat32(base+i*4,true)),world=add(frame.origin,frame.basis.reduce((sum,axis,i)=>add(sum,mul(axis,local[i])),[0,0,0]));max=Math.max(max,length(sub(world,instance.worldOrigin))*1000);});
 }
 return max;
}
function makeTriangleFixture(state,cell,{baseHeightKm,slopeX=0,slopeZ=0}){
 const x0=-E.DOMAIN.half+cell.x*cell.size,z0=-E.DOMAIN.half+cell.z*cell.size,x1=x0+cell.size,z1=z0+cell.size,chart=E.chartFrame(state),basis=SphereSites.shellFrame(chart.direction),mesh=new SphereSites.Mesh(mul(chart.direction,state.radius),basis,'IB-075-C terrain fixture');
 const height=(x,z)=>baseHeightKm+slopeX*(x-x0)*.001+slopeZ*(z-z0)*.001,p=(x,z)=>[x*.001,height(x,z),z*.001],a=p(x0,z0),b=p(x1,z0),c=p(x1,z1),d=p(x0,z1);
 mesh.tri(a,c,b,[1,1,1]);mesh.tri(a,d,c,[1,1,1]);mesh.finish();const top=Math.max(a[1],b[1],c[1],d[1])+.25;
 return (requestState,x,z)=>{
  const hit={},distance=SphereSites.rayBVH([x*.001,top,z*.001],[0,-1,0],mesh.bvh,Infinity,hit);if(!hit.normal)return null;
  const point=mesh.world([x*.001,top-distance,z*.001]),normal=M.norm(mesh.basis.reduce((sum,axis,i)=>add(sum,mul(axis,hit.normal[i])),[0,0,0]));
  if(M.dot(normal,mul(M.norm(point),-1))<0)for(let i=0;i<3;i++)normal[i]*=-1;
  return {point,normal,direction:M.norm(point),heightKm:requestState.radius-length(point),triangleId:`fixture:${baseHeightKm}:${slopeX}:${slopeZ}`,source:'fixture-owned-triangle'};
 };
}
function signature(patch){return JSON.stringify({key:patch.key,candidateCount:patch.candidateCount,roots:patch.roots.map(r=>[r.key,r.chart,r.bladeIds]),instances:patch.instances.map(i=>[i.addressKey,i.worldOrigin,i.quaternion,i.scale,i.phase,i.seed])});}

async function main(){
 const state=stateAt(),chart=E.chartCoordinates(state,M.norm(state.position));
 assert(Math.abs(chart[0])<.01&&Math.abs(chart[1])<.01,'fixed chart follows the named bank, not the temporary terrain anchor');
 assert.equal(fixture.placementRevision,2);assert.equal(state.meadow.placementRevision,fixture.placementRevision);
 const priorProfile={...state.meadow};delete priorProfile.placementRevision;assert.equal(M.validate({...state,meadow:priorProfile}).meadow.placementRevision,1,'older version-3 saved scenes retain their original distribution');
 assert.throws(()=>M.validate({...state,meadow:{...state.meadow,anchor:[21501,-5000]}}),/fixed to the named Open meadow anchor/,'placement revision 2 keeps its named chart anchor fixed');
 assert.deepEqual(Grass.meadowCellForChart(-128,-128),{x:0,z:0,size:8});
 assert.deepEqual(Grass.meadowCellForChart(-120,0),{x:1,z:16,size:8},'a shared lower boundary belongs to the cell on its positive side');
 assert.deepEqual(Grass.meadowCellForChart(-120-1e-8,0),{x:0,z:16,size:8},'the previous cell excludes its upper boundary');
 assert.equal(Grass.meadowCellForChart(128,0),null,'the fixed chart upper edge is excluded');

 const shell= S.query(state,0,0);assert.equal(shell.source,'analytic-inner-shell-collision');assert(Math.abs(state.radius-length(shell.point))<.002,'actual Open meadow support uses radius minus its zero terrain height');assert(M.dot(shell.normal,mul(shell.direction,-1))>.999999);
 const traceStart=add(shell.point,mul(shell.normal,.002)),trace=M.trace(traceStart,mul(shell.normal,-1),state);
 assert.equal(trace.kind,'Inner surface');assert(length(sub(trace.point,shell.point))<.000002,'shared support matches the analytic collision surface within 2 mm');
 const camera=S.camera(state,state.position);assert(Math.abs(camera.cameraHeightKm-.0017)<.000002,'camera height uses the same support query');

 // Exact low/high flats and a slope are queried through an owning triangle.
 const fixtureCell={x:16,z:16,size:8,key:Grass.meadowCellKey({x:16,z:16},state)},small={...state,meadow:{...state.meadow,densityBladesPerM2:25}};
 const terrainCases=[{name:'flat-low',baseHeightKm:.004,slopeX:0,slopeZ:0},{name:'flat-high',baseHeightKm:1.8,slopeX:0,slopeZ:0},{name:'slope',baseHeightKm:.004,slopeX:.6,slopeZ:-.35}];
 const terrainResults=[];
 for(const terrain of terrainCases){
  const surfaceSupport=makeTriangleFixture(small,fixtureCell,terrain),patch=Grass.buildMeadowCell({state:small,cell:fixtureCell,frame:Grass.frameForState(small),areaSteps:4,surfaceSupport});
  let maximumRootErrorMetres=0,maximumChildErrorMetres=0,minimumHeight=Infinity,maximumHeight=-Infinity;
  for(const root of patch.roots){const support=surfaceSupport(small,...root.chart);maximumRootErrorMetres=Math.max(maximumRootErrorMetres,length(sub(root.worldOrigin,support.point))*1000);}
  for(const instance of patch.instances){const support=surfaceSupport(small,...instance.chart);maximumChildErrorMetres=Math.max(maximumChildErrorMetres,length(sub(instance.worldOrigin,support.point))*1000);const local=Grass.frameForState(small).basis.map(axis=>M.dot(sub(instance.worldOrigin,Grass.frameForState(small).origin),axis));minimumHeight=Math.min(minimumHeight,local[1]);maximumHeight=Math.max(maximumHeight,local[1]);}
  assert(maximumRootErrorMetres<=fixture.support.maximumRootToSupportErrorMetres,terrain.name+' roots follow their actual triangle support');
  assert(maximumChildErrorMetres<=fixture.support.maximumRootToSupportErrorMetres,terrain.name+' child blades follow their own actual triangle support');
  assert(patch.instances.every(i=>length(sub(i.origin,patch.center))+i.boundsRadius<=patch.boundsRadius+1e-12),'patch bounds include each child offset, full blade height and maximum bend');
  if(terrain.name==='flat-high')assert(Math.abs((state.radius-length(patch.centerWorld))-terrain.baseHeightKm)<.002,'high terrain keeps the radius-minus-height inner radial sign');
  if(terrain.name==='slope')assert(maximumHeight-minimumHeight>.003,'slope child supports vary independently across the patch');
  terrainResults.push({name:terrain.name,surfaceTriangles:2,rootCount:patch.rootCount,bladeCount:patch.bladeCount,maximumRootToSupportErrorMetres:maximumRootErrorMetres,maximumChildToSupportErrorMetres:maximumChildErrorMetres,minimumLocalHeightKm:minimumHeight,maximumLocalHeightKm:maximumHeight,boundsRadiusKm:patch.boundsRadius});
 }

 // Candidate identities survive filtering because candidate positions and
 // ordinals are owned by the fixed cell before ecological rejection.
 const filterCell=Grass.meadowCellForChart(4,4);filterCell.key=Grass.meadowCellKey(filterCell,small);
 const unfiltered=Grass.buildMeadowCell({state:small,cell:filterCell,frame:Grass.frameForState(small),areaSteps:4});
 const filtered=Grass.buildMeadowCell({state:small,cell:filterCell,frame:Grass.frameForState(small),areaSteps:4,semanticQuery:(q,s)=>{const field=Grass.meadowSemantic(q,s),chart=E.chartCoordinates(s,q);return chart[0]>4?{...field,ecology:{...field.ecology,eligibleArea:false,grassDensityBladesPerM2:0}}:field;}});
 const unfilteredIds=new Set(unfiltered.roots.map(r=>r.key)),filteredIds=new Set(filtered.roots.map(r=>r.key));
 assert([...filteredIds].every(id=>unfilteredIds.has(id)),'filtering cannot renumber surviving roots');assert([...filtered.instances].every(i=>unfiltered.instances.some(old=>old.addressKey===i.addressKey)),'filtering cannot renumber surviving blades');assert.equal(filtered.candidateCount,unfiltered.candidateCount);

 const orderCells=[{x:15,z:16,size:8},{x:16,z:16,size:8},{x:17,z:16,size:8}].map(c=>({...c,key:Grass.meadowCellKey(c,small)}));
 const ordered=new Map(orderCells.map(c=>[c.key,signature(Grass.buildMeadowCell({state:small,cell:c,frame:Grass.frameForState(small),areaSteps:4}))]));
 const reverse=new Map(orderCells.slice().reverse().map(c=>[c.key,signature(Grass.buildMeadowCell({state:small,cell:c,frame:Grass.frameForState(small),areaSteps:4}))]));
 assert.deepEqual([...ordered],[...reverse].reverse(),'request order leaves cell content unchanged');

 const manager=new Grass.FixedChartGrassManager({worker:false,areaSteps:8}),nearState=stateAt(2,2,25),nearA=manager.request(nearState,{radiusMetres:.1}),nearHash=manager.hash(),localBefore=nearA.patches[0].instances[0].origin.slice(),idsBefore=nearA.patches.flatMap(p=>p.instances.map(i=>i.addressKey)),worldBefore=nearA.patches.flatMap(p=>p.instances.map(i=>i.worldOrigin.slice()));
 const moved=stateAt(48,48,25);manager.request(moved,{radiusMetres:.1});assert(manager.info.disposed>0,'moving away unloads unneeded fixed cells');
 const outside=stateAt(300,300,25);assert.equal(manager.request(outside,{radiusMetres:.1}).patches.length,0,'the fixed 256 m chart does not claim an unlimited atlas');
 const revisit=manager.request(nearState,{radiusMetres:.1});assert.equal(manager.hash(),nearHash,'cold revisit regenerates identical geographic ownership');
 const rebased={...nearState,terrainAnchor:E.chartDirection(nearState,3,2)},afterRebase=manager.request(rebased,{radiusMetres:.1});
 assert.deepEqual(afterRebase.patches.flatMap(p=>p.instances.map(i=>i.addressKey)),idsBefore,'rebase preserves blade IDs');
 assert.deepEqual(afterRebase.patches.flatMap(p=>p.instances.map(i=>i.worldOrigin)),worldBefore,'rebase preserves world support points');
 assert.notDeepEqual(afterRebase.patches[0].instances[0].origin,localBefore,'rebase only changes render-local coordinates');

 // Full target-density run over the fixed 0–15 m eligible foreground.
 const densityManager=new Grass.FixedChartGrassManager({worker:false,areaSteps:16}),population=densityManager.request(state),cameraPoint=population.cameraPoint;
 assert(population.patches.length>0);const rootIds=[],bladeIds=[],cellsSeen=new Set(),perCell=[],band={count0to5:0,count5to15:0,eligibleArea0to5M2:0,eligibleArea5to15M2:0,surfaceAreaM2:0,eligibleAreaM2:0};
 for(const patch of population.patches){
  cellsSeen.add(patch.cell.x+','+patch.cell.z);rootIds.push(...patch.roots.map(r=>r.key));bladeIds.push(...patch.instances.map(i=>i.addressKey));
  assert(patch.roots.every(r=>r.cell[0]===patch.cell.x&&r.cell[1]===patch.cell.z),'each root has one half-open cell owner');
  const area=S.measureCell(state,patch.cell,{steps:16,cameraPoint});band.surfaceAreaM2+=area.surfaceAreaM2;band.eligibleAreaM2+=area.eligibleAreaM2;band.eligibleArea0to5M2+=area.eligibleArea0to5M2;band.eligibleArea5to15M2+=area.eligibleArea5to15M2;
  let count0to5=0,count5to15=0;for(const instance of patch.instances){const distance=length(sub(instance.worldOrigin,cameraPoint))*1000;if(distance<=5)count0to5++;else if(distance<=15)count5to15++;}
  band.count0to5+=count0to5;band.count5to15+=count5to15;
  perCell.push({cell:[patch.cell.x,patch.cell.z],surfaceAreaM2:area.surfaceAreaM2,eligibleAreaM2:area.eligibleAreaM2,eligibleArea0to5M2:area.eligibleArea0to5M2,eligibleArea5to15M2:area.eligibleArea5to15M2,count0to5,count5to15,rootCount:patch.roots.length,bladeCount:patch.instances.length});
 }
 const uniqueRoots=new Set(rootIds),uniqueBlades=new Set(bladeIds),emptyEligibleNearCells=perCell.filter(c=>c.eligibleArea0to5M2+c.eligibleArea5to15M2>.01&&c.count0to5+c.count5to15===0).map(c=>c.cell),density0to5=band.count0to5/band.eligibleArea0to5M2,density5to15=band.count5to15/band.eligibleArea5to15M2,maxPackedSupportErrorMetres=maxPackedError(population.patches,Grass.frameForState(state));
 let maxRootToSupportErrorMetres=0;
 for(const patch of population.patches)for(const root of patch.roots){const support=S.query(state,...root.chart);maxRootToSupportErrorMetres=Math.max(maxRootToSupportErrorMetres,length(sub(root.worldOrigin,support.point))*1000);}
 assert.equal(uniqueRoots.size,rootIds.length,'root IDs are unique across all requested cells');assert.equal(uniqueBlades.size,bladeIds.length,'blade IDs are unique across all requested cells');
 assert(band.count0to5>0&&band.count5to15>0);assert(band.eligibleArea0to5M2>0&&band.eligibleArea5to15M2>0);
 assert(density0to5>=200&&density0to5<=300,`0–5 m density ${density0to5}`);assert(density5to15>=200&&density5to15<=300,`5–15 m density ${density5to15}`);
 assert.equal(emptyEligibleNearCells.length,0,'every cell with eligible near area contains blades');
 assert(maxRootToSupportErrorMetres<=.002);assert(maxPackedSupportErrorMetres<=.002,`packed support error ${maxPackedSupportErrorMetres} m`);

 const result={status:'PASS',evidence:'IB-075-C placement and support CPU fixture',fixture:'tests/fixtures/meadow-placement-c1.json',implementation:{profileId:E.PROFILE_ID,coverageId:E.COVERAGE_ID,representationRevision:3,placementRevision:2,chartMetres:[256,256],logicalCellMetres:[8,8],ownerCells:cellsSeen.size,distribution:'fixed 100-candidate roots/m2 pool × 5 blades/root, filtered to the selected physical target',supportSources:[...new Set(population.patches.flatMap(p=>p.supportSources))]},identity:{rootCount:rootIds.length,uniqueRoots:uniqueRoots.size,duplicateRootChecks:rootIds.length-uniqueRoots.size,bladeCount:bladeIds.length,uniqueBlades:uniqueBlades.size,duplicateBladeChecks:bladeIds.length-uniqueBlades.size,boundary:'half-open',filtering:'candidate and blade IDs retained'},areaAndDensity:{surfaceAreaM2:band.surfaceAreaM2,eligibleAreaM2:band.eligibleAreaM2,distanceBands:{'0-5m':{count:band.count0to5,eligibleAreaM2:band.eligibleArea0to5M2,bladesPerM2:density0to5},'5-15m':{count:band.count5to15,eligibleAreaM2:band.eligibleArea5to15M2,bladesPerM2:density5to15}},emptyEligibleNearCells,perCell},support:{maximumRootToSupportErrorMetres:maxRootToSupportErrorMetres,maximumPackedBladeSupportErrorMetres:maxPackedSupportErrorMetres,targetMetres:.002,syntheticTriangleCases:terrainResults,analyticInnerShellTraceErrorMetres:length(sub(trace.point,shell.point))*1000,cameraHeightKm:camera.cameraHeightKm,radialConvention:'radius - terrainHeight'},lifecycle:{unloadDisposed:manager.info.disposed,coldRevisitStable:true,rebaseIdentityStable:true,requestOrderStable:true},limits:{coverageDomainMetres:[256,256],globalPageCubeFaceOwnership:false,workerParity:'recorded separately by browser fixture'}};
 const output=path.resolve(process.env.IB075_TEST_OUTPUT||path.join(__dirname,'../work','ib075-c-'+new Date().toISOString().replace(/[:.]/g,'-')));fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'c-placement-support.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
