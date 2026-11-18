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
 * during the crossing. Restoring a remembered scene uses a soft-focus dissolve.
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
  const sound = (name, seconds) => { try { window.SphereStageSound?.play(name, seconds); } catch {} };   // stage-sound.js; silent if absent
  let current = null;   // { id, shell, frame, observer, where }
  let opening = false;
  let flying = false;
  let lastFlight = null;   // what the last flight found, for inspection
  let lastArrival = null;

  // A biome's scene, in the shape the rest of this file uses.
  function sceneOf(item) {
    const pack = library()?.pack(item.packId);
    if (!pack) return null;
    // contract: the biome implements sphere-biome/1 and needs no special handling here.
    return { name: pack.name, entry: pack.entry, saveKey: pack.saveKey, contract: pack.contract === 'sphere-biome/1', ascent: pack.travel?.ascent === 'guided-journey',
      glide: pack.travel?.glide === 'industry-approach', flightArrival: pack.travel?.flightArrival ?? '' };
  }

  function remember(value, key = library()?.world?.key) {
    try { const store = library().saveStorage(key); value ? store.setItem(KEY, JSON.stringify(value)) : store.removeItem(KEY); } catch {}
  }
  function remembered() {
    try { const v = JSON.parse(library().saveStorage().getItem(KEY)); return v?.schema === 2 ? v : null; } catch { return null; }
  }

  function setFlightView(state) {
    if (!library().matchesWorld(state)) throw Error('The active world changed during the flight.');
    window.SphereApp.setState(state);
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
      clearRecovery();
      lastArrival = null;
      if (sceneOf(item)?.contract) return await descendInto(id);   // no dissolve: down through the cloud
      say('Flying to ' + item.name);
      await library().travelTo(id);
      await sleep(350);
      try { window.SphereSession?.flush(); } catch {}
      return await show(id, 'visit');
    } catch (error) {
      return recover(id, 'visit', null, issue('load-failure', 'travel', error));
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
    try {
      child = frame.contentWindow;
      if (child.location.href === 'about:blank') return;
      if (!child.location.pathname.startsWith(rootPath + 'packs/')) throw Error('The destination document could not be opened.');
    } catch (error) {
      if (current?.pending) current.loadError = error.message;
      else close();
      return;
    }
    // The iframe's initial window can be replaced when its real document loads.
    window.SphereFrameFallback?.install(child);
    child.document.addEventListener('click', event => {
      const target = event.target.closest?.('#leavePack, a[href]');
      if (!target) return;
      const leaving = target.id === 'leavePack' ||
        (!target.hasAttribute('download') && new URL(target.href, child.location.href).pathname.replace(/index\.html$/, '') === rootPath);
      if (!leaving) return;
      event.preventDefault(); event.stopImmediatePropagation(); leave();
    }, true);
    if (!current?.pending) child.focus();
  }

  function mountFrame(id, query = '') {
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
    if (window.SphereStageSound) {   // flight sounds on or off; remembered
      const mute = document.createElement('button'); mute.className = 'secondary';
      const show = () => { mute.textContent = window.SphereStageSound.on ? 'Sound on' : 'Sound off'; };
      mute.onclick = () => { window.SphereStageSound.toggle(); show(); }; show(); bar.append(mute);
    }
    bar.append(back);

    const frame = document.createElement('iframe');
    frame.title = scene.name;
    frame.dataset.worldKey = library().world.key;
    Object.assign(frame.style, { flex: '1', width: '100%', border: '0', background: '#000' });
    frame.addEventListener('load', () => { if (current?.frame === frame) guard(frame); });
    frame.addEventListener('error', () => { if (current?.frame === frame) current.loadError = 'The destination document failed to load.'; });
    frame.src = new URL(scene.entry + query, base).href;
    shell.style.opacity = '0'; shell.style.pointerEvents = 'none';

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

    current = { id, shell, frame, observer, where, query, worldKey:frame.dataset.worldKey, pending: true };
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
    if (!options?.inTransit) remember(null, frame.dataset.worldKey);
    if (toGround && !scene?.contract) groundSave(scene?.saveKey);   // a contract biome keeps its own place; the host does not edit its save
    if (!options?.silent) say('Back above ' + (scene?.name ?? 'the biome') + '. It kept your saved place.');
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

  // The shades ride on shells at fixed fractions of the radius (0.62, 0.74 and 0.86 on 14 November),
  // and Main's overview of a plot sits above the lowest of them. A flight that began and ended at
  // the overview crossed that shell twice and swung inward through the others, so the eye went
  // through any shade that happened to be there. A flight now stays beneath the lowest shade shell
  // from end to end: it leaves and arrives at FLIGHT_PART of the clear height and its swing inward
  // stops short of the shell. Infinity when the world has no shades.
  const FLIGHT_PART = 0.55, SWING_PART = 0.9;
  function clearKm(P) {
    try {
      const routes = window.SphereCollection?.routes;
      if (!routes?.length || window.SphereApp.getState().routeShades === false) return Infinity;
      return P.radius * (1 - Math.max(...routes.map(r => r.radius)));
    } catch { return Infinity; }
  }
  const flightPose = P => { const km = Math.min(altitudeOf(P), clearKm(P) * FLIGHT_PART); return { ...withHeight(P, km), radius: P.radius }; };

  // Rehearsal: send Main to a view while it cannot be seen and let it prepare there,
  // so that it has nothing left to prepare when the audience is looking.
  async function rehearse(P, km, limitMs) {
    const started = performance.now();
    try {
      setFlightView(withHeight(P, km));
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

  // A biome climbing into its own blind stops dead when its script ends, and its wisps stop with
  // it. So the host's cloud does not wait for the end: it comes over as soon as the biome's own
  // veil is full, while the biome is still climbing, streaming at about the pace of that climb.
  // By the time the biome stops, the only cloud in view is the host's, and it never stops.
  function cloudOverAscent(api, lifting) {
    let over = false, revealed = false;
    lifting.then(result => { over = true; revealed = result === 'revealed'; }, () => { over = true; });
    return (async () => {
      while (!over) { let veil = 0; try { veil = api.inspect().veil; } catch {} if (veil >= 1) break; await sleep(50); }
      if (over && !revealed) return;
      sound('cloud', 3.2);
      await cloud().to(1, 700, 4);
    })();
  }

  const takeover = Symbol('taken-over');
  const issue = (status, phase, error) => ({ status, phase, detail: String(error?.message ?? error ?? '') });

  function recordArrival(to, route, from, result) {
    lastArrival = Object.freeze({ to, route, from, ...result });
    return lastArrival;
  }

  // The released packs already surface boot errors before they publish SphereBiome.
  function frameError(opened) {
    if (opened.loadError) return opened.loadError;
    const doc = opened.frame.contentDocument;
    const retry = doc?.getElementById('packRetry');
    if (retry && !retry.hidden) return doc.getElementById('packLoadingStatus')?.textContent || 'The pack could not start.';
    const error = doc?.getElementById('error');
    return error && !error.hidden ? error.textContent.trim() : '';
  }

  // A missing API may still be booting. Once its promise exists, subscribe only once.
  // Continue watching the frame for a boot/render failure while that promise is pending.
  function waitForStage(opened, phase, limitMs, getSignal, canExtend) {
    let deadline = performance.now() + limitMs;
    return new Promise(resolve => {
      let timer, watching = false, finished = false;
      function finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      }
      function failed(error) {
        finish(error === takeover ? { status: 'taken-over', phase } : issue('load-failure', phase, error));
      }
      function poll() {
        if (current !== opened) return finish({ status: 'cancelled', phase });
        try {
          const error = frameError(opened);
          if (error) return failed(error);
          const now = performance.now();
          if (now >= deadline && canExtend && now < deadline + limitMs && canExtend()) {
            deadline += limitMs;
            canExtend = null;
          }
          const remaining = deadline - now;
          if (remaining <= 0) {
            const result = { status: 'timeout', phase };
            const state = phase === 'arrival' && opened.frame.contentWindow?.SphereBiome?.inspect?.();
            if (state) result.scene = { frames: state.frames, held: state.held, scripted: state.scripted };
            return finish(result);
          }
          if (!watching) {
            const signal = getSignal();
            if (signal) {
              watching = true;
              signal.then(status => {
                if (current !== opened) return finish({ status: 'cancelled', phase });
                finish({ status, phase });   // a verified result won the race with the pending-signal timer
              }, failed);
            }
          }
          timer = setTimeout(poll, Math.min(100, remaining));
        } catch (error) { failed(error); }
      }
      poll();
    });
  }

  function promiseOf(value, name) {
    if (typeof value?.then !== 'function') throw Error('The pack did not supply its ' + name + ' promise.');
    return value;
  }

  function settled(opened, scene, limitMs) {
    return waitForStage(opened, 'ready', limitMs, () => {
      const child = opened.frame.contentWindow;
      if (scene.contract) {
        const api = child?.SphereBiome;
        if (!api) return null;
        if (api.contract !== 'sphere-biome/1' || api.id !== opened.id) throw Error('The frame opened a different biome.');
        return promiseOf(api.ready, 'ready').then(() => {
          const frames = api.inspect().frames;
          if (!Number.isSafeInteger(frames) || frames < 1) throw Error('The pack reported ready before drawing a frame.');
          return 'ready';
        });
      }
      if (scene.glide) return child?.SphereIndustryHost?.status === 'ready' ? Promise.resolve('ready') : null;
      return child?.location.href !== 'about:blank' && opened.frame.contentDocument?.readyState === 'complete'
        ? sleep(600).then(() => 'ready') : null;
    });
  }

  function biomeArrival(opened, fromAir) {
    let api, startPose, startFrames;
    return waitForStage(opened, 'arrival', 45000, () => {
      api = opened.frame.contentWindow.SphereBiome;
      if (fromAir) { startPose = api.pose(); startFrames = api.inspect().frames; }
      const signals = new Set([promiseOf(api.arrived, 'arrived')]);
      if (fromAir) signals.add(promiseOf(api.begin(), 'begin'));
      const verified = Array.from(signals, async signal => {
        const value = await signal;
        if (value === 'taken-over') {
          const state = api.inspect();
          if (state.held !== false || state.scripted !== false) throw Error('The pack reported takeover while the approach still held the controls.');
          throw takeover;
        }
        if (value !== 'arrived' && !(value === 'ground' && !fromAir)) throw Error('The pack returned an unknown arrival result.');
      });
      return Promise.all(verified).then(() => {
        const state = api.inspect();
        if (state.held !== false || state.scripted !== false) throw Error('The pack reported arrival before its approach settled.');
        return 'arrived';
      });
    }, () => {
      if (!startPose || opened.frame.contentWindow.SphereBiome !== api) return false;
      const state = api.inspect(), pose = api.pose();
      // The released packs cap simulation time per draw. A slowly painting approach
      // gets one extra window only if its actual camera advanced under its own script.
      return state.scripted === true && state.held === false && state.frames > startFrames
        && ['eastM', 'northM', 'altitudeM', 'yaw', 'pitch'].some(key => pose[key] !== startPose[key]);
    });
  }

  function clearRecovery() { document.getElementById('biomeArrivalRecovery')?.remove(); }

  function recover(id, route, from, result, overview) {
    if (overview && !library()?.matchesWorld(overview)) return;
    if (current && current.id !== id) return;
    const query = current?.query ?? '';
    recordArrival(id, route, from, result);
    if (current?.id === id) close({ silent: true });
    remember(null);
    cover(false);
    if (cloudLayer) cloudLayer.to(0, 300);
    if (overview) try { setFlightView(overview); } catch {}
    const name = library()?.entry(id)?.name ?? id;
    const waiting = { ready: ' to draw.', arrival: ' to finish its approach.', travel: ' to finish preparing the Main view.' }[result.phase];
    const message = result.status === 'timeout' ? 'Timed out waiting for ' + name + waiting
      : 'Could not open ' + name + '. ' + result.detail;
    say(message);
    clearRecovery();
    const panel = document.createElement('section');
    panel.id = 'biomeArrivalRecovery';
    panel.setAttribute('aria-label', 'Biome travel');
    Object.assign(panel.style, { position: 'absolute', bottom: '3rem', left: '1rem', zIndex: '80', maxWidth: 'min(28rem, 88%)', padding: '12px', background: '#16202b', color: '#e8e2d4', border: '1px solid #607080' });
    const text = document.createElement('p'); text.textContent = message;
    const retry = document.createElement('button'); retry.textContent = 'Retry ' + name;
    retry.onclick = () => {
      if (current || opening || flying) return;
      if (route === 'restore' || route === 'open') openScene(id, route, { query });
      else visit(id);
    };
    const stay = document.createElement('button'); stay.textContent = 'Stay in the Sphere'; stay.className = 'secondary';
    stay.onclick = () => { clearRecovery(); document.getElementById('viewport')?.focus(); };
    panel.append(text, retry, stay);
    document.getElementById('viewport').append(panel);
    retry.focus({ preventScroll: true });
    return lastArrival;
  }

  function finishArrival(opened, scene, route, from, result, overview) {
    if (current !== opened) return;
    if (result.status !== 'arrived' && result.status !== 'taken-over') return recover(opened.id, route, from, result, overview);
    opened.pending = false;
    remember({ schema: 2, id: opened.id });
    recordArrival(opened.id, route, from, result);
    if (result.status === 'taken-over') {
      opened.where.textContent = 'You have the controls.';
      say('You have the controls in ' + scene.name + '.');
    } else if (route === 'restore') say('Restored your saved place in ' + scene.name + '.');
    else if (route === 'open' || (!scene.contract && route === 'visit')) say(scene.name + ' is open. Use Return to the Sphere to come back.');
    else { sound('settle'); say(scene.name + ': you have arrived from the air.'); }
    opened.frame.contentWindow?.focus();
    return lastArrival;
  }

  async function show(id, route, query = '') {
    const scene = sceneOf(library().entry(id));
    mountFrame(id, query);
    const opened = current;
    if (!opened) return;
    let result = await settled(opened, scene, 8000);
    if (current !== opened) return;
    if (result.status === 'ready') {
      const fromAir = new URLSearchParams(query).get('arrival') === 'air';
      result = scene.contract ? await biomeArrival(opened, fromAir) : { status: 'arrived', phase: 'arrival' };
      if (current !== opened) return;
      if (result.status === 'arrived' || result.status === 'taken-over') await dissolve(opened.shell, opened.frame, true, 700);
    }
    return finishArrival(opened, scene, route, null, result);
  }

  async function openScene(id, route, { query = '' } = {}) {
    if (current || opening || flying || !library()?.entry(id)) return;
    opening = true;
    clearRecovery();
    lastArrival = null;
    try { return await show(id, route, query); }
    catch (error) { return recover(id, route, null, issue('load-failure', 'ready', error)); }
    finally { opening = false; }
  }

  // Return to the Sphere: the scene goes out through soft focus, then closes.
  async function leave() {
    const leaving = current;
    if (!leaving || flying || leaving.leaving) return;
    leaving.leaving = true;
    // A contract biome leaves by lifting off into its own blind; anything else, or a failure, dissolves.
    let api = null; try { api = leaving.frame.contentWindow?.SphereBiome; } catch {}
    const item = library()?.entry(leaving.id);
    if (item && sceneOf(item)?.contract && api?.contract === 'sphere-biome/1') {
      let done = false;
      try { done = await riseOut(leaving, api); } catch (error) { console.warn('Stage frame: return by air failed', error); }
      if (done || current !== leaving) { leaving.leaving = false; return; }
    }
    leaving.shell.style.pointerEvents = 'none';
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
  function arcPose(A, B, e, peakKm = Infinity) {
    const a = norm(A.position), b = norm(B.position);
    const omega = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    const s = Math.sin(omega);
    const radial = s < 1e-6 ? norm(mix(a, b, e))
      : norm(add(scale(a, Math.sin((1 - e) * omega) / s), scale(b, Math.sin(e * omega) / s)));
    const rA = Math.hypot(...A.position), rB = Math.hypot(...B.position);
    // The swing inward, never higher above the ground than peakKm.
    const lift = Math.max(0, Math.min(A.radius * (0.03 + 0.2 * omega / Math.PI), peakKm - (A.radius - Math.min(rA, rB)))) * Math.sin(Math.PI * e);
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
    const omega = arcPose(A, B, 0).omega, peakKm = clearKm(A) * SWING_PART;
    const duration = 9000 + 7000 * omega / Math.PI;
    sound('jump', duration / 1000);   // charge, release, drone for the crossing, drop-out
    const started = performance.now();
    for (;;) {
      const x = Math.min(1, (performance.now() - started) / duration);
      const e = x * x * (3 - 2 * x);
      const pose = arcPose(A, B, e, peakKm);
      try { setFlightView({ ...window.SphereApp.getState(), position: pose.position, forward: pose.forward, up: pose.up }); }
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
      try { setFlightView({ ...window.SphereApp.getState(), position: scale(radial, P.radius - altitude), forward: P.forward, up: P.up }); }
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
        if (!Number.isFinite(now)) return issue('load-failure', 'arrival', 'The approach height is unavailable.');
        if (now <= target.altitudeM + 1.5) return { status: 'arrived', phase: 'arrival' };
        await sleep(40);
      }
      return { status: 'timeout', phase: 'arrival' };
    } finally { key('keyup'); }
  }

  // Visit and Fly to use the same two gates, before the reveal and after the approach.
  async function descendAndLand(opened, scene, { from = null, pose, overview, loading, glide }) {
    const route = from ? 'fly' : 'visit';
    say('Descending toward ' + scene.name);
    const top = altitudeOf(pose), floor = floorKm(pose), sinkMs = paceMs(top, floor);
    if (from) lastFlight.arriveKm = Math.round(floor);
    const sinking = sinkMain(pose, top, floor, sinkMs, easeIn);
    if (sinkMs > 500) sound('descend', sinkMs / 1000);
    const ready = await loading;
    if (ready.status !== 'ready') {
      await sinking;   // finish the old camera motion before handing Main back to the explorer
      return finishArrival(opened, scene, route, from, ready, overview);
    }
    await Promise.race([sinking, sleep(Math.max(0, sinkMs - 1300))]);
    if (current !== opened) return;
    sound('cloud', 3.2);
    await cloud().to(1, 1200, -1);
    await sinking;
    if (current !== opened) return;
    if (from) {
      const controller = new AbortController();
      const aligned = await waitForStage(opened, 'travel', 4000,
        () => library().travelTo(opened.id, { signal: controller.signal }).then(() => 'ready'));
      if (aligned.status !== 'ready') {
        controller.abort();
        return finishArrival(opened, scene, route, from, aligned, overview);
      }
      setFlightView(withHeight(overview, floor));
    }
    if (current !== opened) return;
    opened.shell.style.opacity = '1'; opened.shell.style.pointerEvents = '';
    opened.frame.contentWindow?.focus();
    const landing = scene.contract ? biomeArrival(opened, true)
      : glide ? glideIn(opened.frame, glide) : Promise.resolve({ status: 'arrived', phase: 'arrival' });
    const reveal = sleep(500).then(() => cloud().to(0, 1200, -1)).then(() => { if (current === opened) cover(true); });
    const [result] = await Promise.all([landing, reveal]);
    if (current === opened) try { window.SphereSession?.flush(); } catch {}
    return finishArrival(opened, scene, route, from, result, overview);
  }

  async function flyTo(target) {
    if (!current || flying || opening) return;
    flying = true;
    const here = current, scene = sceneOf(library().entry(here.id));
    const label = text => { if (here.where) here.where.textContent = text; };
    const controls = off => { for (const b of here.shell.querySelectorAll('button, select')) b.disabled = off; };
    const flight = lastFlight = { from: here.id, to: target.item.id };
    lastArrival = null;
    let overB, rehearsal, moving;
    try {
      controls(true);
      cover(false);   // Main's own travel may wait on its frames
      quiet();
      // Both overview poses come from the library; Main sits at A under the scene.
      label('Plotting a course to ' + target.scene.name);
      let A, B;
      try { overB = await library().travelTo(target.item.id); B = flightPose(overB); A = flightPose(await library().travelTo(here.id)); }
      catch (error) { throw Error('Main could not plot that course. ' + error.message); }
      here.frame.contentWindow?.focus();
      // While this scene lifts off, Main rehearses the low views at both ends behind it.
      rehearsal = (async () => { const there = await rehearse(B, HANDOFF_KM, 12000), back = await rehearse(A, HANDOFF_KM, 12000); return { there, back }; })();
      let low = false;   // the scene itself climbed to the handoff height
      let clouded = null;   // the host cloud, when it came over the scene during its climb
      if (scene.contract || scene.ascent) {
        label('Lifting off · your place here is kept');
        sound('lift', scene.contract ? 16 : 24);
        const api = scene.contract ? here.frame.contentWindow?.SphereBiome : null;
        // A biome that declares a Duck Blind climbs into the middle of it and stops there, in cloud.
        let blind = null; try { blind = api?.air?.().blind ?? null; } catch {}
        flight.departInBlind = !!blind;
        if (scene.contract && typeof api?.ascend !== 'function') throw Error('The departure pack could not start its ascent.');
        const lifting = scene.contract ? Promise.resolve(api.ascend({ toAltitudeM: blind ? (blind.baseM + blind.topM) / 2 : HANDOFF_KM * 1000, handoff: true })) : ascend(here.frame);
        if (api && blind) clouded = cloudOverAscent(api, lifting);
        const result = await lifting;
        if (result === 'taken-over') {
          if (clouded) { await clouded; if (cloudLayer) await cloudLayer.to(0, 400, 1); }
          const text = 'You took control. Flight to ' + target.scene.name + ' cancelled.';
          label(text); say(text);
          await rehearsal; setFlightView(A); controls(false); cover(true);
          return recordArrival(target.item.id, 'fly', here.id, { status: 'taken-over', phase: 'departure' });
        }
        if (result === 'closed') return;
        if (result === 'timeout') {
          await rehearsal; setFlightView(A);
          const text = 'Lift-off timed out. You can retry the flight or return to the Sphere.';
          label(text); say(text); controls(false); cover(true);
          return recordArrival(target.item.id, 'fly', here.id, { status: 'timeout', phase: 'departure' });
        }
        if (result !== 'revealed' && result !== 'already-airborne') throw Error('The departure pack did not complete its ascent.');
        try { low = !!api && (!!blind || api.pose().altitudeM >= HANDOFF_KM * 900); } catch {}
      }
      label('Leaving for ' + target.scene.name);
      here.shell.style.pointerEvents = 'none';
      // Main is already moving when it comes into view. After a contract biome it starts
      // at the height the scene reached and keeps rising; otherwise the crossing has begun.
      flight.rehearsal = await rehearsal;
      const topA = altitudeOf(A), floorA = low ? floorKm(A) : topA;
      flight.departKm = Math.round(floorA);
      setFlightView(withHeight(A, floorA));
      moving = (async () => {
        if (floorA < topA) await sinkMain(A, floorA, topA, paceMs(topA, floorA), easeOut);
        say('Crossing the Sphere to ' + target.scene.name);
        await crossSphere(A, B);
      })();
      // Into cloud; the pictures change places behind it; then the fast fall away.
      if (clouded) await clouded;
      else { sound('cloud', 3.2); await cloud().to(1, low ? 500 : 1100, 1); }
      close({ toGround: true, inTransit: true, silent: true });
      sleep(900).then(() => cloud().to(0, 1400, 1));
      // The destination loads unseen during the crossing, so it is ready before it is wanted.
      let glide = null;
      if (target.scene.glide) try { glide = await prepareGlide(target.scene); } catch (error) { console.warn('Stage frame: glide unavailable', error); }
      const byContract = target.scene.contract;
      mountFrame(target.item.id, glide ? '' : byContract ? '?arrival=air&hold=1&fromM=blind' : target.scene.flightArrival);
      const arriving = current;
      if (!arriving) throw Error('The destination frame could not be opened.');
      const loading = settled(arriving, target.scene, 20000);
      await moving;
      if (current !== arriving) return;
      return await descendAndLand(arriving, target.scene, { from: here.id, pose: B, overview: overB, loading, glide });
    } catch (error) {
      await Promise.allSettled([rehearsal, moving]);   // retire old camera work before a retry can start
      if (current !== here) return recover(target.item.id, 'fly', here.id, issue('load-failure', 'travel', error), overB);
      recordArrival(target.item.id, 'fly', here.id, issue('load-failure', 'departure', error));
      const text = 'Flight could not leave ' + scene.name + '. ' + error.message;
      label(text); say(text); controls(false); cover(true); here.shell.style.pointerEvents = '';
      if (cloudLayer) cloudLayer.to(0, 300);
      return lastArrival;
    } finally { flying = false; quiet(); }
  }

  /* ---- Visit and Return for contract biomes: the two halves of a flight, without the crossing ---- */

  // Visit: Main comes down over the plot, beneath the shades, into cloud; the biome arrives out
  // of its own blind behind that cloud, as at the end of a flight.
  async function descendInto(id) {
    const item = library().entry(id), scene = sceneOf(item);
    flying = true; quiet();
    try {
      say('Flying to ' + item.name);
      const overview = await library().travelTo(id);
      const B = flightPose(overview);
      try { window.SphereSession?.flush(); } catch {}
      setFlightView(B);
      mountFrame(id, '?arrival=air&hold=1&fromM=blind');
      const arriving = current;
      if (!arriving) throw Error('The destination frame could not be opened.');
      const loading = settled(arriving, scene, 20000);
      return await descendAndLand(arriving, scene, { pose: B, overview, loading });
    } finally { flying = false; quiet(); }
  }

  // Return: the biome lifts off into its own blind, the host cloud comes over it, and Main is
  // found beneath the cloud, already rising, beneath the shades. True if the return was handled
  // (including when the person took the controls and stayed); false to fall back to the dissolve.
  async function riseOut(leaving, api) {
    const scene = sceneOf(library().entry(leaving.id));
    const controls = off => { for (const b of leaving.shell.querySelectorAll('button, select')) b.disabled = off; };
    flying = true;
    try {
      controls(true);
      cover(false);   // Main's own travel may wait on its frames
      quiet();
      let A;
      try { A = flightPose(await library().travelTo(leaving.id)); } catch { controls(false); cover(true); return false; }
      leaving.frame.contentWindow?.focus();
      const rehearsal = rehearse(A, HANDOFF_KM, 12000);   // behind the scene, while it lifts off
      let blind = null; try { blind = api.air().blind ?? null; } catch {}
      sound('lift', 16);
      const lifting = Promise.resolve(api.ascend({ toAltitudeM: blind ? (blind.baseM + blind.topM) / 2 : HANDOFF_KM * 1000, handoff: true }));
      const clouded = blind ? cloudOverAscent(api, lifting) : null;
      const result = await lifting;
      if (current !== leaving) return true;
      if (result !== 'revealed') { if (clouded) { await clouded; cloud().to(0, 400, 1); } await rehearsal; setFlightView(A); controls(false); cover(true); say('You have the controls. Still in ' + scene.name + '.'); return true; }
      leaving.shell.style.pointerEvents = 'none';
      await rehearsal;
      const top = altitudeOf(A), floor = floorKm(A);
      setFlightView(withHeight(A, floor));
      const rising = floor < top ? sinkMain(A, floor, top, paceMs(top, floor), easeOut) : Promise.resolve();
      if (clouded) await clouded;
      else { sound('cloud', 3.2); await cloud().to(1, 500, 1); }
      close({ toGround: true });
      await sleep(900);
      await cloud().to(0, 1400, 1);
      await rising;
      try { window.SphereSession?.flush(); } catch {}
      return true;
    } finally { flying = false; quiet(); }
  }

  /* ---- Startup: add buttons, and reopen the scene you were in ---- */

  async function start() {
    const deadline = performance.now() + 300000;
    while (!library() && performance.now() < deadline) await sleep(200);
    await library()?.ready;
    // A biome removed while its scene is open closes the scene.
    window.addEventListener('sphere-biome-world-leaving', () => {
      clearRecovery();
      if (current) close({inTransit:true, silent:true});
      if (cloudLayer) cloudLayer.to(0, 200);
    });
    window.addEventListener('sphere-biomes-changed', () => { if (current && !library().entry(current.id) && !flying) close(); });
    const saved = remembered();
    if (!saved) return;
    while (!window.SphereLoading?.ready && performance.now() < deadline) await sleep(250);
    if (current || opening || flying) return;
    if (library().entry(saved.id)) await openScene(saved.id, 'restore');
    else remember(null);
  }

  window.SphereStageFrame = Object.freeze({ visit, open: (id, options) => openScene(id, 'open', options), close: () => { if (!flying) close(); }, leave,
    get lastFlight() { return lastFlight ? { ...lastFlight } : null; },
    get lastArrival() { return lastArrival ? { ...lastArrival } : null; },
    get current() { return current ? { id: current.id } : null; },
    get flying() { return flying; },
    get cloudOpacity() { return cloudLayer?.opacity ?? 0; }
  });
  start();
})();
