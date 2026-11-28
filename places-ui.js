/* Explore presents drafts; only the transaction commits a destination. */
(function(){
'use strict';const A=SphereApp,M=SphereMath,P=SpherePlaces,J=SphereJourney,$=id=>document.getElementById(id),camera=$('camera');
const basics=camera.querySelector('.camera-basics'),coordinates=$('moveCamera').closest('details'),rotation=$('rotationStep').closest('details'),lens=$('projection').closest('details'),walk=$('autoWalk').closest('label');
const archive=document.createElement('details');archive.id='specialistDestinations';archive.innerHTML='<summary>Specialist destinations & staged scenes</summary>';archive.append(...camera.children);camera.append(archive);
const panel=document.createElement('section');panel.id='places';panel.innerHTML=`
 <h3>Explore</h3><p class="micro">Choose a destination. Your current world and conditions travel with you.</p>
 <div id="placeCategories" class="place-categories" aria-label="Place categories"></div>
 <select id="placeCategory" aria-label="Place category" hidden>${P.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
 <label class="field">Destination<select id="placeDestination"></select></label>
 <p id="placeDescription" class="micro"></p>
 <label class="field">Arrival<select id="placeAltitude" aria-describedby="placeAvailability"></select></label>
 <p id="placeAvailability" class="micro"></p><button id="placeWorld" class="quiet" hidden>Open World</button>
 <p id="placeTargetSummary" class="micro"></p>
 <div class="travel-actions"><button id="visitPlace" class="primary">Visit</button><button id="cancelTravel" class="secondary" hidden>Cancel</button><button id="retryTravel" class="secondary" hidden>Retry</button>
 <p id="placeVisitStatus" class="micro" role="status" aria-live="polite">Ready.</p></div>`;
camera.prepend(panel);panel.querySelector('.travel-actions').prepend($('placeTargetSummary'));
const packReceipt=SpherePackLibrary.releaseReceipt();if(packReceipt){const notice=document.createElement('p');notice.id='packReturnNotice';notice.className='micro';notice.textContent=(packReceipt.sharedWorld?(packReceipt.saved===true?'Your shared Meadow and water works are saved.':'The shared scene closed. Your place could not be saved.'):packReceipt.identity.id==='infinite-industry'?'Your water works are saved.':'Your Meadow is saved.')+' Your Observatory viewpoint is restored.';panel.append(notice);const details=document.createElement('details');details.innerHTML='<summary>Pack return details</summary>';const text=document.createElement('pre');text.id='packReleaseEvidence';text.textContent=JSON.stringify(packReceipt,null,2);details.append(text);panel.append(details);}
const exact=document.createElement('details');exact.id='exactPosition';exact.innerHTML='<summary>Exact address, lens & speed</summary><label class="field">Speed control<select id="speedMode"><option value="auto">Automatic · eases near surfaces</option><option value="manual">Manual · use my chosen speed</option></select></label><p class="micro">Atlas latitude and longitude follow your current position. Altitude is in kilometres relative to the inner shell.</p>';
exact.append(basics,...[...coordinates.children].filter(el=>el.tagName!=='SUMMARY'),rotation,lens,walk);camera.append(exact);
const atlasPanel=document.createElement('details');
atlasPanel.id='atlasPlaces';
atlasPanel.innerHTML='<summary>Atlas places</summary><label class="field">Place name<input id="atlasPlaceName" maxlength="70" placeholder="e.g. Freight hall overlook"></label><button id="atlasMarkHere" type="button">Mark this place</button><div id="atlasPlaceList" class="bookmarks"></div><p id="atlasPlaceStatus" class="micro" role="status"></p>';
exact.before(atlasPanel);
atlasPanel.insertAdjacentHTML('beforeend','<button id="pilotTrace" class="secondary" type="button">Record flight or walk</button><p id="pilotTraceStatus" class="micro" role="status">Save camera poses and scene changes for replay.</p>');
$('pilotTrace').onclick=async()=>{
 const button=$('pilotTrace'),status=$('pilotTraceStatus');
 button.disabled=true;
 try{const {toggleTrace}=await import('./pilot-trace.mjs');toggleTrace(button,status);}
 catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
};
atlasPanel.insertAdjacentHTML('beforeend','<label class="check"><input id="freightSurvey" type="checkbox" aria-controls="freightReadout"> Freight survey instrument</label><p id="freightReadout" class="micro" hidden></p>');
$('freightSurvey').onchange=e=>{
  $('freightReadout').hidden=!e.target.checked;
  $('freightReadout').textContent=e.target.checked?'Acquiring ground track.':'';
};
function showAtlasPlaces(){
 const list=$('atlasPlaceList'),lib=window.SphereBiomeLibrary;list.replaceChildren();
 for(const place of lib?.marks()??[]){
  const row=document.createElement('div'),go=document.createElement('button');row.className='bookmark-row';
  go.type='button';go.className='secondary';go.textContent=place.name;go.title=place.label;
  go.onclick=async()=>{
    const status=$('atlasPlaceStatus');go.disabled=true;status.textContent='Returning to '+place.name+'…';
    try{await SphereStageFrame.returnToPlace(place);status.textContent='Returned to '+place.name+'.';}
    catch(e){status.textContent=e.message;}
    finally{go.disabled=false;}
  };
  row.append(go);list.append(row);
 }
}
$('atlasMarkHere').onclick=async()=>{
 const button=$('atlasMarkHere');button.disabled=true;
 try{
  const place=SphereStageFrame.capturePlace(),lib=SphereBiomeLibrary;
  const mark=await lib.saveMark(place,$('atlasPlaceName').value);$('atlasPlaceName').value='';
  $('atlasPlaceStatus').textContent=mark.name+(lib.persistence==='file'?' saved to this world’s Atlas.':' saved in this browser.');
 }catch(e){$('atlasPlaceStatus').textContent=e.message;}finally{button.disabled=false;}
};
for(const event of ['sphere-atlas-marks','sphere-biomes-changed'])window.addEventListener(event,showAtlasPlaces);
atlasPanel.addEventListener('toggle',()=>{if(atlasPanel.open)showAtlasPlaces();});
for(const category of P.categories){const b=document.createElement('button');b.type='button';b.dataset.category=category.id;b.textContent=category.name;b.onclick=()=>{$('placeCategory').value=category.id;populate();};$('placeCategories').append(b);}
function populate(keep=false){const category=$('placeCategory').value,previous=$('placeDestination').value,options=P.catalogue(A.getState()).filter(p=>p.category===category);$('placeDestination').replaceChildren(...options.map(p=>new Option(p.name,p.id)));if(keep&&options.some(p=>p.id===previous))$('placeDestination').value=previous;for(const b of $('placeCategories').children)b.setAttribute('aria-pressed',String(b.dataset.category===category));describe();}
function describe(){const s=A.getState(),id=$('placeDestination').value,entry=P.catalogue(s).find(p=>p.id===id),previous=$('placeAltitude').value;
 $('placeDescription').textContent=entry?.description||'';const choices=P.arrivals(s,id);$('placeAltitude').replaceChildren(...choices.map(a=>new Option(a.label,a.id)));if(choices.some(a=>a.id===previous))$('placeAltitude').value=previous;else if(choices.some(a=>a.id==='ground'))$('placeAltitude').value='ground';availability();}
function availability(){const s=A.getState(),id=$('placeDestination').value,height=$('placeAltitude').value,result=P.availability(s,id,height),entry=P.catalogue(s).find(p=>p.id===id),arrival=P.arrivals(s,id).find(a=>a.id===height);
 $('placeAvailability').textContent=result.reason;$('placeWorld').hidden=result.available;$('visitPlace').disabled=!result.available||(A.busy&&!(window.SphereStageFrame?.current&&window.SphereLoading?.active));$('placeTargetSummary').textContent=entry&&arrival?entry.name+' · '+arrival.label:'';}
$('placeCategory').onchange=()=>populate();$('placeDestination').onchange=describe;$('placeAltitude').onchange=availability;
$('placeWorld').onclick=()=>document.querySelector('[data-tab=scene]').click();
async function visit(){const id=$('placeDestination').value,arrival=$('placeAltitude').value,title=$('placeTargetSummary').textContent;
 if(window.SphereStageFrame?.showMain()===false)return;
 if(A.busy&&window.SphereLoading?.active){$('placeVisitStatus').textContent='Preparing the Sphere view.';await SphereLoading.pending;if(A.busy)return;}
 if(SpherePackLibrary.get(id)){try{SpherePackLibrary.open(id,arrival);}catch(e){$('placeVisitStatus').textContent=e.message;}return;}return J.travel.request({type:'place',id,arrival,title,overrides:id==='watershed'&&arrival!=='ground'?['fov']:[],resolve:(s,signal)=>P.destination(s,id,arrival,undefined,undefined,{signal})});}
// A coordinate or lens change made in Explore applies to the visible Main view.
for(const type of ['input','change','click']){
 exact.addEventListener(type,e=>{
   if(!e.target.closest('input,select,button') || e.target.closest('#speedMode,#speed,#cameraLat,#cameraLon,#cameraAltitude,#moveCamera') || !window.SphereStageFrame?.current)return;
   if(!SphereStageFrame.showMain()){e.preventDefault();e.stopImmediatePropagation();}
 },true);
}
$('visitPlace').onclick=visit;$('cancelTravel').onclick=()=>{J.travel.cancel();$('visitPlace').focus();};$('retryTravel').onclick=()=>J.travel.retry();
function travelStatus({detail:s}){$('cancelTravel').hidden=s.state!=='preparing';$('retryTravel').hidden=!['failed','cancelled'].includes(s.state);$('placeVisitStatus').textContent=s.state==='preparing'?(s.title||'Destination')+' — '+s.phase:s.state==='arrived'?'Arrived at '+J.current().title+'.':s.error||'Ready.';if(s.recoveryError)$('placeVisitStatus').textContent+=' Current view remains held: '+s.recoveryError+'. Retry to recover.';if(s.state==='failed')$('retryTravel').focus({preventScroll:true});if(s.state!=='preparing')availability();}
window.addEventListener('sphere-travel-status',travelStatus);
window.addEventListener('sphere-visible-biome',e=>{
 if(e.detail)$('placeVisitStatus').textContent='Exploring '+e.detail+'. Visit opens the selected destination.';
 else if($('placeVisitStatus').textContent.startsWith('Exploring '))$('placeVisitStatus').textContent='Ready.';
 availability();
});
$('speedMode').onchange=()=>{A.chooseFlightSpeed($('speedMode').value==='auto');};
// The mark is a world address. Its screen projection is disposable.
let pointer=null,hover=null,press=null,picked=null,markedWorld=null;
const aim=document.createElement('div');aim.className='pointer-aim';aim.hidden=true;$('viewport').append(aim);
const marked=document.createElement('p');marked.id='markedTarget';marked.className='micro';marked.setAttribute('role','status');panel.append(marked);
const clearMark=document.createElement('button');clearMark.id='clearMark';clearMark.className='quiet';clearMark.textContent='Clear mark';clearMark.hidden=true;panel.append(clearMark);
function clearPointer(){pointer=null;picked=null;markedWorld=null;aim.hidden=true;marked.textContent='';clearMark.hidden=true;$('seeSurface').title='Unmarked mode: travel along the centre ray.';$('seeSurface').textContent='Go · centre ray';}
clearMark.onclick=clearPointer;
function worldAddress(s){if(picked?.type!=='shade')return picked?.point;const plate=SphereCollection.plates(s).find(p=>p.id===picked.plate);return plate?[plate.right,plate.normal,plate.up].reduce((p,v,i)=>M.add(p,M.mul(v,picked.local[i])),M.mul(plate.center,s.radius)):null;}
function project(){if(!picked)return;const s=A.getState();if(SphereTravelTransaction.dependencies.some(k=>JSON.stringify(s[k])!==JSON.stringify(markedWorld[k]))){clearPointer();return;}
 const point=worldAddress(s);if(!point){clearPointer();return;}const r=$('view').getBoundingClientRect(),v=$('viewport').getBoundingClientRect(),b=M.basis(s.forward,s.up),d=M.sub(point,s.position),z=M.dot(d,b.f),tan=Math.tan(M.radians(s.fov)/2),x=.5+M.dot(d,b.r)/(2*z*tan),y=.5-M.dot(d,b.u)*r.width/(2*z*tan*r.height);
 aim.hidden=z<=0||x<0||x>1||y<0||y>1||s.projection==='panorama';aim.style.left=(r.left-v.left+x*r.width)+'px';aim.style.top=(r.top-v.top+y*r.height)+'px';marked.textContent=picked.title+' · marked · '+M.length(d).toLocaleString(undefined,{maximumFractionDigits:3})+' km'+(aim.hidden?' · off screen':'');}
function screenPoint(e){const r=$('view').getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
function pointerRay(s,point=pointer||[.5,.5]){const r=$('view').getBoundingClientRect();return M.ray(point[0]*2-1,1-point[1]*2,r.width/r.height,s.fov,M.basis(s.forward,s.up),s.projection==='panorama');}
function mark(point){const s=A.getState(),r=$('view').getBoundingClientRect(),target=SpherePointer.pick(s,pointerRay(s,point),{aspect:r.width/r.height});if(!target){A.toast('Open space. Choose a visible surface or Wound.');return null;}picked=target;pointer=point;markedWorld=s;clearMark.hidden=false;$('seeSurface').title='Travel to '+picked.title+'. The marked address survives looking and resizing.';$('seeSurface').textContent='Go · marked target';project();return picked;}
function go(){if(A.busy)return;const s=A.getState(),r=$('view').getBoundingClientRect(),target=structuredClone(picked||SpherePointer.pick(s,pointerRay(s,[.5,.5]),{aspect:r.width/r.height}));if(!target){A.toast('Point at a surface or Wound to choose an arrival.');return;}return J.travel.request({type:'pointer',title:target.title,resolve:current=>{const arrival=SpherePointer.arrive(current,target);if(!arrival)throw Error('The marked destination is unavailable.');return arrival.state;}});}
$('view').addEventListener('pointermove',e=>{if(!e.buttons)hover=screenPoint(e);});$('view').addEventListener('pointerleave',()=>hover=null);
$('view').addEventListener('pointerdown',e=>{if(e.button===0&&!SphereEnhancements.measuring&&!A.busy)press=[e.clientX,e.clientY];});
$('view').addEventListener('pointerup',e=>{if(!press)return;const click=Math.hypot(e.clientX-press[0],e.clientY-press[1])<4;press=null;if(click&&!SphereEnhancements.measuring&&!A.busy)mark(screenPoint(e));});$('view').addEventListener('pointercancel',()=>press=null);
window.addEventListener('sphere-pose-updated',project);window.addEventListener('sphere-telemetry',project);window.addEventListener('sphere-measure-mode',clearPointer);window.addEventListener('sphere-travel-committed',clearPointer);new ResizeObserver(project).observe($('view'));
window.addEventListener('keydown',e=>{if(e.code!=='KeyG'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||A.busy||$('guide').open||SphereEnhancements.measuring||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;e.preventDefault();if(!picked&&hover&&!mark(hover))return;go();});
SphereSurface.visit=go;SphereSurface.resetReturn=()=>{};$('seeSurface').onclick=go;clearPointer();
const surface=document.querySelector('[data-destination=surface]');surface.onclick=go;
const back=$('browseBiomes');back.textContent='Return';back.onclick=()=>J.back();
function history(){back.disabled=!J.count;back.title=J.previousTitle?'Return to '+J.previousTitle+' · restores saved world and time':'Your journey starts here';}window.addEventListener('sphere-history-changed',history);history();
function sync(){$('speedMode').value=A.getState().autoSpeed===false?'manual':'auto';$('speed').disabled=A.getState().autoSpeed!==false;availability();project();}
window.addEventListener('sphere-state-synced',sync);window.addEventListener('sphere-view-ready',sync);populate();sync();
window.SpherePlaceBrowser={visit,go,mark,pointerRay,clearPointer,get picked(){return picked;},selectCategory(id){$('placeCategory').value=id;populate();}};
})();
