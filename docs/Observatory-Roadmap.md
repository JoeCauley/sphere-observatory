# Observatory roadmap and next-session handoff

Updated 13 September 2026 · local development after v1.4.0

This is the current continuation plan. Use it ahead of the older Next Leap
sequence when priorities or status differ. The first Watershed pack milestone
has implementation and verification evidence. The latest screenshot review
prioritises Wound support, Watershed altitude continuity and automatic intact /
damaged Shade edges ahead of more artistic variations. The investigation and
[surface-continuity execution plan](Observatory-Surface-Continuity.md) are complete.
The first [Wound clipping and matched-seam implementation](Observatory-Wound-Seams-01.md)
is now local. [Edge-speed and continuity step 2](Observatory-Continuity-02.md) adds
view-independent edge clearance, the 80° / 0.2-stop defaults and an opaque
Watershed border with local ground material blending. [Continuity step 3](Observatory-Continuity-03.md) adds cloud sampling and curved containment, automatic intact/broken Shade approaches and versioned connected walking. Its evidence and limits supersede the earlier continuation notes. This document does not schedule a run or create a new task.

## Direction

**The Builders would prioritize the art of it.** Carry the river garden's
elegance into the larger world: shaped water, planted courts, generous space,
beautiful structures and deliberate differences between places.

The intended experience is continuous travel from anywhere to anywhere: ground,
clouds, the cavity, another region, and back to walking. The same geography and
landmarks must survive each change in scale. Eventually this includes both
polar entries, both Shade faces, and persistent authored Hero Zones.

Avoid the beachball appearance: no repeating pole-to-pole wedges, uninterrupted
latitude stripes or equal panels of colour. Replace oversized equipment grids
with an irregular hierarchy of catchments, gardens, service districts and open
land. Weather should help reveal distance; it must not hide a regular atlas.

## Where this session leaves the build

| Area | Implemented locally | Remaining boundary |
|---|---|---|
| Navigation | One-way Go to pointer, marked destinations, return history, central Breach spill arrivals and exits through the opening to visible far destinations | Broader route and moving-target regression coverage as geography expands |
| Flight and walking | Auto by default, gaze-independent nearest-triangle/Wound/Shade clearance with bounded acceleration, 80° lens and 0.2 stops; Space + E lift-off, smooth landing, opposite-shell flight; local Wound ground/props clipped, terrain-following wall shares top/end seam vertices and collision, real lip permits a fall to flight | New landings use nine fine and sixteen coarse connected cells with pinned support and rebasing; original revision-0/1 patches retain their saved bounds. Full mixed shell/Shade journeys remain a broader programme |
| Time and tools | Play/Pause persists through navigation; measurements survive clock ticks and tool close/reopen | Keep these behaviours during new streaming and UI work |
| Watershed | Pack `watershed`, geography/art 1, saved schema-1 address, seed 713; 76 curved graph edges join all 22 original outlets to an irregular neighbourhood | Regional water/routes remain analytic surface representations; nine variants and global walking continuity remain queued |
| Shades | Revision 2 automatically discovers intact perimeters, fracture banks and holes on all four shapes; 180 m edge sections, exposed braces, parent-local residency and collision | Finished environments across both faces remain separate work; revision 1 retains its selected service strip |
| Weather | Three curved layers, regional tint/coverage, independent scene-clock masks, smaller/fainter distant detail, filtered noise and broad Shade shadows | Illustrative lighting; fine cloud shadows and art variation can improve; local Wound containment now follows the shared curved contour |
| Latest size adjustment | All local cloud features and six distant wavelengths are **two-thirds of their previous size**: a one-third reduction | Layer heights, motion periods, atmosphere reach and the existing distance fade retain their settings |
| Loading | Two pack graphs and two prepared provinces; preparation includes compilation/uploads; local Wound end profiles have protected coarse neighbours and same-frame coverage on patch departure | Cold startup/preparation and an observed 2 s frame interval remain; individual GPU texture layers are not generally paged |
| Capture | Exact-scene shadow passes and GPU completion before encoding remove the reproduced paused-tip mismatch; paired Wound views, 4K photographs and panoramas pass | See continuity 3 for current motion/capture evidence and hardware limits |

The larger Biome Pack programme, the complex geometry benchmark, persistent
Hero Zones and global walking continuity are approved directions. They are not
completed features. More graveyard ships remain deferred. An asset importer is
a possible supporting tool, not an existing capability.

## Completed milestone: versioned Watershed neighbourhood

