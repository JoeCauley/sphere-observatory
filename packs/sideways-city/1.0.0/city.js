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
 *   With air, &fromM=<metres> (or fromM=blind, the middle of its own Duck Blind) starts the approach straight down from that height
 *   and &hold=1 waits, unseen and ready, until the host calls begin().
 *   An element with id "leavePack" asks to leave. pagehide saves and disposes.
 *
 * Everything is derived from the body it was built for: a crab about 15 m across
 * that walks sideways and does not climb stairs. Doors are far wider than tall.
 * Streets are 60 m. Every curb is 1.5 m, a comfortable step for them and a wall
 * for you; the ramps they use to mount a block are the only way you get up.
 */
import { ascentShape, arrivalShape, advance, heightAt } from '../../kit/flight.js';   // shared pacing; the kit is not a pack
const ID = 'sideways-city', VERSION = '1.0.0', SAVE_KEY = 'sphere-biome:' + ID + ':' + VERSION;
import {CELL, PLINTH, CURB, EYE, RAMP, RAMP_HALF, hash, cell, local, index, ground, solid} from './ground.js';
import {COMMON,cityPlaneShaders,lightUniforms} from './streets.mjs';
import {lightFor,REFERENCE_LIGHT} from '../../kit/destination-light.mjs';
import {linkProgram} from '../../kit/parallel-program.mjs';
import {trialSettings} from '../../kit/doorway-trial.mjs';
import {surveyUniforms} from './exterior.mjs';
const RADIUS=8;
const REVEAL_M = 3000, MESH_BELOW_M = 600;
// The air, declared rather than built in, so that biomes can differ: thin, thick, layered.
// haze: level layers of air, each with a base, a top and how much it dims per kilometre of path.
// blind: the Duck Blind band. Canon: seen from above, the ground below is discernible; crossing
// it is a few seconds of obscuring cloud. So it veils the eye only while the eye is inside it.
// Every height here is PROPOSED for this prototype; no kilometre value is canon.
const AIRS = {
  thin: { profile:'city-thin', haze: [{ baseM: 0, topM: 400, perKm: .5 }, { baseM: 0, topM: 4000, perKm: .08 }], blind: null },
  thick: { profile:'city-smog', haze: [{ baseM: 0, topM: 1500, perKm: .9 }, { baseM: 0, topM: 9000, perKm: .25 }], blind: { baseM: 11000, topM: 13000, edgeM: 1200 } }
};
const AIR = AIRS[new URLSearchParams(location.search).get('air')] ?? AIRS.thin;
const HAZE = new Float32Array(AIR.haze.flatMap(l => [l.baseM, l.topM, l.perKm / 1000, 0]));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const veilAt = m => !AIR.blind?0:smooth(AIR.blind.baseM - AIR.blind.edgeM, AIR.blind.baseM, m) * (1 - smooth(AIR.blind.topM, AIR.blind.topM + AIR.blind.edgeM, m));
const FAR_ONLY = new URLSearchParams(location.search).get('far') === '1';   // test aid: trace everything, to compare with the meshes
const $ = id => document.getElementById(id);
const canvas = $('world');
const hosted=!!frameElement?.dataset.worldKey,hand=hosted?-1:1;
const graphicsLifetime = new AbortController();
const linkedPrograms = new Set();
const exterior = hosted ? await import('../../kit/station-exterior.mjs') : null;
const facade = exterior && frameElement?.isConnected ? exterior.packStationExterior(parent, canvas,
  parent.SphereBiomeLibrary.entry(frameElement.dataset.locationId), {logDepthFarM:400000}) : null;
const reserved=(x,z)=>facade?.occupies(index(x)*CELL,index(z)*CELL,PLINTH);
const walkHeight=(x,z)=>reserved(x,z)?0:ground(x,z);
const obstruction=(x,z,h)=>!reserved(x,z)&&solid(x,z,h);
const lens=(w,h)=>frameElement?.surfaceEntry?.horizontalFov?w/h/Math.tan(frameElement.surfaceEntry.horizontalFov*Math.PI/360):1.19;

