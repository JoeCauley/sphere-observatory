'use strict';

// Long release gate. All movement after opening the public service approach uses player controls.
// node tools/verify-station-round-trip.cjs [output-directory] [--film]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {setTimeout: sleep} = require('node:timers/promises');
const {chromium} = require('playwright');
const {session, executable} = require('../tests/support/biome-browser.cjs');
const recorder = require('./transition-recorder.cjs');
require('./compositor-film.cjs');

const border = 'border-transport', meadow = 'infinite-meadow';
const output = path.resolve(process.argv.slice(2).find(s => !s.startsWith('--')) || 'work/station-round-trip');
const film = process.argv.includes('--film');
const angle = a => Math.atan2(Math.sin(a),Math.cos(a));

function compareExchange(clip,outputFile) {
  const ready=clip.frames.filter(frame=>frame.ready);
  const i=ready.findIndex((frame,k)=>k>0 && frame.owner!==ready[k-1].owner);
  assert(i>0,'Missing renderer exchange in '+clip.id);
  const from=ready[i-1],to=ready[i],ffmpeg=recorder.ffmpeg();
  const sample=ms=>{
    const args=['-v','error','-ss',(ms/1000).toFixed(3),'-i',outputFile,'-frames:v','1',
      '-vf','crop=iw*0.70:ih*0.71:iw*0.15:ih*0.12,scale=96:64:flags=area',
      '-f','rawvideo','-pix_fmt','rgb24','pipe:1'];
    const image=spawnSync(ffmpeg,args,{windowsHide:true});
    if(image.status!==0 || image.stdout?.length!==96*64*3)throw Error('Could not decode '+clip.id+' at '+ms+' ms');
    return image.stdout;
  };
  const before=sample(from.ms);
  function delta(ms){
    const after=sample(ms);let sum=0;
    for(let j=0;j<before.length;j++)sum+=Math.abs(before[j]-after[j]);
    return sum/(255*before.length);
  }
  return {route:clip.id,from:from.owner,to:to.owner,readyIntervalMs:to.ms-from.ms,
    centralRgbChange:delta(to.ms),centralRgbChangeAfter250ms:delta(Math.min(clip.durationMs-80,to.ms+250))};
}

async function instrument() {
  const geo = await import('./geographic-flight.js');
  const departure = (await import('./studies/border-crossing/clear-day-flight.mjs')).departure;
  const {stationRecord} = await import('./packs/border-transport/0.10.0/atlas.mjs');
  const {item,site,meta} = departure;
  const {station} = await stationRecord(site.address,false,SphereBiomeLibrary.persistence==='file');
  const route = station.routes[0], south = site.address.plots[0]===SphereBiomeLibrary.entry('infinite-meadow').plotId;
  SphereApp.setPlaying(false);
  window.readStationTrip = () => {
    const core = SphereApp.getState(), iframe = document.querySelector('#stageFrame iframe');
    const api = iframe?.contentWindow?.SphereBiome, pose = api?.pose(), inspect = api?.inspect();
    const owner = api?.id || 'Main';
    const world = pose ? geo.mainPose(core,SphereBiomeLibrary.entry(owner),pose,SphereAtlas,SphereWorld) : core;
    const local = owner===item.id ? pose : geo.packPose(world,item,SphereAtlas,SphereWorld);
    return {...local,owner,sampleMs:performance.now(),pace:SphereStageFrame.surfacePace,mode:pose?.mode || (core.walkMode?'walk':'flight'),time:core.time,
      ready:api ? inspect.frames>1 && !inspect.held && !inspect.scripted && iframe.surfaceEntry?.active!==false :
        !SphereStageFrame.current && !window.sphereStageCovered,
      blocked:inspect?.blocked || '',station:inspect?.station || inspect?.exteriorStation ||
        SphereApp.renderer.renderInfo?.walkingStation || null,
      nativeSite:!api ? core.siteId : null,frames:inspect?.frames,uploads:inspect?.uploads,
      drawCalls:inspect?.drawCalls,arrival:SphereStageFrame.lastArrival?.route};
  };
  return {seed:meta.seed,world:meta.world,station:site.address.key,build:SphereBuild,device:SphereApp.renderer.device,
    day:meta.day,time:SphereApp.getState().time,half:site.widthM/2,door:site.x+route.nearDoor[0],
    bridge:route.points[2][1],forward:south?1:-1,hand:meta.hand};
}

