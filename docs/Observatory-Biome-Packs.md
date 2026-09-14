# Biome Packs and continuous exploration

12 September 2026. Approved direction following Watershed province 1. This is
a staged implementation queue, with the first travel fixes described separately
below. It is not an automatically scheduled job or a completed whole-Sphere world.

Use the [current roadmap and handoff](Observatory-Roadmap.md) for the latest
session order and verified build status. This document retains the detailed
pack contract and joining rules.

## The intended experience

The Builders would prioritize the art of it. Keep the elegance of the river
garden: composed spaces, generous clearances, planted courts, shaped water and
beautiful construction. Engineering should explain these places without turning
the landscape into a uniform equipment grid. Different biomes should have their
own silhouette, colour, rhythm and sense of scale.

A traveller should eventually fly continuously from either polar entry to the
other, cross regions without a destination menu, descend through clouds to the
same landscape, and walk when reaching solid ground. Ascending should reveal
the same rivers, roads and landmarks at each successive scale. Shades should
support walking in their moving local frame, with distinct interiors, intact
edges and broken edges. Persistent Hero Zones should occupy real addresses and
inherit their surrounding Biome Pack.

The screenshots show the present limitation clearly: one 640 km province becomes
a small isolated patch at higher altitude. Randomly repeating its image alone
would not make its rivers connect, preserve its terrain, or create walkable
places. The next work joins those representations around shared geography.

## What this pass implements

- The centre of each Wound opens its own **Breach spill** environment, aimed at
  nearby wreckage. Near-boundary selections still inspect the adjoining edge.
- Launch and session restoration start paused. Afterwards the main Play/Pause
  button, Flight console and flight Space key own the running flag. Navigation,
  return, bookmarks, imports, walking, scrubbing and resetting time preserve it.
  Captures freeze their own snapshot; they preserve the live running choice.
- **Walk when descending below 100 m** is enabled under Go to Exact Position. A
  descending flight segment is tested against ground height, including the
  Watershed relief. It enters a local walking patch at the arrival address and
  eases to eye level over about 2.4 seconds. A fast flight step cannot move that
  address sideways through the collision slide.
- The province keeps its existing terrain, rivers and garden architecture.
  Close ground shading and local objects add human scale; water and garden
  clearances are protected from generic planting. Walking queries visible
  triangles for support, steps, walls and overhead clearance. The existing
  garden terraces can be used as walking support.
- Returning to flight allows a 200 m climb before another automatic landing;
  moving to another local area also rearms it. Space + E now starts a smooth
  45 m lift over two seconds; automatic flight speed then follows clearance.
  The nearby height readout uses actual ground. Open water and Wounds retain
  flight. Existing manual biome and polar-entry walking destinations remain.
- Raised Shade decks have nearby collision triangles even when their preview
  worker/upload is still pending. The same fine deck geometry provides those
  contacts. Both analytic faces retain collision and fracture openings remain
  passable. At most twelve extra nearby collision chunks are retained.

**Present bounds:** walking patches are 2.4 km across, with a 1.08 km traversal
limit from their centre. New patches save their anchor, elevation and local
revision; they are not yet an interlocking global tile grid. A different descent
can produce a different patch centre. Shade walking environments, swimming,
continuous patch replacement, arbitrary interior traversal and Hero Zones are
still queued. The three-height walking sweep is a prototype, not the final
capsule controller for a complex game level.

The follow-up [Places and assisted travel pass](Observatory-Places-Travel.md) adds
the category browser, one-way pointer navigation, return history, automatic
speed, lift-off, scene/weather choices and a distant cloud representation.

## Ordered delivery

| Stage | Concrete result | Required evidence |
|---|---|---|
| 1. Version the Biome Pack | A registry with one Watershed pack, separate geography and art revisions, a stable world address and explicit memory/residency limits | Old scenes retain their landscape; missing optional assets have a coherent fallback; a saved address reloads identically |
| 2. Nine province variations | Nine authored variations for the first pack, selected and oriented by coordinate and seed, with compatible boundary connections | Fullscreen views have no rectangular province cut-off; rivers and routes agree on both sides of every join; revisits do not reroll |
| 3. Connect altitude levels | Regional, province, district and walking representations share land/water/route masks and landmarks | Matched ascent/descent captures at 40,000 km, 10,000 km, 1,100 km, cloud altitude, 1 km, 100 m and eye level; perspective and panorama agree |
| 4. Walk across local boundaries | Prepare the next ground patches ahead of motion, retain coarse support until replacements are ready, and recenter coordinates without moving the world | An uninterrupted multi-patch walk and flight in both directions; no hard patch boundary, gaps, duplicated landmarks or ground penetration |
| 5. Complex geometry benchmark | An authored approximately 300 × 300 m garden/service district combining beauty with demanding traversal | Walk stairs, ramps, curved bridges, underpasses, raised courts, narrow doors, irregular rubble and stacked floors; measure cold load, residency and frame time |
| 6. Shade environments | Separate interior, intact-edge and broken-edge families, in the moving Shade frame | Walk on both faces through a running cycle, pause and scrub, approach and leave an edge, traverse a break, detach deliberately and restore a saved position |
| 7. Persistent Hero Zones | A named authored level at a stable shell or Shade address, layered over its Biome Pack template | Identical approach, distant landmark and local layout after reload; authored overrides survive neighbouring procedural changes |
| 8. Expand the catalogue and full-Sphere routes | Apply the proven pack and streaming contract to every biome and the supporting machinery and polar entries | Continuous route from pole to pole, crossing all regional and coordinate seams, with measured quality and bounded residency |

