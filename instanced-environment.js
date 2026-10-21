/*
 * IB-050 native WebGL2 instanced environment pass.
 *
 * The pass deliberately owns neither geography nor residency.  Callers hand it
 * indexed prototypes and address-derived instances; this module is responsible
 * for compact GPU packing, patch culling, LOD selection, deterministic draw
 * ordering and disposal accounting.  Instance origins are camera-relative at
 * draw time, so the pass shares the analytic renderer's depth contract after a
 * local-frame rebase.
 */
(function(root){
'use strict';

const STRIDE=32,MAX_COLOR=255,MAX_UINT16=65535,MAX_RESIDENT_WIND_STRENGTH=.38;
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid '+name);return v;};
const vector=(v,name,n=3)=>{if(!Array.isArray(v)||v.length!==n||!v.every(Number.isFinite))throw Error('Invalid '+name);return v.slice();};
const positive=(v,name)=>{finite(v,name);if(v<=0)throw Error('Invalid '+name);return v;};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const length=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((sum,v,index)=>sum+v*b[index],0);
const normalise=v=>{const n=length(v);return n?v.map(x=>x/n):[0,0,0];};
const hashString=value=>{let h=2166136261>>>0;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const hashBytes=bytes=>{let h=2166136261>>>0;for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,16777619);}return `${bytes.length}:${(h>>>0).toString(16).padStart(8,'0')}`;};
const hashUnit=value=>hashString(value)/4294967296;
const compareText=(a,b)=>a<b?-1:a>b?1:0;

function quaternion(input=[0,0,0,1],name='quaternion'){
 const q=vector(input,name,4),n=length(q);if(!n)throw Error('Invalid '+name);return q.map(v=>v/n);
}
function colour(input=[1,1,1,1]){
 const c=vector(input,'colour',4);return c.map(v=>clamp(v));
}
function boundsFromVertices(vertices){
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<vertices.length;i+=6)for(let k=0;k<3;k++){const v=vertices[i+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}
 if(!Number.isFinite(min[0]))throw Error('Prototype has no vertices');
 const center=min.map((v,i)=>(v+max[i])*.5);let radius=0;for(let i=0;i<vertices.length;i+=6)radius=Math.max(radius,length([vertices[i]-center[0],vertices[i+1]-center[1],vertices[i+2]-center[2]]));
 return {min,max,center,radius};
}
function validateIndices(indices,vertexCount){
 if(!Array.isArray(indices)&&!(ArrayBuffer.isView(indices)))throw Error('Prototype indices are required');
 if(indices.length<3||indices.length%3)throw Error('Prototype indices must contain triangles');
 let max=0;for(const index of indices){if(!Number.isInteger(index)||index<0||index>=vertexCount)throw Error('Prototype index is outside the vertex range');max=Math.max(max,index);}
 return max>MAX_UINT16?Uint32Array.from(indices):Uint16Array.from(indices);
}
function lod(input,index){
 const vertices=input.vertices instanceof Float32Array?input.vertices:Float32Array.from(input.vertices||[]);
 if(vertices.length%6)throw Error('Prototype vertices must contain position and normal pairs');
 const count=vertices.length/6,indices=validateIndices(input.indices,count),b=input.bounds||boundsFromVertices(vertices);
 if(!b||!Number.isFinite(b.radius)||b.radius<=0)throw Error('Prototype bounds must include a positive radius');
 return Object.freeze({index,vertices,indices,indexCount:indices.length,indexType:indices instanceof Uint32Array?'UNSIGNED_INT':'UNSIGNED_SHORT',bounds:{min:vector(b.min,'bounds.min'),max:vector(b.max,'bounds.max'),center:vector(b.center,'bounds.center'),radius:positive(b.radius,'bounds.radius')},bytes:vertices.byteLength+indices.byteLength});
}
function createPrototype(input={}){
 if(typeof input.id!=='string'||!input.id)throw Error('Prototype id is required');
 const source=input.lods?.length?input.lods:[input],lods=source.map((value,index)=>lod(value,index));
 const distances=(input.lodDistances||lods.map((_,i)=>i?i*40:0)).map((v,i)=>{finite(v,'LOD distance');if(i&&v<0)throw Error('Invalid LOD distance');return v;});
 for(let i=1;i<distances.length;i++)if(distances[i]<distances[i-1])throw Error('LOD distances must be ascending');
 const flags={alphaTest:!!input.alphaTest,transparent:!!input.transparent,wind:!!input.wind,broadWind:!!input.broadWind},material={albedo:colour(input.albedo||[.42,.52,.28,1]),roughness:clamp(input.roughness??.9),emission:clamp(input.emission??0)},contentHash=hashString(JSON.stringify([input.id,distances,flags,material,lods.map(l=>[hashBytes(new Uint8Array(l.vertices.buffer,l.vertices.byteOffset,l.vertices.byteLength)),hashBytes(new Uint8Array(l.indices.buffer,l.indices.byteOffset,l.indices.byteLength))])])).toString(16).padStart(8,'0');
 return Object.freeze({id:input.id,lods:Object.freeze(lods),lodDistances:Object.freeze(distances),...flags,material:Object.freeze(material),contentHash});
}
function createInstance(input={}){
 const id=input.prototypeId||input.prototype;if(typeof id!=='string'||!id)throw Error('Instance prototypeId is required');
 const origin=vector(input.origin||input.worldOrigin||[0,0,0],'instance origin'),worldOrigin=input.worldOrigin?vector(input.worldOrigin,'world origin'):null;
 const address=input.address??null,addressKey=input.addressKey??address?.key??address?.id??(address&&root.SphereWorldAddress?.stringify?root.SphereWorldAddress.stringify(address):null);
 return {id,prototypeId:id,origin,worldOrigin,address,geography:input.geography??null,featureId:input.featureId??null,quaternion:quaternion(input.quaternion),scale:positive(input.scale??1,'instance scale'),colour:colour(input.colour||input.color),phase:clamp(input.phase??0),seed:Math.floor(input.seed??hashString(addressKey||[id,...origin].join(':')))>>>0,boundsRadius:positive(input.boundsRadius??1,'instance bounds radius'),addressKey:addressKey==null?null:String(addressKey),transparent:input.transparent==null?null:!!input.transparent};
}
function createPatch(input={}){
 if(typeof input.id!=='string'||!input.id)throw Error('Patch id is required');
 const instances=(input.instances||[]).map(createInstance),center=vector(input.center||[0,0,0],'patch center');
 const radius=input.radius==null?Math.max(1,...instances.map(i=>length(i.origin.map((v,k)=>v-center[k]))+i.boundsRadius)):positive(input.radius,'patch radius');
 return {id:input.id,center,radius,instances,transparent:!!input.transparent,addressKey:input.addressKey==null?null:String(input.addressKey),revision:input.revision??1,coverage:input.coverage==null?1:clamp(input.coverage),tier:input.tier??null,material:input.material??null};
}
function selectLod(prototype,distance){
 let selected=0;for(let i=1;i<prototype.lodDistances.length;i++)if(distance>=prototype.lodDistances[i])selected=i;return Math.min(selected,prototype.lods.length-1);
}
function cameraBasis(camera){
 const b=camera.basis||camera;return {f:normalise(vector(b.f||camera.forward,'camera forward')),r:normalise(vector(b.r||camera.right,'camera right')),u:normalise(vector(b.u||camera.up,'camera up'))};
}
function patchDistance(patch,camera){
 const c=patch.centerRelative||patch.center,position=camera.position||[0,0,0];return length(c.map((v,i)=>v-(camera.relativeOrigin?position[i]:0)));
}
function visiblePatch(patch,camera){
 if(camera.culling===false)return true;
 // Resident Meadow cells carry their conservative sphere as boundsRadius;
 // generic environment patches call the same value radius.
 const c=patch.centerRelative||patch.center,radius=patch.radius??patch.boundsRadius??0,b=cameraBasis(camera),aspect=camera.aspect||1,fov=(camera.fov||90)*Math.PI/180,tan=Math.tan(fov*.5),z=camera.relativeOrigin?c.map((v,i)=>v-camera.relativeOrigin[i]):c;
 const planes=[b.f,[b.f[0]*tan+b.r[0],b.f[1]*tan+b.r[1],b.f[2]*tan+b.r[2]],[b.f[0]*tan-b.r[0],b.f[1]*tan-b.r[1],b.f[2]*tan-b.r[2]],[b.f[0]*tan/aspect+b.u[0],b.f[1]*tan/aspect+b.u[1],b.f[2]*tan/aspect+b.u[2]],[b.f[0]*tan/aspect-b.u[0],b.f[1]*tan/aspect-b.u[1],b.f[2]*tan/aspect-b.u[2]]];
 return planes.every(p=>p[0]*z[0]+p[1]*z[1]+p[2]*z[2]+radius*length(p)>=0);
}
function sortInstances(instances,camera,transparent){
 const basis=cameraBasis(camera),out=instances.slice();if(!transparent)return out.sort((a,b)=>compareText(a.addressKey||a.seed,b.addressKey||b.seed));
 return out.sort((a,b)=>{const da=(a.origin[0]*basis.f[0]+a.origin[1]*basis.f[1]+a.origin[2]*basis.f[2]),db=(b.origin[0]*basis.f[0]+b.origin[1]*basis.f[1]+b.origin[2]*basis.f[2]);return db-da||compareText(a.addressKey||a.seed,b.addressKey||b.seed);});
}
function planDraws(population,camera,options={}){
 const prototypes=population.prototypes instanceof Map?population.prototypes:new Map((population.prototypes||[]).map(p=>[p.id,p]));
 const patches=(population.patches||[]).map(p=>p.instances? p : createPatch(p));
 const near=options.nearDither??.85,far=options.farDither??1.15,commands=[],culled=[];
 for(const patch of patches){if(!visiblePatch(patch,camera)){culled.push(patch.id);continue;}const distance=patchDistance(patch,camera);
  const byPrototype=new Map();for(const instance of patch.instances){const p=prototypes.get(instance.prototypeId);if(!p)continue;const key=p.id;if(!byPrototype.has(key))byPrototype.set(key,[]);byPrototype.get(key).push(instance);}
  for(const [id,instances]of byPrototype){const p=prototypes.get(id),lodIndex=selectLod(p,distance),previous=lodIndex>0?lodIndex-1:null,threshold=p.lodDistances[lodIndex]||0,span=Math.max(1,threshold*.15),t=threshold?clamp((distance-(threshold-span))/(span*2)):1;
   const transparent=patch.transparent||p.transparent||instances.some(i=>i.transparent===true),ordered=sortInstances(instances,camera,transparent);
   commands.push({patch,prototype:p,lodIndex,instances:ordered,distance,coverage:clamp(patch.coverage??1),transparent,sortKey:`${transparent?'1':'0'}:${String(distance).padStart(16,'0')}:${patch.id}:${id}`});
   if(options.dither!==false&&previous!==null&&t<1&&t>0)commands.push({patch,prototype:p,lodIndex:previous,instances:ordered,distance,coverage:1-t,transparent,sortKey:`${transparent?'1':'0'}:${String(distance).padStart(16,'0')}:${patch.id}:${id}:old`});
  }
 }
 commands.sort((a,b)=>a.transparent-b.transparent||a.distance-b.distance||compareText(a.sortKey,b.sortKey));
 // Meadow has many small resident patches but only a handful of immutable
 // prototypes.  Quantising dither coverage lets those patches share settled
 // instance buffers instead of turning a far field into hundreds of draws.
 if(options.batch){const groups=new Map(),steps=Math.max(1,Math.floor(options.coverageSteps??16));for(const command of commands){const bucket=Math.round(command.coverage*steps),key=[command.prototype.id,command.lodIndex,command.transparent?1:0,bucket].join('|');let group=groups.get(key);if(!group){group={...command,coverage:bucket/steps,instances:[],distance:command.distance,sortKey:`${command.prototype.id}:${command.lodIndex}:${bucket}`};groups.set(key,group);}group.instances.push(...command.instances);group.distance=Math.min(group.distance,command.distance);}commands.splice(0,commands.length,...[...groups.values()].map(command=>({...command,instances:sortInstances(command.instances,camera,command.transparent)})).sort((a,b)=>a.transparent-b.transparent||a.distance-b.distance||compareText(a.sortKey,b.sortKey)));}
 return {commands,culled,visiblePatches:patches.length-culled.length};
}
function writePackedInstance(view,base,instance){
  for(let i=0;i<3;i++)view.setFloat32(base+i*4,instance.origin[i],true);
  const q=instance.quaternion;for(let i=0;i<4;i++)view.setInt16(base+12+i*2,Math.round(clamp(q[i],-1,1)*32767),true);
  view.setFloat32(base+20,instance.scale,true);const c=instance.colour;for(let i=0;i<4;i++)view.setUint8(base+24+i,Math.round(c[i]*MAX_COLOR));
  view.setUint16(base+28,Math.round(instance.phase*MAX_UINT16),true);view.setUint16(base+30,instance.seed&MAX_UINT16,true);
}
function packInstances(instances){
 const buffer=new ArrayBuffer(instances.length*STRIDE),view=new DataView(buffer);
 instances.forEach((instance,index)=>writePackedInstance(view,index*STRIDE,instance));
 return new Uint8Array(buffer);
}
function resolvePopulation(population,state){
 const relative=population.coordinateSpace==='relative'&&Array.isArray(population.cameraLocal);
 if(relative){const camera=vector(population.cameraLocal,'relative camera');const patches=(population.patches||[]).map(source=>{const patch=source.instances?source:createPatch(source),instances=patch.instances.map(instance=>({...instance,origin:instance.origin.map((v,i)=>v-camera[i])})),center=patch.center.map((v,i)=>v-camera[i]);return {...patch,center,centerRelative:center,instances};});return {...population,patches,cameraLocal:[0,0,0]};}
 const world=population.coordinateSpace==='world'||(population.instances||[]).some(instance=>instance.worldOrigin);
 if(!world)return population;
 const camera=vector(state.position||[0,0,0],'camera position');
 const patches=(population.patches||[]).map(source=>{const patch=source.instances?source:createPatch(source),instances=patch.instances.map(instance=>{const origin=instance.worldOrigin||instance.origin;return {...instance,origin:origin.map((v,i)=>v-camera[i])};});const center=(source.worldCenter||source.center||[0,0,0]).map((v,i)=>v-camera[i]);return {...patch,center,centerRelative:center,instances};});
 return {...population,patches,coordinateSpace:'relative'};
}
function syntheticPopulation(options={}){
 const prototype=options.prototype||createPrototype({id:options.prototypeId||'synthetic-environment',vertices:[-.45,0,0,0,1,0,.45,0,0,0,1,0,0,1.4,0,0,1,0],indices:[0,1,2],albedo:options.albedo||[.22,.62,.28,1]});
 const patchCount=options.patchCount??4,instancesPerPatch=options.instancesPerPatch??32,spacing=options.spacing??8,seed=options.seed??0,patches=[];
 for(let p=0;p<patchCount;p++){const center=[(p-(patchCount-1)*.5)*spacing,0,options.distance??34],instances=[];for(let i=0;i<instancesPerPatch;i++){const key=`synthetic:${seed}:p${p}:i${i}`,angle=hashUnit(key+'a')*Math.PI*2,radius=(hashUnit(key+'r')**.5)*(spacing*.42),origin=[center[0]+Math.cos(angle)*radius,.04+hashUnit(key+'y')*.12,center[2]+Math.sin(angle)*radius];instances.push(createInstance({prototypeId:prototype.id,origin,scale:.7+hashUnit(key+'s')*.35,phase:hashUnit(key+'w'),seed:hashString(key),addressKey:key,boundsRadius:1}));}patches.push(createPatch({id:`synthetic:${seed}:patch:${p}`,center,radius:spacing*.62,instances}));}
 return {prototypes:[prototype],patches,seed,options:options.options||{dither:true}};
}

const VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aOrigin; layout(location=3) in vec4 aQuaternion;
layout(location=4) in float aScale; layout(location=5) in vec4 aColour;
layout(location=6) in vec2 aParams;
uniform vec3 uForward,uRight,uUp,uCameraLocal; uniform float uFov; uniform vec2 uResolution;
uniform float uWindTime,uWindStrength,uWindEnabled,uBroadWind;
out vec3 vRelative,vNormal; out vec4 vColour; flat out float vSeed;
vec3 rotate(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void main(){vec3 local=aPosition,localNormal=aNormal;float tip=clamp(local.y,0.,1.);float phase=aParams.x*6.2831853+aParams.y*37.17;float gust=sin(phase+uWindTime*.8)+.45*sin(phase*.61+uWindTime*.31);if(uWindEnabled>.5){float blade=tip*tip;float broad=uBroadWind>.5?1.:0.;float bend=gust*uWindStrength*(blade+broad*.18);float crossBend=cos(phase+uWindTime*.63)*uWindStrength*.65*(blade+broad*.18);local.x+=bend;local.z+=crossBend;localNormal.x-=2.*gust*uWindStrength*tip*localNormal.y;localNormal.z-=1.3*cos(phase+uWindTime*.63)*uWindStrength*tip*localNormal.y;}vec3 p=aOrigin+rotate(aQuaternion,local*aScale)-uCameraLocal;vRelative=p;vNormal=normalize(rotate(aQuaternion,localNormal));vColour=aColour;vSeed=aParams.y*65535.;float z=dot(p,uForward),t=tan(uFov*.5);gl_Position=vec4(dot(p,uRight)/t,dot(p,uUp)/t*uResolution.x/uResolution.y,z-.00002,z);}
`;
const FRAGMENT=`#version 300 es
precision highp float;in vec3 vRelative,vNormal;in vec4 vColour;flat in float vSeed;out vec4 fragColor;
 uniform vec3 uLightDir,uFogColor;uniform float uRadius,uLinearOutput,uExposure,uDitherCoverage,uFogNear,uFogFar,uAlphaTest;uniform int uMode;
float hash(float n){return fract(sin(n*12.9898)*43758.5453);}
vec3 tone(vec3 x){x*=exp2(uExposure);x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
void main(){if(uDitherCoverage<.999&&hash(gl_FragCoord.x*17.+gl_FragCoord.y*31.+vSeed)>uDitherCoverage)discard;if(uAlphaTest>.5&&vColour.a<.5)discard;float d=length(vRelative);/* Keep terrain-conformed roots ahead of an equal-depth ground sample. */gl_FragDepth=clamp(log2(1.+d)/log2(1.+4.*uRadius)-.000002,0.,1.);if(uMode==2){fragColor=vec4(fract(vSeed*.00001526),.75,0.,1.);return;}vec3 n=normalize(vNormal);float light=.35+.65*max(0.,dot(n,normalize(uLightDir)));vec3 col=vColour.rgb*light+vColour.rgb*.03;float fog=smoothstep(uFogNear,uFogFar,d);col=mix(col,uFogColor,fog);fragColor=vec4(uLinearOutput>0.5?max(col,vec3(0.)):tone(col),vColour.a);}
`;


// F uses the production structure-shadow sampler in WORLD coordinates, while
// all blade positions/normals and stellar direction use the fixed chart basis.
const F_VERTEX=`#version 300 es
precision highp float;precision highp int;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aNormal;
layout(location=2)in vec3 aOrigin;layout(location=3)in vec4 aQuaternion;
layout(location=4)in float aScale;layout(location=5)in vec4 aColour;layout(location=6)in vec2 aParams;
uniform vec3 uForward,uRight,uUp,uCameraLocal;uniform float uFov;uniform vec2 uResolution;
uniform float uWindTime,uWindStrength,uWindEnabled;uniform int uTier,uWindTimelineRevision;uniform float uStemHeights[32];
out vec3 vRelative,vNormal;out vec4 vColour;out float vTip;flat out float vSeed,vPartSeed,vLodDistance;
${root.SphereMeadowCanopy?.WIND_GLSL||''}
vec3 rotate(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void main(){vec3 local=aPosition,n=aNormal;float heightReciprocal=uTier==2?1./uStemHeights[gl_VertexID/8]:1.,tip=clamp(local.y*heightReciprocal,0.,1.);vec2 wind=meadowWind(aOrigin.xz*1000.,uWindTime);float flutter=.035*sin(aParams.x*6.2831853+uWindTime*.8);vec2 bend=wind*uWindStrength+vec2(flutter,-flutter*.5);if(uWindTimelineRevision==1){bend=rotate(vec4(-aQuaternion.xyz,aQuaternion.w),vec3(bend.x,0.,bend.y)).xz;}if(uWindEnabled>.5){local.xz+=bend*tip*tip;n.y-=2.*tip*heightReciprocal*dot(bend,n.xz);}vec3 p=aOrigin+rotate(aQuaternion,local*aScale)-uCameraLocal;vRelative=p;vNormal=normalize(rotate(aQuaternion,n));vColour=aColour;vTip=tip;vSeed=aParams.y*65535.;vPartSeed=vSeed+(uTier==2?floor(float(gl_VertexID)/8.)*37.11:0.);float rootDistance=length(aOrigin-uCameraLocal);vLodDistance=rootDistance*tan(uFov*.5)/.83909963*1920./uResolution.x;float z=dot(p,uForward),t=tan(uFov*.5);gl_Position=vec4(dot(p,uRight)/t,dot(p,uUp)/t*uResolution.x/uResolution.y,z-.00002,z);}
`;
// F2 keeps the earlier F1 shader independently selectable. Its crossed ribbons
// carry the detailed population's height, colour and wind distributions.
const F2_VERTEX=F_VERTEX
 .replace('out vec3 vRelative,vNormal;','flat out float vRootY,vCanopyWet;out vec3 vRelative,vNormal;')
 .replace('uStemHeights[32]','uStemHeights[72]')
 .replace('uStemHeights[gl_VertexID/8]','uStemHeights[gl_VertexID/16]')
 .replace('float flutter=.035*sin(aParams.x*6.2831853+uWindTime*.8);','float stem=uTier==2?floor(float(gl_VertexID)/16.):0.;float flutter=.035*sin(aParams.x*6.2831853+stem*2.39996323+uWindTime*.8);')
 .replace('vec2 bend=wind*uWindStrength+vec2(flutter,-flutter*.5);','vec2 bend=(wind*uWindStrength+vec2(flutter,-flutter*.5))*(uTier==2?1./heightReciprocal:1.);')
 .replace('vColour=aColour;','vRootY=aOrigin.y;vCanopyWet=aColour.r/.3166666667;vColour=aColour;if(uTier==2){float c=fract(sin(stem*12.9898+aParams.y*65535.)*43758.5453);vec3 palette=c<.333333?vec3(.22,.47,.18):c<.666667?vec3(.31,.58,.22):vec3(.42,.64,.25);vColour.rgb*=palette/vec3(.3166666667,.5633333333,.2166666667);}')
 .replace('floor(float(gl_VertexID)/8.)','floor(float(gl_VertexID)/16.)');
function foliageFragment(){
 const source=root.SphereShaders?.fragment||'',start=source.indexOf('float shadowFetch('),end=source.indexOf('vec3 finishLighting(',start),shadow=start>=0&&end>start?source.slice(start,end):'float structureShadow(vec3 p,vec3 n){return 1.;}';
 return `#version 300 es
precision highp float;precision highp int;
in vec3 vRelative,vNormal;in vec4 vColour;in float vTip;flat in float vSeed,vPartSeed,vLodDistance;out vec4 fragColor;
uniform vec3 uLightDir,uFill,uFrameX,uFrameY,uFrameZ;uniform float uDirect,uRadius,uLinearOutput,uExposure,uRoughness;
uniform int uMode,uTier,uLocalShadowQuality;uniform sampler2D uStructureShadow;uniform vec3 uShadowRight,uShadowUp,uShadowRay,uShadowCentre[2];uniform vec4 uShadowScale;uniform float uSunAngularRadius;
${shadow}
float hash(float n){return fract(sin(n*12.9898)*43758.5453);}
vec3 tone(vec3 x){x*=exp2(uExposure);x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
void main(){float overlap=smoothstep(.012,.020,vLodDistance),weight=uTier==1?1.-overlap:overlap*(1.-smoothstep(.048,.072,vLodDistance));if(weight<.999&&hash(vPartSeed+.31)>weight)discard;float d=length(vRelative);gl_FragDepth=clamp(log2(1.+max(0.,d-.0000005))/log2(1.+4.*uRadius),0.,1.);if(uMode==2){fragColor=vec4(uTier==1?.25:.75,.75,0.,1.);return;}vec3 n=normalize(vNormal);vec3 view=-normalize(vRelative);if(dot(n,view)<0.)n=-n;vec3 light=normalize(uLightDir),worldP=vRelative.x*uFrameX+vRelative.y*uFrameY+vRelative.z*uFrameZ,worldN=n.x*uFrameX+n.y*uFrameY+n.z*uFrameZ;float shadow=structureShadow(worldP,worldN),nl=dot(n,light),wrap=.40+.60*max(0.,nl);float transmission=.14*max(0.,-nl)*(.25+.75*(1.-max(0.,dot(view,light))));float base=.53+.47*smoothstep(0.,.8,vTip),tips=1.+(hash(vSeed+2.)-.5)*.075*vTip;vec3 albedo=vColour.rgb*base*tips;vec3 halfVector=normalize(light+view);float power=mix(96.,12.,uRoughness),spec=pow(max(0.,dot(n,halfVector)),power)*(.002+.014*(1.-uRoughness));vec3 radiance=albedo*(uFill*(.72+.28*vTip)+uDirect*shadow*(wrap+transmission))+vec3(spec*uDirect*shadow);fragColor=vec4(uLinearOutput>.5?max(radiance,vec3(0.)):tone(radiance),1.);}
`;
}

function foliageFragmentF2(){return foliageFragment()
 .replace('uniform int uMode,uTier,uLocalShadowQuality;','uniform int uMode,uTier,uDetailAvailable,uLocalShadowQuality;')
 // An accepted retained clump-only cell can approach the camera while the
 // next detailed target is preparing. Replacement must follow the geometry
 // actually available in this draw, rather than discard both representations.
 .replace('weight=uTier==1?1.-overlap:overlap*(1.-smoothstep(.048,.072,vLodDistance))','weight=uTier==1?1.-overlap:(uDetailAvailable==1?overlap:1.)*(1.-smoothstep(.048,.072,vLodDistance))')
 .replace("float hash(float n)","flat in float vRootY,vCanopyWet;uniform vec3 uCameraLocal;uniform float uWindTime;\n"+root.SphereMeadowCanopy.WIND_GLSL+root.SphereMeadowCanopy.CANOPY_GRAIN_GLSL+"\nfloat hash(float n)")
 .replace("fragColor=vec4(uLinearOutput>.5?max(radiance,vec3(0.)):tone(radiance),1.);","if(uTier==2){vec3 groundRay=uCameraLocal+vRelative*((vRootY-uCameraLocal.y)/min(-.000001,vRelative.y));vec3 meanAlbedo=vec3(.2438333334,.4337666666,.1668333334)*clamp(vCanopyWet,.80,1.02);vec2 wind=meadowWind(groundRay.xz*1000.,uWindTime);vec3 average=meanAlbedo*(uFill*.90+uDirect*shadow*.42)*meadowCanopyGrain(groundRay.xz*1000.,uWindTime)*(1.-(1.-uRoughness)*.08*dot(wind,wind));float filtered=smoothstep(.032,.064,vLodDistance)*smoothstep(0.,.00004,-vRelative.y);radiance=mix(radiance,average,filtered);}fragColor=vec4(uLinearOutput>.5?max(radiance,vec3(0.)):tone(radiance),1.);");}

function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
function link(gl,fragment,vertexSource=VERTEX){
 const program=gl.createProgram(),vertex=compile(gl,gl.VERTEX_SHADER,vertexSource),pixel=compile(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vertex);gl.attachShader(program,pixel);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program);gl.deleteShader(vertex);gl.deleteShader(pixel);gl.deleteProgram(program);throw Error(message);}
 gl.detachShader(program,vertex);gl.detachShader(program,pixel);gl.deleteShader(vertex);gl.deleteShader(pixel);
 const uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i);uniforms[info.name]=gl.getUniformLocation(program,info.name);}return {program,uniforms};
}

class InstancedEnvironmentPass{
 constructor(gl){this.gl=gl;this.records=new Map();this.residentPrototypeRecords=new Map();this.residentCellRecords=new Map();this.residentFrameId=0;this.disposedBytes=0;this.needsFrame=false;this.diagnostics={shaderVariantsPrepared:2,allocatedBytes:0,uploadedBytes:0,frameUploadedBytes:0,frameInstanceUploadBytes:0,framePrototypeUploadBytes:0,frameResidentCellUploads:0,disposedBytes:0,residentBytes:0,residentInstanceBytes:0,residentPrototypeBytes:0,residentCells:0,residentCellUploads:0,residentCellReplacements:0,drawCalls:0,instances:0,triangles:0,visiblePatches:0,culledPatches:0,pendingResidentCells:0,maxResidentCellUploadsPerFrame:1,maxUploadBytesPerFrame:1024*1024,gpuMs:null};this.programs={opaque:link(gl,FRAGMENT),alphaTest:link(gl,FRAGMENT)};this.timer=gl.getExtension?.('EXT_disjoint_timer_query_webgl2')||null;this.queries=[];}
 record(prototype,lodIndex,instanceKey=''){const key=prototype.id+':'+lodIndex+':'+instanceKey;if(this.records.has(key))return this.records.get(key);const gl=this.gl,l=prototype.lods[lodIndex],vao=gl.createVertexArray(),vertex=gl.createBuffer(),index=gl.createBuffer(),instance=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,l.vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,l.indices,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,instance);gl.bufferData(gl.ARRAY_BUFFER,0,gl.DYNAMIC_DRAW);for(const [loc,size,type,normalised,offset]of[[2,3,gl.FLOAT,false,0],[3,4,gl.SHORT,true,12],[4,1,gl.FLOAT,false,20],[5,4,gl.UNSIGNED_BYTE,true,24],[6,2,gl.UNSIGNED_SHORT,true,28]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,normalised,STRIDE,offset);gl.vertexAttribDivisor(loc,1);}gl.bindVertexArray(null);const result={vao,vertex,index,instance,lod:l,instanceBytes:0,bytes:l.bytes};this.records.set(key,result);this.diagnostics.allocatedBytes+=l.bytes;this.diagnostics.residentBytes+=l.bytes;return result;}
 upload(record,instances){const data=instances instanceof Uint8Array?instances:packInstances(instances),signature=hashBytes(data);if(record.instanceSignature===signature)return 0;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,record.instance);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);this.diagnostics.uploadedBytes+=data.byteLength;this.diagnostics.frameUploadedBytes+=data.byteLength;this.diagnostics.residentBytes+=data.byteLength-record.instanceBytes;record.instanceBytes=data.byteLength;record.instanceSignature=signature;return data.byteLength;}
 findResidentPrototype(population,id){const prototypes=population.prototypes||[];for(let i=0;i<prototypes.length;i++)if(prototypes[i].id===id)return prototypes[i];return null;}
 residentPrototype(prototype,lodIndex=0){
  const key=`${prototype.id}:${lodIndex}:${prototype.contentHash}`,old=this.residentPrototypeRecords.get(key);if(old)return old;
  const gl=this.gl,lod=prototype.lods[lodIndex],vertex=gl.createBuffer(),index=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,lod.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,lod.indices,gl.STATIC_DRAW);
  const result={key,prototype,lodIndex,lod,vertex,index,bytes:lod.bytes};this.residentPrototypeRecords.set(key,result);this.diagnostics.allocatedBytes+=lod.bytes;this.diagnostics.uploadedBytes+=lod.bytes;this.diagnostics.frameUploadedBytes+=lod.bytes;this.diagnostics.framePrototypeUploadBytes+=lod.bytes;return result;
 }
 estimatedResidentUploadBytes(cell,population){
  let bytes=cell.residentBuffer?.byteLength||0;if(bytes>0)for(const group of cell.residentGroups||[]){if(!group.count)continue;const prototype=this.findResidentPrototype(population,group.prototypeId);if(!prototype)continue;const key=`${prototype.id}:0:${prototype.contentHash}`;if(!this.residentPrototypeRecords.has(key))bytes+=prototype.lods[0].bytes;}
  return bytes;
 }
 makeResidentVao(resource,group,prototype,lodIndex=0){
  const proto=this.residentPrototype(prototype,lodIndex),key=`${proto.key}:${group.prototypeId}:${group.byteOffset}`;if(resource.vaos.has(key))return resource.vaos.get(key);
  const gl=this.gl,vao=gl.createVertexArray(),offset=group.byteOffset;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,proto.vertex);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,proto.index);
  if(resource.instance){gl.bindBuffer(gl.ARRAY_BUFFER,resource.instance);for(const [loc,size,type,normalised,fieldOffset]of[[2,3,gl.FLOAT,false,0],[3,4,gl.SHORT,true,12],[4,1,gl.FLOAT,false,20],[5,4,gl.UNSIGNED_BYTE,true,24],[6,2,gl.UNSIGNED_SHORT,true,28]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,normalised,STRIDE,offset+fieldOffset);gl.vertexAttribDivisor(loc,1);}}
  gl.bindVertexArray(null);const result={vao,prototype:proto.prototype,lod:proto.lod,count:group.count};resource.vaos.set(key,result);return result;
 }
 ensureResidentCell(cell,population,budget){
  let resource=this.residentCellRecords.get(cell.key);
  if(resource&&resource.contentHash!==cell.residentContentHash){this.disposeResidentCell(resource);this.residentCellRecords.delete(cell.key);resource=null;this.diagnostics.residentCellReplacements++;}
  if(!resource){
   const byteLength=cell.residentBuffer?.byteLength||0,estimated=this.estimatedResidentUploadBytes(cell,population);
   if(byteLength>budget.maxCellBytes||budget.cells>=budget.maxCells||budget.bytes+estimated>budget.maxBytes)return null;
   resource={key:cell.key,contentHash:cell.residentContentHash,instance:null,bytes:byteLength,vaos:new Map(),groups:cell.residentGroups||[],seenAtFrame:this.residentFrameId};
   // This derives once from the retained packed draw groups. A queued target
   // tier or source root-count label cannot establish replacement availability.
   resource.hasDetailedBladeGroups=resource.groups.some(group=>group.count>0&&group.prototypeId.startsWith('meadow-tapered-ribbon-v2-')&&!!this.findResidentPrototype(population,group.prototypeId));
   for(const group of resource.groups)if(group.count){const prototype=this.findResidentPrototype(population,group.prototypeId);if(prototype)this.residentPrototype(prototype,0);}
   if(byteLength){resource.instance=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,resource.instance);this.gl.bufferData(this.gl.ARRAY_BUFFER,cell.residentBuffer,this.gl.STATIC_DRAW);this.diagnostics.allocatedBytes+=byteLength;this.diagnostics.uploadedBytes+=byteLength;this.diagnostics.frameUploadedBytes+=byteLength;this.diagnostics.frameInstanceUploadBytes+=byteLength;this.diagnostics.residentCellUploads++;}
   this.residentCellRecords.set(cell.key,resource);budget.cells++;budget.bytes=this.diagnostics.frameUploadedBytes;
  }
  resource.seenAtFrame=this.residentFrameId;
  for(const group of resource.groups)if(group.count){const prototype=this.findResidentPrototype(population,group.prototypeId);if(prototype)this.makeResidentVao(resource,group,prototype,0);}
  return resource;
 }
 disposeResidentCell(resource){const gl=this.gl;for(const entry of resource.vaos.values())gl.deleteVertexArray(entry.vao);resource.vaos.clear();if(resource.instance)gl.deleteBuffer(resource.instance);this.disposedBytes+=resource.bytes;}
 setResidentUniforms(program,state,population,width,height,linear,renderer,b,toLocal,axes,foliage){const gl=this.gl,u=program.uniforms,f=(name,value)=>{if(u[name]!=null)gl.uniform1f(u[name],value);},v=(name,value)=>{if(u[name]!=null)gl.uniform3fv(u[name],value);},i=(name,value)=>{if(u[name]!=null)gl.uniform1i(u[name],value);};v('uForward',b.f);v('uRight',b.r);v('uUp',b.u);v('uCameraLocal',population.cameraLocal||[0,0,0]);f('uFov',(state.fov||90)*Math.PI/180);gl.uniform2f(u.uResolution,width,height);f('uRadius',state.radius||149597870.7);f('uLinearOutput',linear?1:0);f('uExposure',state.exposure||0);v('uLightDir',toLocal(state.lightDirection||[-1,-1,-1]));v('uFogColor',population.environmentFog||[.06,.09,.08]);f('uFogNear',population.fogNear||200);f('uFogFar',population.fogFar||2000);f('uWindTime',population.windTime??state.time??0);f('uWindStrength',Math.max(0,Math.min(MAX_RESIDENT_WIND_STRENGTH,Number(population.windStrength??0))));f('uWindEnabled',0);f('uAlphaTest',0);i('uMode',population.diagnostic==='grass-id'?2:state.viewMode==='objectid'?2:0);if(foliage){i('uWindTimelineRevision',state.meadow?.windTimelineRevision||0);if(u['uStemHeights[0]']!=null)gl.uniform1fv(u['uStemHeights[0]'],root.SphereMeadowCanopy.clumpHeights(state));const M=root.SphereMath,visibility=root.SphereCollection?.visibility?.(state.position,state,state.stationSamples||64)??1;v('uLightDir',toLocal(M.mul(M.norm(state.position),-1)));v('uFill',renderer?.frameFill||[state.shellshine||0,state.shellshine||0,state.shellshine||0]);f('uDirect',visibility*state.luminosity*Math.pow(M.AU/M.length(state.position),2));v('uFrameX',axes[0]);v('uFrameY',axes[1]);v('uFrameZ',axes[2]);if(renderer?.localShadows)renderer.localShadows.bind(u,state);else i('uLocalShadowQuality',0);this.diagnostics.lighting={starDirectionChart:toLocal(M.mul(M.norm(state.position),-1)),visibility,fill:renderer?.frameFill,direct:visibility*state.luminosity*Math.pow(M.AU/M.length(state.position),2),materialRevision:population.materialRevision,structureShadow:renderer?.localShadows?.quality||0,atmosphereComposition:!!renderer?.weather};}return {f,v,i};}
 vegetationAllocatedBytes(){let bytes=0;for(const r of this.records.values())bytes+=r.bytes+r.instanceBytes;for(const r of this.residentCellRecords.values())bytes+=r.bytes;for(const r of this.residentPrototypeRecords.values())bytes+=r.bytes;for(const backend of this.vegetationBackends||[])if(!backend.closed)bytes+=backend.fixedGpuBytes;return bytes;}
 vegetationProgramKey(variant,backend){return 'slots-'+variant+(backend.optimisation.deferredDecode?'-deferred-decode-v2':'')+(backend.optimisation.powerOfTwoAddressing?'-address-width-'+backend.layout.width:'')+(variant==='foliage2'&&backend.stemMasksReady&&backend.optimisation.zeroWeightStems?(backend.optimisation.stemWeightMasks?'-stem-weight-masks-v2':'-zero-weight-stems-v2'):'');}
 drawVegetation(state,population,width,height,{linear=false,exportFrame=false,measureGpu=true,renderer=null}={}){
  const started=typeof performance==='undefined'?Date.now():performance.now(),gl=this.gl,GPU=root.SphereVegetationGPU;
  if(!GPU||!population.service)throw Error('Persistent vegetation service/backend unavailable');
  this.externalVegetationGpuBytes=renderer?.meadowGround?.info?.residentBytes||0;const service=population.service;let backend=service.gpuBackend;
  this.vegetationBackends??=new Set();
  for(const retiring of this.vegetationBackends){if(retiring.disposing&&!retiring.closed)retiring.pollDisposal();if(retiring.closed)this.vegetationBackends.delete(retiring);}service.cpuInventory.retain('renderer-prototype-cache',this.residentPrototypeRecords,{lifetime:'renderer cache',release:'prototype cache eviction or renderer-pass disposal'});
  if(!backend&&[...this.vegetationBackends].some(b=>b.disposing&&!b.closed)){
   this.needsFrame=true;this.diagnostics={...this.diagnostics,drawCalls:0,instances:0,triangles:0,frameUploadedBytes:0,frameInstanceUploadBytes:0,framePrototypeUploadBytes:0,frameReferenceUploadBytes:0,referencesReady:false,pendingGpuRetirement:true,residentBytes:this.vegetationAllocatedBytes(),framePrepareCpuMs:population.lifecycle?.finishPreparation((typeof performance==='undefined'?Date.now():performance.now())-started)||0};return this.diagnostics;
  }
  if(!backend){backend=new GPU.PersistentRecords(gl,service,{progressive:!!population.lifecycle,additionalGpuBytes:()=>this.vegetationAllocatedBytes()+this.externalVegetationGpuBytes-(service.gpuBackend&&!service.gpuBackend.closed?service.gpuBackend.fixedGpuBytes:0)});this.vegetationBackends.add(backend);this.diagnostics.allocatedBytes+=backend.fixedGpuBytes;}
  if(backend.closed||backend.gl!==gl||backend.owningPass&&backend.owningPass!==this)throw Error('Vegetation backend belongs to another rendering pass/context');this.vegetationBackends.add(backend);backend.owningPass=this;backend.additionalGpuBytes=()=>this.vegetationAllocatedBytes()+this.externalVegetationGpuBytes-(backend.closed?0:backend.fixedGpuBytes);backend.checkCapacity();
  service.cpuInventory.retain('renderer-other-vegetation',{meadow:renderer?.meadow,grass:renderer?.grass,ground:renderer?.meadowGround,records:this.records,residentCells:this.residentCellRecords},{lifetime:'renderer vegetation',release:'cache eviction, replacement or renderer disposal'});
  backend.resetFrame();this.diagnostics.pendingGpuRetirement=false;this.diagnostics.frameUploadedBytes=0;this.diagnostics.frameInstanceUploadBytes=0;this.diagnostics.framePrototypeUploadBytes=0;
  const maximumBytes=Math.min(2*1048576,Math.max(40,Math.floor(population.maxUploadBytesPerFrame??2*1048576))),budget={remaining:maximumBytes};let active=[];
  const globalBasis=root.SphereMath?.basis(state.forward,state.up)||{f:state.forward,r:state.right,u:state.up},axes=population.frameBasis,toLocal=v=>axes?[dot(v,axes[0]),dot(v,axes[1]),dot(v,axes[2])]:v,b={f:toLocal(globalBasis.f),r:toLocal(globalBasis.r),u:toLocal(globalBasis.u)},camera={basis:b,fov:state.fov,aspect:width/height,internalWidth:width,relativeOrigin:population.cameraLocal,culling:population.culling!==false,productionSelection:population.productionSelection===true,demandConflict:population.demand?.conflict||null},foliage=root.SphereMeadowCanopy?.active(state);
  const ensurePrototypes=(plan,budget)=>{for(const family of plan.commands){const p=backend.representationPrototype(family.prototype,family.group.shaderVariant),key=`${p.id}:${family.lodIndex}:${p.contentHash}`;if(!this.residentPrototypeRecords.has(key)){backend.checkCapacity(p.lods[family.lodIndex].bytes);if(p.lods[family.lodIndex].bytes>budget.remaining)continue;this.residentPrototype(p,family.lodIndex);budget.remaining-=p.lods[family.lodIndex].bytes;}if(population.lifecycle){const variant=family.group.shaderVariant,programKey=this.vegetationProgramKey(variant,backend);if(!['opaque','foliage','foliage2'].includes(variant))throw Error('Unsupported vegetation shader family');if(!this.programs[programKey])this.programs[programKey]=link(gl,variant==='foliage2'?GPU.readinessFragment(foliageFragmentF2()):variant==='foliage'?foliageFragment():FRAGMENT,GPU.textureVertex(variant==='foliage2'?F2_VERTEX:variant==='foliage'?F_VERTEX:VERTEX,{readiness:variant==='foliage2',zeroWeightStems:programKey.endsWith('-zero-weight-stems-v2')||programKey.endsWith('-stem-weight-masks-v2'),stemWeightMasks:programKey.endsWith('-stem-weight-masks-v2'),deferredDecode:!!backend.optimisation.deferredDecode,recordWidth:backend.optimisation.powerOfTwoAddressing?backend.layout.width:0}));}}
   return plan.commands.every(c=>{const p=backend.representationPrototype(c.prototype,c.group.shaderVariant);return this.residentPrototypeRecords.has(`${p.id}:${c.lodIndex}:${p.contentHash}`);});};
  let plan,referencesReady,complete;
  if(population.lifecycle){if(!backend.progressive||population.lifecycle.service!==service)throw Error('Incompatible progressive vegetation backend');const prepared=population.lifecycle.prepare(backend,budget,population.prototypes,camera,ensurePrototypes);active=prepared.active;referencesReady=prepared.referencesReady;complete=prepared.complete;plan=population.lifecycle.committed?.plan||{visible:0,culled:0};}
  else{for(const handle of population.handles||[]){if(!service.stageGpu(handle,budget))continue;const r=service.allocations.get(handle.reservationToken);if(r.status==='GPU staged'&&!service.activate(handle))continue;if(service.resolve(handle))active.push(handle);}plan=backend.plan(active,population.prototypes,camera);referencesReady=ensurePrototypes(plan,budget)&&backend.select(plan,budget);complete=referencesReady&&active.length===(population.handles||[]).length;}
  this.diagnostics.framePrepareCpuMs=(typeof performance==='undefined'?Date.now():performance.now())-started;
  if(population.lifecycle)this.diagnostics.framePrepareCpuMs=population.lifecycle.finishPreparation(this.diagnostics.framePrepareCpuMs);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.viewport(0,0,width,height);
  const query=this.timer&&measureGpu&&!exportFrame&&this.queries.length<4?gl.createQuery():null;if(query)gl.beginQuery(this.timer.TIME_ELAPSED_EXT,query);
  let drawCalls=0,instances=0,triangles=0,clumpOnlyFallbackInstances=0,clumpWithDetailInstances=0,clumpOnlyFallbackDraws=0,clumpWithDetailDraws=0,succeeded=false;const tierDrawCalls={blades:0,clumps:0},tierInstances={blades:0,clumps:0};
  try{if(referencesReady)for(const family of backend.commands){
   // Every immutable range owner is revalidated immediately before submission.
   // Foreign/accessor owners retain the original per-range validation path.
   if(family.validationHandles){for(const handle of family.validationHandles)if(!service.resolve(handle))throw Error('Stale slot reference before draw');}
   else for(const range of family.ranges)if(!service.resolve(range.handle))throw Error('Stale slot reference before draw');
   const variant=family.group.shaderVariant,readiness=variant==='foliage2',key=this.vegetationProgramKey(variant,backend);
   if(!['opaque','foliage','foliage2'].includes(variant))throw Error('Unsupported vegetation shader family');
   if(!this.programs[key]){const vertex=variant==='foliage2'?F2_VERTEX:variant==='foliage'?F_VERTEX:VERTEX,fragment=readiness?GPU.readinessFragment(foliageFragmentF2()):variant==='foliage'?foliageFragment():FRAGMENT;this.programs[key]=link(gl,fragment,GPU.textureVertex(vertex,{readiness,zeroWeightStems:key.endsWith('-zero-weight-stems-v2')||key.endsWith('-stem-weight-masks-v2'),stemWeightMasks:key.endsWith('-stem-weight-masks-v2'),deferredDecode:!!backend.optimisation.deferredDecode,recordWidth:backend.optimisation.powerOfTwoAddressing?backend.layout.width:0}));}
   const program=this.programs[key],u=program.uniforms;gl.useProgram(program.program);this.setResidentUniforms(program,state,population,width,height,linear,renderer,b,toLocal,axes,variant!=='opaque');backend.bind(u);
   const prototype=backend.representationPrototype(family.prototype,family.group.shaderVariant),resource=this.residentPrototype(prototype,family.lodIndex);backend.checkCapacity();backend.vao(family,resource);
   if(u.uDitherCoverage!=null)gl.uniform1f(u.uDitherCoverage,1);if(u.uTier!=null)gl.uniform1i(u.uTier,family.group.tier==='coarse'?2:1);if(u.uRoughness!=null)gl.uniform1f(u.uRoughness,prototype.material.roughness);if(u.uWindEnabled!=null)gl.uniform1f(u.uWindEnabled,prototype.wind?1:0);if(u.uBroadWind!=null)gl.uniform1f(u.uBroadWind,prototype.broadWind?1:0);if(u.uAlphaTest!=null)gl.uniform1f(u.uAlphaTest,prototype.alphaTest?1:0);
   gl.drawElementsInstanced(gl.TRIANGLES,resource.lod.indexCount,resource.lod.indexType==='UNSIGNED_INT'?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0,family.count);
   const tier=family.group.tier==='coarse'?'clumps':'blades';tierDrawCalls[tier]++;tierInstances[tier]+=family.count;drawCalls++;instances+=family.count;triangles+=resource.lod.indexCount/3*family.count;
   if(tier==='clumps'){if(family.fallbackCount){clumpOnlyFallbackDraws++;clumpOnlyFallbackInstances+=family.fallbackCount;}if(family.detailCount){clumpWithDetailDraws++;clumpWithDetailInstances+=family.detailCount;}}
  }if(referencesReady)backend.markSubmitted();succeeded=true;}finally{if(query){gl.endQuery(this.timer.TIME_ELAPSED_EXT);if(succeeded)this.queries.push(query);else gl.deleteQuery(query);}gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);}
  this.needsFrame=!complete;
  let prototypeBytes=0;for(const r of this.residentPrototypeRecords.values())prototypeBytes+=r.bytes;
  const frame=backend.frame;this.diagnostics={...this.diagnostics,backend:backend.info.backend,drawCalls,instances,triangles,tierDrawCalls,tierInstances,clumpOnlyFallbackDraws,clumpOnlyFallbackInstances,clumpWithDetailDraws,clumpWithDetailInstances,visiblePatches:plan.visible,culledPatches:plan.culled,residentCells:service.allocations.size,pendingResidentCells:population.lifecycle?[...service.allocations.values()].filter(r=>['queued','preparing','CPU ready','GPU staged'].includes(r.status)).length:(population.handles||[]).length-active.length,residentInstanceBytes:backend.fixedGpuBytes,residentPrototypeBytes:prototypeBytes,residentBytes:this.vegetationAllocatedBytes(),frameReferenceUploadBytes:frame.referenceUploadBytes,frameInstanceUploadBytes:frame.recordUploadBytes,frameSelectionUploadBytes:frame.selectionUploadBytes,coldSelectionReadbackBytes:frame.coldRankProbeReadbackBytes||0,frameUploadedBytes:frame.recordUploadBytes+frame.referenceUploadBytes+frame.selectionUploadBytes+this.diagnostics.framePrototypeUploadBytes,uploadedBytes:this.diagnostics.uploadedBytes+frame.recordUploadBytes+frame.referenceUploadBytes+frame.selectionUploadBytes,physicalGpu:backend.info,maximumUploadBytes:maximumBytes,referencesReady,coverage:population.lifecycle?.info||null,committedTargetSignature:null};
  return this.diagnostics;
 }

 drawResident(state,population,width,height,{linear=false,exportFrame=false,measureGpu=true,renderer=null}={}){
  const preparationStarted=typeof performance!=='undefined'?performance.now():Date.now();
  const gl=this.gl,foliage=root.SphereMeadowCanopy?.active(state),foliageVariant=population.canopyRevision===2?'foliage2':'foliage';if(foliage&&!this.programs[foliageVariant])this.programs[foliageVariant]=link(gl,population.canopyRevision===2?foliageFragmentF2():foliageFragment(),population.canopyRevision===2?F2_VERTEX:F_VERTEX);this.residentFrameId++;this.diagnostics.frameUploadedBytes=0;this.diagnostics.frameInstanceUploadBytes=0;this.diagnostics.framePrototypeUploadBytes=0;
  const maximumCells=Math.max(1,Math.floor(population.maxResidentCellUploadsPerFrame??1)),maximumBytes=Math.max(1024,Math.floor(population.maxUploadBytesPerFrame??1024*1024)),maximumCellBytes=Math.max(1024,Math.floor(population.maxCellUploadBytes??1024*1024)),budget={cells:0,bytes:0,maxCells:maximumCells,maxBytes:maximumBytes,maxCellBytes:maximumCellBytes};
  const active=population.residentCells||population.patches||[],pending=population.pendingResidentCells||[],targetSignature=population.residentTargetSignature,expected=population.expectedPendingCellCount??0;
  for(const cell of active)this.ensureResidentCell(cell,population,budget);
  for(const cell of pending)this.ensureResidentCell(cell,population,budget);
  const pendingReady=!!targetSignature&&expected===pending.length&&pending.every(cell=>{const resource=this.residentCellRecords.get(cell.key);return !!resource&&resource.contentHash===cell.residentContentHash;});
  const targetReady=targetSignature&&expected===0&&pending.length===0;
  const commitSignature=pendingReady||targetReady?targetSignature:null,drawCells=commitSignature?pending:active;
  this.diagnostics.framePrepareCpuMs=(typeof performance!=='undefined'?performance.now():Date.now())-preparationStarted;
  const globalBasis=root.SphereMath?.basis(state.forward,state.up)||{f:state.forward,r:state.right,u:state.up},axes=population.frameBasis,toLocal=v=>axes?[dot(v,axes[0]),dot(v,axes[1]),dot(v,axes[2])]:v,b={f:toLocal(globalBasis.f),r:toLocal(globalBasis.r),u:toLocal(globalBasis.u)},camera={basis:b,fov:state.fov,aspect:width/height,relativeOrigin:population.cameraLocal,culling:population.culling!==false};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.viewport(0,0,width,height);
  const setUniforms=program=>this.setResidentUniforms(program,state,population,width,height,linear,renderer,b,toLocal,axes,foliage);
  this.diagnostics.frameUploadedBytes=this.diagnostics.frameUploadedBytes||0;const startQuery=this.timer&&measureGpu&&!exportFrame&&this.queries.length<4?gl.createQuery():null;if(startQuery)gl.beginQuery(this.timer.TIME_ELAPSED_EXT,startQuery);let drawCalls=0,instances=0,triangles=0,visible=0,culled=0,succeeded=false,clumpOnlyFallbackDraws=0,clumpOnlyFallbackInstances=0,clumpWithDetailDraws=0,clumpWithDetailInstances=0;const tierDrawCalls={blades:0,clumps:0},tierInstances={blades:0,clumps:0};
  try{
   let current=null;
   for(const cell of drawCells){if(!visiblePatch(cell,camera)){culled++;continue;}visible++;const resource=this.residentCellRecords.get(cell.key);if(!resource)continue;
    for(const group of resource.groups){if(!group.count)continue;const prototype=this.findResidentPrototype(population,group.prototypeId);if(!prototype)continue;const vaoRecord=this.makeResidentVao(resource,group,prototype,0),variant=foliage?foliageVariant:prototype.alphaTest?'alphaTest':'opaque';if(current!==variant){current=variant;gl.useProgram(this.programs[current].program);setUniforms(this.programs[current]);}gl.bindVertexArray(vaoRecord.vao);const uniforms=this.programs[current].uniforms;if(uniforms.uDitherCoverage!=null)gl.uniform1f(uniforms.uDitherCoverage,1);if(foliage){gl.uniform1i(uniforms.uTier,group.prototypeId.startsWith('meadow-volume-clump-f')?2:1);gl.uniform1f(uniforms.uRoughness,prototype.material.roughness);if(foliageVariant==='foliage2'&&uniforms.uDetailAvailable!=null)gl.uniform1i(uniforms.uDetailAvailable,resource.hasDetailedBladeGroups?1:0);}if(uniforms.uWindEnabled!=null)gl.uniform1f(uniforms.uWindEnabled,prototype.wind?1:0);if(uniforms.uBroadWind!=null)gl.uniform1f(uniforms.uBroadWind,prototype.broadWind?1:0);if(uniforms.uAlphaTest!=null)gl.uniform1f(uniforms.uAlphaTest,prototype.alphaTest?1:0);gl.drawElementsInstanced(gl.TRIANGLES,vaoRecord.lod.indexCount,vaoRecord.lod.indexType==='UNSIGNED_INT'?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0,group.count);const tier=group.prototypeId.startsWith('meadow-volume-clump-f')?'clumps':'blades';if(foliage&&foliageVariant==='foliage2'&&tier==='clumps'){if(resource.hasDetailedBladeGroups){clumpWithDetailDraws++;clumpWithDetailInstances+=group.count;}else{clumpOnlyFallbackDraws++;clumpOnlyFallbackInstances+=group.count;}}tierDrawCalls[tier]++;tierInstances[tier]+=group.count;drawCalls++;instances+=group.count;triangles+=vaoRecord.lod.indexCount/3*group.count;
    }
   }
   succeeded=true;
  }finally{if(startQuery){try{gl.endQuery(this.timer.TIME_ELAPSED_EXT);if(succeeded)this.queries.push(startQuery);else gl.deleteQuery(startQuery);}catch{gl.deleteQuery(startQuery);}}gl.bindVertexArray(null);}
  for(const [key,resource]of this.residentCellRecords)if(resource.seenAtFrame!==this.residentFrameId){this.disposeResidentCell(resource);this.residentCellRecords.delete(key);}
  let residentInstanceBytes=0;for(const resource of this.residentCellRecords.values())residentInstanceBytes+=resource.bytes;let residentPrototypeBytes=0;for(const resource of this.residentPrototypeRecords.values())residentPrototypeBytes+=resource.bytes;let genericBytes=0;for(const resource of this.records.values())genericBytes+=resource.bytes+resource.instanceBytes;
  const gpuReady=!!commitSignature,activeMissing=active.some(cell=>{const resource=this.residentCellRecords.get(cell.key);return !resource||resource.contentHash!==cell.residentContentHash;}),cpuPending=!!targetSignature&&expected!==pending.length,pendingGpu=!!targetSignature&&!gpuReady;
  this.needsFrame=activeMissing||cpuPending||pendingGpu;
  this.diagnostics={...this.diagnostics,drawCalls,instances,triangles,tierDrawCalls,tierInstances,clumpOnlyFallbackDraws,clumpOnlyFallbackInstances,clumpWithDetailDraws,clumpWithDetailInstances,visiblePatches:visible,culledPatches:culled,residentCells:this.residentCellRecords.size,residentInstanceBytes,residentPrototypeBytes,residentBytes:this.vegetationAllocatedBytes(),frameUploadedBytes:this.diagnostics.frameUploadedBytes,frameResidentCellUploads:budget.cells,pendingResidentCells:Math.max(0,expected-pending.length)+pending.filter(cell=>{const r=this.residentCellRecords.get(cell.key);return !r||r.contentHash!==cell.residentContentHash;}).length,maxResidentCellUploadsPerFrame:maximumCells,maxUploadBytesPerFrame:maximumBytes,committedTargetSignature:gpuReady?commitSignature:null};
  return this.diagnostics;
 }
 draw(state,population,width,height,{linear=false,exportFrame=false,measureGpu=true,renderer=null}={}){
  if(population.coordinateSpace==='vegetation-chart')return this.drawVegetation(state,population,width,height,{linear,exportFrame,measureGpu,renderer});
  if(population.coordinateSpace==='resident-chart')return this.drawResident(state,population,width,height,{linear,exportFrame,measureGpu,renderer});
  const globalBasis=root.SphereMath?.basis(state.forward,state.up)||{f:state.forward,r:state.right,u:state.up},localAxes=population.frameBasis;
  const toLocal=vector=>localAxes?[dot(vector,localAxes[0]),dot(vector,localAxes[1]),dot(vector,localAxes[2])]:vector;
  const gl=this.gl,camera={basis:{f:toLocal(globalBasis.f),r:toLocal(globalBasis.r),u:toLocal(globalBasis.u)},fov:state.fov,aspect:width/height,culling:population.culling!==false};
  const resolved=resolvePopulation(population.resolve?population.resolve(state):population,state),plan=planDraws(resolved,camera,population.options||{});
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.viewport(0,0,width,height);
  const b=camera.basis,setUniforms=(program)=>{const u=program.uniforms,f=(name,value)=>{if(u[name]!=null)gl.uniform1f(u[name],value);},v=(name,value)=>{if(u[name]!=null)gl.uniform3fv(u[name],value);},i=(name,value)=>{if(u[name]!=null)gl.uniform1i(u[name],value);};v('uForward',b.f);v('uRight',b.r);v('uUp',b.u);v('uCameraLocal',[0,0,0]);f('uFov',(state.fov||90)*Math.PI/180);gl.uniform2f(u.uResolution,width,height);f('uRadius',state.radius||149597870.7);f('uLinearOutput',linear?1:0);f('uExposure',state.exposure||0);v('uLightDir',state.lightDirection||[-1,-1,-1]);v('uFogColor',population.environmentFog||[.06,.09,.08]);f('uFogNear',population.fogNear||200);f('uFogFar',population.fogFar||2000);f('uWindTime',population.windTime??state.time??0);f('uWindStrength',population.windStrength??0);f('uWindEnabled',0);f('uAlphaTest',0);i('uMode',population.diagnostic==='grass-id'?2:state.viewMode==='objectid'?2:0);return {f,v,i};};
  this.diagnostics.frameUploadedBytes=0;this.diagnostics.frameInstanceUploadBytes=0;this.diagnostics.framePrototypeUploadBytes=0;const startQuery=this.timer&&measureGpu&&!exportFrame&&this.queries.length<4?gl.createQuery():null;if(startQuery)gl.beginQuery(this.timer.TIME_ELAPSED_EXT,startQuery);let drawCalls=0,instances=0,triangles=0,succeeded=false;
  try{
   let current=null;
   for(const command of plan.commands){const variant=command.coverage<.999||command.prototype.alphaTest?'alphaTest':'opaque';if(current!==variant){current=variant;gl.useProgram(this.programs[current].program);setUniforms(this.programs[current]);}const record=this.record(command.prototype,command.lodIndex,`${variant}:${command.sortKey}`);this.upload(record,command.instances);gl.bindVertexArray(record.vao);gl.uniform1f(this.programs[current].uniforms.uDitherCoverage,command.coverage);if(this.programs[current].uniforms.uWindEnabled!=null)gl.uniform1f(this.programs[current].uniforms.uWindEnabled,command.prototype.wind?1:0);if(this.programs[current].uniforms.uBroadWind!=null)gl.uniform1f(this.programs[current].uniforms.uBroadWind,command.prototype.broadWind?1:0);if(this.programs[current].uniforms.uAlphaTest!=null)gl.uniform1f(this.programs[current].uniforms.uAlphaTest,command.prototype.alphaTest?1:0);gl.drawElementsInstanced(gl.TRIANGLES,record.lod.indexCount,record.lod.indexType==='UNSIGNED_INT'?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0,command.instances.length);drawCalls++;instances+=command.instances.length;triangles+=record.lod.indexCount/3*command.instances.length;}
   succeeded=true;
  }finally{
   if(startQuery){try{gl.endQuery(this.timer.TIME_ELAPSED_EXT);if(succeeded)this.queries.push(startQuery);else gl.deleteQuery(startQuery);}catch{gl.deleteQuery(startQuery);}}
   gl.bindVertexArray(null);
  }
  this.diagnostics={...this.diagnostics,drawCalls,instances,triangles,visiblePatches:plan.visiblePatches,culledPatches:plan.culled.length};return this.diagnostics;
 }
 poll(){if(!this.timer)return;const gl=this.gl;while(this.queries.length&&gl.getQueryParameter(this.queries[0],gl.QUERY_RESULT_AVAILABLE)){const query=this.queries.shift();this.diagnostics.gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);}}
 dispose(){for(const backend of this.vegetationBackends||[]){if(!backend.closed)this.disposedBytes+=backend.fixedGpuBytes;backend.dispose();}const gl=this.gl;gl.useProgram(null);gl.bindVertexArray(null);for(const record of this.records.values()){gl.deleteVertexArray(record.vao);gl.deleteBuffer(record.vertex);gl.deleteBuffer(record.index);gl.deleteBuffer(record.instance);this.disposedBytes+=record.bytes+record.instanceBytes;}for(const record of this.residentCellRecords.values())this.disposeResidentCell(record);for(const record of this.residentPrototypeRecords.values()){gl.deleteBuffer(record.vertex);gl.deleteBuffer(record.index);this.disposedBytes+=record.bytes;}for(const program of Object.values(this.programs))gl.deleteProgram(program.program);for(const query of this.queries)gl.deleteQuery(query);this.records.clear();this.residentCellRecords.clear();this.residentPrototypeRecords.clear();this.needsFrame=false;this.diagnostics={...this.diagnostics,residentBytes:0,residentInstanceBytes:0,residentPrototypeBytes:0,residentCells:0,pendingResidentCells:0,frameUploadedBytes:0,disposedBytes:this.disposedBytes};}
}

const api={STRIDE,MAX_RESIDENT_WIND_STRENGTH,VERTEX,FRAGMENT,F_VERTEX,F2_VERTEX,foliageFragment,foliageFragmentF2,createPrototype,createInstance,createPatch,syntheticPopulation,selectLod,visiblePatch,planDraws,packInstances,writePackedInstance,resolvePopulation,hashString,hashUnit,InstancedEnvironmentPass};
root.SphereInstancedEnvironment=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
