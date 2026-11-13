/* The Sideways City: an endless city built for people fifty feet across.
 *
 * Self-contained. Its own renderer, world, movement and save; it imports nothing
 * from any other pack. It implements the Sphere biome contract, version 1:
 *
 *   window.SphereBiome = {
 *     contract: 'sphere-biome/1', id, version,
 *     ready      Promise, resolves when the first frame has been drawn
 *     arrived    Promise, resolves when a from-the-air arrival has finished
 *     pose()     { eastM, northM, altitudeM, yaw, pitch, mode }
 *     ascend(o)  scripted lift-off; resolves 'revealed' or 'taken-over'. It never
 *                moves the saved place. o.toAltitudeM asks for a greater height and
 *                o.handoff for a straight-down view there, so the host can exchange
 *                the picture with its own at the same height.
 *     begin()    start a held arrival (see below); returns `arrived`
 *     save()     write the current place now
 *     dispose()  stop, save, release GPU resources
 *   }
 *   Arrival is chosen by the address: ?arrival=saved (default) | ground | air.
 *   With air, &fromM=<metres> starts the approach straight down from that height
 *   and &hold=1 waits, unseen and ready, until the host calls begin().
 *   An element with id "leavePack" asks to leave. pagehide saves and disposes.
 *
 * Everything is derived from the body it was built for: a crab about 15 m across
 * that walks sideways and does not climb stairs. Doors are far wider than tall.
 * Streets are 60 m. Every curb is 1.5 m, a comfortable step for them and a wall
 * for you; the ramps they use to mount a block are the only way you get up.
 */
const ID = 'sideways-city', VERSION = '1.0.0', SAVE_KEY = 'sphere-biome:' + ID + ':' + VERSION;
const CELL = 200, PLINTH = 70, CURB = 1.5, EYE = 1.7, RAMP = 9, RAMP_HALF = 10, RADIUS = 8;
const REVEAL_M = 3000;
const $ = id => document.getElementById(id);
const canvas = $('world');

/* ---- deterministic city ---- */
function hash(ix, iz, k) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const STONE = [[.78, .62, .52], [.72, .56, .50], [.80, .70, .58], [.66, .58, .55]];
const ROOF = [[.34, .52, .50], [.42, .36, .44], [.55, .40, .30]];
function describe(ix, iz) {
  const k = hash(ix, iz, 1), kind = k < .10 ? 'pool' : k < .19 ? 'plaza' : 'block', boxes = [];
  if (kind === 'block') {
    const w = 34 + hash(ix, iz, 2) * 24, d = 26 + hash(ix, iz, 3) * 30, h = 14 + hash(ix, iz, 4) * 16;
    const cx = (hash(ix, iz, 5) - .5) * (PLINTH - w) * 1.2, cz = (hash(ix, iz, 6) - .5) * (PLINTH - d) * 1.2;
    boxes.push({ x0: cx - w, x1: cx + w, z0: cz - d, z1: cz + d, h, tiers: 1 + Math.floor(hash(ix, iz, 7) * 3) });
    if (hash(ix, iz, 8) < .22) { const r = 13 + hash(ix, iz, 9) * 7, tx = (hash(ix, iz, 10) < .5 ? -1 : 1) * (PLINTH - r - 3), tz = (hash(ix, iz, 11) < .5 ? -1 : 1) * (PLINTH - r - 3); boxes.push({ x0: tx - r, x1: tx + r, z0: tz - r, z1: tz + r, h: 80 + hash(ix, iz, 12) * 90, tower: r }); }
  }
  if (kind === 'plaza') { for (let i = -1; i <= 1; i++) for (const s of [-13, 13]) boxes.push({ x0: i * 46 + s - 1, x1: i * 46 + s + 1, z0: -1.2, z1: 1.2, h: 7, prop: true }); boxes.push({ x0: -4, x1: 4, z0: 34, z1: 42, h: 22, prop: true }); }
  return { kind, boxes, stone: STONE[Math.floor(hash(ix, iz, 13) * STONE.length)], roof: ROOF[Math.floor(hash(ix, iz, 14) * ROOF.length)] };
}
const cells = new Map();
function cell(ix, iz) { const key = ix + ',' + iz; let c = cells.get(key); if (!c) { c = describe(ix, iz); cells.set(key, c); if (cells.size > 4000) cells.delete(cells.keys().next().value); } return c; }
const local = v => v - Math.round(v / CELL) * CELL, index = v => Math.round(v / CELL);

