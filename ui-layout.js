/* Consolidate the instrument's existing controls without duplicating their state or handlers. */
(function(){
'use strict';const A=SphereApp,M=SphereMath,B=SphereBiomes,$=id=>document.getElementById(id);
function details(title){const d=document.createElement('details');d.innerHTML='<summary>'+title+'</summary>';return d;}
function field(id){return $(id).closest('label');}
function moveField(id,parent,withNote=true){const node=field(id),note=node.nextElementSibling;parent.append(node);if(withNote&&note?.matches('p.micro'))parent.append(note);}
const tabs=document.querySelector('.tabs'),exploreTab=document.querySelector('[data-tab="camera"]');exploreTab.textContent='Explore';tabs.prepend(exploreTab);
document.querySelector('.intro h1').textContent='Find your perspective.';
document.querySelector('.intro p').textContent='A whole world. A place to land.';
// Explore: the visual destination picker first, precise camera controls second.
const camera=$('camera'),intro=camera.firstElementChild;intro.querySelector('h3').textContent='Where next?';intro.querySelector('p').textContent='Aim at a coloured region, then choose See surface. Use the bottom bar to travel across the collection.';
const oldViews=details('Original study viewpoints');for(const id of ['collectionVista','collectionShades'])oldViews.append($(id).parentElement);
const staged=intro.querySelector('details');staged.querySelector('summary').textContent='Staged lighting studies';staged.querySelector('p').textContent='These replace world, time and lighting settings. Save a viewpoint first if you want to keep them.';
const oldJourneyButtons=[...document.querySelectorAll('.journeys [data-preset]')];const legacyRow=document.createElement('div');legacyRow.className='legacy-views';legacyRow.append(...oldJourneyButtons);oldViews.append(legacyRow);
const expeditions=$('biomeExpeditions');intro.after(expeditions);expeditions.querySelector('summary').textContent='Explore a biome';
const preview=document.createElement('figure');preview.className='biome-preview';preview.innerHTML='<div role="img" id="biomePreviewImage"></div><figcaption id="biomePreviewCaption"></figcaption>';field('biomeDestination').after(preview);
function previewBiome(){const b=B.catalog[Number($('biomeDestination').value)];$('biomePreviewImage').style.backgroundImage=`url("assets/biomes/hero/${b.id}.png")`;$('biomePreviewImage').setAttribute('aria-label',b.name+' aerial texture preview');$('biomePreviewCaption').textContent=b.description;}
$('biomeDestination').addEventListener('change',previewBiome);previewBiome();
const expeditionNote=expeditions.querySelector('p.micro');function expeditionContext(){const s=A.getState();expeditionNote.textContent=s.biome>=0?'Your fixed '+B.catalog[s.biome].name+' palette overrides regional appearances. Choose Automatic in World → Living surface to see each destination’s own biome.':'A real destination in the regional mosaic. Sets camera, lens and flight speed; keeps your world and lighting.';}window.addEventListener('sphere-state-synced',expeditionContext);expeditionContext();
const cameraBasics=document.createElement('div');cameraBasics.className='camera-basics';moveField('speed',cameraBasics);moveField('fov',cameraBasics);expeditions.after(cameraBasics);
const slow=document.createElement('option');slow.value='1';slow.textContent='1 · Surface exploration';$('speed').prepend(slow);
const coordinates=details('Exact position & direction');camera.append(coordinates);coordinates.append(field('cameraLat').parentElement,field('cameraAltitude'),$('moveCamera'),$('faceSurface').parentElement,$('inspectBelow'));$('inspectBelow').textContent='Look straight down';camera.append(coordinates);
const rotation=field('rotationStep').closest('details');rotation.open=false;rotation.querySelector('summary').textContent='Rotate & level';camera.append(rotation);
const lens=details('Projection & diagnostic views');for(const id of ['projection','viewMode','grid'])moveField(id,lens,false);camera.append(lens,oldViews,staged);
for(const p of [...camera.querySelectorAll(':scope > p.micro')])p.remove();
const flightHelp=document.createElement('p');flightHelp.className='micro';flightHelp.textContent='Drag to look · WASD fly · Q/E rise and descend · Z/X turn. Scroll adjusts speed. Auto-level engages within 1,000 km on arrival or when descending through 1,000 km.';camera.append(flightHelp);
// World: model and history, biome interpretation, then engineering and scale.
const worldPanel=document.querySelector('.collection-panel');worldPanel.querySelector('.eyebrow').textContent='WORLD & HISTORY';worldPanel.querySelector('h3').textContent='Shape the collection.';worldPanel.querySelector('p.micro').textContent='World changes keep your viewpoint. Compare the same place before and after the attack.';
$('collectionStatus').after(document.querySelector('.biome-panel'));document.querySelector('.biome-panel').open=false;
for(const p of [...worldPanel.querySelectorAll(':scope > p.micro')])if(p.textContent.startsWith('No meteor'))p.remove();worldPanel.querySelector(':scope > .rule')?.remove();
const worldScale=details('Scale & central star');worldScale.append(field('radius'),field('starRadius').parentElement,$('starScale'));$('scene').append(worldScale);
const surfaceVariation=field('seed').closest('details');surfaceVariation.querySelector('summary').textContent='Surface variation';const obsoleteNote=[...surfaceVariation.querySelectorAll('p.micro')].find(p=>p.textContent.startsWith('Atmosphere is'));obsoleteNote?.remove();
// Light: visible appearance first, preview controls together, sampling details optional.
const light=$('lighting');light.querySelector('h3').textContent='Light & atmosphere';light.querySelector('p').textContent='These settings stay with you as you explore.';
const performance=details('Preview quality & performance');performance.open=true;for(const id of ['previewFps','quality','adaptivePreview','antialias'])moveField(id,performance);performance.append($('lightPipeline'));light.append(performance);
const integration=details('Advanced shadow & bounce sampling');for(const id of ['shadowSamples','stationSamples','shineField'])moveField(id,integration);light.append(integration);
const device=document.createElement('p');device.className='micro device-readout';device.textContent=A.renderer.device;integration.append(device);
// Capture: current view is the normal motion study; staged captures are labelled.
const photo=$('photo'),motion=details('Motion study · 12 seconds');moveField('clipShot',motion);motion.append($('recordClip'),$('cancelClip'));const clipNote=[...photo.querySelectorAll('p.micro')].find(p=>p.textContent.startsWith('Real-time local capture'));if(clipNote)motion.append(clipNote);photo.insertBefore(motion,field('bookmarkName'));
$('clipShot').value='current';for(const option of $('clipShot').options)if(option.value!=='current')option.textContent='Staged · '+option.textContent;
const saved=details('Saved viewpoints & scene files');saved.append(field('bookmarkName'),$('saveBookmark'),$('bookmarks'),$('saveScene').parentElement,$('sceneFile'));photo.append(saved);for(const rule of photo.querySelectorAll(':scope > .rule'))rule.remove();
// The bottom bar now describes this instrument, rather than the single-shade prototype.
const journeys=document.querySelector('.journeys');journeys.replaceChildren();journeys.setAttribute('aria-label','Travel presets: camera, lens and speed; world and lighting are preserved');
const destinations=[['overview','Overview','The whole collection'],['surface','Surface','Land where you are looking'],['shades','Shade fleet','Inspect the moving structures'],['wounds','Wounds','Openings into space'],['station','Star','The central star and service rings']];
function navigate(name){if(name==='surface'){SphereSurface.visit();journeys.querySelector('[data-destination="surface"]').classList.add('selected');return;}SphereSurface.resetReturn();const s=A.getState();
 if(s.collection){SphereCollectionUI.view({overview:'vista',shades:'shades',wounds:'wounds',station:'station'}[name]);}
 else{if(name==='overview')A.preset('interior');else if(name==='wounds')A.preset('breach');else if(name==='shades')A.preset('shade');else{const q=M.norm([.7,.8,1]);s.position=M.mul(q,s.starRadius*20);s.forward=M.mul(q,-1);s.up=M.basis(s.forward).u;A.setState(s);}}
 const view=A.getState();view.fov={overview:95,shades:78,wounds:88,station:42}[name];view.speed={overview:1000000,shades:100000,wounds:1000000,station:1000}[name];view.projection='perspective';A.setState(view);$('viewTitle').textContent={overview:'Across the collection',shades:'Among the shades',wounds:'The long wounds',station:'The central star'}[name];document.querySelectorAll('[data-destination]').forEach(b=>b.classList.toggle('selected',b.dataset.destination===name));$('viewport').focus({preventScroll:true});
}
for(const [name,label,description] of destinations){const button=document.createElement('button');button.dataset.destination=name;button.innerHTML='<span>'+label+'</span><small>'+description+'</small>';button.title=description;button.onclick=()=>navigate(name);journeys.append(button);}
const browse=document.createElement('button');browse.id='browseBiomes';browse.innerHTML='<span>Biomes ↗</span><small>Ten places to discover</small>';browse.onclick=()=>{document.body.classList.remove('panel-hidden');exploreTab.click();expeditions.open=true;expeditions.scrollIntoView({block:'nearest'});};journeys.append(browse);
function destinationState(){const s=A.getState();for(const name of ['wounds','shades']){const button=journeys.querySelector(`[data-destination="${name}"]`),available=name==='wounds'?(s.collection?s.era==='after'&&s.multipleWounds:s.breachEnabled):(s.collection?s.routeShades:s.shadeEnabled);button.disabled=!available;button.title=available?destinations.find(d=>d[0]===name)[2]:'Enable this feature in World to visit it.';}}
window.addEventListener('sphere-state-synced',destinationState);window.addEventListener('sphere-view-changed',()=>journeys.querySelectorAll('.selected').forEach(b=>b.classList.remove('selected')));destinationState();
exploreTab.click();journeys.querySelector('[data-destination="overview"]').classList.add('selected');
window.SphereNavigation={navigate};
})();
