/* Stage frame: visit real pack scenes at their installed places, inside Main.
 *
 * The biome service decides WHERE a pack lives (allocator, saved binding). This
 * file decides only WHAT you see when you visit: it opens the accepted pack
 * scene in a same-origin frame over Main's viewport and closes it on Return.
 * Main is never reloaded and none of the service's pinned sources are edited.
 *
 * "Fly to" joins two places: the scene's own ascent, a dissolve, Main's camera
 * flown along an arc across the Sphere, then the other scene from the air.
 *
 * This is a portal, not a continuous surface: the scene is not shaped or lit by
 * the assigned cells. See docs/Observatory-Stage-Frame-2026-11-11.md.
 */
(function () {
  'use strict';

  const KEY = 'sphere-stage-frame-v1';
  const base = new URL('.', document.currentScript.src);
  const rootPath = base.pathname;

  // Which real scene stands at each placement family's assignment.
  const SCENES = Object.freeze({
    'fixture-track-meadow': { name: 'Infinite Meadow', entry: 'packs/infinite-meadow/1.0.0/index.html',
      saveKey: 'sphere-pack:infinite-meadow:1.0.0', ascent: true },
    'fixture-open-industry': { name: 'Infinite Industry', entry: 'packs/infinite-industry/1.0.0/index.html',
      saveKey: 'sphere-pack:infinite-industry:1.0.0', flightArrival: '?arrival=flight', glide: true }
  });

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let current = null;   // { packId, regionId, shell, frame, observer }
  let opening = false;
  let flying = false;
  const overviewButtons = new Map();   // regionId -> Main's own "View assigned region" button

  function installations() {
    try { return window.SphereMainInstallEvidence?.installations ?? []; } catch { return []; }
  }

  function describe(region) {
    const cell = region.cells?.[0];
    return cell ? `face ${cell.face}, level ${region.level}, cell ${cell.x}, ${cell.y}` : region.regionId;
  }

  function remember(value) {
    try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch {}
  }
  function remembered() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); return v?.schema === 1 ? v : null; } catch { return null; }
  }

  function say(text) {
    const status = document.getElementById('biomeInstallStatus');
    if (status) status.textContent = text;
  }

  /* ---- Visit buttons beside each installed place ---- */

  function decorate() {
    const places = document.getElementById('biomeInstalledPlaces');
    if (!places) return;
    const list = installations();
    overviewButtons.clear();
    let installation = null, index = -1, regionIndex = 0;
    for (const node of [...places.children]) {
      if (node.tagName === 'H4') { installation = list[++index] ?? null; regionIndex = 0; continue; }
      if (node.tagName !== 'P' || !installation) continue;
      const region = installation.regions?.[regionIndex++];
      const scene = SCENES[installation.packId];
      if (!region || !scene) continue;
      const present = node.nextElementSibling?.dataset?.stageRegion === region.regionId;
      let overview = node.nextElementSibling;
      while (overview && !(overview.tagName === 'BUTTON' && overview.textContent === 'View assigned region')) {
        if (overview.tagName === 'H4') { overview = null; break; }
        overview = overview.nextElementSibling;
      }
      if (overview) overviewButtons.set(region.regionId, overview);
      if (present) continue;
      const packId = installation.packId;   // capture now; `installation` moves on
      const visit = document.createElement('button');
      visit.textContent = 'Visit ' + scene.name;
      visit.dataset.stageRegion = region.regionId;
      visit.setAttribute('aria-label', `Visit ${scene.name} at its assigned place`);
      visit.onclick = () => visitPlace(packId, region, overview);
      node.after(visit);
    }
  }

  /* ---- Travel there with Main's own controls, then open the scene ---- */

  async function settleTravel(before) {
    // Travel status goes ready -> preparing (when a view needs preparation) ->
    // arrived. Arrival itself is synchronous. status is a fresh copy per read.
    const travel = window.SphereJourney?.travel;
    const started = performance.now();
    while (JSON.stringify(travel?.status) === before && performance.now() - started < 1500) await sleep(50);
    while (travel?.status?.state === 'preparing' && performance.now() - started < 120000) await sleep(100);
    await sleep(400);
  }

  async function visitPlace(packId, region, overviewButton) {
    if (current || opening) return;
    opening = true;
    try {
      if (overviewButton && !overviewButton.disabled) {
        say('Flying to the assigned place');
        const before = JSON.stringify(window.SphereJourney?.travel?.status);
        overviewButton.click();
        await settleTravel(before);
      }
      try { window.SphereSession?.flush(); } catch {}
      open(packId, region.regionId, describe(region));
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
      event.preventDefault(); event.stopImmediatePropagation(); close();
    }, true);
    child.focus();
  }

  function open(packId, regionId, address, { query = '', hidden = false } = {}) {
    const scene = SCENES[packId];
    if (!scene || current) return;
    const shell = document.createElement('section');
    shell.id = 'stageFrame';
    shell.setAttribute('aria-label', scene.name + ' at its assigned place');
    Object.assign(shell.style, { position: 'fixed', zIndex: '900', display: 'flex', flexDirection: 'column', background: '#0b1016' });

    const bar = document.createElement('div');
    Object.assign(bar.style, { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', background: '#16202b', color: '#e8e2d4', font: '13px/1.3 system-ui, sans-serif', borderBottom: '1px solid #ffffff22' });
    const title = document.createElement('strong'); title.textContent = scene.name;
    const where = document.createElement('span'); where.textContent = 'Assigned place · ' + address; where.style.opacity = '.75'; where.style.flex = '1';
    const back = document.createElement('button'); back.textContent = 'Return to the Sphere'; back.className = 'secondary'; back.onclick = () => { if (!flying) close(); };
    bar.append(title, where);
    for (const other of destinations(regionId)) {
      const fly = document.createElement('button');
      fly.textContent = 'Fly to ' + other.scene.name; fly.className = 'secondary';
      fly.onclick = () => flyTo(other);
      bar.append(fly);
    }
    bar.append(back);

    const frame = document.createElement('iframe');
    frame.title = scene.name;
    Object.assign(frame.style, { flex: '1', width: '100%', border: '0', background: '#000' });
    frame.addEventListener('load', () => { if (current?.frame === frame) guard(frame); });
    frame.src = new URL(scene.entry + query, base).href;
    if (hidden) { shell.style.opacity = '0'; shell.style.transition = 'opacity 1.8s ease'; }   // caller reveals it

    shell.append(bar, frame);
    document.body.append(shell);
    place(shell);
    const observer = new ResizeObserver(() => place(shell));
    observer.observe(document.getElementById('view'));
    window.addEventListener('resize', onResize);

    current = { packId, regionId, shell, frame, observer, where };
    remember({ schema: 1, packId, regionId, address });
    say(scene.name + ' is open at its assigned place. Use Return to the Sphere to come back.');
  }

  function onResize() { if (current) place(current.shell); }

  function close(options) {
    if (!current) return;
    const toGround = options?.toGround === true;
    const { shell, frame, observer, packId } = current;
    current = null;
    // The pack runtime saves its place and releases its GPU resources on pagehide.
    try { const child = frame.contentWindow; child.dispatchEvent(new child.Event('pagehide')); } catch {}
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    shell.remove();
    remember(null);
    if (toGround) groundSave(SCENES[packId]?.saveKey);
    say('Back above the assigned place. ' + (SCENES[packId]?.name ?? 'The scene') + ' kept your saved place.');
    document.getElementById('view')?.focus?.();
  }

  /* ---- Flight: lift off here, cross the Sphere, arrive above there ---- */

  function destinations(fromRegionId) {
    const out = [];
    for (const installation of installations()) {
      const scene = SCENES[installation.packId];
      if (!scene) continue;
      for (const region of installation.regions ?? []) {
        if (region.regionId !== fromRegionId) out.push({ packId: installation.packId, scene, region });
      }
    }
    return out;
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

  async function overviewState(regionId) {
    const button = overviewButtons.get(regionId);
    if (!button || button.disabled) return null;
    const before = JSON.stringify(window.SphereJourney?.travel?.status);
    button.click();
    await settleTravel(before);
    return window.SphereApp.getState();
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

  // Main sinks from its overview toward the region, straight down the view line.
  async function descendMain(B, toAltitudeKm, duration) {
    const radial = norm(B.position), from = B.radius - Math.hypot(...B.position);
    if (!(from > toAltitudeKm)) return;
    const started = performance.now();
    for (;;) {
      const x = Math.min(1, (performance.now() - started) / duration), e = x * x * (3 - 2 * x);
      const altitude = Math.exp(Math.log(from) + (Math.log(toAltitudeKm) - Math.log(from)) * e);
      try { window.SphereApp.setState({ ...window.SphereApp.getState(), position: scale(radial, B.radius - altitude), forward: B.forward, up: B.up }); }
      catch (error) { console.warn('Stage frame: descent step refused', error); break; }
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
    const here = current, scene = SCENES[here.packId];
    const label = text => { if (here.where) here.where.textContent = text; };
    try {
      for (const b of here.shell.querySelectorAll('button')) b.disabled = true;
      // Learn both overview poses with Main's own buttons while the scene covers the view.
      label('Plotting a course to ' + target.scene.name);
      try { window.SphereApp?.setPlaying(false); } catch {}
      const B = await overviewState(target.region.regionId);
      const A = await overviewState(here.regionId);
      if (!A || !B) { label('Main could not plot that course. Use Return to the Sphere.'); for (const b of here.shell.querySelectorAll('button')) b.disabled = false; return; }
      here.frame.contentWindow?.focus();
      if (scene.ascent) {
        label('Lifting off · the meadow will stay where you left it');
        const result = await ascend(here.frame);
        if (result === 'taken-over') { label('You took control. Flight to ' + target.scene.name + ' cancelled.'); for (const b of here.shell.querySelectorAll('button')) b.disabled = false; return; }
        if (result === 'closed') return;
      }
      label('Leaving for ' + target.scene.name);
      here.shell.style.transition = 'opacity 1.8s ease';
      here.shell.style.opacity = '0';
      here.shell.style.pointerEvents = 'none';
      await sleep(1900);
      close({ toGround: true });
      say('Crossing the Sphere to ' + target.scene.name);
      await crossSphere(A, B);
      await overviewState(target.region.regionId);   // commit the exact arrival through Main's travel
      let glide = null;
      if (target.scene.glide) try { glide = await prepareGlide(target.scene); } catch (error) { console.warn('Stage frame: glide unavailable', error); }
      say('Descending toward ' + target.scene.name);
      const sinking = descendMain(B, 1500, 6500);
      open(target.packId, target.region.regionId, describe(target.region), { hidden: true, query: glide ? '' : target.scene.flightArrival ?? '' });
      const arriving = current;
      const ready = glide ? await sceneReady(arriving.frame, 12000) : (await sleep(2500), true);
      await Promise.race([sinking, sleep(4500)]);
      if (current !== arriving) return;
      arriving.shell.style.opacity = '1';
      if (glide && ready) await glideIn(arriving.frame, glide);
      await sinking;
      try { window.SphereSession?.flush(); } catch {}
      say(target.scene.name + ': you are on approach. Q descends, F lands.');
    } finally { flying = false; }
  }

  /* ---- Startup: add buttons, and reopen the scene you were in ---- */

  async function start() {
    const deadline = performance.now() + 300000;
    while (!document.getElementById('biomeInstalledPlaces') && performance.now() < deadline) await sleep(200);
    const places = document.getElementById('biomeInstalledPlaces');
    if (!places) return;
    new MutationObserver(decorate).observe(places, { childList: true });
    decorate();

    // The service refuses to install while the world clock is running
    // (INVALID_CORE_SCENE, field "playing") and then stays failed until reload.
    // Pause the clock before an Install click reaches it.
    document.getElementById('biomeInstallReleases')?.addEventListener('click', event => {
      if (event.target.closest?.('button')) try { window.SphereApp?.setPlaying(false); } catch {}
    }, true);

    const saved = remembered();
    if (!saved) return;
    while (performance.now() < deadline) {
      if (window.SphereMainInstallEvidence && window.SphereLoading?.ready) break;
      await sleep(250);
    }
    const match = installations().find(i => i.packId === saved.packId && i.regions?.some(r => r.regionId === saved.regionId));
    if (match && !current) open(saved.packId, saved.regionId, saved.address ?? saved.regionId);
    else if (!match) remember(null);
  }

  window.SphereStageFrame = Object.freeze({ open, close, get current() { return current ? { packId: current.packId, regionId: current.regionId } : null; }, scenes: SCENES });
  start();
})();