// Height of the walkable surface, and whether something solid stands there.
function ground(x, z) {
  const c = cell(index(x), index(z)), lx = local(x), lz = local(z), ax = Math.abs(lx), az = Math.abs(lz);
  if (c.kind === 'plaza') return 0;
  if (ax <= PLINTH && az <= PLINTH) return c.kind === 'pool' && ax < PLINTH - 6 && az < PLINTH - 6 ? CURB - .4 : CURB;
  if (ax > PLINTH && ax <= PLINTH + RAMP && az <= RAMP_HALF) return CURB * (PLINTH + RAMP - ax) / RAMP;
  if (az > PLINTH && az <= PLINTH + RAMP && ax <= RAMP_HALF) return CURB * (PLINTH + RAMP - az) / RAMP;
  return 0;
}
function solid(x, z, y) {
  const c = cell(index(x), index(z)), lx = local(x), lz = local(z);
  for (const b of c.boxes) if (lx > b.x0 - .6 && lx < b.x1 + .6 && lz > b.z0 - .6 && lz < b.z1 + .6 && y < CURB + b.h + 1) return true;
  return false;
}

/* ---- geometry for one cell: position, colour, normal ---- */
function build(ix, iz) {
  const c = cell(ix, iz), out = [];
  const tri = (a, b, d, col) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l); for (const p of [a, b, d]) out.push(p[0], p[1], p[2], col[0], col[1], col[2], n[0], n[1], n[2]); };
  const quad = (a, b, d, e, col) => { tri(a, b, d, col); tri(a, d, e, col); };
  const box = (x0, y0, z0, x1, y1, z1, col, top = col) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col); quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], col);
    quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], col); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
  };
  const dark = [.06, .05, .06], water = [.10, .36, .40], shade = c.stone.map(v => v * .86);
  if (c.kind !== 'plaza') {
    box(-PLINTH, 0, -PLINTH, PLINTH, CURB, PLINTH, shade, c.kind === 'pool' ? shade : c.stone);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // the ramps: their way up, and yours
      const p = (along, out2, y) => sx ? [sx * out2, y, along] : [along, y, sz * out2];
      quad(p(-RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH + RAMP, 0), p(-RAMP_HALF, PLINTH + RAMP, 0), c.stone.map(v => v * .94));
      tri(p(-RAMP_HALF, PLINTH, CURB), p(-RAMP_HALF, PLINTH + RAMP, 0), p(-RAMP_HALF, PLINTH, 0), shade); tri(p(RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH, 0), p(RAMP_HALF, PLINTH + RAMP, 0), shade);
    }
  }
  if (c.kind === 'pool') { quad([-PLINTH + 6, CURB - .4, -PLINTH + 6], [PLINTH - 6, CURB - .4, -PLINTH + 6], [PLINTH - 6, CURB - .4, PLINTH - 6], [-PLINTH + 6, CURB - .4, PLINTH - 6], water); }
  if (c.kind === 'plaza') {   // resting rails: a bar at shell height on two posts
    for (let i = -1; i <= 1; i++) { const x = i * 46; box(x - 14, 0, -1.2, x - 12, 7, 1.2, shade); box(x + 12, 0, -1.2, x + 14, 7, 1.2, shade); box(x - 15, 7, -1.6, x + 15, 8.2, 1.6, c.roof); }
    box(-4, 0, 34, 4, 22, 42, c.stone, c.roof);
  }
  for (const b of c.boxes) {
    if (b.prop) continue;   // drawn with the plaza above; listed only so it is solid
    if (b.tower) {
      const n = 12, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, r = b.tower, top = CURB + b.h;
      for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, a2 = (i + 1) * 2 * Math.PI / n, p = [cx + r * Math.cos(a), cz + r * Math.sin(a)], q = [cx + r * Math.cos(a2), cz + r * Math.sin(a2)];
        quad([p[0], CURB, p[1]], [q[0], CURB, q[1]], [q[0], top, q[1]], [p[0], top, p[1]], i % 2 ? c.stone : shade); tri([p[0], top, p[1]], [q[0], top, q[1]], [cx, top + r * .5, cz], c.roof); }
      continue;
    }
    let { x0, x1, z0, z1 } = b, y = CURB;
    for (let t = 0; t < b.tiers; t++) { const h = b.h / (t + 1); box(x0, y, z0, x1, y + h, z1, t % 2 ? shade : c.stone, c.roof); if (t === 0) {
        // Doors: wider than tall, because they walk in sideways.
        const dw = Math.min(11, (x1 - x0) / 2 - 3), dh = Math.min(9, h - 2), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, dz = Math.min(11, (z1 - z0) / 2 - 3);
        quad([mx - dw, y, z0 - .08], [mx + dw, y, z0 - .08], [mx + dw, y + dh, z0 - .08], [mx - dw, y + dh, z0 - .08], dark); quad([mx + dw, y, z1 + .08], [mx - dw, y, z1 + .08], [mx - dw, y + dh, z1 + .08], [mx + dw, y + dh, z1 + .08], dark);
        quad([x0 - .08, y, mz + dz], [x0 - .08, y, mz - dz], [x0 - .08, y + dh, mz - dz], [x0 - .08, y + dh, mz + dz], dark); quad([x1 + .08, y, mz - dz], [x1 + .08, y, mz + dz], [x1 + .08, y + dh, mz + dz], [x1 + .08, y + dh, mz - dz], dark);
      }
      y += h; const inset = Math.min(x1 - x0, z1 - z0) * .16; x0 += inset; x1 -= inset; z0 += inset; z1 -= inset; }
  }
  return new Float32Array(out);
}

