const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function unzip(bytes){const out={};let p=0;while(p+30<=bytes.length&&bytes.readUInt32LE(p)===0x04034b50){assert.equal(bytes.readUInt16LE(p+8),0);const size=bytes.readUInt32LE(p+18),n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28),name=bytes.subarray(p+30,p+30+n).toString(),start=p+30+n+extra;out[name]=bytes.subarray(start,start+size);p=start+size;}return out;}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[],dir=path.resolve('work/screenshots/travel');fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereSession&&window.SphereLanding);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Renderer ready');
  const playback=await page.evaluate(()=>{
   const A=SphereApp,$=id=>document.getElementById(id),checks=[],check=name=>checks.push({name,playing:A.getState().playing});
   check('launch');$('play').click();check('first play');
   for(const expected of [true,false]){
    if(A.getState().playing!==expected)$('consolePlay').click();
    for(const el of document.querySelectorAll('[data-destination]:not([data-destination=surface])')){el.click();check('destination '+el.dataset.destination);}
    for(const name of ['interior','breach','shade','dawn']){A.preset(name,{stage:true});check('staged '+name);}
    SphereEvolution.visit('biome-0');check('biome');SphereEvolution.visit('biome-0',{walk:true});check('walk');$('leaveWalk').click();check('leave walk');SphereEvolution.restore();check('return');
    $('resetTime').click();check('reset time');$('timeSlider').value='400';$('timeSlider').dispatchEvent(new Event('input'));check('scrub');
    $('consoleReset').click();check('console reset');$('consoleScrub').value='900';$('consoleScrub').dispatchEvent(new Event('input'));check('console scrub');
    $('bookmarkName').value='Playback test '+expected;$('saveBookmark').click();$('bookmarks').lastElementChild.querySelector('button').click();check('bookmark');
    A.setState({...A.getState(),playing:!expected});check('scene update');
    for(const item of checks.slice(checks.findIndex(v=>v.name==='staged interior')))if(!('expected'in item))item.expected=expected;
   }
   $('play').click();return checks;
  });
  assert.equal(playback[0].playing,false);assert.equal(playback[1].playing,true);for(const row of playback)if('expected'in row)assert.equal(row.playing,row.expected,row.name);
  const imported=await page.evaluate(()=>SphereMath.sceneRecord({...SphereApp.getState(),playing:false}));
  await page.locator('#sceneFile').setInputFiles({name:'playback-scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.waitForFunction(()=>document.getElementById('viewTitle').textContent==='Imported viewpoint');assert(await page.evaluate(()=>SphereApp.getState().playing),'Import must preserve the user play choice');
  console.log('PASS playback navigation, walking, return, bookmark, import and both time controls');
  const arrivals=await page.evaluate(()=>{
   const A=SphereApp,M=SphereMath,C=SphereCollection,W=SphereWorld,records=[];
   for(let index=0;index<6;index++)for(const edge of [false,true]){
    const s={...M.defaultState(),collection:true,routeShades:false},f=W.rimFrame(s,index),q=edge?M.norm(M.add(f.point,M.mul(f.inland,-3/s.radius))):C.wounds[index].axis;
    s.position=M.mul(q,s.radius-100);s.forward=q;s.up=M.basis(q).u;SphereSurface.resetReturn();A.setState(s);document.getElementById('seeSurface').click();const selected=A.getState();
    const hit=SphereSites.trace(selected.position,selected.forward,selected,M.trace);document.getElementById('browseBiomes').click();records.push({index,edge,id:selected.siteId,anchorError:M.length(M.sub(selected.siteAnchor,q)),playing:selected.playing,returned:M.length(M.sub(s.position,A.getState().position)),hit:hit.kind,distance:hit.distance});
   }return records;
  });
  for(const r of arrivals){assert(r.playing);assert.equal(r.returned,0);if(!r.edge){assert.equal(r.id,'exterior-0');assert.equal(r.hit,'Breach spill');assert(r.distance<100);assert(r.anchorError<1e-12);}else assert.equal(r.id,'rim');}console.log('PASS all six central spill and edge routes with play/return preserved');
  // Exercise the actual frame-loop keyboard path from province altitude.
  await page.evaluate(async()=>{const M=SphereMath,P=SphereWatershed,s=P.activate({...M.defaultState(),collection:true,routeShades:false,starStation:false});await P.prepare(s);const q=P.direction(0,0,s);s.position=M.mul(q,s.radius-1100);s.forward=q;s.up=M.basis(q).u;s.speed=10000;s.autoSpeed=false;SphereApp.setState(s);});
  await page.locator('#viewport').focus();await page.evaluate(()=>SphereApp.setBusy(false));await page.keyboard.down('w');await page.waitForFunction(()=>SphereApp.getState().walkMode);await page.keyboard.up('w');
  await page.waitForFunction(()=>{const s=SphereApp.getState(),mesh=SphereSites.site(s),hit=SphereLanding.probe(s,s.position,SphereMath.mul(mesh.basis[1],-1),.1);return Math.abs(hit.distance-.0017)<.00008;});
  await page.evaluate(()=>SphereApp.setBusy(true));
  const descent=await page.evaluate(()=>{const A=SphereApp,s=A.getState(),mesh=SphereSites.site(s),M=SphereMath,hit=SphereLanding.probe(s,s.position,M.mul(mesh.basis[1],-1),.1);return {state:s,support:hit.distance,address:SphereWatershed.local(s.siteAnchor,s),label:document.getElementById('fieldChipLabel').textContent,chip:!document.querySelector('.field-chip').hidden,autoWalk:document.getElementById('autoWalk').checked};});
  assert(descent.state.playing&&descent.state.walkSurface);assert.equal(descent.state.siteRevision,1);assert(Math.hypot(...descent.address)<.0001);assert(descent.chip&&descent.autoWalk);console.log('PASS live 1,100 km keyboard descent to the same address and visible walking support');
  async function render(name,kind){const record=await page.evaluate(async kind=>{const A=SphereApp,M=SphereMath,R=A.renderer;let s=A.getState();if(kind==='spill'){const q=SphereCollection.wounds[0].axis;s=SphereArrival.select({...M.defaultState(),collection:true,position:M.mul(q,s.radius-100),forward:q}).state;}else if(kind==='terrace'){s=SphereWatershed.view(SphereWatershed.activate({...M.defaultState(),collection:true}),'terrace');SphereLanding.enter(s,s.position);for(let i=0;i<180;i++)SphereSites.step(s,new Set(),1/60);}
   A.setState(s);s=A.getState();await R.prepare(s);let start=performance.now();do{R.draw(s,1600,900);await new Promise(r=>requestAnimationFrame(r));}while(R.needsFrame&&performance.now()-start<30000);return {png:R.canvas.toDataURL('image/png'),error:R.error(),state:s};},kind);fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(record.png.split(',')[1],'base64'));delete record.png;assert.equal(record.error,0);return record;}
  const walking=await render('watershed-on-foot','walking'),terrace=await render('garden-on-foot','terrace'),spill=await render('breach-spill','spill');
  // Verify a real photograph capture keeps live play status and saves the new
  // patch address/elevation in its portable scene record.
  await page.evaluate(s=>{SphereApp.setState(s);document.getElementById('exportSize').value='3840';},walking.state);
  const downloading=page.waitForEvent('download');await page.evaluate(async()=>{SphereApp.setBusy(false);await SphereApp.capture();SphereApp.setBusy(true);});const download=await downloading,files=unzip(fs.readFileSync(await download.path())),metadata=JSON.parse(files['scene.json']);
  assert(await page.evaluate(()=>SphereApp.getState().playing));assert.equal(metadata.state.siteRevision,1);assert.deepEqual(metadata.state.siteAnchor,walking.state.siteAnchor);assert.equal(metadata.image.width,3840);assert.equal(metadata.image.height,2160);fs.writeFileSync(path.join(dir,'walking-4k.png'),files['photograph.png']);fs.writeFileSync(path.join(dir,'walking-4k.json'),files['scene.json']);
  // A fresh launch still restores paused, including a saved walking patch.
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereSession);assert.equal(await page.evaluate(()=>SphereApp.getState().playing),false);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({playback,arrivals,descent,walking,terrace,spill,capture:metadata.image,errors},null,2));console.log('PASS rendered walking/garden/spill views, actual 4K capture preserves play, and paused fresh launch');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
