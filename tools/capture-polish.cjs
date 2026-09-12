// Reproducible views for the Wound air boundary and analytic Shade silhouettes.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereEvolution||!document.querySelector('#error').hidden);if(!await page.evaluate(()=>!!window.SphereEvolution))throw Error(await page.locator('#error').textContent());console.log('Startup ms',await page.evaluate(()=>performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd));await page.evaluate(()=>SphereApp.setBusy(true));
 const dir=path.resolve('work/screenshots/polish',process.argv[2]||'after');fs.mkdirSync(dir,{recursive:true});const results=[];
 for(const id of ['rim-air','rim-clear-clouds','shade-fleet','shade-inspect']){
  const result=await page.evaluate(async id=>{const A=SphereApp,R=A.renderer,M=SphereMath;SphereEvolution.visit(id.startsWith('rim')?'rim':'shade-0');const s=A.getState();s.time=983;s.playing=false;s.antialias=3;s.weatherQuality=2;s.cavityHaze=.28;
   if(id.startsWith('rim')){const f=SphereWorld.rimFrame(s);s.position=M.add(M.mul(f.point,s.radius-5),M.mul(f.inland,-8));s.forward=M.norm(M.add(M.add(f.tangent,M.mul(f.inland,.15)),M.mul(f.point,.025)));s.up=M.mul(f.point,-1);s.fov=89;s.exposure=1.3;s.atmosphere=1;s.clouds=id==='rim-air';}
   else{SphereInspection.setTime(s,983);const f=SphereSites.shadeSection(s);s.position=f.world([-.3,.2,.75]);s.up=f.basis[1];s.forward=M.norm(M.add(M.mul(f.basis[0],-.75),M.add(f.basis[2],M.mul(f.basis[1],id==='shade-fleet'?.65:.035))));s.fov=95;s.exposure=-.15;s.atmosphere=0;}
   await R.prepare(s);R.draw(s,1600,900,{adaptiveScale:.68});R.gl.finish();return {id,state:s,info:R.renderInfo,image:R.canvas.toDataURL('image/png'),gl:R.error()};
  },id);fs.writeFileSync(path.join(dir,id+'.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;results.push(result);console.log(id,result.gl,result.info.internalWidth,result.info.internalHeight);
 }
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({results,errors},null,2));if(errors.length||results.some(r=>r.gl))throw Error('Capture errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
