/* Isolated p1 render overlay. Installs only when explicitly loaded in the owned
 * snapshot. Existing population records, support, wind and old programs survive.
 * Its version is independent of the production saved-state schema. */
(function(root){
'use strict';
const E=root.SphereInstancedEnvironment,GPU=root.SphereVegetationGPU,API={
 profile:'meadow-prototype-p1',revision:2,mode:'baseline',atlasGpuBytes:0,textures:null,prototype:null,
 description:'View-dependent alpha/normal/depth/height impostor over F2 coarse records; experimental art/backend, no acceptance',
};
function program(gl,vertex,fragment){
 const p=gl.createProgram(),shaders=[];
 try{for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
  const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
  gl.attachShader(p,shader);
 }gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 const uniforms={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(p,i);uniforms[u.name]=gl.getUniformLocation(p,u.name);}
 return {program:p,uniforms};
 }catch(e){gl.deleteProgram(p);throw e;}finally{for(const shader of shaders)gl.deleteShader(shader);}
}
const varying=`
out vec2 vP1UV;flat out vec4 vP1Rotation;flat out vec3 vP1View;flat out float vP1Scale;
`;
const coarse=`
vP1UV=vec2(0.);vP1Rotation=vec4(0.,0.,0.,1.);vP1View=vec3(0.,0.,1.);vP1Scale=1.;
if(uTier==2){
 vec3 centre=vec3(0.,.55,0.);
 vec4 inverseQ=vec4(-aQuaternion.xyz,aQuaternion.w);
 vec3 dir=normalize(rotate(inverseQ,(uCameraLocal-aOrigin)/aScale)-centre);
 vec3 right=abs(dir.y)>.999?vec3(1.,0.,0.):normalize(cross(vec3(0.,1.,0.),dir));
 vec3 up=normalize(cross(dir,right));
 vec3 local=centre+right*(aPosition.x*.8)+up*(aPosition.y*.75);
 float tip=clamp(local.y/1.1,0.,1.);
 vec2 wind=meadowWind(aOrigin.xz*1000.,uWindTime);
 float flutter=.035*sin(aParams.x*6.2831853+uWindTime*.8);
 vec2 bend=wind*uWindStrength+vec2(flutter,-flutter*.5);
 if(uWindTimelineRevision==1)bend=rotate(inverseQ,vec3(bend.x,0.,bend.y)).xz;
 if(uWindEnabled>.5)local.xz+=bend*tip*tip;
 vec3 p=aOrigin+rotate(aQuaternion,local*aScale)-uCameraLocal;
 vRelative=p;vNormal=normalize(rotate(aQuaternion,vec3(0.,1.,0.)));
 vColour=aColour;vTip=tip;vSeed=aParams.y*65535.;vPartSeed=vSeed;
 vRootY=aOrigin.y;vCanopyWet=aColour.r/.3166666667;
 vP1UV=aPosition.xy*.5+.5;vP1Rotation=aQuaternion;vP1View=dir;vP1Scale=aScale;
 float rootDistance=length(aOrigin-uCameraLocal);
 vLodDistance=rootDistance*tan(uFov*.5)/.83909963*1920./uResolution.x;
 float z=dot(p,uForward),t=tan(uFov*.5);
 gl_Position=vec4(dot(p,uRight)/t,dot(p,uUp)/t*uResolution.x/uResolution.y,z-.00002,z);
 return;
}
`;
function vertex(){
 // This diagnostic retains native masks for unchanged near blades and the
 // baseline comparison. The new coarse path never indexes those stem masks.
 const source=E.F2_VERTEX.replace('out vec3 vRelative,vNormal;',varying+'out vec3 vRelative,vNormal;').replace('void main(){','void main(){'+coarse);
 return GPU.textureVertex(source,{readiness:true,zeroWeightStems:false,stemWeightMasks:false,deferredDecode:false,recordWidth:2048});
}
const helpers=`
in vec2 vP1UV;flat in vec4 vP1Rotation;flat in vec3 vP1View;flat in float vP1Scale;
uniform sampler2D uP1Colour,uP1Normal;
vec3 p1Rotate(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
vec3 p1Oct(vec2 p){vec3 n=vec3(p*2.-1.,1.-abs(p.x*2.-1.)-abs(p.y*2.-1.));if(n.z<0.)n.xy=(1.-abs(n.yx))*sign(n.xy+vec2(.000001));return normalize(n);}
vec2 p1AtlasUV(float azimuth,float elevation){
 vec2 tile=vec2(mod(azimuth,4.),elevation);
 return (tile+clamp(vP1UV,vec2(.0078125),vec2(.9921875)))/vec2(4.,2.);
}
vec4 p1Sample(sampler2D atlas){
 float azimuth=mod(atan(vP1View.x,vP1View.z)+6.2831853,6.2831853)/1.57079633;
 float a=floor(azimuth),t=fract(azimuth),e=clamp(asin(clamp(vP1View.y,0.,1.))/1.22173048,0.,1.);
 return mix(mix(texture(atlas,p1AtlasUV(a,0.)),texture(atlas,p1AtlasUV(a+1.,0.)),t),
            mix(texture(atlas,p1AtlasUV(a,1.)),texture(atlas,p1AtlasUV(a+1.,1.)),t),e);
}
uint p1Hash(uint x){x^=x>>16u;x*=2146121005u;x^=x>>15u;x*=2221713035u;x^=x>>16u;return x;}
float p1Rank(){uvec2 cell=uvec2(clamp(vP1UV,vec2(0.),vec2(.99999))*64.);return float(p1Hash(uint(vSeed)^cell.x^(cell.y*65537u))&16777215u)/16777216.;}
`;
function fragment(){
 let source=GPU.readinessFragment(E.foliageFragmentF2());
 source=source.replace('void main(){',helpers+'void main(){vec4 p1Colour=vec4(0.),p1Normal=vec4(.5,.5,.5,.5);if(uTier==2){p1Colour=p1Sample(uP1Colour);p1Normal=p1Sample(uP1Normal);if(p1Colour.a<.40)discard;}');
 source=source.replace('if(weight<.999&&hash(vPartSeed+.31)>weight)discard;','if(uTier==1){if(weight<.999&&hash(vPartSeed+.31)>weight)discard;}else{if(weight<=0.||(weight<1.&&p1Rank()>=weight))discard;}');
 source=source.replace('float d=length(vRelative);','vec3 p1Relative=uTier==2?vRelative+p1Rotate(vP1Rotation,vP1View)*((p1Normal.b*2.-1.)*.8*vP1Scale):vRelative;float d=length(p1Relative);');
 source=source.replace('vec3 n=normalize(vNormal);','vec3 n=uTier==2?normalize(p1Rotate(vP1Rotation,p1Oct(p1Normal.rg))):normalize(vNormal);');
 source=source.replace('float base=.53+.47*smoothstep(0.,.8,vTip),','float p1Tip=uTier==2?p1Normal.a:vTip;float base=.53+.47*smoothstep(0.,.8,p1Tip),');
 source=source.replace('vec3 albedo=vColour.rgb*base*tips;','vec3 albedo=(uTier==2?p1Colour.rgb*clamp(vCanopyWet,.80,1.02):vColour.rgb)*base*tips;');
 return source;
}
API.install=async function(renderer){
 if(API.textures)throw Error('p1 already installed');
 const gl=renderer.gl,manifest=await(await fetch('prototype/atlas.json')).json(),textures=[];
 for(const name of ['colour.rgba','normal.rgba']){
  const bytes=new Uint8Array(await(await fetch('prototype/'+name)).arrayBuffer());
  const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,manifest.size[0],manifest.size[1],0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  let w=manifest.size[0],h=manifest.size[1];do{API.atlasGpuBytes+=w*h*4;w=Math.floor(w/2);h=Math.max(1,Math.floor(h/2));}while(w>=1);
 }
 API.textures=textures;API.atlas=manifest;
 API.prototype=E.createPrototype({id:'meadow-canopy-impostor-p1',vertices:[-1,-1,0,0,0,1,1,-1,0,0,0,1,1,1,0,0,0,1,-1,1,0,0,0,1],indices:[0,1,2,0,2,3],wind:true,roughness:.88});
 const pass=renderer.environment,oldBytes=pass.vegetationAllocatedBytes.bind(pass);
 // residentPrototype uploads ELEMENT_ARRAY_BUFFER. Create the new geometry
 // with no VAO bound, before any draw can leave a near family's VAO active.
 // Late allocation during a mode switch otherwise overwrites that VAO's index.
 gl.bindVertexArray(null);pass.residentPrototype(API.prototype,0);
 pass.vegetationAllocatedBytes=()=>oldBytes()+API.atlasGpuBytes;
 const oldRepresentation=GPU.PersistentRecords.prototype.representationPrototype;
 GPU.PersistentRecords.prototype.representationPrototype=function(prototype,variant){return API.mode==='p1'&&prototype.id==='meadow-volume-clump-f2'?API.prototype:oldRepresentation.call(this,prototype,variant);};
 const oldKey=pass.vegetationProgramKey.bind(pass);
 pass.vegetationProgramKey=function(variant,backend){
  const key=oldKey(variant,backend);if(API.mode!=='p1'||variant!=='foliage2')return key;
  const p1key='p1-'+key;if(!this.programs[p1key])this.programs[p1key]=program(gl,vertex(),fragment());return p1key;
 };
 const oldUniforms=pass.setResidentUniforms.bind(pass);
 pass.setResidentUniforms=function(p,...args){
  const result=oldUniforms(p,...args),u=p.uniforms;
  if(u.uP1Colour!=null){gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,textures[0]);gl.uniform1i(u.uP1Colour,13);gl.activeTexture(gl.TEXTURE14);gl.bindTexture(gl.TEXTURE_2D,textures[1]);gl.uniform1i(u.uP1Normal,14);gl.activeTexture(gl.TEXTURE0);}
  return result;
 };
 const dispose=pass.dispose.bind(pass);pass.dispose=function(){for(const t of textures)gl.deleteTexture(t);API.atlasGpuBytes=0;API.textures=null;dispose();};
 gl.activeTexture(gl.TEXTURE0);
 return {profile:API.profile,revision:API.revision,atlasGpuBytes:API.atlasGpuBytes,atlas:manifest,geometry:{vertices:4,triangles:2},savedSceneSchema:'Production schema unchanged; isolated overlay is not imported/promoted'};
};
API.select=function(mode){if(!['baseline','p1'].includes(mode))throw Error('Unknown prototype mode');API.mode=mode;};
API.sources={vertex,fragment};root.SphereMeadowPrototype=API;
})(window);
