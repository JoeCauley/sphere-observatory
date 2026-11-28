'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright');
const {start}=require('./support/observatory-server.cjs'),{executable,saveAtlasMark}=require('./support/biome-browser.cjs');
const out=process.env.SPHERE_WALL_FIELD,store=process.env.SPHERE_WALL_TEST_STORE||path.join(fs.mkdtempSync(path.join(os.tmpdir(),'wall-field-')),'atlas.json');
const report={method:'WASD, Q and F, manual flight speed. Exact-address setup only at the real junction.',errors:[],trace:[]};
function log(){if(out)fs.writeFileSync(path.join(out,'wall-flight.json'),JSON.stringify(report,null,2));}
(async()=>{
 if(out)fs.mkdirSync(out,{recursive:true});
 let host=await start({transport:'http',storePath:store}),browser;
 try{
 browser=await chromium.launch({headless:true,executablePath:executable()});
 let page,canvas,cdp,record=false,frames=[];
 async function load(route){
   const p=await browser.newPage({viewport:{width:1440,height:840}});
   p.on('pageerror',e=>{report.errors.push(e.message);console.log('Page error',e.message);});p.setDefaultTimeout(180000);
   await p.goto(host.origin+'/?border='+route,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
   await p.evaluate(()=>{
     window.pilot=()=>document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;
     window.flight=()=>{const a=pilot();return {id:a?.id,...a?.pose(),wall:a?.inspect().wall};};
   });
   page=p;canvas=page.frameLocator('#stageFrame iframe').locator('canvas').first();await canvas.focus();
   cdp=await page.context().newCDPSession(page);
   cdp.on('Page.screencastFrame',f=>{
     void cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});
     if(!record)return;
     const index=frames.length,filename='flight-'+String(index).padStart(4,'0')+'.jpg';
     fs.writeFileSync(path.join(out,'movie',filename),Buffer.from(f.data,'base64'));
     frames.push({filename,t:f.metadata.timestamp});
   });
 }
 async function snap(tag){const p=await page.evaluate(()=>flight());report.trace.push({tag,...p});log();
   if(out)await page.screenshot({path:path.join(out,tag+'.png')});return p;}
 async function leg(key,condition,value,ms=40000){
   await canvas.focus();await page.keyboard.down(key);
   try{await page.waitForFunction(condition,value,{timeout:ms,polling:'raf'});}
   finally{await page.keyboard.up(key);}
 }
 async function mark(name){
   await page.locator('[data-tab=camera]').click();
   await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
   return saveAtlasMark(page,name);
 }
 await load('beyond');
 const startPose=await snap('bay-plus-one');assert.equal(startPose.eastM,212000);
 if(out){fs.mkdirSync(path.join(out,'movie'),{recursive:true});record=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:1200,maxHeight:700,everyNthFrame:1});}
 await leg('KeyW',x=>flight().eastM>x,223000);await snap('past-old-end');
 if(record){await cdp.send('Page.stopScreencast');record=false;fs.writeFileSync(path.join(out,'movie','times.json'),JSON.stringify(frames));}
 await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,12));
 await leg('KeyW',x=>flight().eastM>x,305000);
 await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,.5));
 await leg('KeyQ',y=>flight().altitudeM<=y,1746.71);
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>flight().mode==='walk');
 const beforeWalk=await snap('landed');await leg('KeyW',x=>flight().eastM>x,beforeWalk.eastM+3);
 const afterWalk=await snap('plain-roof-walk');assert.equal(afterWalk.altitudeM,1746.7);
 const roofMark=await mark('Plain wall beyond Bay +1');report.roofMark=roofMark;log();
 assert.equal(roofMark.wallEdge,'r10c0/r10c1');assert.equal(roofMark.pose.mode,'walk');
 // Reverse the actual camera using the normal drag control and fly back toward the hall.
 async function turn(yaw,pitch){
   const p=await page.evaluate(()=>flight()),box=await canvas.boundingBox();
   const delta=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw))/.004;
   const n=Math.max(1,Math.ceil(Math.abs(delta)/(box.width*.68)));
   for(let k=0;k<n;k++){
     const x=box.x+box.width*(delta<0?.84:.16),y=box.y+box.height*.46;
     await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+delta/n,y-(pitch-p.pitch)/(.004*n),{steps:5});await page.mouse.up();
   }
 }
 await turn(-Math.PI/2,-.004);
 await canvas.focus();await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
 await page.waitForFunction(()=>flight().mode==='flight');await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,2));
 await leg('KeyE',y=>flight().altitudeM>y,2600);
 await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,12));await leg('KeyW',x=>flight().eastM<x,212000);
 const back=await snap('return-to-double-gallery');assert.equal(back.wall.lod,'hall');
 await page.close();await load('junction');
 const startCorner=await snap('junction-approach');
 const corner=await page.evaluate(async()=>{const d=SphereBiomeLibrary.entry('border-transport').transport;
   const {installedEdge}=await import('/packs/border-transport/0.10.0/district.mjs');return installedEdge(d).lengthM/2;});
 await turn(Math.PI/2,0);await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,1));
 await leg('KeyW',x=>flight().eastM>=x,corner-140);
 await turn(0,0);await page.evaluate(()=>SphereApp.chooseFlightSpeed(false,4));
 await leg('KeyW',z=>flight().northM>=z,40000);
 await turn(-Math.PI*.57,-.14);
 const onArm=await snap('look-back-at-junction');assert.equal(onArm.wall.hallFaces,0);assert.equal(onArm.wall.freightFaces,0);
 assert(onArm.wall.edges.length>=3);assert(Math.abs(onArm.eastM-corner)<1600);
 report.junctionMark=await mark('Junction · east arm looking back');assert.notEqual(report.junctionMark.wallEdge,roofMark.wallEdge);log();
 const port=host.port;await page.close();await browser.close();browser=null;await host.close();host=null;
 host=await start({transport:'http',port,storePath:store});browser=await chromium.launch({headless:true,executablePath:executable()});
 await load('beyond');
 await page.locator('[data-tab=camera]').click();await page.evaluate(()=>document.querySelector('#atlasPlaces').open=true);
 await page.locator('#atlasPlaceList').getByRole('button',{name:roofMark.name,exact:true}).last().click();
 await page.waitForFunction(x=>flight().mode==='walk'&&flight().eastM===x,roofMark.pose.eastM);
 const restored=await snap('restored-roof');assert.equal(restored.northM,roofMark.pose.northM);assert.equal(restored.yaw,roofMark.pose.yaw);
 assert.deepEqual(report.errors,[]);report.passed=true;log();console.log('PASS roof landing, walk, reverse, real junction, fresh browser/server mark return',report.roofMark.pose,report.junctionMark.wallEdge);
 }finally{log();await browser?.close();await host?.close();}
})().catch(e=>{report.failure=e.message;log();console.error(e);process.exitCode=1;});