/* ---- renderer ---- */
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
function program(vs, fs) {
  const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
const COMMON = `uniform vec3 uRight,uUp,uForward;uniform float uAspect,uAltitude;
const vec3 SUN=vec3(.46,.78,.42);
vec3 sky(vec3 d){float t=clamp(d.y*.5+.5,0.,1.);vec3 c=mix(vec3(.86,.72,.60),vec3(.36,.52,.70),smoothstep(.45,.95,t));return c+vec3(1.,.85,.6)*pow(max(dot(normalize(d),SUN),0.),90.)*.5;}
float fogOf(float dist){return 1.-exp(-dist/(1500.+uAltitude*7.));}`;
const mesh = program(`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aCol;layout(location=2)in vec3 aNor;
uniform vec3 uOffset;${COMMON}
out vec3 vCol,vNor,vRel;
void main(){vec3 p=aPos+uOffset;float z=dot(p,uForward);gl_Position=vec4(dot(p,uRight)*1.19/uAspect,dot(p,uUp)*1.19,z-.2,z);vCol=aCol;vNor=aNor;vRel=p;}`,
`#version 300 es
precision highp float;in vec3 vCol,vNor,vRel;out vec4 frag;uniform float uFade;${COMMON}
void main(){float dist=length(vRel);vec3 n=normalize(vNor);if(dot(n,vRel)>0.)n=-n;float lit=.34+.66*max(dot(n,SUN),0.)+.10*max(n.y,0.);
 vec3 col=mix(vCol*lit,sky(vRel/dist*vec3(1.,.15,1.)),fogOf(dist));
 gl_FragDepth=clamp(log2(1.+dist)/log2(1.+400000.),0.,1.);frag=vec4(pow(col,vec3(1./2.2)),uFade);}`);
// The far ground: the same street-and-block grid, drawn analytically to the horizon.
const plane = program(`#version 300 es
precision highp float;${COMMON}
out vec2 vNdc;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;vNdc=p;gl_Position=vec4(p,0.,1.);}`,
`#version 300 es
precision highp float;in vec2 vNdc;out vec4 frag;uniform vec2 uCellPhase;${COMMON}
void main(){vec3 d=normalize(uForward+uRight*vNdc.x*uAspect/1.19+uUp*vNdc.y/1.19);
 if(d.y>-.0005){frag=vec4(pow(sky(d),vec3(1./2.2)),1.);gl_FragDepth=1.;return;}
 float t=uAltitude/-d.y;vec2 g=d.xz*t+uCellPhase;vec2 l=abs(fract(g/${CELL}.+.5)-.5)*${CELL}.;
 float width=t*.0022+.5,block=1.-smoothstep(${PLINTH}.-width,${PLINTH}.+width,max(l.x,l.y));
 vec3 street=vec3(.50,.44,.40),stone=vec3(.70,.57,.50);vec3 col=mix(street,stone,block);
 col*=.34+.66*SUN.y+.10;col=mix(col,sky(d*vec3(1.,.15,1.)),fogOf(t));
 gl_FragDepth=clamp(log2(1.+t)/log2(1.+400000.),0.,1.);frag=vec4(pow(col,vec3(1./2.2)),1.);}`);
const buffers = new Map();
function buffer(ix, iz) {
  const key = ix + ',' + iz; let b = buffers.get(key);
  if (!b) { const data = build(ix, iz), vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (const [loc, off] of [[0, 0], [1, 12], [2, 24]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 36, off); }
    b = { vao, vbo, count: data.length / 9 }; buffers.set(key, b);
    if (buffers.size > 900) { const first = buffers.keys().next().value, old = buffers.get(first); gl.deleteBuffer(old.vbo); gl.deleteVertexArray(old.vao); buffers.delete(first); } }
  return b;
}
const blank = gl.createVertexArray();

/* ---- state, save ---- */
const start = () => ({ eastM: 0, northM: -86, altitudeM: EYE, yaw: 0, pitch: 0, mode: 'walk' });
let pose = start(), bookmark = start(), script = null, held = null, disposed = false, frames = 0, built = 0, drawn = 0;
const valid = p => p && ['eastM', 'northM', 'altitudeM', 'yaw', 'pitch'].every(k => Number.isFinite(p[k])) && ['walk', 'flight'].includes(p.mode);
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s?.schema === 1 && valid(s.pose) && valid(s.bookmark)) { pose = { ...s.pose }; bookmark = { ...s.bookmark }; return true; } } catch {} return false; }
// A scripted ascent or arrival never moves the saved place. While one runs, and after it
// until you take the controls, the place saved is the one you last stood in yourself.
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: 1, pose: script?.keep ?? held ?? pose, bookmark })); return true; } catch { return false; } }
const status = text => { $('status').textContent = text; };

