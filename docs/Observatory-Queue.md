# Observatory queue and resumption notes

Updated 12 September 2026

**Current continuation plan:** [Observatory roadmap and next-session handoff](Observatory-Roadmap.md).
Its status and ordering supersede the older sequence below. This queue retains
historical requests and supporting detail.

This is a durable project backlog. It records the user's latest ideas and the intended order; queued work has not been implemented or scheduled to run automatically. The later request approves Biome Packs, nine province variations per biome, continuous flight/walking, Shade environments, a complex walking benchmark and persistent Hero Zones as staged work. Earlier Blender-import and catalogue-capacity discussion remains background context. Continue in this repository; do not replace the separate Sphere canon or Unreal requirements with these prototype proposals.

## Current delivery

The local Next Leap branch now implements [session 1 arrivals and a measured streaming prototype](Observatory-Next-Leap-Session-01.md). The published release remains v1.4.0. A clean baseline reproduced the known cold export mismatch; capture repeatability is still open.

The release also includes [Shade material filtering](Observatory-Shade-Filtering-14.md): explicit projected texture footprints, a stable distant finish and filtered district boundaries. This follows the user's later observation about procedural texture aliasing.

Observatory 1.4 contains corrected Wound air integration, selective subpixel sampling of analytic Shade edges, fullscreen edge-smoothing control and browser-local settings restoration. Space controls play/pause in flight and jumping on foot. The later user-approved Space + E chord now starts lift-off.

The later material request is also implemented: ten unique Wound-edge albedos, chosen by the adjoining biome, with damage increasing over 240 km of surviving ground until the dedicated image fully replaces the intact material at the lip. These assets supersede the earlier proposal to reuse a shared Ruin image with masked environmental layers. See [the artwork and prompts](../assets/wound-edges/README.md).

See [1.4 implementation and validation](Observatory-Polish-14.md). Before the user's first refresh from 1.3, recommend saving the present scene through Capture if it should survive: that older page cannot retrospectively use the new persistence code. Settings subsequently restore in the same browser and origin, paused.

The latest [travel fixes and Biome Pack programme](Observatory-Biome-Packs.md) add central Breach spill routing, user-owned play/pause, automatic descent into a local walking patch, and collision for raised Shade decks while preview geometry loads. Continuous flight through the star to a walking arrival on the opposite shell is now verified. Streaming between walking patches, full pole-to-pole continuity and Shade walking environments remain queued.

The [Places and assisted travel pass](Observatory-Places-Travel.md) implements the new Explore interface, lift-off, automatic approach speed, pointer travel/history and distant weather. The full streamed landscape remains the next programme.

## Queued work

The [Biome Pack programme](Observatory-Biome-Packs.md) now supplies the next concrete sequence. The [earlier development plan](Observatory-Next-Leap.md) retains the other milestones: finish Wound navigation, address measured travel stalls, then prototype the researched shell atlas, connect its atmosphere and introduce a Fallen Shade landmark. The table retains the full backlog; its item numbers are references, not a conflicting implementation schedule.

