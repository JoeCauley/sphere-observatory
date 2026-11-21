'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const {chromium}=require('playwright');
const {session,executable}=require('../tests/support/biome-browser.cjs');

(async()=>{
  const dir=path.resolve(process.argv[2]||'examples/border-crossing');await fs.mkdir(dir,{recursive:true});
  const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
  let encoder;
  try{
    const page=await browser.newPage({viewport:{width:864,height:768},deviceScaleFactor:1});
    await host.attach(page);await page.goto(host.origin+'/api/health');
    const link=host.origin+'/studies/border-crossing/index.html';
    await page.setContent(`<html><head><style>
      *{box-sizing:border-box}body{margin:0;background:#182226;color:#eaf0e9;font:16px "Segoe UI",Arial,sans-serif}
      header,footer{display:flex;justify-content:space-between;align-items:center;padding:0 20px;height:42px}
      header b{font-size:20px}header span,footer{color:#cedbd6;font-size:15px}
      section{position:relative;height:342px;border-bottom:2px solid #263638}
      iframe{width:100%;height:100%;border:0;display:block}label{position:absolute;left:15px;top:12px;background:#142124e8;padding:5px 10px;border-left:3px solid #ddb975}
      </style></head><body><header><b>Across the Builder freight trunk</b><span>Border crossing study</span></header>
      <section><iframe title="Service bridge" src="${link}"></iframe><label id="bridge"></label></section>
      <section><iframe title="Lane refuge" src="${link}"></iframe><label id="lane"></label></section>
      <footer><span>Same load · 1.8 km long · 4 m/s · 40× world time</span><span id="time"></span></footer></body></html>`);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('iframe')).every(f=>f.contentWindow?.BorderCrossingStudy));
    for(const frame of page.frames().slice(1))await frame.addStyleTag({content:'body{margin:0}#scene{position:fixed!important;inset:0!important;z-index:100!important;display:block;width:100vw!important;height:100vh!important}#readout{display:none}'});
    const output=path.join(dir,'freight-views.mp4'),fps=16,frameCount=256;
    encoder=spawn(process.env.SPHERE_FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',output],{windowsHide:true,stdio:['pipe','ignore','inherit']});
    const closed=once(encoder,'close');closed.catch(()=>{});
    for(let i=0;i<frameCount;i++){
      const elapsed=i*40/fps,offset=elapsed-320;
      const result=await page.evaluate(([offset,elapsed])=>{
        const poses=Array.from(document.querySelectorAll('iframe')).map((f,i)=>{
          const v=i?'lane':'bridge',pose=f.contentWindow.BorderCrossingStudy.witness(v,offset);
          document.getElementById(v).textContent=(i?'Lane refuge':'Service bridge')+' · eye '+pose.eye[1].toFixed(1)+' m above slab';return pose;
        });
        document.getElementById('time').textContent='Elapsed '+Math.floor(elapsed/60)+'m '+String(Math.floor(elapsed%60)).padStart(2,'0')+'s';
        return poses;
      },[offset,elapsed]);
      assert.equal(result[0].train,result[1].train);assert.equal(result[0].clock,result[1].clock);
      const jpg=await page.screenshot({type:'jpeg',quality:89});
      if(i===frameCount/2)await fs.writeFile(path.join(dir,'freight-views.jpg'),jpg);
      if(!encoder.stdin.write(jpg))await Promise.race([once(encoder.stdin,'drain'),closed.then(()=>{throw Error('Encoder exited early');})]);
    }
    encoder.stdin.end();const [code]=await closed;assert.equal(code,0);
    console.log(JSON.stringify({file:output,frames:frameCount,fps,movieSeconds:frameCount/fps,worldSeconds:frameCount*40/fps,bytes:(await fs.stat(output)).size}));
  }finally{encoder?.kill();await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
