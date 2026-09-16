/* Algebraically identical station predicates, without per-ray atan/sin work.
 * Geometry, finite-star sample positions/counts and blocker union are unchanged.
 * The unoptimized CPU implementation remains the independent reference. */
(function(){
'use strict';
const station=`int stationLightMask(vec3 q){
 if(uStation==0)return 0;float r2=dot(q,q),s2=uStar*uStar;if(r2<=s2)return 3;
 int mask=0;
 for(int k=0;k<2;k++){
  vec3 n=normalize(k==0?vec3(.2,1,.3):vec3(.6,.25,1));float height=abs(dot(q,n)),den=height*height-s2;
  if(den<=0.){mask|=1<<k;continue;}
  // The finite star projects an ellipse onto the station plane. Its centre
  // offset plus major radius bounds EVERY ray, including unsampled rays.
  float bound=(s2*sqrt(max(0.,r2-height*height))+uStar*height*sqrt(r2-s2))/den;
  // A 0.1% guard keeps float rounding conservative at the innermost spoke.
  if(bound>=uStar*1.4985)mask|=1<<k;
 }
 return mask;
}
float stationHitMasked(vec3 origin,vec3 d,int mask){
 if(uStation==0)return 1e20;
 float near=1e20,rayOffset=-dot(origin,d);vec3 closest=cross(d,cross(origin,d));
 for(int k=0;k<2;k++){
  if((mask&(1<<k))==0)continue;
  vec3 n=normalize(k==0?vec3(.2,1,.3):vec3(.6,.25,1));float den=dot(d,n);if(abs(den)<1e-10)continue;
  float along=-dot(closest,n)/den,t=rayOffset+along;if(t<=0.)continue;
  vec3 h=closest+d*along;float rr=length(h),rad=uStar*(k==0?3.2:5.2);
  bool ring=abs(rr-rad)<uStar*.14,spoke=rr>uStar*1.5&&rr<rad;
  if(!ring&&!spoke)continue;
  vec3 right=normalize(cross(n,vec3(0,1,0))),up=cross(right,n);
  vec2 a=normalize(vec2(dot(h,right),dot(h,up)));
  // sin(3 theta + k), using the same angular axes as atan(y,x).
  if(uAfter==1){float sin3=a.y*(3.-4.*a.y*a.y),cos3=a.x*(4.*a.x*a.x-3.);
   if(sin3*(k==0?1.:.5403023058681398)+cos3*(k==0?0.:.8414709848078965)>.75)continue;
  }
  // Repeated double-angle identities give sin(8 theta).
  float sin2=2.*a.x*a.y,cos2=a.x*a.x-a.y*a.y;
  float sin4=2.*sin2*cos2,cos4=cos2*cos2-sin2*sin2;
  if(ring||(spoke&&abs(2.*sin4*cos4)<.022))near=min(near,t);
 }
 return near;
}
float stationHit(vec3 origin,vec3 d){return stationHitMasked(origin,d,3);}`;
function optimize(source){const start=source.indexOf('float stationHit('),end=source.indexOf('// One shared stellar sample set:',start);if(start<0||end<0)throw Error('Station shader integration changed');const result=source.slice(0,start)+station+'\n'+source.slice(end),patch=SphereShaderSections.section('Station source-cone culling');return patch(patch(result,'if(candidates==0&&uStation==0)return 1.;','int stationCandidates=stationLightMask(q);if(candidates==0&&stationCandidates==0)return 1.;'),'if(!blocked&&uStation==1)blocked=stationHit(q,d)<starT;','if(!blocked&&stationCandidates!=0)blocked=stationHitMasked(q,d,stationCandidates)<starT;');}
SphereShaders.fragment=optimize(SphereShaders.fragment);
SphereShaders.geometryFragment=optimize(SphereShaders.geometryFragment);
if(window.SphereLegacyShaders)SphereLegacyShaders.fragment=optimize(SphereLegacyShaders.fragment);
window.SphereStationShaderOptimization={optimize,source:station};
})();
