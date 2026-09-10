(function(){
'use strict';const B=SphereBiomes;
const rgb=hex=>[1,3,5].map(i=>(parseInt(hex.slice(i,i+2),16)/255).toFixed(5));
const palette=B.catalog.map(b=>'vec3('+b.albedo.map(x=>x.toFixed(5)).join(',')+')').join(',');
const haze=B.catalog.map(b=>'vec3('+rgb(b.haze).join(',')+')').join(',');
const declarations=`
uniform highp sampler2DArray uBiomeTex,uHeroTex;
uniform vec3 uHeroAnchor;
uniform float uHeroReady[10];
uniform int uSurfaceRelief;
float surfaceBumpLight=1.;
uniform vec3 uBiomeAnchor[3];
uniform float uBiomeReady[10];
uniform int uBiomeOverride,uTextureDetail,uBiomeAtm;
const vec3 BIOME_ALBEDO[10]=vec3[10](${palette});
const vec3 BIOME_HAZE[10]=vec3[10](${haze});
`;
const functions=`
// IDs and the boundary blend are world-anchored, independent of camera and LOD.
vec3 biomeRegion(vec3 q){
 if(uBiomeOverride>=0)return vec3(float(uBiomeOverride),float(uBiomeOverride),0.);
 float x,best=10.;int band=0;
 if(uCollection==1){float lon=0.,sectors=24.;
  for(int i=0;i<3;i++){float v=abs(asin(clamp(dot(q,uBelts[i].xyz),-1.,1.)))/uBelts[i].w;
   if(v<best){best=v;band=i;lon=atan(dot(q,cross(uBelts[i].xyz,uBeltRights[i].xyz)),dot(q,uBeltRights[i].xyz));sectors=uBeltRights[i].w;}}
  x=(lon/(2.*PI)+.5)*sectors;
 }else{x=(atan(q.x,q.z)/(2.*PI)+.5)*24.;band=int(floor((asin(clamp(q.y,-1.,1.))/PI+.5)*12.));best=0.;}
 float id=mod(floor(x)+float(band)*3.+floor(uSeed),10.),next=mod(id+1.,10.);
 float edge=smoothstep(.90,1.,fract(x));
 if(uCollection==1){float belt=clamp((1.15-best)/.25,0.,1.)*uOrder;
  if(belt<1.)return vec3(uAfter==1?4.:5.,id,belt);
 }
 return vec3(id,next,edge);
}
vec3 biomeHaze(vec3 q){vec3 region=biomeRegion(q);return mix(BIOME_HAZE[int(region.x)],BIOME_HAZE[int(region.y)],region.z);}
vec2 tileHash(vec2 cell){cell=mod(cell,64.);return fract(sin(vec2(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3))))*43758.5453);}
vec3 tilePatch(highp sampler2DArray tex,vec2 uv,vec2 cell,float layer,vec2 dx,vec2 dy){
 vec2 hash=tileHash(cell);float turn=floor(hash.x*4.),c=cos(turn*PI*.5),s=sin(turn*PI*.5);mat2 rot=mat2(c,-s,s,c);
 // Sample inside each source image: no mirrored motifs or hard source-edge seams.
 vec2 coord=rot*(uv-cell)*.38+.5+(hash-.5)*.16;
 return textureGrad(tex,vec3(coord,layer),rot*dx*.38,rot*dy*.38).rgb;
}
vec3 stochasticTile(highp sampler2DArray tex,vec2 uv,float layer,vec2 dx,vec2 dy){
 vec2 cell=floor(uv),f=fract(uv);vec2 a,b,c;vec3 w;
 if(f.x+f.y<1.){a=cell;b=cell+vec2(1,0);c=cell+vec2(0,1);w=vec3(1.-f.x-f.y,f.x,f.y);}
 else{a=cell+vec2(1,1);b=cell+vec2(0,1);c=cell+vec2(1,0);w=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);}
 vec3 ca=tilePatch(tex,uv,a,layer,dx,dy),cb=tilePatch(tex,uv,b,layer,dx,dy),cc=tilePatch(tex,uv,c,layer,dx,dy);
 w=pow(max(w,vec3(0.)),vec3(4.));w*=exp(vec3(dot(ca,vec3(.333)),dot(cb,vec3(.333)),dot(cc,vec3(.333)))*2.);w/=max(.00001,w.x+w.y+w.z);
 return ca*w.x+cb*w.y+cc*w.z;
}
vec3 irregularTile(highp sampler2DArray tex,vec2 uv,float layer,vec2 dx,vec2 dy){
 // A periodic, smooth domain warp is anchored in world space, never in camera space.
 float k=2.*PI/64.;float a=k*dot(uv,vec2(2,3))+1.3,b=k*dot(uv,vec2(-3,2))+2.1;
 float c=k*dot(uv,vec2(7,-5))+.7,d=k*dot(uv,vec2(5,9))+3.7;
 vec2 du=k*(.85*cos(a)*vec2(2,3)+.25*cos(c)*vec2(7,-5));
 vec2 dv=k*(.85*cos(b)*vec2(-3,2)+.25*cos(d)*vec2(5,9));
 dx+=vec2(dot(du,dx),dot(dv,dx));dy+=vec2(dot(du,dy),dot(dv,dy));
 uv+=.85*sin(vec2(a,b))+.25*sin(vec2(c,d));
 vec2 grid=floor(uv);vec3 sum=vec3(0.);float total=0.;
 // Compact-support, jittered patches have no regular triangle/cell boundaries.
 // Support vanishes before any candidate leaves this 4x4 neighbourhood.
 for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){
  vec2 cell=grid+vec2(float(x),float(y)),h=tileHash(cell+vec2(17,31)),center=cell+(h-.5)*.7;
  vec2 relative=uv-center;float radius2=dot(relative,relative)/1.96;if(radius2>=1.)continue;
  vec2 crop=tileHash(cell+vec2(43,9));float angle=floor(h.x*4.)*PI*.5;mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
  float scale=.28+.32*h.y;vec2 coord=fract(rot*relative*scale+crop);
  float edge=min(min(coord.x,1.-coord.x),min(coord.y,1.-coord.y));float w=pow(1.-radius2,4.)*smoothstep(0.,.10,edge);if(w<.00001)continue;
  vec3 sampleColor=textureGrad(tex,vec3(coord,layer),rot*dx*scale,rot*dy*scale).rgb;
  sum+=sampleColor*w;total+=w;
 }
 return total>.00001?sum/total:stochasticTile(tex,uv,layer,dx,dy);
}
vec3 sampleSurface(highp sampler2DArray tex,float layer,vec3 p,vec3 tri,vec3 gx,vec3 gy,bool irregular){
 vec3 result=vec3(0.);
 if(tri.x>.001)result+=(irregular?irregularTile(tex,p.yz,layer,gx.yz,gy.yz):stochasticTile(tex,p.yz,layer,gx.yz,gy.yz))*tri.x;
 if(tri.y>.001)result+=(irregular?irregularTile(tex,p.xz,layer,gx.xz,gy.xz):stochasticTile(tex,p.xz,layer,gx.xz,gy.xz))*tri.y;
 if(tri.z>.001)result+=(irregular?irregularTile(tex,p.xy,layer,gx.xy,gy.xy):stochasticTile(tex,p.xy,layer,gx.xy,gy.xy))*tri.z;
 return result;
}
vec3 sampleBiome(int id,int tier,vec3 p,vec3 tri,vec3 gx,vec3 gy){return sampleSurface(uBiomeTex,float(id*3+tier),p,tri,gx,gy,false);}
vec3 surfaceMaterial(vec3 q,vec3 delta,float footprint,float distanceKm){
 vec3 col=uCollection==1?collectionMaterial(q,delta,footprint):(uStyle==1?atlasMaterial(q,delta,footprint):shellMaterial(q));
 if(uCollection==0&&uStyle==0)return col;
 vec3 region=biomeRegion(q);int a=int(region.x),b=int(region.y);float mixB=region.z;
 vec3 albedo=mix(BIOME_ALBEDO[a],BIOME_ALBEDO[b],mixB);
 // Preserve the distant atlas's landforms while identifying all ten biome families.
 float luminance=dot(col,vec3(.2126,.7152,.0722));col=mix(col,albedo*(.55+luminance*5.),.60);
 if(uTextureDetail==0)return col;
 vec3 tri=pow(abs(q),vec3(8.));tri/=max(.0001,tri.x+tri.y+tri.z);
 const float sizes[3]=float[3](256.,16.,1.);
 const float farKm[3]=float[3](1800.,180.,18.);
 const float nearKm[3]=float[3](600.,60.,6.);
 vec3 dx=dFdx(delta),dy=dFdy(delta);
 float heroFade=(1.-smoothstep(600.,1800.,distanceKm))*(1.-smoothstep(.12,.5,footprint/2.5));
 float heroReady=mix(uHeroReady[a],uHeroReady[b],mixB),heroWeight=heroFade*heroReady;
 for(int tier=0;tier<3;tier++){
  if(heroWeight>.999)continue;
  float fade=(1.-smoothstep(nearKm[tier],farKm[tier],distanceKm))*(1.-smoothstep(.03,.12,footprint/sizes[tier]));
  if(fade<.001)continue;
  vec3 p=uBiomeAnchor[tier]+delta/sizes[tier],gx=dx/sizes[tier],gy=dy/sizes[tier];
  float ra=uBiomeReady[a],rb=uBiomeReady[b];
  vec3 ca=col,cb=col;
  if(ra>.001&&mixB<.999)ca=mix(col,sampleBiome(a,tier,p,tri,gx,gy),ra);
  if(rb>.001&&mixB>.001)cb=mix(col,sampleBiome(b,tier,p,tri,gx,gy),rb);
  vec3 detail=mixB<.001?ca:mixB>.999?cb:mix(ca,cb,mixB);
  col=mix(col,detail,fade*.92);
 }
 if(heroWeight>.001){
  vec3 p=uHeroAnchor+delta/2.5,gx=dx/2.5,gy=dy/2.5;vec3 ca=col,cb=col;
  if(uHeroReady[a]>.001&&mixB<.999)ca=sampleSurface(uHeroTex,float(a),p,tri,gx,gy,a==2||a==3||a==7||a==8||a==9);
  if(uHeroReady[b]>.001&&mixB>.001)cb=sampleSurface(uHeroTex,float(b),p,tri,gx,gy,b==2||b==3||b==7||b==8||b==9);
  vec3 hero=mixB<.001?ca:mixB>.999?cb:mix(ca,cb,mixB);
  // Hero landmarks keep the same coordinates through their full mip chain.
  // A small, colour-neutral detail band restores close relief without replacing those landmarks.
  float fineFade=(1.-smoothstep(4.,24.,distanceKm))*(1.-smoothstep(.001,.006,footprint));
  float fineHeight=0.;
  if(fineFade>.001){
   vec3 mp=mod(uBiomeAnchor[2]*4.,64.)+delta/.25,mdx=dx/.25,mdy=dy/.25;
   vec3 fine=sampleBiome(a,2,mp,tri,mdx,mdy),blur=sampleBiome(a,2,mp,tri,mdx*16.,mdy*16.);
   float contrast=clamp(log(max(.004,dot(fine,vec3(.333)))/max(.004,dot(blur,vec3(.333)))),-.7,.7);
   float solid=(a==6||a==7)?smoothstep(.015,.09,hero.r-hero.b*.7):1.;
   hero*=exp(contrast*.30*fineFade*solid);fineHeight=contrast*.003*fineFade*solid;
  }
  col=mix(col,hero,heroWeight);
  if(uSurfaceRelief==1){
   const float reliefKm[10]=float[10](.015,.025,.060,.050,.020,.025,.008,.015,.015,.035);
   float height=pow(max(.0001,dot(hero,vec3(.2126,.7152,.0722))),.45)*mix(reliefKm[a],reliefKm[b],mixB)+fineHeight;
   vec3 n=-q,r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);
   vec3 gradient=(dFdx(height)*r1+dFdy(height)*r2)/((det<0.?-1.:1.)*max(abs(det),1e-12));
   gradient*=min(1.,.9/max(.0001,length(gradient)));
   vec3 bumpNormal=normalize(n-gradient);surfaceBumpLight=mix(1.,max(.65,dot(bumpNormal,n)),heroWeight);
  }
 }
 // Wounds and survey grid remain visible over every detail tier.
 if(uCollection==1&&uAfter==1&&uManyWounds==1){float scar=exp(-max(0.,woundField(q)-1.)*2.);col=mix(col,vec3(.04,.031,.026),scar*.6);}
 if(uGrid==1){vec2 uv=vec2(asin(clamp(q.y,-1.,1.)),atan(q.x,q.z))/(PI/12.);vec2 g=abs(fract(uv+.5)-.5)/max(fwidth(uv),vec2(.00001));col=mix(col,vec3(.055,.4,.37),(1.-smoothstep(.45,1.2,min(g.x,g.y)))*.8);}
 return max(col,vec3(.001));
}
`;
let src=SphereShaders.fragment.replace('const float PI=',declarations+'\nconst float PI=');
src=src.replace('void main(){',functions+'\nvoid main(){');
src=src.replace(/vec3 collectionPalette\(float id\)\{[^}]+\}/, 'vec3 collectionPalette(float id){return BIOME_ALBEDO[int(mod(id,10.))];}');
src=src.replace('mod(cell+float(band)*3.+floor(uSeed),8.)','mod(cell+float(band)*3.+floor(uSeed),10.)');
src=src.replace('(uCollection==1?collectionMaterial(q,delta,footprint):(uStyle==1?atlasMaterial(q,delta,footprint):shellMaterial(q)))','surfaceMaterial(q,delta,footprint,ts*uRadius)');
src=src.replace('col=surfaceMaterial(q,delta,footprint,ts*uRadius)*','vec3 ground=surfaceMaterial(q,delta,footprint,ts*uRadius);col=ground*');
src=src.replace('(uCollection==1?collectionLight(q):lightFraction(q))*uLuminosity+fill','(uCollection==1?collectionLight(q):lightFraction(q))*uLuminosity*surfaceBumpLight+fill');
src=src.replace('vec3 scatter=vec3(.10,.20,.38)*','vec3 scatter=mix(vec3(.10,.20,.38),biomeHaze(uN)*.38,float(uBiomeAtm))*');
SphereShaders.fragment=src;
})();
