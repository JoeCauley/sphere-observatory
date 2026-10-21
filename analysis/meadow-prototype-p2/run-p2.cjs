'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const cfg=require('./last-run.json'),diagnostics=require('./browser-diagnostics.cjs'),H=require(path.join(cfg.runtime,'tests/fixtures/meadow-performance-h1.json')),E=require(path.join(cfg.runtime,'tests/fixtures/meadow-e-visual-exit-v2.json'));
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=path.join(cfg.evidence,'browser-'+stamp),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(path.join(out,'source'),{recursive:true});
const temp=path.join(cfg.work,'browser-temp');fs.mkdirSync(temp,{recursive:true});process.env.TEMP=temp;process.env.TMP=temp;process.env.TMPDIR=temp;
const sources=[];for(const name of fs.readdirSync(__dirname))if(/\.(js|cjs)$/.test(name)){const b=fs.readFileSync(path.join(__dirname,name));fs.writeFileSync(path.join(out,'source',name),b,{flag:'wx'});sources.push({path:name,bytes:b.length,sha256:sha(b)});}
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(sources,null,2)+'\n',{flag:'wx'});
const report={schema:1,profile:cfg.profile,revision:2,status:'INCOMPLETE',createdAt:new Date().toISOString(),baselineBuild:cfg.baselineBuild,sourceManifest:sources,errors:[],experiments:{},scope:'Authorized isolated P2 volume, actual preparation integration and complete-view capture. Diagnostic replay is not H1 or acceptance.'};
const save=()=>fs.writeFileSync(path.join(out,'run.json'),JSON.stringify(report,null,2)+'\n');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(name==='/build-info.json')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(cfg.baselineBuild));
 const overlay=/^\/prototype\/(canopy-p1|canopy-p2|submission-p2|capture-p2|tile-planner-p1)\.js$/.test(name),file=overlay?path.join(out,'source',path.basename(name)):path.resolve(cfg.runtime,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(cfg.runtime+path.sep)&&!file.startsWith(out+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(b));
});
async function replay(page,routes,{enabled,audit,mode='volume18',captureFrames=false}){
 return page.evaluate(async({routes,enabled,audit,mode,captureFrames})=>{
  const R=SphereApp.renderer,C=p2Submission,base=JSON.parse(JSON.stringify(p1BaseState)),runs=[],images=[],stat=a=>{a=a.slice().sort((x,y)=>x-y);return {count:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};};
  SphereMeadowPrototype.select(mode);C.select(enabled,{audit});
  const installAt=performance.now();await p1Settle(base);const compilationPreparation={elapsedMs:performance.now()-installAt,compilerMaximumMs:C.info.stats.maximumCompilerMs};
  for(const [kind,frames]of Object.entries(routes)){
   await p1Settle(base);const rows=[],gpu=new Map(),started=performance.now();
   for(let i=0;i<frames.length;i++){
    const pose=JSON.parse(frames[i].poseKey),s={...base,position:pose[0],forward:pose[1],up:pose[2],time:pose[3],meadow:{...base.meadow,windPhaseSeconds:pose[4],windResolvedPhaseSeconds:pose[4]}};
    SphereApp.setState(s);const at=performance.now();R.draw(s,1920,1080,{adaptiveScale:1});const cpuMs=performance.now()-at,e=R.renderInfo.instancedEnvironment,p=R.meadow.productionPopulation,L=p.lifecycle;
    for(const sample of R.gpuTimerSamples||[])gpu.set(sample.frameId,sample);
    const error=R.gl.getError();if(error)throw Error('P2 integrated draw GL error '+error+' '+kind+' '+i);
    rows.push({routeIndex:i,poseKey:frames[i].poseKey,frameId:R.drawFrameId,at,cpuMs,completePreparationMs:e.framePrepareCpuMs,uploadBytes:e.frameUploadedBytes,viewReady:L.frame.viewReady===true||L.frame.stationaryReferenceReuse===true,foregroundReady:L.info.foregroundReady,committedVersion:L.committed?.version,currentVersion:L.version,submittedDetailed:e.tierInstances.blades,residentDetailed:p.service.info.retainedDetailedRecords,gpuBytes:R.environment.vegetationAllocatedBytes()+(R.meadowGround.info.residentBytes||0),glError:error});
    if(captureFrames&&kind!=='stationary'&&i%30===0)images.push({id:kind+'-'+String(i).padStart(3,'0'),poseKey:frames[i].poseKey,phase:pose[4],png:R.canvas.toDataURL('image/png')});
    if(i%180===0)console.log('P2 replay '+JSON.stringify({kind,enabled,audit,index:i,prepare:e.framePrepareCpuMs,viewReady:rows.at(-1).viewReady,foregroundReady:rows.at(-1).foregroundReady}));
    await new Promise(requestAnimationFrame);
   }
   const elapsedMs=performance.now()-started;
   for(let poll=0;poll<60&&R.queries.length;poll++){await new Promise(requestAnimationFrame);R.pollTimers();for(const sample of R.gpuTimerSamples||[])gpu.set(sample.frameId,sample);}
   for(const row of rows)row.gpu=gpu.get(row.frameId)||null;
   const summary={cpu:stat(rows.map(r=>r.cpuMs)),completePreparation:stat(rows.map(r=>r.completePreparationMs)),drawnFps:rows.length*1000/elapsedMs,elapsedMs,maximumUploadBytes:Math.max(...rows.map(r=>r.uploadBytes)),maximumGpuBytes:Math.max(...rows.map(r=>r.gpuBytes)),missingGpuSamples:rows.filter(r=>!r.gpu?.valid).length,viewUnreadyFrames:rows.filter(r=>!r.viewReady).length,foregroundUnreadyFrames:rows.filter(r=>!r.foregroundReady).length,maximumSubmittedDetailed:Math.max(...rows.map(r=>r.submittedDetailed)),maximumResidentDetailed:Math.max(...rows.map(r=>r.residentDetailed))};
   runs.push({kind,frames:rows,summary});console.log('P2 replay complete '+JSON.stringify({kind,enabled,audit,...summary}));
  }
  return {enabled,audit,mode,runs,compilationPreparation,submission:C.info,images,scope:audit?'Actual ordered candidate and submission parity inside real draw; duplicate oracle overhead, not performance proof':'Actual complete preparation replay with receipts, hashes, uploads, filtering, commit and retirement. Direct held-camera draws paced by RAF; diagnostic, not ordinary app H1.'};
 },{routes,enabled,audit,mode,captureFrames});
}
async function heap(page){const session=await page.context().newCDPSession(page);try{return await session.send('Runtime.getHeapUsage');}finally{await session.detach();}}
(async()=>{
 let browser,page;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/';report.base=base;report.ownedServer={pid:process.pid,address:server.address()};
  const full='C:/Program Files/Google/Chrome/Application/chrome.exe',exe=fs.existsSync(full)?full:require(path.join(cfg.repo,'tools/playwright-browser.cjs')).executable();
  browser=await chromium.launch({headless:true,executablePath:exe});report.browser=browser.version();report.executable=exe;
  page=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});page.setDefaultTimeout(240000);await page.addInitScript(()=>localStorage.setItem('sphere-preview-fps','60'));
  page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(/^(P1|P2) /.test(m.text()))console.log(m.text().slice(0,2000));});
  save();console.log('P2 opening isolated snapshot '+out);const start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready||window.SphereLoading?.error);assert.equal(await page.evaluate(()=>SphereLoading.error),null);report.openingMs=Date.now()-start;
  const click=selector=>page.locator(selector).evaluate(e=>e.click());await click('#tab-scene');await page.locator('#seed').evaluate(e=>{e.value='713';e.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#worldIllumination').selectOption('day');await page.locator('#worldWeather').selectOption('clear');await click('#tab-camera');
  const arrival=Date.now();await click('#placeCategories [data-category="watersheds"]');await page.locator('#placeDestination').selectOption('watershed-meadow');await page.locator('#placeAltitude').selectOption('meadow-study');await click('#visitPlace');await page.waitForFunction(()=>document.querySelector('#placeVisitStatus')?.textContent.startsWith('Arrived at '));await page.waitForFunction(()=>SphereLoading.ready||SphereLoading.error);assert.equal(await page.evaluate(()=>SphereLoading.error),null);report.arrivalMs=Date.now()-arrival;
  await page.evaluate(()=>{SphereApp.setPlaying(false);SphereApp.setBusy(true);window.spherePreviewSuspended=true;});await page.setViewportSize({width:H.viewport[0],height:H.viewport[1]});report.production=await diagnostics.setup(page,H,E);save();console.log('P2 ordinary arrival ready '+JSON.stringify(report.production.cold));
  for(const file of ['canopy-p1.js','canopy-p2.js','tile-planner-p1.js','submission-p2.js','capture-p2.js'])await page.addScriptTag({url:base+'prototype/'+file});
  report.prototype=await page.evaluate(()=>SphereMeadowPrototype.install(SphereApp.renderer));report.heapAfterInstall=await heap(page);save();
  report.experiments.glTrace=await diagnostics.traceGl(page);save();
  const canopy=await diagnostics.canopy(page,E);for(const row of canopy.results){for(const [mode,png]of Object.entries(row.images))fs.writeFileSync(path.join(out,row.id+'-'+mode+'.png'),Buffer.from(png.split('base64,')[1],'base64'),{flag:'wx'});delete row.images;}report.experiments.canopy=canopy;fs.writeFileSync(path.join(out,'canopy.json'),JSON.stringify(canopy,null,2)+'\n',{flag:'wx'});save();
  report.experiments.coverage=[];for(const mode of ['baseline','p1','volume12','volume24']){report.experiments.coverage.push(await diagnostics.coverage(page,E,mode));save();console.log('P2 coverage '+JSON.stringify(report.experiments.coverage.at(-1)));}
  const historical=path.join(cfg.repo,'docs/evidence/meadow-proof-01/hr09-next-v5-2026-10-05T11-15-44Z/hr09-current-v5-01/h1'),routes={};report.routeSources=[];
  for(const kind of ['stationary','walk','turn-elevation']){const file=path.join(historical,'on-'+kind+'.json'),bytes=fs.readFileSync(file);routes[kind]=JSON.parse(bytes).frames.map(f=>({poseKey:f.poseKey,routeIndex:f.routeIndex}));report.routeSources.push({path:file,sha256:sha(bytes),frames:routes[kind].length});}
  await page.evaluate(()=>{window.p2Submission=new SphereMeadowSubmissionP2.CompiledSubmission(SphereApp.renderer.meadow.productionPopulation);});
  report.experiments.parity=await replay(page,{walk:routes.walk,'turn-elevation':routes['turn-elevation']},{enabled:true,audit:true});fs.writeFileSync(path.join(out,'parity.json'),JSON.stringify(report.experiments.parity,null,2)+'\n',{flag:'wx'});save();
  report.experiments.preparation=[];
  for(const enabled of [false,true]){const run=await replay(page,routes,{enabled,audit:false,captureFrames:false});report.experiments.preparation.push(run);fs.writeFileSync(path.join(out,enabled?'preparation-compiled.json':'preparation-original.json'),JSON.stringify(run,null,2)+'\n',{flag:'wx'});save();}
  const motion=await replay(page,{walk:routes.walk,'turn-elevation':routes['turn-elevation']},{enabled:true,audit:false,captureFrames:true});for(const im of motion.images){fs.writeFileSync(path.join(out,'motion-'+im.id+'.png'),Buffer.from(im.png.split('base64,')[1],'base64'),{flag:'wx'});delete im.png;}motion.scope='Separate recorded movement observer; PNG encoding between sampled draws invalidates timing and cadence inference. Every thirtieth actual frame retained with exact pose and readiness.';report.experiments.motion=motion;fs.writeFileSync(path.join(out,'motion.json'),JSON.stringify(motion,null,2)+'\n',{flag:'wx'});save();
  await page.evaluate(async()=>{SphereMeadowPrototype.select('volume18');p2Submission.select(true);await p1Settle(p1BaseState);});
  report.experiments.captures=[];
  for(const projection of ['perspective','panorama']){const result=await page.evaluate(projection=>SphereMeadowCaptureP2.capture({projection,width:3840,state:{...p1BaseState,meadow:{...p1BaseState.meadow,windPhaseSeconds:1.2,windResolvedPhaseSeconds:1.2}}}),projection);if(result.png){const b=Buffer.from(result.png),name='p2-'+projection+'-3840.png';fs.writeFileSync(path.join(out,name),b,{flag:'wx'});result.transaction.file={name,bytes:b.length,sha256:sha(b)};}report.experiments.captures.push(result.transaction);save();console.log('P2 capture '+JSON.stringify(result.transaction));}
  report.heap=await heap(page);report.finalGlError=await page.evaluate(()=>SphereApp.renderer.gl.getError());report.status='DIAGNOSTICS_COMPLETE_UNPROMOTED';report.completedAt=new Date().toISOString();save();console.log('P2 complete '+JSON.stringify({out,errors:report.errors,finalGlError:report.finalGlError}));
 }catch(error){report.status='FAILED_ATTEMPT_RETAINED';report.failure=error.stack;if(page)try{report.failureState=await page.evaluate(()=>({state:SphereApp.getState(),render:SphereApp.renderer.renderInfo,submission:window.p2Submission?.info}));await page.screenshot({path:path.join(out,'failure.png')});}catch{}save();console.error(error);process.exitCode=1;}
 finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})();
