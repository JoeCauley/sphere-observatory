// Measure the same public Visit controls a traveller uses in a fresh browser profile.
'use strict';
const fs=require('node:fs');
const {chromium}=require('playwright');
const {session,executable}=require('../tests/support/biome-browser.cjs');

(async()=>{
  const host=await session();
  const browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext({viewport:{width:1200,height:760}});
    await host.attach(context);
    const page=await context.newPage(),errors=[];
    page.setDefaultTimeout(240000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.visitSample={trips:[]};
      window.addEventListener('sphere-view-ready',()=>{visitSample.openingMs??=Math.round(performance.now());});
      document.addEventListener('click',event=>{if(event.target.id==='visitPlace')visitSample.click=performance.now();},true);
      window.addEventListener('sphere-travel-status',({detail})=>{
        if(['arrived','failed','committed-uncertain'].includes(detail.state))
          visitSample.trips.push({title:detail.title,state:detail.state,ms:Math.round(performance.now()-visitSample.click)});
      });
    });
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready);
    await page.getByRole('tab',{name:'Explore'}).click();
    await page.locator('#placeCategories [data-category="biomes"]').click();
    for(const [index,id] of ['biome-9','biome-0','biome-9'].entries()){
      await page.selectOption('#placeDestination',id);
      await page.selectOption('#placeAltitude','ground');
      await page.locator('#visitPlace').click();
      await page.waitForFunction(i=>visitSample.trips.length>i,index);
    }
    const result=await page.evaluate(()=>({openingMs:visitSample.openingMs,trips:visitSample.trips,
      gpu:SphereApp.renderer.device,webglError:SphereApp.renderer.gl.getError()}));
    if(result.webglError||errors.length||result.trips.some(t=>t.state!=='arrived'))throw Error(JSON.stringify({result,errors}));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready);
    result.reopenMs=await page.evaluate(()=>visitSample.openingMs);
    result.browser=browser.version();
    const record=JSON.stringify(result,null,2)+'\n';
    if(process.argv[2])fs.writeFileSync(process.argv[2],record);
    console.log(record);
  }finally{await browser.close();await host.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
