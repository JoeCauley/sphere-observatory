'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright'),{session,executable}=require('../tests/support/biome-browser.cjs');
const {record}=require('./transition-recorder.cjs');
const directory=path.resolve(process.argv[2]||'work/transition-audit');
const config=process.argv[3]||'installed';
if(!['empty','installed','placed'].includes(config))throw Error('Expected empty, installed or placed');
async function main(){
  fs.mkdirSync(directory,{recursive:true});const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true,args:['--mute-audio']});
  try{
    const ctx=await browser.newContext({viewport:{width:1104,height:680}});await host.attach(ctx);
    const page=await ctx.newPage();page.setDefaultTimeout(180000);
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    await page.locator('#togglePanel').click();await page.evaluate(async c=>{
      const l=SphereBiomeLibrary;if(c==='installed'){for(const p of l.packs())await l.install(p.id);}
      if(c==='placed')await l.placeRegion('sideways-city');
      SphereApp.setPlaying(false);
    },config);
    const plan=await page.evaluate(async config=>{
      const {walkPlan}=await import('./tools/transition-walk-plan.mjs');
      return walkPlan(SphereApp.getState(),SphereBiomeLibrary.placed(),{atlas:SphereAtlas,world:SphereWorld,math:SphereMath,collection:SphereCollection},config);
    },config);
    fs.writeFileSync(path.join(directory,'plan-'+config+'.json'),JSON.stringify(plan,null,2)+'\n');
    // All native owners get arrival and departure films across the installed set.
    // Empty and placed-only installations add matched controls for the same mechanism.
    const cases=config==='installed'?plan.selection:config==='empty'?plan.selection.filter((_,i)=>i%4===0):
        plan.selection.filter(r=>r.from==='sideways-city'||r.to==='sideways-city');
    console.log('PLAN',config,plan.laps.length,'circuits',plan.pairs.length,'directed pairs',cases.length,'films');
    let failed=0;
    for(const r of cases){
      const id='walk-'+config+'-'+r.key.replace('--','-');
      const file=path.join(directory,id+'.json');
      if(process.env.SPHERE_RESUME==='1'&&fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file));if(!old.failure&&!old.errors.length)continue;}
      if(process.env.SPHERE_CLIPS&&!process.env.SPHERE_CLIPS.split(',').includes(id))continue;
      const setup=await page.evaluate(async p=>{const ok=await SphereStageFrame.walkGround(p);return {ok,why:document.getElementById('biomeLibraryStatus').textContent};},r.before);
      assert(setup.ok,JSON.stringify(setup));console.log('START',id,new Date().toISOString());
      const receipt=await record(page,directory,id,async()=>{
        const enter=await page.evaluate(async r=>{
          const ok=await SphereStageFrame.crossWalkingEdge(r.before.q,r.after.q,r.before.forward);
          const f=document.querySelector('#stageFrame iframe');return {ok,gate:f?.surfaceEntry?.passage,why:document.getElementById('biomeLibraryStatus').textContent};
        },r);
        assert(enter.ok && enter.gate,JSON.stringify(enter));assert.equal(enter.gate.near.id,r.from);assert.equal(enter.gate.far.id,r.to);
        // The same controller and collision path as the developer walk clock.
        // Slow the first/last metres, accelerate the long straight middle.
        const travel=await page.evaluate(async()=>{
          const api=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;
          const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
          const start=api.pose().northM,end=1000043,steps=70,middle=[];
          let previous=start;
          for(let i=1;i<=steps;i++){
            const t=i/steps, p=t<.15?start+10*t/.15:t>.85?end-10+10.01*(t-.85)/.15:start+10+(end-start-20)*(t-.15)/.70;
            if(!await api.walkTunnel((p-previous)/3.3))throw Error('Floor or outlet failed at '+(p-start)+' m');
            if(i===35)middle.push(api.pose().northM);
            previous=p;await pause(65);
          }
          return {start,middle,end};
        });
        const end=await page.evaluate(async({gate,to})=>{
          const core=SphereApp.getState(),lib=SphereBiomeLibrary,child=document.querySelector('#stageFrame iframe')?.contentWindow;
          let q,walking;if(child){const g=await import('./geographic-flight.js');q=SphereMath.norm(g.mainPose(core,lib.entry(child.SphereBiome.id),child.SphereBiome.pose(),SphereAtlas,SphereWorld).position);walking=child.SphereBiome.pose().mode==='walk';}
          else{q=SphereMath.norm(core.position);walking=core.walkMode&&core.walkSurface;}
          const {ownerAt}=await import('./surface-passages.js');
          return {owner:ownerAt(q,core,lib.placed(),SphereAtlas,SphereWorld).id,walking,exitDirect:SphereCollection.visibility(q.map(v=>v*(core.radius-.0017)),core,64),slipM:Math.hypot(...gate.far.q.map((v,i)=>v-q[i]))*core.radius*1000};
        },{gate:enter.gate,to:r.to});
        assert.equal(end.owner,r.to);assert(end.walking&&end.slipM<.5,JSON.stringify(end));
        const target=page.locator('#stageFrame iframe');
        if(await target.count())await page.frameLocator('#stageFrame iframe').locator('#world').focus();else await page.locator('#viewport').focus();
        await page.keyboard.down('KeyW');try{await page.waitForTimeout(900);}finally{await page.keyboard.up('KeyW');}
        return {from:r.from,to:r.to,travel,end};
      });
      console.log('END',id,receipt.frames.length,receipt.failure||'arrived',receipt.errors);if(receipt.failure||receipt.errors.length)failed++;
    }
    if(failed)process.exitCode=1;
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
