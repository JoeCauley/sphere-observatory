const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereSession);await page.evaluate(()=>SphereApp.setBusy(true));
  const dir=path.resolve(process.env.SPHERE_ARRIVAL_BIOMES?'work/screenshots/arrival-biomes':'work/screenshots/arrival-fix');fs.mkdirSync(dir,{recursive:true});const records=[];
  for(const index of (process.env.SPHERE_ARRIVAL_BIOMES?[1,4]:[0,1,2,3,4,5]))for(const kind of ['breach','edge']){
   const result=await page.evaluate(async({index,kind})=>{
    const A=SphereApp,M=SphereMath,W=SphereWorld,R=A.renderer,s={...M.defaultState(),collection:true,era:'after'},f=W.rimFrame(s,index,index===1||index===4?0:Math.PI/2);
    const q=kind==='breach'?SphereCollection.wounds[index].axis:M.norm(M.add(f.point,M.mul(f.inland,-50000/s.radius)));
    s.position=M.mul(q,s.radius*.75);s.forward=q;s.up=M.basis(q).u;SphereSurface.resetReturn();A.setState(s);document.getElementById('seeSurface').click();const arrival=A.getState();
    await R.prepare(arrival);const start=performance.now();do{R.draw(arrival,1600,900);await new Promise(r=>requestAnimationFrame(r));}while(R.needsFrame&&performance.now()-start<30000);
    const hit=SphereSites.trace(arrival.position,arrival.forward,arrival,M.trace),near=W.nearestRim(M.norm(arrival.position),s);
    const preview=R.canvas.toDataURL('image/png');R.draw(arrival,1600,900,{exportFrame:true});const exported=R.canvas.toDataURL('image/png');
    document.getElementById('browseBiomes').click();return {index,kind,arrival,title:kind,altitude:s.radius-M.length(arrival.position),nearestIndex:near.index,rimDistance:near.distance,adjoiningBiome:W.sample(arrival.siteAnchor,arrival).id,hit:{kind:hit.kind,distance:hit.distance},returned:M.length(M.sub(A.getState().position,s.position)),preview,exported,gl:R.error(),stream:SphereEdges.streaming.info};
   },{index,kind});
   for(const name of ['preview','exported']){fs.writeFileSync(path.join(dir,`${index}-${kind}-${name}.png`),Buffer.from(result[name].split(',')[1],'base64'));delete result[name];}
   records.push(result);console.log(index,kind,result.altitude,result.hit);assert.equal(result.nearestIndex,index);if(kind==='breach'){assert(Math.abs(result.altitude+2500)<.00001);assert.equal(result.hit.kind,'Breach spill');assert(result.hit.distance<100);}else{assert(result.altitude>0&&result.altitude<10&&result.rimDistance<20);assert(result.hit.distance<30,'The crosshair must frame nearby structure, not empty space');}assert.equal(result.returned,0);assert.equal(result.gl,0);assert.equal(result.stream.queue,0);
  }
  fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({records,errors},null,2));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
