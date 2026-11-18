// Host integration for the public Visit, Fly to, recovery and saved-scene controls.
// Run against the current Observatory. Browser state and the install endpoint are isolated.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const { session, executable } = require('./support/biome-browser.cjs');
const output = process.env.SPHERE_STAGE_OUTPUT;
const industry = 'infinite-industry', city = 'sideways-city';
const industryName = 'Infinite Industry', cityName = 'The Sideways City';
const stageKey = 'sphere-stage-frame-v2';
const limit = 240000;
const root = path.resolve(__dirname, '..');
const industryEntry = require('../packs/biome-library.json').packs.find(p => p.id === industry).entry;
const industryPage = fs.readFileSync(path.join(root, industryEntry), 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const report = { status: 'INCOMPLETE', started: new Date().toISOString(), cases: [], pageErrors: [] };
function writeReport() {
  if (output) fs.writeFileSync(path.join(output, 'arrival-tests.json'), JSON.stringify(report, null, 2) + '\n');
}
function record(name, observation) {
  report.cases.push({ name, observedAt: new Date().toISOString(), ...observation });
  console.log('PASS', name);
  writeReport();
}

// This wrapper runs only in the deliberately faulty child document. Requests made
// by the pack to verify its own files still receive the original source bytes.
function installFault(fault) {
  if (fault === 'arrival-takeover') history.replaceState(null, '', location.pathname);
  const probe = parent.__arrivalProbe = { fault, installed: false, begins: 0 };
  const pending = new Promise(() => {});
  let exposed;
  Object.defineProperty(window, 'SphereBiome', { configurable: true, get() { return exposed; }, set(api) {
    probe.installed = true;
    exposed = { ...api };
    if (fault === 'pending-ready') exposed.ready = pending;
    if (fault === 'pending-arrived') exposed.arrived = pending;
    if (fault === 'rejected-ready') {
      exposed.ready = api.ready.then(() => { throw Error('Destination rejected readiness'); });
      exposed.ready.catch(() => {});   // the injected failure can precede the host's first poll
    }
    if (fault === 'premature-arrived') exposed.arrived = Promise.resolve('arrived');
    if (fault === 'arrival-takeover') exposed.arrived = Promise.resolve('taken-over');
    exposed.begin = () => {
      probe.begins++;
      const look = api.inspect();
      probe.atBegin = { held: look.held, scripted: look.scripted, frames: look.frames };
      if (fault === 'pending-arrived' || fault === 'premature-arrived') return Promise.resolve('arrived');
      if (fault === 'arrival-takeover') return exposed.arrived;
      if (fault === 'slow-moving' || fault === 'overlong-moving') {
        setTimeout(() => { probe.firstDeadline = true; parent.__advanceArrivalClock(45100); }, 2000);
        if (fault === 'overlong-moving') setTimeout(() => { probe.hardDeadline = true; parent.__advanceArrivalClock(90200); }, 4500);
      }
      return api.begin();
    };
  }});
}

async function main() {
  if (output) fs.mkdirSync(output, { recursive: true });
  const server = await session();
  const url = server.origin + '/';
  const browser = await chromium.launch({
    executablePath: executable(),
    headless: true,
    args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
  });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1080, height: 650 } });
  try {
    await server.attach(context);
    let store = { schema: 1, worlds: {} }, fault = null;
    if (process.env.SPHERE_URL) await context.route('**/api/installed-biomes', async route => {
      if (route.request().method() === 'PUT') store = route.request().postDataJSON();
      if (route.request().method() === 'PATCH') {
        const change = route.request().postDataJSON();
        store.worlds[change.key] = { parameters: change.parameters, installed: change.installed };
      }
      await route.fulfill({ json: store });
    });
    await context.addInitScript(() => {
      if (window === window.top) { localStorage.setItem('sphere-stage-sound', 'off'); return; }
      window.addEventListener('pagehide', () => {
        const api = window.SphereBiome;
        if (api) parent.__closedArrivalScene = { id: api.id, ...api.inspect(), pose: api.pose(),
          visibility: document.visibilityState, focused: document.hasFocus(), frameClock: parent.SphereFrameFallback?.inspect(window) };
      }, { once: true, capture: true });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(limit);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    let industryNavigations = 0;
    page.on('request', request => {
      if (request.isNavigationRequest() && new URL(request.url()).pathname.endsWith('/' + industryEntry)) industryNavigations++;
    });
    await page.route('**/' + industryEntry.replace('index.html', 'manifest.json'), route =>
      fault === 'manifest' ? route.fulfill({ status: 503, body: 'Unavailable for the arrival test' }) : route.fallback());
    await page.route('**/' + industryEntry + '*', route => {
      if (!route.request().isNavigationRequest() || !fault || fault === 'manifest') return route.fallback();
      const script = '<script>(' + installFault.toString() + ')(' + JSON.stringify(fault) + ');</script>';
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: industryPage.replace('<head>', '<head>' + script) });
    });
    const wait = (fn, arg) => page.waitForFunction(fn, arg, { polling: 100, timeout: limit });
    const row = name => page.locator('#biomeLibraryList article').filter({ hasText: name });
    const visit = name => row(name).getByRole('button', { name: 'Visit', exact: true }).click();
    const fly = name => page.locator('#stageFrame').getByRole('button', { name: 'Fly to ' + name, exact: true }).click();
    async function retryToIndustry() {
      const before = industryNavigations;
      await page.getByRole('button', { name: 'Retry ' + industryName, exact: true }).click();
      const result = await terminal(industry, 'arrived', 'arrival');
      result.retryNavigations = industryNavigations - before;
      assert.equal(result.retryNavigations, 1);
      return result;
    }
    async function observeStatus() {
      await page.evaluate(() => {
        window.__arrivalMessages = [];
        window.__arrivalProbe = null;
        window.__arrivalObserver?.disconnect();
        const status = document.getElementById('biomeLibraryStatus');
        window.__arrivalObserver = new MutationObserver(() => window.__arrivalMessages.push(status.textContent));
        window.__arrivalObserver.observe(status, { childList: true, characterData: true, subtree: true });
      });
    }
    async function terminal(id, status, phase) {
      let waitError;
      try {
        await wait(id => {
          const stage = window.SphereStageFrame;
          return !stage?.flying && stage?.lastArrival?.to === id;
        }, id);
      } catch (error) { waitError = error; }
      const observed = await page.evaluate(key => {
        const stage = window.SphereStageFrame, api = document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome;
        const seen = api?.inspect();
        return { result: stage.lastArrival, current: stage.current?.id ?? null, flying: stage.flying, marker: JSON.parse(localStorage.getItem(key)),
          covered: !!window.sphereStageCovered, status: document.getElementById('biomeLibraryStatus').textContent,
          messages: window.__arrivalMessages ?? [], probe: window.__arrivalProbe ?? null,
          scene: seen && { frames: seen.frames, held: seen.held, scripted: seen.scripted, pose: api.pose() } };
      }, stageKey);
      if (waitError || observed.result?.status !== status || observed.result?.phase !== phase) {
        report.unexpected = { ...observed, closedScene: await page.evaluate(() => window.__closedArrivalScene) };
      }
      if (waitError) throw waitError;
      assert.equal(observed.result.status, status, JSON.stringify(observed));
      assert.equal(observed.result.phase, phase, JSON.stringify(observed));
      return observed;
    }
    function checkSuccess(result, id, restored = false) {
      assert.equal(result.current, id);
      assert.equal(result.marker.id, id);
      assert(result.covered && result.scene.frames > 0 && !result.scene.held && !result.scene.scripted);
      assert.match(result.status, restored ? /Restored your saved place/ : /you have arrived from the air/);
    }
    const takeManualStep = async () => {
      const canvas = page.frameLocator('#stageFrame iframe').locator('canvas').first();
      await canvas.focus();
      await page.keyboard.down('KeyW');
      try { await new Promise(resolve => setTimeout(resolve, 350)); } finally { await page.keyboard.up('KeyW'); }
    };
    const saved = id => page.evaluate(id => localStorage.getItem(SphereBiomeLibrary.pack(id).saveKey), id);
    const saveCurrent = () => page.evaluate(() => {
      const api = document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;
      if (!api.save()) throw Error('The departure pack could not save.');
      return api.pose();
    });
    const closeScene = () => page.evaluate(() => SphereStageFrame.close());
    let departure;
    async function checkRecovery(result, expected) {
      assert.equal(result.current, null);
      assert.equal(result.marker, null);
      assert.equal(result.covered, false);
      assert.match(result.status, expected);
      assert(!result.messages.some(message => /you have arrived from the air/i.test(message)));
      const button = page.getByRole('button', { name: 'Retry ' + industryName, exact: true });
      assert(await button.isVisible() && await button.isEnabled());
      assert(await page.getByRole('button', { name: 'Stay in the Sphere', exact: true }).isVisible());
      assert.equal(await saved(city), departure, 'City departure must be byte-identical');
      result.departureSha256 = sha(departure);
    }
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await wait(() => !!window.SphereBiomeLibrary?.world && !!document.querySelector('#biomeLibraryList article'));
    const hostFiles = ['stage-frame.js', 'biome-library.js'];
    report.servedHostSha256 = await page.evaluate(async names => {
      const digests = {};
      for (const name of names) {
        const response = await fetch(name, { cache: 'no-store' });
        if (!response.ok) throw Error('Could not verify ' + name);
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        digests[name] = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      }
      return digests;
    }, hostFiles);
    for (const file of hostFiles) assert.equal(report.servedHostSha256[file], sha(fs.readFileSync(path.join(root, file))));
    assert.equal(await page.evaluate(() => SphereStageSound.on), false);
    await row(cityName).getByRole('button', { name: 'Install', exact: true }).click();
    await wait(id => !!SphereBiomeLibrary.entry(id), city);
    await row(industryName).getByRole('button', { name: 'Install', exact: true }).click();
    await wait(id => !!SphereBiomeLibrary.entry(id), industry);
    await observeStatus();
    await visit(cityName);
    const healthy = await terminal(city, 'arrived', 'arrival');
    checkSuccess(healthy, city);
    record('Healthy Visit draws and settles', healthy);
    await takeManualStep();
    const bookmark = await saveCurrent();
    await page.frameLocator('#stageFrame iframe').getByRole('button', { name: 'Save this place', exact: true }).click();
    assert.deepEqual(JSON.parse(await saved(city)).bookmark, bookmark);
    await observeStatus();
    await fly(industryName);
    await wait(() => document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect().scripted);
    await takeManualStep();
    const interrupted = await terminal(industry, 'taken-over', 'departure');
    assert.equal(interrupted.current, city);
    assert.equal(interrupted.marker.id, city);
    assert.equal(interrupted.scene.scripted, false);
    assert(await page.getByRole('button', { name: 'Fly to ' + industryName, exact: true }).isEnabled());
    assert(!interrupted.messages.some(message => /you have arrived from the air/i.test(message)));
    const departurePose = await saveCurrent();
    departure = await saved(city);
    assert.deepEqual(JSON.parse(departure).pose, departurePose);
    assert.deepEqual(JSON.parse(departure).bookmark, bookmark);
    assert.notDeepEqual(departurePose, bookmark);
    record('Keyboard takeover keeps the departure scene and controls', { ...interrupted, departurePose, bookmark, departureSha256: sha(departure) });

    fault = 'manifest';
    await observeStatus();
    await fly(industryName);
    const missing = await terminal(industry, 'load-failure', 'ready');
    assert.equal(missing.result.route, 'fly');
    await checkRecovery(missing, /Industry manifest unavailable/);
    if (output) await page.screenshot({ path: path.join(output, 'missing-manifest-recovery.jpg'), type: 'jpeg', quality: 85 });
    record('Missing manifest during Fly to returns to usable Main', missing);
    fault = null;
    const retried = await retryToIndustry();
    checkSuccess(retried, industry);
    assert.equal(await saved(city), departure);
    record('One retry after the missing manifest settles', retried);
    await observeStatus();
    await fly(cityName);
    const crossed = await terminal(city, 'arrived', 'arrival');
    assert.equal(crossed.result.route, 'fly');
    checkSuccess(crossed, city);
    record('Healthy inter-biome Fly to draws and settles', crossed);

    // Delay only the second request for the target, the final Main overview under cloud.
    // Let it finish after recovery to prove it cannot reset the explorer's Main camera.
    await observeStatus();
    await page.evaluate(id => {
      const travel = SphereJourney.travel, original = travel.request;
      let targets = 0;
      travel.request = function(spec) {
        if (spec.id === 'biome-' + id && ++targets === 2) {
          return new Promise(resolve => { window.__releaseOverview = () => {
            travel.request = original; resolve({ state: 'cancelled' });
          }; });
        }
        return original.call(this, spec);
      };
    }, industry);
    await fly(industryName);
    const late = await terminal(industry, 'timeout', 'travel');
    await checkRecovery(late, /Timed out.*Main view/);
    const unchanged = await page.evaluate(async () => {
      const core = SphereApp.getState();
      const displaced = core.position.map(n => n * 0.998);
      SphereApp.setState({ ...core, position: displaced });
      const before = SphereApp.getState().position;
      window.__releaseOverview();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { before, after: SphereApp.getState().position };
    });
    assert.deepEqual(unchanged.before, unchanged.after);
    record('Expired Main overview cannot move the camera after recovery', late);
    await page.getByRole('button', { name: 'Stay in the Sphere', exact: true }).click();

    for (const [mode, phase, expected] of [
      ['pending-ready', 'ready', /Timed out.*to draw/],
      ['pending-arrived', 'arrival', /Timed out.*finish its approach/]
    ]) {
      fault = mode;
      await observeStatus();
      await visit(industryName);
      const timed = await terminal(industry, 'timeout', phase);
      assert(timed.probe.installed);
      assert.equal(timed.probe.begins, phase === 'ready' ? 0 : 1);
      if (phase === 'arrival') assert(timed.probe.atBegin.held && timed.probe.atBegin.scripted);
      await checkRecovery(timed, expected);
      record(mode + ' times out without announcing arrival', timed);
      fault = null;
      const again = await retryToIndustry();
      checkSuccess(again, industry);
      assert.equal(await saved(city), departure);
      record('One retry after ' + mode + ' settles', again);
      await closeScene();
    }

    // Move only Main's deadline clock. The child still draws, moves and resolves
    // its original promises on its own clock. Always restore the top-level clock.
    for (const mode of ['slow-moving', 'overlong-moving']) {
      fault = mode;
      await observeStatus();
      await page.evaluate(() => {
        const clock = performance, original = Object.getOwnPropertyDescriptor(clock, 'now');
        const now = clock.now.bind(clock);
        let offset = 0;
        Object.defineProperty(clock, 'now', { configurable: true, value: () => now() + offset });
        window.__advanceArrivalClock = value => { offset = value; };
        window.__restoreArrivalClock = () => {
          if (original) Object.defineProperty(clock, 'now', original); else delete clock.now;
          delete window.__advanceArrivalClock;
          delete window.__restoreArrivalClock;
        };
      });
      try {
        await visit(industryName);
        const advances = mode === 'slow-moving';
        const watched = await terminal(industry, advances ? 'arrived' : 'timeout', 'arrival');
        assert(watched.probe.firstDeadline);
        if (advances) {
          checkSuccess(watched, industry);
          record('A moving approach can settle in its single grace window', watched);
          await closeScene();
        } else {
          assert(watched.probe.hardDeadline && watched.result.scene.scripted && !watched.result.scene.held);
          await checkRecovery(watched, /Timed out.*finish its approach/);
          record('A moving approach still times out at its hard deadline', watched);
          await page.getByRole('button', { name: 'Stay in the Sphere', exact: true }).click();
        }
      } finally { await page.evaluate(() => window.__restoreArrivalClock()); }
    }

    for (const [mode, phase, expected] of [
      ['rejected-ready', 'ready', /Destination rejected readiness/],
      ['premature-arrived', 'arrival', /reported arrival before its approach settled/]
    ]) {
      fault = mode;
      await observeStatus();
      await visit(industryName);
      const rejected = await terminal(industry, 'load-failure', phase);
      await checkRecovery(rejected, expected);
      assert(rejected.probe.installed);
      record(mode + ' reports a load failure', rejected);
      await page.getByRole('button', { name: 'Stay in the Sphere', exact: true }).click();
    }

    fault = 'arrival-takeover';
    await observeStatus();
    await visit(industryName);
    const tookDestination = await terminal(industry, 'taken-over', 'arrival');
    assert.equal(tookDestination.current, industry);
    assert.equal(tookDestination.marker.id, industry);
    assert(tookDestination.probe.installed && tookDestination.probe.begins === 1);
    assert(!tookDestination.messages.some(message => /you have arrived from the air/i.test(message)));
    await takeManualStep();
    const manual = await saveCurrent();
    assert.notDeepEqual(manual, tookDestination.scene.pose);
    record('Destination takeover keeps a controllable frame', { ...tookDestination, manualPose: manual });

    fault = 'manifest';
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restoreFailure = await terminal(industry, 'load-failure', 'ready');
    assert.equal(restoreFailure.result.route, 'restore');
    await checkRecovery(restoreFailure, /Industry manifest unavailable/);
    record('A remembered scene that fails to open returns to Main', restoreFailure);
    fault = null;
    const restored = await retryToIndustry();
    assert.equal(restored.result.route, 'restore');
    checkSuccess(restored, industry, true);
    assert.deepEqual(restored.scene.pose, manual);
    record('One retry restores the original manual position', restored);

    await closeScene();
    fault = 'manifest';
    await observeStatus();
    await visit(industryName);
    const stay = await terminal(industry, 'load-failure', 'ready');
    await checkRecovery(stay, /Industry manifest unavailable/);
    await page.getByRole('button', { name: 'Stay in the Sphere', exact: true }).click();
    assert.equal(await page.locator('#biomeArrivalRecovery').count(), 0);
    assert(await page.locator('#viewport').evaluate(el => el === document.activeElement));
    record('Stay in the Sphere dismisses recovery and focuses Main', stay);

    await observeStatus();
    await page.evaluate(id => { void SphereStageFrame.open(id, { query: '?arrival=ground' }); }, industry);
    const direct = await terminal(industry, 'load-failure', 'ready');
    assert.equal(direct.result.route, 'open');
    await checkRecovery(direct, /Industry manifest unavailable/);
    record('Direct public open also rejects the failed destination', direct);
    fault = null;
    const directRetry = await retryToIndustry();
    assert.equal(directRetry.result.route, 'open');
    assert.equal(directRetry.marker.id, industry);
    assert.equal(directRetry.scene.scripted, false);
    assert.match(directRetry.status, /is open/);
    await closeScene();
    await page.evaluate(id => { void SphereStageFrame.open(id); }, industry);
    const defaultOpen = await terminal(industry, 'arrived', 'arrival');
    assert.equal(defaultOpen.result.route, 'open');
    assert.match(defaultOpen.status, /is open/);
    record('Direct-open retry keeps its requested ground entry', { ...directRetry, defaultOpen: defaultOpen.result });
    assert.deepEqual(report.pageErrors, []);
    report.status = 'PASS';
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
}

main().catch(error => { report.status = 'FAIL'; report.error = error.stack; console.error(error.stack); process.exitCode = 1; })
  .finally(() => { report.finished = new Date().toISOString(); writeReport(); });
