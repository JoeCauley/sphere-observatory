# Observatory Collection Study 01

8 September 2026 · implemented WebGL study, provisional world design

## Scope

Extend the existing local Observatory while the Unreal project develops independently. Show an ordered collection before and after damage, with a coloured cavity-light estimate, several long wounds, cycling shades and a stellar-service structure. These dimensions are study proposals, not approved canon.

The application is copied into `the repository root`. The original application under Documents remains unchanged. Development URL: http://127.0.0.1:8766/; the earlier server at 8765 is separate. This version also opens as a local HTML file.

## Layout proposal

Three great-circle collection belts share one spherical surface. Shade routes occupy separate radial envelopes. Different inclinations provide crossings. At crossings, the nearest normalized belt centre determines the palette district; shadows from all routes combine. This is deterministic precedence, not solved habitat engineering. Some crossings would need reassignment or managed mirror light.

| Belt | Shade centre radius | Intact count | Passage cycle | Surface half-width | District count |
|---|---:|---:|---:|---:|---:|
| Verdant | 0.62 R | 8 | 24 hours | 8.88° | 24 |
| Opaline | 0.74 R | 6 | 36 hours | 6.88° | 18 |
| Amber | 0.86 R | 4 | 60 hours | 5.16° | 12 |

These districts are aggregate preservation provinces, not individual habitats or resident civilizations. Eight provisional reflectance palettes cover verdant, cyan, blue, violet, rose, amber, mineral and opaline colours. Finer variation stays within the deterministic layout. Exposed structure outside the belts is darker. Pattern seed, colour richness and degree of ordering are controls.

Disk radius is routeRadius × tan(pi / (2 × count)). For an isolated route this gives approximately half-cycle occultation of a point star at the belt centre. Finite stellar size softens edges; latitude shortens eclipses; other routes add shadows. The stated periods describe successive passages, not guaranteed global 50/50 daylight.

A shade completes a circuit in count × passageCycle: 192, 216 and 240 hours by default. These are prescribed actively maintained motions, not Keplerian orbits. Support, acceleration, structural loads and heat rejection remain engineering questions. CPU and GPU use the same positions and disk geometry.

The approved Pale Reach protective shade and mirror-delivered natural daylight remain a separate regional arrangement. Neither its mirror network nor its concealment system is implemented by this study.

## Before and after

The era switch preserves camera, time, seed and layout controls. Surviving shades retain identities and positions.

- Before: 18 intact disks, intact stellar rings, no collection wounds.
- After: six shade positions empty; of twelve surviving disks, six are fractured into disconnected silhouettes within their original planes. Independent fragment drift and tumbling are not simulated.
- Six elongated angular ellipses cut through the thin mathematical shell, with irregular boundaries and surrounding damage fields. They represent through-openings, not resolved decks or a second outer wall.
- Two stellar-service annuli and radial members surround the star. Missing sectors appear after damage. This is placeholder structure, not simulated star control or energy routing.

Matching intersections drive image occlusion, HUD targets, sampled stellar visibility and area exclusions. Original single-cap and straight-passing shade presets remain available.

## ShellShine

The new model samples 192 approximately equal-area shell points, estimates macro reflectance and direct stellar visibility, removes points in openings and averages the RGB contribution. The estimate is cached until relevant inputs change. The strength slider scales it; default 0.22 means 0.88 times the estimate.

For a perfect diffuse spherical cavity, the product of the two surface incidence cosines divided by squared separation is 1 / (4 R²). First-bounce irradiance can therefore be uniform across the receiving shell despite varying source colours. Colouring this fill from the collection is a useful inexpensive improvement.

Limitations: estimated macro reflectance differs from detailed displayed material; direct visibility uses one ray per sample; small sources are undersampled; reflected-light occlusion by shades and higher bounces are omitted; structures inside the cavity do not receive a position-specific integral. Surface penumbrae use an approximation and seven samples for fractured disks. No radiative equilibrium, refraction or light-travel time is solved. The estimate may change in small steps as sample points enter shadow. Station shading, atmosphere and exposure remain approximate.

Reference: [PBRT diffuse reflection](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection). The spherical-kernel simplification follows from chord geometry, not a claim that this damaged cavity is completely solved.

## Meteor showers: next study

Atmospheric entry is the condition for luminous ablation, not simply belonging to a debris route. A close-range study needs fragment positions, velocities, sizes and an atmospheric profile, followed by approximate drag and energy deposition. Most actual meteor trails would be unresolved in the overview. No artificially enlarged meteor streaks were added.

Distinguish a fresh shower after an event from the ancient present: recurring ancient showers need an ongoing supply or specified reservoir. The era toggle currently represents two design snapshots, not elapsed-time evolution from the attack.

Reference: [NASA meteors and meteorites](https://science.nasa.gov/solar-system/meteors-meteorites/).

## Verification

- Original 13 geometry and 7 area checks pass.
- New tests cover round-trip, invalid settings, object counts, six openings, surviving identity, full route periods, unchanged region identity and light response.
- GPU and CPU classifications agree on 30,720 rays across four views and both eras: zero disagreements and no WebGL errors.
- Browser checks cover camera/time preservation, time advance and return to original studies.
- Preview retains pixel/frame caps, idle rendering and hidden-tab pause. New-version tabs coordinate preview ownership; old tabs do not. This is workload management, not a wattage cap.

Agreement validates geometric consistency, not orbital feasibility, calibrated photometry or photorealism. 4K output does not change the physical scale represented by a pixel.

## Next decisions

Review whether great-circle crossings should be intentional collection junctions or avoided through other lighting arrangements. Refine provinces into a richer hierarchy. Next bounded graphical improvements are a better filtered macro-albedo cache for ShellShine and one near-atmosphere debris study. Resolved wound decks, full mirror transport and photoreal geometry remain native-renderer work.
