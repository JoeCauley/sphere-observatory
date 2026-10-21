# Camera culling and preparation review — 20 October 2026

The useful next step is to reject unnecessary **display work before building, copying or uploading it**. Sphere already performs several kinds of visibility rejection. Their presence does not mean that all upstream work is avoided, and the working Meadow–Industry scene uses a different rendering path from ordinary Main.

This is a source review with focused CPU controls. No renderer behavior, accepted pack, simulation, density, work limit or gate was changed. No native frame rate or performance saving was measured. The [current work plan](Observatory-Current-Work-Plan.md) incorporates the findings. Formal P05 remains OPEN; Phase One remains NOT_ACCEPTED / NOT_RELEASED.

## What is already present

| Path | Existing behavior | Where the saving stops |
| --- | --- | --- |
| Ordinary Main triangle geometry | [geometry-renderer.js](../geometry-renderer.js#L5) tests an oriented mesh box against the forward and four side planes. The colour loop rejects wholly invisible groups before its own lazy upload and draw. Missing box data keeps a mesh visible. | This is colour-pass rejection, not a residency policy. Earlier preparation can already have built and uploaded the mesh. There is no far-distance plane in this helper. |
| Ordinary Main images and artwork | [asset-plan.js](../asset-plan.js#L7) caches a view plan, traces a 5 × 5 perspective or 16 × 9 panorama probe grid, and requests image families within distance bands. Distant surfaces use numeric colour. | The probe plan is an asset-selection heuristic, not proof of complete visible-fragment or AA coverage. Its cache serializes the whole scene value; a narrower dependency key is an opportunity only after exact dependencies are established. |
| Generic instanced environments | [instanced-environment.js](../instanced-environment.js#L82) rejects patch spheres before per-patch instance sorting, LOD command creation and command uploads. It accepts both generic `radius` and resident `boundsRadius`. | Providers can already have generated the instances. The legacy resident-cell branch stages active and pending cells before its colour visibility loop (lines 309–321). |
| Main's production Meadow selection | [vegetation-gpu.js](../vegetation-gpu.js#L205) rejects whole packet spheres, then region spheres, and classifies boundary records. [vegetation-selection.js](../vegetation-selection.js#L18) includes a conservative horizontal turn margin and a key covering the view. | Resident records already exist when this selection runs. [meadow-field.js](../meadow-field.js#L143) and the selection demand generator retain a position/lens-based circle, rather than a direction-only demand wedge. This supports turns and coverage; it is not automatically waste to delete. |
| Main shadows | [local-shadows.js](../local-shadows.js#L6) selects casters in two light-space regions, disables the pass when inappropriate or distant, and reuses unchanged preview shadow maps. Photographs request a fresh pass. | An object outside the colour camera can still cast a required visible shadow. [renderer.js](../renderer.js#L102) prepares these casters before colour drawing and can upload them there. |
| Working Meadow–Industry world | [shared-world renderer](../packs/shared-world/1.0.0/renderer.js#L59) reuses unchanged near-packet identities, rebases only when the render origin changes, chooses distant Industry geometry, and reuses motion geometry when its inputs match. [zoneDemand](../packs/shared-world/1.0.0/host.js#L38) requests nearby zones by distance and altitude. | No per-zone CPU camera-frustum rejection was found in this draw path. Within 7,500 m it submits all six Industry zones; within 250 m it considers the whole motion batch. New near packets are uploaded before that distance decision. |
| Working Meadow pack | [GrassStage](../packs/infinite-meadow/1.0.0/grass-stage.js) retains tile descriptors until its geographic/profile key changes. [Its renderer](../packs/infinite-meadow/1.0.0/renderer.js#L288) gates landmarks, near grass and canopy tiers by distance, altitude or inspection mode. Shaders fade/discard absent coverage and the GPU clips submitted geometry. | The near-grass draw submits the selected tile arrays; each enabled canopy tier submits its full grid. This is procedural GPU grass: the stage does not prepare a large CPU array of individual grass roots. CPU root-generation savings must not be claimed for this path. |

The reviewed triangle and shadow passes explicitly disable face culling. No enabling call was found in the tracked application JavaScript, including the working pack path. Grass uses `gl_FrontFacing` to light both leaf sides in [grass-shaders.js](../packs/infinite-meadow/1.0.0/grass-shaders.js#L50). A global backface switch would therefore remove required leaf/card faces. Closed, consistently wound solid meshes could be reviewed separately; roofs, open walls, undersides, shells and foliage need their own material decisions.

No hardware visibility query or hierarchical depth occlusion culler was found in the searched tracked application JavaScript. The timer queries measure GPU time; material/leaf “occlusion” terms shade surfaces and do not reject hidden objects. This is a source-search observation, not a native GPU-state measurement or an inventory of external engine code.

## Where preparation can wait

### 1. Industry: visibility before copies, uploads and animation geometry

[SharedIndustryBatch.rebase](../packs/shared-world/1.0.0/renderer-batch.js) copies the retained vertex array and updates the complete GPU buffer when the render origin changes. The shared renderer currently does that for every selected Industry zone within range. It also creates or replaces every newly resident near batch before deciding which zone to draw. The constructor eagerly builds/uploads middle and far geometry for all six zones.

First calculate a conservative required-display set, then perform a zone's optional near upload, rebase and submission only when required. Keep valid retained content and its revision; becoming invisible must not imply deleting reference state or repeatedly rebuilding it. A returning zone must receive the current origin and content generation before drawing. A missing or uncertain visibility result must keep it eligible.

For the motion batch, use a conservative bound for **all** permitted motion and routing states. When wholly outside every required display pass, leave its visual revision dirty and skip `movingGeometry` and upload. On return, build the current state once. Process time, water routing, interactions, terrain and support continue in the reference system. [reference.sampleGraphics](../packs/shared-world/1.0.0/reference.js#L81) already reuses the dynamic-input snapshot; do not replace that reuse with a second simulation.

Defer eager fallback construction only as a later part of this work: an approaching or turning camera must always have a complete usable fallback. Moving construction onto the first visible frame without a bounded readiness path would exchange startup work for a hitch.

### 2. Establish bounds before using existing zone metadata

Industry's zone radii currently describe two-dimensional preparation proximity. They are **not certified geometry bounds**. Actual vertex inspection found this counterexample at the normal 150 m facility size, orientation 0, model 0:

| Zone | Existing demand radius | Furthest horizontal vertex from its zone centre |
| --- | ---: | ---: |
| Yard | 72 m | 134.741128 m |
| Storage | 33 m | 33.286634 m |

The yard batch contains the whole hexagonal apron as well as the local yard. A view test using its 72 m scheduling radius could hide visible geometry. This observation does not diagnose a failure of the existing proximity scheduler, which uses a different purpose and margin.

Build or author conservative bounds for each actual batch and content revision, including LOD, configuration scale/orientation, height and motion envelope. For a job not built yet, a cheap bound must come from the recipe/verified metadata; building the full mesh merely to decide whether to build it defeats the saving. The finite geometry samples below are counterexamples and checks, not a universal envelope proof. Split very broad batches only if subsequent measurements justify the additional ownership and draw costs.

### 3. Prioritize production; retain turning and walking coverage

The shared Industry scheduler has one pending worker, up to four resident detailed zones and a bounded packet. Its [update method](../packs/runtime/v1/preparation.js#L11) evicts zones absent from the chosen list. Main Meadow also retains coarse support while replacements prepare, and its production selector already has a turn guard.

Use camera direction first to **prioritize optional detailed jobs**, with a bounded turn/approach guard and stable tie-breaking. Preserve the required coarse/fallback window, original roots and geographic identities. Do not pass a bare visible-only list into today's eviction path: a quick turn could discard useful content, cancel jobs repeatedly and create missing coverage. Evaluate stricter demand admission only after replacement and return behavior are proven.

Keep collision, support, process state and saved places independent of view visibility. Include every current rendering consumer in demand: colour, relevant shadows, panorama faces, photographs, silhouettes and AA/resolve samples as applicable. A pointer-centred approximation cannot substitute for their required coverage.

### 4. Extend reuse without changing content

Reuse a compact visibility/demand result for the same validated inputs. Invalidate on the relevant camera position and basis, lens, viewport/aspect, projection/face, render-origin representation, pass, content generation, LOD and dynamic bounds. Mutable scene object identity is insufficient. Cache construction, key creation, live storage and retirement all belong in the measured work and memory account.

There are existing mechanisms to extend rather than duplicate: zone packet identities, origin stamps, Meadow stage keys, native packet/region selection, retained demand requests, graphics snapshots and shadow-map keys. A future static-geometry origin uniform could avoid full-buffer rebasing, but it requires the existing double-precision geographic subtraction and depth/precision equivalence to be preserved. It follows measured visibility deferral in priority.

Canopy tile or grid-block visibility could save GPU vertex work in the working pack. It is a separate measured experiment, after Industry. Preserve each canonical tile/root identity, instance rank, wind and Industry exclusion mask when compacting submissions; changing the instance-index mapping can change the displayed grass. Preserve boundary silhouettes and replacement overlap. Do not edit the preserved 1.0.0 pack to experiment.

Occlusion queries/depth hierarchies are deferred until these simpler opportunities are measured. A new occlusion system adds work, lifetime and delayed-result concerns; hidden-from-camera is also insufficient for shadow or other-pass demand.

## Relationship to P05

The private Main candidate remains `scene-closed-steady-01/review-source-73`, 515 files, inventory SHA-256 `53fd3f1ed96edda970650a42d0a3c5aac201b43952ba56ee4a83c4dd11881cb0`. The [20 October checkpoint](Observatory-Project-Checkpoint-2026-10-20.md) records the unresolved drawing-work contract and native qualification.

The current disclosed model completes input compilation, then defers before drawing: 2,605 available logical units against a provisional 2,848 entry-plus-following requirement. New tariffs remain unselected and the product Root gate remains false. Geometry culling does not by itself resolve that accounting/scheduling condition. Main's complete visible-pixel field, nine required sample identities and native consumers still need their own proof; the ordinary full-screen field cannot be discarded just because a mesh is outside view.

Carry the reference-world/display-demand separation into that owner chain, but charge actual work and preserve original limits. Do not change sealed candidate73, infer acceptance from the successful shared walk, or use this audit to waive any full-view, memory, native performance, export or public registration requirement.

## Evidence and limits

Review baseline: application commit `2c151880876412ae087ad57d591226ae8c25011f` on `codex/observatory-safety-2026-10-20`. Application status was clean before the audit. Another chat's outer-repository curation files were already changing; those files were left alone.

The local audit folder is `I:/Sphere/work/culling-preparation-review-2026-10-21T00-24-57Z/`. It holds the initial source hashes, source controls and private-candidate pointers. The reproducible [control script](../analysis/culling-preparation-review-2026-10-20/source-controls.mjs) and [compact evidence record](../analysis/culling-preparation-review-2026-10-20/review-evidence.json) are versioned with this report.

Focused controls passed: six existing mesh/patch visibility cases (ahead, behind, side, edge intersection, enclosing camera and very far); three additional conservative-bound/disable cases; 432 actual static geometry builds across six orientations, two implemented models, three LODs and two facility widths; and 24 sampled motion/routing states. Static inspection covered 5,090,544 vertices. This tests pure source behavior and supplies a real undersized-radius counterexample. It does not establish universal animated bounds, absence of visual popping, native GPU state, frame timing, savings or P05 completion.

No browser, server, simulation, renderer or frozen evidence was changed by the review. Subsequent implementation must pass the work plan's visual, lifecycle and complete-cost checks before a gain is reported.
