'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {setTimeout: sleep} = require('node:timers/promises');
const {chromium} = require('playwright');
const {executable} = require('../tests/support/biome-browser.cjs');
const {disposable} = require('../tests/support/observatory-server.cjs');
const recorder = require('./transition-recorder.cjs');
require('./compositor-film.cjs');

const border = 'border-transport';
const directory = path.resolve(process.argv[2] || 'films/clear-day-border');
const freightBearing = ['along','across'].includes(process.argv[3]) ? process.argv[3] : null;
const startHeight = freightBearing ? null : Number(process.argv[3] || 100000);
const approachDegrees = Number(process.argv[4] || 23);
const seed = 713;

async function placeCamera({seed,startHeight,approachDegrees,freightBearing}) {
  const geo=await import('./geographic-flight.js');
  const {freightAt}=await import('./packs/border-transport/0.10.0/station.mjs');
  const study=await import('./studies/border-crossing/clear-day-flight.mjs');
  const {item,site,model,meta}=freightBearing?study.departure:await study.prepareClearFlight({seed,startHeight,approachDegrees});
  if(freightBearing){
    if(meta.freightBearing!==freightBearing)throw Error('The Observatory opened a different departure.');
    SphereApp.setPlaying(false);
    SphereApp.setState({...SphereApp.getState(),time:meta.day.time});
  }
  const {center}=meta;
  const rect = document.getElementById('viewport').getBoundingClientRect();
  window.clearFlightReading = () => {
    const s=SphereApp.getState();
    const f=document.querySelector('#stageFrame iframe');
    const a=f?.contentWindow?.SphereBiome, owner=a?.id??'Main', ins=a?.inspect?.();
    const local=a?.pose?.();
    const p=Number.isFinite(local?.altitudeM)?local:geo.packPose(s,item,SphereAtlas,SphereWorld);
    const canvas=document.querySelector('#viewport canvas[data-station]:not([hidden])');
    const hud=f?.contentDocument?.getElementById('hud');
    const localGl=ins?.frames>0?f.contentDocument.getElementById('scene')?.getContext('webgl2'):null;
    const frameOpacity=f?Number(getComputedStyle(f).opacity):0;
    const sceneOpacity=f?Number(getComputedStyle(f.parentElement).opacity):0;
    const car=freightBearing && freightAt(model,s.time);
    return {owner,ready:a?ins.frames>1&&!ins.held&&!ins.scripted&&f.surfaceEntry?.active!==false:!SphereStageFrame.current&&!window.sphereStageCovered,
      ...(car?{freightEastM:site.x+car.x+Math.round((center.eastM-site.x-car.x)/car.spacingM)*car.spacingM}:{}),
      station:ins?.station??canvas?.dataset.station, p, frameOpacity,sceneOpacity,mainFov:s.fov,
      sky:{clouds:s.clouds,cavityHaze:s.cavityHaze,weather:s.weatherStrength,atmosphere:s.atmosphere,
        direct:a?SphereStageFrame.surfaceLight(f.contentWindow,p)?.direct:SphereCollection.visibility(s.position,s,64),
        shades:s.routeShades, time:s.time,blind:a?.air?.().blind??null},
      hudOpacity:hud?Number(f.contentWindow.getComputedStyle(hud).opacity):0,
      localGl:localGl?.getError()??0, localLost:localGl?.isContextLost()??false,
      status:SphereStageFrame.lastArrival?.status, blocked:ins?.blocked, survey:canvas?.dataset.station};
  };
  return {...meta,
    width:rect.width,height:rect.height,device:SphereApp.renderer.device,build:await fetch('/build-info.json').then(r=>r.json())};
}

