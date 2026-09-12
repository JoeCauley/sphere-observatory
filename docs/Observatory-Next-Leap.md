# The next leap: coherent geography and smooth exploration

Planned 11 September 2026 · baseline: Observatory v1.4.0

This is the plan for a future development pass. Publishing v1.4.0 does not implement or automatically schedule it. The [queue](Observatory-Queue.md) retains the user's requests and the distinction between approved project work and questions about game levels.

The next leap should make a place remain convincing from the whole Sphere down to low flight. Water, machinery, habitat and damage should have readable relationships; approaching them should reveal detail without obvious construction pauses or seams. Keep the arbitrary habitat waist, its three aligned Shade tracks, supporting machinery regions and two opposed polar entries.

## Recommended sequence

| Step | Concrete result | Completion evidence |
|---|---|---|
| 1. Finish Wound navigation | A central opening leads to breach inspection; a selection in space near a boundary leads to the nearest adjoining biome's edge; solid ground leads to the selected ground. | Test all six Wounds at centres, tips, both banks, biome boundaries and either side of the arrival threshold. No accidental jump to the far wall or a default Wound. |
| 2. Remove travel stalls | Generate edge chunks in a worker, limit upload work per frame, retain coarse geometry during replacement, and cancel obsolete requests. | Repeat a 500 km flight with frame-time percentiles, longest main-thread task, queue length and memory recorded. Collision and deterministic capture must still agree with the scene. |
| 3. Build a coherent shell atlas | Compare three layouts from the research, then implement one representative province with watersheds, service districts and believable transitions. | Matched overview, approach and low-flight views tell the same geographic story. CPU/GPU sampling agrees; old exported scenes still open. |
| 4. Connect clouds to the ground | Add bounded cloud shadows and coherent distant illumination; improve containment around more of the Wound contour. | Inspect above, inside and below clouds, including grazing views through a Wound. Vacuum stays clear, and the added cost is measured at each quality setting. |
| 5. Make a Fallen Shade landmark | Register missing major fragments and build the first impact region with an inherited biome, scar and surviving structure. | Source fragment, distant footprint and close geometry match. Large missing pieces are placed or explicitly reserved for later placement. |

Navigation is the small unfinished behaviour to settle first. Streaming then removes a measured obstacle before adding more geometry: the current continuity check observed roughly 245–250 ms CPU stalls for some uncached 100–500 km jumps. That is distinct from the much faster warm GPU timings. Reproduce and profile those stalls before choosing the final worker and upload budgets.

Retain the new capture-failure diagnostics while profiling startup. Release validation found an intermittent first-use 4K byte-identity mismatch; an instrumented rerun passed, but the original discrepancy remains unisolated. Treat cold capture repeatability as an open renderer issue alongside startup profiling.

## The shell should look designed at several scales

The [shell design research](Observatory-Shell-Design-Research.md) supplies three alternatives. My recommendation is to use its watershed network as the organizing layout, compartment and service boundaries where they have a purpose, and an industrial backbone within machinery regions.

At the largest scale, the waist and poles remain recognizable. Within them, provinces contain local catchments and service centres. Districts then vary in density: planted ground, water storage, treatment works, power distribution, repair areas, transport corridors and open maintenance clearances. Material parcels provide the close detail. The same world address should identify a place at every scale.

Several principles matter visually:

- Water should collect and move through local catchments, with reservoirs, drainage paths and deliberate transfers between districts. Avoid depicting one continuous AU-scale water network.
- Habitat boundaries can follow water, terrain, lighting and engineered containment. Keep a mixture of gradual environmental transitions and purposeful hard service boundaries.
- Machinery fields need different jobs and rhythms. Thermal collection, power distribution and repair districts should not share one uniform carpet of panels.
- Interior heat collection must connect conceptually to heat rejection outside the shell. Interior radiator-like patterns alone do not dispose of the system's heat.
- Polar entries should read as broad approach and service regions around a portal, with several scales of infrastructure.
- A central star does not automatically produce Earth's latitude-based climate pattern on a spherical inner surface. Cold, wet and arid regions need authored illumination, environmental control or other stated reasons.

