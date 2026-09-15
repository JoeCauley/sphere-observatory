# Renderer consultancy review

14 September 2026 · reviewed against `b80bd72` on `codex/watershed-neighbourhood`.

**Decision: retain the present WebGL2 renderer and geography-first roadmap.**
Adopt explicit cache validity rules and investigate one relightable geographic
proxy. Defer a second live backend, Gaussian splats and general routing/baking
infrastructure until a bounded experiment demonstrates a useful result.
Continue the joined receiving lake, quiet reach and open meadow next.

This reviews Claude's `sphere-observatory-webgpu-findings.md` and
`sphere-tri-hybrid-renderer-design.md`, both dated 14 September. Their proposed
actions are consultancy input, not authorization to execute a migration.
This review changes documentation only.

## Repository and roadmap audit

The roadmap's central account is supported by the implementation and the
[Continuity 3 evidence](evidence/continuity-03/verification.json). All 18 source
SHA-256 values in that record match the current files. Its 17 passing browser
suites are historical evidence; they were not rerun for this review. The full
28-suite numerical command (`npm test`) passed again on the current checkout.
No fresh Mac performance measurements or comparative visual review were made.

| Roadmap area | Assessment against the checkout |
|---|---|
| Versioned Watershed pack | Implemented: registry, schema-1 address, geography/art revisions, validation, budgets and joined analytic water/routes. The contract already exists; broader pack authoring remains incomplete. |
| Wound seams and support | Implemented: shared clipping/seams, collision and guarded coarse coverage. Preserve these through future representation changes. |
| Altitude/weather continuity | Bounded stage C is implemented: shared province material ownership, opaque depth, footprint-aware clouds and curved Wound containment. Further geographic/artistic transitions still need checks. |
| Automatic Shade approaches | Revision 2 exists across supported perimeters and damage boundaries. Completed edges do not imply finished environments on both faces. |
| Connected walking | Revision 2 uses nine fine and sixteen coarse cells, pinned replacement support and rebasing. Historical revisions keep their bounds. This is bounded route evidence, not global acceptance. |
| Variations, complex geometry, Hero Zones, Fallen Shades | Still future work. `heroAnchors` is texture-coordinate anchoring, not a persistent authored zone registry. |
| Loading/performance | Cold compilation and preparation remain concerns. The earlier 2 s interval remains a useful investigation target. Warm fixed-view timings do not certify cold travel. |
| Handoff | Stale: the continuity work was committed as `b80bd72` on 13 September. At review start, tracked files were clean; `work/` was untracked. The old statement that the milestone was entirely uncommitted was incorrect. |

The earlier 21/13 suite counts describe the first pack milestone, not current
overall coverage. Priorities 3–5 should identify the completed bounded work and
remaining expansion, rather than read as requests to begin those features.
The capture paragraph asking to isolate the old first-use mismatch is also
superseded by Continuity 3's resolve fix and independent-context evidence;
retain that reproducer as a regression gate.

## Corrections to Claude's premises

