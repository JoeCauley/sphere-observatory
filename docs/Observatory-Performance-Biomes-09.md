# Performance, biomes and exploration

Implemented and checked 2026-09-09 on Windows with Chrome ANGLE D3D11 and an NVIDIA RTX 5080.

## Navigation

The existing instrument appearance is retained. Explore opens first, with a texture preview, ten biome destinations and approach altitudes of 1,000 / 100 / 10 / 1 km. Precise coordinates, rotation, projection and diagnostic controls are collapsed below. World owns scene design; Light owns appearance and all preview quality controls; Capture owns photographs, motion studies and saved scenes.

The bottom destinations are Overview, Surface, Shade fleet, Wounds and Star, followed by a Biomes shortcut. Destinations preserve world, simulation time, exposure, atmosphere and quality. They choose a camera, photographic lens and sensible travel speed. Wounds and shades are unavailable when those features are disabled. Original camera studies remain available under Explore; explicitly staged lighting studies are separately labelled because they replace scene conditions.

See surface intersects the shell along the crosshair, searches for intact ground if the ray crosses a wound, and lands at 3 km with a 70-degree lens and 1 km/s travel speed. Return to view restores the original position, orientation, lens, speed and projection. Automatic levelling engages on near-surface arrivals and when descending through 1,000 km; it preserves the viewing direction and position. Manual roll below that threshold remains possible.

Biome expeditions find actual intact regions, rather than changing the world seed. A fixed World biome palette still overrides the regional mosaic; use Automatic for the named geographic destinations.

## Limited material LOD

The close-range texture implementation described below is the initial version. [The hero texture follow-up](Observatory-Hero-Textures-10.md) supersedes its near-surface tiling and transition scheme.

| Layer | Tile coverage | Transition distance to visible ground |
| --- | --- | --- |
| Distant atlas | Procedural global regions | Always available |
| Regional | 256 km | Fades in from 1,800 to 600 km; nominal 1,000 km |
| District | 16 km | Fades in from 180 to 60 km; nominal 100 km |
| Local | 1 km | Fades in from 18 to 6 km; nominal 10 km |

The ten sets are Dark Age Forest, Super Jungle, Ultra Desert, Winter Hell, The Ruin, Machine Expanse, Rustwater Marsh, Chalk Archipelago, Mycelium Sea and Violet Labyrinth. Their local atmospheric colours range from cold blue and jungle green to mineral violet. Atmosphere is enabled by default, fades away outside its local range, and uses a path-length approximation that avoids opaque fog when looking down.

Thirty 512-square sRGB texture layers, including mipmaps, occupy a fixed approximately 40 MiB. Assets load lazily, one decode at a time, and upload one biome per preview frame with a short fade. Failed loads leave procedural material visible. Near-surface exports wait for the full set and use complete texture weights. Serve over localhost: file URL restrictions can prevent texture readback or worker creation.

Coordinates are anchored on the CPU in double precision, with camera-relative GPU coordinates. Triplanar sampling avoids polar singularities; mirrored repetition avoids a hard tile seam. Pixel-footprint filtering prevents distant fine detail from aliasing. Biome edges blend. These are authored albedo images on a smooth mathematical shell: no terrain displacement, walking, buildings or tree geometry. The three scales share a visual family but are not geometrically matching zooms. Repetition remains visible in some views. See [asset prompts and provenance](../assets/biomes/README.md).

## Performance changes

The primary bottleneck was repeated CPU cavity illumination: 192 surface samples, each integrating up to 64 stellar samples against the fleet and station. Cached ring frames and source-disc samples remove repeated allocations and trigonometry. Conservative bounding-sphere culling removes irrelevant blockers while preserving the finite-source calculation.

Live cavity illumination now runs in a worker at most 10 times per second, with one request in flight and smoothly blended results. Paused states and photographs compute the exact sampled result for their frame. Local atmosphere visibility is calculated once per frame on the CPU instead of reintegrating it for every pixel. Texture detail replaces unnecessary procedural octaves.

Live preview supports up to 4K output, separate from its approximately 2.07-million-pixel supersampling budget. Adaptive resolution uses GPU timer queries, reduces resolution under load, and recovers when there is headroom. It does not change export resolution. New installs default to a 60 FPS ceiling; existing frame-limit preferences are retained. Settled views stop drawing, hidden tabs pause, and only one active top-level Observatory tab owns animation.

Warm 1280 × 720 output / 1920 × 1080 internal benchmark results:

| View | Original CPU median | Final CPU median / p95 | Observed final GPU timer |
| --- | --- | --- | --- |
| Overview | 101.8 ms | 0.1 / 0.2 ms | 3.17 ms |
| Surface | 97.5 ms | 0.2 / 0.3 ms | 2.51 ms |
| Station | 100.2 ms | 0.1 / 0.2 ms | 2.57 ms |

At native 3840 × 2160 output/internal resolution, observed GPU timers were 12.41 ms (overview), 10.45 ms (surface) and 10.21 ms (station). CPU medians remained 0.1 / 0.2 / 0.1 ms, with p95 values 0.3 / 0.4 / 0.5 ms. All three reported WebGL error 0. These warm costs fit inside a 16.67 ms GPU frame budget on this machine.

CPU numbers measure main-thread submission, excluding the worker. GPU values are asynchronous timer-query observations, not presentation latency or a guaranteed frame rate. The embedded integration viewport was browser-throttled (its host also received very few animation callbacks), so sustained 60 FPS was not established by that test. Use the main app's live FPS / CPU / GPU readout to assess actual flight cadence. Cold shader compilation and initial image uploads are not included in warm timings.

## Verification

`npm test` passes the existing numerical suites and a new performance regression suite: 384 independent all-blocker visibility comparisons; biome state validation; continuous distance and footprint fades; metre-stable texture anchors; adaptive recovery; robust vertical camera bases.

Open `tests/render-validation.html` on the local server and run its integration checks. Verified all ten image sets / thirty layers, distinct textured surfaces, GPU LOD continuity, fixed-point texture stability, unchanged diagnostic IDs, panorama rendering, 1,000 km levelling, crosshair landings at distinct regions, reversible surface visits, world-preserving bottom destinations, all ten biome expeditions, worker results, paused exact lighting, a 1920 × 1080 PNG and zero draws in a settled view.

`tests/performance.html` measures warm submission costs and GPU timer queries at 1280 × 720 or 3840 × 2160. Run browser benchmarks sequentially to avoid GPU contention. JavaScript syntax and `git diff --check` also pass.

The older standalone Playwright rotation CLI was not run: the workspace has no installed `playwright` package. Browser integration checks above ran through the connected Chrome browser instead.
