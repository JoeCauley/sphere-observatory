import {CELL,PLINTH,CURB} from './ground.js';

export const COMMON = `uniform vec3 uRight,uUp,uForward;uniform float uAspect,uAltitude,uFocal;
uniform vec3 SUN,uSkyLo,uSkyHi;uniform vec4 uLight;   // destination-light.mjs: x ambient, y direct gain, w star disc
vec3 sky(vec3 d){float t=clamp(d.y*.5+.5,0.,1.);vec3 c=mix(uSkyLo,uSkyHi,smoothstep(.45,.95,t));return c+vec3(1.,.85,.6)*pow(max(dot(normalize(d),SUN),0.),90.)*.5*uLight.w;}
uniform vec4 uHaze[2];uniform vec3 uBlind;uniform float uTime;
float through(vec4 L,float dy,float t){float y=uAltitude,y1=y+dy*t,lo=min(y,y1),hi=max(y,y1);   // length of the ray inside one level layer
 return hi-lo<1e-3?(y>=L.x&&y<=L.y?t:0.):t*max(0.,min(hi,L.y)-max(lo,L.x))/(hi-lo);}
float fogOf(float dist,float dy){float tau=0.;for(int i=0;i<2;i++)tau+=uHaze[i].z*through(uHaze[i],dy,dist);return 1.-exp(-tau);}
vec3 veiled(vec3 col,vec3 d){if(uBlind.z<=0.)return col;float v=smoothstep(uBlind.x-uBlind.z,uBlind.x,uAltitude)*(1.-smoothstep(uBlind.y,uBlind.y+uBlind.z,uAltitude));if(v<=0.)return col;
 vec3 q=d*3.+vec3(uTime*.05,uAltitude*.004,uTime*.03);float n=.5+.5*sin(q.x*2.1+sin(q.z*1.7+q.y))*sin(q.y*1.3+q.z*2.3);   // wisps that stream past as the eye climbs
 return mix(col,mix(vec3(.80,.78,.76),vec3(.95,.93,.90),n),smoothstep(0.,1.,v*1.5-.5*n));}`;
