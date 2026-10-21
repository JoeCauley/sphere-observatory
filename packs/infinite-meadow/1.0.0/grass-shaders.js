import {WIND_GLSL,HASH_GLSL,TRANSITION_GLSL} from './grass-stage.js';
import {TERRAIN_GLSL} from './landscape.js';
import {TERRAIN_GRID_GLSL} from './terrain-grid.js';
import {SCATTER_GLSL} from './grass-scatter.js';
import {LINEAGE_GLSL} from './grass-handoff.js';
import {ALLOCATION_GLSL} from './grass-allocation.js';
export {TERRAIN_GLSL} from './landscape.js';
const CAMERA_GLSL=`
uniform vec3 uRight,uUp,uForward;uniform float uAspect,uEyeAltitude;
// All local geometry must share the terrain's depth mapping: even a small
// near-plane mismatch buries upright grass when viewed from flight.
vec4 coverProject(vec3 p){float z=dot(p,uForward);return vec4(dot(p,uRight)*1.428148/uAspect,dot(p,uUp)*1.428148,z*1.00000002-.10,z);}
`;
export const NEAR_GRASS_VS=`#version 300 es
precision highp float;precision highp int;
layout(location=0)in vec3 aBlade;
uniform vec2 uTiles[81];uniform uint uSeeds[81];uniform int uTufts,uRootTufts;uniform vec4 uProportions;
uniform float uWide,uExtension;
uniform float uClearance;uniform vec3 uDisturbance;
out vec3 color,normal,view;out float alpha,leafHeight;out vec2 root;
${CAMERA_GLSL}${TERRAIN_GLSL}${WIND_GLSL}${HASH_GLSL}${TRANSITION_GLSL}${ALLOCATION_GLSL}
void main(){
 int tile=gl_InstanceID/uTufts,index=gl_InstanceID-tile*uTufts;
 int j=heroRootIndex(index,uSeeds[tile],uRootTufts,uWide>.5,uExtension>.5);
 uint seed=coverHash(uSeeds[tile]^uint(j)*0x9e3779b9u);
 float columns=ceil(sqrt(float(uRootTufts))),rows=ceil(float(uRootTufts)/columns);
 vec2 at=uTiles[tile]+(vec2(mod(float(j),columns),floor(float(j)/columns))+.15+.7*vec2(coverRandom(seed+1u),coverRandom(seed+2u)))*vec2(16./columns,16./rows);
 float distanceM=length(at);
 float original=1.-(uWide>.5?coverBlend(at,22.,32.):smoothstep(22.,32.,distanceM));
 alpha=(uExtension>.5?(1.-original)*(1.-coverBlend(at,24.,64.)):original)*(1.-smoothstep(85.,140.,uClearance));
 if(alpha<.001){gl_Position=vec4(2.,2.,2.,1.);color=vec3(0);normal=view=vec3(0,1,0);root=at;leafHeight=0.;return;}
 float b=aBlade.z,angle=coverRandom(seed+5u)*6.2831853+b*2.399963;
 float flatten=uDisturbance.z>0.?mix(1.,.14,1.-smoothstep(2.3,3.,length(at-uDisturbance.xy))):1.;
 float height=mix(uProportions.x,uProportions.y,coverRandom(seed+3u))*flatten*(.66+.34*pow(sin(b*3.7+1.),2.));
 float width=mix(uProportions.z,uProportions.w,coverRandom(seed+4u))*mix(1.,1.8,uExtension);
 vec2 side=vec2(cos(angle),sin(angle)),bend=vec2(cos(angle+.9),sin(angle+.9));float y=aBlade.y;
 vec3 p=vec3(at.x,coverGround(at)-uEyeAltitude,at.y)+vec3(side.x*aBlade.x*width+bend.x*y*y*height*.22,y*height,side.y*aBlade.x*width+bend.y*y*y*height*.22);
 p.xz+=side*.07*sin(b*1.9)+coverWind(at,y,height)+side*(.028*sin(uWindTime.z+angle+y*3.))*y*y;
 normal=normalize(vec3(-side.y,-y*.30,side.x));view=normalize(-p);leafHeight=mix(y,.20+.80*y,uExtension);root=at;
 color=mix(vec3(.055,.12,.014),vec3(.25,.33,.080),y*.66+coverRandom(seed+6u)*.30+.10*uExtension);
 gl_Position=coverProject(p);
}`;
export const NEAR_GRASS_FS=`#version 300 es
precision highp float;
in vec3 color,normal,view;in float alpha,leafHeight;in vec2 root;out vec4 frag;
uniform float uDaylight;uniform vec2 uArc;
float contact(vec2 p,vec2 center,float radius){return 1.-smoothstep(radius,radius+1.4,length(p-center));}
float screenNoise(){return fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));}
void main(){if(alpha<screenNoise())discard;
 vec3 n=normalize(normal);if(!gl_FrontFacing)n=-n;vec3 light=normalize(vec3(.48,.82,-.32)),v=normalize(view);
 float diffuse=max(0.,dot(n,light)),transmission=pow(max(0.,dot(-light,v)),3.)*.65;
 float gloss=pow(max(0.,dot(n,normalize(light+v))),20.)*.09;
 float ambient=.025+(.245+.12*leafHeight)*uDaylight,occlusion=mix(.42,1.,smoothstep(0.,.45,leafHeight));
 vec2 p=root+uArc;float shade=max(contact(p,vec2(6,-5),1.2),max(contact(p,vec2(-8,-27),1.5),contact(p,vec2(12,-42),.65)));
 vec3 lit=color*(ambient+(diffuse*.82+transmission)*uDaylight)*occlusion*(1.-shade*.32)+vec3(.44,.41,.22)*gloss*uDaylight;
 frag=vec4(pow(max(lit,vec3(0.)),vec3(1./2.2)),1.);
}`;
export const GRASSBOX_VS=`#version 300 es
precision highp float;precision highp int;
uniform vec2 uOrigin;uniform uvec2 uCellLow,uCellHigh;uniform float uPitch,uHeight,uClearance;
uniform vec4 uFade;uniform vec3 uDisturbance;
out vec2 uv,root;out vec3 normal,view;out float alpha,leafHeight;
${CAMERA_GLSL}${TERRAIN_GLSL}${WIND_GLSL}${HASH_GLSL}
const vec2 QUAD[6]=vec2[6](vec2(-.5,0),vec2(.5,0),vec2(.5,1),vec2(-.5,0),vec2(.5,1),vec2(-.5,1));
void main(){
 uvec2 local=uvec2(uint(gl_InstanceID)%128u,uint(gl_InstanceID)/128u),cell=uCellLow+local;
 uvec2 high=uCellHigh+uvec2(cell.x<uCellLow.x?1u:0u,cell.y<uCellLow.y?1u:0u);
 uint seed=coverHash(cell.x^coverHash(cell.y)^coverHash(high.x+713u)^coverHash(high.y));
 vec2 at=uOrigin+(vec2(local)+vec2(coverRandom(seed+1u),coverRandom(seed+2u))*.7+.15)*uPitch;
 float dist=length(at);alpha=smoothstep(uFade.x,uFade.y,dist)*(1.-smoothstep(uFade.z,uFade.w,dist))*(1.-smoothstep(8.,36.,uClearance));
 if(alpha<.001){gl_Position=vec4(2.,2.,2.,1.);uv=root=vec2(0);normal=view=vec3(0,1,0);leafHeight=0.;return;}
 // Crossed, world-oriented cards avoid camera-facing rows across the hills.
 vec2 q=QUAD[gl_VertexID%6];float angle=coverRandom(seed+8u)*6.2831853+float(gl_VertexID/6)*1.5707963;
 vec2 side=vec2(cos(angle),sin(angle)),toward=vec2(-side.y,side.x);
 float height=uHeight*(.82+.28*coverRandom(seed+3u));
 if(uDisturbance.z>0.)height*=mix(1.,.14,1.-smoothstep(2.3,3.,length(at-uDisturbance.xy)));
 float viewTilt=abs(coverGround(at)+height*.5-uEyeAltitude)/max(1.,length(vec3(at.x,coverGround(at)+height*.5-uEyeAltitude,at.y)));
 // From above, the terrain canopy supplies cover instead of revealing strips.
 alpha*=1.-smoothstep(.12,.34,viewTilt);
 vec2 plane=at+side*q.x*uPitch*1.50;
 vec3 p=vec3(plane.x,coverGround(plane)-uEyeAltitude+q.y*height,plane.y);
 p.xz+=coverWind(at,q.y,height);normal=normalize(vec3(toward.x,-q.y*.30,toward.y));view=normalize(-p);root=at;leafHeight=q.y;
 float variant=floor(coverRandom(seed+7u)*4.);uv=vec2((q.x+.5+variant)/4.,1.-q.y);gl_Position=coverProject(p);
}`;
export const GRASSBOX_FS=`#version 300 es
precision highp float;
in vec2 uv,root;in vec3 normal,view;in float alpha,leafHeight;out vec4 frag;
uniform sampler2D uAtlas;uniform float uDaylight;
${WIND_GLSL}
float screenNoise(){return fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));}
void main(){
 vec2 coord=uv;coord.x+=sin(uWindMicroPhase+uWindTime.z+root.x*.22+root.y*.15+leafHeight*3.)*.0012*leafHeight*leafHeight;
 vec4 tex=texture(uAtlas,coord);float across=fract(uv.x*4.);
 float coverage=smoothstep(.12,.65,tex.a)*smoothstep(0.,.15,across)*(1.-smoothstep(.85,1.,across));
 if(coverage*alpha<screenNoise())discard;
 vec3 n=normalize(normal),light=normalize(vec3(.48,.82,-.32)),v=normalize(view);
 float diffuse=abs(dot(n,light)),transmission=pow(max(0.,dot(-light,v)),3.)*.35;
 float lit=.025+(.30+diffuse*.62+transmission)*uDaylight;
 vec3 col=tex.rgb*lit*(.96+.065*coverWave(root));
 frag=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);
}`;
// Upright clumps share the near-blade palette, shading and wind. No broad cards
// turn into rectangles from low flight. Each blade is one tapered triangle.
export const CLUMP_VS=`#version 300 es
precision highp float;precision highp int;
uniform vec2 uOrigin;uniform uvec2 uCellLow,uCellHigh;uniform float uPitch,uHeight,uClearance;
uniform float uFullness;
uniform vec4 uFade;uniform vec3 uDisturbance;
out vec3 color,normal,view;out float alpha,leafHeight;out vec2 root;flat out uint coverSeed;out vec2 fadeWindow;
${CAMERA_GLSL}${TERRAIN_GLSL}${TERRAIN_GRID_GLSL}${WIND_GLSL}${HASH_GLSL}${TRANSITION_GLSL}
${SCATTER_GLSL}
const vec2 TRI[3]=vec2[3](vec2(-.45,0),vec2(.45,0),vec2(0,1));
// Each root takes a slightly different, static path through a broad overlap.
// Endpoint and monotonicity bounds remain intact, so no unsupported border is exposed.
float canopyBlend(vec2 at,float start,float end,uint seed){
 float t=clamp((length(at)-start)/(end-start),0.,1.);
 float variation=.70*coverTransitionField(at)+.30*(2.*coverRandom(seed+29u)-1.);
 t+=.90*variation*t*(1.-t);return t*t*(3.-2.*t);}
${LINEAGE_GLSL}
void main(){
 uvec2 local=uvec2(uint(gl_InstanceID)%128u,uint(gl_InstanceID)/128u),cell=uCellLow+local;
 uvec2 high=uCellHigh+uvec2(cell.x<uCellLow.x?1u:0u,cell.y<uCellLow.y?1u:0u);
 uvec2 fineHigh;uint bladeIndex;
 uvec2 fine=lineageCell(cell,high,uint(gl_VertexID/3),fineHigh,bladeIndex);
 uint clusterSeed=coverHash(fine.x^coverHash(fine.y)^coverHash(fineHigh.x+713u)^coverHash(fineHigh.y));
 uint seed=coverHash(clusterSeed+bladeIndex*0x9e3779b9u);
 coverSeed=seed;
 // Neighbouring cells overlap. Leaving a strip along every cell border makes
 // a square lattice visible from flight, even when each blade is jittered.
 vec2 at=uOrigin+(vec2(ivec2(fine-uAnchorLow))+scatterMin+scatterSpan*vec2(coverRandom(seed+1u),coverRandom(seed+2u)))*1.4;
 float widthScale;vec3 weights=handoffWeights(at,seed,widthScale);
 float start=uLevel==0?0.:(uLevel==1?weights.x:weights.x+weights.y);
 float altitude=1.-smoothstep(55.,120.,uClearance);
 alpha=weights[uLevel]*altitude;fadeWindow=vec2(start,start+weights[uLevel])*altitude;
 if(alpha<.001){gl_Position=vec4(2.,2.,2.,1.);color=vec3(0);normal=view=vec3(0,1,0);root=at;leafHeight=0.;return;}
 vec2 q=TRI[gl_VertexID%3];float y=q.y,angle=coverRandom(seed+5u)*6.2831853;
 vec2 side=vec2(cos(angle),sin(angle)),bend=vec2(cos(angle+.9),sin(angle+.9));
 float height=uHeight*(.54+.46*coverRandom(seed+3u)),width=(.095+.09*coverRandom(seed+4u))*widthScale*uFullness;
 if(uDisturbance.z>0.)height*=mix(1.,.14,1.-smoothstep(2.3,3.,length(at-uDisturbance.xy)));
 vec3 p=vec3(at.x,renderedGrassGround(at)-uEyeAltitude,at.y)+vec3(side.x*q.x*width+bend.x*y*y*height*.22,y*height,side.y*q.x*width+bend.y*y*y*height*.22);
 p.xz+=coverWind(at,y,height)+side*.028*sin(uWindTime.z+angle+y*3.)*y*y;
 normal=normalize(vec3(-side.y,-y*.30,side.x));view=normalize(-p);leafHeight=.30+.70*y;root=at;
 color=mix(vec3(.055,.12,.014),vec3(.25,.33,.080), .15+y*.62+coverRandom(seed+6u)*.25);
 gl_Position=coverProject(p);
}`;
// The old screen-space fade has directional correlations that become stripes
// when distant triangles shrink to pixels. Independent hashed thresholds avoid
// that interference; they are static, so a paused view does not shimmer.
export const CLUMP_FS=NEAR_GRASS_FS.replace('precision highp float;', 'precision highp float;precision highp int;').replace('in vec2 root;','in vec2 root;flat in uint coverSeed;in vec2 fadeWindow;').replace('if(alpha<screenNoise())discard;','float noise=screenNoise();if(noise<fadeWindow.x||noise>=fadeWindow.y)discard;').replace(
 'float screenNoise(){return fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));}',
 `${HASH_GLSL}\nfloat screenNoise(){uvec2 p=uvec2(gl_FragCoord.xy);return float(coverHash((p.x+p.y*0x9e3779b9u)^coverSeed))/4294967296.;}`);
export function canopyShaders(groundGLSL=TERRAIN_GLSL){return {nearVS:NEAR_GRASS_VS.replace(TERRAIN_GLSL,groundGLSL),nearFS:NEAR_GRASS_FS,boxVS:CLUMP_VS.replace(TERRAIN_GLSL,groundGLSL),boxFS:CLUMP_FS};}
