'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright');
const { executable, session } = require('../tests/support/biome-browser.cjs');
const industry = require('../packs/biome-library.json').packs.find(pack => pack.id === 'infinite-industry');
const output = process.argv[2];
const size = { width: 1280, height: 720 };
const durationMs = 30000;

// Observe the disposable Main page while its ordinary timers and drawing code run.
function countHostTimers() {
  if (window !== top) return;
  const audit = window.cadenceAudit = { active: false, frames: 0, draws: 0, intervalCalls: 0, departurePolls: 0 };
  const schedule = window.setInterval;
  window.setInterval = function (callback, delay, ...args) {
    if (typeof callback !== 'function') return schedule.call(this, callback, delay, ...args);
    return schedule.call(this, function (...values) {
      if (audit.active) {
        audit.intervalCalls++;
        if (callback.name === 'observeDeparture') audit.departurePolls++;
      }
      return callback.apply(this, values);
    }, delay, ...args);
  };
}

function countHostFrames() {
  const audit = window.cadenceAudit;
  const request = window.requestAnimationFrame;
  let mainFrame;
  window.requestAnimationFrame = function (callback) {
    if (!mainFrame && callback.name === 'frame' && callback.toString().includes('SphereTiming.advance')) mainFrame = callback;
    if (callback !== mainFrame) return request.call(this, callback);
    return request.call(this, time => {
      if (audit.active) audit.frames++;
      callback(time);
    });
  };
  const renderer = window.SphereApp.renderer;
  const draw = renderer.draw;
  renderer.draw = function (...args) {
    if (audit.active) audit.draws++;
    return draw.apply(this, args);
  };
}

