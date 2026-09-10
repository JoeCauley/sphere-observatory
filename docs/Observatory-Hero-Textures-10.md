# Hero landscapes and surface relief

Implemented 2026-09-09, with three visual optimization attempts and an independent screenshot critic. This supersedes the near-surface LOD description in the previous performance note.

## What changed

Ten dedicated hero images replace the repeating local triptych panel in normal close approaches. Native assets are 1254 × 1254, about six times the pixel count of the previous 512-square runtime layer. The image tool delivered this resolution despite prompts requesting 2048-square images; the app uses native resolution without artificial upscaling. [Assets and complete generation prompts](../assets/biomes/hero/README.md) are committed project files, generated using the built-in OpenAI image-generation tool.

Hero mapping uses a 2.5 km world lattice. Each source landscape covers roughly 4–9 km depending on sampling scale, with variable placement rather than a visibly repeated square. Forest, jungle, ruins, industry and marsh use blended triangular patches. Desert, ice, archipelago, fungi and crystal use smoothly warped coordinates, jittered patch centres, variable scale and varied source crops. Sampling weights vanish at source-image edges, so those biomes do not expose mirrored edges or hard wrapping seams. Their blend can still look too soft where incompatible silhouettes overlap.

The same hero landmarks and UV coordinates persist through the full mip chain. The former independent district/local image crossfade no longer replaces near-surface landforms during an approach. Hero appearance blends into the remote atlas over 600–1,800 km ray distance, with additional pixel-footprint filtering; individual source features are already unresolved at that range. A colour-neutral high-frequency detail band fades over 4–24 km and filters away below the pixel footprint. This restores close texture without introducing different large landforms.

World → Living surface contains **Surface relief · bump shading**, enabled by default. Screen-space surface gradients derived from the hero albedo and fine detail perturb the local lighting normal. Each biome has restrained relief amplitude; water-like colours in marsh and archipelago suppress the fine band. This is approximate albedo-derived bump mapping, not a separately authored height map. Geometry, silhouettes, intersections, collision and area measurement remain the analytic shell. The central star is above the local ground, so relief does not invent lateral sunlight or cast mountain shadows.

Hero GPU allocation is lazy and bounded at approximately 80 MiB for all ten mipmapped layers, in addition to the existing 40 MiB atlas array. Images decode and upload one at a time; loading fades over 650 ms. Existing atlas material remains visible while hero maps load. Near-surface exports wait for complete hero maps. Orbit views do not allocate the large hero array until needed.

## Three attempts and evidence

| Biome | Baseline | Attempt 1 | Attempt 2 | Final attempt 3 |
| --- | ---: | ---: | ---: | ---: |
| Dark Age Forest | 5 | 2 | 2 | 2 |
| Super Jungle | 5 | 3 | 2 | 2 |
| Ultra Desert | 5 | 2 | 3 | 2 |
| Winter Hell | 5 | 3 | 4 | 2 |
| The Ruin | 5 | 3 | 2 | 2 |
| Machine Expanse | 4 | 3 | 2 | 2 |
| Rustwater Marsh | 5 | 3 | 2 | 2 |
| Chalk Archipelago | 5 | 3 | 3 | 3 |
| Mycelium Sea | 5 | 3 | 3 | 3 |
| Violet Labyrinth | 5 | 3 | 3 | 2 |

Scale: 1 is the most natural, 5 is obviously small repeating texture. The critic scored the worst supported repetition/blending issue across matched low-altitude and receding views. Eight of ten achieve the strict combined target of 2. Chalk and Mycelium reach 2 for repeat visibility, but remain 3 overall because overlapping coastlines or fungal strands sometimes appear translucent. This is not presented as a complete ten-biome pass. All three authorized attempts have been used; no fourth visual pass was performed. [Independent review and rubric](texture-critic-review.md).

Each baseline/attempt has sixty full-resolution screenshots: ten biomes, with 1 km oblique, 1 km nadir, 10 km, 20 km, an 8 km lateral displacement and a clear-air diagnostic. Six-panel sheets preserve aspect ratio. The final set additionally contains consecutive motion panels, shallow grazing views and 100/300/600/900/1,200/1,800 km remote-atlas comparisons.

Local evidence is under `tests/artifacts/hero/{baseline,attempt1,attempt2,attempt3}/`. This artifact directory is git-ignored. To reproduce it, start `node tests/hero-review-server.cjs`, open `http://127.0.0.1:8767/tests/hero-review.html`, select an attempt and use the capture/verification buttons. This separate localhost-only test server accepts PNG artifacts under a constrained path; it is not part of the normal application server.

## Verification

The numerical `npm test` suites, JavaScript syntax and `git diff --check` pass. Final browser tests verify every hero layer, nonzero bounded bump response for all ten biomes, unchanged geometric diagnostic IDs, and small-step continuity at 1/4/6/8/10/18/24/32/600/1,000/1,800 km. The largest mean image change across a 2 cm altitude perturbation was below 0.053 of a byte-scale RGB channel value in the tested views. This is a continuity check, not proof that every visual blend is natural.

At 1 km altitude and native 3840 × 2160 output/internal resolution on this RTX 5080, observed GPU timers were about 10.90 ms for forest and 11.13 ms for the more complex ice sampling. Overview was 12.62 ms and station 10.46 ms. CPU submission medians were 0.1–0.2 ms; all cases returned WebGL error 0. These are warm frame costs, not a guaranteed presentation frame rate. Cold shader compilation and texture uploads cost more. Adaptive preview remains enabled to handle heavier views, while photographs retain their requested export resolution.

[Portable before/after gallery](../examples/hero-review/index.html) collects matched 1 km screenshots. The remote atlas is an illustrative region design, not geographically matched hero terrain; its broad colour changes and region boundaries remain visible in far-away comparisons. The low-altitude scores do not certify those remote transitions as seamless.
