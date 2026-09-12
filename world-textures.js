/* Original engineering albedo. Exterior illustration plates remain in the art archive. */
(function(){
'use strict';
const base=new URL('assets/',document.currentScript.src);
const groups=[{unit:4,name:'uEngineering',files:['thermal-fields','circulation-fields','fabrication-fields','shade-sunward','shade-shellward'].map(x=>'engineering/'+x+'.png'),w:1024,h:1024}];
class WorldTextures{
 constructor(gl){this.gl=gl;this.ready=false;this.error=null;this.started=false;this.groups=groups.map(g=>{const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+g.unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.SRGB8_ALPHA8,1,1,g.files.length);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);return {...g,texture};});gl.activeTexture(gl.TEXTURE0);}
 async prepare(){if(this.promise)return this.promise;this.started=true;this.promise=(async()=>{const gl=this.gl;
  for(const g of this.groups){const images=await Promise.all(g.files.map(file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Missing world artwork: '+file));img.src=new URL(file,base).href;})));
   gl.activeTexture(gl.TEXTURE0+g.unit);gl.deleteTexture(g.texture);g.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,g.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,Math.floor(Math.log2(Math.max(g.w,g.h)))+1,gl.SRGB8_ALPHA8,g.w,g.h,g.files.length);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
   for(let i=0;i<images.length;i++){const canvas=document.createElement('canvas');canvas.width=g.w;canvas.height=g.h;canvas.getContext('2d').drawImage(images[i],0,0,g.w,g.h);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,g.w,g.h,1,gl.RGBA,gl.UNSIGNED_BYTE,canvas.getContext('2d').getImageData(0,0,g.w,g.h).data);}
   gl.generateMipmap(gl.TEXTURE_2D_ARRAY);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,g.unit===5?gl.CLAMP_TO_EDGE:gl.REPEAT);
   const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }this.ready=true;gl.activeTexture(gl.TEXTURE0);window.dispatchEvent(new Event('sphere-texture-ready'));
 })().catch(e=>{this.error=e;window.dispatchEvent(new Event('sphere-texture-ready'));throw e;});return this.promise;}
 bind(u){const gl=this.gl;for(const g of this.groups){gl.activeTexture(gl.TEXTURE0+g.unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,g.texture);gl.uniform1i(u[g.name],g.unit);}gl.uniform1i(u.uWorldTexturesReady,this.ready?1:0);gl.activeTexture(gl.TEXTURE0);}
 dispose(){for(const g of this.groups)this.gl.deleteTexture(g.texture);}
}
window.SphereWorldTextures=WorldTextures;
})();
