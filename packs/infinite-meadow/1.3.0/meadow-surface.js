import {integerHash,splitCell} from './grass-stage.js';
export function surfaceAnchor(east,north){const e=Math.floor(east/256),n=Math.floor(north/256);return {origin:[east-e*256,north-n*256],low:[splitCell(e).low,splitCell(n).low],high:[splitCell(e).high,splitCell(n).high]};}
export function surfaceHash(eastCell,northCell){const e=splitCell(eastCell),n=splitCell(northCell);return integerHash(e.low^integerHash(n.low)^integerHash((e.high+713)>>>0)^integerHash(n.high))/4294967296;}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function surfaceNoise(east,north,cellM,footprint=0){const weight=1-smooth(.35,1.15,footprint/cellM);if(weight===0)return .5;const e=east/cellM,n=north/cellM,x=Math.floor(e),z=Math.floor(n),u=smooth(0,1,e-x),v=smooth(0,1,n-z),mix=(a,b,t)=>a+(b-a)*t;return mix(.5,mix(mix(surfaceHash(x,z),surfaceHash(x+1,z),u),mix(surfaceHash(x,z+1),surfaceHash(x+1,z+1),u),v),weight);}
export const SURFACE_GLSL=`
uniform vec2 uSurfaceOrigin;uniform uvec2 uSurfaceBlockLow,uSurfaceBlockHigh;
uint surfaceIntegerHash(uint x){x^=x>>16u;x*=0x7feb352du;x^=x>>15u;x*=0x846ca68bu;return x^(x>>16u);}
float surfaceCellHash(ivec2 local,uint shift){
 uvec2 base=uSurfaceBlockLow<<shift,high=uSurfaceBlockHigh<<shift;
 if(shift>0u)high+=uSurfaceBlockLow>>(32u-shift);
 uvec2 cell=base+uvec2(local);
 high+=uvec2(local.x<0?0xffffffffu:0u,local.y<0?0xffffffffu:0u)+uvec2(cell.x<base.x?1u:0u,cell.y<base.y?1u:0u);
 uint seed=surfaceIntegerHash(cell.x^surfaceIntegerHash(cell.y)^surfaceIntegerHash(high.x+713u)^surfaceIntegerHash(high.y));
 return float(seed)/4294967296.;}
float surfaceValueNoise(vec2 p,float cellM,uint shift,float footprint){
 float weight=1.-smoothstep(.35,1.15,footprint/cellM);if(weight<.001)return .5;
 vec2 at=p/cellM,f=fract(at);ivec2 i=ivec2(floor(at));f=f*f*(3.-2.*f);
 float n=mix(mix(surfaceCellHash(i,shift),surfaceCellHash(i+ivec2(1,0),shift),f.x),mix(surfaceCellHash(i+ivec2(0,1),shift),surfaceCellHash(i+ivec2(1,1),shift),f.x),f.y);
 return mix(.5,n,weight);}
// Average the same two-sided leaf lighting used by real blades. A terrain
// Lambert colour has a different response in shade and exposes the handoff.
float canopyLeafDiffuse(vec3 light,vec3 view){
 const vec2 directions[8]=vec2[8](vec2(1,0),vec2(.7071068,.7071068),vec2(0,1),vec2(-.7071068,.7071068),vec2(-1,0),vec2(-.7071068,-.7071068),vec2(0,-1),vec2(.7071068,-.7071068));
 float sum=0.,weight=0.;for(int i=0;i<8;i++){vec3 n=normalize(vec3(directions[i].x,-.10,directions[i].y));float facing=dot(n,view),irradiance=dot(n,light);sum+=max(0.,facing)*max(0.,irradiance)+max(0.,-facing)*max(0.,-irradiance);weight+=abs(facing);}return sum/max(.001,weight);}
vec3 meadowCanopy(vec2 at,vec3 normal,vec3 light,float height,vec3 view,float daylight){
 vec2 p=at+uSurfaceOrigin;float footprint=max(length(dFdx(p)),length(dFdy(p)));
 // Resolve fine marks only while a leaf occupies several pixels. At altitude
 // their area average supplies cover without repeating subpixel leaf rows.
 float windWeight=1.-smoothstep(.045,.14,footprint);
 vec2 bent=p-coverWind(at,1.,height)*windWeight;
 // Broad colour is static. Only resolved blade marks share the grass wind.
 float tone=.12*(surfaceValueNoise(p,256.,0u,footprint)-.5)
   +.16*(surfaceValueNoise(p,16.,4u,footprint)-.5)
   +.10*(surfaceValueNoise(p,4.,6u,footprint)-.5);
 float ridges=0.;
 if(windWeight>.001){
   // Static geographic warp and independent leaf centres prevent a stamped
   // half-metre grid. Neither the warp nor the broad colour follows the eye.
   vec2 warp=vec2(surfaceValueNoise(p,4.,6u,footprint),surfaceValueNoise(p+vec2(17.,-23.),4.,6u,footprint))-.5;
   vec2 cellAt=(bent+warp*1.2)*2.;ivec2 cell=ivec2(floor(cellAt));
   float a=surfaceCellHash(cell,9u),b=surfaceCellHash(cell+ivec2(137,-83),9u);
   vec2 within=fract(cellAt)-(.34+.32*vec2(a,b));
   float angle=surfaceCellHash(cell+ivec2(-71,211),9u)*6.2831853;vec2 side=vec2(cos(angle),sin(angle)),along=vec2(-side.y,side.x);
   float lengthwise=dot(within,along),across=dot(within,side);
   float leaf=(1.-smoothstep(.015,.07,abs(across+.10*lengthwise*lengthwise)))*(1.-smoothstep(.22,.34,abs(lengthwise)));
   ridges=(leaf-.10)*windWeight;}
 float diffuse=canopyLeafDiffuse(light,view),transmission=pow(max(0.,dot(-light,view)),3.)*.65;
 // A tapered triangle has area-weighted mean height 1/3, not 1/2 or its tip.
 float ambient=.025+(.245+.12*(.30+.70/3.))*daylight;
 vec3 meanLeaf=mix(vec3(.055,.12,.014),vec3(.25,.33,.080),.15+.62/3.+.25*.5);
 vec3 canopy=meanLeaf*(ambient+(diffuse*.82+transmission)*daylight)*(.94+tone)*(.90+.122*max(0.,dot(normal,light)));
 return canopy+vec3(.022,.030,.008)*ridges*daylight;}
`;
