import {shellMesh} from './shell-mesh.js';
import {makeGallery} from './geometry.js';
import {valve} from './model.js';
import {tunnelStart,tunnelEnd,tunnelHalfWidth,tunnelHeight} from './border.js';
import {surfaceNoise as noise,outfallMaterials} from '../../kit/outfall-wall.mjs';
const skyVertex=`#version 300 es
out vec2 uv;void main(){uv=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;gl_Position=vec4(uv,0.,1.);}`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform vec3 forwardDir,rightDir,upDir;uniform float aspect,daylight;${noise}
void main(){vec3 v=normalize(forwardDir+rightDir*uv.x*aspect*.64+upDir*uv.y*.64);
float h=max(v.y,0.);vec2 p=v.xz/(h+.09)*1.1;float n=clouds(p),sun=pow(max(dot(v,normalize(vec3(-.72,.22,-.53))),0.),9.);
vec3 c=mix(vec3(.57,.63,.60),vec3(.22,.34,.39),smoothstep(0.,.7,h))+(n-.5)*.22+sun*vec3(.36,.23,.105);frag=vec4(mix(vec3(.006,.010,.017),c,daylight),1.);}`;
const vertex=`#version 300 es
precision highp float;layout(location=0) in vec3 point;layout(location=1) in vec3 normal;layout(location=2) in vec3 tint;layout(location=3) in float kind;
layout(location=4) in float pointW;out float positionW;
uniform float meadowPass,shellRadiusM;uniform vec3 cameraPos,rightDir,upDir,forwardDir,level;uniform vec3 wheelCenter;uniform float aspect,clock,turn;
out vec3 positionH,norm,color;vec3 pos;flat out int mat;out float depth;
void main(){pos=point;norm=normal;mat=int(kind+.5);color=tint;
 if(mat>=10&&mat<=12){pos.y+=level[mat-10]*.48-.50;}
 if(mat==13){pos.y=.86+(pos.y-.86)*(.10+.9*level.x);}
 if(mat==14){float a=turn*2.1;mat2 r=mat2(cos(a),sin(a),-sin(a),cos(a));pos.xy=wheelCenter.xy+r*(pos.xy-wheelCenter.xy);norm.xy=r*norm.xy;}
 if(mat==7){pos.x+=max(pos.y,0.)*.12*sin(clock*.8+pos.z*.25+pos.x*.1);}
 positionH=pos;positionW=pointW;vec3 d=pos-cameraPos*pointW;
 if(pointW>.5){
   // The roof and foot follow the same curved foundation. Haze alone hides distant geometry.
   d.y+=dot(d.xz,d.xz)/(2.*shellRadiusM);
 }
 depth=dot(d,forwardDir);
 float focal=mix(1./.64,1.428148,meadowPass);
 gl_Position=vec4(dot(d,rightDir)*focal/aspect,dot(d,upDir)*focal,mix(depth-.12*pointW,depth*1.00000002-.10*pointW,meadowPass),depth);}`;
const fragment=`#version 300 es
precision highp float;in vec3 positionH,norm,color;in float positionW;flat in int mat;in float depth;
uniform vec3 cameraPos,level,nearTint,farTint;uniform float clock,originX,meadowPass,daylight;out vec4 frag;${noise}${outfallMaterials}
void main(){float w=max(positionW,1.e-8);vec3 pos=positionH/w;vec3 n=normalize(norm),v=normalize(cameraPos-pos);
 if(meadowPass>.5 && mat==1 && pos.z<0.)discard;
 float east=pos.x+originX;
 bool inTunnel=pos.z>=${tunnelStart.toFixed(1)} && pos.z<=${tunnelEnd.toFixed(1)} && abs(east)<=${(tunnelHalfWidth+.1).toFixed(1)} && pos.y<${(tunnelHeight+.1).toFixed(1)};
 float indoors=smoothstep(-.4,3.,pos.z)*float(pos.y<9. && (abs(east)<6.2 || abs(pos.z-39.)<5.1));
 if(inTunnel)indoors=1.;
 float direct=max(dot(n,normalize(vec3(-.58,.75,-.31))),0.);
 int material=mat;vec3 c=color;if(material==1 && pos.z>${tunnelEnd.toFixed(1)})c=farTint;
 if(material==1&&pos.z>=0.&&pos.z<=73.){material=5;c=vec3(.29,.33,.29);}
 if(material==15){material=2;c=mix(c,vec3(.57,.35,.17),1.-smoothstep(.12,.19,abs(mod(pos.x+3.5,7.)-3.5)));}
 if(inTunnel && mat==1){material=5;c=vec3(.31,.33,.30);}
 float dist=distance(pos,cameraPos);vec2 uv=abs(n.y)>.65?pos.xz:(abs(n.x)>.7?pos.zy:pos.xy);
 if(material==0)c*=outfallConcrete(uv);
 if(material==1){float turf=clouds(pos.xz*.5);float dry=1.-smoothstep(.9,1.75,abs(east+1.15+.024*pos.z));
 c=mix(c*(.7+.6*turf),vec3(.32,.34,.245)*(.76+.37*turf),dry);
 c+=vec3(.08,.11,.105)*(1.-dry)*smoothstep(.55,.70,turf);}
 if(material==2||material==14){c*=.86+.26*clouds(uv*1.5);c+=pow(max(dot(reflect(-normalize(vec3(-.4,.6,-.2)),n),v),0.),16.)*.19;}
 if(material==5)c*=outfallGrate(uv,fwidth(uv.x));
 vec3 outside=c*(.09+daylight*(.49+.57*direct))*vec3(.96,1.01,.98);
 float ceiling=max(0.,n.y)*.13,period=abs(mod(pos.z-1.+1.9,3.8)-1.9);
 float nearLamp=exp(-.35*abs(abs(east)-5.1)-.21*abs(5.-pos.y)-.23*period);
 float portal=exp(-max(pos.z,0.)*.085);
 vec3 inside=c*(vec3(.22,.36,.37)+ceiling+portal*.78+vec3(1.55,.83,.31)*nearLamp);
 if(inTunnel){
  float stripe=abs(mod(pos.z-${tunnelStart.toFixed(1)}+4.,8.)-4.);
  float lamp=(1.-smoothstep(.03,.16,stripe))*smoothstep(4.2,4.4,pos.y)*(1.-smoothstep(4.65,4.85,pos.y));
  vec3 landmark=mix(nearTint,farTint,smoothstep(0.,${tunnelEnd.toFixed(1)},pos.z));
  inside=c*(vec3(.39,.46,.43)+landmark*.4)+lamp*vec3(1.4,.88,.47);
 }
 vec3 lit=mix(outside,inside,indoors);
 if(material==3)lit=vec3(1.28,.84,.43);
 if(material==13)lit=vec3(.35,.87,.81);
 if(material>=10&&material<=12){float wave=sin(pos.z*7.+clock*2.+sin(pos.x*3.))*.5+.5;lit=mix(vec3(.052,.18,.19),vec3(.29,.59,.51),pow(wave,6.)*.55+.20+.25*max(n.y,0.));}
 float fog=1.-exp(-dist*mix(.0036,.010,indoors));lit=mix(lit,mix(vec3(.60,.66,.63)*(.12+.88*daylight),vec3(.145,.215,.21),indoors),min(.94,fog));
 if(meadowPass>.5 && positionW>.0 && dist>9500.){
  float haze=smoothstep(9500.,38000.,dist);
  if(fract(dot(floor(gl_FragCoord.xy),vec2(.75487767,.5698403)))<haze)discard;
 }
 frag=vec4(pow(max(lit,0.),vec3(.87)),1.);gl_FragDepth=meadowPass>.5?gl_FragCoord.z:min(.9999999,log2(1.+max(0.,depth/w))/21.);}`;
function program(gl,vs,fs){
 const shaders=[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]].map(([type,source])=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;});
 const p=gl.createProgram();for(const sh of shaders)gl.attachShader(p,sh);gl.linkProgram(p);for(const sh of shaders)gl.deleteShader(sh);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 const u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);}
 return {p,u};
}
export function createRenderer(canvas){
 // Centroid depth for a multisampled edge can admit the face behind a projective
 // strip. Give each depth sample its own pixel, then downsample the finished view.
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});if(!gl)throw Error('The Outfall requires WebGL 2.');
 const mesh=makeGallery(),surface=program(gl,vertex,fragment),sky=program(gl,skyVertex,skyFragment);
 const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
 for(const [index,size,offset] of [[0,3,0],[1,3,12],[2,3,24],[3,1,36]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,40,offset);}
 const count=mesh.vertices.length/10;
 const borderVAO=gl.createVertexArray(),borderBuffer=gl.createBuffer();gl.bindVertexArray(borderVAO);gl.bindBuffer(gl.ARRAY_BUFFER,borderBuffer);
 for(const [index,size,offset] of [[0,3,0],[1,3,12],[2,3,24],[3,1,36],[4,1,40]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,44,offset);}
 gl.bindVertexArray(null);gl.vertexAttrib1f(4,1);let originX=null,originZ=null,borderCount=0;
 function resizeCanvas(){
  const area=Math.max(1,canvas.clientWidth*canvas.clientHeight),sampleScale=Math.max(1,Math.min(1.25,Math.sqrt(2560*1440/area)));
  const scale=Math.min(1.5,Math.max(devicePixelRatio,sampleScale)),w=Math.max(1,Math.round(canvas.clientWidth*scale)),h=Math.max(1,Math.round(canvas.clientHeight*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 }
 function draw(state,time,turn,{overMeadow=false,resize=true,daylight=1,radiusM=149597870700,nearTint=[.16,.42,.15],farTint=[.38,.42,.38]}={}){
  const p=state.pose;if(resize)resizeCanvas();gl.viewport(0,0,canvas.width,canvas.height);
  const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch);
  function view(pr){gl.useProgram(pr.p);gl.uniform3f(pr.u.rightDir,cy,0,-sy);gl.uniform3f(pr.u.upDir,-sy*sp,cp,-cy*sp);gl.uniform3f(pr.u.forwardDir,sy*cp,sp,cy*cp);gl.uniform1f(pr.u.aspect,canvas.width/canvas.height);}
  gl.disable(gl.BLEND);gl.depthMask(true);gl.depthFunc(gl.LESS);
  if(!overMeadow){gl.disable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);view(sky);gl.uniform1f(sky.u.daylight,daylight);gl.drawArrays(gl.TRIANGLES,0,3);}
  gl.enable(gl.DEPTH_TEST);view(surface);const u=surface.u;gl.uniform1f(u.shellRadiusM,radiusM);gl.uniform1f(u.daylight,daylight);gl.uniform1f(u.meadowPass,Number(overMeadow));gl.uniform3f(u.cameraPos,p.eastM,p.altitudeM,p.northM);gl.uniform3fv(u.level,state.levels);gl.uniform3fv(u.nearTint,nearTint);gl.uniform3fv(u.farTint,farTint);
  gl.uniform3f(u.wheelCenter,valve.eastM,valve.heightM,valve.northM);gl.uniform1f(u.turn,turn);gl.uniform1f(u.clock,time);
  const origin=Math.round(p.eastM/504)*504, northOrigin=Math.round(p.northM/2000)*2000;
  gl.bindVertexArray(borderVAO);
  if(origin!==originX || northOrigin!==originZ){originZ=northOrigin;const data=shellMesh(origin,northOrigin);gl.bindBuffer(gl.ARRAY_BUFFER,borderBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);borderCount=data.length/11;originX=origin;}
  gl.uniform1f(u.originX,origin);gl.uniform3f(u.cameraPos,p.eastM-origin,p.altitudeM,p.northM);gl.drawArrays(gl.TRIANGLES,0,borderCount);
  gl.uniform1f(u.originX,0);gl.uniform3f(u.cameraPos,p.eastM,p.altitudeM,p.northM);
  gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,count);gl.bindVertexArray(null);
 }
 return {draw,resize:resizeCanvas,colliders:mesh.colliders,dispose(){gl.deleteBuffer(borderBuffer);gl.deleteVertexArray(borderVAO);gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(surface.p);gl.deleteProgram(sky.p);}};
}
