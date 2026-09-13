const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],dir=path.resolve('work/screenshots/weather-depth');fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Weather depth renderer ready');
 const beforeFiles=['volume-before.js','atmosphere-before.js'].map(name=>path.join(dir,name));
 const before=beforeFiles.every(p=>fs.existsSync(p))?beforeFiles.map(p=>fs.readFileSync(p,'utf8')):null;
 const report=await page.evaluate(async before=>{
  const M=SphereMath,R=SphereApp.renderer,base={...M.defaultState(),collection:true,geometryDetail:false,textureDetail:false,time:4882600,antialias:3,atmosphere:1,weatherStrength:1,exposure:1.5,cavityHaze:.28},q=SphereWorld.locateBiome(8,base),up=M.mul(q,-1),heading=M.basis(up).r;
  function pose(altitude){const forward=M.norm(M.add(heading,M.mul(up,.55)));return {...base,position:M.mul(q,base.radius-altitude),forward,up:M.basis(forward,up).u};}
  function capture(s,width=1440,height=900){R.draw(s,width,height,{exportFrame:true});const gl=R.gl,v=R.weather,pixels=new Float32Array(v.vw*v.vh*4);gl.bindFramebuffer(gl.FRAMEBUFFER,v.volumeFbo);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,v.vw,v.vh,gl.RGBA,gl.FLOAT,pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,null);let opacity=0,opaque=0;for(let i=0;i<pixels.length;i+=4){const a=1-(pixels[i]+pixels[i+1]+pixels[i+2])/3;opacity+=a;opaque+=a>.7?1:0;}return {pixels,image:R.canvas.toDataURL(),opacity:opacity/(pixels.length/4),opaque:opaque/(pixels.length/4),error:R.error()};}
  const images=[],stats=[],s=pose(3712000);await R.prepare(s);const currentVolume=SphereVolume,currentClass=SphereAtmosphere,currentProfiles=SphereWeatherProfiles,currentWeather=R.weather;
  if(before){try{(0,eval)(before[0]);(0,eval)(before[1]);R.weather=new SphereAtmosphere(R.gl);const previous=capture(s);images.push({name:'before-cavity.png',image:previous.image});stats.push({name:'before-cavity',opacity:previous.opacity,opaque:previous.opaque});R.weather.dispose();}finally{window.SphereVolume=currentVolume;window.SphereAtmosphere=currentClass;window.SphereWeatherProfiles=currentProfiles;R.weather=currentWeather;}}
  for(const altitude of [256267,3712000,29483000,70000000]){const c=capture(pose(altitude));images.push({name:'after-'+altitude+'.png',image:c.image});stats.push({altitude,opacity:c.opacity,opaque:c.opaque,error:c.error});}
  // Isolate the cloud field from moving Shade shadows and separately controlled
  // cavity dust. Repeated photographs at the same clock must be identical.
  const still={...s,routeShades:false,starStation:false,cavityHaze:0};const a=capture(still,1200,800),b=capture(still,1200,800),next=capture({...still,time:still.time+1},1200,800),later=capture({...still,time:still.time+7200},1200,800);
  function difference(x,y){let max=0,total=0;for(let i=0;i<x.length;i+=4){const d=Math.abs(x[i]-y[i]);max=Math.max(max,d);total+=d;}return {max,mean:total/(x.length/4)};}
  const frozen=difference(a.pixels,b.pixels),oneSecond=difference(a.pixels,next.pixels),twoHours=difference(a.pixels,later.pixels);images.push({name:'evolution-start.png',image:a.image},{name:'evolution-two-hours.png',image:later.image});
  // Compare the same one-million-kilometre footprint at three receiver distances.
  // Fixed physical wavelengths stay registered; opacity should recede with range.
  const fades=[];
  for(const distance of [3000000,30000000,120000000]){const st={...still,position:M.mul(q,base.radius-distance),forward:q,up:heading,fov:Math.atan(500000/distance)*360/Math.PI};const c=capture(st,1000,700);fades.push({distance,opacity:c.opacity});images.push({name:'fixed-footprint-'+distance+'.png',image:c.image});}
  // Separate diagnostic passes prove that every layer contributes to the image,
  // and allow the upper veil and lower banks to be inspected independently.
  const original=R.weather.farProgram,layers=[];
  for(let layer=0;layer<3;layer++){const shader=SphereVolume.far.replace('int layer=height>high?2-pass:pass;',`int layer=height>high?2-pass:pass;if(layer!=${layer})continue;`).replace(/vec3 airTrans=exp\([^;]+;/,'vec3 airTrans=vec3(1.);');R.weather.farProgram=SphereGLProgram(R.gl,SphereShaders.vertex,shader);const c=capture({...still,position:M.mul(q,base.radius-2000000),forward:q,up:heading,fov:90},1000,700);layers.push({layer,opacity:c.opacity,error:c.error});images.push({name:'layer-'+layer+'.png',image:c.image});R.gl.deleteProgram(R.weather.farProgram.p);}
  // Check world registration across the CPU phase wrap at the cavity centre.
  // Every physical octave and each independent mask must survive origin rebasing.
  const gl=R.gl,audit=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.far.replace('uniform vec3 macroPhase','uniform vec3 auditPoint;uniform vec3 macroPhase').replace('scattering=vec4(light,1.);transmission=vec4(tr,depth);','scattering=vec4(weatherField(auditPoint,10000.,0,.7).x,weatherField(auditPoint,10000.,1,.7).x,weatherField(auditPoint,10000.,2,.7).x,1.);transmission=vec4(tr,depth);'));
  R.weather.farProgram=audit;const seams=[];
  for(const target of [M.mul(q,base.radius),[73000000,-38000000,102000000],[-61000000,118000000,-45000000]]){const samples=[];
   for(const x of [-1,1]){const position=[x,20,30];gl.useProgram(audit.p);gl.uniform3fv(audit.u.auditPoint,M.sub(target,position));R.draw({...still,position},400,280,{exportFrame:true});const pixel=new Float32Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,R.weather.volumeFbo);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(100,70,1,1,gl.RGBA,gl.FLOAT,pixel);gl.bindFramebuffer(gl.FRAMEBUFFER,null);samples.push([...pixel]);}
   seams.push(Math.max(...samples[0].slice(0,3).map((x,i)=>Math.abs(x-samples[1][i]))));
  }
  gl.deleteProgram(audit.p);R.weather.farProgram=original;const final=capture(s),timings=[];
  for(let frame=0;frame<32;frame++){R.draw(s,1440,900,{exportFrame:false});await new Promise(requestAnimationFrame);R.pollTimers();if(frame>=12&&R.gpuMs!==null)timings.push(R.gpuMs);}
  timings.sort((a,b)=>a-b);const performance={gpuMedianMs:timings[Math.floor(timings.length*.5)]??null,gpu95Ms:timings[Math.floor(timings.length*.95)]??null,weatherPixels:R.weather.vw*R.weather.vh,device:R.device};
  R.draw(s,3840,2160,{exportFrame:true});images.push({name:'layered-4k.png',image:R.canvas.toDataURL()});
  const panoramic={...s,projection:'panorama'};await R.prepare(panoramic);R.draw(panoramic,2048,1024,{exportFrame:true});const panoramaA=R.canvas.toDataURL();R.draw(panoramic,2048,1024,{exportFrame:true});const panoramaFrozen=panoramaA===R.canvas.toDataURL();images.push({name:'layered-panorama.png',image:panoramaA});
  return {images,stats,frozen,oneSecond,twoHours,fades,layers,seams,performance,panoramaFrozen,error:R.error()||final.error};
 },before);
 for(const {name,image}of report.images)fs.writeFileSync(path.join(dir,name),Buffer.from(image.split(',')[1],'base64'));delete report.images;fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify(report));
 assert.equal(report.error,0);assert(report.stats.every(s=>!s.error));assert.deepEqual(report.frozen,{max:0,mean:0},'Paused weather must be deterministic');assert(report.oneSecond.mean<.001,'Mask evolution must move gently');assert(report.twoHours.mean>report.oneSecond.mean*5,'The masks must evolve with the saved scene clock');assert(report.fades[2].opacity<report.fades[0].opacity*.8,'The same weather footprint must fade with viewing distance');assert(report.layers.every(l=>l.error===0&&l.opacity>.001),'All three cloud layers must contribute independently');assert(report.seams.every(d=>d<.002),'Rebasing must preserve every layer');assert(report.panoramaFrozen,'Paused panoramas must remain identical across all six faces');assert(report.performance.weatherPixels<=1280*720,'Added layers must respect the existing preview budget');assert.deepEqual(errors,[]);console.log('PASS layered weather, distance recession, subtle clock motion, phase rebasing, 4K photographs and frozen panoramas');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
