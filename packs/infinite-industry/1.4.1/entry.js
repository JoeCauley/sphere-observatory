import {PackHost} from '../../runtime/v1/host.js';
const base=new URL('.',import.meta.url);
window.onpageshow=e=>{if(e.persisted)location.reload();};
try{
 const response=await fetch(new URL('manifest.json',base),{cache:'no-store'});if(!response.ok)throw Error('Industry manifest unavailable');const manifest=await response.json();
 // Shared modules are pinned too; changing Meadow cannot silently change Industry.
 await Promise.all(manifest.dependencies.map(async dependency=>{
  const url=new URL(dependency.path,base);
  if(url.origin!==base.origin||!url.pathname.startsWith(new URL('../../../',base).pathname))throw Error('Shared module left Observatory');
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Shared module unavailable');
  const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==dependency.bytes||hash!==dependency.sha256)throw Error('Shared module changed: '+dependency.path);
 }));
 const frame=window.frameElement,store=frame?.dataset.worldKey ? parent.SphereBiomeLibrary.saveStorage(frame.dataset.worldKey) : localStorage;
 const storage=frame?.surfaceEntry?{getItem:k=>store.getItem(k),setItem:(k,v)=>{if(frame.surfaceEntry.active)store.setItem(k,v);}}:store;
 const host=new PackHost(manifest,base,{storage});window.SphereIndustryHost=host;await host.start();document.getElementById('packLifecycle').textContent='Facility ready · your place stays in this browser';
}catch(error){const panel=document.getElementById('packLoading');panel.hidden=false;document.getElementById('packLoadingStatus').textContent=error.message;const retry=document.getElementById('packRetry');retry.hidden=false;retry.onclick=()=>location.reload();}
