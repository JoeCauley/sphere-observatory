'use strict';
// Use the working directory's offered pack and ordinary flight/walking controls.
// Run this file from either checkout for like-for-like captures on the same GPU.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {session,executable}=require(path.resolve('tests/support/biome-browser.cjs'));
const load=file=>import(pathToFileURL(path.resolve(file)).href);
const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*q)-1)];
function summary(rows){
 return {frames:rows.length,p95IntervalMs:quantile(rows.map(m=>m.intervalMs),.95),p99IntervalMs:quantile(rows.map(m=>m.intervalMs),.99),
  worstIntervalMs:Math.max(...rows.map(m=>m.intervalMs)),p95RenderCpuMs:quantile(rows.map(m=>m.renderCpuMs),.95),
  p95GpuMs:quantile(rows.flatMap(m=>m.gpu),.95),uploadBytes:rows.reduce((s,r)=>s+r.uploadBytes,0),peakBufferBytes:Math.max(...rows.map(r=>r.gpuBufferBytes))};
}
async function main(){
 const directory=path.resolve(process.argv[2]||'films/industry-approach'),film=process.argv.includes('--film');
 fs.mkdirSync(directory,{recursive:true});
 const pack=require(path.resolve('packs/biome-library.json')).packs.find(p=>p.id==='infinite-industry'),dir=path.dirname(pack.entry);
 const manifest=require(path.resolve(dir,'manifest.json'));
 const [model,facility,pods,contract]=await Promise.all([load(dir+'/model.js'),load(dir+'/facility.js'),load(dir+'/pod.js'),load('packs/runtime/v1/contract.js')]);
 const core=pods.pod(pods.district(0,0),-1,1).center,land=core[0]-45,high=1400,low=85,leg=4200,from=land-leg;
 const seed=model.initialState();seed.processPlaying=film;Object.assign(seed.pose,{eastM:from,northM:core[1],altitudeM:facility.DATUM_M+high,yaw:Math.PI/2,pitch:-Math.atan((high-low)/leg),mode:'flight'});
 const saved=model.saveState(seed),store=contract.createStore(manifest,{}),host=await session();
 const browser=await chromium.launch({headless:true,executablePath:executable()});
 const context=await browser.newContext({viewport:film?{width:1280,height:720}:{width:960,height:540}});
 try{
  await host.attach(context);
  await context.addInitScript(({key,save})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,save);
   window.routeFrames=[];let last=0;
   function observe(){
    const api=window.SphereBiome;
    if(api?.inspect().frames){
     window.firstPicture??=performance.now();
     if(!window.readyHook){window.readyHook=true;api.ready.then(()=>window.controlsReady=performance.now());}
     if(api.inspect().frames>=last+22){
      const rows=SphereIndustry.inspect().metrics.filter(r=>r.frame>last);
      for(const r of rows)window.routeFrames.push({frame:r.frame,intervalMs:r.intervalMs,renderCpuMs:r.renderCpuMs,
       uploadBytes:r.uploadBytes,gpuBufferBytes:r.gpuBufferBytes,triangles:r.triangles,drawCalls:r.drawCalls,
       gpu:r.gpuResolved.filter(t=>!t.disjoint).map(t=>t.ms)});
      if(rows.length)last=rows.at(-1).frame;
     }
    }
    requestAnimationFrame(observe);
   }
   requestAnimationFrame(observe);
  },{key:manifest.storageKey,save:store.encode({state:saved,bookmark:saved})});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host.origin+'/'+pack.entry);
  await page.waitForFunction(()=>Number.isFinite(window.controlsReady),null,{timeout:90000});
  if(process.argv.includes('--startup')){
   const timing=await page.evaluate(()=>({firstPictureMs:firstPicture,controlsReadyMs:controlsReady}));
   fs.writeFileSync(path.join(directory,'startup.json'),JSON.stringify(timing)+'\n');console.log(timing);return;
  }
  await page.keyboard.press('KeyH');await page.locator('#world').focus();
  if(film)await page.addStyleTag({content:'header,#show,footer,#status,.toast {visibility:hidden!important} #industryCaption {position:fixed;bottom:6%;left:4%;z-index:50;background:#112124e8;color:#f0eee4;border-left:3px solid #d8a257;padding:9px 15px;font:500 18px system-ui;pointer-events:none}'});
  const pose=()=>page.evaluate(()=>({pose:SphereBiome.pose(),frame:SphereBiome.inspect().frames}));
  const caption=async s=>{if(film)await page.evaluate(s=>{const el=document.querySelector('#industryCaption')||document.body.appendChild(document.createElement('div'));el.id='industryCaption';el.textContent=s;},s);};
  const waitFrames=async n=>{const a=await pose();await page.waitForFunction(f=>SphereBiome.inspect().frames>=f,a.frame+n,{polling:'raf'});};
  const marks=[];
  const mark=async name=>{const row={name,...await pose()};marks.push(row);return row;};
  const fly=async(keys,axis,end,sign)=>{
   for(const key of keys)await page.keyboard.down(key);
   try{await page.waitForFunction(({axis,end,sign})=>sign*(SphereBiome.pose()[axis]-end)>=0,{axis,end,sign},{polling:'raf',timeout:120000});}
   finally{for(const key of [...keys].reverse())await page.keyboard.up(key);}
  };
  const look=async(yaw,pitch)=>{
   const p=(await pose()).pose,dx=((yaw-p.yaw+3*Math.PI)%(2*Math.PI)-Math.PI)/.004,dy=(p.pitch-pitch)/.004;
   const n=Math.max(1,Math.ceil(Math.abs(dx)/320),Math.ceil(Math.abs(dy)/190));
   for(let i=0;i<n;i++){await page.mouse.move(580,320);await page.mouse.down();await page.mouse.move(580+dx/n,320+dy/n,{steps:film?12:2});await page.mouse.up();}
  };
  // Observe additional scenery drawing after arrival, with all motion released.
  const settle=async()=>page.evaluate(async()=>{
   const ctx=new OffscreenCanvas(128,72).getContext('2d',{willReadFrequently:true});
   const pixels=()=>{ctx.drawImage(document.getElementById('world'),0,0,128,72);return ctx.getImageData(0,0,128,72).data;};
   let old=pixels(),largest=0,over=0;
   for(let j=0;j<46;j++){
    await new Promise(requestAnimationFrame);const next=pixels();let changed=0;
    for(let i=0;i<old.length;i+=4)if((Math.abs(next[i]-old[i])+Math.abs(next[i+1]-old[i+1])+Math.abs(next[i+2]-old[i+2]))>36)changed++;
    old=next;largest=Math.max(largest,changed);over+=Number(changed>92);
   }
   return {frames:46,largest,over};
  });
  const settled=[];
  const route=async()=>{
   await caption('Infinite Industry   ·   1,400 m above the works');await mark('depart');
   if(film)await waitFrames(65);
   await fly(['KeyW','ShiftLeft'],'eastM',land,1);await mark('first arrival');
   settled.push(await settle());await page.locator('#world').screenshot({path:path.join(directory,'arrival.jpg'),type:'jpeg',quality:91});
   if(!film){
    await fly(['KeyS','ShiftLeft'],'eastM',from,-1);await mark('return to altitude');
    await fly(['KeyW','ShiftLeft'],'eastM',land,1);await mark('repeat arrival');settled.push(await settle());
   }
   await caption('Low flight   ·   turn across the hot bar district');await look(Math.PI/2,0);
   await mark('low run');await fly(['KeyW','ShiftLeft'],'eastM',land+190,1);
   await look(-Math.PI/2,0);await fly(['KeyW','ShiftLeft'],'eastM',land,-1);await mark('low return');
   await caption('Landing on the service lane');await look(Math.PI/2,-.1);
   await fly(['KeyQ','ShiftLeft'],'altitudeM',4,-1);
   await page.keyboard.press('KeyF');
   await page.waitForFunction(()=>SphereBiome.pose().mode==='walk',null,{timeout:6000});
   await mark('landed');await look(Math.PI/2,.09);
   await caption('On foot   ·   the process floor');await fly(['KeyW','ShiftLeft'],'eastM',land+62,1);await mark('walked');
   await look(2.55,.18);await waitFrames(42);await page.locator('#world').screenshot({path:path.join(directory,'walk.jpg'),type:'jpeg',quality:92});
   if(film){await caption('Looking back across the works');await look(-1.40,.11);await waitFrames(65);}
  };
  if(film){
   require(path.resolve('tools/compositor-film.cjs'));
   const recorder=require(path.resolve('tools/transition-recorder.cjs'));
   const report=await recorder.record(page,directory,'industry-approach',route,{standalone:true});
   assert.equal(report.failure,null,report.failure);assert.deepEqual(report.errors,[]);assert(report.sourcePictures.length>100);
  }else await route();
  await waitFrames(27);
  const readings=await page.evaluate(()=>({firstPictureMs:firstPicture,controlsReadyMs:controlsReady,rows:routeFrames,errors:SphereIndustry.inspect().webglErrors,
   renderer:SphereIndustry.inspect().renderer,identity:SphereIndustry.inspect().identity}));
  assert.deepEqual([...errors,...readings.errors],[]);
  const legs=marks.slice(1).map((m,i)=>({from:marks[i].name,to:m.name,...summary(readings.rows.filter(r=>r.frame>marks[i].frame&&r.frame<=m.frame))}));
  const place=await pose();assert(await page.evaluate(()=>SphereBiome.save()));await page.reload();
  await page.waitForFunction(()=>window.SphereBiome?.inspect().frames>=4,null,{timeout:90000});
  const restored=await pose();assert.equal(restored.pose.mode,'walk');
  assert(Math.hypot(restored.pose.eastM-place.pose.eastM,restored.pose.northM-place.pose.northM)<.02);
  const {rows,...machine}=readings;
  fs.writeFileSync(path.join(directory,'approach.json'),JSON.stringify({viewport:page.viewportSize(),...machine,marks,legs,settled,restored,errors},null,2)+'\n');
  console.log(JSON.stringify({first:readings.firstPictureMs,ready:readings.controlsReadyMs,legs,settled,walked:marks.at(-1).pose}));
 }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