async function main() {
  fs.mkdirSync(output,{recursive:true});
  const service=await session();
  let browser,page;
  const receipt={route:'/?border=doors',marks:[],inputs:[],handoffs:[],visualExchanges:[],positionSamples:[],errors:[]};
  try {
    browser=await chromium.launch({headless:true,executablePath:executable(),args:[
      '--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
    page=await browser.newPage({viewport:{width:1360,height:820}});
    await service.attach(page);
    page.setDefaultTimeout(300000);
    page.on('pageerror',err=>receipt.errors.push(err.message));
    await page.goto(service.origin+receipt.route,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && SphereStageFrame.current?.id==='infinite-meadow' &&
      document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
    const meta=receipt.meta=await page.evaluate(instrument);
    const read=()=>page.evaluate(()=>readStationTrip());
    const frame=page.frameLocator('#stageFrame iframe');
    const rect=await page.locator('#viewport').boundingBox();
    const mouseX=Math.round(rect.x+rect.width*.5), mouseY=Math.round(rect.y+rect.height*.56);
    const focus=owner=>owner==='Main'?page.locator('#viewport').focus():frame.locator('canvas').first().focus();
    const mark=async name=>{
      const state=await read();
      const graphics=await page.evaluate(()=>{
        const f=document.querySelector('#stageFrame iframe');
        const gl=f?.contentDocument?.querySelector('canvas')?.getContext('webgl2') || SphereApp.renderer.gl;
        return {glError:gl.getError(),contextLost:gl.isContextLost()};
      });
      Object.assign(state,graphics);assert.equal(state.glError,0,name+' WebGL error');assert.equal(state.contextLost,false);
      receipt.marks.push({name,at:Date.now(),...state});
      assert.equal(state.mode,'walk',name+' changed movement mode');
      assert(Math.abs(state.eastM-meta.door)<.82,name+' left the service bridge: '+JSON.stringify(state));
      assert.equal(state.time,meta.time,name+' advanced the paused simulation');
      assert(!state.blocked,name+' blocked: '+state.blocked);
      await page.locator('#viewport').screenshot({path:path.join(output,name+'.jpg'),quality:86});
      console.log(name,state.owner,state.eastM.toFixed(2),state.northM.toFixed(2),state.altitudeM.toFixed(2));
      return state;
    };
    const drag=async(dx,dy=0)=>{
      await page.mouse.move(mouseX,mouseY);await page.mouse.down();
      try {await page.mouse.move(mouseX+dx,mouseY+dy,{steps:2});} finally {await page.mouse.up();}
    };
    async function look(yaw,pitch) {
      const start=await read();await drag(16);await sleep(50);const probe=await read();
      const gain=angle(probe.yaw-start.yaw)/16;
      assert(Math.abs(gain)>.0005,'Mouse did not turn the '+start.owner+' camera');
      for(let i=0;i<28;i++){
        const p=await read(),dx=Math.round(angle(yaw-p.yaw)/gain);
        const dy=Math.round((p.pitch-pitch)/(p.owner==='Main'?.003:.004));
        if(!dx&&!dy)return;
        await drag(Math.max(-110,Math.min(110,dx)),Math.max(-35,Math.min(35,dy)));await sleep(40);
      }
      assert(Math.abs(angle((await read()).yaw-yaw))<.006,'Could not turn toward the door');
    }
    async function hold(keys,test,timeout=55000,guide=null) {
      const start=await read();await focus(start.owner);
      receipt.inputs.push({at:Date.now(),owner:start.owner,keys});
      for(const k of keys)await page.keyboard.down(k);
      try {
        const stop=Date.now()+timeout;let previous=start,blockedSince=null;
        while(Date.now()<stop){
          const p=await read();
          if(p.ready){
            if(p.blocked){
              blockedSince ??= Date.now();
              if(Date.now()-blockedSince>1600)throw Error('Blocked while holding '+keys.join('+')+': '+JSON.stringify(p));
            }else blockedSince=null;
            const last=receipt.positionSamples.at(-1);
            if(!last || p.sampleMs-last.sampleMs>=500 || p.owner!==last.owner){
              const {sampleMs,owner,eastM,northM,altitudeM,mode,yaw,pitch,pace}=p;
              receipt.positionSamples.push({sampleMs,owner,eastM,northM,altitudeM,mode,yaw,pitch,pace});
            }
            if(p.owner!==previous.owner){
              const distance=Math.hypot(p.eastM-previous.eastM,p.northM-previous.northM);
              receipt.handoffs.push({keys,from:previous,to:p,distanceM:distance});
              assert(distance<6 && Math.abs(p.altitudeM-previous.altitudeM)<.15 && Math.abs(angle(previous.yaw-p.yaw))<.02 && Math.abs(previous.pitch-p.pitch)<.01 && previous.mode===p.mode,'Discontinuous handoff: '+JSON.stringify(receipt.handoffs.at(-1)));
            }
            previous=p;
            if(test(p))return p;
            if(guide)await guide(p);
          }
          await sleep(36);
        }
        throw Error('Movement timed out: '+JSON.stringify(await read()));
      } finally {for(const k of keys.toReversed())await page.keyboard.up(k);}
    }
    async function pace(value) {
      await frame.locator('#pace').selectOption(String(value));await focus(border);
    }
    async function march(key,goal) {
      await hold([key],goal,70000);
    }
    async function doorstep(name,dir,wall,entering,exterior) {
      const distance=p=>dir*(p.northM-wall);
      const destination=entering?border:exterior;
      const run=async()=>{
        if(entering && exterior===meadow && await frame.locator('#hide').isVisible())await frame.locator('#hide').click();
        const first=await mark(name+'-approach');
        assert.equal(first.owner,entering?exterior:border);
        await sleep(650);
        // Keep the orange jamb in sight on both sides, moving sideways at walking pace.
        await march('KeyW',p=>distance(p)>=-6.5);
        await mark(name+'-facing-door');
        await march('KeyW',p=>distance(p)>=-2.3);
        await look(Math.PI/2,.09);
        const before=await read();
        await focus(before.owner);await page.keyboard.down('KeyD');
        try{await sleep(150);}finally{await page.keyboard.up('KeyD');}
        const shifted=await read(),key=dir*(shifted.northM-before.northM)>0?'KeyD':'KeyA';
        await march(key,p=>distance(p)>=-.8);
        const beforeWall=await mark(name+'-before-jamb');
        assert(Math.abs(distance(beforeWall)+.8)<.6,'Missed the near face of the jamb');
        await sleep(850);
        await march(key,p=>distance(p)>=.8);
        const afterWall=await mark(name+'-after-jamb');
        assert(Math.abs(distance(afterWall)-.8)<.6,'Missed the far face of the jamb');
        await sleep(850);
        await look(dir===1?0:Math.PI,.015);
        await march('KeyW',p=>p.owner===destination && distance(p)>=(entering?39:7));
        const last=await mark(name+'-departure');
        assert.equal(last.owner,destination);
        if(destination===border)assert.equal(last.station,meta.station);
        if(destination==='Main')assert(last.nativeSite,'Missing native habitat identity');
        await sleep(650);
      };
      if(film) {
        const clip=await recorder.record(page,output,name,run,{sample:read});
        if(clip.failure)throw Error(clip.failure);
        assert.deepEqual(clip.errors,[]);
        receipt.visualExchanges.push(compareExchange(clip,path.join(output,name+'.mp4')));
      }else await run();
    }
    async function crossBridge(name,dir) {
      const steer=async p=>{
        assert.equal(p.owner,border,'Left the station on the service bridge');
        const desired=Math.atan2(meta.door-p.eastM,dir*170);
        const dx=Math.round(angle(desired-p.yaw)/(.004*meta.hand));
        if(dx)await drag(Math.max(-4,Math.min(4,dx)));
      };
      await pace(128);
      await hold(['ShiftLeft','KeyW'],p=>dir*p.northM>=-100,240000,steer);
      const crest=await mark(name+'-bridge');
      assert(Math.abs(crest.altitudeM-meta.bridge-1.7)<.15,'Lost support on the bridge');
      if(film && name==='outbound'){
        await pace(1);
        const bridgeFilm=await recorder.record(page,output,'service-bridge',async()=>{
          await hold(['KeyW'],p=>dir*(p.northM-crest.northM)>4,10000,steer);
          await look(Math.PI*.57,-.40);await mark('service-bridge-lookout');await sleep(1300);
          await look(dir===1?0:Math.PI,.015);
        },{sample:read});
        if(bridgeFilm.failure)throw Error(bridgeFilm.failure);
        await pace(128);
      }
      await hold(['ShiftLeft','KeyW'],p=>dir*p.northM>=meta.half-400,240000,steer);
      await pace(16);await hold(['KeyW'],p=>dir*p.northM>=meta.half-56,60000,steer);
      await pace(1);
    }
    const f=meta.forward,firstWall=-f*meta.half,farWall=f*meta.half;
    await doorstep('outbound-meadow',f,firstWall,true,meadow);
    await crossBridge('outbound',f);
    await doorstep('outbound-native',f,farWall,false,'Main');
    await look(1.41,.06);await mark('native-frontage');
    await look(f===1?Math.PI:0,.015);
    await doorstep('return-native',-f,farWall,true,'Main');
    await crossBridge('return',-f);
    await doorstep('return-meadow',-f,firstWall,false,meadow);
    assert.equal(receipt.handoffs.length,4,'Expected four physical renderer handoffs');
    assert.deepEqual(receipt.errors,[]);receipt.passed=true;
  } catch(error) {
    receipt.failure=error.message;
    if(page)await page.screenshot({path:path.join(output,'failed-view.jpg')}).catch(()=>{});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output,'station-round-trip.json'),JSON.stringify(receipt,null,2)+'\n');
    await browser?.close();await service.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});













