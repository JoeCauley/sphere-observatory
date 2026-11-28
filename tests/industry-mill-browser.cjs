'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto'),{chromium}=require('playwright');
const {start}=require('./support/observatory-server.cjs'),{executable}=require('./support/biome-browser.cjs');
const root=path.resolve(__dirname,'..'),world='sphere-ed6a59ab491a9a08',launcher=process.argv.includes('--launcher');
const seed=process.env.SPHERE_FIELD_STORE;
const result={controlledClock:true,world,profiles:[],cases:{},errors:[]};
function attachClock(){
 // Only the elapsed input is controlled. Normal pause, API, view, journaling and reload paths execute.
 let host;Object.defineProperty(window,'SphereProduction',{configurable:true,get:()=>host,set:v=>{
   const advance=v.advance.bind(v);v.advance=(_seconds,running)=>advance(0,running);
   window.advanceTestClock=ms=>advance(ms/1000,window.SphereApp.playing);host=v;
 }});
}
async function millFrame(p){
 await p.waitForFunction(()=>{
  if(document.querySelector('#loadingActions')?.hidden===false)throw Error(document.getElementById('loadingStatus').textContent);
  const w=document.querySelector('#stageFrame iframe')?.contentWindow,retry=w?.document?.getElementById('packRetry');
  if(retry&&!retry.hidden)throw Error(w.document.getElementById('packLoadingStatus').textContent);
  return document.getElementById('sceneLoading')?.hidden&&w?.SphereIndustry?.inspect().mill.ready;
 },null,{timeout:240000});
 const f=await(await p.locator('#stageFrame iframe').elementHandle()).contentFrame();
 await f.waitForFunction(()=>!document.getElementById('millPanel').hidden);
 return f;
}
async function pilot(origin,which){
 const browser=await chromium.launch({headless:true,executablePath:executable(),args:['--mute-audio']});
 try{
  const ctx=await browser.newContext({viewport:{width:1340,height:820}});await ctx.addInitScript(attachClock);
  const p=await ctx.newPage();p.setDefaultTimeout(100000);p.on('pageerror',e=>result.errors.push(e.message));
  await p.goto(origin+'/?mill=R1',{waitUntil:'domcontentloaded'});
  const frame=()=>millFrame(p),f=await frame();
  result.profiles.push(which);console.log('Opened',which);return {p,f,browser,frame};
 }catch(e){await browser.close();throw e;}
}
const view=f=>f.evaluate(()=>SphereIndustry.inspect().mill);
const count=v=>[v.record.slabs,Number(!!v.record.job),v.record.rack.filter(Boolean).length,v.record.shipped.length];
const stamp=({address,record,atMs,remainingMs})=>({address,atMs,remainingMs,job:record.job?.id??null,rack:record.rack,shipped:record.shipped,counts:count({record})});
const go=f=>f.locator('#millWorld').click();
async function step(p,ms){await p.evaluate(ms=>advanceTestClock(ms),ms);}
async function act(f,button,test){await f.locator(button).click();await f.waitForFunction(test);}
async function launchQA(){
 const out=execFileSync('cmd.exe',['/d','/c','Launch-Industry-Rolling-Mill.cmd','--qa','--url'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000});
 const url=new URL(out.trim().split(/\r?\n/).at(-1));assert.equal(url.port,'8846');
 const health=await(await fetch(url.origin+'/api/health')).json();
 assert.equal(health.checkout,createHash('sha256').update(root.toUpperCase()).digest('hex'));assert.equal(health.service,'sphere-observatory');
 return {origin:url.origin,health};
}
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sphere-mill-browser-'));let service,openBrowser;
 async function startTrial(name){
   const folder=path.join(dir,name);await fs.mkdir(folder);const file=path.join(folder,'atlas.json');
   if(seed){
     await fs.copyFile(seed,file);
     try{await fs.cp(seed+'.border-atlas',file+'.border-atlas',{recursive:true});}
     catch(error){if(error.code!=='ENOENT')throw error;}
   }
   return file;
 }
 try{
  if(process.argv.includes('--reopen')){
   const file=await startTrial('live-close');service=await start({storePath:file});
   const user=await pilot(service.origin,'occupied rack');openBrowser=user.browser;
   await act(user.f,'#millFeed',()=>!!SphereIndustry.inspect().mill.record.job);await step(user.p,45000);
   const filled=await view(user.f);assert.deepEqual(count(filled),[2,0,1,0]);
   await user.p.reload({waitUntil:'domcontentloaded'});const room=await millFrame(user.p),loaded=await view(room);
   assert.deepEqual(count(loaded),[2,0,1,0]);assert.deepEqual(loaded.record.rack,filled.record.rack);
   await go(room);await user.p.waitForFunction(()=>SphereApp.playing);
   await act(room,'#millFeed',()=>!!SphereIndustry.inspect().mill.record.job);
   await step(user.p,22000);
   const endpoint=service.origin+'/api/industry-mills?world='+world;
   const durable=async()=>(await(await fetch(endpoint)).json()).state;
   const target=(await view(room)).atMs;
   for(let n=0;n<100&&(await durable()).atMs<target;n++)await new Promise(r=>setTimeout(r,25));
   assert.equal((await durable()).atMs,target);
   await step(user.p,500);const leaving=await view(room);assert.equal(leaving.remainingMs,22500);
   assert(leaving.playing&&!leaving.record.paused);assert.equal((await durable()).atMs,target);
   await user.p.close({runBeforeUnload:true});
   for(let n=0;n<200&&(await durable()).atMs<leaving.atMs;n++)await new Promise(r=>setTimeout(r,25));
   assert.equal((await durable()).atMs,leaving.atMs,'Ordinary close stores the final 500 ms');
   await openBrowser.close();openBrowser=null;
   const closed=await durable(),sleepAt=Date.now();await new Promise(r=>setTimeout(r,2500));
   assert.deepEqual(await durable(),closed);const closedWallMs=Date.now()-sleepAt;
   const fresh=await pilot(service.origin,'after closing a running job');openBrowser=fresh.browser;
   const recovered=await view(fresh.f);assert.deepEqual(stamp(recovered),stamp(leaving));
   result.cases.ordinaryReload={before:stamp(filled),after:stamp(loaded)};
   result.cases.closeWhileRunning={before:stamp(leaving),after:stamp(recovered),closedWallMs,finalBeaconMs:leaving.atMs-target};
   await go(fresh.f);await fresh.p.waitForFunction(()=>SphereApp.playing);
   const mark=await fresh.p.evaluate(()=>SphereBiomeLibrary.marks().find(m=>m.equipment));
   await fresh.p.evaluate(()=>SphereStageFrame.close());
   await fresh.p.waitForFunction(()=>!document.querySelector('#stageFrame iframe')&&!SphereStageFrame.flying);
   await fresh.p.evaluate(async()=>{
     await SphereBiomeLibrary.install('infinite-meadow');
     return SphereStageFrame.visit('infinite-meadow');
   });
   await fresh.p.waitForFunction(()=>{const el=document.querySelector('#stageFrame iframe');return el?.dataset.locationId==='infinite-meadow'&&el.contentWindow?.SphereBiome;});
   await fresh.p.evaluate(()=>SphereApp.setPlaying(true));await step(fresh.p,22499);
   const left=await fresh.p.evaluate(a=>SphereProduction.current.view(a).remainingMs,recovered.address);assert.equal(left,1);
   await step(fresh.p,1);
   const meadow=await fresh.p.evaluate(a=>({scene:document.querySelector('#stageFrame iframe').dataset.locationId,mill:SphereProduction.current.view(a)}),recovered.address);
   assert.equal(meadow.scene,'infinite-meadow');assert.deepEqual(count(meadow.mill),[1,0,2,0]);assert.equal(meadow.mill.record.rack[1],recovered.record.job.id);
   result.cases.meadow={scene:meadow.scene,oneMsBefore:left,completed:stamp(meadow.mill)};
   await fresh.p.evaluate(m=>SphereStageFrame.returnToPlace(m),mark);fresh.f=await millFrame(fresh.p);
   assert.deepEqual(count(await view(fresh.f)),[1,0,2,0]);
   await act(fresh.f,'#millFeed',()=>document.getElementById('millNotice').textContent.includes('full'));
   await act(fresh.f,'#millDispatch',()=>SphereIndustry.inspect().mill.record.shipped.length===1);
   await act(fresh.f,'#millFeed',()=>!!SphereIndustry.inspect().mill.record.job);await step(fresh.p,45000);
   const last=await view(fresh.f);assert.deepEqual(count(last),[0,0,2,1]);
   assert.equal(new Set([...last.record.rack,...last.record.shipped]).size,3);
   await act(fresh.f,'#millFeed',()=>document.getElementById('millNotice').textContent.includes('empty'));
   result.cases.fullBatch=stamp(last);
   assert.deepEqual(result.errors,[]);result.passed=true;console.log('PASS occupied-rack reload, final half second, no offline progress, third slab and exhausted stack');return;
  }
  const trialFile=launcher?null:await startTrial('restart');
  let origin;
  if(launcher){const q=await launchQA();origin=q.origin;result.beforeService=q.health;}
  else{service=await start({storePath:trialFile});origin=service.origin;}
  const first=await pilot(origin,'before restart');openBrowser=first.browser;
  const {p,f}=first;assert.deepEqual(count(await view(f)),[3,0,0,0],'Restart trial needs an unused QA register');
  await act(f,'#millFeed',()=>!!SphereIndustry.inspect().mill.record.job);
  await step(p,22500);await act(f,'#millMachinery',()=>SphereIndustry.inspect().mill.record.paused);
  const frozen=await view(f);assert.equal(frozen.remainingMs,22500);
  await step(p,36000);assert.equal((await view(f)).remainingMs,22500,'machinery pause');
  await go(f);await p.waitForFunction(()=>!SphereApp.playing);await step(p,39000);
  const before=stamp(await view(f));
  // Changing the sky epoch uses the usual slider's input handler.
  await p.locator('#timeSlider').evaluate(e=>{e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.deepEqual(stamp(await view(f)),before);result.cases.pauses={worldAndMachinery:true,skySlider:true,before};
  await openBrowser.close();openBrowser=null;
  if(launcher){
    // The QA port and checkout digest were verified above. Only this QA service is restarted.
    process.kill(result.beforeService.pid);await new Promise(r=>setTimeout(r,650));
    const q=await launchQA();origin=q.origin;result.afterService=q.health;assert.notEqual(q.health.pid,result.beforeService.pid);
  }else{await service.close();service=await start({storePath:trialFile});origin=service.origin;}
  const second=await pilot(origin,'fresh after restart');openBrowser=second.browser;
  const g=second.f,q=second.p,again=await view(g);assert.equal(again.record.job.id,frozen.record.job.id);assert.equal(again.remainingMs,22500);assert.deepEqual(count(again),[2,1,0,0]);
  result.cases.restart={before:stamp(frozen),after:stamp(again)};console.log('Recovered',again.record.job.id,again.remainingMs);
  if(!await g.locator('#show').isVisible())throw Error('Mill aisle should be ready for walking');
  await g.locator('#show').click();await g.locator('#save').click();await g.locator('#hide').click();
  await act(g,'#millMachinery',()=>!SphereIndustry.inspect().mill.record.paused);
  assert.equal((await view(g)).remainingMs,22500);await step(q,12000);assert.equal((await view(g)).remainingMs,22500,'world pause alone');
  await go(g);await q.waitForFunction(()=>SphereApp.playing);await step(q,22499);assert.equal((await view(g)).remainingMs,1);
  await step(q,1);const completed=await view(g);assert.deepEqual(count(completed),[2,0,1,0]);
  result.cases.boundary=stamp(completed);console.log('Exact boundary',completed.record.rack);
  await act(g,'#millDispatch',()=>SphereIndustry.inspect().mill.record.shipped.length===1);
  await g.locator('#show').click();await g.locator('#transfer').click();await g.locator('#returnSaved').click();
  const savedPose=await g.evaluate(()=>SphereBiome.pose());assert.deepEqual(count(await view(g)),[2,0,0,1]);
  if(process.env.SPHERE_MILL_LEGACY){
    await g.locator('#saveFile').setInputFiles(process.env.SPHERE_MILL_LEGACY);
    await g.waitForFunction(()=>document.querySelector('#status').textContent==='Industrial place imported.');
    const legacy=JSON.parse(await fs.readFile(process.env.SPHERE_MILL_LEGACY,'utf8'));
    const current=await g.evaluate(()=>{const s=SphereIndustry.inspect().state;return {pose:s.pose,routing:s.routing};});
    assert.deepEqual(current.pose,legacy.state.pose);assert.equal(current.routing,legacy.state.routing);
    result.cases.legacy={pose:current.pose,routing:current.routing,savedPose};
  }
  const mark=await q.evaluate(()=>SphereBiomeLibrary.marks().find(m=>m.equipment));
  await q.evaluate(m=>SphereStageFrame.returnToPlace(m),mark);const againFrame=await second.frame();
  await againFrame.waitForFunction(()=>!!window.SphereIndustry?.inspect().mill.ready);
  const present=await view(againFrame);assert.deepEqual(count(present),[2,0,0,1]);
  const duplicate={address:present.address,instance:'infinite-industry',verb:'feed',id:frozen.record.receipts[0].id,expected:0,atMs:0};
  const reply=await(await fetch(origin+'/api/industry-mills?world='+world,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(duplicate)})).json();
  assert(reply.duplicate);assert.deepEqual(reply.state.machines[present.address].shipped,[frozen.record.job.id]);
  result.cases.oldViewAndLostAck=stamp(present);
  await openBrowser.close();openBrowser=null;await service?.close();service=null;
  // Two independent services from identical registers. One retires Industry at the halfway point.
  for(const mode of ['watched','away']){
    const file=await startTrial(mode);service=await start({storePath:file});
    const user=await pilot(service.origin,mode);openBrowser=user.browser;
    await act(user.f,'#millFeed',()=>!!SphereIndustry.inspect().mill.record.job);await step(user.p,22500);
    const halfway=stamp(await view(user.f));let visible=user.f;
    const m=await user.p.evaluate(()=>SphereBiomeLibrary.marks().find(v=>v.equipment));
    if(mode==='away'){await user.p.evaluate(()=>SphereStageFrame.close());assert.equal(await user.p.locator('#stageFrame iframe').count(),0);}
    await step(user.p,22499);
    const almost=await user.p.evaluate(address=>SphereProduction.current.view(address).remainingMs,halfway.address);assert.equal(almost,1);
    await step(user.p,1);
    if(mode==='away'){await user.p.evaluate(m=>SphereStageFrame.returnToPlace(m),m);visible=await user.frame();await visible.waitForFunction(()=>!!window.SphereIndustry?.inspect().mill.ready);}
    result.cases[mode]={halfway,end:stamp(await view(visible))};
    await openBrowser.close();openBrowser=null;await service.close();service=null;
  }
  assert.deepEqual(result.cases.watched,result.cases.away);assert.deepEqual(result.errors,[]);
  result.passed=true;console.log('PASS watched/away at identical ticks, restart and fresh profile, pauses, old bookmark, duplicate acknowledgement');
 }finally{await openBrowser?.close();await service?.close();await fs.rm(dir,{recursive:true,force:true});if(process.env.SPHERE_MILL_BROWSER_OUTPUT)await fs.writeFile(process.env.SPHERE_MILL_BROWSER_OUTPUT,JSON.stringify(result,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
