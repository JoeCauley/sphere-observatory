# Wound ground seams: first implementation

13 September 2026 · local continuation after Watershed pack 1

The user's priority is now explicit: matching seams come first. Prefer a rim
that follows the walkable terrain's height; smoothly flatten terrain into the
established rim only if necessary. This implementation uses the preferred
terrain-following approach. No flattening fallback was needed.

## Implementation

`field-sites.js` clips the local terrain triangles against the existing Wound
definition. Crossing edges are solved and snapped to the canonical contour;
shared triangle edges reuse the same intersection. The surviving top vertices
also form the top of a local wall section extending through the existing shell
strata. Ground and wall therefore share their actual uploaded seam vertices,
including the varying terrain elevation. The high-relief inspection fixture
retains approximately 44.32 m of variation along its lip.

The local wall owns that interval of the rim. `edge-stream.js` cuts the distant
rim around it and shares its complete end profiles, origin and basis. Both
coarse and fine neighbours use those exact profiles. The worker receives the
profiles from the main thread rather than trying to reconstruct terrain without
the same optional province modules. Cut addresses are part of the cache key.

`edge-streaming.js` supplies small coarse end neighbours before the worker is
ready, protects them from budget eviction while needed, and atomically replaces
them with finer sections. On departure or a patch-address change, the old local
interval receives its replacement coarse wall in the same frame. This prevents
the removed patch from leaving a temporary slit while a new worker plan builds.

The clipped floor has its own triangle-based support query. It returns no
support over the opening. Ordinary props that extend beyond the surviving ground
are removed while consuming the original random sequence, so rejecting one prop
does not reroll the remaining inland population. Ground and the local wall both
participate in the existing rendering, picking and triangle collision paths.

The surface walker can cross the real lip rather than stopping at an invisible
support boundary. Fractured ledges can still catch a fall because they are real
visible geometry. A clear fall hands control back to free flight 100 m outside
the nominal inner shell, before exceeding saved walking-position bounds.
The existing square traversal limit remains elsewhere.

## Verification

- `npm test`: the complete 22-suite numerical run passed after the initial seam
  implementation. Focused streaming/continuity checks cover the subsequent
  eviction and departure refinements.
- `tests/wound-ground.cjs`: 90 fixtures across all six Wounds, three radii
  (0.1, 1 and 2 AU), tips and both banks; 42,954 exact uploaded top seam vertex
  checks, 1,080 support probes and 57,924 prop footprint corners. Checks also
  cover preserved height variation, rim end-profile equality at 640/3840 output
  widths, coarse/fine and worker/capture parity, era/Wound toggles and walking
  into a clear fall. Maximum sampled contour-chord error is 0.0968 mm against
  a 1 mm tolerance; the sampled terrain triangle interiors stay inland.
- `tests/streaming.cjs`: delayed worker startup still supplies the local end
  profiles; synthetic pressure beyond the vertex budget preserves them. Leaving
  the local patch restores its old interval before a worker reply.
- `tests/wound-ground-browser.cjs`: six saved visual scenes (machine edge,
  varied terrain, ground approach, below the lip, tip and weather). The real
  worker script is held while the cold seam ends are inspected, then released
  and allowed to finish. Repeated 1600 × 900 views, 3840 × 2160 photographs and
  1920 × 960 six-face panoramas are compared for equality. Final verification
  also checks departure and return in the browser.
- Six existing browser regression suites passed sequentially: streaming,
  continuous flight (Mycelium Sea → cavity → Ultra Desert walking arrival),
  pointer travel, Places, both moving Shade deck faces and Watershed.

The final instrumented seam browser run passed, including cold end coverage,
real-worker completion and same-frame departure/return. One preceding run
failed the paused 1600 × 900 tip image equality check between successful runs.
Its cause is **not isolated**. The test now preserves mismatching image pairs,
scene metadata and pixel-difference measurements if it recurs, and still fails
the equality assertion. A passing retry is not recorded as a fix. The older
cold 4K issue may be related, but that has not been established.

Local views and complete scene JSON are under `work/screenshots/wound-ground/`.
Inspect [the varied terrain lip](../work/screenshots/wound-ground/varied-edge.png),
[the machinery edge](../work/screenshots/wound-ground/machine-edge.png) and
[the view from below](../work/screenshots/wound-ground/below-lip.png).
The browser report is `work/screenshots/wound-ground/verification.json`;
sequential regression results are under
`work/screenshots/neighbourhood/regressions/`. These generated files are local,
not portable release evidence; the checked-in tests recreate their scenes.

The first completed browser run drained its edge queue to zero with approximately
3.89 MiB of cached edge vertices and 6.48 MiB including collision. The configured
upload cap stayed at 4 ms. These figures exclude local terrain and other caches
and are not a total-memory or frame-rate guarantee.

## Boundaries and next work

This corrects the local biome/port patch representation at existing Wounds. It
does not redraw the Wounds, revise Watershed geography, replace the original
province terrain or provide arbitrary authored-mesh clipping. The current
2.4 km patch, 1.08 km traversal clamp and 20 km local-detail display range remain.
Departure now keeps the wall covered, but morphing local terrain relief into
the coarse surface is still part of the altitude-continuity work. Patch-to-shell
material contrast and the larger atlas remain visible in some inspection views. General connected
walking terrain and automatic intact/damaged Shade edge discovery are still
planned.

The Watershed dotted blend and atmospheric speckle have not been changed in
this step. Ground-to-atmosphere continuity is the next implementation priority.
The paired exports above do not isolate either the paused-tip mismatch or the
historical first-use cold 4K mismatch. The earlier cold-preparation/frame-interval
outliers also remain open.

Keep the seam-first rule for all future representations: share the actual
boundary geometry across render/collision/LOD/loading paths; if a terrain-following
join cannot meet that rule, blend the terrain to a reliable seam instead.
