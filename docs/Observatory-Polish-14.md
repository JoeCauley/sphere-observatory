# Observatory 1.4 — continuous air and Shade silhouette sampling

September 11, 2026

This pass addresses the stepped atmosphere fan at the Wound edge and the visibly aliased distant Shade outlines. Local Wound and Shade geometry, materials, shadows and navigation remain the foundation.

## Air at the Wound

The weather was already a three-dimensional density volume. The visible fan came from twelve air samples switching across a narrow containment boundary: a tiny camera movement could add or remove a long segment of haze at once.

The renderer now intersects each ray with curved atmospheric height bands and clips the resulting intervals against the local Wound containment boundary before integrating the air. Stable sphere roots and a rationalized altitude calculation retain small heights at astronomical coordinates. Grazing rays can have two valid intervals; both are retained. Eight-node Gaussian quadrature integrates the smooth exponential air profile, and cloud steps use two-node air integration within their already clipped intervals. Cloud density still uses the existing three-dimensional weather field.

This removes the sampled fan without blurring the exposed wall or filling the opening with fog. It is still a local optical model. The containment boundary uses the nearest rim's tangent half-space; it does not model atmospheric escape or follow every distant bend of the Wound. Cloud banks retain authored altitude ranges and a bounded marching distance. Full multiple scattering and cloud shadows on the world are future work.

## Why the Shades needed different antialiasing

The distant fleet is rendered by analytic ray intersections. Its boundaries and fractures can fall between the centre rays of adjacent pixels, even though their shapes are mathematically continuous. A final image filter can soften that staircase but cannot recover missing coverage reliably. The local edge triangles are generated for the inspected Shade, not for every Shade in the fleet. They are not the cause of the distant silhouette problem.

**Smooth edges** now detects pixels near analytic Shade boundaries using conservative projected shape margins. It renders eight fixed subpixel primary rays there and accumulates their radiance before exposure and tone mapping. Other pixels retain their centre sample. The final contrast filter and resolution-budgeted supersampling remain available. Stellar visibility sampling and the geometry used for eclipse calculations are unchanged.

The rays reuse the same shader in masked passes. Whole derivative quads remain active while computing materials, which avoids texture and normal discontinuities at a mask boundary. The mask is detached from the framebuffer before it is sampled. There is no temporal history, so this method cannot leave history trails behind a moving Shade. It also does not eliminate every form of motion shimmer: eight samples are finite, and nearby triangle edges and atmospheric composition still use a centre-sampled geometric depth.

Use **Light → Preview quality & performance → Antialiasing**, or **Flight console → Edge smoothing** in fullscreen. Existing scenes keep their selected mode. Smooth edges enables the new treatment; Supersampling only and Off remain useful comparisons.

## Saving settings between sessions

Settings now save automatically in the same browser and local-server origin. The saved record includes the validated world and rendering state, camera pose, inspection attachment, walking position, simulation time and rate. Reopening restores the scene paused. Preview frame limit, adaptive preview, photograph size, destination choices, the selected control tab and expanded sections are also retained. The existing Space play/pause shortcut is unchanged; it remains Jump on foot.

A versioned, size-bounded record is stored locally. Changes are coalesced instead of writing on every frame, with a final flush on navigation or hiding the page. Inactive cooperating tabs and temporary capture states do not overwrite the saved session. Invalid records fall back to the normal initial view; storage failures produce a visible message and can recover when storage becomes available. Bookmarks remain separate, and exported scenes remain the portable option across browsers or server addresses.

The first refresh from an older version cannot recover settings that version never saved: use Capture → Save scene before that refresh if the current view should be retained, then import it into 1.4.

## Verification and cost

- `tests/polish-browser.cjs` compares air columns with double-precision sphere/half-space clipping and dense midpoint integration. Across 10,240 rays at radii of 10 million km, one AU and one billion km, the largest absolute optical-depth error was below 0.00001. All 3,711 reference vacuum rays stayed exactly clear.
- The same test compares twelve Shade views — four shapes and three damage families — against a 16 × 16 reference grid per output pixel. The eight-sample treatment reduced squared coverage error by approximately 92–94%. The reference contains 21,233,664 rays in total. This measures silhouette coverage, not the accuracy of materials or illumination.
- Representative warm 1600 × 900 previews on the test RTX 5080 through Edge/ANGLE D3D11 measured approximately 2.1 ms GPU time at the default Wound inspection and 9.2 ms at the default Shade inspection with Smooth edges. Off measured about 1.8 ms and 5.1 ms respectively. These are sampled GPU timings on one machine, not total frame times or a performance guarantee. Initial shader compilation and new geometry generation take additional time.
- The mask uses one R8 texel per internal pixel: about 1.37 MiB at 1600 × 900, or 31.64 MiB for a 4K photograph rendered internally at 2× on each axis. It is reused and resized with the radiance buffer. Eight masked passes add bandwidth as well as shading cost; the extra shading is concentrated near silhouettes, but mask lookups still cover the frame.

`npm test`, the weather/collision suite, 505,728 close-boundary classification rays, moving Shade attachment, fullscreen controls and linear-light/fallback checks pass. `tests/session-browser.cjs` closes and restarts a persistent browser profile, verifying restored camera, time, world and UI preferences; it also checks the existing Space shortcut and an immediate-navigation save.

