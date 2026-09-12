/* Shared local material response for analytic Shade skin and streamed geometry.
 * Finishes are original periodic data maps: tangent slopes, roughness, metalness.
 * All lengths below are kilometres. No lighting is painted into these maps. */
(function(){
'use strict';
const glsl=`
uniform int uRichMaterials,uLocalShadowQuality;
uniform highp sampler2DArray uFinish;
uniform sampler2D uStructureShadow;
uniform vec3 uShadowRight,uShadowUp,uShadowRay,uShadowCentre[2];
uniform vec4 uShadowScale; // near half-width, far half-width, half-depth, map resolution
uniform float uSunAngularRadius;

// A derivative frame also handles mirrored Shade coordinates and back faces.
vec3 finishSlope(vec3 n,vec3 p,vec2 uv,vec2 slope){
 vec3 a=dFdx(p),b=dFdy(p),c=cross(b,n),d=cross(n,a);vec2 x=dFdx(uv),y=dFdy(uv);
 vec3 t=c*x.x+d*y.x,bt=c*x.y+d*y.y;
 return (t*slope.x+bt*slope.y)*inversesqrt(max(1e-18,max(dot(t,t),dot(bt,bt))));
}
struct Finish { vec3 normal; float roughness; float metal; float occlusion; };
Finish finishAt(vec3 n,vec3 p,vec3 coordinates,vec3 weights,int family){
 Finish f;f.normal=n;f.roughness=family==2?.9:.7;f.metal=family==0?.025:family==2?.08:.5;f.occlusion=1.;
 if(uRichMaterials==0||uTextureDetail==0)return f;
 vec3 uv=coordinates/.064;vec4 data=vec4(0.);vec3 slope=vec3(0.);
 // Integer tile periods divide the 76.8 km CPU anchor period exactly.
 if(weights.x>.001){vec4 v=textureGrad(uFinish,vec3(uv.yz,float(family)),dFdx(uv.yz),dFdy(uv.yz));data+=v*weights.x;slope+=finishSlope(n,p,uv.yz,v.xy*2.-1.)*weights.x;}
 if(weights.y>.001){vec4 v=textureGrad(uFinish,vec3(uv.xz,float(family)),dFdx(uv.xz),dFdy(uv.xz));data+=v*weights.y;slope+=finishSlope(n,p,uv.xz,v.xy*2.-1.)*weights.y;}
 if(weights.z>.001){vec4 v=textureGrad(uFinish,vec3(uv.xy,float(family)),dFdx(uv.xy),dFdy(uv.xy));data+=v*weights.z;slope+=finishSlope(n,p,uv.xy,v.xy*2.-1.)*weights.z;}
 f.normal=uSurfaceRelief==1?normalize(n+slope*.55):n;f.roughness=clamp(data.z,.24,.98);f.metal=clamp(data.w,0.,.92);return f;
}
Finish shadeFinishGrad(vec3 n,vec2 uv,int layer,int index,vec2 gx,vec2 gy){
 int family=layer==3?0:1;Finish f;f.normal=n;f.roughness=.7;f.metal=family==0?.025:.5;f.occlusion=1.;
 if(uRichMaterials==0||uTextureDetail==0)return f;
 float fw=shadeFilterWidth(uv,gx,gy)*1.2,detail=1.-smoothstep(.001,.020,fw);
 // The final mip is a stable aggregate finish. Unreadable sub-metre slopes
 // must not acquire false detail from quantized AU-distance UV coordinates.
 vec4 mean=textureLod(uFinish,vec3(.5,.5,float(family)),8.),data=mean;
 if(detail>.0001)data=mix(mean,textureGrad(uFinish,vec3(uv*(1.2/.064),float(family)),gx*(1.2/.064),gy*(1.2/.064)),detail);
 if(uSurfaceRelief==1&&detail>.0001){
  vec3 x=uShadeUVRight[index],y=uShadeUVUp[index],t=x-n*dot(n,x),b=y-n*dot(n,y);
  t*=inversesqrt(max(1e-18,dot(t,t)));b*=inversesqrt(max(1e-18,dot(b,b)));
  f.normal=normalize(n+(t*(data.x*2.-1.)+b*(data.y*2.-1.))*(.55*detail));
 }
 f.roughness=clamp(data.z,.24,.98);f.metal=clamp(data.w,0.,.92);
 {vec2 km=uv*1.2;
  float seam=max(constructionRib(km.x,.005,fw),constructionRib(km.y,.02,fw));
  // Narrow recessed joints suppress indirect fill only; cast shadows remain geometric.
  f.occlusion=1.-seam*.28;f.roughness=mix(f.roughness,.90,seam*.5);
 }return f;
}
Finish shadeFinish(vec3 n,vec3 p,vec2 uv,int layer,int index){return shadeFinishGrad(n,uv,layer,index,dFdx(uv),dFdy(uv));}
float shadowFetch(vec2 uv,int cascade){vec2 px=vec2(1./uShadowScale.w);uv=clamp(uv,px*.5,1.-px*.5);return texture(uStructureShadow,vec2((uv.x+float(cascade))*.5,uv.y)).r;}
float structureCascade(vec3 relative,vec3 n,int cascade){
 float extent=cascade==0?uShadowScale.x:uShadowScale.y,texel=2.*extent/uShadowScale.w;
 float nl=clamp(dot(n,-uShadowRay),0.,1.);
 // World-unit normal bias, limited at grazing angles; independent of shell radius.
 vec3 p=relative-uShadowCentre[cascade]+n*texel*(.22+.60*(1.-nl));
 vec2 uv=vec2(dot(p,uShadowRight),dot(p,uShadowUp))/(2.*extent)+.5;
 float receiver=dot(p,uShadowRay)/(2.*uShadowScale.z)+.5-texel*.12/(2.*uShadowScale.z);
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))||receiver<=0.||receiver>=1.)return 1.;
 float blocked=0.,depth=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float z=shadowFetch(uv+vec2(x,y)*1.5/uShadowScale.w,cascade);if(z<receiver){depth+=z;blocked+=1.;}}
 float separation=blocked>0.?max(0.,receiver-depth/blocked)*2.*uShadowScale.z:0.;
 // Finite-star penumbrae grow with caster/receiver separation. Search is deliberately local.
 float radius=clamp(separation*uSunAngularRadius/texel,.75,uLocalShadowQuality==2?5.:3.);
 float result=0.,weight=0.;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  if(uLocalShadowQuality<2&&(abs(x)==2||abs(y)==2))continue;
  float limit=uLocalShadowQuality==2?2.:1.,w=(limit+1.-abs(float(x)))*(limit+1.-abs(float(y)));
  result+=w*step(receiver,shadowFetch(uv+vec2(x,y)*radius/(limit*uShadowScale.w),cascade));weight+=w;
 }return result/max(1.,weight);
}
float structureShadow(vec3 relative,vec3 n){
 if(uLocalShadowQuality==0)return 1.;
 vec3 p=relative-uShadowCentre[0];float a=max(abs(dot(p,uShadowRight)),abs(dot(p,uShadowUp)))/uShadowScale.x;
 vec3 q=relative-uShadowCentre[1];float b=max(abs(dot(q,uShadowRight)),abs(dot(q,uShadowUp)))/uShadowScale.y;
 if(b>=1.)return 1.;float farShadow=structureCascade(relative,n,1);
 float result=a<.86?structureCascade(relative,n,0):a<1.?mix(structureCascade(relative,n,0),farShadow,smoothstep(.86,1.,a)):farShadow;
 return mix(result,1.,smoothstep(.88,1.,b));
}
vec3 finishLighting(vec3 colour,Finish f,vec3 geometryNormal,vec3 light,vec3 view,vec3 fill,float direct){
 vec3 n=f.normal;float nl=max(0.,dot(n,light)),nv=max(.001,dot(n,view));
 // Perturbations cannot admit direct light through the back of an opaque surface.
 nl*=smoothstep(0.,.06,dot(geometryNormal,light));
 vec3 halfway=light+view,halfVector=halfway*inversesqrt(max(1e-12,dot(halfway,halfway)));float nh=max(0.,dot(n,halfVector)),vh=max(0.,dot(view,halfVector));
 vec3 f0=mix(vec3(.04),clamp(colour*3.4,vec3(.08),vec3(.75)),f.metal);
 vec3 fresnel=f0+(1.-f0)*pow(1.-vh,5.);
 float alpha=f.roughness*f.roughness,a2=alpha*alpha,d=nh*nh*(a2-1.)+1.;
 float distribution=a2/max(.0001,PI*d*d),k=(f.roughness+1.)*(f.roughness+1.)/8.;
 float visibility=1./max(.0001,4.*(nl*(1.-k)+k)*(nv*(1.-k)+k));
 vec3 diffuse=colour*(1.-f.metal)*(1.-fresnel);
 // The existing irradiance unit maps Lambert albedo 1 to radiance 1: BRDF * pi.
 vec3 sun=(diffuse+PI*distribution*visibility*fresnel)*nl*direct;
 // ShellShine is a coarse diffuse irradiance estimate, also used as a broad reflection proxy.
 vec3 environment=(colour*(1.-f.metal)+f0*(.24+.34*f.roughness))*fill*f.occlusion;
 return max(vec3(0.),sun+environment);
}
vec3 shadeLighting(vec3 colour,vec3 relative,vec3 outward,vec3 view,int index,int layer,vec3 fill,float direct){
 vec3 n=dot(outward,view)<0.?-outward:outward;
 vec2 uv,gx,gy;shadeUVFootprint(-view,outward,length(relative),index,uv,gx,gy);
 Finish f=shadeFinishGrad(n,uv,layer,index,gx,gy);
 float shadow=structureShadow(relative,n);vec3 light=-normalize(camera()+relative/uRadius);
 if(uRichMaterials==0)return colour*(fill+max(0.,dot(n,light))*direct*shadow);
 return finishLighting(colour,f,n,light,view,fill,direct*shadow);
}
`;
let source=SphereShaders.fragment;
source=source.replace('void main(){',glsl+'\nvoid main(){');
const old='col=shadeSurface(hit,d,diskIndex,tp*uRadius)*(fill+cosine*sunlight*uLuminosity/max(.001,dot(hit,hit)));';
if(!source.includes(old))throw Error('Shade material integration changed');
source=source.replace(old,'col=shadeLighting(shadeSurface(hit,d,diskIndex,tp*uRadius),d*(tp*uRadius),normal,-d,diskIndex,dot(d,normal)>0.?3:4,fill,sunlight*uLuminosity/max(.001,dot(hit,hit)));');
source=source.replace('uLuminosity*surfaceBumpLight+fill','uLuminosity*surfaceBumpLight*structureShadow(d*(ts*uRadius),-q)+fill');
SphereShaders.fragment=source;

function makeMaps(size=256){
 const data=new Uint8Array(size*size*4*4),wrap=(n,p)=>(n%p+p)%p;
 function noise(x,y,px,py,seed){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const hash=(a,b)=>{let h=Math.imul(wrap(a,px)+seed,374761393)^Math.imul(wrap(b,py)+seed,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
 }
 for(let layer=0;layer<4;layer++){
  const height=new Float32Array(size*size),weather=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x/size,v=y/size,seed=101+layer*713;
   const broad=noise(u*8,v*8,8,8,seed),medium=noise(u*32,v*32,32,32,seed+47),fine=noise(u*96,v*96,96,96,seed+139);
   const scratch=noise(u*128,v*8,128,8,seed+331),j=y*size+x;
   // Height in metres. Fracture faces expose aggregate; service metal has shallow directional scoring.
   height[j]=layer===0?.025*medium+.012*fine:layer===1?.055*scratch+.035*fine:layer===2?.55*broad+.30*medium+.14*fine:.15*medium+.07*fine+.04*scratch;
   weather[j]=broad*.65+medium*.35;
  }
  const at=(x,y)=>height[wrap(y,size)*size+wrap(x,size)],spacing=64/size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const w=weather[y*size+x],sx=Math.max(-.9,Math.min(.9,(at(x-1,y)-at(x+1,y))/(2*spacing))),sy=Math.max(-.9,Math.min(.9,(at(x,y-1)-at(x,y+1))/(2*spacing)));
   const rough=layer===0?.58+w*.23:layer===1?.40+w*.30:layer===2?.80+w*.16:.46+w*.35,metal=layer===0?.025:layer===1?.76-w*.40:layer===2?.035+w*.065:.80-w*.45;
   const j=((layer*size+y)*size+x)*4;data[j]=Math.round(127.5*(sx+1));data[j+1]=Math.round(127.5*(sy+1));data[j+2]=Math.round(rough*255);data[j+3]=Math.round(metal*255);
  }
 }return data;
}
class SurfaceFinishes{
 constructor(gl){this.gl=gl;this.texture=gl.createTexture();this.ready=false;
  gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.RGBA8,1,1,4);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,0,1,1,4,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(Array(4).fill([128,128,204,0]).flat()));gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.activeTexture(gl.TEXTURE0);
 }
 prepare(){if(this.ready)return;const gl=this.gl,size=256;gl.activeTexture(gl.TEXTURE10);gl.deleteTexture(this.texture);this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,9,gl.RGBA8,size,size,4);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,0,size,size,4,gl.RGBA,gl.UNSIGNED_BYTE,makeMaps(size));gl.generateMipmap(gl.TEXTURE_2D_ARRAY);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));gl.activeTexture(gl.TEXTURE0);this.ready=true;}
 bind(u,s){const gl=this.gl;gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.uniform1i(u.uFinish,10);gl.uniform1i(u.uRichMaterials,s.richMaterials!==false?1:0);gl.activeTexture(gl.TEXTURE0);}
 dispose(){this.gl.deleteTexture(this.texture);}
}
window.SphereSurfaceFinishes=SurfaceFinishes;
})();
