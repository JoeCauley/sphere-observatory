/*
 * IB-060 deterministic streamed grass.
 *
 * Grass is a render/support layer, not a second geography system. Patch and
 * root ownership come from World Address v2; all variation is counter/hash
 * based so request order, rebasing, eviction and worker count cannot move a
 * blade. Units are kilometres, as in the connected-ground renderer.
 */
(function(root){
'use strict';

const A=root.SphereWorldAddress||((typeof require==='function')?require('./world-address.js'):null);
const T=root.SphereWorldTopology||((typeof require==='function')?require('./world-topology.js'):null);
const G=root.SphereGeography||((typeof require==='function')?require('./world-geography.js'):null);
if(!A||!T)throw Error('World Address v2 and topology are required before grass');

// Level 30 is the finest portable cube-sphere cell in World Address v2. A
// quarter-kilometre patch keeps the same address contract useful from the
// current AU-scale shell down to the close connected-ground frame.
const PATCH_LEVEL=30,ROOT_LEVEL=30,SUBCELLS=4,DEFAULT_ROOTS=12;
const PATCH_SIZE=.256,DEFAULT_RADIUS=2,MAX_PATCHES=81;
const MEADOW_CELL_SIZE_METRES=8,MEADOW_BLADES_PER_ROOT=5,MEADOW_CANDIDATE_POOL_ROOTS_PER_M2=100,MEADOW_DETAIL_RADIUS_METRES=15,MEADOW_MAX_BLADE_HEIGHT_KM=.0011,MEADOW_CHILD_SPREAD_METRES=.012;
const MEADOW_ART_APPEARANCE_REVISION=2,MEADOW_BLADE_SEGMENTS=5,MEADOW_BLADE_HALF_WIDTHS=[.00415,.00495,.00545],MEADOW_BLADE_CURVATURES=[.055,-.038,.072],MEADOW_MAX_REST_CURVE=.075;
const RESIDENT_RESOURCE_REVISION=1,MAX_WIND_BEND_FRACTION=.66,MAX_GRASS_PROTOTYPE_RADIUS_FACTOR=Math.hypot(1,MEADOW_MAX_REST_CURVE+.0055),RESIDENT_CELL_BOUND_PADDING_KM=1e-9;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=v=>Math.hypot(...v);
const norm=v=>{const n=length(v);return n?mul(v,1/n):[0,1,0];};
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid '+name);return v;};
const vector=(v,name,n=3)=>{if(!Array.isArray(v)||v.length!==n||!v.every(Number.isFinite))throw Error('Invalid '+name);return v.slice();};
const metadata=(state,options={})=>{const legacy=state?.packAddress?.geographyRevision===1||state?.provinceRevision===1;return {worldSeed:Math.floor(state?.worldSeed??state?.seed??options.worldSeed??0),geographyRevision:legacy?1:Math.floor(state?.geographyRevision??options.geographyRevision??2),terrainRevision:Math.floor(state?.terrainRevision??options.terrainRevision??2),artRevision:Math.floor(state?.artRevision??options.artRevision??1),assetRevision:Math.floor(state?.assetRevision??options.assetRevision??1),heroRevision:state?.heroRevision??options.heroRevision??null};};
const hash=(...parts)=>T.hash64(['ib060',...parts]);
const random=(seed,stream,key,counter=0)=>Number(hash(seed,stream,key,counter)>>11n)/9007199254740992;
const uint32=(seed,stream,key,counter=0)=>Number(hash(seed,stream,key,counter)&4294967295n)>>>0;
const hashString=value=>{let h=2166136261>>>0;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const hashHex=(...parts)=>hash(...parts).toString(16).padStart(16,'0');

function quaternion(input=[0,0,0,1]){const q=vector(input,'quaternion',4),n=length(q);if(!n)throw Error('Invalid quaternion');return q.map(v=>v/n);}
function quaternionMultiply(a,b){return quaternion([a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]);}
function quaternionFromTo(from,to){const a=norm(from),b=norm(to),d=dot(a,b);if(d<-.999999){const axis=Math.abs(a[0])<.5?norm(cross(a,[1,0,0])):norm(cross(a,[0,1,0]));return [axis[0],axis[1],axis[2],0];}return quaternion([...cross(a,b),1+d]);}
function quaternionAxis(axis,angle){const s=Math.sin(angle/2);return [axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(angle/2)];}
function orient(normal,yaw){return quaternionMultiply(quaternionAxis(norm(normal),yaw),quaternionFromTo([0,1,0],normal));}
function leanedNormal(normal,azimuth,angle){const n=norm(normal),axis=[Math.cos(azimuth),0,Math.sin(azimuth)],tangent=norm(sub(axis,mul(n,dot(axis,n))));return norm(add(mul(n,Math.cos(angle)),mul(tangent,Math.sin(angle))));}

function shellFrame(q){
 const up=mul(q,-1),reference=Math.abs(up[1])<.9?[0,1,0]:[1,0,0],east=norm(cross(reference,up));
 return {east,up,north:norm(cross(east,up))};
}
function frameForState(state){
 const anchor=norm(state.terrainAnchor||state.siteAnchor||state.position||[0,0,1]),radius=finite(state.radius||149597870.7,'radius'),basis=shellFrame(anchor);
 return {origin:mul(anchor,radius),basis:[basis.east,basis.up,basis.north],radius};
}
function frameForMeadowChart(state){
 const ecology=root.SphereMeadowEcology;if(!ecology?.chartFrame)throw Error('The fixed Meadow chart must load before its resident frame');
 const chart=ecology.chartFrame(state),up=mul(chart.direction,-1);
 return {origin:mul(chart.direction,chart.radius),basis:[chart.east,up,chart.north],radius:chart.radius};
}
function local(frame,world){const d=sub(world,frame.origin);return frame.basis.map(axis=>dot(d,axis));}
function world(frame,localPoint){return add(frame.origin,frame.basis.reduce((out,axis,i)=>add(out,mul(axis,localPoint[i])),[0,0,0]));}
function framePlain(frame){return {origin:frame.origin.slice(),basis:frame.basis.map(v=>v.slice()),radius:frame.radius};}

function cellForDirection(direction,state,level=PATCH_LEVEL){
 const address=A.shell({...metadata(state),direction,level});
 return {face:address.face,level:address.level,x:address.x,y:address.y};
}
function addressForCell(cell,state,local=[.5,.5]){return A.create({...metadata(state),space:'shell',...cell,local});}
function patchKey(cell){return `grass:${T.cellKey(cell)}`;}
function patchRequest(state,frame,cx,cz){
 const centre=world(frame,[(cx+.5)*PATCH_SIZE,0,(cz+.5)*PATCH_SIZE]),direction=norm(centre),cell=cellForDirection(direction,state),address=addressForCell(cell,state),key=patchKey(cell);
 return {key,cell,address,centerDirection:direction,centerLocal:local(frame,mul(direction,frame.radius)),frame:framePlain(frame),cx,cz};
}
function patchRequests(state,frame=frameForState(state),options={}){
 const radius=Math.max(0,Math.floor(options.radiusPatches??DEFAULT_RADIUS)),centre=local(frame,state.position||world(frame,[0,0,0])),cx=Math.floor(centre[0]/PATCH_SIZE),cz=Math.floor(centre[2]/PATCH_SIZE),out=[];
 for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++)out.push(patchRequest(state,frame,x,z));
 out.sort((a,b)=>Math.hypot(a.cx-cx,a.cz-cz)-Math.hypot(b.cx-cx,b.cz-cz)||a.key.localeCompare(b.key));
 const scoped=options.coverageId&&root.SphereMeadowEcology?.active?.(state)?out.filter(request=>root.SphereMeadowEcology.coverageAt(request.centerDirection,state).coverage>0):out;
 return scoped.slice(0,Math.max(1,Math.floor(options.maxPatches??MAX_PATCHES)));
}

function terrainHeight(input,q,localPoint,field){
 const state=input.state||{},frame=input.frame;
 if(typeof input.terrainHeight==='function')return input.terrainHeight(q,localPoint,field);
 // Connected-ground height needs the Mesh frame's world() method. Legacy
 // Watershed/Open meadow scenes intentionally use the semantic analytic
 // height path and must not pass a plain frame record into that helper.
 if(root.SphereGround?.height&&frame?.world&&root.SphereGround.enabled?.(state))return root.SphereGround.height(state,frame,localPoint[0],localPoint[2]);
 const radial=(localPoint[0]*localPoint[0]+localPoint[2]*localPoint[2])/(state.radius+Math.sqrt(Math.max(0,state.radius*state.radius-localPoint[0]*localPoint[0]-localPoint[2]*localPoint[2])));
 return (field?.elevationKm??.002)+radial;
}
function semanticAt(q,state){
 const base=G?.query?G.query(q,{state,representation:'walking',ecology:false}):{elevationKm:.002,slope:0,wetness:0,damage:0,canopy:0,water:{membership:0,river:false,basin:false},route:{membership:0,connected:false},exclusionMasks:{water:false,rock:false,slope:false,routeClearance:false,structureClearance:false,damage:false,canopy:false,missing:false},featureIds:{vegetation:null}};
 return root.SphereMeadowEcology?.active?.(state)?root.SphereMeadowEcology.query(q,state,{base,representation:'walking'}):base;
}
function densityFactor(field,options={}){
 if(field?.ecology?.representationRevision===3)return clamp((field.ecology.grassDensityBladesPerM2??0)/250)*(options.density??1);
 const mask=field.exclusionMasks||{},water=field.water?.membership??0,route=field.route?.membership??0,wet=field.wetness??0,damage=field.damage??0,canopy=field.canopy??0;
 if(mask.missing||mask.water||mask.rock||mask.slope||mask.routeClearance||mask.structureClearance||mask.damage||water>.35||route>.35)return 0;
 const weights=field.biomeWeights||[],meadowBlend=options.meadowBlend?clamp((weights[1]||0)*.62+(weights[8]||0)*.28+(field.landUseRole==='meadow'?.2:0))*.52+.48:1;
 return clamp(1-water*.9-wet*(options.wetnessPenalty??.35)-damage*(options.damagePenalty??.65)-canopy*(options.canopyPenalty??.55))*(options.density??1)*meadowBlend;
}
function eligible(field,randomPresence,options={}){
 const density=densityFactor(field,options);
 return density>0&&randomPresence<=density;
}
function createInstance(input){
 const E=root.SphereInstancedEnvironment;
 return E?E.createInstance(input):{...input,prototypeId:input.prototypeId||input.prototype,id:input.prototypeId||input.prototype,origin:input.origin.slice(),quaternion:quaternion(input.quaternion),scale:input.scale,colour:input.colour,phase:input.phase,seed:input.seed,boundsRadius:input.boundsRadius||1,addressKey:input.addressKey};
}

function buildPatch(input){
 const state=input.state||{},request=input.request||input,frame=input.frame||request.frame||frameForState(state),cell=T.validateCell(request.cell||request.address),meta=metadata(state),seed=meta.worldSeed,patchAddress=request.address||addressForCell(cell,state),patchId=patchKey(cell),centreQ=A.direction(patchAddress),axes=shellFrame(centreQ),radius=frame.radius,rootsPerSubcell=Math.max(1,Math.floor(input.rootsPerSubcell??state.grass?.rootsPerSubcell??DEFAULT_ROOTS)),instances=[],roots=[];
 const terrainAt=(q,p,field)=>terrainHeight({state,frame,input,terrainHeight:input.terrainHeight},q,p,field);
 for(let sz=0;sz<SUBCELLS;sz++)for(let sx=0;sx<SUBCELLS;sx++)for(let i=0;i<rootsPerSubcell;i++){
  const subKey=`${patchId}/s${sx}.${sz}/r${i}`,rx=random(seed,'position-x',subKey),rz=random(seed,'position-z',subKey),offsetX=((sx+rx)/SUBCELLS-.5)*PATCH_SIZE,offsetZ=((sz+rz)/SUBCELLS-.5)*PATCH_SIZE;
  const surface=add(mul(centreQ,radius),add(mul(axes.east,offsetX),mul(axes.north,offsetZ))),q=norm(surface),address=A.shell({...meta,direction:q,level:ROOT_LEVEL}),field=semanticAt(q,state);
  if(!eligible(field,random(seed,'presence',subKey),input))continue;
  const flat=local(frame,mul(q,radius));
  const height=Math.max(.00001,terrainAt(q,flat,field)),epsilon=.0001;
  const hx=terrainAt(q,[flat[0]+epsilon,0,flat[2]],field),hz=terrainAt(q,[flat[0],0,flat[2]+epsilon],field);
  const normal=norm([-(hx-height)/epsilon,1,-(hz-height)/epsilon]);
  // Connected-ground units are kilometres: meadow blades are approximately
  // 0.35–1.1 metres tall, not 35–110 metres.
  const yaw=random(seed,'yaw',subKey)*Math.PI*2,heightScale=.00035+random(seed,'height',subKey)*.00075;
  const colourClass=Math.min(2,Math.floor(random(seed,'colour',subKey)*3)),widthClass=Math.min(2,Math.floor(random(seed,'width',subKey)*3));
  // The Observatory's inhabited surface is the *inner* side of the shell.
  // Positive terrain height therefore moves toward the centre, which is
  // positive local-up in this frame.  Keeping this convention here makes
  // roots, patch bounds, connected ground and Watershed agree.
  const prototypeId=`grass-blade-${widthClass}`,phase=random(seed,'wind-phase',subKey),rootWorld=mul(q,radius-height),origin=local(frame,rootWorld),addressKey=A.stringify(address);
  const instance=createInstance({prototypeId,origin,worldOrigin:rootWorld,address,addressKey,geography:field,featureId:field.featureIds?.vegetation??null,quaternion:orient(normal,yaw),scale:heightScale,colour:[[.22,.47,.18,1],[.31,.58,.22,1],[.42,.64,.25,1]][colourClass],phase,seed:uint32(seed,'instance-seed',subKey),boundsRadius:heightScale});
  instances.push(instance);roots.push({key:addressKey,subcell:[sx,sz],root:i,field,worldOrigin:rootWorld,localOrigin:origin,height:height,normal,prototypeId,colourClass,widthClass,phase});
 }
 const centreField=semanticAt(centreQ,state),centreFlat=local(frame,mul(centreQ,radius)),centreHeight=Math.max(.00001,terrainAt(centreQ,centreFlat,centreField));
 const E=root.SphereInstancedEnvironment,packed=E?.packInstances?E.packInstances(instances):null,center=local(frame,mul(centreQ,radius-centreHeight));
 return {id:patchId,key:patchId,address:patchAddress,cell,center,radius:PATCH_SIZE*.8,instances,roots,instanceBuffer:packed,instanceBytes:packed?.byteLength||instances.length*32,revision:2,coordinateSpace:'relative',geographyRevision:meta.geographyRevision,terrainRevision:meta.terrainRevision};
}

function meadowCellForChart(x,z){
 const ecology=root.SphereMeadowEcology;if(!ecology||!Number.isFinite(x)||!Number.isFinite(z))return null;
 const half=ecology.DOMAIN.half;if(x< -half||x>=half||z< -half||z>=half)return null;
 return {x:Math.floor((x+half)/MEADOW_CELL_SIZE_METRES),z:Math.floor((z+half)/MEADOW_CELL_SIZE_METRES),size:MEADOW_CELL_SIZE_METRES};
}
function meadowCellBounds(cell){const half=root.SphereMeadowEcology.DOMAIN.half;return {x0:-half+cell.x*cell.size,z0:-half+cell.z*cell.size,x1:-half+(cell.x+1)*cell.size,z1:-half+(cell.z+1)*cell.size};}
function meadowCellKey(cell,state){
 const m=state.meadow||{},meta=metadata(state),ecology=root.SphereMeadowEcology;
 return ['meadow-cell',m.profileId||ecology?.PROFILE_ID,m.coverageId||ecology?.COVERAGE_ID,`r${m.representationRevision??3}`,`p${m.placementRevision??1}`,`rr${RESIDENT_RESOURCE_REVISION}`,`s${m.seed??meta.worldSeed}`,`w${meta.worldSeed}`,`g${meta.geographyRevision}`,`t${meta.terrainRevision}`,`su${root.SphereMeadowSupport?.REVISION??1}`,`a${meta.artRevision}.${meta.assetRevision}`,`h${meta.heroRevision??'none'}`,`e${m.ecologicalRevision??1}`,`v${m.appearanceRevision??1}`,...(m.appearanceRevision>=3?[`c${m.canopyRevision}`,`ma${m.materialRevision}`]:[]),`d${m.densityBladesPerM2??250}.${m.density??1}`,`${cell.x},${cell.z}`].join(':');
}
function meadowCellRequests(state,cameraChart,radiusMetres=MEADOW_DETAIL_RADIUS_METRES){
 const Ecology=root.SphereMeadowEcology;if(!Ecology||!Number.isFinite(cameraChart?.[0])||!Number.isFinite(cameraChart?.[1]))return [];
 const half=Ecology.DOMAIN.half,count=Math.round(Ecology.DOMAIN.size/MEADOW_CELL_SIZE_METRES),out=[];
 const x0=Math.max(0,Math.floor((cameraChart[0]-radiusMetres+half)/MEADOW_CELL_SIZE_METRES)),x1=Math.min(count-1,Math.floor((cameraChart[0]+radiusMetres+half)/MEADOW_CELL_SIZE_METRES));
 const z0=Math.max(0,Math.floor((cameraChart[1]-radiusMetres+half)/MEADOW_CELL_SIZE_METRES)),z1=Math.min(count-1,Math.floor((cameraChart[1]+radiusMetres+half)/MEADOW_CELL_SIZE_METRES));
 for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
  const cell={x,z,size:MEADOW_CELL_SIZE_METRES},b=meadowCellBounds(cell),dx=Math.max(b.x0-cameraChart[0],0,cameraChart[0]-b.x1),dz=Math.max(b.z0-cameraChart[1],0,cameraChart[1]-b.z1);
  if(Math.hypot(dx,dz)>radiusMetres+1e-9)continue;
  cell.key=meadowCellKey(cell,state);cell.chartBounds=[b.x0,b.z0,b.x1,b.z1];out.push(cell);
 }
 return out.sort((a,b)=>{const ca=meadowCellBounds(a),cb=meadowCellBounds(b),da=Math.hypot((ca.x0+ca.x1)*.5-cameraChart[0],(ca.z0+ca.z1)*.5-cameraChart[1]),db=Math.hypot((cb.x0+cb.x1)*.5-cameraChart[0],(cb.z0+cb.z1)*.5-cameraChart[1]);return da-db||a.key.localeCompare(b.key);});
}
function meadowSemantic(q,state){
 const base=G?.query?G.query(q,{state,representation:'walking',ecology:false}):null;
 return root.SphereMeadowEcology?.active?.(state)?root.SphereMeadowEcology.query(q,state,{base,representation:'walking'}):base;
}
function buildMeadowCell(input){
 const state=input.state||{},m=state.meadow||{},Ecology=root.SphereMeadowEcology,Support=root.SphereMeadowSupport;
 if(!Ecology||!Support)throw Error('The fixed Meadow chart and shared terrain support must load before placement revision 2');
 if(m.placementRevision!==2||!Ecology.active(state))throw Error('Metre-scale meadow placement requires explicit placement revision 2');
 const cell=input.cell&&Number.isInteger(input.cell.x)&&Number.isInteger(input.cell.z)&&input.cell.x>=0&&input.cell.z>=0&&input.cell.x<32&&input.cell.z<32?{x:input.cell.x,z:input.cell.z,size:MEADOW_CELL_SIZE_METRES}:null;
 if(!cell)throw Error('Meadow cell is outside the fixed half-open chart');
 cell.key=input.cell.key||meadowCellKey(cell,state);const b=meadowCellBounds(cell);cell.chartBounds=input.cell.chartBounds||[b.x0,b.z0,b.x1,b.z1];
 const frame=input.frame||framePlain(frameForState(state)),seed=Math.floor(m.seed??metadata(state).worldSeed),targetDensity=Math.max(0,Number(m.densityBladesPerM2??250)*Number(m.density??1)),bladesPerRoot=MEADOW_BLADES_PER_ROOT;
 const area=input.parentArea||Support.measureCell(state,cell,{steps:Math.max(4,Math.floor(input.areaSteps??16)),surfaceSupport:input.surfaceSupport});
 const chartAreaM2=cell.size*cell.size,candidateCount=Math.round(chartAreaM2*MEADOW_CANDIDATE_POOL_ROOTS_PER_M2),columns=Math.ceil(Math.sqrt(candidateCount)),rows=Math.ceil(candidateCount/columns),instances=[],roots=[];
 const frameLocal=worldPoint=>{const delta=sub(worldPoint,frame.origin);return frame.basis.map(axis=>dot(delta,axis));};
 const surface=(x,z)=>Support.query(state,x,z,{surfaceSupport:input.surfaceSupport});
 const semantic=q=>typeof input.semanticQuery==='function'?input.semanticQuery(q,state):meadowSemantic(q,state);
 const idPrefix=`root:${m.profileId}:${m.coverageId}:p${m.placementRevision}:seed${seed}:chart-open-meadow:${cell.x},${cell.z}:candidate:`;
 // HR-02 visits the original parent lattice within the requested rectangle.
 // Child blades stay with their root even when their support crosses its edge.
 const cb=input.candidateBounds||[b.x0,b.z0,b.x1,b.z1],sink=input.instanceSink,sampleRandom=input.generationSampler?.random||random,sampleUint32=input.generationSampler?.uint32||uint32;
 if(cb.length!==4||!cb.every(Number.isFinite)||cb[0]<b.x0||cb[1]<b.z0||cb[2]>b.x1||cb[3]>b.z1||cb[0]>=cb[2]||cb[1]>=cb[3])throw Error('Invalid Meadow candidate rectangle');
 const ix0=Math.max(0,Math.floor((cb[0]-b.x0)/cell.size*columns)),ix1=Math.min(columns,Math.ceil((cb[2]-b.x0)/cell.size*columns)),iz0=Math.max(0,Math.floor((cb[1]-b.z0)/cell.size*rows)),iz1=Math.min(rows,Math.ceil((cb[3]-b.z0)/cell.size*rows));
 let visitedCandidates=0,streamedRoots=0,streamedBlades=0;
 for(let iz=iz0;iz<iz1;iz++)for(let ix=ix0;ix<ix1;ix++){const candidate=iz*columns+ix;visitedCandidates++;
  const rootId=idPrefix+candidate,rx=sampleRandom(seed,'meadow-candidate-x',rootId),rz=sampleRandom(seed,'meadow-candidate-z',rootId),cx=-Ecology.DOMAIN.half+cell.x*MEADOW_CELL_SIZE_METRES+(ix+.15+rx*.7)/columns*MEADOW_CELL_SIZE_METRES,cz=-Ecology.DOMAIN.half+cell.z*MEADOW_CELL_SIZE_METRES+(iz+.15+rz*.7)/rows*MEADOW_CELL_SIZE_METRES;
  if(cx<cb[0]||cx>=cb[2]||cz<cb[1]||cz>=cb[3])continue;
  const rootSupport=surface(cx,cz);if(!rootSupport)continue;
  const rootField=semantic(rootSupport.direction),rootEcology=rootField?.ecology;if(!rootEcology?.eligibleArea||!(rootEcology.grassDensityBladesPerM2>0))continue;
  const acceptance=clamp(rootEcology.grassDensityBladesPerM2*Number(m.density??1)*area.surfaceAreaM2/(bladesPerRoot*MEADOW_CANDIDATE_POOL_ROOTS_PER_M2*chartAreaM2));if(sampleRandom(seed,'meadow-density',rootId)>acceptance)continue;
  const bladeIds=[];let rootHeight=0;
  for(let blade=0;blade<bladesPerRoot;blade++){
   const bladeId=`${rootId}:blade:${blade}`,angle=sampleRandom(seed,'meadow-blade-angle',bladeId)*Math.PI*2,radial=Math.sqrt(sampleRandom(seed,'meadow-blade-radius',bladeId))*MEADOW_CHILD_SPREAD_METRES,bx=cx+Math.cos(angle)*radial,bz=cz+Math.sin(angle)*radial;
   if(Math.abs(bx)>=Ecology.DOMAIN.half||Math.abs(bz)>=Ecology.DOMAIN.half)continue;
   const support=surface(bx,bz);if(!support)continue;
   const field=semantic(support.direction),ecology=field?.ecology;if(!ecology?.eligibleArea)continue;
   const botanical=m.appearanceRevision>=MEADOW_ART_APPEARANCE_REVISION,
    yaw=sampleRandom(seed,botanical?'meadow-art-v2-yaw':'meadow-yaw',bladeId)*Math.PI*2,
    height=.00035+Math.pow(sampleRandom(seed,botanical?'meadow-art-v2-height':'meadow-height',bladeId),botanical?1.7:1)*(.0011-.00035),
    widthRoll=sampleRandom(seed,botanical?'meadow-art-v2-width':'meadow-width',bladeId),widthClass=botanical?(widthRoll<.46?0:widthRoll<.9?1:2):Math.min(2,Math.floor(widthRoll*3)),
    colourClass=Math.min(2,Math.floor(sampleRandom(seed,'meadow-colour',bladeId)*3)),phase=sampleRandom(seed,'meadow-wind-phase',bladeId),localNormal=frame.basis.map(axis=>dot(support.normal,axis)),origin=frameLocal(support.point),
    leanAngle=botanical ? .035+sampleRandom(seed,'meadow-art-v2-lean',bladeId)*.205 : 0,leanAzimuth=botanical?sampleRandom(seed,'meadow-art-v2-lean-direction',bladeId)*Math.PI*2:0,
    bladeNormal=botanical?leanedNormal(localNormal,leanAzimuth,leanAngle):localNormal,
    boundsRadius=botanical?height*MAX_GRASS_PROTOTYPE_RADIUS_FACTOR+height*MAX_WIND_BEND_FRACTION+MEADOW_CHILD_SPREAD_METRES*.001+.000006:height*.75+height*MAX_WIND_BEND_FRACTION+MEADOW_CHILD_SPREAD_METRES*.001+.000006;
   const instance=createInstance({prototypeId:botanical?`meadow-tapered-ribbon-v2-${widthClass}`:`grass-blade-${widthClass}`,origin,worldOrigin:support.point,addressKey:bladeId,quaternion:orient(bladeNormal,yaw),scale:height,colour:[[.22,.47,.18,1],[.31,.58,.22,1],[.42,.64,.25,1]][colourClass],phase,seed:sampleUint32(seed,'meadow-blade-seed',bladeId),boundsRadius});
   instance.id=bladeId;instance.rootId=rootId;instance.bladeNumber=blade;instance.placementRevision=2;instance.chart=[bx,bz];instance.supportSource=support.source;
   if(sink)sink(instance,[cx,cz]);else instances.push(instance);streamedBlades++;bladeIds.push(bladeId);rootHeight=Math.max(rootHeight,height);
  }
  if(bladeIds.length){streamedRoots++;if(!sink||input.rootSink){const item={id:rootId,key:rootId,candidate,cell:[cell.x,cell.z],chart:[cx,cz],worldOrigin:rootSupport.point.slice(),localOrigin:frameLocal(rootSupport.point),supportSource:rootSupport.source,field:rootField,bladeIds,height:rootHeight};if(sink)input.rootSink(item);else roots.push(item);}}
 }
 if(sink)return {candidateCount,visitedCandidates,rootCount:streamedRoots,bladeCount:streamedBlades,areaEstimate:area};
 const bounds=meadowCellBounds(cell),centerSupport=surface((bounds.x0+bounds.x1)*.5,(bounds.z0+bounds.z1)*.5);if(!centerSupport)throw Error('The logical Meadow cell has no rendered/collision support at its centre');
 const center=frameLocal(centerSupport.point),geometricFloor=Math.hypot(cell.size*.5,cell.size*.5)*.001+.00002,maxOffset=instances.reduce((v,i)=>Math.max(v,length(sub(i.origin,center))+i.boundsRadius),geometricFloor),packed=root.SphereInstancedEnvironment?.packInstances(instances)||null;
 return {id:cell.key,key:cell.key,cell:{x:cell.x,z:cell.z,size:cell.size},center,centerWorld:centerSupport.point.slice(),boundsRadius:maxOffset,instances,roots,instanceBuffer:packed,instanceBytes:packed?.byteLength||instances.length*32,revision:2,placementRevision:2,candidateCount,samplingColumns:columns,samplingRows:rows,coordinateSpace:'relative',surfaceAreaM2:area.surfaceAreaM2,eligibleAreaM2:area.eligibleAreaM2,areaEstimate:area,requestedDensityBladesPerM2:targetDensity,rootCount:roots.length,bladeCount:instances.length,rootSupportErrorMetres:0,supportSources:[...new Set(instances.map(i=>i.supportSource))]};
}
function materializeMeadowCell(patch,frame){
 const toLocal=point=>{const delta=sub(point,frame.origin);return frame.basis.map(axis=>dot(delta,axis));},instances=patch.instances.map(source=>{const instance=createInstance({...source,origin:toLocal(source.worldOrigin),worldOrigin:source.worldOrigin});instance.id=source.id;instance.rootId=source.rootId;instance.bladeNumber=source.bladeNumber;instance.placementRevision=source.placementRevision;instance.chart=source.chart;instance.supportSource=source.supportSource;return instance;}),center=toLocal(patch.centerWorld),packed=root.SphereInstancedEnvironment?.packInstances(instances)||null;
 return {...patch,center,instances,instanceBuffer:packed,instanceBytes:packed?.byteLength||instances.length*32,coordinateSpace:'relative'};
}
function byteHash(bytes){let h=2166136261>>>0;for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,16777619);}return `${bytes.length}:${(h>>>0).toString(16).padStart(8,'0')}`;}
function prepareResidentCell(patch,{releaseSource=false,releasePlacementObjects=false}={}){
 if(patch.residentResourceRevision===RESIDENT_RESOURCE_REVISION&&patch.residentBuffer){if(releaseSource)patch.instanceBuffer=null;if(releasePlacementObjects){patch.instances=null;patch.roots=null;}return patch;}
 const E=root.SphereInstancedEnvironment;if(!E?.packInstances)throw Error('Instanced environment packing is required for resident Meadow cells');
 const source=patch.instanceBuffer||E.packInstances(patch.instances),groupsById=new Map();
 for(const instance of patch.instances){instance.boundsRadius=instance.scale*(patch.prototypeRadiusFactor||MAX_GRASS_PROTOTYPE_RADIUS_FACTOR)+instance.scale*MAX_WIND_BEND_FRACTION+MEADOW_CHILD_SPREAD_METRES*.001+.000006;patch.boundsRadius=Math.max(patch.boundsRadius,length(sub(instance.origin,patch.center))+instance.boundsRadius);groupsById.set(instance.prototypeId,(groupsById.get(instance.prototypeId)||0)+1);}
 if(patch.instances.length)patch.boundsRadius+=RESIDENT_CELL_BOUND_PADDING_KM;
 const ids=[...groupsById.keys()].sort(),offsets=new Map();let byteOffset=0;
 for(const id of ids){const count=groupsById.get(id);offsets.set(id,{byteOffset,count,cursor:byteOffset});byteOffset+=count*E.STRIDE;}
 const residentBuffer=new Uint8Array(byteOffset),sourceBytes=new Uint8Array(source.buffer,source.byteOffset,source.byteLength);
 for(let i=0;i<patch.instances.length;i++){
  const target=offsets.get(patch.instances[i].prototypeId),from=i*E.STRIDE,to=target.cursor;
  for(let b=0;b<E.STRIDE;b++)residentBuffer[to+b]=sourceBytes[from+b];target.cursor+=E.STRIDE;
 }
 const groups=ids.map(id=>{const g=offsets.get(id);return Object.freeze({prototypeId:id,byteOffset:g.byteOffset,byteLength:g.count*E.STRIDE,count:g.count});});
 let minimumInstanceBoundMarginKm=Infinity,minimumCellCullingMarginKm=Infinity,maximumPrototypeEnvelopeKm=0,maximumWindBendKm=0,maximumChildOffsetKm=0,maximumInstanceScale=0;
 const rootsById=new Map((patch.roots||[]).map(item=>[item.id,item]));
 for(const instance of patch.instances){
  const envelope=instance.scale*(patch.prototypeRadiusFactor||MAX_GRASS_PROTOTYPE_RADIUS_FACTOR),bend=instance.scale*MAX_WIND_BEND_FRACTION,child=MEADOW_CHILD_SPREAD_METRES*.001,required=envelope+bend+child;
  minimumInstanceBoundMarginKm=Math.min(minimumInstanceBoundMarginKm,instance.boundsRadius-required);maximumPrototypeEnvelopeKm=Math.max(maximumPrototypeEnvelopeKm,envelope);maximumWindBendKm=Math.max(maximumWindBendKm,bend);maximumInstanceScale=Math.max(maximumInstanceScale,instance.scale);
  minimumCellCullingMarginKm=Math.min(minimumCellCullingMarginKm,patch.boundsRadius-length(sub(instance.origin,patch.center))-instance.boundsRadius);
  const parent=rootsById.get(instance.rootId);if(parent?.worldOrigin&&instance.worldOrigin)maximumChildOffsetKm=Math.max(maximumChildOffsetKm,length(sub(instance.worldOrigin,parent.worldOrigin)));
 }
 if(!Number.isFinite(minimumInstanceBoundMarginKm))minimumInstanceBoundMarginKm=0;
 if(!Number.isFinite(minimumCellCullingMarginKm))minimumCellCullingMarginKm=0;
 patch.residentStats=Object.freeze({rootCount:patch.rootCount||0,bladeCount:patch.bladeCount||0,minimumInstanceBoundMarginKm,minimumCellCullingMarginKm,maximumPrototypeEnvelopeKm,maximumWindBendKm,maximumChildOffsetKm,maximumInstanceScale});
 const geometryKey=[RESIDENT_RESOURCE_REVISION,patch.key,patch.placementRevision,patch.center.map(v=>Number(v).toPrecision(16)).join(','),Number(patch.boundsRadius).toPrecision(16),groups.map(g=>`${g.prototypeId}:${g.count}`).join('|')].join(';');
 patch.residentBuffer=residentBuffer;patch.residentGroups=Object.freeze(groups);patch.residentResourceRevision=RESIDENT_RESOURCE_REVISION;patch.residentContentHash=`${hashString(geometryKey).toString(16).padStart(8,'0')}:${byteHash(residentBuffer)}`;patch.residentBytes=residentBuffer.byteLength;
 if(releaseSource)patch.instanceBuffer=null;
 if(releasePlacementObjects){patch.instances=null;patch.roots=null;}
 return patch;
}
function residentNow(){return typeof performance!=='undefined'?performance.now():Date.now();}
class FixedChartGrassManager{
 constructor(options={}){this.options={worker:options.worker!==false,boundedPreparation:false,maxPrepareCellsPerFrame:1,...options};this.cache=new Map();this.queue=[];this.worker=null;this.generation=0;this.disposed=0;this.cancelled=0;this.uploaded=0;this.lastState=null;this.signature='';this.inflight=null;this.targetCells=[];this.targetMask=new Uint8Array(32*32);this.nextMask=new Uint8Array(32*32);this.targetKeySet=new Set();this.targetSignature='';this.activeSignature='';this.activeKeys=new Set();this.activePatches=[];this.pendingPatches=[];this.cameraLocal=new Float32Array(3);this.residentFrame=null;this.residentFrameKey='';this.residentPopulation=null;this.residentHash='';this.residentHashRecomputes=0;this.residentPopulationAllocations=0;this.residentContentKey='';this.lastPreparedCellsPerRequest=0;this.maxPreparedCellsPerRequest=0;this.maxCellPrepareMs=0;this.maxWorkerPrepareMs=0;this.workerPreparationJobs=0;this.maxWorkerJobsInFlight=0;this.workerErrors=0;this.lastWorkerError='';this.preparedCells=0;this.preparedBytes=0;this.staleCompletions=0;this.peakCacheCells=0;}
 request(state,{frame=null,radiusMetres=MEADOW_DETAIL_RADIUS_METRES}={}){
  if(this.options.boundedPreparation)return this.requestBounded(state,{frame,radiusMetres});
  this.lastState=state;frame=frame||frameForState(state);const chart=root.SphereMeadowEcology.chartCoordinates(state,norm(state.position)),cells=meadowCellRequests(state,chart,radiusMetres),wanted=new Set(cells.map(c=>c.key));
  for(const key of this.cache.keys())if(!wanted.has(key)){this.cache.delete(key);this.disposed++;}
  const missing=cells.filter(c=>!this.cache.has(c.key)),signature=[...wanted].sort().join('|');
  if(signature!==this.signature||(missing.length&&!this.queue.length)){if(this.queue.length)this.cancelled+=this.queue.length;this.signature=signature;this.generation++;this.queue=missing.map(cell=>({cell,state:JSON.parse(JSON.stringify(state)),frame:framePlain(frame)}));if(this.options.worker!==false&&typeof Worker!=='undefined')this.startWorker();else this.buildSynchronously();}
  const patches=cells.filter(cell=>this.cache.has(cell.key)).map(cell=>materializeMeadowCell(this.cache.get(cell.key),frame));
  const cameraSupport=root.SphereMeadowSupport.camera(state,state.position),cameraPoint=cameraSupport?.point||null;
  return {patches,cells,chart,cameraPoint,cameraSupport,frameBasis:frame.basis.map(axis=>axis.slice()),coordinateSpace:'relative',placementRevision:2,queue:this.queue.length,signature:this.signature};
 }
 buildSynchronously(){if(this.options.boundedPreparation)return this.buildBoundedSynchronously();while(this.queue.length){const job=this.queue.shift(),patch=buildMeadowCell({state:job.state,cell:job.cell,frame:job.frame,areaSteps:this.options.areaSteps});this.cache.set(patch.key,patch);this.uploaded+=patch.instanceBytes;}}
 startWorker(){if(!this.worker){try{this.worker=new Worker(this.options.workerUrl||(this.options.boundedPreparation?'grass-worker.js?ib075f=canopy-1':'grass-worker.js?ib075c=metre-ownership-2'));this.worker.onmessage=({data})=>this.receive(data);this.worker.onerror=()=>{if(this.options.boundedPreparation)this.workerFailed();else{this.worker=null;this.buildSynchronously();}};}catch{this.worker=null;this.buildSynchronously();return;}}this.postNext();}
 postNext(){if(this.options.boundedPreparation)return this.postNextBounded();if(!this.queue.length||!this.worker)return;const job=this.queue[0];this.worker.postMessage({kind:'meadow-cell-v2',generation:this.generation,state:job.state,cell:job.cell,frame:job.frame,areaSteps:this.options.areaSteps});}
 receive(data){if(this.options.boundedPreparation)return this.receiveBounded(data);if(data.generation!==this.generation)return;if(data.error){this.worker=null;this.buildSynchronously();return;}const job=this.queue.shift();if(data.patch&&(!job||data.patch.key===job.cell.key)){this.cache.set(data.patch.key,data.patch);this.uploaded+=data.patch.instanceBytes||0;}this.postNext();}
 requestBounded(state,{frame=null,radiusMetres=MEADOW_DETAIL_RADIUS_METRES}={}){
  const requestStarted=residentNow();
  this.lastState=state;this.lastPreparedCellsPerRequest=0;const ecology=root.SphereMeadowEcology,m=state?.meadow||{},chart=ecology.chartCoordinates(state,norm(state.position)),radius=Math.max(0,Number(radiusMetres)||0),canopy=root.SphereMeadowCanopy?.active(state),detailRadius=canopy?root.SphereMeadowCanopy.contractFor(state).detailRadiusMetres:radius,half=ecology.DOMAIN.half,size=MEADOW_CELL_SIZE_METRES,count=32;
  const frameKey=JSON.stringify([m.anchor||ecology.DOMAIN.anchor,state.radius,state.provinceAnchor]);
  if(this.residentFrameKey!==frameKey){this.residentFrame=frame||frameForMeadowChart(state);this.residentFrameKey=frameKey;}
  // Retained F resources cover a whole 8 m camera cell. Root LOD still uses
  // the actual camera in the shader; motion inside this cell changes uniforms.
  let requestChart=chart;if(canopy){const previous=this.canopyRequestCenter;if(!previous||Math.abs(chart[0]-previous[0])>size*.5+.10||Math.abs(chart[1]-previous[1])>size*.5+.10)this.canopyRequestCenter=chart.map(v=>Math.floor((v+half+.0001)/size)*size-half+size*.5);requestChart=this.canopyRequestCenter;}const requestMargin=canopy&&radius>=detailRadius?size/Math.SQRT2+.10:0;
  frame=this.residentFrame;this.nextMask.fill(0);const heightMetres=canopy?Math.abs((root.SphereMeadowSupport.camera(state,state.position)?.cameraHeightKm||0)*1000):0,verticalDistance=canopy?Math.max(0,heightMetres-1.9):0;
  if(Number.isFinite(chart[0])&&Number.isFinite(chart[1])){
   const extent=radius+requestMargin,x0=Math.max(0,Math.floor((requestChart[0]-extent+half)/size)),x1=Math.min(count-1,Math.floor((requestChart[0]+extent+half)/size)),z0=Math.max(0,Math.floor((requestChart[1]-extent+half)/size)),z1=Math.min(count-1,Math.floor((requestChart[1]+extent+half)/size));
   for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const x0m=-half+x*size,z0m=-half+z*size,dx=Math.max(x0m-requestChart[0],0,requestChart[0]-(x0m+size)),dz=Math.max(z0m-requestChart[1],0,requestChart[1]-(z0m+size)),distance=Math.hypot(dx,dz,verticalDistance);if(distance<=radius+requestMargin+1e-9)this.nextMask[z*count+x]=canopy&&distance>detailRadius+requestMargin?2:1;}
  }
  const steps=Math.max(4,Math.floor(this.options.areaSteps??16)),contentKey=JSON.stringify([radius,steps,m.anchor||ecology.DOMAIN.anchor,m.profileId,m.coverageId,m.representationRevision,m.placementRevision,m.seed,m.density,m.densityBladesPerM2,m.ecologicalRevision,m.appearanceRevision,m.canopyRevision,m.materialRevision,state.worldSeed??state.seed,state.geographyRevision,state.terrainRevision,state.artRevision,state.assetRevision,state.heroRevision,root.SphereMeadowSupport?.REVISION??1,state.provinceAnchor,state.radius]);
  let changed=contentKey!==this.residentContentKey;
  for(let i=0;i<this.nextMask.length&&!changed;i++)if(this.nextMask[i]!==this.targetMask[i])changed=true;
  if(changed){
   const previousTarget=this.targetSignature;this.residentContentKey=contentKey;this.targetMask.set(this.nextMask);this.targetCells=[];this.targetKeySet.clear();
   for(let z=0;z<count;z++)for(let x=0;x<count;x++)if(this.targetMask[z*count+x]){const b=meadowCellBounds({x,z,size}),cell={x,z,size,canopyTier:canopy?(this.targetMask[z*count+x]===2?'clump':'detail'):null,key:`${meadowCellKey({x,z},state)}:q${steps}${canopy?':f'+m.canopyRevision+':'+(this.targetMask[z*count+x]===2?'clump':'detail'):''}`,chartBounds:[b.x0,b.z0,b.x1,b.z1]};this.targetCells.push(cell);this.targetKeySet.add(cell.key);}
   this.targetCells.sort((a,b)=>{const da=Math.hypot((a.chartBounds[0]+a.chartBounds[2])*.5-chart[0],(a.chartBounds[1]+a.chartBounds[3])*.5-chart[1]),db=Math.hypot((b.chartBounds[0]+b.chartBounds[2])*.5-chart[0],(b.chartBounds[1]+b.chartBounds[3])*.5-chart[1]);return da-db||a.key.localeCompare(b.key);});
   this.targetSignature=`${this.residentContentKey}#${this.targetCells.map(cell=>cell.key).sort().join('|')}`;
   if(previousTarget&&previousTarget!==this.targetSignature){this.cancelled+=this.queue.length;if(this.inflight&&!this.inflight.cancelCounted){this.cancelled++;this.inflight.cancelCounted=true;}}
   this.generation++;this.queue=[];
   for(const cell of this.targetCells)if(!this.cache.has(cell.key))this.queue.push({cell,state:JSON.parse(JSON.stringify(state)),frame:framePlain(frame),areaSteps:steps,generation:this.generation,queuedAt:residentNow()});
   this.refreshPresentation();
  }
  if(this.options.worker!==false&&typeof Worker!=='undefined'){this.startWorker();this.postNextBounded();}
  else this.buildBoundedSynchronously();
  const position=state.position||frame.origin,dx=position[0]-frame.origin[0],dy=position[1]-frame.origin[1],dz=position[2]-frame.origin[2],basis=frame.basis;
  this.cameraLocal[0]=dx*basis[0][0]+dy*basis[0][1]+dz*basis[0][2];this.cameraLocal[1]=dx*basis[1][0]+dy*basis[1][1]+dz*basis[1][2];this.cameraLocal[2]=dx*basis[2][0]+dy*basis[2][1]+dz*basis[2][2];
  if(!this.residentPopulation){this.residentPopulation={patches:this.activePatches,residentCells:this.activePatches,pendingResidentCells:this.pendingPatches,frameBasis:basis,cameraLocal:this.cameraLocal,coordinateSpace:'resident-chart',placementRevision:2,residentResourceRevision:RESIDENT_RESOURCE_REVISION};this.residentPopulationAllocations++;}
  this.residentPopulation.patches=this.activePatches;this.residentPopulation.residentCells=this.activePatches;this.residentPopulation.pendingResidentCells=this.pendingPatches;this.residentPopulation.frameBasis=basis;this.residentPopulation.cameraLocal=this.cameraLocal;this.residentPopulation.expectedPendingCellCount=this.activeSignature===this.targetSignature?0:this.targetCells.length;this.residentPopulation.residentTargetSignature=this.activeSignature===this.targetSignature?null:this.targetSignature;this.residentPopulation.queue=this.queue.length+(this.inflight&&this.inflight.generation===this.generation?1:0);
  this.lastRequestCpuMs=residentNow()-requestStarted;
  return {patches:this.activePatches,cells:this.targetCells,chart,cameraLocal:this.cameraLocal,frameBasis:basis,coordinateSpace:'resident-chart',placementRevision:2,queue:this.residentPopulation.queue,signature:this.targetSignature,population:this.residentPopulation};
 }
 refreshPresentation(){
  this.activePatches.length=0;for(const key of this.activeKeys){const patch=this.cache.get(key);if(patch)this.activePatches.push(patch);}
  this.pendingPatches.length=0;if(this.activeSignature!==this.targetSignature)for(const cell of this.targetCells){const patch=this.cache.get(cell.key);if(patch)this.pendingPatches.push(patch);}
  this.refreshResidentHash();
 }
 refreshResidentHash(){const patches=[...this.cache.values()].sort((a,b)=>a.key.localeCompare(b.key));this.residentHash=hashHex(...patches.flatMap(p=>[p.key,p.residentContentHash||'pending']));this.residentHashRecomputes++;this.peakCacheCells=Math.max(this.peakCacheCells,this.cache.size);}
 buildBoundedSynchronously(){
  const limit=Math.max(1,Math.floor(this.options.maxPrepareCellsPerFrame??1));let prepared=0;
  while(this.queue.length&&prepared<limit){const job=this.queue.shift(),started=typeof performance!=='undefined'?performance.now():Date.now(),patch=prepareResidentCell((root.SphereMeadowCanopy?.buildResidentCell||buildMeadowCell)({state:job.state,cell:job.cell,frame:job.frame,areaSteps:job.areaSteps}),{releaseSource:true,releasePlacementObjects:true}),elapsed=(typeof performance!=='undefined'?performance.now():Date.now())-started;this.cache.set(patch.key,patch);this.uploaded+=patch.residentBytes;this.preparedBytes+=patch.residentBytes;this.preparedCells++;this.maxCellPrepareMs=Math.max(this.maxCellPrepareMs,elapsed);prepared++;}
  this.lastPreparedCellsPerRequest=prepared;this.maxPreparedCellsPerRequest=Math.max(this.maxPreparedCellsPerRequest,prepared);if(prepared)this.refreshPresentation();
 }
 postNextBounded(){if(!this.worker||this.inflight||!this.queue.length)return;const job=this.queue.shift();job.generation=this.generation;this.inflight=job;this.workerPreparationJobs++;this.maxWorkerJobsInFlight=Math.max(this.maxWorkerJobsInFlight,1);this.worker.postMessage({kind:'meadow-cell-v2',resident:true,generation:job.generation,state:job.state,cell:job.cell,frame:job.frame,areaSteps:job.areaSteps});}
 receiveBounded(data){
  const receiveStarted=residentNow();try{return this.consumeBoundedPacket(data);}finally{this.receiveCpuMs=(this.receiveCpuMs||0)+residentNow()-receiveStarted;}
 }
 consumeBoundedPacket(data){
  const job=this.inflight;if(!job){this.staleCompletions++;return;}this.inflight=null;
  if(data.generation!==job.generation||job.generation!==this.generation||!this.targetKeySet.has(job.cell.key)){this.staleCompletions++;return;}
  if(data.error){this.workerErrors++;this.lastWorkerError=String(data.error);this.worker?.terminate();this.worker=null;this.queue.unshift(job);this.buildBoundedSynchronously();return;}
  if(!data.patch||data.patch.key!==job.cell.key){this.staleCompletions++;return;}
  const patch=prepareResidentCell(data.patch,{releaseSource:true,releasePlacementObjects:true});this.lastPreparedCellsPerRequest++;this.maxPreparedCellsPerRequest=Math.max(this.maxPreparedCellsPerRequest,this.lastPreparedCellsPerRequest);this.maxWorkerPrepareMs=Math.max(this.maxWorkerPrepareMs,Number(data.prepareMs)||0);this.maxCellPrepareMs=Math.max(this.maxCellPrepareMs,Number(data.prepareMs)||0);this.cache.set(patch.key,patch);this.uploaded+=patch.residentBytes;this.preparedBytes+=patch.residentBytes;this.preparedCells++;this.refreshPresentation();
  this.lastWorkerQueueLatencyMs=Number.isFinite(job.queuedAt)?residentNow()-job.queuedAt:null;this.lastWorkerPrepareMs=Number(data.prepareMs)||0;
 }
 workerFailed(){const job=this.inflight;this.worker?.terminate();this.worker=null;this.inflight=null;if(job&&job.generation===this.generation&&this.targetKeySet.has(job.cell.key))this.queue.unshift(job);this.buildBoundedSynchronously();}
 commitResident(signature){
  if(!signature||signature!==this.targetSignature||this.activeSignature===signature||this.pendingPatches.length!==this.targetCells.length)return false;
  this.activeKeys=new Set(this.targetCells.map(cell=>cell.key));this.activeSignature=signature;
  for(const key of this.cache.keys())if(!this.activeKeys.has(key)){this.cache.delete(key);this.disposed++;}
  this.refreshPresentation();return true;
 }
 hash(){return this.options.boundedPreparation?this.residentHash:hashHex(...[...this.cache.values()].sort((a,b)=>a.key.localeCompare(b.key)).flatMap(p=>p.roots.flatMap(r=>[r.key,r.candidate,r.bladeIds.join(',')])));}
 dispose(){this.worker?.terminate();this.worker=null;this.queue=[];this.cache.clear();this.activeKeys.clear();this.targetKeySet.clear();this.targetCells.length=0;this.activePatches.length=0;this.pendingPatches.length=0;this.inflight=null;this.residentPopulation=null;this.signature='';this.generation++;this.disposed++;this.refreshResidentHash();}
 get info(){const patches=[...this.cache.values()],typedBytes=patches.reduce((n,p)=>n+(this.options.boundedPreparation?(p.residentBytes||0):(p.instanceBytes||0)),0);return {cells:patches.length,queue:this.queue.length+(this.inflight&&this.inflight.generation===this.generation?1:0),roots:patches.reduce((n,p)=>n+p.rootCount,0),blades:patches.reduce((n,p)=>n+p.bladeCount,0),bytes:typedBytes,retainedTypedArrayBytes:typedBytes,disposed:this.disposed,cancelled:this.cancelled,uploaded:this.uploaded,preparedCells:this.preparedCells,preparedBytes:this.preparedBytes,lastPreparedCellsPerRequest:this.lastPreparedCellsPerRequest,maxPreparedCellsPerRequest:this.maxPreparedCellsPerRequest,maxCellPrepareMs:this.maxCellPrepareMs,maxWorkerPrepareMs:this.maxWorkerPrepareMs,workerPreparationJobs:this.workerPreparationJobs,maxWorkerJobsInFlight:this.maxWorkerJobsInFlight,workerErrors:this.workerErrors,lastWorkerError:this.lastWorkerError,staleCompletions:this.staleCompletions,peakCacheCells:this.peakCacheCells,residentHashRecomputes:this.residentHashRecomputes,residentPopulationAllocations:this.residentPopulationAllocations,worker:!!this.worker,hash:this.hash(),placementRevision:2,residentResourceRevision:RESIDENT_RESOURCE_REVISION};}
}

