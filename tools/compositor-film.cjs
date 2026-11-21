'use strict';
// Load with node --require ./tools/compositor-film.cjs to record the visible compositor.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {setTimeout:sleep}=require('node:timers/promises');
const recorder=require('./transition-recorder.cjs');

async function record(page,directory,id,action,options={}){
  if(!/^[a-z0-9-]+$/.test(id))throw Error('Invalid film name');
  const cdp=await page.context().newCDPSession(page),target=page.locator(options.standalone?'#world':'#viewport').first();
  const rect=await target.boundingBox(),viewport=page.viewportSize(),x=Math.ceil(rect.x),y=Math.ceil(rect.y);
  const width=2*Math.floor(Math.min(rect.width,viewport.width-x)/2),height=2*Math.floor(Math.min(rect.height,viewport.height-y)/2);
  fs.mkdirSync(directory,{recursive:true});
  const raw=fs.mkdtempSync(path.join(directory,'.compositor-'+id+'-'));
  const film=path.resolve(directory,id+'.mp4'),frames=[],pictures=[],errors=[],requests=new Set();
  const onError=e=>{if(!errors.includes(e.message))errors.push(e.message);};
  const onRequest=r=>{const u=new URL(r.url()).pathname;if(u.includes('/assets/'))requests.add(u);};
  page.on('pageerror',onError);page.on('request',onRequest);
  let active=true,base,result,failure,captureError;
  function keep(data,ms){
    const filename=String(pictures.length).padStart(6,'0')+'.jpg';
    fs.writeFileSync(path.join(raw,filename),Buffer.from(data,'base64'));
    pictures.push({filename,ms:Math.max(pictures.at(-1)?.ms??0,Math.round(ms))});
  }
  function onPicture(e){
    cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
    if(!active)return;
    try{
      const observed=Date.now()-base,stamp=e.metadata.timestamp*1000-base;
      keep(e.data,Number.isFinite(stamp)?Math.max(0,Math.min(stamp,observed)):observed);
    }catch(error){captureError=error;active=false;}
  }
  try{
    const initial=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:86,fromSurface:true,captureBeyondViewport:false});
    const first=await page.evaluate(recorder.readCamera);base=Date.now();keep(initial.data,0);frames.push({ms:0,...first});
    cdp.on('Page.screencastFrame',onPicture);
    await cdp.send('Page.startScreencast',{format:'jpeg',quality:82,everyNthFrame:1});
    const sampling=(async()=>{
      try{
        while(active){
          const start=Date.now();const camera=await page.evaluate(recorder.readCamera);
          frames.push({ms:Date.now()-base,...camera});await sleep(Math.max(0,100-(Date.now()-start)));
        }
      }catch(error){captureError=error;active=false;}
    })();
    try{await sleep(400);result=await action();await sleep(500);}catch(error){failure=error;await sleep(400);}
    finally{active=false;await sampling;await cdp.send('Page.stopScreencast');}
    if(captureError)throw captureError;
    const last=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:86,fromSurface:true,captureBeyondViewport:false});
    const duration=Date.now()-base;keep(last.data,duration);
    if(pictures.length<8)throw Error('The compositor supplied only '+pictures.length+' pictures');
    const count=Math.max(1,Math.round(duration*.024)),entries=[];let next=0;
    for(let i=0;i<count;i++){
      const time=i*1000/24;
      while(next+1<pictures.length&&pictures[next+1].ms<=time)next++;
      entries.push('file '+pictures[next].filename);
    }
    fs.writeFileSync(path.join(raw,'timeline.txt'),entries.join('\n')+'\n');
    const ff=process.env.SPHERE_FFMPEG||'ffmpeg';
    const encode=spawnSync(ff,['-v','error','-y','-r','24','-f','concat','-safe','1','-i','timeline.txt','-vf','crop='+[width,height,x,y].join(':')+',format=yuv420p','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-movflags','+faststart',film],{cwd:raw,encoding:'utf8'});
    if(encode.status!==0)throw Error('Encoding failed '+encode.stderr);
    const report={id,width,height,durationMs:duration,method:'CDP compositor, most recent actual picture at each 24 Hz presentation time',sourcePictures:pictures.map(p=>p.ms),frames,errors,requests:[...requests],result:result??null,failure:failure?.message??null};
    fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify(report)+'\n');
    return report;
  }finally{
    active=false;cdp.off('Page.screencastFrame',onPicture);page.off('pageerror',onError);page.off('request',onRequest);
    await cdp.detach().catch(()=>{});
    for(const file of fs.readdirSync(raw))fs.unlinkSync(path.join(raw,file));
    fs.rmdirSync(raw);
  }
}
recorder.record=record;
