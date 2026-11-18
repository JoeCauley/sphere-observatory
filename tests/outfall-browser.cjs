'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const {start}=require('./support/observatory-server.cjs');
const {executable}=require('./support/biome-browser.cjs');
async function main(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sphere-outfall-')),storePath=path.join(dir,'installed.json');
  const transport=process.env.SPHERE_TEST_TRANSPORT||'http',errors=[],steps=[];
  let host,context,page,port=0;
  const note=(name,value)=>{steps.push({name,value});console.log('PASS',name);};
  const inScene=fn=>page.frameLocator('#stageFrame iframe').locator('body').evaluate(fn);
  async function launch(){
    host=await start({port,transport,storePath});port=host.port;
    context=await chromium.launchPersistentContext(path.join(dir,'profile'),{headless:true,executablePath:executable(),viewport:{width:1024,height:600},args:['--mute-audio','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
    await host.attach(context);await context.addInitScript(()=>{if(window===top)localStorage.setItem('sphere-stage-sound','off');});
    page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(155000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host.origin+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereBiomeLibrary?.world&&document.querySelector('#biomeLibraryList article'));
  }
  async function quit(){if(context){await context.close();context=null;}if(host){await host.close();host=null;}}
  const row=()=>page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:/^The Outfall /})});
  async function settled(){
    await page.waitForFunction(()=>SphereStageFrame.lastArrival?.to==='border-outfall'&&SphereStageFrame.lastArrival.status==='arrived'&&!SphereStageFrame.flying
      &&document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect().scripted===false);
  }
  async function visit(){await row().getByRole('button',{name:'Visit',exact:true}).click();await settled();}
  async function leave(){await page.getByRole('button',{name:'Return to the Sphere',exact:true}).click();await page.waitForFunction(()=>!SphereStageFrame.current&&!SphereStageFrame.flying);}
  try{
    await launch();await row().getByRole('button',{name:'Install',exact:true}).click();
    await page.waitForFunction(()=>!!SphereBiomeLibrary.entry('border-outfall'));
    const assignments=await page.evaluate(()=>SphereBiomeLibrary.installed());
    assert.deepEqual(assignments.map(i=>i.id),['infinite-meadow','border-outfall']);
    const edge=assignments[1].edge;
    assert.equal(edge.near,'r12c35');assert.equal(edge.far,'r13c34');
    assert(Math.abs(edge.longitude*180/Math.PI-60)<1e-8);
    note('One install placed Meadow and its adjoining Border edge',{anchor:assignments[0].plotId,edge});
    await visit();const frame=page.frameLocator('#stageFrame iframe');
    await frame.locator('#world').focus();await page.keyboard.press('KeyF');
    await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
    try{
      await page.waitForFunction(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().northM>=10.7,null,{timeout:24000});
    }finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
    const inside=await inScene(()=>SphereBiome.pose());assert.equal(inside.mode,'walk');assert(inside.northM>10);
    assert(await frame.locator('#action').isVisible());await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>{const s=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.inspect();return !s.valveOpen&&s.levels[0]<.55&&s.levels[1]>.64&&s.levels[2]>.8;});
    const response=await inScene(()=>SphereBiome.inspect());assert(response.levels[0]<response.levels[1]&&response.levels[1]<response.levels[2]);
    await frame.locator('#save').click();note('Walked in and shut the bypass; downstream kept flowing',{inside,levels:response.levels});
    await leave();await visit();
    let restored=await inScene(()=>({pose:SphereBiome.pose(),state:SphereBiome.inspect()}));
    assert.deepEqual(restored.pose,inside);assert.equal(restored.state.valveOpen,false);
    note('Public Return and Visit brought the traveler back to the valve',{pose:restored.pose,open:restored.state.valveOpen});
    await quit();await launch();await settled();
    restored=await inScene(()=>({pose:SphereBiome.pose(),state:SphereBiome.inspect()}));
    assert.deepEqual(restored.pose,inside);assert.equal(restored.state.valveOpen,false);
    assert.deepEqual(await page.evaluate(()=>SphereBiomeLibrary.installed()),assignments);
    await page.frameLocator('#stageFrame iframe').locator('#action').click();
    await page.waitForFunction(()=>{const s=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.inspect();return s.valveOpen&&s.levels[0]>.6&&s.levels[1]<s.levels[0]&&s.levels[2]<s.levels[1];});
    note('Cold reopen retained the valve and viewpoint; reopening the bypass refilled the channel',{pose:restored.pose,levels:await inScene(()=>SphereBiome.inspect().levels)});
    assert.deepEqual(errors,[]);
    if(process.env.SPHERE_OUTFALL_OUTPUT)fs.writeFileSync(process.env.SPHERE_OUTFALL_OUTPUT,JSON.stringify({transport,steps,errors},null,2)+'\n');
  }finally{await quit();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
