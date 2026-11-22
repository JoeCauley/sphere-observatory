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
float outfallConcrete(vec2 uv){
  float grain=clouds(uv*.48),drip=noise2(vec2(uv.x*1.3,uv.y*.012));
  vec2 joints=abs(fract((uv+vec2(0.,floor(uv.y/3.8)*2.4))/vec2(8.,3.8))-.5);
  float cut=1.-smoothstep(.005,.019,min(.5-joints.x,.5-joints.y));
  return .82+.32*grain+.20*drip-.22*cut;
}
float outfallGrate(vec2 uv,float pixelWidth){
  float a=max(.06,pixelWidth*2.);
  float grid=smoothstep(.24-a,.38+a,abs(fract(uv.x*4.8)-.5))*smoothstep(.18,.36,abs(fract(uv.y*1.65)-.5));
  return .80+.2*grid;
}
`;
