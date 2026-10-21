/* P4 resumable receipt implementation, generated from pinned native code.
 * Native validation and SHA operations retained in order. Quanta yield only
 * inside preparation; no validation is delegated or excluded from telemetry. */
(function(root){
'use strict';
const V=root.SphereVegetationService;const grass=()=>root.SphereGrass;
 const PACKET_REVISION=2,STRIDE=32,SIZE_CLASS=64;
const LIMITS=Object.freeze({detailedRecords:500000,records:550000,gpuSlots:550016,gpuBytes:32*1048576,cpuBytes:64*1048576,packetBytes:4*1048576,scratchBytes:48*1048576,maxQueue:32,maxWorkers:2,maxAllocations:128,maxAllocationRecords:65536,maxConfigurationBytes:262144});
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const encoder=new TextEncoder(),ror=(x,n)=>(x>>>n)|(x<<(32-n));
const clock=()=>typeof performance==='undefined'?Date.now():performance.now();
const packetRevisions=r=>({resourceRevision:r.context.value.state?.meadow?.residentResourceRevision??1,selectionRevision:r.context.value.state?.meadow?.selectionRevision??1});
let issuerSerial=0;
// Incremental SHA-256: no payload-sized hash staging copy.
function sha256(...parts){
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],block=new Uint8Array(64),w=new Uint32Array(64);let used=0,length=0;
 function compress(bytes=block,offset=0){for(let i=0;i<16;i++){const j=offset+i*4;w[i]=((bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3])>>>0;}for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(ror(a,7)^ror(a,18)^(a>>>3))+w[i-7]+(ror(b,17)^ror(b,19)^(b>>>10)))>>>0;}
  let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],q=h[7];
for(let i=0;i<64;i+=8){
 {const t=(q+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+(g^(e&(f^g)))+K[i]+w[i])>>>0,u=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&b)|(c&(a|b))))>>>0;d=(d+t)>>>0;q=(t+u)>>>0;}
 {const t=(g+(((d>>>6)|(d<<26))^((d>>>11)|(d<<21))^((d>>>25)|(d<<7)))+(f^(d&(e^f)))+K[i+1]+w[i+1])>>>0,u=((((q>>>2)|(q<<30))^((q>>>13)|(q<<19))^((q>>>22)|(q<<10)))+((q&a)|(b&(q|a))))>>>0;c=(c+t)>>>0;g=(t+u)>>>0;}
 {const t=(f+(((c>>>6)|(c<<26))^((c>>>11)|(c<<21))^((c>>>25)|(c<<7)))+(e^(c&(d^e)))+K[i+2]+w[i+2])>>>0,u=((((g>>>2)|(g<<30))^((g>>>13)|(g<<19))^((g>>>22)|(g<<10)))+((g&q)|(a&(g|q))))>>>0;b=(b+t)>>>0;f=(t+u)>>>0;}
 {const t=(e+(((b>>>6)|(b<<26))^((b>>>11)|(b<<21))^((b>>>25)|(b<<7)))+(d^(b&(c^d)))+K[i+3]+w[i+3])>>>0,u=((((f>>>2)|(f<<30))^((f>>>13)|(f<<19))^((f>>>22)|(f<<10)))+((f&g)|(q&(f|g))))>>>0;a=(a+t)>>>0;e=(t+u)>>>0;}
 {const t=(d+(((a>>>6)|(a<<26))^((a>>>11)|(a<<21))^((a>>>25)|(a<<7)))+(c^(a&(b^c)))+K[i+4]+w[i+4])>>>0,u=((((e>>>2)|(e<<30))^((e>>>13)|(e<<19))^((e>>>22)|(e<<10)))+((e&f)|(g&(e|f))))>>>0;q=(q+t)>>>0;d=(t+u)>>>0;}
 {const t=(c+(((q>>>6)|(q<<26))^((q>>>11)|(q<<21))^((q>>>25)|(q<<7)))+(b^(q&(a^b)))+K[i+5]+w[i+5])>>>0,u=((((d>>>2)|(d<<30))^((d>>>13)|(d<<19))^((d>>>22)|(d<<10)))+((d&e)|(f&(d|e))))>>>0;g=(g+t)>>>0;c=(t+u)>>>0;}
 {const t=(b+(((g>>>6)|(g<<26))^((g>>>11)|(g<<21))^((g>>>25)|(g<<7)))+(a^(g&(q^a)))+K[i+6]+w[i+6])>>>0,u=((((c>>>2)|(c<<30))^((c>>>13)|(c<<19))^((c>>>22)|(c<<10)))+((c&d)|(e&(c|d))))>>>0;f=(f+t)>>>0;b=(t+u)>>>0;}
 {const t=(a+(((f>>>6)|(f<<26))^((f>>>11)|(f<<21))^((f>>>25)|(f<<7)))+(q^(f&(g^q)))+K[i+7]+w[i+7])>>>0,u=((((b>>>2)|(b<<30))^((b>>>13)|(b<<19))^((b>>>22)|(b<<10)))+((b&c)|(d&(b|c))))>>>0;e=(e+t)>>>0;a=(t+u)>>>0;}
}
h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+q)>>>0;
 }
 function byte(v){block[used++]=v;if(used===64){compress();used=0;}}
 for(const part of parts){const bytes=typeof part==='string'?encoder.encode(part):part;if(!(bytes instanceof Uint8Array))throw Error('SHA-256 requires bytes');length+=bytes.length;let offset=0;
  if(used){const take=Math.min(64-used,bytes.length);block.set(bytes.subarray(0,take),used);used+=take;offset+=take;if(used===64){compress();used=0;}}
  for(;offset+64<=bytes.length;offset+=64)compress(bytes,offset);
  if(offset<bytes.length){block.set(bytes.subarray(offset),used);used+=bytes.length-offset;}
 }
 byte(128);while(used!==56)byte(0);const bits=length*8,high=Math.floor(bits/4294967296),low=bits>>>0;for(let i=3;i>=0;i--)byte(high>>>(i*8));for(let i=3;i>=0;i--)byte(low>>>(i*8));return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
