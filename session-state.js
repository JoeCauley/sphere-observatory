/* Browser-local, versioned session persistence. No network storage. */
(function(root){
'use strict';
const key='sphere-session-v1',M=root.SphereMath;
function decode(raw){if(typeof raw!=='string'||raw.length>1000000)throw Error('Invalid saved session');const record=JSON.parse(raw);
 if(!record||record.format!=='sphere-session'||record.version!==1)throw Error('Unsupported saved session');
 const state=M.validate(record.state);
 // Upgrade the resumable exploration once. Portable scene imports still keep
 // their explicit geometry revision; subsequent saved choices are respected.
 if(record.shadeBodyVersion!==3&&state.shadeGeometryRevision<3&&state.layoutVersion===2&&state.collection){state.shadeGeometryRevision=3;
  // A shell-facing camera in an old zero-thickness scene may now be inside the
  // body. Preserve its old clearance by moving only that trapped camera out.
  for(const p of root.SphereCollection.plates(state)){const radius=M.length(p.center)*state.radius,curved=p.shape==='cap'||p.shape==='trimmed',along=M.dot(state.position,p.normal),height=curved?M.length(state.position)-radius:along-radius;
   if(height<=0||height>=.182||along<=0)continue;const factor=curved?radius/along:1;
   if(!root.SphereCollection.diskContains(M.dot(state.position,p.right)*factor/state.radius,M.dot(state.position,p.up)*factor/state.radius,p))continue;
   state.position=M.add(state.position,M.mul(curved?M.norm(state.position):p.normal,.18));break;
  }
 }
 state.playing=false;state.walkVelocity=0;
 return {state,ui:record.ui&&typeof record.ui==='object'&&!Array.isArray(record.ui)?record.ui:{}};
}
function encode(state,ui={}){const clean=M.validate(state);clean.playing=false;clean.walkVelocity=0;return JSON.stringify({format:'sphere-session',version:1,shadeBodyVersion:3,state:clean,ui});}
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
 const tab=[...document.querySelectorAll('[data-tab]')].find(el=>el.dataset.tab===ui.tab);tab?.click();
 if(typeof ui.panelHidden==='boolean')document.body.classList.toggle('panel-hidden',ui.panelHidden);
 for(const el of document.querySelectorAll('.tab-panel details')){const open=ui.details?.[detailKey(el)];if(typeof open==='boolean')el.open=open;}
}
function flush(){clearTimeout(timer);timer=null;if(!ready||(A.busy&&!root.SphereLoading?.active)||root.spherePreviewSuspended)return false;
 try{const next=encode(A.getState(),uiState());if(next!==lastWritten){localStorage.setItem(key,next);lastWritten=next;}
  if(storageError){status.textContent='Settings and your viewpoint save automatically in this browser. Reopens paused.';storageError=false;}return true;
 }catch{status.textContent='This browser could not save the session. Export a scene from Capture to keep your settings.';storageError=true;return false;}
}
function schedule(delay=300){if(ready&&timer===null)timer=setTimeout(flush,delay);}
try{const raw=localStorage.getItem(key);if(raw){const saved=decode(raw);A.setState(saved.state);applyUI(saved.ui);$('viewTitle').textContent='Restored viewpoint';document.querySelectorAll('.journeys .selected,[data-preset].selected').forEach(el=>el.classList.remove('selected'));lastWritten=raw;restored=true;}}
catch{storageError=true;status.textContent='The saved session was unavailable. Current settings will be saved as you explore.';}
ready=true;
window.addEventListener('sphere-state-synced',()=>schedule());window.addEventListener('sphere-view-changed',()=>schedule(1000));window.addEventListener('sphere-telemetry',()=>schedule(1000));
for(const type of ['input','change','click','toggle'])document.addEventListener(type,()=>schedule(),true);
window.addEventListener('pagehide',flush);window.addEventListener('blur',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
root.SphereSession={flush,get restored(){return restored;},key};
})(typeof window==='undefined'?globalThis:window);
