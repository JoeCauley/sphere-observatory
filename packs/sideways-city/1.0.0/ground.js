const CELL = 200, PLINTH = 70, CURB = 1.5, EYE = 1.7, RAMP = 9, RAMP_HALF = 10;

/* ---- deterministic city ---- */
function hash(ix, iz, k) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const STONE = [[.78, .62, .52], [.72, .56, .50], [.80, .70, .58], [.66, .58, .55]];
const ROOF = [[.34, .52, .50], [.42, .36, .44], [.55, .40, .30]];
function describe(ix, iz) {
  const k = hash(ix, iz, 1), kind = k < .10 ? 'pool' : k < .19 ? 'plaza' : 'block', boxes = [];
  if (kind === 'block') {
    const w = 34 + hash(ix, iz, 2) * 24, d = 26 + hash(ix, iz, 3) * 30, h = 14 + hash(ix, iz, 4) * 16;
    const cx = (hash(ix, iz, 5) - .5) * (PLINTH - w) * 1.2, cz = (hash(ix, iz, 6) - .5) * (PLINTH - d) * 1.2;
    boxes.push({ x0: cx - w, x1: cx + w, z0: cz - d, z1: cz + d, h, tiers: 1 + Math.floor(hash(ix, iz, 7) * 3) });
    if (hash(ix, iz, 8) < .22) { const r = 13 + hash(ix, iz, 9) * 7, tx = (hash(ix, iz, 10) < .5 ? -1 : 1) * (PLINTH - r - 3), tz = (hash(ix, iz, 11) < .5 ? -1 : 1) * (PLINTH - r - 3); boxes.push({ x0: tx - r, x1: tx + r, z0: tz - r, z1: tz + r, h: 80 + hash(ix, iz, 12) * 90, tower: r }); }
  }
  if (kind === 'plaza') { for (let i = -1; i <= 1; i++) for (const s of [-13, 13]) boxes.push({ x0: i * 46 + s - 1, x1: i * 46 + s + 1, z0: -1.2, z1: 1.2, h: 7, prop: true }); boxes.push({ x0: -4, x1: 4, z0: 34, z1: 42, h: 22, prop: true }); }
  return { kind, boxes, stone: STONE[Math.floor(hash(ix, iz, 13) * STONE.length)], roof: ROOF[Math.floor(hash(ix, iz, 14) * ROOF.length)] };
}
const cells = new Map();
function cell(ix, iz) { const key = ix + ',' + iz; let c = cells.get(key); if (!c) { c = describe(ix, iz); cells.set(key, c); if (cells.size > 4000) cells.delete(cells.keys().next().value); } return c; }
const local = v => v - Math.round(v / CELL) * CELL, index = v => Math.round(v / CELL);

// Height of the walkable surface, and whether something solid stands there.
function ground(x, z) {
  const c = cell(index(x), index(z)), lx = local(x), lz = local(z), ax = Math.abs(lx), az = Math.abs(lz);
  if (c.kind === 'plaza') return 0;
  if (ax <= PLINTH && az <= PLINTH) return c.kind === 'pool' && ax < PLINTH - 6 && az < PLINTH - 6 ? CURB - .4 : CURB;
  if (ax > PLINTH && ax <= PLINTH + RAMP && az <= RAMP_HALF) return CURB * (PLINTH + RAMP - ax) / RAMP;
  if (az > PLINTH && az <= PLINTH + RAMP && ax <= RAMP_HALF) return CURB * (PLINTH + RAMP - az) / RAMP;
  return 0;
}
function solid(x, z, y) {
  const c = cell(index(x), index(z)), lx = local(x), lz = local(z);
  for (const b of c.boxes) if (lx > b.x0 - .6 && lx < b.x1 + .6 && lz > b.z0 - .6 && lz < b.z1 + .6 && y < CURB + b.h + 1) return true;
  return false;
}

export {CELL, PLINTH, CURB, EYE, RAMP, RAMP_HALF, hash, cell, local, index, ground, solid};
