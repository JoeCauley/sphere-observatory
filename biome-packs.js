/* Stable pack addresses. No camera, clock or asset readiness participates in geography. */
(function(root){
'use strict';
const watershed=Object.freeze({id:'watershed',geographyRevision:1,artRevision:1,
 coordinates:'Gnomonic kilometres in SphereSites.shellFrame(saved unit-vector anchor); +y points into the cavity. Opposite hemisphere is outside this pack.',
 seed:713,bounds:{radiusKm:78000,coreExtentKm:640},
 assets:[{id:'catchments-and-routes',source:'watershed-neighbourhood.js',required:true},{id:'river-gardens',source:'watershed-province.js',required:true}],
 fallback:'Analytic land, rivers and routes require no image assets; optional surface artwork falls back to the same masks and measured albedo.',
 budget:{residentAddresses:2,graphSegments:128,graphKiB:96,additionalTextureMiB:0,provinceVertexMiB:128,provinceCollisionMiB:96},
 places:[{id:'watershed',packId:'watershed',name:'Watershed · the river gardens',category:'watersheds',description:'An irregular neighbourhood of receiving lakes, connected waterways and open country, anchored by the ivory river garden.',biome:0,walk:true}]
});
function validate(address,s){
 if(address==null)return null; // Migration: historical scenes never acquire a new atlas.
 if(typeof address!=='object'||Array.isArray(address)||address.schema!==1||address.packId!==watershed.id||address.geographyRevision!==1||address.artRevision!==1)throw Error('Unsupported Biome Pack address or revision');
 if(s.provinceRevision!==1||address.seed!==s.provinceSeed||!Array.isArray(address.anchor)||address.anchor.length!==3||!address.anchor.every((v,i)=>Number.isFinite(v)&&v===s.provinceAnchor?.[i]))throw Error('The pack address must retain its saved province seed and anchor');
 return {schema:1,packId:watershed.id,geographyRevision:1,artRevision:1,seed:address.seed,anchor:address.anchor.slice()};
}
function activate(input){const s=root.SphereWatershed.activate(input);s.packAddress={schema:1,packId:watershed.id,geographyRevision:1,artRevision:1,seed:s.provinceSeed,anchor:s.provinceAnchor.slice()};const clean=root.SphereMath.validate(s);clean.playing=!!input.playing;return clean;}
const api={entries:[watershed],get:id=>id==='watershed'?watershed:null,validate,activate,catalogue:()=>watershed.places.map(p=>({...p})),enabled:s=>s.packAddress?.packId==='watershed'&&s.packAddress.geographyRevision===1};
root.SpherePacks=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
