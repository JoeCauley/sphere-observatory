'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');
const {replayFrame}=require('../tools/replay-pilot-frame.cjs');

(async()=>{
  const server=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  let page;
  try{
    const context=await browser.newContext({viewport:{width:1180,height:740}});
    await server.attach(context);
    page=await context.newPage();
    page.setDefaultTimeout(180000);
    await page.goto(server.origin+'/?border=wall',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && SphereStageFrame.transportAddress()?.rows.length);
    console.log('Loaded the Meadow frontage');
    await page.evaluate(async()=>{
      const stage=SphereStageFrame,lib=SphereBiomeLibrary,row=stage.transportAddress().rows.find(r=>r.site.bay===0);
      const {station}=await stage.stationExterior(row.site.address,lib.persistence==='file');
      const service=station.routes.find(r=>r.id==='service');
      const pose={eastM:row.site.x+service.nearDoor[0],northM:-station.widthM/2+42,altitudeM:1.7,
        yaw:Math.PI,pitch:0,mode:'walk'};
      const arrival=await stage.open('border-transport',{entry:{pose,geographic:true,active:false,horizontalFov:72}});
      if(arrival.status!=='arrived')throw Error('Could not open the station');
      stage.setSurfacePace(16);
    });
    await page.locator('#atlasPlaces summary').click();
    const button=page.locator('#pilotTrace');
    await button.click();
    await page.waitForFunction(()=>document.getElementById('pilotTrace').textContent.startsWith('Stop'));
    console.log('Recording from the station');
    await page.keyboard.down('KeyW');
    try{
      await page.waitForFunction(()=>{
        const status=document.getElementById('biomeLibraryStatus')?.textContent;
        if(status?.startsWith('Surface crossing paused'))throw Error(status);
        return SphereStageFrame.current?.id==='infinite-meadow' && document.querySelector('#stageFrame iframe')?.surfaceEntry?.active;
      },null,{timeout:45000});
    }finally{await page.keyboard.up('KeyW');}
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const pending=page.waitForEvent('download');
    await button.click();
    const download=await pending,trace=JSON.parse(await fs.readFile(await download.path(),'utf8'));
    if(process.env.SPHERE_PILOT_TRACE_OUTPUT)await fs.writeFile(process.env.SPHERE_PILOT_TRACE_OUTPUT,JSON.stringify(trace));
    assert.equal(trace.format,'sphere-pilot-trace');
    assert.equal(trace.endReason,'pilot');
    assert.equal(trace.initial.seed,713);
    assert(trace.frames.every((p,i)=>!i || p.ms>=trace.frames[i-1].ms));
    function recordedBorder(p){
      return ['stage','departing'].find(role=>p[role]?.id==='border-transport' && p[role].pose && p[role].horizontalFov===72);
    }
    const index=trace.frames.findIndex(p=>p.keys.includes('KeyW') && recordedBorder(p));
    assert(index>=0,'The pilot trace missed the departing Border camera while W was held');
    assert(trace.frames.some(p=>p.stage?.id==='infinite-meadow' && p.stage.active && p.stage.pose));
    assert(trace.frames.some(p=>p.departing?.id==='border-transport' && p.departing.pose));
    assert(trace.frames.every(p=>p.main.position.length===3 && Number.isFinite(p.main.time)));
    assert.equal(await button.textContent(),'Record flight or walk');
    // Restore a moving pre-crossing camera after the original route has entered Meadow.
    const role=recordedBorder(trace.frames[index]),expected=trace.frames[index][role].pose;
    const restored=await replayFrame(page,trace,index,role);
    assert.equal(restored.id,'border-transport');
    for(const key of ['eastM','northM','altitudeM','yaw','pitch'])assert(Math.abs(expected[key]-restored.pose[key])<.001,key);
    console.log('Saved manual route through the service door',trace.frames.length,'camera samples; restored frame',index);
  }catch(error){
    if(process.env.SPHERE_PILOT_TRACE_OUTPUT && await page?.locator('#pilotTrace').textContent().catch(()=>'' )==='Stop and save route trace'){
      const pending=page.waitForEvent('download',{timeout:5000});
      await page.evaluate(()=>document.getElementById('pilotTrace').click());
      const failedTrace=await pending;
      await fs.copyFile(await failedTrace.path(),process.env.SPHERE_PILOT_TRACE_OUTPUT);
    }
    console.error('Last pilot status',await page?.evaluate(()=>({status:document.getElementById('pilotTraceStatus')?.textContent,
      owner:window.SphereStageFrame?.current,pose:document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.pose?.(),
      travel:document.getElementById('biomeLibraryStatus')?.textContent,curtain:document.getElementById('travelCurtain')?.textContent,
      loading:document.getElementById('loadingStatus')?.textContent})).catch(()=>null));
    throw error;
  }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
