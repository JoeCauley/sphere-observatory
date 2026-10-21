/* IB-075-H: fail-closed assessment of measured production frames. */
(function(root){
 'use strict';
 function stats(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return {count:a.length,median:a.length?a[Math.ceil(a.length*.5)-1]:null,p95:a.length?a[Math.ceil(a.length*.95)-1]:null,max:a.length?a.at(-1):null};}
 function assess(off,on,limits){
  const checks=[],check=(name,value,limit,lower=false)=>checks.push({name,value,limit,status:Number.isFinite(value)?((lower?value>=limit:value<=limit)?'PASS':'FAIL'):'INCOMPLETE'});
  const a=off.frames,b=on.frames,matched=a.length===b.length&&a.every((f,i)=>f.poseKey===b[i].poseKey),all=[...a,...b],validGpu=matched&&all.every(f=>Number.isFinite(f.gpuMs)&&f.gpuValid===true&&Number.isInteger(f.frameId))&&new Set(all.map(f=>f.frameId)).size===all.length;
  const completeSamples=key=>all.length===limits.frames*2&&all.every(f=>Number.isFinite(f[key])&&f[key]>=0),validCpu=completeSamples('cpuMs'),validPreparation=completeSamples('prepareMs'),validIntervals=completeSamples('intervalMs');
  const cpu=stats(validCpu?b.map(f=>f.cpuMs):[]),gpu=stats(b.map(f=>f.gpuMs)),incrementalCpu=stats(matched&&validCpu?b.map((f,i)=>Math.max(0,f.cpuMs-a[i].cpuMs)):[]),incrementalGpu=stats(validGpu?b.map((f,i)=>Math.max(0,f.gpuMs-a[i].gpuMs)):[]),intervals=stats(validIntervals?b.map(f=>f.intervalMs):[]),preparation=stats(validPreparation?b.map(f=>f.prepareMs):[]);
  check('complete matched poses',matched&&b.length===limits.frames?1:0,1,true);
  for(const [name,complete]of [['complete finite CPU samples',validCpu],['complete finite preparation samples',validPreparation],['complete finite interval samples',validIntervals]])check(name,complete?1:null,1,true);
  const workerEvidence=on.workerVerified??(on.settled?.info?.meadow?.worker===true&&on.heapAfter?.workers?.some(w=>w.usage&&/grass-worker\.js/.test(w.url)));
  check('real worker at warm start and end',workerEvidence===true?1:workerEvidence===false?0:null,1,true);
  if(on.kind==='stationary')check('stationary view contains detailed blades',b.length&&b.every(f=>f.submittedBlades>0)?1:0,1,true);
  const phases=b.map(f=>{if(Number.isFinite(f.windPhase))return f.windPhase;try{return JSON.parse(f.poseKey).at(-1);}catch{return null;}});
  check('animated wind phase advances',phases.every(Number.isFinite)?(new Set(phases).size>1?1:0):null,1,true);
  check('valid unique GPU sample for every off/on frame',validGpu?1:null,1,true);
  check('CPU p95 ms',cpu.p95,limits.cpuP95Ms);check('incremental CPU p95 ms',incrementalCpu.p95,limits.incrementalCpuP95Ms);
  check('GPU p95 ms',validGpu?gpu.p95:null,limits.gpuP95Ms);check('incremental GPU p95 ms',incrementalGpu.p95,limits.incrementalGpuP95Ms);
  check('drawn fps',on.frames.length*1000/on.elapsedMs,limits.minimumFps,true);check('interval p95 ms',intervals.p95,limits.intervalP95Ms);check('interval max ms',intervals.max,limits.intervalMaxMs);
  for(const [name,key,limit] of [['resident detailed records','residentBlades',limits.residentBlades],['submitted detailed instances','submittedBlades',limits.submittedBlades],['vegetation draws','drawCalls',limits.drawCalls],['vegetation GPU bytes','gpuBytes',limits.gpuBytes],['warm main preparation ms','prepareMs',limits.prepareMs],['warm upload bytes','uploadBytes',limits.uploadBytes],['ground bytes','groundBytes',limits.groundBytes],['stationary animated uploads','stationaryUploadBytes',0],['worker errors','workerErrors',0],['GL errors','glError',0],['fixed resolution violations','resolutionViolations',0]])check(name,key==='prepareMs'?(validPreparation&&Number.isFinite(on.peaks[key])?Math.max(on.peaks[key],preparation.max):null):on.peaks[key]??null,limit);
  check('grass CPU residency upper bound bytes',on.cpuResidencyUpperBoundBytes??null,limits.cpuBytes);
  const status=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='INCOMPLETE')?'INCOMPLETE':'PASS';
  return {status,matched,cpu,gpu,incrementalCpu,incrementalGpu,intervals,preparation,checks};
 }
 function certify(report,fixture){
  const checks=[],check=(name,ok)=>checks.push({name,status:ok===true?'PASS':ok===false?'FAIL':'INCOMPLETE'});
  const source=report.build?.sourceSha256,memory=report.cpuEvidence;
  check('unchanged H1 fixture',report.fixtureSha256===report.expectedFixtureSha256);
  check('stable served runtime and assets',!!source&&source===report.finalBuild?.sourceSha256&&report.build.assetSetSha256===report.finalBuild.assetSetSha256);
  check('complete source-bound CPU ownership evidence',memory?.sourceSha256===source&&memory.measurements?.length>=7&&memory.measurements.every(m=>m.assessment?.status==='PASS'&&m.assessment.sourceSha256===source&&Number.isFinite(m.assessment.upperBoundBytes)&&m.assessment.upperBoundBytes<=fixture.limits.cpuBytes));
  const windows=report.rawWindows||[],kinds=['stationary','walk','turn-elevation'];
  check('six complete production windows',windows.length===6&&kinds.every(kind=>[false,true].every(on=>windows.filter(w=>w.kind===kind&&w.on===on&&w.frames.length===fixture.frames&&w.stopReason==='complete').length===1)));
  const frames=windows.flatMap(w=>w.frames),ids=frames.map(f=>f.frameId);
  check('finite nonnegative CPU, preparation and interval samples throughout timing',frames.length===fixture.frames*6&&frames.every(f=>['cpuMs','prepareMs','intervalMs'].every(key=>Number.isFinite(f[key])&&f[key]>=0)));
  check('GPU identities unique across all six windows',frames.length===fixture.frames*6&&frames.every(f=>Number.isInteger(f.frameId)&&f.gpuValid===true&&Number.isFinite(f.gpuMs))&&new Set(ids).size===ids.length);
  check('live CPU owners complete throughout timing',windows.filter(w=>w.on).length===3&&windows.filter(w=>w.on).every(w=>w.frames.every(f=>f.cpuInventoryComplete===true)));
  check('page, worker and context errors absent',Array.isArray(report.errors)&&report.errors.length===0&&windows.every(w=>w.frames.every(f=>f.workerErrors===0&&f.glError===0)));
  const assessments=kinds.map(kind=>{const off=windows.find(w=>w.kind===kind&&!w.on),on=windows.find(w=>w.kind===kind&&w.on);return {kind,...(off&&on?assess(off,on,fixture.limits):{status:'INCOMPLETE'})};});
  const status=checks.some(c=>c.status==='FAIL')||assessments.some(a=>a.status==='FAIL')?'FAIL':checks.some(c=>c.status==='INCOMPLETE')||assessments.some(a=>a.status!=='PASS')?'INCOMPLETE':'PASS';
  return {status,checks,assessments};
 }
 const api={stats,assess,certify};if(typeof module!=='undefined')module.exports=api;root.SphereMeadowPerformance=api;
})(typeof window==='undefined'?globalThis:window);
