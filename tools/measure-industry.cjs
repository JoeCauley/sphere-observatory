'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {session,executable}=require('../tests/support/biome-browser.cjs');

const version=process.argv[2]||'1.4.0', base='packs/infinite-industry/'+version+'/', out=path.resolve(process.argv[3]||'industry-'+version+'.json');
const load=n=>import(pathToFileURL(path.resolve(n)).href);
async function main(){
 const server=await session(),origin=server.origin,offline=c=>server.attach(c);
 const model=await load(base+'model.js'),F=await load(base+'facility.js'),contract=await load('packs/runtime/v1/contract.js'),manifest=JSON.parse(fs.readFileSync(base+'manifest.json')),store=contract.createStore(manifest,{});
 const b=await chromium.launch({headless:false,executablePath:executable(),args:['--mute-audio','--window-size=1400,900']});
 const results=[];
 const {transferPlace}=await load('packs/infinite-industry/1.4.1/transfer.js');
 try{for(const station of [1.7,400,2600,3100,'transfer']){
  const height=station==='transfer'?1.7:station;
  const state=model.initialState();state.pose={...state.pose,eastM:300,northM:-350,altitudeM:F.DATUM_M+height,yaw:-2.43,pitch:height<3?-.025:-.22,mode:height<3?'walk':'flight'};
  if(station==='transfer')Object.assign(state.pose,transferPlace());
  const value=store.encode({state:model.saveState(state),bookmark:model.saveState(state)});
  const context=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});await offline(context);const p=await context.newPage();await p.bringToFront();
  await p.addInitScript(([k,v])=>localStorage.setItem(k,v),[manifest.storageKey,value]);await p.goto(origin+'/'+base+'index.html');await p.waitForFunction(()=>window.SphereBiome?.inspect().frames>=180,null,{timeout:120000});await p.locator('#hide').click();await p.waitForTimeout(2500);
  const m=await p.evaluate(async()=>{
   const rows=new Map(),a=performance.now(),initial=SphereBiome.inspect().frames;
   let focused=true,visible=true;
   do{await new Promise(r=>setTimeout(r,650));focused&&=document.hasFocus();visible&&=document.visibilityState==='visible';
    for(const v of SphereIndustry.inspect().metrics)if(v.frame>initial)rows.set(v.frame,v);
   }while(performance.now()-a<30000);
   const all=[...rows.values()],intervals=all.map(v=>v.intervalMs).sort((a,b)=>a-b),q=(s,p)=>s[Math.min(s.length-1,Math.floor(s.length*p))],gpu=SphereIndustry.inspect(),gl=document.querySelector('#world').getContext('webgl2');
   return {durationMs:performance.now()-a,frames:all.length,unbroken:all.at(-1).frame-initial===all.length,visible,focused,pose:SphereBiome.pose(),canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],gpu:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL),intervalMedianMs:q(intervals,.5),intervalP95Ms:q(intervals,.95),hitchesAbove50:intervals.filter(i=>i>50).length,shareAbove16_7:intervals.filter(i=>i>16.7).length/intervals.length,drawsMedian:q(all.map(i=>i.drawCalls).sort((a,b)=>a-b),.5),uploadBytes:all.reduce((s,v)=>s+v.uploadBytes,0),peakResidentBytes:Math.max(...all.map(v=>v.gpuBufferBytes)),plants:gpu.renderer.plants,errors:gpu.webglErrors};
  });results.push({station,height,...m});fs.writeFileSync(out,JSON.stringify({version,transport:process.env.SPHERE_TEST_TRANSPORT||'http',browser:b.version(),results},null,2));console.log(height,m.frames,m.intervalMedianMs,m.intervalP95Ms,m.focused);await context.close();
 }}finally{await b.close();await server.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});