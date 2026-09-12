# Observatory queue and resumption notes

Updated 11 September 2026

This is a durable project backlog. It records the user's latest ideas and the intended order; queued work has not been implemented or scheduled to run automatically. The user specifically framed biome capacity, Blender assets and full game levels as questions. Preserve that distinction when resuming. Continue in this repository; do not replace the separate Sphere canon or Unreal requirements with these prototype proposals.

## Current delivery

The release also includes [Shade material filtering](Observatory-Shade-Filtering-14.md): explicit projected texture footprints, a stable distant finish and filtered district boundaries. This follows the user's later observation about procedural texture aliasing.

Observatory 1.4 contains corrected Wound air integration, selective subpixel sampling of analytic Shade edges, fullscreen edge-smoothing control and browser-local settings restoration. Space already controls play/pause in flight and jumping on foot; no new Space binding was requested after the user's correction.

The later material request is also implemented: ten unique Wound-edge albedos, chosen by the adjoining biome, with damage increasing over 240 km of surviving ground until the dedicated image fully replaces the intact material at the lip. These assets supersede the earlier proposal to reuse a shared Ruin image with masked environmental layers. See [the artwork and prompts](../assets/wound-edges/README.md).

See [1.4 implementation and validation](Observatory-Polish-14.md). Before the user's first refresh from 1.3, recommend saving the present scene through Capture if it should survive: that older page cannot retrospectively use the new persistence code. Settings subsequently restore in the same browser and origin, paused.

## Queued work

The [next development plan](Observatory-Next-Leap.md) sequences the next pass: finish Wound navigation, address measured travel stalls, then prototype the researched shell atlas, connect its atmosphere and introduce a Fallen Shade landmark. The table retains the full backlog; its item numbers are references, not a conflicting implementation schedule.

| Order | Work | Next concrete result | Status / dependency |
|---|---|---|---|
| 1 | Wound destination selection | Central opening → breach inspection; near the rim in space → edge matching the adjoining biome; solid ground → selected point with contextual edge | Navigation queued. Unique regional edge materials and progressive damage are implemented |
| 2 | Engineering-informed inner shell | Comparative atlas preserving the waist, its Shade tracks, machinery regions and two polar entries; review matched overview/approach views | Research completed in [shell design study](Observatory-Shell-Design-Research.md); atlas and runtime layout queued |
| 3 | Account for missing Shade pieces | Fragment register with parent IDs and destination/impact footprints; first Fallen Shade region inheriting its original biome | Queued concept. Use explicit attack trajectories; mass/energy numbers need defined material and motion assumptions |
| 4 | Smoother travel and startup | Worker-generated edge chunks, bounded GPU uploads, cold shader-start profiling and progressive readiness | Queued renderer work. Preserve deterministic capture and geometry/collision agreement |
| 5 | Stronger atmospheric integration | Cloud shadows and coherent distant illumination; explore containment following more of the Wound contour | Queued. Keep vacuum clear and retain current depth composition |
| 6 | Structural variety | Bent panels, varied fracture sections, cables and material wear driven by exposure/orientation | Queued. Share placement between near geometry, distant appearance and damage history |
| 7 | One authored walking benchmark | A roughly 300 × 300 m forest or industrial level used to measure quality, traversal, load time, memory and frame time | Discussion / feasibility only; no new level or importer has been built |
| 8 | Expanded biome catalogue and level pipeline | Stable biome IDs, on-demand material/mesh loading, reusable environmental recipes, tested Blender asset path | Discussion / feasibility only; follow a successful representative level |
| Later | More graveyard ships and richer fleet activity | Detailed original hulls and local encounters | User explicitly deferred ships in the graveyard |

## Wound behaviour to preserve exactly

- Deep inside an opening: the breach biome inspection view, not a default edge.
- Inside an opening near its boundary: the nearest edge, whose ground and upper damage treatment reflect the biome on the surviving side.
- On surviving inner surface: the requested surface location; add the corresponding rim only when it belongs in that view.
- **Latest explicit corrections:** create unique edge textures for every biome, then increase damage toward the Wound until the edge colour is reached. Do not replace this with a shared Ruin recolour or an overlay-only proposal. The ten delivered images preserve fractured construction with environment-specific debris.
- Boundaries between two biomes: blend the corresponding dedicated edge images using the same regional transition as the intact ground.
- Topsoil, vegetation, snow, industrial skin or coastal sediment affect the upper lip. Deep structural strata retain their construction identity.
- Thresholds use the selected location and meaningful view/readability distances. Test near the threshold, Wound tips, different radii, and multiple adjoining biomes.

