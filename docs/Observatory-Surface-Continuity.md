# Surface continuity, Wound landings and Shade approaches

Planned 13 September 2026 · continuation after Watershed pack 1

Status: execution plan with the first [Wound clipping/seam implementation](Observatory-Wound-Seams-01.md)
now local. [Edge-speed and the first Watershed depth/material correction](Observatory-Continuity-02.md)
are also implemented; broader weather acceptance and general streaming remain open. This plan follows the
user's three screenshots and request; the older roadmap's variants-first order
is superseded. Historical completion evidence remains valid only for its tested
views. No new task, schedule, release or commit is implied.

## Intended result

A place should remain the same place while walking, lifting off, crossing the
clouds and returning. At a Wound, land and its objects stop at the physical lip.
At a Shade, either face can be approached without first selecting that Shade;
an intact perimeter reads as finished construction and a break exposes its
structure. Detail is prepared before it becomes visible or supports the player.
Streaming boundaries never become cliffs, dotted strips or invisible walls.

**Seam agreement is the first constraint.** Prefer a rim whose upper edge follows
the walkable terrain's varying height. If that cannot be made watertight, smoothly
blend the terrain down to the established rim height. A reliable matching seam
takes priority over preserving height variation. Neither choice may conceal a
hole with a material fade or leave different visible and collidable boundaries.
This explicitly supersedes the earlier prohibition on flattening near the lip.

## Findings before implementation and remaining uncertainties

| Observation | Evidence in this checkout | Consequence |
|---|---|---|
| Screenshot 1: square ground overhangs a Wound | `field-sites.js:terrain` emits a 96 × 96 grid across 2.4 km without testing Wound solidity. `populate` protects Watershed water/stations, but does not reject footprints across a Wound. `surface-walk.js:move` checks the landing point only. | Clip terrain and reject unsupported object footprints using the physical boundary; hiding fragments alone leaves false collision. |
| Square travel limit | Both walking paths clamp local x/z to ±1.08 km. Non-province terrain height/noise and population depend on the local patch frame; `height` includes a landing-centred clearing and square taper. | Adjacent patches need shared geographic samples and stable object ownership before removing the limit. Merely moving the patch moves the world. |
| Screenshot 2: dotted, dark Watershed boundary | `geometry-renderer.js` discards ground fragments with a screen-space pattern between local square radii 258 and 319.5 km; its colour blend starts at 250 km. This affects depth as well as colour. | Compare geometry depth, normals, direct/fill lighting and atmosphere reception across the province join. A prior matching land-colour test does not establish continuous depth/weather. |
| Atmospheric speckle / horizontal weather structure | `volume.js` uses per-pixel march jitter, depth-gated distant layers and reduced-resolution depth-aware composition. `atmosphere.js` changes local/far programs at 160 km; local composition already blends over 80–160 km. Nearby Wound containment uses one tangent plane, refreshed at rounded kilometre camera positions. | These are investigation points, not a proven diagnosis. Isolate surface dither, volume sampling, containment, depth precision and reconstruction before changing cloud art. |
| Screenshot 3: Shade edge detail | `edge-stream.js:plateFor` requires `siteId` to name a Shade. `canonicalFrame` and `shadeMeshes` follow one bank of the longitudinal `crack(v)`, including when damage is off. | The intact path is not an outer-perimeter implementation. Need automatic candidates and all relevant boundary families. |
| Useful foundation already present | Fixed edge addresses, screen-space ranges, near/far hysteresis, worker cancellation, bounded uploads, retained coarse replacements, analytic Shade contact and a small synchronous deck collision cache. | Extend these systems; avoid a second independent streaming manager. |

Numerical reproduction on the current local checkout: default state with
collection, after era and multiple Wounds enabled; Wound 0 at t = π/2; anchor
20 m inland; camera 40 m above the nominal shell; revision-1 `biome-5` patch
without a province. Of 18,432 terrain triangles, **9,036 have centroids over
the opening and 192 straddle it**. The same Shade camera produces an edge
context with `siteId = shade-0` and none with `siteId = biome-5`. This reproduces
the two structural gaps, not the exact saved states in the screenshots.

Record exact application scene JSON when recreating the screenshots. Their
visible readouts are clues, not complete camera/clock/quality state; do not
claim pixel-identical reproduction from them.

