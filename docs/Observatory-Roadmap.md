# Observatory roadmap and next-session handoff

Updated 12 September 2026 · local development after v1.4.0

This is the current continuation plan. Use it ahead of the older Next Leap
sequence when priorities or status differ. The work below is queued for a
future session; this document does not schedule a run or create a new task.

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
| Flight and walking | Space + E lift-off, automatic speed by clearance, manual option, smooth landing below approximately 100 m, passable star, continuous flight to the opposite shell | Walking is still a bounded 2.4 km patch with a 1.08 km traversal limit from its centre |
| Time and tools | Play/Pause persists through navigation; measurements survive clock ticks and tool close/reopen | Keep these behaviours during new streaming and UI work |
| Watershed | Versioned 640 km province, shared drainage, rivers and walkable garden structures; default seed 713 | One representative province, not a full-shell network or nine-variant pack |
| Shades | Collision on both analytic faces and raised decks while preview geometry prepares | Full middle-of-Shade and edge walking environments are not implemented |
| Weather | Three curved layers, regional tint/coverage, independent scene-clock masks, smaller/fainter distant detail, filtered noise and broad Shade shadows | Illustrative lighting; fine cloud shadows, detailed Wound containment and art variation can improve |
| Latest size adjustment | All local cloud features and six distant wavelengths are **two-thirds of their previous size**: a one-third reduction | Layer heights, motion periods, atmosphere reach and the existing distance fade retain their settings |
| Loading | Current-view assets, worker geometry, bounded uploads, reusable prepared components and a wait screen when preparation is required | Individual GPU texture layers are not yet paged or evicted by a general pack registry |
| Capture | 4K, panorama, paused-weather, distance/phase and ascent checks passed after the size adjustment; the complete flight was verified before it | The historically intermittent cold 4K byte mismatch remains open until its cause is isolated |

The larger Biome Pack programme, the complex geometry benchmark, persistent
Hero Zones and global walking continuity are approved directions. They are not
completed features. More graveyard ships remain deferred. An asset importer is
a possible supporting tool, not an existing capability.

## Next session: one coherent Watershed neighbourhood

The next bounded deliverable should combine the minimum pack/address foundation
with a visible atlas improvement. Give it a saved seed and revision, fill a
fullscreen view with adjoining irregular catchments, and connect it to the
existing garden. Keep the first result small enough to inspect at every scale.

1. Preserve the current working tree and capture matched baseline views. Check
   the latest cloud sizes during ascent, looking both along the shell and down
   toward it, in both attack eras. Record any remaining haze or texture issues.
2. Define a first Watershed pack entry: stable ID, geography/art revisions,
   coordinate convention, seed, assets, fallback, bounds and resource budget.
   The entry should supply the Places catalogue instead of adding another
   separate destination list. Introduce schema migration before changing saved
   addresses; do not silently reinterpret existing scenes as a new atlas.
3. Build a connected neighbourhood around the current province. Its shared
   drainage and routes determine the joins. Use unequal catchment shapes and
   intervals of open land. Make the existing river garden a recognisable anchor.
4. Show the same rivers and landmarks at 40,000 km, 10,000 km, 1,100 km,
   beneath the clouds, 1 km and ground level. Include a wide grazing view and
   panorama. Identify any tier still using a temporary representation.
5. Record traversal, preparation pauses, resident resources and capture results.
   Update this roadmap with evidence and the next bounded deliverable.

**Done for this milestone:** the neighbourhood has no visible square province
cut-off or beachball rhythm; neighbouring rivers and routes agree; returning to
the same address does not reroll the landscape; old scenes retain their
geography; camera selection, drawing and collision query the same location.
This does not require completing all ten biome packs in that session.

## Ordered improvement work

| Priority | Work item | Concrete completion check |
|---|---|---|
| 1 | Versioned geography and first pack, with the Watershed neighbourhood above | Saved seed/revision; coherent overview-to-ground identity; migration tests; no rectangular province boundary in the reviewed views |
| 2 | Nine artistic variations for the first pack | Nine distinguishable compositions, compatible river/route/height boundaries, valid rotations and coordinate-seeded selection; repeat visits are identical |
| 3 | Connect all altitude representations | Regional, province, district and walking detail derive from the same water, terrain, route and landmark masks; filtered transitions have no texture stretch, jump or camera-dependent reroll |
| 4 | Stream walking terrain across boundaries | Walk across at least ten patch joins and return; keep support during preparation and origin changes; turn around rapidly without gaps, duplication or growing queues |
| 5 | Build the complex geometry benchmark | An approximately 300 × 300 m Watershed garden/service district with stairs, ramps, curved bridge, underpass, raised courts, low clearances, rubble and stacked floors; collision agrees with the visible geometry |
| 6 | Add Shade environment families | Middle of Shade beyond sight of an edge, intact edge and broken edge; walk on both faces in the moving parent frame, approach a break, lift off, pause/scrub and restore a saved position |
| 7 | Add one persistent Hero Zone | A named authored level at a stable shell or Shade address; approach landmark, local layout and saved state agree after reload and neighbouring procedural updates |
| 8 | Build the first Fallen Shade landmark | Register a missing parent fragment and its chosen destination; inherited biome, distant scar, disrupted drainage and close structure share one footprint |
| 9 | Expand the proven pack system and full-Sphere routes | Extend to the other biomes, Builder regions and polar entries; complete pole-to-pole and mixed shell/Shade routes with bounded residency and coherent transitions |

Priority 2 should use the first pack to establish the art and joining rules
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

The existing full-flight check holds E after Space + E from Mycelium Sea,
crosses the star and cavity, and lands on foot in Ultra Desert. Its most recent
run before the final size adjustment took approximately 76 seconds and retained
Play/Pause. It is evidence for that route, not yet for walking between patches.

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
The complete 20-suite numerical run passed after the final cloud and pointer
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
- Current branch: `codex/observatory-next-leap`; last committed baseline at
  this handoff is `96aec0c` (v1.4.0). Later implementation is in the local
  modified and untracked files. Preserve that work; do not restart from the tag
  and discard it. `I:/Sphere` is a separate parent repository.
- Live app: <http://127.0.0.1:8766/?province=watershed>. Refresh to load edits.
- Local runtime: `C:/Program Files/nodejs/node.exe`. Browser checks use
  `SPHERE_PLAYWRIGHT` and `SPHERE_BROWSER`; the current installed browser is
  `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. The current
  Playwright module is at
  `C:/Users/Joe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`.
  Browser tests run sequentially and allow 180–240 seconds for cold startup.
- Core locations: geography in `world.js` / `world-shader.js`; province in
  `watershed-network.js` / `watershed-province.js`; traversal in
  `surface-walk.js` / `travel-control.js`; assets in `asset-plan.js` /
  `loading-screen.js` / `edge-streaming.js`; weather in `volume.js` /
  `atmosphere.js`; destinations in `places.js` / `places-ui.js`.
- No commit, push, release or automatic continuation was requested in this
  session. This is a local implementation and a plan for resuming the work.

Supporting detail: [Places and travel](Observatory-Places-Travel.md),
[Biome Pack contract](Observatory-Biome-Packs.md),
[Watershed province](Observatory-Watershed-Province.md),
[historical queue](Observatory-Queue.md) and
[original Next Leap plan](Observatory-Next-Leap.md).

Suggested next-session request: “Continue from Observatory-Roadmap.md. Start
with the versioned Watershed pack and an irregular connected neighbourhood,
preserving the current cloud scale, travel behaviour and saved geography.
Carry the first milestone through visual and traversal verification.”
