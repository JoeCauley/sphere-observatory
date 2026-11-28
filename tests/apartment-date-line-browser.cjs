'use strict';

const { fixture } = require('./support/apartment-register.cjs');
const { chromium, options, viewport, start, mainReady, ready, walk, fs, assert } = require('./support/apartment-field.cjs');

const destination = 'border-transport/r13c0/r13c51';
const source = process.env.SPHERE_FIELD_STORE;

async function stationaryArrival() {
  const {dir, file} = fixture(source,{empty:true});
  let server, browser, resumeExterior;
  try {
    if (source && fs.existsSync(source + '.furnishings')) {
      fs.cpSync(source + '.furnishings', file + '.furnishings', {recursive: true});
    }
    server = await start({storePath: file});
    browser = await chromium.launch(options);
    const page = await browser.newPage({viewport});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const address = server.origin + '/?apartment=1A&trip=date-line';
    await page.goto(address);
    await mainReady(page);
    const apartment = await ready(page);
    await walk(apartment, -1.55, -1.68);
    await walk(apartment, -2.42, -5.10);
    const from = await apartment.evaluate(() => SphereBiome.pose());
    assert(from.northM < -4 && from.mode === 'walk', 'Depart from inside 1A');

    // Keep the real exterior import pending until the player stops near the service door.
    let requested = false;
    const barrier = new Promise(resolve => { resumeExterior = resolve; });
    await page.route('**/packs/sideways-city/*/exterior.mjs', async route => {
      requested = true;
      await barrier;
      await route.continue();
    });
    const picker = page.getByRole('combobox', {name: 'Destination biome'});
    await picker.selectOption({label: 'Date Line Exchange'});
    assert.equal(await picker.inputValue(), destination);
    await page.getByRole('button', {name: 'Fly there', exact: true}).click();
    await page.waitForFunction(id => {
      const stage = SphereStageFrame, receipt = stage.lastArrival;
      return !stage.flying && receipt?.to === id && receipt.from === 'infinite-new-york' &&
        receipt.route === 'fly' && receipt.status === 'arrived';
    }, destination, {timeout: 180000});
    const station = await ready(page, destination);
    const socket = await page.evaluate(async id => {
      const stage = SphereStageFrame, location = SphereBiomeLibrary.entry(id);
      const {station} = await stage.stationExterior(location.transport.origin, true);
      const service = station.routes.find(r => r.id === 'service');
      const face = stage.stationFrontages(location.transport, station, service)[0];
      return {wallNorth: -station.widthM / 2, doorEast: service.nearDoor[0], station: station.address.key,
        aperture: station.address.key + '/0/service', city: face.instanceId, plot: face.plotId};
    }, destination);
    assert.equal(socket.city, 'sideways-city');
    assert.equal(socket.plot, 'r13c0');
    await station.locator('canvas').first().focus();
    await page.keyboard.press('KeyF');
    await station.waitForFunction(() => SphereBiome.pose().mode === 'walk');
    await page.keyboard.down('KeyW');
    try {
      await station.waitForFunction(north => SphereBiome.pose().northM >= north - 3, socket.wallNorth, {timeout: 15000});
    } finally {
      await page.keyboard.up('KeyW');
    }
    const observe = () => station.evaluate(() => {
      const api = SphereBiome, info = api.inspect(), gl = document.querySelector('canvas').getContext('webgl2');
      return {eye: api.pose(), station: info.station, picture: info.habitatWindow,
        held: parent.SphereStageFrame.heldNavigation, gl: gl.getError(), lost: gl.isContextLost()};
    });
    const stopped = await observe();
    assert(stopped.eye.northM < socket.wallNorth && Math.abs(stopped.eye.eastM - socket.doorEast) < 1);
    assert.deepEqual(stopped.held, []);
    assert(requested && stopped.picture.pending, 'The correct exterior should already be loading on the stopped approach');
    resumeExterior();
    await station.waitForFunction(({city, aperture}) => {
      const w = SphereBiome.inspect().habitatWindow;
      return w.id === city && w.aperture === aperture && w.mode === 'exterior' && w.draws > 0 && !w.pending && !w.error;
    }, socket, {timeout: 20000});
    const settled = await observe();
    assert.deepEqual(settled.eye, stopped.eye);
    assert.deepEqual(settled.held, []);
    assert.equal(settled.station, socket.station);
    assert.equal(settled.gl, 0);
    assert.equal(settled.lost, false);
    assert.deepEqual(errors, []);
    console.log('PASS 1A flight to Date Line Exchange, City exterior drawn with all keys released', socket.aperture);
  } finally {
    resumeExterior?.();
    await browser?.close();
    await server?.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

stationaryArrival().catch(error => {console.error(error); process.exitCode = 1;});
