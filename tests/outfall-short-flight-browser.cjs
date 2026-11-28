'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const {executable,session} = require('./support/biome-browser.cjs');
const {disposable} = require('./support/observatory-server.cjs');

(async () => {
  const server = process.env.SPHERE_URL ? await session() : await disposable('http');
  const browser = await chromium.launch({headless: true, executablePath: executable()});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    page.setDefaultTimeout(150000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.origin, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => {
      if (document.getElementById('loadingActions')?.hidden === false) throw Error(document.getElementById('loadingStatus').textContent);
      return window.SphereLoading?.ready && window.SphereBiomeLibrary?.world;
    }, null, {timeout: 240000, polling: 100});
    await page.evaluate(async () => {
      const s = SphereApp.getState();
      if (s.seed !== 713) {s.seed = 713; SphereApp.setState(s); await SphereBiomeLibrary.selectWorld();}
      if(!SphereBiomeLibrary.entry('infinite-meadow'))await SphereBiomeLibrary.install('infinite-meadow');
      if(!SphereBiomeLibrary.entry('border-transport'))await SphereBiomeLibrary.install('border-transport');
    });
    await page.waitForFunction(() => !!SphereStageFrame.surfaceAddress(), null, {polling: 100});
    await page.evaluate(async () => {
      const geo = await import('/geographic-flight.js');
      const globe = {...SphereApp.getState(), position: [140078383.391, 120938.859, 52512424.993],
        forward: [-.16137, -.98201, .09806], up: [-.92381, .11535, -.36507], walkMode: false};
      const meadow = SphereBiomeLibrary.entry('infinite-meadow');
      const pose = geo.packPose(globe, meadow, SphereAtlas, SphereWorld, {exactAltitude: true});
      await SphereStageFrame.open(meadow.id, {entry: {geographic: true, active: false, pose, horizontalFov: 58.8}});
    });
    const frame = page.frameLocator('#stageFrame iframe');
    if (await frame.locator('#show').isVisible()) await frame.locator('#show').click();
    const before = await frame.locator('body').evaluate(() => window.SphereBiome.inspect());
    assert.match(before.exteriorStation, /r10c0\/r10c1\/0$/);
    assert.equal(before.surfaceEdge, 'north/r10c0/r11c0');
    console.log('PASS replayed the seed 713 camera beside Bay 0');
    const fly = frame.getByRole('button', {name: 'Fly the final 2.7 km'});
    if (process.argv.includes('--retry')) {
      // Exercise an existing failed tab. A single rejected upload uses the real failure and Retry handlers.
      await fly.evaluate(button => button.addEventListener('click', () => {
        const gl = document.getElementById('world').getContext('webgl2');
        const upload = gl.bufferData;
        gl.bufferData = () => {gl.bufferData = upload; throw Error('Pack GPU buffer limit exceeded');};
      }, {capture: true, once: true}));
      await fly.click();
      await frame.getByText('Pack GPU buffer limit exceeded', {exact: true}).waitFor();
      await frame.getByRole('button', {name: 'Try again'}).click();
      await page.waitForFunction(() => {
        const child = document.querySelector('#stageFrame iframe').contentWindow;
        return child.document.getElementById('packLoading')?.hidden && child.SphereBiome?.inspect().ready;
      });
      if (await frame.locator('#show').isVisible()) await frame.locator('#show').click();
      console.log('PASS Try again reopened the installed Meadow in the same tab');
    }
    await fly.click();
    await page.waitForFunction(() => {
      const frame = document.querySelector('#stageFrame iframe');
      const doc = frame?.contentDocument;
      if (doc?.querySelector('#packRetry')?.hidden === false) throw Error(doc.getElementById('packLoadingStatus').textContent);
      const info = frame?.contentWindow?.SphereBiome?.inspect();
      return SphereStageFrame.current?.id === 'infinite-meadow' && info?.rangeM > 2400 && info.rangeM < 2700 && info.levelCruising;
    }, null, {polling: 50});
    const memory = await frame.locator('body').evaluate(() => {
      document.getElementById('inspect').click();
      const evidence = JSON.parse(document.getElementById('evidenceText').value);
      document.getElementById('inspect').click();
      return {...evidence.pack.resources[0], station: SphereBiome.inspect().exteriorStation};
    });
    assert.equal(memory.station, null, 'The generic Atlas wall must release the dedicated Outfall opening');
    assert(memory.bufferBytes > 0 && memory.peakBufferBytes <= 8 * 1024 ** 2);
    console.log('PASS Meadow presented the Outfall approach within its buffer budget', memory.peakBufferBytes, 'bytes');
    if (process.env.SPHERE_SURFACE_OUTPUT) await page.screenshot({path: path.join(process.env.SPHERE_SURFACE_OUTPUT, 'outfall-final-approach.png')});
    await page.waitForFunction(() => {
      const frame = document.querySelector('#stageFrame iframe'), doc = frame?.contentDocument;
      if (doc?.querySelector('#packRetry')?.hidden === false) throw Error(doc.getElementById('packLoadingStatus').textContent);
      return SphereStageFrame.current?.id === 'border-transport/outfall' && SphereStageFrame.lastArrival?.route === 'surface' && frame.contentWindow.SphereBiome?.inspect().levelCruising;
    }, null, {polling: 100});
    await page.waitForFunction(() => {
      const pack = document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;
      return pack && !pack.inspect().levelCruising && Math.abs(pack.pose().northM + 18) < .1;
    }, null, {timeout: 180000});
    const finish = await frame.locator('body').evaluate(() => {
      const gl = document.getElementById('world').getContext('webgl2');
      return {pose: SphereBiome.pose(), contextLost: gl.isContextLost(), error: gl.getError()};
    });
    assert.equal(finish.contextLost, false);
    assert.equal(finish.error, 0);
    assert.deepEqual(errors, []);
    console.log('PASS final 2.7 km from seed 713 screenshot to the Outfall door', JSON.stringify(finish.pose));
    const canvas=frame.locator('#world');
    await canvas.focus();await page.keyboard.down('KeyQ');
    try{await page.waitForFunction(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.pose().altitudeM<5);}
    finally{await page.keyboard.up('KeyQ');}
    await page.keyboard.press('KeyF');await page.keyboard.down('KeyW');
    try{await frame.locator('#action').waitFor({state:'visible',timeout:35000});}
    finally{await page.keyboard.up('KeyW');}
    const valve=await canvas.evaluate(()=>({pose:SphereBiome.pose(),valveOpen:SphereBiome.inspect().valveOpen,error:document.getElementById('world').getContext('webgl2').getError()}));
    assert.equal(valve.pose.mode,'walk');assert.equal(valve.error,0);
    assert(Math.hypot(valve.pose.eastM-1.3,valve.pose.northM-12)<2.8);
    const released=await page.evaluate(()=>JSON.parse(SphereBiomeLibrary.saveStorage().getItem('sphere-pack-last-release-v1')));
    assert.equal(released.identity.id,'infinite-meadow');assert.equal(released.status,'disposed');
    assert.equal(released.release[0].bufferBytes,0);assert.equal(released.release[0].textureBytes,0);
    assert.deepEqual(errors,[]);
    if(process.env.SPHERE_SURFACE_OUTPUT){
      const out=process.env.SPHERE_SURFACE_OUTPUT;
      await page.locator('#viewport').screenshot({path:path.join(out,'outfall-bypass-valve.png')});
      require('node:fs').writeFileSync(path.join(out,'outfall-receipt.json'),JSON.stringify({memory,finish,valve,released,errors},null,2));
    }
    console.log('PASS landed and walked to the working bypass valve; Meadow released its buffers and textures',JSON.stringify(valve.pose));

  } finally {
    await browser.close(); await server.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
