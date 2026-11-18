/* Kit: the Duck Blind veil as an overlay.
 *
 * Optional. For a biome whose own renderer does not draw its blind: an overlay canvas above
 * the biome's picture, with the same wisps and the same opacity law as the Observatory's own
 * cloud, driven by height above the ground. Canon: crossing a Duck Blind is a few seconds in
 * obscuring cloud; from above, the ground below is discernible. So the veil is felt only
 * while the eye is inside the band.
 *
 *   const veil = createVeil(document, { baseM, topM, edgeM });
 *   veil.draw(heightAboveGroundM, nowMs)   // each frame; returns 0..1
 *   veilAt(blind, heightAboveGroundM)      // the same number without drawing
 */
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const veilAt = (blind, m) => smooth(blind.baseM - blind.edgeM, blind.baseM, m) * (1 - smooth(blind.topM, blind.topM + blind.edgeM, m));

export function createVeil(doc, blind) {
  const canvas = doc.createElement('canvas');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', display: 'none', zIndex: '1' });
  (doc.getElementById('world')?.parentNode ?? doc.body).insertBefore(canvas, doc.getElementById('world')?.nextSibling ?? null);
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  let program = null; const u = {};
  if (gl) try {
    const make = (type, source) => { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh)); return sh; };
    program = gl.createProgram();
    gl.attachShader(program, make(gl.VERTEX_SHADER, '#version 300 es\nout vec2 v;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;v=p;gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(program, make(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;in vec2 v;out vec4 frag;uniform float uTime,uClimb,uAspect,uOpacity;void main(){vec3 d=normalize(vec3(v.x*uAspect/1.19,v.y/1.19-.9,.6));vec3 q=d*3.+vec3(uTime*.05,uClimb*.004,uTime*.03);float n=.5+.5*sin(q.x*2.1+sin(q.z*1.7+q.y))*sin(q.y*1.3+q.z*2.3);float a=smoothstep(0.,1.,uOpacity*1.5-.5*n);vec3 c=pow(mix(vec3(.80,.78,.76),vec3(.95,.93,.90),n),vec3(1./2.2));frag=vec4(c*a,a);}'));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    for (const name of ['uTime', 'uClimb', 'uAspect', 'uOpacity']) u[name] = gl.getUniformLocation(program, name);
  } catch { program = null; }
  let shown = false;
  return {
    draw(heightM, nowMs) {
      const value = veilAt(blind, heightM);
      if (value <= 0) { if (shown) { canvas.style.display = 'none'; shown = false; } return 0; }
      if (!shown) { canvas.style.display = 'block'; shown = true; }
      if (!program) { canvas.style.background = '#e2dfdb'; canvas.style.opacity = String(value); return value; }
      const w = Math.max(1, Math.round(canvas.clientWidth / 2)), h = Math.max(1, Math.round(canvas.clientHeight / 2));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
      gl.uniform1f(u.uTime, nowMs / 1000); gl.uniform1f(u.uClimb, heightM); gl.uniform1f(u.uAspect, w / h); gl.uniform1f(u.uOpacity, value);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return value;
    },
    dispose() { canvas.remove(); try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {} }
  };
}