Implementation context: `world.js` now retains the adjoining region and evaluates a signed Wound-distance damage envelope. `world-shader.js` shares the exact near-edge implicit boundary with shell clipping, and `wound-textures.js` loads the ten images in `assets/wound-edges/`. The old abrupt `damage > .40` switch to biome 4 is removed. The original Ruin biome away from Wounds retains its existing artwork. The top 40 m of the wall blend into the local damaged deposit; deeper strata stay structural. The queued navigation route must distinguish the intended near-shell intersection from a ray continuing through an opening to the far wall.

## Feasibility answers retained for later discussion

**Biome count.** A curated 20–40 biome families is a reasonable content-planning range, not a measured engine limit. A much larger catalogue is possible if only nearby assets are resident. The current ten-biome shader tables, texture arrays, validators and destination IDs are hard-coded; expansion needs a data-driven registry and streaming. Families can generate many variants through terrain, vegetation, water, weather, infrastructure and damage. More names alone do not produce more convincing places.

**Memory.** As an illustrative uncompressed budget, one 2,048-square RGBA8 texture with a full mip chain is about 21.3 MiB; an albedo/normal/packed-material set is about 64 MiB. Forty such sets would consume about 2.5 GiB before geometry, framebuffers or shadows. Real formats and maps vary. Use selective residency and supported compression rather than promising every biome at full resolution simultaneously.

**Blender.** Authored meshes, UVs, standard PBR materials and supported animations can be exported through glTF/GLB. Arbitrary Blender shader graphs, modifiers and simulation setups are not automatically reproduced by a browser renderer. The Observatory still needs an import/preparation path, metre conventions, material translation, LODs and collision meshes. [Blender: glTF 2.0](https://docs.blender.org/manual/en/3.6/addons/import_export/scene_gltf2.html), [Khronos: glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

**Forests.** Detailed trunks, branches, undergrowth, fallen wood and canopy are practical locally. A view can suggest thousands of trees through instancing, several geometry detail levels and distant stand representations. Alpha-tested foliage coverage, shadows and transparency cost still matter; there is no useful universal tree-count promise. [MDN: WebGL2 instanced drawing](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawElementsInstanced)

**Industrial areas.** Modular walls, gantries, pipes, equipment and selected interiors can form dense levels. Reuse mesh/material sets, cull districts and rooms, and keep collision meshes simple. Stacked floors, stairs, moving platforms and arbitrary interiors require a more capable character controller than the current bounded terrain samples.

**Game levels.** Yes, as a deliberate extension: terrain, collision, traversal, triggers, interaction, sound, animation and saved progress. A polished bounded level is a sensible benchmark before a streaming world. The current procedural walking sites are roughly 2.4 km wide, but their size does not demonstrate production-level detail or gameplay at that scale. The 300 m benchmark is a proposed quality test, not a promise of measured performance.

## Where to resume

- Working repository: `I:/Sphere/repositories/sphere-observatory`; local app: `http://127.0.0.1:8766/`.
- The 1.0–1.4 work is collected in the v1.4.0 release. Start from that release or its descendants; preserve any subsequent local edits.
- Start with the [next development plan](Observatory-Next-Leap.md), this queue, the shell research and 1.4 notes. The original [1.0 delivery notes](Observatory-Evolution-10.md) provide historical context.
- Navigation/material work: `evolution-ui.js`, `flight.js`, `world.js`, `world-shader.js`, `edge-stream.js`, `field-sites.js` and `inspection-camera.js`.
- Rendering: `renderer.js`, `silhouette-aa.js`, `volume.js`, `atmosphere.js`, `surface-lighting.js`, `local-shadows.js` and `geometry-renderer.js`.
- Session restoration: `session-state.js`, loaded after UI initialization.
- Numerical/visual evidence is generated locally under `work/screenshots/` and excluded from source downloads. Fixed capture scenes ship in `tests/fixtures/polish-scenes.json`; the capture checks can run from a fresh copy.
- CPU checks: `npm test`. Relevant browser checks: `tests/polish-browser.cjs`, `tests/session-browser.cjs`, `tests/focus-browser.cjs`, `tests/continuity-browser.cjs`, `tests/visual-quality-browser.cjs`.
- Browser cold startup can be around 50 seconds on the tested machine; allow 120-second startup timeouts. Warm scene timings do not include shader compilation or new chunk construction.

No automatic wake-up, new task, usage reset, deadline or Tuesday run was created. The queue is ready whenever the user resumes.
