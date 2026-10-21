const assert=require('node:assert/strict'),A=require('../world-address.js'),fs=require('node:fs'),path=require('node:path');

const metadata={worldSeed:713,geographyRevision:1,terrainRevision:2,artRevision:2,assetRevision:1,heroRevision:null};
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/world-address-v2.json'),'utf8'));
assert.deepEqual(A.parse(A.stringify(fixture)),fixture,'Golden shell fixture must be canonical');
assert.equal(A.stringify(fixture),JSON.stringify(fixture),'Golden serialization must be stable');

const directions={
 '+x':[1,0,0],'-x':[-1,0,0],'+y':[0,1,0],'-y':[0,-1,0],'+z':[0,0,1],'-z':[0,0,-1],
 'edge+x+y':[1,1,0], 'edge-y-z':[0,-1,-1], 'corner+x+y+z':[1,1,1],
 'polar-entry-a':[.0000000001,1,-.0000000002], 'polar-entry-b':[-.0000000001,-1,.0000000002],
 'wound-adjacent':[.61,.22,.76]
};
for(const [name,direction] of Object.entries(directions)){
 const address=A.shell({...metadata,direction,level:8});
 const returned=A.direction(address),length=Math.hypot(...returned),error=Math.hypot(...returned.map((v,i)=>v/length-direction[i]/Math.hypot(...direction)));
 assert.equal(address.schema,2);assert.equal(address.space,'shell');assert.equal(address.level,8);assert(error<1e-14,`${name} round trip drift ${error}`);
 assert.deepEqual(A.parse(A.stringify(address)),address,`${name} serialization`);
}

for(const level of [0,1,4,12]){
 for(const direction of Object.values(directions)){
  const a=A.shell({...metadata,direction,level}),p=A.parent(a);
  assert.equal(p.level,Math.max(0,level-1));
  if(level>0){const q=A.child(p,A.quadrant(a));assert(A.equal(q,a),`Parent/child conversion failed at level ${level}`);}
 }
}

const legacy={schema:1,packId:'watershed',geographyRevision:1,artRevision:2,seed:713,anchor:[0.2,0.3,Math.sqrt(1-.2*.2-.3*.3)]};
const migrated=A.legacyPack(legacy,{terrainRevision:2,assetRevision:1,level:12});
assert.equal(migrated.schema,2);assert.equal(migrated.space,'shell');assert.deepEqual(A.toLegacyPack(migrated),legacy,'Schema-1 pack migration must retain provenance');
assert.deepEqual(A.toLegacyPack(A.legacyPack({...legacy,artRevision:1})),{...legacy,artRevision:1},'Legacy art revision must survive migration');
assert.throws(()=>A.legacyPack({...legacy,artRevision:3}),/schema-1/);

const shade=A.shade({...metadata,shadeId:7,parent:fixture,direction:[.8,.1,-.4],level:6});
assert.equal(shade.space,'shade');assert.equal(shade.shadeId,7);assert.deepEqual(shade.parent,{face:fixture.face,level:fixture.level,x:fixture.x,y:fixture.y,local:fixture.local});assert.equal(A.featureId('waterway',fixture,'river-17'),'waterway:713:1:s0.4.8.7:river-17');assert.equal(A.featureId('landmark',shade,'tower_a'),'landmark:713:1:h7.0.6.48.36:tower_a');
for(const direction of [[1,0,0],[-1,0,0]]){const face=A.shade({...metadata,shadeId:7,parent:fixture,direction,level:6});assert.equal(face.space,'shade');assert(face.face===0||face.face===1,'Shade face must be explicit');assert.deepEqual(A.parse(A.stringify(face)),face);}
assert.throws(()=>A.featureId('unknown',fixture),/domain/);assert.throws(()=>A.parse(JSON.stringify({...fixture,space:'camera'})),/Invalid World Address/);

console.log(JSON.stringify({status:'PASS',schema:2,fixture:A.stringify(fixture),faces:Object.keys(directions).length,parentChildLevels:[0,1,4,12],legacyMigration:true,shade:true}));