/* ---- geometry for one cell: position, colour, normal ---- */
function build(ix, iz) {
  const c = cell(ix, iz), out = [];
  const tri = (a, b, d, col) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l); for (const p of [a, b, d]) out.push(p[0], p[1], p[2], col[0], col[1], col[2], n[0], n[1], n[2]); };
  const quad = (a, b, d, e, col) => { tri(a, b, d, col); tri(a, d, e, col); };
  const box = (x0, y0, z0, x1, y1, z1, col, top = col) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col); quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], col);
    quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], col); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col);
    if (top) quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
  };
  const dark = [.06, .05, .06], water = [.10, .36, .40], shade = c.stone.map(v => v * .86);
  if (c.kind !== 'plaza') {
    box(-PLINTH, 0, -PLINTH, PLINTH, CURB, PLINTH, shade, c.kind === 'pool' ? null : c.stone);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // the ramps: their way up, and yours
      const p = (along, out2, y) => sx ? [sx * out2, y, along] : [along, y, sz * out2];
      quad(p(-RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH + RAMP, 0), p(-RAMP_HALF, PLINTH + RAMP, 0), c.stone.map(v => v * .94));
      tri(p(-RAMP_HALF, PLINTH, CURB), p(-RAMP_HALF, PLINTH + RAMP, 0), p(-RAMP_HALF, PLINTH, 0), shade); tri(p(RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH, 0), p(RAMP_HALF, PLINTH + RAMP, 0), shade);
    }
  }
  if (c.kind === 'pool') {   // one level top, nothing stacked: a stone rim around a water panel (stacked sheets flicker when seen from low down)
    const P = PLINTH, I = PLINTH - 6, top = (x0, z0, x1, z1, col) => quad([x0, CURB, z0], [x1, CURB, z0], [x1, CURB, z1], [x0, CURB, z1], col);
    top(-P, -P, P, -I, shade); top(-P, I, P, P, shade); top(-P, -I, -I, I, shade); top(I, -I, P, I, shade); top(-I, -I, I, I, water);
  }
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
async function program(vs, fs) {
  const p = await linkProgram(gl, vs, fs, graphicsLifetime.signal);
  linkedPrograms.add(p);
  const u = {}; for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
const meshReady = program(`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aCol;layout(location=2)in vec3 aNor;
uniform vec3 uOffset;${COMMON}
out vec3 vCol,vNor,vRel;
void main(){vec3 p=aPos+uOffset;float z=dot(p,uForward);gl_Position=vec4(dot(p,uRight)*uFocal/uAspect,dot(p,uUp)*uFocal,z-.2,z);vCol=aCol;vNor=aNor;vRel=p;}`,
`#version 300 es
precision highp float;in vec3 vCol,vNor,vRel;out vec4 frag;uniform float uFade;${COMMON}
void main(){float dist=length(vRel);vec3 n=normalize(vNor);if(dot(n,vRel)>0.)n=-n;float lit=uLight.x+uLight.y*max(dot(n,SUN),0.)+.10*max(n.y,0.);
 vec3 col=veiled(mix(vCol*lit,sky(vRel/dist*vec3(1.,.15,1.)),fogOf(dist,vRel.y/dist)),vRel/dist);
 gl_FragDepth=clamp(log2(1.+dist)/log2(1.+400000.),0.,1.);frag=vec4(pow(col,vec3(1./2.2)),uFade);}`);
const planeReady = program(...cityPlaneShaders);
const programsReady = Promise.all([meshReady, planeReady]).then(
  programs => ({programs}), error => ({error})
);
let mesh, plane;
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
let pose = start(), bookmark = start(), script = null, held = null, disposed = false, frames = 0, built = 0, drawn = 0, meshRing = -1;
const valid = p => p && ['eastM', 'northM', 'altitudeM', 'yaw', 'pitch'].every(k => Number.isFinite(p[k])) && ['walk', 'flight'].includes(p.mode);
const placeStore = window.frameElement?.dataset.worldKey ? parent.SphereBiomeLibrary.saveStorage(window.frameElement.dataset.worldKey) : localStorage;
function load() { try { const s = JSON.parse(placeStore.getItem(SAVE_KEY)); if (s?.schema === 1 && valid(s.pose) && valid(s.bookmark)) { pose = { ...s.pose }; bookmark = { ...s.bookmark }; return true; } } catch {} return false; }
// A scripted ascent or arrival never moves the saved place. While one runs, and after it
// until you take the controls, the place saved is the one you last stood in yourself.
function save() { if(window.frameElement?.surfaceEntry?.active===false)return false;try { placeStore.setItem(SAVE_KEY, JSON.stringify({ schema: 1, pose: script?.keep ?? held ?? pose, bookmark })); return true; } catch { return false; } }
const status = text => { $('status').textContent = text; };

/* ---- movement ---- */
const keys = new Set(); let drag = null, last = 0;
const forward = () => [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), Math.cos(pose.yaw) * Math.cos(pose.pitch)];
function interrupt() { held = null; if (script?.interruptible) { const done = script.done; script = null; done('taken-over'); status('You have the controls.'); } }
function lift() { if (pose.mode === 'walk') { pose.mode = 'flight'; pose.altitudeM += 12; status('Flying · W goes where you look · Q down, E up · F lands'); } }
function land() { const g = walkHeight(pose.eastM, pose.northM); if (pose.mode === 'flight' && pose.altitudeM - g < 14 && !obstruction(pose.eastM, pose.northM, 0)) { pose.mode = 'walk'; pose.altitudeM = g + EYE; pose.pitch = Math.max(-1, Math.min(1, pose.pitch)); status('On foot · WASD walks · Space lifts off'); } else status('Come down close to open ground to land.'); }
function step(dt) {
  if (script) { if (script.held) return; const { pos: e, alt: ea, done: over } = advance(script, dt); for (const k of ['eastM', 'northM', 'yaw', 'pitch']) pose[k] = script.from[k] + (script.to[k] - script.from[k]) * e;
    pose.altitudeM = heightAt(script.from.altitudeM, script.to.altitudeM, ea); pose.mode = 'flight';
    if (over) { const done = script.done; held = script.keep; script = null; done('revealed'); } return; }
  const turn = hand * .95 * dt;
  pose.yaw += (Number(keys.has('ArrowRight') || keys.has('KeyX')) - Number(keys.has('ArrowLeft') || keys.has('KeyZ'))) * turn;
  pose.pitch = Math.max(-1.5, Math.min(1.5, pose.pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * turn));
  const fx = hand*((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)), fz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), fy = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0), fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (pose.mode === 'walk') {
    const speed = (fast ? 7 : 3) * dt, dx = (Math.sin(pose.yaw) * fz + Math.cos(pose.yaw) * fx) * speed, dz = (Math.cos(pose.yaw) * fz - Math.sin(pose.yaw) * fx) * speed;
    const here = walkHeight(pose.eastM, pose.northM), attempt = (x, z) => !obstruction(x, z, here + EYE) && Math.abs(walkHeight(x, z) - here) <= .45;
    if (attempt(pose.eastM + dx, pose.northM)) pose.eastM += dx; if (attempt(pose.eastM, pose.northM + dz)) pose.northM += dz;
    pose.altitudeM = walkHeight(pose.eastM, pose.northM) + EYE;
  } else {
    const g = walkHeight(pose.eastM, pose.northM), clear = Math.max(0, pose.altitudeM - g), base = (8 + clear * .9) * (fast ? 2 : 1), f = forward();
    const stage=window.frameElement?.dataset.worldKey?parent.SphereStageFrame:null;
    const rate=(fx||fz||fy)?stage?.movementSpeed(base,dt,{boost:fast})??base:base;
    const speed=rate*dt/Math.max(1,Math.hypot(fx,fz*Math.cos(pose.pitch),fz*f[1]+fy));
    const nx = pose.eastM + (f[0] * fz + Math.cos(pose.yaw) * fx) * speed, nz = pose.northM + (f[2] * fz - Math.sin(pose.yaw) * fx) * speed, ny = Math.max(pose.altitudeM + (f[1] * fz + fy) * speed, walkHeight(nx, nz) + EYE);
    if (!obstruction(nx, nz, ny)) { pose.eastM = nx; pose.northM = nz; pose.altitudeM = Math.min(ny, 4e6); }
  }
}

