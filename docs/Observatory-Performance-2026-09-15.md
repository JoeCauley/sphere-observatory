# Observatory traversal performance · 15 September 2026

The optimized local build completed the 24-route fixed-quality traversal matrix at **59.8–60.1 preview draws/s** on the tested RTX 5080. Mycelium Sea improved from **44.1 to 59.9 draws/s**. Ground draw submission usually fell from **1.5–1.7 ms to 0.4–0.5 ms**. Fixed-resolution 4K remains GPU-limited in the heaviest close views; adaptive preview reached approximately 60 draws/s after settling.

This is an unreleased optimization of the existing locally modified 1.5.0 integration. It preserves the Wound opening repair, material detail, station lighting sample counts, eight-ray Shade silhouette sampling and export resolution. No commit, push or release was made.

## Findings and changes

1. **Preview pacing skipped otherwise affordable frames.** The limiter could record an early draw slightly in the future. Subsequent 60 Hz callbacks then intermittently missed its threshold. The new cadence preserves fractional timing on faster displays while never advancing a completed draw beyond the callback timestamp. An independent 20-second jitter fixture reproduces 875 draws with the old calculation versus 1,199 with the fix; tests cover 15/30/60 fps on 60/120/144 Hz displays.
2. **Ground streaming oscillated at exact chunk boundaries.** Converting AU-sized positions back to local coordinates introduced micrometre-scale sign changes. A profiled eight-second Mycelium walk issued 230 replacement/cancellation messages, repeatedly abandoning 19–21 pending chunks. Residency-centre selection now snaps only within approximately 0.1 mm of a boundary. Geographic ownership, vertices, collision and world addresses retain their original coordinates. All 24 final routes ended with the ground queue empty and within its 64 MiB budget.
3. **The renderer submitted invisible geometry and repeated identical lighting.** Conservative oriented bounding boxes now reject off-camera meshes in the colour pass. Shadow casters and resident collision meshes retain the complete set. Shared lighting preserves each original Wound/Shade sample origin; identical ground origins share one calculation. The checked forest view submits 11 of 25 groups; the 4K broken-Shade approach submits one of 503. Resident and drawn counts are exposed separately.
4. **CPU boundary and readiness queries duplicated work.** Wound contour searches reuse their fixed coarse samples while retaining the exact refinement. Straight Shade edges use a closed-form weighted segment projection. Readiness and drawing reuse an asset plan only when all scene values and view parameters match. UI pose notifications are batched after movement substeps; physics keeps its original 1/60-second substeps and bounded catch-up.
5. **Local shadow setup forced avoidable GPU synchronization.** The renderer now supplies its known framebuffer and viewport. Framebuffer completeness is checked when shadow storage changes rather than every frame. This removes repeated synchronous state queries without reducing shadow resolution or caster coverage.
6. **GPU shading did unnecessary station and material work.** Station ring/spoke predicates use equivalent angle identities rather than repeated inverse/trigonometric operations. A conservative finite-star cone bound excludes station planes no source ray can intersect. The original blocker union and sample positions/counts remain. Connected ground skips an earlier material evaluation that the final geographic material completely overwrites.
7. **Empty Wound chunks still sampled terrain that was discarded.** Explicitly empty clippers now finish an empty mesh immediately, preserving the absence of both terrain and collision support.

The numerical geometry and timing fixes are deterministic. GPU/CPU timing improvements are measurements on this machine, not universal hardware guarantees.

## Previous-session work retained

The [earlier performance pass](Observatory-Performance-Biomes-09.md) successfully moved cavity illumination into a worker, introduced GPU timer queries and adaptive resolution, and retained exact export lighting. Those mechanisms remain. The integration's shader-section refactor still reconstructs the historical shader fingerprints exactly before the explicitly tested station transform. There is no evidence here that shader-section naming itself caused the slowdown.

The [integration](Integration-2026-09-15.md) and [Wound repair](Wound-edge-repair-2026-09-15.md) remain intact. This evaluation fixes measured costs and pacing defects in their current combined checkout; it is not a claim that one historical session introduced every bottleneck.

## Method and scope