const deeplyFrozen=new WeakSet();
function immutable(value){if(value&&typeof value==='object'&&!deeplyFrozen.has(value)){for(const v of Object.values(value))immutable(v);Object.freeze(value);deeplyFrozen.add(value);}return value;}
function integer(v,name,min=0){if(!Number.isSafeInteger(v)||v<min)throw Error('Invalid '+name);return v;}
function text(v,name){if(typeof v!=='string'||!v||v.length>8192)throw Error('Invalid '+name);return v;}
function fields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Unsupported packet metadata');}
const batchKeys=new WeakMap(),batchFields=['prototypeId','prototypeRevision','materialId','materialRevision','shaderVariant','geometryLod','pass','recordSchema','coordinateSpace'];
function batchKey(group){const old=batchKeys.get(group);if(old!==undefined)return old;const key=canonical([text(group.prototypeId,'prototype'),text(group.prototypeRevision,'prototype revision'),text(group.materialId,'material'),text(group.materialRevision,'material revision'),text(group.shaderVariant,'shader'),integer(group.geometryLod,'geometry LOD'),text(group.pass,'pass'),text(group.recordSchema,'record schema'),text(group.coordinateSpace,'coordinate space')]);if(deeplyFrozen.has(group)&&batchFields.every(name=>{const d=Object.getOwnPropertyDescriptor(group,name);return d&&'value'in d;}))batchKeys.set(group,key);return key;}
function contentHeader(p){return {providerId:p.providerId,recipeRevision:p.recipeRevision,contentKey:p.contentKey,configurationHash:p.configurationHash,recordSchema:p.recordSchema,resourceRevision:p.resourceRevision,selectionRevision:p.selectionRevision,parent:p.parent,block:p.block,bounds:p.bounds,groups:p.groups,...(p.regions===undefined?{}:{regions:p.regions}),recordCount:p.recordCount,detailedCount:p.detailedCount,coarseCount:p.coarseCount,byteLength:p.byteLength};}
function packetHash(p){return sha256(canonical(contentHeader(p)),p.records);}
function createPacket(job,body){const p={kind:'vegetation-packet',packetRevision:PACKET_REVISION,sceneKey:job.sceneKey,providerId:job.providerId,recipeRevision:job.recipeRevision,contentKey:job.contentKey,configurationHash:job.configurationHash,requestGeneration:job.requestGeneration,reservationToken:job.reservationToken,slotGeneration:job.slotGeneration,slotStart:job.slotStart,slotCapacity:job.slotCapacity,recordSchema:job.recordSchema,resourceRevision:job.resourceRevision,selectionRevision:job.selectionRevision,parent:job.block.parent,block:job.block.id,...body};p.contentHash=packetHash(p);return p;}


