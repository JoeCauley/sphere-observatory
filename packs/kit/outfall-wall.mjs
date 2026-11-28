// Metres from the outside face. Both renderers and their walking solvers use this section.
export const ribSpacing = 18;
export const ribs = [[.725, 106, -1.05, 1.05], [.225, 34, -1.825, -.475]];

export const surfaceNoise = `
float hash(vec2 p){return fract(sin(dot(mod(p,1231.),vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float clouds(vec2 p){return .55*noise2(p)+.29*noise2(p*2.13+19.)+.16*noise2(p*4.4-5.);}
`;

// The Outfall's poured concrete and steel walking grate. The caller supplies
// wall-local or floor-local metres, tint, illumination and atmospheric scattering.
export const outfallMaterials = `
float concreteNoise(vec2 p,vec2 span){
  return mix(noise2(p),.5,smoothstep(.25,1.,max(span.x,span.y)));
}
// Integral of a repeating joint over the projected width of one pixel.
vec2 concreteJoints(vec2 grid,vec2 span){
  const float duty=.024;
  vec2 a=grid+.5*duty-.5*span,b=a+span;
  return clamp(((floor(b)-floor(a))*duty+min(fract(b),duty)-min(fract(a),duty))/span,0.,1.);
}
float outfallConcrete(vec2 uv){
  vec2 pixel=max(fwidth(uv),vec2(.001)),p=uv*.48,span=pixel*.48;
  float grain=.55*concreteNoise(p,span)+.29*concreteNoise(p*2.13+19.,span*2.13)+.16*concreteNoise(p*4.4-5.,span*4.4);
  vec2 streak=vec2(1.3,.012);
  float drip=concreteNoise(uv*streak,pixel*streak);
  vec2 period=vec2(8.,3.8),grid=uv/period;
  grid.x+=floor(grid.y)*.3;
  vec2 joint=concreteJoints(grid,max(pixel/period,vec2(.005)));
  joint.x=mix(joint.x,.024,smoothstep(.5,1.,pixel.y/period.y));
  float cut=joint.x+joint.y-joint.x*joint.y;
  return .82+.32*grain+.20*drip-.22*cut;
}
float outfallGrate(vec2 uv,float pixelWidth){
  float a=max(.06,pixelWidth*2.);
  float grid=smoothstep(.24-a,.38+a,abs(fract(uv.x*4.8)-.5))*smoothstep(.18,.36,abs(fract(uv.y*1.65)-.5));
  return .80+.2*grid;
}
`;
