'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),P=require('../meadow-performance.js');
const limits={frames:2,cpuP95Ms:6,incrementalCpuP95Ms:2,gpuP95Ms:14,incrementalGpuP95Ms:4,minimumFps:58,intervalP95Ms:18.5,intervalMaxMs:33.4,residentBlades:500000,submittedBlades:250000,drawCalls:32,gpuBytes:32*1048576,cpuBytes:64*1048576,prepareMs:2,uploadBytes:2*1048576,groundBytes:64*1048576};
const off={frames:[0,1].map(i=>({frameId:i,windPhase:i,workerAlive:true,poseKey:String(i),cpuMs:2,prepareMs:0,gpuMs:8,gpuValid:true,intervalMs:16.7}))},on={frames:off.frames.map(f=>({...f,frameId:f.frameId+100,cpuMs:3,prepareMs:1,gpuMs:10})),elapsedMs:33.4,peaks:{residentBlades:1,submittedBlades:1,drawCalls:1,gpuBytes:1,prepareMs:1,uploadBytes:0,groundBytes:1,stationaryUploadBytes:0,workerErrors:0,glError:0,resolutionViolations:0},cpuResidencyUpperBoundBytes:100};
on.workerVerified=true;
assert.equal(P.assess(off,on,limits).status,'PASS');
assert.equal(P.assess(off,{...on,frames:on.frames.map(f=>({...f,gpuMs:null,gpuValid:false}))},limits).status,'INCOMPLETE');
assert.equal(P.assess(off,{...on,frames:[{...on.frames[0],poseKey:'other'},on.frames[1]]},limits).status,'FAIL');
assert.equal(P.assess(off,{...on,frames:on.frames.map(f=>({...f,intervalMs:40}))},limits).status,'FAIL');
assert.equal(P.assess(off,{...on,peaks:{...on.peaks,stationaryUploadBytes:32}},limits).status,'FAIL');
assert.equal(P.assess(off,{...on,cpuResidencyUpperBoundBytes:null},limits).status,'INCOMPLETE');
assert.equal(P.assess(off,{...on,frames:on.frames.map(f=>({...f,windPhase:0}))},limits).status,'FAIL');
assert.equal(P.assess(off,{...on,workerVerified:false},limits).status,'FAIL');
assert.equal(P.assess(off,{...on,frames:on.frames.map(f=>({...f,frameId:100}))},limits).status,'INCOMPLETE');
for(const key of ['cpuMs','prepareMs','intervalMs'])for(const value of [undefined,null,NaN,Infinity,-1])for(const arm of ['off','on']){
 const control=structuredClone(off),measured=structuredClone(on);(arm==='off'?control:measured).frames[0][key]=value;
 const result=P.assess(control,measured,limits);assert.notEqual(result.status,'PASS',arm+' '+key+' '+String(value)+' must not disappear from statistics');
 assert(result.checks.some(c=>c.name==='complete finite '+(key==='cpuMs'?'CPU':key==='prepareMs'?'preparation':'interval')+' samples'&&c.status==='INCOMPLETE'));
 if(key==='cpuMs')assert.equal(result.cpu.count+result.incrementalCpu.count,0);if(key==='intervalMs')assert.equal(result.intervals.count,0);
}
assert.equal(P.assess(off,{...on,frames:[{...on.frames[0],prepareMs:2.01},on.frames[1]],peaks:{...on.peaks,prepareMs:0}},limits).status,'FAIL','Raw preparation above budget cannot be hidden by a stale peak');
assert.equal(P.stats([]).p95,null);
// A completed query is consumed once; a disjoint event invalidates every
// outstanding query, including one whose result is not yet available.
const context={SphereMath:{},window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../renderer.js'),'utf8'),context);
let disjoint=false,available=false,deleted=0;const q={},r={timer:{GPU_DISJOINT_EXT:1},gl:{QUERY_RESULT_AVAILABLE:2,QUERY_RESULT:3,getParameter:()=>disjoint,getQueryParameter:(_,p)=>p===2?available:12000000,deleteQuery:()=>deleted++},queries:[q],timerFrameIds:new WeakMap([[q,17]])};
const poll=context.window.SphereRenderer.prototype.pollTimers;
poll.call(r);assert.equal(r.gpuTimerSamples.length,0);available=true;poll.call(r);assert.equal(r.gpuTimerSamples[0].frameId,17);assert.equal(r.gpuTimerSamples[0].ms,12);poll.call(r);assert.equal(r.gpuTimerSamples.length,0);assert.equal(deleted,1);
r.queries=[q];available=false;disjoint=true;poll.call(r);assert.equal(r.gpuTimerSamples[0].valid,false);assert.equal(r.gpuMs,null);assert.equal(r.queries.length,0);
console.log('PASS H assessment, unavailable evidence, matched poses and fresh/disjoint GPU queries');