function bladeVertices(width){
 const w=width,normal=[0,0,1],crossNormal=[1,0,0];
 return [-w,0,0,...normal,w,0,0,...normal,w,1,0,...normal,-w,1,0,...normal,-w,0,0,...crossNormal,w,0,0,...crossNormal,w,1,0,...crossNormal,-w,1,0,...crossNormal];
}
function grassPrototypes(options={}){
 const E=root.SphereInstancedEnvironment;if(!E?.createPrototype)throw Error('Instanced environment pass is required before grass prototypes');
 return [0.45,.7,1].map((width,index)=>E.createPrototype({id:`grass-blade-${index}`,lods:[{vertices:bladeVertices(.0045*width),indices:[0,1,2,0,2,3,4,6,5,4,7,6]},{vertices:bladeVertices(.0045*width),indices:[0,1,2,0,2,3]}],lodDistances:[0,options.lodDistance??.045],alphaTest:true,wind:true,albedo:[.3,.58,.22,1]}));
}

function meadowBladeVertices(halfWidth,curvature,segments=MEADOW_BLADE_SEGMENTS){
 const vertices=[],indices=[],planes=[{across:[1,0,0]},{across:[0,0,1]}],tipWidth=.015;
 const emit=(position,normal)=>vertices.push(position[0],position[1],position[2],normal[0],normal[1],normal[2]);
 for(const {across} of planes){
  const rowOffsets=[];
  for(let side=0;side<2;side++){
   const sign=side===0?1:-1,row=[];
   for(let step=0;step<=segments;step++){
    const t=step/segments,taper=step===segments?tipWidth:Math.pow(1-t,1.2),centerX=curvature*(.25*t+.75*t*t),slope=curvature*(.25+1.5*t),center=[centerX,t,0],half=halfWidth*taper,normal=norm(cross(across,[slope,1,0]));
    for(const direction of [-1,1]){const position=add(center,mul(across,direction*half));emit(position,mul(normal,sign));row.push(vertices.length/6-1);}
   }
   rowOffsets.push(row);
  }
  const [front,back]=rowOffsets;
  for(let step=0;step<segments;step++){
   const fl=front[step*2],fr=front[step*2+1],fnextL=front[(step+1)*2],fnextR=front[(step+1)*2+1];
   indices.push(fl,fr,fnextR,fl,fnextR,fnextL);
   const bl=back[step*2],br=back[step*2+1],bnextL=back[(step+1)*2],bnextR=back[(step+1)*2+1];
   indices.push(bl,bnextR,br,bl,bnextL,bnextR);
  }
 }
 return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices),segments};
}
function meadowArtPrototypes(options={}){
 const E=root.SphereInstancedEnvironment;if(!E?.createPrototype)throw Error('Instanced environment pass is required before grass prototypes');
 if(options.appearanceRevision===1)return grassPrototypes(options);
 return MEADOW_BLADE_HALF_WIDTHS.map((halfWidth,index)=>{
  const shape=meadowBladeVertices(halfWidth,MEADOW_BLADE_CURVATURES[index]),id=`meadow-tapered-ribbon-v2-${index}`;
  return E.createPrototype({id,lods:[{vertices:shape.vertices,indices:shape.indices},{vertices:shape.vertices.slice(),indices:shape.indices.slice()}],lodDistances:[0,options.lodDistance??.045],alphaTest:true,wind:true,albedo:[.3,.58,.22,1]});
 });
}

