import assert from 'node:assert/strict';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {borderAt,districtLocation} from '../packs/border-transport/0.10.0/district.mjs';
import {generateStation} from '../packs/border-transport/0.10.0/station.mjs';

const world='sphere-ed6a59ab491a9a08',radius=149597870700;
const primary={id:'border-transport',transport:districtFor(world,'r10c0','r10c1',radius)};
const station={id:'date-line',transport:districtFor(world,'r13c0','r13c51',radius,undefined,[0])};
primary.districts=[station];
for(const item of [station,primary]){
  const district=item.transport,door=generateStation(district.origin).routes[0];
  for(const side of [-1,1])for(const setback of [-40,4,120,400]){
    const point=districtLocation(district,door.nearDoor[0],side*(district.sites.find(s=>s.bay===0).widthM/2+setback));
    assert.equal(borderAt(primary,point.latitude,point.longitude),item);
  }
}
assert.equal(districtFor(world,'r13c51','r13c0',radius).origin.key,station.transport.origin.key);
const distant=districtLocation(station.transport,12000000,0);
assert.equal(borderAt(primary,distant.latitude,distant.longitude),primary);
assert.equal(borderAt(null,0,0),null);
console.log('PASS distinct stations, reciprocal date-line door addresses, remote wall ownership and the legacy district.');
