/*
 * Infinite Biomes shared semantic geography.
 *
 * Semantic truth lives here, independently of meshes, textures, shaders and
 * residency.  The legacy adapter intentionally remains available: saved
 * scenes with geography revision 1 continue to read the original atlas and
 * Watershed fields while newer addresses can use the canonical cell field.
 */
(function(root){
'use strict';

const Address=root.SphereWorldAddress||((typeof require==='function')?require('./world-address.js'):null);
const Topology=root.SphereWorldTopology||((typeof require==='function')?require('./world-topology.js'):null);
const LegacyRoles=root.SphereLegacyRoleAdapter||((typeof require==='function')?require('./legacy-role-adapter.js'):null);
if(!Address||!Topology||!LegacyRoles)throw Error('World Address v2, topology and legacy role adapter are required before shared geography');

const FIELD_REVISION=1,LEGACY_REVISION=1,GENERATED_REVISION=2;
const REPRESENTATIONS=Object.freeze(['regional','district','walking','eye']);
const ROLES=Object.freeze(['wildland','meadow','wetland','waterway','route','service','urban','excluded']);
const BIOME_COUNT=10,DEFAULT_LEVEL=12,SEMANTIC_LEVEL=12;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a*(1-t)+b*t;
const smooth=(t)=>t*t*(3-2*t);
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid '+name);return v;};
const vector=(v,name)=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)||!Math.hypot(...v))throw Error('Invalid '+name);const n=Math.hypot(...v);return v.map(x=>x/n);};
const isAddress=v=>v&&typeof v==='object'&&!Array.isArray(v)&&v.schema===2;
const isState=v=>v&&typeof v==='object'&&!Array.isArray(v)&&(Array.isArray(v.position)||('layoutVersion' in v&&('seed' in v||'radius' in v)));

function metadata(options={},state){
 const source=state||options;
 return {worldSeed:source.worldSeed??source.seed??options.worldSeed??0,
  geographyRevision:source.geographyRevision??options.geographyRevision??GENERATED_REVISION,
  terrainRevision:source.terrainRevision??options.terrainRevision??2,
  artRevision:source.artRevision??options.artRevision??1,
  assetRevision:source.assetRevision??options.assetRevision??1,
  heroRevision:source.heroRevision??options.heroRevision??null};
}

function resolve(input,options={},state){
 const meta=metadata(options,state),level=options.level??DEFAULT_LEVEL;
 if(isAddress(input))return Address.create(input);
 if(input&&typeof input==='object'&&!Array.isArray(input)&&input.cell){
  const cell=Topology.validateCell(input.cell),local=input.local??[.5,.5];
  return Address.create({...meta,space:'shell',...cell,local});
 }
 if(input&&typeof input==='object'&&!Array.isArray(input)&&input.direction)return Address.shell({...meta,direction:input.direction,level:input.level??level});
 if(Array.isArray(input))return Address.shell({...meta,direction:input,level});
 if(isState(input))return Address.shell({...metadata(options,input),direction:vector(input.position,'state position'),level});
 throw Error('A direction, cell or World Address is required');
}

function optionState(input,options){
 if(isState(options))return options;
 if(options&&isState(options.state))return options.state;
 if(isState(input))return input;
 return null;
}

function samplerFor(address){
 return Topology.sampler({worldSeed:address.worldSeed,geographyRevision:address.geographyRevision,terrainRevision:address.terrainRevision});
}

