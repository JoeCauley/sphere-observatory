/* IB-060 worker: all root placement, semantic rejection and compact packing
 * happen off the main thread. The packet is address-derived and disposable. */
'use strict';
importScripts('world-address.js','world-topology.js','meadow-wind.js','math.js','vegetation-revisions.js','vegetation-memory.js','vegetation-service.js','collection.js','biomes.js','world-palette.js','biome-packs.js','world.js','watershed-network.js','field-sites.js','legacy-role-adapter.js','edge-stream.js','shade-edges.js','watershed-province.js','world-geography.js','watershed-neighbourhood.js','meadow-ecology.js','ground-chunks.js','meadow-support.js','instanced-environment.js','meadow-canopy.js','grass-stream.js?ib075f=canopy-1','meadow-blocks.js','meadow-provider.js');
const vegetationConfigurations=new Map();
let vegetationPeakTypedBytes=0,vegetationTransferredBytes=0;
function vegetationMemoryReport(){const buffers=SphereMeadowCanopy.cpuBuffers(),backing=new Set(buffers.map(v=>v.buffer));return {revision:1,configurationCount:vegetationConfigurations.size,configurationSerializedBytes:[...vegetationConfigurations.values()].reduce((n,c)=>n+new TextEncoder().encode(SphereVegetationService.canonical(c.config)).byteLength,0),parentAreaCacheEntries:[...vegetationConfigurations.values()].reduce((n,c)=>n+c.cache.items.size,0),prototypeBackingBytes:[...backing].reduce((n,b)=>n+b.byteLength,0),lastJobPeakTypedBytes:vegetationPeakTypedBytes,transferredBytes:vegetationTransferredBytes,retainedOutputBytes:0,metadata:'Complete worker heap measured externally; serialization is not a heap bound'};}
onmessage=({data})=>{try{
 const started=performance.now();
 if(data.kind==='vegetation-memory'){postMessage({kind:'vegetation-memory',ownership:vegetationMemoryReport()});return;}
 if(data.kind==='vegetation-configure'){
  if(data.packetRevision!==SphereVegetationService.PACKET_REVISION||data.providerId!==SphereMeadowProvider.ID||!Number.isSafeInteger(data.requestGeneration)||data.requestGeneration<1)throw Error('Unsupported vegetation configuration');
  const serialized=SphereVegetationService.canonical(data.configuration);if(new TextEncoder().encode(serialized).byteLength>SphereVegetationService.LIMITS.maxConfigurationBytes)throw Error('Worker configuration exceeds limit');
  const config=SphereMeadowProvider.validateConfiguration(data.configuration);if(config.contentKey!==data.contentKey||SphereVegetationService.sha256(serialized)!==data.configurationHash)throw Error('Worker configuration identity mismatch');
  vegetationConfigurations.clear();vegetationConfigurations.set(data.providerId,{config:SphereVegetationService.immutable(config),configurationHash:data.configurationHash,requestGeneration:data.requestGeneration,cache:new SphereMeadowBlocks.ParentAreaCache()});
  postMessage({kind:'vegetation-configured',providerId:data.providerId,configurationHash:data.configurationHash,requestGeneration:data.requestGeneration,ownership:vegetationMemoryReport()});return;
 }
 if(data.kind==='vegetation-job'){
  const context=vegetationConfigurations.get(data.providerId);if(!context||context.configurationHash!==data.configurationHash||context.requestGeneration!==data.requestGeneration||context.config.contentKey!==data.contentKey)throw Error('Obsolete worker vegetation configuration');
  const metrics={},packet=SphereMeadowProvider.prepare(data,context.config,{cache:context.cache,metrics});packet.prepareMs=performance.now()-started;vegetationPeakTypedBytes=metrics.peakTypedBytes||0;vegetationTransferredBytes+=packet.records.byteLength;postMessage(data.block.compactRevision?{kind:'vegetation-result',reservationToken:data.reservationToken,packet,metrics,ownership:vegetationMemoryReport()}:packet,[packet.records.buffer]);return;
 }
 if(data.kind==='meadow-material-f1'){const descriptor=SphereMeadowCanopy.buildDescriptor(data.state);postMessage({generation:data.generation,prepareMs:performance.now()-started,descriptor},[descriptor.data.buffer]);return;}
 let patch=data.kind==='meadow-cell-v2'?SphereMeadowCanopy.buildResidentCell(data):SphereGrass.buildPatch(data);if(data.resident)patch=SphereGrass.prepareResidentCell(patch,{releaseSource:true,releasePlacementObjects:true});const prepareMs=performance.now()-started,buffer=data.resident?patch.residentBuffer:patch.instanceBuffer,transfer=buffer?[buffer.buffer]:[];postMessage({generation:data.generation,prepareMs,patch},transfer);
}catch(error){postMessage(data.kind?.startsWith('vegetation-')?{kind:'vegetation-error',reservationToken:data.reservationToken,error:String(error)}:{generation:data.generation,error:String(error)});}};