The bounded first milestone is implemented and visually/traversally verified.
See [Watershed pack 1](Observatory-Watershed-Pack-01.md) for the contract,
representations, measurements and [portable evidence](evidence/watershed-pack-01/build.json).
The original 640 km terrain and garden meshes are retained. Old scenes without
an address migrate to no pack; explicit Watershed entry opts into the new
neighbourhood. Places reads its Watershed entry from the registry.

The initial visual review exposed straight joins and the old material square.
Shared cubic junctions and a matching diffuse land material resolve those
issues in the reviewed final views. The neighbourhood fills the 40,000 km
inspection view with unequal catchments and open land, without tiling the
province as rectangles. All 22 original outlet coordinates/widths remain exact.

Verification: **21 numerical suites and 13 browser suites pass**, with final
pack-only reruns after the last fixes. There are 228 matching CPU/GPU water
probes, four anchored bank landings and 24 views at a single saved address in
both eras. Actual 3840 × 2160 photographs and 3840 × 1920 six-face panoramas
match byte-for-byte across their pairs. The full Mycelium Sea → cavity →
Ultra Desert walking arrival takes 76.83 seconds and retains Play/Pause and
its pack address. Pointer travel, return history, measurements, loading
recovery, moving Shade contacts, weather and ascent checks also pass.

The ground-material comparison samples 74,284 land pixels: mean difference
0.000126 on a 0–1 display-channel scale. Fine boundaries still have individual
pixel differences; this is evidence against a broad material cutoff, not
perfect per-pixel correspondence. High-altitude haze, grazing texture stretch
and subpixel tributary fragmentation remain visible. Clear inspection views
are saved alongside weather views. The unchanged far-side atlas can still
show its existing regular divisions in a grazing view or panorama.

The new regional rivers/routes are **surface representations on the analytic
shell**, not excavated channels or raised roads. The original garden retains
its detailed geometry. Its buildings are subpixel at 40,000 km; the shared
receiving network supplies the location cue. The first pack is not nine
completed variants, a new global atlas, or continuous walking between patches.

Final fixed-view timings: 43.4 s cold opening, 1.63 s province worker build and
28.1 s preparation including renderer compilation/upload; cached preparation
8.9 ms. Compilation/upload now happen before revealing the new view. CPU draw
submission median/p95/max is 0.9 / 1.2 / 15.6 ms; the GPU median is 2.03 ms.
Animation-frame intervals are 16.7 ms median and 16.9 ms p95, with an observed
2 s maximum still to investigate. Full-flight frame intervals are median
16.7 ms, p95 17.6 ms and max 222.2 ms. These are not universal 60 Hz guarantees.
Two prepared provinces retain 81.42 MiB of vertices and 55.45 MiB of packed
collision; the final view has 38.84 MiB of GPU vertices, zero pending uploads,
and two bounded graphs using about 43 KiB of numeric data. No pack texture
allocation was added.

## Current bounded delivery and next work

[Continuity 3](Observatory-Continuity-03.md) records stage C sampling and
transition changes, stage D automatic edges, and connected walking from stage E.
Use its exact evidence and compatibility rules rather than the earlier request
to begin these features. The original Wound top/end seams, opaque province
border, river garden, addresses, cloud scale and travel defaults remain protected.

The connected controller crosses 22 joins, rebases once and returns with its
arrival address unchanged. Cold worker delay, coarse/fine borders and bounded
reservations have separate checks. Revision-1 photographs keep their old terrain
and selected Shade strip; new landings use the selected terrain revision.

Continue with the joined receiving lake, quiet reach and open meadow after
reviewing that evidence. Keep geometry, collision, materials and atmosphere tied
to the same geographic boundaries. Global route coverage and finished Shade-face
environments remain distinct milestones beyond these local tests.

## Ordered improvement work

