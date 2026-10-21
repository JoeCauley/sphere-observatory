'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=process.argv[2];assert(out&&path.isAbsolute(out)&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:false});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),files=['shared-gpu-backend.js','overview-index.js','positions-backend.js'].map(name=>fs.realpathSync(path.resolve(__dirname,'../../biome-service/native',name))),sources=files.map(file=>({path:file,bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))}));
const B=require('../../biome-service/native/shared-gpu-backend.js'),program={},vao={},gl={LINK_STATUS:1,fenceSync(){},bindVertexArray(){},isProgram:p=>p===program,getProgramParameter:()=>true,isVertexArray:v=>v===vao,getAttribLocation:()=>0,getUniformLocation:(_p,name)=>name==='uLightDirection'?null:{name}};let groups=0,refusals=0;
try{
 assert.throws(()=>B.create({gl,program,vao}),e=>e.code==='BACKEND_CONTRACT');refusals++;groups++;
 const backend=B.create({gl,program,vao,drawProfile:'host-world-surface-v1'});assert(B.isOwner(backend));assert.equal(typeof backend.backend.submit,'function');assert.equal(typeof backend.createOwnershipTexture,'function');groups++;
 assert.throws(()=>B.create({gl,program,vao,drawProfile:'pack-selected-shader'}),e=>e.code==='BACKEND_CONTRACT');refusals++;
 const locations=gl.getUniformLocation;gl.getUniformLocation=(_p,name)=>name==='uColor'?null:locations(_p,name);assert.throws(()=>B.create({gl,program,vao,drawProfile:'host-world-surface-v1'}),e=>e.code==='BACKEND_CONTRACT');refusals++;groups++;
 assert(sources.every(s=>hash(fs.readFileSync(s.path))===s.sha256));
 const result={format:'sphere-biome-shared-host-draw-profile-component/1',status:'PASS',createdUtc:new Date().toISOString(),groups,refusals,sources,sourceIntegrity:'PASS',qualification:'Static composite root layout admission with instrumented GL; actual native compilation/main renderer/material/depth NOT_RUN.'};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}catch(e){fs.writeFileSync(path.join(out,'failure.txt'),e.stack+'\n',{flag:'wx'});console.error(e.stack);process.exitCode=1;}
