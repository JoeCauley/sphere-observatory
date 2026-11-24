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
  await frame.locator('#pace').selectOption('16');await scene.focus();await page.keyboard.down('KeyW');
  try{await page.waitForFunction(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<3000);}
  finally{await page.keyboard.up('KeyW');}
  const roof=await page.evaluate(async()=>{const {departure}=await import('./studies/border-crossing/clear-day-flight.mjs');return departure.meta.center.altitudeM;});
  await page.keyboard.down('KeyF');
  try{await page.waitForFunction(h=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<h+1,roof);}
  finally{await page.keyboard.up('KeyF');}
  await frame.getByRole('button',{name:'Walk',exact:true}).click();
  const result=await scene.evaluate(canvas=>{const api=window.SphereBiome;return {pose:api.pose(),locked:api.inspect().locked,label:document.querySelector('#readout').textContent,error:canvas.getContext('webgl2').getError()};});
  assert.equal(result.pose.mode,'walk');assert(!result.locked && result.label.includes('maintenance wall'));assert(Math.abs(result.pose.eastM)>70000);assert.equal(result.error,0);assert.deepEqual(errors,[]);
  if(process.env.SPHERE_WALL_IMAGE)await scene.screenshot({path:path.resolve(process.env.SPHERE_WALL_IMAGE)});
  console.log(result);
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
