const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function unzip(bytes){const out={};let p=0;while(p+30<=bytes.length&&bytes.readUInt32LE(p)===0x04034b50){assert.equal(bytes.readUInt16LE(p+8),0);const size=bytes.readUInt32LE(p+18),n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28),name=bytes.subarray(p+30,p+30+n).toString(),start=p+30+n+extra;out[name]=bytes.subarray(start,start+size);p=start+size;}return out;}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true}),errors=[];page.setDefaultTimeout(180000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereSession);await page.evaluate(()=>SphereApp.setBusy(true));
  const dir=path.resolve(process.env.SPHERE_CAPTURE_DIR||'work/screenshots/next-leap');fs.mkdirSync(dir,{recursive:true});
  const arrivals=process.env.SPHERE_SKIP_ARRIVALS?[]:await page.evaluate(()=>{
   const A=SphereApp,M=SphereMath,W=SphereWorld,results=[];
   for(let index=0;index<6;index++)for(const kind of ['breach','edge','ground']){
    const s={...A.getState(),era:'after',multipleWounds:true,siteId:'',siteAnchor:null,shadeAttachment:null,geometryDetail:true},f=W.rimFrame(s,index,Math.PI/2),q=kind==='breach'?SphereCollection.wounds[index].axis:M.norm(M.add(f.point,M.mul(f.inland,(kind==='edge'?-300:300)/s.radius)));
    s.position=M.mul(q,s.radius+1000);s.forward=M.mul(q,-1);s.up=M.basis(s.forward).u;SphereSurface.resetReturn();A.setState(s);document.getElementById('seeSurface').click();const landed=A.getState(),near=W.nearestRim(M.norm(landed.position),s),title=document.getElementById('viewTitle').textContent;
    document.getElementById('browseBiomes').click();results.push({index,kind,title,near:near.index,altitude:s.radius-M.length(landed.position),solid:!M.inBreach(M.norm(landed.position),s),returnError:M.length(M.sub(A.getState().position,s.position))});
   }return results;
  });
  for(const r of arrivals){assert.equal(r.near,r.index);assert.equal(r.returnError,0);assert.equal(r.solid,r.kind==='ground');assert(r.altitude<10);if(r.kind==='breach')assert(r.title.includes('Breach spill'));if(r.kind==='ground')assert(Math.abs(r.altitude-3)<1e-6);}
  if(arrivals.length)console.log('PASS 18 UI arrivals and return views');
  const fixture=process.env.SPHERE_WATERSHED_CAPTURE?await page.evaluate(async()=>{const s=SphereWatershed.activate({...SphereMath.defaultState(),collection:true,era:'after'});await SphereWatershed.prepare(s);return SphereWatershed.view(s,'garden');}):JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/polish-scenes.json'),'utf8')).find(x=>x.id==='rim-air').state;
  const exports=[];
  for(const projection of ['perspective','panorama']){
   await page.evaluate(({state,projection})=>{SphereApp.setState({...state,projection});document.getElementById('exportSize').value='3840';}, {state:fixture,projection});
   const outputs=[];
   for(let i=0;i<2;i++){
    const download=page.waitForEvent('download');await page.evaluate(async()=>{SphereApp.setBusy(false);await SphereApp.capture();SphereApp.setBusy(true);});const file=await download;outputs.push(unzip(fs.readFileSync(await file.path())));
   }
   const same=outputs[0]['photograph.png'].equals(outputs[1]['photograph.png']);
   for(let i=0;i<(same?1:2);i++){fs.writeFileSync(path.join(dir,projection+'-'+i+'.png'),outputs[i]['photograph.png']);fs.writeFileSync(path.join(dir,projection+'-'+i+'.json'),outputs[i]['scene.json']);}
   const meta=JSON.parse(outputs[0]['scene.json']);if(process.env.SPHERE_WATERSHED_CAPTURE){assert.equal(meta.state.provinceRevision,1);assert.equal(meta.state.provinceSeed,713);assert.deepEqual(meta.state.provinceAnchor,fixture.provinceAnchor);}exports.push({projection,same,bytes:outputs[0]['photograph.png'].length,image:meta.image});if(!same)console.error(projection+' exports differ; diagnostic images and scenes retained');assert.equal(meta.image.width,3840);if(projection==='panorama')assert.equal(meta.image.render.panoramaFaces,6);
   console.log(same?'PASS':'FAIL','actual repeatable 4K',projection,'export');
  }
  const error=await page.evaluate(()=>SphereApp.renderer.error());fs.writeFileSync(path.join(dir,'arrivals-and-captures.json'),JSON.stringify({arrivals,exports,error,errors},null,2));assert.equal(error,0);assert.deepEqual(errors,[]);assert(exports.every(x=>x.same),'Capture repeatability failed; diagnostic images, scenes and report retained');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
