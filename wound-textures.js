/* Original biome-specific destruction maps. Decode only the adjoining regions.
 * Native 1254-square images, sRGB sampling, linear-light mipmaps, unit 14. */
(function(){
'use strict';
const B=SphereBiomes,W=SphereWorld,M=SphereMath,base=new URL('assets/wound-edges/',document.currentScript.src),SIZE=1254,LEVELS=11;
const linear=Float32Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
const encoded=x=>Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));
class WoundTextures{
 constructor(gl){this.gl=gl;this.texture=gl.createTexture();this.allocated=false;this.disposed=false;this.status=Array(10).fill('unloaded');this.ready=new Float32Array(10);this.loadedAt=new Float64Array(10);this.queue=[];this.pending=[];this.loading=false;this.fading=false;
  gl.activeTexture(gl.TEXTURE14);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.SRGB8_ALPHA8,1,1,10);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.activeTexture(gl.TEXTURE0);
 }
 allocate(){if(this.allocated)return;this.allocated=true;const gl=this.gl;gl.deleteTexture(this.texture);this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE14);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,LEVELS,gl.SRGB8_ALPHA8,SIZE,SIZE,10);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.MIRRORED_REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.MIRRORED_REPEAT);
  const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));gl.activeTexture(gl.TEXTURE0);
 }
 request(id){if(this.disposed||id<0||id>9||this.status[id]!=='unloaded')return;this.allocate();this.status[id]='queued';this.queue.push(id);this.next();}
 requestFor(s){if(s.layoutVersion!==2||!s.collection||s.era!=='after'||!s.multipleWounds||s.textureDetail===false)return;
  const ctx=SphereEdges.rimContext(s);if(!ctx)return;
  for(const q of [M.norm(s.position),ctx.point,...[-500,500].map(k=>M.norm(M.add(ctx.point,M.mul(ctx.tangent,k/s.radius))))]){const r=W.sample(q,s);this.request(W.edgeBiome(r.a));this.request(W.edgeBiome(r.b));}
 }
 next(){if(this.disposed||this.loading||!this.queue.length)return;const id=this.queue.shift(),img=new Image();this.loading=true;this.status[id]='loading';
  img.onload=()=>{if(this.disposed)return;this.pending.push({id,img});this.status[id]='decoded';this.loading=false;window.dispatchEvent(new Event('sphere-texture-ready'));};
  img.onerror=()=>{if(this.disposed)return;this.status[id]='failed';this.loading=false;console.warn('Missing Wound artwork:',B.catalog[id].name);this.next();window.dispatchEvent(new Event('sphere-texture-ready'));};img.src=new URL(B.catalog[id].id+'.png',base).href;
 }
 upload(){if(!this.pending.length||this.disposed)return;const {id,img}=this.pending.shift(),gl=this.gl;gl.activeTexture(gl.TEXTURE14);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  try{if(img.naturalWidth!==SIZE||img.naturalHeight!==SIZE)throw Error('Unexpected Wound artwork dimensions');const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;canvas.getContext('2d').drawImage(img,0,0);let data=canvas.getContext('2d').getImageData(0,0,SIZE,SIZE).data,size=SIZE;
   for(let level=0;level<LEVELS;level++){
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,level,0,0,id,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,data);if(level===LEVELS-1)break;
    const nextSize=size>>1,next=new Uint8Array(nextSize*nextSize*4);
    // Area bins retain the final row/column of odd-sized mip levels.
    for(let y=0;y<nextSize;y++)for(let x=0;x<nextSize;x++){const x0=Math.floor(x*size/nextSize),x1=Math.floor((x+1)*size/nextSize),y0=Math.floor(y*size/nextSize),y1=Math.floor((y+1)*size/nextSize),n=(x1-x0)*(y1-y0),dst=(y*nextSize+x)*4;
     for(let c=0;c<3;c++){let sum=0;for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)sum+=linear[data[(yy*size+xx)*4+c]];next[dst+c]=encoded(sum/n);}next[dst+3]=255;
    }data=next;size=nextSize;
   }this.status[id]='ready';this.loadedAt[id]=performance.now();
  }catch(e){this.status[id]='failed';console.warn('Wound texture unavailable:',B.catalog[id].name,e.message);}gl.activeTexture(gl.TEXTURE0);this.next();
 }
 bind(u,exact=false){this.fading=false;const now=performance.now();for(let id=0;id<10;id++)if(this.status[id]==='ready'){this.ready[id]=exact?1:Math.min(1,(now-this.loadedAt[id])/650);if(this.ready[id]<1)this.fading=true;}const gl=this.gl;gl.activeTexture(gl.TEXTURE14);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.uniform1i(u.uWoundTex,14);gl.uniform1fv(u['uWoundReady[0]'],this.ready);gl.activeTexture(gl.TEXTURE0);}
 async prepare(){for(let id=0;id<10;id++)this.request(id);const start=performance.now();while(this.loading||this.queue.length||this.pending.length){this.upload();if(performance.now()-start>60000)throw Error('Wound artwork is still loading. Try again shortly.');await new Promise(resolve=>setTimeout(resolve,20));}const failed=this.status.indexOf('failed');if(failed>=0)throw Error('Missing Wound texture: '+B.catalog[failed].name);}
 dispose(){this.disposed=true;this.queue=[];this.pending=[];this.gl.deleteTexture(this.texture);}
 get info(){return {ready:this.status.filter(x=>x==='ready').length,total:10,gpuMiB:this.allocated?79.96:0,tileKm:W.woundTileKm,damageBandKm:W.woundBandKm};}
}
window.SphereWoundTextures=WoundTextures;
})();
