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
  const row=()=>page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:/^Border Biome /})});
  async function settled(){
    await page.waitForFunction(()=>SphereStageFrame.lastArrival?.to==='border-transport/outfall'&&SphereStageFrame.lastArrival.status==='arrived'&&!SphereStageFrame.flying
      &&document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect().scripted===false).catch(async error=>{
      const detail=await page.evaluate(()=>({arrival:SphereStageFrame.lastArrival,scene:SphereStageFrame.current,
        status:document.getElementById('biomeLibraryStatus')?.textContent,travel:SphereJourney.travel.status,pack:document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect()}));
      throw Error(error.message+' '+JSON.stringify(detail));
    });
  }
  async function visit(){await row().getByRole('button',{name:'Visit The Outfall',exact:true}).click();await settled();}
  async function leave(){await page.getByRole('button',{name:'Return to the Sphere',exact:true}).click();await page.waitForFunction(()=>!SphereStageFrame.current&&!SphereStageFrame.flying);}
  try{
    await launch();await page.evaluate(()=>SphereBiomeLibrary.install('infinite-meadow'));await row().getByRole('button',{name:'Install',exact:true}).click();
    await page.waitForFunction(()=>!!SphereBiomeLibrary.entry('border-transport/outfall'));
    const assignments=await page.evaluate(()=>SphereBiomeLibrary.installed());
    assert.deepEqual(assignments.map(i=>i.id),['infinite-meadow','border-transport']);
    const edge=assignments[1].outfall.edge;
    assert.equal(edge.near,'r12c35');assert.equal(edge.far,'r13c34');
    assert(Math.abs(edge.longitude*180/Math.PI-60)<1e-8);
    note('One Border owns the freight district and the adjoining Meadow Outfall',{anchor:assignments[0].plotId,edge});
    const samples=await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary,site=lib.sceneInfo('border-transport/outfall');
      const {createRenderer}=await import(new URL('render.js',new URL(site.entry,location.href)));
      const c=document.createElement('canvas');c.width=800;c.height=500;const renderer=createRenderer(c),gl=c.getContext('webgl2');
      const read=y=>{const rgba=new Uint8Array(4);gl.readPixels(400,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return [...rgba];};
      try{return [2500,12000,30000,60000].map(distance=>{
        const pose={eastM:1500,northM:-distance,altitudeM:100,yaw:0,pitch:Math.atan2(600,distance),mode:'flight'};
        const samples=[[.03,.12,.25],[.98,.87,.69]].map(color=>{
          gl.clearColor(...color,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          renderer.draw({pose,levels:[1,1,1]},0,1,{overMeadow:true,resize:false});
          return {wall:read(250),sky:read(490)};
        });
        return {distance,samples,error:gl.getError()};
      });}finally{renderer.dispose();}
    });
    for(const {distance,samples:[a,b],error} of samples){
      assert.deepEqual(a.wall,b.wall,'Background leaked through concrete at '+distance+' m');
      assert(Math.abs(a.sky[0]-b.sky[0])>220);assert.equal(error,0);
    }
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
