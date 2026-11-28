import assert from 'node:assert/strict';
import {moveOnSupport} from '../packs/runtime/v1/navigation.js';
import {initialState} from '../packs/infinite-industry/1.4.1/model.js';
import {createFacility,DATUM_M} from '../packs/infinite-industry/1.4.1/facility.js';
import {walkingContent} from '../packs/infinite-industry/1.4.1/plant.js';
import {transfer,transferPlace} from '../packs/infinite-industry/1.4.1/transfer.js';
import {atPanel,millPlace} from '../packs/infinite-industry/1.4.1/mill-site.js';

const {intake,outlet,length}=transfer;
const east=(intake[0]-outlet[0])/length,north=(intake[1]-outlet[1])/length;
const keys=new Set(['KeyW','ShiftLeft']),content=walkingContent(createFacility(initialState().config));
const aisle=millPlace();assert(atPanel({...aisle,altitudeM:aisle.altitudeM+DATUM_M},DATUM_M));
for(const steering of [-.042,-.027,-.014,-.005,0,.005,.014,.027,.042]){
  const state=initialState(),motion={speedMps:0};
  Object.assign(state.pose,transferPlace(),{altitudeM:DATUM_M+1.7,yaw:Math.atan2(east,-north)+steering});
  let distance=0;
  // The original operator walk must pass the hood with room for small steering differences.
  for(let frame=0;frame<450&&distance<length+1;frame++){
    const result=moveOnSupport(state,keys,1/60,content,motion);
    assert.equal(result.colliding,false,'Blocked on the original hot-bar walk at yaw offset '+steering);
    distance=(state.pose.eastM-outlet[0])*east+(state.pose.northM-outlet[1])*north;
  }
  assert(distance>=length+1,'The original approach must extend a metre past its hood');
}
console.log('PASS original hot-bar footpath stays clear through the receiving hood across nine steering angles');
