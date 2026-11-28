'use strict';
const assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const percentile=(data,p)=>{
  if(!data.length)return null;
  const sorted=[...data].sort((a,b)=>a-b);
  return +sorted[Math.max(0,Math.ceil(p*sorted.length)-1)].toFixed(3);
};
async function measuredSidestep(page,runMs){
  const element=await page.locator('#stageFrame iframe').elementHandle();
  const frame=await element.contentFrame();
  const measured=await frame.evaluate(async duration=>{
    const timer=window.__timing,base=window.SphereBiome.pose();
    if(!window.SphereBorderTrial)throw Error('Timing was requested outside the station');
    timer.begin();
    timer.move=elapsed=>window.SphereBorderTrial.place({...base,eastM:2600+1.2*Math.sin(elapsed/6000*2*Math.PI)});
    await new Promise(resolve=>setTimeout(resolve,duration));
    return timer.finish();
  },runMs);
  const pic=await page.evaluate(()=>trial.sample().picture);
  assert(measured.durationMs>=runMs-150,'Short timing interval');
  assert(measured.drawFrames>=measured.intervals.length*.9,'Fewer than 90% of frames drew the moving view');
  assert.equal(measured.glError,0);assert.equal(measured.contextLost,false);
  assert.equal(measured.disjoint,0,'GPU timer reset during a sample');
  if(measured.gpuAvailable)assert(measured.gpu.length>=measured.drawFrames*.9,'GPU queries did not cover the drawing frames');
  return {frames:measured.intervals.length,drawFrames:measured.drawFrames,durationMs:measured.durationMs,p95:percentile(measured.intervals,.95),
    p50:percentile(measured.intervals,.5),worst:percentile(measured.intervals,1),gpuP95:percentile(measured.gpu,.95),gpuSamples:measured.gpu.length,
    disjoint:measured.disjoint,queriesLost:measured.queriesLost,peakBytes:measured.peak,liveBytes:measured.live,pictureBytes:pic.bytes,
    cardBytes:pic.cardBytes,scratchBytes:pic.scratchBytes,mode:pic.mode,clipRect:pic.clipRect,cells:pic.cells,
    intervals:measured.intervals,gpu:measured.gpu};
}
async function walkCrossing(page,hold,quick){
  const startDepth=quick?24:120,finishDepth=-1;
  await page.evaluate(({startDepth,hold})=>{
    trial.settings({holdBorder:hold});
    trial.place({depth:startDepth,east:2600,yaw:Math.PI,pitch:.025});
    SphereStageFrame.setSurfacePace(1);
  },{startDepth,hold});
  await delay(1300);
  const before=await page.evaluate(()=>trial.location());
  assert(before.settled&&before.owner!=='sideways-city'&&Math.abs(before.depth-startDepth)<.1,'Walker did not start at the station mark');
  const canvas=()=>page.frameLocator('#stageFrame iframe').locator('canvas').first();
  await canvas().focus();
  await page.evaluate(()=>{
    const walk=window.__walk={on:true,frames:[],ownerChanges:[],positions:[],worstMotionGap:0};
    let lastFrame=0,lastAdvance=0,lastOwner='',previous=null;
    const sample=t=>{
      if(!walk.on)return;
      if(lastFrame)walk.frames.push(t-lastFrame);
      lastFrame=t;
      const f=document.querySelector('#stageFrame iframe'),owner=f?.dataset.locationId;
      if(f?.surfaceEntry?.active&&!document.querySelector('#departingStageFrame')&&f.contentWindow?.SphereBiome){
        const now=f.contentWindow.SphereBiome.pose(),p=[now.eastM,now.northM,now.altitudeM];
        if(lastOwner!==owner){walk.ownerChanges.push({owner,time:t});lastOwner=owner;}
        if(!previous||p.some((v,k)=>Math.abs(v-previous[k])>.00001)){if(lastAdvance)walk.worstMotionGap=Math.max(walk.worstMotionGap,t-lastAdvance);lastAdvance=t;previous=p;}
      }
      requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
  });
  const begin=Date.now(),owners=[before.owner],positions=[before];let focused=before.owner,last=before;
  await page.keyboard.down('KeyW');
  try{
    while(Date.now()-begin<(quick?45000:120000)){
      await delay(80);
      const loc=await page.evaluate(()=>trial.location());
      if(!loc.settled)continue;
      if(loc.owner!==owners.at(-1)){owners.push(loc.owner);positions.push({owner:last.owner,depth:last.depth},{owner:loc.owner,depth:loc.depth});}
      if(focused!==loc.owner){await page.keyboard.up('KeyW');await canvas().focus();await page.keyboard.down('KeyW');focused=loc.owner;}
      last=loc;if(loc.depth<=finishDepth)break;
    }
  }finally{await page.keyboard.up('KeyW');}
  const raw=await page.evaluate(()=>{window.__walk.on=false;return window.__walk;});
  assert(last.depth<=finishDepth,'Walker stopped at depth '+last.depth+' under '+last.owner);
  assert.deepEqual(owners,hold?[before.owner]:[before.owner,'sideways-city'],'Unexpected renderer sequence');
  return {seconds:(Date.now()-begin)/1000,owners,positions:[...positions,{owner:last.owner,depth:last.depth}],events:raw.ownerChanges,
    worstHitchMs:percentile(raw.frames,1),p95:percentile(raw.frames,.95),worstMotionGapMs:+raw.worstMotionGap.toFixed(2),
    frames:raw.frames.length,intervals:raw.frames};
}
module.exports={measuredSidestep,walkCrossing,percentile};
