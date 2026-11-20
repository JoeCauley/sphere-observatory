// Rephotograph the offered biomes using the same camera and save formats as an explorer.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {session, executable} = require('../tests/support/biome-browser.cjs');
const root = path.resolve(__dirname, '..');
const dest = path.resolve(process.argv[2] || path.join(root, 'examples/biomes'));
const packs = require('../packs/biome-library.json').packs;
const camera = (eastM, northM, altitudeM, yaw, pitch, mode = 'flight') => ({eastM,northM,altitudeM,yaw,pitch,mode});
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const readModule = name => import(pathToFileURL(path.join(root, name)).href);
const {sourceFingerprint}=require('./biome-gallery-source.cjs');
const shots = [
  ...[2,10,20,30].map(h => ({file:'meadow-'+h+'m', id:'infinite-meadow', clearance:h, pose:camera(15,10,h,-.72,-.045)})),
  {file:'industry-district',id:'infinite-industry',pose:camera(-210,-620,290,.32+Math.PI*.79,-.37)},
  {file:'industry-waterworks',id:'infinite-industry',pose:camera(107,-180,34,Math.atan2(-107,-180),-.11)},
  {file:'industry-transfer',id:'infinite-industry',pose:camera(-157,316,3.5,Math.atan2(-6,-25),.15)},
  {file:'city-tower',id:'sideways-city',pose:camera(308,-555,19,-.52,.24)},
  {file:'sideways-city',id:'sideways-city',pose:camera(-21,-109,44,.43,-.06)},
  {file:'outfall-approach',id:'border-outfall',pose:camera(-7,-24,1.7,.27,.15,'walk')},
  {file:'outfall-wall',id:'border-outfall',pose:camera(-12000,-4,1.7,1.49,.04,'walk')},
  {file:'outfall-cross-gallery',id:'border-outfall',pose:camera(1004,38,1.7,1.55,.02,'walk')},
  {file:'outfall-gallery',id:'border-outfall',pose:camera(-1.1,7.9,1.7,.30,.025,'walk')}
];
async function saved(pack, shot) {
  const base = path.posix.dirname(pack.entry) + '/';
  if (pack.id === 'sideways-city' || pack.id === 'border-outfall') {
    return JSON.stringify({schema:1, pose:shot.pose, bookmark:shot.pose, open:true, levels:[1,1,1]});
  }
  const m = await readModule(base+'model.js'), c = await readModule('packs/runtime/v1/contract.js');
  const manifest = JSON.parse(fs.readFileSync(path.join(root,base,'manifest.json')));
  const state = m.initialState();
  state.pose = {...shot.pose};
  if (pack.id === 'infinite-meadow') {
    state.pose.altitudeM = m.terrain(shot.pose.eastM,shot.pose.northM) + m.EYE + shot.clearance;
    state.windTime = 17.0; state.windPlaying = false;
    state.skimEnabled = false;
  } else {
    const facility = await readModule(base+'facility.js');
    state.pose.altitudeM += facility.DATUM_M;
  }
  const value = m.saveState(state);
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  return c.createStore(manifest,{}).encode({state:raw,bookmark:raw});
}
async function pan(page) {
  await page.evaluate(() => {
    const stream = document.querySelector('#world').captureStream(30);
    const mimeType = ['video/webm;codecs=vp9','video/webm;codecs=vp8'].find(t => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream,{mimeType,videoBitsPerSecond:3500000}), chunks=[];
    window.__pan = new Promise((resolve,reject) => {
      recorder.ondataavailable = event => { if(event.data.size) chunks.push(event.data); };
      recorder.onerror = reject;
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));
      };
    });
    recorder.start(); window.__stopPan = () => recorder.stop();
  });
  await page.locator('#world').focus();
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyX');
  try { await page.waitForTimeout(2700); } finally { await page.keyboard.up('KeyX'); }
  await page.waitForTimeout(600);
  return Buffer.from(await page.evaluate(() => { window.__stopPan(); return window.__pan; }), 'base64');
}
async function main() {
  fs.mkdirSync(dest,{recursive:true});
  const host=await session(), views=[], source=sourceFingerprint(),capturedAt=new Date().toISOString();
  const browser = await chromium.launch({headless:process.env.SPHERE_CAPTURE_HEADLESS==='1',executablePath:executable(),args:['--mute-audio','--window-size=1650,990']});
  try {
    for (const shot of shots) {
      const pack = packs.find(p => p.id===shot.id);
      const context = await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:1});
      try {
        await host.attach(context);
        await context.addInitScript(([key,value]) => localStorage.setItem(key,value), [pack.saveKey,await saved(pack,shot)]);
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>{errors.push(e.message);console.error(shot.file,e.message);});
        await page.bringToFront();
        await page.goto(host.origin+'/'+pack.entry);
        await page.waitForFunction(() => window.SphereBiome?.inspect().frames>=130,null,{timeout:90000});
        if (errors.length) throw Error(errors.join('\n'));
        const observed=await page.evaluate(() => {
          const api=window.SphereBiome, gl=document.querySelector('#world').getContext('webgl2');
          if(!gl || gl.isContextLost())throw Error('The scene lost its graphics context before capture.');
          const dbg=gl.getExtension('WEBGL_debug_renderer_info');
          return {pose:api.pose(),browserViewport:[innerWidth,innerHeight],drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
            visible:document.visibilityState==='visible',focused:document.hasFocus(),gpu:dbg&&gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)};
        });
        // Keep every rendered scene pixel and omit the floating control panels.
        const bytes=await page.screenshot({type:'jpeg',quality:89,style:'body :not(canvas):not(:has(canvas)){visibility:hidden!important}'});
        fs.writeFileSync(path.join(dest,shot.file+'.jpg'),bytes);
        const record={file:shot.file+'.jpg',pack:pack.id,version:pack.version,...(shot.clearance!=null?{clearanceM:shot.clearance,windTime:17,seed:713}:{}),...observed,sha256:sha(bytes)};
        if(shot.clearance===2){
          const bytes=await pan(page); fs.writeFileSync(path.join(dest,'meadow-pan.webm'),bytes);
          record.pan={file:'meadow-pan.webm',sha256:sha(bytes),endPose:await page.evaluate(()=>SphereBiome.pose())};
        }
        views.push(record);
        fs.writeFileSync(path.join(dest,'captures.json'),JSON.stringify({capturedAt,source,browser:browser.version(),views},null,2)+'\n');
        console.log(shot.file+' '+bytes.length+' bytes');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); await host.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
