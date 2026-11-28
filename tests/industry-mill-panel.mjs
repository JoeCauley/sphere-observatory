import assert from 'node:assert/strict';
import {connectMill} from '../packs/infinite-industry/1.4.1/mill-panel.js';
import {millPlace} from '../packs/infinite-industry/1.4.1/mill-site.js';
import {DATUM_M} from '../packs/infinite-industry/1.4.1/facility.js';
import {counts} from '../packs/kit/rolling-mill.mjs';

const elements=new Map(),storage=new Map();
globalThis.window={frameElement:null};
globalThis.document={
  getElementById(id){
    if(!elements.has(id))elements.set(id,{});
    return elements.get(id);
  }
};
globalThis.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,value),
  removeItem:key=>storage.delete(key)
};

const player={pose:millPlace()};
player.pose.altitudeM+=DATUM_M;
const desk=connectMill(()=>player,()=>{},()=>{});
while(!desk.view().ready)await new Promise(resolve=>setTimeout(resolve,0));
desk.step(0);
for(let i=0;i<2;i++){
  await desk.perform('feed');
  desk.step(45);
}
// Issue Feed on the completion tick, before the HUD has drawn the rack.
await desk.perform('feed');
const notice=elements.get('millNotice');
assert.match(notice.textContent,/full/);
assert.equal(notice.hidden,false);
await desk.perform('dispatch');
await desk.perform('feed');
desk.step(45);
await desk.perform('feed');
assert.match(notice.textContent,/empty/);
assert.equal(notice.hidden,false);
assert.deepEqual(counts(desk.view().record),[0,0,2,1]);
desk.dispose();
console.log('PASS desk keeps full-rack and exhausted-stock feedback at the exact completion boundary');
