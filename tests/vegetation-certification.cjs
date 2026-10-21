'use strict';
const assert=require('node:assert/strict'),P=require('../meadow-performance.js');
const fixture={frames:2,limits:{frames:2,cpuP95Ms:6,incrementalCpuP95Ms:2,gpuP95Ms:14,incrementalGpuP95Ms:4,minimumFps:58,intervalP95Ms:18.5,intervalMaxMs:33.4,residentBlades:500000,submittedBlades:250000,drawCalls:32,gpuBytes:33554432,cpuBytes:67108864,prepareMs:2,uploadBytes:2097152,groundBytes:67108864}};
const source='a'.repeat(64),build={sourceSha256:source,assetSetSha256:'assets'},windows=[];
let id=0;
for(const on of [false,true])for(const kind of ['stationary','walk','turn-elevation'])windows.push({kind,on,frames:[0,1].map(i=>({frameId:++id,poseKey:kind+':'+i,windPhase:i,cpuMs:3,prepareMs:on?1:0,gpuMs:10,gpuValid:true,intervalMs:16.7,cpuInventoryComplete:true,workerErrors:0,glError:0,submittedBlades:10})),elapsedMs:33.4,stopReason:'complete',workerVerified:true,cpuResidencyUpperBoundBytes:100,peaks:{residentBlades:10,submittedBlades:10,drawCalls:4,gpuBytes:100,prepareMs:1,uploadBytes:0,groundBytes:1,stationaryUploadBytes:0,workerErrors:0,glError:0,resolutionViolations:0}});
const report={fixtureSha256:'fixture',expectedFixtureSha256:'fixture',build,finalBuild:build,cpuEvidence:{sourceSha256:source,measurements:Array.from({length:7},()=>({assessment:{status:'PASS',sourceSha256:source,upperBoundBytes:100}}))},errors:[],rawWindows:windows};
const copy=()=>structuredClone(report);
assert.equal(P.certify(report,fixture).status,'PASS');
let bad=copy();bad.cpuEvidence.sourceSha256='b'.repeat(64);assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.cpuEvidence.measurements[0].assessment.upperBoundBytes=fixture.limits.cpuBytes+1;assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.rawWindows[4].frames[0].cpuInventoryComplete=false;assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.rawWindows[2].frames[0].frameId=bad.rawWindows[0].frames[0].frameId;assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.rawWindows.pop();assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.rawWindows[3].peaks.prepareMs=2.01;assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.errors.push('worker fault');assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.finalBuild={...build,assetSetSha256:'changed'};assert.equal(P.certify(bad,fixture).status,'FAIL');
bad=copy();bad.fixtureSha256='changed';assert.equal(P.certify(bad,fixture).status,'FAIL');
for(const key of ['cpuMs','prepareMs','intervalMs'])for(const value of [undefined,null,NaN,Infinity,-1])for(const index of [0,3]){
 bad=copy();bad.rawWindows[index].frames[0][key]=value;
 const result=P.certify(bad,fixture);assert.equal(result.status,'FAIL','Invalid '+key+' in '+(index===0?'off':'on')+' arm must block certification');
 assert(result.checks.some(c=>c.name==='finite nonnegative CPU, preparation and interval samples throughout timing'&&c.status==='FAIL'));
}
bad=copy();bad.rawWindows[3].frames[0].prepareMs=2.01;bad.rawWindows[3].peaks.prepareMs=0;assert.equal(P.certify(bad,fixture).status,'FAIL','Stale summary cannot hide over-budget raw preparation');
console.log('PASS HR-09 source, ownership, limits, complete windows and cross-window GPU identity failures');
