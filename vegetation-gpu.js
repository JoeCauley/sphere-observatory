/* HR-03 persistent WebGL2 records, with the HR-06 equivalent F2 GPU adapter.
 * Geography and allocation lifetimes belong to the shared service; the backend
 * never repacks or renames the planted population. */
(function(root){
'use strict';
const V=root.SphereVegetationService||(typeof require==='function'?require('./vegetation-service.js'):null);
const STRIDE=32,GPU_RECORD_BYTES=40,PARAMETER_STAGING_RECORDS=8192,DETAIL_BIT=0x80000000,SLOT_MASK=0x7fffffff;
const REPRESENTATION_REVISION=2,STEM_MASK_WORDS=9,STEM_MASK_WIDTH=1024,STEM_MASK_HEIGHT=144,STEM_MASK_BYTES=65536*STEM_MASK_WORDS*4,NATIVE_SEED_BATCH=16384;
const integer=(n,label,min=0)=>{if(!Number.isSafeInteger(n)||n<min)throw Error('Invalid '+label);return n;};
function layout(slots,maxTextureSize,width=2048){
 integer(slots,'GPU slots',1);integer(maxTextureSize,'texture size',1);integer(width,'texture width',2);
 if(slots>SLOT_MASK)throw Error('Slot references exceed 31 bits');
 width=Math.min(width,maxTextureSize);width-=width%2;
 const height=Math.ceil(slots*2/width);
 if(width<2||height>maxTextureSize)throw Error('Vegetation records exceed texture capabilities');
 return Object.freeze({width,height,slots,allocatedTexels:width*height,paddingSlots:width*height/2-slots,bytes:width*height*16,format:'RGBA32UI'});
}
function addressing(width){if(!Number.isSafeInteger(width)||width<2||!Number.isInteger(Math.log2(width)))return null;const shift=Math.log2(width);return Object.freeze({width,shift,mask:width-1,parameterWidth:width/2,parameterShift:shift-1,parameterMask:width/2-1});}
function textureVertex(source,{readiness=false,zeroWeightStems=false,stemWeightMasks=false,deferredDecode=false,recordWidth=0}={}){
 if(zeroWeightStems&&!readiness)throw Error('Native stem masks require per-reference readiness');
 if(stemWeightMasks&&!zeroWeightStems)throw Error('Native positive-weight masks require zero-weight masks');
 source=source.replace(/layout\(location=[2-6]\)\s*in\s+(?:vec[234]|float)\s+a(?:Origin|Quaternion|Scale|Colour|Params);/g,'');
 const declarations=`\nprecision highp int;precision highp usampler2D;
layout(location=2) in uint aSlotReference;
uniform usampler2D uRecords;uniform sampler2D uParameters;uniform int uRecordWidth;
${zeroWeightStems?'uniform usampler2D uStemZeroRanks;uniform vec3 uStemWeightThresholds;':''}
${readiness?'flat out uint vDetailAvailable;':''}
float signed16(uint word){return max(-1.,float(int(word<<16u)>>16)*(1./32767.));}
`;
 const address=addressing(recordWidth),recordAt=value=>address?`ivec2((${value})&${address.mask},(${value})>>${address.shift})`:`ivec2((${value})%uRecordWidth,(${value})/uRecordWidth)`,parametersAt=address?`ivec2(int(slot)&${address.parameterMask},int(slot)>>${address.parameterShift})`:'ivec2(int(slot)%(uRecordWidth/2),int(slot)/(uRecordWidth/2))';
 const attributes=`uvec4 hi=texelFetch(uRecords,${recordAt('texel+1')},0);
vec4 aQuaternion=vec4(signed16(lo.w),signed16(lo.w>>16u),signed16(hi.x),signed16(hi.x>>16u));
float aScale=uintBitsToFloat(hi.y);vec4 aColour=vec4(hi.z&255u,(hi.z>>8u)&255u,(hi.z>>16u)&255u,hi.z>>24u)*(1./255.);
`;
 const decode=`uint slot=aSlotReference&2147483647u;int texel=int(slot*2u);
uvec4 lo=texelFetch(uRecords,${recordAt('texel')},0);
vec3 aOrigin=uintBitsToFloat(lo.xyz);
${deferredDecode?'':attributes}
// The bounded RG32F cache carries the already-rounded attribute values. GPU
// reciprocal conversion/reassociation would change the seed/dither pattern.
vec2 aParams=texelFetch(uParameters,${parametersAt},0).rg;
${readiness?'vDetailAvailable=aSlotReference>>31u;':''}
${zeroWeightStems?`// The original fragment shader, not a vertex/CPU sine approximation,
// supplies these survival bits. The original strict fragment discard remains.
if(uTier==2){float earlyDistance=length(aOrigin-uCameraLocal)*tan(uFov*.5)/.83909963*1920./uResolution.x;
float earlyWeight=(vDetailAvailable==1u?smoothstep(.012,.020,earlyDistance):1.)*(1.-smoothstep(.048,.072,earlyDistance));
int layer=earlyWeight==0.?0:-1;
${stemWeightMasks?'if(layer<0){if(earlyWeight<=uStemWeightThresholds.x)layer=1;else if(earlyWeight<=uStemWeightThresholds.y)layer=2;else if(earlyWeight<=uStemWeightThresholds.z)layer=3;}':''}
if(layer>=0){uint seed=uint(round(aParams.y*65535.)),bit=uint(layer)*72u+uint(gl_VertexID/16),word=seed*9u+bit/32u,texel=word/4u;
uvec4 mask=texelFetch(uStemZeroRanks,ivec2(int(texel)%1024,int(texel)/1024),0);
if((mask[int(word%4u)]&(1u<<(bit%32u)))==0u){gl_Position=vec4(2.,2.,2.,1.);return;}}}
`:''}
${deferredDecode?attributes:''}
`;
 if(!source.includes('void main(){'))throw Error('Unsupported instancing vertex shader');
 return source.replace('precision highp float;','precision highp float;'+declarations).replace('void main(){','void main(){'+decode);
}
function readinessFragment(source){return source.replace('uMode,uTier,uDetailAvailable,uLocalShadowQuality','uMode,uTier,uLocalShadowQuality').replace('out vec4 fragColor;','flat in uint vDetailAvailable;out vec4 fragColor;').replaceAll('uDetailAvailable==1','vDetailAvailable==1u');}
function decodeRecord(bytes,index=0){
 const v=new DataView(bytes.buffer,bytes.byteOffset+index*STRIDE,STRIDE);
 return {origin:[0,4,8].map(i=>v.getFloat32(i,true)),quaternion:[12,14,16,18].map(i=>Math.max(-1,v.getInt16(i,true)/32767)),scale:v.getFloat32(20,true),colour:[24,25,26,27].map(i=>v.getUint8(i)/255),params:[28,30].map(i=>v.getUint16(i,true)/65535)};
}
function singleRibbons(prototype){
 if(!/^meadow-tapered-ribbon-v2-[0-2]$/.test(prototype.id))return prototype;
 const lods=prototype.lods.map(lod=>{
  if(lod.vertices.length!==48*6||lod.indices.length!==120)throw Error('Unsupported canonical ribbon geometry');
  const vertices=new Float32Array(24*6),indices=new Uint16Array(60);
  for(let plane=0;plane<2;plane++)for(let v=0;v<12;v++){
   const front=(plane*24+v)*6,back=front+12*6;
   for(let k=0;k<6;k++)if(lod.vertices[front+k]!==lod.vertices[back+k]*(k<3?1:-1))throw Error('Ribbon reverse face is not equivalent');
   // LEQUAL lets the original later reverse face win the coincident sample.
   // Keep that exact normal/interpolation rather than changing its sign twice.
   vertices.set(lod.vertices.subarray(back,back+6),(plane*12+v)*6);
  }
  for(let trianglePair=0;trianglePair<10;trianglePair++)for(let i=0;i<6;i++){const source=lod.indices[trianglePair*12+6+i];if(source%24<12)throw Error('Unexpected ribbon reverse-face index');indices[trianglePair*6+i]=Math.floor(source/24)*12+source%24-12;}
  return {vertices,indices,bounds:lod.bounds};
 });
 return root.SphereInstancedEnvironment.createPrototype({...prototype,id:prototype.id+'-gpu-single-ribbons-v1',lods,roughness:prototype.material.roughness,albedo:prototype.material.albedo,emission:prototype.material.emission});
}
const lifetimeKeys=new WeakMap();
const lifetimeFields=['reservationToken','slotStart','slotGeneration','requestGeneration','sceneKey'];
const immutableLifetime=h=>Object.isFrozen(h)&&lifetimeFields.every(field=>{const descriptor=Object.getOwnPropertyDescriptor(h,field);return descriptor&&'value'in descriptor&&(typeof descriptor.value==='string'||typeof descriptor.value==='number');});
const lifetime=h=>{let key=lifetimeKeys.get(h);if(key!==undefined)return key;key=[h.reservationToken,h.slotStart,h.slotGeneration,h.requestGeneration,h.sceneKey].join('|');if(immutableLifetime(h))lifetimeKeys.set(h,key);return key;};
const sameLifetime=(a,b)=>!!a&&!!b&&a.reservationToken===b.reservationToken&&a.slotStart===b.slotStart&&a.slotGeneration===b.slotGeneration&&a.requestGeneration===b.requestGeneration&&a.sceneKey===b.sceneKey;

class PersistentRecords{
 constructor(gl,service,{textureWidth=2048,referenceCapacity=service.limits.records,additionalGpuBytes=()=>0,progressive=false}={}){
  if(service.gpuBackend)throw Error('Vegetation service already has a GPU backend');
  this.gl=gl;this.service=service;this.additionalGpuBytes=additionalGpuBytes;this.progressive=progressive;
  this.optimisation={ribbons:true,zeroWeightStems:true,stemWeightMasks:true,deferredDecode:true,powerOfTwoAddressing:true};this.optimisedPrototypes=new Map();this.geometryCpuBytes=0;this.stemMaskTexture=null;this.stemMaskGpuBytes=0;this.stemMaskUploadedRows=0;this.stemMasksReady=false;this.stemMaskBatch=null;
  if(progressive&&typeof gl.fenceSync!=='function')throw Error('Progressive vegetation requires WebGL2 fences');
  this.recordUploadStride=GPU_RECORD_BYTES;
  this.layout=layout(service.limits.gpuSlots,gl.getParameter(gl.MAX_TEXTURE_SIZE),textureWidth);
  this.referenceCapacity=integer(referenceCapacity,'reference capacity',1);
  if(referenceCapacity>service.limits.records)throw Error('References exceed service record capacity');
  this.parameterWidth=this.layout.width/2;this.parameterBytes=this.parameterWidth*this.layout.height*8;
  this.fixedGpuBytes=this.layout.bytes+this.parameterBytes+referenceCapacity*4*(progressive?2:1);this.cpuByteLength=referenceCapacity*4*(progressive?3:2)+PARAMETER_STAGING_RECORDS*8;
  this.checkCapacity();
  if(service.cpuTotal()+this.cpuByteLength>service.limits.cpuBytes)throw Error('GPU backend CPU ownership exceeds limit');
  // Unit 15 is the canopy descriptor and 14 the Wound array. The instanced
  // programs use unit 10 only for records; other passes use separate targets.
  this.textureUnit=10;
  this.parameterTextureUnit=11;
  if(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)<2||gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)<=this.parameterTextureUnit)throw Error('Vegetation vertex texture capabilities unavailable');
  this.texture=gl.createTexture();this.parameterTexture=gl.createTexture();this.referenceBuffer=gl.createBuffer();
  gl.activeTexture(gl.TEXTURE0+this.textureUnit);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32UI,this.layout.width,this.layout.height);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.activeTexture(gl.TEXTURE0+this.parameterTextureUnit);gl.bindTexture(gl.TEXTURE_2D,this.parameterTexture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RG32F,this.parameterWidth,this.layout.height);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.referenceBuffer);gl.bufferData(gl.ARRAY_BUFFER,referenceCapacity*4,gl.DYNAMIC_DRAW);gl.activeTexture(gl.TEXTURE0);
  this.references=new Uint32Array(referenceCapacity);this.previous=new Uint32Array(referenceCapacity);this.parameterStaging=new Float32Array(PARAMETER_STAGING_RECORDS*2);
  this.banks=[{buffer:this.referenceBuffer,shadow:this.previous,fence:null,tokens:new Set(),usedTokens:new Set()}];this.currentBank=0;this.selectionHandles=[];
  if(progressive){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,referenceCapacity*4,gl.DYNAMIC_DRAW);this.banks.push({buffer,shadow:new Uint32Array(referenceCapacity),fence:null,tokens:new Set(),usedTokens:new Set()});}
  this.staged=new Map();this.vaos=new Map();this.commands=[];this.selectionKey='';this.pendingSelection=null;this.closed=false;
  this.totals={recordUploadBytes:0,referenceUploadBytes:0,relocationBytes:0,allocations:progressive?4:3,selectionCommits:0,stageCompletions:0,fences:0,fenceWaits:0};
  this.resetFrame();service.attachGpuBackend(this);
 }
 checkCapacity(extra=0){if(this.fixedGpuBytes+this.additionalGpuBytes()+extra>this.service.limits.gpuBytes)throw Error('Physical vegetation GPU capacity exceeds limit');}
 resetFrame(){this.frame={recordUploadBytes:0,referenceUploadBytes:0,selectionUploadBytes:0,relocationBytes:0,stagedAllocations:0,uploadCalls:0};}
 prepareSelection(camera,budget){
  if(!camera.productionSelection||this.stemMasksReady)return true;
  const selector=root.SphereVegetationSelection||(typeof require==='function'?require('./vegetation-selection.js'):null),seedBytes=NATIVE_SEED_BATCH*8,gl=this.gl;
  if(!this.zeroRanks){
  if(budget.remaining<seedBytes)return false;
  if(this.gl.getParameter(this.gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)<3||this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)<=12)throw Error('Native stem-mask texture capabilities unavailable');
  // Every probe runs while the permanent table exists. Charge the real
  // 128x128 RGBA8 framebuffer and 16,384-seed buffer concurrently with it.
  this.checkCapacity(STEM_MASK_BYTES+NATIVE_SEED_BATCH*12);
  this.service.retainCpuOwner('vegetation-native-zero-ranks',65536);
  this.zeroRanks={mask:new Uint8Array(65536),stemMasks:null,cpuBytes:65536,stemMaskBytes:STEM_MASK_BYTES,seedCursor:0,seedBatchSize:NATIVE_SEED_BATCH,batchesCompleted:0,detailCount:0,coarseCount:0,zeroStemPairs:0,survivingStemPairs:[0,0,0],coldProbeDraws:0,coldProbeInstances:0,uploadBytes:0,readbackBytes:0,temporaryCpuBytes:0,temporaryGpuBytes:0};
  this.stemMaskTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+12);gl.bindTexture(gl.TEXTURE_2D,this.stemMaskTexture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32UI,STEM_MASK_WIDTH,STEM_MASK_HEIGHT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.activeTexture(gl.TEXTURE0);
  this.stemMaskGpuBytes=STEM_MASK_BYTES;this.fixedGpuBytes+=STEM_MASK_BYTES;
  }
  const aggregate=this.zeroRanks,rowBytes=STEM_MASK_WIDTH*16;
  while(this.stemMaskUploadedRows<STEM_MASK_HEIGHT){
   if(!this.stemMaskBatch){
    if(budget.remaining<seedBytes)return false;
    const ranks=selector.nativeZeroRanks(gl,this.service,extra=>this.checkCapacity(extra),{stemMasks:true,stemWeightMasks:true,seedStart:aggregate.seedCursor,seedCount:NATIVE_SEED_BATCH,seedMask:aggregate.mask});
    aggregate.stemMasks=ranks.stemMasks;aggregate.cpuBytes=ranks.cpuBytes;aggregate.seedCursor+=NATIVE_SEED_BATCH;
    for(const field of ['detailCount','coarseCount','zeroStemPairs','coldProbeDraws','coldProbeInstances','uploadBytes','readbackBytes'])aggregate[field]+=ranks[field];
    for(let layer=0;layer<3;layer++)aggregate.survivingStemPairs[layer]+=ranks.survivingStemPairs[layer];
    for(const field of ['weightThresholds','probeDistances','exactProductionFragment','rank'])aggregate[field]=ranks[field];
    aggregate.temporaryCpuBytes=Math.max(aggregate.temporaryCpuBytes,ranks.temporaryCpuBytes);aggregate.temporaryGpuBytes=Math.max(aggregate.temporaryGpuBytes,ranks.temporaryGpuBytes);
    this.stemMaskBatch={rows:ranks.stemMasks.byteLength/rowBytes,uploadedRows:0};
    budget.remaining-=seedBytes;this.frame.selectionUploadBytes+=seedBytes;this.frame.coldRankProbeDraws=(this.frame.coldRankProbeDraws||0)+ranks.coldProbeDraws;this.frame.coldRankProbeInstances=(this.frame.coldRankProbeInstances||0)+ranks.coldProbeInstances;this.frame.coldRankProbeTemporaryGpuBytes=ranks.temporaryGpuBytes;this.frame.coldRankProbePeakGpuBytes=this.fixedGpuBytes+ranks.temporaryGpuBytes+this.additionalGpuBytes();this.frame.coldRankProbeReadbackBytes=(this.frame.coldRankProbeReadbackBytes||0)+ranks.readbackBytes;this.totals.selectionUploadBytes=(this.totals.selectionUploadBytes||0)+seedBytes;
   }
   const batch=this.stemMaskBatch,rows=Math.min(batch.rows-batch.uploadedRows,Math.floor(budget.remaining/rowBytes));
   if(rows){const start=batch.uploadedRows,bytes=rows*rowBytes;gl.activeTexture(gl.TEXTURE0+12);gl.bindTexture(gl.TEXTURE_2D,this.stemMaskTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,this.stemMaskUploadedRows,STEM_MASK_WIDTH,rows,gl.RGBA_INTEGER,gl.UNSIGNED_INT,aggregate.stemMasks.subarray(start*STEM_MASK_WIDTH*4,(start+rows)*STEM_MASK_WIDTH*4));gl.activeTexture(gl.TEXTURE0);this.stemMaskUploadedRows+=rows;batch.uploadedRows+=rows;budget.remaining-=bytes;this.frame.selectionUploadBytes+=bytes;this.totals.selectionUploadBytes+=bytes;this.frame.uploadCalls++;}
   if(batch.uploadedRows<batch.rows)return false;
   // Release this exact packed batch before probing the next seed interval.
   aggregate.stemMasks=null;aggregate.cpuBytes=aggregate.mask.byteLength;this.service.retainCpuOwner('vegetation-native-zero-ranks',aggregate.cpuBytes);aggregate.batchesCompleted++;this.stemMaskBatch=null;
  }
  this.stemMasksReady=true;return true;
 }
 representationPrototype(prototype,shaderVariant){
  if(shaderVariant!=='foliage2'||!this.optimisation.ribbons||!/^meadow-tapered-ribbon-v2-[0-2]$/.test(prototype.id))return prototype;
  const key=prototype.id+'|'+prototype.contentHash;let p=this.optimisedPrototypes.get(key);
  if(!p){p=singleRibbons(prototype);const bytes=p.lods.reduce((n,l)=>n+l.bytes,0);if(this.service.cpuTotal()+bytes>this.service.limits.cpuBytes)throw Error('Ribbon adapter CPU ownership exceeds limit');this.cpuByteLength+=bytes;this.geometryCpuBytes+=bytes;this.optimisedPrototypes.set(key,p);}
  return p;
 }
 valid(handle){return !this.closed&&!this.disposing&&this.service.allocator.valid(handle)&&this.service.allocations.get(handle?.reservationToken)?.context.id===handle.requestGeneration&&handle.sceneKey===this.service.sceneKey;}
 has(handle){const entry=this.staged.get(handle?.reservationToken);return !!entry?.ready&&sameLifetime(entry.handle,handle)&&this.valid(handle);}
 uploadRange(packet,firstRecord,count,destination){
  const gl=this.gl,width=this.layout.width;
  gl.activeTexture(gl.TEXTURE0+this.textureUnit);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  // Typed views share the admitted packet allocation. There is no upload copy.
  const words=new Uint32Array(packet.records.buffer,packet.records.byteOffset+firstRecord*STRIDE,count*8);
  let texel=(destination+firstRecord)*2,remaining=count*2,offset=0;
  while(remaining){const x=texel%width,y=Math.floor(texel/width),span=Math.min(remaining,width-x);
   gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,span,1,gl.RGBA_INTEGER,gl.UNSIGNED_INT,words.subarray(offset,offset+span*4));
   offset+=span*4;texel+=span;remaining-=span;this.frame.uploadCalls++;
  }
  const view=new DataView(packet.records.buffer,packet.records.byteOffset,packet.records.byteLength);
  gl.activeTexture(gl.TEXTURE0+this.parameterTextureUnit);gl.bindTexture(gl.TEXTURE_2D,this.parameterTexture);
  for(let first=0;first<count;first+=PARAMETER_STAGING_RECORDS){const chunk=Math.min(count-first,PARAMETER_STAGING_RECORDS);for(let i=0;i<chunk;i++){const base=(firstRecord+first+i)*STRIDE;this.parameterStaging[i*2]=view.getUint16(base+28,true)/65535;this.parameterStaging[i*2+1]=view.getUint16(base+30,true)/65535;}
   let slot=destination+firstRecord+first,remaining=chunk,offset=0;while(remaining){const x=slot%this.parameterWidth,y=Math.floor(slot/this.parameterWidth),span=Math.min(remaining,this.parameterWidth-x);gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,span,1,gl.RG,gl.FLOAT,this.parameterStaging.subarray(offset*2,(offset+span)*2));offset+=span;slot+=span;remaining-=span;this.frame.uploadCalls++;}
  }
  gl.activeTexture(gl.TEXTURE0);this.frame.recordUploadBytes+=count*GPU_RECORD_BYTES;this.totals.recordUploadBytes+=count*GPU_RECORD_BYTES;
 }
 stage(handle,packet,budget){
  integer(budget?.remaining,'GPU upload budget');
  if(!this.valid(handle)||packet.contentHash!==this.service.allocations.get(handle.reservationToken)?.packet?.contentHash)throw Error('Obsolete GPU staging handle');
  let entry=this.staged.get(handle.reservationToken);
  if(!entry){if(this.progressive&&V.packetHash(packet)!==packet.contentHash)throw Error('Corrupt packet before GPU staging');entry={handle:Object.freeze({...handle}),contentHash:packet.contentHash,uploadedRecords:0,ready:false};this.staged.set(handle.reservationToken,entry);}
  if(!sameLifetime(entry.handle,handle)||entry.contentHash!==packet.contentHash)throw Error('GPU staging lifetime mismatch');
  if(entry.ready)return true;
  const count=Math.min(packet.recordCount-entry.uploadedRecords,Math.floor(budget.remaining/GPU_RECORD_BYTES));
  if(count){this.uploadRange(packet,entry.uploadedRecords,count,handle.slotStart);entry.uploadedRecords+=count;budget.remaining-=count*GPU_RECORD_BYTES;}
  if(entry.uploadedRecords===packet.recordCount){entry.ready=true;this.frame.stagedAllocations++;this.totals.stageCompletions++;}
  return entry.ready;
 }
 invalidate(handle){if(!this.progressive)return;const token=handle.reservationToken;if(this.pendingSelection?.handles.some(h=>h.reservationToken===token))this.pendingSelection=null;if(this.selectionHandles.some(h=>h.reservationToken===token)){this.selectionHandles=[];this.selectionKey='';this.commands=[];this.banks[this.currentBank].tokens.clear();}}
 pollFences(){if(this.closed)return;for(const bank of this.banks)if(bank.fence){const result=this.gl.clientWaitSync(bank.fence,0,0);if(result===this.gl.ALREADY_SIGNALED||result===this.gl.CONDITION_SATISFIED){this.gl.deleteSync(bank.fence);bank.fence=null;bank.usedTokens.clear();}else if(result===this.gl.WAIT_FAILED)throw Error('Vegetation last-use fence failed');}}
 canRelease(handle){if(this.closed||!this.progressive)return true;this.pollFences();const token=handle.reservationToken;return !this.selectionHandles.some(h=>h.reservationToken===token)&&!this.pendingSelection?.handles.some(h=>h.reservationToken===token)&&!this.banks.some(b=>b.usedTokens.has(token));}
 selectionContains(handles){const identities=new Set(this.selectionHandles.map(lifetime));return handles.every(h=>identities.has(lifetime(h)));}
 markSubmitted(){if(!this.progressive||!this.commands.length)return;const bank=this.banks[this.currentBank];if(bank.fence)this.gl.deleteSync(bank.fence);bank.fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!bank.fence)throw Error('Vegetation last-use fence unavailable');bank.usedTokens=new Set(bank.tokens);this.totals.fences++;this.gl.flush();}
 release(handle){if(this.progressive){this.invalidate(handle);if(!this.canRelease(handle))throw Error('Vegetation slots still have GPU readers');this.staged.delete(handle.reservationToken);return;}this.staged.delete(handle.reservationToken);this.selectionKey='';this.pendingSelection=null;this.commands=[];}
 relocate(previous,next,packet,budget){
  const bytes=packet.recordCount*GPU_RECORD_BYTES;if(!this.has(previous)||bytes>budget.remaining||this.progressive&&!this.canRelease(previous))throw Error('GPU relocation is not ready, still referenced or exceeds step budget');
  this.uploadRange(packet,0,packet.recordCount,next.slotStart);budget.remaining-=bytes;
  this.frame.relocationBytes+=bytes;this.totals.relocationBytes+=bytes;
  const entry=this.staged.get(previous.reservationToken);entry.handle=Object.freeze({...next});this.totals.stageCompletions++;if(!this.progressive){this.selectionKey='';this.pendingSelection=null;this.commands=[];}
 }
 plan(handles,prototypes,camera,{staged=false,coverage=null}={}){
  const E=root.SphereInstancedEnvironment,byId=new Map(prototypes.map(p=>[p.id,p])),families=new Map(),signature=[];
  const selector=camera.productionSelection?(root.SphereVegetationSelection||(typeof require==='function'?require('./vegetation-selection.js'):null)):null;
  if(selector&&!this.zeroRanks)throw Error('Native selection resources are not ready');
  const query=selector?selector.createView(camera,this.zeroRanks):null;
  let visible=0,culled=0,rejectedRecords=0,boundaryRecords=0;
  for(const handle of handles){const packet=staged?this.service.prepared(handle):this.service.resolve(handle);if(!packet||!this.has(handle))throw Error('Obsolete GPU submission handle');
   if(query&&query.sphere(packet.bounds.center,packet.bounds.radius)<0){culled+=(packet.regions?.length||1);rejectedRecords+=packet.recordCount;signature.push(lifetime(handle)+':outside');continue;}
   const regions=packet.regions||[{...packet.bounds,counts:packet.groups.map(g=>g.count)}],offsets=packet.groups.map(g=>g.byteOffset/STRIDE),compactLifetime=immutableLifetime(handle);let regionSignature='';
   for(let regionIndex=0;regionIndex<regions.length;regionIndex++){
    const region=regions[regionIndex],assignment=coverage?.get(handle.reservationToken),selected=!assignment||assignment.selected.has(regionIndex),visibility=query?query.sphere(region.center,region.radius):null,seen=selected&&(query?visibility>=0:E.visiblePatch(region,camera)),detailAvailable=assignment?assignment.detailAvailable.has(regionIndex):packet.groups.some((g,i)=>g.tier==='detail'&&region.counts[i]>0);
    // Ordered two-bit states are lossless. Foreign/accessor handles retain the
    // original per-region lifetime reads; only immutable own data is compacted.
    if(compactLifetime)regionSignature+='0123'[(seen?2:0)+(detailAvailable?1:0)];else signature.push(lifetime(handle)+':'+regionIndex+':'+(seen?1:0)+':'+(detailAvailable?1:0));
    if(selected){if(seen)visible++;else culled++;}
    for(let i=0;i<packet.groups.length;i++){
     const group=packet.groups[i],count=region.counts[i],firstSlot=handle.slotStart+offsets[i];offsets[i]+=count;
     if(!seen||!count)continue;
     const classification=query?query.classify(region,group.tier,detailAvailable,visibility):1;
     if(classification<0){rejectedRecords+=count;continue;}if(classification===0)boundaryRecords+=count;
     const prototype=byId.get(group.prototypeId);if(!prototype||!prototype.lods[group.geometryLod])throw Error('Missing compatible vegetation prototype');
     if(prototype.transparent)throw Error('Transparent vegetation requires a sorted provider backend');
     const key=V.batchKey(group)+'|'+prototype.contentHash;let family=families.get(key);
     if(!family){family={key,group,prototype,lodIndex:group.geometryLod,ranges:[],validationHandles:[],count:0,detailCount:0,fallbackCount:0};families.set(key,family);}
     // A packet contributes contiguous ranges to each family. Revalidate its
     // immutable owner once immediately before drawing; foreign handles keep
     // every original validation, including accessor invocation order.
     if(!compactLifetime||family.validationHandles.at(-1)!==handle)family.validationHandles.push(handle);
     family.ranges.push({handle,firstSlot,count,detailAvailable,...(classification===0?{filter:{view:new DataView(packet.records.buffer,packet.records.byteOffset,packet.records.byteLength),firstRecord:firstSlot-handle.slotStart,tier:group.tier,query}}:{})});family.count+=count;
     if(detailAvailable)family.detailCount+=count;else family.fallbackCount+=count;
    }
   }
   if(compactLifetime)signature.push(['packet',lifetime(handle),regionSignature]);
  }
  const commands=[...families.values()].sort((a,b)=>a.key.localeCompare(b.key));
  return {commands,visible,culled,handles:handles.slice(),query,selection:query?{revision:2,hierarchicalRejectedRecords:rejectedRecords,boundaryRecords,scannedRecords:0,rejectedBoundaryRecords:0,submittedDetailed:0,foregroundTrimmed:false}:null,key:(query?.key||'')+'#'+JSON.stringify(signature)+'#'+commands.map(c=>c.key).join(';')};
 }
 select(plan,budget,options={}){
  if(this.progressive)return this.selectProgressive(plan,budget,options);
  integer(budget?.remaining,'reference upload budget');
  if(plan.key===this.selectionKey)return true;
  if(this.pendingSelection?.key!==plan.key){
   let cursor=0;
   for(const family of plan.commands){family.referenceStart=cursor;for(const range of family.ranges)for(let i=0;i<range.count;i++){
    if(cursor===this.referenceCapacity)throw Error('Dense reference capacity exceeded');
    this.references[cursor++]=(range.firstSlot+i)|(range.detailAvailable?DETAIL_BIT:0);
   }}
   // Compare by byte range, not by a lossy population hash. The GPU buffer and
   // its allocated capacity persist. A partial selection is never submitted.
   const changes=[];let start=-1;
   for(let i=0;i<cursor;i++){if(this.references[i]!==this.previous[i]){if(start<0)start=i;}else if(start>=0){changes.push({start,end:i});start=-1;}}
   if(start>=0)changes.push({start,end:cursor});
   this.pendingSelection={...plan,count:cursor,changes,index:0};
  }
  const pending=this.pendingSelection,gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.referenceBuffer);
  while(pending.index<pending.changes.length&&budget.remaining>=4){const range=pending.changes[pending.index],count=Math.min(range.end-range.start,Math.floor(budget.remaining/4));
   gl.bufferSubData(gl.ARRAY_BUFFER,range.start*4,this.references.subarray(range.start,range.start+count));
   this.previous.set(this.references.subarray(range.start,range.start+count),range.start);
   range.start+=count;budget.remaining-=count*4;this.frame.referenceUploadBytes+=count*4;this.totals.referenceUploadBytes+=count*4;this.frame.uploadCalls++;
   if(range.start===range.end)pending.index++;
  }
  if(pending.index<pending.changes.length)return false;
  this.commands=pending.commands;this.selectionKey=pending.key;this.pendingSelection=null;return true;
 }
 selectProgressive(plan,budget,{maxReferences=4096,deadline=Infinity}={}){
  integer(budget?.remaining,'reference upload budget');integer(maxReferences,'reference preparation quantum',1);
  if(plan.key===this.selectionKey)return true;
  this.pollFences();
  if(this.pendingSelection?.key!==plan.key){const bank=1-this.currentBank;if(this.banks[bank].fence){this.totals.fenceWaits++;return false;}this.lastConflict=null;if(plan.query)for(const family of plan.commands){family.count=0;family.detailCount=0;family.fallbackCount=0;}this.pendingSelection={...plan,bank,count:0,family:0,range:0,instance:0,compared:0,built:false};}
  const pending=this.pendingSelection;let work=0;
  // Production must make bounded progress even after an atomic receipt or view
  // plan consumed this frame's deadline. Count this work in complete preparation.
   // An expired deadline must still advance a production bank far enough to
   // keep ordinary walking within the conservative view envelope. This bounded
   // work remains charged to complete preparation; it is not a timing pass.
   const minimumWork=plan.query?Math.min(65536,maxReferences):0,inBudget=()=>work<maxReferences&&(work<minimumWork||(typeof performance==='undefined'?Date.now():performance.now())<deadline);
  while(!pending.built&&inBudget()){
   const family=pending.commands[pending.family];if(!family){pending.built=true;break;}
   if(pending.range===0&&pending.instance===0)family.referenceStart=pending.count;
   const range=family.ranges[pending.range];if(!range){pending.family++;pending.range=0;continue;}
   const count=Math.min(range.count-pending.instance,maxReferences-work);
   if(pending.count+count>this.referenceCapacity)throw Error('Dense reference capacity exceeded');
   for(let i=0;i<count;i++){const instance=range.firstSlot+pending.instance+i,filter=range.filter;if(filter&&!filter.query.accepts(filter.view,filter.firstRecord+pending.instance+i,filter.tier,range.detailAvailable)){pending.selection.rejectedBoundaryRecords++;continue;}this.references[pending.count++]=instance|(range.detailAvailable?DETAIL_BIT:0);if(pending.query){family.count++;if(range.detailAvailable)family.detailCount++;else family.fallbackCount++;}}
   if(pending.selection)pending.selection.scannedRecords+=range.filter?count:0;
   work+=count;pending.instance+=count;if(pending.instance===range.count){pending.range++;pending.instance=0;}
  }
  if(pending.built&&pending.query){const submittedDetailed=pending.commands.reduce((n,c)=>n+(c.group.tier==='detail'?c.count:0),0);pending.selection.submittedDetailed=submittedDetailed;
   if(submittedDetailed>root.SphereVegetationSelection.DETAIL_LIMIT){this.lastConflict={kind:'submission-capacity',requiredDetailed:submittedDetailed,limit:root.SphereVegetationSelection.DETAIL_LIMIT,foregroundTrimmed:false,viewKey:pending.query.key};pending.blocked=true;return false;}
  }
  const bank=this.banks[pending.bank];
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,bank.buffer);
  // Compare and upload one bounded run at a time. No per-reference object list
  // or full-arena staging copy survives a partially completed transaction.
  while(pending.built&&pending.compared<pending.count&&inBudget()){
   const start=pending.compared;if(this.references[start]===bank.shadow[start]){pending.compared++;work++;continue;}if(budget.remaining<4)break;
   const end=Math.min(pending.count,start+maxReferences-work,start+Math.floor(budget.remaining/4));let next=start;while(next<end&&this.references[next]!==bank.shadow[next])next++;
   const count=next-start;gl.bufferSubData(gl.ARRAY_BUFFER,start*4,this.references.subarray(start,next));bank.shadow.set(this.references.subarray(start,next),start);pending.compared=next;work+=count;budget.remaining-=count*4;this.frame.referenceUploadBytes+=count*4;this.totals.referenceUploadBytes+=count*4;this.frame.uploadCalls++;
  }
  if(!pending.built||pending.compared<pending.count)return false;
  this.currentBank=pending.bank;this.referenceBuffer=bank.buffer;this.commands=pending.commands.filter(c=>c.count>0);this.selectionKey=pending.key;this.selectionHandles=pending.handles;this.selection=pending.selection;bank.tokens=new Set(pending.handles.map(h=>h.reservationToken));this.pendingSelection=null;this.totals.selectionCommits++;return true;
 }
 vao(family,prototypeResource){
  const key=family.key+'|'+prototypeResource.key+(this.progressive?'|bank'+this.currentBank:'');let vao=this.vaos.get(key);if(!vao){const gl=this.gl;vao=gl.createVertexArray();gl.bindVertexArray(vao);
   gl.bindBuffer(gl.ARRAY_BUFFER,prototypeResource.vertex);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,prototypeResource.index);gl.bindBuffer(gl.ARRAY_BUFFER,this.referenceBuffer);gl.enableVertexAttribArray(2);gl.vertexAttribDivisor(2,1);this.vaos.set(key,vao);
  }
  const gl=this.gl;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.referenceBuffer);gl.vertexAttribIPointer(2,1,gl.UNSIGNED_INT,4,family.referenceStart*4);return vao;
 }
 bind(uniforms){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+this.textureUnit);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(uniforms.uRecords,this.textureUnit);if(uniforms.uRecordWidth!=null)gl.uniform1i(uniforms.uRecordWidth,this.layout.width);gl.activeTexture(gl.TEXTURE0+this.parameterTextureUnit);gl.bindTexture(gl.TEXTURE_2D,this.parameterTexture);gl.uniform1i(uniforms.uParameters,this.parameterTextureUnit);if(uniforms.uStemZeroRanks!=null){if(!this.stemMaskTexture)throw Error('Native zero-weight stem masks are not ready');gl.activeTexture(gl.TEXTURE0+12);gl.bindTexture(gl.TEXTURE_2D,this.stemMaskTexture);gl.uniform1i(uniforms.uStemZeroRanks,12);if(uniforms.uStemWeightThresholds!=null)gl.uniform3fv(uniforms.uStemWeightThresholds,this.zeroRanks.weightThresholds);}gl.activeTexture(gl.TEXTURE0);}
 get info(){return {backend:'rgba32ui-rg32f-slot-references-v1',representation:{revision:REPRESENTATION_REVISION,ribbons:this.optimisation.ribbons,zeroWeightStems:!!this.stemMaskTexture&&this.optimisation.zeroWeightStems,geometryCpuBytes:this.geometryCpuBytes,stemMaskGpuBytes:this.closed?0:this.stemMaskGpuBytes,stemMaskCpuBytes:this.zeroRanks?.stemMasks?.byteLength||0,stemWeightMasks:this.optimisation.stemWeightMasks&&this.stemMasksReady,deferredDecode:!!this.optimisation.deferredDecode,powerOfTwoAddressing:this.optimisation.powerOfTwoAddressing?addressing(this.layout.width):null},lifecycle:this.progressive?'frame-coverage-fences-v1':null,selection:this.selection||null,selectionConflict:this.lastConflict||null,nativeZeroRanks:this.zeroRanks?{seedBatchSize:this.zeroRanks.seedBatchSize,batchesCompleted:this.zeroRanks.batchesCompleted,seedCursor:this.zeroRanks.seedCursor,coldProbeInstances:this.zeroRanks.coldProbeInstances,detailSeeds:this.zeroRanks.detailCount,coarseSeeds:this.zeroRanks.coarseCount,zeroStemPairs:this.zeroRanks.zeroStemPairs,weightThresholds:this.zeroRanks.weightThresholds,probeDistances:this.zeroRanks.probeDistances,survivingStemPairs:this.zeroRanks.survivingStemPairs,stemMaskCpuBackingReleased:this.stemMasksReady&&this.zeroRanks.stemMasks===null,stemMaskBytes:this.zeroRanks.stemMaskBytes,cpuBytes:this.zeroRanks.cpuBytes,uploadBytes:this.zeroRanks.uploadBytes,readbackBytes:this.zeroRanks.readbackBytes,exactProductionFragment:this.zeroRanks.exactProductionFragment,coldProbeDraws:this.zeroRanks.coldProbeDraws,temporaryCpuBytes:this.zeroRanks.temporaryCpuBytes,temporaryGpuBytes:this.zeroRanks.temporaryGpuBytes,rank:this.zeroRanks.rank}:null,texture:{...this.layout},parameterTexture:{width:this.parameterWidth,height:this.layout.height,format:'RG32F',allocatedBytes:this.closed?0:this.parameterBytes},referenceAllocatedBytes:this.closed?0:this.referenceCapacity*4*this.banks.length,referenceBuffers:this.closed?0:this.banks.length,physicalGpuBytes:this.closed?0:this.fixedGpuBytes,cpuBackingBytes:this.closed?0:this.cpuByteLength,parameterStagingBytes:this.closed?0:PARAMETER_STAGING_RECORDS*8,allocatedSlots:this.service.usage.gpuSlots,unusedSlots:this.service.info.unusedSlots,stagedAllocations:this.staged.size,batchVaos:this.vaos.size,pendingLastUses:this.banks.filter(b=>b.fence).length,pendingDisposal:!!this.disposing&&!this.closed,frame:{...this.frame},totals:{...this.totals},temporaryRecordCopyBytes:0};}
 pollDisposal(){
  if(!this.disposing||this.closed)return this.closed;
  if(!this.gl.isContextLost?.())this.pollFences();
  if(!this.gl.isContextLost?.()&&this.banks.some(b=>b.fence)){
   if(!this.disposalTimer){this.disposalTimer=setTimeout(()=>{this.disposalTimer=null;this.pollDisposal();},16);this.disposalTimer.unref?.();}
   return false;
  }
  this.finishDisposal();return true;
 }
 finishDisposal(){if(this.closed)return;if(this.disposalTimer){clearTimeout(this.disposalTimer);this.disposalTimer=null;}const gl=this.gl;for(const vao of this.vaos.values())gl.deleteVertexArray(vao);gl.deleteTexture(this.texture);gl.deleteTexture(this.parameterTexture);if(this.stemMaskTexture)gl.deleteTexture(this.stemMaskTexture);this.stemMaskTexture=null;this.optimisedPrototypes.clear();this.geometryCpuBytes=0;for(const bank of this.banks){if(bank.fence)gl.deleteSync(bank.fence);gl.deleteBuffer(bank.buffer);bank.fence=null;bank.shadow=null;bank.tokens.clear();bank.usedTokens.clear();}this.vaos.clear();this.staged.clear();this.commands=[];this.pendingSelection=null;this.selectionHandles=[];this.references=null;this.previous=null;this.parameterStaging=null;this.closed=true;this.cpuByteLength=0;this.service.collectRetired();}
 dispose(){if(this.closed)return;this.disposing=true;this.zeroRanks=null;this.stemMaskBatch=null;this.service.releaseCpuOwner('vegetation-native-zero-ranks');this.commands=[];this.pendingSelection=null;this.selectionHandles=[];for(const bank of this.banks)bank.tokens.clear();if(this.progressive)this.pollDisposal();else this.finishDisposal();}
}
 const api={STRIDE,GPU_RECORD_BYTES,DETAIL_BIT,SLOT_MASK,REPRESENTATION_REVISION,STEM_MASK_BYTES,NATIVE_SEED_BATCH,layout,addressing,textureVertex,readinessFragment,decodeRecord,singleRibbons,lifetime,PersistentRecords};
root.SphereVegetationGPU=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
