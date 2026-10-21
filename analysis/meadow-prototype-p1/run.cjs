'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const cfg=require('./last-run.json'),diagnostics=require('./browser-diagnostics.cjs'),H=require(path.join(cfg.runtime,'tests/fixtures/meadow-performance-h1.json')),E=require(path.join(cfg.runtime,'tests/fixtures/meadow-e-visual-exit-v2.json'));
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=path.join(cfg.evidence,'browser-'+stamp),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'source'));
const ownedTemporary=path.join(cfg.work,'browser-temp');fs.mkdirSync(ownedTemporary,{recursive:true});
process.env.TEMP=ownedTemporary;process.env.TMP=ownedTemporary;process.env.TMPDIR=ownedTemporary;
const sources=[];
for(const name of fs.readdirSync(__dirname))if(/\.(js|cjs)$/.test(name)){const bytes=fs.readFileSync(path.join(__dirname,name));fs.writeFileSync(path.join(out,'source',name),bytes,{flag:'wx'});sources.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(sources,null,2)+'\n',{flag:'wx'});
for(const name of ['canopy-p1.js','tile-planner-p1.js'])if(fs.existsSync(path.join(__dirname,name)))fs.copyFileSync(path.join(__dirname,name),path.join(cfg.runtime,'prototype',name));
const report={schema:1,profile:cfg.profile,status:'INCOMPLETE',scope:'Authorized isolated experiments D0/D1; no promotion, requirements or acceptance changes',baselineBuild:cfg.baselineBuild,sourceManifest:sources,errors:[],experiments:{}};
const save=()=>fs.writeFileSync(path.join(out,'run.json'),JSON.stringify(report,null,2)+'\n');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
 if(name==='/build-info.json')return res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(require(path.join(cfg.runtime,'build-info.cjs'))(cfg.runtime)));
 if(name==='/raf.html')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>Owned RAF diagnostic</title><canvas width="1920" height="1080"></canvas>');
 const file=path.resolve(cfg.runtime,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(cfg.runtime+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(error,bytes)=>{if(error)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);});
});
async function noop(browser,base){
 const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto(base+'raf.html');
 const result=await page.evaluate(async()=>{const raf=[],starts=[];await new Promise(resolve=>{function next(time){raf.push(time);starts.push(performance.now());if(raf.length===361)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);});return {frames:360,elapsedMs:raf.at(-1)-raf[0],fps:360000/(raf.at(-1)-raf[0]),raf,starts,visibility:document.visibilityState};});
 await page.close();return result;
}
async function heap(page,browser){
 const session=await page.context().newCDPSession(page),bs=await browser.newBrowserCDPSession(),main=await session.send('Runtime.getHeapUsage'),workers=[];
 for(const target of (await bs.send('Target.getTargets')).targetInfos.filter(t=>t.type==='worker')){
  let id;try{
   id=(await bs.send('Target.attachToTarget',{targetId:target.targetId,flatten:false})).sessionId;
   const usage=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{bs.off('Target.receivedMessageFromTarget',handler);reject(Error('worker heap timeout'));},3000);function handler(event){if(event.sessionId!==id)return;const message=JSON.parse(event.message);if(message.id!==1)return;clearTimeout(timer);bs.off('Target.receivedMessageFromTarget',handler);message.error?reject(Error(message.error.message)):resolve(message.result);}bs.on('Target.receivedMessageFromTarget',handler);bs.send('Target.sendMessageToTarget',{sessionId:id,message:JSON.stringify({id:1,method:'Runtime.getHeapUsage'})}).catch(reject);});workers.push({url:target.url,usage});
  }catch(error){workers.push({url:target.url,error:error.message});}finally{if(id)await bs.send('Target.detachFromTarget',{sessionId:id});}
 }
 await session.detach();await bs.detach();const complete=workers.every(w=>w.usage)&&[main,...workers.map(w=>w.usage)].every(u=>Number.isFinite(u?.backingStorageSize));
 return {main,workers,complete,applicationUpperBoundBytes:complete?[main,...workers.map(w=>w.usage)].reduce((n,u)=>n+u.usedSize+u.backingStorageSize,0):null,scope:'CDP heap/backing usage upper bound at one observer-instrumented checkpoint; no fresh owner/heap audit or peak lifetime proof'};
}
(async()=>{
 let browser,page;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/';report.base=base;report.ownedServer={pid:process.pid,address:server.address()};
  const fullChrome='C:/Program Files/Google/Chrome/Application/chrome.exe',executable=fs.existsSync(fullChrome)?fullChrome:require(path.join(cfg.repo,'tools/playwright-browser.cjs')).executable();report.executable=executable;
  browser=await chromium.launch({headless:true,executablePath:executable});report.browser=browser.version();report.experiments.noopHeadless=await noop(browser,base);save();console.log('P1 noop '+JSON.stringify({fps:report.experiments.noopHeadless.fps,browser:report.browser}));
  page=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});page.setDefaultTimeout(240000);
  await page.addInitScript(()=>localStorage.setItem('sphere-preview-fps','60'));
  page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.text().startsWith('P1 ')||m.text().startsWith('HR06 parity '))console.log(m.text().slice(0,1800));});
  const build=await(await fetch(base+'build-info.json')).json();assert.equal(build.sourceSha256,cfg.baselineBuild.sourceSha256);assert.equal(build.assetSetSha256,cfg.baselineBuild.assetSetSha256);report.servedBuild=build;
  const start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});console.log('P1 opening isolated snapshot');await page.waitForFunction(()=>window.SphereLoading?.ready||window.SphereLoading?.error);assert.equal(await page.evaluate(()=>SphereLoading.error),null);report.openingMs=Date.now()-start;save();
  const click=selector=>page.locator(selector).evaluate(e=>e.click());
  await click('#tab-scene');await page.locator('#seed').evaluate(e=>{e.value='713';e.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#worldIllumination').selectOption('day');await page.locator('#worldWeather').selectOption('clear');await click('#tab-camera');
  const arrival=Date.now();await click('#placeCategories [data-category="watersheds"]');await page.locator('#placeDestination').selectOption('watershed-meadow');await page.locator('#placeAltitude').selectOption('meadow-study');await click('#visitPlace');
  await page.waitForFunction(()=>document.querySelector('#placeVisitStatus')?.textContent.startsWith('Arrived at '));await page.waitForFunction(()=>SphereLoading.ready||SphereLoading.error);assert.equal(await page.evaluate(()=>SphereLoading.error),null);report.arrivalMs=Date.now()-arrival;
  await page.evaluate(()=>{SphereApp.setPlaying(false);SphereApp.setBusy(true);window.spherePreviewSuspended=true;});await page.setViewportSize({width:H.viewport[0],height:H.viewport[1]});
  report.production=await diagnostics.setup(page,H,E);save();console.log('P1 normal ready '+JSON.stringify({cold:report.production.cold,counts:report.production.counts}));
  report.heapBeforeObservers=await heap(page,browser);save();
  if(process.env.MEADOW_P1_SKIP_D0!=='1'&&!['probe','planner','exports'].includes(process.env.MEADOW_P1_ONLY)){
   if(process.env.MEADOW_P1_NO_CADENCE!=='1'){
   report.experiments.appCadence=await diagnostics.cadence(page);fs.writeFileSync(path.join(out,'cadence.json'),JSON.stringify(report.experiments.appCadence,null,2)+'\n');save();console.log('P1 cadence '+JSON.stringify(report.experiments.appCadence.runs.map(r=>({on:r.on,fps:r.fps,frames:r.frames.length,internal:r.frames[0].internal}))));
   }
   report.experiments.native=await require(path.join(cfg.repo,'tests/vegetation-optimisation-pixels.cjs'))(page);
   fs.writeFileSync(path.join(out,'native-original-order.json'),JSON.stringify(report.experiments.native,null,2)+'\n');
   for(const image of await page.evaluate(()=>window.hr06Images||[]))fs.writeFileSync(path.join(out,image.id+'.png'),Buffer.from(image.png.split('base64,')[1],'base64'),{flag:'wx'});
   await page.evaluate(()=>{window.hr06Images=[];});save();console.log('P1 native '+report.experiments.native.status);
  }
  if(process.env.MEADOW_P1_NATIVE_ONLY==='1'){report.status='NATIVE_DIAGNOSTIC_UNPROMOTED';save();return;}
  await page.addScriptTag({url:base+'prototype/canopy-p1.js'});report.prototype=await page.evaluate(()=>SphereMeadowPrototype.install(SphereApp.renderer));save();
  report.heapAfterInstall=await heap(page,browser);save();
  report.experiments.glTrace=await diagnostics.traceGl(page);save();console.log('P1 GL trace '+JSON.stringify(report.experiments.glTrace));
  if(!['probe','planner','exports'].includes(process.env.MEADOW_P1_ONLY)){
  const canopy=await diagnostics.canopy(page,E);
  for(const row of canopy.results){for(const [mode,png]of Object.entries(row.images))fs.writeFileSync(path.join(out,row.id+'-'+mode+'.png'),Buffer.from(png.split('base64,')[1],'base64'),{flag:'wx'});delete row.images;}
  report.experiments.canopy=canopy;fs.writeFileSync(path.join(out,'canopy.json'),JSON.stringify(canopy,null,2)+'\n');save();
  }
  if(process.env.MEADOW_P1_ONLY==='exports'){
   report.experiments.exports=[];
   for(const projection of ['perspective','panorama']){
    await page.locator('#exportSize').evaluate(e=>{e.value='3840';e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.evaluate(()=>{window.p1CaptureEvents=[];window.p1CaptureListener??=(event=>p1CaptureEvents.push({...event.detail,at:performance.now()}));window.addEventListener('sphere-capture-status',p1CaptureListener);});
    const downloadPromise=page.waitForEvent('download',{timeout:120000});
    await page.evaluate(async projection=>{const s={...p1BaseState,projection,meadow:{...p1BaseState.meadow,windPhaseSeconds:1.2,windResolvedPhaseSeconds:1.2}};SphereMeadowPrototype.select('p1');SphereApp.setState(s);SphereApp.setPlaying(false);SphereApp.setBusy(false);await SphereApp.capture({projection});},projection);
    const capture=await page.evaluate(()=>({events:p1CaptureEvents,render:SphereApp.renderer.renderInfo,glError:SphereApp.renderer.gl.getError(),displayedPhase:SphereApp.displayedWindPhase}));
    const download=await downloadPromise,file=path.join(out,'p1-'+projection+'-3840.zip');await download.saveAs(file);
    const bytes=fs.readFileSync(file);capture.file={path:file,bytes:bytes.length,sha256:sha(bytes),suggestedFilename:download.suggestedFilename()};capture.projection=projection;report.experiments.exports.push(capture);save();console.log('P1 export '+JSON.stringify({projection,file,events:capture.events,glError:capture.glError}));
    await page.evaluate(()=>{SphereApp.setBusy(true);window.spherePreviewSuspended=true;});
   }
  }
  if(process.env.MEADOW_P1_PLANNER==='1'||process.env.MEADOW_P1_ONLY==='planner'){
   const historical=path.join(cfg.repo,'docs/evidence/meadow-proof-01/hr09-next-v5-2026-10-05T11-15-44Z/hr09-current-v5-01/h1'),routes={};
   report.routeSources=[];
   for(const kind of ['walk','turn-elevation']){const file=path.join(historical,'on-'+kind+'.json'),bytes=fs.readFileSync(file);routes[kind]=JSON.parse(bytes).frames.map(f=>({poseKey:f.poseKey,routeIndex:f.routeIndex}));report.routeSources.push({path:file,sha256:sha(bytes),frames:routes[kind].length});}
   await page.addScriptTag({url:base+'prototype/tile-planner-p1.js'});report.experiments.planner=await diagnostics.planning(page,H,routes);
   fs.writeFileSync(path.join(out,'planner.json'),JSON.stringify(report.experiments.planner,null,2)+'\n',{flag:'wx'});save();console.log('P1 planning '+JSON.stringify(report.experiments.planner.summary));
  }
  report.experiments.coverage=[];
  for(const mode of ['baseline','p1'])report.experiments.coverage.push(await diagnostics.coverage(page,E,mode));
  report.heap=await heap(page,browser);report.finalGlError=await page.evaluate(()=>SphereApp.renderer.gl.getError());report.status='DIAGNOSTICS_COMPLETE_UNPROMOTED';save();
  console.log('P1 complete '+JSON.stringify({out,coverage:report.experiments.coverage,heap:report.heap.applicationUpperBoundBytes,errors:report.errors,finalGlError:report.finalGlError}));
 }catch(error){
  report.status='FAILED_ATTEMPT_RETAINED';report.failure=error.stack;
  if(page)try{report.failureState=await page.evaluate(()=>({state:SphereApp.getState(),render:SphereApp.renderer?.renderInfo,prototype:window.SphereMeadowPrototype&&{mode:SphereMeadowPrototype.mode,atlasGpuBytes:SphereMeadowPrototype.atlasGpuBytes}}));await page.screenshot({path:path.join(out,'failure.png')});}catch{}
  save();console.error(error);process.exitCode=1;
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
