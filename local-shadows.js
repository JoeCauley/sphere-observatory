/* Two local directional shadow regions. CPU coordinates stay double precision;
 * only small light-relative offsets reach the GPU. No AU-sized shadow matrix. */
(function(root){
'use strict';const M=root.SphereMath,{add,sub,mul,dot,norm,length:len}=M;
function bounds(mesh){const b=mesh.bvh;if(!b)return null;const centre=b.min.map((x,i)=>(x+b.max[i])*.5),half=b.min.map((x,i)=>(b.max[i]-x)*.5);return {centre:mesh.world(centre),half};}
function makePlan(s,groups,resolution=1024){
 if(!groups.length)return null;
 const ray=norm(s.position),basis=M.basis(ray),right=basis.r,up=basis.u;
 const items=groups.map(mesh=>({mesh,bound:bounds(mesh)})).filter(x=>x.bound);if(!items.length)return null;
 let nearest=Infinity;for(const {mesh}of items){const p=mesh.local(s.position),b=mesh.bvh;nearest=Math.min(nearest,Math.hypot(...p.map((v,i)=>Math.max(b.min[i]-v,0,v-b.max[i]))));}
 if(nearest>300)return null;
 // Powers of two hold texel density steady during ordinary flight.
 const near=2**Math.ceil(Math.log2(M.clamp(nearest*.8,.5,32))),far=near*8;
 const depth=Math.max(far*2,s.shellThickness+4),axes=[right,up,ray],cascades=[];
 for(const extent of [near,far]){
  const target=add(s.position,mul(norm(s.forward),Math.min(nearest+extent*.25,extent*.65))),texel=extent*2/resolution;
  const xyz=axes.map((axis,i)=>i<2?Math.round(dot(target,axis)/texel)*texel:dot(target,axis));
  const centre=axes.reduce((p,axis,i)=>add(p,mul(axis,xyz[i])),[0,0,0]);
  const casters=items.filter(({mesh,bound})=>{const d=sub(bound.centre,centre);return axes.every((axis,i)=>Math.abs(dot(d,axis))<= (i===2?depth:extent)+mesh.basis.reduce((a,b,j)=>a+Math.abs(dot(b,axis))*bound.half[j],0));}).map(x=>x.mesh);
  cascades.push({extent,centre,relative:sub(centre,s.position),casters});
 }
 return {ray,right,up,depth,resolution,cascades,nearest};
}
const vertex=`#version 300 es
precision highp float;layout(location=0)in vec3 position;
uniform vec3 uOffset,uX,uY,uZ;uniform vec2 uExtent;
void main(){vec3 p=uOffset+position.x*uX+position.y*uY+position.z*uZ;gl_Position=vec4(p.xy/uExtent.x,p.z/uExtent.y,1.);}`;
class LocalShadows{
 constructor(gl){this.gl=gl;this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,2,1,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);for(const [k,v]of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);gl.activeTexture(gl.TEXTURE0);this.plan=null;this.quality=0;this.size=0;this.renders=0;}
 prepare(s,groups,upload,{exportFrame=false}={}){
  const gl=this.gl;this.quality=0;this.info={enabled:false};
  if(s.localShadows===0||!s.geometryDetail||s.layoutVersion!==2||!s.collection||s.viewMode!=='material')return;
  const quality=s.localShadows??1,resolution=exportFrame||quality===2?2048:1024,plan=makePlan(s,groups,resolution);if(!plan)return;
  this.quality=quality;this.plan=plan;
  this.program??=root.SphereGLProgram(gl,vertex,'#version 300 es\nprecision highp float;void main(){}');
  if(!this.fbo)this.fbo=gl.createFramebuffer();
  const target=gl.getParameter(gl.FRAMEBUFFER_BINDING),viewport=gl.getParameter(gl.VIEWPORT);
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.size!==resolution){gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,resolution*2,resolution,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);this.size=resolution;this.key='';}
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.texture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Structure shadow framebuffer unavailable');
  const key=JSON.stringify([quality,resolution,plan.ray,plan.right,plan.cascades.map(c=>[c.centre,c.extent,c.casters.map(m=>[m.streamKey||m.name,m.count,m.origin,m.basis])]),plan.depth]);
  let triangles=0;
  if(key!==this.key){
   gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program.p);
   const u=this.program.u,axes=[plan.right,plan.up,plan.ray];
   for(let i=0;i<2;i++){const cascade=plan.cascades[i];gl.viewport(i*resolution,0,resolution,resolution);gl.uniform2f(u.uExtent,cascade.extent,plan.depth);
    for(const mesh of cascade.casters){const b=upload(mesh);gl.bindVertexArray(b.vao);gl.uniform3fv(u.uOffset,axes.map(a=>dot(sub(mesh.origin,cascade.centre),a)));for(let j=0;j<3;j++)gl.uniform3fv(u[['uX','uY','uZ'][j]],axes.map(a=>dot(mesh.basis[j],a)));gl.drawArrays(gl.TRIANGLES,0,mesh.count);triangles+=mesh.count/3;}
   }
   this.key=key;this.renders++;
  }
  gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(...viewport);gl.activeTexture(gl.TEXTURE0);
  this.info={enabled:true,quality,resolution,cascades:2,nearWidthKm:plan.cascades[0].extent*2,farWidthKm:plan.cascades[1].extent*2,nearTexelMetres:plan.cascades[0].extent*2000/resolution,submittedTriangles:triangles,cached:triangles===0,depthStorageMiB:resolution*resolution*2*4/1048576};
 }
 bind(u,s){const gl=this.gl;gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.uStructureShadow,7);gl.uniform1i(u.uLocalShadowQuality,this.quality);
  if(this.quality){const p=this.plan;gl.uniform3fv(u.uShadowRight,p.right);gl.uniform3fv(u.uShadowUp,p.up);gl.uniform3fv(u.uShadowRay,p.ray);gl.uniform3fv(u['uShadowCentre[0]'],p.cascades.flatMap(c=>sub(c.centre,s.position)));gl.uniform4f(u.uShadowScale,p.cascades[0].extent,p.cascades[1].extent,p.depth,p.resolution);gl.uniform1f(u.uSunAngularRadius,s.starRadius/len(s.position));}gl.activeTexture(gl.TEXTURE0);
 }
 dispose(){const gl=this.gl;gl.deleteTexture(this.texture);if(this.fbo)gl.deleteFramebuffer(this.fbo);if(this.program)gl.deleteProgram(this.program.p);}
}
root.SphereLocalShadows=LocalShadows;root.SphereShadowPlan=makePlan;
})(typeof window==='undefined'?globalThis:window);
