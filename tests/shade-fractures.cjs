const assert = require('node:assert/strict');
const M = require('../math.js');
for (const f of ['collection', 'biomes', 'world-palette', 'world', 'field-sites', 'flight'])
  require('../' + f + '.js');
const C = SphereCollection, E = SphereEdges, B = SphereShadeEdges;
const after = { ...M.defaultState(), collection: true, era: 'after', geometryDetail: false };
const shapes = ['disk', 'square', 'cap', 'trimmed'];
const counts = { through: 0, collisions: 0, fractureBanks: 0, branched: 0, unbranched: 0 };
const fracture = SphereWorld.shadeFracture;

// Ray crossings are independent of the production half-plane predicate.
// In particular, the stair-stepped released bay is nonconvex.
function insidePolygon([u, v], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [x, y] = points[i], [a, b] = points[j];
    if ((v < y) !== (v < b) && u < x + (v - y) * (a - x) / (b - y)) inside = !inside;
  }
  return inside;
}

function checkTopology(id) {
  const regions = fracture.regions(id);
  const { 'released-bay': bank, 'seam-mouth': mouth, 'arrested-tear': tip, branch } =
    Object.fromEntries(regions.map(r => [r.id, r.points]));
  const interpolate = (a, b, t) => a.map((n, i) => n * (1 - t) + b[i] * t);
  const width = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mouthSamples = Array.from({ length: 9 }, (_, i) => interpolate(mouth[0], mouth[1], (i + 1) / 10));
  assert(mouthSamples.some(point => insidePolygon(point, bank)), 'The opening connects to the failed bays');
  assert(width(mouth[0], mouth[1]) > width(mouth[2], mouth[3]), 'The open seam narrows toward the splice');
  assert.deepEqual([tip[0], tip[2]], [mouth[2], mouth[3]], 'The tear and the seam meet without a solid sliver');
  const hinge = interpolate(mouth[2], mouth[3], .5);
  assert(fracture.margin(...hinge, id) < 0, 'The shared cross-section remains open at its exact midpoint');
  if (branch) {
    assert(insidePolygon(branch[0], mouth) && insidePolygon(branch[1], tip), 'The branch emerges from the main tear');
    assert(![bank, mouth, tip].some(poly => insidePolygon(branch[2], poly)), 'The branch arrests separately');
    counts.branched++;
  } else counts.unbranched++;
  assert(!regions.some(r => r.points !== tip && insidePolygon(tip[1], r.points)), 'The primary tear has an exposed tip');
  for (let row = 0; row < 63; row++) for (let col = 0; col < 61; col++) {
    const u = (col + .21) / 61 * 2 - 1, v = (row + .57) / 63 * 2 - 1;
    const open = regions.some(r => insidePolygon([u, v], r.points));
    assert.equal(fracture.margin(u, v, id) < 0, open, 'The analytical mask agrees with the structural polygons');
  }
}

function solid(plate, u, v) {
  return C.diskContains(u * plate.size * plate.across, v * plate.size, plate);
}

function occupancy(plate) {
  const cells = [];
  for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++)
    cells.push(solid(plate, (x + .5) / 40 - 1, (y + .5) / 40 - 1));
  return cells;
}

assert.equal(after.shadeFractureRevision, 2);
const modern = C.plates(after).filter(p => p.damage === 2);
assert(modern.length > 2);
const signatures = modern.map(occupancy);
for (let i = 0; i < modern.length; i++) {
  checkTopology(modern[i].id);
  for (let j = i + 1; j < modern.length; j++) {
    const difference = signatures[i].filter((v, k) => v !== signatures[j][k]).length;
    assert(difference > 80, 'Broken parents must have visibly different silhouettes');
  }
  const atTime = C.plates({ ...after, time: after.time + 2 * 86400 }).find(p => p.id === modern[i].id);
  assert.deepEqual(occupancy(atTime), signatures[i], 'The fracture follows the rotating parent');
  const historical = C.plates({ ...after, shadeFractureRevision: 1 }).find(p => p.id === modern[i].id);
  assert.equal(historical.damage, 1);
  assert.notDeepEqual(occupancy(historical), signatures[i]);
  assert.deepEqual(occupancy(C.plates(after).find(p => p.id === modern[i].id)), signatures[i]);
}

for (const shape of shapes) {
  const s = { ...after, shadeShape: shape };
  for (const plate of C.plates(s).filter(p => p.damage === 2)) {
    const unbroken = C.plates({ ...s, era: 'before' }).find(p => p.id === plate.id);
    assert.equal(unbroken.damage, 0);
    const frames = [];
    for (const curve of B.curves(plate).filter(c => c.kind === 'broken')) {
      // A short segment can end inside a larger void. Only exposed banks
      // separate usable plate from a through-opening.
      for (const fraction of [.5, .25, .75]) {
        const f = B.frame(s, plate, curve, curve.lo + (curve.hi - curve.lo) * fraction);
        if (f) { frames.push(f); break; }
      }
    }
    assert(frames.length >= 3, 'A damaged plate needs distinct inspectable fracture banks');
    for (const f of frames) {
      const at = E.plateVector(f.origin, plate), inward = E.plateVector(f.inward, plate);
      for (const side of [-1, 1]) {
        const uv = B.uvAt(s, plate, M.add(at, M.mul(inward, side * .0001)));
        assert.equal(solid(plate, ...uv), side > 0, 'Close inspection must straddle the actual tear');
      }
      counts.fractureBanks++;
    }
    let removed = 0, retained = 0;
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
      const u = (x + .17) / 9, v = (y + .29) / 9;
      if (!solid(unbroken, u, v)) continue;
      const occupied = solid(plate, u, v);
      const at = E.plateVector(E.canonicalPoint(s, plate, u, v), plate);
      const n = shape === 'cap' || shape === 'trimmed' ? M.norm(at) : plate.normal;
      for (const side of [-1, 1]) {
        const eye = M.add(at, M.mul(n, side < 0 ? -.035 : .215));
        const direction = M.mul(n, -side);
        const hit = C.diskDistance(M.mul(eye, 1 / s.radius), direction, plate);
        if (occupied ? !retained : !removed) {
          const contact = SphereFlight.contact(s, eye, direction, .3);
          if (occupied) {
            assert.equal(contact.kind, 'Shade');
            assert(Math.abs(contact.distance - .033) < 2e-7, 'The flight controller respects clearance on surviving skins');
          } else assert.equal(contact.distance, Infinity, 'Flight may pass entirely through the tear');
        }
        if (occupied) {
          assert(Math.abs(hit * s.radius - .035) < 2e-7, 'Both intact faces retain their physical thickness');
          counts.collisions++;
        } else {
          assert.equal(hit, Infinity, 'A fracture must pass through both faces of the parent');
          counts.through++;
        }
      }
      if (occupied) retained++; else removed++;
    }
    assert(removed > 0 && retained > removed, 'Each surviving plate has both open damage and substantial solid material');
  }
}
assert(counts.branched && counts.unbranched, 'Cross-tie failure varies across broken parents');
console.log(JSON.stringify({ status: 'PASS', damagedParents: modern.map(p => p.id), ...counts }));