| Priority | Work item | Concrete completion check |
|---|---|---|
| 1 | Versioned geography and first pack | Bounded milestone complete; see the verified neighbourhood and its representation limits above |
| 2 | Clip Wound landing ground and match seams | First local patch implementation complete: shared terrain-following top vertices, full rim end profiles, clipped support/props and protected loading/departure coverage; retain the six-Wound checks as other terrain representations expand |
| 3 | Connect ground-to-atmosphere representations | Diagnose/remove the Watershed dotted band and atmospheric artefacts; shared water, terrain, routes and landmarks survive clear/cloudy ascent and descent with no square cutoff, stretch or jump |
| 4 | Discover and prepare intact / damaged Shade edges | Approach without selecting a Shade; both faces, all supported shapes and damage boundaries; prepare before readable silhouette change/contact using relative motion and output pixel error |
| 5 | Stream walking terrain across boundaries | Walk across at least ten patch joins and return; pin support during preparation/origin changes; rapid reversals cause no gaps, duplicate objects, hidden walls or growing queues |
| 6 | Nine artistic variations for the first pack | Start with a joined lake/reach/meadow trio; nine distinguishable compositions ultimately share valid water/route/height boundaries, rotations and repeatable coordinate-seeded selection |
| 7 | Build the complex geometry benchmark | An approximately 300 × 300 m Watershed garden/service district with stairs, ramps, curved bridge, underpass, raised courts, low clearances, rubble and stacked floors; collision agrees with visible geometry |
| 8 | Complete Shade environment families | Middle of Shade beyond sight of an edge plus intact/broken edge environments; walk on both faces in the moving parent frame, cross detail boundaries, lift off, pause/scrub and restore a saved position |
| 9 | Add one persistent Hero Zone | A named authored level at a stable shell or Shade address; approach landmark, local layout and saved state agree after reload and neighbouring procedural updates |
| 10 | Build the first Fallen Shade landmark | Register a missing parent fragment and its chosen destination; inherited biome, distant scar, disrupted drainage and close structure share one footprint |
| 11 | Expand the proven pack system and full-Sphere routes | Extend to the other biomes, Builder regions and polar entries; complete pole-to-pole and mixed shell/Shade routes with bounded residency and coherent transitions |

Priority 6 should use the first pack to establish the art and joining rules
before producing nine variants for every biome. Suggested Watershed compositions
are receiving lakes, braided channels, quiet reaches, paired gardens, wet
woodland, open meadow, terraced courts, storage basins and a cultivated service
district. Nine images alone do not guarantee interlocking geography. Select a
compatible variant and rotation from the shared boundary graph, and rotate its
terrain, water, routes and imagery together.

The next atlas needs its own revision. Retain the oriented habitat waist,
maintained Shade routes, supporting Builder regions and opposed polar entries,
while breaking up the repeated divisions within them. Keep original biome,
service role, water/terrain, damage and wreckage membership separate.

The walking benchmark should establish the controller and asset requirements
before choosing a GLB import path. The current three-height terrain sweep is
not a complete controller for arbitrary interiors. Hero Zones may add authored
objects and saved interaction state after the traversal foundation is proven.

For Fallen Shades, record parent ID, missing footprint, destination, dimensions
and placement status first. Use an authored trajectory; precise impact physics
requires material, thickness and velocity assumptions. This is separate from
the deferred expansion of the graveyard fleet.

## Work to carry through each milestone

- **Weather and scale:** retain the one-third feature reduction, smaller far
  wisps, regional colours and slow masks. Test high coverage, bright exposure,
  darkness, grazing rays and both eras. Improve cloud shadow detail and Wound
  containment where visible, while keeping openings and the cavity clear.
- **Loading and residency:** prepare likely nearby detail ahead of flight,
  cancel obsolete work, keep coarse appearance and collision until replacements
  are complete, and evict distant pack resources. Cached visits should not
  flash a wait screen. Measure cold compilation separately from warm rendering.
  Reserve support residency before admitting decorative detail; predict edge
  approach using parent-relative motion, output resolution and loading latency.
  Do not allow a budget eviction to remove the current floor.
- **Capture reliability:** retain the strict cold/warm equality checks, image
  pairs and scene metadata. Isolate the earlier first-use 4K mismatch rather
  than treating a passing retry as its resolution. Pack resources must be ready
  before fixed-scene photographs and all six panorama faces are drawn.
- **Controls and navigation:** preserve user-owned Play/Pause, Space + E,
  auto/manual speed, one-way pointer travel, history and measurements. Keep
  Places useful as the catalogue grows. Landing should work at the selected
  location without adding landing pads. Entering a Wound from the cavity leads
  to its spill; looking inward from the spill must select the visible surface
  or object beyond the empty entry aperture, without sending the user back.
- **Performance:** record median/p95/max frame times, longest pauses, pending
  work and geometry/texture/collision residency. Include reduced budgets and
  repeated long routes. A 60 Hz warm preview on the current RTX 5080 is a target,
  not a promise for every view or device. A fast GPU sample does not measure
  startup, asset preparation or a streamed world's worst case.

## Verification and evidence