function pointValues(address,cell,local){
 const sampler=samplerFor(address),face=cell.face,level=cell.level,size=2**level;
 const x=cell.x,y=cell.y,u=clamp(local[0]),v=clamp(local[1]);
 const corners=[
  Topology.latticeKey(face,level,x,y),Topology.latticeKey(face,level,x+1,y),
  Topology.latticeKey(face,level,x,y+1),Topology.latticeKey(face,level,x+1,y+1)
 ].map(key=>({key,
  elevation:sampler.random('elevation',key),
  water:sampler.random('water',key),
  route:sampler.random('route',key),
  geology:sampler.random('geology',key),
  wetness:sampler.random('wetness',key),
  catchment:sampler.random('catchment',key),
  service:sampler.random('service',key),
  damage:sampler.random('damage',key),
  exclusion:sampler.random('exclusion',key),
  biomeWeights:Array.from({length:BIOME_COUNT},(_,i)=>sampler.random('biome',key,i))
 }));
 const blend=(name)=>{const a=corners[0][name],b=corners[1][name],c=corners[2][name],d=corners[3][name];return mix(mix(a,b,u),mix(c,d,u),v);};
 const biomeWeights=Array.from({length:BIOME_COUNT},(_,i)=>{const a=corners[0].biomeWeights[i],b=corners[1].biomeWeights[i],c=corners[2].biomeWeights[i],d=corners[3].biomeWeights[i];return mix(mix(a,b,u),mix(c,d,u),v);});
 const total=biomeWeights.reduce((sum,value)=>sum+value,0)||1;
 return {elevation:blend('elevation'),water:blend('water'),route:blend('route'),geology:blend('geology'),wetness:blend('wetness'),catchment:blend('catchment'),service:blend('service'),damage:blend('damage'),exclusion:blend('exclusion'),biomeWeights:biomeWeights.map(value=>value/total),corners,cell:{face,level,x,y},local:[u,v],size};
}

function generated(address){
 // Semantic interpolation has one authoritative lattice.  A coarser or finer
 // viewing address therefore changes representation detail, never the answer
 // at the represented place.
 const q=Address.direction(address),grid=Address.gridAt(q,SEMANTIC_LEVEL),canonical={...address,level:SEMANTIC_LEVEL,face:grid.face,x:grid.x,y:grid.y,local:grid.local},cell={face:grid.face,level:grid.level,x:grid.x,y:grid.y},v=pointValues(canonical,cell,grid.local),identityAddress=Address.create(canonical);
 const c=v.corners;
 const du=mix(c[1].elevation-c[0].elevation,c[3].elevation-c[2].elevation,v.local[1]);
 const dv=mix(c[2].elevation-c[0].elevation,c[3].elevation-c[1].elevation,v.local[0]);
 const slope=clamp(Math.hypot(du,dv)*1.7);
 const biome=v.biomeWeights.reduce((best,value,index)=>value>best.value?{index,value}:best,{index:0,value:-1}).index;
 const waterMembership=clamp(v.water*.82+v.wetness*.18);
 const river=waterMembership>.84,basin=waterMembership>.64;
 const routeMembership=clamp(v.route*.84+v.service*.16),route=routeMembership>.78;
 const wetness=clamp(v.wetness*.65+waterMembership*.35);
 const service=v.service>.84?'service':v.service>.66?'industrial':v.service>.48?'landscape':null;
  const canopy=clamp(v.biomeWeights[4]*.8+v.biomeWeights[5]*.6+v.biomeWeights[7]*.4),excluded=v.exclusion>.965||slope>.93;
 const role=excluded?'excluded':river?'waterway':route?'route':service?'service':wetness>.68?'wetland':biome===1||biome===8?'meadow':'wildland';
 const elevationKm=.001+v.elevation*.018,damage=clamp(v.damage*.16),featureIds={waterway:river?Address.featureId('waterway',identityAddress,'river-'+Math.floor(v.catchment*100000)):null,route:route?Address.featureId('route',identityAddress,'route-'+Math.floor(v.route*100000)):null,district:service?Address.featureId('district',identityAddress,service):null,vegetation:Address.featureId('vegetation',identityAddress,'cluster-'+Math.floor(v.service*100000)),landmark:v.geology>.92?Address.featureId('landmark',identityAddress,'outcrop-'+Math.floor(v.geology*100000)):null};
  const base={elevation:elevationKm,elevationKm,slope,biomeWeights:v.biomeWeights,biome,geology:v.geology,geologyClass:v.geology>.72?'rock':v.geology>.38?'mixed':'soil',wetness,canopy,catchment:{value:v.catchment,id:`catchment:${address.worldSeed}:${Math.floor(v.catchment*4096)}`},waterMembership,water:{membership:waterMembership,river,basin,depth:basin?waterMembership*.006:0,flow:river?waterMembership:0},routeMembership,route:{membership:routeMembership,connected:route,class:route?'regional':null},landUseRole:role,serviceLandUseRole:role,serviceRole:service,damage,exclusionMasks:{water:river||basin,rock:v.geology>.82,slope:slope>.72,routeClearance:route,structureClearance:service!==null,canopy:canopy>.72,damage:v.damage>.82,missing:false},
  featureIds,persistentFeatureIds:featureIds,
  source:'generated',revision:GENERATED_REVISION,address:Address.create(address),identityAddress,cell:v.cell,local:v.local,raw:{...v,biomeWeights:v.biomeWeights.slice()}};
 return base;
}

