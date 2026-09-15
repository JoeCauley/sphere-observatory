/* Shared graph uniforms; analytic shell fallback is available before any image load. */
(function(){
'use strict';const P=SphereNeighbourhood,M=SphereMath;
const declarations=`
uniform int uPackEnabled,uPackEdges,uPackArtRevision;
uniform vec3 uPackX,uPackZ,uPackNormal,uPackBase;
uniform vec4 uPackA[128],uPackB[128],uPackC[128],uPackCatchments[6];
uniform vec4 uPackDistricts[3],uPackAxes[3];
`;
const material=`
vec3 packCompositionWeights(vec2 p){
 vec3 weights=vec3(0.);
 for(int i=0;i<3;i++){vec2 d=p-uPackDistricts[i].xy,axis=uPackAxes[i].xy;
  vec2 local=vec2(dot(d,axis),dot(d,vec2(-axis.y,axis.x)));
  weights[i]=(1.-smoothstep(.55,1.,length(local/uPackDistricts[i].zw)))*smoothstep(1600.,2400.,length(p));
 }
 return weights/max(1.,weights.x+weights.y+weights.z);
}
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
 if(uPackArtRevision==2){
  vec3 weights=packCompositionWeights(p);
  // Filter regional planting bands to their mean before they become subpixel.
  vec2 d=p-uPackDistricts[1].xy,axis=uPackAxes[1].xy;
  vec2 along=vec2(dot(d,axis),dot(d,vec2(-axis.y,axis.x)));
  float planting=noise(vec3(along/vec2(950.,280.),1.7))*.65+noise(vec3(along/vec2(280.,180.),2.7))*.35;
  planting=smoothstep(.28,.72,planting);
  planting=mix(planting,.5,smoothstep(70.,400.,footprint));
  float shore=1.-smoothstep(0.,260.,max(0.,river));
  float mosaic=noise(vec3(p/480.,4.3));mosaic=mix(mosaic,.5,smoothstep(140.,650.,footprint));
  vec3 lakeLand=mix(vec3(.092,.14,.073),vec3(.23,.25,.14),shore)*(.82+.32*mosaic);
  vec3 reachLand=mix(vec3(.028,.068,.041),vec3(.094,.135,.052),planting)*(.85+.3*mosaic);
  vec3 meadowLand=mix(vec3(.17,.205,.070),vec3(.30,.265,.11),mosaic)*(.90+.16*planting);
  land=land*(1.-weights.x-weights.y-weights.z)+lakeLand*weights.x+reachLand*weights.y+meadowLand*weights.z;
  float grain=(noise(vec3(p/12.,2.4))-.5)*(1.-smoothstep(3.,18.,footprint))*.24;
  grain+=(noise(vec3(p/.4,7.1))-.5)*(1.-smoothstep(.1,.6,footprint))*.16;
  grain+=(noise(vec3(p/.016,9.8))-.5)*(1.-smoothstep(.004,.024,footprint))*.10;
  land*=1.+grain*(weights.x+weights.y+weights.z);
 }
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
 gl.uniform1i(u.uPackArtRevision,s.packAddress.artRevision);gl.uniform4fv(u['uPackDistricts[0]'],graph.compositions.flatMap(c=>[c.x,c.z,c.rx,c.rz]));gl.uniform4fv(u['uPackAxes[0]'],graph.compositions.flatMap(c=>[...c.axis,0,0]));
 gl.uniform1i(u.uPackEdges,graph.edges.length);gl.uniform4fv(u['uPackA[0]'],graph.edges.flatMap(e=>[...e.a,e.widthA,e.widthB]));gl.uniform4fv(u['uPackB[0]'],graph.edges.flatMap(e=>[...e.b,...e.c1]));gl.uniform4fv(u['uPackC[0]'],graph.edges.flatMap(e=>[...e.c2,0,0]));gl.uniform4fv(u['uPackCatchments[0]'],graph.catchments.flatMap(c=>[c.x,c.z,c.r,0]));
};
})();
