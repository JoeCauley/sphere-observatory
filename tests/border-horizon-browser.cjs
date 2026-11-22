// Compare a shallow turn above a station and walk from its native apron onto ungraded terrain.
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

async function main() {
  const host = await session();
  const browser = await chromium.launch({headless: true, executablePath: executable()});
  try {
    const context = await browser.newContext({viewport: {width: 1180, height: 740}});
    await host.attach(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(120000);
    await page.goto(host.origin, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereBiomeLibrary?.world && window.SphereStageFrame);
    await page.evaluate(async disposable => {
      SphereApp.setPlaying(false);
      const id = 'border-transport';
      if (!SphereBiomeLibrary.entry(id)) {
        if (!disposable) throw Error('This test needs an installed Border Biome in the selected world.');
        await SphereBiomeLibrary.install(id);
      }
      const geo = await import('./geographic-flight.js');
      const item = SphereBiomeLibrary.entry(id);
      const site = item.transport.sites.find(s => s.bay === 0);
      const cameraAt = (northM, altitudeM, pitch) => {
        const camera = {eastM: site.x + 1300, northM, altitudeM, yaw: 0, pitch, mode: 'flight'};
        SphereApp.setState({...geo.mainPose(SphereApp.getState(), item, camera, SphereAtlas, SphereWorld), speed: 3, autoSpeed: false});
        SphereApp.draw();
      };
      window.surveyPitch = pitch => cameraAt(site.widthM / 4, 36000, pitch);
      window.aboveApron = () => cameraAt(site.widthM / 2 + 3480, 2424, -.04);
      window.apronReading = () => {
        const s = SphereApp.getState();
        return {owner: SphereStageFrame.current?.id, world: SphereBiomeLibrary.world.key, walking: s.walkMode,
          floorDistance: geo.packPose(s, item, SphereAtlas, SphereWorld).northM - site.widthM / 2,
          height: (s.radius - Math.hypot(...s.position)) * 1000,
          clearance: s.walkMode ? SphereLanding.heightAboveGround(s) * 1000 : null};
      };
      window.surveyPitch(Math.asin(.1) - .002);
      await SphereLoading.ensureCurrent();
    }, !process.env.SPHERE_URL);
    await page.waitForFunction(() => {
      const s = document.querySelector('#viewport canvas[data-station]');
      return SphereLoading.ready && !SphereStageFrame.current && s && !s.hidden && +s.style.opacity > .99;
    }).catch(async error => {
      console.error(await page.evaluate(() => ({loading: SphereLoading.error??SphereLoading.active, stage: SphereStageFrame.current,
        altitude: document.getElementById('altitudeReadout').textContent, status: document.getElementById('biomeLibraryStatus').textContent,
        survey: document.querySelector('#viewport canvas[data-station]')?.outerHTML})));
      throw error;
    });
    const rect = await page.locator('#viewport').boundingBox();
    const clip = {x: Math.ceil(rect.x + .16 * rect.width), y: Math.ceil(rect.y + .2 * rect.height),
      width: Math.floor(.68 * rect.width), height: Math.floor(.51 * rect.height)};
    const samples = [];
    for (const offset of [-.002, .002, -.002]) {
      await page.evaluate(d => window.surveyPitch(Math.asin(.1) + d), offset);
      await page.waitForTimeout(350);
      samples.push((await page.screenshot({clip})).toString('base64'));
    }
    const deltas = await page.evaluate(async samples => {
      const canvas = new OffscreenCanvas(96, 64), ctx = canvas.getContext('2d', {willReadFrequently: true});
      const pixels = [];
      for (const sample of samples) {
        const bytes = Uint8Array.from(atob(sample), c => c.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        pixels.push(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        image.close();
      }
      return pixels.slice(1).map((b, k) => {
        let sum = 0;
        for (let i = 0; i < b.length; i++) if (i % 4 !== 3) sum += Math.abs(b[i] - pixels[k][i]);
        return sum / (canvas.width * canvas.height * 3 * 255);
      });
    }, samples);
    console.log('Mean screen RGB change over 0.23 degrees, outward and back', deltas);
    assert(deltas.every(d => d < .045), 'A small pitch change replaced the regional landscape');
    await page.evaluate(() => window.aboveApron());
    await page.locator('#viewport').focus();
    await page.keyboard.down('KeyQ');
    try {
      await page.waitForFunction(() => window.apronReading().walking);
    } finally { await page.keyboard.up('KeyQ'); }
    await page.waitForFunction(() => !SphereLoading.active && Math.abs(window.apronReading().height - 1.72) < .04);
    const landed = await page.evaluate(() => window.apronReading());
    assert(!landed.owner && Math.abs(landed.floorDistance - 3480) < 1);
    await page.locator('#viewport').focus();
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    try {
      await page.waitForFunction(() => window.apronReading().floorDistance > 3610);
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
    }
    const walked = await page.evaluate(() => window.apronReading());
    assert(walked.walking && !walked.owner && walked.world === landed.world);
    assert(Math.abs(walked.clearance - 1.72) < .03, 'The walker lost the support of the native mesh');
    assert.deepEqual(errors, []);
    console.log('Walked from the native apron over its graded edge', {landed, walked});
  } finally {
    await browser.close();
    await host.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
