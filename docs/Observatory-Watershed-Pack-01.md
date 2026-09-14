# Watershed pack 1 · connected neighbourhood

13 September 2026 · local implementation on `codex/watershed-neighbourhood`

Enter **Watershed · the river gardens** in Places or Explore. Explore also offers
**Connected catchments · 40,000 km** and **Receiving reaches · 10,000 km**.
The original garden remains the default arrival.

## Address and migration

`biome-packs.js` registers `watershed`, geography revision 1 and art revision 1.
The entry supplies the Watershed item in Places, its coordinate convention,
required generated assets, fallback, bounds and residency budget. A scene saves
`packAddress: {schema: 1, packId: "watershed", geographyRevision: 1,
artRevision: 1, seed: 713, anchor: [...]}`. The anchor is a unit world vector;
local x/z are gnomonic kilometres in the existing shell frame. This convention
works at geographic poles and across longitude zero/180; the opposite hemisphere
is outside the pack.

Missing addresses migrate to `null`. Neither an old layout nor an existing
province automatically acquires the new neighbourhood on import. Explicitly
entering the Watershed opts into it. Unknown schemas, packs or revisions are
rejected; the address seed and anchor must exactly match the retained province.
The existing `provinceRevision: 1` and its 640 km terrain are unchanged.

The surrounding pack occupies an irregular footprint, bounded by 78,000 km
from the saved anchor. It changes a local part of layout 2. The rest of the
Sphere, including its currently regular distant atlas divisions, is retained.

## Shared geography and artistic treatment

`watershed-neighbourhood.js` connects all 22 original outlets for seed 713 to
four unequal receiving reaches, a shared downstream river, a receiving lake
and six surrounding catchments. Its 76 graph edges use cubic curves with
shared junction tangents, evaluated as twelve fixed intervals. Original outlet
positions and widths are exact boundary conditions. Bank routes derive from
the same distance and width field. No camera pose, scene time, era, image
availability or worker completion selects a new layout.

Open country separates the reaches. Broad planted and meadow colours vary
smoothly; the province's land material joins the surrounding material rather
than exposing a square of differently coloured ground. The original river
garden, terrace, groves and other service gardens keep their actual meshes.
Legacy scenes retain the old material treatment as well as their old geometry.

Both drawing and CPU selection use the same graph coordinates. Outside the
original province, terrain remains the analytic shell at zero relief: regional
rivers, lake and bank routes are **surface representations**, not excavated
channels or raised road meshes. Local walking patches sample that zero-relief
ground and protect water from generic planting; automatic landing retains
flight over open water. The original garden continues to use its detailed
terrain, structures and shared collision triangles.

This is one neighbourhood, not nine completed artistic variants or a global
hydrological solution. At 40,000 km the garden itself is below useful pixel
resolution; its receiving network provides the location cue. Fine surroundings
outside the garden still use the existing generic walking detail. Walking
remains limited to a 2.4 km patch and a 1.08 km radius of traversal.

## Readiness and resources

The graph uses numeric uniforms and adds no texture allocation or image
download. Its mask remains available with optional artwork disabled. Two graph
addresses and two prepared provinces are retained. Graph limits are 128 edges
per address and a 96 KiB numeric-data budget across the two resident graphs.
The declared existing-province budgets are 128 MiB of vertices and 96 MiB of
packed collision; these are measured separately from graph storage and from
the renderer's other texture/geometry systems. Numeric graph byte accounting
does not include JavaScript object overhead or the original drainage arrays.

Captured test routes retain the existing worker preparation, upload batching,
camera selection, saved addresses, manual speed, Play/Pause and return history.
The cloud scale and its layer heights, movement and distance fades are unchanged.
The province renderer is now compiled and its buffers staged during preparation,
including the first visit. Cached preparation needs no new upload or loading
screen; obsolete preparation still obeys the existing cancellation signal.

## Verified milestone

The [portable evidence](evidence/watershed-pack-01/build.json) records 21 passing
numerical suites and [13 passing browser suites](evidence/watershed-pack-01/browser-suites.json).
The pack-specific browser and visual suites were repeated after the final
preparation and ground-material fixes.