/* ---- light ---- */
// The same destinationLight() the doorway uses, sampled for this pose at the shared Sphere time.
let cityLight=REFERENCE_LIGHT,lightSampled=-Infinity;
function currentLight(){
  const now=performance.now();if(now-lightSampled<250)return cityLight;lightSampled=now;
  const host=window.frameElement?.dataset.worldKey?parent:null;
  if(!host){cityLight=REFERENCE_LIGHT;return cityLight;}
  const settings=trialSettings(host),sample=host.SphereStageFrame?.surfaceLight?.(window,pose);
  cityLight=lightFor(settings,sample?.direct??1,host.SphereApp?.getState?.().shellshine);
  return cityLight;
}

/* ---- frame ---- */
let resolveReady,rejectReady; const ready = new Promise((r,j) => { resolveReady = r;rejectReady=j; });
function draw() {
  const fieldSize=hosted && parent.SphereFieldCamera?.need(canvas) && parent.SphereFieldCamera.size(canvas.getBoundingClientRect());
  const w=fieldSize?.width??Math.max(1,Math.floor(canvas.clientWidth*Math.min(devicePixelRatio,2)));
  const h=fieldSize?.height??Math.max(1,Math.floor(canvas.clientHeight*Math.min(devicePixelRatio,2)));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
  const focal=lens(w,h),field=facade?.sync(pose);
  const f = forward(), right = [hand*Math.cos(pose.yaw), 0, -hand*Math.sin(pose.yaw)], up = [-Math.sin(pose.yaw) * Math.sin(pose.pitch), Math.cos(pose.pitch), -Math.cos(pose.yaw) * Math.sin(pose.pitch)];
  const light=currentLight();
  const common = pr => { gl.useProgram(pr.p); lightUniforms(gl,pr.u,light); gl.uniform3fv(pr.u.uRight, right); gl.uniform3fv(pr.u.uUp, up); gl.uniform3fv(pr.u.uForward, f); gl.uniform1f(pr.u.uAspect, w / h); gl.uniform1f(pr.u.uFocal,focal); gl.uniform1f(pr.u.uAltitude, pose.altitudeM); gl.uniform4fv(pr.u['uHaze[0]'], HAZE); gl.uniform3f(pr.u.uBlind, AIR.blind?.baseM??0, AIR.blind?.topM??0, AIR.blind?.edgeM??0); gl.uniform1f(pr.u.uTime, performance.now() / 1000); };
  // Near the eye: full meshes, nearest ring first. meshRing is the widest ring that is complete;
  // the ground shader traces everything outside it, so a cell is always drawn exactly once.
  const cx = index(pose.eastM), cz = index(pose.northM); let made = 0; meshRing = -1;
  if (!FAR_ONLY && pose.altitudeM < MESH_BELOW_M) {
    for (let r = 0; r <= RADIUS; r++) {
      let whole = true;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || buffers.has((cx + dx) + ',' + (cz + dz))) continue;
        if (made >= 24) { whole = false; continue; }   // at most 24 new cells a frame
        buffer(cx + dx, cz + dz); made++; built++;
      }
      if (!whole) break;
      meshRing = r;
    }
  } else if (script?.to) {   // above the meshes: build the ones waiting at the end of the approach
    const tx = index(script.to.eastM), tz = index(script.to.northM);
    for (let dz = -RADIUS; dz <= RADIUS && made < 24; dz++) for (let dx = -RADIUS; dx <= RADIUS && made < 24; dx++) if (!buffers.has((tx + dx) + ',' + (tz + dz))) { buffer(tx + dx, tz + dz); made++; built++; }
  }
  common(plane); gl.uniform2i(plane.u.uCell, cx, cz); gl.uniform2f(plane.u.uLocal, local(pose.eastM), local(pose.northM)); gl.uniform1i(plane.u.uMesh, meshRing); gl.uniform1f(plane.u.uPix, 2 / (focal * h)); surveyUniforms(gl,plane.u,field);
  gl.bindVertexArray(blank); gl.drawArrays(gl.TRIANGLES, 0, 3);
  common(mesh); gl.uniform1f(mesh.u.uFade, 1); drawn = 0;
  for (let dz = -meshRing; dz <= meshRing; dz++) for (let dx = -meshRing; dx <= meshRing; dx++) {
    const b = buffers.get((cx + dx) + ',' + (cz + dz)), ox = (cx + dx) * CELL - pose.eastM, oz = (cz + dz) * CELL - pose.northM;
    if (!b || facade?.occupies((cx+dx)*CELL,(cz+dz)*CELL,PLINTH) || ox * f[0] - pose.altitudeM * f[1] + oz * f[2] < -260) continue;   // wholly behind the eye
    gl.uniform3f(mesh.u.uOffset, ox, -pose.altitudeM, oz); gl.bindVertexArray(b.vao); gl.drawArrays(gl.TRIANGLES, 0, b.count); drawn++;
  }
  facade?.draw(pose,w,h,focal);
  if(hosted)parent.SphereFieldCamera?.submit(canvas);
  frames++; if (resolveReady && frames>=3 && !facade?.pending) {
    if(facade?.error)rejectReady(facade.error);else resolveReady();
    resolveReady=null;
  }
}
function hud() {
  $('mode').textContent = script ? 'JOURNEY' : pose.mode === 'walk' ? 'WALK' : 'FLIGHT';
  const g = walkHeight(pose.eastM, pose.northM), up2 = pose.altitudeM - g;
  $('where').textContent = `E ${pose.eastM.toFixed(0)} m · N ${pose.northM.toFixed(0)} m · ${up2 < 1000 ? up2.toFixed(1) + ' m' : (up2 / 1000).toFixed(2) + ' km'} above the street`;
}
function frame(t) {
  if (disposed) return;
  const dt = Math.min(.25, last ? (t - last) / 1000 : 0); last = t;
  if (frameElement?.surfaceEntry?.standby && frames >= 3 && !resolveReady) {
    requestAnimationFrame(frame);
    return;
  }
  try { const prev=facade?{...pose}:null;step(dt);
    if (facade)pose=facade.constrain(prev,pose);
    draw();
    if(frameElement?.dataset.worldKey)parent.SphereStageFrame?.presentCamera?.(window,pose,canvas.width/canvas.height,lens(canvas.width,canvas.height));
    if (frames % 6 === 0) hud(); } catch (error) { $('error').textContent = error.message; rejectReady(error); dispose(); return; }
  requestAnimationFrame(frame);
}

