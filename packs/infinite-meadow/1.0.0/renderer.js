import {R,cameraBasis,poseFrame,toGlobal,renderOrigin,smooth} from './coordinates.js';
import {terrain,terrainPhases,landmarks,sceneLight,clearance,TUFTS_PER_TILE,GROUND_DATUM} from './model.js';
import {profileFor,STAGE,windUniforms,WIND_GLSL,TRANSITION_GLSL,transitionPhases,createGrassAtlas,canopyAtlasFootprint} from './grass-stage.js';
import {canopyShaders} from './grass-shaders.js';
import {landscapePhases,TERRAIN_GLSL} from './landscape.js';
import {surfaceAnchor,SURFACE_GLSL} from './meadow-surface.js';
import {TERRAIN_GRID,terrainGridOffsets,TERRAIN_GRID_GLSL} from './terrain-grid.js';
import {lineageAnchor} from './grass-handoff.js';
import {heroAllocation} from './grass-allocation.js';

const VS_SCREEN=`#version 300 es
precision highp float;
const vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
out vec2 screen;
void main(){screen=P[gl_VertexID];gl_Position=vec4(screen,1.,1.);}`;
const FS_SCREEN=`#version 300 es
precision highp float;
in vec2 screen;out vec4 frag;
uniform vec3 uRight,uUp,uForward,uEast,uNorth,uRadial;
uniform vec2 uResolution,uArc;
uniform float uAltitude,uReveal,uDaylight,uInteriorLight;
const float R=149597870700.,S=695700000.;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float field(vec3 p){float sum=0.,amp=.5;for(int i=0;i<6;i++){
 float footprint=max(length(dFdx(p)),length(dFdy(p)));
 sum+=amp*mix(noise(p),.5,smoothstep(.35,1.3,footprint));p=p*2.07+vec3(17.1,3.8,8.4);amp*=.5;}return sum;}
vec3 world(vec3 q){
 float n=field(q*5.7+vec3(2.8,1.7,3.5));
 // Pin this experimental meadow to a land region, at all viewing scales.
 n+=.30*exp(-max(0.,1.-q.x)*160.);
 float land=smoothstep(.46,.51,n),upland=smoothstep(.56,.73,n);
 float detail=field(q*117.+vec3(9,2,8)),region=field(q*38.);
 vec3 ocean=mix(vec3(.013,.054,.078),vec3(.035,.16,.19),smoothstep(.35,.46,n));
 vec3 soil=mix(vec3(.085,.18,.045),vec3(.26,.24,.11),region);
 soil=mix(soil,vec3(.10,.13,.09),upland*.6);soil*=.70+.55*detail;
 float snow=smoothstep(.68,.79,n)*smoothstep(.45,.65,detail);
 soil=mix(soil,vec3(.55,.60,.55),snow);
 vec3 col=mix(ocean,soil,land);
 // Thin service meridians on the shell: coherent, filtered, geographic anchors.
 vec2 angle=vec2(atan(q.y,q.x),asin(clamp(q.z,-1.,1.)));
 vec2 seam=abs(sin(angle*vec2(36.,24.)));
 vec2 width=max(fwidth(angle*vec2(36.,24.)),vec2(.001));
 float lines=max(1.-smoothstep(.002,.002+width.x,seam.x),1.-smoothstep(.002,.002+width.y,seam.y));
 col=mix(col,vec3(.34,.29,.14),lines*.22);
 return col;
}
void main(){
 vec3 ray=normalize(uForward+uRight*screen.x*(uResolution.x/uResolution.y)*.70020754+uUp*screen.y*.70020754);
 float h=max(.001,uAltitude),a=h/R,m=(1.-a)*ray.y,d=sqrt(m*m+a*(2.-a));
 float t=m<0.?h*(2.-a)/(d-m):R*(d+m);
 vec3 q=normalize(uRadial*(1.-a)+(uEast*ray.x-uRadial*ray.y+uNorth*ray.z)*(t/R));
 vec3 actual=world(q)*(.025+.975*uInteriorLight);
 vec2 ground=uArc+ray.xz*min(t,100000.);
 float footprint=max(length(dFdx(ground)),length(dFdy(ground)));
 float tex=mix(.5+.18*sin(ground.x*.18)*sin(ground.y*.21),.5,smoothstep(4.,15.,footprint));
 vec3 meadow=mix(vec3(.075,.13,.018),vec3(.15,.22,.046),tex)*(.03+.97*uInteriorLight);
 actual=mix(actual,meadow,1.-smoothstep(2200.,17000.,t));
 float skyV=clamp(ray.y*.6+.45,0.,1.);
 vec3 sky=mix(vec3(.64,.75,.72),vec3(.18,.40,.65),skyV);
 float cloud=field(ray*7.+vec3(7,1,3));
 sky=mix(sky,vec3(.81,.84,.75),smoothstep(.53,.68,cloud)*smoothstep(-.05,.2,ray.y)*.74);
 vec3 light=normalize(vec3(.48,.82,-.32));
 sky+=vec3(.24,.20,.12)*pow(max(0.,dot(ray,light)),32.);
 float daylight=smoothstep(.015,.8,uDaylight);
 vec3 night=mix(vec3(.010,.014,.025),vec3(.0015,.003,.008),skyV);
 float dusk=sin(clamp(uDaylight/.8,0.,1.)*3.14159);
 night+=vec3(.055,.025,.032)*dusk*pow(1.-skyV,3.);
 sky=mix(night,sky,daylight);
 // Synthetic optical-canopy stars: fixed directions, no setting-sun motion.
 if(uDaylight<.8&&uReveal<1.){
 vec3 worldRay=normalize(uEast*ray.x-uRadial*ray.y+uNorth*ray.z);
 // Cube charts avoid polar streaks; size each point in angular screen space.
 float pixelSize=max(length(dFdx(worldRay)),length(dFdy(worldRay)));
 vec3 ar=abs(worldRay);vec2 uv;float face;
 if(ar.x>=ar.y&&ar.x>=ar.z){face=worldRay.x>0.?0.:1.;uv=worldRay.yz/ar.x;}
 else if(ar.y>=ar.z){face=worldRay.y>0.?2.:3.;uv=worldRay.xz/ar.y;}
 else{face=worldRay.z>0.?4.:5.;uv=worldRay.xy/ar.z;}
 vec2 cell=floor((uv*.5+.5)*640.);
 vec2 center=vec2(hash(vec3(cell,face*23.+4.)),hash(vec3(cell,face*23.+9.)))*.5+.25;
 vec2 at=(cell+center)/640.*2.-1.;vec3 starDirection;
 if(face<2.)starDirection=vec3(face<1.?1.:-1.,at);
 else if(face<4.)starDirection=vec3(at.x,face<3.?1.:-1.,at.y);
 else starDirection=vec3(at,face<5.?1.:-1.);
 float chance=.0035*pow(1.+dot(at,at),-1.5);
 float stars=(1.-smoothstep(.00006,.00009+pixelSize*.7,length(worldRay-normalize(starDirection))))*step(1.-chance,hash(vec3(cell,face*23.+17.)));
 stars*=pow(1.-daylight,2.)*smoothstep(.01,.16,ray.y)*(1.-smoothstep(.55,.69,cloud)*.9);
 sky+=vec3(.62,.69,.82)*stars;
 }
 float skyMask=smoothstep(6500.,80000.,t);
 vec3 col=mix(actual,sky,skyMask*(1.-uReveal));
 // Actual central-star angle, with a separate restrained glare halo.
 float angle2=1.-ray.y*ray.y,star2=pow(S/(R-h),2.);
 if(ray.y>0.){float edge=max(fwidth(angle2),.0000001);
 float disk=1.-smoothstep(star2-edge,star2+edge,angle2);
 float halo=exp(-angle2/max(star2*9.,.00001))*.10;
 col=mix(col,vec3(1.,.94,.74),disk*uReveal)+vec3(.9,.75,.42)*halo*uReveal;}
 frag=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);
}`;

