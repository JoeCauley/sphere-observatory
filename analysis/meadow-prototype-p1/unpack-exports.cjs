'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cfg=require('./last-run.json');
const dir=path.join(cfg.evidence,'browser-2026-10-05T14-55-12-104Z'),run=require(path.join(dir,'run.json')),rows=[],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const projection of ['perspective','panorama']){
 const zip=fs.readFileSync(path.join(dir,'p1-'+projection+'-3840.zip')),target=path.join(dir,'unpacked-'+projection);fs.mkdirSync(target);
 let at=0,files=[];
 while(zip.readUInt32LE(at)===0x04034b50){
  assert.equal(zip.readUInt16LE(at+8),0,'Expected production stored ZIP');const size=zip.readUInt32LE(at+18),nameLength=zip.readUInt16LE(at+26),extra=zip.readUInt16LE(at+28),name=zip.subarray(at+30,at+30+nameLength).toString('utf8');
  assert(['photograph.png','scene.json','READ-ME.txt'].includes(name));const start=at+30+nameLength+extra,bytes=zip.subarray(start,start+size);
  fs.writeFileSync(path.join(target,name),bytes,{flag:'wx'});files.push({name,bytes:bytes.length,sha256:sha(bytes)});at=start+size;
 }
 assert.equal(files.length,3);const png=fs.readFileSync(path.join(target,'photograph.png'));assert.equal(png.subarray(1,4).toString(),'PNG');
 const scene=require(path.join(target,'scene.json')),capture=run.experiments.exports.find(e=>e.projection===projection),coverage=capture.render.instancedEnvironment.coverage;
 rows.push({projection,width:png.readUInt32BE(16),height:png.readUInt32BE(20),internal:[capture.render.internalWidth,capture.render.internalHeight],files,zipSha256:sha(zip),capturedWindPhase:scene.state.meadow.windPhaseSeconds,faceWindPhases:capture.render.panoramaWindPhases||null,glError:capture.glError,demandConflict:coverage.frame.demandConflict||null,viewReady:coverage.frame.viewReady??null,foregroundReady:coverage.foregroundReady,status:'ENCODED_CAPTURE_COMPLETENESS_UNPROVED',profile:'meadow-prototype-p1',revision:2,overlaySha256:run.sourceManifest.find(s=>s.path==='canopy-p1.js').sha256,qualification:'Production ZIP base-build/scene labels do not encode this experimental overlay; retain this sidecar and original run/source manifests with these images.'});
}
const report={schema:1,profile:'meadow-prototype-p1',revision:2,status:'EXPORT_ENCODING_PASS_CAPTURE_CONTRACT_OPEN',rows,scope:'Actual SphereApp.capture PNG/scene ZIPs, exact dimensions and phase metadata; no foreground/capture-union or I/B1 acceptance'};
fs.writeFileSync(path.join(dir,'export-readback.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.copyFileSync(__filename,path.join(dir,'source-unpack-exports.cjs'));console.log(JSON.stringify(report));
