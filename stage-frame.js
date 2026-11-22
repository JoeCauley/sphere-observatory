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
 * Walking handoffs project the current position and heading onto the adjoining
 * chart. Flight cinematics are described in docs/Observatory-Stage-Frame-2026-11-11.md.
 */
(function () {
  'use strict';

  const KEY = 'sphere-stage-frame-v2';
  const base = new URL('.', document.currentScript.src);
  const rootPath = base.pathname;
  const library = () => window.SphereBiomeLibrary;

  let optics=null, geography=null, walking=null, suppressedPlot=null, observedPlace=null, lastMouth=null, borderFailure=null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const sound = (name, seconds) => { try { window.SphereStageSound?.play(name, seconds); } catch {} };   // stage-sound.js; silent if absent
  let current = null;   // { id, shell, frame, observer, where }
  let parked = null; // departure remains visible until a surface arrival has drawn its own frames
  let opening = false;
  let flying = false;
  let lastFlight = null;   // what the last flight found, for inspection
  let lastArrival = null;

  // A biome's scene, in the shape the rest of this file uses.
  function sceneOf(item) {
    const pack = library()?.pack(item.packId);
    if (!pack) return null;
    // contract: the biome implements sphere-biome/1 and needs no special handling here.
    return { name: pack.name, transport:!!item.transport, atmosphere: pack.atmosphere || 'clear', atmosphereRules:pack.atmosphereRules, entry: pack.entry, saveKey: pack.saveKey, contract: pack.contract === 'sphere-biome/1', ascent: pack.travel?.ascent === 'guided-journey',
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
    if (opening || flying) { say('A flight is in progress.'); return; }
    if(current?.frame.surfaceEntry?.passage){
      const frame=current.frame;
      if(await leavePassage(frame.contentWindow,frame.surfaceEntry.reverse?'far':'near'))return visit(id);
      return;
    }
    if (current) {
      if (current.id === id) { current.frame.contentWindow?.focus(); say('You are already in ' + library().entry(id).name + '.'); return; }
      const target = destinations(current.id).find(other => other.item.id === id);
      if (target) return flyTo(target);
      return;
    }
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

  function mountFrame(id, query = '', surfaceEntry = null) {
    const passage=surfaceEntry?.passage;
    const item = library().entry(id) ?? (passage && id==='border-outfall' ? {id,packId:id,name:'The Outfall'} : null);
    const scene=item && sceneOf(item);
    if (!scene || current) return;
    const address=passage ? passage.near.name + ' → ' + passage.far.name : library().describe(item);
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
    const others = passage ? [] : destinations(id);
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
      Object.assign(pick.style,{width:'auto',maxWidth:'min(32vw,13rem)',minWidth:'0'});
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
    if(passage)back.textContent='Return to entry';
    bar.append(back);

    const frame = document.createElement('iframe');
    frame.title = scene.name;
    if (surfaceEntry) frame.surfaceEntry = surfaceEntry;
    frame.dataset.worldKey = library().world.key;
    Object.assign(frame.style, { flex: '1', width: '100%', border: '0', background: '#000' });
    frame.addEventListener('load', () => { if (current?.frame === frame) guard(frame); });
    frame.addEventListener('error', () => { if (current?.frame === frame) current.loadError = 'The destination document failed to load.'; });
    frame.src = new URL(scene.entry + query, base).href;
    shell.style.opacity = '0'; shell.style.pointerEvents = 'none';

    if(item.transport || (id==='infinite-meadow' && surfaceEntry?.geographic && library().entry('border-transport')))
      Object.assign(bar.style,{position:'absolute',top:'0',left:'0',right:'0',zIndex:'2'});
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

  function retire({shell, frame, observer}) {
    if(frame.contentWindow===cloudSource)cloudSource=null;
    // The pack runtime saves its place and releases its GPU resources on pagehide.
    try { const child = frame.contentWindow; child.dispatchEvent(new child.Event('pagehide')); } catch {}
    observer.disconnect();
    if (!current) window.removeEventListener('resize', onResize);
    shell.remove();
  }

  function onResize() { if (current) place(current.shell); if (parked) place(parked.shell); }

  function close(options) {
    if (!current) return;
    const toGround = options?.toGround === true;
    const { shell, frame, observer, id } = current;
    const item = library()?.entry(id), scene = item && sceneOf(item);
    if(current.frame.surfaceEntry?.geographic)suppressedPlot=id;
    observedPlace=null;
    current = null;
    cover(false);
    const main = view(); if (main) { main.style.transition = ''; main.style.filter = ''; }
    retire({ shell, frame, observer });
    if (!options?.inTransit) remember(null, frame.dataset.worldKey);
    if (toGround && !scene?.contract) groundSave(scene?.saveKey);   // a contract biome keeps its own place; the host does not edit its save
    if (!options?.silent) say('Back above ' + (scene?.name ?? 'the biome') + '. It kept your saved place.');
    document.getElementById('view')?.focus?.();
  }

  /* ---- Stagecraft: what hides the join between Main and a scene ---- */

  const HANDOFF_KM = 1500;   // Default overview exchange for packs without a surveyed camera
  const view = () => document.getElementById('view');
  const easeIn = x => x * x, easeOut = x => 1 - (1 - x) * (1 - x);
  const altitudeOf = P => P.radius - Math.hypot(...P.position);

  // Main does not draw while a scene covers it completely. Its clock keeps running.
  // While covered, or in flight, Main's "Preparing your view" card is kept out of sight:
  // Main still prepares, but behind the scene, or as a held frame, never as a card.
  const quietStyle = document.createElement('style');
  quietStyle.textContent = 'body.stage-quiet #sceneLoading{opacity:0!important;pointer-events:none!important} body:has(.transport-flight) #viewport :is(.view-top,.view-bottom,.reticle,.target-readout,#surfaceLegend){visibility:hidden} #viewport:has(canvas[data-station]:not([hidden])) .target-readout{visibility:hidden}';
  document.head.append(quietStyle);
  function quiet() { document.body.classList.toggle('stage-quiet', flying || window.sphereStageCovered === true); }
  function cover(on) {
    window.sphereStageCovered = on === true; quiet();
    const name=current?.frame.surfaceEntry?.passage?'Outfall passage':library()?.entry(current?.id)?.name;
    window.dispatchEvent(new CustomEvent('sphere-visible-biome',{detail:on&&current?name:null}));
  }

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
        const km = Math.exp(Math.log(top) + (Math.log(Math.min(top,HANDOFF_KM)) - Math.log(top)) * i / 12);
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
  let cloudLayer = null, cloudRecipe;
  const inBlind = scene => ['meadow-mist','works-vapour','city-smog'].includes(scene.atmosphere);
  const arrivalQuery = scene => '?arrival=air&hold=1&fromM='+(inBlind(scene)?'blind':scene.transport?scene.atmosphereRules.farM:HANDOFF_KM*1000);
  function airOf(scene){
    if(!scene.atmosphereRules)return optics.atmosphere(scene.atmosphere);
    const {base,...rules}=scene.atmosphereRules;
    return {...optics.atmosphere(base),...rules,id:scene.atmosphere};
  }
  let cloudSource=null,cloudDirect=1;
  function useAir(scene){
    cloudRecipe=airOf(scene);cloudSource=current?.frame.contentWindow;
    const p=cloudSource?.SphereBiome?.pose?.(),s=window.SphereApp.getState();
    cloudDirect=(p && surfaceLight(cloudSource,p)?.direct)??(s.routeShades?SphereCollection.visibility(s.position,s,64):1);
  }
  function cloud() {
    if (cloudLayer) return cloudLayer;
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'fixed', zIndex: '950', pointerEvents: 'none', display: 'none' });
    document.body.append(canvas);
    const painter=optics.makeCloudPainter(canvas);
    let opacity = 0, goal = 0, perMs = 0, direction = 1, climb = 0, last = 0, running = false, waiting = [];
    function frame(now) {
      const dt = Math.min(250, last ? now - last : 0); last = now;
      opacity = goal > opacity ? Math.min(goal, opacity + perMs * dt) : Math.max(goal, opacity - perMs * dt);
      climb += direction * dt * 1.4;   // the wisps stream past: upward travel reads as climbing, downward as sinking
      const r = view()?.getBoundingClientRect();
      if (r) {
        Object.assign(canvas.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', display: opacity > 0 || goal > 0 ? 'block' : 'none' });
        painter.draw(opacity,now,climb,cloudRecipe||optics.atmosphere('meadow-mist'),window.SphereApp.getState().seed,cloudLight());
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

  function cloudLight(){
    // A preloaded destination cannot illuminate the departing cloud.
    if(cloudSource && current?.frame.contentWindow===cloudSource){
      const p=cloudSource.SphereBiome?.pose?.();
      if(p)cloudDirect=surfaceLight(cloudSource,p)?.direct??cloudDirect;
    }
    return cloudDirect;
  }

  // Project the regional image with the pack camera while it has the flight controls.
  // Only the narrow overlap needs both levels of detail. A held camera reuses its pixels.
  let surveyView=null,surveyLoad=null,surveyRetry=0;
  function hideSurvey(){
    if(surveyView)surveyView.canvas.hidden=true;
  }
  function retireSurvey(){
    surveyLoad=null;surveyRetry=0;
    if(surveyView){surveyView.view.dispose();surveyView.canvas.remove();surveyView=null;}
  }
  function stationLand(district){
    const lib=library(),plots=district.origin.plots;
    return plots.map(plot=>{const item=lib.placed().find(x=>!x.edge && x.plotId===plot);
      return lib.pack(item?.packId)?.overview?.albedo??[.26,.29,.25];});
  }
  function prepareSurvey(site,district){
    const key=site.address.key;
    if(surveyLoad===key || performance.now()<surveyRetry)return;
    retireSurvey();surveyLoad=key;
    stationExterior(site.address,library().persistence==='file').then(({station,makeView})=>{
      if(surveyLoad!==key)return;
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.dataset.station=key;canvas.hidden=true;
      Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
      view().after(canvas);
      try{
        const renderer=makeView(canvas,{capture:false,composite:true,district,land:stationLand(district)});
        renderer.load(station);surveyView={canvas,view:renderer,station,key,stamp:-Infinity};
      }catch(error){canvas.remove();throw error;}
    }).catch(error=>{
      if(surveyLoad!==key)return;surveyLoad=null;surveyRetry=performance.now()+3000;
      console.warn('Station preview unavailable',error);
    });
  }
  // Near one AU, global shader coordinates cannot distinguish the sides of a 32 km hall.
  // Draw the surveyed footprint in the camera chart before individual decks become visible.
  function projectSurvey(now,s){
    const altitude=s.radius-Math.hypot(...s.position);
    if(altitude>1200 || altitude<-.2 || !s.collection){if(surveyLoad)retireSurvey();return false;}
    const item=library()?.entry('border-transport'),d=item?.transport;
    if(!d || !geography || !library().matchesWorld(s)){
      if(surveyLoad)retireSurvey();return false;
    }
    const q=norm(s.position),ll=SphereWorld.coordinates(q,s);
    if(Math.abs(ll.lat-d.origin.latitude)*s.radius>1500){if(surveyLoad)retireSurvey();return false;}
    const p=geography.packPose(s,item,SphereAtlas,SphereWorld);
    const range=Math.hypot(Math.max(0,altitude),Math.max(0,geography.outsideDistrict(d,p.eastM,p.northM))*.001);
    const extent=Math.max(...d.sites.map(site=>site.widthM))*.001;
    if(range>extent*(surveyLoad?25:22)){if(surveyLoad)retireSurvey();return false;}
    const site=d.sites.reduce((a,b)=>Math.abs(a.x-p.eastM)<=Math.abs(b.x-p.eastM)?a:b);
    if(surveyView?.key!==site.address.key){prepareSurvey(site,d);return false;}
    const weight=optics.layerWeight(extent*3,extent*16,range),v=surveyView;
    if(weight<=0){hideSurvey();return false;}
    const w=view().clientWidth,h=view().clientHeight;
    if(!w||!h){hideSurvey();return false;}
    // Native ground takes over before landing. A shallow turn reveals the cavity ray by ray.
    const groundWeight=s.walkMode?0:1-optics.layerWeight(.1,2,altitude);
    v.canvas.hidden=false;v.canvas.style.opacity=String(weight);
    const time=window.SphereApp.sceneSeconds;
    const key=[...s.position,...s.up,...s.forward,s.fov,s.routeShades,s.time,time,w,h,groundWeight].join('/');
    if(v.pose!==key && now-v.stamp>=32){
      const axes=geography.stationBasis(s,d,p,SphereWorld);
      const direct=s.routeShades?SphereCollection.visibility(scale(q,s.radius-Math.max(.0001,altitude)),s,64):1;
      const focal=w/h/Math.tan(s.fov*Math.PI/360);
      v.view.draw(v.station,[p.eastM-site.x,p.altitudeM,p.northM+v.station.widthM/2],p.yaw,p.pitch,time,false,direct,
        {...axes,focal,groundWeight,maxWidth:altitude>15?720:undefined});
      // Upper bound for the vertical component of any normalized view ray. Only a fully opaque view can skip Main.
      const aspect=w/h,top=axes.forward[1]+(Math.abs(axes.up[1])+aspect*Math.abs(axes.right[1]))/focal;
      v.opaque=groundWeight===1 && top<=-.32*Math.hypot(1,1/focal,aspect/focal);
      v.stamp=now;v.pose=key;
    }
    return v.opaque && weight>=1;
  }
  function regionalFrame(now,warm=false,mainState=null){
    const c=current;
    if(!optics || !geography)return false;
    if(!c?.regional || !c.shell.isConnected){
      if(!window.sphereStageCovered && mainState)return projectSurvey(now,mainState);
      hideSurvey();return false;
    }
    const api=c.frame.contentWindow?.SphereBiome,p=api?.pose?.();
    if(!p || (!warm && p.mode!=='flight')){c.frame.style.opacity='1';hideSurvey();return false;}
    const item=library().entry(c.id);if(!item)return false;
    const recipe=c.regional;
    let weight=optics.layerWeight(recipe.nearM,recipe.farM,p.altitudeM);
    if(item.transport && !warm && !flying && p.mode==='flight' && p.altitudeM<recipe.nearM){
      const d=item.transport,site=geography.nearestSite(d,p.eastM);
      // Above the roof the same station projects into Main. Reveal the cavity before crossing its facade.
      const aboveRoof=1-optics.layerWeight(site.roofM+geography.roofSlabM,site.roofM+400,p.altitudeM);
      const edge=geography.outsideDistrict(d,p.eastM,p.northM);
      const belowOverlap=optics.layerWeight(recipe.nearM*.6,recipe.nearM,p.altitudeM);
      weight=Math.min(weight,1-aboveRoof*belowOverlap*(1-optics.layerWeight(-4500,0,edge)));
    }
    if(!warm){
      c.frame.style.opacity=String(weight);
      if(c.id==='border-transport' && p.altitudeM>=recipe.nearM){
        const label='Builder station approach · '+(p.altitudeM/1000).toFixed(1)+' km above the floor';
        if(c.where.textContent!==label)c.where.textContent=label;c.altitudeLabel=true;
      }else if(c.altitudeLabel){c.where.textContent=library().describe(library().entry(c.id));c.altitudeLabel=false;}
    }
    if(weight>=1 && !warm){hideSurvey();return false;}
    const camera=warm?{...p,mode:'flight',altitudeM:(recipe.nearM+recipe.farM)/2,pitch:-1.49}:p;
    const s=window.SphereApp.getState(), rect=c.frame.getBoundingClientRect();
    if(rect.width<2 || rect.height<2)return false;
    const key=[s.time,camera.eastM,camera.northM,camera.altitudeM,camera.yaw,camera.pitch,rect.width,rect.height,s.routeShades,s.exposure].join('/');
    if(c.regionalKey===key || now-(c.regionalStamp??-Infinity)<40)return true;
    const pose=geography.mainPose(s,item,camera,SphereAtlas,SphereWorld);
    const scale=Math.min(1,640/rect.width,360/rect.height);
    pose.fov=2*Math.atan(rect.width/rect.height/recipe.focal)*180/Math.PI;
    // The regional image is already filtered to the display size during the dissolve.
    pose.geometryDetail=false;pose.antialias=Math.min(pose.antialias??0,1);
    if(recipe.density===0 && !item.transport){pose.clouds=false;pose.textureDetail=false;pose.richMaterials=false;}
    const surveyed=projectSurvey(now,pose);
    if(!surveyed)window.SphereApp.renderer.draw(pose,Math.round(rect.width*scale),Math.round(rect.height*scale));
    c.regionalKey=key;c.regionalStamp=now;return true;
  }
  function enableRegional(c,scene){
    if(!c || !scene || !optics)return;
    c.regional=airOf(scene);
    c.shell.style.background='transparent';
    if(scene.transport)c.shell.classList.add('transport-flight');
    const bar=c.shell.firstElementChild;
    Object.assign(bar.style,{position:'absolute',top:'0',left:'0',right:'0',zIndex:'2'});
    regionalFrame(performance.now());
  }

  // Prime the exact low-altitude shader while the apron still fills the viewport.
  // A fence lets the compositor keep presenting while a cold GPU finishes compiling.
  async function prepareClearDeparture(c,scene){
    enableRegional(c,scene);
    if((c.frame.contentWindow?.SphereBiome?.pose?.()?.altitudeM??Infinity)>c.regional?.nearM)return;
    if(!regionalFrame(performance.now(),true))return;
    const gl=window.SphereApp.renderer.gl,sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!sync)return;
    try{
      gl.flush();
      const end=performance.now()+4000;
      while(current===c && performance.now()<end && gl.clientWaitSync(sync,0,0)===gl.TIMEOUT_EXPIRED)await sleep(16);
    }finally{gl.deleteSync(sync);}
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
      let timer, watching = false, finished = false, finalCheck = false;
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
          const remaining = deadline - now;
          if (remaining <= 0) {
            // A driver can block the UI thread past the deadline while it compiles.
            // Give an already-drawn frame and its fulfilled ready promise one event turn.
            if(phase==='ready' && !finalCheck){
              finalCheck=true;timer=setTimeout(poll,100);return;
            }
            const result = { status: 'timeout', phase };
            const state = opened.frame.contentWindow?.SphereBiome?.inspect?.();
            if (state) result.scene = { frames: state.frames, held: state.held, scripted: state.scripted };
            return finish(result);
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

  function clearRecovery() { borderFailure?.end();borderFailure=null;document.getElementById('biomeArrivalRecovery')?.remove(); }

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
      if (route === 'geographic') enterRegion(id,window.SphereApp.getState());
      else if (route === 'restore' || route === 'open') openScene(id, route, { query });
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
    else if (route === 'geographic') say('Entered ' + scene.name + ' in free flight.');
    else if (route === 'open' || (!scene.contract && route === 'visit')) say(scene.name + ' is open. Use Return to the Sphere to come back.');
    else { sound('settle'); say(scene.name + ': you have arrived from the air.'); }
    opened.frame.contentWindow?.focus();
    return lastArrival;
  }

  async function show(id, route, query = '', geographic = null) {
    const scene = sceneOf(library().entry(id));
    mountFrame(id, query, geographic);
    const opened = current;
    if (!opened) return;
    const status=(geographic?window.SphereTransitStatus.crossing:window.SphereTransitStatus.begin)(scene.name,'Opening the biome and preparing its first frame.');
    let result;
    try { result=await settled(opened,scene,45000); }
    finally { status.end(); }
    if (current !== opened) return;
    if (result.status === 'ready') {
      const fromAir = new URLSearchParams(query).get('arrival') === 'air';
      result = scene.contract ? await biomeArrival(opened, fromAir) : { status: 'arrived', phase: 'arrival' };
      if (current !== opened) return;
      if (result.status === 'arrived' || result.status === 'taken-over') {
        if(geographic){enableRegional(opened,scene);opened.shell.style.opacity='1';opened.shell.style.pointerEvents='';cover(true);}
        else await dissolve(opened.shell, opened.frame, true, 700);
      }
    }
    if(geographic && (result.status==='arrived'||result.status==='taken-over'))geographic.active=true;
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
    if(leaving.frame.surfaceEntry?.passage){
      await leavePassage(leaving.frame.contentWindow,leaving.frame.surfaceEntry.reverse?'far':'near');return;
    }
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

  function stationCamera(opened,scene,core){
    const api=opened.frame.contentWindow.SphereBiome,rect=opened.frame.getBoundingClientRect();
    const p=geography.mainPose(core,library().entry(opened.id),api.pose(),SphereAtlas,SphereWorld);
    return {...p,fov:2*Math.atan(rect.width/rect.height/scene.atmosphereRules.focal)*180/Math.PI};
  }
  async function glideStationCamera(start,end,valid){
    const worldKey=library().world.key;
    const high=altitudeOf(start),low=altitudeOf(end),a=norm(start.position),b=norm(end.position);
    const began=performance.now(),duration=Math.max(1800,paceMs(high,low)),M=window.SphereMath;
    for(;;){
      if(library().world?.key!==worldKey || (valid && !valid()))return;
      const t=Math.min(1,(performance.now()-began)/duration),k=t*t*(3-2*t);
      const f=norm(mix(start.forward,end.forward,k)),project=u=>norm(add(u,scale(f,-dot(u,f))));
      const u=project(start.up),v=project(end.up),angle=Math.atan2(dot(f,M.cross(u,v)),dot(u,v));
      const h=Math.exp(Math.log(high)+(Math.log(low)-Math.log(high))*k);
      const camera={...window.SphereApp.getState(),position:scale(norm(mix(a,b,k)),start.radius-h),
        forward:f,up:M.rotate(u,f,k*angle),fov:start.fov+(end.fov-start.fov)*k};
      setFlightView(camera);projectSurvey(performance.now(),camera);
      if(t===1)return;
      await new Promise(requestAnimationFrame);
    }
  }
  // Visit and Fly to use the same two gates, before the reveal and after the approach.
  async function descendAndLand(opened, scene, { from = null, pose, overview, loading, glide }) {
    const route = from ? 'fly' : 'visit';
    say('Descending toward ' + scene.name);
    const top = altitudeOf(pose), floor = floorKm(pose), sinkMs = paceMs(top, floor);
    if (from) lastFlight.arriveKm = Math.round(floor);
    const sinking = scene.transport?Promise.resolve():sinkMain(pose, top, floor, sinkMs, easeIn);
    if (!scene.transport && sinkMs > 500) sound('descend', sinkMs / 1000);
    let waiting,loaded=false;
    sinking.then(()=>{if(!loaded && current===opened)waiting=window.SphereTransitStatus.begin(scene.name,'Preparing the destination landscape.');}).catch(()=>{});
    let ready;
    try { ready=await loading; } finally { loaded=true;waiting?.end(); }
    if (ready.status !== 'ready') {
      await sinking;   // finish the old camera motion before handing Main back to the explorer
      return finishArrival(opened, scene, route, from, ready, overview);
    }
    await Promise.race([sinking, sleep(Math.max(0, sinkMs - 1300))]);
    if (current !== opened) return;
    if(scene.transport){
      const receiver=stationCamera(opened,scene,pose);
      sound('descend',paceMs(top,altitudeOf(receiver))/1000);
      await glideStationCamera(pose,receiver,()=>current===opened);
      if(current!==opened)return;
      if(from)lastFlight.arriveKm=Math.round(altitudeOf(stationCamera(opened,scene,pose)));
    }
    const blind=opened.frame.contentWindow?.SphereBiome?.air?.().blind;
    if(blind){useAir(scene);sound('cloud',3.2);await cloud().to(1,1200,-1);}
    await sinking;
    if (current !== opened) return;
    // The surveyed approach has already flown Main to the receiving camera.
    if (from && !scene.transport) {
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
    if(!blind)enableRegional(opened,scene);
    opened.shell.style.opacity = '1'; opened.shell.style.pointerEvents = '';
    opened.frame.contentWindow?.focus();
    const landing = scene.contract ? biomeArrival(opened, true)
      : glide ? glideIn(opened.frame, glide) : Promise.resolve({ status: 'arrived', phase: 'arrival' });
    const reveal=(blind?sleep(500).then(()=>cloud().to(0,1200,-1)):Promise.resolve()).then(()=>{if(current===opened)cover(true);});
    const [result] = await Promise.all([landing, reveal]);
    if(scene.transport && current===opened)setFlightView({...window.SphereApp.getState(),fov:pose.fov});
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
      try { const s=window.SphereApp.getState();overB=library().overviewPose(target.item,s);B=flightPose(overB);A=flightPose(library().overviewPose(library().entry(here.id),s)); }
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
        if(blind)useAir(scene);
        else{
          // A clear guided departure needs Main's renderer for the live overlap. Finish preparing both ends first.
          await rehearsal;
          if(current!==here)return;
          await prepareClearDeparture(here,scene);
          if(current!==here)return;
        }
        if (scene.contract && typeof api?.ascend !== 'function') throw Error('The departure pack could not start its ascent.');
        const lifting = scene.contract ? Promise.resolve(api.ascend({ toAltitudeM: blind ? (blind.baseM + blind.topM) / 2 : scene.transport?scene.atmosphereRules.farM:HANDOFF_KM * 1000, handoff: true })) : ascend(here.frame);
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
        try { low = !!api && (!!blind || scene.transport || api.pose().altitudeM >= HANDOFF_KM * 900); } catch {}
      }
      label('Leaving for ' + target.scene.name);
      here.shell.style.pointerEvents = 'none';
      // Main is already moving when it comes into view. After a contract biome it starts
      // at the height the scene reached and keeps rising; otherwise the crossing has begun.
      flight.rehearsal = await rehearsal;
      const released=scene.transport?stationCamera(here,scene,window.SphereApp.getState()):null;
      const topA = altitudeOf(A), floorA = released?altitudeOf(released):low ? floorKm(A) : topA;
      flight.departKm = Math.round(floorA);
      setFlightView(released??withHeight(A, floorA));
      moving = (async () => {
        if(released)await glideStationCamera(released,A);
        else if (floorA < topA) await sinkMain(A, floorA, topA, paceMs(topA, floorA), easeOut);
        say('Crossing the Sphere to ' + target.scene.name);
        await crossSphere(A, B);
      })();
      // Into cloud; the pictures change places behind it; then the fast fall away.
      if (clouded) await clouded;
      else if(!scene.contract){useAir(scene);sound('cloud',3.2);await cloud().to(1,low?500:1100,1);}
      close({ toGround: true, inTransit: true, silent: true });
      if(cloudLayer?.opacity)sleep(900).then(()=>cloud().to(0,1400,1));
      // The destination loads unseen during the crossing, so it is ready before it is wanted.
      let glide = null;
      if (target.scene.glide) try { glide = await prepareGlide(target.scene); } catch (error) { console.warn('Stage frame: glide unavailable', error); }
      const byContract = target.scene.contract;
      mountFrame(target.item.id, glide ? '' : byContract ? arrivalQuery(target.scene) : target.scene.flightArrival);
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
      mountFrame(id, arrivalQuery(scene));
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
      if(!blind){await rehearsal;if(current!==leaving)return true;await prepareClearDeparture(leaving,scene);if(current!==leaving)return true;}
      sound('lift', 16);
      const lifting = Promise.resolve(api.ascend({ toAltitudeM: blind ? (blind.baseM + blind.topM) / 2 : scene.transport?scene.atmosphereRules.farM:HANDOFF_KM * 1000, handoff: true }));
      if(blind)useAir(scene);
      const clouded = blind ? cloudOverAscent(api, lifting) : null;
      const result = await lifting;
      if (current !== leaving) return true;
      if (result !== 'revealed') { if (clouded) { await clouded; cloud().to(0, 400, 1); } await rehearsal; setFlightView(A); controls(false); cover(true); say('You have the controls. Still in ' + scene.name + '.'); return true; }
      leaving.shell.style.pointerEvents = 'none';
      await rehearsal;
      const released=scene.transport?stationCamera(leaving,scene,window.SphereApp.getState()):null;
      const top = altitudeOf(A), floor = released?altitudeOf(released):floorKm(A);
      setFlightView(released??withHeight(A, floor));
      const rising = released?glideStationCamera(released,A):floor < top ? sinkMain(A, floor, top, paceMs(top, floor), easeOut) : Promise.resolve();
      if (clouded) await clouded;
      close({ toGround: true });
      if(clouded){await sleep(900);await cloud().to(0,1400,1);}
      await rising;
      try { window.SphereSession?.flush(); } catch {}
      return true;
    } finally { flying = false; quiet(); }
  }

  function transportAddress(){
    const lib=library(),district=lib?.entry('border-transport')?.transport,meadow=lib?.entry('infinite-meadow');
    if(!district || !meadow || !geography)return null;
    return {district,rows:geography.meadowStations(district,SphereAtlas.byId(meadow.plotId)),fileBacked:lib.persistence==='file'};
  }
  async function stationExterior(address,fileBacked){
    // A surveyed station can open onto native ground. Start linking its shared triangle program while the station is still visible.
    const renderer=window.SphereApp.renderer;
    if(!renderer.geometry&&!renderer.geometryPreparation && renderer.gl.getExtension('KHR_parallel_shader_compile'))
      renderer.prepareGeometry().catch(error=>console.warn('Native ground preparation',error));
    const [{stationRecord},{makeView}]=await Promise.all([
      import(new URL('packs/border-transport/0.10.0/atlas.mjs',base)),
      import(new URL('packs/border-transport/0.10.0/view.mjs',base))]);
    const {station}=await stationRecord(address,false,fileBacked);
    return {station,makeView};
  }
  function surfaceAddress() {
    const lib=library(), meadow=lib?.entry('infinite-meadow'), outfall=lib?.entry('border-outfall');
    if (!meadow || !outfall?.edge || outfall.edge.near !== meadow.plotId) return null;
    return {home:window.SphereAtlas.byId(meadow.plotId), edge:outfall.edge, radiusKm:lib.world.params.radius};
  }

  // Outdoor renderers ask about their own position. Time, pause and Shade
  // geometry belong to Main, including while the viewport is covered.
  const lightSamples=new WeakMap();
  function surfaceLight(source,pose) {
    const scene=[current,parked].find(s=>s && s.frame.contentWindow===source);
    if(!scene || !geography || scene.worldKey!==library()?.world?.key)return null;
    const passage=scene.frame.surfaceEntry?.passage,item=library()?.entry(scene.id);
    if(!passage && !item)return null;
    const now=performance.now(),last=lightSamples.get(source);
    if(last && now-last.at<80 && Math.hypot(pose.eastM-last.east,pose.northM-last.north,pose.altitudeM-last.height)<1000)return last.light;
    const s=window.SphereApp.getState();
    let receiver;
    if(passage){
      const metres=Math.min(walking.tunnelLength,Math.max(0,pose.northM-walking.tunnelStart));
      const radial=norm(walking.passagePoint(passage,metres,s.radius));
      receiver=scale(radial,s.radius-Math.max(.0001,pose.altitudeM/1000));
    }else receiver=geography.lightReceiver(s,item,pose,SphereAtlas,SphereWorld);
    const light={time:s.time,direct:SphereCollection.visibility(receiver,s,64)};
    lightSamples.set(source,{at:now,east:pose.eastM,north:pose.northM,height:pose.altitudeM,light});
    return light;
  }
  let nativeSky=null;
  function surfaceBackdrop(source,pose) {
    const scene=[current,parked].find(s=>s && s.frame.contentWindow===source);
    const lib=library(),map=window.SphereBiomeSurface?.mapData(),home=lib?.entry('infinite-meadow');
    if(!scene || scene.frame.surfaceEntry?.passage || !home || !map || !geography || scene.worldKey!==lib.world?.key)return null;
    const s=window.SphereApp.getState(),axes=SphereWorld.frame(s);
    if(nativeSky?.key!==scene.worldKey){
      const width=128,height=64,data=new Uint8Array(width*height*4);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const q=SphereWorld.direction(((y+.5)/height-.5)*Math.PI,((x+.5)/width-.5)*2*Math.PI,s);
        const color=SphereWorld.sample(q,s).color;
        data.set([...color.map(v=>Math.round(255*Math.max(0,Math.min(1,v)))),255],4*(y*width+x));
      }
      nativeSky={key:scene.worldKey,width,height,data};
    }
    // Both outdoor renderers pass Meadow chart coordinates, including the rotated Outfall apron.
    const at=(e,n)=>norm(geography.worldPosition(s,home,{eastM:e,northM:n,altitudeM:0},SphereAtlas,SphereWorld));
    const radial=at(pose.eastM,pose.northM),inAtlas=v=>[dot(v,axes.right),dot(v,axes.up),dot(v,axes.axis)];
    const tangent=q=>norm(q.map((v,i)=>v-dot(q,radial)*radial[i]));
    const east=tangent(at(pose.eastM+1000,pose.northM)),north=tangent(at(pose.eastM,pose.northM+1000));
    return {map,native:nativeSky,radiusKm:s.radius,radial:inAtlas(radial),east:inAtlas(east),north:inAtlas(north)};
  }
  function canCrossSurface(source) {
    return !!current && current.frame.contentWindow===source && !current.pending && !opening && !flying && !current.leaving;
  }
  async function crossSurface(source, payload, geographicTarget=null) {
    const here=current, address=surfaceAddress();
    if (!canCrossSurface(source))return false;
    if(!geographicTarget && (!address || payload.edge!==address.edge.id || !['infinite-meadow','border-outfall'].includes(here.id)))return false;
    const id=geographicTarget?.id??(here.id==='infinite-meadow'?'border-outfall':'infinite-meadow');
    const arrival={...structuredClone(payload), active:false};
    opening=true;
    parked=here;
    let destination;
    const status=window.SphereTransitStatus.crossing(library().entry(id).name,'Opening the adjoining ground.');
    try {
      here.shell.inert=true;here.shell.id='departingStageFrame';
      current=null;
      mountFrame(id,'',arrival);
      destination=current;
      if (!destination) throw Error('The adjoining biome is unavailable.');
      const result=await settled(destination,sceneOf(library().entry(id)),45000);
      if(current!==destination || parked!==here)return false;
      if(result.status!=='ready')throw Error(result.message || 'The adjoining view did not finish opening.');
      destination.shell.style.transition='opacity 350ms linear';
      destination.shell.style.opacity='1';
      await sleep(350);
      if(current!==destination || parked!==here)return false;
      retire(here);parked=null;
      destination.pending=false;
      if(geographicTarget)enableRegional(destination,sceneOf(geographicTarget));
      destination.shell.style.pointerEvents='';
      arrival.active=true;
      destination.frame.contentWindow.focus();
      remember({schema:2,id});
      recordArrival(id,'surface',here.id,{status:'arrived',phase:'arrival'});
      say('Reached '+library().entry(id).name+' along the surface.');
      cover(true);
      return true;
    } catch(error) {
      if(parked===here){
        if(destination && current===destination)retire(destination);
        current=here;parked=null;here.shell.id='stageFrame';here.shell.inert=false;
        say('Surface crossing paused. '+error.message);
      }
      return false;
    } finally {status.end();opening=false;}
  }

  /* ---- Startup: add buttons, and reopen the scene you were in ---- */

  async function enterRegion(id,state) {
    const lib=library(),item=lib?.entry(id);
    if(!geography || !item || current || flying || opening || !lib.matchesWorld(state))return;
    const here=geography.footprint(state,lib,SphereAtlas,SphereWorld);
    if(here?.id!==id)return;
    opening=true;suppressedPlot=id;clearRecovery();lastArrival=null;
    const camera={geographic:true,pose:geography.packPose(state,item,SphereAtlas,SphereWorld),active:false};
    try{
      window.SphereApp.clearNavigation?.();
      say('Entering '+item.name+' at your flight position.');
      await show(id,'geographic','',camera);
    }catch(error){recover(id,'geographic',null,issue('load-failure','ready',error));}
    finally{opening=false;}
  }
  function groundAt(q,state) {
    return walking.ownerAt(q,state,library().placed(),SphereAtlas,SphereWorld);
  }
  function station(point,state,owner=groundAt(point.q,state)) {
    const color=library().pack(owner.id)?.overview?.albedo ?? SphereWorld.sample(point.q,state).color;
    return {...point,id:owner.id,name:owner.name,pack:owner.pack,tint:color||[.35,.38,.36]};
  }
  function shellView(state,station) {
    const q=station.q,up=q.map(n=>-n);
    return {...state,position:q.map(n=>n*(state.radius-.0017)),forward:station.forward.slice(),up,
      siteId:'',siteAnchor:null,terrainAnchor:null,siteRevision:0,siteElevation:0,
      walkPosition:null,walkVelocity:0,walkMode:true,walkSurface:true,shadeAttachment:null,geometryDetail:true};
  }
  // Keep the departure frame and its save until the adjoining scene can actually support a walker.
  async function walkGround(point,passage=null,entryPose=null) {
    const lib=library(),core=window.SphereApp.getState();
    if(!walking || !lib?.matchesWorld(core) || opening || flying || current?.pending)return false;
    const named=point.pack && lib.entry(point.id);
    const owner=passage ? {id:'border-outfall',name:'Outfall passage',pack:true}
      : named ? {id:named.id,name:named.name,pack:true} : groundAt(point.q,core);
    if(!passage && (SphereMath.inBreach(point.q,core)||SphereCollection.missing(point.q,core)))return false;
    const id=owner.id, here=current, worldKey=lib.world.key;
    const sharedStation=here && [id,here.id].includes('border-transport') && [id,here.id].includes('infinite-meadow');
    const threshold=!sharedStation && !!(passage || here?.frame.surfaceEntry?.passage || id==='border-transport' || here?.id==='border-transport');
    clearRecovery();
    const status=window.SphereTransitStatus.crossing(owner.name,'Preparing the adjoining ground.');
    opening=true;let destination;
    try {
      await window.SphereTransitStatus.paint();
      if(lib.world?.key!==worldKey || current!==here)throw Error('The active world changed.');
      if(here){parked=here;here.shell.inert=true;here.shell.id='departingStageFrame';}
      current=null;
      if(owner.pack){
        const view=shellView(core,point);
        const pose=entryPose||geography.packPose(view,lib.entry(id),SphereAtlas,SphereWorld);
        const entry={geographic:true,pose,passage,reverse:!!passage && pose.yaw===Math.PI,active:false};
        mountFrame(id,'',entry);destination=current;
        if(!destination)throw Error('The neighbouring scene is unavailable.');
        const scene=passage?{contract:true}:sceneOf(lib.entry(id));
        const ready=await settled(destination,scene,90000);
        if(ready.status!=='ready'||current!==destination)throw Error(ready.detail ||
          (ready.status==='timeout'?'The neighbouring scene took too long to draw its first frame.':'The crossing was interrupted.'));
        if(destination.frame.contentWindow.SphereBiome.pose().mode!=='walk')throw Error('The doorway is obstructed.');
        status.end();
        if(threshold){destination.shell.style.transition='opacity 280ms ease-in-out';destination.shell.getBoundingClientRect();}
        destination.shell.style.opacity='1';
        if(threshold){await sleep(280);if(current!==destination || lib.world.key!==worldKey)throw Error('The crossing was interrupted.');}
        destination.pending=false;destination.shell.style.pointerEvents='';
        destination.frame.contentWindow.focus();entry.active=true;cover(true);
        remember({schema:2,id,...(passage?{passage,pose}:{})});
      } else {
        const result=await window.SphereJourney.travel.request({type:'place',title:owner.name,stageTrip:true,resolve:s=>{
          const next=shellView(s,point);
          next.walkMode=false;
          SphereLanding.enter(next,next.position,{activate:false,grounded:true});
          return next;
        }});
        if(result.state!=='arrived' || !window.SphereApp.getState().walkMode)throw Error(result.error||'Could not reach walkable ground.');
        status.end();cover(false);
        if(here && threshold){
          window.SphereApp.draw();await window.SphereTransitStatus.paint();
          here.shell.style.transition='opacity 280ms ease-in-out';here.shell.style.opacity='0';await sleep(280);
          if(parked!==here || lib.world.key!==worldKey)throw Error('The crossing was interrupted.');
        }
        remember(null);document.getElementById('viewport').focus({preventScroll:true});
      }
      if(here)retire(here);
      parked=null;observedPlace=null;
      recordArrival(id,'surface',here?.id??null,{status:'arrived',phase:'arrival'});
      say('On foot in '+owner.name+'.');return true;
    } catch(error) {
      if(destination && current===destination){current=null;retire(destination);}
      if(parked===here && here){current=here;here.shell.inert=false;here.shell.id='stageFrame';here.shell.style.opacity='1';cover(true);window.addEventListener('resize',onResize);}
      parked=null;say('Surface crossing paused. '+error.message);
      if(lib.world?.key===worldKey)borderFailure=window.SphereTransitStatus.begin('Surface crossing paused',error.message,[
        ['Retry crossing',()=>walkGround(point,passage,entryPose)],['Stay here',clearRecovery]
      ],true);
      return false;
    } finally {status.end();opening=false;}
  }
  async function clearGate(gate,retry){
    if(!gate.far.pack || !['infinite-industry','sideways-city'].includes(gate.far.id))return gate;
    if(opening||flying)return null;
    const lib=library(),key=lib.world?.key,source=current;
    opening=true;clearRecovery();
    const status=window.SphereTransitStatus.crossing(gate.far.name,'Finding clear ground for the tunnel exit.');
    try{
      await window.SphereTransitStatus.paint();
      const {surveyGate}=await import(new URL('portal-landing.js',base));
      const state=window.SphereApp.getState();
      if(current!==source||lib.world?.key!==key||!lib.matchesWorld(state))return null;
      return surveyGate(gate,state,lib.installed(),{atlas:SphereAtlas,world:SphereWorld});
    }catch(error){
      if(lib.world?.key===key){
        say('Surface crossing paused. '+error.message);
        borderFailure=window.SphereTransitStatus.begin('Surface crossing paused',error.message,[
          ['Retry crossing',retry],['Stay here',clearRecovery]
        ],true);
      }
      return null;
    }finally{status.end();opening=false;}
  }
  async function enterPassage(gate,reverse=false) {
    if(!reverse){
      const original=gate;
      gate=await clearGate(gate,()=>enterPassage(original));
      if(!gate)return false;
    }
    const point=reverse?gate.far:gate.near;
    const pose={eastM:-1,northM:reverse?walking.tunnelEnd-.5:walking.tunnelStart+.5,
      altitudeM:1.7,yaw:reverse?Math.PI:0,pitch:0,mode:'walk'};
    return walkGround(point,gate,pose);
  }
  function crossedOnFoot(state,oldPosition,bearing=null) {
    if(!walking || current?.frame.surfaceEntry?.passage)return false;
    const q=norm(state.position),old=norm(oldPosition),delta=q.map((x,i)=>x-old[i]);
    if(Math.hypot(...delta)<1e-15)return false;
    const target=geography?.footprint(state,library(),SphereAtlas,SphereWorld);
    if(target?.transport && current?.id!==target.id){
      const f=bearing||state.forward,forward=norm(f.map((v,i)=>v-dot(f,q)*q[i]));
      return walkGround(station({q,forward},state,{id:target.id,name:target.name,pack:true}));
    }
    if(lastMouth){
      const {gate,side}=lastMouth, mouth=gate[side],d=q.map((x,i)=>(x-mouth.q[i])*state.radius*1000);
      const distance=Math.hypot(...d),direction=dot(delta,mouth.forward)*(side==='far'?-1:1);
      if(distance<4 && direction>0)return enterPassage(gate,side==='far');
    }
    const near=groundAt(old,state),far=groundAt(q,state);
    if(near.id===far.id)return false;
    const bank=SphereAtlas.waterwayAt(q,state);
    if(bank?.bank && SphereAtlas.waterwayAt(old,state)?.id===bank.id)return false;
    // Locate the edge between the two footfalls; a long stride can enter off-centre.
    let a=0,b=1;
    for(let i=0;i<24;i++){
      const mid=(a+b)/2,sample=norm(old.map((n,j)=>n+delta[j]*mid));
      if(groundAt(sample,state).id===near.id)a=mid;else b=mid;
    }
    const mouth=norm(old.map((n,j)=>n+delta[j]*a));
    const gate=walking.passageAt(mouth,bearing||delta,state.radius);
    gate.near=station(gate.near,state,near);gate.far=station(gate.far,state);
    return enterPassage(gate);
  }
  function servicePassage(source,eastM=-1) {
    const lib=library(),item=lib?.entry('border-outfall');
    if(!walking||!geography||!item?.edge||current?.id!=='border-outfall'||current.frame.contentWindow!==source)return null;
    const core=window.SphereApp.getState();
    const pose={eastM,northM:walking.tunnelStart,altitudeM:1.7,mode:'walk',yaw:0,pitch:0};
    const from=geography.mainPose(core,item,pose,SphereAtlas,SphereWorld);
    const gate=walking.passageAt(norm(from.position),from.forward,core.radius);
    gate.near=station(gate.near,core,{id:item.id,name:item.name,pack:true});
    gate.near.tint=lib.pack('infinite-meadow')?.overview?.albedo||gate.near.tint;
    gate.far=station(gate.far,core);return gate;
  }
  async function leavePassage(source,side) {
    if(!canCrossSurface(source)||current.id!=='border-outfall'||!['near','far'].includes(side))return false;
    const pose=source.SphereBiome.pose();
    const virtual=current.frame.surfaceEntry?.passage;
    if(!virtual && side!=='far')return false;
    let gate=virtual||servicePassage(source,pose.eastM);
    if(gate && !virtual)gate=await clearGate(gate,()=>leavePassage(source,side));
    if(!gate)return false;
    const point=gate[side];
    const exit={...point,forward:point.forward.map(x=>side==='near'?-x:x)};
    const arrived=await walkGround(exit);
    if(arrived)lastMouth={gate,side};
    return arrived;
  }

  function manualMovement(state,previousPosition){
    const lib=library();
    if(!geography || !lib?.world || current || flying || opening || !window.SphereLoading?.ready || window.SphereJourney?.travel.active)return;
    if(state.walkMode){if(previousPosition)crossedOnFoot(state,previousPosition);return;}
    const altitude=state.radius-Math.hypot(...state.position);
    if(altitude>geography.leaveKm){suppressedPlot=null;return;}
    if(altitude<0)return;
    const descending=previousPosition && Math.hypot(...state.position)>Math.hypot(...previousPosition);
    const target=geography.footprint(state,lib,SphereAtlas,SphereWorld);
    if(!target){suppressedPlot=null;return;}
    if(altitude>geography.enterKm && !descending)return;
    if(target.id!==suppressedPlot)void enterRegion(target.id,state);
  }
  function observeDeparture(){
    if(!geography || !current || current.pending || opening || flying || current.leaving){observedPlace=null;return;}
    const api=current.frame.contentWindow?.SphereBiome,inspect=api?.inspect?.();
    if(!inspect || !api.pose || inspect.scripted || inspect.held)return;
    const pose=api.pose(),previous=observedPlace;
    observedPlace={id:current.id,pose};
    if(previous?.id!==current.id || (pose.altitudeM===previous.pose.altitudeM && pose.eastM===previous.pose.eastM && pose.northM===previous.pose.northM))return;
    const lib=library(),item=lib.entry(current.id),s=window.SphereApp.getState();
    if(!item || !lib.matchesWorld(s))return;
    if(current.frame.surfaceEntry?.passage)return;
    const scene=sceneOf(item);
    if(pose.mode==='flight' && !current.regional && optics && scene)enableRegional(current,scene);
    const climbed=pose.altitudeM>previous.pose.altitudeM && pose.altitudeM>=geography.leaveKm*1000;
    if(!climbed && (inspect.levelCruising || pose.altitudeM>=geography.leaveKm*1000))return;
    if(!climbed && item.transport && geography.outsideDistrict(item.transport,pose.eastM,pose.northM)<=(pose.mode==='walk'?14:650))return;
    if(!climbed && item.edge && !item.transport){
      const home=SphereAtlas.byId(item.edge.near);
      if(geography.onBorder(pose,home.halfWidth*s.radius*1000,2800))return;
    }
    const worldPose=geography.mainPose(s,item,pose,SphereAtlas,SphereWorld);
    const target=climbed?null:geography.footprint(pose.mode==='walk'?{...worldPose,walkMode:true}:worldPose,lib,SphereAtlas,SphereWorld);
    if(!climbed && target?.id===item.id)return;
    if(!climbed && pose.mode==='walk' && target?.transport){
      const q=norm(worldPose.position),owner={id:target.id,name:target.name,pack:true};
      void walkGround(station({q,forward:worldPose.forward},s,owner));return;
    }
    if(!climbed && (item.edge || target?.edge)){
      if(pose.mode==='walk' && !target?.edge){
        const q=norm(worldPose.position);
        void walkGround(station({q,forward:worldPose.forward},s));return;
      }
      if(target){
        const entry={geographic:true,pose:geography.packPose(worldPose,target,SphereAtlas,SphereWorld)};
        void crossSurface(current.frame.contentWindow,entry,target);return;
      }
    }
    if(pose.mode==='walk' && previous.pose.mode==='walk'){
      const old=geography.mainPose(s,item,previous.pose,SphereAtlas,SphereWorld);
      if(crossedOnFoot({...worldPose,walkMode:true},old.position))return;
    }
    if(!climbed && target){
      const entry={geographic:true,pose:geography.packPose(worldPose,target,SphereAtlas,SphereWorld)};
      void crossSurface(current.frame.contentWindow,entry,target);return;
    }
    const id=item.id;
    close({silent:true});suppressedPlot=id;setFlightView(worldPose);
    say('Back in Sphere free flight above '+item.name+'.');
    document.getElementById('viewport')?.focus({preventScroll:true});
  }
  async function start() {
    const deadline = performance.now() + 300000;
    while (!library() && performance.now() < deadline) await sleep(200);
    await library()?.ready;
    [geography,walking,optics]=await Promise.all(['geographic-flight.js','surface-passages.js','packs/kit/atmosphere.js'].map(path=>import(new URL(path,base))));
    window.setInterval(observeDeparture,200);
    // A biome removed while its scene is open closes the scene.
    window.addEventListener('sphere-biome-world-leaving', () => {
      retireSurvey();suppressedPlot=null;observedPlace=null;lastMouth=null;
      clearRecovery();
      if (parked) { retire(parked); parked=null; }
      if (current) close({inTransit:true, silent:true});
      if (cloudLayer) cloudLayer.to(0, 200);
    });
    window.addEventListener('sphere-biomes-changed', () => {
      retireSurvey();
      if(parked && !surfaceAddress()){
        const departure=parked;parked=null;
        if(current)close({inTransit:true,silent:true});
        current=departure;current.shell.id='stageFrame';current.shell.inert=false;cover(true);window.addEventListener('resize',onResize);
      }
      if(current && !current.frame.surfaceEntry?.passage && !library().entry(current.id) && !flying)close();
    });
    const saved = remembered();
    if (!saved) return;
    while (!window.SphereLoading?.ready && performance.now() < deadline) await sleep(250);
    if (current || opening || flying) return;
    if (window.SphereControls?.userSelected && !document.querySelector('[data-tab=camera].active')) return;
    if(saved.passage && saved.pose && saved.id==='border-outfall'){
      await walkGround(saved.passage.near,saved.passage,saved.pose);return;
    }
    if (library().entry(saved.id)) { window.SphereControls?.select('camera'); await openScene(saved.id, 'restore'); }
    else remember(null);
  }

  window.SphereStageFrame = Object.freeze({ visit, manualMovement,
    crossWalkingEdge(from,to,bearing){
      const core=window.SphereApp.getState();
      return crossedOnFoot({...core,position:to},from,bearing);
    }, approachLabel(s){
    const height=altitudeOf(s);
    if(!geography || current || height<0 || height>Math.min(s.radius*.4,4000000) || !library()?.world)return '';
    const item=geography.footprint(s,library(),SphereAtlas,SphereWorld);
    return item?' · '+item.name+' below · '+(height>geography.enterKm?'descend below '+geography.enterKm+' km to enter':'fly into its landscape'):'';
  }, regionalFrame, presentStation(source){
    if(current?.regional && current.frame.contentWindow===source)regionalFrame(performance.now());
  }, stationLand, transportAddress, stationExterior, surfaceAddress, surfaceLight, surfaceBackdrop, servicePassage, canCrossSurface, crossSurface, walkGround, leavePassage,
    savePassage(source,pose){const passage=current?.frame.surfaceEntry?.passage;
      if(passage && current.frame.contentWindow===source && !current.pending && current.frame.surfaceEntry.active)
        remember({schema:2,id:'border-outfall',passage,pose});},
    showMain() {
    if (opening || flying) { const message='A flight is in progress.'; say(message); window.SphereApp?.toast(message); return false; }
    if (current) close();
    return true;
  }, open: (id, options) => openScene(id, 'open', options), close: () => { if (!flying && !parked) close(); }, leave,
    get lastFlight() { return lastFlight ? { ...lastFlight } : null; },
    get lastArrival() { return lastArrival ? { ...lastArrival } : null; },
    get current() { return current ? { id: current.id } : null; },
    get flying() { return flying; },
    get cloudOpacity() { return cloudLayer?.opacity ?? 0; }
  });
  start();
})();
