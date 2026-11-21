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
  let selection = null, selectedSignature = '', legacyWorld = null;
  let operations = Promise.resolve(), patchSupported = false;
  let persistence = 'unknown'; // 'file' | 'browser'
  let filter = '';
  let message = '';

  /* ---- World identity: the Sphere's own parameters, nothing else ---- */

  const parameters = state => Object.fromEntries(WORLD_KEYS.map(key => [key, state[key] ?? null]));
  const matchesWorld = state => JSON.stringify(parameters(state)) === selectedSignature;
  async function identify(params) {
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
    // An installed Border keeps its anchor address if the anchor is removed and later reinstalled.
    for (const item of installed) {
      if (!item.edge) continue;
      const near = A.byId(item.edge.near);
      if (!near) continue;
      const anchorId = packs.find(p => p.id === item.packId)?.placement.anchorPack;
      if (anchorId === pack.id && !taken.has(near.index))
        return {plot:near, direction:window.SphereWorld.direction(near.latitude,near.longitude,state)};
      taken.add(near.index);
    }
    const preferred = [], near = [], far = [], prefer = pack.placement.prefer;
    const preferredPlot=pack.placement.preferredPlot;
    if(preferredPlot?.seed===state.seed){
      const p=A.byId(preferredPlot.id);
      if(p && !taken.has(p.index) && !construction.has(p.index) && !plotBlocked(p,state))
        return {plot:p,direction:window.SphereWorld.direction(p.latitude,p.longitude,state)};
    }
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

  const placedHere = () => store.worlds[world?.key]?.installed ?? [];
  const installedHere = () => placedHere().filter(item => item.detailInstalled!==false);

  function enqueue(operation) {
    const next = operations.then(operation);
    operations = next.catch(() => {});
    return next;
  }

  async function load() {
    let cached;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch {}
    try {
      const response = await fetch(STORE_URL, { cache: 'no-store' });
      if (!response.ok) throw Error('No install endpoint');
      const disk = await response.json();
      if (disk?.schema !== 1 || !disk.worlds) throw Error('Invalid installation file');
      store = disk;
      persistence = 'file';
      patchSupported = response.headers.get('Accept-Patch') === 'application/json';
    } catch {
      persistence = 'browser';
      if (cached?.schema === 1 && cached.worlds) store = cached;
      return;
    }
    if (cached?.schema === 1) {
      for (const [key, prior] of Object.entries(cached.worlds ?? {})) {
        if (!store.worlds[key] && prior.installed?.length)
          await updateWorld({key, params:prior.parameters}, list => { if(!list.length)list.push(...prior.installed); });
      }
      if (persistence === 'file') try { localStorage.removeItem(CACHE_KEY); } catch {}
    }
  }

  // Each edit closes over its initiating world. Compare and retry the one affected list
  // if a second browser wins a write. Other worlds are merged by the server on disk.
  async function updateWorld(target, edit) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = store.worlds[target.key]?.installed ?? [];
      const installed = structuredClone(before);
      const result = edit(installed);
      if (JSON.stringify(before) === JSON.stringify(installed)) return result;
      const entry = {parameters:target.params, installed};
      let next = {...store, worlds:{...store.worlds, [target.key]:entry}};
      if (persistence === 'file') {
        const payload = patchSupported ? {key:target.key, parameters:target.params, before, installed} : next;
        let response;
        try { response = await fetch(STORE_URL, {method:patchSupported ? 'PATCH' : 'PUT',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); } catch {}
        if (response?.status === 409) { store = await response.json(); continue; }
        if (response && !response.ok) throw Error('Installation could not be saved (' + response.status + ').');
        if (!response) persistence = 'browser';
        else if (patchSupported) { const saved = await response.json(); if (saved.schema === 1 && saved.worlds) next = saved; }
      }
      if (persistence === 'browser') localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      store = next;
      return result;
    }
    throw Error('The installed world changed during saving. Please try again.');
  }

  function saveStorage(key = world?.key) {
    if (!key || key === legacyWorld) return localStorage;
    const prefix = 'sphere-place:' + key + ':';
    return {getItem:name => localStorage.getItem(prefix + name), setItem:(name,value) => localStorage.setItem(prefix + name,value),
      removeItem:name => localStorage.removeItem(prefix + name)};
  }

  function selectWorld(state = window.SphereApp.getState()) {
    const params = parameters(state), signature = JSON.stringify(params);
    if (signature === selectedSignature) return selection;
    const departing = world;
    selectedSignature = signature;
    world = null;
    if (departing) {
      window.dispatchEvent(new CustomEvent('sphere-biome-world-leaving',{detail:departing.key}));
      changed();
    }
    selection = identify(params).then(async target => {
      await enqueue(() => updateWorld(target, list => {
        const placed = list.filter(item => Number.isInteger(item.plot));
        for (const item of list) {
          const offered = pack(item.packId);
          if (!offered) continue;
          if (!item.edge && !Number.isInteger(item.plot)) {
            const installedAt = item.installedAt;
            Object.assign(item, record(offered, place(offered,state,placed),state), {installedAt});
            placed.push(item);
          }
          item.version = offered.version; item.name = offered.name;
        }
      }));
      if (selectedSignature === signature) {
        world = target;
        if (!legacyWorld) {
          legacyWorld = localStorage.getItem('sphere-legacy-place-world') || target.key;
          localStorage.setItem('sphere-legacy-place-world',legacyWorld);
        }
        message = ''; changed();
      }
      return target;
    });
    return selection;
  }

  /* ---- Operations ---- */

  const pack = id => packs.find(p => p.id === id) ?? null;
  const entry = id => installedHere().find(i => i.id === id) ?? null;

  function describe(item) {
    const state = window.SphereApp.getState(), at = locate(item.direction, state);
    if(item.edge)return 'Border between '+item.edge.near+' and '+item.edge.far+
      ' · '+Math.abs(deg(at.latitude)).toFixed(2)+'° '+(at.latitude>=0?'N':'S')+', '+Math.abs(deg(at.longitude)).toFixed(2)+'° '+(at.longitude>=0?'E':'W');
    const p = window.SphereAtlas.plot(item.plot);
    const where = p?.track ? 'beneath the ' + p.track : 'in open light';
    let province = ''; try { province = window.SphereWorld.sample(item.direction, state).name ?? ''; } catch {}
    return `plot ${item.plotId} · ${where}${province ? ' · ' + province : ''} · ${Math.abs(deg(at.latitude)).toFixed(1)}° ${at.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(deg(at.longitude)).toFixed(1)}° ${at.longitude >= 0 ? 'E' : 'W'}`;
  }

  function record(p, found, state) {
    return { id: p.id, packId: p.id, name: p.name, version: p.version, plot: found.plot.index, plotId: found.plot.id, direction: found.direction,
      ...(p.placement.footprint ? {footprint:{...p.placement.footprint}} : {}),
      radiusKm: state.radius * Math.max(found.plot.halfHeight*(p.placement.footprint?.north??1), found.plot.halfWidth*(p.placement.footprint?.east??1)), relation: p.placement.relation, installedAt: new Date().toISOString() };
  }

  async function placeRegion(packId,options={}) {
    const p=pack(packId), atlas=window.SphereAtlas;
    if(!p || p.placement.relation==='border')throw Error('Select a surface biome to place.');
    const footprint=options.footprint??p.placement.footprint;
    if(footprint && (!['ellipse','rectangle'].includes(footprint.shape) || ![footprint.east,footprint.north].every(v=>Number.isFinite(v)&&v>0&&v<=1)))throw Error('Invalid region shape or extent.');
    const state=window.SphereApp.getState(),target=await selectWorld(state);
    const result=await enqueue(()=>updateWorld(target,list=>{
      const existing=list.find(i=>i.packId===packId);
      if(existing)return existing;
      let found;
      if(options.plotId){
        const cell=atlas.byId(options.plotId);
        if(!cell || list.some(i=>i.plot===cell.index) || construction.has(cell.index) || plotBlocked(cell,state) ||
          (p.placement.relation==='within')!==(cell.zone==='waist'))throw Error('This plot cannot hold this biome.');
        found={plot:cell,direction:window.SphereWorld.direction(cell.latitude,cell.longitude,state)};
      }else found=place(p,state,list);
      const item=record({...p,placement:{...p.placement,footprint}},found,state);
      item.detailInstalled=false;list.push(item);return item;
    }));
    if(world?.key===target.key)changed();
    return result;
  }
  async function install(packId) {
    const p = pack(packId);
    if (!p) throw Error('Unknown biome');
    const state = window.SphereApp.getState(), target = await selectWorld(state);
    const item = await enqueue(() => updateWorld(target, list => {
      const existing = list.find(i => i.packId === packId);
      if (existing) {
        delete existing.detailInstalled;
        if (p.placement.anchorPack) { const anchor=list.find(i=>i.packId===p.placement.anchorPack); if(anchor)delete anchor.detailInstalled; }
        return existing;
      }
      let item;
      if(p.placement.relation==='border'){
        const parent=pack(p.placement.anchorPack);
        let anchor=list.find(i=>i.packId===parent.id);
        if(!anchor){anchor=record(parent,place(parent,state,list),state);list.push(anchor);}
        else delete anchor.detailInstalled;
        const edge=window.SphereAtlas.northEdge(anchor.plotId);
        if(!edge)throw Error('This Meadow has no northern Border site.');
        item={id:p.id,packId:p.id,name:p.name,version:p.version,edge,plotId:edge.id,relation:'border',
          radiusKm:anchor.radiusKm,direction:window.SphereWorld.direction(edge.latitude,edge.longitude,state),installedAt:new Date().toISOString()};
      }else item=record(p, place(p, state, list), state);
      list.push(item);
      return item;
    }));
    if (world?.key === target.key) changed();
    return item;
  }

  async function remove(id) {
    const target = await selectWorld();
    await enqueue(() => updateWorld(target, list => {
      const item=list.find(i=>i.id===id);
      if (item) {
        item.detailInstalled=false;
        for(const dependent of list)if(pack(dependent.packId)?.placement.anchorPack===item.packId)dependent.detailInstalled=false;
      }
    }));
    if (world?.key === target.key) changed();
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

  async function travelTo(id, { signal } = {}) {
    const item = entry(id), origin = world?.key;
    if (!item) throw Error('That biome is not installed in this world.');
    signal?.throwIfAborted();
    const travel = window.SphereJourney?.travel;
    let cancelOwnRequest;
    try {
      const result = await travel?.request({ type: 'place', id: 'biome-' + item.id, title: item.name, stageTrip:true, resolve: core => {
        if (signal) {
          signal.throwIfAborted();
          const requestId = travel.status.id;
          cancelOwnRequest = () => { if (travel.status.id === requestId) travel.cancel('The biome arrival ended.', false); };
          signal.addEventListener('abort', cancelOwnRequest, { once: true });
        }
        if (world?.key !== origin || !matchesWorld(core)) throw Error('The selected world changed.');
        return overviewPose(item, core);
      } });
      if(travel && result?.state!=='arrived')throw Error(result?.error||'The Sphere approach was interrupted.');
    } finally { if (cancelOwnRequest) signal.removeEventListener('abort', cancelOwnRequest); }
    signal?.throwIfAborted();   // an expired arrival must never move Main during a later retry
    if (world?.key !== origin || !matchesWorld(window.SphereApp.getState())) throw Error('The selected world changed.');
    if (!travel) window.SphereApp.setState(overviewPose(item, window.SphereApp.getState()));
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
      button('View from above', 'quiet', () => attempt(() => { if (window.SphereStageFrame?.showMain() !== false) return travelTo(item.id); })),
      button('Remove', 'quiet', () => attempt(() => remove(item.id)))]);
    for (const p of packs) if (!ids.has(p.id) && match(p.name)) {
      const location=placedHere().find(item=>item.packId===p.id);
      const actions=[button('Install', 'secondary', () => attempt(() => install(p.id)))];
      if(!location && p.placement.relation!=='border')actions.push(button('Place on Atlas','quiet',()=>attempt(()=>placeRegion(p.id))));
      row(p.name + ' · ' + p.version, location?'Regional terrain available at '+location.plotId+'.':p.description ?? '', actions);
    }
    panel.querySelector('#biomeLibraryFilter').hidden = packs.length < 8;
  }

  async function start() {
    const deadline = performance.now() + 300000;
    while (!(document.getElementById('places') && window.SphereApp && window.SphereWorld && window.SphereCollection && window.SphereAtlas) && performance.now() < deadline) await sleep(200);
    const response = await fetch(LIBRARY_URL, { cache: 'no-store' });
    const manifest = await response.json();
    packs = manifest.packs ?? [];
    construction = new Set((manifest.atlas?.underConstruction ?? []).map(id => window.SphereAtlas.byId(id)?.index).filter(Number.isInteger));
    await load();
    await selectWorld();
    const sync = () => selectWorld().catch(error => { message = error.message; render(); });
    window.addEventListener('sphere-world-changed',sync);
    window.addEventListener('sphere-state-synced',sync);
    await selectWorld();
    panel = document.createElement('section'); panel.id = 'biomeLibrary';
    panel.innerHTML = '<h3>Walkable biome packs</h3><p class="micro">Install a pack to place it on the atlas. Descend below 20 km over its plot or service opening to fly in. Visit takes you straight there.</p><input id="biomeLibraryFilter" type="search" placeholder="Filter biomes" aria-label="Filter biomes" hidden><p id="biomeLibraryStatus" class="micro" role="status" aria-live="polite"></p><div id="biomeLibraryList"></div>';
    const style = document.createElement('style');
    style.textContent = '#biomeLibrary{padding:14px 0;border-top:1px solid #ffffff22;border-bottom:1px solid #ffffff22;margin:16px 0}#biomeLibrary h4{margin:12px 0 4px}#biomeLibrary button{margin:6px 6px 2px 0}#biomeLibraryList{max-height:60vh;overflow:auto}#biomeLibraryFilter{width:100%;margin:6px 0}';
    document.head.append(style);
    document.getElementById('places').after(panel);
    panel.querySelector('#biomeLibraryFilter').oninput = event => { filter = event.target.value.trim().toLowerCase(); render(); };
    render();
  }

  const ready = start();
  window.SphereBiomeLibrary = Object.freeze({
    ready, packs: () => packs.map(p => ({ ...p })), pack, placed: () => structuredClone(placedHere()), installed: () => installedHere().map(i => ({ ...i })), entry,
    install, remove, placeRegion, travelTo, overviewPose, describe, locate, tracks, place, saveStorage, selectWorld,
    matchesWorld, underConstruction: () => [...construction],
    get persistence() { return persistence; }, get world() { return world ? { ...world } : null; }
  });
})();