async function visitIndustry(page, origin) {
  await page.addInitScript(countHostTimers);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
  console.log('Main is ready');
  await page.evaluate(() => {
    window.cadenceSoundWasOn = window.SphereStageSound?.on === true;
    if (window.cadenceSoundWasOn) SphereStageSound.toggle();
  });
  await page.getByRole('tab', { name: 'Explore' }).click();
  const row = page.locator('#biomeLibraryList article').filter({ has: page.getByRole('heading', { name: /^Infinite Industry/ }) });
  await row.getByRole('button', { name: 'Install', exact: true }).click();
  await row.getByRole('button', { name: 'Visit', exact: true }).click();
  console.log('Waiting for Industry to arrive');
  await page.waitForFunction(() => window.sphereStageCovered && window.SphereStageFrame?.lastArrival?.status === 'arrived' &&
    document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.id === 'infinite-industry');
  const iframe = await page.locator('#stageFrame iframe').elementHandle();
  const frame = await iframe.contentFrame();
  // The host has its own sidebar and stage bar. Match the pack's viewport to the standalone pack.
  for (let attempt = 0; attempt < 6; attempt++) {
    const inner = await frame.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    if (inner.width === size.width && inner.height === size.height) break;
    const outer = page.viewportSize();
    await page.setViewportSize({ width: outer.width + size.width - inner.width, height: outer.height + size.height - inner.height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert.deepEqual(await frame.evaluate(() => [innerWidth, innerHeight]), [size.width, size.height]);
  console.log('Hosted Industry has a matched viewport');
  await page.evaluate(countHostFrames);
  return frame;
}

async function sample({ duration, label }) {
  const audit = top.cadenceAudit;
  const fallback = top.SphereFrameFallback;
  const fallbackCount = () => fallback?.inspect(window)?.timerFrames ?? 0;
  const focused = () => document.hasFocus() && !document.hidden && !top.document.hidden;
  if (!focused()) throw Error(label + ' does not have visible keyboard focus.');
  let uninterrupted = true;
  const focusLost = () => { uninterrupted = false; };
  window.addEventListener('blur', focusLost);
  document.addEventListener('visibilitychange', focusLost);
  const fallbackBefore = fallbackCount();
  const firstPackFrame = window.SphereBiome?.inspect().frames;
  const intervals = [];
  let firstTime, previous;
  if (audit) audit.active = true;
  let endTime;
  try {
    endTime = await new Promise(resolve => {
      function tick(time) {
        uninterrupted &&= focused();
        firstTime ??= time;
        if (previous !== undefined) intervals.push(time - previous);
        previous = time;
        if (time - firstTime >= duration) resolve(time);
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  } finally {
    if (audit) audit.active = false;
    window.removeEventListener('blur', focusLost);
    document.removeEventListener('visibilitychange', focusLost);
    top.document.title = 'Sphere cadence complete';
  }
  if (!uninterrupted || fallbackCount() !== fallbackBefore) throw Error(label + ' lost focus or used a fallback timer.');
  function stats(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const at = q => Number(sorted[Math.floor((sorted.length - 1) * q)].toFixed(3));
    return { count: sorted.length, medianMs: at(.5), p95Ms: at(.95) };
  }
  const result = { label, ...stats(intervals), elapsedMs: endTime - firstTime,
    fromUnixMs: performance.timeOrigin + firstTime, toUnixMs: performance.timeOrigin + endTime,
    focused: uninterrupted, fallbackFrames: fallbackCount() - fallbackBefore, inner: [innerWidth, innerHeight],
    intervalsMs: intervals.map(ms => Number(ms.toFixed(3))) };
  if (window.SphereIndustry) {
    const state = SphereIndustry.inspect();
    const rows = state.metrics.filter(row => row.frame > firstPackFrame);
    const canvas = document.querySelector('#world'), gl = canvas.getContext('webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    Object.assign(result, { pose: SphereBiome.pose(), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      gpu: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL), packRecentIntervals: stats(rows.map(row => row.intervalMs)),
      packErrors: state.webglErrors });
  }
  if (audit) result.host = { ...audit, covered: top.sphereStageCovered };
  return result;
}

async function focusSample(page, label, browserPid) {
  await page.bringToFront();
  await page.evaluate(name => { document.title = 'Sphere cadence [' + name + ']'; }, label);
  const directory = process.env.SPHERE_CADENCE_FOCUS_DIR;
  if (!directory) return;
  const signal = path.join(directory, label);
  fs.writeFileSync(signal + '.tmp', String(browserPid));
  fs.renameSync(signal + '.tmp', signal + '.request');
  const deadline = Date.now() + 30000;
  while (!fs.existsSync(signal + '.ready')) {
    if (Date.now() >= deadline) throw Error('Windows could not confirm the foreground display for ' + label);
    await delay(100);
  }
}

async function main() {
  if (!output) throw Error('Usage: node tools/measure-frame-cadence.cjs <output.json>');
  const server = await session();
  let browser;
  try {
    browser = await chromium.launch({ headless: false, executablePath: executable(), args: ['--mute-audio', '--window-size=1680,1000'] });
    const cdp = await browser.newBrowserCDPSession();
    const processes = await cdp.send('SystemInfo.getProcessInfo');
    const browserPid = processes.processInfo.find(info => info.type === 'browser')?.id;
    await cdp.detach();
    const report = { browser: browser.version(), browserPid, durationMs, viewport: size, samples: [] };
    fs.writeFileSync(output, JSON.stringify(report) + '\n');
    for (const label of ['blank', 'standalone', 'visit']) {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.setDefaultTimeout(180000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await server.attach(context);
        await page.bringToFront();
        console.log('Preparing ' + label);
        let frame = page.mainFrame();
        if (label === 'visit') frame = await visitIndustry(page, server.origin);
        else if (label === 'standalone') await page.goto(server.origin + '/' + industry.entry);
        if (label !== 'blank') {
          await frame.waitForFunction(() => window.SphereBiome?.inspect().frames > 0);
          await frame.locator('#transfer').click();
          await frame.locator('#hide').click();
          await frame.locator('#world').focus();
          const first = await frame.evaluate(() => SphereBiome.inspect().frames);
          await frame.waitForFunction(n => SphereBiome.inspect().frames >= n + 180, first);
        }
        await focusSample(page, label, browserPid);
        if (label !== 'blank') await frame.locator('#world').focus();
        let timeout;
        let row;
        try {
          row = await Promise.race([frame.evaluate(sample, { duration: durationMs, label }), new Promise((_, reject) => {
            timeout = setTimeout(() => reject(Error(label + ' did not deliver 30 seconds of visible frames.')), durationMs + 15000);
          })]);
        } finally { clearTimeout(timeout); }
        assert.deepEqual(errors, []);
        assert.deepEqual(row.inner, [size.width, size.height]);
        if (row.packErrors) assert.deepEqual(row.packErrors, []);
        if (label === 'visit') {
          const standalone = report.samples.find(r => r.label === 'standalone');
          assert.deepEqual(row.buffer, standalone.buffer);
          assert.deepEqual(row.pose, standalone.pose);
          assert.equal(row.host.covered, true);
        }
        report.samples.push(row);
        fs.writeFileSync(output, JSON.stringify(report) + '\n');
        console.log(label, row.medianMs, row.p95Ms, row.count, row.host ?? '');
      } finally {
        if (label === 'visit') await page.evaluate(() => {
          if (window.cadenceSoundWasOn && !window.SphereStageSound.on) SphereStageSound.toggle();
        }).catch(() => {});
        await context.close();
      }
    }
  } finally { try { await browser?.close(); } finally { await server.close(); } }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
