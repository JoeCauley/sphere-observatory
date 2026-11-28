'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {recordPilot}=require('./support/record-pilot.cjs');
const {chromium}=require('playwright'),{start}=require('./support/observatory-server.cjs'),{executable,saveAtlasMark}=require('./support/biome-browser.cjs');
const folder=path.resolve(process.env.SPHERE_VIOLET_FIELD||fs.mkdtempSync(path.join(os.tmpdir(),'violet-fork-')));
const seed=Number(process.env.SPHERE_FIELD_SEED)||713,store=path.join(folder,'field-atlas.json'),report={seed,samples:[],errors:[]};
fs.mkdirSync(folder,{recursive:true});
if(process.env.SPHERE_FIELD_REGISTER&&!fs.existsSync(store))fs.copyFileSync(process.env.SPHERE_FIELD_REGISTER,store);
const write=()=>fs.writeFileSync(path.join(folder,'violet-route.json'),JSON.stringify(report,null,2));
(async()=>{
 let host=await start({storePath:store}),browser,page,o;
 async function boot(){
  browser=await chromium.launch({executablePath:executable(),headless:true});page=await browser.newPage({viewport:{width:1152,height:720}});page.setDefaultTimeout(200000);
  page.on('pageerror',e=>{console.log('Page error',e.message);report.errors.push(e.message);});
  await page.goto(host.origin,{waitUntil:'domcontentloaded'});console.log('Opened Observatory',host.port);
  await page.waitForFunction(()=>window.SphereBiomeLibrary?.world&&window.SphereLoading?.ready);
  console.log('Native viewport ready');await page.evaluate(async seed=>{
   const s={...SphereApp.getState(),seed,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,collection:true,layoutVersion:2};
   SphereApp.setPlaying(false);SphereApp.setState(s);await SphereBiomeLibrary.selectWorld(s);
   const frame=()=>document.querySelector('#stageFrame iframe'),api=()=>frame()?.contentWindow?.SphereBiome;
   window.mineral=()=>{
    const a=api(),s=a?.nativeView?.()??SphereApp.getState(),p=a?.pose?.(),i=SphereBiomeLibrary.entry('violet-labyrinth'),g=SphereWorld.coordinates(SphereMath.norm(s.position),s);
    return {id:a?.id,p,active:!!a?.inspect?.().frames&&frame()?.surfaceEntry?.active!==false&&!a.inspect().held,scripted:a?.inspect?.().scripted,info:a?.inspect?.(),lat:g.lat,lon:g.lon,position:s.position,forward:s.forward,
     altitudeM:(s.radius-SphereMath.length(s.position))*1000,walking:s.walkMode,site:s.siteId,world:SphereBiomeLibrary.world.key,ground:SphereGround.info,atlas:document.querySelector('#atlasPlaceStatus')?.textContent,status:document.querySelector('#biomeLibraryStatus')?.textContent};
   };
   window.rockDetails=()=>{
    const s=api()?.nativeView?.()??SphereApp.getState(),i=SphereBiomeLibrary.entry('violet-labyrinth'),f=SphereVioletForest.referenceFork(s);
    const ids=SphereGround.neighbourhood(s).flatMap(m=>m.ground.props||[]).filter(v=>String(v).startsWith(f.id+'/arm/'));
    return {id:f.id,count:ids.length,examples:ids.slice(0,5),owners:[...new Set(ids.map(v=>v.split('/arm/')[1].split('/')[0]))],error:SphereApp.renderer.gl.getError()};
   };
  },seed);
  await page.getByRole('tab',{name:'Explore'}).click();await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
 }
 const row=()=>page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:/Violet Labyrinth/})});
 async function ready(){await page.waitForFunction(()=>mineral().id==='violet-labyrinth'&&mineral().active&&!mineral().scripted,null,{timeout:220000});}
 async function snap(tag){
  const v=await page.evaluate(()=>mineral());report.samples.push({tag,...v});write();await page.screenshot({path:path.join(folder,tag+'.png')});
  console.log(tag,v.id||v.site,v.p?.mode??v.walking,Math.round(v.altitudeM),v.p?.eastM,v.p?.northM);return v;
 }
 async function atlas(name){await page.getByRole('tab',{name:'Explore'}).click();await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
  await page.locator('#atlasPlaceList').getByRole('button',{name,exact:true}).last().click();}
 const setSpeed=m=>page.evaluate(m=>SphereApp.chooseFlightSpeed(false,m),m);
 const pace=m=>page.evaluate(m=>SphereStageFrame.setSurfacePace(m),m);
 const canvas=()=>page.frameLocator('#stageFrame iframe').locator('canvas').first();
 async function turn(yaw,pitch=0){
  const p=(await page.evaluate(()=>mineral())).p,box=await canvas().boundingBox();
  const dx=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw))/.004,n=Math.max(1,Math.ceil(Math.abs(dx)/(.66*box.width)));
  for(let j=0;j<n;j++){const x=box.x+box.width*(dx<0?.84:.16),y=box.y+box.height*.5;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/n,y-(pitch-p.pitch)/(.004*n),{steps:4});await page.mouse.up();}
 }
 async function leg(key,fn,arg,ms=90000){
  await canvas().focus();await page.keyboard.down(key);try{await page.waitForFunction(fn,arg,{timeout:ms,polling:'raf'});}
  catch(e){console.log('Last position',JSON.stringify(await page.evaluate(()=>mineral())));throw e;}finally{await page.keyboard.up(key);}
 }
 async function go(target,alt,rate,tolerance){
  const p=(await page.evaluate(()=>mineral())).p,dx=target.eastM-p.eastM,dz=target.northM-p.northM,dist=Math.hypot(dx,dz);
  if(dist<tolerance)return;
  await turn(Math.atan2(dx,-dz),alt==null?.04:Math.atan2(alt-p.altitudeM,dist));
  if(rate!=null)await setSpeed(rate);
  await leg('KeyW',v=>{const p=mineral().p;return p&&(p.eastM-v.x)*v.dx+(p.northM-v.z)*v.dz>=-v.tol;},{x:target.eastM,z:target.northM,dx:dx/dist,dz:dz/dist,tol:tolerance});
  const after=(await page.evaluate(()=>mineral())).p;assert(Math.hypot(after.eastM-target.eastM,after.northM-target.northM)<Math.max(tolerance*1.8,6),'The pilot must reach the surveyed arm');
 }
 const filmed=(tag,action)=>process.env.SPHERE_VIOLET_FILM==='1'
  ?recordPilot(page,path.join(folder,tag+'-frames'),action):action();
 async function doWalk(){
  const [entry,left,right]=o.fork.arms,at=o.fork.local;
  const p=(await page.evaluate(()=>mineral())).p;
  assert(Math.abs(p.altitudeM-11355)<1);
  await turn(Math.atan2(entry[2].eastM,-entry[2].northM),-Math.atan2(p.altitudeM-1250,Math.hypot(entry[2].eastM,entry[2].northM)));
  await snap('mineral-fork-from-survey');
  await page.evaluate(()=>{window.fieldTrace=[];window.fieldTimer=setInterval(()=>{
    const frame=document.querySelector('#stageFrame iframe'),a=frame?.contentWindow?.SphereBiome,p=a?.pose?.(),s=SphereApp.getState();
    fieldTrace.push({t:performance.now(),id:a?.id??'main',h:p?.altitudeM??(s.radius-SphereMath.length(s.position))*1000,
      x:p?.eastM,z:p?.northM,yaw:p?.yaw,pitch:p?.pitch});
  },225);});
  try{await filmed('survey-descent',()=>go(entry[2],1250,1.2,130));}finally{report.descent=await page.evaluate(()=>{clearInterval(fieldTimer);return fieldTrace;});write();}
  const high=await snap('above-incoming-arm');
  assert(Math.abs(high.p.altitudeM-1250)<180,'The native descent must retain the physical flight slope');
  assert(report.descent.every(f=>f.id==='violet-labyrinth'),'The distant ordinary wall should remain visible in the native survey');
  await go(entry[1],330,.18,22);await filmed('along-the-arm',()=>go(entry[0],43,.042,5));await snap('low-on-incoming-arm');
  if(process.env.SPHERE_APPROACH_ONLY==='1')return null;
  await setSpeed(.009);await leg('KeyQ',()=>{const s=mineral(),v=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.nativeView(),f=SphereGround.frame(v),l=f.local(v.position);return s.altitudeM-SphereGround.height(v,f,l[0],l[2])*1000<3.2;});
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>mineral().p?.mode==='walk',null,{timeout:10000});
  await snap('landed-on-seam');await pace(8);
  // Follow the same analytic seam to the junction, then take a different outgoing arm.
  await filmed('walk-to-the-fork',()=>go(at,null,null,3.2));await turn(Math.atan2(left[0].eastM-at.eastM,at.northM-left[0].northM),.07);
  const details=await page.evaluate(()=>rockDetails());assert(details.count>0&&details.owners.length>=2&&details.error===0);report.faces=details;
  const point=await snap('walking-at-mineral-fork');
  report.mark=await saveAtlasMark(page,'Violet mineral fork');write();
  await filmed('other-arm',async()=>{
   await go(left[0],null,null,4);await snap('departing-second-arm');
   const out=(await page.evaluate(()=>mineral())).p;await turn(Math.atan2(at.eastM-out.eastM,out.northM-at.northM),.045);
  });
  await snap('look-back-at-fork');return point;
 }
 try{
  await boot();
  if(!await page.evaluate(()=>!!SphereBiomeLibrary.entry('super-jungle'))){
   await page.evaluate(()=>SphereBiomeLibrary.placeRegion('infinite-meadow',{plotId:'r10c0'}));
   for(const [id,name] of [['infinite-meadow','Infinite Meadow'],['border-transport','Border Biome'],['super-jungle','Super Jungle']]){
    if(await page.evaluate(id=>!!SphereBiomeLibrary.entry(id),id))continue;
    const card=page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:new RegExp(name)})});
    await card.getByRole('button',{name:'Install',exact:true}).click();await page.waitForFunction(id=>!!SphereBiomeLibrary.entry(id),id,{timeout:20000});
   }
  }
  if(!await page.evaluate(()=>!!SphereBiomeLibrary.entry('violet-labyrinth'))){
   await row().getByRole('button',{name:'Install',exact:true}).click();
   await page.waitForFunction(()=>!!SphereBiomeLibrary.entry('violet-labyrinth'),null,{timeout:15000});
  }
  console.log('Installation ready');o=await page.evaluate(()=>SphereBiomeLibrary.entry('violet-labyrinth').occurrence);report.occurrence=o;write();
  assert(await page.evaluate(()=>!!SphereBiomeLibrary.entry('super-jungle')));
  await row().getByRole('button',{name:'Visit',exact:true}).click();console.log('Opening Violet through Visit');await ready();await snap('native-11355m-survey');
  const original=await doWalk();
  if(!original){report.approachPassed=true;write();return;}
  const port=host.port;await browser.close();browser=null;await host.close();host=null;host=await start({port,storePath:store});
  await boot();await atlas('Violet mineral fork');await ready();
  const restored=await snap('fork-after-restart'),p=restored.p;
  assert.equal(restored.info.fork,o.fork.id);assert(Math.abs(p.altitudeM-original.p.altitudeM)<.08);assert(Math.hypot(p.eastM-original.p.eastM,p.northM-original.p.northM)<.15);
  await pace(8);await go(o.fork.arms[2][0],null,null,4);await snap('other-arm-after-restart');
  await canvas().focus();await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
  await page.waitForFunction(()=>mineral().p?.mode==='flight');await setSpeed(1.6);
  await leg('KeyE',()=>{const s=mineral();return !s.id&&s.altitudeM>20000;},null,100000);
  await snap('above-violet-in-main');await page.locator('#viewport').focus();await page.keyboard.down('KeyQ');
  try{await ready();}finally{await page.keyboard.up('KeyQ');}
  const incoming=await snap('geographic-violet-descent');assert.equal(incoming.info.fork,o.fork.id);
  await row().getByRole('button',{name:'Remove',exact:true}).click();await page.waitForFunction(()=>!SphereBiomeLibrary.entry('violet-labyrinth'));
  await atlas('Violet mineral fork');await page.waitForFunction(v=>{const f=mineral();return !f.id&&f.walking&&Math.hypot(...f.position.map((n,i)=>(n-v[i])*1000))<.6;},original.position);
  const absent=await snap('native-fork-with-pack-removed');const backup=await page.evaluate(()=>rockDetails());assert.equal(backup.id,o.fork.id);assert(backup.count>0);
  assert(await page.evaluate(()=>!!SphereBiomeLibrary.entry('super-jungle')));
  await row().getByRole('button',{name:'Install',exact:true}).click();await page.waitForFunction(()=>!!SphereBiomeLibrary.entry('violet-labyrinth'));
  await atlas('Violet mineral fork');await ready();await snap('reinstalled-fork');
  if(await page.evaluate(()=>SphereBiomeLibrary.marks().some(m=>m.name==='Original Violet spire 88'))){
   await atlas('Original Violet spire 88');
   const native=JSON.parse(fs.readFileSync(path.join(folder,'original-native-mark.json')));
   await page.waitForFunction(pos=>{const f=mineral();return Math.hypot(...f.position.map((n,i)=>(n-pos[i])*1000))<1;},native.position);
   const old=await snap('pre-upgrade-spire-restored');
   assert(old.forward.reduce((n,v,i)=>n+v*native.forward[i],0)>.999);assert(old.walking||old.p?.mode==='walk');
   const current=await page.evaluate(id=>{const s=document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.nativeView?.()??SphereApp.getState();return SphereGround.neighbourhood(s).some(t=>t.ground.props?.includes(id));},native.spire);
   assert(current);report.preUpgradeSpire=native.spire;
  }
  if(seed!==713){
    const worlds=JSON.parse(fs.readFileSync(store,'utf8')).worlds,home=worlds['sphere-ed6a59ab491a9a08'];
    if(home?.marks?.some(m=>m.name==='Violet mineral fork')){
      const foreign=home.marks.findLast(m=>m.name==='Violet mineral fork');
      assert.notEqual(foreign.occurrenceId,report.mark.occurrenceId);assert.notEqual(foreign.world,report.mark.world);
      assert(!await page.evaluate(id=>SphereBiomeLibrary.marks().some(m=>m.occurrenceId===id),foreign.occurrenceId));
      report.separateWorlds=[foreign.world,report.mark.world];
    }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;write();console.log('PASS',seed,o.fork.id,'survey, seam, restart, native and reinstall');
 }catch(e){console.log('Failure state',await page?.evaluate(()=>typeof mineral==='function'?mineral():document.body.innerText.slice(-700)).catch(()=>null));report.failure=e.message;throw e;}
 finally{write();await browser?.close();await host?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
