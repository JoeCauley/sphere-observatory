/* Stable identity for legacy Watershed service roles. */
(function(root){
'use strict';
const ROLES=Object.freeze({
 'Water recovery':'water-recovery',
 'Reserve storage':'reserve-storage',
 'Fabrication':'fabrication',
 'Thermal transfer':'thermal-transfer'
});
const DISPLAY=Object.freeze(Object.fromEntries(Object.entries(ROLES).map(([display,slug])=>[slug,display])));
function adapt(displayName){
 if(typeof displayName!=='string'||!Object.prototype.hasOwnProperty.call(ROLES,displayName))throw Error('Unknown legacy Watershed role: '+displayName);
 return {slug:ROLES[displayName],displayName};
}
function displayName(slug){
 if(typeof slug!=='string'||!Object.prototype.hasOwnProperty.call(DISPLAY,slug))throw Error('Unknown legacy Watershed role slug: '+slug);
 return DISPLAY[slug];
}
const api={ROLES,adapt,displayName,slugs:Object.freeze(Object.values(ROLES))};
root.SphereLegacyRoleAdapter=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
