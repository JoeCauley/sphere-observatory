/* Stage frame: visit real pack scenes at their installed places, inside Main.
 *
 * The biome service decides WHERE a pack lives (allocator, saved binding). This
 * file decides only WHAT you see when you visit: it opens the accepted pack
 * scene in a same-origin frame over Main's viewport and closes it on Return.
 * Main is never reloaded and none of the service's pinned sources are edited.
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
    'fixture-track-meadow': { name: 'Infinite Meadow', entry: 'packs/infinite-meadow/1.0.0/index.html' },
    'fixture-open-industry': { name: 'Infinite Industry', entry: 'packs/infinite-industry/1.0.0/index.html' }
  });

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let current = null;   // { packId, regionId, shell, frame, observer }
  let opening = false;

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
    let installation = null, index = -1, regionIndex = 0;
    for (const node of [...places.children]) {
      if (node.tagName === 'H4') { installation = list[++index] ?? null; regionIndex = 0; continue; }
      if (node.tagName !== 'P' || !installation) continue;
      const region = installation.regions?.[regionIndex++];
      const scene = SCENES[installation.packId];
      if (!region || !scene) continue;
      if (node.nextElementSibling?.dataset?.stageRegion === region.regionId) continue;
      let overview = node.nextElementSibling;
      while (overview && !(overview.tagName === 'BUTTON' && overview.textContent === 'View assigned region')) {
        if (overview.tagName === 'H4') { overview = null; break; }
        overview = overview.nextElementSibling;
      }
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
    // Main replaces its travel status object on every change: ready -> preparing
    // (when a view needs preparation) -> arrived. Arrival itself is synchronous.
    const travel = window.SphereJourney?.travel;
    const started = performance.now();
    while (travel?.status === before && performance.now() - started < 1500) await sleep(50);
    while (travel?.status?.state === 'preparing' && performance.now() - started < 120000) await sleep(100);
    await sleep(400);
  }

  async function visitPlace(packId, region, overviewButton) {
    if (current || opening) return;
    opening = true;
    try {
      if (overviewButton && !overviewButton.disabled) {
        say('Flying to the assigned place');
        const before = window.SphereJourney?.travel?.status;
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

  function open(packId, regionId, address) {
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
    const back = document.createElement('button'); back.textContent = 'Return to the Sphere'; back.className = 'secondary'; back.onclick = close;
    bar.append(title, where, back);

    const frame = document.createElement('iframe');
    frame.title = scene.name;
    Object.assign(frame.style, { flex: '1', width: '100%', border: '0', background: '#000' });
    frame.addEventListener('load', () => { if (current?.frame === frame) guard(frame); });
    frame.src = new URL(scene.entry, base).href;

    shell.append(bar, frame);
    document.body.append(shell);
    place(shell);
    const observer = new ResizeObserver(() => place(shell));
    observer.observe(document.getElementById('view'));
    window.addEventListener('resize', onResize);

    current = { packId, regionId, shell, frame, observer };
    remember({ schema: 1, packId, regionId, address });
    say(scene.name + ' is open at its assigned place. Use Return to the Sphere to come back.');
  }

  function onResize() { if (current) place(current.shell); }

  function close() {
    if (!current) return;
    const { shell, frame, observer, packId } = current;
    current = null;
    // The pack runtime saves its place and releases its GPU resources on pagehide.
    try { const child = frame.contentWindow; child.dispatchEvent(new child.Event('pagehide')); } catch {}
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    shell.remove();
    remember(null);
    say('Back above the assigned place. ' + (SCENES[packId]?.name ?? 'The scene') + ' kept your saved place.');
    document.getElementById('view')?.focus?.();
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
