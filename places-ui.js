/* Explore is a catalogue, a set of arrival choices, and precise travel controls. */
(function(){
'use strict';const A=SphereApp,M=SphereMath,P=SpherePlaces,J=SphereJourney,$=id=>document.getElementById(id),camera=$('camera');
const basics=camera.querySelector('.camera-basics'),coordinates=$('moveCamera').closest('details'),rotation=$('rotationStep').closest('details'),lens=$('projection').closest('details'),walk=$('autoWalk').closest('label');
// Old controls keep their import/deep-link handlers, but no longer compete in
// the Explore interface. Their supported destinations all live in the catalogue.
const archive=document.createElement('div');archive.hidden=true;archive.id='retiredExploreControls';archive.append(...camera.children);camera.append(archive);
const panel=document.createElement('details');panel.id='places';panel.open=true;panel.innerHTML=`
 <summary>Places</summary>
 <p class="micro places-intro">Choose a place, an arrival height and the conditions for your visit.</p>
 <div id="placeCategories" class="place-categories" aria-label="Place categories"></div>
 <select id="placeCategory" aria-label="Saved place category" hidden>${P.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
 <label class="field">Place<select id="placeDestination"></select></label>
 <p id="placeDescription" class="place-description"></p>
 <fieldset class="arrival-choices"><legend>Arrive at</legend>
  <button type="button" data-arrival="ground"><span>Ground level</span><small id="groundArrivalNote">On foot</small></button>
  <button type="button" data-arrival="clouds"><span>Beneath the Clouds</span><small id="cloudArrivalNote"></small></button>
  <button type="button" data-arrival="atmosphere"><span>Atmosphere</span><small>256,267 km · the cloud tapestry</small></button>
 </fieldset>
 <select id="placeAltitude" aria-label="Saved arrival height" hidden><option value="ground">Ground level</option><option value="clouds">Beneath the Clouds</option><option value="atmosphere">Atmosphere</option></select>
 <div class="place-conditions">
  <fieldset><legend>Scene</legend>${[['first-light','First Light'],['darkness','Darkness Arrives'],['day','Day'],['dark','Dark']].map(([id,name])=>`<label class="check"><input type="checkbox" name="placeScene" value="${id}" ${id==='day'?'checked':''}>${name}</label>`).join('')}</fieldset>
  <fieldset><legend>Weather</legend>${[['clear','Clear'],['mixed','Mixed'],['cover','Cover'],['precipitation','Precipitation'],['storm','Storm']].map(([id,name])=>`<label class="check"><input type="checkbox" name="placeWeather" value="${id}" ${id==='mixed'?'checked':''}>${name}</label>`).join('')}</fieldset>
 </div>
 <p class="micro conditions-note">One scene and one weather choice. Lighting studies keep your clock and play status.</p>
 <button id="visitPlace" class="primary">Visit Place</button>
 <p id="placeVisitStatus" class="micro" role="status"></p>`;
camera.append(panel);
const exact=document.createElement('details');exact.id='exactPosition';exact.innerHTML='<summary>Go to Exact Position</summary><label class="field">Speed control<select id="speedMode"><option value="auto">Automatic · eases near surfaces</option><option value="manual">Manual · use my chosen speed</option></select></label>';
exact.append(basics,...[...coordinates.children].filter(el=>el.tagName!=='SUMMARY'),rotation,lens,walk);
const help=document.createElement('p');help.className='micro';help.textContent='W A S D move · E climbs · Q descends · Space + E lifts off · Space jumps on foot and controls play in flight. Scroll selects manual speed. Automatic travel eases near ground, Shades and structures.';exact.append(help);camera.append(exact);
const style=document.createElement('style');style.textContent=`
 #camera > #retiredExploreControls[hidden]{display:none}#places{padding-top:8px}#places summary,#exactPosition summary{font-size:13px}
 .place-categories{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0 20px}.place-family{flex-basis:100%;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#8fa2a3;margin-top:8px}
 .place-categories button{width:auto;padding:8px 10px;font-size:11px;background:#202d33;border:1px solid #3a4b50;border-radius:3px;color:#d0d9d7}
 .place-categories button[aria-pressed=true],.arrival-choices button[aria-pressed=true]{border-color:#c5a679;background:#a1885929;color:#efdbb8}
 .place-description{font-size:12px;line-height:1.7;color:#b6c7c7;min-height:58px;margin:10px 0 19px}
 #places fieldset{border:0;padding:0;margin:0}#places legend{font-size:10px;color:#a5b8b7;letter-spacing:.7px;margin-bottom:9px}
 .arrival-choices{display:grid;gap:6px}.arrival-choices button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:5px;width:100%;padding:11px 12px;background:#19262d;border:1px solid #34474c;border-radius:3px;font-size:12px;color:#c6d3d1}.arrival-choices small{font-size:10px;color:#8fa5a7;font-weight:400}.arrival-choices button:disabled{opacity:.4}
 .place-conditions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0 10px}.place-conditions .check{font-size:11px;display:flex;align-items:center;gap:7px;line-height:1.4;margin:0 0 12px}.place-conditions input{margin:0;accent-color:#d1b17e;width:13px;height:13px;flex-shrink:0}
 #visitPlace{width:100%;padding:13px;background:#c5a679;color:#132026;font-weight:600;border:1px solid #dfc295;border-radius:3px}#visitPlace:disabled{opacity:.55}.conditions-note{line-height:1.5}
 #exactPosition .camera-basics{margin-top:15px}.pointer-aim{position:absolute;width:14px;height:14px;border:1px solid #e1c38bcc;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:3;box-shadow:0 0 6px #0008}.pointer-aim[hidden]{display:none}
 #seeSurface{white-space:nowrap}#browseBiomes:disabled{opacity:.38}#placeCategory[hidden],#placeAltitude[hidden]{display:none}
 `;document.head.append(style);
let category='biomes',chosenScene=A.getState().placeScene,chosenWeather=A.getState().placeWeather,token=0;
for(const family of [...new Set(P.categories.map(c=>c.family))]){const label=document.createElement('span');label.className='place-family';label.textContent=family;$('placeCategories').append(label);for(const c of P.categories.filter(c=>c.family===family)){const b=document.createElement('button');b.textContent=c.name;b.dataset.category=c.id;b.onclick=()=>{$('placeCategory').value=c.id;$('placeCategory').dispatchEvent(new Event('change',{bubbles:true}));};$('placeCategories').append(b);}}
function populate(keep=false){category=$('placeCategory').value;const previous=$('placeDestination').value,options=P.catalogue(A.getState()).filter(p=>p.category===category);$('placeDestination').replaceChildren(...options.map(p=>new Option(p.name,p.id)));if(keep&&options.some(p=>p.id===previous))$('placeDestination').value=previous;document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));describe();}
function describe(){const entry=P.catalogue(A.getState()).find(p=>p.id===$('placeDestination').value);if(!entry)return;$('placeDescription').textContent=entry.description;
 $('groundArrivalNote').textContent=entry.walk?'On foot · 1.7 m eye height':category==='shades'?'35 m above the service skin · close flight':'Inside the nearby spill · free flight';
 $('cloudArrivalNote').textContent=category==='shades'?'700 m above the service skin':Math.round(P.cloudAltitude(entry.biome)*1000).toLocaleString()+' m · below the cloud base';
 for(const b of panel.querySelectorAll('[data-arrival]')){b.disabled=category==='wounds'&&b.dataset.arrival!=='ground';if(b.disabled&&$('placeAltitude').value===b.dataset.arrival)$('placeAltitude').value='ground';}
 arrival();$('placeVisitStatus').textContent='';
}
function arrival(){for(const b of panel.querySelectorAll('[data-arrival]'))b.setAttribute('aria-pressed',String(b.dataset.arrival===$('placeAltitude').value));}
$('placeCategory').onchange=()=>populate();$('placeDestination').onchange=describe;$('placeAltitude').onchange=arrival;
for(const b of panel.querySelectorAll('[data-arrival]'))b.onclick=()=>{$('placeAltitude').value=b.dataset.arrival;$('placeAltitude').dispatchEvent(new Event('change',{bubbles:true}));};
for(const name of ['placeScene','placeWeather'])for(const input of panel.querySelectorAll(`[name=${name}]`))input.onchange=()=>{for(const other of panel.querySelectorAll(`[name=${name}]`))other.checked=other===input;if(name==='placeScene')chosenScene=input.value;else chosenWeather=input.value;};
async function visit(){const request=++token,initial=A.getState(),id=$('placeDestination').value,height=$('placeAltitude').value,entry=P.catalogue(initial).find(p=>p.id===id);$('visitPlace').disabled=true;$('placeVisitStatus').textContent='Preparing your arrival…';
 try{const next=await P.destination(initial,id,height,chosenScene,chosenWeather),current=A.getState();if(request!==token)return;
  if(['position','forward','up'].some(k=>JSON.stringify(initial[k])!==JSON.stringify(current[k]))||initial.radius!==current.radius||initial.era!==current.era){$('placeVisitStatus').textContent='Arrival cancelled because the view changed.';return;}
  next.playing=current.playing;next.time=current.time;J.visit(next,entry.name+(next.walkMode?' · on foot':height==='atmosphere'?' · atmosphere':''));$('placeVisitStatus').textContent=next.walkMode?'Space + E to lift off.':next.shadeAttachment!==null?'Following the moving Shade.':'You have arrived.';
 }catch(e){$('placeVisitStatus').textContent=e.message;A.toast(e.message);}finally{if(request===token)$('visitPlace').disabled=false;}}
