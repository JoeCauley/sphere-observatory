const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const {executable}=require('../tools/playwright-browser.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER||executable()});
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
 const pageErrors=[],consoleErrors=[],timeout=Number(process.env.IB070_TIMEOUT_MS||60000);page.setDefaultTimeout(timeout);
 page.on('pageerror',error=>pageErrors.push(String(error.message||error)));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 const output=path.resolve('work/screenshots/ib070');fs.mkdirSync(output,{recursive:true});
 try{
  const base=process.env.SPHERE_URL||'http://127.0.0.1:8766/';
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereApp&&window.SpherePacks&&window.SphereWatershed&&window.SphereLoading,{timeout});
  await page.evaluate(()=>{
   const base={...SphereApp.getState(),layoutVersion:2,collection:true,era:'after',clouds:false,atmosphere:0,weatherStrength:0,richMaterials:false,localShadows:0,antialias:0,geometryDetail:true};
   const packed=SpherePacks.activate(base),f=SphereWatershed.frame(packed);let meadowDirection=null,meadowSample=null;
   for(let x=-280;x<=280&&!meadowDirection;x+=20)for(let z=-280;z<=280&&!meadowDirection;z+=20){const q=SphereWatershed.direction(x,z,packed),sample=SphereWatershed.sample(q,packed),field=SphereGeography.query(q,{state:packed,revision:'legacy',representation:'walking'}),density=SphereGrass.densityFactor(field,{meadowBlend:true});if(sample&&!sample.water.river&&!sample.water.basin&&!sample.service&&density>.1){meadowDirection=q;meadowSample=sample;}}
   if(!meadowDirection)throw Error('No open legacy Watershed grazing cell was found');
   const view=SphereWatershed.view(packed,'garden'),grazingForward=SphereMath.norm(SphereMath.add(f.basis[2],SphereMath.mul(f.basis[1],.38)));Object.assign(view,{position:SphereMath.mul(meadowDirection,packed.radius-Math.max(0,meadowSample.terrainKm)-.006),forward:grazingForward,up:f.basis[1],fov:80});
   SphereApp.setState({...view,playing:true,meadow:{enabled:true,nearRange:.32,middleRange:1.15,farRange:2.8,rootsPerSubcell:8,density:1,windStrength:.38,windClock:view.time,pausedClock:view.time,worker:false}});
   SphereLoading.ensureCurrent({initial:true,force:true});
  });
  await page.waitForFunction(()=>window.SphereLoading?.ready||window.SphereLoading?.error,{timeout});
  const loadingError=await page.evaluate(()=>SphereLoading.error);if(loadingError)throw Error('Full-app preparation failed: '+loadingError);
  const entry=await page.evaluate(()=>{const s=SphereApp.getState();return {provinceRevision:s.provinceRevision,packAddress:s.packAddress,serviceRole:SphereWatershed.sample(SphereMath.norm(s.position),s)?.service};});
  assert.equal(entry.provinceRevision,1);assert.equal(entry.packAddress?.geographyRevision,1);

  // This is the same validated state path used by scene import/session state;
  // no renderer-private population is injected into the application.
  await page.evaluate(()=>{const s=SphereApp.getState();if(!s.meadow?.enabled)SphereApp.setState({...s,playing:true,meadow:{enabled:true,nearRange:.32,middleRange:1.15,farRange:2.8,rootsPerSubcell:8,density:1,windStrength:.38,windClock:s.time,pausedClock:s.time,worker:false}});});
  await page.waitForFunction(()=>{const R=SphereApp.renderer,info=R.renderInfo||{},m=info.meadow||{},e=info.instancedEnvironment||{};return SphereApp.getState().meadow?.enabled&&!R.needsFrame&&m.nearPatches>0&&m.middlePatches>0&&e.drawCalls>0&&e.instances>0;});
  await page.waitForTimeout(500);
  let report=await page.evaluate(()=>{const R=SphereApp.renderer,draw=()=>R.draw(SphereApp.getState(),R.canvas.width,R.canvas.height);const roots=R.renderInfo?.meadow?.hash;draw();const settled=R.renderInfo?.instancedEnvironment?.frameUploadedBytes;return {rootHash:roots,settledFrameUploadedBytes:settled};});
  const liveA=await page.screenshot({path:path.join(output,'live-wind-a.png'),fullPage:false});
  report=Object.assign(report,await page.evaluate(()=>{const R=SphereApp.renderer,a=SphereApp.getState();SphereApp.setState({...a,playing:true,time:a.time+3});R.draw(SphereApp.getState(),R.canvas.width,R.canvas.height);return {afterLiveHash:R.renderInfo?.meadow?.hash};}));
  const liveB=await page.screenshot({path:path.join(output,'live-wind-b.png'),fullPage:false});
  report=Object.assign(report,await page.evaluate(()=>{const R=SphereApp.renderer,draw=()=>R.draw(SphereApp.getState(),R.canvas.width,R.canvas.height),b=SphereApp.getState(),paused={...b,playing:false,meadow:{...b.meadow,pausedClock:b.time}};SphereApp.setState(paused);draw();const pausedA=R.canvas.toDataURL();draw();const pausedB=R.canvas.toDataURL();const info=R.renderInfo||{},m=info.meadow||{},e=info.instancedEnvironment||{};return {state:SphereApp.getState(),meadow:m,instancedEnvironment:e,queue:R.needsFrame,webglError:R.error(),title:document.getElementById('viewTitle')?.textContent,pausedRepeat:pausedA===pausedB,nearInstances:R.meadow?.lastPopulation?.near.reduce((n,p)=>n+p.instances.length,0)||0,middleInstances:R.meadow?.lastPopulation?.middle.reduce((n,p)=>n+p.instances.length,0)||0};}));
  report.liveWindPixelsChanged=!liveA.equals(liveB);
  assert.equal(report.queue,false);assert(report.meadow.nearPatches>0&&report.meadow.middlePatches>0,'grazing view must contain near and middle meadow tiers');assert(report.nearInstances>0&&report.middleInstances>0,'grazing view must submit blades and cards');assert(report.instancedEnvironment.drawCalls>0&&report.instancedEnvironment.instances>0);assert.equal(report.settledFrameUploadedBytes,0,'unchanged settled frame uploads no meadow instance bytes');assert.equal(report.rootHash,report.afterLiveHash,'live wind must not move deterministic roots');assert(report.liveWindPixelsChanged,'live wind must visibly change rendered meadow pixels');assert(report.pausedRepeat,'paused meadow capture must repeat exactly');assert.equal(report.webglError,0);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);
  await page.screenshot({path:path.join(output,'grazing.png'),fullPage:false});
  fs.writeFileSync(path.join(output,'integration.json'),JSON.stringify({status:'PASS',entry,report,pageErrors,consoleErrors},null,2));
  console.log(JSON.stringify({status:'PASS',nearPatches:report.meadow.nearPatches,middlePatches:report.meadow.middlePatches,farPatches:report.meadow.farPatches,drawCalls:report.instancedEnvironment.drawCalls,instances:report.instancedEnvironment.instances,liveWindPixelsChanged:report.liveWindPixelsChanged,webglError:report.webglError,screenshot:path.join(output,'grazing.png')}));
 }catch(error){let snapshot=null;try{snapshot=await page.evaluate(()=>({loading:SphereLoading?.error,status:SphereJourney?.travel?.status,state:SphereApp?.getState?.(),render:SphereApp?.renderer?.renderInfo}));}catch{}console.error(error,snapshot||'');process.exitCode=1;
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
