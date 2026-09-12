// Original, reproducible in-engine screenshots for the GitHub release gallery.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereEvolution);await page.evaluate(()=>SphereApp.setBusy(true));
  const dir=path.join(__dirname,'../examples/v1.4');fs.mkdirSync(dir,{recursive:true});
  const base=JSON.parse(fs.readFileSync(path.join(__dirname,'../tests/fixtures/polish-scenes.json'),'utf8')).find(x=>x.id==='rim-air').state;
  const shots=[['polar-station','From the polar station'],['wound-edge','At the edge of a world'],['shade-structure','The broken Shade'],['cloudscape','Above the cloud sea'],['mycelium','Walking the Mycelium Sea'],['wreckage','The ancient graveyard']];
  const selected=new Set(process.argv.slice(2));
  for(const id of selected)assert(shots.some(s=>s[0]===id),'Unknown shot: '+id);
  for(const [id,title] of shots.filter(s=>!selected.size||selected.has(s[0]))){
   const r=await page.evaluate(async({id,title,base})=>{
    const A=SphereApp,M=SphereMath,R=A.renderer;A.setState({...base,siteId:'',siteAnchor:null,shadeAttachment:null,walkMode:false,exposure:-.15});
    let s;
    if(id==='wound-edge')s={...base,exposure:.65,fov:84};
    else{
     const destination=id==='polar-station'?'port-0':id==='shade-structure'?'shade-0':id==='mycelium'?'biome-8':id==='cloudscape'?'biome-1':'exterior-1';
     SphereEvolution.visit(destination,{walk:id==='mycelium'});s=A.getState();
     if(id==='polar-station'){const f=SphereSites.shellFrame(s.siteAnchor);s.position=M.add(M.mul(s.siteAnchor,s.radius-.1),M.mul(f[2],-.8));s.forward=M.norm(M.add(f[2],M.mul(f[1],.52)));s.up=M.basis(s.forward,f[1]).u;s.fov=112;s.exposure=.35;s.atmosphere=.3;s.cavityHaze=.18;}
     if(id==='shade-structure'){s.atmosphere=0;s.cavityHaze=.12;s.exposure=0;}
     if(id==='mycelium'){const f=SphereSites.shellFrame(s.siteAnchor);s.forward=M.norm(M.add(f[2],M.mul(f[1],.08)));s.up=f[1];s.atmosphere=.7;s.weatherStrength=.35;s.exposure=.15;}
     if(id==='cloudscape'){const f=SphereSites.shellFrame(s.siteAnchor);s.position=M.mul(s.siteAnchor,s.radius-7);s.forward=M.norm(M.add(f[2],M.mul(f[1],-.2)));s.up=M.basis(s.forward,f[1]).u;s.fov=85;s.atmosphere=1;s.weatherStrength=.68;s.exposure=.1;}
     if(id==='wreckage'){s.exposure=1.25;s.fov=78;s.atmosphere=0;s.cavityHaze=0;}
    }
    s.antialias=3;s.weatherQuality=2;s.richMaterials=true;s.localShadows=2;s.playing=false;A.setState(s);s=A.getState();
    await R.prepare(s);R.draw(s,1920,1080,{exportFrame:true});R.draw(s,1920,1080,{exportFrame:true});R.gl.finish();
    return {image:R.canvas.toDataURL('image/png'),scene:M.sceneRecord(s,{application:'The Sphere Observatory 1.4',title,units:'kilometres, seconds, degrees',image:{width:1920,height:1080,render:R.renderInfo},assumptions:A.assumptions}),error:R.error()};
   },{id,title,base});
   assert.equal(r.error,0);const bytes=Buffer.from(r.image.split(',')[1],'base64');
   fs.writeFileSync(path.join(dir,id+'.png'),bytes);fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify(r.scene,null,2)+'\n');console.log(id,bytes.length,'bytes');
  }
  const results=shots.filter(s=>fs.existsSync(path.join(dir,s[0]+'.png'))).map(([id,title])=>({id,title,bytes:fs.statSync(path.join(dir,id+'.png')).size}));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'gallery.json'),JSON.stringify({version:'1.4.0',method:'Unretouched Observatory renders at 1920 × 1080, internally supersampled at 3840 × 2160',shots:results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
