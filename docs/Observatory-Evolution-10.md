# Observatory 1.0 — designed shell and field expeditions

Implemented 10 September 2026 in the local WebGL Observatory. These are provisional visual studies. They do not amend the separate Sphere world canon or Unreal implementation contract.

## What changed

The new default geography has one freely oriented design axis. Three habitat ribbons occupy a waist, initially ±20°. Unequal provinces deliberately arrange the ten biome families. Thermal routing, air/water works, and fabrication/repair districts occupy the supporting regions. Opposing polar caps contain entry complexes with nested service zones; both have inspectable courts.

The Ruin retains its own image-derived colour. The broad brown overlays from the earlier shader no longer replace its appearance. Far materials and the first-bounce estimate use measured linear-sRGB means of the original imagery. Continental colour structure and engineering districts resolve above the original close texture scales. Boundaries blend into interlocking natural patches or engineering parcels. The transition width is saved in kilometres.

Five new original engineering images cover three machinery families and both Shade faces. Three original exterior images provide distant breach spill, a graveyard, and a contested approach. Actual nearby shell fragments, trusses, and simple automated hulls add parallax. The contested scene has prescribed patrol motion and intermittent flashes.

The five damaged surviving Shades use three fracture families. Their visible mask and finite-star occlusion use the same recipe on CPU and GPU. Local inspection sections add deck plates, exposed beams, columns, missing modules and detached fragments. The intact era restores an opaque service section. The two faces have different materials: star-facing collection skin and shell-facing service skin.

Wounds gain local, layered edge meshes with an adjustable thickness, initially 12 km. The top follows the existing analytic opening rather than a separately drawn silhouette. Selecting a location near a Wound keeps that location and adds edge context. Selecting empty space with **See surface** finds the nearest exact rim. The **Wound edge** expedition places the observer over the opening to see the cross-section. From solid ground, one normally sees the lip; the face below it may be geometrically hidden.

Each biome has a deterministic terrain sample, 2.4 km across. Ground triangles, local heights and obstacle data share one source. Walking has a 1.7 m eye height, 2.8 m/s normal speed, 6 m/s running, jumping, obstacle/ceiling collisions and a bounded exploration area. These are an initial procedural geometry pass, not production-quality biome worlds. Entry courts are also walkable. The Ruin sample becomes machinery when its current viewpoint is switched to the intact era.

## Controls

- **World → Shell geography:** layout version, axis, waist width, transition width, provisional shell thickness, local geometry and exterior setting.
- **Explore → Field expeditions:** select a biome, entry, Wound, Shade, or exterior; inspect it or enter a supported walking site. Wound and exterior inspections meter camera exposure for their subject. Return restores the previous view.
- **Light → Local weather:** enable clouds and set coverage. Existing Atmosphere strength controls haze and cloud optical strength.
- **On foot:** W/A/S/D, Shift to run, Space to jump, drag to look. Return to flight raises the camera above the site.
- **Capture:** photographs, scene files and nearby panoramas include local geometry. Panoramas assemble six perspective faces using a shared work budget.

Legacy scenes without a layout version restore version 1. Their shader remains available as a separate program. New state includes geography, site anchors, local walking position and vertical velocity, weather, and exterior selection. The generated source art loads locally; no runtime AI or external service is required.

## Scale and rendering

CPU world positions use doubles. Mesh vertices use small local coordinates; their origins are subtracted from the camera before upload. The analytic pass and geometry pass write the same logarithmic ray-distance depth. Local geometry is tested against the shell, Shades and star. Field sites use a 1,024-square depth shadow map. Ray picking traverses a mesh bounding-volume hierarchy.

Close Shade intersections retain their radial clearance and plane distance separately. This avoids subtracting nearly equal astronomical radii to recover hundreds of metres. Their small texture coordinates are likewise computed from CPU anchors and local derivatives. The inspector substitutes its local section into the matching area of the analytic plate.

The new geography uses range-reduced inverse trigonometry in GLSL. Native inverse-trig approximations on the tested ANGLE backend produced visible differences in narrow transition blends even with highp floats. The revised implementation agrees with CPU material weights to the tested image-quantization tolerance.

