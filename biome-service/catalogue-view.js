/* Browser-facing catalogue projection; activation belongs to the public service. */
(function(root){
'use strict';
function availableRows(registry){if(!registry||typeof registry.listAvailable!=='function')throw Error('A service registry is required');return registry.listAvailable().map(release=>Object.freeze({key:release.payloadDigest,title:release.name,version:release.version,status:release.status,reason:release.reason,canInspect:release.descriptorVerified,canInstall:release.available,installed:false,source:Object.freeze({kind:'catalogue-release',payloadDigest:release.payloadDigest})}));}
async function verifiedRows(registry){if(!registry||typeof registry.listVerified!=='function')throw Error('A service registry is required');return (await registry.listVerified()).map(release=>Object.freeze({key:release.payloadDigest,title:release.name,version:release.version,status:'Verified release',canVisit:false,installed:false}));}
const api={availableRows,verifiedRows};root.SphereBiomeCatalogueView=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
