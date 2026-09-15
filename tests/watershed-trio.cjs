const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites','watershed-network','watershed-province','watershed-neighbourhood','flight','surface-walk','session-state','places'])require('../'+f+'.js');
global.window=globalThis;require('../volume.js');require('../atmosphere.js');delete global.window;
const P=SphereWatershed,N=SphereNeighbourhood,K=SpherePacks,S=SphereSites;
const state=K.activate({...M.defaultState(),collection:true,routeShades:false,starStation:false,multipleWounds:false,playing:true,time:12345,autoSpeed:false,speed:.017});
const legacy=M.validate({...state,packAddress:{...state.packAddress,artRevision:1}});
assert.equal(K.activate(legacy).packAddress.artRevision,1,'Revisiting an old pack never upgrades it');
assert.equal(K.activate(state).packAddress.artRevision,2);
assert.equal(M.validate({...state,packAddress:undefined}).packAddress,null);
assert.deepEqual(P.geometry(state),P.geometry(legacy),'Art must reuse exact retained geometry');
for(const s of [state,legacy])assert.deepEqual(SphereSessionCodec.decode(SphereSessionCodec.encode(s,{})).state.packAddress,s.packAddress);
let probes=0,overlap=0;
for(const seed of [0,1,42,713,714,9981,2147483647]){
 const g=N.model(seed),snapshot=JSON.stringify(g.compositions);
 for(const c of g.compositions){
  assert(!N.sampleLocal(...c.bank,seed).water,'Named arrival must be dry');
  assert(Math.abs(Math.hypot(...c.axis)-1)<1e-12);
  assert(N.compositionWeights(c.x,c.z,seed)[g.compositions.indexOf(c)]>.5);
 }
 for(let z=-16000;z<=19000;z+=700)for(let x=4000;x<=42000;x+=700){
  const weights=N.compositionWeights(x,z,seed);assert(weights.every(w=>w>=0&&w<=1));assert(weights.reduce((a,b)=>a+b,0)<=1+1e-12);
  if(weights.filter(w=>w>.1).length>1)overlap++;
  for(const delta of [[.00001,0],[0,.00001]])assert(Math.max(...N.compositionWeights(x+delta[0],z+delta[1],seed).map((w,i)=>Math.abs(w-weights[i])))<1e-7,'No artistic boundary jump');
  probes++;
 }
 assert.deepEqual(N.compositionWeights(320,320,seed),[0,0,0],'Garden is protected');
 N.model(seed+1);N.model(seed+2);assert.equal(JSON.stringify(N.model(seed).compositions),snapshot,'Eviction never rerolls the composition');
}
assert(overlap>100);assert(N.info.addresses<=2);assert(N.info.graphBytes<=96*1024);assert.equal(N.info.textureBytes,0);
(async()=>{
 for(const c of N.model(713).compositions){
  const view=N.view(legacy,c.id);assert.equal(view.packAddress.artRevision,2);assert.deepEqual(view.packAddress.anchor,legacy.packAddress.anchor);assert.equal(view.time,legacy.time);
  const regional=await SpherePlaces.destination(legacy,'watershed-'+c.id,'regional','day','clear');assert.equal(regional.packAddress.artRevision,2);assert.equal(regional.time,legacy.time);assert.equal(regional.speed,legacy.speed);assert(!regional.walkMode);assert(Math.abs(M.length(regional.position)-(regional.radius-9000))<1e-6);
  const arrival=await SpherePlaces.destination(state,'watershed-'+c.id,'ground','day','clear');
  assert(arrival.walkMode);assert(arrival.playing);assert.equal(arrival.time,state.time);assert.equal(arrival.speed,state.speed);assert.equal(arrival.autoSpeed,false);
  for(let i=0;i<180;i++)S.step(arrival,new Set(),1/60);
  assert(Math.abs(SphereLanding.heightAboveGround(arrival)-S.EYE)<.00008);
  const origin=arrival.position.slice();for(let i=0;i<180;i++)S.step(arrival,new Set(['KeyW']),1/60);
  assert(arrival.walkMode);assert(M.length(M.sub(origin,arrival.position))>.005);
  assert.deepEqual(M.validate(M.sceneRecord(arrival).state).packAddress,state.packAddress);
 }
 console.log(`PASS Watershed trio: ${probes} geographic blends, ${overlap} overlaps, dry arrivals, real walking, exact core geometry, legacy art, clock and saved addresses`);
})().catch(e=>{console.error(e);process.exitCode=1;});