/* ---- contract ---- */
function ascend(options) {
  if (script) return Promise.resolve('taken-over');
  status('Lifting off. The city goes on.');
  const handoff = options?.handoff === true, top = Math.min(4e6, Math.max(REVEAL_M, Number(options?.toAltitudeM) || REVEAL_M));
  if (pose.altitudeM >= top * .98) return Promise.resolve('revealed');   // already there
  const from = { ...pose }, to = { ...pose, altitudeM: top, pitch: handoff ? -1.5 : -.9, yaw: pose.yaw + 1.7 };   // the view turns as it climbs
  if (from.mode === 'walk') from.altitudeM = Math.max(from.altitudeM, EYE);
  // For a handoff the climb keeps gathering pace to the end, so the host's picture can take over a view already moving.
  // Climbing into its own Duck Blind: rise beneath the ordinary sky, then a few seconds of cloud
  // gathering while still climbing. Height and view are paced separately.
  const shape = handoff ? ascentShape(from.altitudeM, top, AIR.blind) : null;
  return new Promise(done => { script = { from, to, keep: held ?? { ...pose }, t: 0, seconds: 16, done, interruptible: true, shape, ease: handoff ? t => .25 * t + .75 * t * t * t : null }; });
}
let resolveArrived; const arrived = new Promise(r => { resolveArrived = r; });
function arriveFromAir(keep, fromM, hold, viaBlind) {
  const to = { eastM: 0, northM: -150, altitudeM: 60, yaw: 0, pitch: -.32, mode: 'flight' }, high = fromM > 2400;
  const from = high ? { ...to, northM: -1650, altitudeM: Math.min(fromM, 4e6), pitch: -1.5, yaw: to.yaw - 1.6 } :   // and turns as it comes down
    { ...to, northM: -5200, altitudeM: 2400, pitch: -.42 };
  pose = { ...from }; status('On approach.');
  // From a great height the descent starts at full pace (the host's picture was already falling) and settles at the end.
  // Out of its own Duck Blind (canon): a few seconds in obscuring cloud, the fast fall away of
  // concealment with the ground first discernible straight below, then the descent.
  const shape = viaBlind ? arrivalShape(from.altitudeM, to.altitudeM, AIR.blind) : null;
  script = { from, to, keep, t: 0, seconds: shape ? 15 : high ? 13.5 : 13, shape, held: hold, ease: high ? t => 1 - (1 - t) ** 3 : null, interruptible: false, done: () => { status('Arrived above the city · Q descends · F lands'); resolveArrived('arrived'); } };
}
function begin() { if (script?.held) script.held = false; return arrived; }
function dispose() {
  if (disposed) return;
  if (frames > 0) save();
  disposed = true;
  graphicsLifetime.abort();
  facade?.dispose();
  gl.deleteVertexArray(blank);
  for (const b of buffers.values()) { gl.deleteBuffer(b.vbo); gl.deleteVertexArray(b.vao); }
  buffers.clear();
  for (const program of linkedPrograms) gl.deleteProgram(program);
  linkedPrograms.clear();
}

