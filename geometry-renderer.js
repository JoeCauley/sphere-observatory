/* Camera-relative triangle pass sharing logarithmic ray-distance depth with analytic bodies. */
(function(){
'use strict';const M=SphereMath;
function program(gl,vs,fs){const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));const u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name);}return {p,u};}
const vertex=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;layout(location=1)in vec3 normal;layout(location=2)in vec3 albedo;layout(location=3)in float material;layout(location=4)in float emission;
uniform vec3 uOriginRelative,uMeshX,uMeshY,uMeshZ,uForward,uRight,uUp;uniform float uFov;uniform vec2 uResolution;
out vec3 vRelative,vNormal,vAlbedo,vLocal,vLocalNormal;flat out float vMaterial,vEmission;
void main(){vec3 p=uOriginRelative+position.x*uMeshX+position.y*uMeshY+position.z*uMeshZ;vRelative=p;vNormal=normal.x*uMeshX+normal.y*uMeshY+normal.z*uMeshZ;vLocalNormal=normal;vAlbedo=albedo;vMaterial=material;vEmission=emission;vLocal=position;float z=dot(p,uForward),t=tan(uFov*.5);gl_Position=vec4(dot(p,uRight)/t,dot(p,uUp)/t*uResolution.x/uResolution.y,z-.00002,z);}
`;
class GeometryRenderer{
 constructor(gl){this.gl=gl;this.meshes=new Map();
  const fragment=SphereShaders.geometryFragment||SphereShaders.fragment,shared=fragment.slice(0,fragment.lastIndexOf('void main(){')).replace('in vec2 vUV;','');
  this.main=program(gl,vertex,shared+`
in vec3 vRelative,vNormal,vAlbedo,vLocal,vLocalNormal;flat in float vMaterial,vEmission;
uniform float uSiteLight,uDetailFeature,uPixelFocal;uniform int uMaterialPlate,uStructureMaterial;uniform vec3 uMaterialOffset,uMaterialX,uMaterialY,uMaterialZ;uniform vec3 uSiteFill;
vec3 fieldGround(int id,vec3 p,float footprint){vec3 col=WORLD_ALBEDO[id];float n=noise(p*35.)*.60+noise(p*110.)*.4;
 if(id==0||id==1)col=mix(vec3(.032,.024,.013),col*.85,n);
 else if(id==4)col=mix(col*.55,col*1.45,n);
 else col*=.66+.68*n;
 float small=1.-smoothstep(.0002,.001,footprint);float pebbles=noise(p*2100.)*.65+noise(p*7300.)*.35;col*=mix(1.,.72+.56*pebbles,small);
 if(id==5){vec2 tile=p.xz/.012;float seams=panelLine(tile,max(.0001,footprint/.012));col*=1.-seams*.65;}
 if(id==8||id==9){float veins=pow(1.-abs(noise(p*400.)*2.-1.),16.);col+=WORLD_ALBEDO[id]*veins*.5*small;}
 return col;}
