require('node:fs').mkdirSync(require('node:path').join(__dirname,'artifacts'),{recursive:true});
// Requires Playwright for development only. The application has no dependencies.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const output=process.env.SPHERE_TEST_OUTPUT||path.join(__dirname,'artifacts');fs.mkdirSync(output,{recursive:true});
const root=path.resolve(__dirname,'..');let browser;
(async()=>{
 browser=await chromium.launch({...(process.env.SPHERE_BROWSER?{executablePath:process.env.SPHERE_BROWSER}:{}),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>!!window.SphereApp);await page.waitForTimeout(300);
 console.log('GPU:',await page.evaluate(()=>SphereApp.renderer.device));
 assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.evaluate(()=>SphereApp.renderer.error()),0);
 console.log('PASS Offline file launch and shader compilation');
 // Compare actual GPU object IDs with independent double-precision CPU ray tests.
 const agreement=await page.evaluate(()=>{
  const M=SphereMath,out=[];for(const name of ['interior','breach','shade','dawn']){
   SphereApp.preset(name,{stage:true});const s=SphereApp.getState(),r=SphereApp.renderer,w=161,h=91;
   r.draw({...s,viewMode:'objectid'},w,h);const pixels=new Uint8Array(w*h*4);r.gl.readPixels(0,0,w,h,r.gl.RGBA,r.gl.UNSIGNED_BYTE,pixels);const b=M.basis(s.forward,s.up),kinds={'Inner surface':0,'Shade':1,'Star':2,'Open space':3};let misses=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=M.ray((x+.5)/w*2-1,(y+.5)/h*2-1,w/h,s.fov,b);const cpu=kinds[M.trace(s.position,d,s).kind],gpu=Math.round(pixels[(y*w+x)*4]/85);if(cpu!==gpu)misses++;}
   out.push({name,misses,total:w*h});
  }
  // Magnified star: the rendered boundary should match its exact angular diameter.
  const s=M.defaultState();s.shadeEnabled=false;s.breachEnabled=false;s.forward=[0,0,-1];s.fov=10;
  const r=SphereApp.renderer,w=1001,h=501;r.draw({...s,viewMode:'objectid'},w,h);const p=new Uint8Array(w*h*4);r.gl.readPixels(0,0,w,h,r.gl.RGBA,r.gl.UNSIGNED_BYTE,p);let first=w,last=-1;for(let x=0;x<w;x++)if(p[((h-1)/2*w+x)*4]===170){first=Math.min(first,x);last=x;}
  const radius=Math.asin(s.starRadius/M.length(s.position)),expected=w*Math.tan(radius)/Math.tan(M.radians(s.fov)/2);out.push({name:'stellar disk',measured:last-first+1,expected});
  SphereApp.preset('interior');return out;
 });
 for(const a of agreement){if(a.name==='stellar disk')assert.ok(Math.abs(a.measured-a.expected)<2,JSON.stringify(a));else assert.ok(a.misses/a.total<.001,JSON.stringify(a));console.log('PASS GPU geometry',a);}
 await page.click('[data-tab="camera"]');await page.locator('#cameraAltitude').fill('300');await page.locator('#cameraLat').fill('0');await page.locator('#cameraLon').fill('0');await page.click('#moveCamera');
 assert.ok(Math.abs(await page.evaluate(()=>SphereApp.getState().radius-SphereMath.length(SphereApp.getState().position))-300)<.001);
 await page.click('#faceStar');await page.waitForTimeout(100);assert.ok((await page.evaluate(()=>SphereApp.getState().forward))[2]<-.999);
 await page.locator('#cameraAltitude').fill('-1');await page.click('#moveCamera');assert.ok((await page.locator('#toast').textContent()).includes('Choose'));console.log('PASS Coordinate navigation and invalid-input feedback');
 await page.click('[data-preset="interior"]');const before=await page.evaluate(()=>SphereApp.getState().position);await page.locator('#viewport').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');const after=await page.evaluate(()=>SphereApp.getState().position);assert.ok(after[2]>before[2]);console.log('PASS Keyboard flight');
 const f1=await page.evaluate(()=>SphereApp.getState().forward);await page.mouse.move(1100,450);await page.mouse.down();await page.mouse.move(1150,480,{steps:4});await page.mouse.up();const f2=await page.evaluate(()=>SphereApp.getState().forward);assert.ok(Math.abs(f1[0]-f2[0])>.01);console.log('PASS Mouse look');
 await page.click('[data-preset="dawn"]');await page.click('#play');await page.waitForTimeout(200);await page.click('#play');assert.ok(await page.evaluate(()=>SphereApp.getState().time)>0);await page.click('#resetTime');assert.equal(await page.evaluate(()=>SphereApp.getState().time),0);console.log('PASS Shade animation and reset');
 await page.click('[data-tab="photo"]');await page.locator('#bookmarkName').fill('Test · first light');await page.click('#saveBookmark');assert.ok((await page.locator('#bookmarks').textContent()).includes('Test · first light'));
 const downloadScene=page.waitForEvent('download');await page.click('#saveScene');const sceneDownload=await downloadScene,scenePath=path.join(output,'scene.json');await sceneDownload.saveAs(scenePath);const scene=JSON.parse(fs.readFileSync(scenePath));assert.equal(scene.format,'sphere-observatory');
 await page.click('[data-preset="interior"]');await page.locator('#sceneFile').setInputFiles(scenePath);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>SphereApp.getState().atmosphere),scene.state.atmosphere);console.log('PASS Bookmark and exported-scene round trip');
 await page.locator('#sceneFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"no"}')});assert.ok((await page.locator('#toast').textContent()).includes('Could not import'));console.log('PASS Invalid scene rejected');
 await page.click('[data-preset="interior"]');await page.click('[data-tab="photo"]');
 const downloadPhoto=page.waitForEvent('download',{timeout:60000});await page.click('#capture');const photo=await downloadPhoto,zipPath=path.join(output,'photograph.zip');await photo.saveAs(zipPath);const zip=fs.readFileSync(zipPath),entries={};let offset=0;
 while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),nl=zip.readUInt16LE(offset+26),ex=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+nl).toString(),start=offset+30+nl+ex;entries[name]=zip.subarray(start,start+size);offset=start+size;}
 assert.ok(entries['photograph.png']&&entries['scene.json']&&entries['READ-ME.txt']);assert.equal(entries['photograph.png'].readUInt32BE(16),3840);assert.equal(entries['photograph.png'].readUInt32BE(20),2160);assert.equal(JSON.parse(entries['scene.json']).image.width,3840);fs.writeFileSync(path.join(output,'photograph.png'),entries['photograph.png']);console.log('PASS Actual 4K PNG + reproducible scene ZIP export');
 await page.click('[data-tab="camera"]');await page.selectOption('#projection','panorama');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>SphereApp.getState().projection),'panorama');await page.screenshot({path:path.join(output,'panorama-ui.png')});
 await page.click('#helpButton');assert.equal(await page.locator('#guide').isVisible(),true);await page.click('#closeGuide');
 await page.click('[data-preset="interior"]');await page.click('[data-tab="scene"]');await page.waitForTimeout(250);await page.screenshot({path:path.join(root,'preview.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert.equal(await page.evaluate(()=>SphereApp.renderer.error()),0);console.log('PASS No browser errors, no WebGL errors, no network requests');
 await page.setViewportSize({width:800,height:650});await page.waitForTimeout(100);await page.screenshot({path:path.join(output,'compact-ui.png')});
 const report={passed:true,geometry:agreement,gpu:await page.evaluate(()=>SphereApp.renderer.device),networkRequests:network,errors};fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
 await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exit(1);});
