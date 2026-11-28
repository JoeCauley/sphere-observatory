'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {PNG} = require('playwright-core/lib/utilsBundle');
const assert = require('node:assert/strict');
const [timingFile, visualFile, crossingFile, flightFile, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node summary.cjs timing.json visual.json crossing.json survey.json table.md');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const [timing, visual, crossing, flight] = [timingFile, visualFile, crossingFile, flightFile].map(read);
for (const stage of [timing, visual, crossing]) {
  assert(stage.passed && !stage.quick && !stage.errors.length, 'Full verified stages are required');
}
const median = numbers => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)];
const fmt = x => Number.isFinite(x) ? x.toFixed(2) : 'unavailable';
const list = values => values.map(fmt).join(' / ');
const rows = ['# Bay 0 doorway measurements', '',
  'Date Line Exchange, bay 0, Service opening toward The Sideways City. Timings are in milliseconds. GPU p95 covers station frames that drew. Each doorway sample repeats a 2.4 m sidestep at 0.7 m inside the jamb for 30 seconds.', '',
  '| Held view | GPU p95 by run | Median GPU p95 | Median frame p95 | Peak tracked allocation (MiB) | Picture bytes after each run |',
  '| --- | --- | ---: | ---: | ---: | --- |'];
for (const [key, name] of [['current', 'Current picture'], ['clipped', 'Clipped City']]) {
  const m = timing.timing[key], runs = m.runs;
  assert.equal(runs.length, 3);
  assert(runs.every(v => v.durationMs >= 29900 && v.gpuSamples > 0 && !v.disjoint));
  rows.push('| '+[name, list(runs.map(r => r.gpuP95)), fmt(m.medianGpuP95), fmt(m.medianP95),
    fmt(m.peakBytes / 1048576), runs.map(r => r.pictureBytes.toLocaleString('en-US')).join(' / ')].join(' | ')+' |');
}
rows.push('', 'The allocation counter covers WebGL buffers and estimated 2D texture/renderbuffer storage within the station frame. Picture bytes are the renderer’s own card and scratch accounting.', '',
  '| Outward 1× walk | Worst frame interval | Longest interval between advancing settled poses | Owner on the apron |',
  '| --- | ---: | ---: | --- |');
for (const [key, name] of [['current-held','Current, station held'], ['clipped-held','Clipped, station held'], ['switch','Existing renderer handoff']]) {
  const r = crossing.crossing[key];
  rows.push('| '+[name, fmt(r.worstHitchMs), fmt(r.worstMotionGapMs), r.owners.at(-1)].join(' | ')+' |');
}
const lights = visual.lightCalibration.atMarks;
assert(lights.noon >= .99 && lights.dusk > .35 && lights.dusk < .65 && lights.night <= .01);
rows.push('', '| Station light | Sphere seconds | Star visible at the station | Star visible in the City |',
  '| --- | ---: | ---: | ---: |');
for (const mark of ['noon','dusk','night']) {
  const photo = (owner) => visual.shown['sphere-'+mark+'-'+owner+'-inside'];
  rows.push('| '+[mark, visual.times[mark], fmt(photo('clipped').light.direct), fmt(photo('city-native').light.direct)].join(' | ')+' |');
}
// The central skyline is visible in both native frames, clear of their different controls.
function skyline(period, owner) {
  const name = 'sphere-'+period+'-'+owner+'-inside.png';
  const image = PNG.sync.read(fs.readFileSync(path.join(path.dirname(visualFile), 'images', name)));
  assert(image.width === 944 && image.height === 734, 'Unexpected photograph dimensions');
  const pixels = [];
  let sum = 0;
  for (let y = 185; y < 380; y++) for (let x = 355; x < 930; x++) {
    const i = 4 * (y * image.width + x);
    const [r,g,b] = [image.data[i],image.data[i+1],image.data[i+2]];
    pixels.push(r,g,b);
    sum += .2126*r + .7152*g + .0722*b;
  }
  return {pixels, luma:sum / (pixels.length / 3)};
}
let previousLuma = null;
for (const period of ['noon','dusk','night']) {
  const held = skyline(period, 'clipped'), city = skyline(period, 'city-native');
  const diff = held.pixels.reduce((sum, value, i) => sum + Math.abs(value-city.pixels[i]), 0) / held.pixels.length;
  assert(diff < 8, 'Visible City and doorway differ at '+period);
  if (previousLuma) assert(held.luma < previousLuma[0]-7 && city.luma < previousLuma[1]-7, 'Shade did not darken both pictures');
  previousLuma = [held.luma, city.luma];
}
const samples=flight.samples;
assert.equal(samples.length,3);
assert(samples.every(x=>x.durationMs >= 29995 && x.glError === 0 && !x.contextLost));
assert(!flight.errors.length);
const sc=visual.sidestep.clipped, seen=sc.rows.map(x=>x.cells.drawn);
rows.push('', 'The one-way sidestep saw '+Math.min(...seen)+'–'+Math.max(...seen)+' distinct street-cell addresses per sample, '+sc.totals.built+' newly seen after warm-up, and '+sc.totals.resident+' in the address set by the end. The fragment shader still traces the procedural streets per pixel. The counters record addresses only.', '',
  'On turning away, the City retained '+timing.release.clipped.picture.cells.resident+' addresses. Picture bytes then visible elsewhere in the station were '+timing.release.current.picture.bytes+' in current mode and '+timing.release.clipped.picture.bytes+' in clipped mode.', '',
  'The established Bay 0 flight used its own 1024 × 640 draw target. Its three frame p95s were '+list(samples.map(x=>x.p95))+' ms, with a median of '+fmt(median(samples.map(x=>x.p95)))+' ms against the 20.80 ms budget. GPU p95s were '+list(samples.map(x=>x.gpuP95))+' ms.', '',
  'Measured on '+timing.device+'. Chrome '+timing.chrome+'. Doorway viewport '+timing.viewport.width+' × '+timing.viewport.height+', canvas '+visual.marks.inside.viewport.canvas.join(' × ')+', horizontal field of view 75°.', '');
fs.writeFileSync(output, rows.join('\n'));
