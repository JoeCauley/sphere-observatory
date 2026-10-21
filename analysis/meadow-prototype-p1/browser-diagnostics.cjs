'use strict';
// Executed only in the newly owned snapshot browser.
exports.setup=async(page,H,E)=>page.evaluate(async({H,E})=>{
 const R=SphereApp.renderer,state={...SphereApp.getState(),...E.poses.normal,time:H.sceneTime,quality:1,fov:H.fov,viewMode:'material',projection:'perspective',walkMode:false,walkSurface:false,walkPosition:null,walkVelocity:0,surfaceLock:false,autoWalk:false};
 state.meadow={...state.meadow,windPhaseSeconds:0,windResolvedPhaseSeconds:0,windAnchorSceneTime:H.sceneTime};
 SphereApp.setState(state);window.hr06State=state;window.p1BaseState=JSON.parse(JSON.stringify(state));
 window.p1Settle=async state=>{
  SphereApp.setState(state);let stable=0,draws=0;const start=performance.now();
  while(performance.now()-start<240000){R.draw(state,1920,1080,{adaptiveScale:1});draws++;
   const p=R.meadow.productionPopulation;
   if(!R.needsFrame&&p?.lifecycle.info.foregroundReady&&R.renderInfo.assets.missing.length===0){if(++stable===2)return {elapsedMs:performance.now()-start,draws};}else stable=0;
   await new Promise(r=>setTimeout(r,4));
  }throw Error('Prototype fixture did not settle');
 };
 const cold=await p1Settle(state),p=R.meadow.productionPopulation;
 window.p1Roots=Array.from(p.service.allocations.values()).filter(a=>a.packet).map(a=>({id:a.block.id,hash:a.packet.contentHash}));
 return {cold,device:R.device,counts:R.renderInfo.instancedEnvironment.tierInstances,triangles:R.renderInfo.instancedEnvironment.triangles,bytes:R.environment.vegetationAllocatedBytes(),tuple:[state.meadow.residentResourceRevision,state.meadow.packetRevision,state.meadow.selectionRevision],state};
},{H,E});
exports.cadence=async(page,count=240)=>page.evaluate(async count=>{
 const R=SphereApp.renderer,original=R.draw.bind(R),frames=[],timerResults=new Map(),base=JSON.parse(JSON.stringify(p1BaseState)),runs=[];
 const style=document.createElement('style');style.textContent='#view,#canvasViewport,#viewport{width:1920px!important;height:1080px!important;min-width:1920px!important;min-height:1080px!important}';document.head.append(style);
 const fps=document.querySelector('#previewFps');if(fps){fps.value='60';fps.dispatchEvent(new Event('change',{bubbles:true}));}
 const adaptive=document.querySelector('#adaptivePreview');if(adaptive)adaptive.checked=false;
 let active=null;
 R.draw=function(state,w,h,options){
  const before=performance.now(),result=original(state,w,h,options),after=performance.now();
  for(const sample of R.gpuTimerSamples||[])timerResults.set(sample.frameId,sample);
  if(active){frames.push({frameId:R.drawFrameId,at:before,cpuMs:after-before,intervalMs:before-active.lastAt,width:w,height:h,internal:[R.renderInfo.internalWidth,R.renderInfo.internalHeight]});active.lastAt=before;}
  return result;
 };
 try{
  for(const on of [false,true,true,false]){
   const state={...base,meadow:{...base.meadow,enabled:on},grass:{...base.grass,enabled:on},instancedEnvironment:{...base.instancedEnvironment,enabled:on}};
   SphereApp.setBusy(true);SphereApp.setState(state);SphereApp.setPlaying(false);window.spherePreviewSuspended=false;
   if(on)await p1Settle(state);else original(state,1920,1080,{adaptiveScale:1});
   frames.length=0;const raf=[];active={lastAt:performance.now()};const start=active.lastAt;SphereApp.setBusy(false);
   await new Promise((resolve,reject)=>{function next(timestamp){raf.push({timestamp,start:performance.now(),draws:frames.length});SphereApp.draw();if(frames.length>=count){resolve();return;}if(performance.now()-start>20000){reject(Error('Cadence diagnostic timeout'));return;}requestAnimationFrame(next);}requestAnimationFrame(next);});
   const elapsedMs=performance.now()-start;active=null;SphereApp.setBusy(true);
   for(let i=0;i<20&&R.queries.length;i++){await new Promise(requestAnimationFrame);R.pollTimers();for(const sample of R.gpuTimerSamples||[])timerResults.set(sample.frameId,sample);}
   runs.push({on,elapsedMs,fps:frames.length*1000/elapsedMs,frames:frames.map(f=>({...f,gpu:timerResults.get(f.frameId)||null})),raf});
  }
  return {scope:'Short ABBA app RAF diagnostic, not H1; complete draw cadence and RAF callback stamps',runs};
 }finally{active=null;R.draw=original;style.remove();window.spherePreviewSuspended=true;SphereApp.setBusy(true);SphereApp.setState(base);}
},count);
exports.canopy=async(page,E)=>page.evaluate(async E=>{
 const R=SphereApp.renderer,gl=R.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),P=SphereMeadowPrototype,base=JSON.parse(JSON.stringify(p1BaseState)),results=[],errors=[];
 if(!ext)throw Error('Native GPU timer unavailable');
 const timer=R.timer;R.timer=null;
 const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return {count:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};};
 const offState=s=>({...s,meadow:{...s.meadow,enabled:false},grass:{...s.grass,enabled:false},instancedEnvironment:{...s.instancedEnvironment,enabled:false}});
 async function sample(state,mode){
  P.select(mode);const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const started=performance.now();R.draw(state,1920,1080,{adaptiveScale:1});const cpuMs=performance.now()-started;gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();
  const waitStart=performance.now();while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()-waitStart>10000)throw Error('GPU sample timed out');await new Promise(r=>setTimeout(r,0));}
  const valid=!gl.getParameter(ext.GPU_DISJOINT_EXT),gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);
  if(!valid)throw Error('Disjoint GPU sample');
  const e=R.renderInfo.instancedEnvironment;
  const glError=gl.getError();if(glError)throw Error('D1 GL error '+glError+' in '+mode);
  return {cpuMs,gpuMs,valid,drawCalls:e?.drawCalls||0,instances:e?.tierInstances||null,triangles:e?.triangles||0,gpuBytes:R.environment.vegetationAllocatedBytes()+(R.meadowGround.info.residentBytes||0),prepareMs:e?.framePrepareCpuMs||0,uploadBytes:e?.frameUploadedBytes||0,glError,roots:R.meadow.productionPopulation?.service.info.retainedDetailedRecords||0};
 }
 function capture(state,mode){
  P.select(mode);R.draw(state,1920,1080,{adaptiveScale:1});return R.canvas.toDataURL('image/png');
 }
 const poses=[['normal',E.poses.normal,0,0,0,1,80],['grazing',E.poses.grazing,.7,0,0,1,80],['downward',E.poses.downward,.7,0,0,1,80],['overlap-turn',E.poses.normal,.7,35,0,1,80],['elevated-turn',E.poses.normal,1.2,120,.010,1,80],['changed-light',E.poses.normal,.4,0,0,.35,80],['wide-lens',E.poses.normal,.7,0,0,1,110]];
 try{
  for(const [id,pose,phase,turn,elevation,luminosity,fov]of poses){
   const state={...base,...pose,luminosity,fov,meadow:{...base.meadow,windPhaseSeconds:phase,windResolvedPhaseSeconds:phase}};
   state.position=SphereMath.add(state.position,SphereMath.mul(SphereMath.basis(state.forward,state.up).u,elevation));state.forward=SphereMath.rotate(state.forward,state.up,SphereMath.radians(turn));
   P.select('baseline');const cold=await p1Settle(state);const off=offState(state),raw={off:[],baseline:[],p1:[]};
   // Keep the off arm separate, as H1 does, so toggling ecology every query
   // cannot cancel/recreate the ground descriptor or introduce cold work.
   for(let i=0;i<8;i++)await sample(off,'baseline');
   for(let pair=0;pair<32;pair++)raw.off.push({...await sample(off,'baseline'),pair});
   P.select('baseline');await p1Settle(state);
   for(let i=0;i<8;i++){await sample(state,'baseline');await sample(state,'p1');}
   for(let pair=0;pair<32;pair++)for(const mode of pair%2?['p1','baseline']:['baseline','p1'])raw[mode].push({...await sample(state,mode),pair});
   const summary={};for(const mode of ['off','baseline','p1'])summary[mode]={gpu:stats(raw[mode].map(f=>f.gpuMs)),cpu:stats(raw[mode].map(f=>f.cpuMs)),gpuBytes:Math.max(...raw[mode].map(f=>f.gpuBytes)),prepare:stats(raw[mode].map(f=>f.prepareMs)),draws:Math.max(...raw[mode].map(f=>f.drawCalls)),triangles:Math.max(...raw[mode].map(f=>f.triangles))};
   for(const mode of ['baseline','p1'])summary[mode].incrementalGpu=stats(raw[mode].map((f,i)=>Math.max(0,f.gpuMs-raw.off[i].gpuMs)));
   const row={id,phase,fov,luminosity,cold,summary,raw,images:{baseline:capture(state,'baseline'),p1:capture(state,'p1')}};
   results.push(row);console.log('P1 GPU '+JSON.stringify({id,summary}));
  }
  if(gl.getError())errors.push('Final GL error');
  P.select('baseline');await p1Settle(base);
  const after=Array.from(R.meadow.productionPopulation.service.allocations.values()).filter(a=>a.packet).map(a=>({id:a.block.id,hash:a.packet.contentHash}));
  const initial=new Map(p1Roots.map(r=>[r.id,r.hash]));return {scope:'D1 complete renderer alternating 32-sample diagnostics; not H1 and not visual acceptance',profile:P.profile,atlasGpuBytes:P.atlasGpuBytes,results,errors,rootsRevisited:after.length,rootChanges:after.filter(r=>initial.has(r.id)&&initial.get(r.id)!==r.hash),physicalCharge:'Both baseline and new geometry and the atlas remain charged during comparison. Original native masks remain resident.'};
 }finally{P.select('baseline');R.timer=timer;}
},E);
exports.coverage=async(page,E,mode)=>page.evaluate(async({E,mode})=>{
 const R=SphereApp.renderer,gl=R.gl,P=SphereMeadowPrototype,s={...p1BaseState,...E.poses.normal},w=1920,h=1080;
 P.select(mode);await p1Settle(s);
 const timer=R.timer;R.timer=null;
 const stages=[],check=stage=>{const error=gl.getError();stages.push({stage,error});return error;};check('entry');
 const vertex='#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}',fragment='#version 300 es\nprecision highp float;precision highp int;uniform sampler2D uDepth;out vec4 colour;void main(){float d=texelFetch(uDepth,ivec2(gl_FragCoord.xy),0).r;uint q=uint(round(clamp(d,0.,1.)*16777215.));colour=vec4(float((q>>16u)&255u),float((q>>8u)&255u),float(q&255u),255.)/255.;}';
 const program=gl.createProgram(),shaders=[];for(const [kind,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(kind);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const fbo=gl.createFramebuffer(),texture=gl.createTexture(),vao=gl.createVertexArray(),depth=new Uint8Array(w*h*4),ids=new Uint8Array(depth.length);check('observer-created');
 try{
  R.draw({...s,meadow:{...s.meadow,enabled:false},grass:{...s.grass,enabled:false},instancedEnvironment:{...s.instancedEnvironment,enabled:false}},w,h,{adaptiveScale:1});
  check('terrain-draw');
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Coverage FBO incomplete');
  check('fbo');
  gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,R.depthTexture);gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'uDepth'),0);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,depth);check('terrain-depth-read');
  gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);R.draw({...s,viewMode:'objectid',meadow:{...s.meadow,diagnostic:'grass-id'}},w,h,{adaptiveScale:1});check('ids-draw');gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,ids);check('ids-read');
  let eligible=0,grass=0;const roi=E.mask.roi;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const nx=(x+.5)/w,ny=(h-y-.5)/h;if(nx<roi[0]||nx>=roi[2]||ny<roi[1]||ny>=roi[3]||E.mask.excludedRects.some(([a,b,c,d])=>nx>=a&&nx<c&&ny>=b&&ny<d))continue;
   const i=(y*w+x)*4,raw=(depth[i]*65536+depth[i+1]*256+depth[i+2])/16777215,d=(Math.pow(2,raw*Math.log2(1+4*s.radius))-1)*1000;
   if(raw>=1||d<2||d>15)continue;eligible++;if(ids[i+1]>=190&&ids[i+1]<=192&&ids[i+2]<=1&&ids[i]>0)grass++;
  }
  return {mode,protocol:2,method:'Corrected F protocol: same-pixel terrain DEPTH24 texelFetch, uint RGBA8 packing, grass IDs 190-192 green, blue <=1, red >0; pixel-centre ROI/exclusions and 2-15 m terrain-depth band',eligiblePixels:eligible,grassPixels:grass,coverage:eligible?grass/eligible:0,threshold:E.mask.minimumCanopyCoverage,pass:stages.every(s=>s.error===0)&&eligible>0&&grass>=E.mask.minimumGrassPixels&&grass/eligible>=E.mask.minimumCanopyCoverage,stages,observerBackingBytes:depth.byteLength+ids.byteLength};
 }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteVertexArray(vao);gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);R.timer=timer;P.select('baseline');}
},{E,mode});

