# Close Wound arrivals and the first atlas comparison

12 September 2026 · local Next Leap development

The user's screenshot exposed a flaw in session 1: a central See Surface selection deliberately backed off by twice the Wound half-width, producing a roughly 13-million-kilometre overview. The tests accepted that camera because they checked classification and selected direction, rather than whether the arrival actually showed a useful nearby subject. A fixed 960 km edge threshold also classified visibly near-rim overview selections as central openings.

## Corrected arrival contract

- A central opening leads to a wide, close inspection of that Wound's nearest fractured wall. At the default shell thickness the camera is 4.2 km above the shell and 9.6 km into the opening. It looks back at the exposed strata and adjoining ground.
- A near-edge opening selection leads to a tighter wall-and-biome view: 1.44 km above the shell and 2.64 km into the opening at default thickness. Its materials are the actual adjoining region, including biome blends.
- Surviving ground keeps the selected address and a 3 km altitude, with a downward view that shows nearby ground instead of aiming into empty space.
- The original view still returns on the next See Surface click. An empty ray does not move the camera.

The physical edge threshold remains `clamp(shellThickness × 80, 25, 1000)` km. A second test recognizes a boundary within 7.5% of viewport height from the crosshair, provided the selected point is in the outer part of the opening (Wound metric above 0.65). This makes near-edge selection work at overview scale without converting the centre of a small distant Wound into an edge click. The viewport aspect ratio is supplied by the actual app view. These are authored navigation thresholds.

All opening inspections use kilometre-scale offsets based on shell thickness, set local flight speed, enable structural detail, and meter exposure for the wall. They never route through the default Wound expedition or continue to the far wall. Near-edge inspection now deliberately places the camera on the opening side of the lip so the vertical wall is visible; it is not a ground landing inside solid shell.

## Verification

The full numerical suite passes, including the updated 1,476 arrival cases, 36 biome transitions, and overview clicks 50,000 km inside each Wound boundary. The new `tests/arrival-framing-browser.cjs` operates the actual See Surface button from overview cameras and captures both settled preview and deterministic export views for the centre and near edge of all six Wounds.

Every browser arrival hits the intended nearby Wound wall at the crosshair: approximately 12.36–12.53 km for central inspections, and 3.38–3.40 km for edge inspections. All 12 retain the intended Wound, have empty streaming queues when captured, return to the original position, and produce no WebGL or page errors. This is a stronger acceptance check than the former route-name/position test. [Recorded states and results](evidence/arrival-fix/verification.json). Native 1600 × 900 images are retained locally in `work/screenshots/arrival-fix/`; representative central and edge previews were visually reviewed. An additional [biome-specific browser run](evidence/arrival-fix/biome-verification.json) captured forest and glacial edges at the tips of Wounds 2 and 5, confirming distinct adjoining materials and nearby wall hits; both were visually reviewed.

## Atlas study

Open [the interactive atlas comparison](../atlas-study.html) through the local Observatory server. It compares the current broad arrangement with the three candidates from the design research: watershed network, compartmented habitat, and industrial backbone. Each has a matched whole-shell map, 640 km province view and 96 km district view. Controls cover a forest, industrial district, biome boundary and a forest edge at Wound 2 and a glacial edge at Wound 5, with landscape, water, service/transport and damage layers.

These are explicitly cartographic mockups, not renderer photographs or an implemented world-layout revision. The current local-detail panel is a schematic reference, not a reproduction of the renderer's texture assets. The global map queries the current geography; the alternatives use irregular province/service assignments. The 640 km study is attached to a world-direction address and its district view is an exact crop of the same authored data. The overview marker is exaggerated to identify that small location at AU scale.

The reusable study model contains an authored terrain field, priority-flood drainage, conserved catchment accumulation, receiving basins and dry-bank service proposals. The numerical test verifies 147,456 drainage cells across four seeds: strict downhill routing, no flow cycles, conservation to boundary outlets, repeatable seeds and matching zoom footprints. The [browser check](evidence/atlas-study/verification.json) passes all 20 location/layer combinations, distinct initial maps, saved study settings and mobile layout. Its full-page comparison and mobile screenshots are retained under `work/screenshots/atlas-study/`.

The three alternatives deliberately share terrain and water so their infrastructure arrangements can be compared fairly. The compartment roads and backbone corridors are proposed engineering patterns; the model does not solve environmental containment, transport throughput or hydraulics. River strokes are cartographic curves derived from the drainage graph. Wound damage sampling is interpolated from a fixed local grid for the study, not used for live collision or clipping.

The comparison supports the research recommendation: use watershed organization, selective compartment boundaries, and a service backbone within machinery districts. The next implementation gate remains one versioned province in the live renderer, with CPU/GPU agreement and old-scene migration checks. The comparison does not alter live layout versions, user preferences, or existing scene files. Cold startup and the previously reproduced intermittent 4K byte-repeatability issue remain open; this arrival/UI pass does not claim to resolve them.
