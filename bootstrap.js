/* Let the wait screen paint before compiling the renderer. Scripts remain classic
 * and ordered so their globals and document.currentScript asset paths are stable. */
(async()=>{
const scriptBase=new URL('.',document.currentScript.src);
const scripts=['math','collection','biomes','hero-textures','world-palette','world','watershed-network','field-sites','watershed-province','edge-stream','edge-streaming','inspection-camera','wreckage','flight','surface-walk','travel-control','places','survey','shaders','collection-shader','biome-shader','world-shader','asset-plan','world-textures','wound-textures','surface-lighting','silhouette-aa','preview-light','geometry-renderer','local-shadows','volume','atmosphere','panorama','renderer','preview-quality','app','navigation-history','enhancements','collection-ui','biome-ui','ui-layout','surface-arrival','pointer-navigation','evolution-ui','watershed-ui','flight-console','places-ui','session-state','loading-screen'];
const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
try{
 await paint();
 for(const name of scripts){
  if(name==='app'){document.getElementById('loadingStatus').textContent='Preparing the renderer. The first opening can take a little longer.';await paint();}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(name+'.js',scriptBase).href;script.onload=resolve;script.onerror=()=>reject(Error('The Observatory could not load '+name+'.js. Check that the local server is running.'));document.body.append(script);});
 }
 if(!window.SphereApp||!window.SphereLoading)throw Error(document.getElementById('error').textContent||'The renderer did not finish opening.');
 document.getElementById('loadingStatus').textContent='Preparing your viewpoint.';
 await window.SphereWatershedJourney?.openLink();
 await window.SphereLoading.start();
}catch(error){
 document.getElementById('loadingTitle').textContent='Opening interrupted';document.getElementById('loadingStatus').textContent=error.message;document.getElementById('loadingProgress').hidden=true;document.getElementById('loadingActions').hidden=false;document.getElementById('loadingFallback').hidden=true;document.getElementById('loadingRetry').onclick=()=>location.reload();
}

})();
