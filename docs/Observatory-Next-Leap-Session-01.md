# Next Leap, session 1: arrivals and background edge construction

12 September 2026 · development branch `codex/observatory-next-leap` · baseline v1.4.0

This session implements the first-session deliverable from [the Next Leap plan](Observatory-Next-Leap.md): corrected Wound arrivals and a measured streaming prototype. It does not change the shell atlas or add the later atmosphere, Fallen Shade, walking-level or import milestones.

## Arrivals

**Superseded by the user-visible correction:** the screenshot review showed that this session's central camera remained millions of kilometres away. See [the close-arrival fix and stronger visual acceptance checks](Observatory-Arrival-Fix-Atlas-Study.md). The description below records the original session-1 implementation, not the current arrival camera.

`surface-arrival.js` chooses the first positive intersection with the geometric shell, before tracing through an opening. Surviving ground keeps its selected world direction and a 3 km arrival altitude. Inside an opening, a nearby selection lands 3 km inland from its exact nearest rim; a deeper selection opens a breach inspection aligned with the selected opening. The adjoining region and its material blend remain the normal world sample. Return restores the saved view. A ray missing the shell leaves the camera alone.

The edge threshold is `clamp(shellThickness × 80, 25, 1000)` kilometres: 960 km at the current 12 km shell thickness. This is an authored inspection/readability distance, not a physical boundary. Central inspection stands back by twice the Wound's authored angular half-width times shell radius, capped at 35% of radius. It does not jump to the first Wound or to the far wall.

## Streaming prototype

`edge-stream.js` now separates address/LOD planning from triangle construction. `edge-worker.js` executes the same recipes in a worker and constructs a flat collision BVH there. Vertex arrays, double-precision collision triangles and BVH nodes are transferred to the main thread. Preview collision and shadows use the same admitted meshes as drawing.

The queue replaces obsolete work on camera changes, processes the nearest coarse coverage and nearby detail first, and admits only one transferred chunk at a time. A worker yields between chunks; cancellation does not interrupt a chunk already being built. GPU admission uses 64 KiB slices with a 4 ms soft time budget. Individual driver calls cannot be preempted. Partial uploads remain invisible and non-collidable. Coarse Shade sections and retained Wound parents remain until their requested replacements are fully uploaded.

The preview cache is bounded by 1,200 meshes, 3 million vertices, and 192 MiB of transferred vertex/collision/BVH data. GPU buffers persist with cached meshes and retire after CPU eviction. These figures exclude browser object overhead, textures, framebuffers and the separate existing synchronous/export cache. The renderer keeps requesting frames until the queue settles. If an extreme view exceeds the resident budget, evicted requested detail is marked budget-limited instead of keeping the page awake forever; a changed view can request it again.

Photographs and panorama faces continue to use the original synchronous deterministic generator, with capture-specific LOD independent of preview history. They complete their required geometry before drawing and do not photograph a partly streamed preview. Moving capture preparation off the main thread is later work. Worker failure falls back to synchronous generation with a diagnostic warning.

## Measurement and verification

Browser results and actual capture images are under `work/screenshots/next-leap/`. Tests run sequentially on the same Edge/ANGLE D3D11 / RTX 5080 machine, with a 1280 × 720 preview and the default scene quality. The flight samples 0–500 km in 10 km steps along Shade 0, then jumps back and forth, waits for residency to settle, and samples 30 warm frames. It is a rapid traversal/load test, not evidence that every requested fine chunk is present while moving.

Baseline: cold page startup 57.23 s; first close draw 4,458.6 ms; travel CPU median 42.8 ms, p95 60.0 ms; warm frame median 16.7 ms. The first close draw includes cold geometry/shader work. See [the retained baseline](evidence/next-leap-session-01/baseline-v1.4.json) for every sample, heap readings and GPU timings. Cold startup, travel and warm performance must be assessed separately.

