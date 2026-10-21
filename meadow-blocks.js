/* HR-02 geographic storage partitions. The 8 m parent remains the sampler. */
(function(root){
'use strict';
const CACHE_ENTRIES=16,CACHE_BYTES=8192,STRIDE=32;
const now=()=>typeof performance==='undefined'?Date.now():performance.now();
// Exact two-word FNV-1a arithmetic for the existing UTF-16 hash contract.
// Products stay below 2^53; carry and low word are therefore exact integers.
function hashWords(parts){
 let low=0x739d0383,high=0x14650fb0;
 const byte=code=>{low=(low^code)>>>0;const product=low*435;high=(high*435+low*256+Math.floor(product/4294967296))>>>0;low=product>>>0;};
 for(const part of parts){const text=String(part);for(let i=0;i<text.length;i++)byte(text.charCodeAt(i));byte(255);}return [low,high];
}
const sampler=Object.freeze({random:(seed,stream,key,counter=0)=>{const [lo,hi]=hashWords(['ib060',seed,stream,key,counter]);return (hi*2097152+(lo>>>11))/9007199254740992;},uint32:(seed,stream,key,counter=0)=>hashWords(['ib060',seed,stream,key,counter])[0]});
function normalize(input,parent){
 const blockMetres=input.blockMetres,jobMetres=input.jobMetres??blockMetres,offsetX=input.offsetX??0,offsetZ=input.offsetZ??0;
 if(![1,2,4,8].includes(blockMetres)||!(parent.tier==='clump'&&blockMetres===1?[1,2,4,8]:[blockMetres,blockMetres*2]).includes(jobMetres)||jobMetres>8||![offsetX,offsetZ].every(v=>Number.isInteger(v)&&v>=0&&v+jobMetres<=8&&v%jobMetres===0))throw Error('Unsupported compact Meadow rectangle');
 const x0=-128+parent.x*8+offsetX,z0=-128+parent.z*8+offsetZ,regions=[];
 for(let z=0;z<jobMetres;z+=blockMetres)for(let x=0;x<jobMetres;x+=blockMetres)regions.push([x0+x,z0+z,x0+x+blockMetres,z0+z+blockMetres]);
 return {...parent,id:parent.id+':blocks'+blockMetres+':job'+jobMetres+':'+offsetX+','+offsetZ,compactRevision:1,blockMetres,jobMetres,offsetX,offsetZ,chartBoundsMetres:[x0,z0,x0+jobMetres,z0+jobMetres],regions};
}
function estimate(block,config){
 const candidates=block.jobMetres**2*100,detail=block.tier==='detail'?candidates*5:0,coarse=root.SphereMeadowCanopy.active(config.state)?block.jobMetres**2*4:0,records=detail+coarse;
 // One typed staging record and selector per possible output; transient objects
 // are released per root. Area nodes exist only while measuring an 8 m parent.
 const metadataBytes=block.regions.length>4?16384:4096;
 return {records,detailedRecords:detail,cpuBytes:records*32+metadataBytes,packetBytes:records*32+metadataBytes,scratchBytes:records*34+(block.areaSteps+1)**2*2048+262144+65536,...(metadataBytes>4096?{metadataBytes}:{})};
}
class ParentAreaCache{
 constructor(){this.items=new Map();this.hits=0;this.misses=0;this.evictions=0;this.contentKey=null;}
 scope(contentKey){if(contentKey!==this.contentKey){this.items.clear();this.contentKey=contentKey;}}
 get(state,block,options={}){
  const key=block.parent+':q'+block.areaSteps;
  if(!options.surfaceSupport&&this.items.has(key)){const value=this.items.get(key);this.items.delete(key);this.items.set(key,value);this.hits++;return value;}
  this.misses++;const value=root.SphereMeadowSupport.measureCell(state,{x:block.x,z:block.z,size:8},{steps:block.areaSteps,surfaceSupport:options.surfaceSupport});
  if(!options.surfaceSupport){if(this.items.size===CACHE_ENTRIES){this.items.delete(this.items.keys().next().value);this.evictions++;}this.items.set(key,value);}return value;
 }
 get info(){return {entries:this.items.size,hits:this.hits,misses:this.misses,evictions:this.evictions,reservedBytes:CACHE_BYTES};}
}
function prepare(job,config,options={}){
 const started=now(),block=job.block,G=root.SphereGrass,E=root.SphereInstancedEnvironment,M=root.SphereMath,V=root.SphereVegetationService,frame=G.frameForMeadowChart(config.state),upper=estimate(block,config).records;
 const staging=new Uint8Array(upper*STRIDE),tags=new Uint16Array(upper),view=new DataView(staging.buffer),ids=Object.keys(config.catalog).sort(),counts=ids.map(()=>block.regions.map(()=>0));
 const local=p=>frame.basis.map(axis=>M.dot(M.sub(p,frame.origin),axis));
 const regions=block.regions.map(b=>{const support=root.SphereMeadowSupport.query(config.state,(b[0]+b[2])*.5,(b[1]+b[3])*.5,{surfaceSupport:options.surfaceSupport});if(!support)throw Error('Compact Meadow region has no terrain support');return {center:local(support.point),radius:Math.hypot(block.blockMetres*.5,block.blockMetres*.5)*.001+.004,counts:[]};});
 let recordCount=0,clumps=0,blades=0,roots=0,visitedCandidates=0;
 const sink=(instance,owner)=>{
  if(recordCount===upper)throw Error('Compact producer exceeded reservation');
  const region=block.regions.findIndex(b=>owner[0]>=b[0]&&owner[0]<b[2]&&owner[1]>=b[1]&&owner[1]<b[3]),group=ids.indexOf(instance.prototypeId);
  if(region<0||group<0)throw Error('Compact record has no geographic/prototype owner');
  E.writePackedInstance(view,recordCount*STRIDE,instance);tags[recordCount]=group*regions.length+region;counts[group][region]++;recordCount++;
  regions[region].radius=Math.max(regions[region].radius,M.length(M.sub(instance.origin,regions[region].center))+.004+1e-9);
  options.onInstance?.(instance,owner,region);
 };
 const input={state:config.state,frame,cell:{x:block.x,z:block.z,size:8,chartBounds:[-128+block.x*8,-128+block.z*8,-120+block.x*8,-120+block.z*8]},areaSteps:block.areaSteps,candidateBounds:block.chartBoundsMetres,instanceSink:sink,rootSink:options.onRoot,surfaceSupport:options.surfaceSupport,semanticQuery:options.semanticQuery||((q,s)=>root.SphereMeadowEcology.query(q,s,{base:root.SphereGeography.queryPlacement(q,s),representation:'walking'})),generationSampler:sampler};
 const cache=options.cache||new ParentAreaCache();cache.scope(config.contentKey);
 if(block.tier==='detail'){input.parentArea=cache.get(config.state,block,options);const result=G.buildMeadowCell(input);blades=result.bladeCount;roots=result.rootCount;visitedCandidates=result.visitedCandidates;}
 if(root.SphereMeadowCanopy.active(config.state)){const result=root.SphereMeadowCanopy.buildClumpCell(input);clumps=result.clumpCount;visitedCandidates+=result.visitedCandidates;}
 const records=new Uint8Array(recordCount*STRIDE),groups=[],cursors=ids.map(()=>regions.map(()=>0));let offset=0;
 for(let group=0;group<ids.length;group++){const count=counts[group].reduce((a,b)=>a+b,0);if(!count)continue;groups.push({...config.catalog[ids[group]],byteOffset:offset,byteLength:count*STRIDE,count});for(let region=0;region<regions.length;region++){cursors[group][region]=offset;offset+=counts[group][region]*STRIDE;regions[region].counts.push(counts[group][region]);}}
 for(let i=0;i<recordCount;i++){const group=Math.floor(tags[i]/regions.length),region=tags[i]%regions.length,cursor=cursors[group][region];records.set(staging.subarray(i*STRIDE,(i+1)*STRIDE),cursor);cursors[group][region]+=STRIDE;}
 const support=root.SphereMeadowSupport.query(config.state,(block.chartBoundsMetres[0]+block.chartBoundsMetres[2])*.5,(block.chartBoundsMetres[1]+block.chartBoundsMetres[3])*.5,{surfaceSupport:options.surfaceSupport}),center=local(support.point),radius=regions.reduce((r,b)=>Math.max(r,M.length(M.sub(b.center,center))+b.radius),.004);
 const packet=V.createPacket(job,{records,groups,regions,bounds:{center,radius,units:'km',coordinateSpace:'resident-chart-km'},recordCount,detailedCount:blades,coarseCount:clumps,byteLength:records.byteLength});
 if(options.metrics)Object.assign(options.metrics,{compactRevision:1,visitedCandidates,roots,records:recordCount,stagingBytes:staging.byteLength,selectorBytes:tags.byteLength,outputBytes:records.byteLength,hashScratchBytes:4416,peakTypedBytes:staging.byteLength+tags.byteLength+records.byteLength+4416,retainedPlacementObjects:0,regionCount:regions.length,cacheEntries:cache.items.size,cacheHits:cache.hits,cacheMisses:cache.misses,cacheEvictions:cache.evictions,generationMs:now()-started});
 return packet;
}
function validateRegions(packet,block,{packetBounds=null}={}){
 const regions=packet.regions;if(!Array.isArray(regions)||regions.length!==block.regions.length)throw Error('Missing compact regions');
 for(const region of regions){if(Object.keys(region).some(k=>!['center','radius','counts'].includes(k))||!Array.isArray(region.center)||region.center.length!==3||!region.center.every(Number.isFinite)||!Number.isFinite(region.radius)||region.radius<=0||!Array.isArray(region.counts)||region.counts.length!==packet.groups.length||!region.counts.every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Invalid compact region metadata');}
 const view=new DataView(packet.records.buffer);for(let g=0;g<packet.groups.length;g++){let offset=packet.groups[g].byteOffset,total=0;for(const region of regions){const count=region.counts[g];total+=count;const [rx,ry,rz]=region.center;for(let i=0;i<count;i++){const x=view.getFloat32(offset,true),y=view.getFloat32(offset+4,true),z=view.getFloat32(offset+8,true);if(Math.hypot(x-rx,y-ry,z-rz)+.004>region.radius+1e-8)throw Error('Compact child outside geographic envelope');if(packetBounds){const scale=view.getFloat32(offset+20,true),c=packetBounds.center;if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(scale)||scale<=0||scale>.004||Math.hypot(x-c[0],y-c[1],z-c[2])+.004>packetBounds.radius+1e-8)throw Error('Invalid packed record or conservative sphere');}offset+=STRIDE;}}if(total!==packet.groups[g].count)throw Error('Incomplete compact region ranges');}
}
function movementPolicy(measurement,{speedMetresPerSecond=2.8,detailRadiusMetres=20,density=290,blockMetres=1,jobMetres=2}={}){
 if(![speedMetresPerSecond,detailRadiusMetres,density].every(v=>Number.isFinite(v)&&v>0)||![1,2,4,8].includes(blockMetres)||![blockMetres,blockMetres*2].includes(jobMetres)||jobMetres>8)throw Error('Invalid compact movement policy');
 if(!measurement||!Number.isFinite(measurement.maxQueueToReadyMs)||measurement.maxQueueToReadyMs<=0||!Number.isFinite(measurement.recordsPerSecond)||measurement.recordsPerSecond<=0)throw Error('Measured worker latency and sustained throughput required');
 const travel= speedMetresPerSecond*measurement.maxQueueToReadyMs/1000,leadMetres=Math.ceil((travel+jobMetres)/blockMetres)*blockMetres,turnGuardMetres=Math.ceil((travel+blockMetres)/blockMetres)*blockMetres,requiredRecordsPerSecond=2*(detailRadiusMetres+turnGuardMetres)*speedMetresPerSecond*density;
 return {speedMetresPerSecond,detailRadiusMetres,blockMetres,jobMetres,leadMetres,turnGuardMetres,requiredRecordsPerSecond,measuredRecordsPerSecond:measurement.recordsPerSecond,throughputSufficient:measurement.recordsPerSecond>=requiredRecordsPerSecond,latencyBasisMs:measurement.maxQueueToReadyMs,margin:'directional swept margin plus a measured local turn guard'};
}
function planRequests(state,{cameraChart,velocity=[0,0],policy,foregroundMetres=5}={}){
 if(!policy?.throughputSufficient)throw Error('Insufficient measured compact generation throughput');
 if(!Array.isArray(cameraChart)||cameraChart.length!==2||!cameraChart.every(Number.isFinite)||!Array.isArray(velocity)||velocity.length!==2||!velocity.every(Number.isFinite))throw Error('Invalid compact demand pose');
 const radius=policy.detailRadiusMetres,speed=Math.hypot(...velocity),lead=speed?policy.leadMetres:0,forward=speed?velocity.map(v=>v/speed):[0,0],future=cameraChart.map((v,k)=>v+forward[k]*lead),requests=[];
 if(speed>policy.speedMetresPerSecond+1e-9)throw Error('Movement exceeds measured preparation policy');
 const distance=(b,p)=>Math.hypot(Math.max(b[0]-p[0],0,p[0]-b[2]),Math.max(b[1]-p[1],0,p[1]-b[3]));
 const sweptDistance=b=>{
  const delta=future.map((v,k)=>v-cameraChart[k]);let low=0,high=1;
  for(let k=0;k<2;k++){if(!delta[k]){if(cameraChart[k]<b[k]||cameraChart[k]>b[k+2]){low=2;break;}}else{const a=(b[k]-cameraChart[k])/delta[k],c=(b[k+2]-cameraChart[k])/delta[k];low=Math.max(low,Math.min(a,c));high=Math.min(high,Math.max(a,c));}}
  if(low<=high)return 0;
  let result=Math.min(distance(b,cameraChart),distance(b,future));const lengthSquared=delta[0]**2+delta[1]**2;
  for(const x of [b[0],b[2]])for(const z of [b[1],b[3]]){const p=[x,z],t=lengthSquared?Math.max(0,Math.min(1,p.reduce((n,v,k)=>n+(v-cameraChart[k])*delta[k],0)/lengthSquared)):0;result=Math.min(result,Math.hypot(...p.map((v,k)=>v-cameraChart[k]-t*delta[k])));}return result;
 };
 const size=policy.jobMetres,guardedRadius=radius+(policy.turnGuardMetres||0),min=cameraChart.map((v,k)=>Math.max(-128,Math.min(v,future[k])-guardedRadius)),max=cameraChart.map((v,k)=>Math.min(128,Math.max(v,future[k])+guardedRadius));
 for(let z=Math.floor((min[1]+128)/size);z<Math.ceil((max[1]+128)/size);z++)for(let x=Math.floor((min[0]+128)/size);x<Math.ceil((max[0]+128)/size);x++){
  const bx=-128+x*size,bz=-128+z*size,b=[bx,bz,bx+size,bz+size],d=distance(b,cameraChart),sd=sweptDistance(b);if(sd>guardedRadius)continue;
  const cx=Math.floor(x*size/8),cz=Math.floor(z*size/8),priority=d<=foregroundMetres?0:d>radius&&sd<=radius?1:d<=radius?2:3;
  requests.push({x:cx,z:cz,offsetX:x*size-cx*8,offsetZ:z*size-cz*8,blockMetres:policy.blockMetres,jobMetres:size,tier:'detail',priority,distanceMetres:d});
 }
 return requests.sort((a,b)=>a.priority-b.priority||a.distanceMetres-b.distanceMetres||a.z-b.z||a.x-b.x||a.offsetZ-b.offsetZ||a.offsetX-b.offsetX);
}
function admitRequests(service,providerId,requests,{maxPending=service.limits.maxWorkers*2}={}){
 if(!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>service.limits.maxQueue)throw Error('Invalid compact pending bound');
 const provider=service.providers.get(providerId),context=service.current.get(providerId);if(!provider||!context)throw Error('Unconfigured compact provider');
 const admitted=[],existingBlocks=new Map();let denied=null,pending=service.queue.length;
 for(const r of service.allocations.values()){if(['preparing','cancelled'].includes(r.status))pending++;if(r.context===context&&r.status!=='cancelled')existingBlocks.set(r.block.id,r);}
 for(const input of requests){const block=provider.normalizeBlock(input,context.value),existing=existingBlocks.get(block.id);if(existing){if(existing.status==='queued')service.prioritize(existing.token,input.priority??2);continue;}
  if(pending>=maxPending)break;
  const result=service.reserve(providerId,input,{priority:input.priority??2});if(!result.ok){denied=result.reason;break;}admitted.push(result.handle);pending++;existingBlocks.set(block.id,{token:result.handle.reservationToken,status:'queued'});
 }return {admitted,denied,maxPending};
}
const api={COMPACT_REVISION:1,CACHE_ENTRIES,CACHE_BYTES,hashWords,sampler,normalize,estimate,ParentAreaCache,prepare,validateRegions,movementPolicy,planRequests,admitRequests};root.SphereMeadowBlocks=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
