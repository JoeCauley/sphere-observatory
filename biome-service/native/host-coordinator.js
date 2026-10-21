/* Prospective complete views share exact state contexts and the root target
 * resource host. These leases hold support; they never certify main rendering. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('../metadata-budget.js'):null),Sources=root.SphereBiomeNativeSourceAdmission||(node?require('./source-admission.js'):null),B=root.SphereBiomeBindingBuilder||(node?require('../binding-builder.js'):null),V=root.SphereBiomeViewEnvelope||(node?require('../view-envelope.js'):null),C=root.SphereBiomeNativeStateContexts||(node?require('./state-contexts.js'):null),T=root.SphereBiomeRootTargetBackend||(node?require('./root-target-backend.js'):null),I=root.SphereBiomeIntervals||(node?require('../intervals.js'):null),Cell=root.SphereBiomeCellGeometry||(node?require('../cell-geometry.js'):null),Distance=root.SphereBiomeNativeDistance||(node?require('./native-distance.js'):null),Halo=root.SphereBiomeNativeDirectionHalo||(node?require('./direction-halo.js'):null);
const owners=new WeakSet(),FORMAT='sphere-biome-native-view-preparation-profile/1',MAX_VIEWS=128,MAX_REGIONS=128,DIRECT=Object.freeze(['biome-service/native/host-coordinator.js','biome-service/view-envelope.js','biome-service/native/direction-halo.js','biome-service/native/native-distance.js','biome-service/intervals.js','biome-service/cell-geometry.js']);
function fail(code,message){throw R.error(code,message,{},'native-host-coordinator');}
function data(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'))||keys&&Object.keys(v).sort().join('|')!==keys.slice().sort().join('|'))fail('INVALID_REQUEST','Exact ordinary data fields required');return v;}
function abort(signal){if(signal?.aborted)fail('CANCELLED','Prospective complete view cancelled');}
async function create({bindingOwner,kernel,providerOwner,stateContexts,rootTargets,metadataOwner,sourceOwner,profileEnvelope,readSource,scheduleYield}={}){
 if(!B.isOwner(bindingOwner)||!Q.isOwner(metadataOwner)||!Sources.isSourceOwner(sourceOwner)||!sourceOwner.usesMetadataOwner(metadataOwner)||!C?.isOwner(stateContexts)||!T?.isOwner(rootTargets)||!rootTargets.usesMetadataOwner(metadataOwner)||!rootTargets.usesSourceOwner(sourceOwner)||!stateContexts.usesOwners({bindingOwner,kernel,providerOwner,resourceHost:rootTargets.resourceHost,metadataOwner,sourceOwner})||typeof readSource!=='function'||typeof scheduleYield!=='function')fail('FOREIGN_OWNER','Complete views require the same authentic binding, state, source, metadata and physical root/provider owners');
 const source=await Sources.admit({profileEnvelope,readSource,metadataOwner,sourceOwner,owner:'biome-native-host-coordinator',phase:'source-admission',extraBytes:32768});
 let codec,serviceOwner;
 try{
  const p=source.profile.body;
  data(p,['format','id','stateContextProfileRef','rootTargetProfileRef','maximumViews','maximumRegions','closure']);
  if(p.format!==FORMAT||p.id!=='root-native-view-preparation-v1'||p.maximumViews!==MAX_VIEWS||p.maximumRegions!==MAX_REGIONS||R.canonicalJSON(p.stateContextProfileRef)!==R.canonicalJSON({id:stateContexts.profileEnvelope.body.id,digest:stateContexts.profileEnvelope.digest})||R.canonicalJSON(p.rootTargetProfileRef)!==R.canonicalJSON({id:rootTargets.profileEnvelope.body.id,digest:rootTargets.profileEnvelope.digest}))fail('SOURCE_PROFILE_MISMATCH','Exact native view and parent-owner profile identities required');
  const rows=new Map(p.closure.map(r=>[r.path,r]));
  for(const path of DIRECT)if(!rows.has(path))fail('SOURCE_PROFILE_MISMATCH','Complete prospective view dependency closure required');
  for(const parent of [stateContexts.profileEnvelope,rootTargets.profileEnvelope])for(const row of parent.body.closure){const actual=rows.get(row.path);if(!actual||actual.bytes!==row.bytes||actual.sha256!==row.sha256)fail('SOURCE_PROFILE_MISMATCH','Root, state and view preparation must pin one coherent complete source closure');}
  codec=V.create({math:root.SphereMath,bindingOwner,reserveMetadata:(bytes,phase)=>metadataOwner.reserve(bytes,{owner:'biome-native-host-coordinator',phase})});
  serviceOwner=rootTargets.resourceHost.createServiceOwner();
 }catch(error){codec?.dispose();source.charge.release();throw error;}
 const resourceHost=rootTargets.resourceHost,credits=resourceHost.createCredits(serviceOwner,{uploadQuantum:16}),leases=new Map(),borrows=new Map(),observations=new Map();
 let disposed=false,busy=false,pending=null;
 function live(){if(disposed)fail('OWNER_DISPOSED','Prospective native view owner disposed');rootTargets.checkAvailable();if(resourceHost.inspect().contextLost)fail('CONTEXT_LOST','Shared physical root/provider context lost');}
 function get(key,{cleanup=false}={}){if(cleanup){if(disposed)fail('OWNER_DISPOSED','Prospective native view owner disposed');}else live();const s=leases.get(key);if(!s)fail('STALE_LEASE','Unknown or released prospective complete view');return s;}
 function observe(value){const h=Sources.ownRecord(value,{metadataOwner,label:'biome-native-host-coordinator',phase:'observation',maxBytes:131072,maxNodes:2048});observations.set(h.value,h);return h.value;}
 function releaseObservation(value){const h=observations.get(value);if(!h)fail('FOREIGN_OWNER','Unknown complete-view observation');observations.delete(value);h.charge.release();}
 async function work(signal){while(credits.takePrepareCredits(1)!==1){abort(signal);await scheduleYield();live();}abort(signal);}
 async function candidates(binding,view,demand,signal){
  const selected=[],observer=view.body.biomeView.observer,radiusM=binding.snapshot.validatedStaticWorldParameters.radius*1000;
  for(const assignment of binding.bindingEnvelope.body.assignments){
   await work(signal);let eye;
   try{const xy=binding.hostAdapter.generatorCoordinates(observer.address,assignment.frame,binding.snapshot);eye={xM:xy.xM,yM:xy.yM,heightM:observer.altitudeM};}catch(error){if(error.code==='OUTSIDE_GENERATOR_FRAME')continue;throw error;}
   const patch=Distance.chart(assignment.frame,radiusM,{x:[eye.xM-demand.requiredRadiusM,eye.xM+demand.requiredRadiusM],y:[eye.yM-demand.requiredRadiusM,eye.yM+demand.requiredRadiusM]}).q;
   for(const cell of assignment.core.cells){await work(signal);const box=Cell.directionBounds({...cell,level:assignment.core.level}).map(b=>[I.fromNumber(b[0])[0],I.fromNumber(b[1])[1]]);if(Halo.possible(patch,box,assignment.guardWidthM,radiusM)){selected.push({assignment,eye});break;}}
  }
  if(selected.length>MAX_REGIONS)fail('RESOURCE_LIMIT','Prospective native region cap exceeded');
  return selected;
 }
 async function prepareView(input){
  live();data(input,['viewEnvelope','demand','targetRequest','signal']);const signal=input.signal;abort(signal);if(busy)fail('PREPARATION_BUSY','One prospective complete view owns the preparation queues');if(leases.size>=MAX_VIEWS)fail('RESOURCE_LIMIT','Prospective complete-view cap reached');busy=true;
  const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;pending=controller;
  let request,view,viewBorrow,bindingHandle,target,charge;const members=[];
  try{
   request=Sources.buildRecord(()=>({viewEnvelope:input.viewEnvelope,demand:input.demand,targetRequest:input.targetRequest}),{metadataOwner,label:'biome-native-host-coordinator',phase:'prospective-input',maxBytes:131072,maxNodes:2048});
   const d=data(request.value.demand,['requiredRadiusM','maximumCellM','tier']);
   if(!Number.isFinite(d.requiredRadiusM)||d.requiredRadiusM<=0||!Number.isFinite(d.maximumCellM)||d.maximumCellM<=0||!['overview','surface','detail'].includes(d.tier))fail('INVALID_REQUEST','The complete explicit demand must be retained; no default or smaller demand');
   if(!request.value.viewEnvelope?.body?.biomeView)fail('INVALID_VIEW','An exact complete service sidecar is required');
   // Reserve actual bounded codec scratch before its clone/hash/verification.
   const scratch=metadataOwner.reserve(4194304,{owner:'biome-native-host-coordinator',phase:'complete-view-codec-scratch'});
   try{view=await codec.verify(request.value.viewEnvelope,{signal:combined});}finally{scratch.release();}
   live();abort(combined);viewBorrow=codec.borrowVerified(view.digest);bindingHandle=await bindingOwner.resolveBinding(view.body.biomeView.bindingDigest,{signal:combined});live();abort(combined);
   const binding=bindingOwner.inspectBinding(bindingHandle),sidecar=view.body.biomeView;
   if(sidecar.regionRef&&!sidecar.providerStateRefs.some(r=>r.regionId===sidecar.regionRef.regionId))fail('MISSING_PROVIDER_STATE','Active ownership cannot fabricate default persistent state');
   if(d.tier!=='overview')for(const item of await candidates(binding,view,d,combined)){
    const ref=sidecar.providerStateRefs.find(r=>r.regionId===item.assignment.regionId);if(!ref)fail('MISSING_PROVIDER_STATE','Every demanded active/neighbour provider needs its exact retained state');
    const context=await stateContexts.acquire({bindingHandle,regionId:item.assignment.regionId,stateRef:ref,signal:combined});
    let prepared;
    try{prepared=await stateContexts.prepare(context,{eye:item.eye,requiredRadiusM:d.requiredRadiusM,tier:d.tier,maximumCellM:d.maximumCellM},{signal:combined});members.push({context,prepared,regionId:item.assignment.regionId,stateRef:ref});}catch(error){if(prepared)stateContexts.releasePrepared(prepared);stateContexts.release(context);throw error;}
   }
   live();abort(combined);target=rootTargets.prepare(request.value.targetRequest,{signal:combined});charge=metadataOwner.reserve(4096,{owner:'biome-native-host-coordinator',phase:'prospective-lease'});const key=Object.freeze({});
   leases.set(key,{request,view,viewBorrow,bindingHandle,binding,members,target,charge,borrows:0});return key;
  }catch(error){if(target)rootTargets.release(target);for(const m of members.reverse()){stateContexts.releasePrepared(m.prepared);stateContexts.release(m.context);}charge?.release();viewBorrow?.close();if(view&&!([...leases.values()].some(s=>s.view.digest===view.digest)))codec.release(view.digest);request?.charge.release();throw error;}
  finally{busy=false;pending=null;}
 }
 function summary(s){return {viewEnvelope:s.view,demand:s.request.value.demand,target:rootTargets.observe(s.target),members:s.members.map(m=>({regionId:m.regionId,stateRef:m.stateRef,preparedSupport:'ACTUAL_PH_K_COMPONENT'})),readiness:{visualCoverageReady:false,terrainAndCollisionReady:false,stateAndIdentityReady:true,conservativeBoundsReady:false},qualification:'PROSPECTIVE_COMPLETE_VIEW_STATE_SUPPORT_TARGET_COMPONENT_ONLY',wholeView:'UNQUALIFIED',fragmentField:'UNQUALIFIED',mainRenderer:'NOT_RUN',nativeSessionAck:'UNQUALIFIED'};}
 function inspectPrepared(key){const s=get(key);for(const m of s.members){const report=stateContexts.inspectPrepared(m.prepared);try{if(!report.readiness.terrainAndCollisionReady||!report.readiness.stateAndIdentityReady||!report.readiness.conservativeBoundsReady)fail('NOT_READY','Actual prepared provider support became unavailable');}finally{stateContexts.releaseObservation(report);}}if(!rootTargets.observe(s.target).resource.usable)fail('NOT_READY','Shared prospective target became unavailable');return observe(summary(s));}
 function borrow(key){const s=get(key),charge=metadataOwner.reserve(4096,{owner:'biome-native-host-coordinator',phase:'complete-view-reader'}),token=Object.freeze({});s.borrows++;borrows.set(token,{s,charge});return token;}
 function closeBorrow(token){const b=borrows.get(token);if(!b)fail('STALE_LEASE','Unknown complete-view reader');borrows.delete(token);b.s.borrows--;b.charge.release();}
 function borrowPreparedMember(key,regionId){
  const s=get(key);if(typeof regionId!=='string'||!/^[-a-z0-9]{3,128}$/.test(regionId))fail('INVALID_REQUEST','Exact demanded region identity required');
  const member=s.members.find(m=>m.regionId===regionId);if(!member)fail('MISSING_ASSIGNMENT','Requested region has no prepared local member in this exact complete view');
  const parent=borrow(key);let child;
  try{child=stateContexts.borrowPrepared(member.prepared);let open=true;return Object.freeze({get value(){if(!open)fail('STALE_LEASE','Complete-view native member reader is closed');get(key);return child.value;},close(){if(!open)return false;child.close();closeBorrow(parent);open=false;return true;}});}catch(error){child?.close();closeBorrow(parent);throw error;}
 }
 function withTarget(key,callback){const s=get(key);return rootTargets.withTarget(s.target,callback);}
 function release(key){const s=get(key,{cleanup:true});if(s.borrows)fail('OWNER_IN_USE','Complete-view readers must close before support and target release');for(const m of s.members){if(m.prepared){stateContexts.releasePrepared(m.prepared);m.prepared=null;}if(m.context){stateContexts.release(m.context);m.context=null;}}rootTargets.release(s.target);s.viewBorrow.close();s.charge.release();s.request.charge.release();leases.delete(key);if(![...leases.values()].some(v=>v.view.digest===s.view.digest))codec.release(s.view.digest);}
 function prepareArrival(key){get(key);fail('NATIVE_FRAGMENT_FIELD_UNQUALIFIED','Prospective support/target leases cannot authorize arrival without actual whole-view and fragment-field admission');}
 function cancel(){pending?.abort();}
 function dispose(){if(disposed)return;if(busy)fail('PREPARATION_BUSY','Prospective work must settle before owner disposal');if(leases.size||borrows.size)fail('OWNER_IN_USE','Complete views and their readers must release first');for(const o of [...observations.keys()])releaseObservation(o);codec.dispose();/* serviceOwner is R's borrowed shared singleton; only R disposes it. */source.charge.release();disposed=true;}
 const owner=Object.freeze({profileEnvelope:source.profile,usesMetadataOwner:value=>value===metadataOwner,usesSourceOwner:value=>value===sourceOwner,prepareView,inspectPrepared,releaseObservation,borrow,closeBorrow,borrowPreparedMember,withTarget,release,prepareArrival,cancel,dispose,inspect:()=>Object.freeze({views:leases.size,readers:borrows.size,observations:observations.size,busy,disposed,nativeMainReadiness:'UNQUALIFIED',nativeSessionAck:'UNQUALIFIED'})});owners.add(owner);return owner;
}
const api=Object.freeze({FORMAT,MAX_VIEWS,MAX_REGIONS,DIRECT,create,isOwner:value=>owners.has(value)});root.SphereBiomeNativeHostCoordinator=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
