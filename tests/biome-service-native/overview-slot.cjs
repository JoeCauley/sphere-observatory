'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=process.argv[2];if(!out||!path.isAbsolute(out))throw Error('Fresh absolute evidence directory required');fs.mkdirSync(out,{recursive:false});
const paths=['overview-index.js','overview-shader.js'].map(p=>fs.realpathSync(path.resolve(__dirname,'../../biome-service/native',p))),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),sources=paths.map(p=>({path:p,bytes:fs.statSync(p).size,sha256:hash(fs.readFileSync(p))}));
const O=require('../../biome-service/native/overview-shader.js');let active=1015;const textures=new Map([[1005,'previous-tree'],[1015,'accepted-meadow']]),writes=[];
const gl={TEXTURE0:1000,TEXTURE_2D:2000,ACTIVE_TEXTURE:3000,TEXTURE_BINDING_2D:3001,MAX_TEXTURE_IMAGE_UNITS:3002,getParameter(n){if(n===3000)return active;if(n===3001)return textures.get(active);if(n===3002)return 16;throw Error('Unexpected GL query');},activeTexture(n){active=n;},bindTexture(t,v){assert.equal(t,2000);textures.set(active,v);},uniform1i(...v){writes.push(v);},uniform1uiv(){},uniform3fv(){},uniform1ui(){}};
const fd={assignmentCount:2,cameraHigh:new Float32Array(3),cameraLow:new Float32Array(3),colors:new Float32Array(384)},tree={texture:'new-tree',roots:[1,2,3,4,5,6],assignmentCount:2};let groups=0,refusals=0;
function restored(){assert.equal(active,1015);assert.equal(textures.get(1005),'previous-tree');assert.equal(textures.get(1015),'accepted-meadow');}
try{
 assert.equal(O.TEXTURE_UNIT,5);assert.equal(O.bind,undefined);groups++;
 const r=O.withBound(gl,{uBpsTree:'tree'},fd,tree,()=>{assert.equal(active,1005);assert.equal(textures.get(1005),'new-tree');assert.equal(textures.get(1015),'accepted-meadow');return 37;});assert.equal(r,37);restored();assert(writes.some(v=>v[0]==='tree'&&v[1]===5));groups++;
 assert.throws(()=>O.withBound(gl,{},fd,tree,()=>{throw Error('draw failed');}),/draw failed/);restored();refusals++;groups++;
 assert.throws(()=>O.withBound(gl,{},fd,tree,async()=>{}),e=>e.code==='INVALID_CALLBACK');restored();refusals++;
 assert.throws(()=>O.withBound(gl,{},fd,tree,()=>Promise.resolve()),e=>e.code==='INVALID_CALLBACK');restored();refusals++;groups++;
 assert.throws(()=>O.withBound(gl,{},fd,{...tree,assignmentCount:1},()=>{}),e=>e.code==='INVALID_INDEX');restored();refusals++;groups++;
 assert(sources.every(s=>hash(fs.readFileSync(s.path))===s.sha256));const result={format:'sphere-biome-overview-slot-component/1',status:'PASS',createdUtc:new Date().toISOString(),groups,refusals,sources,sourceIntegrity:'PASS',scope:'Instrumented GL binding and actual source guard. Native linked sampler validation and main renderer NOT_RUN.'};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}catch(e){fs.writeFileSync(path.join(out,'failure.txt'),e.stack+'\n',{flag:'wx'});console.error(e.stack);process.exitCode=1;}
