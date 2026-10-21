const assert=require('node:assert/strict');
const A=require('../world-address.js'),T=require('../world-topology.js'),G=require('../world-geography.js');

const metadata={worldSeed:713,geographyRevision:2,terrainRevision:2,artRevision:1,assetRevision:1,heroRevision:null};
const direction=[.231,.811,.539],address=A.shell({...metadata,direction,level:6});
const field=G.query(address);
for(const key of ['elevationKm','slope','geology','wetness','biomeWeights','catchment','water','route','landUseRole','damage','exclusionMasks','featureIds'])assert(key in field,`Missing semantic field ${key}`);
assert.equal(field.source,'generated');assert.equal(field.biomeWeights.length,10);assert(Math.abs(field.biomeWeights.reduce((a,b)=>a+b,0)-1)<1e-12);
assert.deepEqual(G.query(address),G.query(A.parse(A.stringify(address))),'Serialized address must resolve to the same geography');

// Changing viewing representation preserves the semantic answer and address.
for(const representation of G.REPRESENTATIONS){const view=G.atScale(address,representation);assert.equal(view.representation,representation);assert.equal(view.elevationKm,field.elevationKm);assert.equal(view.biome,field.biome);assert.equal(view.water.membership,field.water.membership);assert.equal(view.route.membership,field.route.membership);}

// Parent/child addresses at the same represented place share the authoritative
// semantic lattice, while their address levels remain distinct.
const parent=A.parent(address),child=A.child(parent,A.quadrant(address)),parentField=G.query(parent),childField=G.query(child);
assert.equal(parent.level,address.level-1);assert.equal(child.level,address.level);
for(const key of ['elevationKm','slope','geology','wetness','biome','damage'])assert.equal(parentField[key],childField[key],`Parent/child ${key} mismatch`);
assert.equal(parentField.featureIds.vegetation,childField.featureIds.vegetation,'Persistent feature ID moved during refinement');

// Canonical lattice points are shared at exact cube-face joins.
const edge={face:0,level:5,x:0,y:7},point=T.boundaryLattice(edge,'west',4,8),left=A.shell({...metadata,direction:point.direction,level:6}),right=A.shell({...metadata,direction:point.direction,level:6});
assert.deepEqual(G.cpuProbe(left),G.cpuProbe(right),'Face-join probe changed semantic answer');

const parity=G.probeParity(address);assert(parity.pass);assert.equal(parity.maxError,0);

// Revision 1 remains an explicit compatibility path for saved scenes.
global.SphereWorld={sample:()=>({a:2,b:2,blend:0,id:2,damage:.25})};
const legacy=G.query([1,0,0],{state:{seed:713,radius:10000000,layoutVersion:1,geographyRevision:1}});
assert.equal(legacy.source,'legacy-atlas');assert.equal(legacy.revision,1);assert.equal(legacy.biome,2);delete global.SphereWorld;

console.log(JSON.stringify({status:'PASS',revision:G.FIELD_REVISION,generatedRevision:G.GENERATED_REVISION,representations:G.REPRESENTATIONS.length,probeWidth:G.cpuProbe(address).length,faceJoin:true,legacyCompatibility:true}));
