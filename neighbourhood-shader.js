/* Shared graph uniforms; analytic shell fallback is available before any image load. */
(function(){
'use strict';const P=SphereNeighbourhood,M=SphereMath;
const declarations=`
uniform int uPackEnabled,uPackEdges;
uniform vec3 uPackX,uPackZ,uPackNormal,uPackBase;
uniform vec4 uPackA[128],uPackB[128],uPackC[128],uPackCatchments[6];
`;
const material=`
vec3 packMaterial(vec3 original,vec3 delta,float footprint){
 if(uPackEnabled==0)return original;
 float den=uPackBase.z+dot(delta,uPackNormal)/uRadius;if(den<=0.)return original;
 vec2 p=(uPackBase.xy+vec2(dot(delta,uPackX),dot(delta,uPackZ)))/den;
 float a=atan(p.y,p.x),r=length(p)/(1.+.13*sin(a*3.+.4)+.07*sin(a*7.-1.));
 float coverage=1.-smoothstep(49000.,65000.,r);if(coverage<=0.)return original;
 float river=1e20,route=1e20;
 for(int i=0;i<128;i++){if(i>=uPackEdges)break;vec4 v=uPackA[i];vec2 end=uPackB[i].xy,c1=uPackB[i].zw,c2=uPackC[i].xy;
  // A bounding rectangle rejects remote reaches before the distance calculation.
  float pad=max(v.z,v.w)*1.3+footprint*2.;if(any(lessThan(p,min(min(v.xy,end),min(c1,c2))-pad))||any(greaterThan(p,max(max(v.xy,end),max(c1,c2))+pad)))continue;
  vec2 start=v.xy;for(int j=1;j<=12;j++){float t=float(j)/12.,u=1.-t;vec2 next=u*u*u*v.xy+3.*u*u*t*c1+3.*u*t*t*c2+t*t*t*end,d=next-start;float f=clamp(dot(p-start,d)/max(.000001,dot(d,d)),0.,1.),w=mix(v.z,v.w,(float(j-1)+f)/12.),dist=length(p-start-d*f);
   river=min(river,dist-w);route=min(route,abs(dist-w-max(.08,w*.16))-max(.012,w*.015));start=next;
  }
 }
 float lake=(length((p-vec2(29400.,8800.))/vec2(2100.,1100.))-1.)*1100.;river=min(river,lake);
 float fw=max(.0001,footprint*.7),water=1.-smoothstep(-fw,fw,river),road=1.-smoothstep(-fw,fw,route);
 vec2 warped=p+vec2(sin(p.y/4200.),sin(p.x/6100.))*1100.;
 const vec3 colors[6]=vec3[6](vec3(.061,.098,.040),vec3(.118,.126,.055),vec3(.033,.076,.049),vec3(.105,.116,.051),vec3(.075,.092,.043),vec3(.043,.093,.057));
 vec3 land=vec3(0.);float weights=0.;for(int i=0;i<6;i++){float d=length(warped-uPackCatchments[i].xy)/uPackCatchments[i].z,w=exp(-min(40.,d*d*2.));land+=colors[i]*w;weights+=w;}land/=max(1e-20,weights);
 float broad=noise(vec3(p/2600.,.7))*.65+noise(vec3(p/700.,2.1))*.35;
 land*=.70+.65*broad;
 // The protected garden tends into the same green open land. No rectangular
 // image or catchment border is introduced around its retained terrain mesh.
 float core=1.-smoothstep(360.,1600.,length(p));land=mix(land,vec3(.055,.10,.029)*(.75+.5*noise(vec3(p*.018,0.))),core);
 land=mix(land,vec3(.14,.145,.08),road*.65*(1.-water));
 land=mix(land,vec3(.012,.086,.098),water);
 return mix(original,land,coverage);
}
`;
SphereShaders.fragment=SphereShaders.fragment.replace('uniform float uWaist,uTransition;',declarations+'\nuniform float uWaist,uTransition;').replace('vec3 surfaceMaterial(vec3 q,vec3 delta,float footprint,float distanceKm){',material+'\nvec3 surfaceMaterial(vec3 q,vec3 delta,float footprint,float distanceKm){').replace('float damage=woundDamage(q,delta);','col=packMaterial(col,delta,footprint);\n float damage=woundDamage(q,delta);');
P.shader={declarations,material};
const upload=SphereWorld.upload;
SphereWorld.upload=(gl,u,s)=>{upload(gl,u,s);const enabled=SpherePacks.enabled(s);gl.uniform1i(u.uPackEnabled,enabled?1:0);if(!enabled)return;
 const graph=P.model(s.provinceSeed),f=SphereWatershed.frame(s),n=M.norm(s.position);gl.uniform3fv(u.uPackX,f.basis[0]);gl.uniform3fv(u.uPackZ,f.basis[2]);gl.uniform3fv(u.uPackNormal,s.provinceAnchor);gl.uniform3fv(u.uPackBase,[M.dot(n,f.basis[0])*s.radius,M.dot(n,f.basis[2])*s.radius,M.dot(n,s.provinceAnchor)]);
 gl.uniform1i(u.uPackEdges,graph.edges.length);gl.uniform4fv(u['uPackA[0]'],graph.edges.flatMap(e=>[...e.a,e.widthA,e.widthB]));gl.uniform4fv(u['uPackB[0]'],graph.edges.flatMap(e=>[...e.b,...e.c1]));gl.uniform4fv(u['uPackC[0]'],graph.edges.flatMap(e=>[...e.c2,0,0]));gl.uniform4fv(u['uPackCatchments[0]'],graph.catchments.flatMap(c=>[c.x,c.z,c.r,0]));
};
})();
