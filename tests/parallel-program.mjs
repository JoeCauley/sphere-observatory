import assert from 'node:assert/strict';
import {linkProgram} from '../packs/kit/parallel-program.mjs';

function driver(completed) {
  const shaders = new Set(), programs = new Set();
  return {
    shaders, programs, VERTEX_SHADER:1, FRAGMENT_SHADER:2, LINK_STATUS:3,
    createShader() { const shader = {}; shaders.add(shader); return shader; },
    createProgram() { const program = {}; programs.add(program); return program; },
    attachShader() {}, shaderSource() {}, compileShader() {}, linkProgram() {},
    getExtension() { return {COMPLETION_STATUS_KHR:4}; },
    getProgramParameter(program, code) { assert(programs.has(program)); return code === 3 || completed; },
    isContextLost() { return false; },
    deleteShader(shader) { assert(shaders.delete(shader)); },
    deleteProgram(program) { assert(programs.delete(program)); }
  };
}

const loading = driver(false), lifetime = new AbortController();
const pending = linkProgram(loading, '', '', lifetime.signal);
assert.equal(loading.programs.size,1);
assert.equal(loading.shaders.size,2);
lifetime.abort();
assert.equal(loading.programs.size,0);
assert.equal(loading.shaders.size,0);
await assert.rejects(pending,{name:'AbortError'});

const ready = driver(true), active = new AbortController();
const program = await linkProgram(ready,'','',active.signal);
active.abort();
assert.equal(ready.programs.size,1);
assert.equal(ready.shaders.size,0);
ready.deleteProgram(program);
console.log('PASS cancelled and completed WebGL program ownership.');
