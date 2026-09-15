// Compose gallery scenes with the current app's destinations and renderer.
// The hero restores the reference photograph's exact camera and world staging.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'examples/observatory');
const shots=[
 ['hero','The Sphere from the polar court'],
 ['ultra-desert','Ultra Desert'],['winter-hell','Winter Hell'],
 ['watershed-40000','Connected catchments · 40,000 km'],
 ['watershed-10000','Receiving reaches · 10,000 km'],
 ['watershed-1100','The province · 1,100 km'],
 ['watershed-48','River country · 48 km'],
 ['watershed-1','The water garden · 1 km'],
 ['terrace','The open terrace · 6 m above its floor'],
 ['lake','The receiving lake'],['reach','The quiet reach'],['meadow','The open meadow'],
 ['shade-intact','The finished Shade perimeter'],['shade-broken','The broken Shade edge'],
 ['wound','At the edge of a world'],['interior','The stellar conservatory'],['clouds','Above the Super Jungle']
];
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));
  const reference=JSON.parse(fs.readFileSync(path.join(root,'examples/archive/v1.4/polar-station.json')));
  for(const [id,title] of shots){
   const result=await page.evaluate(async({id,title,reference})=>{
    const A=SphereApp,M=SphereMath,R=A.renderer,P=SphereWatershed;
    let s={...M.defaultState(),collection:true,era:'after',playing:false,shadeGeometryRevision:3};
    if(id==='hero')s={...M.validate(reference.state),shadeGeometryRevision:3};
    else if(id.startsWith('watershed-')||['terrace','lake','reach','meadow'].includes(id)){
     s=SpherePacks.activate(s);await P.prepare(s);
     if(['lake','reach','meadow'].includes(id))s=SphereNeighbourhood.view(s,id);
     else s=P.view(s,({'watershed-40000':'neighbourhood','watershed-10000':'region','watershed-1100':'province','watershed-48':'approach','watershed-1':'garden',terrace:'terrace'})[id]);
     s.clouds=false;s.atmosphere=.35;s.cavityHaze=.04;s.exposure=.5;s.fov=id==='terrace'?88:72;
    }else if(id==='ultra-desert'||id==='winter-hell'){
     s=await SpherePlaces.destination(s,id==='ultra-desert'?'biome-2':'biome-3','ground','day','clear');
     const q=s.siteAnchor,f=SphereSites.shellFrame(q);
     s.walkMode=false;s.position=M.add(M.mul(q,s.radius-.13),M.mul(f[2],-.3));
     s.forward=M.norm(M.add(f[2],M.mul(f[1],-.3)));s.up=M.basis(s.forward,f[1]).u;
     s.fov=82;s.exposure=.5;s.atmosphere=.5;s.cavityHaze=.06;
    }else if(id.startsWith('shade-')){
     s={...s,atmosphere:0,cavityHaze:0,clouds:false,time:134199,localShadows:2};
     const p=SphereCollection.plates(s).find(p=>p.id===(id==='shade-broken'?0:4)),E=SphereEdges;
     const f=SphereShadeEdges.arrivalFrame(s,p),at=E.plateVector(f.origin,p),up=E.plateVector(f.up,p),inside=E.plateVector(f.inward,p),along=E.plateVector(f.tangent,p);
     s.position=M.add(M.add(at,M.mul(inside,-.32)),M.mul(up,.06));
     s.forward=M.norm(M.add(M.add(inside,M.mul(along,.55)),M.mul(up,-.25)));s.up=M.basis(s.forward,up).u;s.fov=75;s.exposure=.8;
    }else{
     A.setState(s);
     if(id==='interior'){document.getElementById('collectionStation').click();s=A.getState();s.fov=48;s.exposure=-3.5;s.atmosphere=.6;s.cavityHaze=.12;}
     else {SphereEvolution.visit(id==='wound'?'rim':'biome-1');s=A.getState();s.exposure=.5;s.fov=84;
      if(id==='clouds'){const f=SphereSites.shellFrame(s.siteAnchor);s.position=M.mul(s.siteAnchor,s.radius-9);s.forward=M.norm(M.add(f[2],M.mul(f[1],-.15)));s.up=M.basis(s.forward,f[1]).u;s.fov=85;s.weatherStrength=.5;}
     }
    }
    s.antialias=3;s.weatherQuality=2;s.richMaterials=true;s.playing=false;s.shadeGeometryRevision=3;
    A.setState(s);s=A.getState();await R.prepare(s);
    for(let n=0;n<3;n++){R.draw(s,1280,720,{exportFrame:true});R.gl.finish();}
    return {image:R.canvas.toDataURL(),scene:M.sceneRecord(s,{title}),error:R.error()};
   },{id,title,reference});
   assert.equal(result.error,0);fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify(result.scene,null,2)+'\n');
   const preview=path.join(root,'work/screenshots/release-v1.5');fs.mkdirSync(preview,{recursive:true});
   fs.writeFileSync(path.join(preview,id+'.png'),Buffer.from(result.image.split(',')[1],'base64'));
   console.log('Composed '+id);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(dir,'shots.json'),JSON.stringify(shots,null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
