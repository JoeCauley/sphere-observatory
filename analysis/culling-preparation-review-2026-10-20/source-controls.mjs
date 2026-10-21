import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url)).replaceAll('\\','/');
if(!process.argv[2])throw Error('Provide a fresh output JSON path; existing reports are never overwritten.');
const output=pathToFileURL(process.argv[2]);
if(fs.existsSync(output))throw Error('The output already exists; select a fresh path.');
const {selection,createFacility}=await import(pathToFileURL(root+'packs/infinite-industry/1.0.0/facility.js'));
const {buildZone,movingGeometry}=await import(pathToFileURL(root+'packs/infinite-industry/1.0.0/geometry.js'));
const context=vm.createContext({console});context.window=context;
for(const file of ['math.js','geometry-renderer.js','instanced-environment.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),context,{filename:file});
const basis={f:[0,0,1],r:[1,0,0],u:[0,1,0]},state={position:[0,0,0],fov:90};
const camera={basis,fov:90,aspect:1};
const visibility=[];
for(const [name,center,half,expected] of [
 ['ahead',[0,0,10],1,true],['behind',[0,0,-10],1,false],
 ['side',[30,0,10],1,false],['touching-edge',[11,0,10],1,true],
 ['enclosing-camera',[0,0,0],2,true],['no-far-plane',[0,0,1e8],1,true]
]){
 const mesh={count:3,origin:center,basis:[[1,0,0],[0,1,0],[0,0,1]],bvh:{min:[-half,-half,-half],max:[half,half,half]}};
 const meshVisible=context.SphereGeometryVisible(mesh,state,basis,1);
 const patchVisible=context.SphereInstancedEnvironment.visiblePatch({center,radius:half},camera);
 assert.equal(meshVisible,expected,name+' mesh');assert.equal(patchVisible,expected,name+' patch');
 visibility.push({name,center,half,expected,meshVisible,patchVisible});
}
assert.equal(context.SphereGeometryVisible({count:3},state,basis,1),true,'missing mesh bound must fail open');
assert.equal(context.SphereInstancedEnvironment.visiblePatch({center:[0,0,-10],boundsRadius:1},{...camera,culling:false}),true,'explicit culling disable');
assert.equal(context.SphereInstancedEnvironment.visiblePatch({center:[11,0,10],boundsRadius:1},camera),true,'resident boundsRadius edge guard');

// These are the actual existing production vertices. A demand-radius counterexample
// establishes that those 2D scheduling radii cannot simply become view bounds.
const bounds=[];let vertices=0;
for(const width of [150,300])for(let orientation=0;orientation<6;orientation++)for(const model of [0,1]){
 const config=selection(undefined,undefined,{acrossFlatsM:width,orientation,model}),facility=createFacility(config);
 for(const zone of facility.zones)for(const lod of ['near','middle','far']){
  const data=buildZone(config,zone.id,lod),center=[zone.worldCenter[0]-facility.center[0],48,zone.worldCenter[1]-facility.center[1]];
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let maxHorizontal=0,max3D=0;
  for(let i=0;i<data.length;i+=9){const v=[data[i],data[i+1],data[i+2]];assert(v.every(Number.isFinite));vertices++;for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}maxHorizontal=Math.max(maxHorizontal,Math.hypot(v[0]-center[0],v[2]-center[2]));max3D=Math.max(max3D,Math.hypot(...v.map((x,k)=>x-center[k])));}
  bounds.push({width,orientation,model,zone:zone.id,lod,vertices:data.length/9,bytes:data.byteLength,demandRadius:zone.radius,center,min,max,maxHorizontal,max3D,horizontalOutsideDemandRadius:maxHorizontal>zone.radius+1e-4});
 }
}
const yard=bounds.find(r=>r.width===150&&r.orientation===0&&r.model===0&&r.zone==='yard'&&r.lod==='near');
assert(yard.horizontalOutsideDemandRadius,'expected scheduling-radius counterexample');
const motion=[];
for(const routing of ['distribution','recovery'])for(const transition of [0,.5,1])for(const time of [0,1,10,30]){
 const data=movingGeometry(selection(),time,routing,transition),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<data.length;i+=9)for(let k=0;k<3;k++){assert(Number.isFinite(data[i+k]));min[k]=Math.min(min[k],data[i+k]);max[k]=Math.max(max[k],data[i+k]);}
 motion.push({routing,transition,time,vertices:data.length/9,bytes:data.byteLength,min,max});
}
const report={scope:'Existing pure source behavior and sampled generated geometry, not a new culler, universal bounds proof, native render or performance measurement.',date:new Date().toISOString(),visibility,additionalVisibilityAssertions:3,geometryCases:bounds.length,verticesInspected:vertices,bounds,motionCases:motion.length,motion,defaultYardCounterexample:yard};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'PASS',visibilityCases:visibility.length,additionalVisibilityAssertions:3,geometryCases:bounds.length,verticesInspected:vertices,motionCases:motion.length,defaultYardCounterexample:{demandRadius:yard.demandRadius,maxHorizontal:yard.maxHorizontal,max3D:yard.max3D},output:output.pathname,reportSHA256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')}));
