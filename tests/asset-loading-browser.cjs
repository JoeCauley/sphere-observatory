'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

(async()=>{
  const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext({viewport:{width:1040,height:680}});await host.attach(context);
    const page=await context.newPage(),requests=[],errors=[];
    page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/assets/biomes/'))requests.push(path);});
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(180000);
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    const ready=()=>page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    await ready();
    const startup=await page.evaluate(()=>{const r=SphereApp.renderer;return [r.biomes.allocated,r.heroes.allocated,r.worldTextures.allocated,r.woundTextures.allocated,r.gl.getError()];});
    assert(startup.every(v=>!v));await page.locator('[data-category=biomes]').click();
    for(const id of ['biome-2','biome-3']){
      await page.locator('#placeDestination').selectOption(id);
      await page.locator('#placeAltitude').selectOption('ground');
      await page.locator('#visitPlace').click();
      await page.waitForFunction(id=>SphereJourney.travel.status?.state==='arrived' && SphereApp.getState().siteId===id,id);
      await ready();
      const a=await page.evaluate(()=>({assets:SphereApp.renderer.renderInfo.assets,error:SphereApp.renderer.gl.getError()}));
      assert.equal(a.error,0);assert.deepEqual(requests,[]);
    }
    await page.evaluate(()=>{SphereApp.setPlaying(false);SphereSession.flush();});
    await page.reload({waitUntil:'domcontentloaded'});await ready();
    assert.equal(await page.evaluate(()=>SphereApp.getState().siteId),'biome-3');
    assert.equal(await page.evaluate(()=>SphereApp.getState().playing),false);
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    console.log('PASS procedural desert and winter ground, cold startup and saved-pose recovery without stock habitat requests');
  }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
