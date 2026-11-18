import {PackHost} from '../../runtime/v1/host.js';
const base=new URL('.',import.meta.url);
window.onpageshow=e=>{if(e.persisted)location.reload();};
try{
 const response=await fetch(new URL('manifest.json',base),{cache:'no-store'});if(!response.ok)throw Error('Industry manifest unavailable');const manifest=await response.json();
 // Shared modules are pinned too; changing Meadow cannot silently change Industry.
 for(const dependency of manifest.dependencies){const url=new URL(dependency.path,base);if(url.origin!==base.origin||!url.pathname.startsWith(new URL('../../../',base).pathname))throw Error('Shared module left Observatory');const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Shared module unavailable');const bytes=await r.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(bytes.byteLength!==dependency.bytes||hash!==dependency.sha256)throw Error('Shared module changed: '+dependency.path);}
 const host=new PackHost(manifest,base);window.SphereIndustryHost=host;await host.start();document.getElementById('packLifecycle').textContent='Facility ready · your place stays in this browser';
}catch(error){const panel=document.getElementById('packLoading');panel.hidden=false;document.getElementById('packLoadingStatus').textContent=error.message;const retry=document.getElementById('packRetry');retry.hidden=false;retry.onclick=()=>location.reload();}
