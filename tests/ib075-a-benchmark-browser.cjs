const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const {executable}=require('../tools/playwright-browser.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','meadow-benchmark-v1.json'),'utf8'));

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER||executable()});
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
 const pageErrors=[],consoleErrors=[],timeout=Number(process.env.IB075A_TIMEOUT_MS||120000);page.setDefaultTimeout(timeout);
 page.on('pageerror',error=>pageErrors.push(String(error.message||error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 try{
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereApp&&window.SpherePacks&&window.SphereMeadowBenchmark&&window.SphereLoading,{timeout});
  const report=await page.evaluate(async fixture=>{
   const A=SphereApp,B=SphereMeadowBenchmark,R=A.renderer,W=fixture.settings.viewport[0],H=fixture.settings.viewport[1];window.spherePreviewSuspended=true;B.fixtureValid(fixture);
   const base=SpherePacks.activate({...A.getState(),layoutVersion:2,collection:true,era:'after',time:fixture.settings.sceneTime,placeScene:fixture.settings.placeScene,placeWeather:fixture.settings.placeWeather,fov:fixture.settings.horizontalFov,quality:fixture.settings.quality,clouds:false,antialias:0,richMaterials:true,localShadows:1,geometryDetail:true});
   if(JSON.stringify(base.packAddress)!==JSON.stringify(fixture.location.packAddress))throw Error('Saved pack anchor differs from the frozen benchmark');
   const make=(pose,meadow=fixture.settings.meadow)=>({...base,position:pose.position,forward:pose.forward,up:pose.up,time:fixture.settings.sceneTime,fov:fixture.settings.horizontalFov,viewMode:'objectid',meadow:{...meadow,diagnostic:'grass-id'}});
   const read=state=>{R.draw(state,W,H);const gl=R.gl,rgba=new Uint8Array(W*H*4),depth=new Uint32Array(W*H);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,rgba);gl.readPixels(0,0,W,H,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,depth);if(gl.getError())depth.fill(1);return {rgba,depth,width:W,height:H};};
   // This is a fixed named-location diagnostic baseline, not a candidate B1 scene.
   const normal=make(fixture.poses.normal);A.setState(normal);A.setPlaying(true);if(!A.getState().playing)throw Error('The actual playback control did not set playing');
   for(let i=0;i<24&&R.needsFrame;i++){await new Promise(resolve=>setTimeout(resolve,25));R.draw({...normal,playing:true},W,H);}
   const normalCapture=read({...normal,playing:true}),canopy=B.assessCapture(normalCapture,fixture.mask);
   const farOnly=read(make(fixture.poses.normal,{...fixture.settings.meadow,nearRange:.001,middleRange:.002,farRange:2.8,worker:false}));
   const farOnlyAssessment=B.assessCapture(farOnly,fixture.mask);
   // A small renderer-only blade fixture proves the grass-ID mask detects a
   // frozen phase in real pixels. It is deliberately separate from the named
   // location baseline and cannot qualify as an arrival or canopy success.
   const frame=SphereGrass.frameForState(normal),prototype=SphereGrass.grassPrototypes()[0],instances=[];
   for(let z=0;z<8;z++)for(let x=0;x<8;x++){const index=z*8+x;instances.push(SphereInstancedEnvironment.createInstance({prototypeId:prototype.id,origin:[(x-3.5)*.00045,0,-.004-z*.00045],quaternion:[0,0,0,1],scale:.003,colour:[.3,.58,.22,1],phase:index/64,seed:17+index,addressKey:'ib075-a-frozen-control:'+index,boundsRadius:.004}));}
   const cameraLocal=frame.basis.map(axis=>SphereMath.dot(SphereMath.sub(normal.position,frame.origin),axis)),population={prototypes:[prototype],patches:[SphereInstancedEnvironment.createPatch({id:'ib075-a-frozen-control',center:[0,0,-.006],radius:.006,instances})],coordinateSpace:'relative',cameraLocal,frameBasis:frame.basis,windTime:fixture.settings.sceneTime,windStrength:.38,diagnostic:'grass-id'};
   const control={...normal,instancedEnvironment:{population},meadow:null};const frozenA=read({...control,playing:true,time:fixture.settings.sceneTime}),frozenB=read({...control,playing:true,time:fixture.settings.sceneTime+3,placeScene:'darkness'}),frozen=B.assessWind(frozenA,frozenB,fixture.mask);
   const liveA=read({...control,playing:true,time:fixture.settings.sceneTime,instancedEnvironment:{population:{...population,windTime:fixture.settings.sceneTime}}}),liveB=read({...control,playing:true,time:fixture.settings.sceneTime+3,instancedEnvironment:{population:{...population,windTime:fixture.settings.sceneTime+3}}}),live=B.assessWind(liveA,liveB,fixture.mask);
   return {implementation:'pass',numerical:'pass',visual:'fail',performance:'pending',export:'pending',acceptedBy:null,fixture:fixture.id,build:window.SphereBuild,hardware:{renderer:R.device,userAgent:navigator.userAgent},settings:{viewport:[W,H],fov:normal.fov,sceneTime:normal.time,packAddress:base.packAddress},controls:{canopy,farOnly:{...farOnlyAssessment,controlReason:'far-only-or-empty-foreground'},frozen,live},expectedFailures:fixture.expectedBaselineFailures,webglError:R.error()};
  },fixture);
  assert.equal(report.settings.fov,80);assert.equal(report.settings.viewport.join('x'),'1920x1080');
  assert.equal(report.canopy,undefined);assert.equal(report.controls.canopy.passesCanopy,false,'the preserved baseline must not pass canopy acceptance');
  assert.equal(report.controls.farOnly.passesCanopy,false,'far-only material must not pass foreground canopy acceptance');
  assert.equal(report.controls.frozen.passesWind,false,'a constant wind phase must fail even if time and scene lighting change');
  assert.equal(report.controls.live.passesWind,true,'the grass-only diagnostic must detect a real moving phase: '+JSON.stringify(report.controls.live));
  assert.equal(report.webglError,0);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);
  const result={status:'EXPECTED_FAILURES_RECORDED',...report,pageErrors,consoleErrors};const output=path.resolve('work','screenshots','ib075-a');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'baseline.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,fixture:result.fixture,canopy:result.controls.canopy.reason,farOnly:result.controls.farOnly.reason,frozen:result.controls.frozen.reason,live:result.controls.live.reason,report:path.join(output,'baseline.json')}));
 }catch(error){console.error(error);process.exitCode=1;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
