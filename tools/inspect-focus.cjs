const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.SPHERE_BROWSER?{executablePath:process.env.SPHERE_BROWSER}:{})});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>!!window.SphereEvolution,{timeout:120000});await page.evaluate(()=>SphereApp.setBusy(true));
 const dir=path.resolve('work/screenshots/focus-after');fs.mkdirSync(dir,{recursive:true});const results=[];
 const baselines=fs.existsSync('work/screenshots/focus-before/scenes.json')?JSON.parse(fs.readFileSync('work/screenshots/focus-before/scenes.json','utf8')):[];
 for(const id of process.argv.slice(2).length?process.argv.slice(2):['biome-1','exterior-0','exterior-1','exterior-2','vista']){
  const before=baselines.find(r=>r.id===id);const r=await page.evaluate(async({id,before})=>{const A=SphereApp,M=SphereMath,R=A.renderer;
   if(before)A.setState({...before.state});else if(id==='vista')SphereCollectionUI.view('vista');else SphereEvolution.visit(id,{walk:id.startsWith('walk-')});
   let s=A.getState();s.weatherQuality=1;s.cavityHaze=.28;s.antialias=3;if(id.startsWith('exterior-')){SphereEvolution.visit(id);s={...A.getState(),fov:85};}await R.prepare(s);R.draw(s,1440,900,{exportFrame:true});const image=R.canvas.toDataURL('image/png');
   const times=[];for(let i=0;i<5;i++){const t=performance.now();R.draw(s,1280,720);R.gl.finish();times.push(performance.now()-t);}return {id,image,state:s,info:R.renderInfo,gl:R.error(),submissionMs:times.slice(1)};
  },{id,before});fs.writeFileSync(path.join(dir,id+'.png'),Buffer.from(r.image.split(',')[1],'base64'));delete r.image;results.push(r);console.log(JSON.stringify(r));
 }
 fs.writeFileSync(path.join(dir,'scenes.json'),JSON.stringify({results,errors},null,2));if(errors.length||results.some(r=>r.gl))throw Error('Browser verification failed');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
