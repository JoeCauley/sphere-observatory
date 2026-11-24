// Capture a native habitat at walking height with the Duck Blind active.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

async function main() {
  const host = await session();
  const browser = await chromium.launch({executablePath: executable(), headless: true});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(host.origin);
    await page.waitForFunction(() => window.SphereLoading?.ready, null, {timeout: 150000});
    const result = await page.evaluate(async () => {
      SphereApp.setBusy(true);
      const renderer = SphereApp.renderer;
      const state = {...SphereMath.defaultState(), collection: true, siteId: 'biome-1', siteRevision: 2,
        multipleWounds: false, routeShades: false, starStation: false, atmosphere: 1,
        clouds: true, weatherStrength: .35, playing: false};
      state.siteAnchor = SphereWorld.locateBiome(1, state);
      const frame = SphereGround.frame(state);
      state.position = frame.world([.4,.1,.4]);
      state.forward = frame.basis[0];
      state.up = frame.basis[1];
      await renderer.prepare(state);
      SphereLanding.enter(state, state.position);
      for (let i = 0; i < 160; i++) SphereLanding.step(state, new Set(), 1/60);
      await renderer.prepare(state);
      renderer.draw(state, 800, 450, {exportFrame: true});
      const pass = renderer.weather.composite;
      return {image: renderer.canvas.toDataURL(), walking: state.walkMode, error: renderer.error(),
        blind: renderer.gl.getUniform(pass.p, pass.u.blindRange), bytes: SphereGround.info.bytes, budget: SphereGround.info.budget};
    });
    assert(result.walking && result.blind > 0);
    assert.equal(result.error, 0);
    assert(result.bytes <= result.budget);
    assert.deepEqual(errors, []);
    if (process.env.SPHERE_JUNGLE_IMAGE)
      fs.writeFileSync(process.env.SPHERE_JUNGLE_IMAGE, Buffer.from(result.image.split(',')[1], 'base64'));
    console.log('Super Jungle walking sky and terrain passed', result.bytes, '/', result.budget, 'bytes');
  } finally {
    await browser.close();
    await host.close();
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