function* shaSteps(...parts){
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],block=new Uint8Array(64),w=new Uint32Array(64);let used=0,length=0,quantum=0;
 function compress(bytes=block,offset=0){for(let i=0;i<16;i++){const j=offset+i*4;w[i]=((bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3])>>>0;}for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(ror(a,7)^ror(a,18)^(a>>>3))+w[i-7]+(ror(b,17)^ror(b,19)^(b>>>10)))>>>0;}
  let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],q=h[7];
for(let i=0;i<64;i+=8){
 {const t=(q+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+(g^(e&(f^g)))+K[i]+w[i])>>>0,u=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&b)|(c&(a|b))))>>>0;d=(d+t)>>>0;q=(t+u)>>>0;}
 {const t=(g+(((d>>>6)|(d<<26))^((d>>>11)|(d<<21))^((d>>>25)|(d<<7)))+(f^(d&(e^f)))+K[i+1]+w[i+1])>>>0,u=((((q>>>2)|(q<<30))^((q>>>13)|(q<<19))^((q>>>22)|(q<<10)))+((q&a)|(b&(q|a))))>>>0;c=(c+t)>>>0;g=(t+u)>>>0;}
 {const t=(f+(((c>>>6)|(c<<26))^((c>>>11)|(c<<21))^((c>>>25)|(c<<7)))+(e^(c&(d^e)))+K[i+2]+w[i+2])>>>0,u=((((g>>>2)|(g<<30))^((g>>>13)|(g<<19))^((g>>>22)|(g<<10)))+((g&q)|(a&(g|q))))>>>0;b=(b+t)>>>0;f=(t+u)>>>0;}
 {const t=(e+(((b>>>6)|(b<<26))^((b>>>11)|(b<<21))^((b>>>25)|(b<<7)))+(d^(b&(c^d)))+K[i+3]+w[i+3])>>>0,u=((((f>>>2)|(f<<30))^((f>>>13)|(f<<19))^((f>>>22)|(f<<10)))+((f&g)|(q&(f|g))))>>>0;a=(a+t)>>>0;e=(t+u)>>>0;}
 {const t=(d+(((a>>>6)|(a<<26))^((a>>>11)|(a<<21))^((a>>>25)|(a<<7)))+(c^(a&(b^c)))+K[i+4]+w[i+4])>>>0,u=((((e>>>2)|(e<<30))^((e>>>13)|(e<<19))^((e>>>22)|(e<<10)))+((e&f)|(g&(e|f))))>>>0;q=(q+t)>>>0;d=(t+u)>>>0;}
 {const t=(c+(((q>>>6)|(q<<26))^((q>>>11)|(q<<21))^((q>>>25)|(q<<7)))+(b^(q&(a^b)))+K[i+5]+w[i+5])>>>0,u=((((d>>>2)|(d<<30))^((d>>>13)|(d<<19))^((d>>>22)|(d<<10)))+((d&e)|(f&(d|e))))>>>0;g=(g+t)>>>0;c=(t+u)>>>0;}
 {const t=(b+(((g>>>6)|(g<<26))^((g>>>11)|(g<<21))^((g>>>25)|(g<<7)))+(a^(g&(q^a)))+K[i+6]+w[i+6])>>>0,u=((((c>>>2)|(c<<30))^((c>>>13)|(c<<19))^((c>>>22)|(c<<10)))+((c&d)|(e&(c|d))))>>>0;f=(f+t)>>>0;b=(t+u)>>>0;}
 {const t=(a+(((f>>>6)|(f<<26))^((f>>>11)|(f<<21))^((f>>>25)|(f<<7)))+(q^(f&(g^q)))+K[i+7]+w[i+7])>>>0,u=((((b>>>2)|(b<<30))^((b>>>13)|(b<<19))^((b>>>22)|(b<<10)))+((b&c)|(d&(b|c))))>>>0;e=(e+t)>>>0;a=(t+u)>>>0;}
}
h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+q)>>>0;
 }
 function byte(v){block[used++]=v;if(used===64){compress();used=0;}}
 for(const part of parts){const bytes=typeof part==='string'?encoder.encode(part):part;if(!(bytes instanceof Uint8Array))throw Error('SHA-256 requires bytes');length+=bytes.length;let offset=0;
  if(used){const take=Math.min(64-used,bytes.length);block.set(bytes.subarray(0,take),used);used+=take;offset+=take;if(used===64){compress();used=0;}}
  for(;offset+64<=bytes.length;offset+=64){compress(bytes,offset);if(++quantum===32){quantum=0;yield {phase:"hash",bytes:offset+64};}}
  if(offset<bytes.length){block.set(bytes.subarray(offset),used);used+=bytes.length-offset;}
 }
 byte(128);while(used!==56)byte(0);const bits=length*8,high=Math.floor(bits/4294967296),low=bits>>>0;for(let i=3;i>=0;i--)byte(high>>>(i*8));for(let i=3;i>=0;i--)byte(low>>>(i*8));return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}

