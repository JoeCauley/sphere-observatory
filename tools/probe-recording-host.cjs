'use strict';
const {chromium}=require('playwright'),{session}=require('../tests/support/biome-browser.cjs');
(async()=>{
  const host=await session();
  const args=['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding'];
  if(process.env.CI_RENDERER==='swiftshader')args.push('--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog');
  const browser=await chromium.launch({executablePath:process.env.SPHERE_NATIVE_BROWSER,headless:true,args,timeout:180000});
  try{
    const ctx=await browser.newContext({viewport:{width:860,height:540},deviceScaleFactor:.75});await host.attach(ctx);
    const page=await ctx.newPage();const t=Date.now();
    page.on('pageerror',e=>console.log('PAGE',e.message));let warnings=0;
    page.on('console',m=>{if(['warning','error'].includes(m.type())&&warnings++<25)console.log(m.type(),m.text().slice(0,280));});
    page.on('requestfailed',r=>console.log('FAILED',r.url().split('/').at(-1),r.failure()?.errorText));
    await page.goto(host.origin,{waitUntil:'commit',timeout:240000});
    let ready=false;
    while(Date.now()-t<750000){
      const s=await page.evaluate(()=>{const gl=window.SphereApp?.renderer?.gl,ex=gl?.getExtension('WEBGL_debug_renderer_info');return {document:document.readyState,library:!!window.SphereBiomeLibrary?.world,ready:window.SphereLoading?.ready,loading:document.querySelector('#loadingStatus')?.textContent,title:document.querySelector('#loadingTitle')?.textContent,error:window.SphereLoading?.error,renderer:ex&&gl.getParameter(ex.UNMASKED_RENDERER_WEBGL),lost:ex&&gl.isContextLost(),size:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:[]};}).catch(e=>({failure:e.message.slice(0,170)}));
      console.log(((Date.now()-t)/1000).toFixed(1),JSON.stringify(s));
      if(s.ready&&s.library){ready=true;break;}
      if(s.error)throw Error(s.error);
      await new Promise(r=>setTimeout(r,10000));
    }
    if(!ready)throw Error('First view did not prepare in the probe window');
    await page.locator('#togglePanel').click({timeout:90000});
    const a=await page.evaluate(async()=>{await SphereBiomeLibrary.install('border-outfall');await SphereStageFrame.open('border-outfall');return SphereStageFrame.current?.id;});
    console.log('PACK',a,'after seconds',Math.round((Date.now()-t)/1000));
  }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