The proposed 300 m benchmark is now requested work, rather than the earlier
feasibility-only discussion. Start with the elegant Watershed garden language
and add a service gallery beneath it, a curving accessible approach, stepped
water courts, a bridge and an irregular damaged side court. This exercises
several real geometric problems in one visually coherent place. Imported assets
can follow once the renderer's metre scale, material and collision contracts are
proven with that scene.

## Proposed pack contract

The first Watershed entry and schema-1 saved address are implemented in [Watershed pack 1](Observatory-Watershed-Pack-01.md). The remaining rows describe the larger contract; nine variants, global streaming, Shade families and Hero overrides remain future work.

| Part | Contents |
|---|---|
| Identity | Stable pack ID, geography revision, art revision, compatible scene versions and deterministic seed rules |
| Geography | Height, receiving basins, water courses, routes, original biome, service roles and separate damage history |
| Province family | Nine variant definitions, their allowed orientations, land/water and route connections on each boundary, transition masks and landmark exclusions |
| Altitude imagery | Regional, province and district colour/material layers, matching masks and filtered mip levels; no repeated painted-in camera-dependent lighting |
| Walk environment | Terrain/detail recipes, vegetation and structure modules, material maps, collision shapes, traversal metadata and progressively simplified distant forms |
| Conditions | Authored weather, illumination and damage treatments appropriate to the biome, without replacing its original identity |
| Shade extensions | Interior, intact-edge and broken-edge definitions; surface side, edge distance, damage membership and parent Shade coordinates |
| Hero overrides | Persistent zone ID/address, authored geometry and routes, approach landmark, saved state and the underlying pack/version |
| Residency | Asset sizes, bounds, readiness, fallback and eviction priority; neighbouring patches share resources |

Use a global shell address with well-defined seams and polar behaviour; a
floating local origin supplies precise metre-scale rendering and movement.
Shade addresses also need the parent Shade ID and surface frame. Select an
interior environment only when every edge is beyond the visible detail
neighbourhood; approaching an intact or broken edge should bring in that
matching environment before it becomes readable. A Hero Zone
belongs to those coordinates, not to a camera-relative tile or an arrival menu.

## Making nine variations interlock

Nine is the requested artistic variety per biome. It is not sufficient by itself
to guarantee every possible river/road connection. Let the shared watershed and
route graph define each boundary first. Select a compatible variant and an
allowed orientation from a coordinate-seeded choice. Use connecting strips or
mask-driven geometry where a variant needs to meet a particular boundary.
Rotate only when the boundary connections, flow direction, height and landmarks
remain valid. Do not independently rotate a finished river image and its terrain.

Start with distinct compositions: receiving lakes, braided channels, long quiet
reaches, paired gardens, wet woodland, open meadow, terraced courts, storage
basins and a cultivated service district. These are art briefs for the first
family, not nine delivered assets. Keep larger and smaller rhythms among them;
variation should compose a landscape, not create equal squares of visual noise.

Neighbourhoods need enough surrounding provinces to fill the view toward the
horizon. Residency should follow projected readability and visible bounds,
including very wide lenses and six-face panorama capture. As altitude increases,
replace detail with a filtered representation of the same assembled geography.
This makes a river keep its position instead of dissolving into a differently
randomized high-altitude texture.

## Performance and continuity gates

Retain asynchronous preparation, bounded uploads and cancellation of obsolete
travel requests. Prepare collision before a traveller can reach a surface;
preview image readiness must never decide whether ground is solid. Keep a
coarse representation until its entire replacement is ready. Evict distant
assets instead of keeping all nine variations of every biome resident.

Measure a fixed route with cold and warm timings, median/p95/max frame costs,
longest main-thread task, visible and resident geometry, texture/collision/GPU
memory, pending work and cancelled requests. Include 4K fullscreen and wide
grazing views. The earlier 500 km edge-streaming measurement is a baseline, not
proof that this larger programme already meets its performance targets.

Compare CPU collision, preview and exported views at tile boundaries, pole and
longitude seams, biome transitions, garden structures and both Shade faces.
Retain deterministic photograph and panorama checks. The previously reproduced
intermittent cold 4K capture mismatch remains a separate open renderer issue.

## Verification and continuation

Current numerical coverage is in `tests/travel.cjs` alongside the full existing
suite. Browser travel/capture evidence is produced by `tests/travel-browser.cjs`
and `tests/shade-deck-browser.cjs` under `work/screenshots/travel/`. The CPU
checks include 4,320 two-sided analytic Shade contacts, a deliberately empty
preview queue for the raised deck, 12 spill arrivals, nine descents, garden
support, a step, wall and low ceiling. The browser checks exercise actual
keyboard descent, running/paused navigation, a 4K walking photograph and a
moving Shade approach to contact on each face. Saved reports:
[browser travel](evidence/travel/browser.json) and
[moving Shade contacts](evidence/travel/shade-decks.json). Continue with Stage 1 above, then nine variants
for the first pack before expanding to the full catalogue. Keep this programme
and the remaining Next Leap atmosphere/Fallen Shade work in the shared queue.
