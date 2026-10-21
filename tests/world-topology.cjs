const assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const T=require('../world-topology.js');

const key=c=>T.cellKey(c),sameCell=(a,b)=>key(a)===key(b);
const cells=[];
for(const level of [0,1,3,5]){
 const size=2**level;
 for(let face=0;face<6;face++)for(const [x,y] of [[0,0],[size-1,size-1],[Math.floor(size/2),Math.floor(size/3)]])cells.push({face,level,x,y});
}

// Every directed edge has an inverse, including the twelve face joins.
let neighbourChecks=0,edgeSamples=0;
for(const c of cells)for(const edge of T.EDGES){
 const n=T.neighbour(c,edge),reverse=T.EDGES.find(candidate=>sameCell(T.neighbour(n,candidate),c));
 assert(reverse,`Missing inverse for ${key(c)} ${edge}`);
 assert.equal(T.edgeKey(c,edge),T.edgeKey(n,reverse),'Edge ownership key must be reciprocal');
 const owner=T.edgeOwner(c,edge),other=T.edgeOwner(n,reverse);
 assert.deepEqual(owner.cell,other.cell,'Canonical edge owner must be reciprocal');
 assert.equal(owner.owner,!other.owner,'Exactly one cell owns an edge');
 const a=[],b=[];
 for(let i=0;i<=8;i++){a.push(T.boundaryLattice(c,edge,i,8).key);b.push(T.boundaryLattice(n,reverse,i,8).key);}
 assert.deepEqual(new Set(a),new Set(b),'Cube-face edge samples must have one canonical lattice key');
 neighbourChecks++;edgeSamples+=a.length;
}

// The integer lattice is also the refinement contract: a parent's 2x2
// refinement and its four level+1 children resolve identical boundary points.
const sampler=T.sampler({worldSeed:713,geographyRevision:1,terrainRevision:2});
for(const parent of [{face:0,level:0,x:0,y:0},{face:2,level:3,x:3,y:5},{face:5,level:5,x:17,y:9}]){
 const coarse=sampler.sampleCell(parent,{resolution:2}),byKey=new Map(coarse.vertices.map(v=>[v.key,v]));
 for(const child of T.children(parent))for(const vertex of sampler.sampleCell(child).vertices){
  const corresponding=byKey.get(vertex.key);if(!corresponding)continue;
  assert.equal(vertex.elevation,corresponding.elevation,'Elevation refinement must preserve parent samples');
  assert.equal(vertex.water,corresponding.water,'Water refinement must preserve parent samples');
  assert.equal(vertex.route,corresponding.route,'Route refinement must preserve parent samples');
  assert.deepEqual(vertex.biomeWeights,corresponding.biomeWeights,'Biome refinement must preserve parent samples');
 }
}

// A semantic stream is counter/hash based, not a mutable sequence.  Adding or
// reordering another domain cannot move the existing geography.
const point=T.boundaryLattice({face:0,level:4,x:0,y:7},'east',3,8).key;
const first=sampler.samplePoint(point),second=sampler.samplePoint(point);
assert.deepEqual(first,second);
assert.equal(sampler.random('elevation',point,11),sampler.random('elevation',point,11));
assert.notEqual(sampler.random('elevation',point,11),sampler.random('water',point,11));
assert.throws(()=>sampler.random('elevation',point,-1),/counter/);

function generation(order){
 const out={};for(const index of order){const c=cells[index];out[key(c)]=sampler.sampleCell(c,{resolution:2});}
 return JSON.stringify(Object.fromEntries(Object.keys(out).sort().map(k=>[k,out[k]])));
}
const indices=cells.map((_,i)=>i),reverse=indices.slice().reverse(),shuffled=indices.slice().sort((a,b)=>(a*7919%97)-(b*7919%97));
assert.equal(generation(indices),generation(reverse),'Reversed generation order must not change samples');
assert.equal(generation(indices),generation(shuffled),'Permuted generation order must not change samples');
const partitions=[[],[],[]];for(const i of shuffled)partitions[i%3].push(i);assert.equal(generation(indices),generation(partitions.flat().reverse()),'Worker partition order must not change samples');

// Cold-process comparison catches accidental module or process-local state.
const modulePath=path.join(__dirname,'..','world-topology.js');
const child=cp.spawnSync(process.execPath,['-e',`const T=require(${JSON.stringify(modulePath)}),s=T.sampler({worldSeed:713,geographyRevision:1,terrainRevision:2});const c={face:4,level:6,x:31,y:12};console.log(JSON.stringify(s.sampleCell(c,{resolution:3})));`],{encoding:'utf8'});
assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),JSON.stringify(sampler.sampleCell({face:4,level:6,x:31,y:12},{resolution:3})),'Cold process must return identical samples');

console.log(JSON.stringify({status:'PASS',neighbourChecks,edgeSamples,cells:cells.length,semanticDomains:T.DOMAINS.length,coldProcess:true,orderPermutations:3}));
