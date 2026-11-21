'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {session,executable}=require('../tests/support/biome-browser.cjs');
(async()=>{
 const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1000,height:650}});await host.attach(ctx);
  const page=await ctx.newPage();await page.goto(host.origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereBiomeLibrary?.world);
  const dir=process.argv[2],names=['walk-installed-main-11-main-4','walk-installed-main-12-main-5','walk-empty-main-0-main-11','walk-installed-main-10-main-9','walk-installed-main-9-infinite-meadow','walk-placed-sideways-city-main-7'];
  const out=[];
  for(const id of names){
   const rec=JSON.parse(fs.readFileSync(path.join(dir,id+'.json'),'utf8')),pose=rec.frames.at(-1);
   if(pose.owner!=='main')continue;
   const row=await page.evaluate(async({pose,id})=>{
    const state=SphereApp.getState(),q=SphereMath.norm(pose.main.slice(1,4)),forward=pose.main.slice(4,7);
    const ok=await SphereStageFrame.walkGround({q,forward,pack:false});if(!ok)throw Error('The native destination could not open');
    const s=SphereApp.getState(),G=SphereGround,at=SphereMath.norm(s.position),support=G.surfaceSupport(s,at);
    const p=G.frame(s).local(s.position),height=G.ground(s,p[0],p[2]);const eyeM=1000*(p[1]-height);
    const traceEye=Number.isFinite(height)?1000*(G.frame(s).local(pose.main.slice(1,4))[1]-height):null;
    return {id,site:s.siteId,eyeM,traceEye,support:support?.source,radialEyeM:support?1000*(s.radius-Math.hypot(...s.position)-support.heightKm):null};
   },{pose,id});out.push(row);console.log('SURVEYED_EYE '+JSON.stringify(row));
  }
  console.log('NATIVE_EYES '+JSON.stringify(out));
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
