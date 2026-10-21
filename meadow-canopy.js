/* IB-075-F preserves reviewed F1 appearance 3 / canopy 1 / material 2 and
 * adds F2 appearance 4 / canopy 2 / material 3 equivalent-canopy response.
 * Earlier appearances retain their prototypes, placement and shader branches.
 * Lengths in shader space are km; F2 prototype positions are metres at scale .001. */
(function(root){
'use strict';
const W=root.SphereMeadowWind||(typeof require==='function'?require('./meadow-wind.js'):null);
const CONTRACT=Object.freeze({appearanceRevision:3,appearancePreset:'meadow-proof-f1',canopyRevision:1,materialRevision:2,detailRadiusMetres:20,clumpRadiusMetres:72,bladeDistancesMetres:[12,20],groundDistancesMetres:[48,72],clumpSpacingMetres:.5,clumpStems:32,representedBladesPerClump:72.5});
// F1 is a preserved reviewed implementation. F2 changes only the equivalent
// representation of that planted volume, not C/E blade population ownership.
const CONTRACT_F2=Object.freeze({appearanceRevision:4,appearancePreset:'meadow-proof-f2',canopyRevision:2,materialRevision:3,detailRadiusMetres:20,clumpRadiusMetres:72,bladeDistancesMetres:[12,20],groundDistancesMetres:[48,72],clumpSpacingMetres:.5,clumpStems:72,clumpVerticesPerStem:16,clumpSegments:3,clumpScaleRangeFactors:Object.freeze([.92,1.08]),representedBladesPerClump:72.5,prototypeRadiusFactor:1.5});
const PALETTE=Object.freeze({id:'meadow-canopy-ground-f2',blades:[.3166666667,.5633333333,.2166666667],albedo:[.2438333334,.4337666666,.1668333334],wetAlbedo:[.1999433334,.3556886666,.1368033334],roughness:.88});
const isF2=s=>!!(s?.meadow?.appearanceRevision===4&&s.meadow.appearancePreset==='meadow-proof-f2'&&s.meadow.canopyRevision===2&&s.meadow.materialRevision===3);
const contractFor=s=>isF2(s)?CONTRACT_F2:CONTRACT;
const active=s=>!!(root.SphereMeadowEcology?.active(s)&&((s.meadow.appearanceRevision===3&&s.meadow.canopyRevision===1&&s.meadow.materialRevision===2)||isF2(s)));
// CPU, worker and GPU share the fixed geographic field and units.
const WIND_GLSL=W.GLSL;
let clumpHeightCache,clumpF2DataCache,clumpF2HeightCache,clumpF2ColourCache;
function clumpStemData(){
 if(!clumpF2DataCache){const E=root.SphereInstancedEnvironment,G=root.SphereGrass,unit=k=>E.hashUnit('meadow-cluster-f2:'+k);clumpF2DataCache=Object.freeze(Array.from({length:CONTRACT_F2.clumpStems},(_,stem)=>{
  // Stratify the height distribution, then permute it independently of spatial
  // order. Its .35 + u^1.7*.75 law is the retained E botanical height law.
  const u=((stem*37)%CONTRACT_F2.clumpStems+.5)/CONTRACT_F2.clumpStems,height=.35+Math.pow(u,1.7)*.75,widthRoll=unit(stem+':width'),widthClass=widthRoll<.46?0:widthRoll<.9?1:2;
  return Object.freeze({height,widthClass,halfWidth:G.MEADOW_BLADE_HALF_WIDTHS[widthClass]*height,curvature:G.MEADOW_BLADE_CURVATURES[widthClass]*height,yaw:unit(stem+':yaw')*Math.PI*2,leanAngle:.035+unit(stem+':lean')*.205,leanAzimuth:unit(stem+':lean-direction')*Math.PI*2,colourClass:Math.min(2,Math.floor(unit(stem+':colour')*3))});
 }));}return clumpF2DataCache;
}
function clumpHeights(s){if(isF2(s)){if(!clumpF2HeightCache)clumpF2HeightCache=Float32Array.from(clumpStemData(),d=>d.height);return clumpF2HeightCache;}if(!clumpHeightCache)clumpHeightCache=Float32Array.from({length:CONTRACT.clumpStems},(_,stem)=>.57+root.SphereInstancedEnvironment.hashUnit('meadow-cluster-f1:'+stem+':height')*.43);return clumpHeightCache;}
function clumpColours(s){if(!isF2(s))return null;if(!clumpF2ColourCache){const colours=[[.22,.47,.18],[.31,.58,.22],[.42,.64,.25]];clumpF2ColourCache=Float32Array.from(clumpStemData().flatMap(d=>colours[d.colourClass].map((v,k)=>v/PALETTE.blades[k])));}return clumpF2ColourCache;}
function prototypes(s){
 if(isF2(s))return prototypesF2();
 const E=root.SphereInstancedEnvironment,vertices=[],indices=[],stems=CONTRACT.clumpStems;
 const unit=k=>E.hashUnit('meadow-cluster-f1:'+k);
 for(let stem=0;stem<stems;stem++){
  const angle=stem*2.39996323,radius=.39*Math.sqrt((stem+.5)/stems),base=[Math.cos(angle)*radius,0,Math.sin(angle)*radius],yaw=unit(stem+':yaw')*Math.PI*2,across=[Math.cos(yaw),0,Math.sin(yaw)],height=clumpHeights()[stem],curve=.06+unit(stem+':curve')*.16,width=.016+unit(stem+':width')*.012,start=vertices.length/6;
  for(let row=0;row<=3;row++){const t=row/3,h=height*t,c=curve*t*t,normal=[-across[2],across[2]*2*curve*t/height,across[0]],n=Math.hypot(...normal);for(const side of [-1,1])vertices.push(base[0]+across[0]*width*(1-t)*side+c, h, base[2]+across[2]*width*(1-t)*side,normal[0]/n,normal[1]/n,normal[2]/n);}
  for(let row=0;row<3;row++){const a=start+row*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
 }
 const p=E.createPrototype({id:'meadow-volume-clump-f1',vertices,indices,wind:true,roughness:PALETTE.roughness});
 return [p];
}
function prototypesF2(){
 const E=root.SphereInstancedEnvironment,M=root.SphereMath,vertices=[],indices=[],stems=clumpStemData();
 const rotate=(q,v)=>M.add(v,M.mul(M.cross(q.slice(0,3),M.add(M.cross(q.slice(0,3),v),M.mul(v,q[3]))),2));
 for(let stem=0;stem<stems.length;stem++){
  const d=stems[stem],angle=stem*2.39996323,radius=.28*Math.sqrt((stem+.5)/stems.length),base=[Math.cos(angle)*radius,0,Math.sin(angle)*radius],normal=[Math.cos(d.leanAzimuth)*Math.sin(d.leanAngle),Math.cos(d.leanAngle),Math.sin(d.leanAzimuth)*Math.sin(d.leanAngle)],q=[normal[2],0,-normal[0],1+normal[1]],qn=Math.hypot(...q),align=q.map(v=>v/qn),yaw=v=>[Math.cos(d.yaw)*v[0]+Math.sin(d.yaw)*v[2],v[1],-Math.sin(d.yaw)*v[0]+Math.cos(d.yaw)*v[2]];
  for(const across of [[1,0,0],[0,0,1]]){
   const start=vertices.length/6;
   for(let row=0;row<=CONTRACT_F2.clumpSegments;row++){
    const t=row/CONTRACT_F2.clumpSegments,taper=row===CONTRACT_F2.clumpSegments?.015:Math.pow(1-t,1.2),center=[d.curvature*(.25*t+.75*t*t),d.height*t,0],slope=d.curvature/d.height*(.25+1.5*t),n=rotate(align,yaw(M.norm(M.cross(across,[slope,1,0]))));
    for(const side of [-1,1]){const v=M.add(base,rotate(align,yaw(M.add(center,M.mul(across,d.halfWidth*taper*side)))));vertices.push(...v,...n);}
   }
   for(let row=0;row<CONTRACT_F2.clumpSegments;row++){const a=start+row*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
  }
 }
 // The ordinary F foliage shader is two-sided and culling is disabled, so a
 // duplicate reverse face adds no silhouette. Both crossed planes are real.
 return [E.createPrototype({id:'meadow-volume-clump-f2',vertices,indices,wind:true,roughness:PALETTE.roughness})];
}
function buildClumpCell(input){
 if(isF2(input.state))return buildClumpCellF2(input);
 const M=root.SphereMath,E=root.SphereInstancedEnvironment,Ec=root.SphereMeadowEcology,S=root.SphereMeadowSupport,Grass=root.SphereGrass,state=input.state,cell=input.cell,frame=input.frame,b=cell.chartBounds||[-128+cell.x*8,-128+cell.z*8,-120+cell.x*8,-120+cell.z*8],instances=[];
 const local=p=>{const d=M.sub(p,frame.origin);return frame.basis.map(axis=>M.dot(d,axis));},unit=k=>E.hashUnit('canopy-f1:'+state.meadow.seed+':'+cell.x+','+cell.z+':'+k);
 const cb=input.candidateBounds||b;let count=0,visitedCandidates=0;
 for(let z=Math.floor((cb[1]-b[1])*2);z<Math.ceil((cb[3]-b[1])*2);z++)for(let x=Math.floor((cb[0]-b[0])*2);x<Math.ceil((cb[2]-b[0])*2);x++){visitedCandidates++;
  const id='clump:'+Ec.COVERAGE_ID+':p2:s'+state.meadow.seed+':'+cell.x+','+cell.z+':'+x+','+z,cx=b[0]+(x+.3+unit(id+'x')*.4)*.5,cz=b[1]+(z+.3+unit(id+'z')*.4)*.5,support=S.query(state,cx,cz,{surfaceSupport:input.surfaceSupport});if(!support)continue;
  if(cx<cb[0]||cx>=cb[2]||cz<cb[1]||cz>=cb[3])continue;
  const field=typeof input.semanticQuery==='function'?input.semanticQuery(support.direction,state):Grass.meadowSemantic(support.direction,state);if(!field?.ecology?.eligibleArea||unit(id+'density')>field.ecology.coverage)continue;
  const normal=frame.basis.map(axis=>M.dot(support.normal,axis)),d=1+normal[1],q=d<1e-8?[1,0,0,0]:[normal[2],0,-normal[0],d],scale=.00064+unit(id+'height')*.0002,wet=field.wetness||0,col=PALETTE.blades.map(v=>v*(1-wet*.18));
  const instance=E.createInstance({prototypeId:'meadow-volume-clump-f1',origin:local(support.point),quaternion:q,scale,colour:[...col,1],phase:unit(id+'phase'),seed:E.hashString(id),addressKey:id,boundsRadius:scale*1.9+.00001});count++;if(input.instanceSink)input.instanceSink(instance,[cx,cz]);else instances.push(instance);
 }
 if(input.instanceSink)return {clumpCount:count,visitedCandidates};
 const centre=S.query(state,(b[0]+b[2])*.5,(b[1]+b[3])*.5,{surfaceSupport:input.surfaceSupport});if(!centre)throw Error('F clump cell has no terrain support');
 const center=local(centre.point),radius=instances.reduce((r,i)=>Math.max(r,M.length(M.sub(i.origin,center))+i.boundsRadius),Math.SQRT2*.004+.002);
 return {key:cell.key,id:cell.key,cell:{x:cell.x,z:cell.z,size:8},center,centerWorld:centre.point,chartBounds:b,boundsRadius:radius,instances,roots:[],instanceBuffer:E.packInstances(instances),rootCount:0,bladeCount:0,clumpCount:instances.length,representedBladeCount:instances.length*CONTRACT.representedBladesPerClump,placementRevision:2,canopyRevision:1,materialRevision:2,appearanceRevision:3,prototypeRadiusFactor:1.2,eligibleAreaM2:64,coordinateSpace:'relative'};
}
function buildClumpCellF2(input){
 const M=root.SphereMath,E=root.SphereInstancedEnvironment,Ec=root.SphereMeadowEcology,S=root.SphereMeadowSupport,Grass=root.SphereGrass,state=input.state,cell=input.cell,frame=input.frame,b=cell.chartBounds||[-128+cell.x*8,-128+cell.z*8,-120+cell.x*8,-120+cell.z*8],instances=[];
 const local=p=>{const d=M.sub(p,frame.origin);return frame.basis.map(axis=>M.dot(d,axis));},unit=k=>E.hashUnit('canopy-f2:'+state.meadow.seed+':'+cell.x+','+cell.z+':'+k);
 const cb=input.candidateBounds||b;let count=0,visitedCandidates=0;
 for(let z=Math.floor((cb[1]-b[1])*2);z<Math.ceil((cb[3]-b[1])*2);z++)for(let x=Math.floor((cb[0]-b[0])*2);x<Math.ceil((cb[2]-b[0])*2);x++){visitedCandidates++;
  const id='clump:'+Ec.COVERAGE_ID+':p2:s'+state.meadow.seed+':'+cell.x+','+cell.z+':'+x+','+z,cx=b[0]+(x+.3+unit(id+'x')*.4)*.5,cz=b[1]+(z+.3+unit(id+'z')*.4)*.5,support=S.query(state,cx,cz,{surfaceSupport:input.surfaceSupport});if(!support)continue;
  if(cx<cb[0]||cx>=cb[2]||cz<cb[1]||cz>=cb[3])continue;
  const field=typeof input.semanticQuery==='function'?input.semanticQuery(support.direction,state):Grass.meadowSemantic(support.direction,state);if(!field?.ecology?.eligibleArea||unit(id+'density')>field.ecology.coverage)continue;
  const n=frame.basis.map(axis=>M.dot(support.normal,axis)),align=[n[2],0,-n[0],1+n[1]],norm=Math.hypot(...align),a=align.map(v=>v/norm),angle=unit(id+'yaw')*Math.PI,yaw=[0,Math.sin(angle),0,Math.cos(angle)],q=[a[3]*yaw[0]+a[0]*yaw[3]+a[1]*yaw[2]-a[2]*yaw[1],a[3]*yaw[1]-a[0]*yaw[2]+a[1]*yaw[3]+a[2]*yaw[0],a[3]*yaw[2]+a[0]*yaw[1]-a[1]*yaw[0]+a[2]*yaw[3],a[3]*yaw[3]-a[0]*yaw[0]-a[1]*yaw[1]-a[2]*yaw[2]],wet=field.wetness||0,col=PALETTE.blades.map(v=>v*(1-wet*.18)),range=CONTRACT_F2.clumpScaleRangeFactors,scale=.001*(range[0]+unit(id+'height')*(range[1]-range[0]));
  // Source-versioned F2 candidate tuning decorrelates the shared stem-height
  // spectrum. Its address-derived .92-1.08 law has mean factor 1 and preserves
  // the immutable prototype and each stem's E width/height proportions.
  const instance=E.createInstance({prototypeId:'meadow-volume-clump-f2',origin:local(support.point),quaternion:q,scale,colour:[...col,1],phase:unit(id+'phase'),seed:E.hashString(id),addressKey:id,boundsRadius:scale*2.2});count++;if(input.instanceSink)input.instanceSink(instance,[cx,cz]);else instances.push(instance);
 }
 if(input.instanceSink)return {clumpCount:count,visitedCandidates};
 const centre=S.query(state,(b[0]+b[2])*.5,(b[1]+b[3])*.5,{surfaceSupport:input.surfaceSupport});if(!centre)throw Error('F2 clump cell has no terrain support');
 const center=local(centre.point),radius=instances.reduce((r,i)=>Math.max(r,M.length(M.sub(i.origin,center))+i.boundsRadius),Math.SQRT2*.004+.0022);
 return {key:cell.key,id:cell.key,cell:{x:cell.x,z:cell.z,size:8},center,centerWorld:centre.point,chartBounds:b,boundsRadius:radius,instances,roots:[],instanceBuffer:E.packInstances(instances),rootCount:0,bladeCount:0,clumpCount:instances.length,representedBladeCount:instances.length*CONTRACT_F2.representedBladesPerClump,placementRevision:2,canopyRevision:2,materialRevision:3,appearanceRevision:4,prototypeRadiusFactor:CONTRACT_F2.prototypeRadiusFactor,eligibleAreaM2:64,coordinateSpace:'relative'};
}
function buildResidentCell(input){
 const Grass=root.SphereGrass;if(!active(input.state))return Grass.buildMeadowCell(input);
 const clumps=buildClumpCell(input);if(input.cell.canopyTier==='clump')return clumps;
 const blades=Grass.buildMeadowCell(input),instances=[...blades.instances,...clumps.instances];
 const contract=contractFor(input.state);
 return {...blades,instances,instanceBuffer:root.SphereInstancedEnvironment.packInstances(instances),boundsRadius:Math.max(blades.boundsRadius,clumps.boundsRadius),clumpCount:clumps.clumpCount,representedBladeCount:clumps.representedBladeCount,canopyRevision:contract.canopyRevision,materialRevision:contract.materialRevision,appearanceRevision:contract.appearanceRevision,prototypeRadiusFactor:isF2(input.state)?CONTRACT_F2.prototypeRadiusFactor:1.2};
}
function descriptorKey(s){const m=s.meadow;return JSON.stringify([m.profileId,m.coverageId,m.seed,m.ecologicalRevision,m.placementRevision,m.appearanceRevision,m.materialRevision,m.canopyRevision,m.anchor,s.radius,s.provinceAnchor,s.provinceSeed,s.packAddress,s.geographyRevision,s.terrainRevision,s.heroRevision]);}
function buildDescriptor(s){
 const size=64,data=new Uint8Array(size*size*4),Ec=root.SphereMeadowEcology;
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){const q=Ec.chartDirection(s,-128+(x+.5)*4,-128+(z+.5)*4),field=root.SphereGrass.meadowSemantic(q,s),i=(z*size+x)*4;data[i]=Math.round((field.ecology.eligibleArea?field.ecology.coverage:0)*255);data[i+1]=Math.round(field.wetness*255);data[i+2]=Math.round(field.ecology.grassDensityBladesPerM2/1000*255);data[i+3]=255;}
 return {key:descriptorKey(s),size,data};
}
class GroundField{
 constructor(gl){this.gl=gl;this.worker=null;this.texture=null;this.key='';this.readyKey='';this.pending=null;this.generation=0;this.info={revision:2,ready:false,uploadedBytes:0,frameUploadedBytes:0,allocations:0,stale:0,prepareMs:0};}
 request(s){this.info.frameUploadedBytes=0;if(!active(s)){if(this.key||this.worker||this.pending){this.generation++;if(this.pending)this.info.stale++;this.worker?.terminate();this.worker=null;this.pending=null;this.key='';this.readyKey='';}this.info.ready=false;return;}const contract=contractFor(s);this.info.revision=contract.materialRevision;const key=descriptorKey(s);if(key===this.key)return;if(this.pending){this.pending=null;this.info.stale++;}this.key=key;this.generation++;this.info.ready=false;this.worker?.terminate();this.worker=new Worker('grass-worker.js?ib075f=material-'+contract.materialRevision);const generation=this.generation;this.worker.onmessage=({data})=>{if(generation!==this.generation){this.info.stale++;return;}if(data.error){this.info.error=data.error;return;}this.pending=data.descriptor;this.info.prepareMs=data.prepareMs;this.worker.terminate();this.worker=null;};this.worker.postMessage({kind:'meadow-material-f1',state:s,generation});}
 bind(u,s){const gl=this.gl,key=active(s)?descriptorKey(s):'';if(this.pending&&(!key||this.pending.key!==key||this.pending.key!==this.key)){this.pending=null;this.info.stale++;this.generation++;this.worker?.terminate();this.worker=null;this.key='';this.readyKey='';this.info.ready=false;}if(this.pending){const d=this.pending;if(!this.texture){this.texture=gl.createTexture();this.info.allocations++;}gl.activeTexture(gl.TEXTURE15);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,d.size,d.size,0,gl.RGBA,gl.UNSIGNED_BYTE,d.data);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.readyKey=d.key;this.info.ready=true;this.info.frameUploadedBytes=d.data.byteLength;this.info.uploadedBytes+=d.data.byteLength;this.info.residentBytes=Math.ceil(d.data.byteLength*4/3);this.pending=null;}
  // Unit 14 is the production Wound sampler2DArray; sampler types must never alias.
  if(u.uMeadowDescriptor!=null)gl.uniform1i(u.uMeadowDescriptor,15);const on=!!key&&this.info.ready&&this.readyKey===key&&this.key===key;if(u.uMeadowMaterialRevision!=null)gl.uniform1i(u.uMeadowMaterialRevision,on?contractFor(s).materialRevision:0);
  if(on){const frame=root.SphereMeadowEcology.chartFrame(s),chart=root.SphereMeadowEcology.chartCoordinates(s,root.SphereMath.norm(s.position));gl.activeTexture(gl.TEXTURE15);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.uMeadowDescriptor,15);gl.uniform3fv(u.uMeadowChartX,frame.east);gl.uniform3fv(u.uMeadowChartZ,frame.north);gl.uniform2fv(u.uMeadowChartCamera,chart);gl.uniform3fv(u.uMeadowCanopyPalette,PALETTE.albedo);gl.uniform3fv(u.uMeadowWetPalette,PALETTE.wetAlbedo);gl.uniform1f(u.uMeadowRoughness,PALETTE.roughness);gl.uniform1f(u.uMeadowWindTime,root.SphereMeadow.windClock(s));gl.uniform1f(u.uMeadowWindStrength,s.meadow.windStrength);}
  gl.activeTexture(gl.TEXTURE0);
 }
 dispose(){this.generation++;this.worker?.terminate();if(this.texture)this.gl.deleteTexture(this.texture);this.worker=null;this.texture=null;this.pending=null;this.key='';this.readyKey='';this.info.residentBytes=0;this.info.ready=false;}
}
const CANOPY_GRAIN_GLSL=`
float meadowGrain(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(a,vec2(127.1,311.7)),dot(a+vec2(1,0),vec2(127.1,311.7)),dot(a+vec2(0,1),vec2(127.1,311.7)),dot(a+vec2(1),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
float meadowCanopyGrain(vec2 p,float phase){vec2 wind=meadowWind(p,phase);p+=.05*wind;vec2 along=normalize(vec2(.82,.57)),across=vec2(-along.y,along.x);vec2 fibres=vec2(dot(p,along)*4.5,dot(p,across)*14.),tips=p*10.;float footprintA=max(length(dFdx(fibres)),length(dFdy(fibres))),footprintB=max(length(dFdx(tips)),length(dFdy(tips)));float filterA=1.-smoothstep(.55,1.75,footprintA),filterB=1.-smoothstep(.55,1.75,footprintB);float fibre=.45*(meadowGrain(fibres)-.5)*filterA+.55*(meadowGrain(tips)-.5)*filterB;float macro=1.+.015*sin(dot(p,vec2(.13,.09)));return macro*(1.+1.8*fibre);}
`;
const GROUND_GLSL=`
uniform int uMeadowMaterialRevision;uniform sampler2D uMeadowDescriptor;
uniform vec3 uMeadowChartX,uMeadowChartZ,uMeadowCanopyPalette,uMeadowWetPalette;uniform vec2 uMeadowChartCamera;uniform float uMeadowRoughness,uMeadowWindTime,uMeadowWindStrength;
${WIND_GLSL}
vec2 meadowChart(vec3 delta){return uMeadowChartCamera+1000.*vec2(dot(delta,uMeadowChartX),dot(delta,uMeadowChartZ));}
vec4 meadowDescriptor(vec2 p){if(any(greaterThanEqual(abs(p),vec2(128.))))return vec4(0.);return texture(uMeadowDescriptor,(p+128.)/256.);}
vec3 meadowGroundNormal(vec3 n,vec3 delta){if(uMeadowMaterialRevision!=2&&uMeadowMaterialRevision!=3)return n;vec2 p=meadowChart(delta),wind=meadowWind(p,uMeadowWindTime);float mask=meadowDescriptor(p).r;return normalize(n+mask*.025*(wind.x*uMeadowChartX+wind.y*uMeadowChartZ));}
float meadowGroundSpec(vec3 delta,vec3 n,vec3 view,float direct){if(uMeadowMaterialRevision!=2&&uMeadowMaterialRevision!=3)return 0.;vec4 field=meadowDescriptor(meadowChart(delta));float rough=clamp(uMeadowRoughness-field.g*.16,.5,1.);vec3 normal=meadowGroundNormal(n,delta),halfway=normalize(-uN+view);return field.r*pow(max(0.,dot(normal,halfway)),mix(96.,12.,rough))*.012*(1.-rough)*direct;}
vec3 meadowGroundLighting(vec3 radiance,vec3 delta,float direct,vec3 fill){if(uMeadowMaterialRevision!=2&&uMeadowMaterialRevision!=3)return radiance;float mask=meadowDescriptor(meadowChart(delta)).r;vec3 response=(vec3(direct*.42)+fill*.90)/max(vec3(.00001),vec3(direct)+fill);return mix(radiance,radiance*response,mask);}
${CANOPY_GRAIN_GLSL}
vec3 meadowGroundF3(vec3 original,vec3 delta,float water,float road){vec2 p=meadowChart(delta);vec4 field=meadowDescriptor(p);float mask=field.r*(1.-max(water,road));vec3 colour=mix(uMeadowCanopyPalette,uMeadowWetPalette,field.g);vec2 wind=meadowWind(p,uMeadowWindTime);colour*=meadowCanopyGrain(p,uMeadowWindTime);float normalResponse=1.-(1.-uMeadowRoughness)*.08*dot(wind,wind);return mix(original,colour*normalResponse,mask);}
vec3 meadowGround(vec3 original,vec3 delta,float footprint,float water,float road){if(uMeadowMaterialRevision==3)return meadowGroundF3(original,delta,water,road);vec2 p=meadowChart(delta);vec4 field=meadowDescriptor(p);float mask=field.r*(1.-max(water,road));vec3 colour=mix(uMeadowCanopyPalette,uMeadowWetPalette,field.g);vec2 wind=meadowWind(p,uMeadowWindTime);float macro=.94+.06*sin(dot(p,vec2(.13,.09)))+.025*wind.x*uMeadowWindStrength;float microFade=1.-smoothstep(.0001,.0015,footprint);float micro=.65*meadowGrain(p*2.3)+.35*meadowGrain(p*7.1);colour*=macro*(1.+.40*(micro-.5)*microFade);float normalResponse=1.-(1.-uMeadowRoughness)*.08*dot(wind,wind);return mix(original,colour*normalResponse,mask);}
`;
// Apply an isolated shader extension after the historical shader assembly. Its
// baseline fingerprints remain usable; unsupported/default profiles take the
// original material branch and legacy shader source stays byte-identical.
if(root.SphereShaders&&root.SphereShaderSections){
 const patch=root.SphereShaderSections.section('Meadow canopy material F2');
 const old='vec3 proof=uMeadowGround*(.88+.18*noise(vec3(p/18.,6.)));land=mix(land,proof,meadow);';
 for(const name of ['fragment','geometryFragment'])if(root.SphereShaders[name]){let source=root.SphereShaders[name];source=patch(source,'vec3 packCompositionWeights(vec2 p){',GROUND_GLSL+'\nvec3 packCompositionWeights(vec2 p){');source=patch(source,old,'if(uMeadowMaterialRevision==2||uMeadowMaterialRevision==3){land=meadowGround(land,delta,footprint,water,road);}else{'+old+'}');if(name==='fragment')source=patch(source,'col=ground*((uCollection==1?collectionLight(q):lightFraction(q))*uLuminosity*surfaceBumpLight*structureShadow(d*(ts*uRadius),-q)+fill);','float meadowDirect=(uCollection==1?collectionLight(q):lightFraction(q))*uLuminosity*surfaceBumpLight*structureShadow(d*(ts*uRadius),-q);col=ground*(meadowDirect+fill);if(uMeadowMaterialRevision==2||uMeadowMaterialRevision==3){col=meadowGroundLighting(col,delta,meadowDirect,fill)+vec3(meadowGroundSpec(delta,-q,-d,meadowDirect));}');root.SphereShaders[name]=source;}
}
function cpuBuffers(){return [clumpHeightCache,clumpF2HeightCache,clumpF2ColourCache].filter(Boolean);}
const api={cpuBuffers,CONTRACT,CONTRACT_F2,PALETTE,active,isF2,contractFor,WIND_GLSL,CANOPY_GRAIN_GLSL,GROUND_GLSL,clumpHeights,clumpColours,clumpStemData,prototypes,buildClumpCell,buildResidentCell,descriptorKey,buildDescriptor,GroundField};root.SphereMeadowCanopy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
