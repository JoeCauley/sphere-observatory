# Watershed trio 1 — joined regional compositions

14 September 2026. Bounded first slice of roadmap item 6.

## Design and implementation

Three compositions share the existing receiving network: silver-green shores
around the receiving lake, a darker wooded quiet reach, and golden-green open
meadow alongside it. Unequal elliptical districts overlap and blend rather
than forming rectangular tiles. Their orientation comes from the receiving
river's tangent. Irregular planting patches follow that orientation; shore colour follows
the same water-distance calculation that renders the river and basin.

The original 640 km garden, all outlet coordinates, water widths, routes,
terrain heights and collision remain geography revision 1. This slice changes
regional surface materials, not hydrology or terrain. The district assignment
is deterministic for the saved seed and coordinates; eviction, clock changes
and travel do not choose it again. New procedural material variation filters
to its mean as its features become smaller than a pixel. No image, texture
array, new mesh type or external dependency is added. The three district
records add 192 numeric bytes per cached graph; their GPU parameters use six
`vec4` uniforms.

The renderer uses the same `packMaterial` function on the analytic shell and
existing ground triangles. Atmosphere continues to receive their shared depth.
CPU district weights and GPU district weights use the same saved centres,
orientation, extents and normalized overlap. The original garden is protected
by a zero-weight inner region, with a smooth transition outside it.

## Use and compatibility

- In **Explore → Places → Watersheds**, choose **Receiving lake**, **Quiet
  reach**, or **Open meadow** for a dry bank/field arrival, or the existing
  cloud and atmosphere arrival options.
- The **Landscape view** arrival option for these three Places offers
  oblique regional views. Return restores the prior view.
- New pack entry selects art revision 2. Existing art-revision-1 scenes retain
  revision 1 when opened or revisited. Explicitly choosing a new composition
  opts that scene into revision 2 while retaining its seed and anchor.
- Portable scenes and browser sessions retain the chosen art revision. No
  background session migration is added. Time, Play/Pause and manual speed
  remain user-owned. The [ground material correction](Observatory-Ground-Material-01.md)
  applies to both art revisions; retaining art 1 does not retain that bug.

## Validation

`npm test` includes `tests/watershed-trio.cjs`. Its cases cover 19,635 blend
samples across seven seeds, smooth boundaries, overlapping districts,
deterministic eviction, dry arrivals, actual walking, preserved garden
geometry, old art selection and saved-address round trips.

`tests/watershed-trio-browser.cjs` checks live CPU/GPU district agreement,
paired art-1/art-2 compositions, seven altitude levels in clear and cloudy
conditions, dry arrivals, walking at district boundaries, frame costs,
pending uploads and residency. Screenshots and machine-readable observations
are written to `work/screenshots/watershed-trio/`.

The final trio run passes **483 CPU/GPU blend probes**, **42 clear/cloudy
altitude views**, three 14 m walking arrivals and three outward/return walks
across district edges. Maximum offset from the nominal 1.7 m eye height at the edges is **20.1 mm**,
including the existing controller's 20 mm support clearance.
The UI test passes all three Landscape view selections, exact returns to the
art-1 scene, three ground arrivals and preserved clock/manual speed. The full
numerical command passes **32 suites**; the new trio suite was rerun after the
live Places integration.

See the [browser report](evidence/watershed-trio-01/report.json),
[UI report](evidence/watershed-trio-01/ui-report.json),
[lake before](../examples/archive/pre-v1.5/docs/evidence/watershed-trio-01/lake-art1.png),
[lake after](../examples/archive/pre-v1.5/docs/evidence/watershed-trio-01/lake-art2.png),
[quiet reach](../examples/archive/pre-v1.5/docs/evidence/watershed-trio-01/reach-art2.png) and
[meadow](../examples/archive/pre-v1.5/docs/evidence/watershed-trio-01/meadow-art2.png). Visual inspection confirms
distinct regional palettes, irregular planting and gradual joins; the
watercourses retain their existing analytic shapes. The close views remain
largely flat surfaces, as the bounds below describe.

The final fixed-view draw/finish calls at 1200 × 675 measured median **0.5 ms**,
p95 **1.8 ms**, maximum **4.9 ms** after preparation. Browser opening took
**75.6 s**. These are fixed-view measurements, not continuous-flight or cold
frame guarantees. The retained view has one 24,560-byte numeric graph, no
pack texture allocation, 38.84 MiB of province vertices, 26.20 MiB of packed
collision and zero pending uploads. The previously open Shade cold-4K-repeat
diagnostic remains separate; these checks do not certify its resolution.

The unchanged neighbourhood regression also passes **228 CPU/GPU water probes**,
bank landings and residency checks. Its paired **3840 × 2160 photographs** and
**3840 × 1920 panoramas** match byte-for-byte. See its
[retained report](evidence/watershed-trio-01/neighbourhood-report.json) and the
[combined verification/source receipt](evidence/watershed-trio-01/verification.json).

Replay from this repository with the local server running and the
`SPHERE_PLAYWRIGHT` / `SPHERE_BROWSER` paths from the roadmap handoff:

```powershell
npm test
node tests/watershed-trio-browser.cjs
node tests/watershed-trio-ui-browser.cjs
node tests/ground-material-browser.cjs
node tests/neighbourhood-browser.cjs
```

Run browser suites sequentially. The original neighbourhood suite retains its
strict capture equality assertions; a failure must remain a failed capture
diagnostic rather than be hidden by a looser threshold.

## Bounds and next item

This is three connected **regional material compositions**. Wooded and
reed-fringed areas are surface patterns at this stage; they do not add
individual trees, reeds, excavated channels or new raised roads. Dry local
walking uses the existing analytic support. The regional lake and rivers
remain non-swimmable surface representations. This is not nine finished
environments, an expanded global atlas or the complex geometry benchmark.

The next bounded content step is one local receiving-lake shore: register its
shoreline, planting and promenade to these same coordinates, provide matching
visible geometry and collision, and prove its transition back to the regional
surface before repeating that detail in the reach and meadow. Preserve the
current Wound, Shade-body, saved-scene and connected-ground regression gates.
