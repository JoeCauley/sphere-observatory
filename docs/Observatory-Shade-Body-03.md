# Continuous Shade bodies and curved edge closure

14 September 2026 · Shade geometry revision 3 · roadmap item 4

## What changed

Current exploration now gives Shades two continuous analytic faces, 180 m apart.
Both faces use the same projected footprint, including every existing damaged
opening. Camera collision and altitude/speed assistance use the appropriate face.
The dimensions remain provisional engineering, as in the earlier edge sections.

Finished intact perimeters have closed layered panels and vertical frame members.
Broken boundaries retain exposed braces, recessed backing, and now have connecting
upper/lower returns. Edge discovery follows the actual moving parent on disk,
square, spherical-cap and trimmed-cap shapes. No Place selection is necessary.
The inexpensive envelope is available synchronously when readable; finer members
arrive through the existing worker and replace their coarse interval atomically.
The continuous faces remain when distant edge geometry becomes subpixel.

Curved edges are sampled on the actual spherical surface, with the outer face
at the larger radius. Both detail levels share the same boundary ticks and depth
profiles. The circular loop wraps across its last/first chunk; exact endpoints
replace the previous epsilon-inset endpoints. Recessed profiles close flush at
straight/curved corners and clipped intersections. Fine braces do not change the
body envelope. This is camera-local closure, not a globally tessellated hull.

Unselected approaches also prepare the two Shade artworks from outside a
perimeter. Previously the asset broad-phase used perpendicular skin rays, which
could miss the entire Shade from just outside its edge and leave only the simple
grid material until the camera crossed onto the skin.

## The reported long opening

There are two different features:

- Damaged Shades intentionally have long through-fractures and holes. Their
  width is a fraction of a millions-of-kilometres Shade, so they can be enormous.
  Those are preserved; the exposed service structure belongs at their banks.
- The old revision-1 inspection strip also placed a raised, open-sided deck along
  an imaginary fracture reference on **intact** Shades. That could look like an
  unexplained long break during surface travel. The supplied “exposed service
  structure” label is specific to that older strip. Revision 3 removes this
  artifact from current exploration. Intact Place visits now frame a real outer
  perimeter, instead of that reference line through the middle.

The screenshots do not supply an exact portable camera state, so the tests
reproduce these code paths rather than claiming an exact pixel reconstruction.

## Compatibility and use

Refresh the local app. A pre-update browser session upgrades to revision 3 once,
preserving its view/settings and reopening paused. If a camera on the old outer
skin would be embedded inside the added 180 m body, it moves outward by that
thickness to keep its clearance. Other cameras keep their position.

World → Shell geography → Shade edge detail selects **Solid shades · automatic
edges**. Explicit later selections remain saved. Portable imported scenes retain
their geometry revision: revision 1 keeps its original strip and revision 2 its
thin skin with automatic edge sections. New scenes use revision 3.

## Verification

- `tests/shade-body.cjs`: both continuous faces at 48 positions across four
  shapes/two eras, matching collision/altitude, eight real perimeter arrivals,
  eight cold envelopes with a deliberately unresponsive worker, open fractures,
  migration and historical-scene compatibility.
- `tests/shade-seams.cjs`: 43,200 identical coarse/fine envelope vertices,
  120 adjoining endpoint checks and 48 corner-profile checks. Maximum recovered
  separation is 0.149 mm after local float storage; maximum analytic-face error
  is 0.067 mm. The test limit is 0.2 mm, below the 2 m flight clearance.
- `tests/shade-footprint.cjs`: 140,816 triangle centroids remain within the
  combined footprint, including fracture intersections on all four shapes.
- `tests/shade-body-browser.cjs`: textured intact/broken views on all four shapes,
  upper and lower views, first-frame coarse coverage, corner closure, unchanged
  residency on head turns and graphics-error checks. Artworks must actually be
  uploaded; a simple-grid capture cannot pass the material-preparation assertion.
- The existing boundary test can run its independent 41-scene coverage matrix
  with `SPHERE_COVERAGE_ONLY=1`. Its default still includes the strict original
  cold/repeat image check. Coverage-only is not a capture-repeatability pass.

The full command passes **31 numerical suites**. The independent coverage matrix
matches all **944,640 pixels in 41 scenes**. The eight browser fixtures have zero
background leaks in cold/coarse and detailed wall views; eight straight/curved
corner fixtures also have zero leaks. Sixteen textured views include both sides.
See the [verification record](evidence/shade-body-03/verification.json),
[intact preview](../examples/archive/pre-v1.5/docs/evidence/shade-body-03/cap-intact.png),
[broken preview](../examples/archive/pre-v1.5/docs/evidence/shade-body-03/trimmed-broken.png) and
[importable intact view](evidence/shade-body-03/intact-scene.json).

## Remaining limits

Cold preparation is still visible: the browser diagnostic observed roughly
0.15–0.38 s building a complete first readable envelope, separate from shader
compilation and artwork loading. Warm residency is retained. This delivery does
not certify 60 Hz cold flight. Edge retirement is based on output-pixel size;
the distant body has continuous faces with subpixel side walls omitted.

The previous cold-capture repeatability issue remains open. A full boundary-suite
attempt during this work differed by two pixels, one channel level each, at its
first cap capture; its strict assertion remained failing. No warm-up or relaxed
tolerance was added to the renderer to conceal that diagnostic.

Stellar eclipse sampling retains its existing thin-footprint approximation on
CPU and GPU. This work changes visible primary surfaces, local edge structures
and contact, not the global lighting solver. Complete interiors, authored
Shade-face environments and walking on both faces remain roadmap item 8.

Continue with the joined receiving lake, quiet reach and open meadow after this
bounded Shade delivery. Preserve the body, seam, approach, texture and historical
scene checks as the environment families expand.