// The far field. Not a painting of the city: the city itself, traced per pixel from the
// same function that builds the meshes (same hash, same plinths, tiers, doors, towers).
// A ray is stepped through the street grid; each cell it crosses is rebuilt and intersected.
// Because near and far are one function there is nowhere for a building to pop in. Where a
// building would be smaller than a pixel it fades into the average of its block.
export const cityPlaneShaders = [`#version 300 es
precision highp float;${COMMON}
out vec2 vNdc;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;vNdc=p;gl_Position=vec4(p,0.,1.);}`,
`#version 300 es
precision highp float;precision highp int;in vec2 vNdc;out vec4 frag;
uniform ivec2 uCell;uniform vec2 uLocal;uniform int uMesh;uniform float uPix;${COMMON}
uniform vec4 uSurvey,uSurveyAxes,uDoors,uClearance;uniform float uApronRun;uniform float uFarM;
bool reservedBlock(ivec2 ij){
 if(uSurvey.w<=0.)return false;
 vec2 delta=vec2(ij)*${CELL}.-uLocal;
 vec2 station=uSurvey.xy+vec2(dot(delta,uSurveyAxes.xy),dot(delta,uSurveyAxes.zw));
 vec2 pad=${PLINTH}.*vec2(dot(abs(uSurveyAxes.xy),vec2(1.)),dot(abs(uSurveyAxes.zw),vec2(1.)));
 if(abs(station.x)<=uSurvey.z+pad.x && abs(station.y)<=uSurvey.w+pad.y)return true;
 return abs(station.y)<=uSurvey.w+uApronRun+pad.y && any(lessThanEqual(abs(vec4(station.x)-uDoors),uClearance+pad.x));
}
const float CELL=${CELL}.,PL=${PLINTH}.,CURB=${CURB},HMAX=262.;
const vec3 STONE[4]=vec3[4](vec3(.78,.62,.52),vec3(.72,.56,.50),vec3(.80,.70,.58),vec3(.66,.58,.55));
const vec3 ROOF[3]=vec3[3](vec3(.34,.52,.50),vec3(.42,.36,.44),vec3(.55,.40,.30));
const vec3 DARK=vec3(.06,.05,.06),WATER=vec3(.10,.36,.40),STREET=vec3(.50,.44,.40),FLAT=vec3(.70,.57,.50),MEAN=vec3(.65,.56,.50);
float hsh(ivec2 c,int k){uint h=uint(c.x)*374761393u^uint(c.y)*668265263u^uint(k)*2246822519u;h=(h^(h>>13u))*1274126177u;h^=h>>16u;return min(float(h)/4294967296.,.9999999);}
float bt;vec3 bn,bc;   // nearest hit so far: distance, normal, colour
void tryBox(vec3 o,vec3 d,vec3 inv,vec3 lo,vec3 hi,vec3 side,vec3 top){
 vec3 a=(lo-o)*inv,b=(hi-o)*inv,t0=min(a,b),t1=max(a,b);float tn=max(max(t0.x,t0.y),t0.z),tf=min(min(t1.x,t1.y),t1.z);
 if(tn>tf||tn<0.||tn>=bt)return;
 bt=tn;if(tn==t0.y){bn=vec3(0.,-sign(d.y),0.);bc=d.y<0.?top:side;}else if(tn==t0.x){bn=vec3(-sign(d.x),0.,0.);bc=side;}else{bn=vec3(0.,0.,-sign(d.z));bc=side;}
}
void towerHit(ivec2 c,vec3 o,vec3 d,vec3 inv,vec3 stone,vec3 shade,vec3 roof){
 if(hsh(c,8)<.22){   // tower: a shaft and a cap
  float r=13.+hsh(c,9)*7.,tx=(hsh(c,10)<.5?-1.:1.)*(PL-r-3.),tz=(hsh(c,11)<.5?-1.:1.)*(PL-r-3.),top=CURB+80.+hsh(c,12)*90.;
  vec2 q=o.xz-vec2(tx,tz);float a=dot(d.xz,d.xz),b=dot(q,d.xz),disc=b*b-a*(dot(q,q)-r*r);
  if(disc>0.){float t=(-b-sqrt(disc))/a,py=o.y+d.y*t;if(t>0.&&t<bt&&py>=CURB&&py<=top){vec2 p=q+d.xz*t;float ang=atan(p.y,p.x);if(ang<0.)ang+=6.2831853;float i=floor(ang/.5235988),mid=(i+.5)*.5235988;bt=t;bn=vec3(cos(mid),0.,sin(mid));bc=mod(i,2.)>.5?stone:shade;}}
  vec3 qa=o-vec3(tx,top+r*.5,tz);float ca=a-4.*d.y*d.y,cb=dot(qa.xz,d.xz)-4.*qa.y*d.y,cd=cb*cb-ca*(dot(qa.xz,qa.xz)-4.*qa.y*qa.y);
  if(cd>0.&&abs(ca)>1e-9){float sq=sqrt(cd);for(int m=0;m<2;m++){float t=(-cb+(m==0?-sq:sq))/ca,yy=qa.y+d.y*t;if(t>0.&&t<bt&&yy<=0.&&yy>=-r*.5){vec3 p=qa+d*t;bt=t;bn=normalize(vec3(p.x,-4.*p.y,p.z));bc=roof;}}}
 }
}
void cellHit(ivec2 ij,vec3 o,vec3 d,vec3 inv,bool far){   // o is measured from this cell's centre; far keeps the tower only
 if(reservedBlock(ij))return;
 ivec2 c=uCell+ij;float k=hsh(c,1);
 vec3 stone=STONE[min(3,int(hsh(c,13)*4.))],roof=ROOF[min(2,int(hsh(c,14)*3.))],shade=stone*.86;
 bool pool=k<.10;
 if(far){if(k>=.19&&!pool)towerHit(c,o,d,inv,stone,shade,roof);return;}
 if(k>=.10&&k<.19){   // plaza: resting rails and a marker
  for(int i=-1;i<=1;i++){float x=float(i)*46.;tryBox(o,d,inv,vec3(x-14.,0.,-1.2),vec3(x-12.,7.,1.2),shade,shade);tryBox(o,d,inv,vec3(x+12.,0.,-1.2),vec3(x+14.,7.,1.2),shade,shade);tryBox(o,d,inv,vec3(x-15.,7.,-1.6),vec3(x+15.,8.2,1.6),roof,roof);}
  tryBox(o,d,inv,vec3(-4.,0.,34.),vec3(4.,22.,42.),stone,roof);return;}
 float was=bt;
 tryBox(o,d,inv,vec3(-PL,0.,-PL),vec3(PL,CURB,PL),shade,pool?shade:stone);
 if(pool&&bt<was&&bn.y>.5){vec3 p=o+d*bt;if(abs(p.x)<PL-6.&&abs(p.z)<PL-6.)bc=WATER;}
 for(int m=0;m<4;m++){   // the four ramps
  float sg=m<2?1.:-1.;bool ax=(m&1)==0;float ou=ax?o.x:o.z,du=ax?d.x:d.z,ov=ax?o.z:o.x,dv=ax?d.z:d.x,den=d.y+sg*CURB*du/9.;
  if(abs(den)<1e-9)continue;float t=(CURB*(PL+9.-sg*ou)/9.-o.y)/den;if(t<=0.||t>=bt)continue;
  float u=sg*(ou+du*t),v=ov+dv*t;if(u<PL||u>PL+9.||abs(v)>10.)continue;
  bt=t;bn=normalize(ax?vec3(sg*CURB/9.,1.,0.):vec3(0.,1.,sg*CURB/9.));bc=stone*.94;}
 if(pool)return;
 float w=34.+hsh(c,2)*24.,dd=26.+hsh(c,3)*30.,h=14.+hsh(c,4)*16.;
 float cx=(hsh(c,5)-.5)*(PL-w)*1.2,cz=(hsh(c,6)-.5)*(PL-dd)*1.2;int tiers=1+int(hsh(c,7)*3.);
 float x0=cx-w,x1=cx+w,z0=cz-dd,z1=cz+dd,y=CURB;
 for(int t=0;t<3;t++){if(t>=tiers)break;float th=h/float(t+1);was=bt;
  tryBox(o,d,inv,vec3(x0,y,z0),vec3(x1,y+th,z1),t==1?shade:stone,roof);
  if(t==0&&bt<was&&bn.y==0.){vec3 p=o+d*bt;   // doors: wider than tall
   if(p.y-y<min(9.,th-2.)){if(bn.z!=0.){if(abs(p.x-(x0+x1)*.5)<min(11.,(x1-x0)*.5-3.))bc=DARK;}else if(abs(p.z-(z0+z1)*.5)<min(11.,(z1-z0)*.5-3.))bc=DARK;}}
  y+=th;float inset=min(x1-x0,z1-z0)*.16;x0+=inset;x1-=inset;z0+=inset;z1-=inset;}
 towerHit(c,o,d,inv,stone,shade,roof);
}
void main(){vec3 d=normalize(uForward+uRight*vNdc.x*uAspect/uFocal+uUp*vNdc.y/uFocal);
 if(abs(d.x)<1e-6)d.x=1e-6;if(abs(d.z)<1e-6)d.z=1e-6;if(abs(d.y)<1e-6)d.y=-1e-6;
 vec3 inv=1./d,o=vec3(uLocal.x,uAltitude,uLocal.y);
 float tG=d.y<0.?uAltitude/-d.y:1e12;                                  // where the ray meets the street
 float tIn=o.y>HMAX?(d.y<0.?(o.y-HMAX)/-d.y:1e12):0.;                  // where it enters the layer that holds buildings
 float tOut=d.y>0.?(o.y<HMAX?(HMAX-o.y)/d.y:0.):tG,tLim=30./uPix;      // beyond tLim a pixel is wider than a block
 bt=1e12;
 if(tIn<tOut&&tIn<tLim){
  vec3 p=o+d*tIn;vec2 cf=floor((p.xz+100.)/CELL),stp=sign(d.xz);ivec2 ij=ivec2(cf),si=ivec2(stp);
  vec2 tMax=((cf+max(stp,0.))*CELL-100.-o.xz)*inv.xz,tDelta=CELL*abs(inv.xz);float tCell=tIn;
  for(int n=0;n<96;n++){
   if(max(abs(ij.x),abs(ij.y))>uMesh){cellHit(ij,o-vec3(float(ij.x)*CELL,0.,float(ij.y)*CELL),d,inv,uFarM>0.&&tCell>uFarM);if(bt<1e11)break;}
   float tNext=min(tMax.x,tMax.y);if(tNext>tOut||tNext>tLim)break;tCell=tNext;
   if(tMax.x<tMax.y){tMax.x+=tDelta.x;ij.x+=si.x;}else{tMax.y+=tDelta.y;ij.y+=si.y;}
  }
 }
 if(bt>1e11&&d.y>-.0005){frag=vec4(pow(veiled(sky(d),d),vec3(1./2.2)),1.);gl_FragDepth=1.;return;}
 float up1=uLight.x+uLight.y*SUN.y+.10,t=bt<1e11?bt:tG;vec3 col;
 if(bt<1e11)col=bc*(uLight.x+uLight.y*max(dot(bn,SUN),0.)+.10*max(bn.y,0.));
 else{vec2 g=d.xz*tG+uLocal,l=abs(fract(g/CELL+.5)-.5)*CELL;float k=hsh(uCell+ivec2(floor(g/CELL+.5)),1);col=(k>=.10&&k<.19&&max(l.x,l.y)<PL?FLAT:STREET)*up1;}
 if(d.y<0.){   // too small to draw honestly: become the average of the block
  vec2 g=d.xz*tG+uLocal,l=abs(fract(g/CELL+.5)-.5)*CELL;float width=tG*uPix+.5,block=1.-smoothstep(PL-width,PL+width,max(l.x,l.y));
  col=mix(col,mix(STREET,MEAN,block)*up1,smoothstep(6.,30.,t*uPix));}
 col=veiled(mix(col,sky(d*vec3(1.,.15,1.)),fogOf(t,d.y)),d);
 gl_FragDepth=clamp(log2(1.+t)/log2(1.+400000.),0.,1.);frag=vec4(pow(col,vec3(1./2.2)),1.);}`];

// Light uniforms shared by the doorway exterior and the walkable City (destination-light.mjs).
export function lightUniforms(gl,u,L){gl.uniform3fv(u.SUN,L.sun);gl.uniform4fv(u.uLight,L.light);gl.uniform3fv(u.uSkyLo,L.skyLo);gl.uniform3fv(u.uSkyHi,L.skyHi);}
