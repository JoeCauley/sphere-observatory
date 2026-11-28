'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{start}=require('./support/observatory-server.cjs'),{executable}=require('./support/biome-browser.cjs');
const {PNG}=require('playwright-core/lib/utilsBundle');
const root=path.resolve(__dirname,'..'),source=JSON.parse(fs.readFileSync(path.join(root,'packs/biome-library.json'))),out=process.env.SPHERE_FRONTAGE_OUTPUT;
const packs=['sun-fern','river-glass'],city=source.packs.find(p=>p.id==='sideways-city');
for(const id of packs)source.packs.push({...city,id,name:id,entry:'packs/'+id+'/1.0.0/index.html',
  border:{profile:'unrecognized-stone',exterior:'./frontage-marker.mjs'}});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sphere-frontage-')),store=path.join(dir,'atlas.json'),records=[],errors=[];
function doorPixels(image){
 const {data,width,height}=PNG.sync.read(image);let xSum=0,ySum=0,count=0;
 for(let y=Math.floor(height*.22);y<height*.78;y++)for(let x=Math.floor(width*.22);x<width*.78;x++){
   const i=4*(y*width+x);
   if(data[i]<50&&data[i+1]>58&&data[i+1]<130&&data[i+2]>195){xSum+=x;ySum+=y;count++;}
 }
 assert(count>=5,'The blue post must be visible through the station opening');
 const post=xSum/count,y=Math.round(ySum/count);
 function jamb(direction){
   let run=0;
   for(let x=Math.round(post);Math.abs(x-post)<width*.29;x+=direction){
     const i=4*(y*width+x),r=data[i],g=data[i+1],b=data[i+2];
     run=r>200&&g>70&&g<205&&b<100&&r>1.25*g?run+1:0;
     if(run===4)return x-3*direction;
   }throw Error('The amber jamb must frame the visible post');
 }
 return {post,jamb:(jamb(-1)+jamb(1))/2,pixels:count};
}
(async()=>{
 const host=await start({storePath:store}),browser=await chromium.launch({executablePath:executable(),headless:true});
 try{
  if(out)fs.mkdirSync(out,{recursive:true});
  for(let i=0;i<packs.length;i++){
   const ctx=await browser.newContext({viewport:{width:960,height:640}}),p=await ctx.newPage(),id=packs[i],seed=713+i;
   p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});p.setDefaultTimeout(180000);
   await p.route('**/packs/biome-library.json',r=>r.fulfill({json:source}));
   const packUrl='**/packs/'+id+'/1.0.0/';
   await p.route(packUrl+'index.html',r=>r.fulfill({contentType:'text/html',path:path.join(__dirname,'fixtures/frontage-pack.html')}));
   await p.route(packUrl+'frontage-marker.mjs',r=>r.fulfill({contentType:'text/javascript',path:path.join(__dirname,'fixtures/frontage-marker.mjs')}));
   async function load(){await p.goto(host.origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.SphereLoading?.ready&&document.querySelector('#sceneLoading')?.hidden&&window.SphereBiomeLibrary&&window.SphereStageFrame);
    await p.evaluate(async seed=>{const a=SphereApp;await Promise.all([SphereBiomeLibrary.ready,SphereStageFrame.ready]);a.setPlaying(false);
      a.setState({...a.getState(),radius:149597870.7,seed,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2,shadeGeometryRevision:3,collection:true,fov:75});
      await SphereBiomeLibrary.selectWorld();},seed);}
   await load();
   const address=await p.evaluate(async id=>{
    const L=SphereBiomeLibrary;await L.install('border-transport');
    const station=await L.commissionDistrict(['r13c51','r13c0'],'Fixture crossing');
    await L.placeRegion(id,{plotId:'r13c0',footprint:{shape:'rectangle',east:1,north:.71}});await L.install(id);return station.id;
   },id);
   async function open(){
    const v=await p.evaluate(async address=>{
     const L=SphereBiomeLibrary,T=SphereStageFrame,b=L.entry(address),s=(await T.stationExterior(b.transport.origin,true)).station;
     T.close();const local={eastM:s.routes[0].nearDoor[0],northM:-s.widthM/2+22,altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'};
     let progress;const timer=setInterval(()=>{const info=document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome?.inspect();
       if(info)progress={window:info.habitatWindow,pictures:info.farPictures,blocked:info.error,ground:SphereGround.info};},1000);
     let result;try{result=await T.open(address,{entry:{geographic:true,pose:local,horizontalFov:75}});}finally{clearInterval(timer);}
     const f=document.querySelector('#stageFrame iframe');
     if(!f)throw Error('Station failed to open '+JSON.stringify({result,progress})+' '+document.querySelector('#biomeArrivalRecovery')?.textContent);
     const api=f.contentWindow.SphereBiome,c=f.contentDocument.querySelector('canvas');
     if(api.inspect().habitatWindow?.pending){
       const start=performance.now();
       while(api.inspect().habitatWindow.pending && performance.now()-start<150000)await new Promise(r=>setTimeout(r,70));
     }
     if(api.inspect().habitatWindow.id && !api.inspect().habitatWindow.error)await new Promise(requestAnimationFrame);
     const face=T.stationFrontages(b.transport,s)[0],far=(await import('/packs/kit/border-frontage.mjs')).borderFrontage;
     const edge=(await import('/geographic-flight.js')).installedEdge(b.transport);
     const other=far(edge,0,.47*edge.lengthM,s.widthM/2+4,L.placed(),L.pack,(a,z)=>SphereWorld.sample(SphereWorld.direction(a,z,SphereApp.getState()),SphereApp.getState()));
     const rr=SphereApp.renderer;
     return {face,other:other.instanceId,address:api.inspect().station,window:api.inspect().habitatWindow,stream:{ground:SphereGround.info,
        geometry:!!rr.geometry,compiling:!!rr.geometryPreparation,uploads:rr.geometry?.work?.uploadedBytes,drawn:rr.geometry?.meshes?.size,visibility:document.visibilityState,controllers:rr.prepareControllers?.size},
        pixel:c.dataset.markerPixel,fixture:c.dataset.fixtureOwner,gl:c.getContext('webgl2').getError(),solids:JSON.stringify(s.routes)};
    },address);return v;
   }
   const live=await open();assert.equal(live.fixture,id);assert(live.window.draws>0);const rgb=live.pixel.split(',').map(Number);assert(rgb[2]>225&&rgb[0]<20);
   assert.equal(live.face.profile,'plain');assert.equal(live.other,null);
   const beforeImage=await p.locator('#viewport').screenshot(out?{path:path.join(out,id+'.png')}:{});
   const camera=async()=>p.evaluate(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose());
   const at=await camera();await p.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
   await p.keyboard.down('d');
   try{await p.waitForFunction(x=>Math.abs(document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().eastM-x)>.72,at.eastM);}
   finally{await p.keyboard.up('d');}
   const moved=await camera(),afterImage=await p.locator('#viewport').screenshot(out?{path:path.join(out,id+'-sidestep.png')}:{});
   const original=doorPixels(beforeImage),shifted=doorPixels(afterImage);
   const parallax={distanceM:Math.abs(moved.eastM-at.eastM),postPx:shifted.post-original.post,jambPx:shifted.jamb-original.jamb};
   assert(Math.abs(parallax.postPx)>.15&&Math.sign(parallax.jambPx)===Math.sign(parallax.postPx)&&
     Math.abs(parallax.jambPx)>Math.abs(parallax.postPx)+3,'The near jamb and the distant post must move by different amounts '+JSON.stringify(parallax));
   const late=await p.evaluate(async address=>{
     const T=SphereStageFrame,b=SphereBiomeLibrary.entry(address),station=(await T.stationExterior(b.transport.origin,true)).station;
     const pose={eastM:station.routes[0].nearDoor[0],northM:-station.widthM/2+95,altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'};
     T.close();await T.open(address,{entry:{geographic:true,pose,horizontalFov:75}});
     const f=document.querySelector('#stageFrame iframe'),api=f.contentWindow.SphereBiome,canvas=f.contentDocument.querySelector('canvas');
     const pause=()=>new Promise(r=>setTimeout(r,25)),at=performance.now();
     while(api.inspect().habitatWindow.mode!=='picture' && performance.now()-at<10000)await pause();
     const before=api.inspect().habitatWindow,eye=api.pose(),clock=SphereApp.sceneSeconds;
     canvas.completeFixturePost();
     while(api.inspect().habitatWindow.captures<=before.captures && performance.now()-at<12000)await pause();
     return {mode:before.mode,captures:api.inspect().habitatWindow.captures-before.captures,
       stable:JSON.stringify(eye)===JSON.stringify(api.pose())&&clock===SphereApp.sceneSeconds};
   },address);
   assert.deepEqual(late,{mode:'picture',captures:1,stable:true});
   const ground=await p.evaluate(async({id,address})=>{
     const T=SphereStageFrame,L=SphereBiomeLibrary,b=L.entry(address),s=(await T.stationExterior(b.transport.origin,true)).station;
     const geo=await import('/geographic-flight.js'),pose={eastM:s.routes[0].nearDoor[0],northM:-s.widthM/2-80,altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'};
     const w=geo.mainPose(SphereApp.getState(),b,pose,SphereAtlas,SphereWorld);
     T.close();const arrival=await T.open(id,{entry:{geographic:true,horizontalFov:75,pose:geo.packPose({...w,walkMode:true},L.entry(id),SphereAtlas,SphereWorld)}});
     const f=document.querySelector('#stageFrame iframe'),c=f?.contentDocument.querySelector('canvas');
     if(!f)throw Error('Fixture ground failed '+JSON.stringify(arrival)+' '+document.querySelector('#biomeArrivalRecovery')?.textContent);
     return {id:f?.dataset.locationId,pixel:c?.dataset.markerPixel,mode:f?.contentWindow.SphereBiome.pose().mode};
   },{id,address});
   assert.deepEqual(ground,{id,pixel:live.pixel,mode:'walk'},'Both camera owners see the same authored post');
   if(out)await p.locator('#viewport').screenshot({path:path.join(out,id+'-ground.png')});
   await p.evaluate(async id=>{SphereStageFrame.close();await SphereBiomeLibrary.remove(id);},id);
   const dormant=await open();assert.equal(dormant.face.instanceId,id);assert(!dormant.face.canEnterPack);assert.equal(dormant.face.exterior,null);
   await p.evaluate(async id=>{SphereStageFrame.close();const L=SphereBiomeLibrary,before=L.placed();
    const response=await fetch('/api/installed-biomes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:L.world.key,parameters:L.world.params,before,installed:before.filter(v=>v.id!==id)})});
    if(!response.ok)throw Error('Disposable placement removal '+response.status);},id);
   await load();const removed=await open();assert.equal(removed.face.instanceId,null);assert.equal(removed.window.id,'biome-'+removed.face.nativeBiome);
   assert(removed.window.draws>0&&!removed.window.error,'Native ground must replace the regional sill: '+JSON.stringify([removed.window,removed.stream]));
   assert.deepEqual([dormant.address,removed.address],[live.address,live.address]);assert(dormant.solids===live.solids&&removed.solids===live.solids);
   assert([live,dormant,removed].every(v=>v.gl===0));records.push({id,seed,live,parallax,late,ground,dormant,removed});
   if(out)fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(records,null,2));console.log('PASS',id,seed,live.address,live.pixel,removed.window.id);
   await ctx.close();
  }assert.deepEqual(errors,[]);
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
