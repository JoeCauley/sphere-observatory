'use strict';

const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

(async () => {
  const server = await session();
  const browser = await chromium.launch({headless:true,executablePath:executable()});
  try {
    const context = await browser.newContext({viewport:{width:1160,height:780}});
    await server.attach(context);
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(server.origin+'/?border=wall', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows.length,
      null,{timeout:240000});
    const expected = await page.evaluate(async () => {
      const stage = SphereStageFrame, app = SphereApp, border = SphereBiomeLibrary.entry('border-transport');
      const row = stage.transportAddress().rows.find(r=>r.site.bay===0);
      const {station} = await stage.stationExterior(row.site.address,SphereBiomeLibrary.persistence==='file');
      const frontage = stage.stationHabitats(border.transport,station).indexOf(2);
      if(frontage<0)throw Error('Expected a native Super Jungle frontage');
      const side=frontage===1?1:-1;
      const geo = await import('/geographic-flight.js');
      const lip = station.widthM/2, route = station.routes.find(r=>r.id==='service');
      const pose = {eastM:row.site.x+route.nearDoor[0],northM:side*(lip-42),altitudeM:1.7,
        yaw:side===1?0:Math.PI,pitch:.16,mode:'walk'};
      app.setPlaying(false);
      const result = await stage.open(border.id,{entry:{geographic:true,active:false,pose,horizontalFov:68}});
      if(result?.status!=='arrived') throw Error('Station fixture failed');
      window.stationCrossings=[];
      window.nativeStationRead=()=>{
        if(document.querySelector('#departingStageFrame'))return null;
        const f=document.querySelector('#stageFrame iframe');
        if(f && !f.surfaceEntry?.active)return null;
        const state=app.getState(), p=f?f.contentWindow.SphereBiome.pose():geo.packPose(state,border,SphereAtlas,SphereWorld);
        return {depth:lip-side*p.northM,owner:f?'border':'native',lens:f?f.surfaceEntry.horizontalFov:state.fov,pitch:p.pitch};
      };
      const original=app.renderer.draw;
      let nativeDraw=null, pendingFrames=0, missingNativeFrames=0;
      function checkPending(){
        if(stationCrossings.length>=2)return;
        if(stationCrossings.length && !window.sphereStageCovered)app.draw();
        requestAnimationFrame(checkPending);
      }
      requestAnimationFrame(checkPending);
      app.renderer.draw=function(s,...rest){
        const value=original.call(this,s,...rest);
        nativeDraw={station:this.renderInfo.walkingStation,lens:s.fov,walking:s.walkMode};
        if(s.walkMode){
          const entering=document.querySelector('#stageFrame iframe');
          if(entering && !entering.surfaceEntry?.active && !window.sphereStageCovered){
            pendingFrames++;
            if(!nativeDraw.station)missingNativeFrames++;
          }
        }
        return value;
      };
      window.watchStationRelease=()=>{
        const departing=document.querySelector('#stageFrame');
        new MutationObserver((records,observer)=>{
          if(departing.isConnected)return;
          stationCrossings.push({atRelease:nativeStationRead(),nativeDraw});
          observer.disconnect();
        }).observe(departing.parentElement,{childList:true});
      };
      watchStationRelease();
      window.pendingNativeFrames=()=>({pendingFrames,missingNativeFrames});
      stage.setSurfacePace(1);
      return station.address.key;
    });
    console.log('Walking from the Jungle service gallery',expected);
    await page.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
    async function travel(key, predicate){
      await page.keyboard.down(key);
      try{await page.waitForFunction(predicate,null,{polling:'raf',timeout:90000});}
      catch(error){
        console.error(await page.evaluate(()=>({pose:nativeStationRead(),status:document.querySelector('#biomeLibraryStatus')?.textContent,
          phase:document.querySelector('#transitPhase')?.textContent,travel:SphereJourney.travel.status,arrival:SphereStageFrame.lastArrival})));
        throw error;
      }
      finally{await page.keyboard.up(key);}
    }
    await travel('KeyW',()=>nativeStationRead()?.owner==='native');
    const release=await page.evaluate(()=>stationCrossings[0]);
    assert(release?.atRelease,'Expected a visible native arrival');
    console.log('Native release',release);
    assert.equal(release.nativeDraw?.station,expected,'Native station geometry must already be on screen when Border retires');
    assert.equal(release.atRelease.lens,68,'Keep the horizontal lens across the walking transfer');
    assert(Math.abs(release.atRelease.pitch-.16)<.002,'Keep the outward sightline');
    assert(release.atRelease.depth<17 && release.atRelease.depth>8,'Outgoing station must keep control into the shared gallery');
    await travel('KeyS',()=>nativeStationRead()?.depth>25);
    assert.equal((await page.evaluate(()=>nativeStationRead())).owner,'native');
    await travel('KeyW',()=>nativeStationRead()?.depth<19);
    assert.equal((await page.evaluate(()=>nativeStationRead())).owner,'native');
    await travel('KeyS',()=>nativeStationRead()?.owner==='border');
    const entry=await page.evaluate(()=>({at:nativeStationRead(),frames:pendingNativeFrames()}));
    assert(entry.at.depth>=35 && entry.at.depth<45,JSON.stringify(entry));
    assert.equal(entry.at.lens,68);
    assert(entry.frames.pendingFrames>0,'Sample at least one retained native frame during pack preparation');
    assert.equal(entry.frames.missingNativeFrames,0,'Main must keep drawing its station while Border starts');
    console.log('Stable Super Jungle reversal and return',entry);
    await page.evaluate(()=>watchStationRelease());
    await page.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
    await travel('ArrowDown',()=>nativeStationRead()?.pitch<.025);
    await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
    await travel('KeyW',()=>stationCrossings.length===2);
    const flight=await page.evaluate(()=>stationCrossings[1]);
    assert.equal(flight.nativeDraw.walking,false,'Low flight must draw its own incoming frame');
    assert.equal(flight.nativeDraw.station,expected);
    assert.equal(flight.atRelease.lens,68);
    console.log('Low flight release',flight);
    const residency=await page.evaluate(async expected=>{
      const app=SphereApp,stage=SphereStageFrame,item=SphereBiomeLibrary.entry('border-transport');
      const geo=await import('/geographic-flight.js'),base=app.getState();
      const pose=geo.packPose(base,item,SphereAtlas,SphereWorld);
      const stateAt=(altitudeM,walkMode=false)=>({
        ...geo.mainPose(base,item,{...pose,altitudeM,mode:walkMode?'walk':'flight'},SphereAtlas,SphereWorld),walkMode
      });
      const frame=s=>stage.regionalFrame(performance.now(),false,s);
      app.setPlaying(false);app.setBusy(true);
      const distant=stateAt(1500000);
      frame(distant); // release the survey warmed by the route's initial high approach
      const contexts=new Set(),original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...options){
        const gl=original.call(this,type,...options);
        if(type==='webgl2' && gl && this!==app.renderer.canvas)contexts.add(gl);
        return gl;
      };
      try{
        const walking=stateAt(1.7,true),low=stateAt(42);
        let until=performance.now()+20000;
        do{
          frame(walking);app.renderer.draw(walking,640,360);
          if(app.renderer.renderInfo.walkingStation===expected)break;
          await new Promise(resolve=>setTimeout(resolve,32));
        }while(performance.now()<until);
        const walkingReady=app.renderer.renderInfo.walkingStation===expected;
        frame(low);app.renderer.draw(low,640,360);
        const lowReady=app.renderer.renderInfo.walkingStation===expected,lowContexts=contexts.size;
        frame(stateAt(3000));
        const composite=document.querySelector('canvas[data-station]'),gl=[...contexts][0];
        const highReady=!!gl && gl.canvas===composite && !composite.hidden && composite.dataset.station===expected &&
          !!gl.getParameter(gl.CURRENT_PROGRAM);
        frame(distant);
        return {walkingReady,lowReady,lowContexts,highContexts:contexts.size,highReady,
          disposed:!!gl && gl.isContextLost() && !composite.isConnected};
      }finally{HTMLCanvasElement.prototype.getContext=original;app.setBusy(false);}
    },expected);
    assert.deepEqual(residency,{walkingReady:true,lowReady:true,lowContexts:0,highContexts:1,highReady:true,disposed:true});
    console.log('Station renderer residency',residency);
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
