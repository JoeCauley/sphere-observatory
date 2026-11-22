'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

function ffmpeg() {
  if (process.env.SPHERE_FFMPEG) return process.env.SPHERE_FFMPEG;
  if (spawnSync('ffmpeg', ['-version'], {stdio:'ignore'}).status === 0) return 'ffmpeg';
  const probe = spawnSync('python', ['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], {encoding:'utf8'});
  if (probe.status === 0) return probe.stdout.trim();
  throw Error('Set SPHERE_FFMPEG to the ffmpeg executable.');
}

function readCamera() {
  const s = window.SphereApp?.getState();
  const child = document.querySelector('#stageFrame iframe')?.contentWindow;
  const api = child?.SphereBiome || (!s && window.SphereBiome);
  let d, inspectError;
  try { d=api?.inspect?.(); } catch(e){ inspectError=e.message; }
  const p=api?.pose?.();
  const gl = d?.frames>0 ? (child?.document??document).getElementById('world')?.getContext('webgl2') : window.SphereApp?.renderer?.gl;
  const local = p && [p.eastM,p.northM,p.altitudeM,p.yaw,p.pitch];
  const main = s && [s.radius-Math.hypot(...s.position),...s.position,...s.forward];
  const curtain = document.querySelector('#travelCurtain');
  const stage = document.querySelector('#stageFrame');
  return {owner:api?.id || (s?'main':'boot'), local, main, inspectError, mode:p?.mode || (s?.walkMode?'walk':'flight'),
    count:d?.frames ?? null, veil:d?.veil ?? 0, cloud:window.SphereStageFrame?.cloudOpacity || 0,
    nearOpacity:stage?.querySelector('iframe') ? Number(getComputedStyle(stage.querySelector('iframe')).opacity) : 0,
    stageOpacity:stage ? Number(getComputedStyle(stage).opacity) : 0, direct:d?.light?.direct, sphereTime:s?.time,
    glLost:gl?.isContextLost() ?? false, error:gl?.getError() ?? 0,
    crossingStatus:!!(curtain && !curtain.hidden && curtain.classList.contains('crossing-status')),
    status:window.SphereStageFrame?.lastArrival?.status, curtain:!!(curtain && !curtain.hidden && getComputedStyle(curtain).display!=='none' && Number(getComputedStyle(curtain).opacity)>.1)};
}

async function record(page, directory, id, action, options={}) {
  if (!/^[a-z0-9-]+$/.test(id)) throw Error('Invalid clip ID');
  fs.mkdirSync(directory,{recursive:true});
  const raw=fs.mkdtempSync(path.join(directory,'.frames-'+id+'-'));
  const session=await page.context().newCDPSession(page), errors=[], requests=new Set(), frames=[];
  const onError=e=>{if(!errors.includes(e.message))errors.push(e.message);};
  const onRequest=r=>{const p=new URL(r.url()).pathname;if(/\/assets\//.test(p))requests.add(p);};
  page.on('pageerror',onError);page.on('request',onRequest);
  const viewport=page.viewportSize();
  const box=await page.locator(options.standalone?'#world':'#viewport').first().boundingBox();
  const width=2*Math.floor(Math.min(box.width,viewport.width-Math.ceil(box.x))/2);
  const height=2*Math.floor(Math.min(box.height,viewport.height-Math.ceil(box.y))/2);
  const clip={x:Math.ceil(box.x), y:Math.ceil(box.y), width,height,scale:1};
  const start=performance.now(), interval=1000/(options.fps||10);
  let recording=true, failed, result, captureError;
  async function sample() {
    const t=performance.now();
    const [shot,camera]=await Promise.all([session.send('Page.captureScreenshot',{format:'jpeg',quality:78,clip,fromSurface:true,captureBeyondViewport:false}),page.evaluate(readCamera)]);
    const elapsed=performance.now()-start, index=frames.length;
    const filename=String(index).padStart(6,'0')+'.jpg';
    fs.writeFileSync(path.join(raw,filename),Buffer.from(shot.data,'base64'));
    frames.push({ms:Math.round(elapsed),captureMs:Math.round(performance.now()-t),filename,...camera});
  }
  try {
    await sample();
    const sampling=(async()=>{try{while(recording){const t=performance.now();await sample();await delay(Math.max(0,interval-(performance.now()-t)));}}catch(e){captureError=e;}})();
    try {await delay(400);result=await action();await delay(500);}catch(e){failed=e;await delay(400);}
    finally{recording=false;await sampling;}
    if(captureError)throw captureError;
    const end=performance.now()-start;
    const list=frames.map((f,i)=>'file '+f.filename+'\nduration '+Math.max(.001,((frames[i+1]?.ms??end)-f.ms)/1000).toFixed(4)).join('\n')+'\nfile '+frames.at(-1).filename+'\n';
    fs.writeFileSync(path.join(raw,'frames.txt'),list);
    const film=path.join(directory,id+'.mp4');
    const encode=spawnSync(ffmpeg(),['-hide_banner','-loglevel','error','-y','-f','concat','-safe','1','-i','frames.txt','-vf','fps=24,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','22','-movflags','+faststart',film],{cwd:raw,encoding:'utf8'});
    if(encode.status!==0)throw Error('Encoding '+id+': '+encode.stderr);
    const report={id,width,height,targetSamplesPerSecond:1000/interval,durationMs:Math.round(end-frames[0].ms),frames,errors,requests:[...requests].sort(),result:result??null,failure:failed?.message??null};
    fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify(report)+'\n');
    for(const f of frames)fs.unlinkSync(path.join(raw,f.filename));
    fs.unlinkSync(path.join(raw,'frames.txt'));fs.rmdirSync(raw);
    return report;
  }finally{await session.detach();page.off('pageerror',onError);page.off('request',onRequest);}
}
module.exports={record,readCamera,ffmpeg};
