(function(){
'use strict';const A=SphereApp,M=SphereMath,$=id=>document.getElementById(id);
const panel=document.createElement('div');panel.className='collection-panel';panel.innerHTML=`
 <span class="eyebrow">THE COLLECTION · DESIGN STUDY 01</span>
 <h3>Design the world.</h3>
 <p class="micro">One collection. Two histories. Compare at the same location and time.</p>
 <div class="two buttons"><button id="eraBefore" class="secondary">Before the attack</button><button id="eraAfter" class="secondary">After the attack</button></div>
 <div class="two buttons"><button id="collectionVista" class="secondary">Across the collection</button><button id="collectionWounds" class="secondary">The long wounds</button></div>
 <div class="two buttons"><button id="collectionShades" class="secondary">Among the shades</button><button id="collectionStation" class="secondary">At the star</button></div>
 <button id="collectionEclipse" class="secondary full">A shade eclipsed · intact fleet</button>
 <p id="collectionStatus" class="micro"></p>
 <details><summary>Layout & light</summary>
 <label class="field">Shade width · across the route<input id="shadeTrim" type="range" min=".25" max="1" step=".05"></label><p class="micro">Trimmed sections retain curved ends. Cuts run parallel to travel. Width 1 restores the complete cap.</p><label class="field">Antialiasing<select id="antialias"><option value="0">Off</option><option value="2">Supersampling only · measured resolve</option><option value="3">Smooth edges · supersampling + edge filter</option></select></label><label class="field">Stellar shadow quality<select id="shadowSamples"><option value="7">7 samples · gentle</option><option value="19">19 samples · finer penumbrae</option></select></label><label class="field">Station shadow integration<select id="stationSamples"><option value="19">19 rays · comparison</option><option value="64">64 rays · balanced</option><option value="128">128 rays · fine</option><option value="256">256 rays · capture study</option></select></label><p class="micro">With the station enabled, all blockers share this finer stellar sample set. More rays reduce false shadow bands and cost more GPU work.</p><label class="field">Collection order<input id="regionOrder" type="range" min="0" max="1" step=".05" aria-label="Collection order"></label>
 <label class="field">Colour richness<input id="colorRichness" type="range" min="0" max="1" step=".05" aria-label="Colour richness"></label>
 <label class="field">Shade geometry<select id="shadeShape"><option value="disk">Circular plane</option><option value="square">Square plane</option><option value="cap">Curved sphere section</option><option value="trimmed">Sphere section · trimmed sides</option></select></label><p class="micro">Shared construction scales across the fleet. Fine ribs fade with distance. All four shapes retain collision clearance on these prescribed routes.</p>
 <label class="check"><input id="routeShades" type="checkbox"> Cycling shade fleet</label>
 <label class="check"><input id="multipleWounds" type="checkbox"> Six wounds after the attack</label>
 <label class="check"><input id="starStation" type="checkbox"> Stellar service rings</label>
 <label class="check"><input id="shineField" type="checkbox"> Coloured ShellShine</label>
 <label class="check"><input id="routeGuides" type="checkbox"> Show collection belt boundaries</label>
 <label class="field">Cycle duration<select id="cycleScale"><option value=".5">Half length</option><option value="1">24 / 36 / 60 hours</option><option value="2">Double length</option></select></label>
 <button id="advanceCycle" class="secondary full">Advance six hours</button>
 <p class="micro">Verdant: 8 shades · 24 h<br>Opaline: 6 shades · 36 h<br>Amber: 4 shades · 60 h</p>
 <p class="micro">Proposed active routes, not free orbits. Cycles describe passages at each belt centre; overlapping belts combine shadows. Pale Reach mirror delivery is a separate future study.</p>
 </details>
 <button id="legacyStudy" class="quiet full">Load original dawn scene · resets conditions</button>
 <p class="micro">No meteor effect at this scale: atmospheric entry needs a separate close-range study. Broken shades retain prescribed routes; debris dynamics are not simulated.</p>
 <div class="rule"></div>`;
$('scene').prepend(panel);
const legacyDetails=[...$('scene').querySelectorAll(':scope > details')].slice(0,2);
function sync(){const s=A.getState();for(const k of ['shadeTrim','antialias','shadowSamples','stationSamples','shadeShape','regionOrder','colorRichness','cycleScale','routeShades','multipleWounds','starStation','shineField','routeGuides']){if($(k).type==='checkbox')$(k).checked=s[k];else $(k).value=s[k];}
 $('eraBefore').classList.toggle('selected',s.collection&&s.era==='before');$('eraAfter').classList.toggle('selected',s.collection&&s.era==='after');
 $('timeSlider').min=s.collection?-259200:-36000;$('timeSlider').max=s.collection?259200:36000;$('surfaceStyle').closest('label').hidden=s.collection;
 $('shadeTrim').disabled=s.shadeShape!=='trimmed';const count=SphereCollection.plates(s).length;$('collectionStatus').textContent=s.collection?`${s.era==='before'?'Intact collection':'Damaged collection'} · ${count} shade positions occupied · world changes preserve your camera`:'Original studies active · choose a collection view to return';legacyDetails.forEach(el=>el.hidden=s.collection);
}
function change(fn,{enable=true}={}){const s=A.getState();if(enable)s.collection=true;fn(s);A.setState(s);window.dispatchEvent(new Event('sphere-view-changed'));sync();}
function era(value){change(s=>s.era=value);$('viewTitle').textContent=value==='before'?'The collection · before':'The collection · after';}
$('eraBefore').onclick=()=>era('before');$('eraAfter').onclick=()=>era('after');
for(const k of ['shadeTrim','antialias','shadowSamples','stationSamples','shadeShape','regionOrder','colorRichness','cycleScale','routeShades','multipleWounds','starStation','shineField','routeGuides'])$(k).addEventListener($(k).type==='range'?'input':'change',()=>change(s=>s[k]=$(k).type==='checkbox'?$(k).checked:k==='shadeShape'?$(k).value:Number($(k).value)));
$('advanceCycle').onclick=()=>change(s=>s.time+=21600);
function view(name,{stage=false}={}){const prior=A.getState();change(s=>{s.collection=true;s.playing=false;s.atmosphere=1;s.exposure=-.15;s.shellshine=.22;s.fov=95;s.speed=1000000;s.projection='perspective';s.viewMode='material';
 if(name==='vista'){s.position=M.mul(M.axis(28,-60),s.radius*.08);s.forward=M.norm([.25,-.15,1]);}
 if(name==='wounds'){const w=SphereCollection.wounds[0];s.position=M.mul(w.axis,s.radius*.55);s.forward=w.axis;s.fov=88;}
 if(name==='shades'){const r=SphereCollection.routes[0];s.position=M.mul(M.norm([.7,.11,.7]),s.radius*.9);s.forward=M.norm(M.sub(M.mul(r.right,s.radius*.62),s.position));s.fov=78;s.speed=100000;}
 if(name==='station'){s.position=M.mul(M.norm([.7,.8,1]),s.starRadius*20);s.forward=M.mul(M.norm(s.position),-1);s.fov=42;s.exposure=-4;s.speed=1000;}
 if(name==='eclipse'){s.era='before';s.routeShades=true;s.time=8*3600;const pl=SphereCollection.plates(s).find(p=>p.id===16);s.position=M.mul(M.add(M.mul(pl.normal,.70),M.mul(pl.right,.25)),s.radius);s.forward=M.norm(M.sub(M.mul(pl.center,s.radius),s.position));s.fov=100;s.speed=100000;s.up=M.basis(s.forward,pl.right).u;}
 if(name!=='eclipse')s.up=M.basis(s.forward,[0,1,0]).u;if(!stage){const pose={position:s.position,forward:s.forward,up:s.up};Object.assign(s,prior,pose);}if(s.radius-M.length(s.position)<=1000)s.up=M.basis(s.forward,M.mul(M.norm(s.position),-1)).u;}, {enable:stage});$('viewTitle').textContent={vista:'Across the collection',wounds:'The long wounds',shades:'Among the shades',station:'The stellar conservatory',eclipse:'A shade eclipsed · intact fleet'}[name];document.querySelectorAll('[data-preset]').forEach(el=>el.classList.remove('selected'));}
$('collectionVista').onclick=()=>view('vista');$('collectionWounds').onclick=()=>view('wounds');$('collectionShades').onclick=()=>view('shades');$('collectionStation').onclick=()=>view('station');
 $('collectionEclipse').onclick=()=>view('eclipse',{stage:true});
$('legacyStudy').onclick=()=>{A.preset('dawn',{stage:true});sync();};
document.querySelectorAll('[data-preset]').forEach(el=>el.addEventListener('click',sync));
// Separate destinations, world design and image controls without duplicating inputs.
const cameraIntro=document.createElement('div');cameraIntro.innerHTML='<h3>Go somewhere</h3><p class="micro">Destinations move and rotate the camera. World, time, exposure, lens and quality settings stay yours.</p>';
$('camera').prepend(cameraIntro);
for(const id of ['collectionVista','collectionShades'])cameraIntro.append($(id).parentElement);
const staged=document.createElement('details');staged.innerHTML='<summary>Complete scene studies</summary><p class="micro">These explicitly load a camera, lighting and world setup. Save your scene in Capture to keep it.</p>';
staged.append($('collectionEclipse'),$('legacyStudy'));cameraIntro.append(staged);
const light=$('lighting');const aaNote=document.createElement('p');aaNote.className='micro';aaNote.textContent='Smooth edges also filters contrast edges when the preview pixel budget leaves no room for extra rays. It may soften fine structure. Supersampling only retains the unfiltered light resolve.';$('antialias').closest('label').after(aaNote);
for(const id of ['exposure','shellshine','atmosphere','shineField','antialias','shadowSamples','stationSamples','previewFps','quality']){const el=$(id).closest('label'),note=el.nextElementSibling?.matches('p.micro')?el.nextElementSibling:null;light.append(el);if(note)light.append(note);}
$('lightPipeline').textContent=A.renderer.linearSupported?'Linear light active · exposure follows image sampling · SDR output.':'Compatibility lighting · display-colour sampling · SDR output.';
const layout=panel.querySelector('details');layout.querySelector('summary').textContent='Regions & shade engineering';
const shape=$('shadeShape').closest('label'),trim=$('shadeTrim').closest('label');layout.prepend(shape);shape.after(trim);layout.prepend(layout.querySelector('summary'));
const mode=document.createElement('label');mode.className='field';mode.innerHTML='World model<select id="worldModel"><option value="collection">The Collection</option><option value="legacy">Original single shade</option></select>';panel.insertBefore(mode,panel.querySelector('.two'));
$('worldModel').onchange=()=>{const s=A.getState();s.collection=$('worldModel').value==='collection';A.setState(s);sync();};
window.addEventListener('sphere-state-synced',()=>{$('worldModel').value=A.getState().collection?'collection':'legacy';});
// Cooperative ownership across v0.3 tabs. Still views are idle; a newly used tab owns animation.
const channel=window.top===window&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('sphere-preview-owner-v3'):null;
channel?.addEventListener('message',()=>{window.spherePreviewSuspended=true;});
function claim(){window.spherePreviewSuspended=false;channel?.postMessage('claim');A.draw();}
window.addEventListener('pointerdown',claim);document.addEventListener('visibilitychange',()=>{if(!document.hidden)claim();});
window.addEventListener('sphere-state-synced',sync);
view('vista',{stage:true});change(s=>{s.shadeShape='trimmed';s.antialias=3;});claim();
window.SphereCollectionUI={view,sync};
})();
