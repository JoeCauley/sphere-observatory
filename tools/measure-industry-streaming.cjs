'use strict';
// A fixed camera exposes scenery arriving after the first visible picture.
// Run the same saved pose in a new context each time, through the offered pack.
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require(path.resolve('tests/support/biome-browser.cjs'));

async function main(){
  const directory=path.resolve(process.argv[2]||'films/industry-streaming');
  fs.mkdirSync(directory,{recursive:true});
  const root=process.cwd();
  const pack=require(path.join(root,'packs/biome-library.json')).packs.find(p=>p.id==='infinite-industry');
  const folder=path.dirname(pack.entry);
  const load=file=>import(pathToFileURL(path.join(root,file)).href);
  const [model,facility,contract]=await Promise.all([load(folder+'/model.js'),load(folder+'/facility.js'),load('packs/runtime/v1/contract.js')]);
  const manifest=require(path.join(root,folder,'manifest.json'));
  const store=contract.createStore(manifest,{});
  const host=await session(), browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const reports=[];
    for(const height of [85,1400]){
      const context=await browser.newContext({viewport:{width:960,height:540}});
      await host.attach(context);
      const seed=model.initialState();seed.processPlaying=false;
      Object.assign(seed.pose,{eastM:2500,northM:900,altitudeM:facility.DATUM_M+height,yaw:-.28,pitch:height>1000?-.48:-.11,mode:'flight'});
      const state=model.saveState(seed);
      await context.addInitScript(({key,save})=>{
        localStorage.setItem(key,save);
        const colors=new OffscreenCanvas(128,72).getContext('2d',{willReadFrequently:true});
        const samples=[];let previous,seen=0;
        window.industryStrip=samples;
        window.firstTimes={};
        function sample(){
          const api=window.SphereBiome;
          const frame=api?.inspect().frames??0;
          if(frame && frame!==seen){
            const canvas=document.getElementById('world');seen=frame;
            if(!window.firstTimes.pictureMs){
              window.firstTimes.pictureMs=performance.now();
              api.ready.then(()=>window.firstTimes.controlsMs=performance.now());
            }
            colors.drawImage(canvas,0,0,128,72);
            const next=colors.getImageData(0,0,128,72).data;
            let changed=0,sum=0;
            if(previous)for(let i=0;i<next.length;i+=4){
              const d=(Math.abs(next[i]-previous[i])+Math.abs(next[i+1]-previous[i+1])+Math.abs(next[i+2]-previous[i+2]))/3;
              sum+=d;if(d>12)changed++;
            }
            samples.push({frame,changedPixels:changed,meanDelta:sum/(128*72*255),pose:api.pose()});previous=next;
          }
          if(samples.length<180)requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      },{key:manifest.storageKey,save:store.encode({state,bookmark:state})});
      const page=await context.newPage();
      await page.goto(host.origin+'/'+pack.entry);
      await page.waitForFunction(()=>window.industryStrip?.length>=180,null,{timeout:120000});
      const report=await page.evaluate(()=>{
        const model=SphereIndustry.inspect(), samples=window.industryStrip;
        const indices=new Set(samples.map(s=>s.frame));
        const frames=model.metrics.filter(f=>indices.has(f.frame));
        return {samples,times:window.firstTimes,frames:frames.map(({frame,renderCpuMs,intervalMs,uploadBytes,gpuBufferBytes,drawCalls,triangles,gpuResolved})=>
          ({frame,renderCpuMs,intervalMs,uploadBytes,gpuBufferBytes,drawCalls,triangles,gpuMs:gpuResolved.filter(r=>!r.disjoint).map(r=>r.ms)})),
          errors:model.webglErrors,depth:model.renderer.depth};
      });
      await page.locator('#world').screenshot({path:path.join(directory,'industry-'+height+'m.png')});
      assert.deepEqual(report.errors,[]);
      assert(report.samples.every(r=>Math.hypot(r.pose.eastM-seed.pose.eastM,r.pose.northM-seed.pose.northM)<.01));
      reports.push({height,viewport:[960,540],sampleGrid:[128,72],...report});
      console.log(height+' m, initial pictures with >1% pixels changing:',report.samples.filter(s=>s.changedPixels>92).length);
      await context.close();
    }
    fs.writeFileSync(path.join(directory,'industry-streaming.json'),JSON.stringify(reports));
    // Feather the flight controls either side of one plant's detail threshold.
    const pods=await load(folder+'/pod.js'),district=pods.district(0,0);
    const hex=pods.hexes(pods.pod(district,1,0))[2],height=85;
    const threshold=1.3*district.hexM, north=hex.center[1]+Math.sqrt(threshold*threshold-height*height);
    const saved=model.initialState();saved.processPlaying=false;
    Object.assign(saved.pose,{eastM:hex.center[0],northM:north+4,altitudeM:facility.DATUM_M+height,yaw:0,pitch:0,mode:'flight'});
    const context=await browser.newContext({viewport:{width:960,height:540}});await host.attach(context);
    const pose=model.saveState(saved);
    await context.addInitScript(([key,bytes])=>localStorage.setItem(key,bytes),[manifest.storageKey,store.encode({state:pose,bookmark:pose})]);
    const page=await context.newPage();await page.goto(host.origin+'/'+pack.entry);
    await page.waitForFunction(()=>window.SphereBiome?.inspect().frames>180);
    const first=await page.evaluate(()=>SphereBiome.inspect().frames);
    await page.locator('#world').focus();
    const turns=[];
    for(let i=0;i<12;i++){
      const sign=i%2===0?-1:1,key=sign<0?'KeyW':'KeyS';
      await page.keyboard.down(key);
      try{await page.waitForFunction(({sign,north})=>sign*(SphereBiome.pose().northM-north)>=4,{sign,north},{polling:'raf',timeout:9000});}
      finally{await page.keyboard.up(key);}
      const p=await page.evaluate(()=>({pose:SphereBiome.pose(),frame:SphereBiome.inspect().frames}));
      turns.push(p);await page.waitForFunction(n=>SphereBiome.inspect().frames>=n+10,p.frame);
    }
    const readings=await page.evaluate(first=>{
      const i=SphereIndustry.inspect(),rows=i.metrics.filter(f=>f.frame>first);
      return {frames:rows.length,framesWithUploads:rows.filter(f=>f.uploadBytes>0).length,
        uploadBytes:rows.reduce((s,r)=>s+r.uploadBytes,0),peakGpuBytes:Math.max(...rows.map(r=>r.gpuBufferBytes)),errors:i.webglErrors};
    },first);
    assert.deepEqual(readings.errors,[]);
    assert(turns.every(t=>Math.abs(t.pose.eastM-hex.center[0])<.1 && Math.abs(t.pose.northM-north)<15));
    fs.writeFileSync(path.join(directory,'industry-reversals.json'),JSON.stringify({hex:hex.id,height,threshold,north,turns,...readings},null,2));
    console.log('Six out-and-back flights across the plant detail threshold',readings);
    await context.close();
  }finally{await browser.close();await host.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
