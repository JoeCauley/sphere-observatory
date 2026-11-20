import assert from 'node:assert/strict';
import {passageAt,passagePoint,tunnelStart,tunnelEnd,tunnelLength} from '../surface-passages.js';
import {makeGallery} from '../packs/border-outfall/1.0.0/geometry.js';
import {solidAt,moveBody,supportAt} from '../packs/border-outfall/1.0.0/border.js';
import {entrance,eye} from '../packs/border-outfall/1.0.0/model.js';
const {colliders}=makeGallery();
const near=(a,b,tol=1e-6)=>assert(Math.abs(a-b)<tol,`${a} vs ${b}`);
for(const radius of [1e6,149597870.7,300000000]){
  for(const latitude of [-89.99,-41,0,42,89.99]){
    const lat=latitude*Math.PI/180,q=[-Math.cos(lat),Math.sin(lat),0],dir=[0,0,-1],gate=passageAt(q,dir,radius);
    const a=passagePoint(gate,0,radius),b=passagePoint(gate,tunnelLength,radius);
    near(Math.hypot(...a.map((x,i)=>x-b[i])),1000);
    near(Math.hypot(...b),radius);
    const midpoint=passagePoint(gate,tunnelLength/2,radius);
    assert(Math.hypot(...midpoint)<radius);
    midpoint.forEach((x,i)=>near(x,(a[i]+b[i])/2));
  }
}
const p={...entrance(),eastM:-1,northM:tunnelStart};
for(const dz of [1,57,499942,499997,3]){
  moveBody(p,colliders,0,0,dz);assert.equal(p.mode,'walk');assert(!solidAt(colliders,p.eastM,eye,p.northM));near(supportAt(colliders,p),eye);
}
near(p.northM,tunnelEnd);
moveBody(p,colliders,0,0,-tunnelLength);near(p.northM,tunnelStart);
p.northM=tunnelEnd/2;moveBody(p,colliders,1000,0,0);near(p.eastM,3.28);
p.mode='flight';moveBody(p,colliders,0,1000,0);near(p.altitudeM,6.1);
console.log('PASS straight 1,000 km chords, continuous collision floor, reverse walk, sidewall and ceiling.');
