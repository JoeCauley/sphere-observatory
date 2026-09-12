# Observatory 1.1 — volumes, wreckage and aligned Shades

This pass addresses the stretched exterior illustrations, cloud sampling streaks, lack of depth across the cavity, flight through solid ground, and Shade routes that missed the habitat waist.

## Try it

- Refresh the running localhost Observatory. The header should say **v1.1**.
- Under **Light → Local weather**, adjust **Cloud detail** and **Cavity haze**. Cloud coverage and local Atmosphere strength remain separate from cavity haze. Set cavity haze to zero for a clear cavity.
- Under **Explore → Field expeditions**, inspect the three **Exterior** destinations. Their larger fragments have decks, exposed structural frames, biome surfaces and machinery. Flying changes their perspective and occlusion.
- Under **World → Shell geography**, rotate the waist or change its width. The three Shade routes follow it automatically. Compare before and after the attack.
- Descend onto intact ground in free flight. The camera stops about two metres above it and retains tangential movement. A Wound remains an actual opening. Walking retains its existing terrain, movement and eye height.

## What changed

### Fleet and flight

The three modern Shade routes use latitude centres at −2/3, 0 and +2/3 of the habitat half-width, measured in the waist's own coordinate frame. Their radii remain 0.62, 0.74 and 0.86 of the shell radius. Cross-track dimensions fit inside their respective ribbons, with margins at the corners. Changing the axis and width invalidates the route, inspection, lighting and geometry caches. Wound silhouettes also use the range-reduced inverse trigonometry already used by biome borders, fixing a CPU/GPU opening disagreement revealed by the new fleet viewpoint.

These are actively maintained small-circle routes. They are not passive orbital solutions. The displayed route speeds now use the small-circle circumference; the solar-mass Kepler periods remain comparisons at the same star-centred radii. Legacy layout 1 retains its original intersecting routes and shapes.

Free flight tests the whole movement segment, including both shell crossings. It checks Shade surfaces and local triangle geometry, stops before contact, and projects remaining movement along the surface. A long segment entering through a Wound still stops at an intact opposite wall. This is camera collision and sliding, not rigid-body dynamics or spacecraft navigation. Local triangle contact uses the camera centre ray with a clearance allowance; it is not a full swept-sphere solver around every tiny edge.

### Weather and depth

The previous 14 evenly spaced cloud samples could span hundreds of kilometres. The replacement uses an original periodic 64³ RGBA density volume, continuous value and cellular noise, warped cloud envelopes, erosion, four light samples for self-shadowing, and exponential extinction integrated along the visible ray. Wind stays anchored in world coordinates. Changing detail no longer changes the multiple-scattering fill merely by changing the step size.

| Detail | Maximum view samples |
|---|---:|
| Light | 48 |
| Balanced | 80 |
| Fine | 128 |
| Photograph | At least 112; Fine retains 128 |

The atmosphere pass writes scattering and transmission separately at reduced resolution. A depth-aware reconstruction combines them with the full-resolution scene before exposure and tone mapping. It does not blur the original scene colour. The 3D texture uses mipmaps; long shallow rays have bounded spacing, and unresolved distant clouds fade into local air. Deterministic spatial jitter avoids visible slices without temporal ghosting or random changes between still captures.

The local atmosphere is bounded to the lower 32 km and evaluated from nearby viewpoints, with the existing Wound containment approximation. **Cavity haze** adds a separate, extremely thin illustrative dust column inside the cavity. Its optical depth depends on distance divided by shell radius and stops at the visible object or the cavity boundary. It does not fog external vacuum. This parameter is an artistic physical assumption, not a measured interplanetary dust density.

The cloud model is still approximate: no converged multiple scattering, full cloud-to-ground shadow field, atmosphere escape, refraction, or climate simulation. It is a local weather study rather than a globally streamed cloud field. Fine wisps can remain soft. Floating-point colour render targets are required for this path; the existing compatibility renderer remains available on other devices.

### Exterior clarity

The former exterior source plates have fewer than 1,800 pixels across 360°. At an 85° view, less than 430 source pixels cover the horizontal image. A 4K viewport magnifies those pixels roughly nine times. Upsampling cannot reconstruct the missing structure.

