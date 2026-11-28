// Conformance test for the Sphere biome contract (sphere-biome/1). See packs/CONTRACT.md.
//
// Opens every contract biome in packs/biome-library.json on its own (not through Main, so no
// flight sound is made) and checks what the host relies on: it loads and says so, a lift-off
// reaches the height asked for inside its blind without moving the saved place, the controls
// take a lift-off back, a held arrival waits, ignores the controls and settles, and the place
// last stood in is what is saved throughout.
//
//   npm run test:contract                      all contract biomes, real Chrome, server on 8766
//   SPHERE_CONTRACT_PACKS=sideways-city        only these ids (comma separated)
//   SPHERE_URL, SPHERE_NATIVE_BROWSER          as the other browser tests
//   SPHERE_CONTRACT_HEADLESS=1                 no window
//   SPHERE_CONTRACT_ARGS="--a --b"             extra browser arguments (software GL, for example)
//   SPHERE_CONTRACT_TIMEOUT_MS                 limit for each wait (default 120000)
//   SPHERE_CONTRACT_OUTPUT=<folder>            also write contract-tests.json there
//
// Durations are not checked: a hidden or software-drawn page runs slowly. Only what happens is.
const fs = require('node:fs'), path = require('node:path'), { chromium } = require('playwright');
const { session, executable } = require('./support/biome-browser.cjs');
let url;
const LIMIT = Number(process.env.SPHERE_CONTRACT_TIMEOUT_MS) || 120000;
const only = (process.env.SPHERE_CONTRACT_PACKS || '').split(',').map(s => s.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];

