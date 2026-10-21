import {PackHost} from '../../runtime/v1/host.js';
const base=new URL('.',import.meta.url);
// A restored document has already released its scene resources on pagehide.
window.onpageshow=e=>{if(e.persisted)location.reload();};
try{
 const response=await fetch(new URL('manifest.json',base),{cache:'no-store'});if(!response.ok)throw Error('The meadow pack manifest is unavailable');
 const manifest=await response.json(),host=new PackHost(manifest,base);
 await host.start();
}catch(error){const panel=document.getElementById('packLoading');panel.hidden=false;document.getElementById('packLoadingStatus').textContent=error.message;const retry=document.getElementById('packRetry');retry.hidden=false;retry.onclick=()=>location.reload();}
