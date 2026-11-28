/* Let the wait screen paint before compiling the renderer. Scripts remain classic
 * and ordered so their globals and document.currentScript asset paths are stable. */
(async()=>{
const scriptBase=new URL('.',document.currentScript.src);
const overlay=document.getElementById('sceneLoading'),bar=document.getElementById('loadingProgress'),status=document.getElementById('loadingStatus');
function openingStep(done,text){bar.value=done;bar.setAttribute('aria-valuetext',done+' of '+bar.max+' steps complete');status.textContent=text;}
const scripts=['world-address','world-topology','meadow-wind','math','vegetation-revisions','vegetation-memory','vegetation-service','vegetation-selection','vegetation-gpu','collection','biomes','hero-textures','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','packs/super-jungle/1.0.0/stand-geometry','packs/violet-labyrinth/1.0.0/forest','meadow-ecology','edge-stream','shade-edges','ground-chunks','meadow-support','edge-streaming','inspection-camera','wreckage','flight','surface-walk','travel-control','places','survey','shaders','shader-sections','collection-shader','biome-shader','world-shader','neighbourhood-shader','asset-plan','world-textures','wound-textures','surface-lighting','silhouette-aa','station-shader-performance','habitat-landscape','violet-landscape','preview-light','meadow-canopy','geometry-renderer','instanced-environment','grass-stream','vegetation-worker-pool','meadow-blocks','meadow-provider','vegetation-lifecycle','meadow-field','meadow-benchmark','local-shadows','volume','atmosphere','panorama','renderer','preview-quality','simulation-timing','app','travel-transaction','location-identity','navigation-history','enhancements','collection-ui','biome-ui','ui-layout','surface-arrival','pointer-navigation','evolution-ui','watershed-ui','flight-console','places-ui','integration-ui','session-state','loading-screen'];
scripts.splice(scripts.indexOf('places'),0,'pack-library');
scripts.splice(scripts.indexOf('app'),0,'industry-production');
// The original biome service is opt-in (add ?service to the address). Installs are
// handled by biome-library.js, which loads from index.html.
if(new URLSearchParams(location.search).has('service'))scripts.push('biome-service/main-install-bootstrap.v12','main-install-ui');
const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
try{
 const query=new URLSearchParams(location.search),borderRoute=query.get('border'),bearing=query.get('freight');
 const roofTrip=['beyond','junction'].includes(borderRoute),wallTrip=borderRoute==='wall'||roofTrip,forestWalk=borderRoute==='forest',doorTrip=borderRoute==='doors'||forestWalk;
 const freightTrip=bearing==='along'||bearing==='across',crossing=query.get('crossing');
 const millTrip=query.get('mill')==='R1',apartmentTrip=query.get('apartment')==='1A';
 bar.max=roofTrip||doorTrip||crossing||millTrip||apartmentTrip?5:4;
 window.SphereBuild={version:'1.8.9',status:'unverified-local',release:false};
 fetch(new URL('build-info.json',scriptBase))
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
 openingStep(1,'Preparing the landscape renderer.');
 await paint();
 window.SpherePreparedProgram=await SphereRenderer.prepareMain(document.getElementById('view'));
 openingStep(2,'Connecting the flight controls.');
 await loadGroup(scripts.slice(split));
 if(!window.SphereApp||!window.SphereLoading)throw Error(document.getElementById('error').textContent||'The renderer did not finish opening.');
 openingStep(3,'Preparing your viewpoint.');
 if(query.has('habitat-engine')){
  window.SphereApp.setBusy(true);window.sphereHabitatEngineReady=true;return;
 }
 let enterServiceApproach;
 if(apartmentTrip){
  openingStep(3,'Finding 27 Orchard Street.');
  const {prepareApartmentVisit}=await import(new URL('studies/new-york-first-apartment.mjs',scriptBase));
  enterServiceApproach=await prepareApartmentVisit();
 }else if(millTrip){
  openingStep(3,'Locating the R1 forming bay.');
  const {prepareMillVisit}=await import(new URL('studies/industry-rolling-mill.mjs',scriptBase));
  enterServiceApproach=await prepareMillVisit();
 }else if(crossing){
  openingStep(3,'Finding the surveyed station approaches.');
  const {prepareDistrictWalk}=await import(new URL('studies/border-crossing/district-walk.mjs',scriptBase));
  enterServiceApproach=await prepareDistrictWalk(crossing);
 }else if(freightTrip||wallTrip||doorTrip){
  document.getElementById('loadingStatus').textContent=forestWalk?'Finding the forked Meadow tree at Bay 0.':doorTrip?'Finding the Meadow service door.':wallTrip?'Preparing a clear-day descent between Border stations.':'Preparing the clear-day approach to the freight quay.';
  const {freightDeparture,wallDeparture,prepareClearFlight}=await import(new URL('studies/border-crossing/clear-day-flight.mjs',scriptBase));
  const trip=await prepareClearFlight(doorTrip?{...wallDeparture(),serviceDoor:true,forestWalk}:wallTrip?wallDeparture():freightDeparture(bearing));
  enterServiceApproach=trip.enterServiceApproach;
  if(roofTrip)enterServiceApproach=async()=>{
    const {openWallRoute}=await import(new URL('studies/border-crossing/wall-route.mjs',scriptBase));
    await openWallRoute(borderRoute);
  };
 }else await window.SphereWatershedJourney?.openLink();
 if(window.SphereApp.renderer.modernUniforms?.uInstalledBiomes)await window.SphereBiomeSurface?.ready;
 const prepared=await window.SphereLoading.start();
 // A failed asset can be retried, or bypassed using the existing simpler surface action.
 if(!prepared)await new Promise(resolve=>window.addEventListener('sphere-view-ready',resolve,{once:true}));
 if(enterServiceApproach){
   openingStep(4,apartmentTrip?'Opening the Orchard Street sidewalk.':millTrip?'Opening the rolling mill.':roofTrip?'Opening the Border flight deck.':'Opening the service door.');
   // The destination draws its own first frame. Keep the hidden regional camera
   // from starting a second landscape compilation while the station is opening.
   SphereApp.setBusy(true,{keepKeys:true});
   try{await paint();await enterServiceApproach();}finally{SphereApp.setBusy(false,{keepKeys:true});}
 }else if(freightTrip||wallTrip){window.SphereApp.setPlaying(true);document.getElementById('viewport').focus();}
 openingStep(bar.max,'Ready to explore.');
 overlay.hidden=true;overlay.setAttribute('aria-busy','false');delete overlay.dataset.opening;
 bar.setAttribute('aria-label','Preparing this view');bar.removeAttribute('aria-valuetext');
}catch(error){
 overlay.hidden=false;overlay.setAttribute('aria-busy','false');
 document.getElementById('controlStatus').textContent='Opening interrupted. The view has details and a Retry button.';document.getElementById('loadingTitle').textContent='Opening interrupted';document.getElementById('loadingStatus').textContent=error.message;document.getElementById('loadingProgress').hidden=true;document.getElementById('loadingActions').hidden=false;document.getElementById('loadingFallback').hidden=true;document.getElementById('loadingRetry').onclick=()=>location.reload();
}

})();