- Seven seeds: 134 retained original outlets and 492 connected graph edges;
  downstream widths do not narrow. Saved addresses survive clock, era and
  atlas-orientation changes, eviction and reload. Pole and longitude addresses
  were checked at three shell radii.
- [Pack audit](evidence/watershed-pack-01/pack-and-captures.json): 228 CPU/GPU
  water-mask probes agree. Four new bank arrivals settle at approximately
  1.72 m eye clearance and retain manual speed, Play/Pause and their address.
  A reduced 720 × 450 preview stays inside its reduced pixel budget.
- Across 74,284 sampled land pixels, the retained mesh and analytic material
  differ by a mean of 0.000126 on a 0–1 display-channel scale, approximately
  0.032 of an 8-bit level. Maximum individual difference is 0.294; this checks
  the broad material join, not every-pixel identity at fine geometry boundaries.
  The reviewed final images have no square material cutoff.
- [24 final views](evidence/watershed-pack-01/views.json) share one saved anchor
  across both eras: 40,000 / 10,000 / 1,100 km, 70 km down and along the shell,
  1 km and the terrace, plus clear-air and below-cloud inspections. The initial
  baseline retains each era's original entry address. Wide grazing and actual
  six-face panorama images were also reviewed. Distant tributaries can become
  subpixel fragments; horizon haze and grazing texture stretch remain visible.
- Actual **3840 × 2160 photographs** and **3840 × 1920 panoramas** each match
  byte-for-byte across two exports, retaining the exact pack address.
- [Full traversal](evidence/watershed-pack-01/flight.json): Mycelium Sea through
  the cavity to a walking arrival in Ultra Desert takes 76.83 seconds. All
  4,374 recorded samples retain Play/Pause; the final pack address is unchanged.
  Frame intervals are median 16.7 ms, p95 17.6 ms and maximum 222.2 ms.
- [Weather verification](evidence/watershed-pack-01/weather.json) retains three
  cloud layers, distance fade, paused capture equality, phase rebasing, 4K and
  panorama output. Loading recovery/cancellation, measurements, pointer travel,
  all six numerical Wound cases and both moving Shade faces also pass.

Final fixed-view timings on the RTX 5080: 43.4 s cold app startup, 1.63 s
province worker preparation, then 28.1 s view preparation including renderer
compilation and staged uploads. Cached preparation takes 8.9 ms. CPU draw
submission is median 0.9 ms / p95 1.2 ms / max 15.6 ms, with a 2.03 ms median
GPU sample. Animation-frame intervals are median 16.7 ms / p95 16.9 ms, but
one approximately **2 s interval** remains in the audit. These are separate
measurements, not a claim that all frames or initial visits meet 60 Hz.

Two CPU-prepared provinces retain 646,758 triangles, 81.42 MiB of vertices and
55.45 MiB of packed collision. The final view has seven GPU meshes, 38.84 MiB
of vertex buffers and zero pending upload bytes. Two graph addresses retain
43,616 bytes of estimated numeric data; the pack adds zero texture bytes.
Repeated seed visits and returns keep both caches bounded.

## Reproduction

Run `npm test`, `node tests/neighbourhood-browser.cjs` and
`node scripts/verify-neighbourhood.cjs` with the browser environment described
in the roadmap. `tests/neighbourhood-views.cjs` records both eras at matched
altitudes; `SPHERE_PACK_CLEAR=1` records clear-air inspection views, and
`SPHERE_PACK_BASELINE=1` selects the original province without a pack.

Local images and detailed reports are in `work/screenshots/neighbourhood/`.
The initial baseline was recorded before implementation. High-altitude weather
views show substantial pre-existing haze, so clear-air images are also required
to judge geography. A clear grazing view can see the unchanged far-side atlas;
this pack does not remove those global divisions.

The intermittent historical cold 4K mismatch remains an independent open
renderer issue. A passing capture pair is evidence for that pair, not proof
that its historical cause has been resolved.
