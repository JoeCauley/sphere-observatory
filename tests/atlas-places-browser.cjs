// A fresh browser and a restarted Observatory must recover the marked local pose from disk.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright');
const {start}=require('./support/observatory-server.cjs');
const {executable}=require('./support/biome-browser.cjs');

(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sphere-atlas-places-')),storePath=path.join(dir,'atlas.json');
  let host;
  const browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    host=await start({transport:'http',storePath});
    const errors=[];
    async function openBrowser(){
      const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
      await page.goto(host.origin);await page.waitForFunction(()=>window.SphereLoading?.ready && SphereBiomeLibrary.world);
      await page.locator('[data-tab=camera]').click();
      await page.evaluate(()=>{document.querySelector('#atlasPlaces').open=true;document.querySelector('#exactPosition').open=true;});
      return {context,page};
    }
    let {context,page}=await openBrowser();
    const border='border-transport';
    const before=await page.evaluate(async id=>{
      const lib=SphereBiomeLibrary,b=await lib.install(id),site=b.transport.sites.at(-1);
      const {stationRecord}=await import('/packs/border-transport/0.10.0/atlas.mjs');
      const {boardingPose,walker}=await import('/packs/border-transport/0.10.0/motion.mjs');
      const {station}=await stationRecord(site.address,false,true);
      const pose=boardingPose(station,walker);
      pose.northM=-station.widthM/2+53;pose.eastM-=1.1;pose.pitch=.14;
      await SphereStageFrame.open(id,{entry:{geographic:true,active:false,pose}});
      return {station:site.address.key,pose};
    },border);
    const scene=()=>page.frameLocator('#stageFrame iframe').locator('#scene');
    await scene().focus();await page.keyboard.down('KeyW');
    try{await page.waitForFunction(z=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome.pose().northM>z+.6,before.pose.northM);}
    finally{await page.keyboard.up('KeyW');}
    await page.locator('#atlasPlaceName').fill('East bay survey mark');
    await page.locator('#atlasMarkHere').click();
    await page.waitForFunction(()=>SphereBiomeLibrary.marks().length===1);
    const mark=await page.evaluate(()=>SphereBiomeLibrary.marks()[0]);
    assert.equal(mark.station,before.station);assert.equal(mark.group,'service');assert.equal(mark.pose.mode,'walk');
    assert(mark.pose.northM>before.pose.northM+.5);
    const coordinates=await page.evaluate(async()=>{
      const geo=await import('/geographic-flight.js'),lib=SphereBiomeLibrary,m=lib.marks()[0],s=SphereApp.getState();
      const v=geo.worldPosition(s,lib.entry(m.sceneId),m.pose,SphereAtlas,SphereWorld),ll=SphereWorld.coordinates(SphereMath.norm(v),s);
      return [ll.lat*180/Math.PI,ll.lon*180/Math.PI,s.radius-Math.hypot(...v)];
    });
    const digits=await page.locator('#cameraLon').inputValue();assert(digits.split('.')[1].length>=9);
    await page.waitForFunction(expected=>['cameraLat','cameraLon','cameraAltitude'].every((id,i)=>
      Math.abs(document.getElementById(id).valueAsNumber-expected[i])<(i===2?.000002:2e-10)),coordinates);
    await page.evaluate(()=>SphereStageFrame.close());await context.close();
    const port=new URL(host.origin).port;await host.close();host=null;
    host=await start({transport:'http',port:Number(port),storePath});
    ({context,page}=await openBrowser());
    await page.locator('#atlasPlaceList').getByRole('button',{name:mark.name}).click();
    await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
    const restored=await scene().evaluate(()=>({pose:SphereBiome.pose(),info:SphereBiome.inspect()}));
    assert.deepEqual(restored.pose,mark.pose);assert.equal(restored.info.station,mark.station);
    const positions=()=>['#cameraLat','#cameraLon','#cameraAltitude'].map(s=>page.locator(s));
    await page.waitForFunction(expected=>Math.abs(document.querySelector('#cameraLon').valueAsNumber-expected)<2e-10,coordinates[1]);
    // The visible readout follows the traveler through repeated HUD updates.
    const readings=await page.evaluate(async()=>{
      const readings=[];
      for(let n=0;n<15;n++){
        readings.push(['cameraLat','cameraLon','cameraAltitude'].map(id=>document.getElementById(id).valueAsNumber));
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      return readings;
    });
    assert(readings.every(sample=>sample.every((v,i)=>Math.abs(v-coordinates[i])<(i===2?.000002:2e-10))));
    // A typed coordinate remains a draft while the live readout ticks. Go uses the Atlas axes.
    const [lat,lon,alt]=positions();await lat.fill(coordinates[0].toFixed(10));
    await lon.fill(coordinates[1].toFixed(10));await alt.fill('0.050');
    // Editing remains a draft while focus moves to another control and the live HUD ticks.
    await page.locator('#moveCamera').focus();
    await page.waitForTimeout(1400);
    assert.deepEqual(await Promise.all([lat,lon,alt].map(field=>field.inputValue())),[coordinates[0].toFixed(10),coordinates[1].toFixed(10),'0.050']);
    await page.locator('#moveCamera').click();
    await page.waitForFunction(()=>Math.abs((document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.pose()?.altitudeM??0)-50)<.2);
    const moved=await page.evaluate(()=>({s:SphereStageFrame.current,p:document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose()}));
    assert.equal(moved.s.id,border);assert(Math.hypot(moved.p.eastM-mark.pose.eastM,moved.p.northM-mark.pose.northM)<.5);
    // A typed depth below the freight slab must leave the visible traveler in place.
    const signed=await page.evaluate(async()=>{
      const g=await import('/geographic-flight.js'),s=SphereApp.getState(),lib=SphereBiomeLibrary;
      function fields(id,pose){
        const v=g.worldPosition(s,lib.entry(id),pose,SphereAtlas,SphereWorld);
        const ll=SphereWorld.coordinates(SphereMath.norm(v),s);
        return [(ll.lat*180/Math.PI).toFixed(12),(ll.lon*180/Math.PI).toFixed(12),(s.radius-Math.hypot(...v)).toFixed(6)];
      }
      return {buried:fields('border-transport',{eastM:200000,northM:12000,altitudeM:-1000000}),
        wheel:fields('border-transport/outfall',{eastM:.1,northM:11.25,altitudeM:1.7,yaw:.8,pitch:-.14,mode:'walk'})};
    });
    async function goTo(fields){
      for(const [i,el] of [lat,lon,alt].entries())await el.fill(fields[i]);
      await page.locator('#moveCamera').click();
    }
    await goTo(signed.buried);
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('below the accessible surface'));
    assert.deepEqual(await scene().evaluate(()=>SphereBiome.pose()),moved.p);
    assert(+signed.wheel[2]<0);
    await goTo(signed.wheel);
    await page.waitForFunction(()=>SphereStageFrame.current?.id==='border-transport/outfall'&&document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
    const wheelPose=await page.frameLocator('#stageFrame iframe').locator('#world').evaluate(()=>SphereBiome.pose());
    assert(Math.hypot(wheelPose.eastM-.1,wheelPose.northM-11.25,wheelPose.altitudeM-1.7)<.005);
    assert.deepEqual(errors,[]);console.log('PASS cold Atlas return to arbitrary station floor, exact orientation, live address and typed navigation',mark.station,mark.pose,coordinates);
  }finally{await browser.close();await host?.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