| Order | Work | Next concrete result | Status / dependency |
|---|---|---|---|
| 1 | Wound destination selection | Central opening → Breach spill; near the rim in space → edge matching the adjoining biome; solid ground → selected point with contextual edge | Central arrival and exit through the aperture are corrected in [Places and travel](Observatory-Places-Travel.md), preserving the earlier close edge fix. Unique regional edge materials and progressive damage are implemented |
| 2 | Engineering-informed inner shell | Comparative atlas preserving the waist, its Shade tracks, machinery regions and two polar entries; review matched overview/approach views | Research completed in [shell design study](Observatory-Shell-Design-Research.md); [matched atlas study](../atlas-study.html) implemented; approved [Watershed province 1](Observatory-Watershed-Province.md) implemented with saved addresses, catchments and river gardens; full-shell expansion remains open |
| 3 | Account for missing Shade pieces | Fragment register with parent IDs and destination/impact footprints; first Fallen Shade region inheriting its original biome | Queued concept. Use explicit attack trajectories; mass/energy numbers need defined material and motion assumptions |
| 4 | Smoother travel and startup | Worker-generated edge chunks, bounded GPU uploads, cold shader-start profiling and progressive readiness | Initial worker/BVH/upload prototype implemented and measured in session 1. Broader travel, startup and residency validation remain open |
| 5 | Stronger atmospheric integration | Three regional layers, distance recession and broad Shade shadows are implemented; all cloud features are one-third smaller | Detailed shadow/containment work remains open. Keep vacuum clear and retain correct foreground haze composition |
| 6 | Structural variety | Bent panels, varied fracture sections, cables and material wear driven by exposure/orientation | Queued. Share placement between near geometry, distant appearance and damage history |
| 7 | One authored walking benchmark | A roughly 300 × 300 m forest or industrial level used to measure quality, traversal, load time, memory and frame time | Requested and queued in the Biome Pack programme; no authored benchmark or importer is built yet |
| 8 | Expanded biome catalogue and level pipeline | Stable biome IDs, on-demand material/mesh loading, reusable environmental recipes, tested Blender asset path | Requested Biome Packs; expand after the representative pack, streaming and benchmark pass |
| Later | More graveyard ships and richer fleet activity | Detailed original hulls and local encounters | User explicitly deferred ships in the graveyard |

## Wound behaviour to preserve exactly

- Deep inside an opening: the Breach spill environment anchored in that selected opening, not a rim inspection.
- Looking inward from the exterior spill: select the visible destination through the opening. The empty entry aperture must not send the user back to that same spill.
- Inside an opening near its boundary: the nearest edge, whose ground and upper damage treatment reflect the biome on the surviving side.
- On surviving inner surface: the requested surface location; add the corresponding rim only when it belongs in that view.
- **Latest explicit corrections:** create unique edge textures for every biome, then increase damage toward the Wound until the edge colour is reached. Do not replace this with a shared Ruin recolour or an overlay-only proposal. The ten delivered images preserve fractured construction with environment-specific debris.
- Boundaries between two biomes: blend the corresponding dedicated edge images using the same regional transition as the intact ground.
- Topsoil, vegetation, snow, industrial skin or coastal sediment affect the upper lip. Deep structural strata retain their construction identity.
- Thresholds use the selected location and meaningful view/readability distances. Test near the threshold, Wound tips, different radii, and multiple adjoining biomes.

Implementation context: `world.js` now retains the adjoining region and evaluates a signed Wound-distance damage envelope. `world-shader.js` shares the exact near-edge implicit boundary with shell clipping, and `wound-textures.js` loads the ten images in `assets/wound-edges/`. The old abrupt `damage > .40` switch to biome 4 is removed. The original Ruin biome away from Wounds retains its existing artwork. The top 40 m of the wall blend into the local damaged deposit; deeper strata stay structural. `pointer-navigation.js` distinguishes an entrance selected from the cavity from a ray looking inward through that opening at a visible destination beyond it.

## Background feasibility notes

**Biome count.** A curated 20–40 biome families is a reasonable content-planning range, not a measured engine limit. A much larger catalogue is possible if only nearby assets are resident. The current ten-biome shader tables, texture arrays, validators and destination IDs are hard-coded; expansion needs a data-driven registry and streaming. Families can generate many variants through terrain, vegetation, water, weather, infrastructure and damage. More names alone do not produce more convincing places.

**Memory.** As an illustrative uncompressed budget, one 2,048-square RGBA8 texture with a full mip chain is about 21.3 MiB; an albedo/normal/packed-material set is about 64 MiB. Forty such sets would consume about 2.5 GiB before geometry, framebuffers or shadows. Real formats and maps vary. Use selective residency and supported compression rather than promising every biome at full resolution simultaneously.

