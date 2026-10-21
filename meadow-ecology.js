/* IB-075-B: the bounded meadow's shared ecological overlay.
 * The overlay is an art/vegetation contract over the retained Watershed
 * geography. It never replaces pack water, routes, terrain support or scene
 * identity, and it is inactive for legacy/unversioned meadow scenes. */
(function(root){
'use strict';
const M=root.SphereMath;
const SCHEMA=1,REPRESENTATION_REVISION=3,ECOLOGICAL_REVISION=1,PLACEMENT_REVISION=2;
const PROFILE_ID='bounded-meadow-proof-v1',COVERAGE_ID='watershed-open-meadow-proof-v1';
const DOMAIN=Object.freeze({anchor:[21500,-5000],size:256,half:128,blend:16});
const GROUND_PALETTE=Object.freeze({id:'meadow-proof-ground-v1',albedo:[.16,.205,.075],roughness:.88,wetAlbedo:[.10,.16,.09]});
const chartFrames=new WeakMap();
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const finitePair=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite);

function active(state){const m=state?.meadow;return !!(m?.enabled&&m.schema===SCHEMA&&m.representationRevision===REPRESENTATION_REVISION&&m.profileId===PROFILE_ID&&m.coverageId===COVERAGE_ID);}
function profile(state){return active(state)?state.meadow:null;}
function createProfile(state,options={}){
 const time=Number.isFinite(state?.time)?state.time:0,phase=Number.isFinite(options.windPhaseSeconds)?options.windPhaseSeconds:time;
 const timeline=options.windTimelineRevision===1?{windTimelineRevision:1,windVisualSpeed:options.windVisualSpeed??1,windResolvedPhaseSeconds:phase}:{},scale=Number.isFinite(options.windSceneSecondsPerSecond)?options.windSceneSecondsPerSecond:options.windTimelineRevision===1?(state.timeRate??60)/(options.windVisualSpeed??1):60;
 const density=Number.isFinite(options.densityBladesPerM2)?options.densityBladesPerM2:250;
 return {...timeline,enabled:true,schema:SCHEMA,representationRevision:REPRESENTATION_REVISION,placementRevision:PLACEMENT_REVISION,profileId:PROFILE_ID,coverageId:COVERAGE_ID,seed:Number.isInteger(state?.seed)?state.seed:0,anchor:DOMAIN.anchor.slice(),ecologicalRevision:ECOLOGICAL_REVISION,densityBladesPerM2:density,densityPreset:options.densityPreset||'near-250-blades-m2',qualityPreset:options.qualityPreset||'proof',appearancePreset:options.appearancePreset||'meadow-proof-v2',appearanceRevision:Number.isInteger(options.appearanceRevision)?options.appearanceRevision:2,...(options.appearanceRevision>=3?{canopyRevision:options.canopyRevision??(options.appearanceRevision===4?2:1),materialRevision:options.materialRevision??(options.appearanceRevision===4?3:2)}:{}),nearRange:Number.isFinite(options.nearRange)?options.nearRange:.32,middleRange:Number.isFinite(options.middleRange)?options.middleRange:1.15,farRange:Number.isFinite(options.farRange)?options.farRange:2.8,rootsPerSubcell:Number.isFinite(options.rootsPerSubcell)?options.rootsPerSubcell:12,density:1,windStrength:Number.isFinite(options.windStrength)?options.windStrength:.38,windClock:phase,pausedClock:phase,windPhaseSeconds:phase,windAnchorSceneTime:time,windSceneSecondsPerSecond:scale,worker:options.worker!==false,wind:{phaseSeconds:phase,anchorSceneTime:time,sceneSecondsPerWindSecond:scale}};
}
function chartFrame(state){
 const anchor=state?.meadow?.anchor||DOMAIN.anchor;
 const signature=JSON.stringify([anchor,state?.radius,state?.provinceAnchor]);
 if(state&&typeof state==='object'){const cached=chartFrames.get(state);if(cached?.signature===signature)return cached.frame;}
 if(!root.SphereWatershed?.direction||!root.SphereSites?.shellFrame)throw Error('The named Meadow chart requires the saved Watershed frame');
 const direction=M.norm(root.SphereWatershed.direction(anchor[0],anchor[1],state)),basis=root.SphereSites.shellFrame(direction);
 const frame={direction,east:basis[0],north:basis[2],radius:Number(state.radius)};
 if(state&&typeof state==='object')chartFrames.set(state,{signature,frame});
 return frame;
}
function chartDirection(state,xMetres,zMetres){
 const frame=chartFrame(state),x=Number(xMetres)*.001,z=Number(zMetres)*.001;
 return M.norm(M.add(M.mul(frame.direction,frame.radius),M.add(M.mul(frame.east,x),M.mul(frame.north,z))));
}
function chartCoordinates(state,input){
 const frame=chartFrame(state),q=M.norm(input),den=M.dot(q,frame.direction);
 if(den<=0)return [Infinity,Infinity];
 return [frame.radius*M.dot(q,frame.east)/den*1000,frame.radius*M.dot(q,frame.north)/den*1000];
}
function localOf(input,state){
 if(finitePair(input))return [input[0]-DOMAIN.anchor[0],input[1]-DOMAIN.anchor[1]];
 if(Array.isArray(input)&&input.length===3){
  const q=M?.norm(input);
  if(state?.meadow?.placementRevision===PLACEMENT_REVISION)return chartCoordinates(state,q);
  if(root.SphereNeighbourhood?.local){const local=root.SphereNeighbourhood.local(q,state);if(finitePair(local))return [local[0]-DOMAIN.anchor[0],local[1]-DOMAIN.anchor[1]];}
  if(root.SphereWatershed?.local){const local=root.SphereWatershed.local(q,state);if(finitePair(local))return [local[0]-DOMAIN.anchor[0],local[1]-DOMAIN.anchor[1]];}
  return [Infinity,Infinity];
 }
 if(input?.direction)return localOf(input.direction,state);
 return [Infinity,Infinity];
}
function coverageAt(input,state){
 const [dx,dz]=localOf(input,state),edge=DOMAIN.half-Math.max(Math.abs(dx),Math.abs(dz));
 return {coverage:edge<=0?0:edge>=DOMAIN.blend?1:smooth(edge/DOMAIN.blend),inside:edge>0,blendDistance:Math.max(0,Math.min(DOMAIN.blend,edge)),local:[dx,dz],edgeDistance:edge,coverageId:COVERAGE_ID,domain:DOMAIN};
}
function directionInDomain(state){
 const q=state?.position&&M?.norm(state.position);return q?coverageAt(q,state):{coverage:0,inside:false,local:[Infinity,Infinity],coverageId:COVERAGE_ID,domain:DOMAIN};
}
function query(input,state,options={}){
 const base=options.base||root.SphereGeography?.query(input,{state,representation:options.representation||'walking',ecology:false})||{};
 if(!active(state))return base;
 const coverage=coverageAt(input,state),source=base.exclusionMasks||{},water=!!(source.water||base.water?.river||base.water?.basin||base.water?.membership>.35),route=!!(source.routeClearance||base.route?.membership>.35),structure=!!source.structureClearance,damage=!!source.damage,missing=!!source.missing,slope=!!source.slope;
 const excluded=water||route||structure||damage||missing||slope||coverage.coverage<=0,eligible=!excluded;
 const ecology={schema:SCHEMA,representationRevision:REPRESENTATION_REVISION,ecologicalRevision:ECOLOGICAL_REVISION,coverageId:COVERAGE_ID,coverage:coverage.coverage,local:coverage.local,inside:coverage.inside,eligibleArea:eligible,excluded,exclusions:{water,route,structure,damage,missing,slope},effectiveVegetationRole:eligible?'meadow':base.landUseRole||'wildland',grassDensityBladesPerM2:eligible?(profile(state)?.densityBladesPerM2??250)*coverage.coverage:0,treeSuppressed:eligible&&coverage.coverage>.05,wetness:Number.isFinite(base.wetness)?base.wetness:0,groundPalette:GROUND_PALETTE};
 const masks={...source,water:source.water||water,routeClearance:source.routeClearance||route,structureClearance:source.structureClearance||structure,damage:source.damage||damage,missing:source.missing||missing,slope:source.slope||slope};
 return {...base,exclusionMasks:masks,meadowCoverage:coverage.coverage,effectiveVegetationRole:ecology.effectiveVegetationRole,grassDensityBladesPerM2:ecology.grassDensityBladesPerM2,treeSuppressed:ecology.treeSuppressed,wetness:ecology.wetness,groundPalette:GROUND_PALETTE,ecology};
}
function validate(input){if(!input||typeof input!=='object'||!active({meadow:input}))throw Error('Unsupported meadow profile');return input;}
const api={SCHEMA,REPRESENTATION_REVISION,ECOLOGICAL_REVISION,PLACEMENT_REVISION,PROFILE_ID,COVERAGE_ID,DOMAIN,GROUND_PALETTE,active,profile,createProfile,chartFrame,chartDirection,chartCoordinates,localOf,coverageAt,directionInDomain,query,apply:query,validate};
root.SphereMeadowEcology=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
