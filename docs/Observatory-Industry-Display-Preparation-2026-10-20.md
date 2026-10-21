# Industry display preparation — 20 October 2026

Industry now checks conservative camera bounds before uploading detailed geometry, copying static buffers for a new render origin, submitting draws or rebuilding moving display geometry. The public Meadow–Industry walk remains functional. The simulation, ground support, collision and world clock run independently of display demand.

This is a functional shared-world successor, not formal P05, Meadow H1 or complete native performance qualification. P05 remains OPEN; P06–P08 remain NOT_STARTED and Phase One remains NOT_ACCEPTED / NOT_RELEASED. Read the [current work plan](Observatory-Current-Work-Plan.md) for the remaining Main work.

## Source and walking route

The successor is `packs/shared-world/1.1.0`, reached through **Explore → Biome Packs → Infinite Meadow or Infinite Industry → Visit**, or **Walk Meadow ↔ Industry**. The adapter manifests are version 1.2.0; their content remains the original 1.0.0 packs. Original pack versions, runtime, empty service catalogue and shared-world 1.0.0 are preserved. The 60 protected pack/runtime/catalogue files checked before this change remain byte exact. The successor registry pins 61 files / 317,326 bytes.

The existing shared save schema and geography remain compatible in both directions. A native public walk recorded 380.9544 metres and two crossings, Industry → Meadow → Industry, on foot. A further look-away/return crossed a render-origin boundary. Saving, returning to the Sphere and revisiting the saved place restored the exact six pose fields. The retired scene reported all tracked buffers, arrays, programs, shaders, textures and queries at zero, with no pending frames/listeners and both worker and renderer disposed. This is tracked cleanup; it does not establish complete browser heap or driver retirement.

## What is bounded and reused

Static bounds scan each complete actual vertex buffer once per packet identity. Industry's proximity radii are not used as geometry bounds: the yard's original 72 m proximity radius is smaller than its actual geometry extent. The moving envelope is derived analytically from the pinned recipe: full rotating-arm circles and pipe radii, every route segment for both routing states, basin transition extremes and the valve's full permitted circle. Scale, all six orientations, geography, height and float32 rounding are included. Unknown or malformed inputs remain eligible to draw.

The camera test follows the actual mesh projection and rebasing operations, with a two-pixel guard and a conservative rounding allowance using the separate shader terms. It adds no new far limit or aggressive near cutoff. Edge/intersecting bounds remain eligible. The exact pose, viewport and render-origin values reuse the view result; changed dependencies invalidate it.

All twelve original middle/far fallback batches remain ready for immediate turns. The same four proximity-selected detailed zones still prepare; visible work is ordered first without changing the selected set or cancelling a turn-time job. Detailed uploads and origin copies wait until visible. Hidden unchanged batches can remain resident within the existing limit; replacement retires an obsolete hidden packet. Moving geometry waits while its full envelope is outside view, then uses the latest simulation snapshot when visible again. It also reuses an unchanged process/routing/transition image.

These bounds govern this perspective display only. They do not suppress simulation, collision, support, exports, panorama or required off-camera shadow contributors. No content, density, strict overlap rule or existing acceptance limit was reduced. Backface culling and occlusion queries were not introduced.

## Verification and practical result

- Source controls pass five groups: 1,080 static recipe/LOD cases (12,744,288 vertices); 2,208 sampled motion states supplement the analytic envelope; 621 rejected-geometry cases checked by an independent float32 triangle-clipping oracle; view invalidation, hidden/return, origin/replacement, bounded repeated retirement and save compatibility. Samples alone are not the motion-envelope proof.
- Three preparation controls pass using the actual worker queue: visible-first order, unchanged four-zone residency, no cancellation/generation churn on a turn, eventual hidden preparation and disposal. Four opt-in comparison controls pass.
- The 61 standard Observatory processes, 19 Industry checks and 16 Meadow pack checks pass. The Meadow test's minimal document stub and obsolete standalone-route assertions were corrected for the existing public shared-world route. The checkpoint's earlier failed attempt is retained in its original records.
- In current native source, two stationary hidden observations were 313.4403 simulation seconds apart. Motion-build count stayed 793; Industry uploads, static/moving triangles and draws were zero. The process/wind clock advanced from 443.378 to 756.8183 seconds. Looking back displayed current animation and detail. Normal visits perform no diagnostic GL readback.
- The public walk's tracked GPU buffer peak was 11,421,612 bytes, below the unchanged 24 MiB buffer cap. This is the tracked buffer total, not total driver memory or browser heap. Startup fallback construction and the complete graphics preparation/draw CPU interval are reported; worker build costs remain separately recorded. No quiet matched timing improvement is claimed.

The optional `industryComparison=1` diagnostic captures raw pixels after the ordinary combined draw, under the same scene fingerprint; it is absent from normal visits. Exact image equality has **not passed**. Matched on/off captures differed in a small number of channels by one 8-bit level. Repeating the same culling mode also produced such differences (ten pixels in one retained control). These observations do not prove that culling caused the differences, and they do not waive any exact-image gate. Earlier browser screenshots were JPEG-encoded and are not lossless pixel evidence.

## Evidence and remaining work

The compact versioned [verification record](../analysis/industry-display-2026-10-20/verification.json) pins the source and retained records. Raw captures and test artifacts remain locally at `I:/Sphere/work/industry-camera-preparation-2026-10-21T01-00-00`; the final preview is `industry-display-preview-13.jpg`. Earlier attempts are retained. This evidence supplies no native context-loss/recovery, complete heap/driver peak or quiet performance acceptance.

Main's service chain remains separate. A fresh sealed preflight correction (`closed-command-preflight-01/review-source-02`) now checks the complete additive minimum before entering the command; it still refuses. The unadmitted provisional schedule needs at least 4,184 units before its existing prefix under the original 4,096 limit. That corrects the older Root-local 2,848 quote; neither quote is a selected tariff or evidence of impossibility. The next work is to derive the real source-owned operation contract, remove genuinely repeated preparation through authenticated reuse, and enter the complete native chain with all required checks and ownership intact. Industry's functional result does not close those gates.
