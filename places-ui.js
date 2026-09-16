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
const exact=document.createElement('details');exact.id='exactPosition';exact.innerHTML='<summary>Exact address, lens & speed</summary><label class="field">Speed control<select id="speedMode"><option value="auto">Automatic · eases near surfaces</option><option value="manual">Manual · use my chosen speed</option></select></label><p class="micro">Latitude/longitude in degrees; altitude in kilometres above the shell. Shade marks retain kilometres relative to their moving parent.</p>';
exact.append(basics,...[...coordinates.children].filter(el=>el.tagName!=='SUMMARY'),rotation,lens,walk);camera.append(exact);
for(const category of P.categories){const b=document.createElement('button');b.type='button';b.dataset.category=category.id;b.textContent=category.name;b.onclick=()=>{$('placeCategory').value=category.id;populate();};$('placeCategories').append(b);}
function populate(keep=false){const category=$('placeCategory').value,previous=$('placeDestination').value,options=P.catalogue(A.getState()).filter(p=>p.category===category);$('placeDestination').replaceChildren(...options.map(p=>new Option(p.name,p.id)));if(keep&&options.some(p=>p.id===previous))$('placeDestination').value=previous;for(const b of $('placeCategories').children)b.setAttribute('aria-pressed',String(b.dataset.category===category));describe();}
function describe(){const s=A.getState(),id=$('placeDestination').value,entry=P.catalogue(s).find(p=>p.id===id),previous=$('placeAltitude').value;
 $('placeDescription').textContent=entry?.description||'';const choices=P.arrivals(s,id);$('placeAltitude').replaceChildren(...choices.map(a=>new Option(a.label,a.id)));if(choices.some(a=>a.id===previous))$('placeAltitude').value=previous;else if(choices.some(a=>a.id==='ground'))$('placeAltitude').value='ground';availability();}
function availability(){const s=A.getState(),id=$('placeDestination').value,height=$('placeAltitude').value,result=P.availability(s,id,height),entry=P.catalogue(s).find(p=>p.id===id),arrival=P.arrivals(s,id).find(a=>a.id===height);
 $('placeAvailability').textContent=result.reason;$('placeWorld').hidden=result.available;$('visitPlace').disabled=!result.available||A.busy;$('placeTargetSummary').textContent=entry&&arrival?entry.name+' · '+arrival.label:'';}
$('placeCategory').onchange=()=>populate();$('placeDestination').onchange=describe;$('placeAltitude').onchange=availability;
$('placeWorld').onclick=()=>document.querySelector('[data-tab=scene]').click();
function visit(){const id=$('placeDestination').value,arrival=$('placeAltitude').value,title=$('placeTargetSummary').textContent;return J.travel.request({type:'place',id,arrival,title,overrides:id==='watershed'&&arrival!=='ground'?['fov']:[],resolve:(s,signal)=>P.destination(s,id,arrival,undefined,undefined,{signal})});}
$('visitPlace').onclick=visit;$('cancelTravel').onclick=()=>{J.travel.cancel();$('visitPlace').focus();};$('retryTravel').onclick=()=>J.travel.retry();
function travelStatus({detail:s}){$('cancelTravel').hidden=s.state!=='preparing';$('retryTravel').hidden=!['failed','cancelled'].includes(s.state);$('placeVisitStatus').textContent=s.state==='preparing'?(s.title||'Destination')+' — '+s.phase:s.state==='arrived'?'Arrived at '+J.current().title+'.':s.error||'Ready.';if(s.recoveryError)$('placeVisitStatus').textContent+=' Current view remains held: '+s.recoveryError+'. Retry to recover.';if(s.state==='failed')$('retryTravel').focus({preventScroll:true});availability();}
window.addEventListener('sphere-travel-status',travelStatus);
$('speedMode').onchange=()=>{const s=A.getState();s.autoSpeed=$('speedMode').value==='auto';SphereTravel.reset();A.setState(s);};
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
