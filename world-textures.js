/* Original engineering albedo. Individual layers are fetched on demand. */
(function(){
'use strict';
const base=new URL('assets/engineering/',document.currentScript.src),files=['thermal-fields','circulation-fields','fabrication-fields','shade-sunward','shade-shellward'],SIZE=1024,LEVELS=11;
class WorldTextures{
 constructor(gl){this.gl=gl;this.allocated=false;this.started=false;this.texture=gl.createTexture();this.status=Array(5).fill('unloaded');this.queue=[];this.pending=[];this.loading=false;this.disposed=false;
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.SRGB8_ALPHA8,1,1,5);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.activeTexture(gl.TEXTURE0);
 }
 get ready(){return this.status.includes('ready');}
 allocate(){if(this.allocated)return;this.allocated=true;const gl=this.gl;gl.deleteTexture(this.texture);this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,LEVELS,gl.SRGB8_ALPHA8,SIZE,SIZE,5);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));gl.activeTexture(gl.TEXTURE0);}
 request(id){if(this.disposed||!Number.isInteger(id)||id<0||id>=5||this.status[id]!=='unloaded')return;this.started=true;this.allocate();this.status[id]='queued';this.queue.push(id);this.next();}
 next(){if(this.disposed||this.loading||!this.queue.length)return;const id=this.queue.shift(),img=new Image();this.loading=true;this.status[id]='loading';img.onload=()=>{if(this.disposed)return;this.pending.push({id,img});this.status[id]='decoded';this.loading=false;window.dispatchEvent(new Event('sphere-texture-ready'));};img.onerror=()=>{if(this.disposed)return;this.status[id]='failed';this.loading=false;this.next();window.dispatchEvent(new Event('sphere-texture-ready'));};img.src=new URL(files[id]+'.png',base).href;}
 upload(){if(this.disposed||!this.pending.length)return;const {id,img}=this.pending.shift(),gl=this.gl;gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  try{let canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;canvas.getContext('2d').drawImage(img,0,0,SIZE,SIZE);
   for(let level=0,size=SIZE;level<LEVELS;level++,size>>=1){if(level){const smaller=document.createElement('canvas');smaller.width=smaller.height=size;smaller.getContext('2d').drawImage(canvas,0,0,size,size);canvas=smaller;}gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,level,0,0,id,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,canvas.getContext('2d').getImageData(0,0,size,size).data);}this.status[id]='ready';
  }catch(error){this.status[id]='failed';console.warn('Builder material unavailable:',files[id],error.message);}gl.activeTexture(gl.TEXTURE0);this.next();
 }
 prepare(ids=[],options={}){return window.SphereAssets.prepareMaps(this,ids,'Builder materials',options);}
 bind(u){const gl=this.gl;gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.uniform1i(u.uEngineering,4);gl.uniform1i(u.uWorldTexturesReady,this.ready?1:0);gl.uniform1fv(u['uEngineeringReady[0]'],Float32Array.from(this.status,x=>x==='ready'?1:0));gl.activeTexture(gl.TEXTURE0);}
 dispose(){this.disposed=true;this.queue=[];this.pending=[];this.gl.deleteTexture(this.texture);}
}
window.SphereWorldTextures=WorldTextures;
})();
