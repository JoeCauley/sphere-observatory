const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],records=[],dir=path.resolve('work/screenshots/travel');fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereSession);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Renderer ready');
 for(const side of ['top','bottom']){
  await page.evaluate(side=>{const M=SphereMath,S=SphereSites,A=SphereApp,s={...M.defaultState(),shadeGeometryRevision:1,collection:true,routeShades:true,shadeShape:'cap',siteId:'shade-0',shadeAttachment:0,timeRate:60,speed:.1,autoSpeed:false};s.siteAnchor=SphereCollection.plates(s)[0].normal;const mesh=S.shadeSection(s);s.position=mesh.world([.3,side==='top'?.025:-.25,.1]);s.forward=M.mul(mesh.basis[1],side==='top'?-1:1);s.up=mesh.basis[2];A.setState(s);A.setPlaying(true);},side);
  await page.locator('#viewport').focus();await page.evaluate(()=>SphereApp.setBusy(false));await page.keyboard.down('w');
  await page.waitForFunction(()=>{const s=SphereApp.getState();return SphereFlight.contact(s,s.position,s.forward,.001).distance<.00001;});
  await page.keyboard.up('w');await page.evaluate(()=>SphereApp.setBusy(true));
  const result=await page.evaluate(async side=>{const A=SphereApp,S=SphereSites,M=SphereMath,R=A.renderer,s=A.getState(),mesh=S.shadeSection(s),local=mesh.local(s.position);await R.prepare(s);
   const direct=SphereFlight.contact(s,s.position,s.forward,.001);
   const pose={...s,forward:M.norm(M.sub(mesh.world(side==='top'?[-.25,-.03,.5]:[0,-.04,.5]),s.position))};pose.up=M.basis(pose.forward,side==='top'?mesh.basis[1]:M.mul(mesh.basis[1],-1)).u;
   R.draw(pose,1600,900,{exportFrame:true});return {side,local,time:s.time,playing:s.playing,attachment:s.shadeAttachment,contact:direct.kind,contactDistance:direct.distance,render:R.renderInfo,gl:R.error(),image:R.canvas.toDataURL('image/png')};},side);
  fs.writeFileSync(path.join(dir,'shade-'+side+'.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;assert(result.playing);assert(result.time>0);assert.equal(result.attachment,0);assert.equal(result.gl,0);
  assert(result.contactDistance<.00001);assert.equal(result.contact,'Shade \u00b7 exposed service structure');
  if(side==='top'){assert(result.local[1]>=.01399&&result.local[1]<=.01401,'The raised deck must stop the eye before the basic Shade skin');}else assert(result.local[1]<-.13,'The lower face must remain solid');
  records.push(result);console.log('PASS moving Shade '+side,result.local,result.contact);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'shade-verification.json'),JSON.stringify({records,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