async function main() {
  if(!freightBearing)assert(startHeight>25000 && startHeight<=200000 && approachDegrees>=15 && approachDegrees<=35);
  fs.mkdirSync(directory,{recursive:true});
  const host=await disposable(process.env.SPHERE_TEST_TRANSPORT||'http');
  const browser=await chromium.launch({headless:true,executablePath:executable(),
    args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:786}});
    await host.attach(context);
    const page=await context.newPage();
    // Hide instrument labels for a blind review. The world and loading effects still reach the compositor.
    page.on('framenavigated',frame=>{
      if(new URL(frame.url()).pathname.endsWith('/border-transport/0.10.0/index.html')){
        frame.addStyleTag({content:'#hud,#touch {opacity:0!important;pointer-events:none!important}'}).catch(error=>{
          if(!frame.isDetached())console.error('Recording instruments',error.message);
        });
      }
    });
    page.setDefaultTimeout(90000);
    const errors=[];
    page.on('pageerror', e=>{errors.push(e.message);console.error('Page error:', e.message);});
    await page.goto(freightBearing?host.origin+'/?freight='+freightBearing:host.origin,{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:'#viewport .view-actions,#openMeadowPack,#stageFrame > div:first-child,#departingStageFrame > div:first-child {visibility:hidden!important}'});
    await page.waitForFunction(()=>window.SphereStageFrame && window.SphereBiomeLibrary?.world && window.SphereLoading?.ready);
    await page.locator('#viewport').focus();
    await page.keyboard.press('KeyH');
    const meta=await page.evaluate(placeCamera,{seed,startHeight,approachDegrees,freightBearing});
    console.log('Setup',JSON.stringify({address:meta.address,start:meta.start,day:meta.day,device:meta.device}));
    await page.waitForFunction(()=>{const s=clearFlightReading();return s.owner==='Main'&&s.survey&&s.ready&&!SphereLoading.active;});
    await sleep(700);
    const state=()=>page.evaluate(()=>clearFlightReading());
    const marks=[], keyLog=[];
    const frame=page.frameLocator('#stageFrame iframe');
    const focus=owner=>owner==='Main'?page.locator('#viewport').focus():frame.locator('canvas').first().focus();
    const mark=async label=>{
      const s=await state();
      marks.push({label,ts:Date.now(),...s});
      console.log(label,s.owner,Math.round(s.p.altitudeM),Math.round(s.p.eastM),Math.round(s.p.northM));
      return s;
    };
    async function until(test,timeout=95000) {
      const end=Date.now()+timeout;
      let s;
      do {s=await state();if(test(s))return s;await sleep(30);}while(Date.now()<end);
      throw Error('Flight timed out at '+JSON.stringify(s));
    }
    async function hold(keys,owner,test) {
      await focus(owner);
      keyLog.push({at:Date.now(),owner,keys,pressed:true});
      for(const k of keys)await page.keyboard.down(k);
      try{return await until(test);}
      finally{for(const k of [...keys].reverse())await page.keyboard.up(k);keyLog.push({at:Date.now(),owner,keys,pressed:false});}
    }
    async function changeMode(target) {
      await frame.locator('#mode').focus();
      await page.keyboard.press('Enter');
      await until(s=>s.p.mode===target,5000);
    }
    async function look(yaw,pitch) {
      const rect=await frame.locator('canvas').first().boundingBox();
      const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
      for(let i=0;i<32;i++){
        const s=(await state()).p;
        const turn=Math.atan2(Math.sin(yaw-s.yaw),Math.cos(yaw-s.yaw));
        const dx=Math.round(Math.max(-35,Math.min(35,turn/(.004*meta.hand))));
        const dy=Math.round(Math.max(-25,Math.min(25,(s.pitch-pitch)/.004)));
        if(!dx&&!dy)return;
        await page.mouse.move(x,y);await page.mouse.down();
        try{await page.mouse.move(x+dx,y+dy,{steps:4});}finally{await page.mouse.up();}
      }
      throw Error('Could not turn toward the quay');
    }
    async function freightFlight() {
      await page.evaluate(()=>SphereApp.setPlaying(true));
      await mark('departure');await sleep(700);
      await hold(['KeyW'],'Main',s=>s.owner===border&&s.ready);
      await mark('inbound-local-control');
      await hold(['KeyW'],border,s=>s.p.altitudeM<=meta.center.altitudeM);
      const over=await mark('over-loading-bay');
      // Fly the final descent looking at the machinery. The quay lies between the cranes.
      const yaw=Math.atan2(meta.landmark.x-over.p.eastM,meta.landmark.z-over.p.northM);
      await look(yaw,-.76);
      await hold(['KeyF'],border,s=>s.p.altitudeM<=1950);
      await look(yaw,.48);await sleep(1100);
      await hold(['KeyF'],border,s=>s.p.altitudeM<=175);
      await look(yaw,.045);
      await hold(['KeyF'],border,s=>s.p.altitudeM<=1.72);
      await changeMode('walk');
      const landed=await mark('quay-contact');
      assert.equal(landed.station,meta.address);assert.equal(landed.p.mode,'walk');
      assert(Math.abs(landed.p.northM-meta.center.northM)<135 && Math.abs(landed.p.eastM-meta.center.eastM)<165,
        'Landed outside the selected inspection quay: '+JSON.stringify(landed.p));
      await look(yaw,Math.atan2(meta.landmark.h-landed.p.altitudeM,
        Math.hypot(meta.landmark.x-landed.p.eastM,meta.landmark.z-landed.p.northM)));
      await mark('central-crane-from-quay');await sleep(1600);
      await look(Math.PI/2,.075);
      await frame.locator('#pace').selectOption('16');
      await hold(['KeyW'],border,s=>s.p.eastM>=landed.p.eastM+135);
      await frame.locator('#pace').selectOption('1');
      await look(1.20,.19);
      await hold(['KeyW'],border,s=>s.p.eastM>=landed.p.eastM+146);
      const before=await mark('watching-freight');
      await sleep(4800);
      const after=await mark('end-of-walk');
      assert.equal(after.p.mode,'walk');assert(Math.abs(after.p.altitudeM-1.7)<.02);
      assert(after.freightEastM-before.freightEastM>8,'The load must move while the observer stands still');
      return {meta,marks,keyLog};
    }
    const id=freightBearing?'freight-quay-'+freightBearing:'clear-day-border-round-trip';
    const film=await recorder.record(page,directory,id,freightBearing?freightFlight:async()=>{
      await mark('departure');await sleep(800);
      if(startHeight>36000)await hold(['ShiftLeft','KeyW'],'Main',s=>s.p.altitudeM<=35500);
      await hold(['KeyW'],'Main',s=>s.owner===border&&s.ready);
      await mark('inbound-local-control');
      await hold(['KeyW'],border,s=>s.p.altitudeM<=meta.center.altitudeM+.02);
      const contact=await mark('roof-contact');
      assert.equal(contact.station,meta.address);
      await changeMode('walk');await mark('standing-on-roof');await sleep(1700);
      await changeMode('flight');
      await hold(['KeyS'],border,s=>s.owner==='Main'&&s.ready);
      await mark('outbound-main-control');
      if(startHeight>36000)await hold(['KeyS'],'Main',s=>s.p.altitudeM>=35500);
      await hold(startHeight>36000?['ShiftLeft','KeyS']:['KeyS'],'Main',s=>s.p.altitudeM>=startHeight);
      await mark('back-above-station');await sleep(700);
      return {meta,marks,keyLog};
    },{sample:async()=>({...await page.evaluate(recorder.readCamera),flight:await state()})});
    assert.ifError(film.failure);assert.deepEqual(errors,[]);
    console.log('Complete',film.durationMs,film.width,film.height,film.frames.length);
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