/* ---- movement ---- */
const keys = new Set(); let drag = null, last = 0;
const forward = () => [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), Math.cos(pose.yaw) * Math.cos(pose.pitch)];
function interrupt() { held = null; if (script?.interruptible) { const done = script.done; script = null; done('taken-over'); status('You have the controls.'); } }
function lift() { if (pose.mode === 'walk') { pose.mode = 'flight'; pose.altitudeM += 12; status('Flying · W goes where you look · Q down, E up · F lands'); } }
function land() { const g = ground(pose.eastM, pose.northM); if (pose.mode === 'flight' && pose.altitudeM - g < 14 && !solid(pose.eastM, pose.northM, 0)) { pose.mode = 'walk'; pose.altitudeM = g + EYE; pose.pitch = Math.max(-1, Math.min(1, pose.pitch)); status('On foot · WASD walks · Space lifts off'); } else status('Come down close to open ground to land.'); }
function step(dt) {
  if (script) { if (script.held) return; const t = Math.min(1, (script.t += dt) / script.seconds), e = script.ease ? script.ease(t) : t * t * (3 - 2 * t); for (const k of ['eastM', 'northM', 'yaw', 'pitch']) pose[k] = script.from[k] + (script.to[k] - script.from[k]) * e;
    pose.altitudeM = Math.exp(Math.log(script.from.altitudeM) + (Math.log(script.to.altitudeM) - Math.log(script.from.altitudeM)) * e); pose.mode = 'flight';
    if (t >= 1) { const done = script.done; held = script.keep; script = null; done('revealed'); } return; }
  const fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), fz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), fy = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0), fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (pose.mode === 'walk') {
    const speed = (fast ? 7 : 3) * dt, dx = (Math.sin(pose.yaw) * fz + Math.cos(pose.yaw) * fx) * speed, dz = (Math.cos(pose.yaw) * fz - Math.sin(pose.yaw) * fx) * speed;
    const here = ground(pose.eastM, pose.northM), attempt = (x, z) => !solid(x, z, here + EYE) && Math.abs(ground(x, z) - here) <= .45;
    if (attempt(pose.eastM + dx, pose.northM)) pose.eastM += dx; if (attempt(pose.eastM, pose.northM + dz)) pose.northM += dz;
    pose.altitudeM = ground(pose.eastM, pose.northM) + EYE;
  } else {
    const g = ground(pose.eastM, pose.northM), clear = Math.max(0, pose.altitudeM - g), speed = (8 + clear * .9) * (fast ? 2 : 1) * dt, f = forward();
    const nx = pose.eastM + (f[0] * fz + Math.cos(pose.yaw) * fx) * speed, nz = pose.northM + (f[2] * fz - Math.sin(pose.yaw) * fx) * speed, ny = Math.max(pose.altitudeM + (f[1] * fz + fy) * speed, ground(nx, nz) + EYE);
    if (!solid(nx, nz, ny)) { pose.eastM = nx; pose.northM = nz; pose.altitudeM = Math.min(ny, 4e6); }
  }
}

