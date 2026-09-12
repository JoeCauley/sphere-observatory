/* Extra primary rays only where an analytic Shade boundary crosses a pixel.
 * Eclipse visibility keeps its original geometry and stellar sample set. */
(function(){
'use strict';
const declarations=`
uniform int uSilhouetteSamples,uAAPass;
uniform sampler2D uAAMask;uniform vec2 uAAOffset;
layout(location=1)out vec4 silhouetteMask;
bool probingSilhouette=false;
float silhouetteDistance=1e20,pixelCone=0.;
// Conservative signed margins: negative is intact material. Divisors bound
// each fracture's slope; this is an AA work estimate, never a new shape test.
float shadeBoundaryMargin(vec2 p,int i,float footprint){
 float margin=uShadeShape==1?max(abs(p.x),abs(p.y))-1.:length(p)-1.;
 if(uShadeShape==3)margin=max(margin,abs(p.x)-uShadeTrim);
 if(uDiskNormals[i].w<.5)return margin;
 if(margin>footprint)return margin;
 if(footprint*18.>.14)return 0.; // Unresolved service holes need coverage samples throughout the plate.
 int id=int(uDiskRights[i].w),family=id%3;float u=p.x,v=p.y;
 if(family==0)margin=max(margin,min((u-.09-.055*sin(v*17.)-.017*sin(v*53.))/3.,v+.31));
 if(family==1)margin=max(margin,min((v-.13-.10*sin(u*12.))/2.3,u+.43));
 if(family==2)margin=max(margin,(u+.36*v-.20-.04*sin(v*31.))/2.7);
 margin=max(margin,(.013-abs(u+.27+.065*sin(v*11.)+.018*sin(v*41.)))/2.5);
 margin=max(margin,(.009-abs(v+.28+.052*sin(u*17.)+.011*sin(u*57.)))/2.6);
 vec2 cell=floor((p+1.)*18.),local=(p+1.)*18.-cell-.5;
 if(mod(cell.x*13.+cell.y*7.+float(id)*11.,37.)==0.)margin=max(margin,min(.29-abs(local.x),.34-abs(local.y))/18.);
 return margin;
}
void probeShadeBoundary(vec3 d,float t,vec3 hit,vec2 uv,int i){
 if(!probingSilhouette)return;
 vec3 normal=uShadeShape>=2?normalize(hit):uDiskNormals[i].xyz;
 float face=uShadeShape>=2?max(.001,dot(normal,uDiskNormals[i].xyz)):1.;
 vec2 p=uv/vec2(max(.001,uDiskAcross[i]),1.);
 float footprint=t*pixelCone*max(1.,length(p))/(max(.000001,abs(dot(d,normal)))*face*uDisks[i].w*min(1.,uDiskAcross[i]));
 if(abs(shadeBoundaryMargin(p,i,footprint))<=footprint) silhouetteDistance=min(silhouetteDistance,t);
}
`;
SphereShaders.geometryFragment=SphereShaders.fragment;
let source=SphereShaders.fragment.replace('out vec4 fragColor;','layout(location=0)out vec4 fragColor;');
source=source.replace('float primaryDiskHit(vec3 d,int i){',declarations+'\nfloat primaryDiskHit(vec3 d,int i){');
source=source.replace('if(primaryShadeSolid(uv,i,d*(t*uRadius)-uInspectRelative))return t;','probeShadeBoundary(d,t,hit,uv,i);if(primaryShadeSolid(uv,i,d*(t*uRadius)-uInspectRelative))return t;');
source=source.replace('void main(){',`void main(){
 silhouetteMask=vec4(0.);probingSilhouette=uSilhouetteSamples>1&&uMode==0&&uAAPass==0;silhouetteDistance=1e20;
 if(uAAPass>0){
  // A whole derivative quad must remain live while shading an edge. Testing
  // its four mask texels uniformly avoids undefined texture/normal derivatives.
  ivec2 base=ivec2(gl_FragCoord.xy)/2*2,top=textureSize(uAAMask,0)-1;
  float quadMask=max(max(texelFetch(uAAMask,min(base,top),0).r,texelFetch(uAAMask,min(base+ivec2(1,0),top),0).r),max(texelFetch(uAAMask,min(base+ivec2(0,1),top),0).r,texelFetch(uAAMask,min(base+ivec2(1,1),top),0).r));
  if(quadMask<.5)discard;
 }
 vec2 sampleUV=vUV+uAAOffset/uRasterSize;`);
source=source.replace('vec2 xy=(vUV*2.-1.);','vec2 xy=(sampleUV*2.-1.);');
source=source.replace('float ts=shellHit(d);','pixelCone=length(dFdx(d))+length(dFdy(d));\n float ts=shellHit(d);');
const final=source.lastIndexOf('}');
source=source.slice(0,final)+`
 if(uSilhouetteSamples>1&&uMode==0){
  if(uAAPass==0){float edgeDepth=log2(1.+max(0.,silhouetteDistance*uRadius))/log2(1.+4.*uRadius);
   float edge=silhouetteDistance<1e19&&edgeDepth<=gl_FragDepth+.000001?1.:0.;silhouetteMask=vec4(edge);
   if(edge>.5)fragColor.rgb=vec3(0.);
  }else{
   if(texelFetch(uAAMask,ivec2(gl_FragCoord.xy),0).r<.5)discard;
   fragColor.rgb/=float(uSilhouetteSamples);
  }
 }
`+source.slice(final);
SphereShaders.fragment=source;
window.SphereSilhouetteOffsets=[[-.375,-.125],[-.125,.375],[.125,-.375],[.375,.125],[-.375,.375],[-.125,-.375],[.125,.125],[.375,-.125]];
})();
