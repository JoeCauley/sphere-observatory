'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Drive the same poller used by the host with a clock that can skip UI turns.
// Stop before the following declaration so the host's DOM bootstrap never runs.
const host=fs.readFileSync(require.resolve('../stage-frame.js'),'utf8');
const start=host.indexOf('function waitForStage('),end=host.indexOf('function biomeArrival(',start);
assert(start>=0 && end>start);
const poller=new vm.Script(host.slice(start,end)+'\nsettled');

async function simulate({frames,signalAt,blockUI=false,fail=false,preparingGround=()=>false}){
  let now=0,sequence=0,result;
  const api={id:'violet-labyrinth',contract:'sphere-biome/1',
    inspect:()=>({frames:frames(now),preparingGround:preparingGround(now)})};
  const current={packId:api.id,frame:{contentWindow:{SphereBiome:api}}},timers=new Map();
  const setTimer=(callback,ms)=>{
    const id=++sequence;
    timers.set(id,{at:now+ms,callback});
    return id;
  };
  const wait=poller.runInNewContext({performance:{now:()=>now},current,frameError:()=>null,
    setTimeout:setTimer,clearTimeout:id=>timers.delete(id),takeover:Symbol(),issue:(status,phase)=>({status,phase})});
  api.ready=new Promise((resolve,reject)=>{
    if(signalAt)setTimer(()=>fail?reject(Error('Provider failed')):resolve('ready'),signalAt);
  });
  wait(current,{contract:true},1500).then(value=>{result=value;});
  while(timers.size && !result){
    const [id,job]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
    timers.delete(id);now=Math.max(now,job.at);
    if(blockUI && now>=200 && now<2000)now=2000;
    job.callback();
    await new Promise(resolve=>setImmediate(resolve));
  }
  return [result?.status,now];
}

(async()=>{
  const firstFrames=t=>t>1100?2:0;
  assert.deepEqual(await simulate({frames:()=>1}),['timeout',1600]);
  assert.deepEqual(await simulate({frames:firstFrames,signalAt:1850}),['ready',1850]);
  assert.deepEqual(await simulate({frames:()=>5,signalAt:2300,blockUI:true}),['ready',2300]);
  assert.deepEqual(await simulate({frames:firstFrames}),['timeout',4500]);
  assert.deepEqual(await simulate({frames:firstFrames,signalAt:1650,fail:true}),['load-failure',1650]);
  const cold={frames:t=>Number(t>=2200),signalAt:2200};
  assert.deepEqual(await simulate(cold),['timeout',1600]);
  assert.deepEqual(await simulate({...cold,preparingGround:t=>t<2200}),['ready',2200]);
  assert.deepEqual(await simulate({frames:()=>0,preparingGround:()=>true}),['timeout',3100]);
  console.log('PASS stalled frames time out, active native ground gets one bounded grace, and provider errors settle immediately');
})().catch(error=>{console.error(error);process.exitCode=1;});
