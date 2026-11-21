'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{session,executable}=require('../tests/support/biome-browser.cjs');
const {record}=require('./transition-recorder.cjs');
const dir=path.resolve(process.argv[2]||'work/transition-audit'),filter=(process.env.SPHERE_CLIPS||'').split(',').filter(Boolean);
async function main(){
  fs.mkdirSync(dir,{recursive:true});const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable(),args:['--mute-audio']});
  let failures=0;
  try{
    const ctx=await browser.newContext({viewport:{width:1104,height:680}});await host.attach(ctx);const p=await ctx.newPage();p.setDefaultTimeout(180000);
    await p.goto(host.origin,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereBiomeLibrary?.world);
    await p.locator('#togglePanel').click();
    await p.evaluate(async()=>{SphereApp.setPlaying(false);for(const pack of SphereBiomeLibrary.packs())await SphereBiomeLibrary.install(pack.id);});
    const wanted=id=>(!filter.length||filter.includes(id))&&!(process.env.SPHERE_RESUME==='1'&&fs.existsSync(path.join(dir,id+'.json'))&&!JSON.parse(fs.readFileSync(path.join(dir,id+'.json'))).failure);
    async function shoot(id,action){
      console.log('START',id,new Date().toISOString());
      const r=await record(p,dir,id,action);console.log('END',id,r.frames.length,r.failure||'arrived',r.errors);
      if(r.failure||r.errors.length)failures++;
    }
    const child=()=>p.frameLocator('#stageFrame iframe');
    async function key(key,until,arg,limit=30000,fast=false){
      if(fast)await p.keyboard.down('ShiftLeft');await p.keyboard.down(key);
      try{await p.waitForFunction(until,arg,{polling:40,timeout:limit});}finally{await p.keyboard.up(key);if(fast)await p.keyboard.up('ShiftLeft');}
    }
    for(const [which,short] of [['sideways-city','city'],['infinite-meadow','meadow'],['infinite-industry','industry'],['border-outfall','outfall']]){
      const id='free-'+short+'-reverse';if(!wanted(id))continue;
      await p.evaluate(async which=>{
        SphereStageFrame.showMain();
        const g=await import('./geographic-flight.js'),s=SphereApp.getState(),item=SphereBiomeLibrary.entry(which);
        const camera={eastM:which==='border-outfall'?410:700,northM:which==='border-outfall'?-300:200,altitudeM:24600,yaw:.37,pitch:-.77,mode:'flight'};
        const view=g.mainPose(s,item,camera,SphereAtlas,SphereWorld);
        view.autoSpeed=false;view.speed=4;view.playing=false;SphereApp.setState(view);await SphereLoading.ensureCurrent();
      },which);
      await p.waitForFunction(()=>SphereLoading.ready && document.querySelector('#sceneLoading').hidden);
      await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await shoot(id,async()=>{
        await p.locator('#viewport').focus();await key('KeyQ',i=>SphereStageFrame.current?.id===i,which);
        await p.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active===true);
        await child().locator('#world').focus();
        const entry=await child().locator('body').evaluate(()=>SphereBiome.pose());
        await key('KeyQ',()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome.pose().altitudeM<21950);
        await p.waitForTimeout(250);
        const held=await child().locator('body').evaluate(()=>SphereBiome.pose());await p.waitForTimeout(800);
        const still=await child().locator('body').evaluate(()=>SphereBiome.pose());
        const near=await p.locator('#stageFrame iframe').evaluate(f=>Number(getComputedStyle(f).opacity));assert(near>0 && near<1,'Expected overlapping altitude layers, got '+near);
        assert(Math.abs(held.altitudeM-still.altitudeM)<.05,'hover drift '+(held.altitudeM-still.altitudeM));
        await p.keyboard.down('KeyX');await p.waitForTimeout(450);await p.keyboard.up('KeyX');
        await key('KeyE',()=>!SphereStageFrame.current,null,60000,true);
        const end=await p.evaluate(()=>{const s=SphereApp.getState();return {altitudeKm:s.radius-Math.hypot(...s.position),q:SphereMath.norm(s.position)};});
        assert(end.altitudeKm>=24 && end.altitudeKm<55,JSON.stringify(end));
        return {pack:which,entry,held,still,near,end};
      });
      await p.evaluate(()=>SphereStageFrame.showMain());
    }
    for(const side of ['near','far']){
      const id='outfall-'+side+'-roof';if(!wanted(id))continue;
      await p.evaluate(async side=>{
        SphereStageFrame.showMain();const lib=SphereBiomeLibrary,geo=await import('./geographic-flight.js'),model=await import('./packs/border-outfall/1.0.0/model.js');
        const {farEdgeM,rampEastM,rampAt}=await import('./packs/kit/border-profile.js'),toward=side==='near'?1:-1;
        const northM=side==='near'?-7:farEdgeM+7;
        const pose={eastM:rampEastM,northM,altitudeM:rampAt(rampEastM,northM)+1.7,yaw:toward===1?0:Math.PI,pitch:-.22,mode:'walk'};
        const s=model.initial();s.pose=pose;s.bookmark={...pose};lib.saveStorage().setItem(lib.pack('border-outfall').saveKey,JSON.stringify({schema:1,...s}));
        await SphereStageFrame.open('border-outfall');
      },side);
      await shoot(id,async()=>{
        await child().locator('#world').focus();
        const start=await child().locator('body').evaluate(()=>SphereBiome.pose());
        await key('KeyW',side=>{const q=document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.pose();return q&&(side==='near'?q.northM>1:q.northM<1000042);},side,15000,true);
        const roof=await child().locator('body').evaluate(()=>SphereBiome.pose());assert.equal(roof.mode,'walk');assert(Math.abs(roof.altitudeM-1401.7)<.1);
        await p.keyboard.press('Space');await p.keyboard.down('KeyX');await p.waitForTimeout(1200);await p.keyboard.up('KeyX');
        await key('KeyE',()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome.pose().altitudeM>1650,null,10000,true);
        const end=await child().locator('body').evaluate(()=>SphereBiome.pose());return {side,start,roof,end};
      });await p.evaluate(()=>SphereStageFrame.showMain());
    }
    const service='meadow-outfall-service-door';
    if(wanted(service)){
      await p.evaluate(async()=>{
        SphereStageFrame.showMain();
        const lib=SphereBiomeLibrary,pack=lib.pack('infinite-meadow'),base=new URL('.',new URL(pack.entry,location.href));
        const kit=await import('./packs/kit/surface-route.js'),m=await import(new URL('model.js',base));
        const contract=await import('./packs/runtime/v1/contract.js'),manifest=await (await fetch(new URL('manifest.json',base))).json();
        const address=SphereStageFrame.surfaceAddress(),chart=kit.chartFor(address.home,address.edge,address.radiusKm);
        const state=m.initialState(),bookmark=JSON.parse(m.saveState(state)),datum=m.terrain(chart.eastM,chart.northM);
        state.pose=kit.toMeadow({eastM:0,northM:kit.enterNorthM-140,altitudeM:45,yaw:0,pitch:0,mode:'flight'},chart,datum);
        contract.createStore(manifest,lib.saveStorage()).write({state:JSON.parse(m.saveState(state)),bookmark});
        await SphereStageFrame.open('infinite-meadow');
      });
      await shoot(service,async()=>{
        await child().locator('#outfallCourse').click();
        await p.waitForFunction(()=>SphereStageFrame.lastArrival?.route==='surface' && SphereStageFrame.current?.id==='border-outfall');
        await p.waitForFunction(()=>{const a=document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome;return a&&!a.inspect().levelCruising&&a.pose().northM>-19;},null,{timeout:145000});
        const wall=await child().locator('body').evaluate(()=>SphereBiome.pose());
        assert(Math.abs(wall.northM+18)<.05);
        await child().locator('#world').focus();
        await key('KeyQ',()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<5);
        await p.keyboard.press('KeyF');
        await key('KeyW',()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().northM>=11);
        const before=await child().locator('body').evaluate(()=>SphereBiome.inspect().valveOpen);
        await child().locator('#action').click();await p.waitForTimeout(1500);
        const end=await child().locator('body').evaluate(()=>({pose:SphereBiome.pose(),valve:SphereBiome.inspect().valveOpen}));
        assert.equal(end.pose.mode,'walk');assert.notEqual(end.valve,before);
        return {wall,end};
      });
    }
    const violet='violet-crown-descent';
    if(wanted(violet)){
      await p.evaluate(async()=>{
        SphereStageFrame.showMain();const s=await SpherePlaces.destination(SphereApp.getState(),'biome-9','ground'),M=SphereMath,G=SphereGround;
        s.walkMode=false;s.playing=false;s.routeShades=false;s.time=0;
        const f=G.frame(s),grove=SphereVioletForest.referenceGrove(s);s.position=f.world([0,.12,0]);await SphereApp.renderer.prepare(s,{aspect:1.62});
        const ground=G.ground(s,0,0),choices=grove.spires.map(tree=>({tree,p:f.local(M.mul(tree.q,s.radius))})).filter(v=>v.tree.height>.085&&Math.hypot(v.p[0],v.p[2])>.12).sort((a,b)=>Math.hypot(a.p[0],a.p[2])-Math.hypot(b.p[0],b.p[2]));
        const {tree,p}=choices[0],look=f.world([p[0],ground+tree.height*.53,p[2]]);
        window.crystalSurvey={s,f,ground,look,tree:{id:tree.id,heightM:tree.height*1000}};
        s.position=f.world([0,ground+.48,-.24]);s.forward=M.norm(M.sub(look,s.position));s.up=M.basis(s.forward,f.basis[1]).u;
        SphereApp.setState(s);await SphereLoading.ensureCurrent();
      });
      await shoot(violet,async()=>p.evaluate(async()=>{
        const {s,f,ground,look,tree}=crystalSurvey,duration=11500,start=performance.now();
        await new Promise(resolve=>{function motion(t){const u=Math.min(1,(t-start)/duration),e=u*u*(3-2*u);
          s.position=f.world([.025*Math.sin(Math.PI*e),ground+.0017+.4783*(1-e),-.24*(1-e)]);
          s.forward=SphereMath.norm(SphereMath.sub(look,s.position));s.up=SphereMath.basis(s.forward,f.basis[1]).u;SphereApp.setState(s);
          if(u===1)resolve();else requestAnimationFrame(motion);
        }requestAnimationFrame(motion);});
        await SphereLoading.ensureCurrent();
        const settled=SphereApp.getState();return {tree,eyeM:(f.local(settled.position)[1]-ground)*1000,site:settled.siteId};
      }));
    }
    if(failures)process.exitCode=1;
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
