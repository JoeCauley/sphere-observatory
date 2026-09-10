(function(){
'use strict';const A=SphereApp,B=SphereBiomes,M=SphereMath,$=id=>document.getElementById(id);
const adaptive=document.createElement('label');adaptive.className='check';adaptive.innerHTML='<input id="adaptivePreview" type="checkbox" checked> Adaptive preview · target frame rate';$('lighting').append(adaptive);
const surfaceButton=document.createElement('button');surfaceButton.id='seeSurface';surfaceButton.className='measure-button';surfaceButton.textContent='See surface ↓';surfaceButton.title='Fly to the inner surface under the crosshair, 3 km above the terrain';document.querySelector('.view-actions').prepend(surfaceButton);let returnPose=null;
function surfaceAction(descend=false){const s=A.getState();if(returnPose&&!descend){Object.assign(s,returnPose);returnPose=null;A.setState(s);surfaceButton.textContent='See surface ↓';$('viewTitle').textContent='Previous view';window.dispatchEvent(new Event('sphere-view-changed'));return;}
 const distance=M.shellDistance(s.position,s.forward,s.radius),origin=Number.isFinite(distance)?M.norm(M.add(s.position,M.mul(s.forward,distance))):M.norm(s.position);let q=origin;
 if(M.inBreach(q,s)){const basis=M.basis(origin);let found=false;for(let angle=1;angle<=90&&!found;angle+=1)for(let turn=0;turn<12;turn++){const tangent=M.add(M.mul(basis.r,Math.cos(turn*Math.PI/6)),M.mul(basis.u,Math.sin(turn*Math.PI/6))),candidate=M.norm(M.add(M.mul(origin,Math.cos(M.radians(angle))),M.mul(tangent,Math.sin(M.radians(angle)))));if(!M.inBreach(candidate,s)){q=candidate;found=true;break;}}if(!found){A.toast('No intact nearby surface was found. Choose a biome expedition.');return;}}
 returnPose=returnPose||{position:s.position.slice(),forward:s.forward.slice(),up:s.up.slice(),fov:s.fov,speed:s.speed,projection:s.projection};
 const tangent=M.basis(q).r;s.position=M.mul(q,s.radius-3);s.forward=M.norm(M.add(M.mul(q,.8),M.mul(tangent,.6)));s.up=M.basis(s.forward,M.mul(q,-1)).u;s.fov=70;s.speed=1;s.projection='perspective';A.setState(s);$('viewTitle').textContent=B.catalog[B.region(q,s)].name+' · surface';surfaceButton.textContent='Return to view ↑';window.dispatchEvent(new Event('sphere-view-changed'));$('viewport').focus({preventScroll:true});
};
surfaceButton.onclick=()=>surfaceAction();window.SphereSurface={visit:()=>surfaceAction(true),resetReturn:()=>{returnPose=null;surfaceButton.textContent='See surface ↓';}};
const panel=document.createElement('details');panel.open=true;panel.className='biome-panel';panel.innerHTML=`<summary>Living surface · ten biomes</summary>
<label class="field">Biome palette<select id="biome"><option value="-1">Automatic · regional mosaic</option>${B.catalog.map((b,i)=>`<option value="${i}">${b.name}</option>`).join('')}</select></label>
<p class="micro" id="biomeDescription">Ten world-anchored regions, from ancient forests to alien crystal fields.</p>
<label class="check"><input id="textureDetail" type="checkbox" checked> Near-surface texture detail</label>
<label class="check"><input id="biomeAtmosphere" type="checkbox" checked> Regional atmosphere colours</label>
<p class="micro">Hero landscapes retain their landmarks as you approach. Fine surface detail and bump shading resolve close up; distant views blend into the regional atlas. Atmosphere follows the region around you.</p>
<label class="check"><input id="surfaceRelief" type="checkbox" checked> Surface relief · bump shading</label><p class="micro" id="biomeDetailStatus"></p>`;
$('scene').insertBefore(panel,$('scene').querySelector(':scope > .field'));
const journey=document.createElement('details');journey.id='biomeExpeditions';journey.open=true;journey.innerHTML=`<summary>Biome expeditions</summary><label class="field">Destination<select id="biomeDestination">${B.catalog.map((b,i)=>`<option value="${i}">${b.name}</option>`).join('')}</select></label><label class="field">Approach altitude<select id="biomeAltitude"><option value="1000">1,000 km · regional</option><option value="100">100 km · district</option><option value="10">10 km · local</option><option value="1" selected>1 km · close approach</option></select></label><button id="visitBiome" class="secondary full">Visit biome</button><p class="micro">Moves to an intact surface region. World, light and time settings stay yours. A fixed biome palette overrides the regional mosaic.</p>`;
$('camera').append(journey);
for(const k of ['biome','textureDetail','biomeAtmosphere','surfaceRelief'])$(k).onchange=()=>{const s=A.getState();s[k]=k==='biome'?Number($(k).value):$(k).checked;A.setState(s);};
function sync(){const s=A.getState();$('biome').value=String(s.biome);$('textureDetail').checked=s.textureDetail;$('biomeAtmosphere').checked=s.biomeAtmosphere;$('surfaceRelief').checked=s.surfaceRelief!==false;
 $('biomeDescription').textContent=s.biome<0?'Ten world-anchored regions, from ancient forests to alien crystal fields.':B.catalog[s.biome].description;
}
$('visitBiome').onclick=()=>{const s=A.getState(),id=Number($('biomeDestination').value),alt=Number($('biomeAltitude').value);let chosen=null;
 // Prefer belt interiors and avoid wounds. Search changes the pose, never the world's seed.
 for(let lat=-70;lat<=70&&!chosen;lat+=2)for(let lon=-179;lon<180;lon+=2){const q=M.axis(lat,lon);if(B.region(q,{...s,biome:-1})!==id||M.inBreach(q,s))continue;if(s.collection&&SphereCollection.region(q,s).weight<.99)continue;chosen=q;break;}
 if(!chosen){A.toast('No intact region of that biome was found in this world layout. Increase Collection order or try another biome.');return;}
 s.speed=alt<=10?1:alt<=100?10:1000;s.fov=70;s.projection='perspective';s.position=M.mul(chosen,s.radius-alt);const tangent=M.basis(chosen).r;s.forward=M.norm(M.add(M.mul(chosen,.6),M.mul(tangent,.8)));s.up=M.basis(s.forward,M.mul(chosen,-1)).u;A.setState(s);$('viewTitle').textContent=B.catalog[id].name+' · approach';window.dispatchEvent(new Event('sphere-view-changed'));$('viewport').focus({preventScroll:true});
};
let last='';setInterval(()=>{if(document.hidden)return;const s=A.getState(),hit=M.trace(s.position,s.forward,s),id=B.region(hit.point?M.norm(hit.point):M.norm(s.position),s),d=hit.kind==='Inner surface'?hit.distance:Infinity;
 const tier=d<24?'hero landscape · fine surface detail':d<600?'hero landscape':d<1800?'regional transition':'distant atlas',status=(A.renderer.heroes?.status[id]||A.renderer.biomes?.status[id]);
 const text=B.catalog[id].name+' · '+(s.textureDetail?tier:'texture detail off')+(d<1800&&s.textureDetail?' · '+(status==='ready'?'textures ready':status==='failed'?'atlas fallback':status==='decoded'?'preparing texture':status):'');
 if(text!==last){$('biomeDetailStatus').textContent=text;last=text;}
},500);
window.addEventListener('sphere-state-synced',sync);sync();
})();
