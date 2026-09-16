// Capture the actual interface after journeys made through visible controls.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../examples/observatory');
(async()=>{
 const options={headless:true,executablePath:process.env.SPHERE_BROWSER,viewport:{width:1600,height:1000}};
 const browser=process.env.SPHERE_PROFILE?await chromium.launchPersistentContext(path.resolve(process.env.SPHERE_PROFILE),options):await chromium.launch(options);
 try{
  const page=await browser.newPage(),errors=[],shots=[];page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.clear());await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);
  const visit=async(category,id,arrival)=>{await page.locator('[data-tab=camera]').click();await page.locator('[data-category='+category+']').click();await page.locator('#placeDestination').selectOption(id);await page.locator('#placeAltitude').selectOption(arrival);await page.locator('#visitPlace').click();await page.waitForFunction(()=>!SphereJourney.travel.active&&SphereJourney.travel.status.state==='arrived'&&!SphereApp.busy);};
  const capture=async id=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const file=path.join(dir,id+'.png');await page.screenshot({path:file});shots.push({id,file:id+'.png',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),location:await page.locator('#locationName').textContent()});console.log('Captured interface',id);};
  await visit('biomes','biome-0','ground');await page.waitForFunction(()=>{const s=SphereApp.getState();return s.walkMode&&Math.abs(s.walkVelocity)<1e-9&&SphereLanding.heightAboveGround(s)<.002;});await capture('interface-explore');
  await visit('biomes','biome-3','clouds');await visit('watersheds','watershed','garden');await page.locator('[data-tab=journey]').click();await capture('interface-journey');
  await page.locator('[data-tab=photo]').click();await page.locator('#captureTitle').fill('River gardens · a place to return to');await page.locator('#exportSize').selectOption('3840');await capture('interface-capture');
  const state=await page.evaluate(()=>({build:SphereBuild,device:SphereApp.renderer.device,error:SphereApp.renderer.error()}));assert.equal(state.error,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(dir,'interface.json'),JSON.stringify({capturedAt:new Date().toISOString(),viewport:options.viewport,method:'Browser screenshots of the running app, journeys made through visible controls',...state,shots,errors},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
