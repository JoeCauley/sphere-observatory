import assert from 'node:assert/strict';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtLocation,plantingDistance} from '../packs/border-transport/0.10.0/district.mjs';
import {meadowStations,meadowToStationPose,stationToMeadowPose} from '../geographic-flight.js';
import {surveyVerge} from '../packs/infinite-meadow/1.3.0/verge.mjs';
import {setStations,vergeTrees} from '../packs/infinite-meadow/1.3.0/landscape.js';

const radius=149597870700,atlas=globalThis.SphereAtlas,meadow={id:'field-instance',plotId:'r10c0',plot:atlas.byId('r10c0').index};
const district=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',radius);
const row=meadowStations(district,atlas.byId(meadow.plotId)).find(r=>r.site.bay===0);
const frontage=item=>ll=>atlas.regionAt([item],ll.latitude,ll.longitude)?.id===item.id;
const verge=surveyVerge(row,district,meadow,frontage(meadow));
assert(verge.trees.length>=3&&verge.beds.length>=16);
assert.deepEqual(surveyVerge(row,district,meadow,frontage(meadow)),verge);
assert.equal(surveyVerge(row,district,{...meadow,footprint:{shape:'ellipse',east:.25,north:.25}},frontage({...meadow,footprint:{shape:'ellipse',east:.25,north:.25}})),null);
for(const prop of [...verge.trees,...verge.beds]){
  const ll=districtLocation(district,prop.stationEastM,prop.stationNorthM);
  assert(plantingDistance(district,ll.latitude,ll.longitude)>(prop.spread??prop.radiusM));
}
row.verge=verge;setStations([row],12);
const start=stationToMeadowPose(row,verge.start),other={...start,eastM:start.eastM-32};
assert.notEqual(Math.floor(start.eastM/16),Math.floor(other.eastM/16));
assert.equal(vergeTrees(start.eastM,start.northM)[0],vergeTrees(other.eastM,other.northM)[0]);
const back=meadowToStationPose(row,start);
assert(Math.hypot(back.eastM-verge.start.eastM,back.northM-verge.start.northM)<.001);
console.log('PASS forked tree, addressed flower drifts, chart boundary, doorway clearance and short footprint',verge.home.id,verge.trees.length,verge.beds.length);
