'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),M=require('../math.js');
for(const file of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','meadow-canopy','instanced-environment','grass-stream','meadow-field'])require('../'+file+'.js');
const F=SphereMeadowCanopy,Ec=SphereMeadowEcology,workers=[],uploads=[],deleted=[];
const s=SpherePacks.activate({...M.defaultState(),collection:true,multipleWounds:false,seed:713,provinceSeed:713,time:2468,playing:false});
s.meadow=Ec.createProfile(s,{densityBladesPerM2:290,appearanceRevision:4,appearancePreset:'meadow-proof-f2',worker:true});
s.position=M.mul(Ec.chartDirection(s,4,4),s.radius-.0017);
const a=s,b={...s,geographyRevision:s.geographyRevision+1,meadow:{...s.meadow}},c={...s,terrainRevision:s.terrainRevision+1,meadow:{...s.meadow}};
const descriptorA=F.buildDescriptor(a),descriptorB=F.buildDescriptor(b),descriptorC=F.buildDescriptor(c);
assert.notEqual(descriptorA.key,descriptorB.key);assert.notEqual(descriptorB.key,descriptorC.key);
const OriginalWorker=global.Worker;
global.Worker=class{constructor(url){this.url=url;workers.push(this);}postMessage(message){this.message=message;}terminate(){this.terminated=true;}reply(descriptor){this.onmessage({data:{generation:this.message.generation,descriptor,prepareMs:1}});}};
let bound=null,allocations=0;
const gl={TEXTURE0:0,TEXTURE15:15,TEXTURE_2D:3553,RGBA8:32856,RGBA:6408,UNSIGNED_BYTE:5121,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,LINEAR_MIPMAP_LINEAR:9987,LINEAR:9729,CLAMP_TO_EDGE:33071,activeTexture(){},bindTexture(target,texture){bound=texture;},createTexture(){return {id:++allocations};},texImage2D(...args){uploads.push({texture:bound,data:args[8],bytes:args[8].byteLength});},generateMipmap(){},texParameteri(){},uniform1i(){},uniform3fv(){},uniform2fv(){},uniform1f(){},deleteTexture(texture){deleted.push(texture);}};
const u={uMeadowDescriptor:1,uMeadowMaterialRevision:2,uMeadowChartX:3,uMeadowChartZ:4,uMeadowChartCamera:5,uMeadowCanopyPalette:6,uMeadowWetPalette:7,uMeadowRoughness:8,uMeadowWindTime:9,uMeadowWindStrength:10},field=new F.GroundField(gl);
try{
 field.request(a);workers[0].reply(descriptorA);assert.equal(field.pending,descriptorA);
 field.request(b);assert.equal(field.pending,null,'an accepted obsolete descriptor must be discarded before binding new geography');field.bind(u,b);assert.equal(uploads.length,0,'obsolete A must never upload');assert.equal(allocations,0);assert.equal(field.info.ready,false);
 workers[0].reply(descriptorA);assert.equal(field.pending,null,'late old-generation replies must remain discarded');assert.equal(field.info.stale,2);
 workers[1].reply(descriptorB);field.bind(u,b);assert.equal(uploads.length,1);assert.equal(uploads[0].data,descriptorB.data);assert.equal(uploads[0].bytes,16384);assert.equal(allocations,1);assert.equal(field.readyKey,descriptorB.key);assert.equal(field.info.residentBytes,21846);assert.equal(field.info.frameUploadedBytes,16384);
 const retained=field.texture;
 for(let i=0;i<12;i++){field.request({...b,time:b.time+i,forward:i%2?[0,1,0]:b.forward});field.bind(u,b);assert.equal(field.texture,retained);assert.equal(field.info.frameUploadedBytes,0);}
 assert.equal(workers.length,2);assert.equal(uploads.length,1);assert.equal(allocations,1,'settled light/rotation changes retain the descriptor texture');
 const inactive={...c,meadow:{...c.meadow,enabled:false}};
 field.request(c);workers[2].reply(descriptorC);assert.equal(field.pending,descriptorC);field.request(inactive);field.bind(u,inactive);assert.equal(field.pending,null,'disabling meadow discards an accepted pending descriptor');assert.equal(uploads.length,1,'inactive rendering cannot upload the former meadow descriptor');assert.equal(field.info.ready,false);assert.equal(field.key,'');assert.equal(field.readyKey,'');
 workers[2].reply(descriptorC);assert.equal(field.pending,null,'inactive generation rejects a queued worker reply');
 const inactiveGeneration=field.generation;for(let i=0;i<12;i++){field.request(inactive);field.bind(u,inactive);}assert.equal(field.generation,inactiveGeneration,'settled inactive frames do not churn generations');assert.equal(workers.length,3);assert.equal(uploads.length,1);
 field.request(c);assert.equal(workers.length,4,'reactivation of the same geographic key must start a valid descriptor request');workers[3].reply(descriptorC);field.bind(u,c);assert.equal(uploads.length,2);assert.equal(uploads[1].data,descriptorC.data);assert.equal(field.texture,retained);assert.equal(allocations,1,'reactivation reuses the retained GPU texture');assert.equal(field.readyKey,descriptorC.key);
 field.request(a);const canceledByInactive=workers[4];field.request(inactive);assert(canceledByInactive.terminated,'inactive arrival cancels an in-flight descriptor worker');canceledByInactive.reply(descriptorA);field.bind(u,inactive);assert.equal(field.pending,null);assert.equal(uploads.length,2);
 // Binding also rejects an inactive or mismatched current state, independently
 // of the renderer's ordinary request-before-bind call order.
 field.request(a);workers[5].reply(descriptorA);field.bind(u,inactive);assert.equal(field.pending,null);assert.equal(uploads.length,2,'bind must reject inactive pending descriptors without allocating or uploading');
 field.request(a);assert.equal(workers.length,7,'same active key recovers immediately after defensive inactive bind, without another inactive request');workers[6].reply(descriptorA);field.bind(u,a);assert.equal(uploads.length,3);assert.equal(uploads[2].data,descriptorA.data);assert.equal(field.texture,retained);assert.equal(allocations,1);
 field.request(c);workers[7].reply(descriptorC);field.bind(u,a);assert.equal(field.pending,null);assert.equal(uploads.length,3,'bind must reject descriptors from a different current key');assert.equal(field.key,'');assert.equal(field.info.ready,false);
 field.request(c);assert.equal(workers.length,9,'same active key recovers immediately after mismatched bind, without an intervening inactive request');workers[8].reply(descriptorC);field.bind(u,c);assert.equal(uploads.length,4);assert.equal(uploads[3].data,descriptorC.data);assert.equal(field.texture,retained);assert.equal(allocations,1);
 for(let i=0;i<12;i++){field.request({...c,time:c.time+i});field.bind(u,c);assert.equal(field.info.frameUploadedBytes,0);}assert.equal(uploads.length,4);assert.equal(allocations,1);
 field.request(a);const finalWorker=workers[9];field.dispose();finalWorker.reply(descriptorA);assert.equal(field.pending,null,'disposal rejects replies already queued by the terminated worker');assert.equal(field.texture,null);assert.equal(field.info.residentBytes,0);assert.equal(field.info.ready,false);assert.deepEqual(deleted,[retained]);assert(finalWorker.terminated);
 const result={status:'PASS',acceptedObsoleteDescriptorUploads:0,inactiveDescriptorUploads:0,mismatchedKeyDescriptorUploads:0,lateGenerationRepliesDiscarded:true,inactiveWorkerCanceled:true,sameKeyReactivationRecovers:true,sameKeyDefensiveBindRecovery:true,validDescriptorUploads:4,initialValidDescriptorUploads:1,reactivationValidDescriptorUploads:1,defensiveBindRecoveryUploads:2,validUploadBytesPerDescriptor:16384,residentMipBytes:21846,stationaryActiveFrames:24,stationaryInactiveFrames:12,stationaryUploads:0,stationaryAllocations:0,textureRetained:true,postDisposeReplyDiscarded:true,disposal:true};
 if(process.env.IB075_F_OUTPUT){fs.mkdirSync(process.env.IB075_F_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.IB075_F_OUTPUT,'f-ground-lifecycle-contracts.json'),JSON.stringify(result,null,2)+'\n');}console.log(JSON.stringify(result));
}finally{global.Worker=OriginalWorker;}
