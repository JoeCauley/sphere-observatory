/* Let the wait screen paint before compiling the renderer. Scripts remain classic
 * and ordered so their globals and document.currentScript asset paths are stable. */
(async()=>{
const scriptBase=new URL('.',document.currentScript.src);
const scripts=['world-address','world-topology','meadow-wind','math','vegetation-revisions','vegetation-memory','vegetation-service','vegetation-selection','vegetation-gpu','collection','biomes','hero-textures','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','packs/violet-labyrinth/1.0.0/forest','meadow-ecology','edge-stream','shade-edges','ground-chunks','meadow-support','edge-streaming','inspection-camera','wreckage','flight','surface-walk','travel-control','places','survey','shaders','shader-sections','collection-shader','biome-shader','world-shader','neighbourhood-shader','asset-plan','world-textures','wound-textures','surface-lighting','silhouette-aa','station-shader-performance','habitat-landscape','violet-landscape','preview-light','meadow-canopy','geometry-renderer','instanced-environment','grass-stream','vegetation-worker-pool','meadow-blocks','meadow-provider','vegetation-lifecycle','meadow-field','meadow-benchmark','local-shadows','volume','atmosphere','panorama','renderer','preview-quality','simulation-timing','app','travel-transaction','location-identity','navigation-history','enhancements','collection-ui','biome-ui','ui-layout','surface-arrival','pointer-navigation','evolution-ui','watershed-ui','flight-console','places-ui','integration-ui','session-state','loading-screen'];
scripts.splice(scripts.indexOf('places'),0,'pack-library');
// The original biome service is opt-in (add ?service to the address). Installs are
// handled by biome-library.js, which loads from index.html.
if(new URLSearchParams(location.search).has('service'))scripts.push('biome-service/main-install-bootstrap.v12','main-install-ui');
const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
try{
 window.SphereBuild={version:'1.8.0',status:'unverified-local',release:false};
 const build = fetch(new URL('build-info.json',scriptBase))
  .then(async response=>{if(response.ok)window.SphereBuild=await response.json();}).catch(()=>{});
 // Ordered classic scripts may download together. Only app construction needs the linked program.
 function loadGroup(names){
  return Promise.all(names.map(name=>new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.async=false;script.src=new URL(name+'.js',scriptBase).href;
   script.onload=resolve;script.onerror=()=>reject(Error('Could not load '+name+'.js. Check the local server.'));
   document.body.append(script);
  })));
 }
 await paint();
 const split=scripts.indexOf('app');
 await loadGroup(scripts.slice(0,split));
 document.getElementById('loadingStatus').textContent='Preparing the landscape renderer.';
 await paint();
 const [program]=await Promise.all([SphereRenderer.prepareMain(document.getElementById('view')),build]);
 window.SpherePreparedProgram=program;
 await loadGroup(scripts.slice(split));
 if(!window.SphereApp||!window.SphereLoading)throw Error(document.getElementById('error').textContent||'The renderer did not finish opening.');
 document.getElementById('loadingStatus').textContent='Preparing your viewpoint.';
 const bearing=new URLSearchParams(location.search).get('freight');
 const freightTrip=bearing==='along' || bearing==='across';
 if(freightTrip){
  document.getElementById('loadingStatus').textContent='Preparing the clear-day approach to the freight quay.';
  const {freightDeparture,prepareClearFlight}=await import(new URL('studies/border-crossing/clear-day-flight.mjs',scriptBase));
  await prepareClearFlight(freightDeparture(bearing));
 }else await window.SphereWatershedJourney?.openLink();
 if(window.SphereApp.renderer.modernUniforms?.uInstalledBiomes)await window.SphereBiomeSurface?.ready;
 await window.SphereLoading.start();
 if(freightTrip){window.SphereApp.setPlaying(true);document.getElementById('viewport').focus();}
}catch(error){
 document.getElementById('controlStatus').textContent='Opening interrupted. The view has details and a Retry button.';document.getElementById('loadingTitle').textContent='Opening interrupted';document.getElementById('loadingStatus').textContent=error.message;document.getElementById('loadingProgress').hidden=true;document.getElementById('loadingActions').hidden=false;document.getElementById('loadingFallback').hidden=true;document.getElementById('loadingRetry').onclick=()=>location.reload();
}

})();
