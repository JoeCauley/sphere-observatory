/* NONNATIVE component codec. This is numerical test support, never a renderer. */
(function(root){'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('../../../biome-service/records.js'):null);
function fail(code,message){throw R.error(code,message,{},'component-support-codec');}
function decode(bytes,manifest){const recipe=R.parse(bytes);if(Object.keys(recipe).sort().join(',')!=='format,heightM,requiredConnectors,semanticGeneratorId,structures'||recipe.format!=='sphere-component-heightfield-box-recipe/1'||recipe.semanticGeneratorId!==manifest.semanticGeneratorId||!Number.isFinite(recipe.heightM)||Object.is(recipe.heightM,-0))fail('INVALID_RECIPE','Invalid component recipe');return {format:'sphere-biome-static-support/1',semanticGeneratorId:recipe.semanticGeneratorId,terrainHeightBoundsM:[recipe.heightM,recipe.heightM],staticStructures:recipe.structures,requiredConnectors:recipe.requiredConnectors,boundaryBehaviour:'terrain-only-guard-v1'};}
function heightAt(support){return {heightM:support.terrainHeightBoundsM[0],dx:0,dy:0};}
function validateState(data){if(Object.keys(data).sort().join(',')!=='format,visits'||data.format!=='sphere-component-support-state/1'||!Number.isSafeInteger(data.visits)||data.visits<0||data.visits>1000000)fail('INVALID_PROVIDER_STATE','Invalid component state');return data;}
function validatePresentation(data){if(Object.keys(data).join(',')!=='mode'||data.mode!=='none')fail('UNSUPPORTED_PRESENTATION','Component presentation supports only none');return data;}
function create(support){return Object.freeze({qualification:'NONNATIVE_NUMERICAL_COMPONENT',heightAt:(x,y)=>heightAt(support,x,y),solidBoxes:support.staticStructures.filter(s=>s.kind==='box')});}
const api=Object.freeze({decode,heightAt,validateState,validatePresentation,create});root.SphereBiomeP04SupportCodec=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