/* ---- frame ---- */
let resolveReady; const ready = new Promise(r => { resolveReady = r; });
function draw() {
  const w = Math.max(1, Math.floor(canvas.clientWidth * Math.min(devicePixelRatio, 2))), h = Math.max(1, Math.floor(canvas.clientHeight * Math.min(devicePixelRatio, 2)));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
  const f = forward(), right = [Math.cos(pose.yaw), 0, -Math.sin(pose.yaw)], up = [-Math.sin(pose.yaw) * Math.sin(pose.pitch), Math.cos(pose.pitch), -Math.cos(pose.yaw) * Math.sin(pose.pitch)];
  const common = pr => { gl.useProgram(pr.p); gl.uniform3fv(pr.u.uRight, right); gl.uniform3fv(pr.u.uUp, up); gl.uniform3fv(pr.u.uForward, f); gl.uniform1f(pr.u.uAspect, w / h); gl.uniform1f(pr.u.uAltitude, pose.altitudeM); };
  common(plane); gl.uniform2f(plane.u.uCellPhase, local(pose.eastM), local(pose.northM)); gl.bindVertexArray(blank); gl.drawArrays(gl.TRIANGLES, 0, 3);
  common(mesh); const cx = index(pose.eastM), cz = index(pose.northM); let made = 0;
  // Buildings fade out between 1.5 and 2.5 km instead of vanishing; above that the far ground carries the picture.
  const fade = 1 - Math.min(1, Math.max(0, (pose.altitudeM - 1500) / 1000)); drawn = 0;
  if (fade > 0) {
    if (fade < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    gl.uniform1f(mesh.u.uFade, fade);
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const key = (cx + dx) + ',' + (cz + dz); if (!buffers.has(key)) { if (made >= 24) continue; made++; built++; }   // at most 24 new cells a frame
      const b = buffer(cx + dx, cz + dz), ox = (cx + dx) * CELL - pose.eastM, oz = (cz + dz) * CELL - pose.northM;
      if (ox * f[0] - pose.altitudeM * f[1] + oz * f[2] < -260) continue;   // wholly behind the eye
      gl.uniform3f(mesh.u.uOffset, ox, -pose.altitudeM, oz); gl.bindVertexArray(b.vao); gl.drawArrays(gl.TRIANGLES, 0, b.count); drawn++;
    }
    gl.disable(gl.BLEND);
  } else if (script?.to) {   // too high to see buildings: build the ones waiting at the end of the approach
    const tx = index(script.to.eastM), tz = index(script.to.northM);
    for (let dz = -RADIUS; dz <= RADIUS && made < 24; dz++) for (let dx = -RADIUS; dx <= RADIUS && made < 24; dx++) if (!buffers.has((tx + dx) + ',' + (tz + dz))) { buffer(tx + dx, tz + dz); made++; built++; }
  }
  frames++; if (frames === 3) resolveReady();
}
function hud() {
  $('mode').textContent = script ? 'JOURNEY' : pose.mode === 'walk' ? 'WALK' : 'FLIGHT';
  const g = ground(pose.eastM, pose.northM), up2 = pose.altitudeM - g;
  $('where').textContent = `E ${pose.eastM.toFixed(0)} m · N ${pose.northM.toFixed(0)} m · ${up2 < 1000 ? up2.toFixed(1) + ' m' : (up2 / 1000).toFixed(2) + ' km'} above the street`;
}
function frame(t) {
  if (disposed) return;
  const dt = Math.min(.25, last ? (t - last) / 1000 : 0); last = t;
  try { step(dt); draw(); if (frames % 6 === 0) hud(); } catch (error) { $('error').textContent = error.message; disposed = true; return; }
  requestAnimationFrame(frame);
}

