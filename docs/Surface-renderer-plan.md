# Industry streaming, Super Jungle and replaceable renderers

The far side of the seed 713 Border station gives us three places to compare at a known scale. Super Jungle supplies the ground under the walker, Border draws a 48 km building with a 4 m service door, and Meadow draws the same building beside its grass. Industry provides a fourth test in which thousands of distant structures compete for the same frame. [Return walk](../examples/border-crossing/outfall-return.mp4) · [Measurements](../examples/border-crossing/outfall-return.json)

## What the current build costs

These measurements used Chrome and WebGL 2 on ALPHA's RTX 5080. The Industry camera was fixed, the process clock was paused and the 960 × 540 canvas was sampled at 128 × 72. A pixel counted as changed when its mean absolute RGB difference exceeded 12 on the 0–255 scale. This lets us count scenery arriving even when the player stands still.

| Experiment | Previous build | This build |
| --- | ---: | ---: |
| 85 m over Industry, first 180 frames with more than 1% of pixels changing | 2 | 2 |
| 1,400 m over Industry, same test | 7 | 7 |
| Largest single change at 1,400 m | 817 of 9,216 pixels | 817 of 9,216 pixels |
| Six short out-and-back flights across one plant's 195 m detail boundary, frames with uploads | 12 | 0 |
| Bytes uploaded during those six round trips | 13,719,456 | 0 |
| Border hall mesh, triangle vertices before packing | 42,120 | 94,248 |
| Resident hall and freight geometry, two buffer uploads on either build | 1,734,048 bytes | 1,294,320 bytes |
| Border hall mesh assembly, median warm build | 7.15 ms | 2.85 ms |
| Station draw, median across seven shaded views at 960 × 540 | 0.16 ms | 0.18 ms |

Industry now keeps the resident detail level across a small band on either side of a threshold. The band is 8% in either direction. An approaching player still resolves machinery, while a brief turn near the boundary can reuse the same GPU buffer. On the cold high-altitude view, the renderer settled at 315 draws and 30,635,676 tracked buffer bytes. At 85 m it settled at 143 draws and 20,191,212 bytes.

The first version with both pipe galleries could exhaust Meadow's 8 MiB buffer budget on seed 23. The station now stores four corners, one normal and one tint per flat face. The GPU uses the same six corner indices to draw the two triangles of every face. That keeps both galleries and their materials, reduces resident geometry by 25% against the older, simpler hall and leaves room for Meadow. Comparing the two ways of drawing the new station gave identical RGB pixels at all seven camera positions.

We alternated the old and new worktrees across three trials each. The table reports medians of the per-trial medians. Each trial included ten warm assemblies. Draw timings include browser and driver overhead and synchronize each group of eight draws with a one-pixel readback. Whole-game frame intervals, integrated GPUs and native clients need their own measurements.

## First experiment — keep an Industry skyline in sight

The current streamer draws just the ground in distant districts. Within 3.6 km it requests factory silhouettes, then individual plants. Detailed builds share a two-unit budget per frame. A changed distant district can also release its old ground batch while it waits for a replacement. Both paths can change the picture under a stationary or slowly moving camera.

Use one addressed set of major roofs, towers and tanks as the first visible picture of each incoming district. Build that coarse mesh ahead of the flight path and keep it visible until the replacement can draw. Make each buffer swap atomic. Cars, pipework and moving product can resolve nearer the eye. Record a cold entry, a sustained descent, a sharp reversal and the same trip after the cache warms. Keep the existing roof, conveyor and walking tests alongside them.

The first comparison should at least halve the largest cold-frame change at 1,400 m and preserve the zero-upload result on the short reversal. Record time to first navigable picture, 95th-percentile frame interval, bytes uploaded and peak resident memory alongside the pictures. Waiting behind a loading screen would otherwise make the cold-frame score look better.

## First Super Jungle walk

Today the native Super Jungle and Dark Age Forest share their broad ground pattern. Super Jungle's generic near props use a seeded 128 m lattice, five sides and heights of 3–7 m. Meadow already has a more developed vegetation system. Simply adding more instances of the current Jungle shape would still leave the canopy missing from the horizon.

On seed 713 we turned away from the station and walked 502 m. At 164 samples along that route, the 25 resident ground chunks held the same 100 distinct prop IDs. These counts cover the loaded neighbourhood. The frame shows how little of that geometry reads as vegetation at eye height.

![Standing 612 m beyond the paving and looking into the current Super Jungle](../examples/border-crossing/super-jungle-transect.jpg)

Use a 500 m walk starting at the last outward-film position and heading away from the far apron. Let the walker see canopy crowns against the station wall, pass between trunks and buttress roots, and look down into shade-tolerant undergrowth. Generate one set of addressed trees. Use those same crowns for distant silhouettes and the same trunks for walking collision. Preserve the 96 m transition onto the paved apron. Turn back, reload at a marked trunk and repeat the walk in shade. Judge the silhouettes and frame times before extending the recipe across the habitat.

## What a replacement renderer must consume

The station already supplies a practical starting point. Its Atlas address generates the surveyed model, its movement solver owns support and clearance, and its view has load, draw and dispose operations. Main uses that view on a regional canvas, Border uses it indoors, and Meadow draws it into the depth buffer of its own scene. Industry is more tightly coupled. It subclasses Meadow's WebGL renderer and edits the compiled program's shader source to implement its own depth convention.

| Owned by the world and simulation | Supplied by each rendering module |
| --- | --- |
| Seed, plot and station address, local metre axes, persistent object identities | GPU buffers, instance or cluster layout, streaming cache and disposal |
| Camera pose and lens, clock, shade state, terrain height and solid extents | Projection and depth implementation, lighting, material shaders and drawing |
| Doors, routes, clearance, freight timetable, controller input and save data | A picture for a given world sample and diagnostics for its cost |

Use the existing WebGL 2 station as the reference. Feed a second module the same camera trace, world time, material parameters and geometry. Start with the far look-back, both sides of a door and the freight bridge. Check the roof silhouette at kilometres, jambs and pipe occlusion at metres, eye height at both handoffs and the saved station after restarting. Record cold and warm frame intervals, GPU time where available, peak bytes and teardown for each module on the same hardware and viewport.

A WebGPU module or an installed native viewer can enter this comparison independently. The first worthwhile port is this one route. Keep whichever module gives the better picture within the measured frame and memory budget for its scene. A native pilot can consume the same trace and a copy of the same save before any wider client migration. [Earlier renderer review](Observatory-Renderer-Review-2026-09-14.md)

### Reproduce the measurements

Run `node tools/measure-industry-streaming.cjs <output-directory>` and `node tools/sample-station-surfaces.cjs <output-directory>` from the checkout being measured. To compare an older revision, invoke the new scripts by absolute path with the older checkout as the working directory. Both open real WebGL scenes and write screenshots and numeric samples. The baseline for this comparison is `2f79f43`.
