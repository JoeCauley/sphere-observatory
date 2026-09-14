/* View preparation owns a temporary frame hold, never the user's play/pause flag. */
(function(){
'use strict';const A=SphereApp,R=A.renderer,T=SphereAssets,$=id=>document.getElementById(id),overlay=$('sceneLoading');
let started=false,active=false,ticket=0,controller=null,promise=null,lastError=null,queued=false,priorFocus=null;
const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const aspect=()=>{const r=$('viewport').getBoundingClientRect();return r.width/Math.max(1,r.height);};
function needs(s){const p=T.plan(s,aspect());return (s.walkMode&&window.SphereGround?.enabled(s)&&!SphereGround.available(s))||T.status(R,p).missing.length>0||(p.province&&!SphereWatershed.ready(s))||!T.pipelineReady(R,s,p);}
function show(){if(overlay.hidden)priorFocus=document.activeElement;overlay.hidden=false;overlay.setAttribute('aria-busy','true');$('loadingTitle').textContent=started?'Preparing your view':'Opening the Observatory';$('loadingProgress').hidden=false;$('loadingProgress').removeAttribute('value');$('loadingActions').hidden=true;}
function progress({phase,ready,total}){$('loadingStatus').textContent=phase+(total?' · '+ready+' of '+total+' ready':'');if(total){$('loadingProgress').max=total;$('loadingProgress').value=ready;}else $('loadingProgress').removeAttribute('value');}
async function ensureCurrent({initial=false,force=false}={}){
 if(!started&&!initial)return;if(A.busy&&!active&&!initial)return;if(!force&&!initial&&!needs(A.getState()))return;
 controller?.abort();controller=new AbortController();const signal=controller.signal,id=++ticket;active=true;lastError=null;A.setBusy(true,{keepKeys:true});show();
 promise=(async()=>{try{
  await paint();const s=A.getState(),ratio=aspect(),plan=await R.prepare(s,{aspect:ratio,signal,onProgress:data=>{if(id===ticket)progress(data);}});
  if(signal.aborted||id!==ticket)return;progress({phase:'Lighting the view'});await paint();
  // All chosen images are uploaded. Reveal their settled appearance together.
  for(const key of ['biomes','heroes','woundTextures'])for(const layer of plan[key])if(R[key]?.loadedAt)R[key].loadedAt[layer]=Math.min(R[key].loadedAt[layer],performance.now()-1000);
  const rect=$('viewport').getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.5)*s.quality,factor=Math.min(scale,Math.sqrt(1920*1080/Math.max(1,rect.width*rect.height)));
  R.draw(s,Math.max(1,Math.floor(rect.width*factor)),Math.max(1,Math.floor(rect.height*factor)));
  await paint();if(signal.aborted||id!==ticket)return;
  started=true;active=false;overlay.hidden=true;overlay.setAttribute('aria-busy','false');A.setBusy(false,{keepKeys:true});A.draw();
  if(overlay.contains(document.activeElement))priorFocus?.isConnected?priorFocus.focus({preventScroll:true}):$('viewport').focus({preventScroll:true});window.dispatchEvent(new Event('sphere-view-ready'));
 }catch(error){if(signal.aborted||id!==ticket||error.name==='AbortError')return;lastError=error;$('loadingTitle').textContent='Your view needs a moment';$('loadingStatus').textContent=error.message;$('loadingProgress').hidden=true;$('loadingActions').hidden=false;$('loadingFallback').hidden=!error.artwork;overlay.setAttribute('aria-busy','false');$('loadingRetry').focus({preventScroll:true});}
 })();return promise;
}
function schedule(){if(queued||!started)return;queued=true;queueMicrotask(()=>{queued=false;if(active||!A.busy)ensureCurrent({force:active});});}
$('loadingRetry').onclick=()=>{T.retry(R,T.plan(A.getState(),aspect()));ensureCurrent({initial:!started,force:true});};
$('loadingFallback').onclick=()=>{const s=A.getState();s.textureDetail=false;A.setState(s);ensureCurrent({initial:!started,force:true});};
window.addEventListener('sphere-state-synced',schedule);
// Navigation and play controls cannot receive keystrokes through the wait screen.
window.addEventListener('keydown',event=>{if(overlay.hidden)return;if(event.key==='Tab'){const buttons=[...overlay.querySelectorAll('button')].filter(b=>!b.hidden&&!b.parentElement.hidden);event.preventDefault();if(buttons.length){const index=buttons.indexOf(document.activeElement),next=(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;buttons[next].focus();}return;}if(!overlay.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
window.SphereLoading={start:()=>ensureCurrent({initial:true}),needs,ensureCurrent,get active(){return active;},get ready(){return started&&!active;},get error(){return lastError?.message||null;},get pending(){return promise;}};
A.assumptions.assets='Image maps are selected from the current viewing frustum and their distance bands, uploaded before revealing a new view, and reused from cache. Distant views use the numeric world palette. Texture arrays reserve bounded GPU capacity on first use; loading is selective by image, not a GPU paging system. A failed image can be retried or bypassed with the simpler surface.';
})();
