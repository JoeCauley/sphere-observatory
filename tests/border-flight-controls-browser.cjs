// Exercise the sidebar and the two independent Border movement loops with held keys.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {disposable}=require('./support/observatory-server.cjs');
const {executable}=require('./support/biome-browser.cjs');

(async()=>{
  const host=await disposable(process.env.SPHERE_TEST_TRANSPORT||'http'),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
    await host.attach(page.context());
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(300000);
    const ready=()=>page.waitForFunction(()=>window.SphereLoading?.ready && SphereBiomeLibrary.world && document.querySelector('#speedMode'),null,{timeout:300000});
    const border='border-transport',outfall=border+'/outfall';
    await page.goto(host.origin,{waitUntil:'commit'});await ready();
    await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary,store=lib.saveStorage();
      const b=await lib.install('border-transport'),s=b.transport.sites.find(site=>site.bay===0);
      const {roofSlabM}=await import('/packs/border-transport/0.10.0/district.mjs');
      const {roofM}=await import('/packs/kit/border-profile.js');
      const pose={eastM:s.x+2200,northM:s.widthM*.3,altitudeM:s.roofM+roofSlabM+3.7,yaw:Math.PI/2,pitch:0,mode:'flight'};
      store.setItem(lib.sceneInfo(b.id).saveKey,JSON.stringify({schema:1,pose,group:'service'}));
      const facility={...pose,eastM:5000,northM:3000,altitudeM:roofM+3.7};
      store.setItem(lib.sceneInfo(b.outfall.id).saveKey,JSON.stringify({schema:1,pose:facility,bookmark:facility,open:true,levels:[1,1,1]}));
      document.querySelector('#exactPosition').open=true;
    });
    const mode=page.locator('#speedMode'),speed=page.locator('#speed');
    const open=async id=>{
      await page.evaluate(id=>SphereStageFrame.open(id),id);
      await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.environment?.().air==='vacuum');
      return page.frameLocator('#stageFrame iframe').locator('canvas').first();
    };
    const measure=async(canvas,cap)=>{
      await canvas.focus();await page.keyboard.down('KeyW');
      try{return await canvas.evaluate(async(_,cap)=>{
        const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
        await frame();
        let previous=await frame(),elapsed=0;
        const start=SphereBiome.pose();
        for(let i=0;i<48;i++){const t=await frame();elapsed+=Math.min(cap,(t-previous)/1000);previous=t;}
        const p=SphereBiome.pose();
        return Math.hypot(p.eastM-start.eastM,p.northM-start.northM,p.altitudeM-start.altitudeM)/elapsed;
      },cap);}finally{await page.keyboard.up('KeyW');}
    };
    await mode.selectOption('manual');await speed.selectOption('0.0028');
    let canvas=await open(outfall);
    const slowOutfall=await measure(canvas,.10);
    await speed.selectOption('0.02');
    const fastOutfall=await measure(canvas,.10);
    // Read the actual front buffer before the browser presents it. Sky above the
    // roof must let Main through while the concrete below must cover it.
    const pixels=await canvas.evaluate(c=>new Promise(resolve=>requestAnimationFrame(()=>{
      const gl=c.getContext('webgl2'),rgba=new Uint8Array(4);
      const alpha=y=>{gl.readPixels(c.width>>1,Math.floor(c.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return rgba[3];};
      resolve({sky:alpha(.8),roof:alpha(.2),error:gl.getError(),native:parent.SphereApp.renderer.gl.drawingBufferWidth,
        width:frameElement.clientWidth,opacity:frameElement.style.opacity,background:getComputedStyle(document.body).backgroundColor});
    })));
    assert.equal(pixels.sky,0);assert.equal(pixels.roof,255);assert.equal(pixels.error,0);
    assert.equal(pixels.background,'rgba(0, 0, 0, 0)');assert(+pixels.opacity>.99 && pixels.native>0);
    await page.evaluate(()=>SphereStageFrame.close());canvas=await open(border);
    assert.equal(await speed.inputValue(),'0.02');const fastBorder=await measure(canvas,.12);
    await mode.selectOption('auto');
    const autoBorder=await measure(canvas,.12);
    await page.evaluate(()=>SphereStageFrame.close());canvas=await open(outfall);
    const autoOutfall=await measure(canvas,.10);
    await page.evaluate(()=>SphereStageFrame.close());
    await page.reload({waitUntil:'commit'});await ready();
    assert.equal(await mode.inputValue(),'auto');assert.equal(await speed.inputValue(),'0.02');
    await page.evaluate(()=>{document.querySelector('#exactPosition').open=true;});
    await mode.selectOption('manual');await speed.selectOption('0.0028');
    await page.goto(host.origin+'/?border=wall',{waitUntil:'commit'});await ready();
    assert.equal(await mode.inputValue(),'manual');assert.equal(await speed.inputValue(),'0.0028');
    // Descend through the open cut with the same Q / F / W controls as a player.
    await mode.selectOption('auto');
    const tunnel=await page.evaluate(async()=>{
      const stage=SphereStageFrame,entry=SphereBiomeLibrary.entry('border-transport');
      const site=entry.transport.sites.find(s=>s.bay===0);
      const {station}=await stage.stationExterior(site.address,SphereBiomeLibrary.persistence==='file');
      const heavy=station.routes[2];
      stage.setSurfacePace(16);
      const pose={eastM:site.x+heavy.nearDoor[0],northM:station.laneHalfM+32,
        altitudeM:22,yaw:Math.PI,pitch:0,mode:'flight'};
      const result=await stage.open(entry.id,{entry:{geographic:true,active:false,pose,horizontalFov:72}});
      if(result.status!=='arrived')throw Error('Could not enter the station cut: '+result.status);
      return {floor:heavy.points[2][1],edge:station.laneHalfM};
    });
    const stationFrame=page.frameLocator('#stageFrame iframe'),stationCanvas=stationFrame.locator('canvas').first();
    await stationCanvas.focus();
    await page.keyboard.down('KeyQ');
    try{await page.waitForFunction(floor=>{
      const p=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose();
      return Math.abs(p.altitudeM-1.7-floor)<.01;
    },tunnel.floor,{timeout:15000});}finally{await page.keyboard.up('KeyQ');}
    await page.keyboard.press('KeyF');
    await page.keyboard.down('KeyW');
    try{await page.waitForFunction(edge=>{
      const p=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose();
      return p.mode==='walk' && p.northM<edge-8;
    },tunnel.edge,{timeout:15000});}finally{await page.keyboard.up('KeyW');}
    assert.equal(await stationCanvas.evaluate(()=>SphereBiome.pose().altitudeM),tunnel.floor+1.7);
    console.log('Landed in the open heavy-haul cut and walked below the freight slab',tunnel);
    const speeds={slowOutfall,fastOutfall,fastBorder,autoBorder,autoOutfall};
    for(const [actual,target] of [[slowOutfall,2.8],[fastOutfall,20],[fastBorder,20]])assert(Math.abs(actual-target)<.07*target,JSON.stringify(speeds));
    for(const actual of [autoBorder,autoOutfall])assert(actual>=7.9&&actual<=10,JSON.stringify(speeds));
    assert.deepEqual(errors,[]);console.log('PASS roof speeds in metres per simulation second, sidebar persistence and exposed Outfall sky',speeds,pixels);
  }finally{await browser.close();await host.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