| Consultancy claim | What the repository or evidence establishes | Design consequence |
|---|---|---|
| The engine is essentially one analytic surface; only `renderer.js` makes graphics API calls | The macro bodies are analytic, but `geometry-renderer.js` rasterizes real triangles. Texture, shadow, atmosphere and panorama modules own WebGL resources. | Preserve the existing analytic/mesh hybrid. A backend migration spans resource ownership and multiple passes, not a file rename. |
| No global interreflection; add cheap bounce light | `world.js` overrides `SphereCollection.cavity` with a 192-direction first-bounce estimate. `shine-worker.js` and `preview-light.js` update it off-thread; captures use the exact scene time. `renderer.js` and `surface-lighting.js` apply ShellShine. | Improve an existing coarse model if needed. It is not spatially resolved multiple-bounce transport, but another ambient term would risk double counting. The cited atmospheric comment does not prove absence of shell bounce. |
| Lighting studies lock the clock | `places.js:renderState` scales luminosity for an artistic study. `places-ui.js` preserves `time` and `playing`; the clock can keep running. | There is no existing study-mode guarantee that makes a lit splat valid. Never silently pause a study to accommodate a cache. |
| `SpherePanorama` anticipates a mid-field cache | `panorama.js` renders six fresh camera-relative views and converts them to an equirectangular image. It stores resolved colour, without a reusable regional material/depth contract. | Its capture orchestration may help a baker, but it is not a relightable traversal representation. |
| Packs need a schema and validation | `biome-packs.js` already validates saved addresses and revisions; the pack document defines joining, imagery, fallback and residency rules. | Extend the existing contract when an experiment identifies missing fields. Do not create parallel state semantics. |
| GPU-bound, not CPU/browser-bound | The reported Mac views suggest substantial GPU cost, but also report 26 ms CPU on the ground. `renderer.cpuMs` covers only part of frame work; timer queries are asynchronous. | Measure full-frame intervals, simulation, workers, uploads and GPU passes separately. A view-specific bottleneck is not a universal diagnosis. |

The reports' concerns about mid-field legibility and softness are credible
review targets, not newly reproduced findings here. The current revision
already addresses several older seams. An impostor cannot repair an incoherent
river network or a repeating far atlas: those require the shared geography and
new atlas revision already on the roadmap.

## The benchmark does not decide an API migration

The standalone benchmark HTML and raw run output are not among the supplied
files and were not found in the Downloads listing or repository source search.
The numbers remain Claude-reported measurements, not independently reproduced
results. Even accepting the table, its interpretation needs these corrections:

1. **It changes API and pipeline together.** WebGL2 fragment versus WebGPU
   compute does not compare WebGL2 with a WebGPU fragment/render pipeline.
   Storage writes, workgroup size, blending and presentation can all differ.
2. **The timing boundaries differ.** Full-frame readback plus additive blending
   versus queue completion is not an isolated GPU shading comparison. Readback
   and presentation costs must be separated from the pass under test.
3. **Equal sampled means do not prove byte-identical images.** Use full-frame
   comparisons, maximum/mean error and inspected differences, including edges,
   depth, moving shadows and volume compositing.
4. **The percentage description is wrong.** The 8×8 results imply approximately
   28%, 45% and 49% more time per frame at the three resolutions. Approximately
   22–33% describes lost throughput, not increased frame time. The summary's
   25–35% slowdown is not supported by its own table.
5. **The workload is synthetic.** Current weather uses textured density,
   separate local/far paths, 48/80/128 preview steps, reduced-resolution light
   and transmittance, and depth-aware composition. The renderer also performs
   triangle/shadow passes and up to eight extra silhouette samples. A 40-step
   ALU stand-in does not establish their cost.

Khronos specifies that `glFinish` completes prior GL effects, including
framebuffer changes. A reported 50× discrepancy deserves a minimal reproducer
and driver/browser investigation; it is not grounds for assuming `glFinish` is
generally ineffective on Apple hardware. See the
[OpenGL ES reference](https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glFinish.xhtml).

Keep WebGL2 as the supported baseline. Do not conclude that WebGPU is inherently
slower on Apple or faster on NVIDIA. WebGL2 availability also depends on browser,
driver and device support; “universally available” is too strong.

A future benchmark should compare WebGL2 fragment, WebGPU fragment and WebGPU
compute at equal output quality, with compilation outside warm timing. Record
browser/adapter/driver, full state and revisions, internal/output resolution,
pass timings where timestamp queries are available, end-to-end frame intervals,
median/p95/max, cold preparation, memory and copies. Exercise ground, mid-field,
cavity, Shade/Wound and textured weather views, plus photo/panorama output.
Half-resolution configurations belong in every applicable backend comparison.
The test gates a port decision; it does not block ordinary WebGL2 improvements.

## What to adopt, adapt or defer

