'use strict';
const h=require('./support/apartment-field.cjs'),{fixture}=require('./support/apartment-register.cjs');
const {recordPage}=require('./support/apartment-film.cjs');
const {assert,fs,path,world,id,viewport,options,walk,aim,look,pose,ready,mainReady,mark,returnMark,sleep}=h;
const out=process.env.SPHERE_APARTMENT_EVIDENCE,live=process.env.SPHERE_APARTMENT_QA_STORE,film=!!(out&&process.argv.includes('--film'));
const sidewalkName='Orchard Street · Public sidewalk',insideName='1A · Before the move',meadowName='Meadow · Orchard expedition';
const report={events:[],views:{},unloads:[],thresholds:[],errors:[],pass:false};
const startTime=Date.now(),event=name=>{report.events.push({name,ms:Date.now()-startTime});console.log(name,Math.round((Date.now()-startTime)/1000)+'s');};
function equalPose(a,b,tolerance=.012){
  const distance=Math.hypot(...['eastM','northM','altitudeM'].map(k=>a[k]-b[k]));assert(distance<=tolerance,JSON.stringify({a,b,distance}));
  assert.equal(a.mode,b.mode);for(const k of ['yaw','pitch'])assert(Math.abs(a[k]-b[k])<.001);return distance;
}
async function buttons(page,canvasId){
  await page.locator('summary').filter({hasText:'Camera & travel'}).click();await page.locator('#'+canvasId).click();
}
async function reveal(locator){
  const ids=await locator.evaluate(e=>({tab:e.closest('.tab-panel')?.id,summaries:[...function*(n){while(n){if(n.tagName==='DETAILS'&&!n.open)yield n.querySelector('summary').textContent;n=n.parentElement;}}(e)].reverse()}));
  const p=locator.page();
  if(ids.tab){const tab=p.locator('[role=tab][aria-controls="'+ids.tab+'"]');if(await tab.count())await tab.click();}
  for(const text of ids.summaries)await p.locator('summary').getByText(text,{exact:true}).or(p.locator('summary').filter({hasText:text})).first().click();
}
async function selectSeedUI(p){
  if(await p.evaluate(w=>SphereBiomeLibrary.world?.key===w,world))return;
  const seed=p.locator('#seed');await reveal(seed);await seed.fill('713');await seed.press('Tab');
  await p.waitForFunction(w=>SphereBiomeLibrary.world?.key===w,world);
}
(async()=>{
 const isolated=fixture(process.env.SPHERE_APARTMENT_SEED),file=live||isolated.file;
 const root=live?path.dirname(live):isolated.dir,profileRoot=fs.mkdtempSync(path.join(root,'walk-profiles-'));
 let host,ctx,p,f,stopFilm;
 const initial=JSON.parse(fs.readFileSync(file)).worlds[world];
 assert(initial.installed.find(i=>i.id===id));assert(!fs.existsSync(file+'.furnishings'),'Run the walk on an untouched QA register.');
 async function open(which,route){
   console.log('Opening',which,route);
   ctx=await h.chromium.launchPersistentContext(path.join(profileRoot,which),{...options,viewport,deviceScaleFactor:1});
   p=ctx.pages()[0]??await ctx.newPage();p.on('pageerror',e=>{report.errors.push(e.message);console.error('PAGE',e.message);});
   await p.addInitScript(()=>{
     if(window===window.top)window.localStorage.setItem('sphere-stage-sound','off');
   });
   await p.goto(host.origin+route);await mainReady(p);
   if(film)stopFilm=await recordPage(p,path.join(out,'film-frames'),startTime);
 }
 async function closeProfile(){await stopFilm?.();stopFilm=null;await ctx?.close();ctx=null;}
 async function photo(name){if(out)await h.shot(p,path.join(out,name+'.jpg'));}
 const info=()=>f.evaluate(()=>SphereBiome.inspect());
 async function take(name){const r=await info();report.views[name]={pose:await pose(f),chair:r.chair,light:r.light,lens:r.horizontalFov};await photo(name);}
 async function keepRetirement(){await p.evaluate(()=>{window.__leavingNY=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;});}
 async function retired(label){
   const r=await p.evaluate(()=>{const api=window.__leavingNY,s=api.inspect();delete window.__leavingNY;return s;});
   assert(r.disposed);assert.equal(r.ownedBytes,0);assert(Object.values(r.resources).every(n=>n===0));
   assert.deepEqual(r.remainingObjects,[]);assert.deepEqual(r.glErrors,[]);report.unloads.push({label,resources:r.resources,ownedBytes:r.ownedBytes,peak:r.peakOwnedBytes,remainingObjects:r.remainingObjects,glErrors:r.glErrors});
 }
 async function watchThreshold(){
   await f.evaluate(()=>{const readings=[];let last,token;
     function tick(t){const q=SphereBiome.pose();
       if(last&&q.mode==='walk'&&Math.abs(q.eastM+1.55)<.82&&Math.abs(q.northM)<.8&&Math.abs(q.northM-last.z)>.002)readings.push(t-last.t);
       last={t,z:q.northM};token=requestAnimationFrame(tick);}
     token=requestAnimationFrame(tick);window.addEventListener('pagehide',()=>cancelAnimationFrame(token),{once:true});window.__orchardThreshold=readings;
   });
 }
 async function thresholds(){const v=await f.evaluate(()=>window.__orchardThreshold);assert(v.length);report.thresholds.push({samples:v.length,worstMs:Math.max(...v)});}
 async function toIndoor(){await walk(f,-1.55,-1.68);await walk(f,-2.42,-5.10);await look(f,.77,-2.42,-.13);}
 try{
   host=await h.start({port:live?8854:0,storePath:file});report.origin=host.origin;
   report.beforeService=await (await fetch(host.origin+'/api/health')).json();
   await open('original','/?apartment=1A');f=await ready(p);
   await watchThreshold();event('Sidewalk before departure');const sidewalk=await mark(p,sidewalkName);report.sidewalk=sidewalk;await photo('qa-sidewalk');await sleep(900);
   await toIndoor();event('Inside before move');const indoor=await mark(p,insideName);report.indoor=indoor;await buttons(f,'save');
   await take('chair-at-table');assert.equal((await info()).chair.revision,0);await sleep(800);
   await walk(f,-1.55,-3.44);await look(f,-.42,-3.50,-.53);event('Pick up');await f.locator('#chairButton').click();
   assert((await info()).carrying);await walk(f,-1.48,-1.68);await walk(f,1.35,-1.29);
   await look(f,2.35,-1.03,-.48);event('Place by window');await f.locator('#chairButton').click();
   await f.waitForFunction(()=>SphereBiome.inspect().chair.revision===1&&!SphereBiome.inspect().carrying);
   const moved=(await info()).chair;report.accepted=moved;assert.equal(moved.target,'B');await sleep(800);
   await walk(f,-1.48,-1.78);await walk(f,-1.54,-3.50);const empty=await walk(f,-.42,-3.50);
   assert(Math.hypot(empty.eastM+.42,empty.northM+3.5)<.18);event('Standing in old footprint');
   await walk(f,-1.55,-3.50);await walk(f,-1.55,2.78);await walk(f,23.7,3.4);await walk(f,24,-9.4);
   await look(f,-1.55,0,.02);event('Stoop behind the corner');report.aroundCorner=await pose(f);await photo('stoop-out-of-sight');await sleep(900);await thresholds();
   await keepRetirement();const select=p.getByRole('combobox',{name:'Destination biome'});event('Leave for Infinite Meadow');
   if(await select.count()){await select.selectOption('infinite-meadow');await p.getByRole('button',{name:'Fly there',exact:true}).click();}
   else await p.getByRole('button',{name:'Fly to Infinite Meadow',exact:true}).click();
   const meadow=await ready(p,'infinite-meadow');await retired('Orchard Street to Infinite Meadow');
   event('Arrived in Infinite Meadow');await mark(p,meadowName);await photo('meadow-away');await sleep(800);
   const clock=p.locator('#timeSlider');await reveal(clock);const oldTime=await p.evaluate(()=>SphereApp.getState().time);
   await clock.focus();await clock.press('End');const newTime=await p.evaluate(()=>SphereApp.getState().time);assert.notEqual(oldTime,newTime);report.awayClock={oldTime,newTime};
   report.meadowPose=await pose(meadow);
   event('Close original browser');await closeProfile();const port=host.port;await host.close();host=null;
   host=await h.start({port,storePath:file});report.afterService=await (await fetch(host.origin+'/api/health')).json();assert.notEqual(report.afterService.pid,report.beforeService.pid);
   await open('fresh','/');await selectSeedUI(p);event('Fresh browser chooses sidewalk mark');
   f=await returnMark(p,sidewalkName);await watchThreshold();event('Same sidewalk after restart');const back=await pose(f);
   report.returnErrorM=equalPose(back,sidewalk.pose,1);assert.deepEqual((await info()).chair,moved);await photo('restored-sidewalk');await sleep(800);
   await walk(f,-1.55,2.02);await look(f,-2.55,0,.22);event('Read number on return');await sleep(700);
   await toIndoor();event('Back inside after restart');await take('window-on-walked-return');await sleep(900);await thresholds();
   f=await returnMark(p,insideName);event('Pre-move indoor Atlas mark');equalPose(await pose(f),indoor.pose);assert.deepEqual((await info()).chair,moved);
   await take('chair-at-window');await sleep(1100);
   await p.locator('#timeSlider').focus();await p.locator('#timeSlider').press('End');
   await f.waitForFunction(t=>SphereBiome.inspect().light.time===t,newTime);assert.deepEqual((await info()).chair,moved);
   report.alternateLight=(await info()).light;await take('window-alternate-sky');
   await keepRetirement();await returnMark(p,meadowName,'infinite-meadow');await retired('Fresh profile to Meadow mark');await closeProfile();
   await open('original','/?apartment=1A');f=await ready(p);const beforeRecall=await pose(f);await buttons(f,'recall');
   equalPose(await pose(f),indoor.pose);assert(Math.abs(beforeRecall.northM-indoor.pose.northM)>2);assert.deepEqual((await info()).chair,moved);
   event('Original local camera bookmark');await take('camera-return');await sleep(900);
   await keepRetirement();await returnMark(p,meadowName,'infinite-meadow');await retired('Original profile to Meadow mark');
   assert.deepEqual(report.errors,[]);report.pass=true;event('Route complete');
 }catch(error){
   report.failure=error.message;
   if(p&&!p.isClosed()){report.failureView=await p.evaluate(()=>({url:location.href,opening:document.querySelector('#loadingStatus')?.textContent,
     stage:document.querySelector('#stageFrame iframe')?.dataset.locationId,loading:document.querySelector('#sceneLoading')?.hidden})).catch(()=>null);
     if(out)await p.screenshot({path:path.join(out,'walk-interruption.jpg'),timeout:4000}).catch(()=>{});}
   throw error;
 }finally{if(out)h.write(path.join(out,'restart-walk.json'),report);await closeProfile();await host?.close();fs.rmSync(isolated.dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
