'use strict';

const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

async function main() {
  const server = await session();
  const browser = await chromium.launch({headless:true, executablePath:executable()});
  let release;
  try {
    const context = await browser.newContext({viewport:{width:1180,height:740}});
    await server.attach(context);
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(server.origin+'/?border=wall', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows.length);
    const start = await page.evaluate(async () => {
      const stage = SphereStageFrame, lib = SphereBiomeLibrary, state = SphereApp.getState();
      const border = lib.entry('border-transport'), row = stage.transportAddress().rows.find(r=>r.site.bay===0);
      const {station} = await stage.stationExterior(row.site.address,lib.persistence==='file');
      const service = station.routes.find(r=>r.id==='service');
      const geo = await import('./geographic-flight.js');
      // The walker has backed into the shared gallery and is still looking out at Meadow.
      const pose = {eastM:row.site.x+service.nearDoor[0],northM:-station.widthM/2+36,
        altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'};
      const world = geo.mainPose(state,border,pose,SphereAtlas,SphereWorld);
      const magnitude = Math.hypot(...world.position);
      const point = {id:border.id,pack:true,q:world.position.map(n=>n/magnitude),forward:world.forward};
      const meadowPose = geo.packPose({...world,walkMode:true},lib.entry('infinite-meadow'),SphereAtlas,SphereWorld);
      const opened = await stage.open('infinite-meadow',{entry:{geographic:true,active:false,pose:meadowPose,horizontalFov:72}});
      if(opened?.status!=='arrived')throw Error('Failed to open native Meadow: '+(opened?.detail??opened?.status));
      window.departingMeadow = document.querySelector('#stageFrame iframe');
      window.enterStation = () => stage.walkGround(point,null,pose);
      window.flyIntoStation = () => stage.crossSurface(departingMeadow.contentWindow,
        {geographic:true,pose:{...pose,mode:'flight'}},border);
      return departingMeadow.contentWindow.SphereBiome.pose();
    });
    const wait = new Promise(resolve=>{release=resolve;});
    await page.route('**/packs/kit/meadow-bridge.mjs', async route => {
      await wait;
      await route.fulfill({contentType:'text/javascript',body:
        'export function createMeadowBridge(){throw new Error("test doorway allocation failure");}'});
    });
    await page.evaluate(()=>{window.crossingResult=enterStation();});
    await page.waitForFunction(()=>{
      const api=document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;
      return api?.id==='border-transport' && api.inspect().bridge?.loading && api.inspect().frames>=3;
    });
    assert(await page.evaluate(()=>departingMeadow.isConnected &&
      departingMeadow.closest('section')?.id==='departingStageFrame' &&
      getComputedStyle(departingMeadow.closest('section')).opacity==='1' &&
      document.querySelector('#stageFrame').style.opacity==='0'), 'The source must cover the unprepared aperture');
    release();
    const transferred = await page.evaluate(()=>crossingResult);
    assert.equal(transferred,false,'A failed provider must cancel the exchange');
    const restored = await page.evaluate(()=>({
      owner:SphereStageFrame.current?.id,pose:departingMeadow.contentWindow?.SphereBiome?.pose(),
      visible:document.querySelector('#stageFrame iframe')===departingMeadow && !departingMeadow.closest('section')?.inert,
      leftovers:document.querySelectorAll('#departingStageFrame').length
    }));
    assert.equal(restored.owner,'infinite-meadow');assert.equal(restored.visible,true);assert.equal(restored.leftovers,0);
    assert.deepEqual(restored.pose,start,'A failed exchange must preserve the departing camera');
    // A fresh key must reach the original window with no click after the rollback.
    await page.keyboard.down('ArrowRight');
    try {await page.waitForFunction(yaw=>Math.abs(departingMeadow.contentWindow.SphereBiome.pose().yaw-yaw)>.02,start.yaw,{timeout:5000});}
    finally {await page.keyboard.up('ArrowRight');}
    await page.getByRole('button',{name:'Stay here'}).click();
    assert.equal(await page.evaluate(()=>flyIntoStation()),false);
    assert.match(await page.locator('#transitPhase').innerText(),/test doorway allocation failure/);
    assert(await page.getByRole('button',{name:'Retry crossing'}).isVisible());
    const newReceivers=await page.evaluate(async()=>{
      let count=0;
      const observer=new MutationObserver(records=>{
        for(const record of records)for(const node of record.addedNodes)if(node.id==='stageFrame')count++;
      });
      observer.observe(departingMeadow.closest('section').parentElement,{childList:true});
      const child=departingMeadow.contentWindow;
      child.dispatchEvent(new child.KeyboardEvent('keydown',{code:'KeyA',bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,650));
      child.dispatchEvent(new child.KeyboardEvent('keyup',{code:'KeyA',bubbles:true}));
      observer.disconnect();return count;
    });
    assert.equal(newReceivers,0,'A failed geographic transition must not launch a replacement each polling interval');
    console.log('A delayed doorway failure retained the visible camera, restored input, and paused automatic retries.');
  } finally {
    release?.();
    await browser.close();
    await server.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
