/* Host-owned overview extension. It changes only an assigned shell's material. */
(function(root){
'use strict';
const O=root.SphereBiomeOverviewIndex||(typeof module!=='undefined'?require('./overview-index.js'):null),MAX_ASSIGNMENTS=128,TEXTURE_UNIT=5;
function fail(code,message){throw Object.assign(Error(message),{code,phase:'overview-shader'});}
function replace(source,slot,replacement){const count=source.split(slot).length-1;if(count!==1)fail('SHADER_SOURCE_MISMATCH','Expected one exact overview integration slot, found '+count);return source.replace(slot,replacement);}
function assemble(source){
 if(typeof source!=='string'||!source.startsWith('#version 300 es\n')||!O?.kernel)fail('SHADER_SOURCE_MISMATCH','The actual modern world shader and fixed ownership kernel are required');
 const declarations=O.kernel+`\nuniform vec3 uBpsCameraHi,uBpsCameraLo;
uniform vec3 uBpsAlbedo[${MAX_ASSIGNMENTS}];
vec3 bpsAssignedMaterial(vec3 original,vec3 direction){
 if(uBpsEnabled==0)return original;
 vec3 qh,ql;bpsRayPoint(uBpsCameraHi,uBpsCameraLo,direction,vec3(0.),qh,ql);
 uint slot=bpsOwner(qh,ql);if(slot==0u||slot>${MAX_ASSIGNMENTS}u)return original;
 return uBpsAlbedo[int(slot)-1];
}\n`;
 let out=replace(source,'const float PI=',declarations+'\nconst float PI=');
 // Object selection, protected holes, physical shades, lighting, depth and sky
 // remain the existing host's owners. No material is painted over another hit.
 const material='surfaceMaterial(q,delta,footprint,ts*uRadius)';
 out=replace(out,material,'bpsAssignedMaterial('+material+',d)');
 return out;
}
function createProgram(gl,source){
 if(!gl?.createProgram)fail('INVALID_RENDERER','The main WebGL2 context is required');
 const fragment=assemble(source.fragment),shaders=[],program=gl.createProgram();let complete=false;
 try{for(const [type,text]of [[gl.VERTEX_SHADER,source.vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);if(!shader)fail('RESOURCE_LIMIT','Shader allocation refused');shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))fail('SHADER_COMPILE_FAILED',gl.getShaderInfoLog(shader)||'Overview shader failed');gl.attachShader(program,shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))fail('SHADER_LINK_FAILED',gl.getProgramInfoLog(program)||'Overview program failed');
  const uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i);uniforms[info.name]=gl.getUniformLocation(program,info.name);}complete=true;
  return Object.freeze({program,uniforms,fragment,dispose(){gl.deleteProgram(program);}});
 }finally{for(const shader of shaders)gl.deleteShader(shader);if(!complete&&program)gl.deleteProgram(program);}
}
function frame(core,albedos){
 if(!core||!Array.isArray(core.position)||core.position.length!==3||!core.position.every(Number.isFinite)||!Number.isFinite(core.radius)||core.radius<=0||!Array.isArray(albedos)||albedos.length>MAX_ASSIGNMENTS)fail('INVALID_FRAME','Actual core pose and exact registry-order appearance data are required');
 const colors=new Float32Array(MAX_ASSIGNMENTS*3);for(let n=0;n<albedos.length;n++){const c=albedos[n];if(!Array.isArray(c)||c.length!==3||!c.every(v=>Number.isFinite(v)&&v>=0&&v<=1))fail('INVALID_APPEARANCE','Admitted overview albedo must be finite in [0,1]');colors.set(c,n*3);}
 const camera=O.splitVector(core.position.map(v=>v/core.radius));return {cameraHigh:camera.high,cameraLow:camera.low,colors,assignmentCount:albedos.length};
}
function bind(gl,uniforms,frameData,tree){
 const textureUnit=TEXTURE_UNIT;
 if(!Number.isSafeInteger(textureUnit)||textureUnit<0||textureUnit>=gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)||!tree||!Array.isArray(tree.roots)||tree.roots.length!==6||!tree.roots.every(Number.isSafeInteger)||tree.assignmentCount!==frameData.assignmentCount)fail('INVALID_INDEX','Exact ownership bank and ordered appearance projection differ');
 gl.activeTexture(gl.TEXTURE0+textureUnit);gl.bindTexture(gl.TEXTURE_2D,tree.texture);gl.uniform1i(uniforms.uBpsTree,textureUnit);gl.uniform1uiv(uniforms['uBpsRoots[0]'],tree.roots);gl.uniform3fv(uniforms.uBpsCameraHi,frameData.cameraHigh);gl.uniform3fv(uniforms.uBpsCameraLo,frameData.cameraLow);gl.uniform3fv(uniforms['uBpsAlbedo[0]'],frameData.colors);gl.uniform1ui(uniforms.uBpsRoundXor,0);gl.uniform1i(uniforms.uBpsEnabled,1);
}
function withBound(gl,uniforms,frameData,tree,draw){
 if(typeof draw!=='function'||draw.constructor.name==='AsyncFunction')fail('INVALID_CALLBACK','A synchronous main renderer draw is required');
 const previousActive=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+TEXTURE_UNIT);
 const previousTexture=gl.getParameter(gl.TEXTURE_BINDING_2D);
 try{bind(gl,uniforms,frameData,tree);const value=draw();if(value&&typeof value.then==='function')fail('INVALID_CALLBACK','A main renderer draw cannot await');return value;}
 finally{gl.activeTexture(gl.TEXTURE0+TEXTURE_UNIT);gl.bindTexture(gl.TEXTURE_2D,previousTexture);gl.activeTexture(previousActive);}
}
const api=Object.freeze({MAX_ASSIGNMENTS,TEXTURE_UNIT,assemble,createProgram,frame,withBound});root.SphereBiomeOverviewShader=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
