'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {setTimeout:sleep} = require('node:timers/promises');
const {chromium} = require('playwright');
const {session,executable} = require('../tests/support/biome-browser.cjs');
const recorder = require('./transition-recorder.cjs');
require('./compositor-film.cjs');

// Last published camera sample in the ALPHA roof film, in the station's metre chart.
const start = {eastM:-1099.9975301112147,northM:27610.063987886788,altitudeM:7.773607969284058,
  yaw:-3.1401440494167274,pitch:.05017765041097271,mode:'walk'};
const stationKey='sphere-ed6a59ab491a9a08/r10c0/r10c1/0';
const border='border-transport', meadow='infinite-meadow';
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));

async function main(){
  const dir=path.resolve(process.argv[2]||'films/return-walk');
  const host=await session();
  const browser=await chromium.launch({headless:true,executablePath:executable(),
    args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:756}});
    await host.attach(context);
    const page=await context.newPage();page.setDefaultTimeout(120000);
    page.on('pageerror',e=>console.error('Page error:',e.message));
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world && window.SphereStageFrame);
    const info=await page.evaluate(async ({start,key,live})=>{
      const geo=await import('./geographic-flight.js');
      const {stationRecord}=await import('./packs/border-transport/0.10.0/atlas.mjs');
      SphereApp.setPlaying(false);
      SphereApp.setState({...SphereApp.getState(),seed:713,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,
        layoutVersion:2,shadeGeometryRevision:3});
      await SphereBiomeLibrary.selectWorld();
      for(const id of ['infinite-meadow','border-transport']){
        if(SphereBiomeLibrary.entry(id))continue;
        if(live)throw Error('Requested installed world lacks '+id);
        await SphereBiomeLibrary.install(id);
      }
      const item=SphereBiomeLibrary.entry('border-transport'),site=item.transport.sites.find(s=>s.bay===0);
      if(site.address.key!==key)throw Error('The restored film belongs to a different station: '+site.address.key);
      const row=await stationRecord(site.address,false,SphereBiomeLibrary.persistence==='file');
      const travel=await SphereJourney.travel.request({type:'place',title:'Far-side look back',stageTrip:true,resolve:s=>{
        const placed=geo.mainPose(s,item,start,SphereAtlas,SphereWorld);
        SphereLanding.enter(placed,placed.position,{activate:false,grounded:true});return placed;
      }});
      if(travel.state!=='arrived')throw Error('Could not restore the recorded viewpoint: '+JSON.stringify(travel));
      window.readReturn=()=>{
        const s=SphereApp.getState(),frame=document.querySelector('#stageFrame iframe'),api=frame?.contentWindow?.SphereBiome;
        const local=api?.pose(),owner=api?.id||'Main',details=api?.inspect();
        const global=local?geo.mainPose(s,SphereBiomeLibrary.entry(owner),local,SphereAtlas,SphereWorld):s;
        const p=owner==='border-transport'?local:geo.packPose(global,item,SphereAtlas,SphereWorld);
        return {owner,x:p.eastM,z:p.northM,h:p.altitudeM,yaw:p.yaw,pitch:p.pitch,mode:local?.mode||(s.walkMode?'walk':'flight'),
          ready:api?details.frames>1&&!details.scripted&&frame.surfaceEntry?.active!==false:!SphereStageFrame.current&&!window.sphereStageCovered,
          station:details?.station??details?.exteriorStation??document.querySelector('#viewport canvas[data-station]:not([hidden])')?.dataset.station,
          locked:details?.locked,blocked:details?.blocked||'',ground:owner==='Main'&&s.walkMode?SphereLanding.heightAboveGround(s)*1000:null};
      };
      window.returnJournal=()=>stationRecord(site.address,false,SphereBiomeLibrary.persistence==='file');
      const caption=document.createElement('div');caption.id='returnFilmCaption';
      const picture=document.querySelector('#viewport').getBoundingClientRect();
      caption.style.cssText='position:fixed;z-index:12000;pointer-events:none;background:#101b20ed;color:#ffe0af;font:600 15px system-ui;padding:7px 12px;border-left:3px solid #dca359';
      caption.style.left=(picture.left+16)+'px';caption.style.top=(picture.top+64)+'px';
      document.body.append(caption);
      return {key,door:site.x+row.station.routes[0].farDoor[0],half:site.widthM/2,bridge:row.station.routes[0].points[2][1],
        initialDiscovery:row.discoveredAt,build:await fetch('/build-info.json').then(r=>r.json()).then(b=>b.commit)};
    },{start,key:stationKey,live:!!process.env.SPHERE_URL});
    const state=()=>page.evaluate(()=>window.readReturn());
    const frame=page.frameLocator('#stageFrame iframe');
    const focus=owner=>owner==='Main'?page.locator('#viewport').focus():frame.locator('canvas').first().focus();
    await page.waitForFunction(key=>{const s=window.readReturn();return s.ready&&s.mode==='walk'&&s.station===key&&Math.abs(s.ground-1.72)<.06;},stationKey);
    const here=await state();
    assert(Math.hypot(here.x-start.eastM,here.z-start.northM)<.3 && Math.abs(angle(here.yaw-start.yaw))<.004);
    console.log('Restored camera',JSON.stringify(here),'Door',info.door);
    const marks=[];let rate=1;
    const mark=async name=>{const s=await state();marks.push({name,...s});console.log(name,JSON.stringify(s));return s;};
    const caption=async (text,speed)=>{rate=speed;await page.locator('#returnFilmCaption').evaluate((el,s)=>el.textContent=s,text);};
    const pause=ms=>sleep(ms);
    async function walk(keys,test,timeout,guide){
      for(const key of keys)await page.keyboard.down(key);
      const end=Date.now()+timeout;let lastLog=0,lastGuide=0;
      try{
        while(Date.now()<end){
          const s=await state();
          if(s.ready && test(s))return s;
          if(Date.now()-lastLog>30000){console.log('Walking',s.owner,s.x.toFixed(2),s.z.toFixed(2),s.blocked);lastLog=Date.now();}
          if(guide && s.ready && Date.now()-lastGuide>180){await guide(s);lastGuide=Date.now();}
          await pause(40);
        }
        throw Error('Timed out walking: '+JSON.stringify(await state()));
      }finally{for(const key of keys.slice().reverse())await page.keyboard.up(key);}
    }
    const rect=await page.locator('#view').boundingBox();
    async function drag(dx,dy=0){
      const x=rect.x+rect.width*.48,y=rect.y+rect.height*.54;
      await page.mouse.move(x,y);await page.mouse.down();
      try{await page.mouse.move(x+dx,y+dy,{steps:Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/14))});}
      finally{await page.mouse.up();}
    }
    async function aim(yaw,pitch,owner){
      for(let i=0;i<12;i++){
        const s=await state(),sensitivity=owner==='Main'?.003:.004;
        const dx=Math.round(angle(yaw-s.yaw)/sensitivity),dy=Math.round((s.pitch-pitch)/sensitivity);
        if(!dx && !dy)return;
        await drag(Math.max(-135,Math.min(135,dx)),Math.max(-60,Math.min(60,dy)));
      }
      const s=await state();assert(Math.abs(angle(yaw-s.yaw))<.008,'Could not steer to the doorway: '+JSON.stringify(s));
    }
    async function alignDoor(){
      await aim(Math.PI,-.025,'Main');
      for(let i=0;i<4;i++){
        const s=await state(),sign=Math.sign(info.door-s.x);
        if(Math.abs(info.door-s.x)<.22)return;
        await walk([sign>0?'KeyA':'KeyD'],p=>(info.door-p.x)*sign<.12,45000);
      }
      assert(Math.abs((await state()).x-info.door)<.35,'Outside the service lane');
    }
    async function steerBridge(s){
      if(s.owner!==border)return;
      const direction=Math.atan2(info.door-s.x,-75);
      const dx=Math.round(angle(direction-s.yaw)/.004);
      if(dx)await drag(Math.max(-8,Math.min(8,dx)));
    }
    async function turnBackInMeadow(){
      const before=await state();
      // The adjoining habitat uses its own chart. Measure its mouse direction in
      // station coordinates, then pan at walking eye height without taking a step.
      await drag(10);await pause(80);
      const gain=angle((await state()).yaw-before.yaw)/10;
      assert(Math.abs(gain)>.002 && Math.abs(gain)<.006,'Meadow did not accept the camera drag');
      for(let i=0;i<48;i++){
        const s=await state(),dx=Math.round(angle(-s.yaw)/gain),dy=Math.round((s.pitch-.085)/.004);
        if(!dx && !dy)break;
        await drag(Math.max(-25,Math.min(25,dx)),Math.max(-8,Math.min(8,dy)));await pause(95);
      }
      const end=await mark('meadow-look-back');
      assert(Math.abs(angle(end.yaw))<.012 && Math.hypot(end.x-before.x,end.z-before.z)<.06,'Meadow look-back moved off its mark');
    }
    const pace=async n=>{await frame.locator('#pace').selectOption(String(n));await focus(border);};
    await caption('Super Jungle  ·  Far-side look back',1);
    const action=async()=>{
      await mark('look-back');await pause(1600);
      const targetZ=info.half+160;
      const first=await state();
      await aim(Math.atan2(info.door-first.x,targetZ-first.z),-.022,'Main');
      await caption('Far apron  ·  Run at 6 m/s  ·  24× playback',24);await focus('Main');
      await walk(['ShiftLeft','KeyW'],s=>s.z<=targetZ,1050000);
      await mark('service-lane');await alignDoor();await focus('Main');
      await caption('Service entrance  ·  6× playback',6);
      await walk(['ShiftLeft','KeyW'],s=>s.z<=info.half+24,115000);
      await mark('far-jamb');await caption('Far service door  ·  Real time',1);
      await walk(['KeyW'],s=>s.owner===border&&s.ready,75000);
      await mark('border-owner');await pace(1);await aim(Math.PI,-.02,border);
      await walk(['KeyW'],s=>s.z<=info.half-4,30000,steerBridge);
      await mark('through-far-door');
      await caption('Service bridge  ·  128× travel pace  ·  6× playback',6);await pace(128);
      await walk(['KeyW'],s=>s.z<20,270000,steerBridge);
      const crest=await mark('freight-crossing');assert(Math.abs(crest.h-info.bridge-1.7)<.12,'Lost bridge support');
      await caption('Above the freight lane  ·  Real time',1);
      await aim(Math.PI*.57,-.48,border);await pause(1700);await aim(Math.PI,-.025,border);
      await caption('Meadow side  ·  128× travel pace  ·  6× playback',6);
      await walk(['KeyW'],s=>s.z< -info.half+75,270000,steerBridge);
      await pace(16);await caption('Near service door  ·  16× travel pace',1);
      await walk(['KeyW'],s=>s.z< -info.half+9,18000,steerBridge);
      await pace(1);await caption('Back to Meadow  ·  Real time',1);
      await walk(['KeyW'],s=>s.owner===meadow&&s.ready,55000,steerBridge);
      await mark('meadow-owner');await focus(meadow);
      await walk(['KeyW'],s=>s.owner===meadow&&s.z< -info.half-22,30000);
      const end=await mark('meadow-apron');
      assert.equal(end.mode,'walk');assert.equal(end.station,stationKey);
      await caption('Meadow  ·  Looking back at the same station  ·  Real time',1);
      await turnBackInMeadow();
      const journal=await page.evaluate(()=>window.returnJournal());
      assert(journal.locked && journal.station.address.key===stationKey);
      if(info.initialDiscovery)assert.equal(journal.discoveredAt,info.initialDiscovery);
      await pause(2600);
      return {info,marks,discoveredAt:journal.discoveredAt};
    };
    fs.mkdirSync(dir,{recursive:true});
    const sample=async()=>({...await page.evaluate(recorder.readCamera),walk:await state()});
    const film=await recorder.record(page,dir,'outfall-return',action,{sample,playbackRate:()=>rate});
    if(film.failure)throw Error(film.failure);
    assert.deepEqual(film.errors,[]);
  }finally{await browser.close();await host.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