- Hardware: Intel Core i7-13700K, NVIDIA RTX 5080 16 GB, driver 610.74; Chrome 152.0.7977.83, ANGLE Direct3D11, hardware rendering. Node 24.18.0 drives Playwright.
- Sequential browser runs in an isolated persistent test profile; no concurrent GPU benchmarks. The server serves this repository. Before runs override the changed JavaScript with frozen pre-session copies, including the previous integration and Wound repair.
- Real application animation loop and keyboard input. Ground arrivals settle before measurement; W walks approximately 11.2 m in four seconds, and Shift-W runs approximately 24 m beside each Wound. No internal busy flag freezes these traversal measurements.
- Ten geographic biome destinations; one running lip route on each of all six Wounds. Eight unattached flight approaches cover both faces of an intact Shade (4) and all three broken families (0, 7, 8). Flights begin outside the selected perimeter/fracture and use automatic speed and normal collision. These are representative arbitrary-flight paths, not an exhaustive sweep of every coordinate, seed, time or shape.
- Fixed-quality matrix: 1600 × 900 browser viewport; scene area 1264 × 834; internal supersampling 1772 × 1169 (about 2.07 million pixels). Quality 1, highest AA mode, full default materials/weather/lighting, default after-era scene, adaptive disabled, 60 fps target. Four-second warm movement samples per route.
- 4K window: 3840 × 2160 browser viewport, scene/internal raster 3504 × 2094 (7.34 million pixels). The side panel occupies the remainder; this is not an 8.29-million-pixel fullscreen benchmark.
- CPU below is wall time around the entire draw call, including submission and driver waits, excluding simulation/UI work elsewhere in the animation callback. GPU values are asynchronous timer-query medians. Draw fps counts preview draws during keyboard input; it is not independently measured display presentation or input-to-photon latency. Raw summaries retain p95, maxima, movement, memory, geometry and error data.
- Shader compilation, travel preparation and initial texture upload are excluded from warm route timings. Warm arrival preparation generally took about 2.1–2.3 seconds for biomes and 1–2 seconds for Wounds. A cold shader cache remains substantially slower.

## All-biome, Wound and Shade matrix

Indices below are the zero-based geometry identifiers used by the test. CPU and GPU columns are medians in milliseconds.

| Route | Draw fps before → after | CPU ms before → after | GPU ms before → after |
|---|---:|---:|---:|
| Dark Age Forest | 59.9 → 60.0 | 1.7 → 0.5 | 4.30 → 3.69 |
| Super Jungle | 59.9 → 59.9 | 1.6 → 0.5 | 4.24 → 3.32 |
| Ultra Desert | 59.9 → 59.9 | 1.6 → 0.5 | 7.16 → 5.92 |
| Winter Hell | 60.0 → 59.9 | 1.6 → 0.5 | 5.72 → 4.65 |
| The Ruin | 60.0 → 60.1 | 1.6 → 0.5 | 4.74 → 4.07 |
| Machine Expanse | 59.9 → 60.0 | 1.6 → 0.4 | 5.07 → 4.07 |
| Rustwater Marsh | 59.9 → 59.9 | 1.6 → 0.5 | 6.15 → 5.53 |
| Chalk Archipelago | 58.0 → 59.8 | 1.5 → 0.5 | 6.48 → 5.61 |
| Mycelium Sea | 44.1 → 59.9 | 1.6 → 0.4 | 5.51 → 4.68 |
| Violet Labyrinth | 58.3 → 60.0 | 1.6 → 0.5 | 4.76 → 3.96 |
| Wound 0 | 60.0 → 60.0 | 2.7 → 1.4 | 5.95 → 5.04 |
| Wound 1 | 59.9 → 59.9 | 2.9 → 4.6 | 6.44 → 5.40 |
| Wound 2 | 60.0 → 60.0 | 3.2 → 1.5 | 10.10 → 9.06 |
| Wound 3 | 60.0 → 59.9 | 2.8 → 5.7 | 6.25 → 4.26 |
| Wound 4 | 60.0 → 59.9 | 6.6 → 5.4 | 10.04 → 8.68 |
| Wound 5 | 59.9 → 59.9 | 2.9 → 1.5 | 4.71 → 3.73 |
| Shade 4 · inner | 59.8 → 59.8 | 1.8 → 1.0 | 6.79 → 5.70 |
| Shade 4 · outer | 59.9 → 59.8 | 1.7 → 1.0 | 4.25 → 3.53 |
| Shade 0 · inner | 59.9 → 59.8 | 1.5 → 0.9 | 7.88 → 6.63 |
| Shade 0 · outer | 60.1 → 59.9 | 1.5 → 0.9 | 8.62 → 7.45 |
| Shade 7 · inner | 59.9 → 59.9 | 1.6 → 0.9 | 12.81 → 11.34 |
| Shade 7 · outer | 60.0 → 60.0 | 1.5 → 0.9 | 8.38 → 7.30 |
| Shade 8 · inner | 60.0 → 59.8 | 1.6 → 0.9 | 6.00 → 4.75 |
| Shade 8 · outer | 60.1 → 59.9 | 1.6 → 0.9 | 5.60 → 4.54 |

Every final route completed with WebGL error 0, no page errors, no draw interval over 50 ms and no dropped movement time. Ground queues ended empty. GPU medians improved on all 24 routes. Draw-call CPU time did not improve uniformly: Wounds 1 and 3 were slower in this final sample despite lower GPU cost and 60 fps cadence. The table retains those results; CPU submission timing includes driver stalls and should not be treated as pure JavaScript execution time.

## Fixed-resolution 4K window

| Route | Draw fps before → after | CPU ms before → after | GPU ms before → after |
|---|---:|---:|---:|
| Dark Age Forest | 60.0 → 60.0 | 1.6 → 0.5 | 16.47 → 14.15 |
| Wound 2 | 47.7 → 55.1 | 17.1 → 6.5 | 20.71 → 17.87 |
| Shade 7 · inner | 40.4 → 46.8 | 22.2 → 1.5 | 23.93 → 20.57 |
| Shade 7 · outer | 57.0 → 60.0 | 15.1 → 1.4 | 16.68 → 15.91 |

