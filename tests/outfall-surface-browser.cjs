'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function main(){
  const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
  const dir=process.env.SPHERE_SURFACE_OUTPUT, errors=[], observations={};
  let page;
  if(dir)fs.mkdirSync(dir,{recursive:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await host.attach(context);
    page=await context.newPage();
    page.setDefaultTimeout(160000);
    page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
    const api=fn=>page.frameLocator('#stageFrame iframe').locator('body').evaluate(fn);
    const waitPose=fn=>page.waitForFunction(fn,null,{timeout:80000,polling:100});
    const shot=async name=>{
      const pixels=await api(()=>new Promise(resolve=>requestAnimationFrame(()=>{
        const gl=document.getElementById('world').getContext('webgl2'),rgba=new Uint8Array(4);
        gl.readPixels(gl.drawingBufferWidth>>1,gl.drawingBufferHeight>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
        resolve({lost:gl.isContextLost(),error:gl.getError(),rgba:[...rgba]});
      })));
      assert(!pixels.lost && pixels.error===0 && pixels.rgba[3]===255,name+' must paint a live WebGL frame');
      if(dir)await page.screenshot({path:path.join(dir,name+'.jpg'),type:'jpeg',quality:90});
    };
    const capture=async name=>{observations[name]=await api(()=>({pose:SphereBiome.pose(),state:SphereBiome.inspect()}));};
    await page.goto(host.origin+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('tab',{name:'Capture'}).click();
    await page.getByRole('tab',{name:'Capture'}).press('Home');
    await page.getByRole('button',{name:'Guide & assumptions'}).click();
    assert(await page.locator('#guide').isVisible());
    await page.locator('#closeGuide').click();
    await page.waitForFunction(()=>{
      if(document.querySelector('#loadingActions')?.hidden===false)throw Error(document.querySelector('#loadingStatus').textContent);
      return window.SphereLoading?.ready && window.SphereBiomeLibrary?.world;
    },null,{polling:100,timeout:240000});
    console.log('PASS opening tabs and Guide; the renderer and biome library are ready');
    await page.evaluate(async()=>{
      const s=SphereApp.getState();s.seed=713;SphereApp.setState(s);
      await SphereBiomeLibrary.selectWorld();
    });
    await page.waitForFunction(()=>SphereLoading.ready && SphereBiomeLibrary.world?.params.seed===713,null,{polling:100});
    await page.evaluate(()=>SphereBiomeLibrary.install('border-outfall'));
    await page.waitForFunction(()=>!!SphereStageFrame.surfaceAddress());
    observations.approach=await page.evaluate(async()=>{
      const pack=SphereBiomeLibrary.pack('infinite-meadow'),base=new URL('.',new URL(pack.entry,location.href));
      const kit=await import('./packs/kit/surface-route.js'),m=await import(new URL('model.js',base));
      const contract=await import('./packs/runtime/v1/contract.js'),manifest=await (await fetch(new URL('manifest.json',base))).json();
      const a=SphereStageFrame.surfaceAddress(),chart=kit.chartFor(a.home,a.edge,a.radiusKm);
      const state=m.initialState(),bookmark=m.saveState(state),datum=m.terrain(chart.eastM,chart.northM);
      const p={eastM:0,northM:kit.enterNorthM-140,altitudeM:45,yaw:0,pitch:0,mode:'flight'};
      state.pose=kit.toMeadow(p,chart,datum);
      const store=contract.createStore(manifest,SphereBiomeLibrary.saveStorage());
      store.write({state:JSON.parse(m.saveState(state)),bookmark:JSON.parse(bookmark)});
      return {edge:chart.edge,initialRangeM:kit.course(state.pose,chart).distanceM,originalBookmark:JSON.parse(bookmark).pose};
    });
    assert.equal(observations.approach.edge,'north/r10c0/r11c0');
    assert(Math.abs(observations.approach.initialRangeM-2540)<.01);
    await page.evaluate(()=>SphereStageFrame.open('infinite-meadow'));
    await capture('beforeCourse');
    await page.frameLocator('#stageFrame iframe').locator('#outfallCourse').click();
    await waitPose(()=>SphereStageFrame.lastArrival?.route==='surface' && SphereStageFrame.current?.id==='border-outfall');
    await capture('crossed');assert(observations.crossed.state.levelCruising);assert(Math.abs(observations.crossed.pose.eastM)<.02);
    console.log('PASS normal-speed Level Cruise crossed at the installed edge',observations.approach.edge);
    await page.waitForFunction(()=>{const a=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;
      return a && !a.inspect().levelCruising && a.pose().northM>-19;},null,{timeout:120000});
    await capture('atWall');assert(Math.abs(observations.atWall.pose.northM+18)<.05);
    await shot('cruise-arrival');
    const frame=page.frameLocator('#stageFrame iframe');
    await frame.locator('#world').focus();await page.keyboard.down('KeyQ');
    try{await waitPose(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<5);}
    finally{await page.keyboard.up('KeyQ');}
    await page.keyboard.press('KeyF');await page.keyboard.down('KeyW');
    try{await waitPose(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().northM>=11);}
    finally{await page.keyboard.up('KeyW');}
    assert(await frame.locator('#action').isVisible());await frame.locator('#action').click();
    await frame.locator('#save').click();await capture('atValve');assert.equal(observations.atValve.state.valveOpen,false);
    await shot('valve');
    await page.locator('[data-category=machinery]').click();await page.locator('#placeDestination').selectOption('works-0');
    await page.locator('#placeAltitude').selectOption('ground');
    await page.locator('#visitPlace').click();
    await page.waitForFunction(()=>!SphereStageFrame.current && !SphereJourney.travel.active &&
      ['arrived','failed','cancelled'].includes(SphereJourney.travel.status.state),null,{polling:100,timeout:240000});
    const result=await page.evaluate(()=>SphereJourney.travel.status);
    assert.equal(result.state,'arrived',JSON.stringify(result));
    assert.match(await page.locator('#locationName').textContent(),/Thermal routing/i);
    console.log('PASS walked through the entrance, operated the valve and visited Thermal routing from the sidebar');
    const saved=await page.evaluate(()=>JSON.parse(SphereBiomeLibrary.saveStorage().getItem(SphereBiomeLibrary.pack('border-outfall').saveKey)));
    assert.equal(saved.open,false);assert.equal(saved.bookmark.mode,'walk');
    await page.evaluate(()=>SphereStageFrame.open('border-outfall'));
    await capture('restored');assert.deepEqual(observations.restored.pose,observations.atValve.pose);assert.equal(observations.restored.state.valveOpen,false);
    await page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:/^The Outfall /})}).getByRole('button',{name:'View from above'}).click();
    await page.waitForFunction(()=>!SphereStageFrame.current && !SphereJourney.travel.active);
    // Walk the old end of the gallery and fly the exterior at both signs of x.
    // Use the ordinary save reader for these poses so no live explorers are moved.
    async function placeAt(pose){
      await page.evaluate(p=>{
        const store=SphereBiomeLibrary.saveStorage(),key=SphereBiomeLibrary.pack('border-outfall').saveKey;
        const record=JSON.parse(store.getItem(key));record.pose=p;store.setItem(key,JSON.stringify(record));
        return SphereStageFrame.open('border-outfall');
      },pose);
    }
    for(const [name,x,z,y,pitch] of [['gallery-east',1004,38,1.7,-.08],['wall-west',-12000,-4,1.7,.04],['wall-east',1500000,-16,8,.10]]){
      await placeAt({eastM:x,northM:z,altitudeM:y,yaw:1.54,pitch,mode:y===1.7?'walk':'flight'});
      await shot(name);await capture(name);assert.equal(observations[name].pose.eastM,x);
      if(name==='gallery-east'){
        const floor=await api(()=>new Promise(resolve=>requestAnimationFrame(()=>{
          const gl=document.getElementById('world').getContext('webgl2'),rgba=new Uint8Array(4);
          const samples=[.25,.5,.75].map(x=>{
            gl.readPixels(Math.floor(gl.drawingBufferWidth*x),Math.floor(gl.drawingBufferHeight*.2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
            return [...rgba];
          });
          resolve(samples);
        })));
        assert(floor.every(([r,g,b,a])=>a===255 && g>r && g<110 && b<110),'The far gallery floor must cover the bright exterior sky');
      }
      await page.evaluate(()=>SphereStageFrame.showMain());
    }
    await placeAt({eastM:-73,northM:-2795,altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'});
    await page.frameLocator('#stageFrame iframe').locator('#world').focus();await page.keyboard.down('KeyW');
    try{await waitPose(()=>SphereStageFrame.lastArrival?.route==='surface' && SphereStageFrame.current?.id==='infinite-meadow');}
    finally{await page.keyboard.up('KeyW');}
    await capture('walkedBack');assert.equal(observations.walkedBack.pose.mode,'walk');
    assert(observations.walkedBack.state.rangeM>2790 && observations.walkedBack.state.rangeM<2820);
    console.log('PASS restored the bookmarked valve, viewed the border from above, inspected the old ends and walked back into Meadow');
    assert.deepEqual(errors,[]);
    if(dir)fs.writeFileSync(path.join(dir,'surface-browser.json'),JSON.stringify({observations,errors},null,2));
  }catch(error){
    if(page && !page.isClosed()){
      const state=await page.evaluate(()=>({loading:document.querySelector('#loadingStatus')?.textContent,
        ready:window.SphereLoading?.ready,world:window.SphereBiomeLibrary?.world?.params,
        journey:window.SphereJourney?.travel.status,stage:window.SphereStageFrame?.current?.id,
        ground:window.SphereGround?.info,glLost:window.SphereApp?.renderer.gl.isContextLost()})).catch(()=>null);
      console.error('Observatory at failure',JSON.stringify(state));
    }
    throw error;
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
