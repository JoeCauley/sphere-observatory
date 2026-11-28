(function(){
 'use strict';const M=SphereMath;
 class Renderer {
  static async prepareMain(canvas){
   const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
   if(!gl)return null;
   const program=gl.createProgram();
   const fragment=window.SphereBiomeSurface && window.SphereAtlas
    ? SphereBiomeSurface.assemble(SphereShaders.fragment,SphereAtlas) : SphereShaders.fragment;
   for(const [type,source] of [[gl.VERTEX_SHADER,SphereShaders.vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(program,shader);gl.deleteShader(shader);
   }
   gl.linkProgram(program);
   const parallel=gl.getExtension('KHR_parallel_shader_compile');
   if(parallel)while(!gl.getProgramParameter(program,parallel.COMPLETION_STATUS_KHR)){
    if(gl.isContextLost())throw Error('The graphics context was lost while opening. Retry to reopen the view.');
    await new Promise(resolve=>setTimeout(resolve,32));
   }
   return program;
  }
  constructor(canvas,preparedProgram){
   this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
   if(!this.gl)throw Error('WebGL 2 is unavailable. Open this app in Chrome or Edge with hardware acceleration enabled.');
   const gl=this.gl;
   try{
   // Own the final quantization: driver dithering introduced intermittent
   // one-level differences when revisiting identical paused weather frames.
   gl.disable(gl.DITHER);
   this.maxSize=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);this.previewLight=window.SpherePreviewLight?new SpherePreviewLight():null;this.biomes=window.SphereBiomes?new SphereBiomes.Textures(gl):null;this.heroes=window.SphereBiomes?.HeroTextures?new SphereBiomes.HeroTextures(gl):null;this.timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.queries=[];this.gpuMs=null;this.atmosphereCache={};
   const compile=(type,src)=>{const sh=gl.createShader(type);try{gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}catch(error){gl.deleteShader(sh);throw error;}};
   const attach=(program,type,src)=>{const sh=compile(type,src);try{gl.attachShader(program,sh);}finally{gl.deleteShader(sh);}};
   this.program=preparedProgram||gl.createProgram();if(!preparedProgram){attach(this.program,gl.VERTEX_SHADER,SphereShaders.vertex);attach(this.program,gl.FRAGMENT_SHADER,SphereShaders.fragment);gl.linkProgram(this.program);}
   if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
   gl.useProgram(this.program);this.uniforms={};
   for(let i=0;i<gl.getProgramParameter(this.program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(this.program,i);this.uniforms[info.name]=gl.getUniformLocation(this.program,info.name);}
   this.modernProgram=this.program;this.modernUniforms=this.uniforms;
   if(this.uniforms.uInstalledBiomes)gl.uniform1i(this.uniforms.uInstalledBiomes,5);
   const data=new Uint8Array(2048*1024*4);let seed=23873;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<3800;i++){let x=Math.floor(random()*2048),lat=Math.asin(random()*2-1),y=Math.floor((lat/Math.PI+.5)*1024),j=(y*2048+x)*4;const bright=30+Math.floor(Math.pow(random(),3)*225);data[j]=bright;data[j+1]=bright;data[j+2]=bright;data[j+3]=255;}
   this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2048,1024,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   this.linearSupported=!!gl.getExtension('EXT_color_buffer_float');this.worldTextures=window.SphereWorldTextures?new SphereWorldTextures(gl):null;this.woundTextures=window.SphereWoundTextures?new SphereWoundTextures(gl):null;
   this.resolve=gl.createProgram();attach(this.resolve,gl.VERTEX_SHADER,SphereShaders.vertex);
   attach(this.resolve,gl.FRAGMENT_SHADER,`#version 300 es
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
}`);
   gl.linkProgram(this.resolve);if(!gl.getProgramParameter(this.resolve,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.resolve));
   this.resolveSource=gl.getUniformLocation(this.resolve,'source');this.resolveExposure=gl.getUniformLocation(this.resolve,'exposure');this.resolveEdge=gl.getUniformLocation(this.resolve,'edgeAA');
   const debug=gl.getExtension('WEBGL_debug_renderer_info');this.device=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    this.preparedViews=new Set();this.geometry=null;this.environment=window.SphereInstancedEnvironment?new SphereInstancedEnvironment.InstancedEnvironmentPass(gl):null;this.grass=window.SphereGrass?new SphereGrass.GrassStreamManager():null;this.meadow=window.SphereMeadow?new SphereMeadow.EndlessMeadow():null;this.meadowGround=window.SphereMeadowCanopy?new SphereMeadowCanopy.GroundField(gl,this.texture):null;this.finishes=new SphereSurfaceFinishes(gl);this.localShadows=new SphereLocalShadows(gl);this.weather=window.SphereAtmosphere?new SphereAtmosphere(gl):null;
   }catch(error){try{this.dispose();}catch(cleanupError){error.cleanupError=cleanupError;error.renderer=this;}throw error;}
  }
  // Service/slot lifetimes stay outside saved scenes and worker state clones.
  setBiomeOverview(owner){
   if(this.disposalStarted)throw Error('The renderer is being disposed.');
   if(!window.SphereBiomeMainOverview?.isOwner(owner)||!owner.usesRenderer(this))throw Error('Foreign installed overview owner');
   this.biomeOverview=owner;
  }
  // Neutral overlay hook: any owner that supplies a substitute surface program and
  // sets its own uniforms around the shell draw. Shares the overview slot above.
  setSurfaceOverlay(owner){
   if(this.disposalStarted)throw Error('The renderer is being disposed.');
   if(!owner||typeof owner.programFor!=='function'||typeof owner.withFrame!=='function'||typeof owner.inspect!=='function'||owner.usesRenderer?.(this)!==true)throw Error('A surface overlay owner for this renderer is required');
   this.biomeOverview=owner;
  }
  clearBiomeOverview(owner){if(this.biomeOverview!==owner)return false;this.biomeOverview=null;this.program=this.modernProgram;this.uniforms=this.modernUniforms;return true;}
  setBiomeLocal(owner){if(!window.SphereBiomeMainLocalSupportV6?.isOwner(owner)||!owner.usesRenderer(this))throw Error('The actual source-owned Main local view is required');if(this.biomeLocal&&this.biomeLocal!==owner)throw Error('Retire the previous Main local view first');this.biomeLocal=owner;window.SphereMainSurfaceSlot?.attach(owner,this);}
  clearBiomeLocal(owner){if(this.biomeLocal!==owner)return false;if(owner.isActive())throw Error('Leave the local view before clearing its renderer');window.SphereMainSurfaceSlot?.clear(owner);this.biomeLocal=null;return true;}
  lockUniformFrame(owner){if(!window.SphereBiomeMainLocalMaterialV2?.isOwner(owner)||!owner.usesRenderer(this)||this.uniformFrameLock&&this.uniformFrameLock!==owner||this.prepareControllers?.size)throw Error('The exact settled Main material owner is required for a uniform hold');this.uniformFrameLock=owner;}
  unlockUniformFrame(owner){if(this.uniformFrameLock===owner){this.uniformFrameLock=null;window.SphereApp?.draw();}}
  setVegetationPopulation(population=null){
   if(this.disposalStarted)throw Error('The renderer is being disposed.');
   if(population&&(population.coordinateSpace!=='vegetation-chart'||!population.service||!Array.isArray(population.handles)))throw Error('Invalid runtime vegetation population');
   const previous=this.vegetationPopulation?.service;if(previous&&previous!==population?.service)this.vegetationPopulation.lifecycle?.dispose();if(previous&&previous!==population?.service&&previous.gpuBackend?.owningPass===this.environment)previous.gpuBackend.dispose();
   previous?.collectRetired();this.vegetationPopulation=population;
  }
  uploadFrameUniforms(s,width,height,{rw,rh,linear,silhouettes,exportFrame=false}){
   const gl=this.gl;
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.viewport(0,0,rw,rh);gl.useProgram(this.program);gl.uniform1i(this.uniforms.uLinearOutput,linear?1:0);
   this.finishes.bind(this.uniforms,s);this.localShadows.bind(this.uniforms,s);
   const f=(n,v)=>gl.uniform1f(this.uniforms[n],v),i=(n,v)=>gl.uniform1i(this.uniforms[n],v),v=(n,a)=>gl.uniform3fv(this.uniforms[n],a);
   const b=M.basis(s.forward,s.up),plate=M.shade(s),radius=M.length(s.position),n=M.norm(s.position);
   if(this.biomes){const B=SphereBiomes,alt=s.radius-radius;i('uBiomeOverride',s.biome??-1);i('uTextureDetail',s.textureDetail!==false?1:0);i('uBiomeAtm',s.biomeAtmosphere!==false?1:0);gl.uniform3fv(this.uniforms['uBiomeAnchor[0]'],B.anchors(n,s.radius));
    this.biomes.upload();this.biomes.bind(this.uniforms,exportFrame);
    if(this.heroes){i('uSurfaceRelief',s.surfaceRelief!==false?1:0);v('uHeroAnchor',B.heroAnchors(n,s.radius));
     this.heroes.upload();this.heroes.bind(this.uniforms,exportFrame);
    }
   }
   const atmKey=[n.join(','),s.time,s.radius,s.starRadius,s.collection,s.shadeEnabled,s.shadeAltitude,s.shadeDiameter,s.shadeOffset,s.shadeDamage,s.shadeSpeed,s.era,s.routeShades,s.starStation,s.cycleScale,s.shadeShape,s.shadeTrim,s.shadeFractureRevision,s.seed,s.stationSamples,s.layoutVersion,s.axisLat,s.axisLon,s.waistWidth].join('|');
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
   window.SphereVioletForest?.bindFork?.(gl,this.uniforms,s,n);
   if(window.SphereWorld)SphereWorld.upload(gl,this.uniforms,s);this.meadowGround?.bind(this.uniforms,s);this.renderInfo.meadowGround=this.meadowGround?.info;
   if(this.worldTextures){this.worldTextures.upload();this.worldTextures.bind(this.uniforms);}
   if(this.woundTextures){this.woundTextures.upload();this.woundTextures.bind(this.uniforms,exportFrame);}
  }
  withUniformFrame(s,layout,hostProgram,callback){
   if(this.disposalStarted||typeof callback!=='function'||callback.constructor.name==='AsyncFunction')throw Error('One synchronous live Main uniform frame required');
   const installed=s.collection&&s.layoutVersion===2?this.biomeOverview?.programFor(s):null,program=installed?.program??this.modernProgram,uniforms=installed?.uniforms??this.modernUniforms;
   if(program!==hostProgram)throw Error('The source-admitted actual Main program changed');
   const gl=this.gl,prior={program:this.program,uniforms:this.uniforms,renderInfo:this.renderInfo,frameFill:this.frameFill,atmosphereCache:this.atmosphereCache,glProgram:gl.getParameter(gl.CURRENT_PROGRAM),active:gl.getParameter(gl.ACTIVE_TEXTURE),viewport:Array.from(gl.getParameter(gl.VIEWPORT))};
   try{this.program=program;this.uniforms=uniforms;this.renderInfo={};this.uploadFrameUniforms(s,layout.width,layout.height,layout);const result=callback();if(result!==null&&(typeof result==='object'||typeof result==='function'))throw Error('Main uniform frame did not settle synchronously');return result;}
   finally{this.program=prior.program;this.uniforms=prior.uniforms;this.renderInfo=prior.renderInfo;this.frameFill=prior.frameFill;this.atmosphereCache=prior.atmosphereCache;gl.useProgram(prior.glProgram);gl.activeTexture(prior.active);gl.viewport(...prior.viewport);}
  }
  frameLayout(s,width,height,{exportFrame=false,adaptiveScale=1,facePass=false}={}){
   if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Exact full output viewport required');
   const diagnostic=['objectid','lightid','surfaceLight','distance','geographyid'].includes(s.viewMode),budget=(exportFrame?3840*2160*4:1920*1080*adaptiveScale*adaptiveScale)/(facePass?6:1),factor=s.antialias>=2&&!diagnostic?Math.max(1,Math.min(2,Math.sqrt(budget/(width*height)),this.maxSize/width,this.maxSize/height)):1,rw=Math.floor(width*factor),rh=Math.floor(height*factor),linear=this.linearSupported&&(!s.viewMode||s.viewMode==='material');
   return {width,height,rw,rh,smooth:rw>width||rh>height,linear,silhouettes:linear&&s.antialias===3&&s.collection&&s.layoutVersion===2,antialias:s.antialias,exportFrame,adaptiveScale,facePass};
  }
  draw(s,width,height,{exportFrame=false,adaptiveScale=1,facePass=false}={}){
   if(this.disposalStarted)throw Error('The renderer is being disposed.');
   if(this.gl.isContextLost())throw Error('The graphics context was interrupted. Reload the page to restore the view.');
   if(this.uniformFrameLock||this.biomeLocal?.holdsMainFrame?.())return this.renderInfo;
   if(this.biomeLocal?.isActive()){
    const layout=this.frameLayout(s,width,height,{exportFrame,adaptiveScale,facePass});
    if(!this.biomeLocal.matches(s,layout)){if(!this.nativeViewHeld){this.nativeViewHeld=true;window.dispatchEvent(new CustomEvent('sphere-native-view-held',{detail:{reason:'The local inspection needs preparation for the changed view. Use Return to leave it.'}}));}return this.renderInfo;}
    this.nativeViewHeld=false;
   }
   const frameStarted=performance.now();
   const frameId=this.drawFrameId=(this.drawFrameId||0)+1;
   SphereEdges.setView(width,{deterministic:exportFrame});
   if(!exportFrame&&window.SphereEdgeStreaming){
    if(!s.geometryDetail||s.layoutVersion!==2||!s.collection)SphereEdgeStreaming.cancel();
    else if(SphereEdgeStreaming.needsFrame && !this.geometryPreparation){this.geometry??=new SphereGeometryRenderer(this.gl);SphereEdgeStreaming.pump((mesh,budget)=>this.geometry.stage(mesh,budget));}
   }
   if(!facePass&&s.projection==='panorama'&&s.layoutVersion===2&&s.collection&&s.geometryDetail&&window.SpherePanorama&&SphereSites.geometry(s).length){this.panorama??=new SpherePanorama(this.gl);this.pollTimers();const result=this.panorama.draw(this,s,width,height,{exportFrame,adaptiveScale});this.preparedViews.add(SphereAssets.pipelineKey(s,SphereAssets.plan(s,width/height)));return result;}
   const stationState=s;
   if(window.SpherePlaces)s=SpherePlaces.renderState(s);
   if(!this.geometry&&!this.geometryPreparation&&window.SphereGeometryRenderer&&s.layoutVersion===2&&s.collection&&s.geometryDetail&&SphereSites.geometry(s).length)this.geometry=new SphereGeometryRenderer(this.gl);
   const gl=this.gl;const started=performance.now();if(!facePass)this.pollTimers();let timerQuery=null;if(this.timer&&!exportFrame&&!facePass&&this.queries.length<4){timerQuery=gl.createQuery();gl.beginQuery(this.timer.TIME_ELAPSED_EXT,timerQuery);}
   try{
   const installedOverview=this.biomeOverview,installedProgram=s.collection&&s.layoutVersion===2?installedOverview?.programFor(s):null;
   if(s.collection&&s.layoutVersion===2){this.program=installedProgram?.program??this.modernProgram;this.uniforms=installedProgram?.uniforms??this.modernUniforms;}
    else if(window.SphereLegacyShaders){if(!this.legacyProgram){const compiled=SphereGLProgram(gl,SphereLegacyShaders.vertex,SphereLegacyShaders.fragment);this.legacyProgram=compiled.p;this.legacyUniforms=compiled.u;}this.program=this.legacyProgram;this.uniforms=this.legacyUniforms;}
   if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
   const {rw,rh,smooth,linear,silhouettes}=this.frameLayout(s,width,height,{exportFrame,adaptiveScale,facePass});
   if(linear){
    if(!this.lightBuffer){this.lightBuffer=gl.createFramebuffer();this.lightTexture=gl.createTexture();this.depthTexture=gl.createTexture();}
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.lightBuffer);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.lightTexture);
    if(this.lightWidth!==rw||this.lightHeight!==rh){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,rw,rh,0,gl.RGBA,gl.HALF_FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.lightTexture,0);
     gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.depthTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,rw,rh,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depthTexture,0);
     if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){this.linearSupported=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return this.draw(s,width,height,{exportFrame,adaptiveScale,facePass});}this.lightWidth=rw;this.lightHeight=rh;
    }
    // Check weather attachments before drawing the shell, once the linear pipeline is available.
    if(this.weather?.prepareTargets?.(s,rw,rh,exportFrame))gl.bindFramebuffer(gl.FRAMEBUFFER,this.lightBuffer);
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
   this.renderInfo={windPhaseSeconds:window.SphereMeadowWind?.active(s)?SphereMeadowWind.phase(s):null,windTimelineRevision:s.meadow?.windTimelineRevision||0,width,height,internalWidth:rw,internalHeight:rh,antialias:linear&&s.antialias===3?(smooth?'supersampled + edge filter':'edge filter'):smooth?'supersampled':'none',lightPipeline:linear?'linear-half-float':'display-colour',exportFrame,silhouetteSamples:silhouettes?8:0,silhouetteMaskMiB:silhouettes?rw*rh/1048576:0};
   this.meadowGround?.request(s);const assetPlan=SphereAssets.plan(s,width/height);SphereAssets.request(this,assetPlan);if(assetPlan.finishes)this.finishes.prepare();
   const shadowGroups=this.geometry&&s.layoutVersion===2&&s.geometryDetail?SphereSites.geometry(s):[];
   this.localShadows.prepare(s,shadowGroups,mesh=>this.geometry.upload(mesh),{exportFrame,target:linear?this.lightBuffer:smooth?this.aaBuffer:null,viewport:[0,0,rw,rh]});
   this.renderInfo.structureShadows=this.localShadows.info;
   this.uploadFrameUniforms(s,width,height,{rw,rh,linear,silhouettes,exportFrame});
   gl.bindVertexArray(null);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.ALWAYS);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
   const i=(name,value)=>gl.uniform1i(this.uniforms[name],value);
   const drawShell=()=>{gl.drawArrays(gl.TRIANGLES,0,3);
   if(silhouettes){
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,null,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,this.silhouetteMask);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE);i('uAAPass',1);
    for(const offset of SphereSilhouetteOffsets){gl.uniform2fv(this.uniforms.uAAOffset,offset);gl.drawArrays(gl.TRIANGLES,0,3);}
    gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);i('uAAPass',0);gl.uniform2f(this.uniforms.uAAOffset,0,0);gl.activeTexture(gl.TEXTURE0);
   }
   };
   if(installedProgram){installedOverview.withFrame(s,this.uniforms,drawShell);this.renderInfo.installedOverview=installedOverview.inspect();}else drawShell();
    const nativeLocalDrawn=this.biomeLocal?.isActive()?this.biomeLocal.draw(s,this.frameLayout(s,width,height,{exportFrame,adaptiveScale,facePass})):false;
    if(nativeLocalDrawn)this.renderInfo.nativeBiomeLocal=this.biomeLocal.frameInfo();
    if(!nativeLocalDrawn){
    this.geometry?.draw(s,this,linear,rw,rh);
    let environmentPopulation=this.vegetationPopulation||s.instancedEnvironment?.population||null,meadowResidentPopulation=null,environmentFrameDiagnostics=null;const meadowConfig=s.meadow||s.instancedEnvironment?.meadow;const grassConfig=s.grass||s.instancedEnvironment?.grass;
    if(this.meadow&&meadowConfig?.enabled){const runtimePopulation=environmentPopulation?.coordinateSpace==='vegetation-chart'&&environmentPopulation.service?.providers.has(window.SphereMeadowProvider?.ID)?environmentPopulation:null;if(runtimePopulation&&SphereVegetationRevisions.resourceKey(SphereVegetationRevisions.describe(runtimePopulation.service.current.get(SphereMeadowProvider.ID)?.value.state))!==SphereVegetationRevisions.resourceKey(SphereVegetationRevisions.describe({...s,meadow:meadowConfig})))throw Error('Runtime Meadow population belongs to another scene');const meadowPopulation=runtimePopulation?SphereMeadow.createGpuPopulation(runtimePopulation.service,{...s,meadow:meadowConfig},runtimePopulation.handles,{prototypes:runtimePopulation.prototypes,culling:runtimePopulation.culling,maxUploadBytesPerFrame:runtimePopulation.maxUploadBytesPerFrame,diagnostic:runtimePopulation.diagnostic,lifecycle:runtimePopulation.lifecycle,productionSelection:runtimePopulation.productionSelection}):this.meadow.request({...s,meadow:meadowConfig},{internalWidth:rw,capture:exportFrame});if(runtimePopulation)environmentPopulation=null;if(['resident-chart','vegetation-chart'].includes(meadowPopulation.coordinateSpace))meadowResidentPopulation=meadowPopulation;else environmentPopulation=environmentPopulation?{...environmentPopulation,prototypes:[...(environmentPopulation.prototypes||[]),...meadowPopulation.prototypes],patches:[...(environmentPopulation.patches||[]),...meadowPopulation.patches],windTime:meadowPopulation.windTime,windStrength:meadowPopulation.windStrength,diagnostic:meadowConfig.diagnostic}: {...meadowPopulation,diagnostic:meadowConfig.diagnostic};if(!meadowResidentPopulation?.service)this.renderInfo.meadow={...this.meadow.info,diagnostic:meadowConfig.diagnostic||null};}
    if(this.grass&&grassConfig?.enabled&&!meadowConfig?.enabled){this.grass.options={...this.grass.options,...grassConfig};const grassPopulation=this.grass.request({...s,grass:grassConfig});environmentPopulation=environmentPopulation?{...environmentPopulation,prototypes:[...(environmentPopulation.prototypes||[]),...grassPopulation.prototypes],patches:[...(environmentPopulation.patches||[]),...grassPopulation.patches],windTime:grassPopulation.windTime,windStrength:grassPopulation.windStrength}:grassPopulation;this.renderInfo.grass={...this.grass.info};}
    if(this.environment&&s.instancedEnvironment?.enabled!==false&&environmentPopulation){this.environment.draw(s,environmentPopulation,rw,rh,{linear,exportFrame,measureGpu:false,renderer:this});environmentFrameDiagnostics={...this.environment.diagnostics};this.renderInfo.instancedEnvironment=environmentFrameDiagnostics;}
    if(this.environment&&s.instancedEnvironment?.enabled!==false&&meadowResidentPopulation){this.environment.draw(s,meadowResidentPopulation,rw,rh,{linear,exportFrame,measureGpu:false,renderer:this});if(meadowResidentPopulation.coordinateSpace==='resident-chart')this.meadow.commitResident(this.environment.diagnostics.committedTargetSignature);const meadowInfo=meadowResidentPopulation.service?.info;this.renderInfo.meadow=meadowInfo?{...meadowInfo,fixedBlades:meadowInfo.retainedDetailedRecords,fixedBytes:meadowInfo.retainedBackingBytes,fixedCells:meadowResidentPopulation.service.allocations.size,queue:meadowInfo.queue+meadowInfo.workers,diagnostic:meadowConfig.diagnostic||null}:{...this.meadow.info,diagnostic:meadowConfig.diagnostic||null};this.renderInfo.instancedEnvironment={...this.environment.diagnostics};if(environmentFrameDiagnostics){for(const field of ['drawCalls','instances','triangles','frameUploadedBytes','frameInstanceUploadBytes','framePrototypeUploadBytes','frameReferenceUploadBytes'])this.renderInfo.instancedEnvironment[field]=(this.renderInfo.instancedEnvironment[field]||0)+(environmentFrameDiagnostics[field]||0);}}
    }
   this.renderInfo.borderEnvironment=null;
   this.renderInfo.walkingStation=!facePass?window.SphereStageFrame?.drawWalkingStation?.(stationState,rw,rh,linear,this.renderInfo,linear?this.lightBuffer:smooth?this.aaBuffer:null):null;
   gl.disable(gl.DEPTH_TEST);
   if(linear){const image=this.weather?this.weather.draw(s,this,rw,rh):this.lightTexture;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.useProgram(this.resolve);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,image);gl.uniform1i(this.resolveSource,1);gl.uniform1f(this.resolveExposure,s.exposure);gl.uniform1i(this.resolveEdge,s.antialias===3?1:0);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);}
   else if(smooth){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.aaBuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,rw,rh,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.LINEAR);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
    if(timerQuery){gl.endQuery(this.timer.TIME_ELAPSED_EXT);this.timerFrameIds??=new WeakMap();this.timerFrameIds.set(timerQuery,frameId);this.queries.push(timerQuery);timerQuery=null;}
   // Export callers immediately read the canvas (toBlob/toDataURL). Complete
   // the GPU resolve before handing the frame to the browser's image encoder.
   if(exportFrame)gl.finish();
   this.cpuMs=performance.now()-started;this.renderInfo.cpuMs=this.cpuMs;this.renderInfo.gpuMs=this.gpuMs;this.renderInfo.fullDrawCpuMs=performance.now()-frameStarted;this.renderInfo.geometryWork=this.geometry?.work||null;
   this.renderInfo.indirectLight=exportFrame?'exact frame':this.previewLight?.worker?'worker, at most 10 Hz':'cached CPU';
   this.renderInfo.indirectSampleTime=exportFrame?s.time:this.previewLight?.sampleTime;
   if(this.heroes)this.renderInfo.heroTextures={ready:this.heroes.status.filter(x=>x==='ready').length,total:10,gpuMiB:this.heroes.allocated?79.96:0,tileKm:SphereBiomes.heroScale};
   if(this.woundTextures)this.renderInfo.woundTextures=this.woundTextures.info;
    this.renderInfo.assets=SphereAssets.status(this,assetPlan);this.preparedViews.add(SphereAssets.pipelineKey(s,assetPlan));
    this.presentedDetailRevision=this.detailRevision;
   if(this.biomes)this.renderInfo.textures={ready:this.biomes.status.filter(x=>x==='ready').length,total:10,gpuMiB:this.biomes.allocated?40:0,scalesKm:SphereBiomes.scales};
  }finally{
   if(timerQuery){try{gl.endQuery(this.timer.TIME_ELAPSED_EXT);}catch{}gl.deleteQuery(timerQuery);timerQuery=null;}
  }
  }
  pollTimers(){const gl=this.gl;this.environment?.poll();this.gpuTimerSamples=[];if(!this.timer)return;const disjoint=gl.getParameter(this.timer.GPU_DISJOINT_EXT);this.gpuTimerDisjoint=disjoint;
   while(this.queries.length){const q=this.queries[0];if(!disjoint&&!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;this.queries.shift();const sample={frameId:this.timerFrameIds?.get(q)??null,valid:!disjoint,ms:disjoint?null:gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6};this.gpuTimerSamples.push(sample);if(sample.valid){this.gpuMs=sample.ms;this.lastGpuFrame=sample.frameId;}gl.deleteQuery(q);}
   if(disjoint)this.gpuMs=null;
  }
  dispose(){
   if(this.disposalComplete)return;
   this.disposalStarted=true;window.SphereStageFrame?.releaseRendererSurvey?.(this);for(const controller of this.prepareControllers||[])controller.abort();const gl=this.gl;this.disposedChildren??=new WeakSet();
   const child=value=>{if(value?.dispose&&!this.disposedChildren.has(value)){value.dispose();this.disposedChildren.add(value);}};
   if(this.biomeLocal?.isActive())this.biomeLocal.deactivate();child(this.biomeLocal);if(this.biomeLocal)window.SphereMainSurfaceSlot?.clear(this.biomeLocal);
   child(this.biomeOverview);child(this.vegetationPopulation?.lifecycle);for(const name of ['previewLight','biomes','heroes','worldTextures','woundTextures','finishes','localShadows','geometry','environment','meadowGround','grass','meadow'])child(this[name]);child(window.SphereEdgeStreaming);child(window.SphereGround);child(this.weather);child(this.panorama);
   const destroy=(method,value)=>{if(gl.isContextLost())return;gl[method](value);if(gl.getError()!==gl.NO_ERROR&&!gl.isContextLost())throw Error('The renderer could not finish '+method+'. Its resource is retained for retry.');};
   const programs=new Set(['modernProgram','program','legacyProgram','resolve'].map(name=>this[name]).filter(Boolean));
   if(!gl.isContextLost()&&programs.has(gl.getParameter(gl.CURRENT_PROGRAM))){gl.useProgram(null);if(!gl.isContextLost()&&(gl.getError()!==gl.NO_ERROR||gl.getParameter(gl.CURRENT_PROGRAM)!==null))throw Error('The renderer could not unbind its current program. Its programs are retained for retry.');}
   // These fields are the legacy renderer's own allocations. Native R targets
   // remain private to R and must never be installed as mutable field aliases.
   for(const [method,names]of [['deleteTexture',['texture','lightTexture','depthTexture','silhouetteMask']],['deleteFramebuffer',['lightBuffer','aaBuffer']],['deleteRenderbuffer',['aaColor','aaDepth']],['deleteProgram',['modernProgram','program','legacyProgram','resolve']]]){
    const values=new Set(names.map(name=>this[name]).filter(Boolean));for(const value of values){destroy(method,value);for(const name of names)if(this[name]===value)this[name]=null;}
   }
   for(const query of new Set(this.queries||[])){destroy('deleteQuery',query);this.queries=this.queries.filter(value=>value!==query);}
   this.disposalComplete=true;
  }
  async prepareGeometry(){
   if(this.geometry)return;
   if(!SphereGeometryRenderer.prepare){this.geometry=new SphereGeometryRenderer(this.gl);return;}
   if(!this.geometryPreparation){
    this.geometryPreparation=SphereGeometryRenderer.prepare(this.gl,()=>this.disposalStarted).then(candidate=>{
     if(this.disposalStarted||this.geometry)candidate.dispose();else this.geometry=candidate;
    }).finally(()=>{this.geometryPreparation=null;});
   }
   return this.geometryPreparation;
  }
  get preparingView(){return !!this.prepareControllers?.size;}
  async prepare(s,{aspect=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight)||16/9,onProgress,signal,preview=false}={}){
   if(this.disposalStarted)throw Error('The renderer is being disposed.');
   if(this.uniformFrameLock)throw Error('The current Main material frame is held for verification.');
   // The connected-ground worker has one destination. A doorway view must yield
   // it before a player visit can request a different set of terrain tiles.
   if(!preview)this.previewPreparation?.abort();
   const controller=new AbortController();
   if(preview)this.previewPreparation=controller;
   this.prepareControllers??=new Set();this.prepareControllers.add(controller);
   signal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
   const check=()=>{if(this.disposalStarted||signal.aborted)throw new DOMException('View changed','AbortError');};
   try{
   check();
   const plan=SphereAssets.plan(s,aspect);
   SphereAssets.request(this,plan);
   // Shader linking can run on the driver while the ground worker builds the landing tiles.
   const atmosphere=this.weather?.prepare?.(s);
   atmosphere?.catch(()=>{}); // A cancelled ground job may finish before this shared program.
   if(window.SphereGround?.enabled(s)){
    onProgress?.({phase:'Preparing connected ground'});check();
    SphereGround.request?.(s);await this.prepareGeometry();check();
    while(!SphereGround.ready(s)){check();SphereGround.neighbourhood(s);SphereEdgeStreaming.pump((mesh,budget)=>this.geometry.stage(mesh,budget));await new Promise(requestAnimationFrame);check();}
   }
   const progress=()=>onProgress?.({phase:'Preparing the artwork',...SphereAssets.status(this,plan)});
   if(plan.province){
    onProgress?.({phase:'Building the river gardens'});check();const groups=await SphereWatershed.prepare(s,{signal});
    check();
    // Compilation and every province upload belong to preparation, including
    // a first-ever visit. The first visible frame must not allocate them all.
    if(!this.geometry){onProgress?.({phase:'Preparing the landscape renderer'});check();await new Promise(r=>requestAnimationFrame(r));check();await this.prepareGeometry();check();}
    for(const mesh of groups){check();while(!this.geometry.stage(mesh,4)){check();await new Promise(r=>requestAnimationFrame(r));check();}}
   }
   check();progress();check();
   if(atmosphere){onProgress?.({phase:'Preparing the atmosphere'});await atmosphere;check();}
   const results=await Promise.allSettled(['biomes','heroes','worldTextures','woundTextures'].map(key=>{check();return this[key]?.prepare(plan[key],{signal,onProgress:progress});}));
   check();
   const failure=results.find(r=>r.status==='rejected');if(failure){failure.reason.artwork=true;throw failure.reason;}
   check();
   if(plan.finishes)this.finishes.prepare();check();return plan;
   }finally{
    this.prepareControllers.delete(controller);
    if(this.previewPreparation===controller)this.previewPreparation=null;
   }
  }
  // A worker may finish its last cell between two frames. An empty queue
  // still needs one presentation if the completed contents changed.
  get detailRevision(){return [window.SphereGround?.revision??0,window.SphereEdgeStreaming?.revision??0,
   this.grass?.uploaded??0,this.meadow?.grass?.uploaded??0,this.meadow?.fixedGrass?.uploaded??0].join('/');}
  get needsFrame(){return !!(this.presentedDetailRevision!==this.detailRevision||window.SphereEdgeStreaming?.needsFrame||this.meadowGround?.pending||this.meadowGround?.worker||this.grass?.queue.length||this.meadow?.info.queue||this.environment?.needsFrame||this.biomes&&(this.biomes.fading||this.biomes.pending.length||this.heroes?.fading||this.heroes?.pending.length)||this.woundTextures?.fading||this.woundTextures?.pending.length);}
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