## Options and choice

| Approach | Benefit | Limit / decision |
|---|---|---|
| Enlarge or overlap several flat planes | Fast increase in apparent coverage | Retains square silhouettes, mismatched heights and duplicate depth/collision. Do not use as the continuity solution. |
| More texture versions / compatible tiles | Reduces visible repetition and improves composition | Cannot remove an overhanging floor or walking limit. Add after shared terrain/water/routes and filtering are established. |
| Shader clipping only | Useful analytic silhouette guard at long range | Does not remove CPU collision or close-up coarse triangles. Use only with matching physical geometry/support. |
| Fixed geographic terrain chunks with coarser surrounding levels | Reuses the current worker/mesh/BVH architecture; stable revisits and bounded residency | Requires seam ownership, height continuity and a connected walking controller. Recommended first implementation. |
| Full geometry clipmap renderer | Regular nested levels and transition bands suit large heightfields | Larger renderer change; cannot represent walls, breaks, bridges and stacked floors alone. Borrow its transition principle now; benchmark a full conversion later. |

The recommended combination is connected terrain chunks, separate structural
meshes at real edges, one geographic material field and predictive residency.
The outer detail boundary can remain square internally if it meets the coarser
surface continuously; the user should never see that allocation boundary.

Nested levels with geometry/material transition bands are established in
[NVIDIA's geometry clipmap chapter](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry).
Compatible texture tiles can avoid pattern discontinuities, but require correct
filtering across tile boundaries, as described in
[NVIDIA's tile-based texture mapping chapter](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-12-tile-based-texture-mapping).
Their application to this engine is a design recommendation, not a measured
performance claim.

## Shared boundary and support contract

Introduce one boundary query consumed by terrain generation, object placement,
edge meshing, ray picking, contact and atmospheric containment. Return parent
ID/frame, boundary ID, nearest point, inward tangent normal, signed local
clearance in km, solid/void classification, boundary kind and revision.
Use a bounding-distance query for discovery; `woundMetric().km` is an approximate
metric, not a guaranteed Euclidean signed distance. Use a locally refined
contour and the existing precise implicit expressions for the final boundary.

Boundary families:

- Shell: all six Wound contours, both banks and tips; no Wound in the before era.
- Shade: disk/cap perimeter, square sides/corners and trimmed perimeter/joins;
  when damaged, large missing regions, both banks of both crack directions and
  authored holes. Extract the boundary of the combined solid region so an
  intersection cannot generate duplicate walls or cap an opening.
- Both Shade faces share footprint/topology and a persistent parent-local
  address. Face normals, contact offsets and structural thickness are explicit.
  Resolve thickness against the intended Shade section model before extending
  the existing 180 m service-strip section around the entire perimeter.

Keep the existing CPU/GPU solidity definitions authoritative. Refactor them
without changing geography, with parity probes at boundaries and intersections.
Keep kilometre/meter calculations in local double-precision frames until GPU
upload; never subtract AU-sized float positions to find a metre-sized edge.

### Wound clipping and support

1. Reject cells proven wholly in void. Accept cells proven wholly inland.
   For intersecting/uncertain cells, adaptively subdivide and solve intersections
   with the actual contour, then triangulate the surviving polygon. Checking
   only the three vertices or centroid misses a narrow opening through a cell.
2. Share actual seam vertices and end profiles between terrain and wall; matching
   height samples at different tessellation points is insufficient. Prefer a
   wall top that follows the terrain elevation, including a different height at
   every clipped edge vertex. If impractical, smoothly flatten the terrain into
   the rim's seam band. Keep the requested horizontal landing address. Use the
   same vertex positions in GPU buffers and collision, across every LOD and
   worker/capture path. Verify the two ends of the local wall as well as its top.
3. Build the collision BVH from those same retained triangles. Remove void from
   height-query/fallback support as well; an empty result must mean no support,
   rather than the existing out-of-grid zero height.
4. Reject ordinary props whose supporting footprint intersects void. Allow an
   authored overhang only when its visible supporting structure is intentional.
5. Make the edge continuous before decorative ribs, cables and rubble appear.
   A shader boundary guard may suppress residual subpixel slivers, but cannot
   substitute for clipped close geometry.
6. Preserve the selected address and support on valid ground right up to the
   controller's physical footprint. Distinguish a missing streamed neighbour
   from a real drop: crossing a real lip enters unsupported/falling movement,
   with lift-off available, rather than clamping to an invisible patch wall.
   Specify and test the handoff; the current walker refuses unsupported steps.

## The user bubble and predictive preparation

Use two related regions in the same residency planner:

- **Support region:** a direction-independent neighbourhood around the player,
  including step/jump/fall sweeps and a margin for the next updates. Pin its
  visible surface and collision while replacements prepare. Head turns cannot
  evict the floor or the geometry immediately behind the player.
- **Preparation region:** a larger region extended along predicted relative
  movement. Include nearby off-screen edges for sudden turns, and broad-phase
  sweep candidates for fast travel. Select all nearby Shade parents regardless
  of Places selection or attachment. Measure velocity in the moving parent
  frame, including Shade motion under a stationary camera.

Initial scheduling proposal, to tune from measured build/upload latency:

`focalPx = outputWidth / (2 * tan(horizontalFov / 2))`

`visibleDistance = featureErrorKm * focalPx / targetErrorPx`

`prepareDistance = visibleDistance + relativeClosingSpeed * prepareLatency + margin`

Use nearest 3D distance to bounded edge segments, not distance to a Shade centre.
Use conservative projected silhouette error for grazing views and curved pieces;
the formula is a scheduling estimate, not proof of readiness. Base visibility
on presentation/output resolution, so adaptive low-resolution preview does not
prepare too late. Re-evaluate on FOV/viewport changes; export uses its own fixed
output plan. Track generation, collision, compilation and upload latency
separately. A provisional target is preparation before 0.5 px added silhouette
error, with a wider retreat threshold to prevent oscillation.

Never let extreme manual speed turn the prediction distance into unbounded
residency. Query swept coarse bounds, cap detailed work, prioritise impending
contact, cancel obsolete jobs and keep complete coarse geometry. For teleports
prepare the destination through the existing loading flow. If the next support
surface cannot be ready, retain current support and explicitly wait at the
streaming frontier; never invent ground across a physical Wound. Record such
waits as a failed smooth-travel target, even if they preserve correctness.

Residency lifecycle: requested → generated → collision ready → GPU ready →
active → retained fallback → evictable. A raised fine deck cannot acquire
invisible collision before its visible replacement is ready. The existing
synchronous contact path needs a consistent visible fallback or an atomic
promotion strategy; test delayed uploads explicitly. Protect pinned support
from the current hard-cap eviction loop by reserving its budget first and
refusing lower-priority admissions when necessary.

## Connected ground and atmosphere transitions

Start with a bounded 3 × 3 neighbourhood of fine terrain chunks and a coarser
surrounding band; chunk dimensions and resident count remain benchmark choices,
not nine copies of today's complete populated 2.4 km patch. Use fixed parent
addresses, shared border samples, stable object IDs and a single owner at each
join. Shade chunks use parent-local coordinates; shell chunks need chart/seam
rules that also work at poles and longitude wrap. Rebase the camera, not the
procedural world. Keep the active support chunk until its successor is complete.

A concrete first benchmark is nine 1.024 km fine chunks, each with 64 × 64
cells (16 m spacing), surrounded by sixteen chunks at 32 × 32 cells. This is
106,496 triangles, about 13.4 MiB of the current non-indexed 44-byte vertex
format before props, collision, clipped edges and retained replacements. It
is a sizing proposal to measure, not a resident-memory guarantee. Start with
a separate 64 MiB ground/support reservation, at most one promotion per frame
within the existing 4 ms upload window, and the current edge budget unchanged.
Reduce coarse/fine counts before compromising active support or a closed seam.
Indexed shared vertices are a later memory optimisation if profiling warrants it.

Use one shared local frame for the resident neighbourhood so duplicated border
vertices upload identically. All terrain chunks, their wall sections and LOD
neighbours consume the same ordered boundary samples. Combine/coalesce owned
Wound intervals before generating the coarse complement; today's one-patch cut
descriptor cannot simply be copied nine times. Clip outer-ring chunks as well as
the central one. Retain the original terrain generator for old scene revisions;
a new world-addressed height field requires a new saved terrain revision.

Texture variants choose appearance within this common field; they never choose
height, water, support or physical edge ownership. Rotation/variation must use
stable geographic addresses, with the same material phase on both sides of a
join. The local material feather now implemented softens the present square,
but does not remove the walking clamp or provide these neighbours.

Morph heights and normals toward the coarser representation in the outer band.
Use the same land/water/route field and material phase across all levels. Avoid
coplanar overlaps; explicitly assign depth ownership. Do not place seam-hiding
skirts across Wounds, water gaps or Shade perimeters. Bridges and stacked floors
are separate visible meshes with matching triangle collision, not duplicate
terrain planes. These remain part of the complex geometry benchmark.

The first Watershed correction reproduced the dotted border in matched
clear/cloudy captures and compared rendered depth to triangle collision.
Keeping the already-tapered terrain opaque removed that stipple and the
border-depth mismatches; see [continuity step 2](Observatory-Continuity-02.md).
The existing terrain/water geography and garden remain unchanged. Continue
checking direct/fill illumination, normals and grazing sampling before claiming
all distant joins are invisible. Texture recolouring alone cannot fix stretched
geometry or every local-to-coarse transition.

For weather, inspect slow motion as well as stills around the local/far overlap,
at cloud entry/exit and at grazing surface depth. Keep one phase/geography and
compatible scattering/transmission through the handoff. Check whether the
160 km program switch preserves the already-blended result; do not add a second
arbitrary fade. Refine Wound containment over the relevant ray footprint using
the shared contour rather than one stale tangent plane. Preserve deliberately
tenuous cavity dust and stars while removing wrongly applied local atmosphere.
Diagnose high-frequency sampling and depth reconstruction before considering
temporal accumulation; any history would need reset rules for scrubbing,
teleports, origin shifts and paused deterministic exports.

## Edge-aware flight clearance

Auto is the new-session speed mode; both lens controls share an 80° horizontal
field of view, with 0.2 stops exposure. Ordinary Place, pointer and field visits
retain the user's lens/exposure and explicit manual-speed choice. Saved sessions
and imported scenes retain their chosen values; fresh defaults do not rewrite
an existing photograph or viewpoint.

`travel-control.js` now combines the nearest point on resident triangles with
analytic Wound wall and Shade footprint clearance. Geometry distance is
independent of gaze. Across a lip, lateral separation combines with perpendicular
height, so an empty view ray cannot discard the nearby surface. The analytic
Shade distance is deliberately conservative on curved/damaged boundaries; it
can brake early and is not a replacement for exact solid/void collision. Both
sides, intact perimeters, three fracture families and small holes participate
without selecting a Shade. Detailed automatic edge spawning remains stage D.

Acceleration is also bounded relative to current speed (at most exp(3·dt) per
step), rather than easing an arbitrary fraction of a distant-space speed in one
frame. Approach braking and swept collision remain immediate. This protects
against detail retirement as well as pointer/view changes.

## Current continuation

[Continuity 3](Observatory-Continuity-03.md) records the new stage C/D work and
connected walking from E. It supersedes the implementation-status paragraphs
below; the acceptance criteria remain the contract for extending this work.

## Bounded execution sequence and acceptance

| Stage | Work / primary files | Required evidence before moving on |
|---|---|---|
| A. Reproduce and measure | Save three representative scenes; add focused edge/support probes and debug views in existing test tooling. | Separate observations from causes; record depth/material/weather and cold/warm frame timings. Keep a slow ascent/descent video. |
| B. Safe Wound landing | Clip `field-sites.js` terrain/props; build a wall from the same top vertices and share full end profiles with `edge-stream.js`; update `surface-walk.js` support. Prefer terrain-following height, with terrain-to-rim flattening as the authorised fallback. | All six Wounds, tips and banks: no triangle support in void or floating props; top and both end seams are watertight in coarse/fine, cold/warm, preview/capture and collision. Land at the chosen location, approach/cross the lip, lift off and return. |
| C. Watershed altitude continuity | `geometry-renderer.js`, `watershed-province.js`, `volume.js`, `atmosphere.js` and corresponding surface material/depth paths. | No visible square band in clear or cloudy grazing views; no new speckle or abrupt switch during ascent/descent. Compare both eras and exposures at the same addresses. |
| D. Automatic intact and damaged Shade edges | Boundary discovery, parent-local mesh recipes and `edge-streaming.js` scheduling; collision/navigation integration. Implement one intact perimeter and one fracture first, then generalise. | Approach without selecting a Shade, from either face and beyond the edge; visible construction precedes contact. Repeat for every supported shape, damage family, corners/intersections, moving/paused/scrubbed time and fast reversals. |
| E. Continuous walking residency | Stable connected chunks, shared samples, pinned support, coarse transitions and removal of both coordinate clamps. | Walk at least ten joins and return without a wall, fall, reroll or duplicate objects; rebasing and low-budget reversals preserve support. Queues and memory stabilise. |
| F. Resume joined artistic variations | Receiving lake, quiet reach and open meadow first; then the other six compositions. | Distinct art at stable addresses, compatible water/routes/heights/rotations; repeat altitude and traversal checks on every introduced boundary. |

B's first local patch clipping/seam implementation is now available; see
[Wound seams 1](Observatory-Wound-Seams-01.md) for verification and scope. C has
its first depth/material delivery: the province keeps opaque terrain through
its border blend, and local patches blend to the geographic shell material. Its
remaining gates include wider weather motion/aliasing and support-to-coarse
morphs. D and E follow as
separately reviewable milestones; do not claim the whole-Sphere streaming
programme is complete after a local fix.

Proposed geometric tolerances: within the support region, target ≤1 mm join
error (below the current 0.28 m controller skin); at distance, target ≤0.5 output
pixel silhouette discrepancy. Validate these at AU-scale origins before adopting
them as guarantees. Exact solid/void classification and zero false support are
required independent of image tolerance. Visual acceptance includes inspection
of motion; a pixel average can hide an obvious narrow band.

The controller's `.00028` km skin is 0.28 m, not 0.28 mm as the first plan stated.
The implemented shared local seam vertices aim for exact uploaded equality;
the 1 mm tolerance is for contour approximation and independent world-space checks.

Exercise ground/1.7 m eye height, 40 m, 100 m, 1.08 km, cloud boundaries, 36.325 km
(screenshot clue), 70 km, the 80–160 km overlap including either side of 160 km,
and the existing higher ascent range. Include along-ground and downward views,
62°/76° FOV, bright/dark exposure, clear/mixed/overcast weather, fractional preview
sizes, 4K photographs and all six panorama faces. Vary Wound distance separately
from altitude. Run Shade tests at low and high scene-clock rates in both eras.

Run `npm test` for changed geometry/travel, then appropriate existing browser
suites sequentially: `watershed`, `neighbourhood`, `weather-depth`, `ascent`,
`atmosphere-release`, `shade-deck`, `asset-loading`, `continuous-flight`, `places`,
`pointer` and `measure` (each is `tests/<name>-browser.cjs`). Extend these with the
new edge/ascent cases; their existing passes do not cover the new acceptance.
Preserve cold/warm capture equality checks and investigate the historical cold
4K mismatch independently. Capture must prepare its complete resource set.

Record median/p95/max frame intervals, longest task, worker/compile/upload times,
missed preparation deadlines, pending/cancelled jobs and geometry/collision/texture
memory. Keep the existing 4 ms upload cap and 192 MiB / 3 million vertex edge
ceilings as initial limits; account for active support and other caches separately.
The current observed cold delay and 2 s frame outlier stay open until isolated.

## Compatibility and scope

Retain Watershed geography revision 1, its 22 original outlets, river garden,
saved addresses, cloud feature scale and navigation/time/capture behaviour.
Appearance-only variants may get an art revision. Moving water/routes/terrain,
removing the old landing-centred height generator, or changing Shade footprint
or physical thickness needs explicit versioning with a retained legacy generator.
Correcting a local mesh to match an existing authoritative hole is a consistency
fix, not permission to redraw that hole. The user's seam-first instruction
permits a local flattening fallback if a terrain-following lip is impractical;
record any such change and its saved-scene implications. New scenes can use revised streaming
addresses while old scenes retain their meaning; specify migrations before edits.

Persistent Hero Zones, the complex geometry benchmark, Fallen Shade placement,
general texture paging and expansion to all biomes remain on the roadmap. This
plan adds no graveyard ships and chooses no asset importer.
