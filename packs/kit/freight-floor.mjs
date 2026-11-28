// The packed blue channel also identifies the upper wearing surface.
export const freightFloorTint=[.44,.455,2+.425];

export const freightFloorGLSL = `
// Integrate the occupied length in a periodic strip. At grazing angles the
// two grate directions and concrete joints have very different pixel widths.
vec2 stripArea(vec2 p,vec2 duty){return floor(p)*duty+min(fract(p),duty);}
vec2 stripCoverage(vec2 cycles,vec2 width,vec2 duty){
 vec2 centre=fract(cycles)+duty*.5;
 return clamp((stripArea(centre+width*.5,duty)-stripArea(centre-width*.5,duty))/width,0.,1.);
}
vec2 filteredStrips(vec2 cycles,vec2 pixel,vec2 duty){
 return stripCoverage(cycles,max(pixel,vec2(.015)),duty);
}
// UV and pixel footprint are physical metres along and across the floor.
vec2 floorCuts(vec2 uv,vec2 pixel,vec2 pitch,vec2 width){
  return stripCoverage(uv/pitch,max(pixel,vec2(.001))/pitch,width/pitch);
}
float eitherStrip(vec2 bars){return bars.x+bars.y-bars.x*bars.y;}
vec3 pouredFloor(vec3 base,vec2 uv,vec2 detailUV,vec2 pixel){
  const vec2 pour=vec2(16.,8.),section=vec2(160.,80.);
  vec2 local=mod(uv,32000.),cell=floor(local/pour);
  float batch=hash(cell),field=hash(floor(local/section)+vec2(49.,7.));
  vec2 rel=pixel/pour;
  float seePour=1.-smoothstep(.12,.64,max(rel.x,rel.y));
  float seeSection=1.-smoothstep(12.,64.,max(pixel.x,pixel.y));
  // Adjacent concrete batches keep small hue and value differences above the height
  // where the fine saw cuts disappear. The light lip sits on one side of each cut.
  vec2 cut=floorCuts(uv,pixel,pour,vec2(.052,.040));
  vec2 lip=floorCuts(uv-.060,pixel,pour,vec2(.036,.024));
  vec2 seal=floorCuts(uv,pixel,section,vec2(.32,.24));
  vec2 shoulder=floorCuts(uv-.32,pixel,section,vec2(.20,.14));
  vec3 finish=base*(1.+(field-.5)*.085*seeSection+(batch-.5)*.070*seePour
    -.49*eitherStrip(cut)+.18*eitherStrip(lip)-.43*eitherStrip(seal)+.16*eitherStrip(shoulder));
  finish+=base*vec3(.025,.002,-.031)*(batch-.5)*seePour;
  float pixelM=max(pixel.x,pixel.y);
  vec2 metres=mod(detailUV,32.);
  if(pixelM<.35){
    // Overlapping broom passes leave shallow arcs in the paste between the stones.
    float pass=metres.y+.14*cos(metres.x*.785398+batch*3.)+batch*.6;
    float comb=floorCuts(vec2(0.,pass),pixel,vec2(1.,.8),vec2(.1,.090)).y;
    finish*=1.+.045*(comb-.1125)*(1.-smoothstep(.12,.35,pixelM));
  }
  if(pixelM<.045){
    vec2 grain=mat2(.8,.6,-.6,.8)*metres*40.,id=floor(grain);
    float stone=hash(id),seed=hash(id+vec2(19.,31.)),radius=.065+.19*seed;
    vec2 offset=vec2(stone-.5,hash(id+27.)-.5)*.72;
    vec2 fleck=fract(grain)-.5-offset;
    float d=length(vec2(fleck.x+(.7-seed)*fleck.y,fleck.y*(.75+.8*stone)));
    float aa=max(.025,pixelM*20.);
    float chip=(1.-smoothstep(radius-aa,radius+aa,d))*smoothstep(.25,.53,seed)*(1.-smoothstep(.006,.025,pixelM));
    float sweep=metres.y+.042*cos(metres.x*.785398+batch*3.)+batch*.19;
    float brush=floorCuts(vec2(0.,sweep),pixel,vec2(1.,.03125),vec2(.1,.004)).y;
    finish*=1.+chip*(stone>.62?.25:-.21)+.055*(brush-.128)*(1.-smoothstep(.012,.045,pixelM));
  }
  return finish;
}
// Steel access decks use removable panels with inset fasteners and alternating raised tread.
vec3 treadFloor(vec3 base,vec2 uv,vec2 detailUV,vec2 pixel){
  const vec2 pitch=vec2(2.,4.);
  vec2 cuts=floorCuts(uv,pixel,pitch,vec2(.020));
  vec2 edge=floorCuts(uv-.026,pixel,pitch,vec2(.014));
  float pixelM=max(pixel.x,pixel.y);
  float variation=(hash(floor(mod(uv,32000.)/pitch))-.5)*(1.-smoothstep(.30,1.2,pixelM));
  vec3 finish=base*(1.+.13*variation-.48*eitherStrip(cuts)+.21*eitherStrip(edge));
  if(pixelM<.12){
    vec2 stud=abs(mod(detailUV+vec2(1.,.5),vec2(2.,1.))-vec2(1.,.5))-vec2(.065,.09);
    float aa=max(.001,pixelM*.5),r=length(stud);
    float seat=1.-smoothstep(.023-aa,.023+aa,r),head=1.-smoothstep(.013-aa,.013+aa,r);
    vec2 tile=mod(detailUV,32.)*vec2(8.,16.),p=(fract(tile)-.5)/vec2(8.,16.);
    float signRow=1.-2.*mod(floor(tile.y),2.);
    vec2 axis=vec2(.8944,.4472*signRow);
    float along=dot(p,axis),across=dot(p,vec2(-axis.y,axis.x));
    float bar=length(vec2(max(abs(along)-.034,0.),across));
    float top=1.-smoothstep(.005-aa,.005+aa,bar);
    float bevel=1.-smoothstep(.008-aa,.008+aa,bar);
    finish*=1.+(-.26*bevel+.59*top)*(1.-smoothstep(.012,.065,pixelM))
      +(-.54*seat+.44*head)*(1.-smoothstep(.025,.12,pixelM));
  }
  return finish;
}
float floorGrate(vec2 uv,vec2 pixel){
  vec2 pitch=vec2(.0625,.25),width=vec2(.012,.022);
  vec2 bars=floorCuts(uv,pixel,pitch,width);
  vec2 edges=floorCuts(uv-.005,pixel,pitch,vec2(.003,.004));
  float frame=eitherStrip(floorCuts(uv,pixel,vec2(1.,2.),vec2(.028)));
  return mix(.72+.32*eitherStrip(bars)+.14*eitherStrip(edges),1.05,frame);
}
`;