class GrassStreamManager{
 constructor(options={}){this.options={radiusPatches:DEFAULT_RADIUS,rootsPerSubcell:DEFAULT_ROOTS,worker:options.worker!==false,...options};this.cache=new Map();this.queue=[];this.worker=null;this.generation=0;this.activeGeneration=0;this.disposed=0;this.cancelled=0;this.uploaded=0;this.lastState=null;this.lastPopulation=null;this.requestSignature='';}
 request(state){
  this.lastState=state;const frame=root.SphereGround?.frame&&root.SphereGround.enabled?.(state)?root.SphereGround.frame(state):frameForState(state),requests=patchRequests(state,frame,this.options),wanted=new Set(requests.map(r=>r.key));
  for(const key of this.cache.keys())if(!wanted.has(key)){this.cache.delete(key);this.disposed++;}
  const missing=requests.filter(r=>!this.cache.has(r.key));if(!missing.length)return this.population(state);
  const signature=[...wanted].sort().join('|')+'@'+frame.origin.map(v=>v.toPrecision(14)).join(',')+'@'+frame.basis.map(axis=>axis.map(v=>v.toPrecision(12)).join(',')).join(';');
  if(signature===this.requestSignature)return this.population(state);
  this.requestSignature=signature;this.generation++;this.activeGeneration=this.generation;this.queue=missing.map(request=>({request,state:JSON.parse(JSON.stringify(state)),frame:framePlain(frame)}));this.cancelled+=this.queue.length>1?0:0;
  if(this.options.worker!==false&&typeof Worker!=='undefined')this.startWorker();else this.buildSynchronously();
  return this.population(state);
 }
  buildSynchronously(){while(this.queue.length){const job=this.queue.shift();const patch=buildPatch({...job,rootsPerSubcell:this.options.rootsPerSubcell,density:this.options.density,terrainHeight:this.options.terrainHeight});this.cache.set(patch.key,patch);this.uploaded+=patch.instanceBytes;}}
 startWorker(){
  if(!this.worker){try{this.worker=new Worker(this.options.workerUrl||'grass-worker.js?ib070=scale-2');this.worker.onmessage=({data})=>this.receive(data);this.worker.onerror=()=>{this.worker=null;this.buildSynchronously();};}catch{this.worker=null;this.buildSynchronously();return;}}
  this.postNext();
 }
 postNext(){if(!this.queue.length||!this.worker)return;const job=this.queue[0];this.worker.postMessage({generation:this.activeGeneration,state:job.state,request:job.request,frame:job.frame,rootsPerSubcell:this.options.rootsPerSubcell,density:this.options.density});}
 receive(data){if(data.generation!==this.activeGeneration)return;if(data.error){this.worker=null;this.buildSynchronously();return;}const job=this.queue.shift();if(data.patch){this.cache.set(data.patch.key,data.patch);this.uploaded+=data.patch.instanceBytes||0;}this.postNext();}
 population(state=this.lastState){const patches=[...this.cache.values()].sort((a,b)=>a.key.localeCompare(b.key)),frame=root.SphereGround?.frame&&root.SphereGround.enabled?.(state)?root.SphereGround.frame(state):frameForState(state),cameraLocal=local(frame,state?.position||frame.origin);this.lastPopulation={prototypes:this.options.prototypes||grassPrototypes(this.options),patches,coordinateSpace:'relative',frameBasis:frame.basis.map(axis=>axis.slice()),cameraLocal,options:{dither:true},windTime:state?.time||0,windStrength:this.options.windStrength??.0015,grass:true};return this.lastPopulation;}
 hash(){return hashHex(...[...this.cache.values()].sort((a,b)=>a.key.localeCompare(b.key)).flatMap(p=>p.roots.map(root=>[p.key,root.key,root.localOrigin.map(v=>v.toPrecision(12)).join(','),root.height.toPrecision(12),root.phase.toPrecision(12)].join('|'))));}
 dispose(){this.worker?.terminate();this.worker=null;this.queue=[];this.cache.clear();this.lastPopulation=null;this.generation++;this.disposed++;}
 get info(){return {patches:this.cache.size,queue:this.queue.length,bytes:[...this.cache.values()].reduce((n,p)=>n+(p.instanceBytes||0),0),disposed:this.disposed,cancelled:this.cancelled,uploaded:this.uploaded,worker:!!this.worker,hash:this.hash()};}
}

