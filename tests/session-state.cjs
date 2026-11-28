const assert=require('node:assert/strict'),M=require('../math.js');require('../collection.js');require('../biomes.js');require('../world-palette.js');require('../world.js');require('../session-state.js');
const C=SphereSessionCodec,state={...M.defaultState(),collection:true,era:'after',exposure:1.7,antialias:3,localShadows:2,richMaterials:false,weatherQuality:2,cavityHaze:.43,time:9876,timeRate:600,playing:true,quality:.75},ui={values:{adaptivePreview:false,exportSize:'3840'},tab:'lighting'};
const saved=C.decode(C.encode(state,ui));assert.equal(saved.state.playing,false);for(const key of ['exposure','antialias','localShadows','richMaterials','weatherQuality','cavityHaze','time','timeRate','quality'])assert.equal(saved.state[key],state[key]);assert.deepEqual(saved.state.position,state.position);assert.deepEqual(saved.ui,ui);assert.equal(state.playing,true);
const resumed=C.decode(JSON.stringify({format:'sphere-session',version:1,state:{...state,walkVelocity:.01}}));assert.equal(resumed.state.playing,false);assert.equal(resumed.state.walkVelocity,0);
const historic={...state};
delete historic.shadeFractureRevision;
assert.equal(state.shadeFractureRevision,2,'New explorations use structural fractures');
const imported=M.validate(historic);
assert(!Object.hasOwn(imported,'shadeFractureRevision'),'Historical portable states retain their serialized fields');
assert.equal(SphereCollection.plates(imported).find(p=>p.damage).damage,1,'An unversioned scene uses its original openings');
assert.equal(C.decode(C.encode(imported)).state.shadeFractureRevision,1,'An imported historical view survives an autosave and restart');
assert.equal(C.decode(JSON.stringify({format:'sphere-session',version:2,state:historic})).state.shadeFractureRevision,2);
for(const revision of [1,2]){
 const explicit={...state,shadeFractureRevision:revision};
 assert.equal(C.decode(C.encode(explicit)).state.shadeFractureRevision,revision);
 assert.equal(M.validate(M.sceneRecord(explicit).state).shadeFractureRevision,revision);
}
assert.throws(()=>M.validate({...state,shadeFractureRevision:9}),/fracture revision/);
// Only a camera caught inside material newly occupying an old crack moves.
const CShade=SphereCollection,oldShade={...historic,shadeGeometryRevision:3,shadeShape:'disk'};
const plate=CShade.plates({...oldShade,shadeFractureRevision:2})[0];
let filled;
for(let i=-8;i<9&&!filled;i++)for(let j=-8;j<9&&!filled;j++){
 const x=i/10*plate.size*plate.across,y=j/10*plate.size;
 if(CShade.diskContains(x,y,plate)&&!CShade.diskContains(x,y,{...plate,damage:1}))filled=[x,y];
}
assert(filled,'Expected a previously open part of this Shade to contain material');
const facePoint=M.add(M.mul(plate.center,state.radius),M.add(M.mul(plate.right,filled[0]*state.radius),M.mul(plate.up,filled[1]*state.radius)));
const position=M.add(facePoint,M.mul(plate.normal,.05));
const resumedPlate=C.decode(JSON.stringify({format:'sphere-session',version:2,shadeBodyVersion:3,state:{...oldShade,position}})).state;
assert(Math.abs(M.dot(M.sub(resumedPlate.position,facePoint),plate.normal)+.002)<1e-7);
for(const raw of ['{','null','[]',JSON.stringify({format:'sphere-session',version:99,state}),JSON.stringify({format:'sphere-session',version:1,state:{...state,exposure:1e20}}),' '.repeat(1000001)])assert.throws(()=>C.decode(raw));
console.log('PASS versioned session round trip, paused restoration, unchanged source, invalid/corrupt/oversized record rejection.');
