/* HR-05: conservative submission in the immutable resident chart (km).
 * The F2 sine rank stays in the fragment shader; only geometric exclusion and
 * zero-contribution LOD endpoints are considered here. HR-06 also retains the
 * exact native zero-rank stem bits for early clipping. Wind is never a key. */
(function(root){
'use strict';
const REVISION=3,DETAIL_LIMIT=250000,ENVELOPE_KM=.004,LOD_ERROR_KM=.0000002,TURN_GUARD_RADIANS=Math.PI/6;
// Only this module can register an immutable generated request. Ordinary
// callers retain mutable requests and the complete foreign-input validation.
const generatedDemandKeys=new WeakMap();
// The authoritative registry remains private. Ownership inspection follows the
// diagnostic proxy's native target edge; callers cannot mutate or borrow native
// WeakMap mutators against this incompatible proxy receiver.
const generatedDemandKeyGet=generatedDemandKeys.get.bind(generatedDemandKeys),generatedDemandKeyHas=generatedDemandKeys.has.bind(generatedDemandKeys);
const generatedDemandCache=new Proxy(generatedDemandKeys,Object.freeze({get:(_target,name)=>name==='get'?generatedDemandKeyGet:name==='has'?generatedDemandKeyHas:name===Symbol.toStringTag?'WeakMap':undefined,set:()=>false,deleteProperty:()=>false,defineProperty:()=>false,setPrototypeOf:()=>false}));
function generatedDemandKey(input,tier){const entry=generatedDemandKeys.get(input);return entry!==undefined&&(input.jobMetres===8?'clump':'detail')===tier?entry:null;}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function createView(camera,zeroRanks=null){
 const fov=camera.fov,width=camera.internalWidth,aspect=camera.aspect,position=camera.relativeOrigin;
 if(!Number.isFinite(fov)||fov<=0||fov>=180||!Number.isFinite(width)||width<=0||!Number.isFinite(aspect)||aspect<=0||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))throw Error('Invalid production selection view');
 const {f,r,u}=camera.basis||{},tan=Math.tan(fov*Math.PI/360),scale=tan/.83909963*1920/width;
 if(![f,r,u].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))throw Error('Invalid production selection basis');
 // A production bank finishes a bounded camera snapshot before the next one.
 // Retain a conservative horizontal turn margin while it is in flight. LOD
 // distance/scale and the actual render lens remain unchanged; extra submitted
 // records still count against the same capacity and detailed submission cap.
 const horizontalTan=camera.productionSelection?Math.tan(Math.min(Math.PI/2-Math.PI/360,fov*Math.PI/360+TURN_GUARD_RADIANS)):tan;
 const planes=[f,...[1,-1].map(sign=>f.map((v,k)=>v*horizontalTan+sign*r[k])),...[1,-1].map(sign=>f.map((v,k)=>v*tan/aspect+sign*u[k]))].map(p=>{const n=Math.hypot(...p);return p.map(v=>v/n);});
 const key=JSON.stringify([position,f,r,u,fov,width,aspect,camera.culling!==false,horizontalTan]);
 function sphere(center,radius){if(camera.culling===false)return 1;let inside=true;const dx=center[0]-position[0],dy=center[1]-position[1],dz=center[2]-position[2];for(const p of planes){const d=p[0]*dx+p[1]*dy+p[2]*dz;if(d+radius<0)return -1;if(d-radius<0)inside=false;}return inside?1:0;}
 function distance(origin){return Math.hypot(origin[0]-position[0],origin[1]-position[1],origin[2]-position[2])*scale;}
 function contributes(d,tier,detailAvailable){return tier==='detail'?d<=.020+LOD_ERROR_KM:d<=.072+LOD_ERROR_KM&&(!detailAvailable||d>=.012-LOD_ERROR_KM);}
 function classify(bounds,tier,detailAvailable,visibility=sphere(bounds.center,bounds.radius)){if(visibility<0)return -1;const d=distance(bounds.center),radius=bounds.radius*scale,lo=Math.max(0,d-radius),hi=d+radius;
  if(tier==='detail'){if(lo>.020+LOD_ERROR_KM)return zeroRanks?.detailCount?0:-1;return visibility===1&&hi<.020-LOD_ERROR_KM?1:0;}
  if(lo>.072+LOD_ERROR_KM||detailAvailable&&hi<.012-LOD_ERROR_KM)return zeroRanks?.coarseCount?0:-1;
  return visibility===1&&hi<.072-LOD_ERROR_KM&&(!detailAvailable||lo>.012+LOD_ERROR_KM)?1:0;
 }
 function accepts(view,record,tier,detailAvailable){const base=record*32,x=view.getFloat32(base,true),y=view.getFloat32(base+4,true),z=view.getFloat32(base+8,true),dx=x-position[0],dy=y-position[1],dz=z-position[2];
  // F2 uses strict `hash > weight`: a native sine rank of exactly zero can
  // survive even a zero LOD weight. Keep those exceptional seeds; replacing
  // the rank or its comparison would change the preserved appearance.
  if(!contributes(Math.hypot(dx,dy,dz)*scale,tier,detailAvailable)&&!(zeroRanks?.mask[view.getUint16(base+30,true)]&(tier==='detail'?1:2)))return false;
  if(camera.culling!==false)for(const p of planes)if(p[0]*dx+p[1]*dy+p[2]*dz+ENVELOPE_KM<0)return false;return true;
 }
 return {key,scale,position:position.slice(),planes,sphere,distance,contributes,classify,accepts};
}
function nativeZeroRanks(gl,service,checkCapacity,{stemMasks=false,stemWeightMasks=false,seedStart=0,seedCount=65536,seedMask=null}={}){
 if(stemWeightMasks&&!stemMasks)throw Error('Positive-weight probes require stem masks');
 if(![16384,65536].includes(seedCount)||!Number.isSafeInteger(seedStart)||seedStart<0||seedStart%seedCount||seedStart+seedCount>65536||seedMask&&(!(seedMask instanceof Uint8Array)||seedMask.length!==65536))throw Error('Invalid native seed batch');
 const side=Math.sqrt(seedCount),owner='vegetation-native-zero-ranks',wordsPerSeed=stemWeightMasks?9:4,stemBytes=stemMasks?seedCount*wordsPerSeed*4:0,temporaryCpuBytes=seedCount*12+65536+72*4+7*16+4*16+stemBytes,temporaryGpuBytes=seedCount*12,previous={framebuffer:gl.getParameter(gl.FRAMEBUFFER_BINDING),viewport:gl.getParameter(gl.VIEWPORT),program:gl.getParameter(gl.CURRENT_PROGRAM),vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING),array:gl.getParameter(gl.ARRAY_BUFFER_BINDING),active:gl.getParameter(gl.ACTIVE_TEXTURE),depth:gl.isEnabled(gl.DEPTH_TEST),blend:gl.isEnabled(gl.BLEND),depthMask:gl.getParameter(gl.DEPTH_WRITEMASK),blendRgb:gl.getParameter(gl.BLEND_EQUATION_RGB),blendAlpha:gl.getParameter(gl.BLEND_EQUATION_ALPHA),clear:gl.getParameter(gl.COLOR_CLEAR_VALUE),attributes:Array.from({length:7},(_,i)=>gl.getVertexAttrib(i,gl.CURRENT_VERTEX_ATTRIB))};
 checkCapacity(temporaryGpuBytes);service.retainCpuOwner(owner,temporaryCpuBytes);
 const shaders=[],program=gl.createProgram(),texture=gl.createTexture(),framebuffer=gl.createFramebuffer(),buffer=gl.createBuffer(),vao=gl.createVertexArray();let ok=false;
 try{
  // Compile the complete production fragment source. A simplified sine probe
  // may be optimised differently by a driver and is not a parity oracle.
  // Preserve F2's seed/stem vertex expression; only probe clip positions differ.
  const E=root.SphereInstancedEnvironment,GPU=root.SphereVegetationGPU;
  const vertex=E.F2_VERTEX.replace('out vec3 vRelative','flat out uint vDetailAvailable;out vec3 vRelative').replace('void main(){','void main(){vDetailAvailable=1u;').replace('gl_Position=vec4(dot(p,uRight)/t,dot(p,uUp)/t*uResolution.x/uResolution.y,z-.00002,z);',`int cornerId=gl_VertexID%16;vec2 corner=vec2((cornerId==1||cornerId==2||cornerId==4)?1.:0.,(cornerId==2||cornerId==4||cornerId==5)?1.:0.);vec2 cell=vec2(gl_InstanceID%${side},gl_InstanceID/${side});gl_Position=vec4((cell+corner)/${side/2}.-1.,0.,1.);`);
  const fragment=GPU.readinessFragment(E.foliageFragmentF2());
  for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const seeds=new Float32Array(seedCount*2),pixels=new Uint8Array(seedCount*4),mask=seedMask||new Uint8Array(65536);for(let i=0;i<seedCount;i++)seeds[i*2+1]=(seedStart+i)/65535;gl.activeTexture(gl.TEXTURE0);const oldTexture=gl.getParameter(gl.TEXTURE_BINDING_2D);previous.texture=oldTexture;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,side,side);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.bindTexture(gl.TEXTURE_2D,oldTexture);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Native rank probe framebuffer unavailable');gl.viewport(0,0,side,side);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,seeds,gl.STATIC_DRAW);gl.enableVertexAttribArray(6);gl.vertexAttribPointer(6,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(6,1);gl.vertexAttrib3f(0,0,0,0);gl.vertexAttrib3f(1,0,1,0);gl.vertexAttrib3f(2,0,0,.1);gl.vertexAttrib4f(3,0,0,0,1);gl.vertexAttrib1f(4,1);gl.vertexAttrib4f(5,1,1,1,1);
  gl.uniform1i(gl.getUniformLocation(program,'uMode'),2);gl.uniform1f(gl.getUniformLocation(program,'uRadius'),1);gl.uniform1f(gl.getUniformLocation(program,'uFov'),80*Math.PI/180);gl.uniform2f(gl.getUniformLocation(program,'uResolution'),1920,1080);gl.uniform3f(gl.getUniformLocation(program,'uForward'),0,0,1);gl.uniform3f(gl.getUniformLocation(program,'uRight'),1,0,0);gl.uniform3f(gl.getUniformLocation(program,'uUp'),0,1,0);gl.uniform1fv(gl.getUniformLocation(program,'uStemHeights[0]'),new Float32Array(72).fill(1));
  const tier=gl.getUniformLocation(program,'uTier');gl.uniform1i(tier,1);gl.drawArraysInstanced(gl.TRIANGLES,0,6,seedCount);gl.readPixels(0,0,side,side,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let detailCount=0,coarseCount=0;for(let i=0;i<seedCount;i++)if(pixels[i*4]){mask[seedStart+i]|=1;detailCount++;}
  const stems=stemMasks?new Uint32Array(seedCount*wordsPerSeed):null;let zeroStemPairs=0;
  gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1i(tier,2);
  for(let stem=0;stem<72;stem++){
   if(stemMasks)gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArraysInstanced(gl.TRIANGLES,stem*16,6,seedCount);
   if(stemMasks){gl.readPixels(0,0,side,side,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(let seed=0;seed<seedCount;seed++)if(pixels[seed*4]){mask[seedStart+seed]|=2;stems[seed*wordsPerSeed+(stem>>>5)]|=1<<(stem&31);zeroStemPairs++;}}
  }
  if(!stemMasks){gl.readPixels(0,0,side,side,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(let seed=0;seed<seedCount;seed++)if(pixels[seed*4])mask[seedStart+seed]|=2;}
  const weightThresholds=stemWeightMasks?[.15624,.49999,.84374]:[],probeDistances=stemWeightMasks?[.066,.060,.054]:[],survivingStemPairs=[];
  // The complete original fragment shader still performs its own strict rank
  // discard at each probe pose. The thresholds deliberately sit 1e-5 below
  // the corresponding .15625/.5/.84375 weights to guard float rounding; a
  // retained stem always goes through the unchanged production discard.
  for(let layer=0;layer<probeDistances.length;layer++){
   gl.vertexAttrib3f(2,0,0,probeDistances[layer]);let pairs=0;
   for(let stem=0;stem<72;stem++){
    gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArraysInstanced(gl.TRIANGLES,stem*16,6,seedCount);gl.readPixels(0,0,side,side,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const bit=(layer+1)*72+stem;
    for(let seed=0;seed<seedCount;seed++)if(pixels[seed*4]){stems[seed*wordsPerSeed+(bit>>>5)]|=1<<(bit&31);pairs++;}
   }
   survivingStemPairs.push(pairs);
  }
  const coldProbeDraws=73+probeDistances.length*72;
  for(let i=seedStart;i<seedStart+seedCount;i++)if(mask[i]&2)coarseCount++;service.retainCpuOwner(owner,mask.byteLength+stemBytes);ok=true;
  return {mask,stemMasks:stems,seedStart,seedCount,zeroStemPairs,detailCount,coarseCount,cpuBytes:mask.byteLength+stemBytes,stemMaskBytes:stemBytes,stemWeightMasks,weightThresholds,probeDistances,survivingStemPairs,coldProbeDraws,coldProbeInstances:coldProbeDraws*seedCount,uploadBytes:seeds.byteLength,readbackBytes:pixels.byteLength*(stemMasks?coldProbeDraws:2),temporaryCpuBytes,temporaryGpuBytes,exactProductionFragment:true,rank:'Preserved complete native F2 shader and strict comparison'};
 }finally{
  gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.deleteTexture(texture);gl.deleteFramebuffer(framebuffer);gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,previous.framebuffer);gl.viewport(...previous.viewport);gl.useProgram(previous.program);gl.bindVertexArray(previous.vao);gl.bindBuffer(gl.ARRAY_BUFFER,previous.array);for(let i=0;i<previous.attributes.length;i++){const value=previous.attributes[i];value instanceof Int32Array?gl.vertexAttribI4iv(i,value):value instanceof Uint32Array?gl.vertexAttribI4uiv(i,value):gl.vertexAttrib4fv(i,value);}gl.activeTexture(gl.TEXTURE0);if('texture'in previous)gl.bindTexture(gl.TEXTURE_2D,previous.texture);gl.activeTexture(previous.active);previous.depth?gl.enable(gl.DEPTH_TEST):gl.disable(gl.DEPTH_TEST);previous.blend?gl.enable(gl.BLEND):gl.disable(gl.BLEND);gl.depthMask(previous.depthMask);gl.blendEquationSeparate(previous.blendRgb,previous.blendAlpha);gl.clearColor(...previous.clear);if(!ok){if(seedMask)service.retainCpuOwner(owner,seedMask.byteLength);else service.releaseCpuOwner(owner);}
 }
}
function demand(state,cameraLocal,internalWidth,{previous=null,immutableInputs=false}={}){
 const scale=Math.tan(state.fov*Math.PI/360)/.83909963*1920/internalWidth;
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid production demand scale');
 // Half-metre pose buckets have a 0.354 m diagonal guard. Child roots may
 // extend outside their parent's storage rectangle; the extra metre includes
 // that spread and the bucket guard without rerolling geographic content.
 const center=[cameraLocal[0],cameraLocal[2]].map(v=>(Math.floor(v*2000)+.5)*.5),detailRadius=.020/scale*1000+1,coarseRadius=.072/scale*1000+5;
 const fallback=[],detail=[],distance=(x,z,size)=>Math.hypot(Math.max(x-center[0],0,center[0]-x-size),Math.max(z-center[1],0,center[1]-z-size));
 const cursors={clump:0,detail:0};
 const request=(x,z,size,priority)=>{
  const tier=size===8?'clump':'detail',id=(z+128)*256+x+128,old=immutableInputs?(tier==='clump'?previous?.fallback:previous?.detail):null;
  // Both enumerations retain row-major order. Merge only registered immutable
  // inputs from the preceding window; arbitrary prior arrays cannot gain trust.
  if(Array.isArray(old))while(cursors[tier]<old.length){const input=old[cursors[tier]],entry=generatedDemandKeys.get(input);if(entry===undefined||input.jobMetres!==size){cursors[tier]=old.length;break;}const oldId=(input.z*8+input.offsetZ)*256+input.x*8+input.offsetX;if(oldId<id){cursors[tier]++;continue;}if(oldId===id&&input.priority===priority){cursors[tier]++;return input;}break;}
  const input={x:Math.floor((x+128)/8),z:Math.floor((z+128)/8),offsetX:(x+128)%8,offsetZ:(z+128)%8,blockMetres:1,jobMetres:size,priority};
  if(immutableInputs){Object.freeze(input);generatedDemandKeys.set(input,JSON.stringify([input.x,input.z,8,input.offsetX,input.offsetZ,1,size,16,tier]));}return input;
 };
 // Restrict enumeration to rectangles that can intersect the same full circle.
 // Include a touching rectangle on the lower edge; ordering and the exact
 // distance comparison remain identical to the complete chart enumeration.
 const extent=(size,radius)=>({x0:Math.max(-128,(Math.ceil((center[0]-radius+128)/size)-1)*size-128),z0:Math.max(-128,(Math.ceil((center[1]-radius+128)/size)-1)*size-128),x1:Math.min(127,center[0]+radius),z1:Math.min(127,center[1]+radius)}),coarseExtent=extent(8,coarseRadius),detailExtent=extent(2,detailRadius);
 for(let z=coarseExtent.z0;z<=coarseExtent.z1;z+=8)for(let x=coarseExtent.x0;x<=coarseExtent.x1;x+=8)if(distance(x,z,8)<=coarseRadius)fallback.push(request(x,z,8,0));
 for(let z=detailExtent.z0;z<=detailExtent.z1;z+=2)for(let x=detailExtent.x0;x<=detailExtent.x1;x+=2){const d=distance(x,z,2);if(d<=detailRadius)detail.push(request(x,z,2,d<=5?1:2));}
 if(fallback.length+detail.length>4096)return {conflict:{kind:'demand-capacity',requiredRequests:fallback.length+detail.length,limit:4096,foregroundTrimmed:false},fallback:[],detail:[]};
 return {fallback,detail,detailRadiusMetres:detailRadius,coarseRadiusMetres:coarseRadius,poseBucketMetres:.5,key:JSON.stringify([center,scale])};
}
const api={REVISION,DETAIL_LIMIT,ENVELOPE_KM,LOD_ERROR_KM,TURN_GUARD_RADIANS,createView,nativeZeroRanks,demand,generatedDemandKey,cpuCaches:()=>({generatedDemandKeys:generatedDemandCache})};root.SphereVegetationSelection=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
