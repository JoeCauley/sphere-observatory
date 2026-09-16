/* Only committed visits enter the bounded, persistent journey. */
(function(){
'use strict';const A=SphereApp,M=SphereMath,entries=[];let identity=SphereLocation.resolve(A.getState());
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
function sync(){emit('sphere-history-changed');}
function current(){return identity=SphereLocation.resolve(A.getState(),identity);}
function remember(state=A.getState(),title=current().title){entries.push({state:structuredClone(state),title,identity:SphereLocation.resolve(state),created:new Date().toISOString()});if(entries.length>24)entries.shift();sync();}
const travel=SphereTravelTransaction.create({getState:A.getState,validate:M.validate,hold:A.setTravelHold,blocked:()=>A.busy&&window.SphereLoading?.ready,
 requiresHold:s=>s.walkMode||!!window.SphereGround?.enabled(s),
 ready:s=>{const r=document.getElementById('viewport').getBoundingClientRect(),plan=SphereAssets.plan(s,r.width/r.height);return !SphereAssets.status(A.renderer,plan).missing.length&&(!s.walkMode||!SphereGround.enabled(s)||SphereGround.available(s));},
 releaseResources:()=>window.SphereGround?.suspend(),prepare:(s,options)=>A.renderer.prepare(s,options),publish:detail=>emit('sphere-travel-status',detail),
 commit(next,spec){
  const departureIdentity=SphereLocation.resolve(spec.departure,identity);A.commitTravel(next,spec.candidate);identity=SphereLocation.resolve(next);
  if(spec.returnEntry){const index=entries.indexOf(spec.returnEntry);if(index>=0)entries.splice(index);}
  else remember(spec.departure,departureIdentity.title);
  sync();document.getElementById('viewTitle').textContent=identity.title;
  window.SphereEnhancements?.closeMeasurement();emit('sphere-travel-committed',{identity,title:spec.title});emit('sphere-view-changed');document.getElementById('viewport').focus({preventScroll:true});
 }});
function visit(state,title,options={}){return travel.request({type:'saved',title,resolve:()=>structuredClone(state),...options});}
function back(){const previous=entries.at(-1);if(!previous)return Promise.resolve();return visit(previous.state,previous.title,{returnEntry:previous});}
function restore(raw){const skipped=[];entries.length=0;if(Array.isArray(raw))for(const entry of raw.slice(-24)){try{if(!entry||typeof entry.title!=='string'||entry.title.length>240)throw Error('Invalid journey title');entries.push({...entry,state:M.validate(entry.state),title:entry.title});}catch(e){skipped.push(e.message);}}identity=SphereLocation.resolve(A.getState());sync();return skipped;}
window.addEventListener('sphere-user-navigation-intent',()=>travel.cancel('Travel cancelled by navigation input.'));
window.addEventListener('sphere-state-synced',()=>{travel.checkWorld();current();});window.addEventListener('sphere-world-changed',()=>travel.checkWorld());
window.SphereJourney={remember,visit,back,restore,travel,current,get entries(){return structuredClone(entries);},get count(){return entries.length;},get previousTitle(){return entries.at(-1)?.title||'';}};
})();