void main(){float distanceKm=length(vRelative);if(uDetailFeature>0.){float coverage=smoothstep(.45,1.2,uDetailFeature*uPixelFocal/max(.00001,distanceKm));if(fract(dot(gl_FragCoord.xy,vec2(.754877666,.569840296)))>coverage)discard;}gl_FragDepth=clamp(log2(1.+distanceKm)/log2(1.+4.*uRadius),0.,1.);if(uMode==2){fragColor=vec4(0.,.75,0.,1.);return;}if(uMode==4||uMode==5){fragColor=vec4(0,0,0,1);return;}vec3 n=normalize(vNormal);if(dot(n,vRelative)>0.)n=-n;vec3 q=normalize(camera()+vRelative/uRadius),delta=vRelative-uN*(uH*uRadius),col=vAlbedo;
 if(vMaterial>=20.){int id=int(vMaterial)-20;if(uTextureDetail==1&&uHeroReady[id]>.001){vec3 tri=pow(abs(vLocalNormal),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);col=mix(col,sampleSurface(uHeroTex,float(id),vLocal/2.5,tri,dFdx(vLocal)/2.5,dFdy(vLocal)/2.5,false),uHeroReady[id]);}}
 else if(vMaterial== -4.){float fw=max(length(dFdx(vLocal)),length(dFdy(vLocal)));vec3 weights=pow(abs(vLocalNormal),vec3(8.));weights/=max(.00001,weights.x+weights.y+weights.z);float seams=weights.x*panelLine(vLocal.yz/.12,fw/.12)+weights.y*panelLine(vLocal.xz/.12,fw/.12)+weights.z*panelLine(vLocal.xy/.12,fw/.12);col*=.72+.48*noise(vLocal*2.);col*=1.-seams*.55;float fine=weights.x*panelLine(vLocal.yz/.008,fw/.008)+weights.y*panelLine(vLocal.xz/.008,fw/.008)+weights.z*panelLine(vLocal.xy/.008,fw/.008);col*=1.-fine*.2;}
 else if(vMaterial>=13.&&vMaterial<=14.&&uMaterialPlate>=0){vec2 uv=uShadeUVAnchor[uMaterialPlate]+vec2(dot(vRelative,uShadeUVRight[uMaterialPlate]),dot(vRelative,uShadeUVUp[uMaterialPlate]))/1.2;col=shadeSkin(uv,int(vMaterial)-10,distanceKm);}
 else if(vMaterial>=13.&&uWorldTexturesReady==1&&uTextureDetail==1){vec3 tri=pow(abs(vLocalNormal),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);col=sampleSurface(uEngineering,vMaterial-10.,vLocal/6.,tri,dFdx(vLocal)/6.,dFdy(vLocal)/6.,false);}
 else if(vMaterial>=0.){float footprint=max(length(dFdx(delta)),length(dFdy(delta)));col=worldDetail(int(vMaterial),q,delta,footprint,distanceKm);if(vMaterial<10.&&distanceKm<.12)col=mix(col,fieldGround(int(vMaterial),vLocal,footprint),1.-smoothstep(.05,.12,distanceKm));}
 if(vMaterial== -3.){vec3 p=vec3(dot(vRelative,uMaterialX),dot(vRelative,uMaterialY),dot(vRelative,uMaterialZ))+uMaterialOffset;float fw=max(length(dFdx(p)),length(dFdy(p)));
  float ribs=constructionRib(p.x,.18,fw),seams=constructionRib(p.y,.065,fw);
  float grain=noise(p*vec3(1.8,5.,1.8))*.6+noise(p*vec3(12.,2.,12.))*.4;col*=.76+.46*grain;
  col*=1.-ribs*.25-seams*.15;
  float veins=pow(1.-abs(noise(p*vec3(3.,.4,3.))*2.-1.),12.);col=mix(col,col*vec3(1.22,.98,.76),veins*.26);
  if(uWorldTexturesReady==1&&uTextureDetail==1){vec2 uv=p.xy/1.2;vec3 tex=stochasticTile(uEngineering,uv,2.,dFdx(uv),dFdy(uv));col*=mix(vec3(1.),clamp(tex/vec3(.071,.075,.075),vec3(.65),vec3(1.45)),.25*(1.-smoothstep(.05,.20,fw)));}
  // Carry the matching ground deposit over the first forty metres of the lip,
  // then reveal the existing exposed structural strata. Rationalized radial
  // depth avoids subtracting two AU-sized floats and follows the curved wall.
  float radial=2.*dot(uN,delta)+dot(delta,delta)/uRadius;
  float depth=max(0.,radial/(sqrt(max(0.,1.+radial/uRadius))+1.));
  float lip=1.-smoothstep(0.,.04,depth);
  if(lip>.001){vec3 r=worldRegion(q),edge=woundDetail(int(r.x),q,delta,fw,distanceKm);if(r.z>.001&&r.x!=r.y)edge=mix(edge,woundDetail(int(r.y),q,delta,fw,distanceKm),r.z);col=mix(col,edge,lip);}
 }

 float micro=noise(vLocal*400.)*.6+noise(vLocal*1700.)*.4,footprint=max(length(dFdx(vLocal)),length(dFdy(vLocal)));if(uStructureMaterial==0)col*=mix(1.,.90+.20*micro,1.-smoothstep(.001,.005,footprint));
 vec3 light=-q;float cosine=max(0.,dot(n,light)),shadow=structureShadow(vRelative,n);vec3 view=-normalize(vRelative),halfway=normalize(light+view);float spec=pow(max(0.,dot(n,halfway)),32.)*.018;
 vec3 radiance=col*(uSiteFill*(.45+.55*max(0.,dot(n,-uN)))+uSiteLight*uLuminosity/max(.01,dot(camera()+vRelative/uRadius,camera()+vRelative/uRadius))*cosine*shadow)+vec3(spec*uSiteLight*shadow)+col*vEmission;
 if(uStructureMaterial==1&&uRichMaterials==1){
  vec3 p=vec3(dot(vRelative,uMaterialX),dot(vRelative,uMaterialY),dot(vRelative,uMaterialZ))+uMaterialOffset;
  vec3 tri=pow(abs(vec3(dot(n,uMaterialX),dot(n,uMaterialY),dot(n,uMaterialZ))),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);
  Finish finish=finishAt(n,vRelative,p,tri,vMaterial== -3.?2:3);
  if(vMaterial>=13.&&vMaterial<=14.&&uMaterialPlate>=0){vec2 uv=uShadeUVAnchor[uMaterialPlate]+vec2(dot(vRelative,uShadeUVRight[uMaterialPlate]),dot(vRelative,uShadeUVUp[uMaterialPlate]))/1.2;finish=shadeFinish(n,vRelative,uv,int(vMaterial)-10,uMaterialPlate);}
  float direct=uSiteLight*uLuminosity/max(.01,dot(camera()+vRelative/uRadius,camera()+vRelative/uRadius));
  radiance=finishLighting(col,finish,n,light,view,uSiteFill,direct*shadow)+col*vEmission;
 }
 if(uMode==1){float f=clamp(log(1.+distanceKm/uRadius*1e6)/log(2000001.),0.,1.);radiance=mix(vec3(.05,.6,.51),vec3(.25,.12,.45),f);}
 fragColor=vec4(uLinearOutput==1?clamp(radiance,vec3(0.),vec3(60000.)):tone(radiance),1.);}
