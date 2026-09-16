const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),dir='work/wound-chunks';fs.mkdirSync(dir,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);
  console.log('Ready with real frame loop');
  const results=[];
  for(const [name,along,inland,height] of [['lip',-.1,.025,.045],['over-opening',-.1,-.1,.047],['return-to-lip',-.1,.025,.045]]){
   const result=await page.evaluate(async ({along,inland,height})=>{
    const M=SphereMath,W=SphereWorld,G=SphereGround,C=SphereCollection;
    const s={...M.defaultState(),collection:true,era:'after',playing:false,time:0,routeShades:false,starStation:false,siteId:'biome-5',siteRevision:2,siteElevation:0,provinceRevision:0,packAddress:null,geometryDetail:true,textureDetail:true,richMaterials:true,clouds:false,atmosphere:0,cavityHaze:0,exposure:.2,fov:80,antialias:3};
    const f=W.rimFrame(s,0,.7),point=M.mul(f.point,s.radius),up=M.mul(f.point,-1),at=(a,i,h)=>M.add(point,M.add(M.mul(f.tangent,a),M.add(M.mul(f.inland,i),M.mul(up,h))));
    s.siteAnchor=M.norm(at(0,.02,0));s.position=at(along,inland,height);s.forward=M.norm(M.sub(at(.6,-.12,.02),s.position));s.up=M.basis(s.forward,up).u;
    const status=await SphereJourney.visit(s,'Wound edge regression');
    const live=SphereApp.getState(),groups=G.neighbourhood(live);let bad=0,triangles=0,empty=0;
    for(const mesh of groups){empty+=mesh.count===0;for(let i=0;i<mesh.vertices.length;i+=33){if(mesh.vertices[i+9]<0)continue;const p=[0,0,0];for(const o of [0,11,22])for(let k=0;k<3;k++)p[k]+=mesh.vertices[i+o+k]/3;const intrusion=(1-C.woundDistance(M.norm(mesh.world(p)),C.wounds[0]))*C.wounds[0].width*s.radius;if(intrusion>.000001)bad++;triangles++;}}
    return {status:status.state,bad,triangles,empty,groups:groups.length,residency:G.info,gl:SphereApp.renderer.error()};
   },{along,inland,height});
   assert.equal(result.status,'arrived');assert.equal(result.groups,25);assert.equal(result.bad,0,'Worker terrain must not fill the Wound');assert(result.empty>0);assert(result.triangles>0);assert.equal(result.gl,0);
   await page.screenshot({path:dir+'/'+name+'.png'});results.push({name,...result});console.log('PASS',name,result.triangles,'terrain triangles,',result.empty,'empty sections');
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/verification.json',JSON.stringify({results,errors},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