const api={PATCH_LEVEL,ROOT_LEVEL,SUBCELLS,DEFAULT_ROOTS,PATCH_SIZE,MAX_PATCHES,MEADOW_CELL_SIZE_METRES,MEADOW_BLADES_PER_ROOT,MEADOW_CANDIDATE_POOL_ROOTS_PER_M2,MEADOW_DETAIL_RADIUS_METRES,MEADOW_MAX_BLADE_HEIGHT_KM,MEADOW_CHILD_SPREAD_METRES,MEADOW_ART_APPEARANCE_REVISION,MEADOW_BLADE_SEGMENTS,MEADOW_BLADE_HALF_WIDTHS,MEADOW_BLADE_CURVATURES,RESIDENT_RESOURCE_REVISION,MAX_WIND_BEND_FRACTION,MAX_GRASS_PROTOTYPE_RADIUS_FACTOR,RESIDENT_CELL_BOUND_PADDING_KM,random,uint32,hashHex,frameForState,frameForMeadowChart,patchKey,patchRequests,semanticAt,densityFactor,eligible,buildPatch,meadowCellForChart,meadowCellKey,meadowCellRequests,meadowSemantic,buildMeadowCell,materializeMeadowCell,prepareResidentCell,FixedChartGrassManager,grassPrototypes,meadowBladeVertices,meadowArtPrototypes,GrassStreamManager};
// Shared worker dispatch is opt-in until compact storage and GPU integration.
api.createVegetationWorkerPool=(service,options)=>{const pool=root.SphereVegetationWorkerPool||(typeof require==='function'?require('./vegetation-worker-pool.js'):null);return new pool.VegetationWorkerPool(service,options);};
root.SphereGrass=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
