import assert from 'node:assert/strict';
import {at,move,length,bridge,spans,station,buildHall} from '../studies/maintenance-interchange/model.mjs';

assert(at(0).z<0 && at(length).z>station.widthM);
const i=spans.indexOf(bridge);
for(const ramp of [spans[i-1],spans[i+1]]){
  const cosine=(ramp.dx*bridge.dx+ramp.dz*bridge.dz)/(ramp.len*bridge.len);
  assert(Math.abs(1-cosine)<1e-12);
  assert.equal(ramp.a.y,ramp.b.y);
}
assert.strictEqual(buildHall(),buildHall());
assert.equal(bridge.a.z,station.widthM/2-1750);
assert.equal(bridge.b.z,station.widthM/2+1750);
assert.equal(bridge.a.y,bridge.b.y);
assert.equal(bridge.a.y-12-station.traffic.heightM,18);
assert(Math.max(...spans.map(e=>Math.abs(e.b.y-e.a.y)/e.len))<=.05);
for(const sign of [1,-1]){
  const start=sign===1?0:length;
  let p=at(start);
  for(let travel=0;travel<length;){
    travel=Math.min(length,travel+7);
    const next=at(start+sign*travel);
    p=move(p,next.x-p.x,next.z-p.z);
    assert(Math.hypot(p.x-next.x,p.y-next.y,p.z-next.z)<.15);
  }
}
const p=at(bridge.start+bridge.len/2);
for(const dir of [-1,1]){
  const stop=move(p,dir*100,0);
  assert(Math.abs(stop.x-p.x)<12 && Math.abs(stop.x-p.x)>9);
  assert.equal(stop.y,500);
}
console.log('Both walks, deck edges, stacked ramp support, grade and freight headroom passed.');
