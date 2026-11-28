import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {surveyJungle,surveyJungleGrove} from '../packs/super-jungle/1.0.0/survey.mjs';
import {surveyForestWalk} from '../packs/super-jungle/1.0.0/forest-walk.mjs';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import * as rules from '../packs/border-transport/0.10.0/district.mjs';
const require=createRequire(import.meta.url);
for(const name of ['math','collection','biomes','world-palette','world','field-sites','flight','surface-walk'])require('../'+name+'.js');
const s={...SphereMath.defaultState(),seed:713,collection:true,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2};
const district=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',s.radius*1000);
const results=[];
for(const result of [surveyJungle(s,district,'r10c0'),surveyJungleGrove(s)]){
  const o=result.occurrence,stand=surveyForestWalk(s,o,globalThis,district),f=stand.fallen;
  assert(f.distanceM>=800&&f.distanceM<=1200);assert(f.clearanceM>=20);assert(stand.ferns.length>15&&stand.trees.length>=25);
  // The original entrance from the canopy gap stays open all the way to the old buttress.
  const g=o.gap.local,t=o.tree.local,dx=t.eastM-g.eastM,dz=t.northM-g.northM;
  for(const tree of stand.trees){
    const x=tree.local.eastM-g.eastM,z=tree.local.northM-g.northM;
    const a=Math.max(0,Math.min(1,(x*dx+z*dz)/(dx*dx+dz*dz)));
    assert(Math.hypot(x-a*dx,z-a*dz)>=43);
  }
  assert.deepEqual(surveyForestWalk({...s,time:1207},o,globalThis,district),stand);
  const at={...s,position:SphereMath.mul(f.direction,s.radius-.002),walkMode:true,siteId:'biome-1',siteRevision:2,
    terrainRevision:2,siteAnchor:result.direction,terrainAnchor:result.direction,geometryDetail:true,jungleStand:stand};
  SphereGround.setApronSurvey({district,parameters:{seed:s.seed,radius:s.radius}},rules);
  const chart=SphereGround.frame(at),[x,,z]=chart.local(SphereMath.mul(f.direction,s.radius)),owner=SphereGround.owner(x,z);
  const groups=SphereGround.neighbourhood(at),piece=groups.find(m=>m.ground.props.includes(f.id));
  assert(piece,'The root plate must enter the physical terrain mesh');
  const terrain=SphereGround.height(at,chart,x,z),hit={};
  const distance=SphereSites.rayBVH([x,terrain+.016,z],[0,-1,0],piece.bvh,.017,hit);
  assert(hit.normal&&distance<.014,'The wood must stand above surveyed ground');
  const far=SphereGround.build(at,owner[0],owner[1],SphereGround.COARSE,[owner[0]+2,owner[1]+2]);
  // Coarse tiles may extend away from this cell. Use the same footprint once as a coarse interior tile.
  const middle=far.ground.props.includes(f.id)?far:SphereGround.build(at,...owner,SphereGround.COARSE,owner);
  assert(middle.ground.props.includes(f.id));assert(piece.ground.props.includes(stand.trees.find(t=>piece.ground.props.includes(t.id))?.id));
  assert(SphereGround.info.bytes<=SphereGround.info.budget);
  results.push({stand:f.id,distanceM:f.distanceM,tree:o.tree.id,standing:stand.trees.length,ferns:stand.ferns.length,
    rootCollisionM:(.016-distance)*1000,bytes:SphereGround.info.bytes});
  SphereGround.dispose();assert.equal(SphereGround.info.bytes,0);
}
assert.notEqual(results[0].stand,results[1].stand);
console.log('PASS addressed deadfall, roots, fern margin, coarse identity and disposal in two native stands',results);
