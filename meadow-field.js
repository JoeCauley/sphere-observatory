/*
 * IB-070 Endless Meadow vertical slice.
 *
 * This module is deliberately a layer above IB-060.  Grass roots keep their
 * existing World Address identity; the meadow adds representation ownership,
 * a shared far-material field, coherent wind timing and deterministic blend
 * weights.  It is opt-in and does not alter old scenes.
 */
(function(root){
'use strict';
const W=root.SphereMeadowWind||(typeof require==='function'?require('./meadow-wind.js'):null);

const A=root.SphereWorldAddress||((typeof require==='function')?require('./world-address.js'):null);
const T=root.SphereWorldTopology||((typeof require==='function')?require('./world-topology.js'):null);
const G=root.SphereGeography||((typeof require==='function')?require('./world-geography.js'):null);
const E=root.SphereInstancedEnvironment||((typeof require==='function')?require('./instanced-environment.js'):null);
const Grass=root.SphereGrass||((typeof require==='function')?require('./grass-stream.js'):null);
if(!A||!T||!G||!E||!Grass)throw Error('World, geography, instancing and grass modules are required before the meadow');

const REVISION=2, PATCH_SIZE=Grass.PATCH_SIZE;
// Wind strength is expressed as a fraction of a blade/card's own height.
const DEFAULTS=Object.freeze({nearRange:.32,middleRange:1.15,farRange:2.8,radiusPatches:11,maxPatches:225,rootsPerSubcell:12,nearBladeCopies:14,nearBladeSpread:.0018,density:1,windStrength:.38,worker:true});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,k)=>a.map(v=>v*k);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const length=v=>Math.hypot(...v);
const norm=v=>{const n=length(v);return n?mul(v,1/n):[0,1,0];};
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const hashUnit=value=>(E.hashString(value)>>>0)/4294967296;
const hashHex=values=>{let h=2166136261>>>0;for(const value of values){for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

function frameSignature(frame){return frame.origin.map(v=>v.toPrecision(12)).join(',')+'|'+frame.basis.map(a=>a.map(v=>v.toPrecision(10)).join(',')).join(';');}
function metadata(state){return {worldSeed:Math.floor(state.worldSeed??state.seed??0),geographyRevision:Math.floor(state.geographyRevision??2),terrainRevision:Math.floor(state.terrainRevision??2),artRevision:Math.floor(state.artRevision??1),assetRevision:Math.floor(state.assetRevision??1),heroRevision:state.heroRevision??null};}
function quaternion(input){const q=input,n=Math.hypot(...q);return n?q.map(v=>v/n):[0,0,0,1];}
function orientation(normal,yaw=0){const n=norm(normal),from=[0,1,0],d=dot(from,n);let q;if(d<-.999999)q=[1,0,0,0];else q=quaternion([from[1]*n[2]-from[2]*n[1],from[2]*n[0]-from[0]*n[2],from[0]*n[1]-from[1]*n[0],1+d]);const s=Math.sin(yaw/2),r=[0,n[0]*s,n[1]*s,n[2]*s];return quaternion([r[3]*q[0]+r[0]*q[3]+r[1]*q[2]-r[2]*q[1],r[3]*q[1]-r[0]*q[2]+r[1]*q[3]+r[2]*q[0],r[3]*q[2]+r[0]*q[1]-r[1]*q[0]+r[2]*q[3],r[3]*q[3]-r[0]*q[0]-r[1]*q[1]-r[2]*q[2]]);}

function windClock(state,options={}){
 const meadow=state?.meadow||{};
 if(W.active(state))return W.phase(state);
 if(meadow.representationRevision===3){
  const phase=Number(meadow.windPhaseSeconds??meadow.wind?.phaseSeconds??meadow.pausedClock??meadow.windClock??state?.time??0);
  if(options.capture||state?.playing===false)return phase;
  const anchor=Number(meadow.windAnchorSceneTime??meadow.wind?.anchorSceneTime??state?.time??0),scale=Math.max(.001,Number(meadow.windSceneSecondsPerSecond??meadow.wind?.sceneSecondsPerWindSecond??60));
  return phase+(Number(state?.time??anchor)-anchor)/scale;
 }
 // windClock is a recorded/capture value, never a live-preview latch.  A
 // normal playing scene follows application time; paused and exported views
 // repeat the explicitly recorded clock.
 if(options.capture||state?.playing===false)return Number(meadow.pausedClock??meadow.windClock??state?.time??0);
 return Number(state?.time??meadow.windClock??0);
}
function windAt(address,state,options={}){
 const key=typeof address==='string'?address:A.stringify(address),clock=windClock(state,options),phase=hashUnit('meadow-wind:'+key)*Math.PI*2;
 if(W.active(state)){const q=A.direction(typeof address==='string'?A.parse(address):address),metres=root.SphereMeadowEcology.chartCoordinates(state,q);return {clock,phase,...W.field(metres,clock)};}
 return {clock,phase,gust:.68+.32*Math.sin(phase+clock*.19),direction:[Math.cos(phase*.37),0,Math.sin(phase*.37)]};
}
function interactionFactor(local,state,options={}){
 const interaction=options.interaction??state?.meadow?.interaction;if(!interaction||!Array.isArray(interaction.position))return 1;
 const radius=Math.max(.0001,Number(interaction.radius??.8)),distance=length(sub(local,interaction.position));
 return 1-clamp(Number(interaction.strength??.7))*(1-smooth(clamp(distance/radius)));
}
function semantic(q,state){const legacy=state?.packAddress?.geographyRevision===1||state?.provinceRevision===1,base=G.query(q,{state,revision:legacy?'legacy':undefined,representation:'walking',ecology:false});return root.SphereMeadowEcology?.active?.(state)?root.SphereMeadowEcology.query(q,state,{base,representation:'walking'}):base;}
function density(field,options={}){
 return Grass.densityFactor(field,{...options,meadowBlend:true});
}
function material(field,address,state,options={}){
 const d=density(field,options),w=windAt(address,state,options),weights=field.biomeWeights||[],wet=field.wetness||0;
 const meadow=clamp((weights[1]||0)*.7+(weights[8]||0)*.3),palette=field.groundPalette?.albedo||[.18+.16*meadow,.35+.25*meadow,.11+.12*meadow],green=palette.slice(),soil=[.22,.18,.10];
 const colour=green.map((v,i)=>v*(.55+.45*d)+soil[i]*(1-d)*.35),slope=clamp(field.slope||0);
 const normal=norm([Math.sin(w.phase)*slope*.24,1,Math.cos(w.phase)*slope*.24]);
 return {density:d,colour:[...colour,1],normal,roughness:clamp(.88-wet*.16),wind:w,biomeWeights:weights.slice(),source:field.source,revision:REVISION};
}
function tierWeights(distance,options={}){
 const near=Math.max(.001,options.nearRange??DEFAULTS.nearRange),middleRange=Math.max(near+.001,options.middleRange??DEFAULTS.middleRange);
 const nearOut=1-smooth(clamp((distance-near*.72)/(near*.48))),farIn=smooth(clamp((distance-middleRange*.78)/(middleRange*.42)));
 const middleWeight=Math.max(0,(1-nearOut)*(1-farIn)),far=farIn;
 return {near:nearOut,middle:middleWeight,far,total:nearOut+middleWeight+far};
}
function cardVertices(width=.5,height=1){return [-width,0,-width,0,1,0,width,0,-width,0,1,0,width,height,-width,0,1,0,-width,height,-width,0,1,0,-width,0,width,0,1,0,width,0,width,0,1,0,width,height,width,0,1,0,-width,height,width,0,1,0];}
function materialVertices(size=.5){return [-size,0,-size,0,1,0,size,0,-size,0,1,0,size,0,size,0,1,0,-size,0,size,0,1,0];}
function prototypes(options={}){
 const near=Grass.grassPrototypes(options),middle=[];
 for(let i=0;i<3;i++)middle.push(E.createPrototype({id:`meadow-middle-card-${i}`,lods:[{vertices:cardVertices(.012+i*.002,1),indices:[0,1,2,0,2,3,4,6,5,4,7,6]}],alphaTest:true,wind:true,albedo:[.28+.04*i,.52+.04*i,.18+.03*i,1],roughness:.9}));
 const far=E.createPrototype({id:'meadow-far-material',lods:[{vertices:materialVertices(1),indices:[0,1,2,0,2,3]}],wind:true,broadWind:true,albedo:[.2,.42,.14,1],roughness:.92});
 return {near,middle,far,all:[...near,...middle,far]};
}
function cloneFor(instance,prototypeId,scale=1){return E.createInstance({...instance,prototypeId,scale:instance.scale*scale});}
function nearTuft(instance,sourceKey,config){
 const copies=Math.max(1,Math.floor(config.nearBladeCopies??DEFAULTS.nearBladeCopies)),spread=Math.max(0,Number(config.nearBladeSpread??DEFAULTS.nearBladeSpread)),out=[];
 for(let copy=0;copy<copies;copy++){const key=`${sourceKey}:blade:${copy}`,angle=hashUnit(key+':angle')*Math.PI*2,radius=Math.sqrt(hashUnit(key+':radius'))*spread;
  // A root remains the stable IB-060 identity; blades are deterministic
  // botanical children, so density can change without relocating that root.
  out.push(E.createInstance({...instance,origin:[instance.origin[0]+Math.cos(angle)*radius,instance.origin[1],instance.origin[2]+Math.sin(angle)*radius],addressKey:key,phase:hashUnit(key+':wind'),seed:E.hashString(key),scale:instance.scale*(.68+hashUnit(key+':height')*.62),boundsRadius:instance.boundsRadius*1.35}));
 }
 return out;
}

class EndlessMeadow {
 constructor(options={}){this.options={...DEFAULTS,...options};this.grass=new Grass.GrassStreamManager({...this.options});this.fixedGrass=new Grass.FixedChartGrassManager({...this.options,boundedPreparation:true,maxPrepareCellsPerFrame:1});this.lastPopulation=null;this.lastFrame='';this.lastConfig='';this.residentPrototypeKey='';this.residentPrototypes=null;this.residentPopulation=null;this.rebases=0;}
 request(state,options={}){
  const config={...this.options,...state?.meadow,...options};
  if(config.representationRevision===3&&config.placementRevision===2)return this.requestResident(state,config,options);
  const frame=Grass.frameForState(state),frameKey=frameSignature(frame),configKey=JSON.stringify([config.nearRange,config.middleRange,config.farRange,config.density,config.densityBladesPerM2,config.rootsPerSubcell,config.radiusPatches,config.maxPatches,config.representationRevision,config.placementRevision,config.coverageId]);
  if(this.lastFrame&&this.lastFrame!==frameKey){this.grass.cache.clear();this.grass.requestSignature='';this.rebases++;}
  if(this.lastConfig&&this.lastConfig!==configKey){this.grass.cache.clear();this.grass.requestSignature='';}
  this.lastFrame=frameKey;this.lastConfig=configKey;
  this.grass.options={...this.grass.options,...config,meadowBlend:true,coverageId:config.representationRevision===3?config.coverageId:null,radiusPatches:Math.ceil(config.farRange/PATCH_SIZE),maxPatches:config.maxPatches,rootsPerSubcell:config.rootsPerSubcell,worker:config.worker!==false};
  const grassPopulation=this.grass.request({...state,grass:{...state.grass,enabled:true,...config}}),fixedPopulation=config.placementRevision===2?this.fixedGrass.request({...state,meadow:config},{frame,radiusMetres:Grass.MEADOW_DETAIL_RADIUS_METRES}):null,p=prototypes(config),near=[],middle=[],far=[];
  for(const source of grassPopulation.patches){
   const cameraLocal=(()=>{const d=sub(state.position||frame.origin,frame.origin);return [dot(d,frame.basis[0]),dot(d,frame.basis[1]),dot(d,frame.basis[2])];})();
   const d=length([source.center[0]-cameraLocal[0],source.center[1]-cameraLocal[1],source.center[2]-cameraLocal[2]]),weights=tierWeights(d,config),field=semantic(A.direction(source.address),state),farMaterial=material(field,source.address,state,config);
   if(weights.near>.001){const instances=source.instances.flatMap((instance,i)=>{if(config.placementRevision===2&&length(sub(instance.origin,cameraLocal))<=Grass.MEADOW_DETAIL_RADIUS_METRES*.001)return [];return nearTuft(cloneFor(instance,instance.prototypeId,interactionFactor(instance.origin,state,config)),`${source.key}:${i}`,config);});if(instances.length)near.push(E.createPatch({id:`${source.id}:near`,center:source.center,radius:source.radius,instances,addressKey:source.key,revision:REVISION,coverage:weights.near,tier:'near'}));}
   if(weights.middle>.001){const instances=source.instances.map((instance,i)=>cloneFor(instance,`meadow-middle-card-${source.roots[i]?.widthClass??0}`,1.35*interactionFactor(instance.origin,state,config)));middle.push(E.createPatch({id:`${source.id}:middle`,center:source.center,radius:source.radius,instances,addressKey:source.key,revision:REVISION,coverage:weights.middle,tier:'middle'}));}
   // source.center is already terrain-conformed by Grass.buildPatch.  Adding
   // semantic height again creates stale, camera-intersecting far cards.
   if(weights.far>.001){const centre=source.center,instance=E.createInstance({prototypeId:p.far.id,origin:centre,quaternion:orientation(farMaterial.normal),scale:PATCH_SIZE,colour:farMaterial.colour,phase:farMaterial.wind.phase/(Math.PI*2),seed:E.hashString(source.key),boundsRadius:source.radius,address:source.address,addressKey:source.key,geography:field});far.push(E.createPatch({id:`${source.id}:far`,center:centre,radius:source.radius,instances:[instance],addressKey:source.key,revision:REVISION,coverage:weights.far,tier:'far',material:farMaterial}));}
  }
  for(const cell of fixedPopulation?.patches||[])near.push(E.createPatch({id:`${cell.id}:near`,center:cell.center,radius:cell.boundsRadius,instances:cell.instances,addressKey:cell.key,revision:cell.placementRevision,coverage:1,tier:'near'}));
  const population={prototypes:p.all,patches:[...near,...middle,...far],near,middle,far,farMaterialField:far.map(x=>x.material),coordinateSpace:'relative',frameBasis:grassPopulation.frameBasis,cameraLocal:grassPopulation.cameraLocal,placementRevision:config.placementRevision??1,fixedMeadowCells:fixedPopulation?.patches||[],options:{dither:true,batch:true,coverageSteps:16},windTime:windClock(state,{capture:!!options.capture}),windStrength:config.windStrength,meadowRevision:REVISION,representationRevision:config.representationRevision??null,profileId:config.profileId??null,coverageId:config.coverageId??null,recordedScene:{windClock:windClock(state,{capture:true}),paused:state.playing===false},interaction:config.interaction||null};
  this.lastPopulation=population;return population;
 }
 requestResident(state,config,options={}){
  if(config.selectionRevision===2)return this.requestProduction({...state,meadow:config},options);
  if(this.productionPopulation){this.productionPopulation.service.dispose();this.productionPopulation=null;this.productionKey=null;}
  const prototypeKey=JSON.stringify(['meadow-resident-prototypes-v1',config.canopyRevision,config.materialRevision,config.artRevision??state.artRevision??1,config.assetRevision??state.assetRevision??1,config.appearanceRevision??1,config.lodDistance??.045]);
  if(this.residentPrototypeKey!==prototypeKey){this.residentPrototypes=config.appearanceRevision>=Grass.MEADOW_ART_APPEARANCE_REVISION&&Grass.meadowArtPrototypes?Grass.meadowArtPrototypes(config):Grass.grassPrototypes(config);if(root.SphereMeadowCanopy?.active(state))this.residentPrototypes=[...this.residentPrototypes,...root.SphereMeadowCanopy.prototypes(state)];this.residentPrototypeKey=prototypeKey;}
  this.fixedGrass.options={...this.fixedGrass.options,...config,worker:config.worker!==false,boundedPreparation:true,maxPrepareCellsPerFrame:1};
  const fixed=this.fixedGrass.request({...state,meadow:config},{radiusMetres:root.SphereMeadowCanopy?.active(state)?root.SphereMeadowCanopy.contractFor(state).clumpRadiusMetres:Grass.MEADOW_DETAIL_RADIUS_METRES}),population=fixed.population;
  population.canopyRevision=config.canopyRevision||0;population.materialRevision=config.materialRevision||1;population.prototypes=this.residentPrototypes;population.cells=fixed.cells;if(this.residentTierKey!==this.fixedGrass.activeSignature){this.residentNear=population.residentCells.filter(c=>c.bladeCount>0);this.residentMiddle=population.residentCells.filter(c=>c.clumpCount>0);this.residentTierKey=this.fixedGrass.activeSignature;}population.near=this.residentNear;population.middle=this.residentMiddle;population.far=EMPTY_PATCHES;population.nearPatches=population.residentCells.length;population.options=RESIDENT_DRAW_OPTIONS;population.windTime=windClock(state,{capture:!!options.capture});population.windStrength=config.windStrength??this.options.windStrength;population.meadowRevision=REVISION;population.representationRevision=config.representationRevision;population.appearancePreset=config.appearancePreset??'meadow-proof-v1';population.appearanceRevision=config.appearanceRevision??1;population.profileId=config.profileId??null;population.coverageId=config.coverageId??null;population.diagnostic=config.diagnostic||null;population.coordinateSpace='resident-chart';
  this.lastPopulation=population;this.residentPopulation=population;return population;
 }
 requestProduction(state,options={}){
  const started=typeof performance==='undefined'?Date.now():performance.now();try{
  const descriptor=root.SphereVegetationRevisions.describe(state),contentKey=root.SphereVegetationRevisions.resourceKey(descriptor);
  // One pending producer lets its reserved tail merge before the next job.
  // Bounded asynchronous generation keeps stable 2 m jobs and shared records;
  // record limits remain independent of the padded physical address arena.
  if(this.productionKey!==contentKey||!this.productionPopulation){this.productionPopulation?.service.dispose();this.productionPopulation=createProgressivePopulation(state,{limits:{maxWorkers:3,maxAllocations:2048,gpuSlots:655360},maxPending:1,maxReferences:65536,maxUploadBytesPerFrame:2*1048576,productionSelection:true});this.productionKey=contentKey;this.productionDemandKey=null;}
  const population=this.productionPopulation,delta=sub(state.position,population.frameOrigin);population.cameraLocal=population.frameBasis.map(axis=>dot(delta,axis));population.windTime=windClock(state,{capture:!!options.capture});population.windStrength=state.meadow.windStrength;population.diagnostic=state.meadow.diagnostic;
  const width=options.internalWidth||1920,key=JSON.stringify([Math.floor(population.cameraLocal[0]*2000),Math.floor(population.cameraLocal[2]*2000),state.fov,width]);
  if(key!==this.productionDemandKey){const target=root.SphereVegetationSelection.demand(state,population.cameraLocal,width,{previous:population.demand,immutableInputs:true});this.productionDemandKey=key;population.demand=target;population.lifecycle.generatedDemand=target;if(!target.conflict)population.lifecycle.updateDemand(target);}
  this.lastPopulation=population;return population;
  }finally{const lifecycle=this.productionPopulation?.lifecycle;if(lifecycle)lifecycle.pendingPreparationMs=(lifecycle.pendingPreparationMs||0)+(typeof performance==='undefined'?Date.now():performance.now())-started;}
 }
 commitResident(signature){return this.fixedGrass.commitResident(signature);}
 hash(){const p=this.lastPopulation;if(!p)return '';if(p.coordinateSpace==='resident-chart')return this.fixedGrass.hash();return hashHex([...p.patches].sort((a,b)=>a.id.localeCompare(b.id)).flatMap(x=>[x.id,x.coverage,...x.instances.map(i=>[i.addressKey,i.prototypeId,i.seed].join('|')),x.material?.density??'']));}
 dispose(){this.productionPopulation?.service.dispose();this.productionPopulation=null;this.grass.dispose();this.fixedGrass.dispose();this.lastPopulation=null;this.residentPopulation=null;this.residentPrototypes=null;this.residentNear=null;this.residentMiddle=null;this.residentTierKey=null;}
 get info(){const p=this.lastPopulation;if(p?.service){const info=p.service.info;return {...info,fixedCells:p.service.allocations.size,fixedBlades:info.retainedDetailedRecords,fixedBytes:info.retainedBackingBytes,queue:info.queue+info.workers,canopyRevision:p.canopyRevision,materialRevision:p.materialRevision,selectionRevision:2,demand:p.demand?{detailRadiusMetres:p.demand.detailRadiusMetres,coarseRadiusMetres:p.demand.coarseRadiusMetres,conflict:p.demand.conflict||null}:null};}const i=this.grass.info,f=this.fixedGrass.info,resident=p?.coordinateSpace==='resident-chart',source=resident?f:i;return {...source,fixedCells:f.cells,fixedRoots:f.roots,fixedBlades:f.blades,fixedClumps:[...this.fixedGrass.cache.values()].reduce((n,c)=>n+(c.clumpCount||0),0),canopyRevision:p?.canopyRevision||0,materialRevision:p?.materialRevision||1,queue:resident?f.queue:i.queue+f.queue,fixedBytes:f.bytes,placementRevision:p?.placementRevision??1,meadowRevision:REVISION,nearPatches:p?.near.length||0,middlePatches:p?.middle.length||0,farPatches:p?.far.length||0,farMaterialPatches:p?.far.length||0,rebases:this.rebases,hash:this.hash()};}
}

const EMPTY_PATCHES=Object.freeze([]),RESIDENT_DRAW_OPTIONS=Object.freeze({dither:false,batch:false});

// The legacy production manager keeps the HR-00 saved-scene route. HR-02/03
// consume this service factory when generation/storage are ready to replace it.
function createResidencyService(state,options){const provider=root.SphereMeadowProvider||(typeof require==='function'?require('./meadow-provider.js'):null);return provider.createService(state,options);}
// Runtime population adapter for the real-worker shared service. Slot handles
// stay outside portable Meadow metadata. Untagged saved scenes retain the
// original route; the ordinary study arrival explicitly selects tuple (2,2,2).
function createGpuPopulation(service,state,handles,options={}){
 const frame=Grass.frameForMeadowChart(state),delta=sub(state.position,frame.origin);
 const gpuPrototypes=options.prototypes||(state.meadow.appearanceRevision>=2?[...Grass.meadowArtPrototypes(state.meadow),...(root.SphereMeadowCanopy.active(state)?root.SphereMeadowCanopy.prototypes(state):[])]:Grass.grassPrototypes(state.meadow));
 const population={service,handles:handles.slice(),prototypes:gpuPrototypes,frameOrigin:frame.origin,frameBasis:frame.basis,cameraLocal:frame.basis.map(axis=>dot(delta,axis)),coordinateSpace:'vegetation-chart',canopyRevision:state.meadow.canopyRevision||0,materialRevision:state.meadow.materialRevision||1,windTime:windClock(state),windStrength:state.meadow.windStrength??DEFAULTS.windStrength,...options};service.cpuInventory.retain('population',population,{lifetime:'population',release:'population/service disposal'});return population;
}
function createProgressivePopulation(state,options={}){if(!root.SphereMeadowCanopy.isF2(state))throw Error('Progressive coverage requires the F2 clump fallback adapter');const service=options.service||root.SphereMeadowProvider.createService(state,{sceneKey:options.sceneKey,limits:options.limits}),lifecycle=new root.SphereVegetationLifecycle.ProgressiveVegetation(service,root.SphereMeadowProvider.ID,options);return createGpuPopulation(service,state,[],{...options,lifecycle});}
const api={REVISION,PATCH_SIZE,DEFAULTS,windClock,windAt,interactionFactor,semantic,density,material,tierWeights,prototypes,EndlessMeadow,createResidencyService,createGpuPopulation,createProgressivePopulation};
root.SphereMeadow=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
