const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],dir=path.resolve('work/screenshots/ground-material');fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(240000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Ground material renderer ready');const cases=[];
 for(const id of [3,2,5,4])for(const revision of [1,2]){
  const result=await page.evaluate(async({id,revision})=>{
   const M=SphereMath,S=SphereSites,W=SphereWorld,R=SphereApp.renderer,gl=R.gl,s={...M.defaultState(),collection:true,era:'after',routeShades:false,starStation:false,multipleWounds:false,clouds:false,atmosphere:0,cavityHaze:0,antialias:0,localShadows:0,packAddress:null,siteId:'biome-'+id,siteRevision:revision,siteElevation:0,biome:-1};
   s.siteAnchor=W.locateBiome(id,s);s.terrainAnchor=revision===2?s.siteAnchor:null;s.position=M.mul(s.siteAnchor,s.radius-.9);s.forward=s.siteAnchor;s.up=S.shellFrame(s.siteAnchor)[2];s.fov=110;
   await R.prepare(s);R.draw(s,1000,750,{exportFrame:true});const u=R.geometry.main.u,original=gl.uniform1i;
   const draw=()=>{R.draw(s,1000,750,{exportFrame:true});gl.finish();return R.canvas.toDataURL();};
   // Replay the three actual unset defaults in the old mesh program without
   // changing shader source, texture bytes, geometry, camera or lighting.
   gl.uniform1i=function(location,value){if([u.uBiomeOverride,u.uAfter,u.uManyWounds].includes(location)&&location!=null)value=0;return original.call(gl,location,value);};
   let before;try{before=draw();}finally{gl.uniform1i=original;}
   const after=draw(),bindings={biome:gl.getUniform(R.geometry.main.p,u.uBiomeOverride),after:gl.getUniform(R.geometry.main.p,u.uAfter),manyWounds:gl.getUniform(R.geometry.main.p,u.uManyWounds)};
   // Probe the actual mesh program after alternating override and era states.
   const transitions=[];for(const [biome,era,multipleWounds] of [[id,'after',true],[-1,'before',false],[-1,'after',true]]){const next={...s,biome,era,multipleWounds};await R.prepare(next);R.draw(next,1000,750,{exportFrame:true});transitions.push({biome:gl.getUniform(R.geometry.main.p,u.uBiomeOverride),after:gl.getUniform(R.geometry.main.p,u.uAfter),manyWounds:gl.getUniform(R.geometry.main.p,u.uManyWounds)});}
   return {id,revision,before,after,bindings,transitions,scene:M.sceneRecord(s),gl:R.error()};
  },{id,revision});
  for(const key of ['before','after']){fs.writeFileSync(path.join(dir,`${id}-r${revision}-${key}.png`),Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
  fs.writeFileSync(path.join(dir,`${id}-r${revision}-scene.json`),JSON.stringify(result.scene,null,2));delete result.scene;cases.push(result);assert.equal(result.gl,0);assert.deepEqual(result.bindings,{biome:-1,after:1,manyWounds:0});assert.deepEqual(result.transitions,[{biome:id,after:1,manyWounds:1},{biome:-1,after:0,manyWounds:0},{biome:-1,after:1,manyWounds:1}]);console.log('PASS correct mesh material bindings',id,revision);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({status:'PASS',cases,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
