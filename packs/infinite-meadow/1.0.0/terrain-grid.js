export const TERRAIN_GRID=Object.freeze({cells:48,half:24,inner:12,levels:12,basePitch:2,maxRadiusM:98304});
export function terrainGridOffsets(east,north,out=new Float32Array(24)){for(let i=0;i<12;i++){const p=2*2**i;out[i*2]=Math.floor(east/p)*p-east;out[i*2+1]=Math.floor(north/p)*p-north;}return out;}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function gridPoint(point,level,eye){const offsets=terrainGridOffsets(...eye),pitch=2*2**level,w=level?1-smooth(12*pitch,13*pitch,Math.max(...point.map(Math.abs))):0;return point.map((v,j)=>v+offsets[level*2+j]+(level?(offsets[(level-1)*2+j]-offsets[level*2+j])*w:0));}
function triHeight(at,a,b,c,h){const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]),d=at.map((v,j)=>v-a[j]),det=ab[0]*ac[1]-ab[1]*ac[0],u=(d[0]*ac[1]-d[1]*ac[0])/det,v=(ab[0]*d[1]-ab[1]*d[0])/det;return {height:(1-u-v)*h[0]+u*h[1]+v*h[2],weights:[1-u-v,u,v]};}
export function gridVertexHeight(point,level,eye,ground){const at=gridPoint(point,level,eye),offsets=terrainGridOffsets(...eye),p=2*2**level,world=at.map((v,j)=>v+eye[j]);let h=ground(...world),w=level<11?smooth(23*p,24*p,Math.max(...point.map(Math.abs))):0;if(w){const origin=world.map((v,j)=>Math.floor((at[j]-offsets[level*2+j])/(2*p))*2*p+offsets[level*2+j]+eye[j]),f=world.map((v,j)=>(v-origin[j])/(2*p)),g=(x,z)=>ground(origin[0]+x*2*p,origin[1]+z*2*p),coarse=f[0]<=f[1]?(1-f[1])*g(0,0)+(f[1]-f[0])*g(0,1)+f[0]*g(1,1):(1-f[0])*g(0,0)+(f[0]-f[1])*g(1,0)+f[1]*g(1,1);h+=(coarse-h)*w;}return h;}
export function renderedSupport(at,eye,ground){const offsets=terrainGridOffsets(...eye);let level=11;for(let i=0;i<11;i++){const p=2*2**i,d=at.map((v,j)=>v-offsets[i*2+j]);if(Math.max(...d.map(Math.abs))<=24*p){level=i;break;}}
 const p=2*2**level,initial=at.map((v,j)=>Math.floor((v-offsets[level*2+j])/p)*p);
 // The stitched edge shifts vertices by at most half a cell in each axis.
 // Locate the actual drawn triangle, rather than invert its smooth warp.
 for(const delta of [[0,0],[-p,0],[0,-p],[-p,-p]]){const base=initial.map((v,j)=>v+delta[j]),points=[[0,0],[0,p],[p,p],[p,0]].map(d=>base.map((v,j)=>v+d[j])),[a,b,c,d]=points.map(q=>gridPoint(q,level,eye)),cross=(c[0]-a[0])*(at[1]-a[1])-(c[1]-a[1])*(at[0]-a[0]),indices=cross>=0?[0,1,2]:[0,2,3],verts=[a,b,c,d],t=triHeight(at,...indices.map(j=>verts[j]),[0,0,0]);if(Math.min(...t.weights)>=-1e-7){const heights=indices.map(j=>gridVertexHeight(points[j],level,eye,ground));return {level,base,height:t.weights.reduce((s,w,j)=>s+w*heights[j],0),weights:t.weights};}}
 throw Error('No rendered terrain triangle contains the grass root');}