`);
 }
 upload(mesh){if(this.meshes.has(mesh))return this.meshes.get(mesh);const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);for(const [loc,size,offset]of[[0,3,0],[1,3,3],[2,3,6],[3,1,9],[4,1,10]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,44,offset*4);}gl.bindVertexArray(null);const result={vao,buffer};this.meshes.set(mesh,result);return result;}
 draw(s,renderer,linear,width,height){const groups=s.geometryDetail&&s.layoutVersion===2&&s.collection&&s.projection!=='panorama'?SphereSites.geometry(s):[],gl=this.gl;
  // Release retired chunks even when the camera leaves the detail region entirely.
  for(const [m,b]of this.meshes)if(!groups.includes(m)){gl.deleteVertexArray(b.vao);gl.deleteBuffer(b.buffer);this.meshes.delete(m);}
  if(!groups.length)return;
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.CULL_FACE);
  gl.viewport(0,0,width,height);gl.useProgram(this.main.p);
  const u=this.main.u,f=(k,v)=>gl.uniform1f(u[k],v),i=(k,v)=>gl.uniform1i(u[k],v),v=(k,a)=>gl.uniform3fv(u[k],a),n=M.norm(s.position),b=M.basis(s.forward,s.up);
  v('uN',n);v('uForward',b.f);v('uRight',b.r);v('uUp',b.u);f('uH',(s.radius-M.length(s.position))/s.radius);f('uRadius',s.radius);f('uFov',M.radians(s.fov));f('uLuminosity',s.luminosity*(M.AU/s.radius)**2);f('uExposure',s.exposure);f('uSeed',s.seed);gl.uniform2f(u.uResolution,width,height);i('uLinearOutput',linear?1:0);i('uTextureDetail',s.textureDetail?1:0);i('uSurfaceRelief',s.surfaceRelief?1:0);i('uMode',s.viewMode==='objectid'?2:s.viewMode==='distance'?1:0);
  gl.uniform3fv(u['uAnchor[0]'],[1000000,100000,10000,1000,100,10,1,.1,.01,.001].flatMap(scale=>n.map(x=>((x*s.radius/scale)%256+256)%256)));v('uHeroAnchor',SphereBiomes.heroAnchors(n,s.radius));gl.uniform3fv(u['uBiomeAnchor[0]'],SphereBiomes.anchors(n,s.radius));renderer.biomes?.bind(u,true);renderer.heroes?.bind(u,true);renderer.worldTextures?.bind(u);SphereWorld.upload(gl,u,s);
  renderer.woundTextures?.bind(u,true);renderer.finishes.bind(u,s);renderer.localShadows.bind(u,s);
  const lights=new Map();let triangles=0;for(const mesh of groups){const buffer=this.upload(mesh);gl.bindVertexArray(buffer.vao);gl.uniform3fv(u.uOriginRelative,M.sub(mesh.origin,s.position));gl.uniform3fv(u.uMeshX,mesh.basis[0]);gl.uniform3fv(u.uMeshY,mesh.basis[1]);gl.uniform3fv(u.uMeshZ,mesh.basis[2]);gl.uniform1i(u.uStructureMaterial,mesh.plate||mesh.name.startsWith('Wound')?1:0);
   const lightKey=mesh.plate?'shade-'+mesh.plate.id:mesh.name.startsWith('Wound')?'rim':mesh;
   if(!lights.has(lightKey)){const lightPoint=M.add(mesh.origin,M.mul(mesh.basis[1],.01));lights.set(lightKey,SphereCollection.visibility(lightPoint,s,s.stationSamples||64,mesh.plate?.id??-1));}const direct=lights.get(lightKey);
   gl.uniform1f(u.uDetailFeature,mesh.detailFeature||0);gl.uniform1f(u.uPixelFocal,SphereEdges.focal(s));const materialFrame=mesh.materialFrame||(mesh.plate?[mesh.plate.right,mesh.plate.normal,mesh.plate.up]:mesh.basis);gl.uniform3fv(u.uMaterialOffset,materialFrame.map(b=>((M.dot(s.position,b)%76.8)+76.8)%76.8));gl.uniform3fv(u.uMaterialX,materialFrame[0]);gl.uniform3fv(u.uMaterialY,materialFrame[1]);gl.uniform3fv(u.uMaterialZ,materialFrame[2]);gl.uniform1i(u.uMaterialPlate,mesh.plate?SphereCollection.plates(s).findIndex(p=>p.id===mesh.plate.id):-1);
   gl.uniform1f(u.uSiteLight,direct);gl.uniform3fv(u.uSiteFill,renderer.frameFill.map(v=>v*(s.siteId.startsWith('exterior-')?.375:1)));gl.drawArrays(gl.TRIANGLES,0,mesh.count);triangles+=mesh.count/3;}
  gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);renderer.renderInfo.geometry={groups:groups.length,triangles,localShadow:renderer.localShadows.quality>0,materials:s.richMaterials!==false&&groups.some(m=>m.plate||m.name.startsWith('Wound'))?'roughness / metalness / normal':'simple'};
 }
 dispose(){const gl=this.gl;for(const b of this.meshes.values()){gl.deleteVertexArray(b.vao);gl.deleteBuffer(b.buffer);}gl.deleteProgram(this.main.p);}
}
window.SphereGeometryRenderer=GeometryRenderer;window.SphereGLProgram=program;
})();
