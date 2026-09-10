window.SphereShaders={vertex:`#version 300 es
precision highp float;
out vec2 vUV;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}
`,fragment:`#version 300 es
precision highp float;
in vec2 vUV;out vec4 fragColor;
uniform vec2 uResolution;
uniform int uLinearOutput;
uniform vec3 uN,uForward,uRight,uUp,uBreachAxis,uPlateRelative,uPlateWorld;
uniform vec3 uAnchor[10];
uniform float uAtmosphereLight;
uniform float uH,uRadius,uStar,uLuminosity,uFov,uExposure,uShine,uAtm,uSeed;
uniform float uBreachChord,uPlateRadius,uDamage;
uniform float uBreachRoughness;
uniform int uStyle;
uniform int uBreach,uShade,uGrid,uMode,uPanorama,uStars;
uniform sampler2D uStarTex;
const float PI=3.141592653589793;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec3(4.3,7.1,2.8);a*=.5;}return v;}
vec3 camera(){return (1.-uH)*uN;}
float shellHit(vec3 d){float b=(1.-uH)*dot(uN,d),c=-uH*(2.-uH),s=sqrt(max(0.,b*b-c));return b>0.?(-c)/(b+s):-b+s;}
float breachEdge(vec3 q){vec3 r=normalize(cross(uBreachAxis,abs(uBreachAxis.y)>.999?vec3(1,0,0):vec3(0,1,0))),up=cross(r,uBreachAxis),delta=q-uBreachAxis;float a=atan(dot(delta,up),dot(delta,r));return uBreachChord*(1.+uBreachRoughness*(.12*sin(a*5.)+.05*sin(a*13.)+.03*sin(a*29.)));}
bool missing(vec3 q){return uBreach==1&&length(q-uBreachAxis)<breachEdge(q);}
bool onPlate(vec2 q){if(length(q)>uPlateRadius)return false;if(uDamage>0.&&length(q+vec2(.86,-.18)*uPlateRadius)<uPlateRadius*.42*uDamage)return false;return true;}
float plateRelative(vec3 d,vec3 rel){if(uShade==0||abs(d.z)<1e-10)return 1e20;float t=rel.z/d.z;if(t<=0.)return 1e20;return onPlate(d.xy*t-rel.xy)?t:1e20;}
float starHit(vec3 d){vec3 p=camera();float b=dot(p,d);vec3 c=cross(p,d);float disc=uStar*uStar-dot(c,c);if(disc<0.)return 1e20;float t=-b-sqrt(disc);return t>0.?t:1e20;}
float lightFraction(vec3 q){
 if(uShade==0)return 1.;
 vec3 rel=uPlateWorld-q,sd=-normalize(q);if(abs(sd.z)<1e-8)return 1.;
 float t=rel.z/sd.z;if(t<=0.||t>length(q))return 1.;
 vec2 hit=sd.xy*t-rel.xy;
 float spread=abs(t)*uStar/max(.01,abs(sd.z));
 float edge=length(hit)-uPlateRadius;
 if(edge>spread*1.5)return 1.;
 if(edge < -spread*1.5 && (uDamage==0.||length(hit+vec2(.86,-.18)*uPlateRadius)>uPlateRadius*.42*uDamage+spread*1.5))return 0.;
 vec3 right=normalize(cross(sd,abs(sd.y)<.9?vec3(0,1,0):vec3(1,0,0))),up=cross(right,sd);float lit=0.;
 for(int i=0;i<19;i++){float k=float(i),a=k*2.39996323,r=sqrt((k+.5)/19.)*uStar;vec3 target=(right*cos(a)+up*sin(a))*r;vec3 d=normalize(target-q);lit+=plateRelative(d,rel)>length(q)-uStar?1.:0.;}
 return lit/19.;
}
vec3 shellMaterial(vec3 q){
 vec3 p=q*18.+uSeed;
 float broad=fbm(q*4.+uSeed),m=fbm(p+fbm(p*1.8)*3.);
 float bands=abs(sin((q.x+q.y*.7)*110.+m*13.));
 float fine=fbm(p*12.);
 vec3 dark=vec3(.021,.028,.031),stone=vec3(.19,.151,.095);
 vec3 col=mix(dark,stone,smoothstep(.34,.72,m));
 col*=.72+.28*bands;
 col+=vec3(.014,.012,.009)*(fine-.3);
 col=mix(col,col*1.35,smoothstep(.84,.99,bands)*smoothstep(.50,.72,m));
 float preserve=smoothstep(.74,.79,fbm(q*51.+vec3(34,1,8)))*smoothstep(.35,.65,broad);
 col=mix(col,vec3(.055,.16,.145),preserve*.8);
 if(uBreach==1){float dist=length(q-uBreachAxis)-breachEdge(q);float scar=exp(-max(0.,dist)/max(.00001,uBreachChord*.25));col=mix(col,vec3(.23,.18,.10)*(.6+.5*fine),scar*.8);}
 if(uGrid==1){float la=asin(clamp(q.y,-1.,1.)),lo=atan(q.x,q.z),st=PI/12.;vec2 a=vec2(la,lo)/st;vec2 g=abs(fract(a+.5)-.5)/max(fwidth(a),vec2(.00001));float line=1.-smoothstep(.45,1.2,min(g.x,g.y));col=mix(col,vec3(.06,.36,.34),line*.8);}
 return max(col,vec3(.005));
}
float thash(vec3 p){return hash(mod(p,256.));}
float tnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(thash(i),thash(i+vec3(1,0,0)),f.x),mix(thash(i+vec3(0,1,0)),thash(i+vec3(1,1,0)),f.x),f.y),mix(mix(thash(i+vec3(0,0,1)),thash(i+vec3(1,0,1)),f.x),mix(thash(i+vec3(0,1,1)),thash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float panelLine(vec2 p,float fw){vec2 g=abs(fract(p)-.5);return 1.-smoothstep(max(.004,fw),max(.009,fw*2.),min(g.x,g.y));}
vec3 atlasMaterial(vec3 q,vec3 delta,float footprint){
 float reg=fbm(q*12.+vec3(uSeed*.073,1.7,3.1)),fine=fbm(q*95.+uSeed);
 float habitat=1.-smoothstep(.36,.38,reg),intact=smoothstep(.36,.38,reg)*(1.-smoothstep(.51,.53,reg));
 float fused=smoothstep(.51,.53,reg)*(1.-smoothstep(.67,.69,reg)),scoured=smoothstep(.67,.69,reg);
 vec3 col=habitat*vec3(.019,.055,.058)+intact*vec3(.112,.132,.128)+fused*vec3(.062,.047,.034)+scoured*vec3(.18,.13,.074);
 col*=.46+1.05*fine;
 float folds=abs(sin(q.x*170.+q.y*98.+fbm(q*13.)*18.));
 col=mix(col,col*1.4,fused*smoothstep(.90,.99,folds));
 vec3 tri=pow(abs(q),vec3(8.));tri/=max(.001,tri.x+tri.y+tri.z);
 const float sizes[10]=float[10](1000000.,100000.,10000.,1000.,100.,10.,1.,.1,.01,.001);
 for(int i=0;i<3;i++){
  float scale=sizes[i],fade=1.-smoothstep(.045,.22,footprint/scale);
  if(fade>.002){
   vec3 p=uAnchor[i]+delta/scale;
   vec3 warped=p+2.3*vec3(tnoise(p+vec3(7,3,11)),tnoise(p+vec3(31,17,2)),tnoise(p+vec3(2,41,5)));
   float n=tnoise(warped+vec3(uSeed*.17)),n2=tnoise(warped*2.+vec3(4,9,1));float fw=clamp(footprint/scale,.001,.2);
   float fractal=n*.57+n2*.29+tnoise(p*4.+vec3(11,3,7))*.14;
   float seams=i<3?0.:tri.x*panelLine(p.yz,fw)+tri.y*panelLine(p.xz,fw)+tri.z*panelLine(p.xy,fw);
   float arch=smoothstep(.46,.64,n+.09*n2);
   vec3 sea=mix(vec3(.014,.051,.071),vec3(.026,.125,.134),smoothstep(.42,.51,n));
   vec3 land=mix(vec3(.046,.085,.035),vec3(.13,.19,.068),n2);
   vec3 preserve=mix(sea,land,arch);
   float ripple=abs(sin(2.*PI*(p.x*2.+p.y+n)));
   vec3 metal=mix(vec3(.075,.093,.09),vec3(.16,.175,.15),n2)*(1.-seams*.68);
   vec3 melt=mix(vec3(.034,.035,.033),vec3(.12,.071,.035),smoothstep(.65,.94,ripple))*(.7+.6*n2);
   vec3 eroded=mix(vec3(.095,.058,.035),vec3(.32,.24,.14),n)*(1.-seams*.20);
   vec3 detail=habitat*preserve+intact*metal+fused*melt+scoured*eroded;
   if(i<3)col=mix(col,detail,fade*.48);
   else{
    // Fine layers modulate the existing region rather than replacing its coast.
    float ridge=pow(1.-abs(fractal*2.-1.),8.);
    float channel=smoothstep(.94,.985,ridge);
    float grain=.35+1.25*fractal;
    vec3 micro=col*grain;
    micro=mix(micro,micro*vec3(.43,.68,.78),habitat*channel*.55);
    micro*=1.-intact*seams*.65-fused*channel*.4-scoured*seams*.18;
    micro+=fused*vec3(.025,.012,.006)*pow(ripple,16.);
    col=mix(col,micro,fade*.65);
   }
  }
 }
 if(uBreach==1){float dist=length(q-uBreachAxis)-breachEdge(q),scar=exp(-max(0.,dist)/max(.000001,uBreachChord*.18));col=mix(col,vec3(.3,.21,.105)*(.6+.6*fine),scar*.75);}
 if(uGrid==1){vec2 a=vec2(asin(clamp(q.y,-1.,1.)),atan(q.x,q.z))/(PI/12.);vec2 g=abs(fract(a+.5)-.5)/max(fwidth(a),vec2(.00001));col=mix(col,vec3(.055,.4,.37),(1.-smoothstep(.45,1.2,min(g.x,g.y)))*.8);}
 return max(col,vec3(.002));
}
vec3 stars(vec3 d){if(uStars==0)return vec3(0.);vec2 uv=vec2(atan(d.x,d.z)/(2.*PI)+.5,asin(clamp(d.y,-1.,1.))/PI+.5);return texture(uStarTex,uv).rgb*.035;}
vec3 tone(vec3 x){x*=exp2(uExposure);x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
void main(){
 vec2 xy=(vUV*2.-1.);vec3 d;
 if(uPanorama==1){float lo=xy.x*PI,la=xy.y*PI*.5;d=normalize(uForward*cos(la)*cos(lo)+uRight*cos(la)*sin(lo)+uUp*sin(la));}
 else{float t=tan(uFov*.5);d=normalize(uForward+uRight*xy.x*t+uUp*xy.y*t*uResolution.y/uResolution.x);}
 float ts=shellHit(d);vec3 q=normalize(camera()+d*ts);bool hole=missing(q);
 vec3 delta=d*(ts*uRadius)-uN*(uH*uRadius);
 float footprint=max(length(dFdx(delta)),length(dFdy(delta)));
 float tp=plateRelative(d,uPlateRelative),tstar=starHit(d);float obj=hole?1e20:ts;int kind=0;
 if(tp<obj){obj=tp;kind=1;}if(tstar<obj){obj=tstar;kind=2;}if(obj>1e19)kind=3;
 if(uMode==2){fragColor=vec4(float(kind)/3.,0.,0.,1.);return;}
 vec3 col;
 if(kind==0){col=(uStyle==1?atlasMaterial(q,delta,footprint):shellMaterial(q))*(lightFraction(q)*uLuminosity+uShine);}
 else if(kind==1){vec2 pp=(d.xy*tp-uPlateRelative.xy)/uPlateRadius;float facets=.65+.35*step(.02,abs(sin(pp.x*30.)*sin(pp.y*30.)));vec3 hit=camera()+d*tp;float direct=max(0.,sign(d.z)*normalize(hit).z)*uLuminosity/max(1e-6,dot(hit,hit));col=vec3(.055,.063,.065)*facets*(uShine+direct);}
 else if(kind==2){col=vec3(1.,.93,.8)*uLuminosity/max(1e-7,uStar*uStar)*.04;}
 else{col=stars(d);}
 if(uMode==1){if(kind==3)col=vec3(0.);else{float v=clamp(log(1.+obj*1e6)/log(2000001.),0.,1.);col=mix(vec3(.05,.6,.51),vec3(.25,.12,.45),v);}}
 // Deliberately approximate local atmospheric transfer; no global multiple scattering.
 if(uAtm>0. && uMode==0 && uH*uRadius<160.){float hKm=uH*uRadius;float density=exp(-hKm/8.);float mu=-dot(d,uN);float segment=min(obj*uRadius,2000.);float column=abs(mu)<.001?density*segment/8.:density*(1.-exp(clamp(-mu*segment/8.,-30.,20.)))/mu;float optical=uAtm*max(0.,column);vec3 tr=exp(-vec3(.12,.23,.48)*optical);float vis=uAtmosphereLight;vec3 scatter=vec3(.10,.20,.38)*(vis*uLuminosity+uShine*1.5);col=col*tr+scatter*(1.-tr);}
 fragColor=vec4(uLinearOutput==1?clamp(col,vec3(0.),vec3(60000.)):tone(col),1.);
}`};