The large painted objects have been replaced by original dimensional assemblies. The nearest landmark is an 18 km shell fragment. Other pieces show both inhabited surfaces and supporting structure; nearby hulls have modules, ribs and drives. Approximately 1,400 distant pieces add parallax over a volume about 4,600 km in radius. The three exterior studies render roughly 47,000–56,000 triangles in one or two groups. Directional, analytically filtered flecks supply the remote background beyond that local volume.

The original three illustrations remain in `assets/space/` as an art archive. They are no longer sampled by the sky shader or uploaded to the GPU, saving approximately 32 MiB including their mip chains. No larger background download or external runtime service was added. Exterior fleet motion remains an authored illustration of the setting, not a combat or long-term debris simulation.

## Performance and verification

The local geometry shader and full cloud shader are compiled when first needed, so the initial overview does not compile both large graphs. Geometry and atmosphere share the renderer's frame lighting estimate; live cloud rendering does not force a new exact 192-region bounce calculation every frame. Still captures retain exact frame lighting.

On the tested RTX 5080 / Edge ANGLE D3D11 setup, a dense jungle cloud scene at 1280 × 720 output, with a 1920 × 1080 internal scene and 960 × 540 atmosphere buffer, measured median GPU times of **4.69 / 4.90 / 5.20 ms** for Light / Balanced / Fine. Native 3840 × 2160 photographs (internally sampled at 7680 × 4320) also passed: measured GPU work was about 35 ms for the exterior, 62 ms for clouds and 65 ms for the fleet overview. PNG capture including readback took about 177–269 ms after warm-up. The tested cold overview load still took about 29 seconds, so first-load shader compilation remains a noticeable limitation. These are whole-frame GPU measurements from particular scenes, not universal frame-rate guarantees. Other views, 4K output, browser scheduling and hardware change the cost.

Regression checks also passed 122,880 object rays, 69,120 exterior rays (including 11,495 far-wall hits), and 28,350 legacy Shade-light probes with zero mismatches. Station integration remained within its one-sample tolerance.

Checks include:

- 17,496 Shade footprint probes across axes, waist widths and times; conservative all-cycle separation of neighboring Shades and radial layers.
- Continuous collision from inside and outside, Wound exit and entry, an opposite-wall crossing, repeated close Shade contact, ground sliding and local terrain landing.
- Actual keyboard descent stops at approximately 2 m; the same motion through a Wound enters exterior space.
- 18,432 modern fleet penumbra probes. Four differed by one of 19 stellar samples between CPU doubles and GPU floats; none exceeded one sample plus 8-bit output rounding. Fully lit, dark and partial cases were exercised.
- All 19 field destinations, walking and jumping, saved-state restoration, selected Wound landing and return, local panoramas, and Wound air containment.
- Ordinary exterior exploration loads every required biome texture without capture preloading. Live volume and geometry frames preserve asynchronous bounce updates.
- Cloud off/on, wind movement, quality settings and scene round-trip. Repeated identical cloud captures were pixel-identical in the tested renderer.
- Cavity haze changes interior views and leaves outward-facing exterior vacuum unchanged.

Run `npm test` for CPU checks. The focused browser checks are in `tests/focus-browser.cjs`; the existing collection, exterior, lighting, station, evolution and colour-resolve suites provide broader regression coverage. Browser tests run sequentially. Inspection images and measured reports are written under the ignored `work/screenshots/` directory.

Scene files now identify Observatory 1.1. Old layout-2 scenes acquire the new aligned fleet and default weather settings when loaded, so their images can differ from 1.0. Layout-1 scenes retain their legacy rendering. Keep the application version with archived captures when exact reproduction matters.

## Technique references

WebGL2's [3D texture API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texImage3D) supports the sampled density field. The [Nubis 2017 presentation](https://advances.realtimerendering.com/s2017/index.html) describes the broader practice of combining density structure, ray marching and controlled sampling budgets for real-time clouds. These informed the approach; this implementation and its procedural models are original. It does not incorporate game assets, shaders or other content from Star Agent.
