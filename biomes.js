/* Three finite texture scales; stable positions are computed in CPU doubles. */
(function(root){
'use strict';const M=root.SphereMath;
const catalog=[
 ['dark-age-forest','Dark Age Forest','#557776',[.025,.075,.042],'Black firs, ancient oak canopy and forgotten clearings.'],
 ['super-jungle','Super Jungle','#70ab79',[.035,.16,.075],'An unbroken ocean of colossal emerald crowns.'],
 ['ultra-desert','Ultra Desert','#d69b67',[.30,.15,.05],'Dune seas, salt hollows and exposed black rock.'],
 ['winter-hell','Winter Hell','#a2c6e5',[.32,.40,.46],'Fractured glaciers, blue crevasses and wind-scoured ice.'],
 ['ruined-shell','The Ruin','#a58d79',[.075,.052,.041],'Ash, shattered districts and exposed shell foundations.'],
 ['machine-expanse','Machine Expanse','#9fa78f',[.065,.082,.09],'Vast machines, service trenches and amber conduits.'],
 ['rust-marsh','Rustwater Marsh','#bd8b76',[.15,.075,.042],'Copper wetlands, black channels and teal algae.'],
 ['chalk-archipelago','Chalk Archipelago','#8acacb',[.14,.26,.24],'White limestone islands in shallow turquoise lagoons.'],
 ['mycelium-sea','Mycelium Sea','#67bfb1',[.028,.11,.12],'A luminous fungal ocean threaded with living networks.'],
 ['violet-labyrinth','Violet Labyrinth','#b394d3',[.15,.065,.20],'Endless amethyst mazes and crystalline mineral crowns.']
].map(([id,name,haze,albedo,description])=>({id,name,haze,albedo,description}));
const scales=[256,16,1],bands=[[600,1800],[60,180],[6,18]];
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function weights(distance,footprint=0){return bands.map(([near,far],i)=>(1-smooth(near,far,distance))*(1-smooth(.03,.12,footprint/scales[i])));}
function region(q,s){if(s.biome>=0)return s.biome;const C=root.SphereCollection;if(s.collection&&C){const r=C.region(q,s);if(r.weight<.15)return s.era==='after'?4:5;return ((r.cell+r.band*3+Math.floor(s.seed))%10+10)%10;}
 const lat=Math.asin(M.clamp(q[1],-1,1)),lon=Math.atan2(q[0],q[2]);return ((Math.floor((lon/Math.PI/2+.5)*24)+Math.floor((lat/Math.PI+.5)*12)*3+Math.floor(s.seed))%10+10)%10;}
function anchors(n,radius){return scales.flatMap(scale=>n.map(x=>((x*radius/scale)%64+64)%64));}
const originalDefault=M.defaultState,originalValidate=M.validate;
M.defaultState=()=>({...originalDefault(),biome:-1,textureDetail:true,biomeAtmosphere:true});
M.validate=input=>{const s=originalValidate(input);s.biome=input.biome??-1;s.textureDetail=input.textureDetail??true;s.biomeAtmosphere=input.biomeAtmosphere??true;
 if(!Number.isInteger(s.biome)||s.biome< -1||s.biome>=catalog.length)throw Error('Invalid biome');
 for(const k of ['textureDetail','biomeAtmosphere'])if(typeof s[k]!=='boolean')throw Error('Invalid '+k);return s;};
root.SphereBiomes={catalog,scales,bands,weights,region,anchors};
if(typeof document==='undefined')return;
const assetRoot=new URL('assets/biomes/',document.currentScript.src);
class Textures {
 constructor(gl){this.gl=gl;this.ready=new Float32Array(10);this.loadedAt=new Float64Array(10);this.status=Array(10).fill('unloaded');this.queue=[];this.loading=false;this.pending=[];
  this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY,10,gl.SRGB8_ALPHA8,512,512,30);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.MIRRORED_REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.MIRRORED_REPEAT);
  const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  gl.activeTexture(gl.TEXTURE0);
 }
 request(id){if(id<0||id>=10||this.status[id]!=='unloaded')return;this.status[id]='queued';this.queue.push(id);this.next();}
 next(){if(this.loading||!this.queue.length)return;const id=this.queue.shift();this.loading=true;this.status[id]='loading';const img=new Image();
  img.onload=()=>{this.pending.push({id,img});this.status[id]='decoded';this.loading=false;this.next();root.dispatchEvent(new Event('sphere-texture-ready'));};
  img.onerror=()=>{this.status[id]='failed';this.loading=false;this.next();root.dispatchEvent(new Event('sphere-texture-ready'));};img.src=new URL(catalog[id].id+'.png',assetRoot).href;
 }
 upload(){if(!this.pending.length)return;const {id,img}=this.pending.shift(),gl=this.gl,canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  // Build each layer's mip chain separately: loading one biome never rebuilds all 30 layers.
  try{for(let tier=0;tier<3;tier++){canvas.width=canvas.height=512;ctx.drawImage(img,tier*img.width/3,0,img.width/3,img.height,0,0,512,512);
   for(let level=0,size=512;level<10;level++,size>>=1){if(level){const smaller=document.createElement('canvas');smaller.width=smaller.height=size;smaller.getContext('2d').drawImage(canvas,0,0,size,size);canvas.width=canvas.height=size;ctx.drawImage(smaller,0,0);}
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,level,0,0,id*3+tier,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,ctx.getImageData(0,0,size,size).data);
   }
  }
  this.loadedAt[id]=performance.now();this.status[id]='ready';
  }catch(error){this.status[id]='failed';console.warn('Biome texture unavailable; using atlas fallback. Launch through localhost for texture access.',catalog[id].name,error.message);}
  gl.activeTexture(gl.TEXTURE0);
 }
 bind(uniforms,exact=false){const now=performance.now();this.fading=false;for(let id=0;id<10;id++)if(this.status[id]==='ready'){this.ready[id]=exact?1:clamp((now-this.loadedAt[id])/350);if(this.ready[id]<1)this.fading=true;}
  const gl=this.gl;gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texture);gl.uniform1i(uniforms.uBiomeTex,2);gl.uniform1fv(uniforms['uBiomeReady[0]'],this.ready);gl.activeTexture(gl.TEXTURE0);}
 async prepare(){for(let i=0;i<10;i++)this.request(i);const start=performance.now();while(this.loading||this.queue.length){if(performance.now()-start>15000)throw Error('Surface textures are still loading. Try the photograph again.');await new Promise(r=>setTimeout(r,20));}
  while(this.pending.length)this.upload();const failed=this.status.findIndex(s=>s==='failed');if(failed>=0)throw Error('Missing biome texture: '+catalog[failed].name);}
}
root.SphereBiomes.Textures=Textures;
})(typeof window==='undefined'?globalThis:window);
