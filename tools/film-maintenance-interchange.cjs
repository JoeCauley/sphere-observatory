'use strict';
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const {chromium}=require('playwright'),{disposable}=require('../tests/support/observatory-server.cjs');
const {executable}=require('../tests/support/biome-browser.cjs'),{ffmpeg}=require('./transition-recorder.cjs');
(async()=>{
 const out=path.resolve(process.argv[2]||'films/interchange');fs.mkdirSync(out,{recursive:true});
 const server=await disposable('http'),browser=await chromium.launch({headless:true,executablePath:executable()});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  await page.goto(server.origin+'/studies/maintenance-interchange/index.html');await page.waitForFunction(()=>window.studyFrame);
  for(const side of ['meadow','jungle','air']){
   const frames=side==='air'?300:720,dir=fs.mkdtempSync(path.join(out,side+'-'));
   for(let i=0;i<frames;i++){
    const data=await page.evaluate(([side,t])=>{
      const result=window.studyFrame(side,t);if(result.error)throw Error('WebGL '+result.error);
      return document.querySelector('canvas').toDataURL('image/jpeg',.84).split(',')[1];
    },[side,i/20]);
    fs.writeFileSync(path.join(dir,String(i).padStart(4,'0')+'.jpg'),Buffer.from(data,'base64'));
   }
   const encoded=spawnSync(ffmpeg(),['-v','error','-y','-framerate','20','-i',path.join(dir,'%04d.jpg'),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,side+'.mp4')],{encoding:'utf8'});
   if(encoded.status!==0)throw Error(encoded.stderr);
   for(const file of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,file));fs.rmdirSync(dir);console.log(side,frames);
  }
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