The final Wound route improved from 47.7 to 55.1 draws/s, and the inner Shade route from 40.4 to 46.8. These views still exceed a 16.67 ms GPU budget. The strongest CPU reductions remove waiting/submission work; they do not make the expensive full-resolution lighting and silhouette passes free.

## Adaptive 4K and moving clock

The existing adaptive controller was also tested for ten seconds per route. The following rates and GPU medians use the last three seconds; final internal raster sizes make the resolution tradeoff explicit.

| Route | Settled draw fps | Settled GPU ms | Final internal pixels |
|---|---:|---:|---:|
| Dark Age Forest | 60.0 | 12.12 | 3153 × 1884 |
| Wound 2 | 60.0 | 13.54 | 2067 × 1235 |
| Shade 7 · inner | 60.0 | 11.04 | 1857 × 1109 |
| Shade 7 · outer | 60.0 | 9.26 | 2207 × 1319 |

Whole-run rates were 59.6–60.0 draws/s. The Wound and inner Shade runs each had one transient interval over 50 ms during adaptation (approximately 62 and 74 ms); the settled portions reached approximately 60. Adaptive preview does not lower photograph or panorama export resolution. Settings and quality defaults were not lowered by this change.

With the clock running at 60 simulation seconds per real second, six-second forest, Wound and unattached moving-Shade flights held approximately 60 draws/s and advanced about 360 simulation seconds with zero dropped movement time. The moving Shade quickly leaves the close-edge view; that check exercises moving-world traversal, not sustained tracking or Shade-face walking.

## Correctness and visual checks

- **36 numerical suites** pass, including collision, streaming, geographic ground addresses, Wound chunks, Shade bodies/seams, travel transactions and historical shader fingerprints.
- New performance regression checks: 90 exact original Wound searches; 1,287 straight boundary projections; 3,000 rotated-box/frustum comparisons; asset-plan invalidation; stable terrain reservations; jittered frame cadence.
- **65,536 GPU rays** comparing the original and optimized station predicates across both eras: zero mismatches. These include arbitrary primary rays and finite-star lighting rays near station rings/spokes.
- Independent CPU/GPU station visibility: 11,376 probes, all within the existing one-sample-plus-8-bit tolerance, with 4,973 partially occluded probes. Five probes differ by more than 0.004, maximum 0.007874; no out-of-bound result. This is not a claim of bit-identical CPU/GPU arithmetic.
- Culling on/off at fixed forest, Wound, and both-face broken-Shade poses: zero changed bytes in both object-ID and material images at 641 × 359. Original lighting sample origins and complete shadow caster sets are retained.
- Real worker/browser Wound regression: lip → over opening → return; no terrain triangles fill the opening, and empty sections remain empty.
- Actual photograph and panorama downloads preserve capture metadata, build identity and playback restoration. Modern, legacy and geometry shader variants compile in WebGL. Keyboard tab navigation, quiet-view recovery and effective 200% layout checks pass.

Visual parity establishes the checked views and rays, not every possible subpixel boundary. The earlier strict cold-capture repeatability gate remains separate and is not declared solved by these tests.

## Remaining performance limits

Close Shade views at a full 4K-window raster still spend about 21 ms on the GPU; retained finite-star lighting and eight-ray edge shading dominate. Adaptive preview is the currently verified path to approximately 60 fps there. Cold shader compilation can take tens of seconds to roughly two minutes on a fresh driver/profile cache; warm launch measurements around 0.7 seconds must not be mistaken for a cold-start result. Further gains should target shader specialization/compilation and expensive edge-lighting passes, with the same image and light-convergence gates.

This pass does not certify other GPUs, every world configuration, hour-long memory stability, sustained attached moving-Shade traversal or all capture determinism. It provides an automated repeatable baseline for those next evaluations.

## Evidence and reproduction

[Evidence directory](evidence/performance-2026-09-15/) contains before/after summaries, fixed-resolution and adaptive 4K records, moving-clock results, visual fixtures/images, station and Wound verification, capture metadata, numerical output and source hashes. Per-frame records and frozen baseline source copies remain in the ignored local `work/traversal-performance/` and `work/performance-baseline/` directories.

Run `npm test` for the numerical gates. With Playwright available and the local server running, set `SPHERE_URL` to its URL (this run used `http://127.0.0.1:8770/`), then run `npm run test:performance` and `npm run test:performance-visual`. `SPHERE_BROWSER` selects Chrome/Edge; `NODE_PATH` or `SPHERE_PLAYWRIGHT` can supply the Playwright installation.

Traversal options: `SPHERE_WIDTH` / `SPHERE_HEIGHT`, `SPHERE_CASES` (comma-separated route IDs), `SPHERE_MEASURE_MS`, `SPHERE_ADAPTIVE=1`, `SPHERE_PLAYING=1`, and `SPHERE_RATE=60`. Baseline comparison uses `SPHERE_BASELINE=1` and requires the preserved local baseline source files; it deliberately fails if those files are absent. Run GPU checks sequentially.