export const TERRAIN_GRID_GLSL=`
uniform vec2 uTerrainGridOffsets[12];
float gridPitch(int level){return 2.*exp2(float(level));}
vec2 renderedGridPoint(vec2 point,int level){float pitch=gridPitch(level);vec2 at=point+uTerrainGridOffsets[level];
 if(level>0){float edge=max(abs(point.x),abs(point.y));float weight=1.-smoothstep(12.*pitch,13.*pitch,edge);at+=(uTerrainGridOffsets[level-1]-uTerrainGridOffsets[level])*weight;}return at;}
vec3 triangleWeights(vec2 at,vec2 a,vec2 b,vec2 c){vec2 ab=b-a,ac=c-a,d=at-a;float det=ab.x*ac.y-ab.y*ac.x;float u=(d.x*ac.y-d.y*ac.x)/det,v=(ab.x*d.y-ab.y*d.x)/det;return vec3(1.-u-v,u,v);}
float triangleHeight(vec2 at,vec2 a,vec2 b,vec2 c,vec3 heights){return dot(triangleWeights(at,a,b,c),heights);}
bool gridCellContains(vec2 at,vec2 base,int level){float pitch=gridPitch(level);vec2 a=renderedGridPoint(base,level),b=renderedGridPoint(base+vec2(0,pitch),level),c=renderedGridPoint(base+vec2(pitch),level),d=renderedGridPoint(base+vec2(pitch,0),level);float side=(c.x-a.x)*(at.y-a.y)-(c.y-a.y)*(at.x-a.x);vec3 weights=side>=0.?triangleWeights(at,a,b,c):triangleWeights(at,a,c,d);return min(weights.x,min(weights.y,weights.z))>=-.00001;}
float plainGridHeight(vec2 at,vec2 origin,float pitch){vec2 base=floor((at-origin)/pitch)*pitch+origin,f=(at-base)/pitch;
 float h00=coverGround(base),h11=coverGround(base+vec2(pitch));
 return f.x<=f.y?dot(vec3(1.-f.y,f.y-f.x,f.x),vec3(h00,coverGround(base+vec2(0,pitch)),h11)):dot(vec3(1.-f.x,f.x-f.y,f.y),vec3(h00,coverGround(base+vec2(pitch,0)),h11));}
float renderedGridVertexHeight(vec2 point,int level){vec2 at=renderedGridPoint(point,level);float pitch=gridPitch(level),h=coverGround(at);
 if(level<11){float edge=max(abs(point.x),abs(point.y)),weight=smoothstep(23.*pitch,24.*pitch,edge);if(weight>0.)h=mix(h,plainGridHeight(at,uTerrainGridOffsets[level],pitch*2.),weight);}
 return h;}
float renderedGrassGround(vec2 at){int level=0;for(int i=0;i<11;i++){float p=gridPitch(i);vec2 d=at-uTerrainGridOffsets[i];if(max(abs(d.x),abs(d.y))<=24.*p){level=i;break;}level=i+1;}
 float pitch=gridPitch(level);vec2 base=floor((at-uTerrainGridOffsets[level])/pitch)*pitch;
 if(level>0&&!gridCellContains(at,base,level)){vec2 left=base-vec2(pitch,0),down=base-vec2(0,pitch);if(gridCellContains(at,left,level))base=left;else if(gridCellContains(at,down,level))base=down;else base-=vec2(pitch);}
 vec2 a=renderedGridPoint(base,level),b=renderedGridPoint(base+vec2(0,pitch),level),c=renderedGridPoint(base+vec2(pitch),level),d=renderedGridPoint(base+vec2(pitch,0),level);
 float ha=renderedGridVertexHeight(base,level),hc=renderedGridVertexHeight(base+vec2(pitch),level);
 float crossSide=(c.x-a.x)*(at.y-a.y)-(c.y-a.y)*(at.x-a.x);
 return crossSide>=0.?triangleHeight(at,a,b,c,vec3(ha,renderedGridVertexHeight(base+vec2(0,pitch),level),hc)):triangleHeight(at,a,c,d,vec3(ha,hc,renderedGridVertexHeight(base+vec2(pitch,0),level)));}
`;
