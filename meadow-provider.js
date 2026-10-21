/* Shared Meadow provider: legacy parents and HR-02 compact geographic jobs. */
(function(root){
'use strict';
const V=root.SphereVegetationService||(typeof require==='function'?require('./vegetation-service.js'):null),R=root.SphereVegetationRevisions||(typeof require==='function'?require('./vegetation-revisions.js'):null);
const ID='meadow-fixed-chart',RECIPE_REVISION=1,SCHEMA='sphere-instance32-v1',SPACE='resident-chart-km';
function grass(){const g=root.SphereGrass;if(!g)throw Error('Meadow placement must load before its provider');return g;}
function catalog(state){const m=state.meadow,items={};for(let i=0;i<3;i++){const id=m.appearanceRevision>=2?'meadow-tapered-ribbon-v2-'+i:'grass-blade-'+i;items[id]={prototypeId:id,prototypeRevision:V.sha256(V.canonical([id,m.appearanceRevision,state.artRevision,state.assetRevision])),materialId:'meadow-foliage',materialRevision:V.sha256(V.canonical([m.materialRevision??1,m.appearanceRevision,state.heroRevision])),shaderVariant:m.canopyRevision===2?'foliage2':m.canopyRevision===1?'foliage':'opaque',geometryLod:0,pass:'colour',recordSchema:SCHEMA,coordinateSpace:SPACE,tier:'detail'};}
 if(root.SphereMeadowCanopy?.active(state)){const id='meadow-volume-clump-f'+m.canopyRevision;items[id]={...items[Object.keys(items)[0]],prototypeId:id,prototypeRevision:V.sha256(V.canonical([id,m.appearanceRevision,m.canopyRevision,state.artRevision,state.assetRevision])),tier:'coarse'};}return items;
}
function configurationFromState(state){const descriptor=R.describe(state);if(!descriptor)throw Error('A fixed-chart Meadow profile is required');return {contentKey:R.contentKey(descriptor),state,catalog:catalog(state),fallback:{kind:'retain-existing-canopy',detailReady:false,meaning:'A clump or terrain fallback never proves foreground detail readiness'},units:{records:'32-byte packed instances',position:'km',parent:'metres',bounds:'km'}};}
function configure(input){return configurationFromState(root.SphereMath.validate(input));}
function validateConfiguration(config){
 // Validation may renormalise camera unit vectors by one ULP. Preserve the
 // exact already-validated, hashed main-thread snapshot for worker generation.
 root.SphereMath.validate(config.state);const expected=configurationFromState(config.state);if(V.canonical(config)!==V.canonical(expected))throw Error('Unsupported Meadow configuration');return config;
}
function blocks(){return root.SphereMeadowBlocks||(typeof require==='function'?require('./meadow-blocks.js'):null);}
function normalizeBlock(input,config){const x=input?.x??input?.cell?.x,z=input?.z??input?.cell?.z,size=input?.size??input?.cell?.size??8,tier=input?.tier??input?.cell?.canopyTier??'detail',areaSteps=input?.areaSteps??16;
 if(!Number.isInteger(x)||x<0||x>=32||!Number.isInteger(z)||z<0||z>=32||size!==8||!['detail','clump'].includes(tier)||!Number.isInteger(areaSteps)||areaSteps<4||areaSteps>16)throw Error('Unsupported bounded Meadow parent job');
 if(tier==='clump'&&!root.SphereMeadowCanopy?.active(config.state))throw Error('Clump recipe unavailable');
 const g=grass(),parent=g.meadowCellKey({x,z},config.state),suffix=config.state.meadow.canopyRevision?':f'+config.state.meadow.canopyRevision+':'+tier:'';
 const id=parent+':q'+areaSteps+suffix,job={id,parent,x,z,sizeMetres:8,tier,areaSteps,chartBoundsMetres:[-128+x*8,-128+z*8,-120+x*8,-120+z*8],ownership:'half-open-parent-root'};
 return input.blockMetres===undefined?job:blocks().normalize(input,job);
}
function estimate(block,config){if(block.compactRevision)return blocks().estimate(block,config);const candidates=64*grass().MEADOW_CANDIDATE_POOL_ROOTS_PER_M2,detail=block.tier==='detail'?candidates*grass().MEADOW_BLADES_PER_ROOT:0,coarse=root.SphereMeadowCanopy?.active(config.state)?256:0,records=detail+coarse;
 // The legacy generator builds objects and intermediate packed copies. This
 // explicit conservative allowance is not complete empirical CPU attribution.
 return {records,detailedRecords:detail,cpuBytes:records*32+4096,packetBytes:records*32+4096,scratchBytes:records*1024+candidates*256+records*64};
}
function validatePacket(p,block,config){for(const group of p.groups){const declared=config.catalog[group.prototypeId];if(!declared||V.batchKey(group)!==V.batchKey(declared)||group.tier!==declared.tier)throw Error('Unsupported provider prototype/material batch');}
 if(block.tier==='clump'&&p.detailedCount!==0)throw Error('Clump job returned detailed records');
 const frame=grass().frameForMeadowChart(config.state);
 if(block.compactRevision){blocks().validateRegions(p,block,{packetBounds:p.bounds});for(let i=0;i<block.regions.length;i++){const b=block.regions[i],s=root.SphereMeadowSupport.query(config.state,(b[0]+b[2])*.5,(b[1]+b[3])*.5),delta=s.point.map((v,k)=>v-frame.origin[k]),c=frame.basis.map(axis=>root.SphereMath.dot(delta,axis));if(p.regions[i].center.some((v,k)=>Math.abs(v-c[k])>1e-9)||p.regions[i].radius>1)throw Error('Mismatched compact region bounds');}}else if(p.regions!==undefined)throw Error('Unexpected compact metadata on legacy parent');
 // Bounds are tied to the immutable chart frame, not an arbitrary render rebase.
 const support=root.SphereMeadowSupport.query(config.state,(block.chartBoundsMetres[0]+block.chartBoundsMetres[2])*.5,(block.chartBoundsMetres[1]+block.chartBoundsMetres[3])*.5),delta=support.point.map((v,i)=>v-frame.origin[i]),center=frame.basis.map(axis=>root.SphereMath.dot(delta,axis));
 if(p.bounds.center.some((v,i)=>Math.abs(v-center[i])>1e-9)||p.bounds.radius>1)throw Error('Mismatched Meadow chart bounds');
 // Every packed origin and a conservative maximum botanical/wind envelope
 // must fit the supplied sphere. This checks producer bounds, not visibility.
 if(block.compactRevision)return; // Both packed-record envelopes were checked in the same regional scan.
 const view=new DataView(p.records.buffer),envelope=.004;
 for(let i=0;i<p.recordCount;i++){const base=i*32,origin=[view.getFloat32(base,true),view.getFloat32(base+4,true),view.getFloat32(base+8,true)],scale=view.getFloat32(base+20,true);if(!origin.every(Number.isFinite)||!Number.isFinite(scale)||scale<=0||scale>.004||Math.hypot(...origin.map((v,k)=>v-p.bounds.center[k]))+envelope>p.bounds.radius+1e-8)throw Error('Invalid packed record or conservative sphere');}
}
function validateCoverage(config){if(!root.SphereMeadowCanopy.isF2(config.state))throw Error('Progressive coverage requires the F2 clump fallback adapter');}
function provider(){return Object.freeze({id:ID,recipeRevision:RECIPE_REVISION,recordSchema:SCHEMA,stride:32,coordinateSpace:SPACE,workerCacheBytes:8192,configure,normalizeBlock,estimate,validatePacket,validateCoverage});}
function prepare(job,config,options={}){if(job.providerId!==ID||job.recipeRevision!==RECIPE_REVISION||job.recordSchema!==SCHEMA||job.packetRevision!==V.PACKET_REVISION)throw Error('Unsupported Meadow worker recipe');
 const block=normalizeBlock(job.block,config);if(V.canonical(block)!==V.canonical(job.block))throw Error('Mismatched worker geographic job');const required=estimate(block,config);for(const k of Object.keys(required))if((k==='metadataBytes'?job.metadataBytes:job.credit[k])<required[k])throw Error('Insufficient pre-dispatch worker reservation');
 if(block.compactRevision)return blocks().prepare(job,config,options);
 const g=grass(),cell={x:block.x,z:block.z,size:8,canopyTier:block.tier,key:block.id,chartBounds:block.chartBoundsMetres},input={state:config.state,frame:g.frameForMeadowChart(config.state),cell,areaSteps:block.areaSteps},patch=g.prepareResidentCell(root.SphereMeadowCanopy.buildResidentCell(input),{releaseSource:true,releasePlacementObjects:true});
 const groups=patch.residentGroups.map(group=>({...config.catalog[group.prototypeId],byteOffset:group.byteOffset,byteLength:group.byteLength,count:group.count})),records=patch.residentBuffer;
 // Add the shared provider envelope to the legacy sphere without changing records.
 const radius=patch.boundsRadius+.004;
 return V.createPacket(job,{records,groups,bounds:{center:patch.center.slice(),radius,units:'km',coordinateSpace:SPACE},recordCount:records.byteLength/32,detailedCount:patch.bladeCount||0,coarseCount:patch.clumpCount||0,byteLength:records.byteLength});
}
function createService(state,options={}){const service=options.service||new V.VegetationService(options);if(!service.providers.has(ID))service.register(provider());service.setScene(options.sceneKey||'meadow-residency');service.configure(ID,state);return service;}
const api={ID,RECIPE_REVISION,SCHEMA,SPACE,provider,prepare,configure,validateConfiguration,normalizeBlock,estimate,createService};root.SphereMeadowProvider=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
