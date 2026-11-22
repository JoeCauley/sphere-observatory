/* Biome surface: draw the atlas on the Sphere's inner surface.
 *
 * Main's surface shader gets one extra step. After it has chosen the ground
 * material for a pixel, the atlas decides what that point is (sphere-atlas.js,
 * repeated here as GLSL) and draws it:
 *   blank plot          Main's own ground, drained of colour: bare Builder structure, no collection declared;
 *   under construction  blank, with scaffold striping;
 *   placed biome        the pack's regional colours and pattern, with or without local detail;
 *   border              roof decks and longitudinal service strips;
 *   transport trunk     wider roofed rights of way along the waist edges and six meridians;
 *   polar megalopolis   a lit radial grid beyond the last row.
 * Lighting, shades, wounds, atmosphere and depth stay exactly as Main computes them.
 *
 * Each plot uses three texels for base colour, accent and geographic bounds. Subpixel deck coverage
 * depends on the projected footprint. Surveyed structures supply their own footprint.
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
uniform vec4 uBorderChart,uBorderSurvey,uTransportChart,uTransportWidths;
float transportCoverage(float d,float halfWidth,float pixelKm){
 float halfPixel=max(.0001,pixelKm*.5);
 return clamp((min(d+halfPixel,halfWidth)-max(d-halfPixel,-halfWidth))/(2.*halfPixel),0.,1.);
}
vec3 transportMaterial(float across,float along,float halfWidth,float pixelKm){
 float ratio=across/halfWidth;
 float service=transportCoverage(abs(ratio-.74)*halfWidth,halfWidth*.055,pixelKm);
 float bays=cos(along*.0245437)*cos(across/max(halfWidth,1.)*2.8)*(1.-smoothstep(24.,120.,pixelKm));
 return mix(vec3(.32,.37,.35)*(.96+.055*bays),vec3(.25,.28,.255),service);
}
vec3 installedBiomeMaterial(vec3 original,vec3 q,float pixel,float distanceKm){
 if(uInstalledBiomesOn==0)return original;
 float mapWeight=smoothstep(1000.,12000.,distanceKm),ownerWeight=mapWeight;
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
  vec4 bounds=texelFetch(uInstalledBiomes,ivec2(int(colF),int(rowF)+${A.ROWS*2}),0);
  vec2 offset=p/max(bounds.xy,vec2(.000001));
  bool inside=bounds.z>.5 ? dot(offset,offset)<=1. : max(abs(offset.x),abs(offset.y))<=1.;
  if(P.a>1.5 && inside){
   ownerWeight=1.;
   vec3 look=P.rgb;
   if(A.a<.5){float w=sin(p.x*9.+sin(p.y*7.)*1.7)*sin(p.y*11.+sin(p.x*5.)*1.3);look=mix(P.rgb,A.rgb,smoothstep(-.2,.6,w));}
   else if(A.a<1.5){vec2 g=abs(fract(p*6.)-.5);look=mix(P.rgb,A.rgb,(1.-smoothstep(.03,.09,min(g.x,g.y)))*.8);}
   col=mix(P.rgb,look,detail);
   // Atlas coordinates in kilometres keep the regional pattern fixed during banking and reversal.
   vec2 km=p*vec2(ATLAS_TAU*.5/n*cos(mid),ROW*.5)*uAtlasRadiusKm;
   float pixelKm=pixel*uAtlasRadiusKm;
   float province=(sin(km.x/547.+.8*sin(km.y/806.))+sin(km.y/391.-km.x/1117.))*.5;
   float district=sin(km.x/91.+sin(km.y/134.))*cos(km.y/76.-km.x/210.);
   float modulation=.12*province*(1.-smoothstep(110.,550.,pixelKm))+.06*district*(1.-smoothstep(18.,92.,pixelKm));
   col=clamp(col*(1.+modulation),0.,1.);
  }else if(P.a>.5 && P.a<1.5){
   float stripe=abs(fract((p.x+p.y)*7.)-.5);
   col=mix(col,vec3(.62,.44,.12),.10+(1.-smoothstep(.12,.2,stripe))*.42*detail);
  }
  // Coverage is composited after native material, so close flight can see the same decks.
 }
 col=mix(original,col,ownerWeight);
 // A global unit vector at one AU carries kilometre-scale error. Local meshes own finer joints.
 float px=max(.001,max(pixel,1.e-7)*uAtlasRadiusKm),along=0.,edge=1e19;
 vec3 eastT=-sin(lon)*uAtlasRight+cos(lon)*uAtlasUp;
 vec3 northT=cos(lat)*uAtlasAxis-sin(lat)*(cos(lon)*uAtlasRight+sin(lon)*uAtlasUp);
 vec3 dx=dFdx(q),dy=dFdy(q);
 float eastPx=max(px,(abs(dot(dx,eastT))+abs(dot(dy,eastT)))*uAtlasRadiusKm);
 float northPx=max(px,(abs(dot(dx,northT))+abs(dot(dy,northT)))*uAtlasRadiusKm),branchPx=px;
 float halfWidth=${f(A.TRANSPORT_ROOF_KM.branch*.5)};
 if(abs(lat)<LIMIT){
  float rowCoord=(lat+LIMIT)/ROW,middle=(floor(rowCoord)+.5)*ROW-LIMIT;
  float n=max(${f(A.MIN_COLUMNS)},floor(${f(A.EQUATOR_COLUMNS)}*cos(middle)+.5));
  float east=abs(fract((lon/ATLAS_TAU+.5)*n+.5)-.5)*ATLAS_TAU/n*cosLat;
  float north=abs(fract(rowCoord+.5)-.5)*ROW;
  edge=min(east,north)*uAtlasRadiusKm;
  branchPx=east<north?eastPx:northPx;
  along=(east<north?lat:lon*cos(middle))*uAtlasRadiusKm;
 }
 float meridian=abs(fract(lon/ATLAS_TAU*${f(A.TRUNK_MERIDIANS)}+.5)-.5)*ATLAS_TAU/${f(A.TRUNK_MERIDIANS)}*cosLat;
 float waist=abs(abs(lat)-3.*ROW);
 float trunk=min(meridian,waist)*uAtlasRadiusKm,trunkHalf=${f(A.TRANSPORT_ROOF_KM.trunk*.5)};
 float trunkPx=meridian<waist?eastPx:northPx;
 float branchCover=transportCoverage(edge,halfWidth,branchPx),trunkCover=transportCoverage(trunk,trunkHalf,trunkPx);
 if(trunkCover>0. && trunkCover>=branchCover){
  along=(meridian<waist?lat:lon*cos(3.*ROW))*uAtlasRadiusKm;
  col=mix(col,transportMaterial(trunk,along,trunkHalf,trunkPx),trunkCover);
 }else if(branchCover>0.)col=mix(col,transportMaterial(edge,along,halfWidth,branchPx),branchCover);
 // Draw the surveyed rooftop between the two parcels, including in the middle-distance shell.
 if(uBorderSurvey.z>0. && abs(lat-uBorderChart.x)<ROW){
  float dl=lon-uBorderChart.y,c=cos(lat),sl=sin(lat),ch=cos(uBorderChart.x),sh=sin(uBorderChart.x);
  vec2 en=vec2(c*sin(dl),ch*sl-sh*c*cos(dl));float h=length(en);
  vec2 km=en*(atan(h,sh*sl+ch*c*cos(dl))*uAtlasRadiusKm/max(h,.0000001))-uBorderChart.zw;
  float east=abs(dot(km,uBorderSurvey.xy)),north=dot(km,vec2(-uBorderSurvey.y,uBorderSurvey.x));
  float outside=max(east-uBorderSurvey.z,max(-north,north-uBorderSurvey.w));
  float aa=max(.01,pixel*uAtlasRadiusKm);
  float roof=(1.-smoothstep(-aa,aa,outside))*min(1.,uBorderSurvey.w/aa);
  if(roof>0.){
   float bays=cos(east/86.)*cos(north/57.)*(1.-smoothstep(15.,80.,aa));
   col=mix(col,vec3(.32,.37,.35)*(1.+.11*bays),roof);
  }
 }
 if(uTransportWidths.w>0. && abs(lat-uTransportChart.x)*uAtlasRadiusKm<240.){
  float dl=atan(sin(lon-uTransportChart.y),cos(lon-uTransportChart.y));
  vec2 km=vec2(dl*cos(uTransportChart.x),lat-uTransportChart.x)*uAtlasRadiusKm;
  if(uTransportChart.z!=0.)km=vec2(km.y,km.x*uTransportChart.z);
  float bay=clamp(floor(km.x/200.+.5),-1.,1.);
  float width=bay<-.5?uTransportWidths.x:(bay>.5?uTransportWidths.z:uTransportWidths.y);
  float hall=width>0.?max(abs(km.x-bay*200.)-16.,abs(km.y)-width):1.e10;
  float link=max(max((uTransportWidths.x>0.?-200.:0.)-km.x,km.x-(uTransportWidths.z>0.?200.:0.)),abs(km.y)-1.9);
  float aa=max(.015,pixel*uAtlasRadiusKm);
  float roof=(1.-smoothstep(-aa,aa,min(hall,link)))*min(1.,max(width,1.9)/aa);
  col=mix(col,transportMaterial(abs(km.y),km.x,max(width,1.9),aa),roof);
 }
 return col;
}
`;
  }

  function assemble(fragment, A) {
    if (fragment.split(SLOT).length !== 2 || fragment.split('const float PI=').length !== 2) throw Error('Main surface shader changed; the atlas slot was not found.');
    // A uniform upper bound prevents drivers from expanding hundreds of iterations at link time.
    // The original loops broke on these same limits, including a zero edge or plate count.
    fragment=fragment.replaceAll('for(int i=0;i<18;i++){if(i>=uPlateCount)break;','for(int i=0;i<min(uPlateCount,18);i++){')
      .replaceAll('for(int k=0;k<256;k++){if(k>=count)break;','for(int k=0;k<min(count,256);k++){')
      .replaceAll('for(int i=0;i<128;i++){if(i>=uPackEdges)break;','for(int i=0;i<min(uPackEdges,128);i++){');
    return fragment.replace('const float PI=', glsl(A) + '\nconst float PI=').replace(SLOT, 'installedBiomeMaterial(' + SLOT + ',q,footprint/uRadius,ts*uRadius)');
  }

  // The final band stores normalized half-extents and the ellipse flag.
  function build(A, installed, lookOf, declared) {
    const data = new Float32Array(WIDTH * A.ROWS * 3 * 4), byPlot = new Map(installed.map(item => [item.plot, item]));
    let construction = 0;
    for (let index = 0; index < A.TOTAL; index++) {
      const p = A.plot(index), at = (p.row * WIDTH + p.col) * 4, accent = ((p.row + A.ROWS) * WIDTH + p.col) * 4, item = byPlot.get(index);
      if (item) {
        const look = lookOf(item) ?? {}, albedo = look.albedo ?? [0.4, 0.4, 0.4], second = look.accent ?? albedo;
        data.set([albedo[0], albedo[1], albedo[2], INSTALLED], at);
        data.set([second[0], second[1], second[2], PATTERNS[look.pattern] ?? PATTERNS.plain], accent);
        const bounds=item.footprint;
        data.set([bounds?.east??1,bounds?.north??1,bounds?.shape==='ellipse'?1:0,0],accent+WIDTH*A.ROWS*4);
      } else if (declared.has(index)) { data[at + 3] = CONSTRUCTION; construction++; }
      else data[at + 3] = BLANK;
    }
    return { data, height: A.ROWS * 3, construction };
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
    while (!(window.SphereBiomeLibrary && window.SphereAtlas && window.SphereApp?.renderer) && performance.now() < deadline) await sleep(250);
    const library = window.SphereBiomeLibrary, renderer = window.SphereApp?.renderer, A = window.SphereAtlas;
    if (!library || !renderer || !A) return;
    await library.ready;
    if (typeof renderer.setSurfaceOverlay !== 'function') { state.status = 'unavailable: this Main renderer has no surface overlay hook'; return; }
    const gl = renderer.gl;
    let compiled = null, texture = null, disposed = false, enabled = true;

    const [{chartFor},{farEdgeM,halfLengthM},apronRules]=await Promise.all([import('./packs/kit/surface-route.js'),import('./packs/kit/border-profile.js'),import('./packs/border-transport/0.10.0/district.mjs')]);
    let revision=0,transportChart=[0,0,0,0],transportWidths=[0,0,0,0],borderChart=[0,0,0,0],borderSurvey=[0,0,0,0];
    function upload() {
      const started = performance.now(), items = library.placed().filter(item => Number.isInteger(item.plot));
      const built = build(A, items, item => library.pack(item.packId)?.overview, new Set(library.underConstruction()));
      const d=library.placed().find(i=>i.transport)?.transport;
      window.SphereGround?.setApronSurvey(d?{district:d,parameters:library.world.params}:null,apronRules);
      transportChart=d?[d.origin.latitude,d.origin.longitude,d.origin.axis==='meridian'?d.origin.acrossSign:0,0]:[0,0,0,0];
      transportWidths=d?[-1,0,1].map(b=>(d.sites.find(s=>s.bay===b)?.widthM??0)/2000).concat(1):[0,0,0,0];
      const edge=library.placed().find(i=>i.id==='border-outfall')?.edge,home=edge && A.byId(edge.near);
      const gate=home && chartFor(home,edge,library.world.params.radius);
      borderChart=gate?[home.latitude,home.longitude,gate.eastM/1000,gate.northM/1000]:[0,0,0,0];
      borderSurvey=gate?[Math.cos(gate.angle),Math.sin(gate.angle),Math.min(gate.halfWidthM,halfLengthM)/1000,farEdgeM/1000]:[0,0,0,0];
      api.mapData=()=>({data:built.data,width:WIDTH,height:built.height,revision,borderChart,borderSurvey,transportChart,transportWidths});
      revision++;
      const priorActive = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0 + UNIT);
      const priorBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
      texture ??= gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, WIDTH, built.height, 0, gl.RGBA, gl.FLOAT, built.data);
      gl.bindTexture(gl.TEXTURE_2D, priorBinding); gl.activeTexture(priorActive);
      Object.assign(state, { plots: A.TOTAL, installed: library.installed().filter(i=>Number.isInteger(i.plot)).length, placed: items.length, construction: built.construction, textureBytes: built.data.byteLength, buildMs: +(performance.now() - started).toFixed(2) });
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
        gl.uniform4fv(uniforms.uTransportChart,transportChart);gl.uniform4fv(uniforms.uTransportWidths,transportWidths);
        gl.uniform4fv(uniforms.uBorderChart,borderChart);gl.uniform4fv(uniforms.uBorderSurvey,borderSurvey);
        gl.uniform1i(uniforms.uInstalledBiomes, UNIT); gl.uniform1i(uniforms.uInstalledBiomesOn, 1);
        gl.uniform3fv(uniforms.uAtlasAxis, frame.axis); gl.uniform3fv(uniforms.uAtlasRight, frame.right); gl.uniform3fv(uniforms.uAtlasUp, frame.up);
        try { draw(); } finally { gl.uniform1i(uniforms.uInstalledBiomesOn,0); gl.activeTexture(gl.TEXTURE0 + UNIT); gl.bindTexture(gl.TEXTURE_2D, priorBinding); gl.activeTexture(priorActive); state.frames++; }
      },
      inspect: () => ({ ...state }),
      dispose() { if (disposed) return; disposed = true; if (compiled && compiled!==shared) gl.deleteProgram(compiled.program); if (texture) gl.deleteTexture(texture); compiled = texture = null; }
    };

    // The normal bootstrap links the atlas into Main once. Standalone hosts can still supply the original shell.
    const shared=renderer.modernUniforms?.uInstalledBiomes
      ? {program:renderer.modernProgram,uniforms:renderer.modernUniforms} : null;
    let compiling = false;
    const refresh = async () => {
      if (disposed || compiling) return;
      try {
        if (!compiled) {
          compiling = true;
          state.status = 'compiling';
          const started = performance.now();
          compiled = shared ?? await compile(gl, window.SphereShaders.vertex, assemble(window.SphereShaders.fragment, A));
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

  const api = { inspect: () => ({ ...state }), build, assemble, glsl, mapData:()=>null, show() {} };
  window.SphereBiomeSurface = api;
  api.ready=start();
})();
