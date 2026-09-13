// Recreate the current README gallery using saved scenes and the app renderer.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../examples/observatory');
const shots=[['interior','The stellar conservatory'],['cavity','Across the interior'],['wound','At the edge of a world'],['river-garden','The open river-garden terrace'],['watershed','A garden beside the river'],['shade','The broken Shade'],['clouds','Above the cloud sea']];
(async()=>{
 const selected=new Set(process.argv.slice(2));for(const id of selected)assert(shots.some(s=>s[0]===id),'Unknown shot: '+id);
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));
  const diagnostics=[];
  for(const [id,title] of shots.filter(([id])=>!selected.size||selected.has(id))){
   const input=JSON.parse(fs.readFileSync(path.join(dir,id+'.json'),'utf8'));
   const result=await page.evaluate(async({input,title})=>{
    const A=SphereApp,M=SphereMath,R=A.renderer;A.setState(M.validate(input.state));const s=A.getState();
    if(s.playing)throw Error('Gallery scene must be paused');await R.prepare(s);
    let previous=null,image=null;const matches=[];
    for(let n=0;n<8;n++){R.draw(s,3840,2160,{exportFrame:true});R.gl.finish();image=R.canvas.toDataURL('image/png');if(previous!==null)matches.push(previous===image);previous=image;if(n>=2&&matches.at(-1))break;}
    const ext=R.gl.getExtension('WEBGL_debug_renderer_info');
    return {image,coldMatches:matches[0],warmMatches:matches.at(-1),frameMatches:matches,error:R.error(),renderer:ext?R.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):R.gl.getParameter(R.gl.RENDERER),scene:M.sceneRecord(s,{application:'The Sphere Observatory — current source build',title,units:'kilometres, seconds, degrees',image:{width:3840,height:2160,render:R.renderInfo},assumptions:A.assumptions})};
   },{input,title});
   assert.equal(result.error,0);assert.equal(result.warmMatches,true,'Repeated prepared captures differ: '+id);assert.equal(result.scene.state.playing,false);
   const png=Buffer.from(result.image.split(',')[1],'base64');assert.equal(png.readUInt32BE(16),3840);assert.equal(png.readUInt32BE(20),2160);
   fs.writeFileSync(path.join(dir,id+'.png'),png);fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify(result.scene,null,2)+'\n');delete result.image;delete result.scene;
   diagnostics.push({id,title,...result,bytes:png.length,sha256:crypto.createHash('sha256').update(png).digest('hex')});console.log(id,JSON.stringify(diagnostics.at(-1)));
   const auditFile=path.join(dir,'gallery.json'),prior=fs.existsSync(auditFile)?JSON.parse(fs.readFileSync(auditFile)).shots:[],merged=new Map(prior.map(x=>[x.id,x]));for(const item of diagnostics)merged.set(item.id,item);
   fs.writeFileSync(auditFile,JSON.stringify({capturedAt:new Date().toISOString(),sourceCommit:process.env.SPHERE_SOURCE_COMMIT||null,width:3840,height:2160,method:'Native app renderer, prepared assets, three to eight paused frames; last two must match. All adjacent-frame comparisons retained. No external image retouching.',shots:shots.map(([id])=>merged.get(id)).filter(Boolean),errors},null,2)+'\n');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
