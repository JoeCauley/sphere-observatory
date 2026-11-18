// Quit both processes, reopen the same origin, and walk the public four-biome route.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');
const {start} = require('./support/observatory-server.cjs');
const {executable} = require('./support/biome-browser.cjs');
const packs = require('../packs/biome-library.json').packs;
const [meadow,industry,city,outfall] = ['infinite-meadow','infinite-industry','sideways-city','border-outfall'];
const name = id => packs.find(p=>p.id===id).name;
const transport=process.env.SPHERE_TEST_TRANSPORT || 'http';
const output=process.env.SPHERE_RESTART_OUTPUT;
const report={transport,viewport:[1024,600],checks:[],pageErrors:[],status:'RUNNING'};
function record(name,observation) {
  report.checks.push({name,observation}); console.log('PASS '+name);
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}

// Compare what was actually on either side of a frame exchange. While Main is
// visible, the outermost shade shell is a conservative bound on every plate.
function startFlightProbe() {
  const result=window.__flightProbe={samples:0,mainSamples:0,swaps:0,uncovered:0,loaderFrames:0,shadeShellFrames:0,maxMainRadiusFraction:0,events:[]};
  let previous=null,previousVeil=0;
  function sample() {
    const stage=window.SphereStageFrame;
    const shell=document.querySelector('#stageFrame'),frame=shell?.querySelector('iframe');
    const visible=shell&&Number(getComputedStyle(shell).opacity)>.5;
    const api=frame?.contentWindow?.SphereBiome;
    const scene=visible?(api?.id||frame?.title||'child'):'Main';
    const veil=Math.max(stage.cloudOpacity||0,visible?(api?.inspect().veil||0):0);
    result.samples++;
    if(previous&&scene!==previous){
      const cover=Math.max(previousVeil,veil);
      result.swaps++;if(cover<.98)result.uncovered++;
      result.events.push({from:previous,to:scene,cover});
    }
    if(!visible){
      result.mainSamples++;
      const core=SphereApp.getState(), ratio=Math.hypot(...core.position)/core.radius;
      const shells=window.SphereCollection?.routes?.map(r=>r.radius)||[];
      if(veil<.98&&shells.length&&core.routeShades!==false){
        result.maxMainRadiusFraction=Math.max(result.maxMainRadiusFraction,1-ratio);
        if(ratio<=Math.max(...shells))result.shadeShellFrames++;
      }
    }
    const card=document.querySelector('#sceneLoading');
    if(!visible&&veil<.98&&card&&!card.hidden&&getComputedStyle(card).display!=='none'&&Number(getComputedStyle(card).opacity)>.05&&card.getBoundingClientRect().width>0)result.loaderFrames++;
    previous=scene;previousVeil=veil;
    if(!result.done)requestAnimationFrame(sample);
  }
  sample();
}
async function main() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sphere-restart-')),storePath=path.join(dir,'installed.json');
  const disk=()=>JSON.parse(fs.readFileSync(storePath,'utf8'));
  let host,context,page,port=0;
  async function server(){host=await start({transport,port,storePath});port=host.port;}
  async function launch(profile){
    context=await chromium.launchPersistentContext(path.join(dir,profile),{headless:true,executablePath:executable(),
      viewport:{width:1024,height:600},args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
    await host.attach(context);
    await context.addInitScript(()=>{if(top===window)localStorage.setItem('sphere-stage-sound','off');});
    page=context.pages()[0]||await context.newPage();
    page.setDefaultTimeout(150000);
    page.on('pageerror',e=>{report.pageErrors.push(e.message);console.error('page error',e.message);});
    await page.goto(host.origin+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereBiomeLibrary?.world&&document.querySelector('#biomeLibraryList article'));
    await page.evaluate(()=>SphereBiomeLibrary.ready);
  }
  const installed=()=>page.evaluate(()=>SphereBiomeLibrary.installed());
  const row=id=>page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:new RegExp('^'+name(id)+' '),exact:false})});
  const install=async id=>{await row(id).getByRole('button',{name:'Install',exact:true}).click();await page.waitForFunction(id=>!!SphereBiomeLibrary.entry(id),id);};
  const settled=async id=>{
    await page.waitForFunction(id=>SphereStageFrame.current?.id===id&&!SphereStageFrame.flying&&SphereStageFrame.lastArrival?.status==='arrived'
      &&document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect().scripted===false,id);
  };
  const visit=async id=>{await row(id).getByRole('button',{name:'Visit',exact:true}).click();await settled(id);};
  const fly=async id=>{await page.locator('#stageFrame').getByRole('button',{name:'Fly to '+name(id),exact:true}).click();await settled(id);};
  const back=async()=>{await page.getByRole('button',{name:'Return to the Sphere',exact:true}).click();await page.waitForFunction(()=>!SphereStageFrame.current&&!SphereStageFrame.flying);};
  const pose=()=>page.evaluate(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose());
  const place=id=>page.evaluate(id=>{const s=SphereBiomeLibrary;return JSON.parse(s.saveStorage().getItem(s.pack(id).saveKey));},id);
  const close=async()=>{if(context){await context.close();context=null;}};
  async function changeSeed(n,wait=true) {
    await page.evaluate(n=>{const el=document.querySelector('#seed');el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},n);
    if(wait)await page.waitForFunction(n=>SphereBiomeLibrary.world?.params.seed===n,n);
  }
  try {
    await server();await launch('traveler');
    const original=await page.evaluate(()=>SphereBiomeLibrary.world);
    assert.equal(original.params.seed,23);assert.equal((await installed()).length,0);
    report.browser=await page.evaluate(()=>navigator.userAgent);
    report.gpu=await page.evaluate(()=>{const g=SphereApp.getRenderer?.()?.gl||document.querySelector('canvas').getContext('webgl2');return g?.getParameter(g.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL);});
    for(const id of [meadow,industry,city])await install(id);
    const initial=await installed();
    assert.equal(new Set(initial.map(i=>i.plotId)).size,3);
    const before=fs.readFileSync(storePath,'utf8');
    await page.evaluate(id=>SphereBiomeLibrary.install(id),industry);
    assert.equal(fs.readFileSync(storePath,'utf8'),before);
    record('Three plots and an idempotent repeat install',{world:original,installed:initial});
    await visit(meadow);const meadowArrival=await pose();await page.evaluate(startFlightProbe);await fly(industry);
    const probe=await page.evaluate(()=>{window.__flightProbe.done=true;return {probe:window.__flightProbe,flight:SphereStageFrame.lastFlight};});
    record('Prepared Meadow to Industry flight',probe);
    assert(probe.probe.swaps>=2&&probe.probe.mainSamples>0);
    assert.equal(probe.probe.uncovered,0);assert.equal(probe.probe.loaderFrames,0);assert.equal(probe.probe.shadeShellFrames,0);
    const airborne=await pose();await page.frameLocator('#stageFrame iframe').locator('#world').focus();
    await page.keyboard.down('KeyW');try {await page.waitForTimeout(520);}finally{await page.keyboard.up('KeyW');}
    await page.keyboard.down('KeyX');try {await page.waitForTimeout(280);}finally{await page.keyboard.up('KeyX');}
    await page.evaluate(()=>{if(!document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.save())throw Error('Industry save failed');});
    const saved=await pose(),written=(await place(industry)).state.pose;
    assert.notDeepEqual(saved,airborne);record('Manual address and heading before quit',{meadowArrival,industryArrival:airborne,saved,written});
    await close();await host.close();host=null;await server();await launch('traveler');await settled(industry);
    assert.deepEqual(await installed(),initial);assert.deepEqual(await pose(),saved);assert.deepEqual((await place(industry)).state.pose,written);
    record('Chrome and the server reopened the same scene and exact stored address',{restored:await pose(),origin:host.origin,installed:disk().worlds[original.key].installed});
    await back();await visit(city);await fly(meadow);
    assert.equal(await page.evaluate(()=>SphereStageFrame.lastFlight.from),city);
    record('Returned through Main, visited the City and flew home',{arrived:await pose()});
    await back();await changeSeed(24);
    assert.deepEqual(await installed(),[]);assert.equal(await place(industry),null);
    await page.waitForFunction(()=>SphereBiomeSurface.inspect().installed===0);
    assert.equal(await row(meadow).getByRole('button',{name:'Install',exact:true}).count(),1);
    const other=await page.evaluate(()=>SphereBiomeLibrary.world);assert.notEqual(other.key,original.key);
    let release,intercept;
    const delayed=new Promise(r=>{intercept=r;}),gate=new Promise(r=>{release=r;});
    await page.route('**/api/installed-biomes',async route=>{
      if(route.request().method()==='PATCH'){intercept();await gate;}await route.fallback();
    });
    await row(outfall).getByRole('button',{name:'Install',exact:true}).click();
    await delayed;await changeSeed(23,false);release();
    await page.waitForFunction(n=>SphereBiomeLibrary.world?.params.seed===n,23);
    await page.unroute('**/api/installed-biomes');
    await page.waitForFunction(()=>SphereBiomeSurface.inspect().installed===3);
    assert.deepEqual(await installed(),initial);
    assert.deepEqual(disk().worlds[other.key].installed.map(i=>i.id),[meadow,outfall]);
    assert.deepEqual(disk().worlds[original.key].installed,initial);
    record('Pending install stayed in seed 24 while panel and atlas returned to 23',{originKey:original.key,otherKey:other.key,other:disk().worlds[other.key].installed});
    await close();await launch('visitor');
    assert.deepEqual(await installed(),initial);assert.equal(await place(industry),null);assert.equal(await page.evaluate(()=>SphereStageFrame.current),null);
    record('Second profile shares the three plots and starts with a fresh camera',{installed:(await installed()).map(i=>i.plotId)});
    assert.deepEqual(report.pageErrors,[]);report.status='PASS';
  } finally {
    await close();if(host)await host.close();
    fs.rmSync(dir,{recursive:true,force:true});
    if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