These are design inferences from the cited engineering and environmental sources, not a NASA-validated design for an AU-sized inhabited shell. Artificial gravity, support, atmospheric containment and controlled Shade motion remain assumptions. Before committing to a new atlas, compare three still mockups at identical viewpoints, then prototype one province in the renderer.

## Shared geography before more texture layers

Represent original biome, infrastructure role, terrain and water, damage, and wreckage membership separately. A damaged place should retain its history rather than become an unrelated biome ID. This extends the principle already used by the ten Wound-edge materials.

Give the next layout its own version and retain the existing version 1 and version 2 paths. Store layout revision and seeds in exported scenes. Preserve current saved viewpoints and validate scene migration explicitly. Far colour, local material, navigation, collision and future terrain should query the same geographic definition.

Streaming should use stable chunk addresses, screen-space readability and hysteresis. A coarse representation remains until the finer replacement is ready. Background requests need priorities, cancellation and bounded caches; rapid changes of direction must not create an ever-growing queue. Capture must wait for the required fixed-scene resources rather than recording whichever chunks arrived first.

Material expansion needs the same discipline. The current Wound array reserves about 80 MiB even though normal previews decode only nearby images. More biome families should follow a data-driven registry and bounded GPU residency, with measured format and quality budgets. The earlier 20–40-family discussion is a content-planning range, not a demonstrated engine capacity.

## Fallen Shade: one place that tells the attack story

Start with a fragment register: parent Shade, missing source footprint, approximate dimensions, chosen destination and placement status. Outcomes can include the inner surface, a retained cavity trajectory, escape through a Wound, or an explicit reservation for a later site. Do not invent precise mass, energy or impact mechanics without material, thickness and velocity assumptions.

The first landmark should occupy an existing biome. Its distant scar, disrupted drainage and wreck footprint must correspond to the local structure. Bent panels, exposed ribs, cables and service spaces make the fragments readable without giving every piece maximal geometry at all distances. Use an authored attack trajectory initially; dynamic impact simulation is a separate project.

This is a better first expansion than many unrelated new textures: it tests the new geography, damage layers, structural variety and streaming together. More ships in the graveyard remain deferred as the user requested.

## Walking and Blender: a later feasibility milestone

The user's questions about full game levels and Blender assets remain questions. This plan does not authorize or claim a new level or importer.

If that direction is chosen later, start with a roughly 300 × 300 m forest benchmark containing a small maintenance building. Test trunks, canopy, undergrowth, fallen wood, local shadows, ground collision and a short traversal route with one simple interior. Define a narrow GLB asset path with metre units, supported PBR materials, explicit geometry detail levels and separate collision meshes. Validate it before promising forest density or a larger map.

A second industrial benchmark can examine pipes, gantries, stacked floors and rooms. That requires a controller capable of those spaces. Full levels also require interaction, animation, audio, triggers and saved progress; importing attractive meshes alone does not provide those systems. The current 2.4 km walking samples demonstrate scale and atmosphere, not production-level gameplay or detail throughout that area.

## Proposed targets and review gates

These are proposed targets, not results already achieved:

- Record a v1.4 baseline on the same browser, hardware, resolution and quality settings. Separate cold startup, uncached travel, warm frame time and GPU time.
- Aim to sustain a 60 Hz warm preview on the current test machine. Start by budgeting about 4 ms per frame for geometry uploads and investigating main-thread tasks above 50 ms after warm-up; revise the budget from actual measurements.
- Record frame-time percentiles and the longest pauses, not only averages. Memory and pending work should settle during extended travel and after returning to an earlier area. Include a reduced-budget quality test.
- Preserve the numerical geometry checks, Shade silhouette comparisons, clear vacuum, open-Wound traversal, moving Shade attachment, surface level lock, settings restoration and deterministic exports.
- Review native-resolution fixed views at overview, regional approach, 1 km and ground level. Reject oversized repeating grids, visible chunk borders, atmosphere fans and wreck footprints that fail to match their geometry.
- Test actual 4K photographs and panoramas after each renderer milestone. A better preview must not quietly degrade saved output.

The first session should deliver corrected Wound arrivals and a measured streaming prototype. The first major visual deliverable should then be the atlas comparison and one convincing province. That gives us evidence before expanding the entire shell or investing in a level pipeline.
