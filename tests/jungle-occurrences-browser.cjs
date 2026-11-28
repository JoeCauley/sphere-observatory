'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright'),{start}=require('./support/observatory-server.cjs'),{executable,saveAtlasMark}=require('./support/biome-browser.cjs');
const dir=path.resolve(process.env.SPHERE_GROVE_FIELD||fs.mkdtempSync(path.join(os.tmpdir(),'sphere-groves-'))),store=path.join(dir,'field-atlas.json');
fs.mkdirSync(dir,{recursive:true});
if(!fs.existsSync(store))fs.copyFileSync(process.env.SPHERE_FIELD_REGISTER,store);
const r={samples:[]},write=()=>fs.writeFileSync(path.join(dir,'occurrences.json'),JSON.stringify(r,null,2));
(async()=>{
 const h=await start({storePath:store}),b=await chromium.launch({executablePath:executable(),headless:true});
 try{
  const p=await b.newPage({viewport:{width:1152,height:720}});p.setDefaultTimeout(240000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(h.origin+'/?border=beyond',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
  await p.getByRole('tab',{name:'Explore'}).click();await p.evaluate(()=>{document.getElementById('atlasPlaces').open=true;
   window.groveState=()=>{const f=document.querySelector('#stageFrame iframe'),a=f?.contentWindow.SphereBiome,l=SphereBiomeLibrary,p=a?.pose?.(),i=l.entry(f?.dataset.locationId);
    return {id:f?.dataset.locationId,name:i?.name,api:a?.id,active:!!a?.inspect?.().frames&&f?.surfaceEntry?.active!==false,held:a?.inspect?.().held,scripted:a?.inspect?.().scripted,pose:p,info:a?.inspect?.(),occurrence:i?.occurrence?.id,tree:i?.occurrence?.tree?.id,
      bytes:SphereGround.info.bytes,frameCount:document.querySelectorAll('#stageFrame iframe').length,atlas:document.getElementById('atlasPlaceStatus').textContent};};});
  const get=()=>p.evaluate(()=>groveState()),canvas=()=>p.frameLocator('#stageFrame iframe').locator('canvas').first();
  const primary='super-jungle',second='super-jungle-reference',violet='violet-labyrinth';
  const row=name=>p.locator('#biomeLibraryList article').filter({has:p.getByRole('heading',{name})});
  async function ready(id){
    const timer=setInterval(()=>p.evaluate(()=>({place:groveState(),phase:document.querySelector('#transitPhase')?.textContent,resources:SphereGround.info,arrival:SphereStageFrame.lastArrival})).then(x=>console.log('Preparing',id,x.place.id,x.place.atlas,x.phase,x.resources.queue,x.resources.cancelled)).catch(()=>{}),25000);
    try{await p.waitForFunction(id=>{const s=groveState();return s.id===id&&s.active&&!s.held&&!s.scripted;},id);}
    finally{clearInterval(timer);}
  }
  async function markVisit(name,id){await p.getByRole('tab',{name:'Explore'}).click();await p.evaluate(()=>document.getElementById('atlasPlaces').open=true);await p.locator('#atlasPlaceList').getByRole('button',{name,exact:true}).last().click();await ready(id);}
  async function snap(tag){const s=await get();assert.equal(s.frameCount,1);console.log(tag,s.id,s.occurrence);r.samples.push({tag,...s});write();await p.screenshot({path:path.join(dir,tag+'.png')});}
  async function walkTo(at){
   let v=await get(),box=await canvas().boundingBox(),p0=v.pose,dx=at.eastM-p0.eastM,dz=at.northM-p0.northM;
   const yaw=Math.atan2(dx,-dz),drag=Math.atan2(Math.sin(yaw-p0.yaw),Math.cos(yaw-p0.yaw))/.004,n=Math.max(1,Math.ceil(Math.abs(drag)/(.6*box.width)));
   for(let i=0;i<n;i++){const x=box.x+box.width*(drag<0?.82:.18),y=box.y+box.height*.56;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+drag/n,y-(.10-p0.pitch)/(.004*n),{steps:4});await p.mouse.up();}
   await canvas().focus();await p.keyboard.down('KeyW');try{await p.waitForFunction(at=>{const q=groveState().pose;return q&&Math.hypot(q.eastM-at.eastM,q.northM-at.northM)<3.2;},at,{timeout:55000});}finally{await p.keyboard.up('KeyW');}
  }
  await markVisit('Bay 0 Jungle buttress',primary);await snap('start-at-bay-zero-tree');
  // Hold just the next native preparation and cancel with actual pilot input.
  // The outgoing frame and stored geographic address must survive the failed attempt.
  await p.evaluate(()=>{
   const renderer=SphereApp.renderer,original=renderer.prepare;
   renderer.prepare=function(s,options){
    if(s.siteId!=='biome-9')return original.call(this,s,options);
    renderer.prepare=original;window.delayedNativeArrival=true;
    return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{
      window.cancelledNativeArrival=true;reject(new DOMException('Pilot resumed the walk','AbortError'));
    },{once:true}));
   };
  });
  const originalTree=(await get()).pose;
  await p.locator('#atlasPlaceList').getByRole('button',{name:'Violet mineral fork',exact:true}).last().click();
  await p.waitForFunction(()=>window.delayedNativeArrival);await p.screenshot({path:path.join(dir,'outgoing-tree-held.png')});
  const held=(await get()).pose;assert(Math.hypot(held.eastM-originalTree.eastM,held.northM-originalTree.northM)<.2);
  await canvas().focus();await p.keyboard.down('KeyS');try{
    await p.waitForFunction(v=>{const s=groveState();return window.cancelledNativeArrival&&s.id==='super-jungle'&&Math.hypot(s.pose.eastM-v.eastM,s.pose.northM-v.northM)>.25;},held,{timeout:8000});
  }finally{await p.keyboard.up('KeyS');}
  r.cancelledArrival={outgoing:primary,retained:held,recovered:(await get()).pose};write();
  await markVisit('Violet mineral fork',violet);await snap('atlas-to-mineral-fork');
  const before=await p.evaluate(()=>({world:SphereBiomeLibrary.world.key,old:SphereBiomeLibrary.marks().filter(x=>['Plain wall beyond Bay +1','Bay 0 Jungle buttress'].includes(x.name))}));
  await row(/^Super Jungle · 1/).getByRole('button',{name:'Install reference grove'}).click();
  await p.waitForFunction(()=>!!SphereBiomeLibrary.entry('super-jungle-reference'),null,{timeout:20000});
  const l=await p.evaluate(()=>['super-jungle','super-jungle-reference'].map(id=>SphereBiomeLibrary.entry(id)));
  assert.notEqual(l[0].occurrence.tree.id,l[1].occurrence.tree.id);assert.notEqual(l[0].plotId,l[1].plotId);
  r.distanceKm=await p.evaluate(([a,b])=>Math.atan2(SphereMath.length(SphereMath.cross(a.direction,b.direction)),SphereMath.dot(a.direction,b.direction))*SphereApp.getState().radius,l);
  assert(r.distanceKm>1000);r.installations=l.map(i=>({id:i.id,name:i.name,plot:i.plotId,address:i.occurrence.id,tree:i.occurrence.tree.id}));write();
  await p.evaluate(()=>SphereStageFrame.showMain());await row(/Reference Grove/).getByRole('button',{name:'Visit',exact:true}).click();await ready(second);
  // Visit arrives in flight just above the gap. Set down there with the normal controls.
  const c=await get();if(c.pose.mode==='flight'){
   await canvas().focus();await p.evaluate(()=>SphereApp.chooseFlightSpeed(false,.006));await p.keyboard.down('KeyQ');
   try{await p.waitForTimeout(1600);}finally{await p.keyboard.up('KeyQ');}
   await p.keyboard.press('KeyF');await p.waitForFunction(()=>groveState().pose.mode==='walk',null,{timeout:14000});
  }
  await p.evaluate(()=>SphereStageFrame.setSurfacePace(12));
  const t=l[1].occurrence.tree.local,g=l[1].occurrence.gap.local,len=Math.hypot(g.eastM-t.eastM,g.northM-t.northM);
  await walkTo({eastM:t.eastM+28*(g.eastM-t.eastM)/len,northM:t.northM+28*(g.northM-t.northM)/len});
  const resident=await p.evaluate(()=>{const f=document.querySelector('#stageFrame iframe'),a=f.contentWindow.SphereBiome,s=a.nativeView();
   return SphereGround.neighbourhood(s).some(tile=>tile.ground.props?.includes(a.inspect().tree));});
  assert(resident);await snap('second-native-buttress');
  await saveAtlasMark(p,'Reference Grove buttress');
  const marked=(await get()).pose;
  await markVisit('Bay 0 Jungle buttress',primary);await snap('back-at-first-tree');
  await markVisit('Reference Grove buttress',second);await snap('back-at-second-tree');
  assert(Math.abs((await get()).pose.altitudeM-marked.altitudeM)<.06);
  const keys=await p.evaluate(()=>{const l=SphereBiomeLibrary,storage=l.saveStorage();document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.save();
   return ['super-jungle','super-jungle-reference'].map(id=>{const key=l.sceneInfo(id).saveKey;return {key,stored:JSON.parse(storage.getItem(key))?.occurrence};});});
  assert.notEqual(keys[0].key,keys[1].key);assert.deepEqual(keys.map(k=>k.stored),l.map(i=>i.occurrence.id));r.saved=keys;
  await markVisit('Plain wall beyond Bay +1','border-transport');await snap('legacy-plain-wall');
  await row(/Reference Grove/).getByRole('button',{name:'Remove',exact:true}).click();await p.waitForFunction(()=>!SphereBiomeLibrary.entry('super-jungle-reference'));
  assert(await p.evaluate(()=>!!SphereBiomeLibrary.entry('super-jungle')&&!!SphereBiomeLibrary.entry('violet-labyrinth')));
  await row(/Reference Grove/).getByRole('button',{name:'Install',exact:true}).click();
  await p.waitForFunction(()=>!!SphereBiomeLibrary.entry('super-jungle-reference'));await markVisit('Reference Grove buttress',second);
  assert.deepEqual(before.old,await p.evaluate(()=>SphereBiomeLibrary.marks().filter(x=>['Plain wall beyond Bay +1','Bay 0 Jungle buttress'].includes(x.name))));
  assert.deepEqual(errors,[]);r.passed=true;write();console.log('PASS two geographically distinct Jungle occurrences and the Atlas journey to Violet');
 }catch(e){r.failure=e.message;write();throw e;}finally{await b.close();await h.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