/* ---- contract ---- */
function ascend(options) {
  if (script) return Promise.resolve('taken-over');
  status('Lifting off. The city goes on.');
  const handoff = options?.handoff === true, top = Math.min(4e6, Math.max(REVEAL_M, Number(options?.toAltitudeM) || REVEAL_M));
  const from = { ...pose }, to = { ...pose, altitudeM: top, pitch: handoff ? -1.5 : -.9, yaw: pose.yaw + .5 };
  if (from.mode === 'walk') from.altitudeM = Math.max(from.altitudeM, EYE);
  // For a handoff the climb keeps gathering pace to the end, so the host's picture can take over a view already moving.
  return new Promise(done => { script = { from, to, keep: held ?? { ...pose }, t: 0, seconds: 16, done, interruptible: true, ease: handoff ? t => .25 * t + .75 * t * t * t : null }; });
}
let resolveArrived; const arrived = new Promise(r => { resolveArrived = r; });
function arriveFromAir(keep, fromM, hold) {
  const to = { eastM: 0, northM: -150, altitudeM: 60, yaw: 0, pitch: -.32, mode: 'flight' }, high = fromM > 2400;
  const from = high ? { ...to, northM: -1650, altitudeM: Math.min(fromM, 4e6), pitch: -1.5 } : { ...to, northM: -5200, altitudeM: 2400, pitch: -.42 };
  pose = { ...from }; status('On approach.');
  // From a great height the descent starts at full pace (the host's picture was already falling) and settles at the end.
  script = { from, to, keep, t: 0, seconds: high ? 13.5 : 13, held: hold, ease: high ? t => 1 - (1 - t) ** 3 : null, interruptible: false, done: () => { status('Arrived above the city · Q descends · F lands'); resolveArrived('arrived'); } };
}
function begin() { if (script?.held) script.held = false; return arrived; }
function dispose() { if (disposed) return; save(); disposed = true; for (const b of buffers.values()) { gl.deleteBuffer(b.vbo); gl.deleteVertexArray(b.vao); } buffers.clear(); gl.deleteProgram(mesh.p); gl.deleteProgram(plane.p); }

const query = new URLSearchParams(location.search), arrival = query.get('arrival') ?? 'saved', had = load();
if (arrival === 'ground' || (arrival === 'saved' && !had)) pose = start();
if (arrival === 'air') arriveFromAir(had ? { ...pose } : start(), Number(query.get('fromM')) || 0, query.get('hold') === '1'); else resolveArrived('ground');
window.SphereBiome = { contract: 'sphere-biome/1', id: ID, version: VERSION, ready, arrived, pose: () => ({ ...pose }), ascend, begin, save, dispose, inspect: () => ({ frames, cellsBuilt: built, buffers: buffers.size, cellsDrawn: drawn, scripted: !!script, held: !!script?.held }) };

canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', e => { if (!drag || script) return; held = null; pose.yaw += (e.clientX - drag[0]) * .004; pose.pitch = Math.max(-1.5, Math.min(1.5, pose.pitch - (e.clientY - drag[1]) * .004)); drag = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('keydown', e => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { e.preventDefault(); interrupt(); } if (e.code === 'Space' && !e.repeat) lift(); if (e.code === 'KeyF' && !e.repeat) land(); keys.add(e.code); });
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('pagehide', dispose);
$('lift').onclick = () => { interrupt(); lift(); canvas.focus(); };
$('land').onclick = () => { land(); canvas.focus(); };
$('save').onclick = () => { bookmark = { ...pose }; status(save() ? 'Place saved.' : 'This browser would not keep the save.'); };
$('back').onclick = () => { if (!script) { pose = { ...bookmark }; status('Back at your saved place.'); } };
$('leavePack').onclick = () => { dispose(); location.assign(new URL('../../../index.html', import.meta.url).href); };
setInterval(() => { if (!disposed) save(); }, 5000);
status(pose.mode === 'walk' ? 'On foot · WASD walks · drag to look · Space lifts off' : 'Flying · W goes where you look');
requestAnimationFrame(frame);
