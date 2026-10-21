/* HR-00: revision identity only. Allocation and worker admission belong to HR-01. */
(function(root){
'use strict';
const M=root.SphereMath||(typeof require==='function'?require('./math.js'):null);
const SCHEMA=1,CURRENT=M.VEGETATION_REVISIONS;
const REVISION_FIELDS=Object.freeze(Object.keys(CURRENT));
const LIFETIME_FIELDS=M.VEGETATION_LIFETIME_FIELDS;
function revisions(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid vegetation revisions');
 const result={},supported=REVISION_FIELDS.every(field=>input[field]===M.PERSISTENT_VEGETATION_REVISIONS[field])?M.PERSISTENT_VEGETATION_REVISIONS:CURRENT;
 for(const field of REVISION_FIELDS){const value=field in input?input[field]:CURRENT[field];if(!Number.isSafeInteger(value)||value!==supported[field])throw Error('Unsupported vegetation '+field);result[field]=value;}
 return Object.freeze(result);
}
function sceneRevisions(meadow){
 if(!meadow)return {};
 return Object.freeze(M.validateVegetationRevisions(meadow));
}
function lifetime(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid vegetation lifetime');
 const result={};
 for(const field of LIFETIME_FIELDS){const value=input[field];if(!Number.isSafeInteger(value)||value<(field==='slotGeneration'?1:0))throw Error('Invalid vegetation '+field);result[field]=value;}
 return Object.freeze(result);
}
function describe(state){
 const clean=M.validate(state),m=clean.meadow;
 if(!m||m.schema!==1||m.representationRevision!==3||m.placementRevision!==2)return null;
 // Content is geographic/appearance identity. No request, slot, camera,
 // timeline phase or render-frame value participates in it.
 const content=Object.freeze({providerId:m.profileId,coverageId:m.coverageId,schema:m.schema,representationRevision:m.representationRevision,placementRevision:m.placementRevision,ecologicalRevision:m.ecologicalRevision,appearancePreset:m.appearancePreset,appearanceRevision:m.appearanceRevision,canopyRevision:m.canopyRevision??0,materialRevision:m.materialRevision??1,seed:m.seed,anchor:Object.freeze(m.anchor.slice()),density:m.density,densityBladesPerM2:m.densityBladesPerM2,densityPreset:m.densityPreset,qualityPreset:m.qualityPreset,worldSeed:clean.worldSeed??clean.seed,geographyRevision:clean.geographyRevision,terrainRevision:clean.terrainRevision,artRevision:clean.artRevision,assetRevision:clean.assetRevision,heroRevision:clean.heroRevision,supportRevision:1,radius:clean.radius,provinceAnchor:clean.provinceAnchor?Object.freeze(clean.provinceAnchor.slice()):null});
 return Object.freeze({schema:SCHEMA,content,revisions:revisions(m)});
}
function contentKey(descriptor){if(descriptor?.schema!==SCHEMA||!descriptor.content)throw Error('Invalid vegetation revision descriptor');return JSON.stringify(descriptor.content);}
function resourceKey(descriptor){const key=contentKey(descriptor);return JSON.stringify([key,revisions(descriptor.revisions)]);}
const api={SCHEMA,CURRENT,REVISION_FIELDS,LIFETIME_FIELDS,revisions,sceneRevisions,lifetime,describe,contentKey,resourceKey};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SphereVegetationRevisions=api;
})(typeof window==='undefined'?globalThis:window);
