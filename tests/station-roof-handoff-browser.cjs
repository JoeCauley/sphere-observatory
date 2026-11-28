'use strict';

const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

// Walk from the exposed Bay 0 corner into native Super Jungle flight. Release
// the movement key during preparation, then reverse as the first native input.
(async()=>{
  const server=await session();
  const browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext({viewport:{width:1120,height:720}});
    await server.attach(context);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(100000);
    await page.goto(server.origin+'/?border=wall',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows.length,
      null,{timeout:240000});
    const fixture=await page.evaluate(async()=>{
      const stage=SphereStageFrame,app=SphereApp,lib=SphereBiomeLibrary,border=lib.entry('border-transport');
      const row=stage.transportAddress().rows.find(row=>row.site.bay===0);
      const {station}=await stage.stationExterior(row.site.address,lib.persistence==='file');
      const geo=await import('/geographic-flight.js'),side=stage.stationHabitats(border.transport,station).indexOf(2)===1?1:-1;
      const roof=station.roofM+geo.roofSlabM+1.7,lip=station.widthM/2,angle=side>0?.24:Math.PI-.24;
      app.setPlaying(false);
      app.chooseFlightSpeed(false,.06);
      const p={eastM:row.site.x+geo.hallHalfM-22,northM:side*(lip-.4),altitudeM:roof,
        yaw:angle,pitch:0,mode:'walk'};
      const result=await stage.open(border.id,{entry:{geographic:true,active:false,pose:p,horizontalFov:103}});
      if(result?.status!=='arrived')throw Error(result?.detail||result?.status);
      stage.setSurfacePace(1);
      window.roofRead=()=>{
        const el=document.querySelector('#stageFrame iframe'),api=el?.contentWindow?.SphereBiome;
        if(document.querySelector('#departingStageFrame') || el && (!api || !el.surfaceEntry?.active))return null;
        const state=app.getState(),local=el?api.pose():geo.packPose(state,border,SphereAtlas,SphereWorld);
        return {owner:el?api.id:'native',mode:local.mode,height:local.altitudeM,depth:lip-side*local.northM,
          yaw:local.yaw,pitch:local.pitch,fov:el?el.surfaceEntry.horizontalFov:state.fov,
          held:!!el && stage.stationFrameHeld(el.contentWindow),air:api?.environment()?.air};
      };
      return {roof,angle};
    });
    const read=()=>page.evaluate(()=>roofRead());
    const wait=async predicate=>{
      try{await page.waitForFunction(predicate,null,{polling:'raf',timeout:75000});}
      catch(error){throw Error(error.message+' '+JSON.stringify(await page.evaluate(()=>({
        camera:roofRead(),phase:document.querySelector('#transitPhase')?.textContent,
        status:document.querySelector('#biomeLibraryStatus')?.textContent}))));}
    };
    const start=await read();
    assert.equal(start.mode,'walk');assert.equal(start.air,'vacuum');
    await page.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
    await page.keyboard.down('KeyW');
    try{await wait(()=>{const p=roofRead();return p?.held || p?.owner==='native';});}
    finally{await page.keyboard.up('KeyW');}
    await wait(()=>roofRead()?.owner==='native');
    const outside=await read();
    assert.equal(outside.mode,'flight');
    assert(outside.depth<0,JSON.stringify(outside));
    // Take the entire return across the edge in one flight step. A second
    // outside step would clear the stale re-entry suppression on older builds.
    await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,1.8));
    await page.keyboard.down('KeyS');
    try{await wait(()=>roofRead()?.owner==='border-transport');}
    finally{await page.keyboard.up('KeyS');}
    const back=await read();
    assert.equal(back.mode,'flight');assert.equal(back.air,'vacuum');
    assert(back.depth>=-.01,JSON.stringify(back));
    for(const p of [outside,back]){
      assert(Math.abs(p.height-fixture.roof)<.04,JSON.stringify(p));
      const turn=p.yaw-fixture.angle;
      assert(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<.001 && Math.abs(p.pitch)<.001,JSON.stringify(p));
      assert(Math.abs(p.fov-103)<.001,JSON.stringify(p));
    }
    await page.keyboard.press('KeyF');
    await wait(()=>roofRead()?.mode==='walk');
    assert(Math.abs((await read()).height-fixture.roof)<.001);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({start,outside,back,landed:await read()}));
  }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
