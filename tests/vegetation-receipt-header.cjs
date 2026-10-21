'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),V=require('../vegetation-service.js');
const group={prototypeId:'prototype:é🌾\ud800',prototypeRevision:'版1',materialId:'葉:😀',materialRevision:'révision1',shaderVariant:'foliage2',geometryLod:0,pass:'colour',recordSchema:'sphere-instance32-v1',coordinateSpace:'resident-chart-km',tier:'detail'};
function make(action){const service=new V.VegetationService({limits:{maxWorkers:1}});service.register({id:'receipt:日本🌾',recipeRevision:1,recordSchema:group.recordSchema,stride:32,coordinateSpace:group.coordinateSpace,configure:()=>({contentKey:'配置:é😀',state:{seed:1}}),normalizeBlock:input=>({id:input.id,parent:'parent:日本🌾',count:5}),estimate:()=>({records:5,detailedRecords:5,cpuBytes:4256,packetBytes:4256,scratchBytes:1024}),validatePacket:packet=>action?.(packet)});service.setScene('scene:é🌾');service.configure('receipt:日本🌾',{});assert(service.reserve('receipt:日本🌾',{id:'block:é😀\ud800'}).ok);const job=service.dispatch(),records=Uint8Array.from({length:160},(_,i)=>(i*13+7)&255),packet=V.createPacket(job,{records,groups:[{...group,count:5,byteOffset:0,byteLength:160}],bounds:{center:[0,0,0],radius:1,units:'km',coordinateSpace:group.coordinateSpace},recordCount:5,detailedCount:5,coarseCount:0,byteLength:160});return {service,job,packet};}
// Independent crypto hashes cover exact UTF-8 header snapshots, split blocks,
// supplementary Unicode and JSON's escaped lone surrogate representation.
let unicodeCases=0;for(const header of ['', 'é日本🌾😀', JSON.stringify({key:'\ud800',value:'𐀀é'}), 'x'.repeat(63)+'🌾', 'x'.repeat(64)+'é']){const bytes=new TextEncoder().encode(header),records=Uint8Array.from({length:161},(_,i)=>(i*29)&255),expected=crypto.createHash('sha256').update(bytes).update(records).digest('hex');assert.equal(V.sha256(bytes,records),expected);assert.equal(V.sha256(header,records),expected);unicodeCases++;}
const cases=[];
function run(id,action,{prepare=null,expectedOk=true,expectedReason=null,expectedEncodes=2,expectValidation=true,expectedRetainedHashMatches=true,expectedEvents=null}={}){const events=[];let firstHeaderBytes=null,encodeCalls=0;const p=make(packet=>{events.push('provider-validation');action?.(packet,{firstHeaderBytes,events,replaceEncoder(){TextEncoder.prototype.encode=function(){encodeCalls++;events.push('replacement-encode');throw Error('encode sentinel');};}});});prepare?.(p.packet);const originalEncode=TextEncoder.prototype.encode;
 TextEncoder.prototype.encode=function(input){encodeCalls++;events.push('header-encode');const bytes=originalEncode.call(this,input);firstHeaderBytes??=bytes;return bytes;};let result;
 try{result=p.service.receive(p.job,p.packet);}finally{TextEncoder.prototype.encode=originalEncode;}
 assert.equal(result.ok,expectedOk,id);if(expectedReason)assert.match(result.reason,expectedReason,id);assert.equal(encodeCalls,expectedEncodes,id+' original header encoding calls');assert.equal(events.includes('provider-validation'),expectValidation,id+' validation order');const normalEvents=expectValidation?['header-encode','provider-validation',...(expectedEncodes===2?['header-encode']:[])]:[];assert.deepEqual(events,expectedEvents||normalEvents,id+' original provider/header/hash call order');
 if(expectedOk){const retained=p.service.allocations.get(result.handle.reservationToken).packet;assert.equal(retained.contentHash===V.packetHash(retained),expectedRetainedHashMatches,id+' exact retained snapshot behavior');assert.equal(p.packet.records.buffer.byteLength,0,id+' transfers former owner');}else assert.equal(p.service.allocations.size,0,id+' rejection releases allocation');
 cases.push({id,resultOk:result.ok,reason:result.reason||null,encodeCalls,events});p.service.dispose();
}
run('valid-unicode-header',null);
run('provider-mutates-records',packet=>{packet.records[0]^=1;},{expectedOk:false,expectedReason:/packet content hash mismatch/});
// The previous implementation hashes the pre-validation serialized header even
// if a provider mutates header metadata. Confirm that exact snapshot behavior:
// retained packetHash then differs; receive acceptance itself stays unchanged.
run('provider-mutates-hash-covered-metadata',packet=>{packet.block+='changed';},{expectedOk:true,expectedRetainedHashMatches:false});
run('provider-throws-before-hash',()=>{throw Error('provider sentinel');},{expectedOk:false,expectedReason:/provider sentinel/,expectedEncodes:1});
run('corrupt-content-hash',null,{prepare:packet=>{packet.contentHash='0'.repeat(64);},expectedOk:false,expectedReason:/packet content hash mismatch/});
run('malformed-count-before-header-encoding',null,{prepare:packet=>{packet.recordCount++;},expectedOk:false,expectedReason:/packet count\/byte envelope exceeded/,expectedEncodes:0,expectValidation:false});
// These original callback effects rejected the attempted allocation saving:
// reusing the first UTF-8 buffer would accept the replaced encoder case and
// reject the captured-buffer case. Keep both original outcomes exact.
run('provider-replaces-encoder',(_packet,control)=>control.replaceEncoder(),{expectedOk:false,expectedReason:/encode sentinel/,expectedEvents:['header-encode','provider-validation','replacement-encode']});
run('provider-mutates-captured-first-header',(_packet,control)=>{control.firstHeaderBytes[0]^=1;});
const report={schema:1,status:'PASS',unicodeCases,cases,originalReceiptCallbackSemanticsPreserved:true,rejectedAllocationTrial:{kind:'reuse-first-UTF8-header-buffer',status:'REJECTED',exactCallbackMismatchCases:2},scope:'Original synchronous receipt snapshot/hash/callback/rejection contracts, including two retained rejection controls for the allocation trial. No browser/native/performance/ownership claim.'};module.exports=report;if(require.main===module)console.log(JSON.stringify(report));
