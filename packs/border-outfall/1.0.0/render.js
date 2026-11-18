import {makeGallery} from './geometry.js';
import {valve} from './model.js';
const skyVertex=`#version 300 es
out vec2 uv;void main(){uv=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;gl_Position=vec4(uv,0.,1.);}`;
const noise=`
float hash(vec2 p){return fract(sin(dot(mod(p,1231.),vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float clouds(vec2 p){return .55*noise2(p)+.29*noise2(p*2.13+19.)+.16*noise2(p*4.4-5.);}
`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform vec3 forwardDir,rightDir,upDir;uniform float aspect;${noise}
void main(){vec3 v=normalize(forwardDir+rightDir*uv.x*aspect*.64+upDir*uv.y*.64);
float h=max(v.y,0.);vec2 p=v.xz/(h+.09)*1.1;float n=clouds(p),sun=pow(max(dot(v,normalize(vec3(-.72,.22,-.53))),0.),9.);
vec3 c=mix(vec3(.57,.63,.60),vec3(.22,.34,.39),smoothstep(0.,.7,h))+(n-.5)*.22+sun*vec3(.36,.23,.105);frag=vec4(c,1.);}`;
const vertex=`#version 300 es
precision highp float;layout(location=0) in vec3 point;layout(location=1) in vec3 normal;layout(location=2) in vec3 tint;layout(location=3) in float kind;
uniform vec3 cameraPos,rightDir,upDir,forwardDir,level;uniform vec3 wheelCenter;uniform float aspect,clock,turn;
out vec3 pos,norm,color;flat out int mat;out float depth;
void main(){pos=point;norm=normal;mat=int(kind+.5);color=tint;
 if(mat>=10&&mat<=12){pos.y+=level[mat-10]*.48-.50;}
 if(mat==13){pos.y=.86+(pos.y-.86)*(.10+.9*level.x);}
 if(mat==14){float a=turn*2.1;mat2 r=mat2(cos(a),sin(a),-sin(a),cos(a));pos.xy=wheelCenter.xy+r*(pos.xy-wheelCenter.xy);norm.xy=r*norm.xy;}
 if(mat==7){pos.x+=max(pos.y,0.)*.12*sin(clock*.8+pos.z*.25+pos.x*.1);}
 vec3 d=pos-cameraPos;depth=dot(d,forwardDir);
 gl_Position=vec4(dot(d,rightDir)/(.64*aspect),dot(d,upDir)/.64,depth*1.00000004-.12,depth);}`;
const fragment=`#version 300 es
precision highp float;in vec3 pos,norm,color;flat in int mat;in float depth;
uniform vec3 cameraPos,level;uniform float clock;out vec4 frag;${noise}
void main(){vec3 n=normalize(norm),v=normalize(cameraPos-pos);
 float indoors=smoothstep(-.4,3.,pos.z)*float(pos.y<9. && (abs(pos.x)<6.2 || abs(pos.z-39.)<5.1));
 float direct=max(dot(n,normalize(vec3(-.58,.75,-.31))),0.);
 vec3 c=color;float dist=distance(pos,cameraPos);vec2 uv=abs(n.y)>.65?pos.xz:(abs(n.x)>.7?pos.zy:pos.xy);
 if(mat==0){float grain=clouds(uv*.48),drip=noise2(vec2(uv.x*1.3,uv.y*.012));
 vec2 joints=abs(fract((uv+vec2(0.,floor(uv.y/3.8)*2.4))/vec2(8.,3.8))-.5);
 float cut=1.-smoothstep(.005,.019,min(.5-joints.x,.5-joints.y));
 c*=.82+.32*grain+.20*drip-.22*cut;}
 if(mat==1){float turf=clouds(pos.xz*.5);float dry=1.-smoothstep(.9,1.75,abs(pos.x+1.15+.024*pos.z));
 c=mix(c*(.7+.6*turf),vec3(.32,.34,.245)*(.76+.37*turf),dry);
 c+=vec3(.08,.11,.105)*(1.-dry)*smoothstep(.55,.70,turf);}
 if(mat==2||mat==14){c*=.86+.26*clouds(uv*1.5);c+=pow(max(dot(reflect(-normalize(vec3(-.4,.6,-.2)),n),v),0.),16.)*.19;}
 if(mat==5){float a=max(.06,fwidth(uv.x)*2.);float grid=smoothstep(.24-a,.38+a,abs(fract(uv.x*4.8)-.5))*smoothstep(.18,.36,abs(fract(uv.y*1.65)-.5));c*=.80+.2*grid;}
 vec3 outside=c*(.58+.57*direct)*vec3(.96,1.01,.98);
 float ceiling=max(0.,n.y)*.13,period=abs(mod(pos.z-1.+1.9,3.8)-1.9);
 float nearLamp=exp(-.35*abs(abs(pos.x)-5.1)-.21*abs(5.-pos.y)-.23*period);
 float portal=exp(-max(pos.z,0.)*.085);
 vec3 inside=c*(vec3(.22,.36,.37)+ceiling+portal*.78+vec3(1.55,.83,.31)*nearLamp);
 vec3 lit=mix(outside,inside,indoors);
 if(mat==3)lit=vec3(1.28,.84,.43);
 if(mat==13)lit=vec3(.35,.87,.81);
 if(mat>=10&&mat<=12){float wave=sin(pos.z*7.+clock*2.+sin(pos.x*3.))*.5+.5;lit=mix(vec3(.052,.18,.19),vec3(.29,.59,.51),pow(wave,6.)*.55+.20+.25*max(n.y,0.));}
 float fog=1.-exp(-dist*mix(.0036,.010,indoors));lit=mix(lit,mix(vec3(.60,.66,.63),vec3(.145,.215,.21),indoors),min(.94,fog));
 frag=vec4(pow(max(lit,0.),vec3(.87)),1.);gl_FragDepth=log2(1.+max(0.,depth))/21.;}`;
function program(gl,vs,fs){
 const shaders=[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]].map(([type,source])=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;});
 const p=gl.createProgram();for(const sh of shaders)gl.attachShader(p,sh);gl.linkProgram(p);for(const sh of shaders)gl.deleteShader(sh);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 const u={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);}
 return {p,u};
}
export function createRenderer(canvas){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error('The Outfall requires WebGL 2.');
 const mesh=makeGallery(),surface=program(gl,vertex,fragment),sky=program(gl,skyVertex,skyFragment);
 const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
 for(const [index,size,offset] of [[0,3,0],[1,3,12],[2,3,24],[3,1,36]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,40,offset);}
 const count=mesh.vertices.length/10;gl.bindVertexArray(null);
 function draw(state,time,turn){
  const p=state.pose,scale=Math.min(devicePixelRatio,1.5),w=Math.max(1,Math.round(canvas.clientWidth*scale)),h=Math.max(1,Math.round(canvas.clientHeight*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
  const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch);
  function view(pr){gl.useProgram(pr.p);gl.uniform3f(pr.u.rightDir,cy,0,-sy);gl.uniform3f(pr.u.upDir,-sy*sp,cp,-cy*sp);gl.uniform3f(pr.u.forwardDir,sy*cp,sp,cy*cp);gl.uniform1f(pr.u.aspect,w/h);}
  gl.disable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);view(sky);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.enable(gl.DEPTH_TEST);view(surface);const u=surface.u;gl.uniform3f(u.cameraPos,p.eastM,p.altitudeM,p.northM);gl.uniform3fv(u.level,state.levels);
  gl.uniform3f(u.wheelCenter,valve.eastM,valve.heightM,valve.northM);gl.uniform1f(u.turn,turn);gl.uniform1f(u.clock,time);
  gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,count);gl.bindVertexArray(null);
 }
 return {draw,colliders:mesh.colliders,dispose(){gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(surface.p);gl.deleteProgram(sky.p);}};
}
