'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const {start} = require('./support/observatory-server.cjs');
(async () => {
  const {packId, room, objectId, placements} = await import('../packs/infinite-new-york/0.1.0/address.mjs');
  const {currentChair} = await import('../packs/infinite-new-york/0.1.0/furnishing.mjs');
  const world = 'sphere-ed6a59ab491a9a08', other = 'sphere-aa6a59ab491a9a08';
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sphere-chair-')), file = path.join(dir, 'installed.json');
  const installations = {installed: [packId, 'annex'].map(id => ({id, packId, version: '0.1.0'}))};
  await fs.writeFile(file, JSON.stringify({schema: 1, worlds: {[world]: installations, [other]: installations}}));
  const address = {world, instance: packId, ...room};
  let host = await start({storePath: file});
  async function call(command, extra = {}) {
    const url = host.origin + '/api/furnishings?' + new URLSearchParams({...address, ...extra});
    const response = await fetch(url, command === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(command)});
    return {status: response.status, ...await response.json()};
  }
  async function expect(status, command, extra) {
    const reply = await call(command, extra);
    assert.equal(reply.status, status, JSON.stringify(reply));
    return reply;
  }
  try {
    const id = objectId(world, packId);
    const first = (await expect(200)).chair;
    assert.deepEqual(first, {id, revision:0, target:'A', pose:placements.A});
    for (const extra of [{building:'29'}, {apartment:'2F'}, {block:'orchard-02'}, {world:other}, {instance:'annex'}])
      assert.notEqual((await expect(200, undefined, extra)).chair.id, id);
    const ab = {actionId:'first-route', expected:0, target:'B'};
    for (const invalid of [{...ab, target:'wall'}, {...ab, pose:{x:0,y:0,z:-9,yaw:0}}, {...ab, actionId:[]}, null])
      await expect(400, invalid);
    await expect(404, undefined, {instance:'uninstalled'});
    assert.equal(await fs.stat(file+'.furnishings').catch(()=>null), null);
    const accepted = await expect(200, ab);
    const retry = await expect(200, ab);
    assert(retry.duplicate); assert.deepEqual(accepted.receipt, retry.receipt);
    await host.close(); host = await start({storePath:file});
    assert.deepEqual((await expect(200)).chair, {id, revision:1, target:'B', pose:placements.B});
    const back = await expect(200, {actionId:'return-to-table',expected:1,target:'A'});
    const late = await expect(200, ab); assert.deepEqual(late.receipt, accepted.receipt);
    assert.deepEqual(late.chair, back.chair); assert.deepEqual(currentChair(back.chair, accepted.chair), back.chair);
    const concurrent = {instance:'annex'};
    const [a,b] = await Promise.all([call(ab, concurrent), call({...ab,actionId:'second-tab'}, concurrent)]);
    assert.deepEqual([a.status,b.status].sort(), [200,409]); assert.deepEqual(a.chair,b.chair);
    assert.equal(a.chair.revision,1);
    const committed = [a,b].find(r=>r.status===200);
    await expect(409,{...ab,actionId:committed.receipt.actionId,target:'A'},concurrent);
    assert.equal((await expect(200,undefined,{world:other})).chair.revision,0);
    assert.equal((await expect(200)).chair.revision,2);
    assert.equal((await fs.readdir(file+'.furnishings')).length,2);
    console.log('PASS untouched reads and invalid coordinates make zero records; retry receipt survives restart; late reply cannot roll back revision 2; concurrent edits serialize; world and instance isolation');
    console.log(JSON.stringify({id,accepted:accepted.chair,retry:retry.receipt,late:late.chair,twoTabs:[a.status,b.status],distanceM:Math.hypot(placements.A.x-placements.B.x,placements.A.z-placements.B.z)}));
  } finally {await host.close();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