exports.traceGl=async(page)=>page.evaluate(async()=>{
 const R=SphereApp.renderer,gl=R.gl,prior=gl.getError(),errors=[],methods=new Map(),getError=gl.getError.bind(gl),state=JSON.parse(JSON.stringify(p1BaseState)),P=SphereMeadowPrototype;
 const names=new Set();for(let proto=gl;proto;proto=Object.getPrototypeOf(proto))for(const name of Object.getOwnPropertyNames(proto))if(name!=='getError'&&name!=='constructor'&&typeof gl[name]==='function')names.add(name);
 const timer=R.timer;R.timer=null;
 let mode='initial';
 try{
  for(const name of names){const fn=gl[name];methods.set(name,fn);gl[name]=function(...args){const result=fn.apply(this,args),error=getError();if(error)errors.push({mode,name,error,args:args.map(a=>ArrayBuffer.isView(a)?a.constructor.name+'['+a.length+']':a===null?null:typeof a==='object'?a.constructor.name:a)});return result;};}
  const counts=[];
  for(mode of ['off','baseline','p1','baseline-id','p1-id']){P.select(mode.startsWith('p1')?'p1':'baseline');const s=mode==='off'?{...state,meadow:{...state.meadow,enabled:false},grass:{...state.grass,enabled:false},instancedEnvironment:{...state.instancedEnvironment,enabled:false}}:mode.endsWith('id')?{...state,viewMode:'objectid',meadow:{...state.meadow,diagnostic:'grass-id'}}:state;if(mode==='off')R.draw(s,1920,1080,{adaptiveScale:1});else await p1Settle(s);for(let i=0;i<4;i++)R.draw(s,1920,1080,{adaptiveScale:1});counts.push({mode,instances:R.renderInfo.instancedEnvironment?.tierInstances,draws:R.renderInfo.instancedEnvironment?.drawCalls});}
  return {prior,errors,counts,scope:'Settled untimed draws per arm, checks after every WebGL API call; invasive diagnosis only, never used for timing or first native capture'};
 }finally{for(const [name,fn]of methods)gl[name]=fn;R.timer=timer;P.select('baseline');}
});

