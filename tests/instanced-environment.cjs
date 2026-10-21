const assert=require('node:assert/strict');
const E=require('../instanced-environment.js');

const triangle=(scale=1)=>({vertices:[-scale,0,0,0,1,0,scale,0,0,0,1,0,0,scale,0,0,1,0],indices:[0,1,2]});
const tree=E.createPrototype({id:'meadow-tuft',lods:[triangle(.5),triangle(.25)],lodDistances:[0,20],albedo:[.2,.6,.25,1]});
assert.equal(tree.lods[0].indexType,'UNSIGNED_SHORT');
assert.equal(tree.lods[0].indexCount,3);
assert.equal(E.selectLod(tree,0),0);
assert.equal(E.selectLod(tree,21),1);

const instances=[
 E.createInstance({prototypeId:'meadow-tuft',origin:[0,0,20],addressKey:'c0'}),
 E.createInstance({prototypeId:'meadow-tuft',origin:[0,0,10],addressKey:'c1'}),
 E.createInstance({prototypeId:'meadow-tuft',origin:[0,0,30],addressKey:'c2'})
];
const patch=E.createPatch({id:'patch-0',center:[0,0,25],radius:40,instances});
assert.equal(E.packInstances(instances).byteLength,instances.length*E.STRIDE);
const population={prototypes:[tree],patches:[patch]};
const camera={basis:{f:[0,0,1],r:[1,0,0],u:[0,1,0]},fov:90,aspect:16/9};
let plan=E.planDraws(population,camera);
assert.equal(plan.visiblePatches,1);
assert.equal(plan.commands.length,1);
assert.deepEqual(plan.commands[0].instances.map(v=>v.addressKey),['c0','c1','c2']);

const diagonalEdge=E.createPatch({id:'diagonal-edge',center:[-1.2,0,1],radius:.15,instances:[instances[0]]});
assert.equal(E.visiblePatch(diagonalEdge,{basis:{f:[0,0,1],r:[1,0,0],u:[0,1,0]},fov:90,aspect:1}),true,'culling expands plane distance by its unnormalised normal length');

const outside=E.createPatch({id:'outside',center:[1000,0,0],radius:1,instances:[instances[0]]});
plan=E.planDraws({prototypes:[tree],patches:[outside]},camera);
assert.equal(plan.visiblePatches,0);
assert.deepEqual(plan.culled,['outside']);

const transparent=E.createPrototype({id:'mist',...triangle(.5),transparent:true});
const tInstances=[E.createInstance({prototypeId:'mist',origin:[0,0,30],addressKey:'near'}),E.createInstance({prototypeId:'mist',origin:[0,0,10],addressKey:'far'})];
plan=E.planDraws({prototypes:[transparent],patches:[E.createPatch({id:'transparent',center:[0,0,20],radius:30,instances:tInstances})]},camera);
assert.deepEqual(plan.commands[0].instances.map(v=>v.addressKey),['near','far']);

const reordered=E.planDraws({prototypes:[tree],patches:[E.createPatch({id:'patch-0',center:[0,0,25],radius:40,instances:instances.slice().reverse()})]},camera);
assert.deepEqual(reordered.commands[0].instances.map(v=>v.addressKey),plan.commands[0].instances.map(v=>v.addressKey).slice(0,0).concat(['c0','c1','c2']),'Opaque ordering is address-stable');
assert.equal(E.hashString('same'),E.hashString('same'));
const syntheticA=E.syntheticPopulation({seed:42,patchCount:3,instancesPerPatch:12}),syntheticB=E.syntheticPopulation({seed:42,patchCount:3,instancesPerPatch:12});
assert.deepEqual(syntheticA.patches.map(p=>p.instances.map(i=>i.addressKey)),syntheticB.patches.map(p=>p.instances.map(i=>i.addressKey)),'Synthetic addresses are repeatable');
assert.deepEqual(E.planDraws(syntheticA,camera).commands.map(c=>[c.patch.id,c.lodIndex,c.instances.map(i=>i.seed)]),E.planDraws(syntheticB,camera).commands.map(c=>[c.patch.id,c.lodIndex,c.instances.map(i=>i.seed)]),'Synthetic draw plan is repeatable');
console.log(JSON.stringify({status:'PASS',stride:E.STRIDE,prototypeBytes:tree.lods.reduce((n,l)=>n+l.bytes,0),planned:reordered.commands.length,culled:1,syntheticInstances:36}));
