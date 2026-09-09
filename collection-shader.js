(function(){
const declarations=`
uniform int uCollection,uAfter,uManyWounds,uRoutes,uStation,uShineField,uGuide,uPlateCount,uShadeShape,uShadowSamples,uStationSamples;
uniform float uOrder,uRichness,uShadeTrim;
uniform vec3 uCavity;
uniform vec4 uDisks[18],uDiskNormals[18],uDiskRights[18];
uniform vec4 uWounds[6],uWoundTangents[6];
uniform vec4 uBelts[3],uBeltRights[3];
`;
const functions=`
float woundMetric(vec3 q,int i){vec3 axis=uWounds[i].xyz,tanv=uWoundTangents[i].xyz;float a=atan(dot(q,tanv),dot(q,axis)),b=asin(clamp(dot(q,cross(axis,tanv)),-1.,1.));float jag=1.+.13*sin(a*71.)+.055*sin(a*193.);return length(vec2(a/uWoundTangents[i].w,b/(uWounds[i].w*jag)));}
float woundField(vec3 q){float v=100.;for(int i=0;i<6;i++)v=min(v,woundMetric(q,i));return v;}
bool collectionHole(vec3 q){return uAfter==1&&uManyWounds==1&&woundField(q)<1.;}
bool diskSolid(vec2 p,int i){if(uShadeShape==3&&abs(p.x)>uShadeTrim)return false;if(uShadeShape==1?max(abs(p.x),abs(p.y))>1.:dot(p,p)>1.)return false;if(uDiskNormals[i].w<.5)return true;return !(p.x>.12&&p.y>-.2)&&abs(p.x+.3+.16*sin(p.y*9.))>.018&&abs(p.y+.18+.11*sin(p.x*10.))>.012;}
float diskHit(vec3 origin,vec3 d,int i){
 vec3 n=uDiskNormals[i].xyz,right=uDiskRights[i].xyz,up=cross(n,right);
 if(uShadeShape>=2){float r=length(uDisks[i].xyz),b=dot(origin,d),disc=r*r-dot(cross(origin,d),cross(origin,d));if(disc<0.)return 1e20;float root=sqrt(disc);
  for(int k=0;k<2;k++){float t=-b+(k==0?-root:root);if(t<=1e-10)continue;vec3 q=(origin+d*t)/r;float f=dot(q,n);if(f<=0.)continue;vec2 p=vec2(dot(q,right),dot(q,up))*r/(f*uDisks[i].w);if(diskSolid(p,i))return t;}return 1e20;
 }
 float den=dot(d,n);if(abs(den)<1e-10)return 1e20;float t=dot(uDisks[i].xyz-origin,n)/den;if(t<=1e-10)return 1e20;vec3 h=origin+d*t-uDisks[i].xyz;vec2 p=vec2(dot(h,right),dot(h,up))/uDisks[i].w;return diskSolid(p,i)?t:1e20;
}
float stationHit(vec3 origin,vec3 d){if(uStation==0)return 1e20;float near=1e20;for(int k=0;k<2;k++){vec3 n=normalize(k==0?vec3(.2,1,.3):vec3(.6,.25,1));float den=dot(d,n);if(abs(den)<1e-10)continue;vec3 closest=cross(d,cross(origin,d));float along=-dot(closest,n)/den;float t=-dot(origin,d)+along;if(t<=0.)continue;vec3 h=closest+d*along;float rr=length(h),rad=uStar*(k==0?3.2:5.2);vec3 right=normalize(cross(n,vec3(0,1,0))),up=cross(right,n);float a=atan(dot(h,up),dot(h,right));if(uAfter==1&&sin(a*3.+float(k))>.75)continue;if(abs(rr-rad)<uStar*.14||(rr>uStar*1.5&&rr<rad&&abs(sin(a*8.))<.022))near=min(near,t);}return near;}
// One shared stellar sample set: union of blockers, not products of partial shadows.
float collectionLightExcept(vec3 q,int receiver){
 vec3 sd=-normalize(q);float dist=length(q),stellarSlope=uStar/sqrt(max(1e-12,dist*dist-uStar*uStar));
 vec3 right=normalize(cross(sd,abs(sd.y)<=.999?vec3(0,1,0):vec3(1,0,0))),up=cross(right,sd);
 // Cull whole shade bounds once, then integrate the union on shared source rays.
 int candidates=0;
 for(int i=0;i<18;i++){if(i>=uPlateCount)break;if(i==receiver)continue;
  vec3 to=uDisks[i].xyz-q;float bound=uDisks[i].w*(uShadeShape==1?1.415:1.01),along=dot(to,sd);
  if(along+bound<0.||along-bound>dist||length(cross(to,sd))>bound+uStar*1.5)continue;candidates|=1<<i;
 }
 int count=uStation==1?max(uShadowSamples,uStationSamples):uShadowSamples;float visible=0.;
 for(int k=0;k<256;k++){if(k>=count)break;float a=float(k)*2.39996323,r=sqrt((float(k)+.5)/float(count))*stellarSlope;vec3 d=normalize(sd+(right*cos(a)+up*sin(a))*r);
  float starB=dot(q,d),starDisc=uStar*uStar-dot(cross(q,d),cross(q,d)),starT=-starB-sqrt(max(0.,starDisc));bool blocked=false;
  if(candidates!=0)for(int i=0;i<18;i++){if(i>=uPlateCount)break;if((candidates&(1<<i))==0)continue;if(diskHit(q,d,i)<starT){blocked=true;break;}}
  if(!blocked&&uStation==1)blocked=stationHit(q,d)<starT;
  if(!blocked)visible+=1.;
 }
 return visible/float(count);
}
float collectionLight(vec3 q){return collectionLightExcept(q,-1);}
// Shared construction vocabulary in kilometres; no normalization by shade diameter.
vec2 shadeCoordinates(vec3 hit,int i){vec3 n=uDiskNormals[i].xyz,r=uDiskRights[i].xyz,u=cross(n,r);
 if(uShadeShape>=2){vec3 q=normalize(hit);float radius=length(uDisks[i].xyz)*uRadius;return radius*vec2(atan(dot(q,r),dot(q,n)),asin(clamp(dot(q,u),-1.,1.)));}
 vec3 off=(hit-uDisks[i].xyz)*uRadius;return vec2(dot(off,r),dot(off,u));
}
float constructionRib(float km,float pitch,float footprint){float p=km/pitch,w=footprint/pitch;float fade=1.-smoothstep(.08,.35,w);float edge=abs(fract(p+.5)-.5);float line=1.-smoothstep(.008,.008+max(.001,w),edge);return mix(.016,line,fade);}
vec3 shadeMaterial(vec2 km){float footprint=max(length(dFdx(km)),length(dFdy(km)));
 float trunk=constructionRib(km.x,1000000.,footprint),service=constructionRib(km.y,100000.,footprint),skin=constructionRib(km.x+km.y*.25,1000.,footprint);
 float fade=1.-smoothstep(.08,.35,footprint/2000000.);float broad=.5+.5*sin(km.x/2000000.*6.283185+.15*sin(km.y/2000000.));
 vec3 body=mix(vec3(.045,.059,.068),vec3(.050,.064,.073),mix(.5,broad,fade));
 body=mix(body,vec3(.088,.082,.065),trunk*.32);body*=1.-service*.12-skin*.08;return body;
}
vec3 collectionPalette(float id){if(id<.5)return vec3(.015,.12,.065);if(id<1.5)return vec3(.02,.15,.18);if(id<2.5)return vec3(.115,.04,.15);if(id<3.5)return vec3(.22,.10,.025);if(id<4.5)return vec3(.16,.045,.055);if(id<5.5)return vec3(.23,.28,.16);if(id<6.5)return vec3(.025,.065,.18);return vec3(.13,.20,.21);}
vec3 collectionMaterial(vec3 q,vec3 delta,float footprint){
 float best=10.,lon=0.,sectorCount=24.;int band=0;
 for(int i=0;i<3;i++){float lat=asin(clamp(dot(q,uBelts[i].xyz),-1.,1.)),v=abs(lat)/uBelts[i].w;if(v<best){best=v;band=i;lon=atan(dot(q,cross(uBelts[i].xyz,uBeltRights[i].xyz)),dot(q,uBeltRights[i].xyz));sectorCount=uBeltRights[i].w;}}
 float cell=floor((lon/(2.*PI)+.5)*sectorCount),id=mod(cell+float(band)*3.+floor(uSeed),8.);
 float weight=clamp((1.15-best)/.25,0.,1.)*uOrder;
 vec3 hue=mix(vec3(.12,.13,.13),collectionPalette(id),uRichness);
 // Purposeful districts remain fixed as detail resolves inside them.
 float n=fbm(q*80.+uSeed),cloud=fbm(q*190.+vec3(3,7,19));
 float land=fbm(q*29.+vec3(fbm(q*43.)*2.)+uSeed*.13);
 vec3 metal=mix(vec3(.018,.023,.028),vec3(.055,.036,.023),smoothstep(.40,.67,fbm(q*9.+17.)));
 vec3 ocean=hue*vec3(.22,.42,.55);vec3 terrain=mix(ocean,hue,smoothstep(.37,.55,land));
 vec3 col=mix(metal,terrain,weight)*(.56+.9*n);
 float edge=abs(fract((lon/(2.*PI)+.5)*sectorCount)-.5);
 float seam=smoothstep(.478,.494,edge)*weight;
 col*=1.-seam*.45;
 float contour=abs(sin(best*12.+n*2.));col*=1.-(1.-weight)*smoothstep(.96,.995,contour)*.08;
 // Fine detail uses the existing stable anchor system, never a new world seed.
 const float scales[7]=float[7](100000.,10000.,1000.,100.,10.,1.,.1);
 for(int k=0;k<7;k++){float size=scales[k],fade=1.-smoothstep(.045,.22,footprint/size);if(fade>.002){vec3 p=uAnchor[k+1]+delta/size;float grain=tnoise(p+vec3(uSeed*.17))+tnoise(p*2.)*.35;col*=mix(1.,.65+.65*grain,fade*.5);}}
 float clouds=smoothstep(.64,.78,cloud)*weight*.10;col=mix(col,vec3(.45,.48,.44),clouds);
 if(uAfter==1&&uManyWounds==1){float w=woundField(q),scar=exp(-max(0.,w-1.)*2.);col=mix(col,vec3(.04,.031,.026)*(.6+n),scar*.85);float rim=exp(-abs(w-1.)*25.);col=mix(col,vec3(.24,.14,.065),rim*.7);}
 if(uGuide==1){for(int i=0;i<3;i++){float lat=abs(asin(clamp(dot(q,uBelts[i].xyz),-1.,1.)));float width=max(fwidth(lat)*1.2,.0003);float line=1.-smoothstep(width,width*2.,abs(lat-uBelts[i].w));col=mix(col,collectionPalette(float(i)*2.+1.),line*.75);}}
 if(uGrid==1){vec2 a=vec2(asin(clamp(q.y,-1.,1.)),atan(q.x,q.z))/(PI/12.);vec2 g=abs(fract(a+.5)-.5)/max(fwidth(a),vec2(.00001));col=mix(col,vec3(.055,.4,.37),(1.-smoothstep(.45,1.2,min(g.x,g.y)))*.8);}
 return max(col,vec3(.002));
}
`;
let src=SphereShaders.fragment.replace('const float PI=',declarations+'\nconst float PI=');
src=src.replace('void main(){',functions+'\nvoid main(){');
src=src.replace('bool hole=missing(q);','bool hole=uCollection==1?collectionHole(q):missing(q);');
src=src.replace('float tp=plateRelative(d,uPlateRelative),tstar=starHit(d);','int diskIndex=-1;float tp=uCollection==1?1e20:plateRelative(d,uPlateRelative),tstar=starHit(d);if(uCollection==1){for(int i=0;i<18;i++){if(i>=uPlateCount)break;float t=diskHit(camera(),d,i);if(t<tp){tp=t;diskIndex=i;}}}');
src=src.replace('if(tp<obj){obj=tp;kind=1;}','if(tp<obj){obj=tp;kind=1;}if(uCollection==1){float station=stationHit(camera(),d);if(station<obj){obj=station;kind=4;}}');
src=src.replace('vec3 col;','vec3 col;vec3 fill=uCollection==1&&uShineField==1?uCavity*(uShine*4.):vec3(uShine);');
src=src.replace("col=(uStyle==1?atlasMaterial(q,delta,footprint):shellMaterial(q))*(lightFraction(q)*uLuminosity+uShine);","col=(uCollection==1?collectionMaterial(q,delta,footprint):(uStyle==1?atlasMaterial(q,delta,footprint):shellMaterial(q)))*((uCollection==1?collectionLight(q):lightFraction(q))*uLuminosity+fill);");
src=src.replace('else if(kind==1){',`else if(kind==4){vec3 h=camera()+d*obj;float lighting=uLuminosity/max(.00001,dot(h,h));float a=atan(h.x,h.z);float modules=.3+.7*smoothstep(.18,.28,abs(sin(a*96.)));col=vec3(.10,.12,.14)*lighting*.008*modules+fill*.15;}
 else if(kind==1&&uCollection==1){vec3 hit=camera()+d*tp;vec3 normal=uShadeShape>=2?normalize(hit):uDiskNormals[diskIndex].xyz;
 float cosine=dot(d,normal)>0.?max(0.,dot(normal,normalize(hit))):0.;
 float sunlight=cosine>0.?collectionLightExcept(hit,diskIndex):0.;
 if(uMode==3){fragColor=vec4(vec3(sunlight),1.);return;}
 col=shadeMaterial(shadeCoordinates(hit,diskIndex))*(fill+cosine*sunlight*uLuminosity/max(.001,dot(hit,hit)));}
 else if(kind==1){`);
src=src.replace('float vis=lightFraction(uN);vec3 scatter=vec3(.10,.20,.38)*(vis*uLuminosity+uShine*1.5);','float vis=uCollection==1?collectionLight(uN):lightFraction(uN);vec3 scatter=vec3(.10,.20,.38)*(vis*uLuminosity+fill*1.5);');
src=src.replace('float(kind)/3.','float(kind)/(uCollection==1?4.:3.)');
src=src.replace('if(uMode==2)', 'if(uMode==5){fragColor=vec4(vec3(kind==0?collectionLight(normalize(camera()+d*obj)):0.),1.);return;}if(uMode==4){fragColor=vec4(vec3(kind==1?1.:0.),1.);return;}if(uMode==2)');
SphereShaders.fragment=src;
SphereCollection.upload=function(gl,uniforms,s){const C=SphereCollection,f=(k,x)=>gl.uniform1f(uniforms[k],x),i=(k,x)=>gl.uniform1i(uniforms[k],+x),v=(k,x)=>gl.uniform3fv(uniforms[k],x);
 f('uShadeTrim',s.shadeTrim??.65);i('uShadowSamples',s.shadowSamples||7);i('uStationSamples',s.stationSamples||64);i('uShadeShape',s.shadeShape==='trimmed'?3:s.shadeShape==='cap'?2:s.shadeShape==='square'?1:0);i('uCollection',s.collection);i('uAfter',s.era==='after');i('uManyWounds',s.multipleWounds);i('uRoutes',s.routeShades);i('uStation',s.starStation);i('uShineField',s.shineField);i('uGuide',s.routeGuides);f('uOrder',s.regionOrder);f('uRichness',s.colorRichness);
 if(!s.collection)return;const pp=C.plates(s),pack=(name,values,size)=>{while(values.length<size)values.push(0);gl.uniform4fv(uniforms[name+'[0]'],values);};i('uPlateCount',pp.length);pack('uDisks',pp.flatMap(p=>[...p.center,p.size]),72);pack('uDiskNormals',pp.flatMap(p=>[...p.normal,p.damage]),72);pack('uDiskRights',pp.flatMap(p=>[...p.right,p.id]),72);
 pack('uWounds',C.wounds.flatMap(w=>[...w.axis,w.width]),24);pack('uWoundTangents',C.wounds.flatMap(w=>[...w.tangent,w.length]),24);pack('uBelts',C.routes.flatMap(r=>[...r.normal,r.width]),12);pack('uBeltRights',C.routes.flatMap(r=>[...r.right,r.sectors]),12);v('uCavity',s.shineField?C.cavity(s):[0,0,0]);
};
})();
