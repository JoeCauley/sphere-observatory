/* Original periodic density volume and depth-aware WebGL2 atmosphere passes. */
(function(root){
'use strict';
// One-third smaller cloud features at every scale. This is a wavelength change;
// cloud heights, atmospheric reach and the distance fade retain their meaning.
const cloudFeatureScale=2/3;
function noiseVolume(size=64){
 const data=new Uint8Array(size*size*size*4),wrap=n=>(n%16+16)%16;
 const hash=(x,y,z)=>{let h=Math.imul(wrap(x),73856093)^Math.imul(wrap(y),19349663)^Math.imul(wrap(z),83492791);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 const features=new Float32Array(16*16*16*3),featureIndex=(x,y,z)=>((wrap(z)*16+wrap(y))*16+wrap(x))*3;
 for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=featureIndex(x,y,z);features[i]=hash(x,y,z);features[i+1]=hash(x+7,y+3,z+11);features[i+2]=hash(x+1,y+13,z+5);}
 const value=(x,y,z)=>{const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let u=x-ix,v=y-iy,w=z-iz;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);let n=0;for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)n+=hash(ix+i,iy+j,iz+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);return n;};
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const a=(x+.5)/size*16,b=(y+.5)/size*16,c=(z+.5)/size*16,i=((z*size+y)*size+x)*4;
  data[i]=Math.round(value(a,b,c)*255);data[i+1]=Math.round(value(a+5.3,b+8.7,c+1.9)*255);
  data[i+2]=Math.round(value(a+11.2,b+2.4,c+7.6)*255);
  let nearest=4;const ix=Math.floor(a),iy=Math.floor(b),iz=Math.floor(c);for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const j=featureIndex(ix+dx,iy+dy,iz+dz),xx=ix+dx+features[j]-a,yy=iy+dy+features[j+1]-b,zz=iz+dz+features[j+2]-c;nearest=Math.min(nearest,xx*xx+yy*yy+zz*zz);}data[i+3]=Math.round(Math.max(0,1-Math.sqrt(nearest))*255);
 }return {data,size};
}
const march=`#version 300 es
precision highp float;precision highp sampler3D;
in vec2 vUV;layout(location=0)out vec4 scattering;layout(location=1)out vec4 transmission;
uniform sampler2D sceneDepth;uniform sampler3D densityVolume;
uniform vec3 cameraUp,forward,right,up,phase,cloudTint,hazeTint,fill;
uniform vec2 resolution,volumeResolution;uniform vec4 rimPlane;
uniform vec3 rimAxis,rimTangent,rimNorth,rimOrigin,rimAnchor;
uniform vec4 rimShape;
uniform float radius,height,fov,rayAspect,amount,weather,direct,low,high,cloudScale,cloudDensity,cavityHaze,stellarPower;
uniform int panorama,clouds,spores,clipRim,steps,localAir;
// Match the geographic shader's small-angle precision on ANGLE/D3D11.
float rimSin(float x){float t=x*x;return abs(x)<.01?x*(1.-t/6.+t*t/120.):sin(x);}
float rimAngle(float y,float x){float r=y/max(x,1e-20),t=r*r;return x>0.&&abs(r)<.01?r*(1.-t/3.+t*t/5.):atan(y,x);}
float containedAir(vec3 p){if(clipRim==0)return 1.;
 // Angular increments around the exact contour preserve small clearances at
 // AU origins and follow the curved bank over the whole atmospheric ray.
 vec3 d=(p-rimOrigin)/radius;
 float A=rimAnchor.x,B=rimAnchor.y,U=rimAnchor.z;
 float da=dot(d,rimAxis),db=dot(d,rimTangent),du=dot(d,rimNorth);
 float angle=rimAngle(A*db-B*da,A*(A+da)+B*(B+db));
 float c=length(vec2(A,B)),nextC=length(vec2(A+da,B+db)),dc=(2.*A*da+da*da+2.*B*db+db*db)/(nextC+c);
 float latitude=rimAngle(c*du-U*dc,c*nextC+U*(U+du));
 float a=rimShape.x,b=rimShape.y,j=1.+.13*sin(a*71.)+.055*sin(a*193.);
 float dj=.26*cos(a*71.+angle*35.5)*rimSin(angle*35.5)+.11*cos(a*193.+angle*96.5)*rimSin(angle*96.5);
 float v=b/j,dv=(latitude*j-b*dj)/(j*(j+dj));
 float metric=(2.*a*angle+angle*angle)/(rimShape.z*rimShape.z)+(2.*v*dv+dv*dv)/(rimShape.w*rimShape.w);
 return smoothstep(0.,.02,metric*radius*min(rimShape.z,rimShape.w)*.5);
}
float altitude(vec3 p){float h=dot(p,cameraUp),r=radius-height;
 // Rationalized radius difference keeps metre-scale heights at AU coordinates.
 float dr2=dot(p,p)-2.*r*h;return height-dr2/(sqrt(max(0.,r*r+dr2))+r);
}
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec3 ray(){vec2 xy=vUV*2.-1.;if(panorama==1){float lo=xy.x*3.14159265359,la=xy.y*1.57079632679;return normalize(forward*cos(la)*cos(lo)+right*cos(la)*sin(lo)+up*sin(la));}return normalize(forward+right*xy.x*tan(fov*.5)+up*xy.y*tan(fov*.5)/rayAspect);}
// Shape is a continuous 3D field. The vertical envelope warps with the broad
// weather field; no translucent geometry or planar cloud textures are drawn.
float density(vec3 relative,float lod){float h=altitude(relative);if(h<low||h>high)return 0.;
 vec3 p=phase+relative/cloudScale;
 vec4 broad=textureLod(densityVolume,p/32.,max(0.,lod-1.));
 float base=low+(high-low)*(.02+.12*broad.g),top=low+(high-low)*(.43+.55*smoothstep(.20,.78,broad.b));
 float vertical=smoothstep(base,base+(high-low)*.16,h)*(1.-smoothstep(top-(high-low)*.36,top,h));
 if(vertical<=0.)return 0.;
 vec3 warp=(broad.rgb-.5)*.65;
 vec4 cell=textureLod(densityVolume,(p+warp)/16.,lod);
 float shape=cell.r*.42+cell.a*.30+textureLod(densityVolume,(p*2.+warp)/16.,lod+1.).g*.20+textureLod(densityVolume,p*4./16.,lod+2.).b*.08;
 float threshold=mix(.685,.295,weather)+.09*(broad.r-.5);
 float body=smoothstep(threshold,threshold+.19,shape)*vertical;
 float erosion=(1.-textureLod(densityVolume,p*8./16.,lod+3.).g)*.19*(1.-body);
 return max(0.,body-erosion)*cloudDensity*containedAir(relative);
}
vec2 heightRoots(vec3 d,float level){float b=-(radius-height)*dot(d,cameraUp),c=(level-height)*(2.*radius-height-level),disc=b*b-c;
 if(disc<0.)return vec2(1e20,-1e20);float root=sqrt(disc),q=-b-(b<0.?-root:root);
 float a=q,z=abs(q)>1e-12?c/q:-b;return vec2(min(a,z),max(a,z));
}
// Intersect a ray with a curved atmospheric band. A grazing ray can cross it
// twice; retaining both intervals avoids a tangent-plane horizon discontinuity.
vec4 heightBand(vec3 d,float bottom,float top,float limit){vec2 outer=heightRoots(d,bottom),inner=heightRoots(d,top);
 float a=max(0.,outer.x),b=min(limit,outer.y);if(b<=a)return vec4(0.);
 if(inner.y<=a||inner.x>=b)return vec4(a,b,0.,0.);
 return vec4(a,max(a,min(b,inner.x)),max(a,min(b,inner.y)),b);
}
vec2 containedRange(vec3 d,vec2 range){return range;}
float airDensity(vec3 d,float t){return exp(-max(0.,altitude(d*t))/7.)*containedAir(d*t);}
float airColumn(vec3 d,float a,float b){float middle=(a+b)*.5,halfLength=(b-a)*.5,total=0.;
 const vec4 nodes=vec4(.1834346425,.5255324099,.7966664774,.9602898565),weights=vec4(.3626837834,.3137066459,.2223810345,.1012285363);
 for(int i=0;i<4;i++){float offset=nodes[i]*halfLength;total+=weights[i]*(airDensity(d,middle-offset)+airDensity(d,middle+offset));}
 return total*halfLength*amount/110.;
}
float airDepth(vec3 d,float a,float b){if(b<=a||amount<=0.)return 0.;vec4 band=heightBand(d,0.,32.,min(b,1400.));float total=0.;
 for(int k=0;k<2;k++){vec2 range=k==0?band.xy:band.zw;range.x=max(a,range.x);range=containedRange(d,range);
  if(range.y>range.x)total+=airColumn(d,range.x,range.y);
 }return total;
}
void airSegment(inout vec3 sum,inout vec3 tr,vec3 d,float a,float b,vec3 ambient){vec3 t=exp(-vec3(.52,.74,1.)*airDepth(d,a,b));sum+=tr*(1.-t)*ambient;tr*=t;}
void main(){vec3 d=ray();float depth=texture(sceneDepth,vUV).r,hit=depth>=.999999?1e20:exp2(depth*log2(1.+4.*radius))-1.;
 vec3 sum=vec3(0.),tr=vec3(1.);float mu=dot(d,cameraUp);
 if(height>=0.&&height<160.&&amount>0.&&localAir==1){
  float limit=min(hit,1400.),cursor=0.,reach=cloudScale*${(30/cloudFeatureScale).toFixed(8)};vec4 banks=heightBand(d,low,high,limit);
  vec3 airLight=hazeTint*(direct+fill*1.4);
  if(clouds==1&&weather>0.)for(int bank=0;bank<2;bank++){
   vec2 range=containedRange(d,bank==0?banks.xy:banks.zw);float start=range.x,end=min(range.y,start+reach);if(end<=start)continue;
   airSegment(sum,tr,d,cursor,start,airLight);
   float dt=(end-start)/float(steps),jitter=hash(gl_FragCoord.xy),phaseLight=.46+.54*pow(max(0.,mu),8.);
   float lod=max(0.,log2(max(.001,dt/cloudScale)*4.)-.7);
   float pixelAngle=panorama==1?6.28318530718/volumeResolution.x:2.*tan(fov*.5)/volumeResolution.x;
   for(int i=0;i<144;i++){if(i>=steps||max(tr.r,max(tr.g,tr.b))<.007)break;
    float t=start+(float(i)+jitter)*dt;vec3 p=d*t;
    // Cloud billows must respect the lateral pixel footprint, not just the
    // raymarch step. The latter stays tiny even when a pixel spans kilometres.
    float pixelLod=log2(max(.001,t*pixelAngle*2./max(.02,abs(mu)))*4./cloudScale);
    float sampleLod=max(lod,pixelLod),h=altitude(p),rho=density(p,sampleLod)*(1.-smoothstep(start+reach*.72,start+reach,t));
    float cloudTau=rho*dt*.78*amount;
    // The whole step lies inside the clipped air interval. Integrating it is
    // continuous as the boundary moves; no samples switch a kilometre of air on.
    float middle=start+(float(i)+.5)*dt,offset=dt*.2886751346;
    float airTau=(airDensity(d,middle-offset)+airDensity(d,middle+offset))*.5*dt*amount/110.;
    vec3 tau=vec3(cloudTau)+vec3(.52,.74,1.)*airTau;
    if(max(tau.r,max(tau.g,tau.b))<.00001)continue;
    float shadow=0.;if(rho>.015){float lengthToTop=max(.1,high-h),lightStep=lengthToTop/4.;float shadowLod=max(sampleLod,max(1.,log2(max(.001,lightStep/cloudScale)*4.)-.7));for(int j=0;j<4;j++)shadow+=density(p+cameraUp*(float(j)+.5)*lightStep,shadowLod)*lightStep;}
    float sun=exp(-shadow*1.05*amount),multiple=.14*(1.-exp(-rho*max(0.,high-h)*.8));
    vec3 light=cloudTint*(direct*(phaseLight*sun+multiple)+fill*1.8);
    if(spores==1)light+=cloudTint*.012*weather;
    vec3 scatter=(light*cloudTau+airLight*vec3(.52,.74,1.)*airTau)/max(vec3(.000001),tau),atten=exp(-tau);
    sum+=tr*(1.-atten)*scatter;tr*=atten;
   }
   cursor=end;
  }
  airSegment(sum,tr,d,cursor,limit,airLight);
 }
 // A separate, extremely tenuous cavity dust study. Its optical depth scales
 // with R, and its segment ends at visible geometry or the cavity boundary.
 float rr=1.-height/radius,b=-mu*rr,c=(rr-1.)*(rr+1.),disc=b*b-c;
 if(cavityHaze>0.&&disc>0.){float root=sqrt(disc),a=max(0.,-b-root),z=min(hit/radius,-b+root),length=max(0.,z-a);
  float tau=length*cavityHaze*1.05,atten=exp(-tau);vec3 dust=vec3(.031,.043,.058)*stellarPower*(.75+.25*pow(max(0.,mu),4.));
  sum+=tr*(1.-atten)*dust;tr*=atten;
 }
 scattering=vec4(sum,1.);transmission=vec4(tr,depth);
}`;
const composite=`#version 300 es
precision highp float;in vec2 vUV;out vec4 fragColor;
uniform sampler2D source,sceneDepth,volumeLight,volumeTrans;uniform vec2 volumeSize;
void main(){float depth=texture(sceneDepth,vUV).r;vec2 p=vUV*volumeSize-.5,base=floor(p),f=fract(p);vec3 light=vec3(0.),tr=vec3(0.);float total=0.,best=1e20;vec3 nearestLight=vec3(0.),nearestTr=vec3(1.);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec2 uv=(base+vec2(x,y)+.5)/volumeSize;vec4 t=texture(volumeTrans,uv);vec3 l=texture(volumeLight,uv).rgb;float error=abs(t.a-depth);
  float weight=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y)*exp(-error*900.);light+=l*weight;tr+=t.rgb*weight;total+=weight;
  if(error<best){best=error;nearestLight=l;nearestTr=t.rgb;}
 }
 if(total<.00001){light=nearestLight;tr=nearestTr;}else{light/=total;tr/=total;}
 fragColor=vec4(texture(source,vUV).rgb*tr+light,1.);
}`;
// The overview only needs this small shader. Compile the cloud graph when a
// lower-atmosphere view is first requested, rather than delaying the first view.
const dust=march.slice(0,march.indexOf('float containedAir'))+march.slice(march.indexOf('vec3 ray(){'),march.indexOf('// Shape is'))+`
void main(){vec3 d=ray();float depth=texture(sceneDepth,vUV).r,hit=depth>=.999999?1e20:exp2(depth*log2(1.+4.*radius))-1.,mu=dot(d,cameraUp),rr=1.-height/radius,b=-mu*rr,c=(rr-1.)*(rr+1.),disc=b*b-c;
 vec3 light=vec3(0.),tr=vec3(1.);if(cavityHaze>0.&&disc>0.){float root=sqrt(disc),a=max(0.,-b-root),z=min(hit/radius,-b+root),distance=max(0.,z-a),atten=exp(-distance*cavityHaze*1.05);light=vec3(.031,.043,.058)*stellarPower*(.75+.25*pow(max(0.,mu),4.))*(1.-atten);tr=vec3(atten);}
 scattering=vec4(light,1.);transmission=vec4(tr,depth);
}`;
// Three bounded, filtered weather layers take over beyond the local volume.
// Geographic wavelengths never follow the camera. Distance changes their
// contribution, so small fields emerge without stretching or sliding the sky.
const weatherScales=[64,1024,16384,262144,1048576,4194304].map(scale=>scale*cloudFeatureScale);
const distantHelpers=`
uniform vec3 macroPhase[6],climateAxis,climateRight,climateUp;
uniform vec2 cloudEvolution[3];uniform sampler2D climateMap;
uniform float weatherTime;uniform int precipitation,storm,regionalTint;
uniform int weatherShadeCount,weatherShadeShape;uniform float weatherShadeTrim,weatherStarAngle;
uniform vec4 weatherShadeNormal[18],weatherShadeRight[18],weatherShadeSize[18];
vec4 climateAt(vec3 q,float footprint){
 vec2 uv=vec2(atan(dot(q,climateUp),dot(q,climateRight))/6.28318530718+.5,asin(clamp(dot(q,climateAxis),-1.,1.))/3.14159265359+.5);
 float lod=max(0.,log2(footprint/radius*256./3.14159265359));
 vec4 climate=textureLod(climateMap,uv,lod);
 if(regionalTint==0)climate.rgb=vec3(.65,.70,.75);return climate;
}
// Low banks, middle fields and high veils have independent masks and winds.
// Slow mask evolution uses only the saved scene clock, including paused exports.
vec2 weatherField(vec3 p,float footprint,int layer,float remoteness){
 const float scales[6]=float[6](${weatherScales.map(x=>x.toFixed(12)).join(',')});
 vec3 offset=vec3(float(layer)*.237,float(layer)*.419,float(layer)*.173);
 vec3 frontUV=(macroPhase[5]+p/scales[5])/32.+offset;
 vec4 front=textureLod(densityVolume,frontUV,max(0.,log2(footprint*2./scales[5])));
 float fields[6];
 for(int i=0;i<6;i++){
  float lod=max(0.,log2(footprint*2./scales[i]));
  vec3 uv=(macroPhase[i]+p/scales[i])/32.+offset+(front.gbr-.5)*.19;
  if(layer==1)uv=uv.zxy;
  // Integer frequency transforms preserve the phase anchor's wrap period.
  // Fractional UV stretches would make the pattern jump at a rebasing seam.
  if(layer==2){uv=uv.yzx*vec3(2.,1.,1.);lod+=1.;}
  vec4 n=textureLod(densityVolume,uv,lod);fields[i]=n.r*.64+n.g*.25+n.a*.11;
 }
 float broad=fields[5]*.42+fields[4]*.34+fields[3]*.24;
 float banks=fields[5]*.06+fields[4]*.25+fields[3]*.47+fields[2]*.22;
 float billows=fields[3]*.14+fields[2]*.38+fields[1]*.33+fields[0]*.15;
 float mass=layer==0?mix(broad*.52+banks*.34+billows*.14,banks*.78+billows*.22,remoteness):layer==1?mix(broad*.65+banks*.35,banks*.92+billows*.08,remoteness):mix(broad,banks,remoteness*.72);
 vec3 maskUV=frontUV*2.+vec3(cloudEvolution[layer]*.055,0.);
 float mask=textureLod(densityVolume,maskUV,max(0.,log2(footprint*4./scales[5]))).b;
 // Broad fronts control where small fields live without turning into large,
 // equally bright cotton balls themselves. The mask never becomes a hard cut.
 float opening=smoothstep(.23,.69,front.b*.60+mask*.40);
 return vec2(mass+(mask-.5)*.07,opening);
}
float weatherSun(vec3 q,float footprint){
 float visible=1.;
 for(int i=0;i<18;i++){if(i>=weatherShadeCount)break;
  vec3 n=weatherShadeNormal[i].xyz,r=weatherShadeRight[i].xyz,u=cross(n,r);float facing=dot(q,n);if(facing<=0.)continue;
  vec2 uv=vec2(dot(q,r),dot(q,u))/facing/weatherShadeSize[i].xy;
  float blur=clamp((weatherStarAngle+footprint/radius*1.5)/min(weatherShadeSize[i].x,weatherShadeSize[i].y),.002,.2);
  float edge=weatherShadeShape==1?1.-max(abs(uv.x),abs(uv.y)):1.-length(uv);
  if(weatherShadeShape==3)edge=min(edge,weatherShadeTrim-abs(uv.x));
  float cover=smoothstep(-blur,blur,edge);
  if(weatherShadeNormal[i].w>.5){
   // Resolve the authored fracture families, but filter subpixel cracks rather
   // than scattering bright holes over distant clouds.
   int family=int(weatherShadeRight[i].w)%3;float opening;
   if(family==0)opening=min(uv.x-(.09+.055*sin(uv.y*17.)+.017*sin(uv.y*53.)),uv.y+.31);
   else if(family==1)opening=min(uv.y-(.13+.10*sin(uv.x*12.)),uv.x+.43);
   else opening=uv.x+.36*uv.y-(.20+.04*sin(uv.y*31.));
   cover*=1.-smoothstep(-blur,blur,opening);
  }
  visible*=1.-cover*.97;
 }
 return visible;
}
vec3 distantClouds(vec3 d,float hit,out vec3 trans){
 trans=vec3(1.);if(clouds==0||weather<=0.||height<0.||amount<=0.)return vec3(0.);
 // At cavity distances two cloud radii can round to the same float. Intersect
 // one middle surface and integrate its thickness analytically, never subtract
 // two AU-sized depths to recover a kilometre-sized layer.
 // Use the shell renderer's normalized equation for the depth comparison.
 // Mixing kilometre-sized and radius-normalized roots amplifies rounding on
 // grazing rays and can turn a continuous horizon into a row of missing pixels.
 float h=height/radius,b=-(1.-h)*dot(d,cameraUp),c=-h*(2.-h),root=sqrt(max(0.,b*b-c));
 float ground=(b>0.?(-c)/(b+root):-b+root)*radius;
 // A Place's storm/coverage and aerosol profile describe its nearby weather.
 // They cannot fill the far side of the Sphere or jump when the camera passes
 // the centre and its nearest biome changes. Distant systems have their own
 // restrained coverage and column; only resolved regional weather uses the
 // local controls. All of these are receiver distances, not time since takeoff.
 float localWeather=1.-smoothstep(300000.,3000000.,ground);
 float thickness=mix(1.5,high-low,localWeather);
 float t=heightRoots(d,mix(2.5,(low+high)*.5,localWeather)).y;
 vec3 normal=normalize(d*ground-cameraUp*(radius-height));float facing=abs(dot(d,normal)),slant=max(.02,facing);
 // Include the ray-normal dot product's float error as well as log-depth
 // quantization. At the horizon its error is amplified by 1 / cos(incidence).
 float tolerance=max(16.,ground*max(16e-6,1e-6/max(.001,facing)));
 // The distant layer belongs to the visible shell: an open Wound, a Shade or
 // the star must not receive clouds from the intact sphere behind that object.
 if(hit>1e19||t<=0.||ground<=0.||hit<t-tolerance||abs(hit-ground)>tolerance)return vec3(0.);
 vec3 p=d*t;
 float pixelAngle=panorama==1?6.28318530718/volumeResolution.x:2.*tan(fov*.5)/volumeResolution.x;
 float footprint=max(.001,t*pixelAngle*2./slant),remoteness=smoothstep(2000000.,100000000.,t);
 vec4 climate=climateAt(normal,footprint);float coverage=mix(climate.a,weather,localWeather);
 float scaleFade=mix(1.,.14,smoothstep(1500000.,radius*.82,t));
 float sun=weatherSun(normal,footprint);
 if(height<160.)sun=mix(sun,direct/max(.000001,stellarPower),1.-smoothstep(400.,1800.,t));
 vec3 regional=mix(cloudTint,climate.rgb,smoothstep(15000.,1000000.,t));
 vec3 light=vec3(0.),cloudTrans=vec3(1.);float overburden=0.;
 // Above the deck the upper veil is nearest the eye. Under it, reverse the
 // order. Each layer has its own curved height, profile and alpha mask.
 for(int pass=0;pass<3;pass++){
  int layer=height>high?2-pass:pass;float index=float(layer);
  float level=mix(2.5,(low+high)*.5,localWeather)+index*mix(5.,max(.3,high-low)*1.6,localWeather);
  float layerT=heightRoots(d,level).y;if(layerT<=0.||layerT>hit+tolerance)continue;
  float layerFootprint=max(.001,layerT*pixelAngle*2./slant);
  vec2 field=weatherField(d*layerT,layerFootprint,layer,remoteness);
  float threshold=mix(.60,.29,coverage)+index*.006;
  float body=smoothstep(threshold,threshold+.17,field.x);
  float mask=mix(smoothstep(.12,.88,field.y),1.,localWeather*.65);float rho=body*mask*mix(.65,cloudDensity,localWeather);
  float strength=layer==0?1.:layer==1?.36:.14;
  if(layer==0&&t<1800.){float fine=density(p,max(0.,log2(footprint/cloudScale)+2.));rho=mix(fine*.80,rho,smoothstep(120.,1800.,t));}
  // Extra layers recede before the local volume, preserving the ground weather.
  if(layer>0)strength*=smoothstep(900.,12000.,t);
  float tau=rho*min(7.,thickness/slant)*1.15*amount*strength*scaleFade;
  vec3 atten=vec3(exp(-tau));
  vec3 tint=mix(regional,vec3(.67,.73,.83),index*.17);
  float relief=mix(.38,1.,pow(max(0.,1.-body),.65));
  float phaseLight=.60+.25*pow(facing,2.);float selfShadow=exp(-overburden*.75);
  vec3 illumination=tint*(stellarPower*sun*phaseLight*relief*selfShadow+fill*1.55);
  // Gentle cool extinction reduces far contrast without whitening the cavity.
  illumination=mix(illumination,vec3(.10,.145,.205)*(stellarPower*.6+fill),remoteness*.32);
  light+=cloudTrans*(1.-atten)*illumination;cloudTrans*=atten;overburden+=rho*strength;
 }
 vec3 airTrans=exp(-vec3(.52,.74,1.)*(amount*.048/slant)*mix(1.,.52,remoteness));
 vec3 airLight=mix(hazeTint,vec3(.075,.115,.18),smoothstep(15000.,1000000.,t))*(stellarPower*sun+fill*1.4);
 trans=cloudTrans*airTrans;
 return light+cloudTrans*(1.-airTrans)*airLight;
}
vec3 cavityColumn(vec3 d,float hit,out vec3 trans){
 trans=vec3(1.);float mu=dot(d,cameraUp),rr=1.-height/radius,b=-mu*rr,c=(rr-1.)*(rr+1.),disc=b*b-c;
 if(cavityHaze<=0.||disc<=0.)return vec3(0.);
 float root=sqrt(disc),a=max(0.,-b-root),z=min(hit/radius,-b+root),distance=max(0.,z-a),atten=exp(-distance*cavityHaze*1.05);
 trans=vec3(atten);return vec3(.031,.043,.058)*stellarPower*(.75+.25*pow(max(0.,mu),4.))*(1.-atten);
}
void fallingWeather(inout vec3 sum,inout vec3 tr,vec3 d,float hit){
 if(precipitation==0||height<0.||height>low||amount<=0.||localAir==0)return;
 // Direction-space streaks with scene-clock motion. Frozen time freezes every
 // drop, including panorama cube faces and repeated image exports.
 vec3 direction=normalize(d-cameraUp*dot(d,cameraUp)+vec3(.00001));
 float azimuth=atan(direction.z,direction.x),vertical=dot(d,cameraUp);
 vec2 cell=vec2(azimuth*440.,vertical*35.+weatherTime*13.);float lane=fract(cell.x),row=floor(cell.y);
 float drop=(1.-smoothstep(.025,.11,abs(lane-.5)))*smoothstep(.24,.95,fract(cell.y))*step(.76,hash(vec2(floor(cell.x),row)));
 float visibility=(1.-smoothstep(.3,.95,vertical))*smoothstep(.002,.012,hit),rain=drop*.28*visibility*weather;
 vec3 colour=cloudTint*(direct*.4+fill*2.+.008);sum+=tr*rain*colour;tr*=1.-rain*.3;
 if(storm==1){float cycle=floor(weatherTime/7.),pulse=exp(-pow(fract(weatherTime/7.)*7.-.18,2.)*180.)*step(.56,hash(vec2(cycle,17.)));
  sum+=tr*cloudTint*pulse*.14*visibility;
 }
}
`;
const helperPoint=march.indexOf('void main(){'),header=march.slice(0,helperPoint);
const far=header+distantHelpers+`
void main(){vec3 d=ray();float depth=texture(sceneDepth,vUV).r,hit=depth>=.999999?1e20:exp2(depth*log2(1.+4.*radius))-1.;
 vec3 tr,light=distantClouds(d,hit,tr),dustTrans;vec3 dustLight=cavityColumn(d,hit,dustTrans);
 // The cavity lies in front of the remote clouds. Attenuate their scattered
 // light as well as the surface behind them, then add foreground dust light.
 light=light*dustTrans+dustLight;tr*=dustTrans;
 scattering=vec4(light,1.);transmission=vec4(tr,depth);
}`;
const local=march.slice(0,helperPoint)+distantHelpers+march.slice(helperPoint).replace(' // A separate, extremely tenuous',`
 // Representation follows the distance being viewed as well as altitude.
 // From below the clouds, distant weather sits behind the nearby volume. From
 // above it, resolved billows gradually become banks and broad weather fronts.
 bool distantComposed=false;
 if(hit>800.||height>80.){vec3 farTrans,dustTrans;vec3 farLight=distantClouds(d,hit,farTrans),dustLight=cavityColumn(d,hit,dustTrans);farLight=farLight*dustTrans+dustLight;farTrans*=dustTrans;
  if(height>high){float blend=max(smoothstep(800.,1800.,hit),smoothstep(80.,160.,height));sum=mix(sum,farLight,blend);tr=mix(tr,farTrans,blend);distantComposed=true;}
  else if(hit>1800.){sum+=tr*farLight;tr*=farTrans;distantComposed=true;}
 }
 fallingWeather(sum,tr,d,hit);
 // A separate, extremely tenuous`).replace('if(cavityHaze>0.&&disc>0.)','if(!distantComposed&&cavityHaze>0.&&disc>0.)');
// Match the depth sample's full-resolution ray when weather is drawn at a
// reduced resolution. A half-pixel ray mismatch at 250,000 km can be hundreds
// of kilometres, incorrectly clipping a kilometre-thick cloud deck in half.
const depthRay=source=>source.replace('vec2 xy=vUV*2.-1.;','vec2 xy=((floor(vUV*resolution)+.5)/resolution)*2.-1.;').replaceAll('texture(sceneDepth,vUV)','texelFetch(sceneDepth,ivec2(floor(vUV*resolution)),0)');
root.SphereVolume={noiseVolume,cloudFeatureScale,weatherScales,march:depthRay(local),far:depthRay(far),dust:depthRay(dust),composite};
})(typeof window==='undefined'?globalThis:window);
