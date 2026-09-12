const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.SPHERE_BROWSER?{executablePath:process.env.SPHERE_BROWSER}:{})});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.SphereEvolution);await page.evaluate(()=>SphereApp.setBusy(true));
 const dir=path.resolve('work/screenshots/continuity-4k');fs.mkdirSync(dir,{recursive:true});const results=[];
 for(const id of ['rim','rim-grazing','shade-0','shade-ride','walk-1']){
  const result=await page.evaluate(async id=>{const A=SphereApp,M=SphereMath,R=A.renderer;SphereEvolution.visit(id.startsWith('rim')?'rim':id.startsWith('shade')?'shade-0':'biome-1',{walk:id==='walk-1'});const s=A.getState();s.antialias=3;
   if(id==='rim-grazing'){const f=SphereWorld.rimFrame(s);s.position=M.add(M.mul(f.point,s.radius-.5),M.mul(f.inland,-.8));s.forward=M.norm(M.add(M.add(f.tangent,M.mul(f.inland,.18)),M.mul(f.point,.08)));s.up=M.mul(f.point,-1);s.fov=78;}
   if(id==='shade-ride'){const frame=SphereSites.shadeSection(s);s.position=frame.world([-.3,.2,100.75]);}
   await R.prepare(s);const times=[];for(let j=0;j<6;j++){const start=performance.now();R.draw(s,1280,720);R.gl.finish();times.push(performance.now()-start);}const preview={...R.renderInfo,submissionMs:times.slice(2)};
   R.draw(s,3840,2160,{exportFrame:true});R.gl.finish();const start=performance.now();R.draw(s,3840,2160,{exportFrame:true});R.gl.finish();return {id,state:s,image:R.canvas.toDataURL('image/png'),info:R.renderInfo,preview,nativeCaptureMs:performance.now()-start,cacheMiB:SphereEdges.cacheVertexMiB,gl:R.error()};
  },id);fs.writeFileSync(path.join(dir,id+'.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;results.push(result);console.log(JSON.stringify({id,geometry:result.info.geometry,preview:result.preview.submissionMs,native:result.nativeCaptureMs,cacheMiB:result.cacheMiB,gl:result.gl}));
 }
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({results,errors},null,2));if(errors.length||results.some(r=>r.gl))throw Error('Capture verification failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
