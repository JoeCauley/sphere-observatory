/* Stage sound: the sounds of a flight between biomes.
 *
 * Everything is synthesized here from oscillators and noise. Nothing is sampled, and nothing
 * is copied from any game or film. Each voice is a plain function (ctx, out, t0, seconds) that
 * schedules its own nodes and returns when it ends, so a voice can also be rendered offline
 * and checked without anyone listening.
 *
 * Browsers only allow sound after the person has clicked or pressed something on the page.
 * The Fly to and Visit buttons are such clicks; a flight started by a script stays silent.
 */
(function (root) {
  'use strict';
  const noiseOf = new WeakMap();
  function noise(ctx) {
    let buffer = noiseOf.get(ctx);
    if (!buffer) { buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseOf.set(ctx, buffer); }
    const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true; return source;
  }
  const gain = (ctx, v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filter = (ctx, type, f, q = .7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const osc = (ctx, type, f, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; return o; };
  const run = (source, t0, t1) => { source.start(t0); source.stop(t1 + .05); };
  const env = (param, points) => { param.setValueAtTime(points[0][1], points[0][0]); for (let i = 1; i < points.length; i++) param.linearRampToValueAtTime(points[i][1], points[i][0]); };
  const glide = (param, t0, a, t1, b) => { param.setValueAtTime(a, t0); param.exponentialRampToValueAtTime(b, t1); };

  const voices = {
    // Lift-off: the arrival played backwards. The three tones swell in and cut off; the engine winds up through thinning air.
    lift(ctx, out, t0, s) {
      const t1 = t0 + s, lead = Math.min(2.2, s * .25), edge = Math.min(.8, s * .3);
      [392, 294, 196].forEach((f, i) => { const o = osc(ctx, 'sine', f), g = gain(ctx, 0), a = t0 + i * .09; o.connect(g).connect(out); env(g.gain, [[a, 0], [a + lead - .03, .09], [a + lead, 0]]); run(o, a, a + lead + .05); });
      const g = gain(ctx, 0), lp = filter(ctx, 'lowpass', 320, 1); lp.connect(g).connect(out);
      for (const cents of [-7, 6]) { const o = osc(ctx, 'sawtooth', 58, cents); glide(o.frequency, t0, 58, t1, 150); o.connect(lp); run(o, t0, t1); }
      glide(lp.frequency, t0, 320, t1, 1100); env(g.gain, [[t0, 0], [t0 + edge, .1], [t1 - edge, .13], [t1, 0]]);
      const n = noise(ctx), bp = filter(ctx, 'bandpass', 520, 1), ng = gain(ctx, 0); n.connect(bp).connect(ng).connect(out);
      glide(bp.frequency, t0, 520, t1, 2000); env(ng.gain, [[t0, 0], [t0 + s * .2, .06], [t0 + s * .7, .12], [t1, 0]]); run(n, t0, t1);
      return t1;
    },
    // Cloud: air rushing past, with a low rumble under it.
    cloud(ctx, out, t0, s) {
      const t1 = t0 + s, n = noise(ctx), bp = filter(ctx, 'bandpass', 500, .8), g = gain(ctx, 0); n.connect(bp).connect(g).connect(out);
      bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(1400, t0 + s * .4); bp.frequency.exponentialRampToValueAtTime(600, t1);
      env(g.gain, [[t0, 0], [t0 + s * .35, .62], [t0 + s * .7, .42], [t1, 0]]); run(n, t0, t1);
      const r = noise(ctx), lp = filter(ctx, 'lowpass', 180, .7), rg = gain(ctx, 0); r.connect(lp).connect(rg).connect(out);
      env(rg.gain, [[t0, 0], [t0 + s * .4, .5], [t1, 0]]); run(r, t0, t1);
      return t1;
    },
    // The jump: a charge, a deep release, a rhythmic engine over a quiet drone for as long as the crossing lasts, and a drop-out.
    jump(ctx, out, t0, s) {
      const charge = Math.min(1.2, s * .2), tR = t0 + charge, tEnd = t0 + Math.max(s, charge + 1.6), tOut = Math.max(tR + .5, tEnd - 1.1);
      // charge
      const cg = gain(ctx, 0), hp = filter(ctx, 'highpass', 120, .7); hp.connect(cg).connect(out);
      const c1 = osc(ctx, 'sawtooth', 70), c2 = osc(ctx, 'sine', 140); glide(c1.frequency, t0, 70, tR, 880); glide(c2.frequency, t0, 140, tR, 1760);
      c1.connect(hp); c2.connect(hp); run(c1, t0, tR + .05); run(c2, t0, tR + .05); env(cg.gain, [[t0, 0], [tR - .05, .1], [tR + .03, 0]]);
      const cn = noise(ctx), ch = filter(ctx, 'highpass', 800, .7), cng = gain(ctx, 0); cn.connect(ch).connect(cng).connect(out);
      glide(ch.frequency, t0, 800, tR, 6000); env(cng.gain, [[t0, 0], [tR - .05, .05], [tR + .05, 0]]); run(cn, t0, tR + .1);
      // release
      const sub = osc(ctx, 'sine', 120), sg = gain(ctx, 0); sub.connect(sg).connect(out); glide(sub.frequency, tR, 120, tR + .6, 30);
      env(sg.gain, [[tR, 0], [tR + .01, .8], [tR + 1.4, 0]]); run(sub, tR, tR + 1.5);
      const bn = noise(ctx), bl = filter(ctx, 'lowpass', 1800, .7), bg = gain(ctx, 0); bn.connect(bl).connect(bg).connect(out);
      glide(bl.frequency, tR, 1800, tR + .7, 200); env(bg.gain, [[tR, 0], [tR + .01, .22], [tR + .7, 0]]); run(bn, tR, tR + .8);
      // drone
      const lp = filter(ctx, 'lowpass', 500, 2), dg = gain(ctx, 0); lp.connect(dg).connect(out);
      const lfo = osc(ctx, 'sine', .23), depth = gain(ctx, 220); lfo.connect(depth).connect(lp.frequency); run(lfo, tR, tEnd);
      for (const [f, cents] of [[55, -6], [82.5, 5], [110, 9]]) { const o = osc(ctx, 'sawtooth', f, cents); o.frequency.setValueAtTime(f, tOut); o.frequency.exponentialRampToValueAtTime(f * .6, tEnd); o.connect(lp); run(o, tR, tEnd); }
      env(dg.gain, [[tR, 0], [tR + .8, .04], [tOut, .04], [tEnd, 0]]);   // the drone is the bed; the engine below carries the crossing
      const an = noise(ctx), ab = filter(ctx, 'bandpass', 3000, .5), ag = gain(ctx, 0); an.connect(ab).connect(ag).connect(out);
      env(ag.gain, [[tR, 0], [tR + 1, .015], [tOut, .015], [tEnd, 0]]); run(an, tR, tEnd);
      // engine: a deep pulse, more felt than heard. Its pace and pitch follow the camera, which starts the
      // crossing from rest, is fastest in the middle and comes to rest again.
      const steps = 64, span = tEnd - tR - .02, pace = new Float32Array(steps), pitch = new Float32Array(steps);
      for (let i = 0; i < steps; i++) { const x = (tR + span * i / (steps - 1) - t0) / (tEnd - t0), v = 4 * x * (1 - x); pace[i] = 1.1 + 2.1 * v; pitch[i] = 36 + 8 * v; }
      const el = filter(ctx, 'lowpass', 120, .9), throb = gain(ctx, .5), eg = gain(ctx, 0); el.connect(throb).connect(eg).connect(out);
      for (const [mult, level] of [[1, 1], [2, .22]]) { const o = osc(ctx, 'sine', 36 * mult), og = gain(ctx, level); o.frequency.setValueCurveAtTime(pitch.map(f => f * mult), tR + .01, span); o.connect(og).connect(el); run(o, tR, tEnd); }
      for (const [k, depth] of [[1, .42], [2, .16]]) { const beat = osc(ctx, 'sine', 1.1 * k), bd = gain(ctx, depth); beat.connect(bd).connect(throb.gain); beat.frequency.setValueCurveAtTime(pace.map(f => f * k), tR + .01, span); run(beat, tR, tEnd); }
      env(eg.gain, [[tR, 0], [tR + .6, .6], [tOut, .6], [tEnd, 0]]);
      // drop-out
      const dn = noise(ctx), db = filter(ctx, 'bandpass', 900, .9), dng = gain(ctx, 0); dn.connect(db).connect(dng).connect(out);
      env(dng.gain, [[tOut, 0], [tEnd - .08, .12], [tEnd, 0]]); run(dn, tOut, tEnd);
      const th = osc(ctx, 'sine', 90), tg = gain(ctx, 0); th.connect(tg).connect(out); glide(th.frequency, tEnd, 90, tEnd + .4, 36);
      env(tg.gain, [[tEnd, 0], [tEnd + .01, .5], [tEnd + .55, 0]]); run(th, tEnd, tEnd + .6);
      return tEnd + .6;
    },
    // Descent: the engine winding down through thickening air.
    descend(ctx, out, t0, s) {
      const t1 = t0 + s, g = gain(ctx, 0), lp = filter(ctx, 'lowpass', 1100, 1); lp.connect(g).connect(out);
      for (const cents of [-7, 6]) { const o = osc(ctx, 'sawtooth', 150, cents); glide(o.frequency, t0, 150, t1, 58); o.connect(lp); run(o, t0, t1); }
      glide(lp.frequency, t0, 1100, t1, 320); env(g.gain, [[t0, 0], [t0 + Math.min(.8, s * .3), .13], [t1 - Math.min(.8, s * .3), .1], [t1, 0]]);
      const n = noise(ctx), bp = filter(ctx, 'bandpass', 2000, 1), ng = gain(ctx, 0); n.connect(bp).connect(ng).connect(out);
      glide(bp.frequency, t0, 2000, t1, 520); env(ng.gain, [[t0, 0], [t0 + s * .3, .12], [t0 + s * .8, .06], [t1, 0]]); run(n, t0, t1);
      return t1;
    },
    // Arrival: three soft tones, one after another.
    settle(ctx, out, t0) {
      [196, 294, 392].forEach((f, i) => { const o = osc(ctx, 'sine', f), g = gain(ctx, 0), a = t0 + i * .09; o.connect(g).connect(out); env(g.gain, [[a, 0], [a + .03, .09], [a + 2.2, 0]]); run(o, a, a + 2.3); });
      return t0 + 2.6;
    }
  };

  const KEY = 'sphere-stage-sound';
  let ctx = null, master = null, on = true;
  try { on = root.localStorage.getItem(KEY) !== 'off'; } catch {}
  function context() {
    if (!ctx) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = .5; const limit = ctx.createDynamicsCompressor(); master.connect(limit).connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // Any click or key on the page lets the browser start sound.
  for (const type of ['pointerdown', 'keydown']) root.addEventListener(type, () => { if (on) context(); }, { capture: true, passive: true });
  root.SphereStageVoices = voices;
  root.SphereStageSound = Object.freeze({
    play(name, seconds) { if (!on || !voices[name]) return false; const c = context(); if (!c || c.state !== 'running') return false; voices[name](c, master, c.currentTime + .03, seconds); return true; },
    toggle() { on = !on; try { root.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} if (!on && ctx) ctx.suspend().catch(() => {}); else if (on) context(); return on; },
    get on() { return on; },
    get state() { return ctx ? ctx.state : 'not started'; }
  });
})(window);
