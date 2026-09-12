/* Bounded weather volumes and optional thin cavity dust, composed in linear light. */
(function(){
'use strict';const M=SphereMath;
const profiles=[
 {name:'Forest cumulus',low:1.2,high:3.6,scale:2.6,density:.85,tint:[.58,.65,.69]},
 {name:'Jungle thunderheads',low:.7,high:5.2,scale:3.8,density:1.1,tint:[.58,.65,.55]},
 {name:'Lofted desert dust',low:2.8,high:7.5,scale:6,density:.34,tint:[.67,.39,.21]},
 {name:'Ice fog and snow clouds',low:.15,high:2.2,scale:2.8,density:1.0,tint:[.63,.74,.86]},
 {name:'Ruin ash banks',low:1.8,high:4.6,scale:4.4,density:.48,tint:[.39,.35,.31]},
 {name:'Condensation plumes',low:1.0,high:3.0,scale:2.1,density:.68,tint:[.62,.66,.63]},
 {name:'Marsh vapour',low:.05,high:.7,scale:1.7,density:1.0,tint:[.57,.42,.31]},
 {name:'Marine cumulus',low:1.0,high:3.2,scale:3,density:.8,tint:[.69,.80,.80]},
 {name:'Suspended luminous spores',low:.03,high:.65,scale:1.5,density:.72,tint:[.16,.49,.44]},
 {name:'Violet mineral aerosols',low:1.5,high:5.0,scale:3.6,density:.65,tint:[.48,.30,.60]}
];
class Atmosphere{
 constructor(gl){this.gl=gl;this.program=null;this.dustProgram=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.dust);this.composite=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.composite);this.texture=gl.createTexture();this.volumeLight=gl.createTexture();this.volumeTrans=gl.createTexture();this.fbo=gl.createFramebuffer();this.volumeFbo=gl.createFramebuffer();}
 buffer(texture,unit,width,height,filter){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 noise(){const gl=this.gl;if(!this.noiseTexture){const {data,size}=SphereVolume.noiseVolume();this.noiseTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_3D,this.noiseTexture);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,size,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,k,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_3D);}else{gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_3D,this.noiseTexture);}}
 draw(s,renderer,width,height){
  const altitude=s.radius-M.length(s.position);if(s.layoutVersion!==2||!s.collection||(s.cavityHaze<=0&&(s.atmosphere<=0||altitude<0||altitude>=160)))return renderer.lightTexture;
  const gl=this.gl,n=M.norm(s.position),wound=SphereWorld.woundMetric(n,s);let rim=null,amount=s.atmosphere;
  if(wound.index>=0&&Math.abs(wound.km)<3000&&altitude>=0&&altitude<160){const key=[s.position.map(x=>Math.round(x)),s.radius].join('|');if(this.rimKey!==key){const near=SphereWorld.nearestRim(n,s);this.rim=SphereWorld.rimFrame(s,near.index,near.t);this.rimKey=key;}rim=this.rim;}
  else if(SphereCollection.missing(n,s))amount=0;
  const quality=s.weatherQuality??1,exporting=renderer.renderInfo.exportFrame,steps=exporting?Math.max(112,[48,80,128][quality]):[48,80,128][quality];
  const scale=Math.min(.5,Math.sqrt((exporting?1920*1080:1280*720)/(width*height))),vw=Math.max(1,Math.ceil(width*scale)),vh=Math.max(1,Math.ceil(height*scale));
  const local=amount>0&&altitude>=0&&altitude<160;if(local){this.program??=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.march);this.noise();}const program=local?this.program:this.dustProgram,u=program.u;
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);if(this.width!==width||this.height!==height){this.buffer(this.texture,8,width,height,gl.LINEAR);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Atmosphere composite buffer unavailable');this.width=width;this.height=height;}
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.volumeFbo);if(this.vw!==vw||this.vh!==vh){this.buffer(this.volumeLight,11,vw,vh,gl.NEAREST);this.buffer(this.volumeTrans,12,vw,vh,gl.NEAREST);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.volumeLight,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,this.volumeTrans,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Atmosphere volume buffer unavailable');this.vw=vw;this.vh=vh;}
  gl.viewport(0,0,vw,vh);gl.useProgram(program.p);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,renderer.depthTexture);gl.uniform1i(u.sceneDepth,6);gl.uniform1i(u.densityVolume,10);
  const b=M.basis(s.forward,s.up),id=SphereBiomes.region(n,s),p=profiles[id],rgb=SphereBiomes.catalog[id].haze,f=(k,v)=>gl.uniform1f(u[k],v),v=(k,a)=>gl.uniform3fv(u[k],a);
  gl.uniform1i(u.clipRim,rim?1:0);if(rim)gl.uniform4fv(u.rimPlane,[...rim.inland,M.dot(M.sub(s.position,M.mul(rim.point,s.radius)),rim.inland)]);
  v('cameraUp',M.mul(n,-1));v('forward',b.f);v('right',b.r);v('up',b.u);gl.uniform2f(u.resolution,width,height);f('radius',s.radius);f('height',altitude);f('fov',M.radians(s.fov));f('amount',amount);f('weather',s.weatherStrength);f('low',p.low);f('high',p.high);f('cloudScale',p.scale);f('cloudDensity',p.density);v('cloudTint',p.tint);
  v('hazeTint',s.biomeAtmosphere?[1,3,5].map(i=>Math.pow(parseInt(rgb.slice(i,i+2),16)/255,2.2)*.22):[.06,.12,.21]);v('fill',renderer.frameFill);f('direct',(renderer.atmosphereCache.value??1)*s.luminosity*(M.AU/s.radius)**2);
  f('cavityHaze',s.cavityHaze??.28);f('stellarPower',s.luminosity*(M.AU/s.radius)**2);gl.uniform1i(u.steps,steps);
  v('phase',s.position.map((v,i)=>((v/p.scale+s.time*(i===0?.002:i===2?.0007:0)/p.scale)%32+32)%32));gl.uniform1i(u.panorama,s.projection==='panorama'?1:0);gl.uniform1i(u.clouds,s.clouds?1:0);gl.uniform1i(u.spores,id===8?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,width,height);gl.useProgram(this.composite.p);const c=this.composite.u;
  for(const [unit,texture,name] of [[1,renderer.lightTexture,'source'],[6,renderer.depthTexture,'sceneDepth'],[11,this.volumeLight,'volumeLight'],[12,this.volumeTrans,'volumeTrans']]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(c[name],unit);}gl.uniform2f(c.volumeSize,vw,vh);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
  renderer.renderInfo.weather=altitude>=0&&altitude<160&&amount>0?p.name:'Cavity dust';renderer.renderInfo.volume={steps,width:vw,height:vh,depthAware:true,cavityHaze:s.cavityHaze??.28};return this.texture;
 }
 dispose(){const gl=this.gl;for(const t of [this.texture,this.volumeLight,this.volumeTrans,this.noiseTexture])if(t)gl.deleteTexture(t);gl.deleteFramebuffer(this.fbo);gl.deleteFramebuffer(this.volumeFbo);if(this.program)gl.deleteProgram(this.program.p);gl.deleteProgram(this.dustProgram.p);gl.deleteProgram(this.composite.p);}
}
window.SphereAtmosphere=Atmosphere;window.SphereWeatherProfiles=profiles;
})();
