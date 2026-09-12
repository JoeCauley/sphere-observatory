/* Original periodic density volume and depth-aware WebGL2 atmosphere passes. */
(function(root){
'use strict';
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
uniform vec2 resolution;uniform vec4 rimPlane;
uniform float radius,height,fov,amount,weather,direct,low,high,cloudScale,cloudDensity,cavityHaze,stellarPower;
uniform int panorama,clouds,spores,clipRim,steps;
float containedAir(vec3 p){return clipRim==1?smoothstep(0.,.02,dot(p,rimPlane.xyz)+rimPlane.w):1.;}
float altitude(vec3 p){float h=dot(p,cameraUp),r=radius-height;
 // Rationalized radius difference keeps metre-scale heights at AU coordinates.
 float dr2=dot(p,p)-2.*r*h;return height-dr2/(sqrt(max(0.,r*r+dr2))+r);
}
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec3 ray(){vec2 xy=vUV*2.-1.;if(panorama==1){float lo=xy.x*3.14159265359,la=xy.y*1.57079632679;return normalize(forward*cos(la)*cos(lo)+right*cos(la)*sin(lo)+up*sin(la));}return normalize(forward+right*xy.x*tan(fov*.5)+up*xy.y*tan(fov*.5)*resolution.y/resolution.x);}
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
 float shape=cell.r*.42+cell.a*.30+textureLod(densityVolume,(p*2.+warp)/16.,lod).g*.20+textureLod(densityVolume,p*4./16.,lod).b*.08;
 float threshold=mix(.685,.295,weather)+.09*(broad.r-.5);
 float body=smoothstep(threshold,threshold+.19,shape)*vertical;
 float erosion=(1.-textureLod(densityVolume,p*8./16.,lod).g)*.19*(1.-body);
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
vec2 containedRange(vec3 d,vec2 range){if(clipRim==0)return range;
 float slope=dot(d,rimPlane.xyz);if(abs(slope)<1e-10)return rimPlane.w>=0.?range:vec2(0.);
 float t=-rimPlane.w/slope;if(slope>0.)range.x=max(range.x,t);else range.y=min(range.y,t);
 return vec2(range.x,max(range.x,range.y));
}
float airDensity(vec3 d,float t){return exp(-max(0.,altitude(d*t))/7.);}
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
 if(height>=0.&&height<160.&&amount>0.){
  float limit=min(hit,1400.),cursor=0.,reach=cloudScale*30.;vec4 banks=heightBand(d,low,high,limit);
  vec3 airLight=hazeTint*(direct+fill*1.4);
  if(clouds==1&&weather>0.)for(int bank=0;bank<2;bank++){
   vec2 range=containedRange(d,bank==0?banks.xy:banks.zw);float start=range.x,end=min(range.y,start+reach);if(end<=start)continue;
   airSegment(sum,tr,d,cursor,start,airLight);
   float dt=(end-start)/float(steps),jitter=hash(gl_FragCoord.xy),phaseLight=.46+.54*pow(max(0.,mu),8.);
   float lod=max(0.,log2(max(.001,dt/cloudScale)*4.)-.7);
   for(int i=0;i<144;i++){if(i>=steps||max(tr.r,max(tr.g,tr.b))<.007)break;
    float t=start+(float(i)+jitter)*dt;vec3 p=d*t;float h=altitude(p),rho=density(p,lod)*(1.-smoothstep(start+reach*.72,start+reach,t));
    float cloudTau=rho*dt*.78*amount;
    // The whole step lies inside the clipped air interval. Integrating it is
    // continuous as the boundary moves; no samples switch a kilometre of air on.
    float middle=start+(float(i)+.5)*dt,offset=dt*.2886751346;
    float airTau=(airDensity(d,middle-offset)+airDensity(d,middle+offset))*.5*dt*amount/110.;
    vec3 tau=vec3(cloudTau)+vec3(.52,.74,1.)*airTau;
    if(max(tau.r,max(tau.g,tau.b))<.00001)continue;
    float shadow=0.;if(rho>.015){float lengthToTop=max(.1,high-h),lightStep=lengthToTop/4.;for(int j=0;j<4;j++)shadow+=density(p+cameraUp*(float(j)+.5)*lightStep,1.)*lightStep;}
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
root.SphereVolume={noiseVolume,march,dust,composite};
})(typeof window==='undefined'?globalThis:window);
