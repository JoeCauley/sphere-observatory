/* Modern Violet Labyrinth geography shared by the analytic shell and connected ground. */
(function(root){
'use strict';
const patch=root.SphereShaderSections.section('violet-mineral-geography');
const source=`${root.SphereVioletForest?.glsl||''}// The regional beds and local mineral facets both sample shell-fixed coordinates.
// The local waves have periods dividing their 64-unit CPU anchor.
vec3 violetRock(vec3 col,vec3 delta,float footprint,float distanceKm){
 // Regional beds are fixed to the shell. Each octave disappears as its rocks
 // fall below a pixel, long before it can repeat across a planetary view.
 float basin=1.-smoothstep(120.,500.,footprint);
 if(basin>0.){
   vec3 seed=vec3(uSeed*.03125,13.,29.);
   float broad=tnoise(uAnchor[3]+delta*.001+seed)-.5;
   float belt=1.-smoothstep(12.,55.,footprint);
   float detail=belt>0.?tnoise(uAnchor[4]+delta*.01+seed+broad)-.5:0.;
   col*=1.+basin*(broad*vec3(.42,.35,.48)+belt*detail*vec3(.25,.22,.29));
 }
 float visible=(1.-smoothstep(55.,${root.SphereVioletForest?.localMaterialKm??240}.,distanceKm))*(1.-smoothstep(.15,1.2,footprint));
 if(visible<=0.)return col;
 vec3 p=uBiomeAnchor[1]+delta/16.+vec3(uSeed*.03125);
 vec3 warp=.23*sin(6.2831853*(p.yzx/8.+p.zxy/16.));
 vec3 planes=cos(6.2831853*(vec3(p.x+.5*p.y,p.y-.5*p.z,p.z+.25*p.x)+warp));
 float peak=max(planes.x,max(planes.y,planes.z)),middle=max(min(planes.x,planes.y),min(max(planes.x,planes.y),planes.z));
 float gap=peak-middle,aa=clamp(footprint*.28,.008,.30);
 float fracture=1.-smoothstep(.02,.12+aa,gap);
 float quartz=1.-smoothstep(.03,.09+aa,abs(gap-.19));
 vec3 rock=col*mix(vec3(.83,.78,.94),vec3(1.13,1.07,1.10),.5+.5*peak);
 rock=mix(rock,vec3(.068,.027,.097),fracture*.70);
 rock+=vec3(.095,.068,.115)*quartz;
 ${root.SphereVioletForest?'rock=violetForkRock(rock,p,delta);':''}
 return mix(col,rock,visible);
}
`;
const call=' if(id==9)col=violetRock(col,delta,footprint,distanceKm);\n';
for(const name of ['fragment','geometryFragment']){
 let shader=root.SphereShaders[name];
 const signature='vec3 worldDetail(int id,vec3 q,vec3 delta,float footprint,float distanceKm){';
 shader=patch(shader,signature,source+signature);
 const engineering=' if(id>=10){\n  // Hierarchical service districts';
 root.SphereShaders[name]=patch(shader,engineering,call+engineering);
}
root.SphereShaderSections.register('violet-mineral-geography',source);
})(typeof window==='undefined'?globalThis:window);
