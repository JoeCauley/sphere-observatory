import {surfaceNoise,outfallMaterials} from '../../kit/outfall-wall.mjs';
import {BOULEVARD_M,DISTRICT_M,HEX_M,LANE_HALF_M} from './pod.js';
import {DATUM_M} from './facility.js';
import {PALETTES} from './works.js';

export const FIELD_OUT=4200,FIELD_IN=2950,DETAIL_OUT=360,DETAIL_IN=215;
const view=`
uniform vec3 uCamera,uRight,uUp,uForward;
uniform float uAspect;
vec4 project(vec3 d){
 float z=dot(d,uForward);
 return vec4(dot(d,uRight)*1.428148/uAspect,dot(d,uUp)*1.428148,z*1.00000002-.10,z);
}`;
export {view as viewProjection};
const depth=`gl_FragDepth=clamp(log2(1.+length(delta))/log2(1000001.),0.,1.);`;
const air=`vec3 air(vec3 c,float d){
 return mix(c,vec3(.47,.55,.54),1.-exp(-d/6400.));
}`;
export const meshVertex=`#version 300 es
precision highp float;
layout(location=0)in vec3 point;layout(location=1)in vec3 tint;layout(location=5)in vec3 norm;
layout(location=2)in vec4 instance;
uniform float uKit;
${view}
out vec3 color,normal,local,delta;
void main(){
 vec3 p=point,n=norm;local=point;
 if(uKit>.5){
  mat2 turn=mat2(instance.z,instance.w,-instance.w,instance.z);
  p.xz=turn*p.xz+instance.xy;
  p.y=${DATUM_M}.+(p.y-${DATUM_M}.)*length(instance.zw);
  n.xz=turn*n.xz/length(instance.zw);
 }
 color=tint;normal=n;delta=p-uCamera;gl_Position=project(delta);
}`;
export const detailVertex=`#version 300 es
precision highp float;
layout(location=0)in vec3 point;layout(location=5)in vec3 norm;
layout(location=1)in vec4 xAxis;layout(location=2)in vec4 yAxis;layout(location=3)in vec4 zAxis;
layout(location=4)in vec4 paint;
uniform float uRing;
${view}
out vec3 color,normal,local,delta;
void main(){
 vec3 q=point;
 if(uRing>.5)q=point+norm*paint.w;
 mat3 basis=mat3(xAxis.xyz,yAxis.xyz,zAxis.xyz);
 vec3 p=basis*q+vec3(xAxis.w,yAxis.w,zAxis.w);
 normal=normalize(xAxis.xyz*(norm.x/max(.000001,dot(xAxis.xyz,xAxis.xyz)))+
                  yAxis.xyz*(norm.y/max(.000001,dot(yAxis.xyz,yAxis.xyz)))+
                  zAxis.xyz*(norm.z/max(.000001,dot(zAxis.xyz,zAxis.xyz))));
 local=p;color=paint.rgb;delta=p-uCamera;gl_Position=project(delta);
}`;
export const materialFragment=`#version 300 es
precision highp float;
in vec3 color,normal,local,delta;out vec4 frag;
uniform float uLocal,uKit,uAge,uMSAA,uFarBase;
${surfaceNoise}${outfallMaterials}${air}
float stripe(float x,float width){float a=max(fwidth(x),.001);return (1.-smoothstep(width-a,width+a,abs(fract(x+.5)-.5)))*(1.-smoothstep(.16,.5,a));}
void main(){
 float d=length(delta);
 if(uFarBase>.5){
  if(d<19500.)discard;
  frag=vec4(pow(air(vec3(.32,.35,.33),d),vec3(.53)),1.);${depth}
  return;
 }
 float cover=uLocal>.5?uAge*(1.-smoothstep(${DETAIL_IN}.,${DETAIL_OUT}.,d)):uKit>.5?1.-smoothstep(${FIELD_IN}.,${FIELD_OUT}.,d):1.;
 if(cover<=0.||uMSAA<.5&&cover<1.&&fract(dot(floor(gl_FragCoord.xy),vec2(.75487767,.5698403)))>=cover)discard;
 vec3 n=normalize(normal),light=normalize(vec3(-.48,.81,-.33)),v=normalize(-delta);
 vec3 base=color;vec2 uv=abs(n.y)>.68?local.xz:(abs(n.x)>abs(n.z)?local.zy:local.xy);
 float footprint=max(fwidth(uv.x),fwidth(uv.y));
 if(d<185.){
  float relief=(1.-smoothstep(.07,.56,footprint))*(1.-smoothstep(125.,185.,d));
  float grains=outfallConcrete(uv);
  float raised=stripe(uv.x*.59,.023),courses=stripe(uv.y*.39,.012);
  float grille=outfallGrate(uv,footprint);
  float dark=1.-smoothstep(.09,.31,max(max(color.r,color.g),color.b));
  base*=mix(1.,mix(grains*(1.-courses*.21+raised*.09),grille*(.94+raised*.12),dark),relief);
 }
 float sun=max(0.,dot(n,light));
 float spec=pow(max(0.,dot(n,normalize(v+light))),27.)*(.075+.13*(1.-max(color.r,color.b)));
 vec3 lit=base*(.28+sun*.77+.14*max(n.y,0.))+vec3(spec);
 frag=vec4(pow(max(air(lit,d),vec3(0.)),vec3(.53)),cover);${depth}
}`;