| Proposal | Decision | Reason and scope |
|---|---|---|
| Analytic macro shell plus local detail | Retain | This is already the right scale decomposition and already combines analytic bodies and meshes. |
| Relightable mid-field representations | Prototype narrowly | Cache geography/material information; retain live star, Shades and weather. Compare against the existing procedural masks before committing. |
| Appearance mutability as an additional selection criterion | Adopt as a rule | Geometry, lighting, view and resource readiness have different validity conditions. They should not be collapsed into “static.” |
| One generic state hash and automatic dependency inference | Adapt | Declare dependencies per representation and verify them. Serialization alone does not discover shader dependencies, external assets or view validity. |
| `RendererBackend`, `MutabilityRouter`, `RepresentationCache`, `Baker` now | Defer | Prove a second useful implementation first. Existing asset/ground/edge managers already supply readiness, cancellation and residency mechanisms. |
| WebGPU-only GI, culling, path tracing and baking | Reframe | Compute makes some algorithms more practical, but approximate GI, baking and even progressive path tracing are not categorically impossible in fragment passes. GPU-generated indirect work is a stronger capability distinction. Choose by measured need. |
| WebGL2 surface plus live WebGPU feature passes | Defer pending an explicit transfer design | There is no standard shared WebGL/WebGPU depth attachment or arbitrary buffer/texture aliasing. Cross-API copies and synchronization could dominate a small feature. |
| Shader transpiler/IR | Defer | No second surface backend is selected. Porting assembled shader code also involves bindings, texture operations, derivatives, depth and render targets. Shared mathematical tests are useful; a new compiler layer is not yet justified. |
| Improved indirect light | Investigate after profiling | Compare a better low-order/spatial approximation with existing ShellShine under day, Shade shadow and Wound exposure. Keep exact-scene capture and avoid duplicate energy. |
| Gaussian splat destinations | Optional later experiment | Need a better source scene, explicit appearance validity, collision, occlusion, memory and export evidence. Do not replace the walkable Hero Zone milestone with a frozen view. |

