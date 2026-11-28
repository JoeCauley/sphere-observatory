/* Browser-local, versioned session persistence. No network storage. */
(function(root){
'use strict';
const key='sphere-session-v1',M=root.SphereMath;
function decode(raw){if(typeof raw!=='string'||raw.length>1000000)throw Error('Invalid saved session');const record=JSON.parse(raw);
 if(!record||record.format!=='sphere-session'||![1,2].includes(record.version))throw Error('Unsupported saved session');
 const state=M.validate(record.state);
 // Resume existing explorations with the current fracture model. Portable
 // scenes and any saved session which specifies a model replay that model.
 const updateFracture=record.state.shadeFractureRevision===undefined && state.layoutVersion===2;
 if(updateFracture)state.shadeFractureRevision=2;
 const updateBody=record.shadeBodyVersion!==3 && state.shadeGeometryRevision<3 && state.layoutVersion===2 && state.collection;
 if(updateBody)state.shadeGeometryRevision=3;
 if(state.collection && (updateBody || updateFracture)){
  // A saved camera in a former through-opening can now be inside the plate.
  // Preserve the view and give it clearance on the nearest exposed face.
  for(const p of root.SphereCollection.plates(state)){
   if(!p.thickness || (!updateBody && !p.damage))continue;
   const radius=M.length(p.center)*state.radius,depth=p.thickness*state.radius;
   const curved=p.shape==='cap'||p.shape==='trimmed',along=M.dot(state.position,p.normal);
   const height=(curved?M.length(state.position):along)-radius;
   if(height<=0 || height>=depth || along<=0)continue;
   const scale=(curved?radius/along:1)/state.radius;
   const x=M.dot(state.position,p.right)*scale,y=M.dot(state.position,p.up)*scale;
   if(!root.SphereCollection.diskContains(x,y,p))continue;
   if(!updateBody && root.SphereCollection.diskContains(x,y,{...p,damage:1,fractureRevision:1}))continue;
   const shift=updateBody?depth:height<depth*.5?-.002-height:depth+.002-height;
   state.position=M.add(state.position,M.mul(curved?M.norm(state.position):p.normal,shift));break;
  }
 }
 state.playing=false;state.walkVelocity=0;
 const history=[],skipped=[];
 if(record.version===2&&record.journey?.version===1&&Array.isArray(record.journey.entries))for(const entry of record.journey.entries.slice(-24)){try{if(!entry||typeof entry.title!=='string'||entry.title.length>240||!entry.state)throw Error('Invalid journey entry');const viewContext=entry.viewContext??null;if(viewContext!==null&&(viewContext.kind!=='installed-native-local/1'||typeof viewContext.regionId!=='string'||viewContext.regionId.length>160))throw Error('Invalid installed local journey context');history.push({state:M.validate(entry.state),title:entry.title,created:typeof entry.created==='string'?entry.created.slice(0,40):'',identity:entry.identity,viewContext});}catch(e){skipped.push(e.message);}}
 else if(record.version===2&&record.journey)skipped.push('Unsupported journey version');
 return {state,history,skipped,ui:record.ui&&typeof record.ui==='object'&&!Array.isArray(record.ui)?record.ui:{}};
}
function encode(state,ui={},entries=[]){const clean=M.validate(root.SphereMeadowWind.snapshot(state));
 // An imported, unversioned portable scene runs the original model. Pin it
 // in the autosave so a subsequent resume does not migrate the imported view.
 if(clean.layoutVersion===2 && clean.shadeFractureRevision===undefined)clean.shadeFractureRevision=1;
 clean.playing=false;clean.walkVelocity=0;const raw=JSON.stringify({format:'sphere-session',version:2,shadeBodyVersion:3,state:clean,ui,journey:{version:1,entries:entries.slice(-24)}});if(raw.length>1000000)throw Error('Saved session exceeds 1 MB');return raw;}
root.SphereSessionCodec={key,decode,encode};
if(!root.document||!root.SphereApp)return;
const A=root.SphereApp,$=id=>document.getElementById(id),preferences=['previewFps','adaptivePreview','exportSize','clipShot','biomeDestination','biomeAltitude','fieldDestination','rotationStep','placeCategory','placeDestination','placeAltitude'];
const status=document.createElement('p');status.id='sessionStatus';status.className='micro';status.textContent='Settings and your viewpoint save automatically in this browser. Reopens paused.';
$('lightPipeline').after(status);
let ready=false,restored=false,timer=null,lastWritten='',storageError=false;
const detailKey=el=>(el.closest('.tab-panel')?.id||'view')+':'+(el.id||el.querySelector('summary')?.firstChild?.textContent?.trim()||'');
function uiState(){const values={};for(const id of preferences){const el=$(id);if(el)values[id]=el.type==='checkbox'?el.checked:el.value;}
 return {values,tab:document.querySelector('[data-tab].active')?.dataset.tab,panelHidden:document.body.classList.contains('panel-hidden'),details:Object.fromEntries([...document.querySelectorAll('.tab-panel details')].map(el=>[detailKey(el),el.open]))};
}
function applyUI(ui){for(const id of preferences){const el=$(id),value=ui.values?.[id];if(!el||value===undefined)continue;
  if(el.type==='checkbox'){if(typeof value!=='boolean')continue;el.checked=value;}
  else if(el.tagName==='SELECT'){if(![...el.options].some(option=>option.value===value))continue;el.value=value;}
  else{if(typeof value!=='string'||!Number.isFinite(Number(value))||(el.min!==''&&Number(value)<Number(el.min))||(el.max!==''&&Number(value)>Number(el.max)))continue;el.value=value;}
  el.dispatchEvent(new Event('change',{bubbles:true}));
 }
 if(!root.SphereControls.userSelected)root.SphereControls.select(ui.tab);
 if(!root.SphereControls.userSelected&&typeof ui.panelHidden==='boolean')document.body.classList.toggle('panel-hidden',ui.panelHidden);
 for(const el of document.querySelectorAll('.tab-panel details')){const open=ui.details?.[detailKey(el)];if(typeof open==='boolean')el.open=open;}
}
function flush(){clearTimeout(timer);timer=null;if(!ready||(A.busy&&!root.SphereLoading?.active)||root.spherePreviewSuspended||root.SphereJourney?.travel?.legacyAutosaveAllowed===false)return false;
 if(root.SphereMainBiomeView?.getViewContext()){status.textContent='Local inspection is temporary. Use Return to resume automatic viewpoint saving.';return false;}
 try{const next=encode(A.snapshot(),uiState(),root.SphereJourney?.entries||[]);if(next!==lastWritten){localStorage.setItem(key,next);lastWritten=next;}
  if(storageError){status.textContent='Settings and your viewpoint save automatically in this browser. Reopens paused.';storageError=false;}return true;
 }catch{status.textContent='This browser could not save the session. Export a scene from Capture to keep your settings.';storageError=true;return false;}
}
function schedule(delay=300){if(ready&&timer===null)timer=setTimeout(flush,delay);}
try{const raw=localStorage.getItem(key);if(raw){const saved=decode(raw);A.setState(saved.state);root.SphereJourney?.restore(saved.history);applyUI(saved.ui);$('viewTitle').textContent=root.SphereJourney?.current().title||'Restored viewpoint';if(saved.skipped.length)status.textContent=saved.skipped.length+' unsupported journey entries were skipped. Your current view was restored.';document.querySelectorAll('.journeys .selected,[data-preset].selected').forEach(el=>el.classList.remove('selected'));lastWritten=raw;restored=true;}}
catch{storageError=true;status.textContent='The saved session was unavailable. Current settings will be saved as you explore.';}
ready=true;
window.addEventListener('sphere-state-synced',()=>schedule());window.addEventListener('sphere-view-changed',()=>schedule(1000));window.addEventListener('sphere-telemetry',()=>schedule(1000));
window.addEventListener('sphere-travel-committed',flush);window.addEventListener('sphere-history-changed',()=>schedule());
for(const type of ['input','change','click','toggle'])document.addEventListener(type,()=>schedule(),true);
window.addEventListener('pagehide',flush);window.addEventListener('blur',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
root.SphereSession={flush,get restored(){return restored;},key};
})(typeof window==='undefined'?globalThis:window);
