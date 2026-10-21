'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),V=require('../vegetation-service.js');
const oracle=(...parts)=>{const h=crypto.createHash('sha256');for(const part of parts)h.update(part);return h.digest('hex');};
let checks=0;
// Independent crypto covers both padding boundaries, direct and split blocks,
// supplementary Unicode, empty parts and the largest admitted header size.
for(const length of [0,1,2,3,7,31,55,56,57,63,64,65,127,128,129,255,256,257,1023,1024,4095,4096,47440,262144,1048576,2097152]){
 const data=Uint8Array.from({length},(_,i)=>(i*137+(i>>>8))&255),expected=oracle(data);assert.equal(V.sha256(data),expected);checks++;
 for(const cut of [...new Set([0,1,Math.min(55,length),Math.min(63,length),Math.min(64,length),Math.floor(length/2),length])].filter(n=>n<=length)){assert.equal(V.sha256(data.subarray(0,cut),new Uint8Array(0),data.subarray(cut)),expected);checks++;}
 for(const text of ['', 'é日本🌾😀','x'.repeat(63)+'🌾',JSON.stringify({surrogate:'\ud800'})]){assert.equal(V.sha256(text,data),oracle(text,data));checks++;}
}
for(const value of [null,{},[1],new Int8Array(4),42]){assert.throws(()=>V.sha256(value),/SHA-256 requires bytes/);checks++;}
// A caller-controlled byte getter may reenter hashing and mutate later bytes.
const bytes=Uint8Array.from({length:145},(_,i)=>(i*19)&255),reads=[];let nested=false;
const proxy=new Proxy(bytes,{get(target,key){reads.push(String(key));if(key==='0'&&!nested){nested=true;bytes[3]^=1;assert.equal(V.sha256('nested'),oracle('nested'));}const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
assert.equal(V.sha256(proxy),oracle(bytes));assert.deepEqual(reads.filter(k=>/^\d+$/.test(k)),Array.from({length:128},(_,i)=>String(i)));checks+=2;
// Observe a substituted scratch constructor without changing host constructors.
// Every original schedule get/set and all 64 ordered round reads are required.
const source=fs.readFileSync(path.join(__dirname,'../vegetation-service.js'),'utf8'),localRequire=require('node:module').createRequire(path.join(__dirname,'../vegetation-service.js'));
function scratch(mode){const tapes=[],nestedDigests=[];let api,entered=false;const sandbox={module:{exports:{}},require:localRequire,Uint8Array,Uint32Array:function(n){assert.equal(n,64);const id=tapes.length,tape=[];tapes.push(tape);return new Proxy(new Uint32Array(n),{get(t,k){tape.push('get:'+String(k));if(mode==='reentrant'&&!entered&&k==='1'){entered=true;nestedDigests.push(api.sha256('scratch callback'));}if(mode==='throw'&&k==='1')throw Error('scratch getter sentinel');return Reflect.get(t,k,t);},set(t,k,v){tape.push('set:'+String(k));return Reflect.set(t,k,v,t);}});},TextEncoder,ArrayBuffer,DataView,performance,structuredClone};
 vm.runInNewContext(source,sandbox,{filename:'isolated-sha-contract'});api=sandbox.module.exports;const data=Uint8Array.from({length:128},(_,i)=>(i*23)&255);let digest=null,error=null;try{digest=api.sha256(data);}catch(e){error=e.message;}return {tapes,nestedDigests,digest,error,data};}
const blockTape=[];for(let i=0;i<16;i++)blockTape.push('set:'+i);for(let i=16;i<64;i++)blockTape.push('get:'+(i-15),'get:'+(i-2),'get:'+(i-16),'get:'+(i-7),'set:'+i);for(let i=0;i<64;i++)blockTape.push('get:'+i);
for(const mode of ['plain','reentrant']){const r=scratch(mode);assert.equal(r.digest,oracle(r.data));assert.equal(r.error,null);assert.deepEqual(r.tapes[0],[...blockTape,...blockTape,...blockTape]);assert.equal(r.tapes.length,mode==='plain'?1:2);if(mode==='reentrant'){assert.deepEqual(r.tapes[1],blockTape);assert.deepEqual(r.nestedDigests,[oracle('scratch callback')]);}checks++;}
const thrown=scratch('throw');assert.equal(thrown.error,'scratch getter sentinel');assert.equal(thrown.digest,null);assert.deepEqual(thrown.tapes[0],[...Array.from({length:16},(_,i)=>'set:'+i),'get:1']);checks++;
const report={schema:1,status:'PASS',checks,independentCrypto:true,originalOrderedByteAndScratchAccess:true,reentrantCallbacks:true,unchangedScratchAllocations:{blockBytes:64,scheduleBytes:256},scope:'Synchronous SHA contract only. Both receipt encodes and provider/callback/rejection order are covered separately by vegetation-receipt-header.cjs. No native/performance/ownership certification.'};
module.exports=report;if(require.main===module)console.log(JSON.stringify(report));