const VS_MESH=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in vec3 aColor;layout(location=5)in vec3 aNormal;
uniform vec3 uCamera,uRight,uUp,uForward;uniform float uAspect,uScale,uOffsetY,uNormalized;
out vec3 color,normal,position;out float distanceM,edgeAlpha;
void main(){vec3 at=aPos*uScale+vec3(0,uOffsetY,0),p=at-uCamera;float z=dot(p,uForward);
 gl_Position=vec4(dot(p,uRight)*1.428148/uAspect,dot(p,uUp)*1.428148,z*1.00000002-mix(.10,.00002,uNormalized),z);
 color=aColor;normal=aNormal;position=at;distanceM=length(p)*mix(1.,149597870700.,uNormalized);edgeAlpha=1.;}`;
const FS_MESH=`#version 300 es
precision highp float;
precision highp int;
in vec3 color,normal,position;in float distanceM,edgeAlpha;out vec4 frag;
uniform float uDaylight,uAlpha,uGround,uReveal;uniform vec3 uTexturePhase;uniform vec2 uSiteOffset;
uniform vec3 uCamera;
uniform float uCover,uCoverHeight;uniform vec2 uCoverOrigin;
${WIND_GLSL}
${TRANSITION_GLSL}
${SURFACE_GLSL}
float shadow(vec2 p,vec2 root,float height,float radius){
 vec2 d=p-root+vec2(.48,-.32)*height*.48;
 vec2 axis=normalize(vec2(.48,-.32)),side=vec2(-axis.y,axis.x);
 float v=pow(dot(d,axis)/(height*.42+radius),2.)+pow(dot(d,side)/(radius*1.3),2.);
 return .38*(1.-smoothstep(.5,1.7,v));}
