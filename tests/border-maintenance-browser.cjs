// An addressed valve must operate its own visible plant and survive a cold scene.
// A legacy save must still identify the original gallery and its world coordinates.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {disposable}=require('./support/observatory-server.cjs');
const {executable}=require('./support/biome-browser.cjs');
const border='border-transport',outfall=border+'/outfall';
(async()=>{
  const host=await disposable('http'),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:840}});
    const page=await context.newPage(),errors=[];
    page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
    const ready=()=>page.waitForFunction(()=>window.SphereLoading?.ready && SphereBiomeLibrary.world && document.querySelector('#biomeLibraryList article'));
    await page.goto(host.origin);await ready();
    const addresses=await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary;
      const b=await lib.install('border-transport'),alone=lib.installed().map(i=>i.id);
      const reservedPlot=await lib.placeRegion('sideways-city',{plotId:b.outfall.edge.near})
        .then(()=>null,error=>error.message);
      const meadow=await lib.install('infinite-meadow');
      return {border:b,alone,meadow,reservedPlot,world:lib.world,ids:lib.packs().map(p=>p.id)};
    });
    assert.deepEqual(addresses.alone,[border]);
    assert.match(addresses.reservedPlot,/reserved for Meadow/);
    assert(!addresses.ids.includes('border-outfall'));
    assert.equal(addresses.meadow.plotId,addresses.border.outfall.edge.near);
    assert.notEqual(addresses.border.edge.id,addresses.border.outfall.edge.id);
    await page.evaluate(id=>SphereStageFrame.open(id),border);
    const frame=page.frameLocator('#stageFrame iframe'),scene=frame.locator('#scene');
    const machine=()=>scene.evaluate(()=>SphereBiome.inspect().maintenance);
    async function walkToBypass(){
      await scene.focus();await page.keyboard.down('KeyW');
      try{await frame.locator('#bypass').waitFor({state:'visible',timeout:25000});}
      finally{await page.keyboard.up('KeyW');}
      return machine();
    }
    assert.deepEqual((await walkToBypass()).levels,[1,1,1,1]);
    const aim=await scene.evaluate(async()=>{
      const {rightSign}=await import('./district.mjs'),d=parent.SphereBiomeLibrary.entry('border-transport').transport;
      const pose=SphereBiome.pose(),s=d.sites.find(s=>s.bay===0);
      const {station}=await parent.SphereStageFrame.stationExterior(s.address,true);
      const x=station.address.chainageM+station.routes[0].nearDoor[0]-2.9-pose.eastM;
      const {wheel}=await import('./maintenance.mjs');
      const z=-station.widthM/2+2+wheel.z-pose.northM;
      return {yaw:Math.atan2(x,z),key:rightSign(d)>0?'ArrowLeft':'ArrowRight'};
    });
    await page.keyboard.down(aim.key);
    try{await page.waitForFunction(yaw=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().yaw<=yaw,aim.yaw);}
    finally{await page.keyboard.up(aim.key);}
    const readPose=()=>scene.evaluate(()=>SphereBiome.pose());
    const physicalPose=await readPose();
    const wet=await scene.screenshot();
    await page.keyboard.press('KeyR');
    await page.waitForFunction(()=>{
      const s=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.inspect().maintenance;
      return !s.open && s.levels[0]<.6 && s.levels[0]<s.levels[1] && s.levels[1]<s.levels[2];
    });
    console.log('Closed near bypass on foot',await machine());
    await page.waitForFunction(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.inspect().maintenance.levels[2]<.04);
    const dry=await scene.screenshot();
    // The appearance of the plant itself must change with a stationary camera.
    const pixels=await page.evaluate(async imgs=>{
      const decode=async b64=>{
        const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
        const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
        // Omit the field HUD, scene bar and all buttons from the measurement.
        return ctx.getImageData(0,65,img.width,img.height-250).data;
      };
      const [wet,dry]=await Promise.all(imgs.map(decode));let changed=0;
      for(let i=0;i<wet.length;i+=4)
        if(wet[i+1]-dry[i+1]>65 && wet[i+2]-dry[i+2]>65)changed++;
      return changed;
    },[wet,dry].map(v=>v.toString('base64')));
    assert(pixels>130,'Expected the physical sight glasses to drain on screen, got '+pixels+' pixels');
    assert.deepEqual(await readPose(),physicalPose);
    if(process.env.SPHERE_MAINTENANCE_SHOTS){
      const dir=process.env.SPHERE_MAINTENANCE_SHOTS;
      fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'station-fed.png'),wet);
      fs.writeFileSync(path.join(dir,'station-drained.png'),dry);
    }
    await page.reload();await ready();await frame.locator('#bypass').waitFor({state:'visible'});
    assert.equal((await machine()).open,false);assert.deepEqual(await readPose(),physicalPose);
    await frame.locator('#bypass').click();
    await page.waitForFunction(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.inspect().maintenance.levels[0]>.5);
    // Board from the opposite apron and operate that independent manifold.
    await page.evaluate(async()=>{
      SphereStageFrame.showMain();const lib=SphereBiomeLibrary,entry=lib.entry('border-transport');
      const {station}=await SphereStageFrame.stationExterior(entry.transport.sites.find(s=>s.bay===0).address,true);
      const {boardingPose,walker}=await import('./packs/border-transport/0.10.0/motion.mjs');
      lib.saveStorage().setItem(lib.pack(entry.id).saveKey,JSON.stringify({schema:1,pose:boardingPose(station,walker,true),group:'service'}));
      await SphereStageFrame.open(entry.id);
    });
    const opposite=await walkToBypass();assert.equal(opposite.face,'far');assert.equal(opposite.open,true);
    await frame.locator('#bypass').click();assert.equal((await machine()).open,false);
    const valves=await scene.evaluate(async()=>{
      const {drainBank}=await import('./maintenance.mjs');
      const bank=drainBank(SphereBiome.inspect().station,localStorage);
      return [bank.read('near',Date.now()/1000).open,bank.read('far',Date.now()/1000).open];
    });
    assert.deepEqual(valves,[true,false]);
    console.log('Rendered wet/dry gauge pixels',pixels,'; cold reopen and both physical station valves passed');
    await page.evaluate(()=>SphereStageFrame.showMain());

    const {world,meadow}=addresses;
    const original={...addresses.border};delete original.outfall;
    const historical={...addresses.border.outfall,id:'border-outfall',packId:'border-outfall',name:'The Outfall',version:'1.0.0',installedAt:'2026-11-17T12:00:00Z'};
    delete historical.facility;
    // Seed an old build's actual install record and save shapes on the existing origin.
    const writeWorld=async list=>{
      const store=await (await fetch(host.origin+'/api/installed-biomes')).json();
      const body={key:world.key,parameters:world.params,before:store.worlds[world.key].installed,installed:list};
      const response=await fetch(host.origin+'/api/installed-biomes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      assert.equal(response.status,200);
    };
    const bookmark={eastM:-.7,northM:11.2,altitudeM:1.7,yaw:.32,pitch:.04,mode:'walk'};
    await page.evaluate(pose=>{
      const storage=SphereBiomeLibrary.saveStorage();
      storage.setItem('sphere-biome:border-outfall:1.0.0',JSON.stringify({schema:1,pose,bookmark:pose,open:false,levels:[0,0,0]}));
      storage.setItem('sphere-stage-frame-v2',JSON.stringify({schema:2,id:'border-outfall'}));
    },bookmark);
    await writeWorld([meadow,historical,original]);await page.reload();await ready();
    await page.waitForFunction(()=>SphereStageFrame.current?.facility==='outfall' && document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect().frames>2);
    assert.deepEqual(await frame.locator('#world').evaluate(()=>SphereBiome.pose()),bookmark);
    assert.equal(await frame.locator('#world').evaluate(()=>SphereBiome.inspect().valveOpen),false);
    const migrated=await page.evaluate(()=>SphereBiomeLibrary.installed());
    assert.deepEqual(migrated.map(i=>i.id),['infinite-meadow',border]);
    assert.deepEqual(migrated[1].transport,original.transport);
    assert.deepEqual(migrated[1].outfall.edge,historical.edge);
    assert.equal(migrated[1].outfall.installedAt,historical.installedAt);
    await page.evaluate(()=>SphereStageFrame.showMain());
    // Also cover a world that never installed freight, including a removed legacy site.
    await writeWorld([meadow,{...historical,detailInstalled:false}]);await page.reload();await ready();
    const dormant=await page.evaluate(()=>({placed:SphereBiomeLibrary.placed(),installed:SphereBiomeLibrary.installed().map(i=>i.id)}));
    assert.deepEqual(dormant.installed,['infinite-meadow']);
    assert.deepEqual(dormant.placed.find(i=>i.id===border).outfall.edge,historical.edge);
    await page.evaluate(()=>SphereBiomeLibrary.install('border-transport'));
    assert.equal(await page.locator('#biomeLibraryList article').filter({hasText:'Visit The Outfall'}).count(),1);
    const after=await (await fetch(host.origin+'/api/installed-biomes')).json();
    await page.reload();await ready();
    assert.deepEqual(await (await fetch(host.origin+'/api/installed-biomes')).json(),after);
    assert.equal(await page.evaluate(()=>SphereBiomeLibrary.entry('border-transport/outfall').id),outfall);
    assert.deepEqual(errors,[]);
    console.log('Preserved the original freight survey, Outfall edge and bookmark; migration is idempotent');
  }finally{await browser.close();await host.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
