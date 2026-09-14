# Edge flight and surface continuity 2

Implemented locally 13 September 2026, after Wound seams 1.

## Behaviour

New sessions start with automatic speed, an 80° horizontal lens and 0.2 stops
exposure. The viewport and Flight console read the same state. Ordinary Place,
pointer, biome and field visits retain the chosen lens and exposure. Explicit
manual speed and saved/imported scene settings remain intact.

Auto speed now measures the nearest point on visible triangles, including
terrain faces, their edges and corners. It no longer estimates nearby geometry
using a handful of view-relative rays. The same tree and packed-tree geometry
used by collision supplies the query, with nearest-first bounding-box pruning.
The search is bounded to 1,000 km; major surfaces have analytic fallbacks.

Near a Wound, separation from its finite shell-depth wall combines with height
above/below its lip. Near a Shade, the footprint, trimmed sides, three fracture
families, both crack directions and small holes contribute even before a Shade
is selected. The curved/damaged Shade estimate is a conservative speed aid,
not new collision or rendered geometry. Exact triangle distance takes over for
resident structures. Steep curved banks can therefore slow the user early.

Acceleration is limited to exp(3·dt) times the previous speed, as well as the
existing eased target. At 60 Hz this is at most a 5.13% increase per step.
Braking still follows the immediate clearance ceiling and swept collision.
Manual speed retains its existing multiplier and bypasses Auto.

## Watershed diagnosis and correction

The 36.325 km grazing fixture reproduces the screenshot's dotted dark strip.
The old border shader discarded province fragments between 258 and 319.5 km,
while collision kept the continuous terrain. In the diagnostic border sample,
259 of 3,052 pixels exceeded the depth comparison tolerance. Maximum logarithmic
depth discrepancy was 0.00248008. These holes also supplied alternating surface
depths to weather composition.

Province terrain already tapers its height to the shell at 320 km. The fix
keeps this terrain opaque through the existing material transition. No terrain,
water, outlet, bank or saved geography address moved. The same 3,052 probes now
have zero failures; maximum logarithmic error is 0.000009903, below the 0.00002
rasterisation tolerance of this grazing test. This is a coarse grazing diagnostic,
not a millimetre collision claim; the existing detailed Watershed depth test is
retained separately. The dark stipple is absent from the matched clear/cloudy
images. No new weather shader, cloud scale, layer height or temporal history was
introduced in this step.

Local biome/port ground also blends its outer 0.32 km material band into the
geographically addressed shell material. It remains opaque, with identical
terrain, props and collision. The Wound top/end vertex joins are unchanged. This
softens material contrast; it does not create extra walkable terrain or remove
all signs of the existing square footprint.

## Verification and evidence

- All 23 numerical suites pass, including the existing 90 Wound fixtures,
  42,954 exact uploaded seam-vertex comparisons and 1,080 support probes.
- New speed coverage: 270 Wound probes, 720 Shade probes over four shapes,
  intact/damaged eras and both faces; view rotation, relative acceleration,
  manual speed, packed/unpacked triangle faces, corners and edges. A further
  3,380 points compare speed clearance with the independent authored Shade
  solid/void predicate (1,212 void and 2,168 solid samples).
- The focused warm lip query measured median 0.027 ms and p95 0.063 ms in the
  complete numerical run. This is one query, not whole-frame timing.
- Fresh browser startup verifies both lens controls at 80°, exposure 0.2 and
  Auto selected. Numerical Place visits retain those defaults and also retain
  explicit custom lens/exposure/manual settings.
- Six Wound browser fixtures pass with cold workers, exact coarse seam ends,
  completed workers, departure/return coverage and paired 4K/photo/panorama.
  Place navigation, the uninterrupted Mycelium Sea → Ultra Desert walking
  arrival, and the detailed Watershed GPU-depth suite also pass.
- Watershed matched captures cover both eras, clear/mixed weather at 36.325 km,
  and 79.9/80.1, 119.9/120.1, 159.9/160.1 km. Across the final pair the mean
  image-channel change is about 0.42%, without a large program-switch jump.
  This metric accompanies visual inspection; it does not certify every cloud
  view or fine atmospheric speckle.
- The saved ascent/descent has 130 frames from a 1.7 m eye height above the
  province terrain to 200 km above that terrain and back, at a fixed scene
  clock. Nominal shell altitudes are 1.165–201.163 km at this address. Key
  frames were inspected; the recording and per-frame timings are retained in
  `work/screenshots/watershed-continuity/after/ascent-descent.webm` and its
  `verification.json`. No page/WebGL errors were reported. This is a bounded
  route, not the remaining all-weather motion acceptance matrix.

The wider default lens exposed one low-resolution garden probe whose four
subpixel corners all missed a narrow reveal between foreground structures. An
independent interior probe reaches the province surface at 1.52026 km and agrees
with the GPU depth to 3.44 × 10⁻⁷. The existing browser test now checks interior
samples of the same raster footprint for unresolved pixels. Its spatial/depth
tolerance is unchanged; this is a reference-sampling correction, not a geometry
or collision change.

Reproduce with `npm test`, `tests/edge-speed.cjs`,
`tests/watershed-continuity-browser.cjs`, and the relevant existing browser
suites. The continuity test supports `SPHERE_CONTINUITY_BASELINE=1` to retain a
separate diagnostic capture directory; reproducing the original defect also
requires the old shader. Local evidence is under
`work/screenshots/watershed-continuity/{before,after}/` and
`work/screenshots/wound-ground/`. Generated evidence is not a release artifact.

## Next bounded work (historical)

See [Continuity 3](Observatory-Continuity-03.md) for the subsequent implementation,
recording audit and updated capture/streaming evidence.

Use the updated [surface-continuity plan](Observatory-Surface-Continuity.md)
for a connected neighbourhood: shared terrain/material samples, one border
owner, a coarse surrounding band, and pinned support. Its initial sizing
proposal is nine fine chunks plus sixteen coarse chunks, approximately 13.4 MiB
of terrain vertices before collision, props, edge clipping and replacement
residency. Measure the full reservation before raising quality or removing the
walking clamp. Copying nine populated landing-centred patches would repeat
features and break seam ownership.

Stage C's broader weather acceptance and local-relief-to-coarse morphs remain
open. Stage D still needs automatic visible intact/damaged Shade geometry;
the new speed fallback is not that geometry. Stage E supplies connected walking
and terrain revisioning. The paused-tip and historical cold 4K capture mismatch
remain unresolved; a passing repeat run does not establish their cause. Keep
the seam-first rule through all of these changes.
