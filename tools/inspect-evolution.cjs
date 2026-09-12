const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.SPHERE_BROWSER?{executablePath:process.env.SPHERE_BROWSER}:{})});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForTimeout(2000);
 const status=await page.evaluate(()=>({app:!!window.SphereApp,error:document.querySelector('#error')?.textContent}));console.log(status,errors);
 if(!status.app)throw Error(status.error||'App did not start');
 await page.evaluate(async()=>{SphereApp.setBusy(true);await SphereApp.renderer.prepare(SphereApp.getState());});
 if(process.argv[2])await page.evaluate(id=>{SphereEvolution.visit(id);},process.argv[2]);
 await page.evaluate(async()=>{const A=SphereApp,s=A.getState();await A.renderer.prepare(s);A.renderer.draw(s,1440,900,{exportFrame:true});});
 const out=path.resolve(__dirname,'../work/screenshots');fs.mkdirSync(out,{recursive:true});await page.locator('#view').screenshot({path:path.join(out,(process.argv[2]||'overview')+'.png')});
 console.log(await page.evaluate(()=>({gl:SphereApp.renderer.error(),info:SphereApp.renderer.renderInfo,state:SphereApp.getState()})));
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
