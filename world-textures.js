/* Original engineering albedo. Individual layers are fetched on demand. */
(function(root){
'use strict';
// Preserve radiance while reducing Shade artwork. Canvas resizing averages
// display-encoded values, so thin bright construction darkens at each mip.
function shadeMips(pixels,size){
 if(!Number.isInteger(size)||size<1||(size&(size-1))||pixels.length!==size*size*4)throw Error('Shade artwork must be square power-of-two RGBA');
 const decode=Array.from({length:256},(_,i)=>{const v=i/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const encode=v=>Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));
 const levels=[{size,pixels:new Uint8Array(pixels)}];let linear=new Float32Array(size*size*3);
 for(let i=0;i<size*size;i++)for(let c=0;c<3;c++)linear[i*3+c]=decode[pixels[i*4+c]];
 for(let child=size/2;child>=1;child/=2){
  const parent=child*2,next=new Float32Array(child*child*3),data=new Uint8Array(child*child*4);
  for(let y=0;y<child;y++)for(let x=0;x<child;x++){
   for(let c=0;c<3;c++){const p=(y*2*parent+x*2)*3+c,v=(linear[p]+linear[p+3]+linear[p+parent*3]+linear[p+parent*3+3])*.25;next[(y*child+x)*3+c]=v;data[(y*child+x)*4+c]=encode(v);}
   data[(y*child+x)*4+3]=255;
  }
  levels.push({size:child,pixels:data});linear=next;
 }
 return {levels,mean:Array.from(linear)};
}
root.SphereShadeMips=shadeMips;
if(typeof module!=='undefined')module.exports=shadeMips;
if(typeof document==='undefined')return;
const base=new URL('assets/engineering/',document.currentScript.src),files=['thermal-fields','circulation-fields','fabrication-fields','shade-sunward','shade-shellward'],SIZE=1024,LEVELS=11;
// Linear means of the shipped 1024 px Shade artwork, available before loading.
// The uploaded pyramid remeasures them; browser coverage checks this contract.
const shadeMeans=[[.0743750408,.0686222687,.0657429099],[.1488371789,.1400215179,.1251828223]];
class WorldTextures{
 constructor(gl){this.gl=gl;this.allocated=false;this.started=false;this.texture=gl.createTexture();this.status=Array(5).fill('unloaded');this.queue=[];this.pending=[];this.loading=false;this.disposed=false;this.means=new Float32Array([...Array(9).fill(0),...shadeMeans.flat()]);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.SRGB8_ALPHA8,1,1,5);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.activeTexture(gl.TEXTURE0);
 }
 get ready(){return this.status.includes('ready');}
 allocate(){if(this.allocated)return;this.allocated=true;const gl=this.gl;gl.deleteTexture(this.texture);this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,LEVELS,gl.SRGB8_ALPHA8,SIZE,SIZE,5);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));gl.activeTexture(gl.TEXTURE0);}
 request(id){if(this.disposed||!Number.isInteger(id)||id<0||id>=5||this.status[id]!=='unloaded')return;this.started=true;this.allocate();this.status[id]='queued';this.queue.push(id);this.next();}
 next(){if(this.disposed||this.loading||!this.queue.length)return;const id=this.queue.shift(),img=new Image();this.loading=true;this.status[id]='loading';img.onload=()=>{if(this.disposed)return;this.pending.push({id,img});this.status[id]='decoded';this.loading=false;window.dispatchEvent(new Event('sphere-texture-ready'));};img.onerror=()=>{if(this.disposed)return;this.status[id]='failed';this.loading=false;this.next();window.dispatchEvent(new Event('sphere-texture-ready'));};img.src=new URL(files[id]+'.png',base).href;}
 upload(){if(this.disposed||!this.pending.length)return;const {id,img}=this.pending.shift(),gl=this.gl;gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  try{let canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;canvas.getContext('2d').drawImage(img,0,0,SIZE,SIZE);
   if(id===3||id===4){const chain=shadeMips(canvas.getContext('2d').getImageData(0,0,SIZE,SIZE).data,SIZE);this.means.set(chain.mean,id*3);for(const [level,{size,pixels}]of chain.levels.entries())gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,level,0,0,id,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);}
   else for(let level=0,size=SIZE;level<LEVELS;level++,size>>=1){if(level){const smaller=document.createElement('canvas');smaller.width=smaller.height=size;smaller.getContext('2d').drawImage(canvas,0,0,size,size);canvas=smaller;}gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,level,0,0,id,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,canvas.getContext('2d').getImageData(0,0,size,size).data);}this.status[id]='ready';
  }catch(error){this.status[id]='failed';console.warn('Builder material unavailable:',files[id],error.message);}gl.activeTexture(gl.TEXTURE0);this.next();
 }
 prepare(ids=[],options={}){return window.SphereAssets.prepareMaps(this,ids,'Builder materials',options);}
 bind(u){const gl=this.gl;gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.uniform1i(u.uEngineering,4);gl.uniform1i(u.uWorldTexturesReady,this.ready?1:0);gl.uniform1fv(u['uEngineeringReady[0]'],Float32Array.from(this.status,x=>x==='ready'?1:0));gl.uniform3fv(u['uEngineeringMean[0]'],this.means);gl.activeTexture(gl.TEXTURE0);}
 dispose(){this.disposed=true;this.queue=[];this.pending=[];this.gl.deleteTexture(this.texture);}
}
window.SphereWorldTextures=WorldTextures;
})(typeof window==='undefined'?globalThis:window);
