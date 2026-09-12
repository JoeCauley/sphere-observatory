/* Geography generated from the same province tables as the CPU. Legacy remains intact. */
(function(){
'use strict';const W=SphereWorld;
window.SphereLegacyShaders={...SphereShaders};
const constants=`
uniform int uLayout,uWorldTexturesReady,uSpaceEnvironment,uWreckage;
uniform vec3 uWorldAxis,uWorldRight,uWorldUp,uEngineeringAnchor;
uniform vec2 uShadeUVAnchor[18];uniform vec3 uShadeUVRight[18],uShadeUVUp[18];
vec3 shadeRayDx=vec3(0.),shadeRayDy=vec3(0.);
uniform vec2 uRasterSize;
uniform vec4 uDiskPrecision[18];uniform int uInspectDisk;uniform vec3 uInspectRelative;
uniform vec4 uInspectBase;uniform vec3 uInspectCanonical;
uniform int uRimIndex;uniform vec3 uRimRelative;uniform vec4 uRimBase;uniform float uRimRange;
uniform highp sampler2DArray uWoundTex;
uniform vec3 uWoundAnchor;uniform float uWoundReady[10];
uniform float uWaist,uTransition;
uniform highp sampler2DArray uEngineering;
float worldAsin(float x);float worldAtan2(float y,float x);
const vec3 WORLD_ALBEDO[16]=vec3[16](${W.palette.map(c=>'vec3('+c.join(',')+')').join(',')});
const vec3 WOUND_ALBEDO[10]=vec3[10](${W.woundPalette.map(c=>'vec3('+c.join(',')+')').join(',')});
const float WOUND_BAND=${W.woundBandKm.toFixed(1)},WOUND_TILE=${W.woundTileKm.toFixed(4)};
const float PROVINCE_EDGES[11]=float[11](${W.fractions.map(v=>Number(v).toFixed(6)).join(',')});
const int PROVINCES[30]=int[30](${W.provinces.flat().join(',')});
`;
const functions=`
// Range-reduced inverse trig avoids implementation-dependent native approximations at narrow borders.
float worldAsinSeries(float x){float t=x*x;return x*(1.+t*(.1666666666667+t*(.075+t*(.0446428571429+t*(.0303819444444+t*(.0223721590909+t*(.0173527644231+t*(.01396484375+t*.0115518008961))))))));}
float worldAsin(float x){x=clamp(x,-1.,1.);float a=abs(x);return sign(x)*(a<=.5?worldAsinSeries(a):PI*.5-2.*worldAsinSeries(sqrt((1.-a)*.5)));}
float worldAtan2(float y,float x){float ax=abs(x),ay=abs(y),r=min(ax,ay)/max(1e-20,max(ax,ay));bool reduce=r>.414213562373;float z=reduce?(r-1.)/(r+1.):r,t=z*z;float a=z*(1.+t*(-.333333333333+t*(.2+t*(-.142857142857+t*(.111111111111+t*(-.090909090909+t*(.076923076923+t*(-.066666666667+t*.058823529412))))))));if(reduce)a+=PI*.25;if(ay>ax)a=PI*.5-a;if(x<0.)a=PI-a;return y<0.?-a:a;}
// ANGLE's native sin can quantize nanoradian increments to zero on D3D11.
// Preserve the derivative with a small-angle series (the CPU uses doubles).
float worldSinDelta(float x){float t=x*x;return abs(x)<.01?x*(1.-t/6.+t*t/120.):sin(x);}
// Close boundaries use small increments about an exact CPU point on the edge.
vec3 primaryRimField(vec3 local){
   int i=uRimIndex;vec3 axis=uWounds[i].xyz,tangent=uWoundTangents[i].xyz,across=cross(axis,tangent),dq=local/uRadius;
   float a=uRimBase.x,b=uRimBase.y,j=uRimBase.z,A=cos(b)*cos(a),B=cos(b)*sin(a),U=sin(b),c=cos(b);
   float dA=dot(dq,axis),dB=dot(dq,tangent),dU=dot(dq,across);
   float da=worldAtan2(A*dB-B*dA,A*(A+dA)+B*(B+dB));
   float dc=-(2.*U*dU+dU*dU)/(sqrt(max(0.,1.-(U+dU)*(U+dU)))+c);
   float db=worldAtan2(c*dU-U*dc,1.+U*dU+c*dc);
   float dj=.26*cos(a*71.+da*35.5)*worldSinDelta(da*35.5)+.11*cos(a*193.+da*96.5)*worldSinDelta(da*96.5);
   float v=b/j,dv=(db*j-b*dj)/(j*(j+dj));
   float margin=(2.*a*da+da*da)/(uWoundTangents[i].w*uWoundTangents[i].w)+(2.*v*dv+dv*dv)/(uWounds[i].w*uWounds[i].w);
   return vec3(margin,a+da,b+db);
}
float primaryRimMargin(vec3 local){return primaryRimField(local).x;}
bool primaryShellHole(vec3 d,float t,vec3 q){
 if(uRimIndex>=0){vec3 local=d*(t*uRadius)-uRimRelative;if(length(local)<uRimRange)return primaryRimMargin(local)<0.;}
 return collectionHole(q);
}
float woundGroundDistance(vec3 q,vec3 delta){
 if(uAfter==0||uManyWounds==0)return 1e20;
 // The incremental field shares the exact lip with shell clipping and the wall.
 // Evaluate the gradient at the receiver, so a new camera anchor cannot move
 // the damage envelope. Only the cancellation-sensitive margin uses increments.
 if(uRimIndex>=0){vec3 local=delta+uN*(uH*uRadius)-uRimRelative;if(length(local)<uRimRange){
  vec3 field=primaryRimField(local);float a=field.y,b=field.z,L=uWoundTangents[uRimIndex].w,w=uWounds[uRimIndex].w;
  float j=1.+.13*sin(a*71.)+.055*sin(a*193.),dj=.13*71.*cos(a*71.)+.055*193.*cos(a*193.);
  float da=(2.*a/(L*L)-2.*b*b*dj/(w*w*j*j*j))/max(1e-12,cos(b)),db=2.*b/(w*w*j*j);
  return field.x/max(1e-12,length(vec2(da,db)))*uRadius;
 }}
 float result=1e20;
 for(int i=0;i<6;i++){vec3 axis=uWounds[i].xyz,tangent=uWoundTangents[i].xyz;
  float a=worldAtan2(dot(q,tangent),dot(q,axis)),b=worldAsin(dot(q,cross(axis,tangent))),j=1.+.13*sin(a*71.)+.055*sin(a*193.),dj=.13*71.*cos(a*71.)+.055*193.*cos(a*193.);
  float L=uWoundTangents[i].w,w=uWounds[i].w,f=a*a/(L*L)+b*b/(w*w*j*j)-1.;
  float da=(2.*a/(L*L)-2.*b*b*dj/(w*w*j*j*j))/max(1e-12,cos(b)),db=2.*b/(w*w*j*j);
  result=min(result,(f>.44?(sqrt(f+1.)-1.)*w:f/max(1e-12,length(vec2(da,db))))*uRadius);
 }return result;
}
float woundDamage(vec3 q,vec3 delta){return 1.-smoothstep(0.,WOUND_BAND,max(0.,woundGroundDistance(q,delta)));}
vec3 woundDetail(int id,vec3 q,vec3 delta,float footprint,float distanceKm){
 id=id<10?id:5;vec3 col=WOUND_ALBEDO[id];
 float fade=(1.-smoothstep(700.,2200.,distanceKm))*(1.-smoothstep(.08,.45,footprint/WOUND_TILE));
 if(uTextureDetail==1&&uWoundReady[id]>.001&&fade>.001){vec3 tri=pow(abs(q),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);
  vec3 tex=sampleSurface(uWoundTex,float(id),uWoundAnchor+delta/WOUND_TILE,tri,dFdx(delta)/WOUND_TILE,dFdy(delta)/WOUND_TILE,true);
  col=mix(col,tex,fade*uWoundReady[id]);
 }return col;
}
bool primaryShadeSolid(vec2 uv,int i,vec3 local){
 if(i!=uInspectDisk||length(local)>1000000.||uDiskNormals[i].w<.5)return diskSolid(uv,i);
 vec3 n=uDiskNormals[i].xyz,right=uDiskRights[i].xyz,up=cross(n,right);
 float r=uDiskPrecision[i].x*uRadius,kx=r/(uDisks[i].w*uRadius*uDiskAcross[i]),ky=r/(uDisks[i].w*uRadius);
 float du,dv;if(uShadeShape>=2){float dn=dot(local,n),den=uInspectCanonical.y+dn;
  du=kx*(dot(local,right)-uInspectCanonical.x/uInspectCanonical.y*dn)/den;
  dv=ky*(dot(local,up)-uInspectCanonical.z/uInspectCanonical.y*dn)/den;
 }else{du=dot(local,right)/(uDisks[i].w*uRadius*uDiskAcross[i]);dv=dot(local,up)/(uDisks[i].w*uRadius);}
 vec2 p=uInspectBase.xy+vec2(du,dv);
 if(uShadeShape==3&&abs(p.x)>uShadeTrim)return false;
 if(uShadeShape==1?max(abs(p.x),abs(p.y))>1.:dot(p,p)>1.)return false;
 float v=uInspectBase.y,margin=du+.13*cos(v*11.+dv*5.5)*worldSinDelta(dv*5.5)+.036*cos(v*41.+dv*20.5)*worldSinDelta(dv*20.5);
 return (margin>=0.||margin<=-.026)&&detailedShadeRest(p.x,p.y,int(uDiskRights[i].w));
}
int provinceID(int row,float u){u=fract(u);int cell=9;for(int i=0;i<10;i++)if(u<PROVINCE_EDGES[i+1]){cell=i;break;}int id=PROVINCES[row*10+cell];return id==4&&uAfter==0?5:id;}
float primaryDiskHit(vec3 d,int i){if(uLayout!=2)return diskHit(camera(),d,i);vec3 n=uDiskNormals[i].xyz,right=uDiskRights[i].xyz,up=cross(n,right);float r=uDiskPrecision[i].x,h=uDiskPrecision[i].y,times[2];int count=1;
 if(uShadeShape>=2){float b=(1.-uH)*dot(uN,d),c=-h*(2.*r-h),disc=b*b-c;if(disc<0.)return 1e20;float root=sqrt(disc);times[0]=h<0.?(b<0.?c/(-b+root):1e20):1e20;times[1]=b>0.?-c/(b+root):-b+root;count=2;}
 else{float den=dot(d,n);if(abs(den)<1e-12)return 1e20;times[0]=uDiskPrecision[i].z/den;}
 for(int k=0;k<2;k++){if(k>=count)break;float t=times[k];if(t<=1e-13||t>1e19)continue;vec3 hit=camera()+d*t;vec2 uv;if(uShadeShape>=2){vec3 q=hit/r;float f=dot(q,n);if(f<=0.)continue;uv=vec2(dot(q,right),dot(q,up))*r/(f*uDisks[i].w);}else{vec3 off=hit-uDisks[i].xyz;uv=vec2(dot(off,right),dot(off,up))/uDisks[i].w;}
  if(primaryShadeSolid(uv,i,d*(t*uRadius)-uInspectRelative))return t;
 }return 1e20;}
vec3 worldRegion(vec3 q){
 if(uBiomeOverride>=0)return vec3(float(uBiomeOverride),float(uBiomeOverride),0.);
 float lat=worldAsin(dot(q,uWorldAxis)),lon=worldAtan2(dot(q,uWorldUp),dot(q,uWorldRight)),latitude=abs(lat),u=fract(lon/(2.*PI)+.5);
 int row=clamp(int(floor((lat+uWaist)/(2.*uWaist)*3.)),0,2);
 float warp=.006*sin(lon*7.+float(row)*1.7)+.002*sin(lon*19.+float(row)*2.3),pu=fract(u+warp);int cell=9;for(int j=0;j<10;j++)if(pu<PROVINCE_EDGES[j+1]){cell=j;break;}
 int id=provinceID(row,pu),a=id,b=id,machine=10+(int(floor(u*8.))+(lat<0.?1:0))%3;float blend=0.,belt=1.-smoothstep(uWaist-.004,uWaist+.004,latitude);
 if(latitude>uWaist){a=machine;b=a;}if(latitude>1.31){a=15;b=15;}
 if(belt>0.&&belt<1.){a=machine;b=id;blend=belt;}
 else if(latitude<uWaist){float fade=uTransition/uRadius/(2.*PI*max(.1,cos(lat))),left=pu-PROVINCE_EDGES[cell],right=PROVINCE_EDGES[cell+1]-pu;
  if(left<fade){a=provinceID(row,pu-fade*2.);b=id;blend=.5+.5*smoothstep(0.,fade,left);}else if(right<fade){a=id;b=provinceID(row,pu+fade*2.);blend=.5*(1.-smoothstep(0.,fade,right));}
  float ribbon=(lat+uWaist)/(2.*uWaist)*3.,rf=uTransition/uRadius/(2.*uWaist/3.),part=fract(ribbon);
  if(row>0&&part<rf){a=provinceID(row-1,pu);b=id;blend=.5+.5*smoothstep(0.,rf,part);}
  if(row<2&&1.-part<rf){a=id;b=provinceID(row+1,pu);blend=.5*(1.-smoothstep(0.,rf,1.-part));}
 }
 return vec3(float(a),float(b),blend);
}
vec3 biomeRegion(vec3 q){return uLayout==2&&uCollection==1?worldRegion(q):legacyBiomeRegion(q);}
vec3 biomeHaze(vec3 q){vec3 r=biomeRegion(q);return mix(BIOME_HAZE[min(9,int(r.x))],BIOME_HAZE[min(9,int(r.y))],r.z);}
vec3 worldDetail(int id,vec3 q,vec3 delta,float footprint,float distanceKm){
 vec3 col=WORLD_ALBEDO[id];float continent=fbm(q*23.+vec3(uSeed*.03)),district=fbm(q*190.+vec3(uSeed*.13));
 float land=smoothstep(.29,.66,continent+.17*(district-.5));col*=.40+1.18*land;
 // Continental colour structure is distinct from the metre-scale features in the albedo maps.
 if(id==7){vec3 sea=col*vec3(.23,.80,.94),chalk=col*vec3(1.85,1.56,1.35);col=mix(sea,chalk,smoothstep(.39,.67,continent+district*.20));}
 else if(id==6||id==8){float channels=pow(1.-abs(district*2.-1.),18.);col=mix(col,col*vec3(.40,.73,.86),channels*.65);}
 // A resolved image tends to its own measured linear mean at planetary distances.
 float fade=(1.-smoothstep(700.,2200.,distanceKm))*(1.-smoothstep(.08,.45,footprint/2.5));
 vec3 tri=pow(abs(q),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);
 vec3 dx=dFdx(delta),dy=dFdy(delta);
 if(id<10&&uTextureDetail==1&&fade>.001&&uHeroReady[id]>.001){vec3 p=uHeroAnchor+delta/2.5;vec3 tex=sampleSurface(uHeroTex,float(id),p,tri,dx/2.5,dy/2.5,id==2||id==3||id==7||id==8||id==9);col=mix(col,tex,fade*uHeroReady[id]);
  float detail=(1.-smoothstep(3.,20.,distanceKm))*(1.-smoothstep(.0008,.006,footprint));if(detail>.001&&uBiomeReady[id]>.001){vec3 p=mod(uBiomeAnchor[2]*8.,64.)+delta/.125,small=sampleBiome(id,2,p,tri,dx/.125,dy/.125),blur=sampleBiome(id,2,p,tri,dx/.125*12.,dy/.125*12.);float contrast=clamp(log(max(.003,dot(small,vec3(.333)))/max(.003,dot(blur,vec3(.333)))),-1.,1.);col*=exp(contrast*.38*detail);}
 }
 if(id>=10){
  // Hierarchical service districts, then real six-kilometre engineering artwork.
  for(int tier=0;tier<3;tier++){float scale=tier==0?1000000.:tier==1?100000.:10000.;vec3 p=uAnchor[tier]+delta/scale;float fw=footprint/scale;float district=tri.x*panelLine(p.yz,fw)+tri.y*panelLine(p.xz,fw)+tri.z*panelLine(p.xy,fw);float block=tnoise(floor(p));col*=mix(1.,(.70+.6*block)*(1.-district*.40),1.-smoothstep(.1,.45,fw));}
  if(id==15){float polar=acos(clamp(abs(dot(q,uWorldAxis)),0.,1.))*uRadius;float facility=1.-smoothstep(320000.,350000.,polar);float rings=constructionRib(polar,35000.,footprint),gate=1.-smoothstep(8000.,10000.,polar);col=mix(col,vec3(.14,.18,.19)*(1.-rings*.70),facility);col=mix(col,vec3(.035,.05,.055),gate);}
  if(uTextureDetail==1&&uWorldTexturesReady==1){float ef=(1.-smoothstep(1500.,6000.,distanceKm))*(1.-smoothstep(.1,.5,footprint/6.));if(ef>.001){vec3 ep=uEngineeringAnchor+delta/6.;int layer=id==15?4:id-10;vec3 tex=sampleSurface(uEngineering,float(layer),ep,tri,dx/6.,dy/6.,false);col=mix(col,tex,ef);}}
 }
 // Sub-metre to hundred-metre roughness detail has physical pitches and neutral colour.
 float detailFade=1.-smoothstep(.001,.006,footprint);if(detailFade>.001&&uSurfaceRelief==1){vec3 p=uAnchor[8]+delta/.01;float grain=tnoise(p)*.65+tnoise(p*4.)*.35;col*=mix(1.,.82+.36*grain,detailFade);surfaceBumpLight=.91+.09*grain;}
 return col;
}
vec3 surfaceMaterial(vec3 q,vec3 delta,float footprint,float distanceKm){
 if(uLayout!=2||uCollection!=1)return legacySurfaceMaterial(q,delta,footprint,distanceKm);
 vec3 r=worldRegion(q);int a=int(r.x),b=int(r.y);float blend=r.z;
 // Resolve a transition into interlocking landforms or engineered parcels, never painted stripes.
 if(a!=b&&distanceKm<200000.){vec3 p=uAnchor[2]+delta/10000.;bool built=a==4||a==5||b==4||b==5||a>=10||b>=10;float mosaic=built?tnoise(floor(p*.5)):tnoise(p)+.22*(tnoise(p*3.)-.5);float resolved=smoothstep(mosaic-.05,mosaic+.05,blend);blend=mix(blend,resolved,1.-smoothstep(20000.,200000.,distanceKm));}
 vec3 col=worldDetail(a,q,delta,footprint,distanceKm);if(blend>.001&&a!=b)col=mix(col,worldDetail(b,q,delta,footprint,distanceKm),blend);
 float damage=woundDamage(q,delta);
 if(damage>.00001){vec3 edge=woundDetail(a,q,delta,footprint,distanceKm);if(blend>.001&&a!=b)edge=mix(edge,woundDetail(b,q,delta,footprint,distanceKm),blend);col=mix(col,edge,damage);}
 if(uGuide==1){float lat=abs(asin(clamp(dot(q,uWorldAxis),-1.,1.))),fw=max(.00003,fwidth(lat));float line=1.-smoothstep(fw,fw*2.,abs(lat-uWaist));col=mix(col,vec3(.22,.35,.30),line*.5);}
 if(uGrid==1){vec2 uv=vec2(asin(clamp(q.y,-1.,1.)),atan(q.x,q.z))/(PI/12.);vec2 g=abs(fract(uv+.5)-.5)/max(fwidth(uv),vec2(.00001));col=mix(col,vec3(.055,.4,.37),(1.-smoothstep(.45,1.2,min(g.x,g.y)))*.8);}
 return max(col,vec3(.001));
}
// Differentiate the same surface, even when the neighbouring primary ray sees
// the shell, a different Shade or space. Hit-coordinate derivatives inside the
// object branch are not a valid material footprint at a silhouette or fracture.
void shadeCameraFootprint(vec3 d,vec2 xy){
 if(uPanorama==1){float lo=xy.x*PI,la=xy.y*PI*.5;
  shadeRayDx=(-uForward*cos(la)*sin(lo)+uRight*cos(la)*cos(lo))*(2.*PI/uRasterSize.x);
  shadeRayDy=(-uForward*sin(la)*cos(lo)-uRight*sin(la)*sin(lo)+uUp*cos(la))*(PI/uRasterSize.y);
 }else{float scale=2.*tan(uFov*.5)*max(1e-8,dot(d,uForward));
  shadeRayDx=(uRight-d*dot(d,uRight))*(scale/uRasterSize.x);
  shadeRayDy=(uUp-d*dot(d,uUp))*(scale*uResolution.y/(uResolution.x*uRasterSize.y));
 }
}
vec3 shadeSurfaceDelta(vec3 d,vec3 normal,float distanceKm,vec3 rayDelta){
 float facing=dot(normal,d),denom=(facing<0.?-1.:1.)*max(1e-6,abs(facing));
 return distanceKm*(rayDelta-d*(dot(normal,rayDelta)/denom));
}
void shadeUVFootprint(vec3 d,vec3 normal,float distanceKm,int index,out vec2 uv,out vec2 gx,out vec2 gy){
 vec3 relative=d*distanceKm,dx=shadeSurfaceDelta(d,normal,distanceKm,shadeRayDx),dy=shadeSurfaceDelta(d,normal,distanceKm,shadeRayDy);
 uv=uShadeUVAnchor[index]+vec2(dot(relative,uShadeUVRight[index]),dot(relative,uShadeUVUp[index]))/1.2;
 gx=vec2(dot(dx,uShadeUVRight[index]),dot(dx,uShadeUVUp[index]))/1.2;
 gy=vec2(dot(dy,uShadeUVRight[index]),dot(dy,uShadeUVUp[index]))/1.2;
}
float shadeFilterWidth(vec2 uv,vec2 gx,vec2 gy){
 // Do not claim readable detail below the precision of a very distant coordinate.
 return max(max(length(gx),length(gy)),max(abs(uv.x),abs(uv.y))*4.768371582e-7);
}
vec2 shadeKilometreDelta(vec3 hit,vec3 delta,int i){
 vec3 n=uDiskNormals[i].xyz,r=uDiskRights[i].xyz,u=cross(n,r);
 if(uShadeShape<2)return vec2(dot(delta,r),dot(delta,u));
 vec3 q=normalize(hit);float a=dot(q,r),b=dot(q,u),c=dot(q,n);
 return vec2(dot(delta,r*c-n*a)/max(1e-8,a*a+c*c),dot(delta,u-q*b)/sqrt(max(1e-8,1.-b*b)));
}
float shadeDistrict(vec2 km,vec2 gx,vec2 gy,int index){
 vec2 p=km/200000.,cell=floor(p),f=fract(p),width=(abs(gx)+abs(gy))/200000.;
 float fade=1.-smoothstep(.35,1.,max(width.x,width.y));if(fade==0.)return .5;
 vec2 w=clamp(width,vec2(.00001),vec2(1.)),lo=f-w*.5,hi=f+w*.5;float value=0.,total=0.;
 if(all(greaterThanEqual(lo,vec2(0.)))&&all(lessThanEqual(hi,vec2(1.))))return mix(.5,thash(vec3(cell,float(index))),fade);
 // Box coverage of neighbouring district cells; keep the original world addresses.
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 offset=vec2(x,y),overlap=max(vec2(0.),min(hi,offset+1.)-max(lo,offset));
  float weight=overlap.x*overlap.y;value+=weight*thash(vec3(cell+offset,float(index)));total+=weight;
 }return mix(.5,value/max(1e-20,total),fade);
}
// One scale and material recipe on both the analytic skin and the streamed deck.
vec3 shadeSkinGrad(vec2 uv,int layer,float distanceKm,vec2 gx,vec2 gy){
 float fw=shadeFilterWidth(uv,gx,gy),kmFootprint=fw*1.2;
 vec2 km=uv*1.2;vec3 base=layer==3?vec3(.041,.047,.050):vec3(.085,.097,.104),col=base;
 if(uWorldTexturesReady==1&&uTextureDetail==1){float fade=(1.-smoothstep(.12,.7,fw))*(1.-smoothstep(6000.,20000.,distanceKm));
  if(fade>.001){vec3 tex=stochasticTile(uEngineering,uv,float(layer),gx,gy);col=mix(col,mix(base,tex*.80,.56),fade);}
 }
 float service=max(constructionRib(km.x,.1,kmFootprint),constructionRib(km.y,.1,kmFootprint));
 float cells=max(constructionRib(km.x,.005,kmFootprint),constructionRib(km.y,.02,kmFootprint));
 col*=1.-service*.42-cells*.18;
 float duct=constructionRib(km.y+.012,.1,kmFootprint)*(1.-smoothstep(.006,.025,kmFootprint));
 col=mix(col,vec3(.11,.103,.079),duct*.38);
 return col;
}
vec3 shadeSkin(vec2 uv,int layer,float distanceKm){return shadeSkinGrad(uv,layer,distanceKm,dFdx(uv),dFdy(uv));}
vec3 shadeSurface(vec3 hit,vec3 d,int index,float distanceKm){
 vec3 n=uShadeShape>=2?normalize(hit):uDiskNormals[index].xyz;int layer=dot(d,n)>0.?3:4;
 vec2 uv,gx,gy;shadeUVFootprint(d,n,distanceKm,index,uv,gx,gy);
 vec3 col=shadeSkinGrad(uv,layer,distanceKm,gx,gy);vec2 km=shadeCoordinates(hit,index);
 vec2 dx=shadeKilometreDelta(hit,shadeSurfaceDelta(d,n,distanceKm,shadeRayDx),index),dy=shadeKilometreDelta(hit,shadeSurfaceDelta(d,n,distanceKm,shadeRayDy),index);
 float fw=max(length(dx),length(dy));float districts=.86+.26*shadeDistrict(km,dx,dy,index);
 float seams=max(constructionRib(km.x,100000.,fw),constructionRib(km.y,10000.,fw));
 return col*mix(1.,districts*(1.-seams*.28),smoothstep(1500.,5000.,distanceKm));
}
vec3 exteriorSky(vec3 d){vec3 col=stars(d);if(uLayout!=2||uAfter==0||uWreckage==0)return col;
 // Distant flecks are analytically filtered angular silhouettes. Large wrecks
 // live in the dimensional exterior volume, not a low-resolution sky painting.
 vec2 uv=vec2(atan(dot(d,uWorldRight),dot(d,uWorldUp))/(2.*PI)+.5,.5-asin(clamp(dot(d,uWorldAxis),-1.,1.))/PI);
 for(int layer=0;layer<3;layer++){vec2 grid=vec2(220.,110.)*pow(2.,float(layer)),p=uv*grid,cell=floor(p);float fw=max(.001,max(length(dFdx(p)),length(dFdy(p))));float h=hash(vec3(mod(cell.x,grid.x),cell.y,float(layer)+uSeed));if(h<.982-float(uSpaceEnvironment)*.003)continue;
  vec2 centre=vec2(.25+.5*fract(h*713.1),.25+.5*fract(h*371.7)),v=fract(p)-centre;float a=h*871.,c=cos(a),s=sin(a);v=mat2(c,-s,s,c)*v;
  vec2 size=vec2(.025+.11*fract(h*617.3),.006+.027*fract(h*977.7));
  float shape=1.-smoothstep(-fw*.5,fw*.5,max(abs(v.x)-size.x,abs(v.y)-size.y));float brightness=.007+.05*fract(h*173.5);
  col+=mix(vec3(.60,.72,.80),vec3(.83,.60,.37),fract(h*197.))*brightness*shape;
 }
 return col;
}
`;
let src=SphereShaders.fragment;
// Wound silhouettes need the same range-reduced inverse trig as province
// boundaries. Native ANGLE asin/atan can shift a thin opening by a whole pixel.
src=src.replace('float a=atan(dot(q,tanv),dot(q,axis)),b=asin(clamp(dot(q,cross(axis,tanv)),-1.,1.));','float a=worldAtan2(dot(q,tanv),dot(q,axis)),b=worldAsin(dot(q,cross(axis,tanv)));');
const damageGLSL=W.shadeSolidBody.replace('const family=id%3;','int family=id%3;').replace('const edge=','float edge=').replaceAll('===','==').replaceAll('Math.sin','sin').replaceAll('Math.abs','abs').replaceAll('Math.floor','floor').replace('const x=','float x=').replace(/,y=/g,',y=').replace('(x*13+y*7+id*11)%37','mod(x*13.+y*7.+float(id)*11.,37.)').replaceAll('*18','*18.').replaceAll('*17','*17.').replaceAll('*53','*53.').replaceAll('*12','*12.').replaceAll('*31','*31.').replaceAll('*11','*11.').replaceAll('*41','*41.').replaceAll('*57','*57.').replaceAll('(u+1)','(u+1.)').replaceAll('(v+1)','(v+1.)').replace('==0&&','==0.&&');
src=src.replace('bool diskSolid(vec2 p,int i){','bool detailedShadeSolid(float u,float v,int id){'+damageGLSL.replace('family==0.','family==0').replaceAll('11..','11.').replace('37.)==0','37.)==0.')+'}\nbool diskSolid(vec2 p,int i){');
const restGLSL=damageGLSL.replace(/if\(abs\(u\+\.27[^\n]+\n/,'');
src=src.replace('bool diskSolid(vec2 p,int i){','bool detailedShadeRest(float u,float v,int id){'+restGLSL.replace('family==0.','family==0').replaceAll('11..','11.').replace('37.)==0','37.)==0.')+'}\nbool diskSolid(vec2 p,int i){');
src=src.replace('if(uDiskNormals[i].w<.5)return true;','if(uDiskNormals[i].w<.5)return true;if(uLayout==2)return detailedShadeSolid(p.x,p.y,int(uDiskRights[i].w));');
src=src.replace('const float PI=',constants+'\nconst float PI=');
src=src.replace('vec3 biomeRegion(vec3 q){','vec3 legacyBiomeRegion(vec3 q){');
src=src.replace(/vec3 biomeHaze\(vec3 q\)\{[^}]+\}/,'');
src=src.replace('vec3 surfaceMaterial(vec3 q,vec3 delta,float footprint,float distanceKm){','vec3 legacySurfaceMaterial(vec3 q,vec3 delta,float footprint,float distanceKm){');
// Legacy material calls the legacy region; declarations above main avoid forward calls.
src=src.replaceAll('vec3 region=biomeRegion(q);','vec3 region=legacyBiomeRegion(q);');
src=src.replace('void main(){',functions+'\nvoid main(){');
// Camera-ray derivatives are continuous and evaluated before object selection.
src=src.replace('float ts=shellHit(d);','shadeCameraFootprint(d,xy);\n float ts=shellHit(d);');
src=src.replace('col=shadeMaterial(shadeCoordinates(hit,diskIndex))','col=shadeSurface(hit,d,diskIndex,tp*uRadius)');
src=src.replace('float t=diskHit(camera(),d,i);','float t=primaryDiskHit(d,i);');
src=src.replace('else{col=stars(d);}','else{col=exteriorSky(d);}');
// The exterior skin cannot receive direct light from the star behind an opaque shell.
src=src.replace('if(uMode==1){','if(kind==0&&uH<0.&&dot(d,q)<0.)col=WORLD_ALBEDO[12]*.0008;\n if(uMode==1){');
src=src.replace('if(uAtm>0. && uMode==0 && uH*uRadius<160.)','if(uLayout!=2 && uAtm>0. && uMode==0 && uH*uRadius<160.)');
// All surfaces share logarithmic distance depth with the camera-relative mesh pass.
src=src.replace('if(uMode==5){','gl_FragDepth=obj>1e19?1.:clamp(log2(1.+max(0.,obj*uRadius))/log2(1.+4.*uRadius),0.,1.);\n if(uMode==5){');
src=src.replace('bool hole=uCollection==1?collectionHole(q):missing(q);',`bool hole=ts>1e19||(uCollection==1?primaryShellHole(d,ts,q):missing(q));
 if(uH<0.&&ts<1e19&&hole){float b=(1.-uH)*dot(uN,d),c=-uH*(2.-uH);ts=-b+sqrt(max(0.,b*b-c));q=normalize(camera()+d*ts);hole=primaryShellHole(d,ts,q);}`);
src=src.replace(/float shellHit\(vec3 d\)\{[^}]+\}/,`float shellHit(vec3 d){float b=(1.-uH)*dot(uN,d),c=-uH*(2.-uH),disc=b*b-c;if(disc<0.)return 1e20;float root=sqrt(disc);if(uLayout==2&&uH<0.){float near=-b-root,far=-b+root;return near>0.?near:far>0.?far:1e20;}float t=b>0.?(-c)/(b+root):-b+root;return t>0.?t:1e20;}`);
src=src.replace('if(uMode==5){','if(uMode==6){vec3 r=worldRegion(q);fragColor=vec4(r.x/15.,r.y/15.,r.z,1.);return;}if(uMode==5){');
SphereShaders.fragment=src;
// Compile each layout independently: carrying both large material graphs in one program
// makes some ANGLE drivers spend tens of seconds optimizing dead branches at startup.
function removeFunction(source,name){const re=new RegExp('(?:float|bool|vec[234]) '+name+'\\('),match=re.exec(source);if(!match)return source;let start=source.indexOf('{',match.index),end=start+1,depth=1;while(depth&&end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;end++;}return source.slice(0,match.index)+source.slice(end);}
src=src.replace('if(uLayout!=2||uCollection!=1)return legacySurfaceMaterial(q,delta,footprint,distanceKm);','').replace('return uLayout==2&&uCollection==1?worldRegion(q):legacyBiomeRegion(q);','return worldRegion(q);').replace('if(uLayout!=2)return shadeMaterial(km);','');
for(const name of ['legacySurfaceMaterial','legacyBiomeRegion','collectionMaterial','collectionPalette','atlasMaterial','shellMaterial','shadeMaterial'])src=removeFunction(src,name);
src=src.replace('uniform int uLayout,uWorldTexturesReady','const int uLayout=2;\nuniform int uWorldTexturesReady').replace('uniform int uCollection,uAfter','const int uCollection=1;\nuniform int uAfter');
SphereShaders.fragment=src;
W.upload=function(gl,u,s){const f=W.frame(s);gl.uniform1i(u.uLayout,s.collection?(s.layoutVersion||1):1);gl.uniform3fv(u.uWorldAxis,f.axis);gl.uniform3fv(u.uWorldRight,f.right);gl.uniform3fv(u.uWorldUp,f.up);gl.uniform1f(u.uWaist,SphereMath.radians(s.waistWidth||20));gl.uniform1f(u.uTransition,s.transitionKm||60000);gl.uniform1i(u.uSpaceEnvironment,s.spaceEnvironment||0);gl.uniform1i(u.uWreckage,s.wreckage!==false?1:0);const n=SphereMath.norm(s.position);gl.uniform3fv(u.uEngineeringAnchor,n.map(v=>((v*s.radius/6)%64+64)%64));
 const M=SphereMath,anchors=[],right=[],up=[],precision=[],camLength=M.length(s.position);for(const plate of SphereCollection.plates(s)){const r=M.length(plate.center)*s.radius,a=M.dot(n,plate.right),b=M.dot(n,plate.up),c=M.dot(n,plate.normal);let x,y,dx=plate.right,dy=plate.up;
 if(plate.shape==='cap'||plate.shape==='trimmed'){x=r*Math.atan2(a,c);y=r*Math.asin(M.clamp(b,-1,1));dx=M.mul(M.sub(M.mul(plate.right,c),M.mul(plate.normal,a)),r/camLength/Math.max(1e-10,a*a+c*c));dy=M.mul(M.sub(plate.up,M.mul(n,b)),r/camLength/Math.sqrt(Math.max(1e-10,1-b*b)));}
 else{const d=M.sub(s.position,M.mul(plate.center,s.radius));x=M.dot(d,plate.right);y=M.dot(d,plate.up);}
 anchors.push(((x/1.2)%64+64)%64,((y/1.2)%64+64)%64);right.push(...dx);up.push(...dy);precision.push(r/s.radius,(r-camLength)/s.radius,M.dot(M.sub(M.mul(plate.center,s.radius),s.position),plate.normal)/s.radius,0);}
 while(anchors.length<36)anchors.push(0);while(right.length<54)right.push(0);while(up.length<54)up.push(0);gl.uniform2fv(u['uShadeUVAnchor[0]'],anchors);gl.uniform3fv(u['uShadeUVRight[0]'],right);gl.uniform3fv(u['uShadeUVUp[0]'],up);while(precision.length<72)precision.push(0);gl.uniform4fv(u['uDiskPrecision[0]'],precision);gl.uniform1i(u.uInspectDisk,-1);
 const inspect=window.SphereEdges?.shadeContext(s);
 if(inspect){gl.uniform1i(u.uInspectDisk,SphereCollection.plates(s).findIndex(p=>p.id===inspect.plate.id));gl.uniform3fv(u.uInspectRelative,M.sub(inspect.origin,s.position));gl.uniform4fv(u.uInspectBase,[inspect.u,inspect.v,0,0]);gl.uniform3fv(u.uInspectCanonical,inspect.canonicalOrigin);}
 gl.uniform1i(u.uRimIndex,-1);const rim=window.SphereEdges?.rimContext(s);
 if(rim){gl.uniform1i(u.uRimIndex,rim.index);gl.uniform3fv(u.uRimRelative,M.sub(rim.origin,s.position));gl.uniform4fv(u.uRimBase,[rim.a,rim.b,rim.j,s.radius/W.woundGradient(rim.a,rim.b,rim.w)]);gl.uniform1f(u.uRimRange,Math.max(10000,SphereEdges.readableRange(s.shellThickness,s)*1.4));}
 gl.uniform3fv(u.uWoundAnchor,n.map(v=>((v*s.radius/W.woundTileKm)%64+64)%64));
};
})();
