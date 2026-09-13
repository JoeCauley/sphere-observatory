const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1800,height:1200},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
 await page.goto((process.env.SPHERE_URL||'http://127.0.0.1:8766/')+'atlas-study.html');await page.waitForFunction(()=>window.SphereAtlasStudyView?.ready);
 const dir=path.resolve('work/screenshots/atlas-study');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'forest-comparison.png'),fullPage:true});
 const initial=await page.evaluate(()=>[...document.querySelectorAll('canvas')].map(c=>c.toDataURL()));assert.equal(new Set(initial).size,12,'Each candidate and viewing scale must have its own drawing');
 const cases=[];for(const location of ['industrial','boundary','wound-a','wound-b','forest'])for(const layer of ['water','service','damage','composite']){
  await page.selectOption('#location',location);await page.selectOption('#layer',layer);const result=await page.evaluate(()=>({state:SphereAtlasStudyView.current,overflow:document.documentElement.scrollWidth>innerWidth,views:[...document.querySelectorAll('canvas[data-view]')].map(c=>JSON.parse(c.dataset.view))}));assert(!result.overflow);assert.equal(result.state.region,location);assert.equal(result.state.layer,layer);assert(result.views.every((v,i)=>JSON.stringify(v)===JSON.stringify(result.views[i%2])));cases.push({location,layer});
 }
 const download=page.waitForEvent('download');await page.click('#save');const file=await download,settings=JSON.parse(fs.readFileSync(await file.path()));assert.equal(settings.format,'sphere-atlas-design-study');assert.equal(settings.provinceExtentKm,640);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({cases,settings,errors},null,2));console.log('PASS 20 location/layer comparisons, 12 distinct maps, matched view rectangles, exported settings and mobile layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
