/* Reviewed classic-script boot for Main installation. No storage or placement. */
(function(root){
'use strict';
const REVISION='main-install-browser-boot-v6-native-support';
const MODULES=Object.freeze([
 ['schema-validators','SphereBiomeSchemaValidators',[]],
 ['records','SphereBiomeRecords',['envelope','verifyEnvelope','validateManifest']],
 ['numeric-profile','SphereBiomeNumericProfile',['capture','verify']],
 ['host-world','SphereBiomeHostWorld',['create']],
 ['provider-profiles','SphereBiomeProviderProfiles',['admit','makeProfile']],
 ['intervals','SphereBiomeIntervals',['add','toNumbers']],
 ['cell-geometry','SphereBiomeCellGeometry',['areaOfCells','certifyDomain']],
 ['eligibility-verifier','SphereBiomeEligibilityVerifier',['verifyCertificate']],
 ['eligibility','SphereBiomeEligibility',['create']],
 ['reservation-index','SphereBiomeReservations',['prepareReservations']],
 ['spatial-index','SphereBiomeSpatialIndex',['build','verify','metadataBytes']],
 ['metadata-budget','SphereBiomeMetadataBudget',['create','isOwner']],
 ['native/source-admission','SphereBiomeNativeSourceAdmission',['admit','createSourceOwner']],
 ['storage','SphereBiomeStorage',['open']],
 ['release-store','SphereBiomeReleaseStore',['create']],
 ['verified-record-store','SphereBiomeVerifiedRecordStore',['create','isOwner']],
 ['checkpoint-store','SphereBiomeCheckpointStore',['create']],
 ['commonboundary-adapter','SphereBiomeCommonBoundary',['create']],
 ['allocator','SphereBiomeAllocator',['create','buildProfile']],
 ['allocation-handoff.v1','SphereBiomeAllocationHandoff',['transfer','verifyCheckpoint']],
 ['binding-builder.v2','SphereBiomeBindingBuilder',['create']],
 ['native/fixture-recipe','SphereBiomeNativeFixtureRecipe',['validateRecipe','heightAt']],
 ['native/native-distance','SphereBiomeNativeDistance',['chart']],
 ['native/direction-halo','SphereBiomeNativeDirectionHalo',['bounds']],
 ['native/surface-differential','SphereBiomeNativeDifferential',['constant']],
 ['native/composition-model','SphereBiomeNativeCompositionModel',[]],
 ['native/legacy-base','SphereBiomeNativeLegacyBase',['geometry']],
 ['native/surface-bounds','SphereBiomeNativeSurfaceBounds',[]],
 ['native/binary64-sampler','SphereBiomeNativeBinary64Sampler',[]],
 ['native/static-geometry','SphereBiomeNativeStaticGeometry',['build']],
 ['native/surface-kernel.v2','SphereBiomeNativeSurfaceKernelV2',['create','isOwner']],
 ['native/terrain-mesh.v2','SphereBiomeNativeTerrainMeshV2',['layout','support']],
 ['native/resource-leases','SphereBiomeNativeResources',['createHost','isHost']],
 ['native/fixture-definition','SphereBiomeNativeFixtureDefinition',['make']],
 ['native/provider-host.v2','SphereBiomeNativeProviderHostV2',['createBridge','isOwner']],
 ['view-envelope','SphereBiomeViewEnvelope',['create']],
 ['lifecycle','SphereBiomeLifecycle',['validateStatus','validatePublishedMarker']],
 ['publication.v2','SphereBiomePublication',['create']],
 ['policy','SphereBiomePolicy',['pilot']],
 ['registry','SphereBiomeRegistry',['create','fetchBounded']],
 ['ingestion-worker','SphereBiomeIngestion',['inspectPackage']],
 ['native/providers/fixture-track-meadow','SphereBiomeFixtureTrackMeadow',['configure','validateRecipe']],
 ['bounded-storage.v1','SphereBiomeBoundedStorage',['create','measure']],
 ['native/overview-index','SphereBiomeOverviewIndex',['packVerified','splitVector']],
 ['native/overview-shader','SphereBiomeOverviewShader',['assemble','createProgram','withBound']],
 ['native/boundary-shader','SphereBiomeNativeBoundaryShader',[]],
 ['native/native-surface-program','SphereBiomeNativeSurfaceProgram',['surfaceFragment']],
 ['native/positions-backend','SphereBiomePositionsBackend',['createPositionsBackend']],
 ['native/shared-gpu-backend','SphereBiomeSharedGpuBackend',['create','isOwner']],
 ['native/root-program-binding','SphereBiomeNativeRootProgramBinding',['create','isOwner']],
 ['native/local-transform','SphereBiomeNativeLocalTransform',['projection','rebase']],
 ['native/local-field.v2','SphereBiomeNativeLocalFieldV2',['create','isOwner']],
 ['service-resources.v1','SphereBiomeServiceResources',['create','isOwner']],
 ['main-overview.v2','SphereBiomeMainOverview',['create','isOwner']],
 ['main-local-support.v1','SphereBiomeMainLocalSupport',['create','isOwner']],
 ['main-install.v5','SphereMainInstall',['create']]
].map(([path,name,methods])=>Object.freeze({path,name,methods:Object.freeze(methods)})));
const CORE=Object.freeze([
 {name:'SphereMath',methods:['defaultState','validate']},
 {name:'SphereWorldAddress',methods:['shell','direction']},
 {name:'SphereWorldTopology',methods:[]},
 {name:'SphereApp',methods:['snapshot']}
].map(e=>Object.freeze({...e,methods:Object.freeze(e.methods)})));
function check(entry){
 const api=root[entry.name],missing=!api?entry.name:entry.methods.find(name=>typeof api[name]!=='function');
 if(missing){const error=Error('Main cannot open biome installation: required browser dependency '+entry.name+(missing===entry.name?'':'.'+missing)+' is unavailable.');error.code='MAIN_INSTALL_DEPENDENCY_MISSING';error.phase='browser-startup';error.details={revision:REVISION,namespace:entry.name,member:missing===entry.name?null:missing};throw error;}
}
function assertReady(){for(const entry of [...CORE,...MODULES])check(entry);return Object.freeze({revision:REVISION,modules:MODULES.length,ready:true});}
let pending=null;
function load(baseURL){
 if(pending)return pending;
 pending=(async()=>{
  for(const entry of CORE)check(entry);
  for(const entry of MODULES){
   await new Promise((resolve,reject)=>{const script=root.document.createElement('script');script.src=new URL('biome-service/'+entry.path+'.js',baseURL).href;script.onload=resolve;script.onerror=()=>reject(Error('Could not load '+entry.path));root.document.body.append(script);});
   check(entry);
  }
  return assertReady();
 })();return pending;
}
const api=Object.freeze({REVISION,MODULES,CORE,load,assertReady});root.SphereMainInstallBootstrap=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