function* validateRegionsSteps(packet,block,{packetBounds=null}={}){
 const regions=packet.regions;if(!Array.isArray(regions)||regions.length!==block.regions.length)throw Error('Missing compact regions');
 for(const region of regions){if(Object.keys(region).some(k=>!['center','radius','counts'].includes(k))||!Array.isArray(region.center)||region.center.length!==3||!region.center.every(Number.isFinite)||!Number.isFinite(region.radius)||region.radius<=0||!Array.isArray(region.counts)||region.counts.length!==packet.groups.length||!region.counts.every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Invalid compact region metadata');}
 const view=new DataView(packet.records.buffer);for(let g=0;g<packet.groups.length;g++){let offset=packet.groups[g].byteOffset,total=0;for(const region of regions){const count=region.counts[g];total+=count;const [rx,ry,rz]=region.center;for(let i=0;i<count;i++){const x=view.getFloat32(offset,true),y=view.getFloat32(offset+4,true),z=view.getFloat32(offset+8,true);if(Math.hypot(x-rx,y-ry,z-rz)+.004>region.radius+1e-8)throw Error('Compact child outside geographic envelope');if(packetBounds){const scale=view.getFloat32(offset+20,true),c=packetBounds.center;if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(scale)||scale<=0||scale>.004||Math.hypot(x-c[0],y-c[1],z-c[2])+.004>packetBounds.radius+1e-8)throw Error('Invalid packed record or conservative sphere');}offset+=STRIDE;if((i&127)===127)yield {phase:"record-envelope",group:g,record:i};}}yield {phase:'region-group',group:g};if(total!==packet.groups[g].count)throw Error('Incomplete compact region ranges');}
}

function* validatePacketSteps(p,block,config){for(const group of p.groups){const declared=config.catalog[group.prototypeId];if(!declared||V.batchKey(group)!==V.batchKey(declared)||group.tier!==declared.tier)throw Error('Unsupported provider prototype/material batch');}
 if(block.tier==='clump'&&p.detailedCount!==0)throw Error('Clump job returned detailed records');
 const frame=grass().frameForMeadowChart(config.state);
 if(block.compactRevision){yield* validateRegionsSteps(p,block,{packetBounds:p.bounds});for(let i=0;i<block.regions.length;i++){const b=block.regions[i],s=root.SphereMeadowSupport.query(config.state,(b[0]+b[2])*.5,(b[1]+b[3])*.5),delta=s.point.map((v,k)=>v-frame.origin[k]),c=frame.basis.map(axis=>root.SphereMath.dot(delta,axis));if(p.regions[i].center.some((v,k)=>Math.abs(v-c[k])>1e-9)||p.regions[i].radius>1)throw Error('Mismatched compact region bounds');yield {phase:'terrain-region',index:i};}}else if(p.regions!==undefined)throw Error('Unexpected compact metadata on legacy parent');
 // Bounds are tied to the immutable chart frame, not an arbitrary render rebase.
 const support=root.SphereMeadowSupport.query(config.state,(block.chartBoundsMetres[0]+block.chartBoundsMetres[2])*.5,(block.chartBoundsMetres[1]+block.chartBoundsMetres[3])*.5),delta=support.point.map((v,i)=>v-frame.origin[i]),center=frame.basis.map(axis=>root.SphereMath.dot(delta,axis));
 if(p.bounds.center.some((v,i)=>Math.abs(v-center[i])>1e-9)||p.bounds.radius>1)throw Error('Mismatched Meadow chart bounds');
 // Every packed origin and a conservative maximum botanical/wind envelope
 // must fit the supplied sphere. This checks producer bounds, not visibility.
 if(block.compactRevision)return; // Both packed-record envelopes were checked in the same regional scan.
 const view=new DataView(p.records.buffer),envelope=.004;
 for(let i=0;i<p.recordCount;i++){const base=i*32,origin=[view.getFloat32(base,true),view.getFloat32(base+4,true),view.getFloat32(base+8,true)],scale=view.getFloat32(base+20,true);if(!origin.every(Number.isFinite)||!Number.isFinite(scale)||scale<=0||scale>.004||Math.hypot(...origin.map((v,k)=>v-p.bounds.center[k]))+envelope>p.bounds.radius+1e-8)throw Error('Invalid packed record or conservative sphere');}
}

function* receiveSteps(expected,packet){
  const r=this.allocations.get(expected?.reservationToken);if(!r||r.status!=='preparing'){this.counters.staleArrivals=(this.counters.staleArrivals||0)+1;return this.reject(r,'obsolete, cancelled or duplicate arrival',packet);}
  try{
   if(!this.allocator.valid(expected)||r.sceneKey!==this.sceneKey||this.current.get(r.context.providerId)!==r.context)throw Error('obsolete scene or slots');
   const job={...this.handle(r),packetRevision:PACKET_REVISION,providerId:r.provider.id,recipeRevision:r.provider.recipeRevision,contentKey:r.context.contentKey,configurationHash:r.context.configurationHash,recordSchema:r.provider.recordSchema,...packetRevisions(r)};
   fields(packet,['kind','packetRevision','sceneKey','providerId','recipeRevision','contentKey','configurationHash','requestGeneration','reservationToken','slotGeneration','slotStart','slotCapacity','recordSchema','resourceRevision','selectionRevision','parent','block','bounds','groups','regions','recordCount','detailedCount','coarseCount','byteLength','records','contentHash','prepareMs']);
   if(packet?.kind!=='vegetation-packet')throw Error('invalid packet kind');for(const [k,v]of Object.entries(job))if(packet[k]!==v)throw Error('mismatched '+k);if(packet.prepareMs!==undefined&&(!Number.isFinite(packet.prepareMs)||packet.prepareMs<0))throw Error('invalid worker preparation timing');
   if(packet.parent!==r.block.parent||packet.block!==r.block.id)throw Error('mismatched geographic ownership');
   const bytes=packet.records;if(!(bytes instanceof Uint8Array)||!(bytes.buffer instanceof ArrayBuffer)||bytes.byteOffset!==0||bytes.byteLength!==bytes.buffer.byteLength)throw Error('packet must own its complete transferred backing allocation');
   for(const k of ['recordCount','detailedCount','coarseCount','byteLength'])integer(packet[k],k);if(packet.recordCount>r.credit.records||packet.detailedCount>r.credit.detailedRecords||packet.detailedCount+packet.coarseCount!==packet.recordCount||packet.byteLength!==packet.recordCount*STRIDE||bytes.byteLength!==packet.byteLength||packet.byteLength>r.credit.packetBytes)throw Error('packet count/byte envelope exceeded');
   const b=packet.bounds;fields(b,['units','coordinateSpace','center','radius']);if(b.units!=='km'||b.coordinateSpace!==r.provider.coordinateSpace||!Array.isArray(b.center)||b.center.length!==3||!b.center.every(Number.isFinite)||!Number.isFinite(b.radius)||b.radius<=0)throw Error('invalid conservative bounds');
   if(!Array.isArray(packet.groups)||packet.groups.length>32)throw Error('invalid batch groups');let offset=0,detail=0,coarse=0;const keys=new Set();
   for(const g of packet.groups){fields(g,['prototypeId','prototypeRevision','materialId','materialRevision','shaderVariant','geometryLod','pass','recordSchema','coordinateSpace','tier','byteOffset','byteLength','count']);integer(g.count,'group count',1);if(g.byteOffset!==offset||g.byteLength!==g.count*STRIDE||g.recordSchema!==r.provider.recordSchema||g.coordinateSpace!==r.provider.coordinateSpace)throw Error('invalid group layout');const key=batchKey(g);if(keys.has(key))throw Error('duplicate batch group');keys.add(key);if(g.tier==='detail')detail+=g.count;else if(g.tier==='coarse')coarse+=g.count;else throw Error('invalid group tier');offset+=g.byteLength;}
   yield {phase:"header"};const encodedHeader=canonical(contentHeader(packet));if(encoder.encode(encodedHeader).byteLength>r.metadataBytes)throw Error('Packet metadata exceeds reserved allowance');
   if(packet.regions!==undefined){const list=packet.regions,plainArray=(a,n)=>Array.isArray(a)&&a.length<=n&&Object.keys(a).every(k=>/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<a.length);if(!plainArray(list,Math.min(64,r.block.regions?.length||4)))throw Error('Invalid bounded region metadata');for(const region of list){fields(region,['center','radius','counts']);if(!plainArray(region.center,3)||region.center.length!==3||!region.center.every(Number.isFinite)||!Number.isFinite(region.radius)||region.radius<=0||!plainArray(region.counts,32)||region.counts.length!==packet.groups.length||!region.counts.every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Invalid bounded region metadata');}}
   if(offset!==packet.byteLength||detail!==packet.detailedCount||coarse!==packet.coarseCount)throw Error('incomplete packet groups');yield {phase:"metadata"};yield* validatePacketSteps(packet,r.block,r.context.value);
   if(typeof packet.contentHash!=='string'||packet.contentHash!==(yield* shaSteps(encodedHeader,packet.records)))throw Error('packet content hash mismatch');
   yield {phase:"validated"};if(!this.allocator.valid(expected)||r.status!=="preparing"||r.sceneKey!==this.sceneKey||this.current.get(r.context.providerId)!==r.context)throw Error("obsolete scene or slots after resumed validation");
   // Transfer, never copy: caller's view becomes detached. Retained metadata is bounded.
   const owned=structuredClone(packet,{transfer:[bytes.buffer]});immutable(owned.groups);r.packet=owned;r.status='CPU ready';r.readyAt=clock();this.timings.dispatchToReadyMs=r.readyAt-r.dispatchedAt;this.timings.maximumDispatchToReadyMs=Math.max(this.timings.maximumDispatchToReadyMs,this.timings.dispatchToReadyMs);this.counters.transferredBytes=(this.counters.transferredBytes||0)+owned.byteLength;r.slot=this.allocator.shrink(r.token,owned.recordCount);
   const next={...r.credit,records:owned.recordCount,detailedRecords:owned.detailedCount,gpuSlots:r.slot.capacity,gpuBytes:r.slot.capacity*STRIDE,cpuBytes:owned.byteLength+r.metadataBytes,packetBytes:0,scratchBytes:0};for(const k of Object.keys(next))this.usage[k]+=next[k]-r.credit[k];r.credit=next;this.counters.accepted++;this.recordPeak();return Object.freeze({ok:true,handle:this.handle(r),recordCount:owned.recordCount,contentHash:owned.contentHash});
  }catch(e){return this.reject(r,e.message,packet);}
 }

function* packetHashSteps(p){return yield* shaSteps(canonical(contentHeader(p)),p.records);}
root.SphereMeadowResumableP4={shaSteps,packetHashSteps,receiveSteps,validatePacketSteps,validateRegionsSteps};
})(window);
