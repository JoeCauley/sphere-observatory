import {buildBlock,buildChair} from './block.mjs';
import {makeTexture} from './materials.mjs';

const transform=`
vec3 worldPoint(vec3 v){return vec3(uTurn.x*v.x-uTurn.y*v.z,v.y,uTurn.y*v.x+uTurn.x*v.z);}
vec3 shadowClip(vec3 p){
  vec3 r=normalize(cross(vec3(0,1,0),uSun)), u=cross(uSun,r);
  vec3 d=p-vec3(0,4,1);
  return vec3(dot(d,r)/32.,dot(d,u)/26.,-dot(d,uSun)/65.);
}`;
const vertex=`#version 300 es
precision highp float;
layout(location=0)in vec3 pos;layout(location=1)in vec3 normal;layout(location=2)in vec2 uv;
layout(location=3)in float layer;layout(location=4)in vec3 tint;
uniform vec3 uOffset,uEye,uRight,uUp,uLook,uSun;uniform vec2 uTurn,uLens,uDepth;
out vec3 vColor,vNormal,vWorld,vShadow;out vec2 vUV;flat out float vLayer;
${transform}
void main(){
 vec3 world=worldPoint(pos)+uOffset,d=world-uEye; float z=dot(d,uLook);
 gl_Position=vec4(dot(d,uRight)*uLens.x,dot(d,uUp)*uLens.y,z*uDepth.x+uDepth.y,z);
 vWorld=world;vShadow=shadowClip(world)*.5+.5;vNormal=worldPoint(normal);vUV=uv;vLayer=layer;vColor=tint;
}`;
const fragment=`#version 300 es
precision highp float;precision highp sampler2DArray;precision highp sampler2DShadow;
in vec3 vColor,vNormal,vWorld,vShadow;in vec2 vUV;flat in float vLayer;
uniform sampler2DArray uAtlas;uniform sampler2DShadow uShadow;uniform vec3 uSun,uEye;uniform float uDay,uGhost;
out vec4 frag;
void main(){
 vec3 n=normalize(vNormal);float nd=max(0.,dot(n,uSun)),lit=1.;
 if(all(greaterThan(vShadow,vec3(.003)))&&all(lessThan(vShadow,vec3(.997)))){
   float depth=vShadow.z-max(.00025,.0012*(1.-nd));vec2 texel=vec2(1./1536.);
   lit=.25*(texture(uShadow,vec3(vShadow.xy+texel*vec2(-.60,-.60),depth))+texture(uShadow,vec3(vShadow.xy+texel*vec2(.60,-.60),depth))+
      texture(uShadow,vec3(vShadow.xy+texel*vec2(-.60,.60),depth))+texture(uShadow,vec3(vShadow.xy+texel*.60,depth)));
 }
 vec3 albedo=texture(uAtlas,vec3(vUV,vLayer)).rgb*vColor;
 float inside=step(-4.02,vWorld.x)*step(vWorld.x,4.02)*step(-7.02,vWorld.z)*step(vWorld.z,-.26)*step(.64,vWorld.y)*step(vWorld.y,3.92);
 float corner=min(4.-abs(vWorld.x),min(vWorld.z+7.,-vWorld.z));
 float bounce=mix(.93, .82+.18*clamp(corner+.20,0.,1.),inside);
 vec3 ambient=mix(vec3(.35,.40,.46),vec3(.75,.78,.79),uDay)*(.91+.09*n.y);
 ambient+=inside*vec3(.08,.035,.005);
 vec3 color=albedo*(ambient*bounce+nd*lit*vec3(.44,.34,.22)*uDay);
 float distanceM=length(vWorld-uEye),fog=1.-exp(-distanceM*.0044);
 color=mix(color,mix(vec3(.42,.48,.53),vec3(.83,.80,.73),uDay),fog*.76);
 if(uGhost>.5)color=mix(color,vec3(.48,.8,.71),.54);
 frag=vec4(color,1.);
}`;
const shadowV=`#version 300 es
precision highp float;layout(location=0)in vec3 pos;uniform vec2 uTurn;uniform vec3 uOffset,uSun;
${transform}
void main(){gl_Position=vec4(shadowClip(worldPoint(pos)+uOffset),1.);}`;
const shadowF='#version 300 es\nprecision highp float;void main(){}';
const skyV=`#version 300 es
out vec2 ray;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2)*2.-1.;ray=p;gl_Position=vec4(p,.99999,1.);}`;
const skyF=`#version 300 es
precision highp float;in vec2 ray;uniform vec3 uUp,uLook,uRight,uSun;uniform vec2 uLens;uniform float uDay;out vec4 frag;
void main(){vec3 r=normalize(uLook+uRight*ray.x/uLens.x+uUp*ray.y/uLens.y);
 float h=smoothstep(-.13,.77,r.y);
 vec3 c=mix(vec3(.89,.84,.74),vec3(.46,.64,.74),h);
 c+=pow(max(0.,dot(r,uSun)),22.)*vec3(.16,.115,.06);
 frag=vec4(c*mix(.50,1.,uDay),1.);}`;