(async () => {
  const server = await session();
  url = server.origin + '/';
  const browser = await chromium.launch({
    headless: process.env.SPHERE_CONTRACT_HEADLESS === '1',
    executablePath: executable(),
    args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', ...(process.env.SPHERE_CONTRACT_ARGS || '').split(' ').filter(Boolean)]
  });
  const library = JSON.parse((await server.dispatch(url + 'packs/biome-library.json')).body);
  const packs = library.packs.filter(p => p.contract === 'sphere-biome/1').flatMap(owner => [
    { ...owner, ownerId: owner.id },
    ...Object.entries(owner.facilities ?? {}).map(([facility, site]) =>
      ({ ...site, ownerId: owner.id, version: owner.version, facility }))
  ]).filter(site => !only.length || only.includes(site.id) || only.includes(site.ownerId));
  if (!packs.length) throw Error('No contract biomes to test');

  for (const pack of packs) {
    const record = { id: pack.id, version: pack.version, checks: [], failed: 0 };
    results.push(record);
    const check = (name, ok, detail) => { record.checks.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); if (!ok) record.failed++; console.log((ok ? 'PASS ' : 'FAIL ') + pack.id + ' : ' + name + (ok || detail === undefined ? '' : ' : ' + JSON.stringify(detail))); };
    const near = (a, b, part) => Math.abs(a - b) <= Math.abs(b) * part;

    // A fresh browser profile each time: every scene starts from the pack's own first place.
    const open = async query => {
      const context = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await context.newPage(), errors = [];
      await server.attach(context);
      page.setDefaultTimeout(LIMIT);
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
      await page.goto(url + pack.entry + query);
      await page.waitForFunction(() => window.SphereBiome?.contract === 'sphere-biome/1');
      const drew = await page.evaluate(limit => Promise.race([window.SphereBiome.ready.then(() => true), new Promise(r => setTimeout(() => r(false), limit))]), LIMIT);
      return { context, page, errors, drew };
    };
    const look = page => page.evaluate(() => ({ pose: window.SphereBiome.pose(), ...window.SphereBiome.inspect() }));
    // The saved place, whatever else the pack keeps beside it (clocks, settings).
    const place = page => page.evaluate(key => { const ok = window.SphereBiome.save(), s = JSON.parse(localStorage.getItem(key) ?? 'null'); return { ok, place: JSON.stringify(s?.pose ?? s?.state?.pose ?? null) }; }, pack.saveKey);
    const until = async (page, test) => { const end = Date.now() + LIMIT; for (;;) { const value = await page.evaluate(test); if (value || Date.now() > end) return value; await sleep(200); } };

    let first = null, blind = null;
    try {
      // 1. Loads, says what it is, lifts off into its blind, keeps the saved place.
      {
        const { context, page, errors, drew } = await open('');
        check('ready resolves after the scene has drawn', drew);
        const said = await page.evaluate(() => { const b = window.SphereBiome, air = b.air(), pose = b.pose(), seen = b.inspect(); return { id: b.id, facility: b.facility, version: b.version, members: ['ready', 'arrived', 'pose', 'ascend', 'begin', 'save', 'dispose', 'air', 'inspect'].filter(k => b[k] === undefined), air, pose, seen }; });
        check('owner, facility and version match the library entry',
          said.id === pack.ownerId && said.facility === pack.facility && said.version === pack.version,
          { id: said.id, facility: said.facility, version: said.version });
        check('every contract member is present', said.members.length === 0, said.members);
        check('pose() has place, heading and mode', ['eastM', 'northM', 'altitudeM', 'yaw', 'pitch'].every(k => Number.isFinite(said.pose[k])) && ['walk', 'flight'].includes(said.pose.mode), said.pose);
        check('inspect() reports veil, frames, scripted and held', Number.isFinite(said.seen.veil) && Number.isFinite(said.seen.frames) && said.seen.scripted === false && said.seen.held === false, said.seen);
        blind = said.air?.blind ?? null;
        check('air() declares haze layers and a blind (or null)', Array.isArray(said.air?.haze) && (blind === null || (blind.baseM > blind.edgeM && blind.topM > blind.baseM && blind.edgeM > 0)), said.air);
        first = await place(page);
        check('save() writes under the library saveKey', first.ok && first.place !== 'null', first);
        const target = blind ? (blind.baseM + blind.topM) / 2 : 1500000;
        await page.evaluate(to => { window.__lift = null; window.SphereBiome.ascend({ toAltitudeM: to, handoff: true }).then(r => { window.__lift = r; }); }, target);
        const scripted = (await look(page)).scripted;
        check('a lift-off is scripted while it runs', scripted === true);
        const lifted = await until(page, () => window.__lift);
        const top = await look(page);
        check('ascend resolves revealed', lifted === 'revealed', lifted);
        check('it reaches the height asked for', near(top.pose.altitudeM, target, .02), { asked: target, reached: top.pose.altitudeM });
        check('it ends looking straight down', top.pose.pitch <= -1.4, top.pose.pitch);
        if (blind) check('inside its blind the view is fully veiled', top.veil === 1, top.veil);
        check('a lift-off does not move the saved place', (await place(page)).place === first.place);
        const again = await page.evaluate(async to => { const t = performance.now(), r = await window.SphereBiome.ascend({ toAltitudeM: to, handoff: true }); return { r, ms: performance.now() - t }; }, target);
        check('a second lift-off returns at once', again.r === 'revealed' && again.ms < 500, again);
        const after = await page.evaluate(key => { window.SphereBiome.dispose(); const s = JSON.parse(localStorage.getItem(key) ?? 'null'); return JSON.stringify(s?.pose ?? s?.state?.pose ?? null); }, pack.saveKey);
        check('dispose saves the place last stood in, not the height reached', after === first.place);
        check('no page errors (lift-off)', errors.length === 0, errors);
        await context.close();
      }
      // 2. The controls take a lift-off back.
      {
        const { context, page, errors } = await open('');
        await page.evaluate(() => { window.__lift = null; window.SphereBiome.ascend({ toAltitudeM: 3000 }).then(r => { window.__lift = r; }); });
        await until(page, () => window.SphereBiome.inspect().scripted && window.SphereBiome.pose().mode === 'flight');
        await page.locator('canvas').first().focus().catch(() => {});
        await page.keyboard.down('KeyW'); await sleep(300); await page.keyboard.up('KeyW');
        const taken = await until(page, () => window.__lift);
        check('a movement key during a lift-off resolves taken-over', taken === 'taken-over', taken);
        check('and the script stops', (await look(page)).scripted === false);
        check('no page errors (take-over)', errors.length === 0, errors);
        await context.close();
      }
      // 3. A held arrival from its own blind.
      {
        const { context, page, errors, drew } = await open('?arrival=air&hold=1&fromM=blind');
        check('a held arrival draws and says ready', drew);
        const held = await look(page);
        check('it waits: scripted and held', held.scripted === true && held.held === true, { scripted: held.scripted, held: held.held });
        if (blind) {
          check('it waits in the middle of its blind, fully veiled', near(held.pose.altitudeM, (blind.baseM + blind.topM) / 2, .02) && held.veil === 1, { altitudeM: held.pose.altitudeM, veil: held.veil });
        }
        await page.keyboard.press('KeyW'); await page.mouse.click(480, 270); await sleep(400);
        const still = await look(page);
        check('the controls are refused while it waits', still.held === true && still.pose.altitudeM === held.pose.altitudeM && still.pose.eastM === held.pose.eastM && still.pose.northM === held.pose.northM, still.pose);
        await page.evaluate(() => { window.__landed = null; window.SphereBiome.begin().then(r => { window.__landed = r ?? true; }); });
        const landed = await until(page, () => window.__landed);
        const down = await look(page);
        check('begin() releases it and arrived resolves', !!landed, landed);
        check('it settles: no script, no veil, in flight below its blind', down.scripted === false && down.veil === 0 && down.pose.mode === 'flight' && (!blind || down.pose.altitudeM < blind.baseM - blind.edgeM), { altitudeM: down.pose.altitudeM, veil: down.veil, mode: down.pose.mode });
        check('an arrival does not move the saved place', (await place(page)).place === first.place);
        check('the arrival is removed from the address', !/arrival=/.test(await page.evaluate(() => location.search)), await page.evaluate(() => location.search));
        check('no page errors (arrival)', errors.length === 0, errors);
        await context.close();
      }
    } catch (error) { check('the test ran to the end', false, String(error.message ?? error).slice(0, 300)); }
  }

  await browser.close();
  await server.close();
  const report = { date: new Date().toISOString(), contract: 'sphere-biome/1', url, pass: results.every(r => r.failed === 0), packs: results, scope: 'Each contract biome opened on its own. What happens, not how long it takes or how it looks. Flights between biomes through Main are separate.' };
  const output = process.env.SPHERE_CONTRACT_OUTPUT; if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'contract-tests.json'), JSON.stringify(report, null, 2)); }
  console.log('\n' + results.map(r => `${r.id} ${r.version}: ${r.checks.length - r.failed} of ${r.checks.length} pass`).join('\n'));
  process.exit(report.pass ? 0 : 1);
})().catch(error => { console.error('FAILED', error); process.exit(1); });
