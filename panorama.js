/* Six camera-relative views preserve local geometry in equirectangular photographs. */
(function(){
'use strict';const M=SphereMath,faces=[[[1,0,0],[0,-1,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[0,0,1]],[[0,-1,0],[0,0,-1]],[[0,0,1],[0,-1,0]],[[0,0,-1],[0,-1,0]]];
class Panorama{
 constructor(gl){this.gl=gl;this.texture=gl.createTexture();this.program=SphereGLProgram(gl,SphereShaders.vertex,`#version 300 es
precision highp float;in vec2 vUV;out vec4 fragColor;uniform samplerCube panorama;uniform vec3 forward,right,up;
void main(){vec2 xy=vUV*2.-1.;float lon=xy.x*3.14159265359,lat=xy.y*1.570796326795;vec3 d=forward*cos(lat)*cos(lon)+right*cos(lat)*sin(lon)+up*sin(lat);fragColor=vec4(texture(panorama,d).rgb,1.);}`);}
 draw(renderer,s,width,height,options){const gl=this.gl,start=performance.now(),size=Math.max(64,Math.min(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),Math.ceil(width/4)));gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);
  // The renderer's alpha:false drawing buffer is RGB. WebGL requires matching
  // colour components when copying its pixels into a cube face.
  if(size!==this.size){for(let face=0;face<6;face++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+face,0,gl.RGB8,size,size,0,gl.RGB,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_CUBE_MAP,parameter,gl.CLAMP_TO_EDGE);this.size=size;}
  gl.activeTexture(gl.TEXTURE0);let query=null;if(renderer.timer&&!options.exportFrame&&renderer.queries.length<4){query=gl.createQuery();gl.beginQuery(renderer.timer.TIME_ELAPSED_EXT,query);}
  for(let face=0;face<6;face++){const [forward,up]=faces[face];renderer.draw({...s,forward,up,fov:90,projection:'perspective'},size,size,{...options,facePass:true});gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);gl.copyTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+face,0,0,0,0,0,size,size);}
  const info={...renderer.renderInfo};renderer.canvas.width=width;renderer.canvas.height=height;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(null);gl.useProgram(this.program.p);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);const b=M.basis(s.forward,s.up),u=this.program.u;gl.uniform1i(u.panorama,9);gl.uniform3fv(u.forward,b.f);gl.uniform3fv(u.right,b.r);gl.uniform3fv(u.up,b.u);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
  if(query){gl.endQuery(renderer.timer.TIME_ELAPSED_EXT);renderer.queries.push(query);}renderer.cpuMs=performance.now()-start;renderer.renderInfo={...info,width,height,panoramaFaces:6,faceResolution:size,cpuMs:renderer.cpuMs,gpuMs:renderer.gpuMs};
 }
 dispose(){this.gl.deleteTexture(this.texture);this.gl.deleteProgram(this.program.p);}
}
window.SpherePanorama=Panorama;
})();
