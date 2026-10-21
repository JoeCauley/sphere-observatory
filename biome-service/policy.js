/* Host pilot policy. Pack recipes do not own publication or these ceilings. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const ALLOCATION=R.deepFreeze({level:14,minimumLevel:12,maximumLevel:18,regionsPerPack:1,targetAreaM2:1e16,maxCandidateAnchors:4096,maxCellVisits:65536,maxCellsPerRegion:4096,maxCellsPerWorld:65536,maxRegionsPerWorld:128,maxBatchClassifications:256,maxIndexNodes:262144,numericSafetyMarginM:1,tieBreak:'numeric-face-level-x-y',freshBatchOrder:'priority-pack-request'});
const LIMITS=R.deepFreeze({maxInstalledReleases:64,maxManifestBytes:1048576,maxReleaseBytes:268435456,maxAssets:4096,maxWorldBindingBytes:16777216,maxProviderStateBytes:1048576,serviceCpuPeakBytes:33554432,serviceGpuPeakBytes:10485760,aggregateProviderCpuPeakBytes:67108864,aggregateProviderGpuPeakBytes:33554432,frameMaintenanceP95Ms:.5,overviewIncrementalGpuP95Ms:.5});
async function pilot(hostAdapter,captured){
 const snapshot=captured?.snapshot,hostWorldEnvelope=R.deepFreeze(R.clone(captured?.hostWorldEnvelope));
 hostAdapter.metadata(snapshot);await R.verifyEnvelope(hostWorldEnvelope);
 if(R.canonicalJSON(snapshot)!==R.canonicalJSON(hostWorldEnvelope.body))throw R.error('HOST_WORLD_MISMATCH','Pilot policy requires the exact captured host world',{},'policy');
 const body={format:'sphere-biome-policy/1',policyId:'pilot-policy-v1',allocatorRevision:'connected-frontier-v1',worldId:snapshot.worldId,worldSeed:snapshot.worldSeed,hostWorldDigest:hostWorldEnvelope.digest,hostGeographyDigest:snapshot.hostGeographyDigest,trackProfileDigest:snapshot.trackProfileDigest,protectionProfileDigest:snapshot.protectionProfileDigest,shellRadiusM:snapshot.validatedStaticWorldParameters.radius*1000,addressProfile:'sphere-world-address-v2',allocation:R.clone(ALLOCATION),limits:R.clone(LIMITS),protectedProfiles:['wound-apertures-v1','authored-sites-v1','polar-ports-v1'],continuation:'same-input-same-counters'};
 R.validatePolicy(body,{hostWorld:snapshot,hostWorldDigest:hostWorldEnvelope.digest});return R.envelope(body);
}
const api=Object.freeze({ALLOCATION,LIMITS,pilot});root.SphereBiomePolicy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
