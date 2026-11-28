'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createHandler } = require('../serve.cjs');

// A decoded 1 × 1 PNG with a complete IDAT and IEND.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aencAAAAASUVORK5CYII=', 'base64');

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sphere-camera-'));
  const server = http.createServer(createHandler({root}));
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const shoot = (body = png, source = origin) => fetch(origin + '/api/screenshots', {
      method:'POST', headers:{'Content-Type':'image/png', Origin:source}, body
    });
    const destination = path.join(root, 'Screenshots');
    assert.equal((await shoot(png, 'http://elsewhere.invalid')).status, 403);
    assert.equal((await shoot(png.subarray(0, -7))).status, 400);
    const shots = await Promise.all([shoot(), shoot()]);
    assert(shots.every(r => r.ok));
    const receipts = await Promise.all(shots.map(r => r.json()));
    assert.notEqual(receipts[0].name, receipts[1].name);
    for (const receipt of receipts) {
      assert.deepEqual([receipt.width, receipt.height, receipt.bytes], [1, 1, png.length]);
      assert.deepEqual(await fs.readFile(path.join(destination, receipt.name)), png);
    }
    assert.deepEqual((await fs.readdir(destination)).sort(), receipts.map(r => r.name).sort());
    await fs.rename(destination, path.join(root, 'first-shots'));
    await fs.writeFile(destination, 'Occupied by a file');
    const failed = await shoot();
    assert(!failed.ok);
    assert((await failed.json()).error);
    await fs.unlink(destination);
    assert((await shoot()).ok);
    console.log('PASS concurrent PNG saves, byte identity, incomplete image, write failure and recovery');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(root, {recursive:true, force:true});
  }
}
run().catch(e => { console.error(e); process.exitCode=1; });
