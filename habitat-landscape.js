/* Replace the surveyed shader's photographic habitat tier with procedural terrain. */
(function(root){
'use strict';
const patch=root.SphereShaderSections.section('procedural-habitats');
const original=" // A resolved image tends to its own measured linear mean at planetary distances.\n float fade=(1.-smoothstep(700.,2200.,distanceKm))*(1.-smoothstep(.08,.45,footprint/2.5));\n vec3 tri=pow(abs(q),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);\n vec3 dx=dFdx(delta),dy=dFdy(delta);\n if(id<10&&uTextureDetail==1&&fade>.001&&uHeroReady[id]>.001){vec3 p=uHeroAnchor+delta/2.5;vec3 tex=sampleSurface(uHeroTex,float(id),p,tri,dx/2.5,dy/2.5,id==2||id==3||id==7||id==8||id==9);col=mix(col,tex,fade*uHeroReady[id]);\n  float detail=(1.-smoothstep(3.,20.,distanceKm))*(1.-smoothstep(.0008,.006,footprint));if(detail>.001&&uBiomeReady[id]>.001){vec3 p=mod(uBiomeAnchor[2]*8.,64.)+delta/.125,small=sampleBiome(id,2,p,tri,dx/.125,dy/.125),blur=sampleBiome(id,2,p,tri,dx/.125*12.,dy/.125*12.);float contrast=clamp(log(max(.003,dot(small,vec3(.333)))/max(.003,dot(blur,vec3(.333)))),-1.,1.);col*=exp(contrast*.38*detail);}\n }\n";
const terrain=` // Seeded habitat structure shares its phase across the shell and the connected ground.
 vec3 p=uBiomeAnchor[1]+delta/16.+vec3(uSeed*.03125);
 float habitatWeight=1.-smoothstep(.2,4.,footprint);
 // Violet supplies its own mineral material at these scales.
 if(id<9 && uTextureDetail==1 && habitatWeight>0.){
  float ridge=sin(6.2831853*(p.x+.5*p.z)+.8*sin(6.2831853*p.y)),crossing=sin(6.2831853*(p.y-p.z*.25));
  float field=tnoise(p*4.),pattern=ridge*crossing;
  if(id<=1){
   // Uneven belts of canopy and sheltered glades have no preferred grid direction.
   // The phase wraps at the same period as tnoise and the camera-relative anchor.
   vec3 stand=uAnchor[5]+delta/10.+vec3(3.,5.,11.)+vec3(uSeed*.03125);
   float shade=tnoise(stand),gap=smoothstep(.56,.76,shade);
   float clusters=tnoise(p*16.+vec3(7.,3.,13.))-.5;
   float clusterWeight=1.-smoothstep(.09,.65,footprint);
   col*=1.+habitatWeight*(.16*(field-.5)+.22*(gap-.25)+.095*clusters*clusterWeight);
  }
  else if(id==2||id==3)col*=1.+habitatWeight*(.26*ridge+.16*field);
  else if(id==4||id==5)col*=1.-habitatWeight*.4*(1.-smoothstep(.035,.15,min(abs(ridge),abs(crossing))));
  else col=mix(col,col*vec3(.60,.76,.92),habitatWeight*.45*pow(1.-abs(pattern),6.));
 }
 vec3 tri=pow(abs(q),vec3(8.));tri/=max(.00001,tri.x+tri.y+tri.z);
 vec3 dx=dFdx(delta),dy=dFdy(delta);
`;
for(const name of ['fragment','geometryFragment'])root.SphereShaders[name]=patch(root.SphereShaders[name],original,terrain);
root.SphereShaderSections.register('procedural-habitats',terrain);
})(typeof window==='undefined'?globalThis:window);
