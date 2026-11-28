
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{start}=require('./support/observatory-server.cjs'),{executable}=require('./support/biome-browser.cjs');
const city=process.argv.includes('city'),sideName=city?'city':'meadow',biome=city?'sideways-city':'infinite-meadow';
const folder=process.env.SPHERE_FACE_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'sphere-face-'));
fs.mkdirSync(folder,{recursive:true});const store=path.join(folder,'atlas.json'),source=process.env.SPHERE_FIELD_STORE;
if(source){fs.copyFileSync(source,store);if(fs.existsSync(source+'.border-atlas'))fs.cpSync(source+'.border-atlas',store+'.border-atlas',{recursive:true});}
const log={sideName,stops:[],owners:[],errors:[]},save=()=>fs.writeFileSync(path.join(folder,'faces.json'),JSON.stringify(log,null,2));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Runs in the real page. Count displayed intervals at the point where a held
// walk changes keyboard documents and both scenes have drawn the same station.
function observeHeldHandoffs() {
  window.heldHandoffs = [];
  let transfer = null;
  const point = frame => frame?.contentWindow?.SphereBiome?.pose?.();
  const changed = (a,b) => a && b && Math.hypot(a.eastM-b.eastM,a.northM-b.northM,a.altitudeM-b.altitudeM) > .001;
  function sample() {
    const source = document.querySelector('#departingStageFrame iframe');
    const next = document.querySelector('#stageFrame iframe');
    if (source && next) {
      if (!transfer) {
        const info = source.contentWindow.SphereBiome.inspect();
        transfer = {from:source.dataset.locationId, to:next.dataset.locationId, fromKey:info.station ?? info.exteriorStation,
          heldOnEntry:SphereStageFrame.heldNavigation, visibleWaitFrames:0, framesToMotion:0};
      }
      if (next.parentElement.style.opacity === '1') transfer.visibleWaitFrames++;
      transfer.previous = point(next);
    } else if (transfer && next?.surfaceEntry?.active && next.dataset.locationId === transfer.to) {
      const now = point(next);
      if (changed(transfer.previous, now)) {
        const info = next.contentWindow.SphereBiome.inspect();
        transfer.toKey = info.station ?? info.exteriorStation;
        transfer.heldOnMotion = SphereStageFrame.heldNavigation;
        delete transfer.previous;
        window.heldHandoffs.push(transfer);
        transfer = null;
      } else {
        transfer.framesToMotion++;
        transfer.previous = now;
      }
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
(async()=>{const host=await start({storePath:store}),b=await chromium.launch({executablePath:executable(),headless:true});
 const p=await b.newPage({viewport:{width:1180,height:760}});p.setDefaultTimeout(150000);p.on('pageerror',e=>{log.errors.push(e.message);console.error(e.message);});
 try{
  if(city&&!source){
    await p.goto(host.origin+'/?border=doors',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>document.querySelector('#sceneLoading')?.hidden&&document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
    await p.evaluate(async()=>{const L=SphereBiomeLibrary;
      if(!L.placed().some(item=>item.id==='sideways-city'))await L.placeRegion('sideways-city',{plotId:'r13c0',footprint:{shape:'rectangle',east:1,north:1}});
      if(!L.entry('sideways-city'))await L.install('sideways-city');
    });
  }
  await p.goto(host.origin+(city?'/?crossing=city-marsh':'/?border=doors'),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('#sceneLoading')?.hidden&&document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
  const setup=await p.evaluate(async({city,biome})=>{
   const L=SphereBiomeLibrary,T=SphereStageFrame,g=await import('/geographic-flight.js'),A=SphereApp;
   const border=city?L.locations().find(x=>x.transport&&x.id!=='border-transport'):L.entry('border-transport'),item=L.entry(biome);
   const s=(await T.stationExterior(border.transport.origin,true)).station,side=T.stationFrontages(border.transport,s).findIndex(f=>f.instanceId===biome),sign=side?1:-1,half=s.widthM/2;
   if(side<0)throw Error('Test face is unoccupied');const doors=s.routes.map(r=>(side?r.farDoor:r.nearDoor)[0]);
   const frame=()=>document.querySelector('#stageFrame iframe'),pose={eastM:doors[0],northM:sign*(half+13),altitudeM:1.7,yaw:sign===-1?0:Math.PI,pitch:.025,mode:'walk'};
   A.setPlaying(false);T.setMeadowWind({time:5,playing:false});T.close();
   const w=g.mainPose(A.getState(),border,pose,SphereAtlas,SphereWorld);
   await T.open(item.id,{entry:{geographic:true,pose:g.packPose({...w,walkMode:true},item,SphereAtlas,SphereWorld),horizontalFov:75}});
   window.sampleFace=(desired=null)=>{
    const f=frame(),api=f?.contentWindow.SphereBiome,owner=f?.dataset.locationId;
    if(!f?.surfaceEntry?.active || document.querySelector('#departingStageFrame'))return {waiting:true,owner};
    if(!api)return {waiting:true,owner};
    const at=api.pose(),core=A.getState(),w=g.mainPose(core,L.entry(owner),at,SphereAtlas,SphereWorld);
    const local=owner===border.id?at:g.packPose({...w,walkMode:true},border,SphereAtlas,SphereWorld,{exactAltitude:true});
    const info=api.inspect(),face=owner===border.id?api.frontage():null,cam=city?info.habitatWindow:info.bridge;
    const result={owner,side:face?.side,instance:face?.instanceId,east:local.eastM,depth:half-sign*local.northM,yaw:local.yaw,pitch:local.pitch,mode:at.mode,
      picture:cam&&{mode:cam.mode??cam.phase,key:cam.aperture??cam.activeKey,captures:cam.captures??cam.captureCount,reuses:cam.reuses??cam.reuseCount,bytes:cam.bytes??cam.residentBytes,cardBytes:cam.cardBytes,scratchBytes:cam.scratchBytes,id:cam.id},
      label:f.contentDocument.querySelector('#readout')?.textContent,blocked:info.blocked,gl:f.contentDocument.querySelector('canvas').getContext('webgl2').getError()};
    if(desired){const m=SphereMath,target=g.mainPose(core,border,{...local,yaw:desired[0],pitch:desired[1]},SphereAtlas,SphereWorld).forward;
      result.turn=[Math.atan2(m.dot(target,m.norm(m.cross(w.forward,w.up))),m.dot(target,w.forward)),Math.asin(Math.max(-1,Math.min(1,m.dot(target,w.up))))];}
    return result;
   };
   return {id:border.id,doors,side,sign,half};
  },{city,biome});Object.assign(log,setup);const {id,doors,sign,side}=setup;
  if(city)await p.evaluate(observeHeldHandoffs);
  const read=(q=null)=>p.evaluate(q=>sampleFace(q),q),pace=n=>p.evaluate(n=>SphereStageFrame.setSurfacePace(n),n);
  const cam=()=>p.frameLocator('#stageFrame iframe').locator('canvas').first();
  const observe=v=>{if(v.waiting)return;assert([id,biome].includes(v.owner),'Unexpected owner '+JSON.stringify(v));assert.equal(v.mode,'walk');assert.equal(v.gl,0);
    if(v.owner===id){assert.equal(v.side,side);assert.equal(v.instance,biome);}
    if(log.owners.at(-1)!==v.owner){log.owners.push(v.owner);save();}};
  async function aim(yaw,pitch=.025){
    for(let i=0;i<24;i++){const v=await read([yaw,pitch]);if(v.waiting){await delay(80);continue;}observe(v);
      const box=await cam().boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.4;
      const dx=Math.round(v.turn[0]/.004),dy=Math.round(-v.turn[1]/.004);if(Math.abs(dx)<2&&Math.abs(dy)<2)return;
      await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+Math.max(-box.width*.32,Math.min(box.width*.32,dx)),y+Math.max(-box.height*.22,Math.min(box.height*.22,dy)),{steps:2});await p.mouse.up();await delay(24);
    }throw Error('Could not turn '+JSON.stringify(await read([yaw,pitch])));
  }
  async function leg(label,key,done,maxMs=55000){
    const begin=Date.now();let next=begin+7000;await cam().focus();await p.keyboard.down('ShiftLeft');await p.keyboard.down(key);
    try{while(Date.now()-begin<maxMs){const v=await read();observe(v);if(!v.waiting&&done(v))return v;
      if(Date.now()>next){console.log(label,v.owner,v.east,v.depth,v.blocked);next=Date.now()+9000;}
      await delay(55);}
      throw Error(label+' timed out '+JSON.stringify(await read()));
    }finally{await p.keyboard.up(key);await p.keyboard.up('ShiftLeft');}
  }
  async function stop(name,photo=false){await delay(160);const v=await read();observe(v);assert(!v.waiting);log.stops.push({name,...v});save();
    if(photo)await p.locator('#viewport').screenshot({path:path.join(folder,name+'.png')});console.log(name,v.owner,v.east.toFixed(1),v.depth.toFixed(1),v.picture?.mode);}
  const inward=sign<0?0:Math.PI,outward=sign<0?Math.PI:0;
  await stop('01-outside');await pace(4);await aim(inward);
  await leg('service in','w',v=>v.owner===id && v.depth>=47);await aim(outward);await stop('02-live-service',true);
  await leg('back further inside','s',v=>v.depth>=94);await stop('03-deeper-service',true);
  await delay(500);const still=await read();await aim(outward+.014);await delay(160);const pan=await read();
  if(city){
    for(const view of [still,pan]){
      assert.equal(view.picture.mode,'clipped');
      assert.equal(view.picture.id,biome);
      assert.equal(view.picture.cardBytes,0);
      assert.equal(view.picture.scratchBytes,0);
      assert.equal(view.picture.captures,0);
      assert.equal(view.gl,0);
    }
  }else{
    assert.equal(still.picture.mode,'picture');
    assert.equal(pan.picture.captures,still.picture.captures,'Turn in place should reuse the exterior');
    assert(pan.picture.reuses>still.picture.reuses,'Card should be reprojected on the opening');
  }
  log.reprojection={still,pan};save();
  // After clearing the 35 m service gallery, the same hall floor joins the lanes.
  const toCarrier=Math.sign(doors[1]-doors[0]);await aim(toCarrier*Math.PI/2);await pace(16);
  await leg('interior traverse','w',v=>toCarrier*(doors[1]-v.east)<16);
  await pace(1);let v=await read();
  if(Math.abs(v.east-doors[1])>1.5){const sg=Math.sign(doors[1]-v.east);await aim(sg*Math.PI/2);await leg('carrier centre','w',v=>sg*(doors[1]-v.east)<=1);}
  await stop('04-carrier-gallery');await pace(4);await aim(outward);
  await leg('carrier out','w',v=>v.owner===biome&&v.depth < -17);await stop('05-carrier-exterior',true);
  // Keep facing out. Crossing backwards and reversing must use the same owner.
  await leg('back through carrier','s',v=>v.owner===id&&v.depth>47);await stop('06-carrier-backwards');
  await leg('return through carrier','w',v=>v.owner===biome&&v.depth < -14);await stop('07-same-exterior',true);
  assert.deepEqual(log.owners,[biome,id,biome,id,biome]);assert.deepEqual(log.errors,[]);
  if(city){
    log.heldHandoffs=await p.evaluate(()=>window.heldHandoffs);
    assert.equal(log.heldHandoffs.length,4);
    for(const handoff of log.heldHandoffs){
      assert(handoff.fromKey && handoff.fromKey===handoff.toKey,'Both renderers must share the surveyed station');
      assert(['KeyW','KeyS'].some(k=>handoff.heldOnEntry.includes(k)&&handoff.heldOnMotion.includes(k)),'A held movement key was lost');
      assert(handoff.visibleWaitFrames<=2 && handoff.framesToMotion<=2,'Movement paused on the ready view: '+JSON.stringify(handoff));
    }
  }
  log.passed=true;save();
 }catch(e){log.error=e.stack;save();await p.screenshot({path:path.join(folder,'last.png')}).catch(()=>{});throw e;}
 finally{await b.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
