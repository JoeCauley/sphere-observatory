# Observatory 1.2 — continuous edges and attached inspection

September 11, 2026

This pass addresses the supplied Wound and Shade inspection screenshots. The shell and the exposed Wound wall now share a precise close boundary. Shade inspections follow the moving object, and detailed structures continue along the fracture as the camera travels. Flight console provides controls inside the fullscreen viewport.

## Boundaries and structure

The large triangular gaps in the Wound screenshot came from disagreement between the normalized GPU boundary and double-precision geometry. They were not intentional overhangs. The local shader now evaluates small changes around an exact point on the Wound. Testing on ANGLE/D3D11 exposed quantization of tiny native sine arguments; a small-angle series preserves those increments.

Adaptive curved wall segments follow the existing Wound outline. Eight structural strata slope into alternating recesses, with torn ribs nearby. Surface and wall meet at the same boundary; no straight wall is substituted for the curved outline. Wall materials use a shared physical coordinate frame, so individual mesh chunks do not restart the texture. The profile is periodic around the Wound.

The fixed rectangular hole previously cut out of the analytic Shade is removed. Its skin now continues through and beyond the detailed region. Nearby deck panels, exposed braces, torn members, thin edge caps and an underside apron follow the common longitudinal fracture. The apron meets the skin inland. Different macroscopic damage families remain intact; the local structure is a common engineering system, not three complete authored spacecraft models.

Shade geometry and the analytic skin share the same material recipe and texture coordinates: 1.2 km artwork tiles, 100 m service divisions, and filtered 5 m by 20 m panel divisions. Far districts retain larger service divisions. The two sides retain different materials. Two-sided lighting now orients the normal toward the viewer independently of a reflected local coordinate frame.

## The moving detail region

For a feature of size `s`, horizontal output width `w`, horizontal field of view `f`, and distance `d`, projected size is approximately:

`pixels = s × w / (2 × d × tan(f / 2))`.

This sets the detail ranges. A shell wall remains modeled much farther away than a narrow brace. Geometry is present before it becomes readable and retires below a pixel with filtered coverage. The nearby pattern uses fixed addresses and seeds along the edge. Movement reuses existing buffers; it does not scatter a new set of objects around the camera.

Wound intervals subdivide for projected curvature and nearby relief. Shade chunks switch between panels/braces and a simpler skin section, with hysteresis during flight. Captures use a fixed threshold independent of previous travel. The region surrounds the camera, including behind it, so turning around does not reveal an empty area.

CPU mesh caching is bounded by both chunk count and vertex storage. GPU buffers outside the current region are released. Collision hierarchies for streamed chunks are built when a ray reaches their bounding box. Rapid, large position jumps can still incur a brief generation cost; this is synchronous procedural streaming, not a background world-generation service.

## Navigation

- Inspecting a Shade automatically attaches the camera to its moving frame. Play, reverse time, scrubbing and Reset time preserve the local camera position and view. Movement keys continue to work relative to that frame.
- **Flight console → Detach from Shade** permits independent flight; **Follow Shade** attaches again. Attachment is stored in scene files and bookmarks.
- **Keep level within 1 km** continuously removes roll while preserving pitch. **L** toggles it. Looking almost straight up or down preserves the last roll to avoid an orientation flip. The existing alignment on arrival within 1,000 km remains.
- The console contains Play/Pause, time rate, scrubbing, reset, attachment, flight speed, lens, exposure, Level now and Save photograph. It remains accessible when the viewport is fullscreen.
- Attached altitude measures distance from the inspected Shade. Short distances and inspection speeds use metres, making 20 m/s readable instead of rounding to zero km/s.

## Verification

- CPU suite: existing geometry, area, layout, light, route, walking and collision checks; plus 84 moving-frame transports, 360 close-edge probes, buffer retention, resolution-dependent LOD, scene restoration, detach and roll-lock stability.
- GPU precision: 432,000 close Wound rays and 73,728 close Shade rays agree with CPU object classification with zero mismatches on the test GPU. Wound views include 20 m, 5 km and 300 km altitude; Shade tests cover all four shapes and three inspection identities.
- Browser interactions exercise Play, scrub, detach, keyboard flight after console use, fullscreen exposure and level controls, and travel up to 500 km along a Shade edge.
- Existing browser suites passed for all 19 destinations, walking/return, clouds and wind, collision, six-face panoramas, finite-star shadows, 122,880 Collection object rays, display resolve and compatibility fallback. The pre-existing four one-sample shadow differences remain within tolerance.
- Five native 3840 × 2160 captures were inspected, including a grazing Wound view and a Shade view after 100 km of edge travel. The 4K Shade scenes used 475 chunks and 316,048 triangles. Retained vertex storage peaked at 71 MiB across these captures; this excludes JavaScript collision data, textures and render targets. Warm capture including PNG encoding took 226–303 ms on the test RTX 5080. These are capture timings, not 4K gameplay frame rates.
- Visual artifacts and scene settings are generated by `tests/continuity-browser.cjs` and `tools/capture-continuity.cjs` in `work/screenshots/continuity/` and `work/screenshots/continuity-4k/`.

These are rendering and navigation improvements. Shell thickness, local structural dimensions, active Shade propulsion and atmospheric containment remain authored assumptions. Full material failure, global terrain, general relativistic transport and complete structural simulation are not added. Additional graveyard ships remain deferred as requested.