// The station exterior can still be linking when the walker turns back.
window.addEventListener('pagehide', dispose, {once:true});

const query = new URLSearchParams(location.search), arrival = query.get('arrival') ?? 'saved', had = load();
if (arrival === 'ground' || (arrival === 'saved' && !had)) pose = start();
const geographic=window.frameElement?.surfaceEntry;
if(geographic?.geographic) document.getElementById('panel').open=false;
function enterPrepared(next) {
  pose={...next};
  facade?.sync(pose);
  const floor=walkHeight(pose.eastM,pose.northM)+EYE;
  pose.altitudeM=pose.mode==='walk'?floor:Math.max(floor,pose.altitudeM);
  if(obstruction(pose.eastM,pose.northM,pose.altitudeM)){pose.mode='flight';while(obstruction(pose.eastM,pose.northM,pose.altitudeM))pose.altitudeM+=2;}
  lightSampled=-Infinity;
}
if(geographic?.geographic){
  facade?.sync(geographic.pose);if(facade?.pending)await facade.pending;
  if (!disposed) enterPrepared(geographic.pose);
}
if (arrival === 'air') arriveFromAir(had ? { ...pose } : start(), query.get('fromM') === 'blind' && AIR.blind ? (AIR.blind.baseM + AIR.blind.topM) / 2 : Number(query.get('fromM')) || 0, query.get('hold') === '1', query.get('fromM') === 'blind'); else resolveArrived('ground');
// The arrival is read once: a reload of this page opens the saved place, not the arrival again.
if (query.has('arrival')) { const address = new URL(location.href); for (const key of ['arrival', 'hold', 'fromM']) address.searchParams.delete(key); history.replaceState(null, '', address.href); }
window.SphereBiome = { contract: 'sphere-biome/1', id: ID, version: VERSION, ready, arrived, enterPrepared(next) { enterPrepared(next); if (mesh && plane) draw(); }, pose: () => ({ ...pose }), ascend, begin, save, dispose, air: () => structuredClone(AIR), inspect: () => ({ veil: +veilAt(pose.altitudeM).toFixed(3), frames, cellsBuilt: built, buffers: buffers.size, cellsDrawn: drawn, meshRing, exteriorStation:facade?.station, scripted: !!script, held: !!script?.held }) };

canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', e => { if (!drag || script) return; held = null; pose.yaw += hand*(e.clientX - drag[0]) * .004; pose.pitch = Math.max(-1.5, Math.min(1.5, pose.pitch - (e.clientY - drag[1]) * .004)); drag = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('keydown', e => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX'].includes(e.code)) { e.preventDefault(); interrupt(); } if (e.code === 'Space' && !e.repeat) lift(); if (e.code === 'KeyF' && !e.repeat) land(); keys.add(e.code); });
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
$('lift').onclick = () => { interrupt(); lift(); canvas.focus(); };
$('land').onclick = () => { land(); canvas.focus(); };
$('save').onclick = () => { bookmark = { ...pose }; status(save() ? 'Place saved.' : 'This browser would not keep the save.'); };
$('back').onclick = () => { if (!script) { pose = { ...bookmark }; status('Back at your saved place.'); } };
$('leavePack').onclick = () => { dispose(); location.assign(new URL('../../../index.html', import.meta.url).href); };
setInterval(() => { if (!disposed) save(); }, 5000);
status(pose.mode === 'walk' ? 'On foot · WASD walks · drag to look · Space lifts off' : 'Flying · W goes where you look');
const result = await programsReady;
if (!disposed) {
  if (result.error) {
    $('error').textContent = result.error.message;
    rejectReady(result.error);
    dispose();
  } else {
    [mesh, plane] = result.programs;
    requestAnimationFrame(frame);
  }
}