$('visitPlace').onclick=visit;
$('speedMode').onchange=()=>{const s=A.getState();s.autoSpeed=$('speedMode').value==='auto';SphereTravel.reset();A.setState(s);};
// Marking is explicit: crossing the canvas on the way to a button cannot move it.
let pointer=null,hover=null,press=null,picked=null;const aim=document.createElement('div');aim.className='pointer-aim';aim.hidden=true;$('viewport').append(aim);
function clearPointer(){pointer=null;picked=null;aim.hidden=true;}
function screenPoint(e){const r=$('view').getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
$('view').addEventListener('pointermove',e=>{if(!e.buttons)hover=screenPoint(e);});
$('view').addEventListener('pointerleave',()=>{hover=null;});
$('view').addEventListener('pointerdown',e=>{if(e.button===0&&!SphereEnhancements.measuring&&!A.busy)press=[e.clientX,e.clientY];});
$('view').addEventListener('pointerup',e=>{if(!press)return;const click=Math.hypot(e.clientX-press[0],e.clientY-press[1])<4;press=null;if(click&&!SphereEnhancements.measuring&&!A.busy)mark(screenPoint(e));});
$('view').addEventListener('pointercancel',()=>press=null);
window.addEventListener('sphere-view-changed',clearPointer);window.addEventListener('sphere-measure-mode',clearPointer);new ResizeObserver(clearPointer).observe($('view'));
function pointerRay(s,point=pointer||[.5,.5]){const r=$('view').getBoundingClientRect();return M.ray(point[0]*2-1,1-point[1]*2,r.width/r.height,s.fov,M.basis(s.forward,s.up),s.projection==='panorama');}
function mark(point){const s=A.getState(),r=$('view').getBoundingClientRect(),v=$('viewport').getBoundingClientRect();picked=SpherePointer.pick(s,pointerRay(s,point),{aspect:r.width/r.height});if(!picked){clearPointer();A.toast('Open space. Choose a visible surface or a Wound.');return null;}pointer=point;aim.style.left=(r.left-v.left+point[0]*r.width)+'px';aim.style.top=(r.top-v.top+point[1]*r.height)+'px';aim.hidden=false;aim.title=picked.title;$('seeSurface').title='Travel to '+picked.title+'. Click another point to change your destination.';return picked;}
function go(){if(A.busy&&window.SphereLoading?.active)return;const s=A.getState(),r=$('view').getBoundingClientRect(),target=picked||SpherePointer.pick(s,pointerRay(s),{aspect:r.width/r.height}),arrival=SpherePointer.arrive(s,target);if(!arrival){A.toast('Point at a surface or a Wound to choose an arrival.');return;}J.visit(arrival.state,arrival.title);clearPointer();}
window.addEventListener('keydown',e=>{if(e.code!=='KeyG'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||A.busy||$('guide').open||SphereEnhancements.measuring||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.target.isContentEditable)return;e.preventDefault();if(hover&&!mark(hover))return;go();});
SphereSurface.visit=go;SphereSurface.resetReturn=()=>{};$('seeSurface').onclick=go;$('seeSurface').textContent='Go to pointer';$('seeSurface').title='Click a destination to mark it, then travel. Or point and press G. Uses the centre marker until a point is marked.';
const pointerHelp=document.createElement('small');pointerHelp.textContent='Click · mark destination    G · go';document.querySelector('.keyboard-map').append(pointerHelp);
const surface=document.querySelector('[data-destination=surface]');surface.innerHTML='<span>Go to pointer</span><small>Travel to your target</small>';surface.onclick=go;
const back=$('browseBiomes');back.innerHTML='<span>Return to previous</span><small id="returnDestination">Your previous place</small>';back.onclick=()=>J.back();back.title='Return to the previous arrival, keeping your current play or pause status.';
function history(){back.disabled=!J.count;$('returnDestination').textContent=J.previousTitle||'Your journey starts here';}window.addEventListener('sphere-history-changed',history);history();
let previousPose=null,era=A.getState().era,lastScene=A.getState().placeScene,lastWeather=A.getState().placeWeather;
function sync(){const s=A.getState(),pose=JSON.stringify([s.position,s.forward,s.up,s.radius,s.fov,s.projection,s.shadeShape,s.era]);if(pose!==previousPose){clearPointer();previousPose=pose;}$('speedMode').value=s.autoSpeed===false?'manual':'auto';$('speed').disabled=s.autoSpeed!==false;
 if(s.era!==era){era=s.era;populate(true);}for(const [name,value] of [['placeScene',s.placeScene],['placeWeather',s.placeWeather]]){if(name==='placeScene'){if(value===lastScene)continue;chosenScene=value;lastScene=value;}else{if(value===lastWeather)continue;chosenWeather=value;lastWeather=value;}for(const el of panel.querySelectorAll(`[name=${name}]`))el.checked=el.value===value;}
 $('seeSurface').textContent='Go to pointer';}
window.addEventListener('sphere-state-synced',sync);populate();sync();
window.SpherePlaceBrowser={visit,go,mark,pointerRay,get picked(){return picked;},selectCategory(id){$('placeCategory').value=id;populate();}};
})();
