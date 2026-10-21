# Observatory visual quality study 06

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

Implemented 8 September 2026. This is a renderer and usability revision, with no change to the Sphere's dimensions, routes or world canon.

## Destinations and scenes

Ordinary destinations change only position, forward direction and camera up. The four Collection destinations and the four bottom-row destinations preserve world model, era, time, playback state, field of view, flight speed, lighting and quality. This intentionally means that a destination may look different under your current world and exposure settings. First light as a camera destination does not manufacture dawn conditions.

Camera > Complete scene studies provides explicitly labelled eclipse and original-dawn staging. These deliberately set conditions. World model can also be switched independently in World. Bookmarks and scene imports still restore their complete saved state. Named motion studies stage their own conditions, retain the selected sampling quality and surface style, then restore the original scene after recording; the current-view motion study starts from the current scene.

Controls are grouped into World, Camera, Light and Capture. Light combines exposure, atmosphere, ShellShine, antialiasing, shadow sampling and preview budgets. Camera contains destinations and pose/lens controls. World retains engineering and region design. Capture keeps photos, clips, bookmarks and scene files. Trim width is disabled for shapes to which it does not apply.

## Linear-light resolve

When EXT_color_buffer_float is available and the framebuffer is complete, the material pass writes linear radiance into an RGBA16F texture. Texture filtering resolves that radiance before exposure, the existing filmic curve and gamma encoding. This corrects the previous averaging of already tone-mapped values. The output is still an ordinary SDR PNG/canvas/video, not an HDR display signal.

The half-float buffer clamps scene channels to 60,000 for finite storage. It is not a calibrated astronomical detector. The atmosphere and ShellShine models themselves have not changed. Full-frame sampling and one additional colour pass increase memory and GPU work. At 7680 x 4320 the radiance attachment alone is roughly 253 MiB. Existing ray-budget and frame-limit controls remain in force; those are not watt limits.

If float rendering is unavailable, the renderer retains display-colour supersampling. Geometric/light diagnostics bypass the new pipeline. Actual pipeline and internal dimensions appear in exported metadata. At exact 2x scale, filtering averages four rays per output pixel. Fractional scales use bilinear filtering, not a complete pixel-area integral.

## Verification

- All eight ordinary destinations preserve every non-pose scene field, including playback, custom exposure, time, lens and quality.
- 11,520 output colour channels compared with independent averaging of the actual linear buffer and application of the tone curve: maximum difference 0.56 on the 0-255 output scale.
- Compatibility fallback exercised without WebGL errors.
- Original fixed geometry fixtures: 122,880 CPU/GPU rays, zero disagreements. The fixtures now explicitly request staged conditions because ordinary destinations no longer do so.
- The preserved wide lens exposes a separate existing precision limit: at the star viewpoint, one sampled ray along a damaged-shell boundary classified differently between CPU double precision and GPU float, repeated across the four shade shapes. This is not evidence of exact CPU/GPU agreement at every possible silhouette. Geometry was unchanged in this revision.
- Antialiasing coverage and internal-pixel-budget tests passed. Live 15/30 fps limits and idle stopping passed.
- Actual 3840 x 2160 first-light PNG produced from a 7680 x 4320 linear buffer, with reproducible scene JSON and no WebGL errors.
- Camera and Light panels visually inspected; text encoding corrected.

The next major appearance improvements remain directional ShellShine, better atmospheric integration, restrained optical glare and resolved wound structure. They are not claimed as implemented here. Offline frame-by-frame cinema remains future work; current video uses real-time browser recording.
