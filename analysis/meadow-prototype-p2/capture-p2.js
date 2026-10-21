/* Explicit complete-view capture transactions, in the isolated runtime only.
 * No job, record, submission or quality cap is raised. Every actual encoded
 * view is prepared at its actual internal resolution and has a completed
 * selection, no conflict, complete resources and the same latched wind phase.
 * A rejection is retained and never emits a complete/export event. */
(function(root){
'use strict';
const faces=[[[1,0,0],[0,-1,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[0,0,1]],[[0,-1,0],[0,0,-1]],[[0,0,1],[0,-1,0]],[[0,0,-1],[0,-1,0]]];
const status=(state,message)=>window.dispatchEvent(new CustomEvent('sphere-capture-status',{detail:{state,message,profile:'meadow-prototype-p2'}}));
function readiness(R){const p=R.meadow.productionPopulation,L=p?.lifecycle,e=R.renderInfo.instancedEnvironment;
 return {demand:p?.demand?.conflict||null,selection:e?.physicalGpu?.selectionConflict||L?.frame.selectionConflict||null,foregroundReady:L?.info.foregroundReady===true,viewReady:L?.frame.viewReady===true||L?.frame.stationaryReferenceReuse===true,committedVersion:L?.committed?.version,currentVersion:L?.version,completeResources:R.renderInfo.assets?.missing?.length===0,groundReady:R.meadowGround.info.ready,internal:[R.renderInfo.internalWidth,R.renderInfo.internalHeight],phase:R.renderInfo.windPhaseSeconds,prepareMs:e?.framePrepareCpuMs,uploadedBytes:e?.frameUploadedBytes,submitted:e?.tierInstances,gpuBytes:R.environment.vegetationAllocatedBytes()+(R.meadowGround.info.residentBytes||0)};
}
async function prepareView(R,s,w,h,{signal,facePass=false,timeoutMs=120000}={}){
 await R.prepare(s,{aspect:w/h,signal});const start=performance.now();let draws=0,stable=0,latest;
 do{
  if(signal?.aborted)throw new DOMException('Capture cancelled.','AbortError');
  R.draw(s,w,h,{exportFrame:true,facePass});draws++;latest=readiness(R);
  const error=R.gl.getError();if(error)throw Object.assign(Error('Capture GL error '+error),{readiness:latest});
  if(latest.demand||latest.selection)throw Object.assign(Error('Requested capture exceeds current vegetation capacity'),{readiness:latest});
  const complete=latest.foregroundReady&&latest.viewReady&&latest.committedVersion===latest.currentVersion&&latest.completeResources&&latest.groundReady;
  if(complete){if(++stable===2)return {...latest,draws,elapsedMs:performance.now()-start};}else stable=0;
  if(performance.now()-start>timeoutMs)throw Object.assign(Error('Requested capture view did not become completely ready'),{readiness:latest});
  await new Promise(resolve=>setTimeout(resolve,4));
 }while(true);
}
async function capture({projection='perspective',width=3840,signal,state}={}){
 const R=SphereApp.renderer,s=SphereMeadowWind.snapshot(state||SphereApp.snapshot()),height=Math.round(width/(projection==='panorama'?2:16/9)),transaction={schema:1,profile:'meadow-prototype-p2',revision:1,projection,width,height,status:'PREPARING',views:[],phase:SphereMeadowWind.phase(s),createdAt:new Date().toISOString(),encoded:false};
 s.playing=false;s.projection=projection;SphereApp.setBusy(true);window.spherePreviewSuspended=true;status('preparing','Preparing every capture view…');
 try{
  if(projection==='perspective')transaction.views.push(await prepareView(R,s,width,height,{signal}));
  else{
   const gl=R.gl,P=R.panorama??=new SpherePanorama(gl),size=Math.max(64,Math.min(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),Math.ceil(width/4)));
   gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_CUBE_MAP,P.texture);
   if(size!==P.size){for(let face=0;face<6;face++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+face,0,gl.RGB8,size,size,0,gl.RGB,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_CUBE_MAP,parameter,gl.CLAMP_TO_EDGE);P.size=size;}
   for(let face=0;face<6;face++){
    const [forward,up]=faces[face],view={...s,forward,up,fov:90,projection:'perspective'};
    const ready=await prepareView(R,view,size,size,{signal,facePass:true});transaction.views.push({face,forward,up,...ready});
    if(ready.phase!==transaction.phase)throw Error('Capture changed the displayed wind phase');
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_CUBE_MAP,P.texture);gl.copyTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+face,0,0,0,0,0,size,size);
   }
   R.canvas.width=width;R.canvas.height=height;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(null);gl.useProgram(P.program.p);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_CUBE_MAP,P.texture);const b=SphereMath.basis(s.forward,s.up),u=P.program.u;gl.uniform1i(u.panorama,9);gl.uniform3fv(u.forward,b.f);gl.uniform3fv(u.right,b.r);gl.uniform3fv(u.up,b.u);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
   if(gl.getError())throw Error('Capture resolve GL error');
  }
  if(transaction.views.some(v=>v.phase!==transaction.phase))throw Error('Capture phase mismatch');
  const blob=await new Promise(resolve=>R.canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Capture encoding failed');
  if(signal?.aborted)throw new DOMException('Capture cancelled.','AbortError');
  const bytes=new Uint8Array(await blob.arrayBuffer());transaction.encoded=true;transaction.status='COMPLETE';transaction.pngBytes=bytes.length;transaction.completedAt=new Date().toISOString();status('complete','Complete experimental photograph prepared.');
  return {transaction,png:Array.from(bytes)};
 }catch(error){transaction.status='REJECTED_NO_FILE';transaction.error=error.message;transaction.failedView=error.readiness||readiness(R);transaction.completedAt=new Date().toISOString();status('failed',error.message);return {transaction,png:null};}
 finally{SphereApp.setBusy(true);window.spherePreviewSuspended=true;}
}
root.SphereMeadowCaptureP2={capture,prepareView,readiness,profile:'meadow-capture-p2',revision:1};
})(window);
