'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{session,executable}=require('./support/biome-browser.cjs');
const id='border-transport',output=process.env.SPHERE_BORDER_OUTPUT;
async function main(){
  const server=await session(),browser=await chromium.launch({headless:true,executablePath:executable(),args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  try{
    const c=await browser.newContext({viewport:{width:1160,height:730}});await server.attach(c);
    const page=await c.newPage();page.setDefaultTimeout(90000);const errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
    await page.goto(server.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world && window.SphereStageFrame);
    const eager=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/border-transport[/].*(station|view|pack)[.]mjs/.test(r.name)).map(r=>r.name));
    assert.deepEqual(eager,[],'Main must defer station generation and WebGL assets until install or entry');
    const register=async()=>JSON.parse((await server.dispatch(server.origin+'/api/installed-biomes')).body);
    const before=await register(),live=process.env.SPHERE_BORDER_INSTALL_EXISTING==='1';
    if(process.env.SPHERE_URL&&!live)throw Error('Use the disposable server for tests or select the existing-world installation explicitly.');
    const worlds=live?Object.entries(before.worlds).filter(([,w])=>w.installed.length):[[await page.evaluate(()=>SphereBiomeLibrary.world.key),null]];
    assert(worlds.length);
    const row=page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:/^Border Biome /})});
    let installed=[];
    for(const [key,prior] of worlds){
      await page.evaluate(async params=>{
        if(params)SphereApp.setState({...SphereApp.getState(),...params});
        await SphereBiomeLibrary.selectWorld();SphereApp.setPlaying(false);
      },prior?.parameters??null);
      assert.equal(await page.evaluate(()=>SphereBiomeLibrary.world.key),key);
      const exists=await page.evaluate(id=>!!SphereBiomeLibrary.entry(id),id);
      if(!exists)await row.getByRole('button',{name:'Install',exact:true}).click();
      await page.waitForFunction(id=>SphereBiomeLibrary.entry(id)?.version==='0.10.0',id);
      const item=await page.evaluate(id=>SphereBiomeLibrary.entry(id),id);assert.equal(item.transport.sites.length,3);
      const after=(await register()).worlds[key].installed;
      assert.deepEqual(after.filter(i=>i.id!==id),(prior?.installed??[]).filter(i=>i.id!==id));
      installed.push({key,edge:item.edge.id,widthsKm:item.transport.sites.map(s=>s.widthM/1000)});
      console.log('Installed and reread',key,item.edge.id);
    }
    await row.getByRole('button',{name:'Visit',exact:true}).click();
    await page.waitForFunction(id=>{
      const stage=SphereStageFrame,b=document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;
      if(stage.lastArrival?.status==='failed')throw Error(document.getElementById('biomeLibraryStatus').textContent);
      return stage.current?.id===id&&!stage.flying&&b?.inspect().frames>1&&!b.inspect().scripted;
    },id);
    const frame=page.frameLocator('#stageFrame iframe'),seen=()=>frame.locator('canvas').evaluate(()=>({pose:SphereBiome.pose(),...SphereBiome.inspect()}));
    const first=await seen();
    const item=await page.evaluate(id=>SphereBiomeLibrary.entry(id),id),home=item.transport.sites.find(s=>s.bay===0);
    const addr=home.address,q=new URLSearchParams({world:addr.world,a:addr.plots[0],b:addr.plots[1],bay:0});
    const atlas=async()=>JSON.parse((await server.dispatch(server.origin+'/api/border-stations?'+q)).body);
    const preview=await atlas();assert.equal(first.locked,preview.locked);
    if(!live)assert.equal(preview.locked,false,'Looking from the apron must not discover the station');
    assert.equal(first.uploads,2);assert.equal(first.pose.mode,'flight');
    await frame.getByRole('button',{name:'Walk',exact:true}).click();
    await frame.locator('#pace').selectOption('16');await frame.locator('canvas').focus();
    await page.keyboard.down('KeyW');
    try{await page.waitForFunction(z=>{
      const b=document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;
      if(b?.id==='border-transport'&&b.inspect().error)throw Error(b.inspect().error);
      return b?.id==='border-transport'&&b.inspect().locked&&b.pose().northM>z+2;
    },first.pose.northM+6,{timeout:18000});}
    catch(error){console.error('Service doorway',first,await page.evaluate(()=>{const f=document.querySelector('#stageFrame iframe'),b=f?.contentWindow?.SphereBiome;
      return {current:SphereStageFrame.current,pose:b?.pose(),inspect:b?.inspect(),active:f?.surfaceEntry?.active,message:document.getElementById('biomeLibraryStatus').textContent};}));throw error;}
    finally{await page.keyboard.up('KeyW');}
    const inside=await seen(),locked=await atlas();
    assert(locked.locked&&locked.discoveredAt);assert(inside.pose.altitudeM>1 && inside.pose.mode==='walk');
    assert.equal(inside.uploads,2,'Publishing an unchanged survey must reuse geometry');
    assert.equal(inside.time,first.time,'Freight must observe the paused Main clock');
    if(output){fs.mkdirSync(output,{recursive:true});await frame.locator('canvas').screenshot({path:path.join(output,'service-door.png')});}
    await frame.locator('canvas').evaluate(()=>SphereBiome.save());
    await page.keyboard.down('KeyS');
    try{await page.waitForFunction(()=>SphereStageFrame.current?.id!=='border-transport'&&!SphereStageFrame.flying && !document.querySelector('#departingStageFrame'));}
    finally{await page.keyboard.up('KeyS');}
    const exit=await page.evaluate(()=>({owner:SphereStageFrame.current?.id??'Main',onFoot:document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.pose().mode==='walk'||SphereApp.getState().walkMode}));
    assert(exit.onFoot);
    if(exit.owner==='Main')await page.waitForFunction(key=>SphereApp.renderer.renderInfo.walkingStation===key,addr.key);
    // We backed out facing the door. Walk forward from the adjoining renderer.
    const trace=()=>page.evaluate(async()=>{
      const s=SphereApp.getState(),g=await import('./geographic-flight.js'),item=SphereBiomeLibrary.entry('border-transport');
      return {local:g.packPose(s,item,SphereAtlas,SphereWorld),footprint:g.footprint(s,SphereBiomeLibrary,SphereAtlas,SphereWorld)?.id,
        covered:window.sphereStageCovered&&true,travel:SphereJourney.travel.active,site:s.siteId,stage:SphereStageFrame.current,
        message:document.getElementById('biomeLibraryStatus').textContent};
    });
    const atExit=await trace();
    assert(Math.abs(atExit.local.northM)-home.widthM/2<55,'Walking must hand off at the apron, within one stride interval of the 14 m exit margin');
    const destination=page.frameLocator('#stageFrame iframe').locator('canvas').first();
    if(exit.owner==='Main')await page.locator('#viewport').focus();else await destination.focus();
    await page.keyboard.down('KeyW');
    try{await page.waitForFunction(()=>{const f=document.querySelector('#stageFrame iframe');
      return SphereStageFrame.current?.id==='border-transport' && f?.surfaceEntry?.active && f.contentWindow.SphereBiome.pose().mode==='walk';},null,{timeout:27000});}
    catch(error){console.error('Doorway return',atExit,await trace());throw error;}
    finally{await page.keyboard.up('KeyW');}
    const returned=await seen();
    assert.equal(returned.station,inside.station);assert(returned.locked);assert.equal((await atlas()).discoveredAt,locked.discoveredAt);
    let roof=null;
    if(!live){
      // Start in Main above an unseen off-centre bay and use the aircraft's normal movement controls.
      await page.evaluate(async()=>{
        if(!SphereStageFrame.showMain())throw Error('Could not release the previous walk');
        const g=await import('./geographic-flight.js'),item=SphereBiomeLibrary.entry('border-transport'),s=SphereApp.getState();
        const p={eastM:item.transport.sites[0].x+5200,northM:3800,altitudeM:30000,yaw:.53,pitch:-.7,mode:'flight'};
        const start=g.mainPose(s,item,p,SphereAtlas,SphereWorld);start.autoSpeed=false;start.speed=2;
        SphereApp.setState(start);await SphereLoading.ensureCurrent();
      });
      await page.locator('#viewport').focus();await page.keyboard.down('KeyQ');
      try{await page.waitForFunction(()=>{const f=document.querySelector('#stageFrame iframe');return f?.surfaceEntry?.active&&f.contentWindow.SphereBiome.id==='border-transport';},null,{timeout:45000});}
      catch(error){console.error('Off-centre approach',await trace());throw error;}
      finally{await page.keyboard.up('KeyQ');}
      const airborne=await seen();assert.equal(airborne.locked,false);assert(Math.abs(airborne.pose.eastM-item.transport.sites[0].x-5200)<40);
      await frame.locator('#pace').selectOption('128');await frame.locator('canvas').focus();await page.keyboard.down('KeyQ');
      try{await page.waitForFunction(()=>{const b=document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;return b?.inspect().locked&&Math.abs(b.pose().altitudeM-1746.7)<.05;});}
      finally{await page.keyboard.up('KeyQ');}
      await frame.getByRole('button',{name:'Walk',exact:true}).click();const top=await seen();
      assert.equal(top.pose.mode,'walk');assert(Math.abs(top.pose.altitudeM-1746.7)<.05);
      if(output)await frame.locator('canvas').screenshot({path:path.join(output,'roof-landing.png')});
      await frame.getByRole('button',{name:'Fly',exact:true}).click();await frame.locator('canvas').focus();await page.keyboard.down('KeyE');
      try{await page.waitForFunction(()=>!SphereStageFrame.current&&!window.sphereStageCovered&&SphereApp.getState().radius-Math.hypot(...SphereApp.getState().position)>24);}
      finally{await page.keyboard.up('KeyE');}
      roof={bay:item.transport.sites[0].bay,approachM:airborne.pose.altitudeM,roofEyeM:top.pose.altitudeM,returnedToMain:true};
    }
    assert.deepEqual(errors,[]);
    const receipt={installed,visits:[{station:addr.key,layout:locked.station.layout,discoveredAt:locked.discoveredAt,previewWasLocked:preview.locked,
      apron:first.pose,inside:inside.pose,geometryUploads:inside.uploads,clockPaused:inside.time===first.time,exit,returnPose:returned.pose}],roof,errors};
    if(output)fs.writeFileSync(path.join(output,'installation.json'),JSON.stringify(receipt,null,2)+'\n');
    console.log(JSON.stringify(receipt));
  }finally{await browser.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
