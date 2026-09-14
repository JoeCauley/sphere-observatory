const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],dir=path.resolve('work/screenshots/wound-ground');fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
 // Hold the actual worker script while inspecting the cold, sealed rim ends.
 let releaseWorker;const workerGate=new Promise(r=>releaseWorker=r);await page.route('**/edge-worker.js',async route=>{await workerGate;await route.continue();});
 await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Wound ground renderer ready');
 if(process.env.SPHERE_TEST_NO_SHADOWS)await page.evaluate(()=>{const original=SphereApp.renderer.localShadows.prepare;SphereApp.renderer.localShadows.prepare=function(s,...args){return original.call(this,{...s,localShadows:0},...args);};});const records=[];
 for(const view of ['machine-edge','varied-edge','ground-along','below-lip','tip','weather']){
  const result=await page.evaluate(async view=>{
   const M=SphereMath,W=SphereWorld,S=SphereSites,E=SphereEdges,R=SphereApp.renderer,id=view==='machine-edge'?5:2,t=view==='tip'?0:.7;
   const s={...M.defaultState(),collection:true,era:'after',playing:false,time:0,routeShades:false,starStation:false,siteId:'biome-'+id,siteRevision:1,siteElevation:0,provinceRevision:0,packAddress:null,geometryDetail:true,textureDetail:true,richMaterials:true,clouds:view==='weather',atmosphere:view==='weather'?1:0,cavityHaze:0,exposure:1.5,fov:76,antialias:3};
   const f=W.rimFrame(s,0,t),point=M.mul(f.point,s.radius),up=M.mul(f.point,-1),at=(along,inland,height)=>M.add(point,M.add(M.mul(f.tangent,along),M.add(M.mul(f.inland,inland),M.mul(up,height))));
   s.siteAnchor=M.norm(at(0,.02,0));s.position=at(-.15,-.10,.08);
   let target=at(.20,.035,.010);if(view==='ground-along'){s.position=at(-.10,.025,.045);target=at(.3,.01,.025);}if(view==='below-lip'){s.position=at(-.12,-.14,-.055);target=at(.1,0,.008);}
   s.forward=M.norm(M.sub(target,s.position));s.up=M.basis(s.forward,up).u;await R.prepare(s);E.setView(1600);const mesh=S.site(s),rim=mesh.ground.rim;
   R.draw(s,1600,900);const cold={stream:SphereEdgeStreaming.info,groups:S.geometry(s).map(m=>m.name),cut:E.rimCut(s),gl:R.error()};
   // The local terrain/wall and coarse end profiles must already be visible.
   const endNeighbours=SphereEdgeStreaming.geometry(s).filter(m=>m.name.startsWith('Wound')&&rim.ends.some(e=>e.profile.every(p=>{const key=p.map(Math.fround).join(',');for(let i=0;i<m.vertices.length;i+=11)if(Array.from(m.vertices.slice(i,i+3)).join(',')===key)return true;return false;})));
   cold.sealedEnds=endNeighbours.length;
   const snapshot=()=>({analytic:Object.fromEntries(Object.entries(R.uniforms).map(([k,u])=>{const v=R.gl.getUniform(R.program,u);return [k,ArrayBuffer.isView(v)?[...v]:v];})),assets:Object.fromEntries(['biomes','heroes','worldTextures','woundTextures'].map(k=>[k,{status:R[k].status.slice(),pending:R[k].pending?.length,ready:[...(R[k].ready?.length?R[k].ready:[])]}])),shadowKey:R.localShadows.key,shadow:R.localShadows.info,uniforms:Object.fromEntries(Object.entries(R.geometry.main.u).map(([k,u])=>{const v=R.gl.getUniform(R.geometry.main.p,u);return [k,ArrayBuffer.isView(v)?[...v]:v];}))});const snapshots=[];const images={};R.draw(s,1600,900,{exportFrame:true});images.view=R.canvas.toDataURL();snapshots.push(snapshot());R.draw(s,1600,900,{exportFrame:true});images.repeat=R.canvas.toDataURL();snapshots.push(snapshot());
   let photo=null,panorama=null;if(view==='varied-edge'){
    R.draw(s,3840,2160,{exportFrame:true});const a=R.canvas.toDataURL();R.draw(s,3840,2160,{exportFrame:true});photo={equal:a===R.canvas.toDataURL(),image:a};
    const panoramic={...s,projection:'panorama'};R.draw(panoramic,1920,960,{exportFrame:true});const b=R.canvas.toDataURL();R.draw(panoramic,1920,960,{exportFrame:true});panorama={equal:b===R.canvas.toDataURL(),image:b};
   }
   window.woundGroundScene=s;return {view,state:s,cold,seamSegments:rim.segments.length,snapshots,heightRange:Math.max(...rim.segments.flatMap(e=>[e.a[1],e.b[1]]))-Math.min(...rim.segments.flatMap(e=>[e.a[1],e.b[1]])),images,photo,panorama,gl:R.error()};
  },view);
  assert.equal(result.gl,0);assert.equal(result.cold.gl,0);assert(result.cold.groups.includes('Wound · terrain-matched lip'));assert(result.cold.sealedEnds>=2,'Cold worker delay cannot leave open end profiles');result.repeatEqual=result.images.view===result.images.repeat;
  if(!result.repeatEqual){
   for(const [name,url]of Object.entries(result.images))fs.writeFileSync(path.join(dir,view+'-mismatch-'+name+'.png'),Buffer.from(url.split(',')[1],'base64'));
   result.difference=await page.evaluate(async urls=>{const pixels=[];for(const url of urls){const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const context=canvas.getContext('2d');context.drawImage(img,0,0);pixels.push(context.getImageData(0,0,img.width,img.height).data);}let changed=0,max=0,total=0;for(let i=0;i<pixels[0].length;i+=4){let different=false;for(let j=0;j<3;j++){const d=Math.abs(pixels[0][i+j]-pixels[1][i+j]);different||=d>0;max=Math.max(max,d);total+=d;}changed+=different?1:0;}return {changedPixels:changed,maxChannelDelta:max,totalChannelDelta:total};},Object.values(result.images));
   console.log('Capture mismatch retained',view,result.difference);
  }
  fs.writeFileSync(path.join(dir,view+'.png'),Buffer.from(result.images.view.split(',')[1],'base64'));delete result.images;
  for(const kind of ['photo','panorama'])if(result[kind]){assert(result[kind].equal,kind+' must be identical across paired exports');fs.writeFileSync(path.join(dir,view+'-'+kind+'.png'),Buffer.from(result[kind].image.split(',')[1],'base64'));delete result[kind].image;}
  records.push(result);console.log((result.repeatEqual?'PASS ':'MISMATCH ')+view+'; '+result.seamSegments+' joined segments; cold ends '+result.cold.sealedEnds);
 }
 releaseWorker();
 const warm=await page.evaluate(async()=>{const R=SphereApp.renderer,s=window.woundGroundScene,start=performance.now(),samples=[];while(performance.now()-start<90000){R.draw(s,1280,720);samples.push(SphereEdgeStreaming.info);if(!SphereEdgeStreaming.needsFrame)break;await new Promise(r=>setTimeout(r,16));}return {info:SphereEdgeStreaming.info,samples,gl:R.error()};});
 assert.equal(warm.gl,0);assert(!warm.info.failed);assert.equal(warm.info.queue,0,'The real worker must finish the cut rim plan');assert.equal(warm.info.ready,0);
 const transition=await page.evaluate(()=>{const s=window.woundGroundScene,M=SphereMath,E=SphereEdges,S=SphereSites,R=SphereApp.renderer,cut=E.rimCut(s),departed={...s,position:M.mul(s.siteAnchor,s.radius-S.localRange(s)-1)};R.draw(departed,1280,720);const restored=SphereEdgeStreaming.geometry(departed),filled=restored.some(m=>m.rim&&cut.cuts.some(([a,b])=>m.rim.a<=a&&m.rim.b>=b));const absent=E.rimCut(departed)===null&&!S.geometry(departed).some(m=>m.name==='Wound · terrain-matched lip');R.draw(s,1280,720);return {filled,absent,returned:S.geometry(s).some(m=>m.name==='Wound · terrain-matched lip'),gl:R.error()};});
 assert(transition.filled&&transition.absent&&transition.returned,'Departure and return exchange complete rim coverage in one frame');assert.equal(transition.gl,0);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({records,warm,transition,errors},null,2));assert(records.every(r=>r.repeatEqual),'Paused capture mismatch: image pairs, state and pixel difference retained in work/screenshots/wound-ground');console.log('PASS actual worker completion, departure/return, paired 4K/photo and panorama, six visual fixtures, no page/WebGL errors');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
