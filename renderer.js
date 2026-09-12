(function(){
 'use strict';const M=SphereMath;
 class Renderer {
  constructor(canvas){
   this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
   if(!this.gl)throw Error('WebGL 2 is unavailable. Open this app in Chrome or Edge with hardware acceleration enabled.');
   const gl=this.gl;this.maxSize=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);this.previewLight=window.SpherePreviewLight?new SpherePreviewLight():null;this.biomes=window.SphereBiomes?new SphereBiomes.Textures(gl):null;this.heroes=window.SphereBiomes?.HeroTextures?new SphereBiomes.HeroTextures(gl):null;this.timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.queries=[];this.gpuMs=null;this.atmosphereCache={};
   const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
   this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,SphereShaders.vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,SphereShaders.fragment));gl.linkProgram(this.program);
   if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
   gl.useProgram(this.program);this.uniforms={};
   for(let i=0;i<gl.getProgramParameter(this.program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(this.program,i);this.uniforms[info.name]=gl.getUniformLocation(this.program,info.name);}
   this.modernProgram=this.program;this.modernUniforms=this.uniforms;
   const data=new Uint8Array(2048*1024*4);let seed=23873;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<3800;i++){let x=Math.floor(random()*2048),lat=Math.asin(random()*2-1),y=Math.floor((lat/Math.PI+.5)*1024),j=(y*2048+x)*4;const bright=30+Math.floor(Math.pow(random(),3)*225);data[j]=bright;data[j+1]=bright;data[j+2]=bright;data[j+3]=255;}
   this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2048,1024,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   this.linearSupported=!!gl.getExtension('EXT_color_buffer_float');this.worldTextures=window.SphereWorldTextures?new SphereWorldTextures(gl):null;this.woundTextures=window.SphereWoundTextures?new SphereWoundTextures(gl):null;
   this.resolve=gl.createProgram();gl.attachShader(this.resolve,compile(gl.VERTEX_SHADER,SphereShaders.vertex));
   gl.attachShader(this.resolve,compile(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;
in vec2 vUV;out vec4 fragColor;uniform sampler2D source;uniform float exposure;uniform int edgeAA;
vec3 mapped(vec3 x){x*=exp2(exposure);x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
vec3 display(vec2 uv){if(edgeAA==0)return mapped(texture(source,uv).rgb);
 ivec2 size=textureSize(source,0);vec2 p=uv*vec2(size)-.5;ivec2 base=ivec2(floor(p));vec2 t=fract(p);ivec2 top=size-1;
 vec3 a=mapped(texelFetch(source,clamp(base,ivec2(0),top),0).rgb),b=mapped(texelFetch(source,clamp(base+ivec2(1,0),ivec2(0),top),0).rgb);
 vec3 c=mapped(texelFetch(source,clamp(base+ivec2(0,1),ivec2(0),top),0).rgb),d=mapped(texelFetch(source,clamp(base+ivec2(1,1),ivec2(0),top),0).rgb);
 return mix(mix(a,b,t.x),mix(c,d,t.x),t.y);
}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){vec3 center=mapped(texture(source,vUV).rgb);if(edgeAA==0){fragColor=vec4(center,1.);return;}
 vec2 px=1./vec2(textureSize(source,0));
 float nw=lum(display(vUV+vec2(-1.,-1.)*px)),ne=lum(display(vUV+vec2(1.,-1.)*px)),sw=lum(display(vUV+vec2(-1.,1.)*px)),se=lum(display(vUV+vec2(1.,1.)*px)),m=lum(center);
 float lo=min(m,min(min(nw,ne),min(sw,se))),hi=max(m,max(max(nw,ne),max(sw,se)));
 if(hi-lo<max(.025,hi*.12)){fragColor=vec4(center,1.);return;}
 vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));float reduce=max((nw+ne+sw+se)*.03125,.0078125);
 dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-4.),vec2(4.))*px;
 vec3 a=.5*(display(vUV+dir*(-1./6.))+display(vUV+dir*(1./6.)));
 vec3 b=a*.5+.25*(display(vUV-dir*.5)+display(vUV+dir*.5));float lb=lum(b);
 fragColor=vec4(lb<lo||lb>hi?a:b,1.);
}`));
   gl.linkProgram(this.resolve);if(!gl.getProgramParameter(this.resolve,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.resolve));
   this.resolveSource=gl.getUniformLocation(this.resolve,'source');this.resolveExposure=gl.getUniformLocation(this.resolve,'exposure');this.resolveEdge=gl.getUniformLocation(this.resolve,'edgeAA');
   const debug=gl.getExtension('WEBGL_debug_renderer_info');this.device=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   this.geometry=null;this.finishes=new SphereSurfaceFinishes(gl);this.localShadows=new SphereLocalShadows(gl);this.weather=window.SphereAtmosphere?new SphereAtmosphere(gl):null;
  }
  draw(s,width,height,{exportFrame=false,adaptiveScale=1,facePass=false}={}){
   SphereEdges.setView(width,{deterministic:exportFrame});
   if(!facePass&&s.projection==='panorama'&&s.layoutVersion===2&&s.collection&&s.geometryDetail&&window.SpherePanorama&&SphereSites.geometry(s).length){this.panorama??=new SpherePanorama(this.gl);this.pollTimers();return this.panorama.draw(this,s,width,height,{exportFrame,adaptiveScale});}
   if(!this.geometry&&window.SphereGeometryRenderer&&s.layoutVersion===2&&s.collection&&s.geometryDetail&&SphereSites.geometry(s).length)this.geometry=new SphereGeometryRenderer(this.gl);
   const gl=this.gl;const started=performance.now();if(!facePass)this.pollTimers();let timerQuery=null;if(this.timer&&!exportFrame&&!facePass&&this.queries.length<4){timerQuery=gl.createQuery();gl.beginQuery(this.timer.TIME_ELAPSED_EXT,timerQuery);}
   if(s.collection&&s.layoutVersion===2){this.program=this.modernProgram;this.uniforms=this.modernUniforms;}
   else if(window.SphereLegacyShaders){if(!this.legacyProgram){const compiled=SphereGLProgram(gl,SphereLegacyShaders.vertex,SphereLegacyShaders.fragment);this.legacyProgram=compiled.p;this.legacyUniforms=compiled.u;}this.program=this.legacyProgram;this.uniforms=this.legacyUniforms;}
   if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
   const diagnostic=['objectid','lightid','surfaceLight','distance','geographyid'].includes(s.viewMode),budget=(exportFrame?3840*2160*4:1920*1080*adaptiveScale*adaptiveScale)/(facePass?6:1),maxSize=this.maxSize;
   const factor=s.antialias>=2&&!diagnostic?Math.max(1,Math.min(2,Math.sqrt(budget/(width*height)),maxSize/width,maxSize/height)):1;
   const rw=Math.floor(width*factor),rh=Math.floor(height*factor),smooth=rw>width||rh>height;
   const linear=this.linearSupported&&(!s.viewMode||s.viewMode==='material'),silhouettes=linear&&s.antialias===3&&s.collection&&s.layoutVersion===2;
   if(linear){
    if(!this.lightBuffer){this.lightBuffer=gl.createFramebuffer();this.lightTexture=gl.createTexture();this.depthTexture=gl.createTexture();}
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.lightBuffer);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.lightTexture);
    if(this.lightWidth!==rw||this.lightHeight!==rh){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,rw,rh,0,gl.RGBA,gl.HALF_FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.lightTexture,0);
     gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.depthTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,rw,rh,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depthTexture,0);
     if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){this.linearSupported=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(timerQuery){gl.endQuery(this.timer.TIME_ELAPSED_EXT);gl.deleteQuery(timerQuery);}return this.draw(s,width,height,{exportFrame,adaptiveScale});}this.lightWidth=rw;this.lightHeight=rh;
    }
   }else if(smooth){
    if(!this.aaBuffer){this.aaBuffer=gl.createFramebuffer();this.aaColor=gl.createRenderbuffer();this.aaDepth=gl.createRenderbuffer();}
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.aaBuffer);
    if(this.aaWidth!==rw||this.aaHeight!==rh){gl.bindRenderbuffer(gl.RENDERBUFFER,this.aaColor);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,rw,rh);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,this.aaColor);gl.bindRenderbuffer(gl.RENDERBUFFER,this.aaDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,rw,rh);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.aaDepth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Antialiasing buffer unavailable. Choose Off.');this.aaWidth=rw;this.aaHeight=rh;}
   }else gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   if(silhouettes){
    this.silhouetteMask??=gl.createTexture();gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,this.silhouetteMask);
    if(this.maskWidth!==rw||this.maskHeight!==rh){gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,rw,rh,0,gl.RED,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.maskWidth=rw;this.maskHeight=rh;}
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,this.silhouetteMask,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
   }
   // The mask must not be bound for reading while attached for writing.
   gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,this.texture);
   this.renderInfo={width,height,internalWidth:rw,internalHeight:rh,antialias:linear&&s.antialias===3?(smooth?'supersampled + edge filter':'edge filter'):smooth?'supersampled':'none',lightPipeline:linear?'linear-half-float':'display-colour',exportFrame,silhouetteSamples:silhouettes?8:0,silhouetteMaskMiB:silhouettes?rw*rh/1048576:0};
   if(s.layoutVersion===2&&s.richMaterials!==false)this.finishes.prepare();
   const shadowGroups=this.geometry&&s.layoutVersion===2&&s.geometryDetail?SphereSites.geometry(s):[];
   this.localShadows.prepare(s,shadowGroups,mesh=>this.geometry.upload(mesh),{exportFrame});
   this.renderInfo.structureShadows=this.localShadows.info;
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.viewport(0,0,rw,rh);gl.useProgram(this.program);gl.uniform1i(this.uniforms.uLinearOutput,linear?1:0);
   this.finishes.bind(this.uniforms,s);this.localShadows.bind(this.uniforms,s);
   const f=(n,v)=>gl.uniform1f(this.uniforms[n],v),i=(n,v)=>gl.uniform1i(this.uniforms[n],v),v=(n,a)=>gl.uniform3fv(this.uniforms[n],a);
   const b=M.basis(s.forward,s.up),plate=M.shade(s),radius=M.length(s.position),n=M.norm(s.position);
   if(this.biomes){const B=SphereBiomes,alt=s.radius-radius;i('uBiomeOverride',s.biome??-1);i('uTextureDetail',s.textureDetail!==false?1:0);i('uBiomeAtm',s.biomeAtmosphere!==false?1:0);gl.uniform3fv(this.uniforms['uBiomeAnchor[0]'],B.anchors(n,s.radius));
    if(s.textureDetail!==false&&alt<2400){const hit=M.trace(s.position,s.forward,s);const id=B.region(hit.point?M.norm(hit.point):n,s);for(const index of [id,(id+1)%10,B.region(n,s),s.era==='after'?4:5])this.biomes.request(index);}
    this.biomes.upload();this.biomes.bind(this.uniforms,exportFrame);
    if(this.heroes){i('uSurfaceRelief',s.surfaceRelief!==false?1:0);v('uHeroAnchor',B.heroAnchors(n,s.radius));
     if(s.textureDetail!==false&&alt<2400){const hit=M.trace(s.position,s.forward,s),id=B.region(hit.point?M.norm(hit.point):n,s);for(const index of [id,(id+1)%10,B.region(n,s)])this.heroes.request(index);}
     if(s.textureDetail!==false&&s.geometryDetail&&s.siteId?.startsWith('exterior-'))for(const id of [0,3,4,5,7])this.heroes.request(id);
     this.heroes.upload();this.heroes.bind(this.uniforms,exportFrame);
    }
   }
   const atmKey=[n.join(','),s.time,s.radius,s.starRadius,s.collection,s.shadeEnabled,s.shadeAltitude,s.shadeDiameter,s.shadeOffset,s.shadeDamage,s.shadeSpeed,s.era,s.routeShades,s.starStation,s.cycleScale,s.shadeShape,s.shadeTrim,s.stationSamples,s.layoutVersion,s.axisLat,s.axisLon,s.waistWidth].join('|');
   if(s.atmosphere>0&&s.radius-radius<160){if(this.atmosphereCache.key!==atmKey){this.atmosphereCache={key:atmKey,value:M.sunVisibility(M.mul(n,s.radius),s,s.stationSamples||64)};}f('uAtmosphereLight',this.atmosphereCache.value);}else f('uAtmosphereLight',1);
   const indirect=s.collection&&s.shineField?(exportFrame||!this.previewLight?SphereCollection.cavity(s):this.previewLight.sample(s)):[0,0,0];this.frameFill=s.shineField?indirect.map(v=>v*s.shellshine*4):[s.shellshine,s.shellshine,s.shellshine];
   gl.uniform2f(this.uniforms.uResolution,width,height);gl.uniform2f(this.uniforms.uRasterSize,rw,rh);i('uSilhouetteSamples',silhouettes?8:0);i('uAAPass',0);i('uAAMask',13);gl.uniform2f(this.uniforms.uAAOffset,0,0);v('uN',n);v('uForward',b.f);v('uRight',b.r);v('uUp',b.u);
   const anchor=[];for(const scale of [1000000,100000,10000,1000,100,10,1,.1,.01,.001])for(const value of n)anchor.push(((value*s.radius/scale)%256+256)%256);gl.uniform3fv(this.uniforms['uAnchor[0]'],anchor);
   f('uBreachRoughness',s.breachRoughness||0);i('uStyle',s.surfaceStyle==='legacy'?0:1);
   f('uH',(s.radius-radius)/s.radius);f('uRadius',s.radius);f('uStar',s.starRadius/s.radius);f('uLuminosity',s.luminosity*Math.pow(M.AU/s.radius,2));f('uFov',M.radians(s.fov));f('uExposure',s.exposure);f('uShine',s.shellshine);f('uAtm',s.atmosphere);f('uSeed',s.seed);
   v('uBreachAxis',M.axis(s.breachLat,s.breachLon));f('uBreachChord',2*Math.sin(s.breachDiameter/(4*s.radius)));i('uBreach',+s.breachEnabled);
   v('uPlateRelative',M.mul(M.sub(plate.center,s.position),1/s.radius));v('uPlateWorld',M.mul(plate.center,1/s.radius));f('uPlateRadius',plate.radius/s.radius);f('uDamage',s.shadeDamage);i('uShade',+s.shadeEnabled);
   i('uGrid',+s.grid);i('uMode',s.viewMode==='geographyid'?6:s.viewMode==='surfaceLight'?5:s.viewMode==='coverageid'?4:s.viewMode==='lightid'?3:s.viewMode==='objectid'?2:s.viewMode==='distance'?1:0);i('uPanorama',s.projection==='panorama'?1:0);i('uStars',+s.starfield);i('uStarTex',0);
   if(window.SphereCollection)SphereCollection.upload(gl,this.uniforms,s,indirect);
   if(window.SphereWorld)SphereWorld.upload(gl,this.uniforms,s);
   if(this.worldTextures){if(s.layoutVersion===2&&!this.worldTextures.started)this.worldTextures.prepare().catch(e=>console.warn(e.message));this.worldTextures.bind(this.uniforms);}
   if(this.woundTextures){this.woundTextures.requestFor(s);this.woundTextures.upload();this.woundTextures.bind(this.uniforms,exportFrame);}
   gl.bindVertexArray(null);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.ALWAYS);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
   if(silhouettes){
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,null,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,this.silhouetteMask);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE);i('uAAPass',1);
    for(const offset of SphereSilhouetteOffsets){gl.uniform2fv(this.uniforms.uAAOffset,offset);gl.drawArrays(gl.TRIANGLES,0,3);}
    gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);i('uAAPass',0);gl.uniform2f(this.uniforms.uAAOffset,0,0);gl.activeTexture(gl.TEXTURE0);
   }
   this.geometry?.draw(s,this,linear,rw,rh);gl.disable(gl.DEPTH_TEST);
   if(linear){const image=this.weather?this.weather.draw(s,this,rw,rh):this.lightTexture;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.useProgram(this.resolve);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,image);gl.uniform1i(this.resolveSource,1);gl.uniform1f(this.resolveExposure,s.exposure);gl.uniform1i(this.resolveEdge,s.antialias===3?1:0);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);}
   else if(smooth){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.aaBuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,rw,rh,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.LINEAR);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
   if(timerQuery){gl.endQuery(this.timer.TIME_ELAPSED_EXT);this.queries.push(timerQuery);}
   this.cpuMs=performance.now()-started;this.renderInfo.cpuMs=this.cpuMs;this.renderInfo.gpuMs=this.gpuMs;
   this.renderInfo.indirectLight=exportFrame?'exact frame':this.previewLight?.worker?'worker, at most 10 Hz':'cached CPU';
   this.renderInfo.indirectSampleTime=exportFrame?s.time:this.previewLight?.sampleTime;
   if(this.heroes)this.renderInfo.heroTextures={ready:this.heroes.status.filter(x=>x==='ready').length,total:10,gpuMiB:this.heroes.allocated?79.96:0,tileKm:SphereBiomes.heroScale};
   if(this.woundTextures)this.renderInfo.woundTextures=this.woundTextures.info;
   if(this.biomes)this.renderInfo.textures={ready:this.biomes.status.filter(x=>x==='ready').length,total:10,gpuMiB:40,scalesKm:SphereBiomes.scales};
  }
  pollTimers(){const gl=this.gl;if(!this.timer)return;const disjoint=gl.getParameter(this.timer.GPU_DISJOINT_EXT);
   while(this.queries.length){const q=this.queries[0];if(!disjoint&&!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;this.queries.shift();if(!disjoint)this.gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}
   if(disjoint)this.gpuMs=null;
  }
  dispose(){if(this.silhouetteMask)this.gl.deleteTexture(this.silhouetteMask);this.previewLight?.dispose();this.heroes?.dispose();this.worldTextures?.dispose();this.woundTextures?.dispose();this.finishes?.dispose();this.localShadows?.dispose();this.geometry?.dispose();this.weather?.dispose();this.panorama?.dispose();for(const q of this.queries)this.gl.deleteQuery(q);this.queries=[];}
  async prepare(s){if(s.layoutVersion===2&&this.worldTextures)await this.worldTextures.prepare();if(this.biomes&&s.textureDetail!==false&&s.radius-M.length(s.position)<2400){await this.biomes.prepare();if(this.heroes&&s.radius-M.length(s.position)<2400)await this.heroes.prepare();if(s.layoutVersion===2&&s.collection&&s.era==='after'&&s.multipleWounds)await this.woundTextures?.prepare();}}
  get needsFrame(){return !!(this.biomes&&(this.biomes.fading||this.biomes.pending.length||this.heroes?.fading||this.heroes?.pending.length)||this.woundTextures?.fading||this.woundTextures?.pending.length);}
  error(){return this.gl.getError();}
 }
 window.SphereRenderer=Renderer;
 // Uncompressed ZIP: a photograph and its complete scene travel as one download.
 const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
 function crc(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 function zip(files){const enc=new TextEncoder(),parts=[],directory=[];let offset=0,dirSize=0;
  for(const [name,bytes] of files){const fn=enc.encode(name),c=crc(bytes),head=new Uint8Array(30+fn.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,c,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,fn.length,true);head.set(fn,30);parts.push(head,bytes);
   const cd=new Uint8Array(46+fn.length),d=new DataView(cd.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,c,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,fn.length,true);d.setUint32(42,offset,true);cd.set(fn,46);directory.push(cd);dirSize+=cd.length;offset+=head.length+bytes.length;}
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,dirSize,true);e.setUint32(16,offset,true);return new Blob([...parts,...directory,end],{type:'application/zip'});
 }
 window.SphereZip=zip;
})();
