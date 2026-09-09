# Observatory visual quality study 05

Status: implemented v0.5, 8 September 2026. These are provisional Builder engineering choices, not additions to settled canon.

## Trimmed spherical shades

The new trimmed shape starts with the existing spherical cap at its route radius. Two planes parallel to instantaneous travel cut away its cross-route sides. In projection from the star the sides are straight and the leading/trailing ends rounded. A plane intersecting a sphere produces a curved edge in three dimensions; these are not straight Euclidean edges laid on a curved surface.

The width control is the fraction of the original tangent-projected half-width retained on each side, default 0.65 and range 0.25–1. The centreline length and passage timing remain unchanged. Off-centre light coverage changes, including removal of some inter-route eclipses. This is a design control rather than proof of optimal mass or climate performance.

The trimmed shape is a subset of the existing cap. The conservative all-phase collision bounds in Observatory-Shade-Standard-01 therefore still apply. The paths are prescribed and actively controlled, not gravitational orbits. Thickness, stray debris and changing trajectories are outside that proof.

All shapes retain the same kilometre-based construction hierarchy and filtered detail. CPU picking, area measurement and GPU intersections use the same trim rule. Old scene files default to their original disk and seven-sample settings.

## Antialiasing and shadows

The scene is ray-intersected inside a fullscreen fragment shader. Conventional triangle-edge multisampling alone would not smooth those internal silhouettes. The new option instead traces a larger image and downsamples it through a WebGL2 framebuffer blit.

The maximum scale is two per dimension: four rays per displayed pixel at that scale. Preview sampling stays within 1920 × 1080 internal pixels under the existing UI output cap. Thus a full-budget preview has no extra supersampling headroom. Export can use up to 33,177,600 internal pixels and the GPU renderbuffer dimension limit. A 3840 × 2160 photo can render at 7680 × 4320. The metadata reports actual dimensions. Fractional scale factors use bilinear filtering rather than an exact box integral. Diagnostic picking/light views remain unfiltered.

The present buffer is RGBA8 after tone mapping. Averaging this display colour improves edges but is not radiometrically correct linear-light integration. Output remains SDR. Increasing resolution or sample counts adds GPU work; frame and pixel budgets do not enforce a motherboard or GPU watt limit.

Direct shade shadows offer seven or nineteen samples of the stellar disk, with shared sample masks and receiver self-exclusion. Nineteen gives finer penumbra steps but does not constitute converged integration. ShellShine remains the earlier approximate one-bounce macro-albedo estimate.

## Verification

- 122,880 CPU/GPU geometry rays across four shapes: zero disagreements.
- 28,350 sun-facing shade-light probes across four shapes, three times and both sample counts: zero disagreements at output quantization tolerance.
- Binary-silhouette four-ray antialiasing comparison: 129 partial-coverage pixels, zero disagreements.
- Preview budget, export scaling and disabled-AA checks passed without WebGL errors.
- Analytic clearance inequalities, trimmed side rejection, retained leading/trailing extent and setting validation passed. The original off-belt eclipse fixture correctly becomes clear when its blocker is trimmed.

These checks establish consistency of implemented geometry and sampling, not a comprehensive physical validation. Browser draw submission timing is not a GPU benchmark.

## Next graphics work, in priority order

1. Linear floating-point radiance accumulation, followed by exposure and tone mapping once. This makes antialiasing and subsequent glare behave better around the star and bright rims. Support must be checked on the actual WebGL backend.
2. A restrained camera glare/bloom model with an explicit exposure control. Keep the true geometric stellar disk distinct from optical glare; never enlarge the star to create drama.
3. Directional, spatially varying cavity fill and better atmospheric integration. The shell is an enormous coloured light source; correct variation can improve depth more than adding decorative texture. Start with measurable reference scenes and bounded sample budgets.
4. Structured wound margins and shade edge thickness, using a small local detail domain when the camera is close enough to resolve them. Global metre-scale geometry is unnecessary. Decks, beams and torn laminations should follow an agreed construction design.
5. Deterministic frame-by-frame cinematic export with high sample accumulation. Current browser video recording is real-time and can fall behind; offline frame rendering should decouple image quality from playback speed.

Each stage should retain an interactive low-cost preview and a deliberate expensive capture mode. Unreal remains the stronger destination for resolved landscapes, dense geometry and production cinematography. The Observatory can continue to serve as a scale, illumination and composition instrument alongside it.
