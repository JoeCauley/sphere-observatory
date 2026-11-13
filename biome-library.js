/* Biome library: which biomes exist, which are installed, and where they are.
 *
 * Deliberately small. A biome is one entry in packs/biome-library.json. Installing
 * one picks a place on the inner surface and records it. Nothing here depends on
 * the browser build, and nothing is digest-pinned.
 *
 * The surface is divided into plots by sphere-atlas.js. Installing a biome gives
 * it one free plot:
 *   - "within" a shade track means a plot in the habitat waist;
 *   - "outside" means a plot in the shell works, nearest the waist first;
 *   - plots cut by a wound or the breach, and plots declared under construction, are skipped.
 * The same pack on the same world always gets the same plot.
 *
 * The installed list lives in installed-biomes.json beside the app, written by
 * the local server. If that server is an older build without the endpoint, the
 * list falls back to this browser's storage and says so.
 */
(function () {
  'use strict';

  const base = new URL('.', document.currentScript.src);
  const STORE_URL = new URL('api/installed-biomes', base).href;
  const LIBRARY_URL = new URL('packs/biome-library.json', base).href;
  const CACHE_KEY = 'sphere-installed-biomes-v1';
  const WORLD_KEYS = ['seed', 'radius', 'axisLat', 'axisLon', 'waistWidth', 'layoutVersion', 'shadeGeometryRevision'];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  let packs = [];
  let construction = new Set();   // plot indexes declared under construction; never generated
  let store = { schema: 1, worlds: {} };
  let world = null;            // { key, params }
  let persistence = 'unknown'; // 'file' | 'browser'
  let filter = '';
  let message = '';

  /* ---- World identity: the Sphere's own parameters, nothing else ---- */

  async function identify(state) {
    const params = Object.fromEntries(WORLD_KEYS.map(key => [key, state[key] ?? null]));
    const bytes = new TextEncoder().encode(JSON.stringify(params));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return { key: 'sphere-' + [...digest.slice(0, 8)].map(v => v.toString(16).padStart(2, '0')).join(''), params };
  }

  /* ---- Geometry ---- */

  const deg = radians => radians * 180 / Math.PI;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const frac = x => x - Math.floor(x);
  function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // Each shade route sweeps a band of latitude in the world frame. Its half-width
  // is the plate's cross-track half-angle as seen from the star.
  function tracks(state) {
    if (state.layoutVersion !== 2) return [];
    const M = window.SphereMath, waist = M.radians(state.waistWidth);
    return window.SphereCollection.routes.map((route, index) => ({
      index, name: route.name.replace(/ belt$/, ' track'),
      latitude: waist * (index - 1) * 2 / 3,
      halfWidth: Math.min(Math.PI / (2 * route.count), waist / 3 * 0.88)
    }));
  }

  function locate(direction, state) {
    const c = window.SphereWorld.coordinates(direction, state);
    let track = null, clearance = Infinity;
    for (const t of tracks(state)) {
      const edge = Math.abs(c.lat - t.latitude) - t.halfWidth;   // negative inside
      if (edge < clearance) { clearance = edge; track = edge < 0 ? t : track; }
    }
    return { latitude: c.lat, longitude: c.lon, track, clearance };
  }

  function blocked(direction, radius, state) {
    const M = window.SphereMath, C = window.SphereCollection;
    const c = window.SphereWorld.coordinates(direction, state);
    if (Math.abs(c.lat) > 1.31 - radius) return 'polar entry';
    for (const wound of C.wounds) if (C.woundDistance(direction, wound) < 1.35) return 'wound';
    const breach = M.axis(state.breachLat, state.breachLon);
    const breachRadius = state.breachDiameter / 2 / state.radius;
    if (Math.acos(M.clamp(dot(direction, breach), -1, 1)) < breachRadius * 1.15 + radius) return 'breach';
    return null;
  }

  // Would any part of this plot fall in a wound, the breach or a polar entry?
  function plotBlocked(p, state) {
    for (const dy of [-0.8, 0, 0.8]) for (const dx of [-0.8, 0, 0.8]) {
      const latitude = p.latitude + dy * p.halfHeight, longitude = p.longitude + dx * p.halfWidth / Math.max(0.05, Math.cos(latitude));
      if (blocked(window.SphereWorld.direction(latitude, longitude, state), 0, state)) return true;
    }
    return false;
  }

  function place(pack, state, installed) {
    const A = window.SphereAtlas, relation = pack.placement.relation, taken = new Set(installed.map(i => i.plot));
    const preferred = [], near = [], far = [], prefer = pack.placement.prefer;
    for (let index = 0; index < A.TOTAL; index++) {
      if (taken.has(index) || construction.has(index)) continue;
      const p = A.plot(index);
      if (relation === 'within' && p.zone !== 'waist') continue;
      if (relation === 'outside' && p.zone !== 'works') continue;
      // Open-light biomes prefer the shell works beside the waist to the far ones.
      (relation === 'outside' && Math.abs(p.latitude) > A.ROW * 7 ? far : near).push(p);
      // A pack may name the Main province it belongs in (a water works in "Air and water works").
      if (prefer) try { if (window.SphereWorld.sample(window.SphereWorld.direction(p.latitude, p.longitude, state), state).name === prefer) preferred.push(p); } catch {}
    }
    const seed = hash(pack.id);
    for (const pool of [preferred, near, far]) for (let k = 0; k < pool.length; k++) {
      const p = pool[(seed + k * 7919) % pool.length];   // 7919 is prime: every plot in the pool is reached
      if (!plotBlocked(p, state)) return { plot: p, direction: window.SphereWorld.direction(p.latitude, p.longitude, state), candidate: k };
    }
    throw Error('No free plot is left for ' + pack.name + '.');
  }

  /* ---- Storage ---- */

  const installedHere = () => store.worlds[world?.key]?.installed ?? [];

  async function load() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch {}
    try {
      const response = await fetch(STORE_URL, { cache: 'no-store' });
      if (!response.ok) throw Error('no endpoint');
      const value = await response.json();
      if (value?.schema !== 1 || typeof value.worlds !== 'object') throw Error('bad file');
      store = value; persistence = 'file';
      // Installs made before the server could write: move them into the file once.
      if (cached?.schema === 1) {
        let moved = false;
        for (const [key, entry] of Object.entries(cached.worlds ?? {})) if (!store.worlds[key] && entry?.installed?.length) { store.worlds[key] = entry; moved = true; }
        if (moved) await save();
        if (persistence === 'file') try { localStorage.removeItem(CACHE_KEY); } catch {}
      }
    } catch {
      persistence = 'browser';
      if (cached?.schema === 1 && typeof cached.worlds === 'object') store = cached;
    }
  }

  async function save() {
    if (persistence === 'file') {
      try {
        const response = await fetch(STORE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(store) });
        if (response.ok) return;
      } catch {}
      persistence = 'browser';
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); } catch { throw Error('The installed list could not be saved anywhere.'); }
  }

  /* ---- Operations ---- */

  const pack = id => packs.find(p => p.id === id) ?? null;
  const entry = id => installedHere().find(i => i.id === id) ?? null;

  function describe(item) {
    const state = window.SphereApp.getState(), at = locate(item.direction, state);
    const p = window.SphereAtlas.plot(item.plot);
    const where = p?.track ? 'beneath the ' + p.track : 'in open light';
    let province = ''; try { province = window.SphereWorld.sample(item.direction, state).name ?? ''; } catch {}
    return `plot ${item.plotId} · ${where}${province ? ' · ' + province : ''} · ${Math.abs(deg(at.latitude)).toFixed(1)}° ${at.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(deg(at.longitude)).toFixed(1)}° ${at.longitude >= 0 ? 'E' : 'W'}`;
  }

  function record(p, found, state) {
    return { id: p.id, packId: p.id, name: p.name, version: p.version, plot: found.plot.index, plotId: found.plot.id, direction: found.direction,
      radiusKm: state.radius * Math.max(found.plot.halfHeight, found.plot.halfWidth), relation: p.placement.relation, installedAt: new Date().toISOString() };
  }

  // Installs recorded before the surface was divided into plots are given one.
  async function adoptPlots() {
    const list = store.worlds[world?.key]?.installed;
    if (!list?.some(item => !Number.isInteger(item.plot))) return;
    const state = window.SphereApp.getState(), kept = list.filter(item => Number.isInteger(item.plot));
    for (const item of list) if (!Number.isInteger(item.plot)) { const p = pack(item.packId); if (!p) continue; kept.push({ ...record(p, place(p, state, kept), state), installedAt: item.installedAt }); }
    store.worlds[world.key].installed = kept;
    await save();
  }

  async function install(packId) {
    const p = pack(packId);
    if (!p) throw Error('Unknown biome');
    if (entry(packId)) return entry(packId);
    const state = window.SphereApp.getState(), found = place(p, state, installedHere());
    const item = record(p, found, state);
    store.worlds[world.key] ??= { parameters: world.params, installed: [] };
    store.worlds[world.key].installed.push(item);
    await save();
    changed();
    return item;
  }

  async function remove(id) {
    const list = store.worlds[world?.key]?.installed;
    if (!list) return;
    const index = list.findIndex(i => i.id === id);
    if (index < 0) return;
    list.splice(index, 1);
    await save();
    changed();
  }

  // Main's camera above a biome, looking out at it with world north up.
  function overviewPose(item, state) {
    const M = window.SphereMath, d = item.direction, axis = window.SphereWorld.frame(state).axis;
    const altitudeKm = Math.min(state.radius * 0.25, Math.max(1000, item.radiusKm * 3.5));
    let up = M.sub(axis, M.mul(d, dot(axis, d)));
    up = M.length(up) < 1e-6 ? M.basis(d).r : M.norm(up);
    return { ...state, position: M.mul(d, state.radius - altitudeKm), forward: d.slice(), up,
      walkMode: false, walkSurface: false, walkPosition: null, shadeAttachment: null, siteId: '', siteAnchor: null };
  }

  async function travelTo(id) {
    const item = entry(id);
    if (!item) throw Error('That biome is not installed in this world.');
    const travel = window.SphereJourney?.travel;
    let arrived = false;
    try {
      const result = await travel?.request({ type: 'place', id: 'biome-' + item.id, title: item.name, resolve: core => overviewPose(item, core) });
      arrived = result?.state === 'arrived';
    } catch {}
    if (!arrived) window.SphereApp.setState(overviewPose(item, window.SphereApp.getState()));
    return window.SphereApp.getState();
  }

  /* ---- Panel ---- */

  let panel = null;
  function changed() { render(); window.dispatchEvent(new CustomEvent('sphere-biomes-changed')); }
  function button(text, kind, action) { const b = document.createElement('button'); b.textContent = text; b.className = kind; b.onclick = action; return b; }
  async function attempt(work) { try { message = ''; await work(); } catch (error) { message = error.message; render(); } }

  function render() {
    if (!panel) return;
    const installed = installedHere(), ids = new Set(installed.map(i => i.packId));
    const match = text => !filter || text.toLowerCase().includes(filter);
    const status = panel.querySelector('#biomeLibraryStatus');
    status.textContent = message || `${installed.length} of ${packs.length} biomes installed on ${window.SphereAtlas.TOTAL} plots · ` + (persistence === 'file' ? 'saved beside the app' : 'saved in this browser only; restart the Observatory server to keep installs on disk');
    const list = panel.querySelector('#biomeLibraryList'); list.replaceChildren();
    const row = (title, detail, buttons) => {
      const article = document.createElement('article'), h = document.createElement('h4'), p = document.createElement('p');
      h.textContent = title; p.className = 'micro'; p.textContent = detail; article.append(h, p, ...buttons); list.append(article);
    };
    for (const item of installed) if (match(item.name)) row(item.name + ' · ' + item.version, 'Installed ' + describe(item) + '.', [
      button('Visit', 'secondary', () => window.SphereStageFrame?.visit(item.id)),
      button('View from above', 'quiet', () => attempt(() => travelTo(item.id))),
      button('Remove', 'quiet', () => attempt(() => remove(item.id)))]);
    for (const p of packs) if (!ids.has(p.id) && match(p.name)) row(p.name + ' · ' + p.version, p.description ?? '', [
      button('Install', 'secondary', () => attempt(() => install(p.id)))]);
    panel.querySelector('#biomeLibraryFilter').hidden = packs.length < 8;
  }

  async function start() {
    const deadline = performance.now() + 300000;
    while (!(document.getElementById('places') && window.SphereApp && window.SphereWorld && window.SphereCollection && window.SphereAtlas) && performance.now() < deadline) await sleep(200);
    const response = await fetch(LIBRARY_URL, { cache: 'no-store' });
    const manifest = await response.json();
    packs = manifest.packs ?? [];
    construction = new Set((manifest.atlas?.underConstruction ?? []).map(id => window.SphereAtlas.byId(id)?.index).filter(Number.isInteger));
    world = await identify(window.SphereApp.getState());
    await load();
    await adoptPlots();
    panel = document.createElement('section'); panel.id = 'biomeLibrary';
    panel.innerHTML = '<h3>Biomes</h3><p class="micro">Install a biome and the Sphere gives it a place. Visit walks you into it; Fly to, inside a biome, crosses to another.</p><input id="biomeLibraryFilter" type="search" placeholder="Filter biomes" aria-label="Filter biomes" hidden><p id="biomeLibraryStatus" class="micro" role="status" aria-live="polite"></p><div id="biomeLibraryList"></div>';
    const style = document.createElement('style');
    style.textContent = '#biomeLibrary{padding:14px 0;border-top:1px solid #ffffff22;border-bottom:1px solid #ffffff22;margin:16px 0}#biomeLibrary h4{margin:12px 0 4px}#biomeLibrary button{margin:6px 6px 2px 0}#biomeLibraryList{max-height:60vh;overflow:auto}#biomeLibraryFilter{width:100%;margin:6px 0}';
    document.head.append(style);
    document.getElementById('places').after(panel);
    panel.querySelector('#biomeLibraryFilter').oninput = event => { filter = event.target.value.trim().toLowerCase(); render(); };
    render();
  }

  const ready = start();
  window.SphereBiomeLibrary = Object.freeze({
    ready, packs: () => packs.map(p => ({ ...p })), pack, installed: () => installedHere().map(i => ({ ...i })), entry,
    install, remove, travelTo, describe, locate, tracks, place, underConstruction: () => [...construction],
    get persistence() { return persistence; }, get world() { return world ? { ...world } : null; }
  });
})();
