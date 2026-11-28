'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { disposable } = require('./support/observatory-server.cjs');
const { executable } = require('./support/biome-browser.cjs');

async function main() {
  const server = await disposable('http');
  const browser = await chromium.launch({ headless: true, executablePath: executable() });
  try {
    const page = await browser.newPage({ viewport: { width: 1950, height: 1040 } });
    page.setDefaultTimeout(180000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.addInitScript(() => {
      if (top !== window) return;
      window.openingFrames = [];
      new MutationObserver(() => {
        const overlay = document.getElementById('sceneLoading');
        const bar = document.getElementById('loadingProgress');
        if (!overlay || !bar || overlay.hidden) return;
        const rect = overlay.getBoundingClientRect();
        const front = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        openingFrames.push({
          done: bar.value, total: bar.max, inFront: overlay.contains(front),
          estimate: document.getElementById('openingEstimate')?.textContent
        });
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['value', 'hidden'] });
    });
    await page.goto(server.origin + '/?border=wall', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.SphereLoading?.ready && document.querySelector('#sceneLoading')?.hidden);
    await page.evaluate(() => {
      SphereApp.setPlaying(false);
      document.getElementById('adaptivePreview').checked = false;
      SphereApp.setState({ ...SphereApp.getState(), playing: false, quality: 1 });
      window.approachSize = () => {
        const canvas = document.querySelector('#viewport canvas[data-station]:not([hidden])');
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect(), s = SphereApp.getState();
        return { raster: [canvas.width, canvas.height], bounds: [r.width, r.height],
          altitudeM: (s.radius - Math.hypot(...s.position)) * 1000, pack: SphereStageFrame.current?.id || null };
      };
    });
    await page.waitForFunction(() => window.approachSize());
    async function checkApproach(label) {
      const result = await page.waitForFunction(() => {
        const s = approachSize();
        return s && s.raster.every((size, i) => Math.abs(size - s.bounds[i]) <= 1) && s;
      });
      const size = await result.jsonValue();
      assert.equal(size.pack, null, 'The approach remains in Main');
      console.log(label, size);
      return size;
    }
    const cold = await checkApproach('Cold regional approach');
    assert(cold.raster[0] > 1440);
    assert(cold.altitudeM > 35000 && cold.altitudeM < 37000);
    await page.locator('#viewport').focus();
    await page.keyboard.down('KeyW');
    try { await page.waitForFunction(h => approachSize()?.altitudeM < h - 500, cold.altitudeM); }
    finally { await page.keyboard.up('KeyW'); }
    await checkApproach('After 500 metres of descent');
    await page.setViewportSize({ width: 1660, height: 920 });
    await checkApproach('Parked after resizing');

    await page.evaluate(async () => {
      const lib = SphereBiomeLibrary;
      await lib.install('violet-labyrinth');
      const { surveyPose } = lib.entry('violet-labyrinth').occurrence;
      const result = await SphereStageFrame.open('violet-labyrinth', { entry: {
        geographic: true, active: false, pose: surveyPose, horizontalFov: 90
      } });
      if (!['arrived', 'taken-over'].includes(result?.status)) {
        throw Error('Violet approach did not open. ' + JSON.stringify(result));
      }
      window.violetRaster = () => {
        const frame = document.querySelector('#stageFrame iframe');
        const canvas = frame?.contentDocument.querySelector('canvas');
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect(), native = SphereApp.renderer;
        return { owner: frame.contentWindow.SphereBiome.id, opacity: +frame.style.opacity,
          raster: [canvas.width, canvas.height], bounds: [r.width, r.height],
          shared: [native.canvas.width, native.canvas.height],
          height: frame.contentWindow.SphereBiome.pose().altitudeM,
          forkUniform: !!native.modernUniforms.uVioletFork, glError: native.gl.getError() };
      };
    });
    await page.setViewportSize({ width: 1950, height: 1040 });
    await page.waitForFunction(() => {
      const s = violetRaster();
      return s?.owner === 'violet-labyrinth' && s.raster[0] > 1440 &&
        s.raster.every((size, i) => Math.abs(size - s.bounds[i]) <= 1 && size === s.shared[i]);
    });
    const violet = await page.evaluate(() => violetRaster());
    console.log('Violet survey', violet);
    assert.equal(violet.opacity, 1);
    assert.equal(violet.height, 11355);
    assert.equal(violet.forkUniform, true);
    assert.equal(violet.glError, 0);
    const changedExposure = await page.evaluate(() => {
      const input = document.getElementById('exposure');
      input.value = +input.value === 1 ? '0' : '1';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return +input.value;
    });
    await page.waitForFunction(target => {
      const r = SphereApp.renderer;
      return r.gl.getUniform(r.resolve, r.resolveExposure) === target;
    }, changedExposure);
    assert.equal((await page.evaluate(() => violetRaster())).height, violet.height);

    const seen = await page.evaluate(() => openingFrames.filter(frame => frame.inFront && /45/.test(frame.estimate)));
    for (const step of [0, 1, 3]) assert(seen.some(frame => frame.done === step && frame.total === 4));
    assert.deepEqual(errors, []);
    console.log('PASS opening milestones, full-size approaches and the parked exposure control');
  } finally {
    await browser.close();
    await server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
