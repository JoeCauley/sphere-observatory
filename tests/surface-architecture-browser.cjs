'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function main(){
  const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
  try{
    const context=await browser.newContext({viewport:{width:860,height:560}});
    await host.attach(context);
    const page=await context.newPage(),errors=[];
    page.setDefaultTimeout(180000);
    page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    await page.evaluate(async()=>{
      const s=SphereApp.getState();s.seed=23;s.playing=false;s.time=0;s.routeShades=true;
      SphereApp.setState(s);await SphereBiomeLibrary.selectWorld();await SphereBiomeLibrary.install('infinite-meadow');await SphereBiomeLibrary.install('border-transport');
    });
    await page.waitForFunction(()=>SphereBiomeSurface.inspect().status==='ready' && SphereLoading.ready);
    const colors=await page.evaluate(()=>{
      SphereApp.setBusy(true);
      const r=SphereApp.renderer,lib=SphereBiomeLibrary,M=SphereMath,A=SphereAtlas;
      const home=A.byId(lib.entry('infinite-meadow').plotId);
      const samples=[];
      try{
        for(const [km,offset,tilt] of [[500,0,0],[500,.7,.5],[24.1,.4,0],[19.9,.25,0],[500,1.3,0]]){
          const s=SphereApp.getState(),q=SphereWorld.direction(home.latitude,home.longitude+offset*Math.PI/home.columns,s);
          const east=SphereSites.shellFrame(q)[0];s.position=M.mul(q,s.radius-km);
          s.forward=M.norm(M.add(q,M.mul(east,tilt)));s.up=M.basis(s.forward,SphereWorld.frame(s).axis).u;
          const read=on=>{
            SphereBiomeSurface.show(on);r.draw(s,280,200);
            const gl=r.gl,pixel=new Uint8Array(4);
            gl.readPixels(gl.drawingBufferWidth>>1,gl.drawingBufferHeight>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
            return [...pixel];
          };
          samples.push({km,offset,off:read(false),on:read(true)});
        }
        return samples;
      }finally{SphereBiomeSurface.show(true);SphereApp.setBusy(false);}
    });
    for(const v of colors.slice(0,-1))assert(v.on.slice(0,3).some((c,i)=>Math.abs(c-v.off[i])>=3),JSON.stringify(v));
    assert.deepEqual(colors.at(-1).on,colors.at(-1).off);
    console.log('PASS actual nadir and oblique shell pixels at 500 km, 24.1 and 19.9 km, and bare neighbor',JSON.stringify(colors));
    await page.evaluate(()=>SphereStageFrame.open('infinite-meadow'));
    const frame=page.frameLocator('#stageFrame iframe');
    async function shade(time,shades=true){
      await page.evaluate(({time,shades})=>{const s=SphereApp.getState();s.time=time;s.playing=false;s.routeShades=shades;SphereApp.setState(s);SphereApp.setPlaying(false);},{time,shades});
      await page.waitForFunction(t=>document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect().light?.time===t,time,{polling:100});
      return frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
        const gl=document.querySelector('canvas').getContext('webgl2'),pixel=new Uint8Array(4);
        gl.readPixels(gl.drawingBufferWidth>>1,Math.floor(gl.drawingBufferHeight*.79),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        resolve({...SphereBiome.inspect().light,sky:[...pixel],error:gl.getError()});
      })));
    }
    const full=await shade(0),partial=await shade(132000),dark=await shade(132300),off=await shade(132301,false);
    const expected=await page.evaluate(async()=>{
      const s=SphereApp.getState(),p=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose();
      const plot=SphereAtlas.byId(SphereBiomeLibrary.entry('infinite-meadow').plotId);
      const {unproject}=await import('./packs/kit/surface-route.js');
      const at=unproject(plot,p.eastM,p.northM,s.radius*1000),q=SphereWorld.direction(at.latitude,at.longitude,s);
      const receiver=q.map(v=>v*(s.radius-p.altitudeM/1000));
      return [[0,true],[132000,true],[132300,true],[132301,false]].map(([time,routeShades])=>SphereCollection.visibility(receiver,{...s,time,routeShades},64));
    });
    assert.deepEqual([full.direct,partial.direct,dark.direct,off.direct],expected);
    assert(full.direct>.9 && partial.direct>0 && partial.direct<full.direct && dark.direct===0 && off.direct>.9);
    for(const l of [full,partial,dark,off]){assert.equal(l.error,0);assert.equal(l.direct,l.canopyDaylight);assert.equal(l.direct,l.interiorDaylight);}
    assert(full.sky[1]>partial.sky[1] && partial.sky[1]>dark.sky[1],JSON.stringify([full,partial,dark]));
    await page.evaluate(()=>SphereApp.setPlaying(true));
    await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome.inspect().light.time>132301,null,{polling:100});
    await page.evaluate(()=>SphereApp.setPlaying(false));await page.waitForTimeout(300);
    const time=await frame.locator('body').evaluate(()=>SphereBiome.inspect().light.time);
    await page.waitForTimeout(300);assert.equal(await frame.locator('body').evaluate(()=>SphereBiome.inspect().light.time),time);
    console.log('PASS hosted clear, penumbra, umbra, Shades off and play/pause',JSON.stringify([full,partial,dark,off]));
    await page.evaluate(()=>SphereStageFrame.showMain());
    const far=await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary,cell=lib.entry('border-transport/outfall').edge.far;
      const item=await lib.placeRegion('sideways-city',{plotId:cell,footprint:{shape:'rectangle',east:1,north:1}});
      return [cell,item.plotId,lib.entry(item.id),item.detailInstalled];
    });
    assert.equal(far[0],far[1]);assert.deepEqual(far.slice(2),[null,false]);
    const border='border-transport/outfall',city='sideways-city';
    async function roof(){
      await page.evaluate(async()=>{
        const lib=SphereBiomeLibrary,model=await import('./packs/border-transport/0.10.0/outfall/model.js'),profile=await import('./packs/kit/border-profile.js');
        const r=model.initial();r.pose={eastM:410,northM:profile.farEdgeM-3,altitudeM:1401.7,mode:'walk',yaw:0,pitch:0};r.bookmark={...r.pose};
        lib.saveStorage().setItem(lib.sceneInfo('border-transport/outfall').saveKey,JSON.stringify({schema:1,...r}));
        await SphereStageFrame.open('border-transport/outfall');
      });
      await frame.locator('#world').focus();
    }
    async function go(key,test,arg){
      await page.keyboard.down(key);try{await page.waitForFunction(test,arg,{polling:50,timeout:80000});}finally{await page.keyboard.up(key);}
    }
    async function flyAcross(){
      await go('KeyW',()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.pose().northM>1000041);
      await page.keyboard.press('Space');
      await go('KeyE',()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.pose().altitudeM>1460);
      await page.keyboard.down('ShiftLeft');
      try{await go('KeyW',id=>SphereStageFrame.current?.id!==id,border);}finally{await page.keyboard.up('ShiftLeft');}
    }
    await roof();await flyAcross();
    await page.waitForFunction(()=>!SphereStageFrame.current && SphereLoading.ready);
    const baseline=await page.evaluate(()=>{
      const s=SphereApp.getState(),q=SphereMath.norm(s.position),g=SphereWorld.coordinates(q,s);
      return {id:SphereAtlas.regionAt(SphereBiomeLibrary.placed(),g.lat,g.lon)?.id,h:s.radius-Math.hypot(...s.position),forward:s.forward};
    });
    assert.equal(baseline.id,city);assert(baseline.h>1.4 && baseline.h<1.8);
    // Reverse the bearing in Main and fly across the same edge with the normal forward key.
    await page.evaluate(()=>{const s=SphereApp.getState();s.forward=s.forward.map(v=>-v);s.autoSpeed=false;s.speed=2;SphereApp.setState(s);});
    await page.locator('#viewport').focus();
    await go('KeyW',id=>SphereStageFrame.current?.id===id && document.querySelector('#stageFrame iframe')?.surfaceEntry?.active,border);
    await page.evaluate(()=>SphereStageFrame.showMain());
    await page.evaluate(()=>SphereBiomeLibrary.install('sideways-city'));
    await roof();await flyAcross();
    await page.waitForFunction(id=>SphereStageFrame.current?.id===id && document.querySelector('#stageFrame iframe')?.surfaceEntry?.active,city,{timeout:90000});
    assert.equal(await frame.locator('body').evaluate(()=>SphereBiome.pose().mode),'flight');
    await page.evaluate(()=>SphereStageFrame.showMain());
    const remembered=await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary,old=lib.entry('sideways-city');
      await lib.remove(old.id);const baseline=lib.placed().find(i=>i.id===old.id);
      await lib.install(old.id);return {old,baseline,restored:lib.entry(old.id)};
    });
    assert.equal(remembered.baseline.detailInstalled,false);assert.deepEqual(remembered.old,remembered.restored);
    console.log('PASS rooftop walk, manual lift and low overflight to mapped far ground, reverse entry from Main, installed City destination and persistent placement');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
