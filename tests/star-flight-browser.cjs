const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[],dir=path.resolve('work/screenshots/star-flight');fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);console.log('Star flight ready');
 const records=[];
 for(const mode of ['auto','manual'])for(const sign of [-1,1]){
  await page.evaluate(({mode,sign})=>{const A=SphereApp,M=SphereMath,s={...M.defaultState(),collection:true,routeShades:false,starStation:false,geometryDetail:false,cavityHaze:0,atmosphere:0,autoWalk:false,autoSpeed:mode==='auto',speed:1000000};s.position=[s.starRadius*1.4*sign,0,0];s.forward=[-sign,0,0];s.up=[0,1,0];A.setState(s);A.setPlaying(mode==='auto');}, {mode,sign});
  await page.waitForFunction(()=>SphereLoading.ready&&!SphereApp.busy);await page.locator('#viewport').focus();await page.keyboard.down('e');
  await page.waitForFunction(sign=>SphereApp.getState().position[0]*sign< -SphereApp.getState().starRadius*1.4,sign);const crossed=await page.evaluate(()=>SphereApp.getState());
  await page.waitForFunction(({sign,x})=>SphereApp.getState().position[0]*sign<x-250000,{sign,x:crossed.position[0]*sign});await page.keyboard.up('e');const after=await page.evaluate(()=>SphereApp.getState());
  assert(after.position.every(Number.isFinite));assert.equal(after.playing,mode==='auto');assert.equal(after.speed,1000000);assert.equal(after.autoSpeed,mode==='auto');assert(after.position[0]*sign<crossed.position[0]*sign);assert.equal(await page.evaluate(()=>SphereApp.renderer.error()),0);records.push({mode,sign,crossed:crossed.position,after:after.position,playing:after.playing});
  console.log('PASS held E crosses the centre without reversing',mode,sign);
 }
 const centre=await page.evaluate(async()=>{const A=SphereApp,R=A.renderer,s={...A.getState(),position:[0,0,0],forward:[0,0,1],up:[0,1,0]};A.setBusy(true);A.setState(s);await R.prepare(s);R.draw(s,1100,700,{exportFrame:true});return {error:R.error(),state:A.getState(),png:R.canvas.toDataURL(),visibility:SphereMath.sunVisibility(s.position,s)};});
 fs.writeFileSync(path.join(dir,'centre.png'),Buffer.from(centre.png.split(',')[1],'base64'));delete centre.png;assert.equal(centre.error,0);assert.equal(centre.visibility,1);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({records,centre,errors},null,2));console.log('PASS centre rendering, continuous star flight, speed and play ownership');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
