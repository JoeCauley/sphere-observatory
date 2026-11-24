'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');
(async()=>{
 const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(150000);
  await page.goto(host.origin+'/?border=wall',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereLoading?.ready && SphereStageFrame.approachLabel(SphereApp.getState()).includes('maintenance wall'));
  const viewport=page.locator('#viewport');
  await viewport.focus();await page.keyboard.down('KeyW');
  try{await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);}
  finally{await page.keyboard.up('KeyW');}
  const frame=page.frameLocator('#stageFrame iframe'),scene=frame.locator('#scene');
  // Bracket the reported sky change on the same ordinary roof at a fixed bearing.
  await scene.focus();
  for(const altitude of [18400,17800]){
    await page.keyboard.down('KeyQ');
    try{await page.waitForFunction(h=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<=h,altitude);}
    finally{await page.keyboard.up('KeyQ');}
    if(process.env.SPHERE_DESCENT_OUTPUT){
      const box=await scene.boundingBox();
      await page.screenshot({path:path.join(process.env.SPHERE_DESCENT_OUTPUT,'border-'+altitude+'.jpg'),type:'jpeg',quality:85,
        clip:{x:box.x,y:box.y+44,width:box.width,height:box.height-48}});
    }
  }
  await frame.locator('#pace').selectOption('16');await scene.focus();await page.keyboard.down('KeyW');
  try{await page.waitForFunction(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<3000);}
  finally{await page.keyboard.up('KeyW');}
  const roof=await page.evaluate(async()=>{const {departure}=await import('./studies/border-crossing/clear-day-flight.mjs');return departure.meta.center.altitudeM;});
  await page.keyboard.down('KeyQ');
  try{await page.waitForFunction(h=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<h+1,roof);}
  finally{await page.keyboard.up('KeyQ');}
  await scene.focus();await page.keyboard.press('KeyF');
  const result=await scene.evaluate(canvas=>{const api=window.SphereBiome;return {pose:api.pose(),locked:api.inspect().locked,label:document.querySelector('#readout').textContent,error:canvas.getContext('webgl2').getError()};});
  assert.equal(result.pose.mode,'walk');assert(!result.locked && result.label.includes('maintenance wall'));assert(Math.abs(result.pose.eastM)>70000);assert.equal(result.error,0);assert.deepEqual(errors,[]);
  if(process.env.SPHERE_WALL_IMAGE)await scene.screenshot({path:path.resolve(process.env.SPHERE_WALL_IMAGE)});
  await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
  assert.equal(await scene.evaluate(()=>SphereBiome.pose().mode),'flight');
  await scene.focus();
  const key=await page.evaluate(async()=>{
    const {mainPose,footprint}=await import('./geographic-flight.js');
    const lib=SphereBiomeLibrary, border=lib.entry('border-transport'), s=SphereApp.getState();
    const p=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose();
    const hand=(await import('./packs/border-transport/0.10.0/district.mjs')).rightSign(border.transport);
    for(const side of [-1,1]){
      const view=mainPose(s,border,{...p,northM:side*4000},SphereAtlas,SphereWorld);
      if(footprint(view,lib,SphereAtlas,SphereWorld)?.id==='infinite-meadow')return side===-hand?'KeyD':'KeyA';
    }
    throw Error('No Meadow frontage at this chainage');
  });
  await page.keyboard.down(key);
  try{await page.waitForFunction(()=>SphereStageFrame.current?.id==='infinite-meadow' && document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);}
  finally{await page.keyboard.up(key);}
  const landing=await frame.locator('#world').evaluate(()=>{
    const api=window.SphereBiome,p=api.pose(),row=parent.SphereStageFrame.transportAddress().rows[0];
    return {...row.locate(p.eastM,p.northM),altitudeM:p.altitudeM,wall:api.inspect().exteriorStation};
  });
  assert(Math.abs(landing.eastM-result.pose.eastM)<500 && Math.abs(landing.northM)<9000,JSON.stringify(landing));
  assert(Math.abs(landing.altitudeM-result.pose.altitudeM)<2 && landing.wall,JSON.stringify(landing));
  assert.deepEqual(errors,[]);
  await frame.locator('#world').focus();
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyQ');
  try{await page.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.pose().mode==='walk');}
  finally{await page.keyboard.up('KeyQ');await page.keyboard.up('ShiftLeft');}
  const ground=await frame.locator('#world').evaluate(()=>{
    const pose=SphereBiome.pose(), row=parent.SphereStageFrame.transportAddress().rows[0];
    return {...row.locate(pose.eastM,pose.northM),wall:SphereBiome.inspect().exteriorStation};
  });
  assert(Math.hypot(ground.eastM-landing.eastM,ground.northM-landing.northM)<2 && ground.wall,JSON.stringify(ground));
  assert.deepEqual(errors,[]);
  console.log(result,landing,ground);
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