export const floorVertex=`#version 300 es
precision highp float;
layout(location=0)in vec2 point;layout(location=2)in vec4 tile;layout(location=3)in vec4 spec;
${view}
out vec2 local;out vec3 delta;flat out vec4 district;flat out vec2 angle;
void main(){
 local=mat2(tile.z,-tile.w,tile.w,tile.z)*point;
 district=spec;angle=tile.zw;
 delta=vec3(tile.x+point.x,${DATUM_M}.-.012,tile.y+point.y)-uCamera;
 gl_Position=project(delta);
}`;
const vec=c=>'vec3('+c.map(v=>v.toFixed(3)).join(',')+')';
export const floorFragment=`#version 300 es
precision highp float;
in vec2 local;in vec3 delta;flat in vec4 district;flat in vec2 angle;out vec4 frag;
${surfaceNoise}${outfallMaterials}${air}
const float root=.866025403784;
vec2 cell(vec2 p,float w){
 float r=p.y/(root*w),q=p.x/w-r*.5;
 vec3 t=vec3(q,-q-r,r),v=floor(t+.5),e=abs(v-t);
 if(e.x>e.y&&e.x>e.z)v.x=-v.y-v.z;else if(e.y<=e.z)v.z=-v.x-v.y;return v.xz;
}
vec2 centre(vec2 qr,float w){return vec2(qr.x+.5*qr.y,root*qr.y)*w;}
float extent(vec2 p){return max(abs(p.x),max(abs(.5*p.x+root*p.y),abs(-.5*p.x+root*p.y)));}
float mark(float x,float halfW,float aa){return 1.-smoothstep(halfW,halfW+aa,abs(x));}
void main(){
 float d=length(delta),s=district.x,w=${HEX_M}.*s;
 vec2 qr=cell(local,w),off=local-centre(qr,w);
 // These are integer addresses. Floating mod can return nearly 7 for a negative multiple.
 int lattice=int(qr.x)-2*int(qr.y),slot=abs(lattice)%7;
 if(lattice<0)slot=(7-slot)%7;
 const vec2 ring[7]=vec2[7](vec2(0),vec2(1,0),vec2(0,-1),vec2(1,-1),vec2(-1,1),vec2(0,1),vec2(-1,0));
 vec2 core=qr-ring[slot],c=centre(core,w);
 vec2 oriented=mat2(angle.x,angle.y,-angle.y,angle.x)*c;
 bool built=extent(oriented)<=${DISTRICT_M/2-BOULEVARD_M/2}.-w*(1.+.57735026919);
 int heat=((4*int(core.x)-int(core.y))/7+int(district.y)+300)%3;
 vec3 concrete=vec3(.35,.35,.308);
 if(built && !(district.z>.5 && all(equal(qr,vec2(0))))){
  concrete=heat==0?${vec(PALETTES.ambient.ground)}:heat==1?${vec(PALETTES.hot.ground)}:${vec(PALETTES.cold.ground)};
  vec2 p=off/s;
  float across=min(abs(p.y),min(abs(root*p.x+.5*p.y),abs(root*p.x-.5*p.y)));
  float aa=clamp(d/(900.*s),.035,5.);
  float lane=mark(across,${LANE_HALF_M}.,aa);
  float edge=mark(extent(p)-75.,.5,aa),plaza=1.-smoothstep(10.,12.+aa,length(p));
  concrete*=1.-.19*max(lane,plaza)-.24*edge;
  float bay=smoothstep(25.,32.+aa,length(p))*(1.-smoothstep(63.,69.+aa,length(p)))*smoothstep(6.,9.+aa,across);
  concrete*=1.-.14*bay;
  float thin=1.-smoothstep(.18,1.25,aa);
  float line=mark(across-${LANE_HALF_M}.,.13,aa)*smoothstep(10.,14.,length(p))*thin;
  concrete=mix(concrete,vec3(.66,.48,.18),line*.85);
  if(d<140.){
   float meter=max(fwidth(p.x),fwidth(p.y));
   float grain=outfallConcrete(p),grate=outfallGrate(p,meter);
   float drain=mark(across-${LANE_HALF_M+1.15},.28,aa)*smoothstep(10.,14.,length(p));
   concrete*=mix(1.,grain,(1.-smoothstep(.11,.64,meter))*(1.-smoothstep(85.,140.,d)));
   concrete=mix(concrete,vec3(.115,.14,.14)*grate,drain*.8*thin);
  }
 }
 if(!built){
  // Both facing districts use the same tangent to their shared boundary.
  // Slabs, paired service drains and a broken centreline cross the clear strip.
  vec2 xy=mat2(angle.x,angle.y,-angle.y,angle.x)*local;
  vec3 proj=abs(vec3(xy.x,.5*xy.x+root*xy.y,-.5*xy.x+root*xy.y));
  vec2 tangent=proj.x>max(proj.y,proj.z)?vec2(0,1):proj.y>proj.z?vec2(-root,.5):vec2(-root,-.5);
  float along=dot(xy,tangent),edge=${DISTRICT_M/2}.-max(proj.x,max(proj.y,proj.z));
  float aa=clamp(max(fwidth(edge),d*.00048),.035,8.);
  float road=1.-smoothstep(13.,14.+aa,edge);
  concrete=mix(concrete,vec3(.195,.21,.205),road);
  concrete*=1.-.13*mark(edge-22.,2.,aa);
  float resolved=1.-smoothstep(.15,2.,aa);
  float drain=mark(edge-15.,.62,aa)*resolved;
  concrete=mix(concrete,vec3(.09,.12,.12),drain*.8);
  float dash=mark(edge,.16,aa)*(1.-smoothstep(2.7,3.+aa,abs(mod(along+6.,12.)-6.)));
  concrete=mix(concrete,vec3(.67,.47,.19),resolved*max(dash,.62*mark(edge-12.,.15,aa)));
  if(d<150.)concrete*=mix(1.,outfallConcrete(xy),resolved*(1.-smoothstep(95.,150.,d)));
 }
 vec3 lit=mix(concrete*.86,vec3(.32,.35,.33),smoothstep(12500.,19000.,d));
 frag=vec4(pow(air(lit,d),vec3(.53)),1.);${depth}
}`;