export function createRenderer(canvas) {
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:true});
  if(!gl)throw Error('A WebGL 2 context is required to draw Orchard Street.');
  const buffers=[],arrays=[],programs=[],textures=[],framebuffers=[];
  let bytes=0,frames=0,disposed=false;const errors=[],remainingObjects=[];
  function program(v,f){
    const p=gl.createProgram();programs.push(p);
    for(const [type,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
      const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p,sh);gl.deleteShader(sh);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    const u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){
      const name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name);}
    return {p,u};
  }
  function upload(data){
    const vao=gl.createVertexArray(),buffer=gl.createBuffer();arrays.push(vao);buffers.push(buffer);
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    const sizes=[3,3,2,1,3];let offset=0;
    for(let i=0;i<sizes.length;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sizes[i],gl.FLOAT,false,48,offset);offset+=4*sizes[i];}
    bytes+=data.byteLength;return {vao,count:data.length/12};
  }
  const scene=buildBlock(),city=upload(scene.vertices),chair=upload(buildChair());delete scene.vertices;
  const main=program(vertex,fragment),shadow=program(shadowV,shadowF),sky=program(skyV,skyF);
  const atlas=makeTexture(gl);textures.push(atlas.texture);bytes+=atlas.bytes;
  const size=1536,depth=gl.createTexture(),fb=gl.createFramebuffer();textures.push(depth);framebuffers.push(fb);
  gl.bindTexture(gl.TEXTURE_2D,depth);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT16,size,size);bytes+=size*size*2;
  for(const [key,val] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL]])
    gl.texParameteri(gl.TEXTURE_2D,key,val);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
  gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Orchard shadow buffer could not be allocated.');
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const peak=bytes,debug=gl.getExtension('WEBGL_debug_renderer_info'),device=gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
  let shadowKey='',fov=0;
  function drawGeometry(pass,piece,where){
    gl.uniform3f(pass.u.uOffset,where?.x??0,where?.y??0,where?.z??0);
    gl.uniform2f(pass.u.uTurn,Math.cos(where?.yaw??0),Math.sin(where?.yaw??0));
    gl.bindVertexArray(piece.vao);gl.drawArrays(gl.TRIANGLES,0,piece.count);
  }
  function check(){if(disposed)return;let err;while((err=gl.getError())!==gl.NO_ERROR){errors.push(err);if(err===gl.CONTEXT_LOST_WEBGL)break;}}
  function draw(p,chairPose,light,ghost=false){
    if(disposed)return;
    const w=Math.max(1,Math.round(canvas.clientWidth*devicePixelRatio)),h=Math.max(1,Math.round(canvas.clientHeight*devicePixelRatio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    // The host supplies seconds. Minute buckets keep a running clock from rebuilding static shadows every frame.
    const angle=Math.floor((light.time||0)/60)*Math.PI/720;
    const sx=-.58+.18*Math.sin(angle),sy=.84,sz=.80,sl=Math.hypot(sx,sy,sz),sun=[sx/sl,sy/sl,sz/sl];
    const key=[angle,chairPose.x,chairPose.z,chairPose.yaw].join('/');
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
    if(key!==shadowKey){
      shadowKey=key;gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,size,size);gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(shadow.p);gl.uniform3fv(shadow.u.uSun,sun);drawGeometry(shadow,city);drawGeometry(shadow,chair,chairPose);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    gl.viewport(0,0,w,h);gl.clear(gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);
    const cy=Math.cos(p.yaw),syaw=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch);
    const right=[cy,0,syaw],up=[-syaw*sp,cp,cy*sp],look=[syaw*cp,sp,-cy*cp];
    fov=frameElement?.surfaceEntry?.horizontalFov??(2*Math.atan(w/h*Math.tan(63*Math.PI/360))*180/Math.PI);
    const fx=1/Math.tan(fov*Math.PI/360),fy=fx*w/h,day=Math.min(1,.38+.62*(light.direct??1));
    function camera(pass){const u=pass.u;gl.useProgram(pass.p);
      gl.uniform3fv(u.uLook,look);gl.uniform3fv(u.uUp,up);gl.uniform3fv(u.uRight,right);gl.uniform2f(u.uLens,fx,fy);
      gl.uniform3fv(u.uSun,sun);gl.uniform1f(u.uDay,day);}
    camera(sky);gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);camera(main);
    gl.uniform3f(main.u.uEye,p.eastM,p.altitudeM,p.northM);
    const far=Math.max(520,p.altitudeM+800),near=Math.max(.055,p.altitudeM*.00004);
    gl.uniform2f(main.u.uDepth,(far+near)/(far-near),-2*far*near/(far-near));
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,atlas.texture);gl.uniform1i(main.u.uAtlas,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,depth);gl.uniform1i(main.u.uShadow,1);
    gl.uniform1f(main.u.uGhost,0);drawGeometry(main,city);
    gl.uniform1f(main.u.uGhost,ghost?1:0);drawGeometry(main,chair,chairPose);
    if(++frames===1||frames%90===0)check();
  }
  function counts(){return {buffers:buffers.length,arrays:arrays.length,programs:programs.length,textures:textures.length,framebuffers:framebuffers.length};}
  function inspect(){check();return {frames,ownedBytes:bytes,peakOwnedBytes:peak,resources:counts(),glErrors:errors.slice(),device,
    viewport:[canvas.clientWidth,canvas.clientHeight],drawingBuffer:[canvas.width,canvas.height],horizontalFov:fov,disposed,remainingObjects:remainingObjects.slice()};}
  function dispose(){
    if(disposed)return;check();gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);gl.useProgram(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    for(const [items,release] of [[arrays,'deleteVertexArray'],[buffers,'deleteBuffer'],[programs,'deleteProgram'],[textures,'deleteTexture'],[framebuffers,'deleteFramebuffer']]){
      for(const item of items){gl[release](item);if(gl[release.replace('delete','is')](item))remainingObjects.push(release.slice(6));}items.length=0;}
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,null);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);
    check();disposed=true;bytes=0;gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return {draw,inspect,dispose,floors:scene.floors,colliders:scene.colliders};
}
