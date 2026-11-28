'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright'),{executable}=require('./support/biome-browser.cjs'),{disposable}=require('./support/observatory-server.cjs');
(async()=>{
 const host=await disposable('http');
 const browser=await chromium.launch({headless:true,executablePath:executable()});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host.origin+'/?border=beyond',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
  await page.evaluate(async()=>{
    const geo=await import('/geographic-flight.js');
    window.checkCamera=()=>{
      const frame=document.querySelector('#stageFrame iframe'),app=SphereApp.getState(),api=frame?.contentWindow.SphereBiome;
      const scene=SphereStageFrame.current?.id,host=scene?frame.parentElement:document.getElementById('viewport');
      const panel=host.querySelector('.camera-locator'),item=scene&&SphereBiomeLibrary.entry(scene);
      if(!panel||panel.hidden||!panel.getClientRects().length||scene&&!api)return false;
      const s=item?(api.nativeView?.()??geo.mainPose(app,item,api.pose(),SphereAtlas,SphereWorld)):app;
      const rows=[...panel.querySelectorAll('.camera-columns')].slice(1);
      for(const [i,row] of rows.entries()){
        const values=[...row.querySelectorAll('i,span')].map(node=>Number(node.textContent));
        if(Math.abs(values[0]-s.position[i])>.00051||Math.abs(values[1]-s.forward[i])>.0000051||Math.abs(values[2]-s.up[i])>.0000051)return false;
      }
      return {scene:scene||'Main',position:s.position,aim:s.forward,plot:panel.querySelector('.camera-dot').getAttribute('cx'),lens:panel.querySelector('.camera-lens').textContent};
    };
  });
  async function check(label){
    const result=await (await page.waitForFunction(()=>checkCamera())).jsonValue();
    if(process.env.SPHERE_CAMERA_FIELD)await page.screenshot({path:path.join(process.env.SPHERE_CAMERA_FIELD,label+'.png')});
    console.log(label,JSON.stringify(result));return result;
  }
  const station=await check('station');
  assert(!await page.locator('#openMeadowPack').isVisible(),'Main shortcut must leave the station controls clear');
  await page.evaluate(async()=>{
    const documentBefore=document.querySelector('#stageFrame iframe').contentDocument;
    const viewport=document.getElementById('viewport');
    await viewport.requestFullscreen();
    if(!document.fullscreenElement.contains(document.querySelector('.camera-locator')))throw Error('The camera plot left fullscreen');
    await document.exitFullscreen();
    if(document.querySelector('#stageFrame iframe').contentDocument!==documentBefore)throw Error('Fullscreen reloaded the station');
  });
  const canvas=page.frameLocator('#stageFrame iframe').locator('canvas').first();
  await canvas.focus();await page.keyboard.down('w');try{await page.waitForTimeout(650);}finally{await page.keyboard.up('w');}
  const moved=await check('station-moved');assert.notDeepEqual(station.position,moved.position);
  await page.evaluate(async()=>{
    SphereStageFrame.close();SphereApp.setPlaying(false);
    const b=SphereBiomeLibrary.entry('border-transport'),site=b.transport.sites.find(s=>s.bay===0);
    const {generateStation}=await import('/packs/border-transport/0.10.0/station.mjs'),s=generateStation(site.address);
    const pose={eastM:site.x+s.routes[2].nearDoor[0],northM:-s.laneHalfM-86,altitudeM:-51.3,yaw:0,pitch:0,mode:'flight'};
    await SphereStageFrame.open(b.id,{entry:{geographic:true,active:false,pose,horizontalFov:103}});
  });
  await check('bay-zero-trench');
  await page.evaluate(async()=>{
    SphereStageFrame.close();
    const s=SphereApp.getState(),b=SphereBiomeLibrary.entry('border-transport'),geo=await import('/geographic-flight.js');
    SphereApp.setState({...geo.mainPose(s,b,{eastM:240000,northM:0,altitudeM:543000,yaw:Math.PI/2,pitch:-.034},SphereAtlas,SphereWorld),playing:false,fov:45});
  });
  const main=await check('main');assert.equal(main.scene,'Main');
  await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,600));
  await page.locator('#viewport').focus();await page.keyboard.down('w');
  try{await page.waitForFunction(p=>Math.hypot(...SphereApp.getState().position.map((x,i)=>x-p[i]))>320,main.position);}
  finally{await page.keyboard.up('w');}
  await check('aerial-wall-flight');
  await page.evaluate(()=>{const s=SphereApp.getState();s.up=SphereMath.rotate(s.up,s.forward,.39);s.fov=72;SphereApp.setState(s);});
  assert.match((await check('main-rolled')).lens,/72\.0/);
  await page.evaluate(async()=>{await SphereBiomeLibrary.install('infinite-industry');await SphereStageFrame.open('infinite-industry');});
  const industry=await check('industry');assert.equal(industry.scene,'infinite-industry');
  await canvas.focus();await page.keyboard.down('ArrowRight');try{await page.waitForTimeout(550);}finally{await page.keyboard.up('ArrowRight');}
  assert.notDeepEqual((await check('industry-turned')).aim,industry.aim);
  await page.evaluate(()=>document.body.classList.add('clean'));assert(!(await page.locator('.camera-locator').isVisible()));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