The [WebGPU specification](https://gpuweb.github.io/gpuweb/#dom-gpuqueue-copyexternalimagetotexture)
provides external-image copying, including canvas sources. That transfers image
content, not ownership of a WebGL depth buffer. For any future mixed design,
choose either one API for all tightly coupled live passes, or an asynchronous
baker producing versioned transferable assets. A small, infrequently updated
irradiance payload might justify a cross-API experiment; a live full-frame
colour/depth round trip needs its own measured case.

## The useful cache design

Start with a geographically anchored Watershed material tile or simplified mesh
proxy derived from the existing boundary graph. Preserve albedo, normals,
roughness and relevant height/coverage masks; apply current lighting at render
time. This can be generated on the CPU or with WebGL2 render targets. WebGPU is
not a prerequisite.

| Cached representation | Required validity |
|---|---|
| Geometry/material proxy | Pack and geography/art/terrain revisions, stable region/address, seed, material/asset and baker version, applicable damage and local parent frame. Live time need not invalidate geometry. |
| Lit radiance or ordinary splats | All source appearance dependencies, including effective study illumination, star/Shades, time and baked weather. A warm entry for an old appearance is not usable merely because it is resident. |
| View-derived G-buffer/panorama | Source content validity plus camera/projection, coverage, depth/parallax and output error limits. One view cannot reveal newly exposed surfaces during arbitrary travel. |

Keep view selection separate from persistent world identity. Exposure can remain
outside a linear-radiance cache key only when applied later; an already
tone-mapped panorama cannot make that assumption. Camera motion usually selects
LOD rather than changing world identity, but can invalidate a view-dependent
proxy. Capture dimensions and baker/shader versions also matter. Record these
dependencies explicitly instead of assuming a seed or whole-state hash is enough.

Claude's proposed router has a logical conflict: its first rule routes anything
reading changing time to procedural, so static terrain with dynamic lighting
never reaches the later relightable-proxy rule. Select by **geometry validity**
first, then whether a representation supports the current lighting and view.
Use projected error and readiness rather than hard universal altitude bands.

Retain valid coarse coverage until a replacement is complete. Hysteresis can
stabilize an otherwise valid choice; it must not retain stale geography or baked
lighting. A fade is not a substitute for matching depth and support. In
particular, do not reintroduce transparent/stippled province borders that exposed
the earlier depth holes. Reserve floor/collision resources ahead of decorative
proxies, include both representations in peak residency during a transition,
and reject stale worker results. Reuse the current 4 ms upload-admission model.

## Why splats should wait

Ordinary appearance-trained splats are a poor default for a world whose clock,
occluders and weather change. That is a sound limitation to carry forward.
However, “any change requires rebaking” is too absolute: deformation and
relightable formulations exist. The
[original 3DGS work](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
learns a radiance representation from calibrated views;
[Relightable 3D Gaussian](https://nju-3dv.github.io/projects/Relightable3DGaussian/)
adds normals, material and lighting decomposition and ray-traced visibility.
Those extra systems require validation in our renderer; they are not supplied
by loading a conventional splat asset.

Baking the current procedural preview cannot create missing architecture,
materials or photoreal detail. It may amortize an expensive reference renderer,
but better source assets or better offline rendering must supply any quality
gain. Also, a fictitious world does not force one source route: authored assets,
licensed scans adapted to the setting, or offline synthetic rendering could
supply a future scene. Provenance and the canonical world address must remain
explicit.

The existing compositor is a useful starting point: analytic and triangle
surfaces share logarithmic ray-distance depth, followed by volumetric composition
in linear light and a display resolve. Splats would have to preserve that depth
convention, metre precision, occlusion, colour space and capture behaviour.
Transparent extended primitives do not necessarily have one sufficient surface
depth for atmospheric integration. Sorted alpha blending alone does not solve
every overlapping mesh/volume case; the
[UniMGS paper](https://arxiv.org/abs/2601.19233) specifically addresses joint
occlusion/transparency and deformation. Its existence is evidence of a problem
being studied, not evidence of a ready Observatory integration.

If pursued later, use one explicitly frozen, bounded scene with a stated viewing
region and measured asset budget. Validate against its source views and novel
views, the moving/paused surroundings, Wound silhouettes, collision, 4K photos
and all six panorama faces. Resume live conditions through a valid procedural
fallback without taking ownership of the user's Play/Pause choice. A Wound is
not automatically lighting-static because the background stars are static.

## Effect on the next work

1. Continue the joined lake/reach/meadow trio, preserving original geography,
   support, saved revisions and cloud scale. Its clearer source geography is
   necessary for any useful proxy.
2. During that work, profile a fixed set of clear/cloudy ascent and descent views,
   separating cold preparation from warm cost. Keep the existing capture and
   connected-walking gates. Investigate the unresolved longest frame intervals.
3. If repeated geographic shading is costly or loses readable detail, compare
   one relightable proxy with the current path across eye level, 100 m, 1 km,
   cloud level, 1,100 km, 10,000 km and 40,000 km, including grazing/panorama
   views and a running Shade cycle. Require unchanged water/routes and collision,
   no boundary cutoff, bounded bytes/queues, valid cache misses and exact-scene
   export readiness. Declare visual/error and time/memory budgets before the
   experiment. Keep the current path if the proxy does not earn its cost.
4. Continue the complex 300 × 300 m geometry benchmark and persistent authored
   Hero Zone sequence. Prefer ordinary relightable meshes for walkable structures
   unless another representation demonstrates a specific advantage.
5. Revisit WebGPU only with a reproducible representative benchmark or a bounded
   feature requiring its execution model. Revisit splats only with a better
   source scene and an explicit product use for frozen appearance.

This adopts the strongest part of the consultancy—representations appropriate
to geography, lighting and view validity—without making an unproven backend or
asset representation a prerequisite for the next visible improvement.
