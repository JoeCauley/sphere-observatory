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
].map(profile=>({...profile,scale:profile.scale*SphereVolume.cloudFeatureScale}));
// Broad climate belongs to the receiving region, never to the camera's Place.
// This small numeric map carries tint and coverage; it loads no image assets.
const regionalCoverage=[.43,.54,.22,.42,.25,.31,.46,.49,.34,.29];
function climatePixels(s,width=256,height=128){
 const data=new Uint8Array(width*height*4),climateState={...s,multipleWounds:false,transitionKm:Math.max(s.transitionKm,s.radius*.024)};
 const profile=id=>profiles[id<10?id:5],coverage=id=>id===15?.24:regionalCoverage[id<10?id:5];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const q=SphereWorld.direction(((y+.5)/height-.5)*Math.PI,((x+.5)/width-.5)*Math.PI*2,s),r=SphereWorld.sample(q,climateState),a=profile(r.a),b=profile(r.b),i=(y*width+x)*4;
  for(let j=0;j<3;j++)data[i+j]=Math.round((([.65,.70,.75][j]*.64)+(a.tint[j]*(1-r.blend)+b.tint[j]*r.blend)*.36)*255);
  data[i+3]=Math.round((coverage(r.a)*(1-r.blend)+coverage(r.b)*r.blend)*255);
 }return {data,width,height};
}
class Atmosphere{
 constructor(gl){this.gl=gl;this.program=null;this.dustProgram=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.dust);this.composite=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.composite);this.texture=gl.createTexture();this.volumeLight=gl.createTexture();this.volumeTrans=gl.createTexture();this.fbo=gl.createFramebuffer();this.volumeFbo=gl.createFramebuffer();}
 buffer(texture,unit,width,height,filter){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 noise(){const gl=this.gl;if(!this.noiseTexture){const {data,size}=SphereVolume.noiseVolume();this.noiseTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_3D,this.noiseTexture);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,size,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,k,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_3D);}else{gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_3D,this.noiseTexture);}}
 climate(s){const gl=this.gl,key=[s.layoutVersion,s.axisLat,s.axisLon,s.waistWidth,s.transitionKm,s.radius,s.era,s.biome].join('|');
  this.climateTexture??=gl.createTexture();gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.climateTexture);
  if(this.climateKey!==key){const {data,width,height}=climatePixels(s);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);this.climateKey=key;}
 }
 draw(s,renderer,width,height){
  const altitude=s.radius-M.length(s.position);if(s.layoutVersion!==2||!s.collection||(s.cavityHaze<=0&&(s.atmosphere<=0||altitude<0)))return renderer.lightTexture;
  const gl=this.gl,n=M.norm(s.position),wound=SphereWorld.woundMetric(n,s);let rim=null,amount=s.atmosphere;
  if(wound.index>=0&&Math.abs(wound.km)<3000&&altitude>=0&&altitude<160){const key=[s.position.map(x=>Math.round(x)),s.radius].join('|');if(this.rimKey!==key){const near=SphereWorld.nearestRim(n,s);this.rim=SphereWorld.rimFrame(s,near.index,near.t);this.rimKey=key;}rim=this.rim;}
  const quality=s.weatherQuality??1,exporting=renderer.renderInfo.exportFrame,steps=exporting?Math.max(112,[48,80,128][quality]):[48,80,128][quality];
  const scale=Math.min(.5,Math.sqrt((exporting?1920*1080:1280*720)/(width*height))),vw=Math.max(1,Math.ceil(width*scale)),vh=Math.max(1,Math.ceil(height*scale));
  const air=amount>0&&altitude>=0,local=air&&altitude<160;if(air){if(local)this.program??=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.march);else this.farProgram??=SphereGLProgram(gl,SphereShaders.vertex,SphereVolume.far);this.noise();this.climate(s);}const program=air?(local?this.program:this.farProgram):this.dustProgram,u=program.u;
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);if(this.width!==width||this.height!==height){this.buffer(this.texture,8,width,height,gl.LINEAR);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Atmosphere composite buffer unavailable');this.width=width;this.height=height;}
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.volumeFbo);if(this.vw!==vw||this.vh!==vh){this.buffer(this.volumeLight,11,vw,vh,gl.NEAREST);this.buffer(this.volumeTrans,12,vw,vh,gl.NEAREST);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.volumeLight,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,this.volumeTrans,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Atmosphere volume buffer unavailable');this.vw=vw;this.vh=vh;}
  gl.viewport(0,0,vw,vh);gl.useProgram(program.p);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,renderer.depthTexture);gl.uniform1i(u.sceneDepth,6);gl.uniform1i(u.densityVolume,10);
  const b=M.basis(s.forward,s.up),id=SphereBiomes.region(n,s),p=profiles[id],rgb=SphereBiomes.catalog[id].haze,f=(k,v)=>gl.uniform1f(u[k],v),v=(k,a)=>gl.uniform3fv(u[k],a);
  gl.uniform1i(u.localAir,rim||!SphereCollection.missing(n,s)?1:0);gl.uniform1i(u.clipRim,rim?1:0);if(rim)gl.uniform4fv(u.rimPlane,[...rim.inland,M.dot(M.sub(s.position,M.mul(rim.point,s.radius)),rim.inland)]);
  // The depth texture uses the internal raster size, but its rays use the
  // output camera aspect. Fractional preview supersampling rounds each raster
  // dimension separately; that ratio is not the camera's ratio.
  v('cameraUp',M.mul(n,-1));v('forward',b.f);v('right',b.r);v('up',b.u);gl.uniform2f(u.resolution,width,height);f('rayAspect',renderer.renderInfo.width/renderer.renderInfo.height);f('radius',s.radius);f('height',altitude);f('fov',M.radians(s.fov));f('amount',amount);f('weather',s.weatherStrength);f('low',p.low);f('high',p.high);f('cloudScale',p.scale);f('cloudDensity',p.density);v('cloudTint',p.tint);
  v('hazeTint',s.biomeAtmosphere?[1,3,5].map(i=>Math.pow(parseInt(rgb.slice(i,i+2),16)/255,2.2)*.22):[.06,.12,.21]);v('fill',renderer.frameFill);f('direct',(local?(renderer.atmosphereCache.value??1):1)*s.luminosity*(M.AU/s.radius)**2);
  f('cavityHaze',s.cavityHaze??.28);f('stellarPower',s.luminosity*(M.AU/s.radius)**2);gl.uniform1i(u.steps,steps);
  gl.uniform3fv(u['macroPhase[0]'],SphereVolume.weatherScales.flatMap(scale=>s.position.map((x,j)=>((x/scale+s.time*(j===0?.002:j===2?.0007:0)/scale)%32+32)%32)));
  gl.uniform2fv(u['cloudEvolution[0]'],[43200,68400,108000].flatMap((period,j)=>{const angle=((s.time%period)/period+j*.27)*Math.PI*2;return [Math.cos(angle),Math.sin(angle)];}));
  gl.uniform1i(u.climateMap,7);gl.uniform1i(u.regionalTint,s.biomeAtmosphere?1:0);const worldFrame=SphereWorld.frame(s);v('climateAxis',worldFrame.axis);v('climateRight',worldFrame.right);v('climateUp',worldFrame.up);
  const plates=SphereCollection.plates(s),shadeNormals=new Float32Array(72),shadeRights=new Float32Array(72),shadeSizes=new Float32Array(72);
  plates.forEach((plate,i)=>{shadeNormals.set([...plate.normal,plate.damage],i*4);shadeRights.set([...plate.right,plate.id],i*4);const radius=M.length(plate.center);shadeSizes.set([plate.size*plate.across/radius,plate.size/radius,radius,0],i*4);});
  gl.uniform1i(u.weatherShadeCount,plates.length);gl.uniform4fv(u['weatherShadeNormal[0]'],shadeNormals);gl.uniform4fv(u['weatherShadeRight[0]'],shadeRights);gl.uniform4fv(u['weatherShadeSize[0]'],shadeSizes);gl.uniform1i(u.weatherShadeShape,['disk','square','cap','trimmed'].indexOf(s.shadeShape));f('weatherShadeTrim',s.shadeTrim);f('weatherStarAngle',s.starRadius/s.radius);
  f('weatherTime',s.time);gl.uniform1i(u.precipitation,['precipitation','storm'].includes(s.placeWeather)?1:0);gl.uniform1i(u.storm,s.placeWeather==='storm'?1:0);
  v('phase',s.position.map((v,i)=>((v/p.scale+s.time*(i===0?.002:i===2?.0007:0)/p.scale)%32+32)%32));gl.uniform1i(u.panorama,s.projection==='panorama'?1:0);gl.uniform1i(u.clouds,s.clouds?1:0);gl.uniform1i(u.spores,id===8?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,width,height);gl.useProgram(this.composite.p);const c=this.composite.u;
  for(const [unit,texture,name] of [[1,renderer.lightTexture,'source'],[6,renderer.depthTexture,'sceneDepth'],[11,this.volumeLight,'volumeLight'],[12,this.volumeTrans,'volumeTrans']]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(c[name],unit);}gl.uniform2f(c.volumeSize,vw,vh);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
  renderer.renderInfo.weather=air?(local?p.name:'Layered distant weather'):'Cavity dust';renderer.renderInfo.volume={steps,width:vw,height:vh,depthAware:true,cavityHaze:s.cavityHaze??.28,weatherLayers:air?3:0};return this.texture;
 }
 dispose(){const gl=this.gl;for(const t of [this.texture,this.volumeLight,this.volumeTrans,this.noiseTexture,this.climateTexture])if(t)gl.deleteTexture(t);gl.deleteFramebuffer(this.fbo);gl.deleteFramebuffer(this.volumeFbo);if(this.program)gl.deleteProgram(this.program.p);if(this.farProgram)gl.deleteProgram(this.farProgram.p);gl.deleteProgram(this.dustProgram.p);gl.deleteProgram(this.composite.p);}
}
window.SphereAtmosphere=Atmosphere;window.SphereWeatherProfiles=profiles;window.SphereWeatherClimate={pixels:climatePixels,coverage:regionalCoverage};
})();
