const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message);});page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log(m.type(),m.text());});
  const start=Date.now();await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereSession);
  const startupMs=Date.now()-start;console.log("Startup",startupMs);
  const result=await page.evaluate(async budget=>{
   const A=SphereApp,R=A.renderer,M=SphereMath,E=SphereEdges;A.setBusy(true);SphereEvolution.visit('shade-0');
   if(E.streaming)E.streaming.uploadBudgetMs=budget;const s=A.getState(),anchor=SphereSites.shadeSection(s),tasks=[],records=[];
   const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
   const tick=()=>new Promise(r=>requestAnimationFrame(r));
   for(const distance of [...Array.from({length:51},(_,i)=>i*10),500,250,0,500,0]){
    s.position=anchor.world([-.3,.2,distance+.75]);const before=performance.now();R.draw(s,1280,720);const cpuMs=performance.now()-before;await tick();
    records.push({distance,cpuMs,frameMs:performance.now()-before,gpuMs:R.gpuMs,groups:R.renderInfo.geometry?.groups||0,cache:E.streaming?.info.cache??E.cacheSize,cacheMiB:E.streaming?.info.vertexMiB??E.cacheVertexMiB,stream:E.streaming?.info||null,heap:performance.memory?.usedJSHeapSize});
   }
   const settle=performance.now();while(R.needsFrame&&performance.now()-settle<30000){R.draw(s,1280,720);await tick();}
   const warm=[];for(let i=0;i<30;i++){const t=performance.now();R.draw(s,1280,720);await tick();warm.push(performance.now()-t);}
   observer.disconnect();const stats=values=>{values.sort((a,b)=>a-b);return {p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],p99:values[Math.floor(values.length*.99)],max:Math.max(...values)};};
   return {device:R.device,records,travel:stats(records.map(x=>x.frameMs)),cpu:stats(records.map(x=>x.cpuMs)),warm:stats(warm),longestTask:Math.max(0,...tasks),settleMs:performance.now()-settle,settled:!R.needsFrame,final:E.streaming?.info||null,error:R.error()};
  },Number(process.env.SPHERE_UPLOAD_BUDGET||4));
  const dir=path.resolve('work/screenshots/next-leap');fs.mkdirSync(dir,{recursive:true});
  const label=process.env.SPHERE_PROFILE_LABEL||'streaming';fs.writeFileSync(path.join(dir,label+'.json'),JSON.stringify({startupMs,...result,errors},null,2));
  console.log(JSON.stringify({label,startupMs,...result,records:undefined},null,2));assert.equal(result.error,0);assert.deepEqual(errors,[]);assert(result.settled);assert(result.records.every(x=>x.cache<=1200));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
