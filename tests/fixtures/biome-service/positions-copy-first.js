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
  const records = new WeakMap(), fences = new WeakMap(); let lost = false, contextGeneration = 0;
  let activeProgram = program, activeVao = vao;
  let uniforms = locations(program);
  function locations(p) { const result = { view: gl.getUniformLocation(p, 'uViewProjection'), color: gl.getUniformLocation(p, 'uColor'), light: gl.getUniformLocation(p, 'uLightDirection') }; check(result.view !== null && result.color !== null && (drawProfile === 'host-world-surface-v1' || result.light !== null), 'BACKEND_CONTRACT', 'Fixed shader uniforms missing'); return result; }
  function live() { check(!lost && !gl.isContextLost(), 'CONTEXT_LOST', 'Host WebGL context is lost'); }
  function resource(key) { const r = records.get(key); check(r && !r.deleted, 'STALE_RELEASE', 'Unknown or deleted positions buffer'); check(r.contextGeneration === contextGeneration, 'CONTEXT_LOST', 'Buffer belongs to lost context'); return r; }
  function copyBinding(fn) { const previous = gl.getParameter(gl.COPY_WRITE_BUFFER_BINDING); try { return fn(); } finally { gl.bindBuffer(gl.COPY_WRITE_BUFFER, previous); } }
  const backend = Object.freeze({
    createGpu(kind, bytes, { layout = 'opaque' } = {}) {
      live(); int(bytes, 'GPU buffer length', 1); check(kind === 'gpu-buffer' && ['positions-f32x3', 'indices-u16', 'opaque'].includes(layout), 'BACKEND_CONTRACT', 'This admitted backend owns buffers only');
      check(layout !== 'positions-f32x3' || bytes % 12 === 0, 'INVALID_INPUT', 'Position allocation must contain whole xyz float vertices'); check(layout !== 'indices-u16' || bytes % 2 === 0, 'INVALID_INPUT', 'Index allocation must contain whole UInt16 values');
      let buffer = null;
      try { buffer = gl.createBuffer(); check(buffer, 'BACKEND_CONTRACT', 'GPU buffer creation failed'); copyBinding(() => { gl.bindBuffer(gl.COPY_WRITE_BUFFER, buffer); gl.bufferData(gl.COPY_WRITE_BUFFER, bytes, gl.DYNAMIC_DRAW); }); check(gl.getError() === gl.NO_ERROR, 'BACKEND_CONTRACT', 'GPU buffer allocation failed'); }
      catch (e) { if (buffer) gl.deleteBuffer(buffer); throw e; }
      const key = Object.freeze({ byteLength: bytes }); records.set(key, { buffer, bytes, layout, contextGeneration, deleted: false }); return key;
    },
    destroyGpu(key) { const r = records.get(key); check(r, 'STALE_RELEASE', 'Unknown GPU buffer'); if (r.deleted) return; if (!lost && r.contextGeneration === contextGeneration && !gl.isContextLost()) gl.deleteBuffer(r.buffer); r.deleted = true; r.buffer = null; },
    writeGpu(key, offset, bytes) { live(); const r = resource(key); int(offset, 'GPU upload offset'); check(bytes instanceof Uint8Array && bytes.byteLength > 0 && offset <= r.bytes - bytes.byteLength, 'INVALID_INPUT', 'GPU upload span differs from exact allocation'); copyBinding(() => { gl.bindBuffer(gl.COPY_WRITE_BUFFER, r.buffer); gl.bufferSubData(gl.COPY_WRITE_BUFFER, offset, bytes); }); check(gl.getError() === gl.NO_ERROR, 'BACKEND_CONTRACT', 'GPU upload failed'); },
    createFence() { live(); const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); check(sync, 'BACKEND_CONTRACT', 'GPU retirement fence failed'); const key = Object.freeze({}); fences.set(key, { sync, contextGeneration, deleted: false }); return key; },
    pollFence(key) { live(); const f = fences.get(key); check(f && !f.deleted, 'STALE_RELEASE', 'Unknown retirement fence'); check(f.contextGeneration === contextGeneration, 'CONTEXT_LOST', 'Fence belongs to a lost context'); const result = gl.clientWaitSync(f.sync, 0, 0); check(result !== gl.WAIT_FAILED, 'BACKEND_CONTRACT', 'GPU fence wait failed'); return result === gl.ALREADY_SIGNALED || result === gl.CONDITION_SATISFIED; },
    destroyFence(key) { const f = fences.get(key); check(f, 'STALE_RELEASE', 'Unknown retirement fence'); if (f.deleted) return; if (!lost && f.contextGeneration === contextGeneration && !gl.isContextLost()) gl.deleteSync(f.sync); f.deleted = true; f.sync = null; },
    loseContext() { check(contextGeneration < Number.MAX_SAFE_INTEGER, 'GENERATION_EXHAUSTED', 'Private GPU context counter exhausted'); contextGeneration++; lost = true; },
    restoreContext() { check(lost && !gl.isContextLost(), 'CONTEXT_LOST', 'Physical host context must be restored first'); check(gl.isProgram(activeProgram) && gl.getProgramParameter(activeProgram, gl.LINK_STATUS) === true && gl.isVertexArray(activeVao), 'BACKEND_CONTRACT', 'Host must rebuild fixed program and scratch VAO before restoration'); lost = false; },
    replaceHostDrawObjects(next) { check(lost && next && gl.isProgram(next.program) && gl.getProgramParameter(next.program, gl.LINK_STATUS) === true && gl.isVertexArray(next.vao) && gl.getAttribLocation(next.program,'aPosition') === 0, 'BACKEND_CONTRACT', 'Only lost host context may replace admitted draw objects'); const nextUniforms = locations(next.program); activeProgram = next.program; activeVao = next.vao; uniforms = nextUniforms; },
    submit(resources, pass) {
      live(); check(Array.isArray(resources) && resources.length === 2, 'NOT_READY', 'Exact positions and index GPU closure required');
      const p = resources.find(x => x.layout === 'positions-f32x3'), i = resources.find(x => x.layout === 'indices-u16'); check(p && i && p !== i, 'NOT_READY', 'Fixed positions/index formats required'); const positions = resource(p.value), indices = resource(i.value);
      check(positions.layout === p.layout && indices.layout === i.layout && positions.bytes === p.bytes && indices.bytes === i.bytes, 'BACKEND_CONTRACT', 'Submission metadata differs from retained GPU records');
      check(pass && Object.keys(pass).sort().join('|') === 'color|firstIndex|indexCount|lightDirection|viewProjection', 'INVALID_INPUT', 'Exact host draw pass required');
      for (const [key,length] of [['viewProjection',16],['color',4],['lightDirection',3]]) check(pass[key] instanceof Float32Array && pass[key].length === length && Array.from(pass[key]).every(Number.isFinite), 'INVALID_INPUT', 'Host '+key+' must contain finite GPU float values');
      check(pass.lightDirection.some(x=>x!==0), 'INVALID_INPUT', 'Host lighting vector cannot be zero'); int(pass.firstIndex,'First index'); int(pass.indexCount,'Index count',3); check(pass.firstIndex % 3 === 0 && pass.indexCount % 3 === 0 && pass.firstIndex <= indices.bytes / 2 - pass.indexCount, 'INVALID_INPUT', 'Draw span must contain bounded complete triangles');
      const priorVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING), priorArray = gl.getParameter(gl.ARRAY_BUFFER_BINDING), priorProgram = gl.getParameter(gl.CURRENT_PROGRAM);
      try {
        gl.useProgram(activeProgram); gl.uniformMatrix4fv(uniforms.view,false,pass.viewProjection); gl.uniform4fv(uniforms.color,pass.color); if(uniforms.light!==null)gl.uniform3fv(uniforms.light,pass.lightDirection);
        gl.bindVertexArray(activeVao); gl.bindBuffer(gl.ARRAY_BUFFER,positions.buffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices.buffer); gl.drawElements(gl.TRIANGLES,pass.indexCount,gl.UNSIGNED_SHORT,pass.firstIndex*2);
        check(gl.getError() === gl.NO_ERROR, 'BACKEND_CONTRACT', 'Host positions draw failed');
      } finally { gl.bindVertexArray(priorVao); gl.bindBuffer(gl.ARRAY_BUFFER,priorArray); gl.useProgram(priorProgram); }
      return Object.freeze({ draws: 1, triangles: pass.indexCount/3, declaredPositionBytes:positions.bytes, declaredIndexBytes:indices.bytes, nativeGpuTiming:'UNMEASURED' });
    }
  });
  return backend;
}
const API = Object.freeze({ createPositionsBackend, VERTEX_SOURCE, FRAGMENT_SOURCE });
if (typeof module === 'object' && module.exports) module.exports = API;
else globalThis.SphereBiomePositionsBackend = API;
})();
