// Run against an extracted source archive to catch missing release assets.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),url=process.env.SPHERE_URL||'http://127.0.0.1:8766/';

(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/wound-edges/manifest.json'),'utf8'));
 for(const entry of manifest.images){
  const bytes=fs.readFileSync(path.join(root,entry.path));
  assert.equal(bytes.length,entry.bytes,entry.path);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
  page.setDefaultTimeout(180000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const response=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.SphereSession&&window.SphereEvolution);
  await page.evaluate(()=>SphereApp.setBusy(true));
  const version=await page.evaluate(async()=>{const r=await fetch('package.json');return (await r.json()).version;});
  assert.equal(version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
  console.log('Release booted:',version);
  const captures=[];
  for(const id of ['rim','shade-0','biome-0','port-0','exterior-0']){
   const result=await page.evaluate(async id=>{
    const A=SphereApp,R=A.renderer;SphereEvolution.visit(id,{walk:id==='biome-0'});
    const s=A.getState();await R.prepare(s);
    for(let i=0;i<2;i++)R.draw(s,800,500,{exportFrame:true});
    const pixels=new Uint8Array(800*500*4);R.gl.readPixels(0,0,800,500,R.gl.RGBA,R.gl.UNSIGNED_BYTE,pixels);
    let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];
    return {id,mean:sum/(800*500*3),error:R.error(),groups:R.renderInfo.geometry?.groups||0,walk:s.walkMode,woundTextures:R.woundTextures.status,worldReady:R.worldTextures.ready,siteId:s.siteId,attachment:s.shadeAttachment};
   },id);
   assert.equal(result.error,0,id);assert(result.mean>1,id+' rendered black');assert(result.groups>0,id+' missing geometry');
   assert(result.worldReady,id+' missing world textures');
   if(id==='rim')assert(result.woundTextures.every(x=>x==='ready'),'Missing Wound texture');
   if(id==='biome-0')assert(result.walk,'Walking site did not activate');
   if(id==='shade-0')assert.equal(result.attachment,0);
   console.log(id,JSON.stringify({mean:result.mean,groups:result.groups,gl:result.error}));captures.push(result);
  }
  assert.deepEqual(errors,[]);
  const out=path.join(root,'work/screenshots/release');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({version,verifiedWoundAssets:manifest.images.length,captures,errors},null,2));
  console.log('PASS release assets, fresh boot, Wound, Shade, walking, polar entry and exterior');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