exports.planning=async(page,H,routeFrames)=>page.evaluate(async({H,routeFrames})=>{
 const R=SphereApp.renderer,P=SphereMeadowPrototype,base=JSON.parse(JSON.stringify(p1BaseState)),planner=new SphereMeadowTilePlannerP1.TilePlanner(),runs=[];
 P.select('p1');await p1Settle(base);
 const stat=a=>{a=a.slice().sort((x,y)=>x-y);return {count:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};};
 for(const [kind,frames]of Object.entries(routeFrames)){
  await p1Settle(base);const rows=[];
  // Public poses are copied verbatim from retained H1 raw windows. App draws
  // remain ordinary. This shadow observer is outside acceptance timing.
  for(let i=0;i<frames.length;i++){
   const pose=JSON.parse(frames[i].poseKey),s={...base,position:pose[0],forward:pose[1],up:pose[2],time:pose[3],meadow:{...base.meadow,windPhaseSeconds:pose[4],windResolvedPhaseSeconds:pose[4]}};
   SphereApp.setState(s);const at=performance.now();R.draw(s,1920,1080,{adaptiveScale:1});const drawCpuMs=performance.now()-at;
   const pop=R.meadow.productionPopulation,life=pop.lifecycle,start=performance.now(),snapshot=planner.sync(pop.service,life),plannerCpuMs=performance.now()-start;
   const fields=['grid','gridBits','footprintRows','footprintBits'],saved=fields.map(k=>life[k].slice()),cached=life.footprintCached;
   const oracleStart=performance.now(),oracle=life.candidate(),oracleCpuMs=performance.now()-oracleStart,comparison=planner.compare(oracle),glError=R.gl.getError();
   fields.forEach((k,j)=>life[k].set(saved[j]));life.footprintCached=cached;
   if(!oracle&&snapshot.candidateEligible||oracle&&(!comparison.matched||snapshot.foregroundReady!==oracle.foregroundReady))throw Error('P1 coverage divergence '+kind+' frame '+i+' '+JSON.stringify({snapshot,comparison}));
   if(glError)throw Error('P1 planning ordinary draw GL error '+glError+' '+kind+' frame '+i);
   const e=R.renderInfo.instancedEnvironment;
   rows.push({routeIndex:i,poseKey:frames[i].poseKey,drawCpuMs,completePreparationMs:e.framePrepareCpuMs,uploadBytes:e.frameUploadedBytes,residentDetailed:pop.service.info.retainedDetailedRecords,submittedDetailed:e.tierInstances.blades,physicalGpuBytes:R.environment.vegetationAllocatedBytes(),plannerCpuMs,oracleCpuMs,snapshot,comparison,glError,viewReady:life.frame.viewReady===true,foregroundReady:life.info.foregroundReady});
   if(i%60===0)console.log('P1 plan '+kind+' '+i+' '+JSON.stringify({plannerCpuMs,oracleCpuMs,dirty:snapshot.dirtyRegions,prepare:e.framePrepareCpuMs}));
   await new Promise(requestAnimationFrame);
  }
  runs.push({kind,frames:rows,summary:{planner:stat(rows.map(r=>r.plannerCpuMs)),oracle:stat(rows.map(r=>r.oracleCpuMs)),ordinaryDraw:stat(rows.map(r=>r.drawCpuMs)),ordinaryPreparation:stat(rows.map(r=>r.completePreparationMs)),dirtyRegions:stat(rows.map(r=>r.snapshot.dirtyRegions)),fullMatch:rows.every(r=>r.comparison.candidateNull||r.comparison.matched),backingBytes:Math.max(...rows.map(r=>r.snapshot.backingBytes)),maximumUploadBytes:Math.max(...rows.map(r=>r.uploadBytes))}});
 }
 P.select('baseline');await p1Settle(base);
 return {profile:SphereMeadowTilePlannerP1.profile,status:'SHADOW_ONLY',scope:'Verbatim retained 900-frame walk/turn poses, current validated packets. Numeric winner/support planning compared to unmodified candidate oracle every frame. Real draw still uses production planner. Extra shadow/oracle observer work prevents interpreting this as H1.',runs,summary:runs.map(r=>({kind:r.kind,...r.summary})),stats:planner.stats,metadataBackingBytes:planner.backingBytes,unimplemented:['Submission range compiler','Typed reference-bank selection','Incremental demand normalization and receipt validation','Full integrated preparation measurement without duplicate oracle','Two-page world/render/support joins']};
},{H,routeFrames});