function legacyBiome(q,state){
 const W=root.SphereWorld;
 if(!W?.sample)return {a:0,b:0,blend:0,id:0,damage:0};
 return W.sample(q,state);
}
function legacyElevation(q,state,original,watershed){
 if(watershed?.terrainKm!=null)return watershed.terrainKm;
 const S=root.SphereSites,M=root.SphereMath,W=root.SphereWorld;
 if(!S||!M||!W)return .001;
 const world=M.mul(q,state.radius),n=(scale,seed)=>(S.noise(world[0]*scale,world[1]*scale,seed)+S.noise(world[1]*scale,world[2]*scale,seed+91)+S.noise(world[2]*scale,world[0]*scale,seed+173))/3;
 const extra=id=>id===2?.012*n(.14,state.seed+21):id===3?.016*n(.4,state.seed+27):0;
 const relief=.002+n(.45,state.seed)*.008+n(2.5,state.seed+5)*.0002+extra(original.a)*(1-original.blend)+extra(original.b)*original.blend;
 if(root.SphereWatershed?.enabled(state)){const [x,z]=root.SphereWatershed.local(q,state);return relief*W.smooth(320,322,Math.max(Math.abs(x),Math.abs(z)));}
 return relief;
}
function legacy(q,state,address,placementOnly=false){
 const W=root.SphereWorld,C=root.SphereCollection,original=legacyBiome(q,state),watershed=root.SphereWatershed?.sample?.(q,state)||null;
 const weights=Array(BIOME_COUNT).fill(0);weights[original.a]=1-original.blend;weights[original.b]+=original.blend;
 const total=weights.reduce((a,b)=>a+b,0)||1;
 const water=watershed?.water||{river:false,basin:false,distance:Infinity,flow:0};
 const river=!!water.river,basin=!!water.basin,waterMembership=river?1:basin?.72:0;
  const route=!!watershed?.route,serviceRoleDisplay=watershed?.service||null,serviceRole=serviceRoleDisplay?LegacyRoles.adapt(serviceRoleDisplay).slug:null;
 const local=watershed?{x:watershed.x,z:watershed.z}:null;
 const elevation=placementOnly?null:legacyElevation(q,state,original,watershed);
 const slope=clamp((Math.abs((local?.x||0)%16)/160+Math.abs((local?.z||0)%16)/160)*.08);
 const role=state.layoutVersion===2?(river?'waterway':route?'route':serviceRole?'service':basin?'wetland':original.id===1||original.id===8?'meadow':'wildland'):'legacy';
 const missing=!!(C?.missing?.(q,state));
 const excluded=missing||missing===true;
 const canopy=(original.id===4||original.id===5||original.id===7) ? .62 : original.id===8 ? .35 : 0;
 const masks={water:river||basin,rock:false,slope:slope>.72,routeClearance:route,structureClearance:!!serviceRole,canopy:canopy>.72,damage:(original.damage||0)>.82,missing:excluded};
 // Placement consumes the same exclusions/wetness without allocating four
 // representation summaries, feature IDs and unused elevation/noise results.
 if(placementOnly)return {water:{membership:waterMembership,river,basin},route:{membership:route?1:0},landUseRole:role,wetness:clamp(waterMembership+(original.id===6||original.id===8?.22:0)),exclusionMasks:masks};
   const ids={waterway:river?Address.featureId('waterway',address,'watershed-river-'+Math.round(water.flow*1000)):null,route:route?Address.featureId('route',address,'watershed-route'):null,district:serviceRole?Address.featureId('district',address,serviceRole):null,vegetation:Address.featureId('vegetation',address,'legacy-cluster-'+original.id),landmark:null};
   return {elevation,elevationKm:elevation,slope,biomeWeights:weights.map(v=>v/total),biome:original.id,geology:clamp((original.id*17%31)/30),geologyClass:original.id===2||original.id===3?'rock':'soil',wetness:clamp(waterMembership+(original.id===6||original.id===8?.22:0)),canopy,catchment:{value:watershed?clamp((Math.abs(watershed.x)+Math.abs(watershed.z))/640):0,id:watershed?`watershed:${state.provinceSeed}`:'legacy-atlas'},waterMembership,water:{membership:waterMembership,river,basin,depth:basin?.006:0,flow:water.flow||0,distance:water.distance},routeMembership:route?1:0,route:{membership:route?1:0,connected:route,class:route?'district':null},landUseRole:role,serviceLandUseRole:role,serviceRole,serviceRoleDisplay,damage:original.damage||0,exclusionMasks:{water:river||basin,rock:false,slope:slope>.72,routeClearance:route,structureClearance:!!serviceRole,canopy:canopy>.72,damage:(original.damage||0)>.82,missing:excluded},featureIds:ids,persistentFeatureIds:ids,source:watershed?'watershed':'legacy-atlas',revision:LEGACY_REVISION,address:Address.create(address),cell:{face:address.face,level:address.level,x:address.x,y:address.y},local:address.local.slice(),raw:{originalBiome:original.id,original}};
}

