'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {setTimeout: sleep} = require('node:timers/promises');
const {chromium} = require('playwright');
const {session, executable} = require('../tests/support/biome-browser.cjs');
const recorder = require('./transition-recorder.cjs');
require('./compositor-film.cjs');

const meadow = 'infinite-meadow', border = 'border-transport';

async function main() {
  const directory = path.resolve(process.argv[2] || 'films/manual-roof');
  const seed = Number(process.argv[3] || 713);
  const host = await session();
  const browser = await chromium.launch({headless: true, executablePath: executable(),
    args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']});
  try {
    const context = await browser.newContext({viewport: {width: 1280, height: 756}});
    await host.attach(context);
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(host.origin, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereBiomeLibrary?.world && window.SphereStageFrame);
    const meta = await page.evaluate(async ({seed, live}) => {
      SphereApp.setPlaying(false);
      if (SphereApp.getState().seed !== seed) {
        const registry = await fetch('/api/installed-biomes').then(r => r.json());
        const row = Object.values(registry.worlds).find(w => w.parameters.seed === seed);
        if (live && !row) throw Error('The requested seed has no installed world on this server.');
        SphereApp.setState({...SphereApp.getState(), ...(row?.parameters || {seed})});
        await SphereBiomeLibrary.selectWorld();
      }
      for (const id of ['infinite-meadow', 'border-transport']) {
        if (SphereBiomeLibrary.entry(id)) continue;
        if (live) throw Error('The selected world requires ' + id);
        await SphereBiomeLibrary.install(id);
      }
      const geo = await import('./geographic-flight.js');
      const item = SphereBiomeLibrary.entry('border-transport');
      const home = item.transport.sites.find(s => s.bay === 0);
      window.readRoof = () => {
        const s = SphereApp.getState(), frame = document.querySelector('#stageFrame iframe');
        const local = frame?.contentWindow?.SphereBiome, owner = local?.id || 'Main', pose = local?.pose();
        const view = pose ? geo.mainPose(s, SphereBiomeLibrary.entry(owner), pose, SphereAtlas, SphereWorld) : s;
        const p = geo.packPose(view, item, SphereAtlas, SphereWorld), stage = SphereStageFrame;
        return {owner, ready: local ? local.inspect().frames > 1 && !local.inspect().scripted && frame.surfaceEntry?.active !== false
          : !stage.current && !window.sphereStageCovered,
          leaving: !!document.querySelector('#departingStageFrame iframe'),
          x: p.eastM, z: p.northM, h: pose?.altitudeM ?? ((s.radius - Math.hypot(...s.position)) * 1000),
          yaw: p.yaw, pitch: pose?.pitch ?? p.pitch, half: home.widthM / 2, mode: pose?.mode || (s.walkMode ? 'walk' : 'flight'),
          groundM: !local && s.walkMode ? SphereLanding.heightAboveGround(s) * 1000 : null,
          loading: SphereLoading.active, station: local?.inspect().station || null,
          survey: document.querySelector('#viewport canvas[data-station]:not([hidden])')?.dataset.station};
      };
      return {seed, world: SphereBiomeLibrary.world.key, home, roofSlabM: geo.roofSlabM, edge: item.edge,
        build: (await fetch('/build-info.json').then(r => r.json())).commit};
    }, {seed, live: !!process.env.SPHERE_URL});
    const frame = page.frameLocator('#stageFrame iframe');
    const state = () => page.evaluate(() => window.readRoof());
    const focus = id => id === 'Main' ? page.locator('#viewport').focus() : frame.locator('canvas').first().focus();
    const pace = async value => { await frame.locator('#pace').selectOption(String(value)); await focus(border); };
    const speed = () => page.locator('#speed').evaluate(el => {
      el.value = '10'; el.dispatchEvent(new Event('change', {bubbles: true}));
    });
    async function until(test, timeout = 90000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const reading = await state();
        if (test(reading)) return reading;
        await sleep(30);
      }
      throw Error('Camera did not reach the expected position. ' + JSON.stringify(await state()));
    }
    async function hold(keys, test) {
      for (const k of keys) await page.keyboard.down(k);
      try { return await until(test); }
      finally { for (const k of keys.slice().reverse()) await page.keyboard.up(k); }
    }
    const marks = [];
    async function mark(label) {
      const reading = await state();
      marks.push({label, ...reading}); console.log(label, reading.owner, reading.z, reading.h);
      return reading;
    }
    // Before recording, use the service door to find the same near apron on each installation.
    const row = page.locator('#biomeLibraryList article').filter({has: page.getByRole('heading', {name: /^Border Biome /})});
    const visit = row.getByRole('button', {name: 'Visit', exact: true});
    if (!await visit.isVisible()) await page.getByRole('button', {name: 'Explore', exact: true}).first().click();
    await visit.click();
    await until(s => s.owner === border && s.ready && !s.leaving && s.h < 10, 150000);
    await pace(16);
    await hold(['KeyS'], s => s.owner === meadow && s.ready && !s.leaving);
    await focus(meadow); await page.keyboard.press('KeyF');
    await until(s => s.owner === meadow && s.mode === 'walk');

    const sample = async () => {
      const [camera, roof] = await Promise.all([page.evaluate(recorder.readCamera), state()]);
      return {...camera, roof};
    };
    const film = await recorder.record(page, directory, 'meadow-roof-crossing', async () => {
      await mark('01-meadow'); await sleep(700); await focus(meadow);
      await page.keyboard.down('Space'); await page.keyboard.press('KeyE'); await page.keyboard.up('Space');
      await until(s => s.owner === meadow && s.mode === 'flight'); await sleep(2200);
      await hold(['ShiftLeft', 'KeyE'], s => s.owner === 'Main' && s.ready && s.h >= 24000);
      await mark('02-main'); await speed(); await focus('Main');
      await hold(['KeyE'], s => s.h >= 30800); await mark('03-climb');
      await hold(['KeyW'], s => s.z > s.half - 12000);
      const course = await state();
      await hold(['KeyD'], s => Math.abs(s.x - course.x) > 1300); await mark('04-overhead');
      const r = await page.locator('#view').boundingBox(), x = r.x + .55 * r.width, y = r.y + .16 * r.height;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 84; i++) { await page.mouse.move(x, y + 6.2 * i); await sleep(18); }
      await page.mouse.up(); await focus('Main'); await sleep(700); await mark('05-approach');
      await hold(['KeyQ'], s => s.owner === border && s.ready); await mark('06-border-entry');
      await pace(1); const roofEye = meta.home.roofM + meta.roofSlabM + 1.7;
      await hold(['KeyQ'], s => Math.abs(s.h - roofEye) < .02);
      await frame.getByRole('button', {name: 'Walk', exact: true}).click(); await until(s => s.mode === 'walk');
      const roof = await mark('07-roof-landed'); await focus(border);
      if (roof.pitch < -.16) await hold(['ArrowUp'], s => s.pitch >= -.13);
      await pace(128); await hold(['KeyW'], s => s.z >= roof.z + 220);
      assert(Math.abs((await mark('08-roof-walked')).h - roofEye) < .02);
      await frame.getByRole('button', {name: 'Fly', exact: true}).click();
      await pace(16); await hold(['KeyE'], s => s.h >= 2450);
      if ((await state()).pitch < -.055) await hold(['ArrowUp'], s => s.pitch >= -.055);
      await hold(['KeyW'], s => s.owner !== border && s.ready && !s.leaving && s.z > s.half + 550);
      assert.equal((await mark('09-far-side')).owner, 'Main');
      await page.mouse.move(x, y + 145); await page.mouse.wheel(0, 1535); await sleep(250); await focus('Main');
      await hold(['KeyW'], s => s.z > s.half + 3370); await speed(); await focus('Main');
      await hold(['KeyQ'], s => s.mode === 'walk' && s.owner === 'Main');
      await until(s => !s.loading && Math.abs(s.groundM - 1.72) < .08);
      const landed = await mark('10-far-ground');
      assert(landed.z < landed.half + 3500 && Math.abs(landed.h - 1.72) < .12);
      await focus('Main'); await hold(['ShiftLeft', 'KeyW'], s => s.z > s.half + 3610);
      const walked = await mark('11-far-walk');
      assert(walked.owner === 'Main' && Math.abs(walked.groundM - 1.72) < .03);
      // Turn the camera back from the native side to check that the departed hall is still there.
      for (let turn = 0; turn < 2; turn++) {
        const x0 = r.x + .18 * r.width, y0 = r.y + .55 * r.height;
        await page.mouse.move(x0, y0); await page.mouse.down();
        for (let i = 1; i <= 50; i++) {
          await page.mouse.move(x0 + i * Math.PI / (.003 * 100), y0 - i * .35);
          await sleep(22);
        }
        await page.mouse.up();
      }
      await sleep(700); const back = await mark('12-look-back');
      assert(back.survey === meta.home.address.key && Math.cos(back.yaw - walked.yaw) < -.97);
      assert(Math.abs(back.z - walked.z) < .5 && back.owner === 'Main');
      await sleep(1200); return {meta, marks};
    }, {sample});
    assert.ifError(film.failure); assert.deepEqual(film.errors, []);
  } finally { await browser.close(); await host.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