The latest screenshots add acceptance cases beyond the existing passing suites.
Use the [continuity plan's fixtures and stage gates](Observatory-Surface-Continuity.md#bounded-execution-sequence-and-acceptance)
for near-lip ground clipping, exact support, clear/cloudy grazing province joins,
the 80–160 km weather overlap, unselected Shade approaches, both faces, intact
perimeters and bounded residency. The Wound step now has runtime implementation
and numerical/browser evidence in [Wound seams 1](Observatory-Wound-Seams-01.md).
The first Watershed border correction removes dotted depth holes (259 mismatches
before, zero after in 3,052 border probes). The broader weather matrix, unselected Shade geometry and connected walking
now have focused evidence in [continuity step 3](Observatory-Continuity-03.md). Keep extending the fixtures when adding new boundaries.

The full-flight check holds E after Space + E from Mycelium Sea, crosses the
star and cavity, and lands on foot in Ultra Desert. The 13 September rerun
with the retained cloud scale and pack address took 76.83 seconds and retained
Play/Pause. It is evidence for that route, not walking between patches.

For cloud work, use `tests/weather-depth-browser.cjs`,
`tests/ascent-browser.cjs` and `tests/atmosphere-release-browser.cjs`.
The depth check inspects each layer, distance recession, phase rebasing,
scene-clock evolution, paused photographs, 4K output, panorama consistency and
the existing preview pixel budget. The ascent check covers 70 km through
70 million km. Release checks exercise full local coverage, fractional preview
resizing and an open Wound. Choose additional checks according to the changed
systems; do not use screenshot counts as a substitute for inspecting the views.

The final Wound correction removes the invisible near crossing from pointer
selection when looking inward through an aperture from outside. The selected
far hit supplies the arrival address. Numerical checks cover all six Wound
entries, exits to the far shell, star and Shades, rays through two openings,
and solid exterior ground. The pointer browser route enters a spill through
the button, leaves for the far wall, returns, and visits another Place while
retaining Play/Pause and clearing the previous marker. G over empty space must
stay put, rather than falling back to an unrelated centre-screen destination.
The earlier complete 20-suite numerical run passed after the final cloud and pointer
changes; its weather fixture loads the same shared scale source as the app.

For geography/travel changes, run `npm test` and the relevant browser suites:
`tests/continuous-flight-browser.cjs`, `tests/places-browser.cjs`,
`tests/pointer-browser.cjs`, `tests/measure-browser.cjs`,
`tests/asset-loading-browser.cjs`, `tests/shade-deck-browser.cjs` and
`tests/watershed-browser.cjs`. Include continuous ascent/descent, cold and cached
visits, polar and longitude seams, both Shade faces, all six Wounds and explicit
manual speed. Preserve historical scene validation and CPU/GPU agreement.

Generated screenshots, reports and the flight video are local under
`work/screenshots/`, including `weather-depth/`, `ascent/`,
`atmosphere-release/`, `continuous-flight/` and `pointer/`. They are ignored by Git;
reproduce them with the tests when continuing from a different checkout.

## Handoff details

- Repository: `I:/Sphere/repositories/sphere-observatory`.
- Current branch: `codex/watershed-neighbourhood`, created from the current
  `f4d71ad` checkout without discarding work. This milestone is in local modified
  and untracked files; it has not been committed, pushed or released. Preserve
  it when continuing. `I:/Sphere` is a separate parent repository.
- Live app: <http://127.0.0.1:8766/?province=watershed>. Refresh to load edits.
- Local runtime: `C:/Program Files/nodejs/node.exe`. Browser checks use
  `SPHERE_PLAYWRIGHT` and `SPHERE_BROWSER`; the current installed browser is
  `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. The current
  Playwright module is at
  `C:/Users/Joe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`.
  Browser tests run sequentially and allow 180–240 seconds for cold startup.
- Core locations: geography in `world.js` / `world-shader.js`; province in
  `watershed-network.js` / `watershed-province.js`; pack registry and neighbourhood
  in `biome-packs.js` / `watershed-neighbourhood.js` / `neighbourhood-shader.js`; traversal in
  `surface-walk.js` / `travel-control.js`; assets in `asset-plan.js` /
  `loading-screen.js` / `edge-streaming.js`; weather in `volume.js` /
  `atmosphere.js`; destinations in `places.js` / `places-ui.js`.
- No commit, push, release or automatic continuation was requested in this
  session. This is a local implementation and a plan for resuming the work.

Supporting detail: [Places and travel](Observatory-Places-Travel.md),
[Surface continuity and edge approaches](Observatory-Surface-Continuity.md),
[Biome Pack contract](Observatory-Biome-Packs.md),
[Watershed province](Observatory-Watershed-Province.md),
[historical queue](Observatory-Queue.md) and
[original Next Leap plan](Observatory-Next-Leap.md).

Suggested next-session request: “Review Continuity 3 and its final evidence,
then continue the joined receiving lake, quiet reach and open meadow. Preserve
the revision-1 river garden and addresses, Wound seams, cloud scale, automatic
Shade approaches, connected support and travel behaviour. Repeat altitude and
walking checks on each new artistic boundary.”