function isLegacy(options,state,address){
 if(options.revision==='legacy'||options.source==='legacy')return true;
 if(options.revision==='generated'||options.source==='generated')return false;
 return !!state&&(state.geographyRevision??1)<=LEGACY_REVISION||address.geographyRevision<=LEGACY_REVISION&&!!state;
}

function probeValues(field){
 const values=[field.elevationKm,field.slope,field.geology,field.wetness,field.water.membership,field.route.membership,field.damage,...field.biomeWeights];
 return Float32Array.from(values);
}
function cloneForRepresentation(field,representation){
 if(!REPRESENTATIONS.includes(representation))throw Error('Invalid geography representation');
 return {...field,representation,representations:REPRESENTATIONS.reduce((out,name)=>{out[name]={address:Address.stringify(field.address),biome:field.biome,water:field.water.membership,route:field.route.membership,elevationKm:field.elevationKm};return out;}, {})};
}
function query(input,options={},maybeState){
 let state=optionState(input,options);if(isState(maybeState))state=maybeState;
 if(isState(options))options={};
 const address=resolve(input,options,state),q=Address.direction(address);
 const field=isLegacy(options,state,address)?legacy(q,state||{},address):generated(address);
 const representation=options.representation||'eye';
 const represented=cloneForRepresentation(field,representation);
 return options.ecology===false||!root.SphereMeadowEcology?.active?.(state)?represented:root.SphereMeadowEcology.query(input,state,{base:represented,representation});
}
function queryPlacement(input,state){
 // Validated legacy scenes need the exact canonical grid direction, but no
 // portable address object. gridAt/direction are the same operations as shell.
 if(Array.isArray(input)&&state&&(state.geographyRevision??1)<=LEGACY_REVISION)return legacy(Address.direction(Address.gridAt(input,DEFAULT_LEVEL)),state,null,true);
 const address=resolve(input,{},state),q=Address.direction(address);
 return isLegacy({},state,address)?legacy(q,state,address,true):query(input,{state,ecology:false,representation:'walking'});
}
function sample(input,stateOrOptions){return query(input,isState(stateOrOptions)?{state:stateOrOptions}:stateOrOptions||{});}
function atScale(input,representation,options={}){return query(input,{...options,representation});}
function cpuProbe(input,options={}){return returnProbe(input,options);}
function returnProbe(input,options={}){return probeValues(query(input,options));}
function gpuProbe(input,options={}){return Float32Array.from(cpuProbe(input,options));}
function probeParity(input,options={}){const a=cpuProbe(input,options),b=gpuProbe(input,options);let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return {pass:max===0,maxError:max,cpu:a,gpu:b};}
const PROBE_GLSL=`struct GeographyProbe { float elevationKm; float slope; float geology; float wetness; float waterMembership; float routeMembership; float damage; vec4 biomeWeights0; vec4 biomeWeights1; vec2 biomeWeights2; };`;
const api={FIELD_REVISION,LEGACY_REVISION,GENERATED_REVISION,REPRESENTATIONS,ROLES,PROBE_GLSL,resolve,query,queryPlacement,sample,atScale,generated,legacy,cpuProbe,gpuProbe,probeParity,probeValues};
root.SphereGeography=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