**Blender.** Authored meshes, UVs, standard PBR materials and supported animations can be exported through glTF/GLB. Arbitrary Blender shader graphs, modifiers and simulation setups are not automatically reproduced by a browser renderer. The Observatory still needs an import/preparation path, metre conventions, material translation, LODs and collision meshes. [Blender: glTF 2.0](https://docs.blender.org/manual/en/3.6/addons/import_export/scene_gltf2.html), [Khronos: glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

**Forests.** Detailed trunks, branches, undergrowth, fallen wood and canopy are practical locally. A view can suggest thousands of trees through instancing, several geometry detail levels and distant stand representations. Alpha-tested foliage coverage, shadows and transparency cost still matter; there is no useful universal tree-count promise. [MDN: WebGL2 instanced drawing](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawElementsInstanced)

**Industrial areas.** Modular walls, gantries, pipes, equipment and selected interiors can form dense levels. Reuse mesh/material sets, cull districts and rooms, and keep collision meshes simple. Stacked floors, stairs, moving platforms and arbitrary interiors require a more capable character controller than the current bounded terrain samples.

**Game levels.** Yes, as a deliberate extension: terrain, collision, traversal, triggers, interaction, sound, animation and saved progress. A polished bounded level is a sensible benchmark before a streaming world. The current procedural walking sites are roughly 2.4 km wide, but their size does not demonstrate production-level detail or gameplay at that scale. The 300 m benchmark is a proposed quality test, not a promise of measured performance.

## Where to resume

- Working repository: `I:/Sphere/repositories/sphere-observatory`; local app: `http://127.0.0.1:8766/`.
- The 1.0–1.4 work is collected in the v1.4.0 release. Start from that release or its descendants; preserve any subsequent local edits.
- Start with the [current roadmap](Observatory-Roadmap.md), then the approved [Biome Pack programme](Observatory-Biome-Packs.md). The original Next Leap plan, shell research and 1.0–1.4 notes provide historical context.
- Navigation/material work: `evolution-ui.js`, `flight.js`, `world.js`, `world-shader.js`, `edge-stream.js`, `field-sites.js` and `inspection-camera.js`.
- Rendering: `renderer.js`, `silhouette-aa.js`, `volume.js`, `atmosphere.js`, `surface-lighting.js`, `local-shadows.js` and `geometry-renderer.js`.
- Session restoration: `session-state.js`, loaded after UI initialization.
- Numerical/visual evidence is generated locally under `work/screenshots/` and excluded from source downloads. Fixed capture scenes ship in `tests/fixtures/polish-scenes.json`; the capture checks can run from a fresh copy.
- CPU checks: `npm test`. Relevant browser checks: `tests/polish-browser.cjs`, `tests/session-browser.cjs`, `tests/focus-browser.cjs`, `tests/continuity-browser.cjs`, `tests/visual-quality-browser.cjs`.
- Browser cold startup can exceed a minute on the tested machine; current browser checks allow 180–240 seconds. Warm scene timings do not include shader compilation or new chunk construction.

No automatic wake-up, new task, usage reset, deadline or Tuesday run was created. The queue is ready whenever the user resumes.

## Latest navigation and startup corrections

Implemented with Places and assisted travel: explicit pointer pins and G-to-go,
selection of visible geometry, moving Shade addresses, retained area
measurements, and current-view artwork preparation with a loading screen.
Overview startup does not fetch old image collections. See
[Places and travel](Observatory-Places-Travel.md) for behaviour and verification.

The user's aspirational shell rendering is a visual reference for a future
art pass: richer macro surface composition, long Shade shadows, restrained
stellar bloom and coherent tonal depth. WebGL2 supports this class of effects;
whole-Sphere-to-ground quality and frame time still need a representative
benchmark. Continue Biome Pack streaming and the walkable geometry benchmark
before promising a match at a particular resolution or frame rate.

The latest art direction explicitly rejects a beachball appearance in the
major shell divisions. The next versioned shell atlas must avoid repeated
pole-to-pole wedges, continuous latitude stripes and uniformly sized colour
panels. Use asymmetric, interlocking catchments and Builder territories with
coherent transitions and unequal extents. Cloud cover must not serve as the
only disguise for a regular layout. Preserve existing saved addresses when
introducing the atlas revision. Atmosphere should reveal nested weather systems
and cloud structure through descent, with restrained haze and tonal depth that
make the enormous distance legible. The present latitude/longitude geography
remains an interim layout while that atlas and Biome Packs are developed.
