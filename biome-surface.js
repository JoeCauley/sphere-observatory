/* Biome surface: draw the atlas on the Sphere's inner surface.
 *
 * Main's surface shader gets one extra step. After it has chosen the ground
 * material for a pixel, the atlas decides what that point is (sphere-atlas.js,
 * repeated here as GLSL) and draws it:
 *   blank plot          Main's own ground, drained of colour: bare Builder structure, no collection declared;
 *   under construction  blank, with scaffold striping;
 *   installed biome     the pack's own colours and pattern;
 *   border              a dark strip along every plot edge;
 *   transport trunk     a bright line along the waist edges and six meridians;
 *   polar megalopolis   a lit radial grid beyond the last row.
 * Lighting, shades, wounds, atmosphere and depth stay exactly as Main computes them.
 *
 * Plot state is one 64 x 44 float texture: a texel per plot for colour and state,
 * and a second for accent and pattern. Borders and trunks narrower than a pixel
 * are drawn at about a pixel, so the partition reads from any distance.
 */
(function () {
  'use strict';

  const UNIT = 5, WIDTH = 64;
  const SLOT = 'surfaceMaterial(q,delta,footprint,ts*uRadius)';
  const PATTERNS = { field: 0, works: 1, plain: 2 };
  const BLANK = 0, CONSTRUCTION = 1, INSTALLED = 2;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const f = x => { const s = String(+x.toPrecision(10)); return /[.e]/.test(s) ? s : s + '.'; };

  function glsl(A) {
    return `
uniform highp sampler2D uInstalledBiomes;
uniform int uInstalledBiomesOn;
uniform float uAtlasRadiusKm;
uniform vec3 uAtlasAxis,uAtlasRight,uAtlasUp;
vec3 installedBiomeMaterial(vec3 original,vec3 q,float pixel){
 if(uInstalledBiomesOn==0)return original;
 const float ROW=${f(A.ROW)},LIMIT=${f(A.LIMIT)},ATLAS_TAU=6.283185307179586;
 float lat=asin(clamp(dot(q,uAtlasAxis),-1.,1.)),lon=atan(dot(q,uAtlasUp),dot(q,uAtlasRight));
 float grey=dot(original,vec3(.3333)),cosLat=max(.05,cos(lat));
 vec3 col;
 if(abs(lat)>=LIMIT){
  float ring=abs(fract((abs(lat)-LIMIT)/ROW*6.)-.5),spoke=abs(fract(lon/ATLAS_TAU*48.)-.5);
  float lines=(1.-smoothstep(.04,.10,min(ring,spoke)))*clamp(ROW/(pixel*400.),0.,1.);
  col=mix(vec3(grey)*.5+vec3(.02,.025,.035),vec3(.80,.68,.44),lines*.7);
 }else{
  float fr=(lat+LIMIT)/ROW,rowF=min(floor(fr),${f(A.ROWS - 1)}),mid=(rowF+.5)*ROW-LIMIT;
  float n=max(${f(A.MIN_COLUMNS)},floor(${f(A.EQUATOR_COLUMNS)}*cos(mid)+.5)),fc=(lon+ATLAS_TAU*.5)/ATLAS_TAU*n,colF=clamp(floor(fc),0.,n-1.);
  vec2 local=vec2(fc-colF,fr-rowF),p=local*2.-1.;
  vec4 P=texelFetch(uInstalledBiomes,ivec2(int(colF),int(rowF)),0),A=texelFetch(uInstalledBiomes,ivec2(int(colF),int(rowF)+${A.ROWS}),0);
  float detail=clamp(ROW/(pixel*60.)-.2,0.,1.);
  col=mix(original,vec3(grey),.62)*.80;
  if(P.a>1.5){
   vec3 look=P.rgb;
   if(A.a<.5){float w=sin(p.x*9.+sin(p.y*7.)*1.7)*sin(p.y*11.+sin(p.x*5.)*1.3);look=mix(P.rgb,A.rgb,smoothstep(-.2,.6,w));}
   else if(A.a<1.5){vec2 g=abs(fract(p*6.)-.5);look=mix(P.rgb,A.rgb,(1.-smoothstep(.03,.09,min(g.x,g.y)))*.8);}
   col=mix(P.rgb,look,detail);
  }else if(P.a>.5){
   float stripe=abs(fract((p.x+p.y)*7.)-.5);
   col=mix(col,vec3(.62,.44,.12),.10+(1.-smoothstep(.12,.2,stripe))*.42*detail);
  }
  float edge=min(min(local.y,1.-local.y)*ROW,min(local.x,1.-local.x)*ATLAS_TAU/n*cosLat);
  float border=max(${f(A.BORDER_KM)}/uAtlasRadiusKm,pixel*1.1);
  col=mix(col,vec3(.035,.04,.045),1.-smoothstep(border*.55,border,edge));
 }
 float trunk=min(abs(abs(lat)-3.*ROW),abs(fract(lon/ATLAS_TAU*${f(A.TRUNK_MERIDIANS)}+.5)-.5)*ATLAS_TAU/${f(A.TRUNK_MERIDIANS)}*cosLat);
 float wide=max(${f(A.TRUNK_KM)}/uAtlasRadiusKm,pixel*1.8);
 return mix(col,vec3(.62,.55,.40),(1.-smoothstep(wide*.5,wide,trunk))*.85);
}
`;
  }

  function assemble(fragment, A) {
    if (fragment.split(SLOT).length !== 2 || fragment.split('const float PI=').length !== 2) throw Error('Main surface shader changed; the atlas slot was not found.');
    return fragment.replace('const float PI=', glsl(A) + '\nconst float PI=').replace(SLOT, 'installedBiomeMaterial(' + SLOT + ',q,footprint/uRadius)');
  }

  // One texel per plot: [r, g, b, state] and, ROWS rows lower, [accent r, g, b, pattern].
  function build(A, installed, lookOf, declared) {
    const data = new Float32Array(WIDTH * A.ROWS * 2 * 4), byPlot = new Map(installed.map(item => [item.plot, item]));
    let construction = 0;
    for (let index = 0; index < A.TOTAL; index++) {
      const p = A.plot(index), at = (p.row * WIDTH + p.col) * 4, accent = ((p.row + A.ROWS) * WIDTH + p.col) * 4, item = byPlot.get(index);
      if (item) {
        const look = lookOf(item) ?? {}, albedo = look.albedo ?? [0.4, 0.4, 0.4], second = look.accent ?? albedo;
        data.set([albedo[0], albedo[1], albedo[2], INSTALLED], at);
        data.set([second[0], second[1], second[2], PATTERNS[look.pattern] ?? PATTERNS.plain], accent);
      } else if (declared.has(index)) { data[at + 3] = CONSTRUCTION; construction++; }
      else data[at + 3] = BLANK;
    }
    return { data, height: A.ROWS * 2, construction };
  }

  async function compile(gl, vertex, fragment) {
    const make = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); return s; };
    const v = make(gl.VERTEX_SHADER, vertex), fs = make(gl.FRAGMENT_SHADER, fragment), program = gl.createProgram();
    gl.attachShader(program, v); gl.attachShader(program, fs); gl.linkProgram(program);
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    if (parallel) while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) await sleep(50);   // never block the page
    const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
    const log = ok ? '' : (gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(program) || 'link failed');
    gl.deleteShader(v); gl.deleteShader(fs);
    if (!ok) { gl.deleteProgram(program); throw Error('Atlas shader: ' + log.slice(0, 400)); }
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) { const info = gl.getActiveUniform(program, i); uniforms[info.name] = gl.getUniformLocation(program, info.name); }
    return { program, uniforms };
  }

  let state = { status: 'idle', plots: 0, installed: 0, construction: 0, textureBytes: 0, compileMs: 0, buildMs: 0, frames: 0 };

  async function start() {
    const deadline = performance.now() + 300000;
    while (!(window.SphereBiomeLibrary && window.SphereAtlas && window.SphereApp?.renderer && window.SphereLoading?.ready) && performance.now() < deadline) await sleep(250);
    const library = window.SphereBiomeLibrary, renderer = window.SphereApp?.renderer, A = window.SphereAtlas;
    if (!library || !renderer || !A) return;
    await library.ready;
    if (typeof renderer.setSurfaceOverlay !== 'function') { state.status = 'unavailable: this Main renderer has no surface overlay hook'; return; }
    const gl = renderer.gl;
    let compiled = null, texture = null, disposed = false, enabled = true;

    function upload() {
      const started = performance.now(), items = library.installed().filter(item => Number.isInteger(item.plot));
      const built = build(A, items, item => library.pack(item.packId)?.overview, new Set(library.underConstruction()));
      const priorActive = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0 + UNIT);
      const priorBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
      texture ??= gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, WIDTH, built.height, 0, gl.RGBA, gl.FLOAT, built.data);
      gl.bindTexture(gl.TEXTURE_2D, priorBinding); gl.activeTexture(priorActive);
      Object.assign(state, { plots: A.TOTAL, installed: items.length, construction: built.construction, textureBytes: built.data.byteLength, buildMs: +(performance.now() - started).toFixed(2) });
      window.SphereApp.draw();
    }

    const owner = {
      usesRenderer: value => value === renderer,
      programFor: core => (!disposed && enabled && compiled && core.layoutVersion === 2 ? compiled : null),
      withFrame(core, uniforms, draw) {
        const frame = window.SphereWorld.frame(core), priorActive = gl.getParameter(gl.ACTIVE_TEXTURE);
        gl.activeTexture(gl.TEXTURE0 + UNIT);
        const priorBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1f(uniforms.uAtlasRadiusKm, core.radius);
        gl.uniform1i(uniforms.uInstalledBiomes, UNIT); gl.uniform1i(uniforms.uInstalledBiomesOn, 1);
        gl.uniform3fv(uniforms.uAtlasAxis, frame.axis); gl.uniform3fv(uniforms.uAtlasRight, frame.right); gl.uniform3fv(uniforms.uAtlasUp, frame.up);
        try { draw(); } finally { gl.activeTexture(gl.TEXTURE0 + UNIT); gl.bindTexture(gl.TEXTURE_2D, priorBinding); gl.activeTexture(priorActive); state.frames++; }
      },
      inspect: () => ({ ...state }),
      dispose() { if (disposed) return; disposed = true; if (compiled) gl.deleteProgram(compiled.program); if (texture) gl.deleteTexture(texture); compiled = texture = null; }
    };

    let compiling = false;
    const refresh = async () => {
      if (disposed || compiling) return;
      try {
        if (!compiled) {
          compiling = true;
          state.status = 'compiling';
          const started = performance.now();
          compiled = await compile(gl, window.SphereShaders.vertex, assemble(window.SphereShaders.fragment, A));
          state.compileMs = Math.round(performance.now() - started);
          upload();
          renderer.setSurfaceOverlay(owner);
        } else upload();
        state.status = 'ready';
        window.SphereApp.draw();
      } catch (error) { state.status = 'failed: ' + error.message; console.warn('Biome surface', error); } finally { compiling = false; }
    };
    window.addEventListener('sphere-biomes-changed', refresh);
    api.show = value => { enabled = value !== false; window.SphereApp.draw(); };
    await refresh();
  }

  const api = { inspect: () => ({ ...state }), build, assemble, glsl, show() {} };
  window.SphereBiomeSurface = api;
  start();
})();
