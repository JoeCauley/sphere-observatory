import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {factoryChair, placeChair} from '../packs/infinite-new-york/0.1.0/furnishing.mjs';
import {packId, room, objectId} from '../packs/infinite-new-york/0.1.0/address.mjs';

export function apartmentEndpoint(storePath, readInstallations, reply) {
  const directory = storePath + '.furnishings';
  let writes = Promise.resolve();
  async function load(file, id) {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (data.schema !== 1 || data.chair?.id !== id || !Number.isSafeInteger(data.chair.revision) ||
          !['A', 'B'].includes(data.chair.target) || !Array.isArray(data.receipts) ||
          !['x','y','z','yaw'].every(k => Number.isFinite(data.chair.pose?.[k])))
        throw Error('Invalid furnishing record');
      return data;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return async (req, res) => {
    const host = req.headers.host, origin = req.headers.origin;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (origin && origin !== 'http://' + host))
      return reply(res, 403, {error: 'Local tester only'});
    const params = new URL(req.url, 'http://localhost').searchParams;
    const world = params.get('world'), instance = params.get('instance');
    const block = params.get('block'), building = params.get('building'), apartment = params.get('apartment'), slot = params.get('slot');
    if (!/^sphere-[0-9a-f]{16}$/.test(world) || typeof instance !== 'string' || !instance ||
        !/^orchard-[0-9]{2,5}$/.test(block) || !/^[1-9][0-9]{0,3}$/.test(building) ||
        !/^[1-9][0-9]?[A-Z]$/.test(apartment) || slot !== room.slot)
      return reply(res, 400, {error: 'Invalid furnishing address'});
    const installations = (await readInstallations()).worlds[world]?.installed ?? [];
    if (!installations.some(i => i.id === instance && i.packId === packId && i.detailInstalled !== false))
      return reply(res, 404, {error: 'New York is not installed at this address'});
    const id = objectId(world, instance, {block, building, apartment, slot});
    const file = path.join(directory, createHash('sha256').update(id).digest('hex') + '.json');
    if (req.method === 'GET') {
      await writes;
      return reply(res, 200, {chair: (await load(file, id))?.chair ?? factoryChair(id)});
    }
    if (req.method !== 'POST') return reply(res, 405, {error: 'GET or POST required'});
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return reply(res, 415, {error: 'JSON required'});
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) return reply(res, 413, {error: 'Command exceeds 4 KiB'});
      chunks.push(chunk);
    }
    let request;
    try { request = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return reply(res, 400, {error: 'Invalid JSON'}); }
    async function update() {
      const result = placeChair(await load(file, id), id, request);
      if (result.write) {
        await fs.mkdir(directory, {recursive: true});
        const temp = file + '.' + randomUUID() + '.writing';
        try {
          await fs.writeFile(temp, JSON.stringify(result.write) + '\n', {flag: 'wx', flush: true});
          await fs.rename(temp, file);
        } finally { await fs.rm(temp, {force: true}); }
      }
      reply(res, result.status, result.body);
    }
    const pending = writes.then(update);
    writes = pending.catch(() => {});
    await pending;
  };
}
