# Shade material filtering at astronomical scale

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

11 September 2026 · release 1.4.0

The remaining Shade noise needed a material pass as well as silhouette antialiasing. A pixel can cover millions of fine panels, and adjacent pixels at a fracture may hit the Shade, another object or space. Texture gradients calculated from those unrelated hit positions do not describe the area of the Shade covered by one pixel.

The material path now calculates the camera ray differential directly from the lens, projection and internal render resolution. It projects that differential onto the Shade's tangent surface, including at cracks and the outer silhouette. Albedo filtering and the Shade finish use these explicit gradients. The material calculation no longer needs neighbouring primary pixels to hit the same object.

The near skin keeps the existing 1.2 km texture scale, 100 m service grid and 5/20 m cell pitches. The 64 m normal/roughness/metalness finish transitions to its aggregate mip as its small detail becomes unreadable, between roughly 1 and 20 metres per pixel. The distant normal becomes the geometric surface normal; high-frequency slopes do not become spurious highlights. A precision floor also prevents very large texture coordinates from claiming finer detail than their floating-point representation supports.

The broad 200,000 km district cells keep their existing world addresses. Their colour is now integrated over the pixel footprint at district boundaries and converges to an average when the cells become unresolved. Construction ribs retain their existing footprint filtering. This is separate from the eight primary samples used for silhouette coverage, which remain unchanged.

The streamed Shade deck shares the skin and finish recipe with the analytic surface. Its rasterized triangles supply their own interpolated texture gradients. No additional Shade edge meshes are created for the fleet's eclipse calculations.

## Validation

`tests/shade-material-browser.cjs` checks material consistency when alternating pixels see another object, near and far finishes at normal and grazing views, tangent-surface differentials against independent ray/plane finite differences, and district filtering against dense area samples. Run it with the local server and the browser environment described in the README. It writes its measured results under `work/screenshots/shade-material/`.

On the tested Edge/ANGLE backend, all twenty near/far and grazing material configurations retained identical values at the surviving pixels when their neighbours changed. Twenty ray/plane differential probes agreed with the finite-difference reference to a maximum relative error of about 0.000000066. Across 3,072 district pixels and 3,145,728 reference area samples, squared error fell from 16.238 with point sampling to 0.0230 with filtering. These are targeted numerical comparisons, not a universal claim that all aliasing is removed.

The existing Shade coverage, materials/shadows, capture and release checks remain required because this shader code is shared with local geometry and still exports.

## Scope and remaining limits

This is spatial material filtering, with no temporal history or motion trails. A first-order tangent footprint is an approximation on curved surfaces and is conservatively bounded near grazing incidence. Averaged finish parameters are a practical distant appearance, not a full microfacet-distribution integration. Eight silhouette samples are finite; tiny moving geometry and sharp lighting can still shimmer. These changes address a concrete material weakness but do not establish that every artifact in earlier screenshots had the same cause.

The filtering principle is to average details over the area represented by a pixel before those details become unresolved. [NVIDIA GPU Gems: filter-width estimates and procedural antialiasing](https://developer.nvidia.com/gpugems/gpugems/part-iv-image-processing/chapter-25-fast-filter-width-estimates-texture-maps) explains that distinction. The implementation here uses the Observatory's own ray and material model.