void main(){
 vec3 n=normalize(normal),light=normalize(vec3(.48,.82,-.32));
 float lit=.025+(.235+max(0.,dot(n,light))*.90)*uDaylight;
 vec3 col=color*lit;
 if(uGround<.5)col+=vec3(.12,.052,.009)*step(.30,color.r)*step(color.g*1.10,color.r)*(1.-uDaylight);
 if(uGround>.5){
   float texture=.5+.20*sin(position.x*1.7+uTexturePhase.x)*sin(position.z*1.3+uTexturePhase.y)+.10*sin(position.x*7.+position.z*3.+uTexturePhase.z);
   float detailWeight=1.-smoothstep(.8,3.,max(length(dFdx(position.xz)),length(dFdy(position.xz))));
   col*=.91+.18*mix(.5,texture,detailWeight);
   if(uCover>.5){vec3 canopy=meadowCanopy(position.xz,n,light,uCoverHeight,normalize(uCamera-position),uDaylight);
     col=mix(col,canopy,(1.-smoothstep(6000.,22000.,distanceM))*.92);}
   vec2 at=position.xz+uSiteOffset;
   float shade=shadow(at,vec2(6,-5),3.8,1.2)+shadow(at,vec2(-8,-27),2.6,1.5)+shadow(at,vec2(12,-42),8.,.65);
   col*=1.-min(.7,shade)*uDaylight;
 }
 float fog=(1.-exp(-distanceM/14000.))*(1.-uReveal);
 col=mix(col,mix(vec3(.008,.012,.023),vec3(.58,.68,.62),smoothstep(.015,.8,uDaylight)),fog*.82);
 float opacity=uAlpha*edgeAlpha;if(opacity<.003)discard;
 frag=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),opacity);
}`;
const VS_TERRAIN=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;
uniform vec3 uCamera,uRight,uUp,uForward;uniform float uAspect;
out vec3 color,normal,position;out float distanceM,edgeAlpha;
${TERRAIN_GLSL}
${TERRAIN_GRID_GLSL}
void main(){
 int level=int(aPos.y);vec2 at=renderedGridPoint(aPos.xz,level);float x=at.x,z=at.y,r=length(at);
 float h=renderedGridVertexHeight(aPos.xz,level);
 float dx=(coverGround(at+vec2(.25,0))-coverGround(at-vec2(.25,0)))*2.;
 float dz=(coverGround(at+vec2(0,.25))-coverGround(at-vec2(0,.25)))*2.;
 float detail=1.-smoothstep(1024.,8192.,r);
 h=mix(12.,h,detail)+r*r*.00000000000334229;
 vec3 p=vec3(x,h,z)-uCamera;float depth=dot(p,uForward);
 gl_Position=vec4(dot(p,uRight)*1.428148/uAspect,dot(p,uUp)*1.428148,depth*1.00000002-.10,depth);
 color=vec3(.095,.158,.027);normal=normalize(vec3(-dx*detail,1.,-dz*detail));position=vec3(x,h,z);distanceM=length(p);
 edgeAlpha=1.-smoothstep(28000.,65536.,r);
}`;
function compile(gl,vs,fs){
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
}
class Mesh {
  constructor(gl,data){this.gl=gl;this.count=data.length/9;this.bytes=data.byteLength;this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    for(const [attribute,offset] of [[0,0],[1,12],[5,24]]){gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,36,offset);}gl.bindVertexArray(null);}
  draw(){this.gl.bindVertexArray(this.vao);this.gl.drawArrays(this.gl.TRIANGLES,0,this.count);}
}
function geom(){
  const a=[];
  const tri=(p,q,r,c,normals)=>{const u=q.map((v,i)=>v-p[i]),v=r.map((v,i)=>v-p[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;
    [p,q,r].forEach((vertex,i)=>a.push(...vertex,...c,...(normals?.[i]??n.map(x=>x/length))));};
  const quad=(p,q,r,s,c,n)=>{tri(p,q,r,c,n?.slice(0,3));tri(p,r,s,c,n?[n[0],n[2],n[3]]:null);};
  const box=(x,y,z,hx,hy,hz,c)=>{const p=(a,b,d)=>[x+a*hx,y+b*hy,z+d*hz];for(const f of [[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]])quad(...f.map(v=>p(...v)),c);};
  return {tri,quad,box,data:()=>new Float32Array(a)};
}
export class Renderer {
  constructor(canvas){
    this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 unavailable');this.gl=gl;
    const shaders=canopyShaders();
    this.screen=compile(gl,VS_SCREEN,FS_SCREEN);this.mesh=compile(gl,VS_MESH,FS_MESH);this.grass=compile(gl,shaders.nearVS,shaders.nearFS);this.grassbox=compile(gl,shaders.boxVS,shaders.boxFS);this.terrainProgram=compile(gl,VS_TERRAIN,FS_MESH);this.uniforms=new Map;
    const ground=geom();
    for(let level=0;level<TERRAIN_GRID.levels;level++){const pitch=TERRAIN_GRID.basePitch*2**level;
      for(let z=-24;z<24;z++)for(let x=-24;x<24;x++){if(level>0&&x>=-12&&x<12&&z>=-12&&z<12)continue;
        const point=(x,z)=>[x*pitch,level,z*pitch];ground.quad(point(x,z),point(x,z+1),point(x+1,z+1),point(x+1,z),[.095,.158,.027]);}}
    this.terrainMesh=new Mesh(gl,ground.data());this.terrainGridOffsets=new Float32Array(24);
    const structures=geom();
    for(const o of landmarks){const base=terrain(o.eastM,o.northM),r=o.radiusM;
      structures.box(o.eastM,base+.20,o.northM,r*.88,.20,r*.88,[.19,.20,.16]);
      structures.box(o.eastM,base+o.heightM/2,o.northM,r*.60,o.heightM/2,r*.60,o.color);
      structures.box(o.eastM,base+o.heightM,o.northM,r*.76,.16,r*.76,[.52,.40,.16]);
      for(let y=.65;y<o.heightM-.2;y+=.65)structures.box(o.eastM,base+y,o.northM,r*.64,.035,r*.64,[.19,.22,.18]);
    }this.landmarkMesh=new Mesh(gl,structures.data());
    // Finite depth is deliberate: these girders visibly move against the shell.
    // Coordinates scale with the provisional Blind height rather than the AU radius.
    const lattice=geom(),c=[.085,.13,.12],gold=[.30,.24,.12];
    for(const z of [-2.4,-1.2,1.2,2.4]){
      lattice.box(0,1.15,z,2.8,.006,.009,c);lattice.box(0,1.159,z,2.8,.001,.010,gold);
      for(let x=-2.4;x<=2.4;x+=.3)lattice.box(x,1.12,z,.001,.03,.001,c);
    }
    for(const x of [-2.4,-1.2,1.2,2.4]){
      lattice.box(x,1.15,0,.009,.006,2.8,c);lattice.box(x,1.159,0,.010,.001,2.8,gold);
    }
    for(const x of [-2.4,2.4])for(const z of [-2.4,2.4]){
      lattice.box(x,1.29,z,.020,.14,.020,[.18,.21,.17]);lattice.box(x,1.43,z,.042,.007,.042,gold);
    }this.latticeMesh=new Mesh(gl,lattice.data());
    const belt=geom(),radius=.985,width=.00013;
    for(let i=0;i<512;i++){
      const a=i*Math.PI*2/512,b=(i+1)*Math.PI*2/512;
      // A slim service belt on a genuinely finite curved shell, 0.015 R inward.
      for(const plane of [0,1]){
        const point=(angle,r,w)=>plane===0?[r*Math.cos(angle),w,r*Math.sin(angle)]:[r*Math.cos(angle),r*Math.sin(angle),w];
        belt.quad(point(a,radius,-width),point(b,radius,-width),point(b,radius,width),point(a,radius,width),[.24,.19,.085]);
        belt.quad(point(a,radius-.000035,-width),point(b,radius-.000035,-width),point(b,radius-.000035,width),point(a,radius-.000035,width),[.15,.19,.16]);
      }
    }this.beltMesh=new Mesh(gl,belt.data());
    const blades=[];
    for(let b=0;b<5;b++)for(let i=0;i<3;i++){
      const y0=i/3,y1=(i+1)/3,widths=[.45,1,.55,0],w0=widths[i],w1=widths[i+1];
      blades.push(-w0,y0,b,w0,y0,b,w1,y1,b,-w0,y0,b,w1,y1,b,-w1,y1,b);
    }
    this.bladeVertices=blades.length/3;this.grassVAO=gl.createVertexArray();gl.bindVertexArray(this.grassVAO);
    this.bladeBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.bladeBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(blades),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
    const outer=[];for(let b=0;b<5;b++)outer.push(-.45,0,b,.45,0,b,0,1,b);
    this.outerVertices=outer.length/3;this.outerVAO=gl.createVertexArray();gl.bindVertexArray(this.outerVAO);this.outerBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.outerBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(outer),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
    gl.bindVertexArray(null);this.tileOffsets=new Float32Array(162);this.tileSeeds=new Uint32Array(81);this.coreOffsets=new Float32Array(50);this.coreSeeds=new Uint32Array(25);this.sortedTiles=[];this.coreTiles=[];
    this.atlasCanvas=createGrassAtlas();this.textureBytes=0;
    this.gpuBytes=[this.terrainMesh,this.landmarkMesh,this.latticeMesh,this.beltMesh].reduce((n,m)=>n+m.bytes,0)+(blades.length+outer.length)*4;
    this.instanceCount=0;this.version=-1;this.origin=null;this.uploadBytes=0;
    this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.queries=[];this.gpuSamples=[];this.frame=0;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    this.info={webglVersion:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timerQuery:!!this.ext,
      coverage:'Eye-centered 81-cell stage; stable canonical root subsets and wind; 64 m geometry reach; continuous filtered canopy; geographic terrain grids and attached distant clumps',ownedGpuBufferBytes:this.gpuBytes,ownedGpuTextureBytes:this.textureBytes,
      lighting:'Directional shading, transmission, root occlusion; one shared geographic wind field for near grass, grassbox and distant cover'};
  }
  location(program,key){const gl=this.gl,id=program===this.screen?'s':program===this.mesh?'m':program===this.terrainProgram?'t':program===this.grassbox?'b':'g';let location=this.uniforms.get(id+key);if(location===undefined){location=gl.getUniformLocation(program,key);this.uniforms.set(id+key,location);}return location;}
  uniform(program,key,type,value){const gl=this.gl,location=this.location(program,key);if(type==='int')gl.uniform1i(location,value);else if(type==='uint2')gl.uniform2uiv(location,value);else if(type===1)gl.uniform1f(location,value);else if(type===2)gl.uniform2fv(location,value);else if(type===4)gl.uniform4fv(location,value);else gl.uniform3fv(location,value);}
  common(program,p){this.gl.useProgram(program);const b=cameraBasis(p);for(const [key,value] of [['uRight',b.right],['uUp',b.up],['uForward',b.forward]])this.uniform(program,key,3,value);this.uniform(program,'uAspect',1,this.canvas.width/this.canvas.height);}
  upload(residency){
    this.sortedTiles=[...residency.tiles.values()].sort((a,b)=>a.key.localeCompare(b.key));this.tileSeeds.fill(0);
    this.sortedTiles.forEach((tile,i)=>this.tileSeeds[i]=tile.seed);
    this.coreTiles=this.sortedTiles.filter(tile=>Math.abs(tile.tx-residency.center.tx)<=2&&Math.abs(tile.tz-residency.center.tz)<=2);this.coreSeeds.fill(0);this.coreTiles.forEach((tile,i)=>this.coreSeeds[i]=tile.seed);
    this.heroAllocation=heroAllocation(this.sortedTiles[0]?.count??0,residency.reach);
    this.instanceCount=this.coreTiles.length*this.heroAllocation.core+this.sortedTiles.length*this.heroAllocation.extension;this.version=residency.version;
  }
  coverUniforms(program,state){const p=state.pose,profile=profileFor(state.grassDensity,state.grassHeightScale,state.grassWidthScale),wind=windUniforms(state);this.common(program,p);
    this.uniform(program,'uTerrainGridOffsets[0]',2,this.terrainGridOffsets);
    this.uniform(program,'uTransitionPhase',4,transitionPhases(p.eastM,p.northM));
    this.uniform(program,'uTerrainPhase',4,terrainPhases(p.eastM,p.northM));this.uniform(program,'uLandscapePhase',4,landscapePhases(p.eastM,p.northM));this.uniform(program,'uHomeOffset',2,[p.eastM,p.northM]);this.uniform(program,'uWindPhase',2,wind.spatial);this.uniform(program,'uWindTime',3,wind.temporal);this.uniform(program,'uWindMicroPhase',1,wind.micro);this.uniform(program,'uBend',1,profile.bend);this.uniform(program,'uEyeAltitude',1,p.altitudeM);this.uniform(program,'uClearance',1,clearance(p));
    this.uniform(program,'uDisturbance',3,state.disturbance?[state.disturbance.eastM-p.eastM,state.disturbance.northM-p.northM,3]:[0,0,0]);}
  draw(state,residency,{timing=true,inspection='all'}={}){
    const gl=this.gl,p=state.pose,start=performance.now(),origin=renderOrigin(p);this.frame++;this.uploadBytes=0;
    terrainGridOffsets(p.eastM,p.northM,this.terrainGridOffsets);
    if(residency.version!==this.version)this.upload(residency);
    let query=null;if(this.ext&&timing&&this.queries.length<8){query=gl.createQuery();gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);}
    const {reveal,interiorDaylight}=sceneLight(state);
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.depthMask(true);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.common(this.screen,p);
    const f=poseFrame(p);for(const [key,value] of [['uEast',f.east],['uNorth',f.north],['uRadial',f.radial]])this.uniform(this.screen,key,3,value);
    this.uniform(this.screen,'uResolution',2,[this.canvas.width,this.canvas.height]);this.uniform(this.screen,'uArc',2,[p.eastM,p.northM]);
    for(const [key,value] of [['uAltitude',p.altitudeM],['uReveal',reveal],['uDaylight',state.daylight],['uInteriorLight',interiorDaylight]])this.uniform(this.screen,key,1,value);
    gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);
    let calls=1,triangles=1;gl.enable(gl.DEPTH_TEST);this.common(this.mesh,p);
    if(reveal>.001){
      const camera=toGlobal(p).map(x=>x/R),basis=cameraBasis(p),worldVector=v=>f.east.map((_,i)=>f.east[i]*v[0]-f.radial[i]*v[1]+f.north[i]*v[2]);
      for(const [key,value] of [['uRight',basis.right],['uUp',basis.up],['uForward',basis.forward]])this.uniform(this.mesh,key,3,worldVector(value));
      this.uniform(this.mesh,'uCamera',3,camera);this.uniform(this.mesh,'uScale',1,1);this.uniform(this.mesh,'uOffsetY',1,0);this.uniform(this.mesh,'uGround',1,0);this.uniform(this.mesh,'uReveal',1,1);this.uniform(this.mesh,'uDaylight',1,interiorDaylight);
      this.uniform(this.mesh,'uAlpha',1,reveal);this.uniform(this.mesh,'uNormalized',1,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      this.beltMesh.draw();gl.depthMask(true);gl.disable(gl.BLEND);calls++;triangles+=this.beltMesh.count/3;this.common(this.mesh,p);
    }
    this.uniform(this.mesh,'uCamera',3,[p.eastM,p.altitudeM,p.northM]);this.uniform(this.mesh,'uDaylight',1,interiorDaylight);this.uniform(this.mesh,'uAlpha',1,1);this.uniform(this.mesh,'uScale',1,1);this.uniform(this.mesh,'uOffsetY',1,0);this.uniform(this.mesh,'uNormalized',1,0);this.uniform(this.mesh,'uReveal',1,reveal);
    const terrainAlpha=1-smooth((clearance(p)-6000)/16000);
    if(terrainAlpha>.001){
      const program=this.terrainProgram;this.common(program,p);this.uniform(program,'uCamera',3,[0,p.altitudeM,0]);this.uniform(program,'uTerrainPhase',4,terrainPhases(p.eastM,p.northM));this.uniform(program,'uLandscapePhase',4,landscapePhases(p.eastM,p.northM));this.uniform(program,'uHomeOffset',2,[p.eastM,p.northM]);
      this.uniform(program,'uSiteOffset',2,[p.eastM,p.northM]);this.uniform(program,'uTexturePhase',3,[p.eastM*1.7,p.northM*1.3,p.eastM*7+p.northM*3].map(x=>x%(Math.PI*2)));
      this.uniform(program,'uTerrainGridOffsets[0]',2,this.terrainGridOffsets);
      for(const [key,value] of [['uDaylight',interiorDaylight],['uReveal',reveal],['uGround',1],['uAlpha',terrainAlpha]])this.uniform(program,key,1,value);
      const wind=windUniforms(state),cover=profileFor(state.grassDensity,state.grassHeightScale,state.grassWidthScale);this.uniform(program,'uWindPhase',2,wind.spatial);this.uniform(program,'uWindTime',3,wind.temporal);this.uniform(program,'uBend',1,cover.bend);this.uniform(program,'uCoverHeight',1,cover.height[1]);this.uniform(program,'uCover',1,state.grassbox?1:0);
      this.uniform(program,'uTransitionPhase',4,transitionPhases(p.eastM,p.northM));
      const surface=surfaceAnchor(p.eastM,p.northM);this.uniform(program,'uSurfaceOrigin',2,surface.origin);this.uniform(program,'uSurfaceBlockLow','uint2',surface.low);this.uniform(program,'uSurfaceBlockHigh','uint2',surface.high);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.terrainMesh.draw();gl.disable(gl.BLEND);calls++;triangles+=this.terrainMesh.count/3;
    }
    if(p.altitudeM<40000&&Math.hypot(p.eastM,p.northM)<50000){this.common(this.mesh,p);this.uniform(this.mesh,'uGround',1,0);this.landmarkMesh.draw();calls++;triangles+=this.landmarkMesh.count/3;}
    if(reveal>.001&&p.altitudeM<state.blindHeightM*8&&Math.hypot(p.eastM,p.northM)<state.blindHeightM*10){
      this.common(this.mesh,p);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.uniform(this.mesh,'uGround',1,0);this.uniform(this.mesh,'uAlpha',1,reveal);this.uniform(this.mesh,'uScale',1,state.blindHeightM);this.uniform(this.mesh,'uOffsetY',1,GROUND_DATUM);this.latticeMesh.draw();calls++;triangles+=this.latticeMesh.count/3;gl.disable(gl.BLEND);
    }
    let descriptorBytes=0,grassboxInstances=0,grassboxBlades=0;
    if(this.instanceCount&&residency.ready&&inspection!=='distant'&&inspection!=='surface'){const profile=profileFor(state.grassDensity,state.grassHeightScale,state.grassWidthScale);this.coverUniforms(this.grass,state);
      const wide=state.grassReach==='wide';this.uniform(this.grass,'uRootTufts','int',profile.tufts);this.uniform(this.grass,'uWide',1,wide?1:0);
      this.uniform(this.grass,'uProportions',4,[...profile.height,...profile.width]);this.uniform(this.grass,'uArc',2,[p.eastM,p.northM]);this.uniform(this.grass,'uDaylight',1,interiorDaylight);
      gl.disable(gl.BLEND);gl.depthMask(true);gl.bindVertexArray(this.grassVAO);
      const drawLayer=(tiles,offsets,seeds,extension)=>{
        tiles.forEach((tile,i)=>{offsets[i*2]=tile.tx*16-p.eastM;offsets[i*2+1]=tile.tz*16-p.northM;});
        const values=offsets.subarray(0,tiles.length*2),keys=seeds.subarray(0,tiles.length);
        gl.uniform2fv(this.location(this.grass,'uTiles[0]'),values);gl.uniform1uiv(this.location(this.grass,'uSeeds[0]'),keys);descriptorBytes+=values.byteLength+keys.byteLength;
        const count=this.heroAllocation[extension?'extension':'core'];this.uniform(this.grass,'uTufts','int',count);this.uniform(this.grass,'uExtension',1,extension);
        const vertices=extension?this.outerVertices:this.bladeVertices,instances=tiles.length*count;gl.bindVertexArray(extension?this.outerVAO:this.grassVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,vertices,instances);calls++;triangles+=instances*vertices/3;
      };
      drawLayer(this.coreTiles,this.coreOffsets,this.coreSeeds,0);if(wide)drawLayer(this.sortedTiles,this.tileOffsets,this.tileSeeds,1);
    }
    if(state.grassbox&&clearance(p)<120&&inspection!=='near'&&inspection!=='surface'){const profile=profileFor(state.grassDensity,state.grassHeightScale,state.grassWidthScale);this.coverUniforms(this.grassbox,state);this.uniform(this.grassbox,'uDaylight',1,interiorDaylight);this.uniform(this.grassbox,'uHeight',1,profile.height[1]);this.uniform(this.grassbox,'uFullness',1,state.grassWidthScale);this.uniform(this.grassbox,'uArc',2,[p.eastM,p.northM]);
      gl.bindVertexArray(null);gl.disable(gl.BLEND);gl.depthMask(true);
      const anchor=lineageAnchor(p);this.uniform(this.grassbox,'uOrigin',2,anchor.origin);this.uniform(this.grassbox,'uAnchorLow','uint2',[anchor.x.low,anchor.z.low]);
      for(const [level,tier] of STAGE.boxTiers.entries()){const foot=canopyAtlasFootprint(p,tier);this.uniform(this.grassbox,'uLevel','int',level);this.uniform(this.grassbox,'uCellLow','uint2',[foot.x.low,foot.z.low]);this.uniform(this.grassbox,'uCellHigh','uint2',[foot.x.high,foot.z.high]);this.uniform(this.grassbox,'uPitch',1,tier.pitch);this.uniform(this.grassbox,'uFade',4,tier.fade);
        gl.drawArraysInstanced(gl.TRIANGLES,0,tier.blades*3,tier.grid*tier.grid);grassboxInstances+=tier.grid*tier.grid;grassboxBlades+=tier.grid*tier.grid*tier.blades;calls++;triangles+=tier.grid*tier.grid*tier.blades;}
    }
    if(query){gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.queries.push({query,frame:this.frame});}
    let gpuMs=null,gpuSampleFrame=null,gpuDisjoint=null;const gpuResolved=[];
    while(this.ext&&this.queries.length&&gl.getQueryParameter(this.queries[0].query,gl.QUERY_RESULT_AVAILABLE)){
      const q=this.queries.shift(),disjoint=gl.getParameter(this.ext.GPU_DISJOINT_EXT),ms=disjoint?null:gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q.query);
      const resolved={frame:q.frame,ms,disjoint};gpuResolved.push(resolved);this.gpuSamples.push(resolved);if(this.gpuSamples.length>512)this.gpuSamples.shift();gpuMs=ms;gpuSampleFrame=q.frame;gpuDisjoint=disjoint;
    }
    return {rendererFrame:this.frame,renderCpuMs:performance.now()-start,gpuMs,gpuSampleFrame,gpuDisjoint,gpuResolved,drawCalls:calls,triangles,uploadBytes:this.uploadBytes,descriptorBytes,gpuBytes:this.gpuBytes,gpuTextureBytes:this.textureBytes,origin,originId:`${origin.eastM}/${origin.northM}`,reveal,interiorDaylight,instanceCount:this.instanceCount,grassboxInstances,grassboxBlades,ready:residency.ready,gpuQueryPending:this.queries.length,terrainAlpha,heroCenter:{eastM:p.eastM,northM:p.northM},grassCenter:{eastM:p.eastM,northM:p.northM},terrainRadiusM:65536};
  }
}
