/* Frame fallback: keep the Observatory running when its tab is not being painted.
 *
 * A hidden or background tab never delivers requestAnimationFrame callbacks. The
 * boot, the loading screen, Main's draw loop and the pack runtime all wait on
 * them, so a hidden Observatory never finished opening.
 *
 * Every frame request now also arms a timer. Whichever fires first runs the
 * callback once and cancels the other. In a visible tab the real frame always
 * wins and nothing changes; in a hidden one the app ticks slowly on the timer.
 */
(function (root) {
  'use strict';
  const MARK = '__sphereFrameFallback', DELAY_MS = 250;

  function install(win) {
    if (!win || win[MARK]) return false;
    const raf = win.requestAnimationFrame.bind(win), caf = win.cancelAnimationFrame.bind(win);
    const pending = new Map();
    let next = 1, timerFrames = 0;
    win.requestAnimationFrame = callback => {
      const id = next++;
      const entry = { frame: 0, timer: 0 };
      const run = (time, fromTimer) => {
        if (!pending.delete(id)) return;
        if (fromTimer) { caf(entry.frame); timerFrames++; } else win.clearTimeout(entry.timer);
        callback(time);
      };
      pending.set(id, entry);
      entry.frame = raf(time => run(time, false));
      entry.timer = win.setTimeout(() => run(win.performance.now(), true), DELAY_MS);
      return id;
    };
    win.cancelAnimationFrame = id => {
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id); caf(entry.frame); win.clearTimeout(entry.timer);
    };
    win[MARK] = { get timerFrames() { return timerFrames; }, get pending() { return pending.size; } };
    return true;
  }

  install(root);
  root.SphereFrameFallback = Object.freeze({ install, inspect: win => { const m = (win ?? root)[MARK]; return m ? { timerFrames: m.timerFrames, pending: m.pending } : null; } });
})(window);