Native 3840 × 2160 captures rendered internally at 7680 × 4320 pass, as does a six-face Shade panorama. The actual photograph ZIP path was checked twice at 4K: its PNGs match exactly after priming. Storage-full feedback and subsequent recovery also pass.

The first raw 4K Wound draw showed a small first-use discrepancy: 57,108 of 8,294,400 output pixels differed on the next draw, mostly by one 8-bit code value; the maximum channel difference was 15. Repeated subsequent frames matched exactly. Instrumented checks found identical primary uniforms and tracked render states, and rebuilding the shadow maps after warming did not reproduce it; the precise backend cause remains unisolated. Photograph export now renders the fixed scene once at its final resolution before rendering the encoded frame, as video capture already did. This adds one rendering pass to still capture. It does not change simulation time or introduce temporal blending. Exact cross-device or cold-render byte identity is not claimed.

`tools/capture-polish.cjs` creates matching Wound and Shade views. `tools/review-polish.cjs` produces a local before/after divider with zoom. `work/screenshots/polish/verification.json` records numerical results and timings. Capture and UI checks are recorded separately from live GPU measurements.

During final release packaging, one fresh-copy 4K export check failed PNG byte identity despite priming. The subsequent instrumented browser run produced identical PNGs with no WebGL errors. The first failure did not retain its images, so its pixel difference cannot be quantified; intermittent first-use export identity remains unresolved. The capture test now saves both PNGs, both scene records and decoded pixel-difference statistics on failure. Priming improves repeatability but is not a guarantee of identical first-use output.

## Biome-specific Wound damage

Ten unique generated albedos now cover damaged ground adjoining each biome. Forest roots, jungle remains, sand, fractured ice, barren Ruin, machinery, rust sediment, chalk, cyan fungal networks and violet crystal debris have separate compositions. The original Ruin image is retained away from Wounds.

The former abrupt reassignment to biome 4 is replaced by a smooth 240 km damage envelope on surviving ground. It reaches the full dedicated edge material at the lip. Distance comes from the Wound's implicit boundary divided by its surface gradient; close rendering evaluates the margin incrementally about the exact CPU rim, as shell clipping does. This avoids subtracting nearly equal AU-sized values. The local gradient is evaluated at the receiver, so changing the camera anchor does not change the intended damage field. The conversion is an approximation to shortest surface distance, not a damage-physics simulation.

The image colour is blended in linear light. Close views use native 1254-square artwork, stochastic triplanar sampling, anisotropic filtering and linear-light mipmaps at a 640 m sampling scale. Distant views use the images' measured linear means. The upper 40 m of the exposed wall blend into the matching deposit; deeper wall strata retain their existing structural materials. Openings remain empty. Before-attack and Wounds-disabled scenes have no Wound damage layer.

The texture array reserves about 80 MiB when first needed; preview only decodes nearby biome images. Close capture prepares all ten layers. This is selective image loading, not full GPU-layer eviction. [Artwork, scale notes and prompts](../assets/wound-edges/README.md) describe the source assets and remaining material limits. No new walkable terrain or collision detail was created by these albedo images.

`tests/wound-materials.cjs` checks 7,200 biome/damage cases, including six Wounds, three shell radii, tips, sides, fixed world coordinates, monotonic progression and inactive damage states. `tests/wound-materials-browser.cjs` compares 13,824 GPU samples with the CPU field, checks adjoining biome IDs, loads all ten maps and captures matching progression views. The maximum GPU/CPU damage-weight difference was 0.00000161, with signed-distance disagreement below 0.385 m; all sampled adjoining biome IDs matched. These compare the shared distance approximation, not a full impact model. The local review is `work/screenshots/wound-materials/review.html`.

After integrating these materials, the full CPU suite passed again, as did 505,728 Wound/Shade classification rays with zero mismatches, moving-frame/fullscreen checks, air integration and the Shade coverage reference. Representative warm Smooth-edges GPU samples were about 2.5 ms at the Wound and 9.7 ms at the Shade on the same test machine; cold loading and geometry construction are excluded. Two actual 4K photograph ZIP exports again contained identical PNGs. The comparison gallery contains 23 rendered views, with all images loading and no horizontal page overflow at the tested 1600-pixel width.

## Next priorities

1. Generate geometry in a worker and upload it in bounded batches, reducing the pause after a large jump into an uncached area.
2. Add cloud shadows and better distant cloud lighting to connect the atmosphere to the surface beneath it.
3. Expand the local structural vocabulary with bent panels, varied fracture sections and cables, retaining the same world-addressed streaming scheme.

Temporal reconstruction and irradiance probes remain possible larger projects, each requiring explicit handling of moving Shades, disocclusion and the enormous distance range. WebGL2 is still usable for these improvements; available frame time, memory and precision are the practical constraints.

The requested Wound navigation choices, researched shell layout and missing Shade wreckage remain in [the durable queue](Observatory-Queue.md). The ten unique Wound-edge materials and progressive damage are part of this delivery.

## Technique references

The implementation is original. The general reasoning follows the pixel-area sampling principles in [PBRT: Sampling and Reconstruction](https://pbr-book.org/4ed/Sampling_and_Reconstruction) and the integrated extinction and segment composition described in [PBRT: Transmittance](https://pbr-book.org/4ed/Volume_Scattering/Transmittance). This renderer uses deterministic bounded approximations, not PBRT's full volume transport algorithms.
