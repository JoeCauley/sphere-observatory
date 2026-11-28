'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const before=process.argv.includes('before'),base=process.env.SPHERE_APPROACH_TEST_ROOT||path.resolve(__dirname,'..');
const {start}=require(base+'/tests/support/observatory-server.cjs'),{executable}=require(base+'/tests/support/biome-browser.cjs');
const folder=process.env.SPHERE_APPROACH_OUTPUT||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'sphere-wall-rest-')),store=path.join(folder,'atlas.json');
fs.mkdirSync(folder,{recursive:true});if(process.env.SPHERE_FIELD_STORE)fs.copyFileSync(process.env.SPHERE_FIELD_STORE,store);
const receipt={before,route:'/?border=wall',events:[],errors:[]},save=()=>fs.writeFileSync(path.join(folder,'rest.json'),JSON.stringify(receipt,null,2));
(async()=>{const service=await start({storePath:store}),browser=await chromium.launch({headless:true,executablePath:executable()});
try{
 const page=await browser.newPage({viewport:{width:1160,height:740}});page.setDefaultTimeout(140000);
 await page.addInitScript(()=>{
   const proto=WebGL2RenderingContext.prototype,draw=proto.drawArraysInstanced;
   window.largestGrassDraw=0;
   proto.drawArraysInstanced=function(mode,first,count,instances){if(mode===this.TRIANGLES)window.largestGrassDraw=Math.max(window.largestGrassDraw,instances);return draw.apply(this,arguments);};
 });
 page.on('pageerror',e=>{receipt.errors.push(e.message);console.log(e.message);});
 // Give the real Meadow loader a deterministic interval after key-up.
 await page.route('**/packs/infinite-meadow/1.3.0/grass-stage.js',async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue();});
 await page.goto(service.origin+receipt.route,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready && document.querySelector('#sceneLoading').hidden);
 receipt.entry=await page.evaluate(()=>({altitudeM:(SphereApp.getState().radius-Math.hypot(...SphereApp.cameraSample().position))*1000,seed:SphereApp.getState().seed,current:SphereStageFrame.current?.id??'main'}));
 await page.evaluate(async()=>{
  const T=SphereStageFrame,A=SphereApp,L=SphereBiomeLibrary,g=await import('/geographic-flight.js');
  const border=L.entry('border-transport'),row=T.transportAddress().rows.find(r=>r.site.bay===0);
  const station=(await T.stationExterior(row.site.address,true)).station,m=L.entry('infinite-meadow'),side=row.site.address.plots.indexOf(m.plotId);
  const sign=side?1:-1,near={eastM:station.routes[0].nearDoor[0]+32,northM:sign*(station.widthM/2+85),altitudeM:1.7,yaw:sign<0?Math.PI:0,pitch:-.18,mode:'walk'};
  T.close();A.setBusy(true);A.setPlaying(false);T.setMeadowWind({time:6,playing:false});
  const w=g.mainPose(A.getState(),border,near,SphereAtlas,SphereWorld);
  w.walkMode=false;SphereLanding.enter(w,w.position,{activate:false,grounded:true});
  await A.renderer.prepare(w);A.setState(w);A.setBusy(false);A.draw();
  window.readGround=()=>{
    const f=document.querySelector('#stageFrame iframe'),api=f?.contentWindow.SphereBiome,here=api?.pose(),item=f&&L.entry(f.dataset.locationId),s=A.getState();
    const world=here&&item?g.mainPose(s,item,here,SphereAtlas,SphereWorld):s,info=api?.inspect()??{},ll=SphereWorld.coordinates(SphereMath.norm(world.position),s);
    const grass=f?.contentDocument.querySelector('#ready')?.textContent.match(/(\d+)\/(\d+) cells\D+(\d+) tufts/);
    return {owner:f?.surfaceEntry?.active?item.id:f?'loading':'main',target:g.footprint(s,L,SphereAtlas,SphereWorld)?.id??null,plot:SphereAtlas.plotAt(ll.lat,ll.lon)?.id,status:document.querySelector('#controlStatus')?.textContent,mode:here?.mode??(s.walkMode?'walk':'flight'),point:world.position,ll,clock:A.sceneSeconds,grassTiles:Number(grass?.[1]??0),tufts:Number(grass?.[3]??0),drawInstances:f?.contentWindow.largestGrassDraw??0,frames:info.frames,ready:info.ready,
       fov:f?.surfaceEntry?.horizontalFov??s.fov,gl:api?f.contentDocument.querySelector('canvas').getContext('webgl2').getError():A.renderer.gl.getError()};
  };
 });
 await page.locator('#viewport').focus();await page.keyboard.down('w');await page.waitForTimeout(240);await page.keyboard.up('w');
 const stop=Date.now();receipt.release=await page.evaluate(()=>readGround());await page.locator('#viewport').screenshot({path:path.join(folder,'01-release.png')});
 for(let i=0;i<(before?10:90);i++){
   const v=await page.evaluate(()=>readGround());receipt.events.push({ms:Date.now()-stop,...v});if(v.owner==='infinite-meadow'&&v.ready&&(before||v.tufts>0))break;
   if(i%5===0){save();console.log('REST',i,v.owner,v.grassTiles,v.tufts);}await page.waitForTimeout(450);
 }
 receipt.presented=receipt.events.at(-1);
 if(before){receipt.reproduced=receipt.presented.owner==='main';assert(receipt.reproduced);}
 else{
  assert.equal(receipt.presented.owner,'infinite-meadow');assert(receipt.presented.grassTiles>0&&receipt.presented.tufts>0&&receipt.presented.drawInstances>0);
  await page.waitForTimeout(1500);const end=await page.evaluate(()=>readGround());receipt.end=end;
  const direction=q=>{const r=Math.hypot(...q);return q.map(x=>x/r);};
  const d0=direction(receipt.release.point),d1=direction(end.point),r=Math.hypot(...end.point);
  receipt.horizontalDriftM=Math.hypot(...d1.map((v,i)=>v-d0[i]))*r*1000;
  assert(receipt.horizontalDriftM<.1,'The stopped camera drifted '+receipt.horizontalDriftM+' m');
  assert.deepEqual(end.point,receipt.presented.point);assert.equal(end.clock,receipt.release.clock);assert.equal(end.fov,80);assert.equal(end.gl,0);
 }
 await page.locator('#viewport').screenshot({path:path.join(folder,'02-still.png')});assert.deepEqual(receipt.errors,[]);receipt.passed=true;save();
 console.log('DONE',before,receipt.presented.owner,receipt.presented.tufts,receipt.horizontalDriftM);
}catch(e){receipt.error=e.stack;save();throw e;}finally{await browser.close();await service.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
