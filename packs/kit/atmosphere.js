// Pack recipes are evaluated at runtime. They contain no image URLs or volume textures.
const recipes={
  clear:{nearM:18000,farM:24000,focal:1.19,tint:[.48,.65,.76],stretch:[1,1],drift:.04,density:0},
  'city-thin':{nearM:19000,farM:24000,focal:1.19,tint:[.71,.65,.58],stretch:[2.8,.55],drift:.025,density:.08},
  'outfall-salt':{nearM:18000,farM:24000,focal:1/.64,tint:[.59,.70,.70],stretch:[3.5,.65],drift:.08,density:.12},
  'meadow-mist':{nearM:20000,farM:24000,focal:1/.70020754,tint:[.73,.81,.70],stretch:[1.4,.85],drift:.07,density:.85},
  'works-vapour':{nearM:19000,farM:24000,focal:1.428,tint:[.71,.65,.51],stretch:[.68,2.2],drift:.17,density:1.25},
  'city-smog':{nearM:19000,farM:24000,focal:1.19,tint:[.62,.55,.50],stretch:[2.9,.55],drift:.09,density:.95},
  'violet-dust':{nearM:9000,farM:16000,focal:1.19,tint:[.54,.40,.65],stretch:[2.1,.8],drift:.025,density:.10}
};
export const atmosphere=id=>({id:recipes[id]?id:'clear',...(recipes[id]??recipes.clear)});
export function layerWeight(nearM,farM,heightM){
  const t=Math.max(0,Math.min(1,(farM-heightM)/(farM-nearM)));
  return t*t*(3-2*t);
}
export const veilVertex='#version 300 es\nout vec2 v;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;v=p;gl_Position=vec4(p,0.,1.);}';
export const veilFragment=`#version 300 es
precision highp float;in vec2 v;out vec4 frag;
uniform float uTime,uHeight,uAspect,uOpacity,uSeed,uLight,uDensity;uniform vec2 uStretch;uniform vec3 uTint;
void main(){
 vec2 p=vec2(v.x*uAspect,v.y)*uStretch;
 float t=mod(uTime,2048.),z=mod(uHeight*.00035,64.)+uSeed;
 float billow=.5+.5*sin(p.x*2.6+z+sin(p.y*3.1+t*.8))*sin(p.y*2.2-.67*z+t);
 float grain=.5+.5*sin(p.x*6.7-p.y*5.3+.48*z+2.*billow-t);
 float density=mix(billow,grain,.26);
 float a=smoothstep(0.,1.,uOpacity+(density-.5)*.45*uDensity*sin(3.14159265*uOpacity));
 vec3 c=mix(uTint*.66,mix(uTint,vec3(1.),.55),density)*(.13+.87*uLight);
 frag=vec4(pow(c,vec3(1./2.2))*a,a);
}`;
export function makeCloudPainter(canvas){
 let gl,program,attempted=false,uniforms={};
 function prepare(){
  attempted=true;gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false});
  if(!gl)return;
  const shader=(kind,source)=>{const sh=gl.createShader(kind);gl.shaderSource(sh,source);gl.compileShader(sh);return sh;};
  const v=shader(gl.VERTEX_SHADER,veilVertex),f=shader(gl.FRAGMENT_SHADER,veilFragment),p=gl.createProgram();
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){gl.deleteProgram(p);return;}
  program=p;for(const key of ['uTime','uHeight','uAspect','uOpacity','uSeed','uLight','uDensity','uStretch','uTint'])uniforms[key]=gl.getUniformLocation(p,key);
 }
 return {
  draw(value,time,height,recipe,seed=0,light=1){
   if(!value){canvas.style.display='none';return;}
   canvas.style.display='block';if(!attempted)prepare();
   if(!program){canvas.style.backgroundColor='rgb('+recipe.tint.map(x=>Math.round(255*x*(.22+.78*light))).join(',')+')';canvas.style.opacity=String(value);return;}
   const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
   const scale=Math.min(.5,384/Math.max(1,canvas.clientWidth),216/Math.max(1,canvas.clientHeight));
   const w=Math.max(1,Math.round(canvas.clientWidth*scale)),h=Math.max(1,Math.round(canvas.clientHeight*scale));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.useProgram(program);
   for(const [k,x] of [['uOpacity',value],['uTime',time*.001*recipe.drift],['uHeight',height],['uAspect',aspect],['uSeed',(seed%4093)*.071],['uLight',light],['uDensity',recipe.density]])gl.uniform1f(uniforms[k],x);
   gl.uniform2fv(uniforms.uStretch,recipe.stretch);gl.uniform3fv(uniforms.uTint,recipe.tint);gl.drawArrays(gl.TRIANGLES,0,3);
  },
  dispose(){if(program)gl.deleteProgram(program);if(gl)gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
 };
}
