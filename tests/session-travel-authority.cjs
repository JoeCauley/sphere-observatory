'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
// Exercise the real travel transaction and browser-facing session script together.
// DOM/storage/timers are deterministic adapters; no renderer or BPS arrival is claimed.
const repo=process.env.SPHERE_MAIN_TEST_SOURCE||path.resolve(__dirname,'..'),out=process.env.SPHERE_SESSION_TRAVEL_TEST_OUTPUT||path.join(os.tmpdir(),'sphere-session-travel-'+crypto.randomUUID());
if(!out||!path.isAbsolute(out))throw Error('Fresh absolute SPHERE_SESSION_TRAVEL_TEST_OUTPUT required');
fs.mkdirSync(out,{recursive:false});
const sourcePaths=['math.js','meadow-wind.js','travel-transaction.js','session-state.js'];
const paths=sourcePaths.map(relative=>path.join(repo,relative));
const before=paths.map(file=>{const bytes=fs.readFileSync(file);return {path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
const groups=[],observations=[];
function harness(mode='normal',withJourney=true){
 const writes=[],records=new Map(),windowEvents=new Map(),documentEvents=new Map(),timers=new Map();let timerId=0;
 const listen=(events,name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
 const document={hidden:false,body:{classList:{contains:()=>false}},getElementById:id=>id==='lightPipeline'?{after(){}}:null,createElement:()=>({}),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listen(documentEvents,name,fn)};
 const context=vm.createContext({structuredClone,AbortController,AbortSignal,performance:{now:()=>1},document,localStorage:{getItem:key=>records.get(key)||null,setItem(key,value){writes.push({key,value});records.set(key,value);}},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>listen(windowEvents,name,fn),mode});
 vm.runInContext('window=globalThis;',context);
 for(const relative of ['meadow-wind.js','math.js','travel-transaction.js'])vm.runInContext(fs.readFileSync(path.join(repo,relative),'utf8'),context,{filename:relative});
 vm.runInContext(`
 let state=SphereMath.defaultState(),viewContext={bindingDigest:'departure'},commitCount=0,reconciliationCount=0,released=[],held=[];
 const prepared=Object.freeze({candidate:'lease'}),witness=Object.freeze({authority:'retained-owner'});
 SphereApp={get busy(){return false;},getState:()=>structuredClone(state),snapshot:()=>SphereMeadowWind.snapshot(state)};
 const travel=SphereTravelTransaction.create({getState:SphereApp.getState,validate:SphereMath.validate,getViewContext:()=>viewContext,prepareViewContext:()=>prepared,releaseViewContext:token=>released.push(token),prepare:async()=>{},hold:value=>held.push(value),commit(next){commitCount++;state=next;viewContext={bindingDigest:'candidate'};if(mode==='throw')throw Error('Authority transferred before failure');if(mode==='thenable')return {then(){}};},verifyCommitReconciliation(value,summary){if(value!==witness)throw Object.assign(Error('Untrusted witness'),{code:'FOREIGN_WITNESS'});reconciliationCount++;return {requestId:summary.requestId,state:'arrived',resourcesOwnedByHost:true};}});
 SphereJourney={travel,get entries(){return [];}};
 test={travel,witness,prepared,get state(){return state;},setExposure:value=>state.exposure=value,get commitCount(){return commitCount;},get released(){return released;},get held(){return held;},get reconciliationCount(){return reconciliationCount;},request:()=>travel.request({type:'saved',title:'Candidate',viewContext:{bindingDigest:'candidate'},resolve:()=>({...state,exposure:2})})};
 `,context);
 if(!withJourney)vm.runInContext('delete SphereJourney;',context);
 vm.runInContext(fs.readFileSync(path.join(repo,'session-state.js'),'utf8'),context,{filename:'session-state.js'});
 function fire(events,name){for(const fn of events.get(name)||[])fn();}
 return {context,test:context.test,writes,records,flush:()=>context.SphereSession.flush(),fireWindow:name=>fire(windowEvents,name),fireDocument:name=>fire(documentEvents,name),setHidden:value=>document.hidden=value,runTimers(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}},get pendingTimers(){return timers.size;}};
}
async function main(){
 for(const mode of ['throw','thenable']){
  const h=harness(mode);assert.equal(h.flush(),true);const saved=h.records.get('sphere-session-v1'),writes=h.writes.length;
  h.test.setExposure(1.25);h.fireWindow('sphere-state-synced');assert.equal(h.pendingTimers,1);
  const outcome=await h.test.request();assert.equal(outcome.state,'committed-uncertain');assert.equal(h.test.travel.legacyAutosaveAllowed,false);assert.equal(h.test.commitCount,1);assert.equal(h.test.state.exposure,2);assert.equal(h.test.released.length,0);
  h.runTimers();assert.equal(h.flush(),false);
  for(const event of ['sphere-travel-committed','pagehide','blur'])h.fireWindow(event);
  h.setHidden(true);h.fireDocument('visibilitychange');h.setHidden(false);
  for(const event of ['sphere-state-synced','sphere-view-changed','sphere-telemetry','sphere-history-changed']){h.fireWindow(event);h.runTimers();}
  for(const event of ['input','change','click','toggle']){h.fireDocument(event);h.runTimers();}
  assert.equal(h.writes.length,writes);assert.equal(h.records.get('sphere-session-v1'),saved);assert.equal(h.test.released.length,0);
  assert.equal((await h.test.travel.retry()).state,'committed-uncertain');assert.equal(h.test.commitCount,1);
  assert.throws(()=>h.test.travel.reconcileCommit({authority:'retained-owner'}),error=>error.code==='FOREIGN_WITNESS');assert.equal(h.flush(),false);assert.equal(h.records.get('sphere-session-v1'),saved);
  h.test.travel.reconcileCommit(h.test.witness);assert.equal(h.test.travel.legacyAutosaveAllowed,true);assert.equal(h.test.reconciliationCount,1);assert.equal(h.test.released.length,0);assert.equal(h.flush(),true);assert.equal(h.writes.length,writes+1);assert.equal(JSON.parse(h.records.get('sphere-session-v1')).state.exposure,2);
  groups.push({name:mode+' transferred authority blocks every autosave route until actual travel reconciliation',status:'PASS'});
  observations.push({mode,commitCount:h.test.commitCount,reconciliationCount:h.test.reconciliationCount,retainedLeaseWasNotGenericallyReleased:h.test.released.length===0,writesBeforeUncertainty:writes,writesAfterReconciliation:h.writes.length});
 }
 const legacy=harness('normal',false);assert.equal(legacy.flush(),true);legacy.test.setExposure(1.75);legacy.fireWindow('pagehide');assert.equal(legacy.writes.length,2);assert.equal(JSON.parse(legacy.records.get('sphere-session-v1')).state.exposure,1.75);groups.push({name:'legacy session without Journey keeps direct and pagehide saving',status:'PASS'});
 const normal=harness();assert.equal(normal.flush(),true);const arrived=await normal.test.request();assert.equal(arrived.state,'arrived');assert.equal(normal.test.travel.legacyAutosaveAllowed,true);normal.fireWindow('sphere-travel-committed');assert.equal(normal.writes.length,2);assert.equal(JSON.parse(normal.records.get('sphere-session-v1')).state.exposure,2);groups.push({name:'normal actual travel arrival remains saveable',status:'PASS'});
 const after=paths.map(file=>{const bytes=fs.readFileSync(file);return {path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});assert.deepEqual(after,before);
 const report={format:'sphere-main-session-travel-authority-tests/1',status:'PASS_MAIN_SESSION_GUARD_INSTRUMENTED_DOM',groups,observations,sourceBefore:before,sourceAfter:after,scope:{actualCode:'SphereTravelTransaction and browser-facing SphereSession',DOMStorageEvents:'deterministic instrumented adapters',nativeGL:'NOT_RUN',biomeMainArrival:'UNQUALIFIED',nativeSessionAck:'UNQUALIFIED'}};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,groups:groups.length,output:out}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'failed-attempt.json'),JSON.stringify({error:{message:error.message,stack:error.stack},groups,observations,sourceBefore:before},null,2)+'\n',{flag:'wx'});console.error(error);process.exitCode=1;});