Engineering images describe six-kilometre source districts. Stochastic cropping changes the footprint of a repeated patch; this is illustrative engineering material, not surveyed equipment dimensions. Construction grids, local vertices, terrain heights, walking speed, Wound thickness and camera position have explicit kilometre/metre scales. The ground view adds finer procedural material beneath the aerial imagery.

Weather is a finite, depth-clipped local optical approximation: forest cumulus, jungle thunderheads, lofted dust, ice fog, Ruin ash, condensation plumes, marsh vapour, marine cumulus, luminous spores and violet aerosols. It follows the current biome and simulation time. Clouds do not fill the cavity or overlay closer objects. Contained habitat air stops at Wounds, using a local tangent plane near the exact rim. This is not a cloud microphysics or climate model. The cloud pass requires floating-point colour-buffer support.

## Physics and limits

At one AU the star-to-shell light time is approximately 499.005 seconds. The maintained Shade circuits are 8, 9 and 10 days. Passive circular orbits around a solar-mass star at the same radii would take approximately 178.3, 232.5 and 291.3 days. The in-app guide calculates these comparisons at the selected radius.

Artificial gravity, structural support, atmospheric containment and Shade propulsion remain assumptions. The local walking acceleration is an explicitly assumed 9.81 m/s² toward the supporting surface. Thermal fields route energy toward heat rejection; interior machinery alone is not a solution to the Sphere's heat balance.

A centimetre tolerance prevents floating-point rounding from making an on-shell receiver shadow itself. From outside, a ray entering a Wound continues to the far wall. The opaque outer skin receives no direct central-star illumination; its faint external fill is illustrative.

Lighting remains instantaneous. First-bounce light uses 192 macro samples with an artistic strength control, not a converged radiosity solution. There is no orbital evolution, tactical combat, damage propagation, atmospheric escape, mirror-delivered daylight, or materials-strength simulation. Exterior imagery is a distant illustrative backdrop; only nearby geometry has measurable parallax and ray distances. Local sites are bounded samples; the astronomical surface has not been generated at walking resolution.

## Technique research

[Star Agent](https://github.com/AvonMexicola/star-agent) was inspected at commit `46fdc5cd25f7440a8d8634ced6c238b3b9a2461c` on `dev/all-features`. Useful principles were camera-local geometry, deterministic terrain shared with collision, and compositing clouds against depth. Those principles informed this implementation. No source code, shaders, models, textures or other content from that project were incorporated. Its general planetary streaming/LOD engine was not adopted; these sites use bounded geometry and resource caches.

## Verification

`npm test` includes the existing geometry, measurement, Shade and lighting checks plus the new versioned-world tests. These cover oriented coordinates and poles, every biome destination, exact Wound boundaries and sub-metre nearest-rim queries, exterior shell occlusion, terrain rays, walking/jumping and scene restoration.

`tests/evolution-browser.cjs` checks CPU/GPU geography, renders all 19 destinations, exercises walking and actual keyboard controls, compares weather on/off, and captures a local panorama. It also verifies that the empty side of a Wound remains clear of contained air, and that Surface lands at the nearest rim and restores the original viewpoint. It writes inspection images and a machine-readable report under `work/screenshots/`. Browser tests run sequentially to avoid GPU contention.

Verified on Windows/Edge with hardware WebGL:

| Check | Result |
| --- | --- |
| `npm test` | All geometry, survey, scene, light and field-site checks passed |
| Geography | 36,864 probes; zero mismatches; maximum material-weight difference 0.002194 |
| Collection intersections | 122,880 rays; zero CPU/GPU mismatches |
| Exterior intersections | 69,120 rays; zero mismatches, including 12,170 far-wall hits through openings |
| Shade illumination | 28,350 probes; zero mismatches |
| Station shadows | 10,736 probes; all within one source sample plus 8-bit quantization |
| Expeditions | All 19 rendered without WebGL errors; walking, keyboard, restoration, Wound landing and six-face panorama checks passed |
| Linear-light resolve | 11,520 colour-channel checks; maximum error below one 8-bit step; compatibility fallback and UI grouping passed |

Station-edge results are approximate: six probes differed by about one of the 128 stellar samples. This is the finite-sampling tolerance, not exact analytic coverage.

Artwork and its prompts are recorded in `assets/evolution-art.json`. `tools/build-world-palette.py` reproduces the colour measurements without altering source images.