export const shadowVertex=`#version 300 es
precision highp float;
layout(location=2)in vec4 footprint;layout(location=3)in vec4 levels;layout(location=4)in float roundFoot;
${view}
out vec2 uv;flat out vec2 sweep,extent;flat out float rounded;out vec3 delta;
void main(){
 const vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(-1,1),vec2(1,1),vec2(-1,-1),vec2(1,1),vec2(1,-1));
 vec2 light=vec2(.48,.33)/.81,halfSize=levels.xy;
 mat2 turn=mat2(footprint.z,footprint.w,-footprint.w,footprint.z);
 vec2 localSweep=transpose(turn)*light*(levels.w-levels.z);
 vec2 q=corners[gl_VertexID]*(halfSize+.5*abs(localSweep)+vec2(.65))+.5*localSweep;
 vec2 xz=footprint.xy+light*levels.z+turn*q;
 uv=q/halfSize;sweep=localSweep/halfSize;extent=halfSize;rounded=roundFoot;
 delta=vec3(xz.x,${DATUM_M}.+.002,xz.y)-uCamera;gl_Position=project(delta);
}`;
export const shadowFragment=`#version 300 es
precision highp float;
in vec2 uv;flat in vec2 sweep,extent;flat in float rounded;in vec3 delta;
uniform float uAge;out vec4 frag;
void main(){
 float t=clamp(dot(uv,sweep)/max(dot(sweep,sweep),.001),0.,1.);
 vec2 q=abs(uv-sweep*t);float edge=rounded>.5?length(q):max(q.x,q.y);
 float softness=min(.85,.42/min(extent.x,extent.y))+fwidth(edge);
 float a=.23*uAge*(1.-smoothstep(.84-softness,1.+softness,edge))*(1.-smoothstep(140.,235.,length(delta)));
 if(a<.005)discard;frag=vec4(.10,.12,.13,a);${depth}
}`;
