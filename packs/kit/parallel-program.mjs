// Submit shaders before waiting for the driver. The synchronous API is still
// the fallback on WebGL implementations without parallel link completion.
export async function linkProgram(gl, vertex, fragment, signal) {
  signal?.throwIfAborted();
  const shaders = [], program = gl.createProgram();
  let ownsProgram = true;
  const releaseShaders = () => {
    for (const shader of shaders.splice(0)) gl.deleteShader(shader);
  };
  // A removed frame may never run another timer. Retire its objects in the abort event.
  function discard() {
    if (ownsProgram) {
      gl.deleteProgram(program);
      ownsProgram = false;
    }
    releaseShaders();
  }
  signal?.addEventListener('abort', discard, {once:true});
  try {
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(kind);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    if (parallel) {
      while (true) {
        signal?.throwIfAborted();
        if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) break;
        if (gl.isContextLost()) throw Error('The graphics context closed during shader preparation.');
        await new Promise(resolve => setTimeout(resolve, 12));
      }
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw Error(gl.getProgramInfoLog(program) || shaders.map(shader => gl.getShaderInfoLog(shader)).join('\n'));
    }
    ownsProgram = false;
    return program;
  } catch (error) {
    discard();
    throw error;
  } finally {
    signal?.removeEventListener('abort', discard);
    releaseShaders();
  }
}
