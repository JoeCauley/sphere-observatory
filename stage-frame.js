/* Stage frame: visit installed biomes inside Main, and fly between them.
 *
 * biome-library.js decides WHICH biomes are installed and WHERE they are. This
 * file decides only what you see when you go: it opens the biome's scene in a
 * same-origin frame over Main's viewport and closes it on Return. Main is never
 * reloaded.
 *
 * "Fly to" joins two places: the scene's own ascent, Main's camera flown along an
 * arc across the Sphere, Main sinking toward the destination, then the other
 * scene on approach. The joins are hidden with stagecraft (see "Stagecraft"):
 * the two pictures exchange at the same height, looking straight down, both
 * already moving; in flight they change places only behind a few seconds of
 * obscuring cloud (the Duck Blind crossing); and the destination loads unseen
 * during the crossing. Visit and Return still use a soft-focus dissolve.
 *
 * This is a portal, not a continuous surface: the scene is not shaped or lit by
 * its place on the Sphere. See docs/Observatory-Stage-Frame-2026-11-11.md.
 */
(function () {
  'use strict';

  const KEY = 'sphere-stage-frame-v2';
  const base = new URL('.', document.currentScript.src);
  const rootPath = base.pathname;
  const library = () => window.SphereBiomeLibrary;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let current = null;   // { id, shell, frame, observer, where }
  let opening = false;
  let flying = false;
  let lastFlight = null;   // what the last flight found, for inspection

  // A biome's scene, in the shape the rest of this file uses.
  function sceneOf(item) {
    const pack = library()?.pack(item.packId);
    if (!pack) return null;
    // contract: the biome implements sphere-biome/1 and needs no special handling here.
    return { name: pack.name, entry: pack.entry, saveKey: pack.saveKey, contract: pack.contract === 'sphere-biome/1', ascent: pack.travel?.ascent === 'guided-journey',
      glide: pack.travel?.glide === 'industry-approach', flightArrival: pack.travel?.flightArrival ?? '' };
  }

  function remember(value) {
    try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch {}
  }
  function remembered() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); return v?.schema === 2 ? v : null; } catch { return null; }
  }

  function say(text) {
    const status = document.getElementById('biomeLibraryStatus');
    if (status) status.textContent = text;
  }

  /* ---- Travel there with Main's own travel, then open the scene ---- */

  async function visit(id) {
    if (current || opening || flying) return;
    opening = true;
    try {
      const item = library().entry(id);
      if (!item) return;
      say('Flying to ' + item.name);
      await library().travelTo(id);
      await sleep(350);
      try { window.SphereSession?.flush(); } catch {}
      await show(id);
    } finally { opening = false; }
  }

  /* ---- The frame itself ---- */

  function place(shell) {
    const view = document.getElementById('view');
    if (!view) return;
    const r = view.getBoundingClientRect();
    Object.assign(shell.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }

  function guard(frame) {
    // Keep the frame on pack scenes. "Return to Observatory" inside a pack closes
    // the frame instead of loading a second copy of Main inside it.
    let child;
    try { child = frame.contentWindow; if (!child.location.pathname.startsWith(rootPath + 'packs/')) return close(); }
    catch { return close(); }
    child.document.addEventListener('click', event => {
      const target = event.target.closest?.('#leavePack, a[href]');
      if (!target) return;
      const leaving = target.id === 'leavePack' ||
        (!target.hasAttribute('download') && new URL(target.href, child.location.href).pathname.replace(/index\.html$/, '') === rootPath);
      if (!leaving) return;
      event.preventDefault(); event.stopImmediatePropagation(); leave();
    }, true);
    child.focus();
  }

  function open(id, { query = '', hidden = false } = {}) {
    const item = library()?.entry(id), scene = item && sceneOf(item);
    if (!scene || current) return;
    const address = library().describe(item);
    const shell = document.createElement('section');
    shell.id = 'stageFrame';
    shell.setAttribute('aria-label', scene.name + ' at its assigned place');
    Object.assign(shell.style, { position: 'fixed', zIndex: '900', display: 'flex', flexDirection: 'column', background: '#0b1016' });

    const bar = document.createElement('div');
    Object.assign(bar.style, { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', background: '#16202b', color: '#e8e2d4', font: '13px/1.3 system-ui, sans-serif', borderBottom: '1px solid #ffffff22' });
    const title = document.createElement('strong'); title.textContent = scene.name;
    const where = document.createElement('span'); where.textContent = address; where.style.opacity = '.75'; where.style.flex = '1'; where.style.minWidth = '0'; where.style.whiteSpace = 'nowrap'; where.style.overflow = 'hidden'; where.style.textOverflow = 'ellipsis';
    const back = document.createElement('button'); back.textContent = 'Return to the Sphere'; back.className = 'secondary'; back.onclick = () => { leave(); };
    bar.append(title, where);
    const others = destinations(id);
    if (others.length <= 3) {
      for (const other of others) {
        const fly = document.createElement('button');
        fly.textContent = 'Fly to ' + other.scene.name; fly.className = 'secondary';
        fly.onclick = () => flyTo(other);
        bar.append(fly);
      }
    } else {
      // Hundreds of biomes: one picker, not hundreds of buttons.
      const pick = document.createElement('select'), fly = document.createElement('button');
      pick.setAttribute('aria-label', 'Destination biome');
      for (const other of others) { const option = document.createElement('option'); option.value = other.item.id; option.textContent = other.scene.name; pick.append(option); }
      fly.textContent = 'Fly there'; fly.className = 'secondary';
      fly.onclick = () => { const other = others.find(o => o.item.id === pick.value); if (other) flyTo(other); };
      bar.append(pick, fly);
    }
    bar.append(back);

    const frame = document.createElement('iframe');
    frame.title = scene.name;
    Object.assign(frame.style, { flex: '1', width: '100%', border: '0', background: '#000' });
    frame.addEventListener('load', () => { if (current?.frame === frame) guard(frame); });
    frame.src = new URL(scene.entry + query, base).href;
    if (hidden) { shell.style.opacity = '0'; shell.style.pointerEvents = 'none'; }   // the caller reveals it with dissolve()
    else cover(true);

    shell.append(bar, frame);
    document.body.append(shell);
    // Give the scene the same frame fallback as Main, as soon as its window exists
    // and before its (deferred) scripts start their loops.
    const arm = setInterval(() => {
      try {
        const child = frame.contentWindow;
        if (child && child.location.href !== 'about:blank') { window.SphereFrameFallback?.install(child); clearInterval(arm); }
      } catch { clearInterval(arm); }
      if (!frame.isConnected) clearInterval(arm);
    }, 5);
    place(shell);
    const observer = new ResizeObserver(() => place(shell));
    observer.observe(document.getElementById('view'));
    window.addEventListener('resize', onResize);

    current = { id, shell, frame, observer, where };
    remember({ schema: 2, id });
    say(scene.name + ' is open. Use Return to the Sphere to come back.');
  }

  function onResize() { if (current) place(current.shell); }

  function close(options) {
    if (!current) return;
    const toGround = options?.toGround === true;
    const { shell, frame, observer, id } = current;
    const item = library()?.entry(id), scene = item && sceneOf(item);
    current = null;
    cover(false);
    const main = view(); if (main) { main.style.transition = ''; main.style.filter = ''; }
    // The pack runtime saves its place and releases its GPU resources on pagehide.
    try { const child = frame.contentWindow; child.dispatchEvent(new child.Event('pagehide')); } catch {}
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    shell.remove();
    remember(null);
    if (toGround && !scene?.contract) groundSave(scene?.saveKey);   // a contract biome keeps its own place; the host does not edit its save
    say('Back above ' + (scene?.name ?? 'the biome') + '. It kept your saved place.');
    document.getElementById('view')?.focus?.();
  }

  /* ---- Stagecraft: what hides the join between Main and a scene ---- */

  const HANDOFF_KM = 1500;   // Main and a contract biome exchange the picture at this height, both looking straight down
  const view = () => document.getElementById('view');
  const easeIn = x => x * x, easeOut = x => 1 - (1 - x) * (1 - x);
  const altitudeOf = P => P.radius - Math.hypot(...P.position);

  // Main does not draw while a scene covers it completely. Its clock keeps running.
  // While covered, or in flight, Main's "Preparing your view" card is kept out of sight:
  // Main still prepares, but behind the scene, or as a held frame, never as a card.
  const quietStyle = document.createElement('style');
  quietStyle.textContent = 'body.stage-quiet #sceneLoading{opacity:0!important;pointer-events:none!important}';
  document.head.append(quietStyle);
  function quiet() { document.body.classList.toggle('stage-quiet', flying || window.sphereStageCovered === true); }
  function cover(on) { window.sphereStageCovered = on === true; quiet(); }

  const withHeight = (P, km) => ({ ...window.SphereApp.getState(), position: scale(norm(P.position), P.radius - km), forward: P.forward, up: P.up });

  // Rehearsal: send Main to a view while it cannot be seen and let it prepare there,
  // so that it has nothing left to prepare when the audience is looking.
  async function rehearse(P, km, limitMs) {
    const started = performance.now();
    try {
      window.SphereApp.setState(withHeight(P, km));
      await sleep(80);
      while (performance.now() - started < limitMs) {
        const loading = window.SphereLoading;
        if (!loading.active && !loading.needs(window.SphereApp.getState())) return true;
        if (!loading.active) loading.ensureCurrent();
        await sleep(100);
      }
    } catch (error) { console.warn('Stage frame: rehearsal failed', error); }
    return false;
  }

  // The lowest height above P that Main can show without stopping to prepare,
  // asked of Main's own gate at every step of the way up.
  function floorKm(P) {
    const top = altitudeOf(P);
    let floor = top;
    try {
      for (let i = 1; i <= 12; i++) {
        const km = Math.exp(Math.log(top) + (Math.log(HANDOFF_KM) - Math.log(top)) * i / 12);
        if (window.SphereLoading.needs(withHeight(P, km))) break;
        floor = km;
      }
    } catch {}
    return floor;
  }
  const paceMs = (fromKm, toKm) => Math.min(9000, Math.abs(Math.log(fromKm / toKm)) * 900);   // matches the biome's pace at the exchange

  // A cross-dissolve through soft focus. Both pictures are blurred while they
  // exchange, so the eye is given colour and motion to follow, not detail to compare.
  async function dissolve(shell, frame, show, ms) {
    const main = view(), soft = 'blur(14px)', sharp = 'blur(0px)', timing = ms + 'ms ease-in-out';
    if (show) frame.style.filter = soft; else { if (main) main.style.filter = soft; cover(false); }
    void shell.offsetWidth;   // commit the starting styles before the transition
    shell.style.transition = 'opacity ' + timing; frame.style.transition = 'filter ' + timing; if (main) main.style.transition = 'filter ' + timing;
    shell.style.opacity = show ? '1' : '0'; frame.style.filter = show ? sharp : soft; if (main) main.style.filter = show ? soft : sharp;
    await sleep(ms + 40);
    shell.style.transition = ''; frame.style.transition = ''; if (show) frame.style.filter = '';
    if (main) { main.style.transition = ''; main.style.filter = ''; }
    if (show && current?.shell === shell) { shell.style.pointerEvents = ''; cover(true); }
  }

  // The cloud. Canon: crossing a Duck Blind is a few seconds in obscuring cloud. The host draws
  // that cloud over the viewport, above whichever picture is showing, and the two pictures are
  // exchanged only while it is opaque. A contract biome stops and starts inside its own declared
  // blind, where its own picture is already cloud, so the host's cloud arrives over cloud.
  let cloudLayer = null;
  function cloud() {
    if (cloudLayer) return cloudLayer;
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'fixed', zIndex: '950', pointerEvents: 'none', display: 'none' });
    document.body.append(canvas);
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    let program = null, u = {};
    if (gl) try {
      const make = (type, source) => { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh)); return sh; };
      program = gl.createProgram();
      gl.attachShader(program, make(gl.VERTEX_SHADER, '#version 300 es\nout vec2 v;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;v=p;gl_Position=vec4(p,0.,1.);}'));
      // The same wisps and the same opacity law as a contract biome's own blind.
      gl.attachShader(program, make(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;in vec2 v;out vec4 frag;uniform float uTime,uClimb,uAspect,uOpacity;void main(){vec3 d=normalize(vec3(v.x*uAspect/1.19,v.y/1.19-.9,.6));vec3 q=d*3.+vec3(uTime*.05,uClimb*.004,uTime*.03);float n=.5+.5*sin(q.x*2.1+sin(q.z*1.7+q.y))*sin(q.y*1.3+q.z*2.3);float a=smoothstep(0.,1.,uOpacity*1.5-.5*n);vec3 c=pow(mix(vec3(.80,.78,.76),vec3(.95,.93,.90),n),vec3(1./2.2));frag=vec4(c*a,a);}'));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      for (const name of ['uTime', 'uClimb', 'uAspect', 'uOpacity']) u[name] = gl.getUniformLocation(program, name);
    } catch (error) { console.warn('Stage frame: cloud shader unavailable, using a plain veil', error); program = null; }
    let opacity = 0, goal = 0, perMs = 0, direction = 1, climb = 0, last = 0, running = false, waiting = [];
    function frame(now) {
      const dt = Math.min(250, last ? now - last : 0); last = now;
      opacity = goal > opacity ? Math.min(goal, opacity + perMs * dt) : Math.max(goal, opacity - perMs * dt);
      climb += direction * dt * 1.4;   // the wisps stream past: upward travel reads as climbing, downward as sinking
      const r = view()?.getBoundingClientRect();
      if (r) {
        Object.assign(canvas.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', display: opacity > 0 || goal > 0 ? 'block' : 'none' });
        const w = Math.max(1, Math.round(r.width / 2)), h = Math.max(1, Math.round(r.height / 2));
        if (program) {
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
          gl.uniform1f(u.uTime, now / 1000); gl.uniform1f(u.uClimb, climb); gl.uniform1f(u.uAspect, w / h); gl.uniform1f(u.uOpacity, opacity);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else { canvas.style.background = '#e2dfdb'; canvas.style.opacity = String(opacity); }
      }
      if (opacity === goal) { for (const done of waiting.splice(0)) done(); if (goal === 0) { canvas.style.display = 'none'; running = false; last = 0; return; } }
      requestAnimationFrame(frame);
    }
    cloudLayer = {
      // Bring the cloud to an opacity over a time; resolves when it gets there.
      to(value, ms, travel = 1) { goal = value; perMs = 1 / Math.max(1, ms); direction = travel; const reached = new Promise(done => waiting.push(done)); if (!running) { running = true; requestAnimationFrame(frame); } return reached; },
      get opacity() { return opacity; }
    };
    return cloudLayer;
  }

  // Has the scene drawn? Contract biomes say so; the two older packs are asked their own way.
  async function settled(frame, scene, limitMs) {
    if (scene.contract) return biomeReady(frame, limitMs);
    if (scene.glide) return sceneReady(frame, limitMs);
    const started = performance.now();
    while (performance.now() - started < limitMs) {
      try { if (frame.contentWindow.location.href !== 'about:blank' && frame.contentDocument.readyState === 'complete') break; } catch {}
      await sleep(50);
    }
    await sleep(600);
    return true;
  }

  // Open a scene unseen, wait until it has drawn, then let it come up through soft focus.
  async function show(id) {
    open(id, { hidden: true });
    const opened = current;
    if (!opened) return;
    await settled(opened.frame, sceneOf(library().entry(id)), 8000);
    if (current === opened) await dissolve(opened.shell, opened.frame, true, 700);
  }

  // Return to the Sphere: the scene goes out through soft focus, then closes.
  async function leave() {
    const leaving = current;
    if (!leaving || flying || leaving.leaving) return;
    leaving.leaving = true; leaving.shell.style.pointerEvents = 'none';
    await dissolve(leaving.shell, leaving.frame, false, 500);
    if (current === leaving) close();
  }

  /* ---- Flight: lift off here, cross the Sphere, arrive above there ---- */

  function destinations(fromId) {
    return (library()?.installed() ?? []).filter(item => item.id !== fromId).map(item => ({ item, scene: sceneOf(item) })).filter(d => d.scene);
  }

  // A scene closed in mid-air would save "current place" up there. Put it back
  // at the bookmark the pack took when the ascent began.
  function groundSave(key) {
    try {
      const save = JSON.parse(localStorage.getItem(key));
      if (!save?.bookmark?.pose?.address) return;
      save.state = structuredClone(save.bookmark);
      save.address = save.bookmark.pose.address;
      localStorage.setItem(key, JSON.stringify(save));
    } catch {}
  }

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return scale(a, 1 / l); };
  const mix = (a, b, t) => add(scale(a, 1 - t), scale(b, t));

  // Main's camera along a great arc from A to B, swinging inward for the view.
  function arcPose(A, B, e) {
    const a = norm(A.position), b = norm(B.position);
    const omega = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    const s = Math.sin(omega);
    const radial = s < 1e-6 ? norm(mix(a, b, e))
      : norm(add(scale(a, Math.sin((1 - e) * omega) / s), scale(b, Math.sin(e * omega) / s)));
    const rA = Math.hypot(...A.position), rB = Math.hypot(...B.position);
    const lift = A.radius * (0.03 + 0.2 * omega / Math.PI) * Math.sin(Math.PI * e);
    const position = scale(radial, rA + (rB - rA) * e - lift);
    // Look ahead along the arc and down at the passing surface, then settle.
    let tangent = add(b, scale(radial, -dot(b, radial)));
    tangent = Math.hypot(...tangent) < 1e-9 ? norm(B.forward) : norm(tangent);
    const w = 0.85 * Math.pow(Math.sin(Math.PI * e), 0.8);
    const ahead = norm(add(scale(tangent, 0.82), scale(radial, 0.57)));
    const forward = norm(add(scale(norm(mix(A.forward, B.forward, e)), 1 - w), scale(ahead, w)));
    let up = add(scale(norm(mix(A.up, B.up, e)), 1 - w), scale(radial, -w));
    up = add(up, scale(forward, -dot(up, forward)));
    up = Math.hypot(...up) < 1e-6 ? norm(add(scale(radial, -1), scale(forward, dot(radial, forward)))) : norm(up);
    return { position, forward, up, omega };
  }

  async function crossSphere(A, B) {
    const omega = arcPose(A, B, 0).omega;
    const duration = 9000 + 7000 * omega / Math.PI;
    const started = performance.now();
    for (;;) {
      const x = Math.min(1, (performance.now() - started) / duration);
      const e = x * x * (3 - 2 * x);
      const pose = arcPose(A, B, e);
      try { window.SphereApp.setState({ ...window.SphereApp.getState(), position: pose.position, forward: pose.forward, up: pose.up }); }
      catch (error) { console.warn('Stage frame: flight step refused', error); break; }
      if (x >= 1) break;
      await new Promise(requestAnimationFrame);
    }
  }

  // Meadow's own guided ascent: lift, rise, cross the Duck Blind, travel inward.
  async function ascend(frame) {
    const doc = frame.contentDocument;
    const mode = () => doc.getElementById('mode')?.textContent;
    const stage = () => doc.getElementById('stage')?.textContent ?? '';
    doc.getElementById('journey')?.click();
    await sleep(600);
    if (mode() !== 'JOURNEY') return 'already-airborne';
    const started = performance.now();
    while (performance.now() - started < 90000) {
      if (!current || current.frame !== frame) return 'closed';
      if (mode() !== 'JOURNEY') return 'taken-over';
      if (/^Large-scale view/.test(stage())) { doc.getElementById('pause')?.click(); return 'revealed'; }
      await sleep(200);
    }
    return 'timeout';
  }

  /* ---- Arrival: come down instead of appearing ---- */

  // Main moves along the view line above a region, by equal ratios of height in equal times.
  async function sinkMain(P, fromKm, toKm, duration, ease) {
    const radial = norm(P.position);
    if (!(fromKm > 0 && toKm > 0) || fromKm === toKm) return;
    const started = performance.now();
    for (;;) {
      const x = Math.min(1, (performance.now() - started) / duration), e = ease(x);
      const altitude = Math.exp(Math.log(fromKm) + (Math.log(toKm) - Math.log(fromKm)) * e);
      try { window.SphereApp.setState({ ...window.SphereApp.getState(), position: scale(radial, P.radius - altitude), forward: P.forward, up: P.up }); }
      catch (error) { console.warn('Stage frame: height step refused', error); break; }
      if (x >= 1) break;
      await new Promise(requestAnimationFrame);
    }
  }

  // Industry: start several kilometres back along its own approach line, so the
  // pack's flight model (speed falls with height) can fly the last leg itself.
  async function prepareGlide(scene) {
    const root = new URL('packs/infinite-industry/1.0.0/', base).href;
    const [model, site, contract, manifest] = await Promise.all([
      import(root + 'model.js'), import(root + 'facility.js'),
      import(new URL('packs/runtime/v1/contract.js', base).href),
      fetch(root + 'manifest.json', { cache: 'no-store' }).then(r => r.json())]);
    let previous = null;
    try { previous = JSON.parse(localStorage.getItem(scene.saveKey)); } catch {}
    let state;
    try { state = previous?.state ? model.parseState(previous.state) : model.initialState(); } catch { state = model.initialState(); }
    const facility = site.createFacility(state.config), approach = model.approachPose(facility), distanceM = 5000;
    const cp = Math.cos(approach.pitch), sp = Math.sin(approach.pitch);
    const ahead = [Math.sin(approach.yaw) * cp, sp, -Math.cos(approach.yaw) * cp];   // east, up, north
    state.pose = { ...approach, eastM: approach.eastM - ahead[0] * distanceM, altitudeM: approach.altitudeM - ahead[1] * distanceM, northM: approach.northM - ahead[2] * distanceM };
    const plain = value => typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
    const saved = plain(model.saveState(state));
    const bookmark = previous?.bookmark ?? plain(model.saveState({ ...state, pose: { ...facility.arrival } }));
    localStorage.setItem(scene.saveKey, JSON.stringify({ format: 'sphere-biome-pack', schema: 1, pack: contract.identity(manifest), address: saved.pose.address, state: saved, bookmark }));
    return { altitudeM: approach.altitudeM };
  }

  async function sceneReady(frame, limitMs) {
    const started = performance.now();
    while (performance.now() - started < limitMs) {
      try { if (frame.contentWindow?.SphereIndustryHost?.status === 'ready') return true; } catch {}
      await sleep(100);
    }
    return false;
  }

  // A contract biome says for itself when its first frame is drawn.
  async function biomeReady(frame, limitMs) {
    const started = performance.now();
    while (performance.now() - started < limitMs) {
      try { const api = frame.contentWindow?.SphereBiome; if (api?.contract === 'sphere-biome/1') { await Promise.race([api.ready, sleep(Math.max(0, limitMs - (performance.now() - started)))]); return true; } } catch {}
      await sleep(100);
    }
    return false;
  }

  // Hold "forward" for the pack until it reaches its approach height.
  async function glideIn(frame, target) {
    const child = frame.contentWindow, canvas = frame.contentDocument.getElementById('world') ?? frame.contentDocument;
    const press = (type, code) => canvas.dispatchEvent(new child.KeyboardEvent(type, { code, key: code, bubbles: true }));
    const key = type => { press(type, 'ShiftLeft'); press(type, 'KeyW'); };   // forward, at the pack's faster pace
    const altitude = () => child.SphereIndustry?.inspect?.().state?.pose?.address?.altitudeM;
    const started = performance.now();
    key('keydown');
    try {
      while (performance.now() - started < 30000 && current?.frame === frame) {
        const now = altitude();
        if (!(now > target.altitudeM + 1.5)) break;
        await sleep(40);
      }
    } finally { key('keyup'); }
  }

  async function flyTo(target) {
    if (!current || flying || opening) return;
    flying = true;
    const here = current, scene = sceneOf(library().entry(here.id));
    const label = text => { if (here.where) here.where.textContent = text; };
    const controls = off => { for (const b of here.shell.querySelectorAll('button, select')) b.disabled = off; };
    const flight = lastFlight = { from: here.id, to: target.item.id };
    try {
      controls(true);
      cover(false);   // Main's own travel may wait on its frames
      quiet();
      // Both overview poses come from the library; Main sits at A under the scene.
      label('Plotting a course to ' + target.scene.name);
      let A, B;
      try { B = await library().travelTo(target.item.id); A = await library().travelTo(here.id); }
      catch { label('Main could not plot that course. Use Return to the Sphere.'); controls(false); cover(true); return; }
      here.frame.contentWindow?.focus();
      // While this scene lifts off, Main rehearses the low views at both ends behind it.
      const rehearsal = (async () => { const there = await rehearse(B, HANDOFF_KM, 12000), back = await rehearse(A, HANDOFF_KM, 12000); return { there, back }; })();
      let low = false;   // the scene itself climbed to the handoff height
      if (scene.contract || scene.ascent) {
        label('Lifting off · your place here is kept');
        const api = scene.contract ? here.frame.contentWindow?.SphereBiome : null;
        // A biome that declares a Duck Blind climbs into the middle of it and stops there, in cloud.
        let blind = null; try { blind = api?.air?.().blind ?? null; } catch {}
        flight.departInBlind = !!blind;
        const result = scene.contract ? await (api?.ascend({ toAltitudeM: blind ? (blind.baseM + blind.topM) / 2 : HANDOFF_KM * 1000, handoff: true }) ?? 'revealed') : await ascend(here.frame);
        if (result === 'taken-over') { label('You took control. Flight to ' + target.scene.name + ' cancelled.'); await rehearsal; window.SphereApp.setState(A); controls(false); cover(true); return; }
        if (result === 'closed') return;
        try { low = !!api && (!!blind || api.pose().altitudeM >= HANDOFF_KM * 900); } catch {}
      }
      label('Leaving for ' + target.scene.name);
      here.shell.style.pointerEvents = 'none';
      // Main is already moving when it comes into view. After a contract biome it starts
      // at the height the scene reached and keeps rising; otherwise the crossing has begun.
      flight.rehearsal = await rehearsal;
      const topA = altitudeOf(A), floorA = low ? floorKm(A) : topA;
      flight.departKm = Math.round(floorA);
      window.SphereApp.setState(withHeight(A, floorA));
      const moving = (async () => {
        if (floorA < topA) await sinkMain(A, floorA, topA, paceMs(topA, floorA), easeOut);
        say('Crossing the Sphere to ' + target.scene.name);
        await crossSphere(A, B);
      })();
      // Into cloud; the pictures change places behind it; then the fast fall away.
      await cloud().to(1, low ? 500 : 1100, 1);
      close({ toGround: true });
      sleep(900).then(() => cloud().to(0, 1400, 1));
      // The destination loads unseen during the crossing, so it is ready before it is wanted.
      let glide = null;
      if (target.scene.glide) try { glide = await prepareGlide(target.scene); } catch (error) { console.warn('Stage frame: glide unavailable', error); }
      const byContract = target.scene.contract;
      open(target.item.id, { hidden: true, query: glide ? '' : byContract ? '?arrival=air&hold=1&fromM=blind' : target.scene.flightArrival });
      const arriving = current;
      const loading = glide ? sceneReady(arriving.frame, 20000) : byContract ? biomeReady(arriving.frame, 20000) : sleep(2500).then(() => true);
      await moving;
      await library().travelTo(target.item.id);   // commit the exact arrival through Main's travel
      if (current !== arriving) return;
      say('Descending toward ' + target.scene.name);
      const topB = altitudeOf(B), floorB = floorKm(B), sinkMs = paceMs(topB, floorB);
      flight.arriveKm = Math.round(floorB);
      const sinking = sinkMain(B, topB, floorB, sinkMs, easeIn);   // still gathering pace at the exchange
      const ready = await loading;
      await Promise.race([sinking, sleep(Math.max(0, sinkMs - 1300))]);
      if (current !== arriving) return;
      await cloud().to(1, 1200, -1);   // Main sinks into cloud
      if (current !== arriving) return;
      const api = byContract && ready ? arriving.frame.contentWindow.SphereBiome : null;
      // The biome holds level for the first half of the exchange, then starts down as Main arrives at its height.
      const landing = api ? (typeof api.begin === 'function' ? api.begin() : api.arrived) : null;
      // The scene is put in place behind the cloud, already moving; then the cloud falls away.
      arriving.shell.style.opacity = '1'; arriving.shell.style.pointerEvents = '';
      const revealed = sleep(500).then(() => cloud().to(0, 1200, -1)).then(() => { if (current === arriving) cover(true); });
      if (glide && ready) await glideIn(arriving.frame, glide);
      else if (landing) await Promise.race([landing, sleep(45000)]);
      await revealed;
      await sinking;
      try { window.SphereSession?.flush(); } catch {}
      say(target.scene.name + ': you have arrived from the air.');
    } finally { flying = false; quiet(); }
  }

  /* ---- Startup: add buttons, and reopen the scene you were in ---- */

  async function start() {
    const deadline = performance.now() + 300000;
    while (!library() && performance.now() < deadline) await sleep(200);
    await library()?.ready;
    // A biome removed while its scene is open closes the scene.
    window.addEventListener('sphere-biomes-changed', () => { if (current && !library().entry(current.id) && !flying) close(); });
    const saved = remembered();
    if (!saved) return;
    while (!window.SphereLoading?.ready && performance.now() < deadline) await sleep(250);
    if (library().entry(saved.id) && !current) await show(saved.id);
    else remember(null);
  }

  window.SphereStageFrame = Object.freeze({ visit, open, close: () => { if (!flying) close(); }, leave, get lastFlight() { return lastFlight ? { ...lastFlight } : null; }, get current() { return current ? { id: current.id } : null; }, get flying() { return flying; } });
  start();
})();
