'use strict';
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const {executable}=require('../tests/support/biome-browser.cjs');
const {disposable}=require('../tests/support/observatory-server.cjs');

// Reopen one recorded camera. For an overlap the caller can inspect either layer.
// The trace retains the original opacities and the departing/incoming timing.
async function replayFrame(page,trace,index,layerName){
  if(trace.format!=='sphere-pilot-trace'||trace.version!==1)throw Error('Expected a Sphere pilot trace, version 1');
  if(!Number.isInteger(index)||!trace.frames[index])throw Error('Choose a frame from 0 to '+(trace.frames.length-1));
  const frame=trace.frames[index];
  if(!layerName){
    const incoming=(frame.stage?.shellOpacity??0)*(frame.stage?.frameOpacity??0);
    const outgoing=(1-incoming)*(frame.departing?.shellOpacity??0)*(frame.departing?.frameOpacity??0);
    const main=1-incoming-outgoing;
    layerName=incoming>=main && incoming>=outgoing?'stage':outgoing>main?'departing':'main';
  }
  if(!['stage','departing','main'].includes(layerName))throw Error('Choose stage, departing or main');
  if(layerName!=='main' && !frame[layerName]?.pose)throw Error('The selected layer had no camera at this frame');
  const scene=layerName==='main'?null:frame[layerName];
  // Match the view window even if the pilot changed window size or closed the side panel.
  for(let i=0;i<2;i++){
    const box=await page.locator('#viewport').boundingBox(),current=page.viewportSize();
    if(!current||!box || (box.width===frame.width && box.height===frame.height))break;
    await page.setViewportSize({width:Math.max(1,Math.round(current.width+frame.width-box.width)),
      height:Math.max(1,Math.round(current.height+frame.height-box.height))});
  }
  return page.evaluate(async({initial,worldKey,placements,main,windTime,scene,passage})=>{
    const app=SphereApp,stage=SphereStageFrame,lib=SphereBiomeLibrary;
    if(!stage.showMain())throw Error('A handoff is still in progress');
    const {mode,...camera}=main;
    app.setPlaying(false);
    app.setState({...initial,...camera,walkMode:mode==='walk',playing:false});
    await lib.selectWorld(app.getState());
    if(lib.world.key!==worldKey)throw Error('The recorded world definition does not match this build');
    for(const p of placements){
      if(!p.edgeId && !lib.placed().some(x=>x.packId===p.packId) && p.plotId)
        await lib.placeRegion(p.packId,{plotId:p.plotId,footprint:p.footprint});
      if(p.detailInstalled!==false && !lib.installed().some(x=>x.packId===p.packId))await lib.install(p.packId);
      const item=lib.placed().find(x=>x.packId===p.packId);
      if(item?.plotId!==p.plotId || item?.edge?.id!==p.edgeId)
        throw Error('The recorded placement of '+p.packId+' is unavailable in this build');
    }
    if(Number.isFinite(windTime))stage.setMeadowWind({time:windTime,playing:false});
    if(!scene){await SphereLoading.ensureCurrent();app.draw();return {id:'main',pose:app.cameraSample()};}
    if(passage){
      if(!await stage.walkGround(passage.near,passage,scene.pose))throw Error('Could not restore the recorded passage');
    }else{
      const result=await stage.open(scene.id,{entry:{geographic:true,active:false,pose:{...scene.pose},
        horizontalFov:scene.horizontalFov,group:scene.group,windTime}});
      if(result?.status!=='arrived' && result?.status!=='taken-over')throw Error('Could not restore the recorded pack camera');
    }
    if(Number.isFinite(windTime))stage.setMeadowWind({time:windTime,playing:false});
    const api=document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;
    return {id:stage.current.id,pose:api?.pose()};
  },{initial:trace.initial,worldKey:trace.world.key,placements:trace.placements,main:frame.main,windTime:frame.windTime,
    scene,passage:trace.passages?.[scene?.passage]});
}

async function main(){
  const [input,framePath,output,layer]=process.argv.slice(2);
  if(!input||!framePath||!output)throw Error('Usage: node tools/replay-pilot-frame.cjs trace.json frame-number output.png [stage|departing|main]');
  const trace=JSON.parse(await fs.readFile(input,'utf8'));
  const server=await disposable(process.env.SPHERE_TEST_TRANSPORT||'http');
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:executable()});
    const context=await browser.newContext({viewport:{width:trace.viewport.windowWidth,height:trace.viewport.windowHeight},
      deviceScaleFactor:trace.viewport.pixelRatio});
    await server.attach(context);
    const page=await context.newPage();page.setDefaultTimeout(180000);
    await page.goto(server.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    const restored=await replayFrame(page,trace,Number(framePath),layer);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const clip=await page.locator('#viewport').boundingBox();
    await page.screenshot({path:output,clip});
    console.log('Restored frame',framePath,'in',restored.id,restored.pose);
  }finally{await browser?.close();await server.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={replayFrame};