| Same-machine measurement | v1.4 baseline | Worker, 4 ms budget | Worker, 0.25 ms budget |
|---|---:|---:|---:|
| Cold startup | 57.23 s | 62.15 s | 60.53 s |
| Travel CPU median | 42.8 ms | 2.8 ms | 2.8 ms |
| Travel CPU p95 | 60.0 ms | 3.6 ms | 7.1 ms |
| Travel CPU maximum, including first close draw | 4,458.6 ms | 9.9 ms | 13.5 ms |
| Travel frame p95 | 60.1 ms | 17.0 ms | 16.8 ms |
| Warm frame median | 16.7 ms | 16.6 ms | 16.7 ms |
| Longest observed main-thread task during traversal/settling | 4,462 ms | 0 recorded | 0 recorded |
| Post-flight settling, including 30 warm frames | 0.50 s | 3.03 s | 3.03 s |
| Final streamed vertex/collision/BVH residency | n/a | 19.66 MiB / 192 meshes | 19.66 MiB / 192 meshes |

The [full-budget](evidence/next-leap-session-01/streaming-final.json) and [reduced-budget](evidence/next-leap-session-01/streaming-reduced.json) raw sample records are retained in the repository. Edge was version 152.0.4191.66. Both worker runs ended with zero pending chunks, 53 obsolete responses discarded, no WebGL errors, and a maximum observed upload call duration of 0.20 ms. This particular hardware did not saturate even the reduced 0.25 ms upload budget; partial-upload exclusion is additionally covered by the numerical test.

The structure shader now warms during initial modern-detail startup rather than on the first close draw. Consequently, the cold first-draw comparison partly moves compilation to startup; it must not be presented as eliminating that work. The post-startup CPU median/p95 reduction is the useful worker comparison. The rapid flight does not wait for complete detail at each sample: residency is deliberately progressive. About 2.5 seconds of the final settling interval is streaming; the rest is the warm-frame sample.

Browser UI validation passed all 18 centre/edge/ground arrivals and Return actions across the six Wounds. The first development run produced byte-identical 4K perspective photographs, but its 3840 × 1920 panoramas differed at three pixels by one channel level. A clean detached v1.4.0 checkout, served separately on port 8767, also failed cold repeatability: 74,648 perspective pixels differed, with a maximum channel difference of 13; its panorama pair matched. Both failure image pairs and scene records remain under the local evidence directory. [Difference counts and bounds](evidence/next-leap-session-01/capture-differences.json) are retained in source. This confirms a pre-existing cold export problem; it does not establish a common root cause. A fresh development rerun then passed both actual 4K photograph and panorama byte-equality checks, as well as all 18 UI arrivals again. The [baseline failure report](evidence/next-leap-session-01/baseline-capture.json) and [successful rerun](evidence/next-leap-session-01/repeat-capture.json) are retained. The byte-equality assertions remain strict.

The dependency-free suite includes 1,476 arrival probes across six Wounds and three radii, 36 biome transitions, 1,184 collision BVH rays with 970 hits, byte-identical worker/synchronous vertex recipes, coarse replacement, partial-upload exclusion and stale-message cancellation. Existing geometry, flight collision, material, level-lock, moving-Shade and scene migration checks remain in `npm test`.

The final [continuity browser run](evidence/next-leap-session-01/continuity.json) passed 432,000 close Wound and 73,728 close Shade CPU/GPU probes with zero mismatches. It also passed four structural captures, Play/scrub attachment, detach, keyboard flight, fullscreen controls and residency-complete 0/2/20/100/500 km travel. Those travel records measure total readiness wait, not a blocking draw duration.

Reproduce with `npm test`, then `node tests/streaming-browser.cjs`, `node tests/next-leap-browser.cjs`, and `node tests/continuity-browser.cjs`. Browser tests use the existing `SPHERE_PLAYWRIGHT`, `SPHERE_BROWSER`, and optional `SPHERE_URL` environment variables. The profiler also accepts `SPHERE_PROFILE_LABEL` and `SPHERE_UPLOAD_BUDGET`; the reduced run uses 0.25 ms.

## Remaining work

Cold startup/shader compilation is still expensive. One flight is not a comprehensive throughput, heap plateau, or visual continuity certification; broader routes and long-duration operation remain necessary before calling streaming finished. Newly entered regions can still reveal geometry progressively while requests arrive. The v1.4 intermittent first-use 4K mismatch was reproduced and remains open. This is a development prototype, not a release-validation claim.

The next visual milestone is the three matched atlas comparisons and one representative province. Keep the existing layout versions and saved viewpoints; review the comparison before choosing the new atlas. Cloud-ground integration and the first registered Fallen Shade follow that work.
