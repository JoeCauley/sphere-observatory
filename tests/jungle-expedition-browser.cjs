'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {recordPilot}=require('./support/record-pilot.cjs');
const {chromium}=require('playwright'),{start}=require('./support/observatory-server.cjs'),{executable,saveAtlasMark}=require('./support/biome-browser.cjs');
const folder=process.env.SPHERE_JUNGLE_FIELD||fs.mkdtempSync(path.join(os.tmpdir(),'jungle-field-'));
const store=path.join(folder,'field-atlas.json'),source=process.env.SPHERE_FIELD_REGISTER;
fs.mkdirSync(folder,{recursive:true});
if(source&&!fs.existsSync(store))fs.copyFileSync(source,store);
const resume=process.env.SPHERE_RESTART_AT_TREE==='1';
const report=resume?JSON.parse(fs.readFileSync(path.join(folder,'jungle-route.json'))):{samples:[],errors:[]};
delete report.failure;
const write=()=>fs.writeFileSync(path.join(folder,'jungle-route.json'),JSON.stringify(report,null,2));
(async()=>{
 let host=await start({transport:'http',storePath:store}),browser,page;
 const held=new Set();
 async function boot(){
  browser=await chromium.launch({executablePath:executable(),headless:true});
  page=await browser.newPage({viewport:{width:1152,height:720}});page.setDefaultTimeout(150000);
  page.on('pageerror',e=>{console.log('Page error',e.message);report.errors.push(e.message);});
  page.on('console',m=>{if(m.type()==='error')console.log('console',m.text().slice(0,260));});
  page.on('requestfailed',r=>{const failed={url:r.url(),error:r.failure()?.errorText,type:r.resourceType()};(report.requestFailures??=[]).push(failed);console.log('Request aborted',JSON.stringify(failed));});
  await page.goto(host.origin+'/?border=beyond',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
  await page.evaluate(async()=>{
   const stage=SphereStageFrame,l=SphereBiomeLibrary,geo=await import('/geographic-flight.js');
   const row=stage.transportAddress().rows.find(v=>v.site.bay===0),b=l.entry('border-transport');
   window.field=()=>{
    const f=document.querySelector('#stageFrame iframe'),api=f?.contentWindow?.SphereBiome;
    const id=api?.id,p=api?.pose(),j=l.entry('super-jungle'),s=SphereApp.getState();
    const world=p&&l.entry(id)?geo.mainPose(s,l.entry(id),p,SphereAtlas,SphereWorld):s;
    const local=p&&id===b.id?p:geo.packPose(world,b,SphereAtlas,SphereWorld,{exactAltitude:true});
    const physical=SphereWorld.coordinates(SphereMath.norm(world.position),s);
    const jd=j?.occurrence,meshState=jd?{...world,siteId:'biome-1',siteRevision:2,terrainRevision:2,siteAnchor:j.direction,terrainAnchor:j.direction,collection:true,geometryDetail:true}:null;
    const props=id==='super-jungle'&&meshState?SphereGround.neighbourhood(meshState).some(m=>m.ground.props?.includes(jd.tree.id)):false;
    return {id,landmarkResident:props,active:!!f?.surfaceEntry?.active,local,p,physical,tree:j?.occurrence.tree.id,info:api?.inspect(),
     status:document.querySelector('#biomeLibraryStatus')?.textContent,phase:document.querySelector('#transitPhase')?.textContent};
   };
   window.stationHeading=(yaw,pitch)=>{
    const f=field(),s=SphereApp.getState(),i=l.entry(f.id);
    if(i?.id===b.id)return {yaw,pitch};
    if(i?.id==='infinite-meadow')return geo.stationToMeadowPose(row,{...f.local,yaw,pitch});
    const bearing=geo.mainPose(s,b,{...f.local,yaw,pitch},SphereAtlas,SphereWorld);
    return i?geo.packPose(bearing,i,SphereAtlas,SphereWorld):null;
   };
   window.stationStart=async(mode,distance)=>{
    const j=l.entry('super-jungle'),o=j.occurrence,depth=o.threshold.northM;
    const p={eastM:o.threshold.eastM,northM:mode==='full'?-depth-distance:depth-distance,altitudeM:1.7,yaw:0,pitch:.035,mode:'walk'};
    const target=mode==='full'?'infinite-meadow':b.id,pose=mode==='full'?geo.stationToMeadowPose(row,p):p;
    stage.close();SphereApp.setPlaying(false);stage.setMeadowWind({time:7.5,playing:false});
    return stage.open(target,{entry:{geographic:true,pose,horizontalFov:75}});
   };
  });
 }
 const filmed=(tag,action)=>recordPilot(page,path.join(folder,tag+'-frames'),action);
 async function snap(tag){
  const f=await page.evaluate(()=>field());report.samples.push({tag,...f});write();console.log(tag,f.id,f.local?.eastM,f.local?.northM,f.local?.altitudeM,f.p?.mode);
  await page.screenshot({path:path.join(folder,tag+'.png')});return f;
 }
 async function focus(){
  if(await page.locator('#stageFrame iframe').count())await page.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
  else await page.locator('#viewport').focus();
 }
 async function leg(key,predicate,arg,ms=75000){
  await focus();await page.keyboard.down(key);held.add(key);
  try{await page.waitForFunction(predicate,arg,{timeout:ms,polling:'raf'});}
  catch(e){console.log('stalled',JSON.stringify(await page.evaluate(()=>field())));throw e;}
  finally{await page.keyboard.up(key);held.delete(key);}
 }
 async function turn(yaw,pitch=.06){
  const p=(await page.evaluate(()=>field())).p,box=await page.frameLocator('#stageFrame iframe').locator('canvas').first().boundingBox();
  const d=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw))/.004;
  const n=Math.max(1,Math.ceil(Math.abs(d)/(.65*box.width)));
  for(let k=0;k<n;k++){const x=box.x+box.width*(d<0?.84:.16),y=box.y+box.height*.5;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+d/n,y-(pitch-p.pitch)/(.004*n),{steps:4});await page.mouse.up();}
 }
 async function flyHomeToBayZero(o){
  await page.locator('[data-tab=camera]').click();await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
  await page.locator('#atlasPlaceList').getByRole('button',{name:'Plain wall beyond Bay +1',exact:true}).last().click();
  await page.waitForFunction(()=>field().p?.mode==='walk'&&field().active);
  await turn(-Math.PI/2,0);await focus();await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
  const speed=m=>page.evaluate(m=>SphereApp.chooseFlightSpeed(false,m),m);
  await speed(.5);await leg('KeyE',()=>field().local.altitudeM>2500);await speed(20);
  await filmed('back-to-double-gallery',()=>leg('KeyW',()=>field().local.eastM<212000));
  await snap('hall-growing-from-wall');await leg('KeyW',()=>field().local.eastM<5000);
  // Brake in steps on the straight deck before crossing toward the precise 4 m service door.
  const target=o.threshold.eastM;
  for(const [rate,pad] of [[1,170],[.10,16],[.01,1.3],[.002,.09]]){
   const at=(await page.evaluate(()=>field())).local.eastM,dir=Math.sign(target-at);if(Math.abs(at-target)<pad)continue;
   await speed(rate);await leg(dir<0?'KeyW':'KeyS',v=>v.dir*(field().local.eastM-v.target)>-v.pad,{dir,target,pad});
  }
  await snap('bay-zero-roof');await turn(Math.PI,0);await speed(4);
  await leg('KeyW',z=>field().local.northM<z,-o.threshold.northM-85);
  await page.waitForFunction(()=>field().id==='infinite-meadow'&&field().active);
  await snap('over-meadow-apron');
  await speed(.18);await leg('KeyQ',()=>field().local.altitudeM<3);
  const approach=await snap('descending-to-apron');
  if(approach.p.mode==='flight'){await focus();await page.keyboard.press('KeyF');}
  try{await page.waitForFunction(()=>field().p?.mode==='walk'&&field().id==='infinite-meadow',null,{timeout:12000});}
  catch(e){console.log('Apron landing',JSON.stringify(await page.evaluate(()=>field())));throw e;}
  const heading=await page.evaluate(()=>stationHeading(0,.035));await turn(heading.yaw,heading.pitch);
  console.log('Flew plain wall to Bay 0 service approach',JSON.stringify((await page.evaluate(()=>field())).local));
 }
 async function walkTo(x,z,tolerance=3){
  let p=(await page.evaluate(()=>field())).p;
  for(let attempt=0;attempt<5&&Math.hypot(x-p.eastM,z-p.northM)>tolerance;attempt++){
   await turn(Math.atan2(x-p.eastM,p.northM-z));
   await leg('KeyW',v=>{const p=field().p;return p&&Math.hypot(p.eastM-v.x,p.northM-v.z)<v.tol;},{x,z,tol:tolerance},40000);
   p=(await page.evaluate(()=>field())).p;
  }
 }
 try{
  const full=process.env.SPHERE_FULL_TRANSECT==='1';let o,tree;
  if(!resume){
  await boot();
  if(!await page.evaluate(()=>!!SphereBiomeLibrary.entry('super-jungle'))){
   const tab=await page.locator('#biomeLibrary').evaluate(el=>el.closest('[role=tabpanel], [data-panel], .panel')?.id);
   await page.locator('[data-tab]').evaluateAll(nodes=>{const places=document.querySelector('#biomeLibrary');for(const n of nodes){n.click();if(places.offsetWidth>0)break;}});
   const row=page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:/Super Jungle/})});
   await row.getByRole('button',{name:'Install',exact:true}).click();
   await page.waitForFunction(()=>!!SphereBiomeLibrary.entry('super-jungle'),null,{timeout:12000});
   console.log('Installed through the pack menu',tab);
  }
  o=await page.evaluate(()=>SphereBiomeLibrary.entry('super-jungle').occurrence);assert.equal(o.biome,1);report.occurrence=o;write();
  if(process.env.SPHERE_WALL_TRANSECT==='1')await flyHomeToBayZero(o);
  else await page.evaluate(([mode,d])=>stationStart(mode,d),[full?'full':'door',full?18:52]);
  await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
  if(full){
   await snap('meadow-approach');await filmed('meadow-to-gallery',()=>leg('KeyW',()=>field().id==='border-transport'&&field().active));
   await page.evaluate(()=>SphereStageFrame.setSurfacePace(128));
   await page.keyboard.down('ShiftLeft');try{await leg('KeyW',z=>field().local.northM>z,o.threshold.northM-380,450000);}finally{await page.keyboard.up('ShiftLeft');}
   await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
   await leg('KeyW',z=>field().local.northM>z,o.threshold.northM-55);
   await page.evaluate(()=>SphereStageFrame.setSurfacePace(1));await snap('station-gallery');
  }
  await page.waitForFunction(()=>field().info?.habitatWindow?.draws>0,null,{timeout:140000});
  await snap('canopy-through-service-door');
  await filmed('into-jungle',()=>leg('KeyW',()=>field().id==='super-jungle'&&field().active,null,150000));
  await snap('threshold-handoff');
  await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
  await leg('KeyW',z=>field().local.northM>z,o.threshold.northM+388,140000);
  await snap('outside-at-gap');
  await walkTo(o.gap.local.eastM,o.gap.local.northM,5);
  await snap('in-clearing');
  const t=o.tree.local;
  await walkTo(t.eastM-26,t.northM,3.5);
  await page.evaluate(()=>SphereStageFrame.setSurfacePace(1));
  for(const [dx,dz] of [[-18,18],[0,26],[18,18],[26,0],[18,-18],[0,-26],[-18,-18],[-26,0]])await walkTo(t.eastM+dx,t.northM+dz,2.8);
  await turn(Math.atan2(t.eastM-(await page.evaluate(()=>field())).p.eastM,(await page.evaluate(()=>field())).p.northM-t.northM),.24);
  // A near eye-level pose reveals the roots. A second walking pose frames the complete crown.
  tree=await snap('buttressed-tree');assert(tree.landmarkResident,'The rendered and collidable native mesh must contain the marked tree');assert.equal(tree.tree,o.tree.id);assert.equal(tree.p.mode,'walk');
  await page.locator('[data-tab=camera]').click();await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
  report.mark=await saveAtlasMark(page,'Bay 0 Jungle buttress');write();
  await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
  await walkTo(t.eastM-35,t.northM-22,3);
  let observer=(await page.evaluate(()=>field())).p;
  await turn(Math.atan2(t.eastM-observer.eastM,observer.northM-t.northM),.32);
  await snap('tree-and-crown');
  await turn(-Math.PI/2,.12);await snap('return-sightline');
  if(full){
   await walkTo(o.gap.local.eastM,o.gap.local.northM,4);
   await focus();await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
   await page.waitForFunction(()=>field().p?.mode==='flight');
   await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,.025));await leg('KeyE',()=>field().p.altitudeM>82);
   observer=(await page.evaluate(()=>field())).p;
   await turn(Math.atan2(t.eastM-observer.eastM,observer.northM-t.northM),-.50);await snap('crown-from-clearing');
   await leg('KeyQ',()=>field().p.altitudeM<3);await page.keyboard.press('KeyF');
   await page.waitForFunction(()=>field().p.mode==='walk');await snap('landed-through-gap');
  }
  const port=host.port;await browser.close();browser=null;await host.close();host=null;
  host=await start({transport:'http',port,storePath:store});
  }else{
   o=report.occurrence;tree=report.samples.find(f=>f.tag==='buttressed-tree');
   assert(o&&tree&&report.mark,'Resume requires a field mark made on foot');
  }
  await boot();
  await page.locator('[data-tab=camera]').click();await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
  await page.locator('#atlasPlaceList').getByRole('button',{name:'Bay 0 Jungle buttress',exact:true}).last().click();
  try{await page.waitForFunction(()=>field().id==='super-jungle'&&field().active,null,{timeout:180000});}
  catch(e){console.log('Atlas return status',await page.evaluate(()=>({status:document.querySelector('#atlasPlaceStatus')?.textContent,library:document.querySelector('#biomeLibraryStatus')?.textContent,arrival:SphereStageFrame.lastArrival,ground:SphereGround.info,error:document.querySelector('#error')?.textContent})));throw e;}
  const reload=await snap('tree-after-restart');
  assert.equal(reload.tree,o.tree.id);assert(Math.abs(reload.p.altitudeM-tree.p.altitudeM)<.05,'Restore the original ground beneath the canopy');assert(Math.hypot(tree.p.eastM-reload.p.eastM,tree.p.northM-reload.p.northM)<1);
  if(full){
   const changes=await page.evaluate(()=>{
    const before=SphereApp.getState(),clock={...before,routeShades:true},here=field();
    const q=SphereWorld.direction(here.physical.lat,here.physical.lon,clock),receiver=SphereMath.mul(q,clock.radius-.002);
    for(let t=0;t<=2000000;t+=120){clock.time=t;if(SphereCollection.visibility(receiver,clock,64)===0){
      SphereApp.setPlaying(false);SphereApp.setState(clock);return {day:before.time,night:t,coverage:0};}}
    throw Error('No Shade passage at the surveyed tree');
   });report.clocks=changes;await page.waitForTimeout(350);
   await snap('tree-in-shade');await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
   await walkTo(o.gap.local.eastM,o.gap.local.northM,5);
   await walkTo(o.gap.local.eastM-110,0,5);await walkTo(-598,0,4);
   await turn(-Math.PI/2,.02);await filmed('back-to-gallery',()=>leg('KeyW',()=>field().id==='border-transport'&&field().active,null,150000));
   await snap('back-through-service');await page.evaluate(()=>SphereStageFrame.setSurfacePace(128));
   await page.keyboard.down('ShiftLeft');try{await leg('KeyW',z=>field().local.northM<z,-o.threshold.northM+500,450000);}finally{await page.keyboard.up('ShiftLeft');}
   await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
   await filmed('back-in-meadow',()=>leg('KeyW',()=>field().id==='infinite-meadow'&&field().active,null,120000));await snap('back-in-meadow');
  }
  assert.deepEqual(report.errors,[]);report.passed=true;write();console.log('PASS native tree circled and restored',o.tree.id);
 }finally{write();await browser?.close();await host?.close();}
})().catch(e=>{report.failure=e.message;write();console.error(e);process.exitCode=1;});
