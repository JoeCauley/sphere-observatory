(() => {
'use strict';

// WORK ONLY: host-owned WebGL2 buffer/draw adapter. Providers never receive GL.
// Host admits/owns the program and exclusive scratch VAO, including their cost.
const VERTEX_SOURCE = `#version 300 es
layout(location=0) in vec3 aPosition;
uniform mat4 uViewProjection;
out vec3 vEyePosition;
void main(){vEyePosition=aPosition;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 vEyePosition;
uniform vec4 uColor;
uniform vec3 uLightDirection;
out vec4 outColor;
void main(){vec3 n=normalize(cross(dFdx(vEyePosition),dFdy(vEyePosition)));float lit=0.28+0.72*max(dot(n,normalize(uLightDirection)),0.0);outColor=vec4(uColor.rgb*lit,uColor.a);}`;
function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
function check(ok, code, message) { if (!ok) fail(code, message); }
function int(n, name, min = 0) { check(Number.isSafeInteger(n) && n >= min, 'INVALID_INPUT', name + ' is not an exact integer'); }
function createPositionsBackend({ gl, program, vao, positionLocation = 0, drawProfile = 'simple-light-v1' }) {
  check(gl && typeof gl.fenceSync === 'function' && typeof gl.bindVertexArray === 'function', 'BACKEND_CONTRACT', 'Host WebGL2 context required');
  check(gl.isProgram(program) && gl.getProgramParameter(program, gl.LINK_STATUS) === true && gl.isVertexArray(vao), 'BACKEND_CONTRACT', 'Host must supply an admitted linked program and exclusive scratch VAO');
  check(positionLocation === 0 && gl.getAttribLocation(program, 'aPosition') === 0, 'BACKEND_CONTRACT', 'Fixed positions shader layout differs');
  check(['simple-light-v1','host-world-surface-v1'].includes(drawProfile), 'BACKEND_CONTRACT', 'Unknown static host draw profile');
  const records = new WeakMap(), fences = new WeakMap(), failedCreations = new WeakMap(), pendingFeedback = new Set(); let lost = false, uncertain = false, contextGeneration = 0;
  let activeProgram = program, activeVao = vao;
  let uniforms = locations(program);
  function locations(p) { const result = { view: gl.getUniformLocation(p, 'uViewProjection'), color: gl.getUniformLocation(p, 'uColor'), light: gl.getUniformLocation(p, 'uLightDirection') }; check(result.view !== null && result.color !== null && (drawProfile === 'host-world-surface-v1' || result.light !== null), 'BACKEND_CONTRACT', 'Fixed shader uniforms missing'); return result; }
  function live() { check(!lost && !gl.isContextLost(), 'CONTEXT_LOST', 'Host WebGL context is lost'); check(!uncertain, 'COMMITTED_UNCERTAIN', 'Prior physical backend state is unresolved until authentic context loss'); }
  function resource(key) { const r = records.get(key); check(r && !r.deleted, 'STALE_RELEASE', 'Unknown or deleted positions buffer'); check(r.contextGeneration === contextGeneration, 'CONTEXT_LOST', 'Buffer belongs to lost context'); return r; }
  function sameUniform(a,b) { if(typeof a==='number'||typeof b==='number')return Object.is(a,b);if(!ArrayBuffer.isView(a)||!ArrayBuffer.isView(b)||a.byteLength!==b.byteLength||a.constructor!==b.constructor)return false;const x=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),y=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);return x.every((v,i)=>v===y[i]); }
  function restore(tasks,verify) { let first=null;for(const task of tasks)try{task();}catch(error){first??=error;}if(gl.isContextLost())fail('CONTEXT_LOST','Actual context was lost while restoring physical backend state');try{if(gl.getError()!==gl.NO_ERROR)throw Error('GL restoration error');verify();if(gl.getError()!==gl.NO_ERROR)throw Error('GL restoration verification error');}catch(error){first??=error;}if(first){uncertain=true;fail('COMMITTED_UNCERTAIN','Exact physical backend state could not be restored');} }
  function copyBinding(fn) { const previous=gl.getParameter(gl.COPY_WRITE_BUFFER_BINDING);try{return fn();}finally{restore([()=>gl.bindBuffer(gl.COPY_WRITE_BUFFER,previous)],()=>check(gl.getParameter(gl.COPY_WRITE_BUFFER_BINDING)===previous,'RESTORE_FAILED','Prior copy-write binding differs'));} }
  function readBinding(fn) { const previous=gl.getParameter(gl.COPY_READ_BUFFER_BINDING);try{return fn();}finally{restore([()=>gl.bindBuffer(gl.COPY_READ_BUFFER,previous)],()=>check(gl.getParameter(gl.COPY_READ_BUFFER_BINDING)===previous,'RESTORE_FAILED','Prior copy-read binding differs'));} }
  function elementBinding(fn) {
    const previousVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);let previousElement,entered=false;
    try{gl.bindVertexArray(activeVao);previousElement=gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);entered=true;return fn();}
    finally{restore([...(entered?[()=>gl.bindVertexArray(activeVao),()=>gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,previousElement)]:[]),()=>gl.bindVertexArray(previousVao)],()=>{check(gl.getParameter(gl.VERTEX_ARRAY_BINDING)===previousVao,'RESTORE_FAILED','Prior index VAO differs');if(entered){let observed;try{gl.bindVertexArray(activeVao);observed=gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);}finally{gl.bindVertexArray(previousVao);}check(observed===previousElement&&gl.getParameter(gl.VERTEX_ARRAY_BINDING)===previousVao,'RESTORE_FAILED','Prior scratch index binding differs');}});}
  }
  const backend = Object.freeze({
    createGpu(kind, bytes, { layout = 'opaque' } = {}) {
      live(); int(bytes, 'GPU buffer length', 1); check(kind === 'gpu-buffer' && ['positions-f32x3', 'indices-u16', 'opaque'].includes(layout), 'BACKEND_CONTRACT', 'This admitted backend owns buffers only');
      check(layout !== 'positions-f32x3' || bytes % 12 === 0, 'INVALID_INPUT', 'Position allocation must contain whole xyz float vertices'); check(layout !== 'indices-u16' || bytes % 2 === 0, 'INVALID_INPUT', 'Index allocation must contain whole UInt16 values');
      let buffer = null;
      try {
        buffer = gl.createBuffer(); check(buffer, 'BACKEND_CONTRACT', 'GPU buffer creation failed');
        if (layout === 'indices-u16') elementBinding(() => { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','GPU index allocation failed'); });
        else copyBinding(() => { gl.bindBuffer(gl.COPY_WRITE_BUFFER, buffer); gl.bufferData(gl.COPY_WRITE_BUFFER, bytes, gl.DYNAMIC_DRAW);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','GPU buffer allocation failed'); });
        check(gl.getError() === gl.NO_ERROR, 'BACKEND_CONTRACT', 'GPU buffer allocation failed');
      }
      catch (e) { let held=buffer&&e.code==='COMMITTED_UNCERTAIN';if(buffer&&!held)try{gl.deleteBuffer(buffer);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','Failed creation buffer cleanup did not settle');}catch(cleanup){if(!gl.isContextLost()){uncertain=true;e=Object.assign(Error('Failed creation cleanup remains physically unresolved'),{code:'COMMITTED_UNCERTAIN'});held=true;}}if(held){const key=Object.freeze({byteLength:bytes});records.set(key,{buffer,bytes,layout,contextGeneration,deleted:false});failedCreations.set(e,key);}throw e; }
      const key = Object.freeze({ byteLength: bytes }); records.set(key, { buffer, bytes, layout, contextGeneration, deleted: false }); return key;
    },
    claimFailedCreation(error) { const key=failedCreations.get(error);if(key)failedCreations.delete(error);return key||null; },
    destroyGpu(key) { check(!uncertain||gl.isContextLost(),'COMMITTED_UNCERTAIN','Unresolved physical resources remain retained until actual loss');const r = records.get(key); check(r, 'STALE_RELEASE', 'Unknown GPU buffer'); if (r.deleted) return; if (!lost && r.contextGeneration === contextGeneration && !gl.isContextLost()) {gl.deleteBuffer(r.buffer);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','GPU buffer disposal remains unresolved');} r.deleted = true; r.buffer = null; },
    writeGpu(key, offset, bytes) { live(); const r = resource(key); int(offset, 'GPU upload offset'); check(bytes instanceof Uint8Array && bytes.byteLength > 0 && offset <= r.bytes - bytes.byteLength, 'INVALID_INPUT', 'GPU upload span differs from exact allocation'); copyBinding(() => { gl.bindBuffer(gl.COPY_WRITE_BUFFER, r.buffer); gl.bufferSubData(gl.COPY_WRITE_BUFFER, offset, bytes);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','GPU upload failed'); }); check(gl.getError() === gl.NO_ERROR, 'BACKEND_CONTRACT', 'GPU upload failed'); },
    createFence() { live(); const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); check(sync, 'BACKEND_CONTRACT', 'GPU retirement fence failed'); const key = Object.freeze({}); fences.set(key, { sync, contextGeneration, deleted: false }); return key; },
    pollFence(key) { live(); const f = fences.get(key); check(f && !f.deleted, 'STALE_RELEASE', 'Unknown retirement fence'); check(f.contextGeneration === contextGeneration, 'CONTEXT_LOST', 'Fence belongs to a lost context'); const result = gl.clientWaitSync(f.sync, 0, 0); check(result !== gl.WAIT_FAILED, 'BACKEND_CONTRACT', 'GPU fence wait failed'); return result === gl.ALREADY_SIGNALED || result === gl.CONDITION_SATISFIED; },
    destroyFence(key) { check(!uncertain||gl.isContextLost(),'COMMITTED_UNCERTAIN','Unresolved fences remain retained until actual loss');const f = fences.get(key); check(f, 'STALE_RELEASE', 'Unknown retirement fence'); if (f.deleted) return; if (!lost && f.contextGeneration === contextGeneration && !gl.isContextLost()) {gl.deleteSync(f.sync);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','GPU fence disposal remains unresolved');} f.deleted = true; f.sync = null; },
    verifyContextLoss() { check(gl.isContextLost(),'CONTEXT_LOSS_NOT_OBSERVED','Actual GL loss must precede resource invalidation');return true; },
    loseContext() { check(gl.isContextLost(),'CONTEXT_LOSS_NOT_OBSERVED','Actual GL loss must precede physical backend invalidation');uncertain=false;pendingFeedback.clear();check(contextGeneration < Number.MAX_SAFE_INTEGER, 'GENERATION_EXHAUSTED', 'Private GPU context counter exhausted'); contextGeneration++; lost = true; },
    restoreContext() { check(lost && !gl.isContextLost(), 'CONTEXT_LOST', 'Physical host context must be restored first'); check(gl.isProgram(activeProgram) && gl.getProgramParameter(activeProgram, gl.LINK_STATUS) === true && gl.isVertexArray(activeVao), 'BACKEND_CONTRACT', 'Host must rebuild fixed program and scratch VAO before restoration'); lost = false; },
    replaceHostDrawObjects(next) { check(lost && next && gl.isProgram(next.program) && gl.getProgramParameter(next.program, gl.LINK_STATUS) === true && gl.isVertexArray(next.vao) && gl.getAttribLocation(next.program,'aPosition') === 0, 'BACKEND_CONTRACT', 'Only lost host context may replace admitted draw objects'); const nextUniforms = locations(next.program); activeProgram = next.program; activeVao = next.vao; uniforms = nextUniforms; },
    submit(resources, pass) {
      live(); check(Array.isArray(resources) && resources.length === 2, 'NOT_READY', 'Exact positions and index GPU closure required');
      const p = resources.find(x => x.layout === 'positions-f32x3'), i = resources.find(x => x.layout === 'indices-u16'); check(p && i && p !== i, 'NOT_READY', 'Fixed positions/index formats required'); const positions = resource(p.value), indices = resource(i.value);
      check(positions.layout === p.layout && indices.layout === i.layout && positions.bytes === p.bytes && indices.bytes === i.bytes, 'BACKEND_CONTRACT', 'Submission metadata differs from retained GPU records');
      check(pass && Object.keys(pass).sort().join('|') === 'color|firstIndex|indexCount|lightDirection|viewProjection', 'INVALID_INPUT', 'Exact host draw pass required');
      for (const [key,length] of [['viewProjection',16],['color',4],['lightDirection',3]]) check(pass[key] instanceof Float32Array && pass[key].length === length && Array.from(pass[key]).every(Number.isFinite), 'INVALID_INPUT', 'Host '+key+' must contain finite GPU float values');
      check(pass.lightDirection.some(x=>x!==0), 'INVALID_INPUT', 'Host lighting vector cannot be zero'); int(pass.firstIndex,'First index'); int(pass.indexCount,'Index count',3); check(pass.firstIndex % 3 === 0 && pass.indexCount % 3 === 0 && pass.firstIndex <= indices.bytes / 2 - pass.indexCount, 'INVALID_INPUT', 'Draw span must contain bounded complete triangles');
      const priorVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING), priorArray = gl.getParameter(gl.ARRAY_BUFFER_BINDING), priorProgram = gl.getParameter(gl.CURRENT_PROGRAM),priorUniforms=[{location:uniforms.view,value:gl.getUniform(activeProgram,uniforms.view),kind:'matrix'},{location:uniforms.color,value:gl.getUniform(activeProgram,uniforms.color),kind:'color'},...(uniforms.light!==null?[{location:uniforms.light,value:gl.getUniform(activeProgram,uniforms.light),kind:'vector'}]:[])];
      try {
        gl.useProgram(activeProgram); gl.uniformMatrix4fv(uniforms.view,false,pass.viewProjection); gl.uniform4fv(uniforms.color,pass.color); if(uniforms.light!==null)gl.uniform3fv(uniforms.light,pass.lightDirection);
        gl.bindVertexArray(activeVao); gl.bindBuffer(gl.ARRAY_BUFFER,positions.buffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices.buffer); gl.drawElements(gl.TRIANGLES,pass.indexCount,gl.UNSIGNED_SHORT,pass.firstIndex*2);
        check(gl.getError() === gl.NO_ERROR, 'BACKEND_CONTRACT', 'Host positions draw failed');
      } finally { restore([()=>gl.useProgram(activeProgram),...priorUniforms.map(u=>()=>{if(u.kind==='matrix')gl.uniformMatrix4fv(u.location,false,u.value);else if(u.kind==='color')gl.uniform4fv(u.location,u.value);else gl.uniform3fv(u.location,u.value);}),()=>gl.bindVertexArray(priorVao),()=>gl.bindBuffer(gl.ARRAY_BUFFER,priorArray),()=>gl.useProgram(priorProgram)],()=>{check(gl.getParameter(gl.VERTEX_ARRAY_BINDING)===priorVao&&gl.getParameter(gl.ARRAY_BUFFER_BINDING)===priorArray&&gl.getParameter(gl.CURRENT_PROGRAM)===priorProgram,'RESTORE_FAILED','Prior draw binding differs');for(const u of priorUniforms)check(sameUniform(gl.getUniform(activeProgram,u.location),u.value),'RESTORE_FAILED','Prior draw uniform bits differ');}); }
      return Object.freeze({ draws: 1, triangles: pass.indexCount/3, declaredPositionBytes:positions.bytes, declaredIndexBytes:indices.bytes, nativeGpuTiming:'UNMEASURED' });
    },
    usesDrawObjects(candidateProgram,candidateGl) { if(uncertain)live();return !lost&&!gl.isContextLost()&&candidateGl===gl&&candidateProgram===activeProgram; },
    status:()=>Object.freeze({lost,uncertain,pendingFeedback:pendingFeedback.size,contextGeneration}),
    // Root-only private physical identity check under an authentic R GPU reader.
    verifyPreparedResources(resources) { live(); check(Array.isArray(resources) && resources.length > 0 && resources.length <= 16, 'NOT_READY', 'Bounded actual prepared GPU closure required'); for (const item of resources) { const r = resource(item.value); check(r.layout === item.layout && r.bytes === item.bytes, 'BACKEND_CONTRACT', 'Prepared metadata differs from this exact physical backend'); } return true; },
    // Fixed bounded prospective input read. The resource owner retains the GPU
    // closure and destination CPU reader before this synchronous native call.
    readPositions(resources, firstVertex, pointCount, destination) {
      live();const item=resources.find(r=>r.layout==='positions-f32x3');check(item,'NOT_READY','Exact actual positions resource required');const input=resource(item.value);int(firstVertex,'First actual vertex');int(pointCount,'Actual vertex count',1);check(pointCount<=256&&input.layout===item.layout&&input.bytes===item.bytes&&firstVertex+pointCount<=input.bytes/12&&destination instanceof Float32Array&&destination.length===pointCount*3,'INVALID_INPUT','Bounded exact actual positions read required');readBinding(()=>{gl.bindBuffer(gl.COPY_READ_BUFFER,input.buffer);gl.getBufferSubData(gl.COPY_READ_BUFFER,firstVertex*12,destination);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','Actual positions readback failed');});
    },
    // Fixed root-only qualification slot. Callers retain both physical records
    // through ResourceHost.withGpuUse; a provider never receives this backend.
    // It uses the same program, position location, VAO and vertex source as draw.
    probeTransform(resources, pass) {
      live();check(Array.isArray(resources)&&resources.length===2,'NOT_READY','Owned input/output GPU closure required');
      const input=resources.find(r=>r.layout==='positions-f32x3'),output=resources.find(r=>r.layout==='opaque');check(input&&output&&input!==output,'NOT_READY','Fixed transform probe buffer layouts required');const positions=resource(input.value),destination=resource(output.value);
      check(pass&&Object.keys(pass).sort().join('|')==='pointCount|rebaseHigh|rebaseLow|viewProjection','INVALID_INPUT','Exact root transform probe pass required');int(pass.pointCount,'Probe points',1);check(pass.pointCount<=256&&positions.bytes===pass.pointCount*12&&destination.bytes===pass.pointCount*28,'INVALID_INPUT','Bounded complete root probe buffers required');
      for(const [key,size]of [['viewProjection',16],['rebaseHigh',3],['rebaseLow',3]])check(pass[key] instanceof Float32Array&&pass[key].length===size&&Array.from(pass[key]).every(Number.isFinite),'INVALID_INPUT','Finite actual root transform uniforms required');
      check(gl.getProgramParameter(activeProgram,gl.TRANSFORM_FEEDBACK_VARYINGS)===2,'BACKEND_CONTRACT','Actual root program lacks fixed transform capture outputs');for(let k=0;k<2;k++){const v=gl.getTransformFeedbackVarying(activeProgram,k);check(v&&v.name===(k===0?'vEyePosition':'vBpsProjectedPosition')&&v.size===1&&v.type===(k===0?gl.FLOAT_VEC3:gl.FLOAT_VEC4),'BACKEND_CONTRACT','Actual transform outputs differ');}
      check(!gl.getParameter(gl.TRANSFORM_FEEDBACK_ACTIVE),'ROOT_STATE_BUSY','An existing transform-feedback owner is active');
      const saved={program:gl.getParameter(gl.CURRENT_PROGRAM),vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING),array:gl.getParameter(gl.ARRAY_BUFFER_BINDING),feedback:gl.getParameter(gl.TRANSFORM_FEEDBACK_BINDING),feedbackBuffer:gl.getParameter(gl.TRANSFORM_FEEDBACK_BUFFER_BINDING),copyRead:gl.getParameter(gl.COPY_READ_BUFFER_BINDING),discard:gl.isEnabled(gl.RASTERIZER_DISCARD)},uniformsToRestore=[];let feedback=null,begun=false;
      try{feedback=gl.createTransformFeedback();check(feedback,'RESOURCE_LIMIT','Root transform object allocation failed');pendingFeedback.add(feedback);gl.useProgram(activeProgram);for(const [name,value,kind]of [['uViewProjection',pass.viewProjection,'matrix'],['uBpsRebaseHigh',pass.rebaseHigh,'vector'],['uBpsRebaseLow',pass.rebaseLow,'vector'],['uBpsVertexRoundXor',0,'uint']]){const location=gl.getUniformLocation(activeProgram,name);check(location!==null,'BACKEND_CONTRACT','Fixed root transform uniform missing');uniformsToRestore.push({location,value:gl.getUniform(activeProgram,location),kind});if(kind==='matrix')gl.uniformMatrix4fv(location,false,value);else if(kind==='vector')gl.uniform3fv(location,value);else gl.uniform1ui(location,value);}gl.bindVertexArray(activeVao);gl.bindBuffer(gl.ARRAY_BUFFER,positions.buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,destination.buffer);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);begun=true;gl.drawArrays(gl.POINTS,0,pass.pointCount);gl.endTransformFeedback();begun=false;check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','Actual root transform-feedback draw failed');return Object.freeze({points:pass.pointCount,tupleComponents:7,outputBytes:destination.bytes,source:'ACTUAL_ROOT_SURFACE_PROGRAM',nativeTiming:'UNMEASURED'});}
      finally{
        const tasks=[...(begun?[()=>{gl.endTransformFeedback();begun=false;}]:[]),...(feedback?[()=>gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback),()=>gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null)]:[]),()=>gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,saved.feedback),()=>gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,saved.feedbackBuffer),()=>{if(saved.discard)gl.enable(gl.RASTERIZER_DISCARD);else gl.disable(gl.RASTERIZER_DISCARD);},()=>gl.useProgram(activeProgram),...uniformsToRestore.map(u=>()=>{if(u.kind==='matrix')gl.uniformMatrix4fv(u.location,false,u.value);else if(u.kind==='vector')gl.uniform3fv(u.location,u.value);else gl.uniform1ui(u.location,u.value);}),()=>gl.bindVertexArray(saved.vao),()=>gl.bindBuffer(gl.ARRAY_BUFFER,saved.array),()=>gl.bindBuffer(gl.COPY_READ_BUFFER,saved.copyRead),()=>gl.useProgram(saved.program)];
        restore(tasks,()=>{check(gl.getParameter(gl.CURRENT_PROGRAM)===saved.program&&gl.getParameter(gl.VERTEX_ARRAY_BINDING)===saved.vao&&gl.getParameter(gl.ARRAY_BUFFER_BINDING)===saved.array&&gl.getParameter(gl.TRANSFORM_FEEDBACK_BINDING)===saved.feedback&&gl.getParameter(gl.TRANSFORM_FEEDBACK_BUFFER_BINDING)===saved.feedbackBuffer&&gl.getParameter(gl.COPY_READ_BUFFER_BINDING)===saved.copyRead&&gl.isEnabled(gl.RASTERIZER_DISCARD)===saved.discard&&!gl.getParameter(gl.TRANSFORM_FEEDBACK_ACTIVE),'RESTORE_FAILED','Prior transform binding/rasterizer state differs');for(const u of uniformsToRestore)check(sameUniform(gl.getUniform(activeProgram,u.location),u.value),'RESTORE_FAILED','Prior transform uniform bits differ');});
        if(feedback){try{gl.deleteTransformFeedback(feedback);check(gl.getError()===gl.NO_ERROR,'RESTORE_FAILED','Temporary transform disposal failed');pendingFeedback.delete(feedback);}catch(error){uncertain=!gl.isContextLost();if(uncertain)fail('COMMITTED_UNCERTAIN','Temporary transform object remains retained');throw error;}}
      }
    },
    readTransform(resources,destination) {
      live();check(Array.isArray(resources)&&resources.length===1&&resources[0].layout==='opaque','NOT_READY','Retained root transform output required');const output=resource(resources[0].value);check(destination instanceof Float32Array&&destination.byteLength===output.bytes&&output.bytes<=256*28,'INVALID_INPUT','Exact bounded owned CPU readback required');readBinding(()=>{gl.bindBuffer(gl.COPY_READ_BUFFER,output.buffer);gl.getBufferSubData(gl.COPY_READ_BUFFER,0,destination);check(gl.getError()===gl.NO_ERROR,'BACKEND_CONTRACT','Actual root transform readback failed');});
    }
  });
  return backend;
}
const API = Object.freeze({ createPositionsBackend, VERTEX_SOURCE, FRAGMENT_SOURCE });
if (typeof module === 'object' && module.exports) module.exports = API;
else globalThis.SphereBiomePositionsBackend = API;
})();
