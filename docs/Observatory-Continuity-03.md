# Surface continuity 3: weather, automatic Shade edges and connected ground

13 September 2026 · local development after v1.4.0

This continues stages C, D and the explicitly requested walking portion of E in
[the surface-continuity plan](Observatory-Surface-Continuity.md). It preserves
the revision-1 Watershed, garden, pack addresses, original terrain generators,
cloud wavelengths, travel controls and Wound seam recipes.

## Representations and compatibility

New scenes use `shadeGeometryRevision: 2` and `terrainRevision: 2`. Missing
fields in imported scenes resolve to revision 1. Existing revision-0/1 field
sites keep their height generator, objects and walking bounds. World → Shell geography selects automatic Shade edges. Camera → Field
expeditions selects the terrain used for new landings.
This deliberately does not reinterpret an old photograph as new terrain.

`siteAnchor` remains the arrival address. Revision-2 terrain has a separate
`terrainAnchor` for its working coordinate frame. Rebasing updates that frame
and walking coordinates together after replacement support is ready; it never
changes the camera's world position or the original arrival address.

## Stage C

Cloud sampling now derives its pixel footprint from the actual reduced march
resolution. Shadow samples use the primary footprint and their own step length
instead of always sampling mip level 1. Wound containment follows the shared
curved contour in camera-relative coordinates, with stable small-angle math;
the old kilometre-rounded tangent-plane update is gone. The 160 km switch keeps
the existing local/far overlap, scene-clock phase and two-thirds cloud scale.
No temporal history or new cloud art was introduced.

The province retains opaque depth through its geographic material blend. Local
terrain border normals now agree with the shell. Legacy relief retires only
when its 120 m feature bound is below the established output-pixel threshold,
rather than at a fixed 20 km distance. The geographic material graph is shared
between transition owners instead of duplicated in three shader branches.

Exports now finish the GPU resolve before handing the canvas to the browser's
image encoder. The cold Wound-tip fixture had differed at 1,271 pixels despite
identical scene uniforms, with a maximum five-level channel difference. The
final path passes the original single-frame cold/repeat test in two independent
contexts, including the exact end seams and paired 4K/photo/panorama checks.
Each export owns a fresh shadow pass at its resolution; preview retains cached
shadows. Driver dithering is disabled to prevent intermittent one-level output
differences during otherwise identical paused weather revisits.

Both the original saved ascent/descent and the new recording contain 130
changing decoded frames. The initial browser seek/canvas review returned a stale
frame; sequential decoding corrected that diagnostic. The new route ascends
from a 1.7 m eye height above the original province terrain to 200 km above it
and returns. Its 65 source views match exactly on return. The six-route weather
matrix covers both eras and clear/mixed/full cover; separate exposure, lens and
fractional-resolution probes cross 160 km without an abrupt switch. The largest
mean channel change is 0.0000653 in the fractional-resolution pairs and
0.00000911 across the exact-resolution 160 km switch.

## Stage D

`shade-edges.js` discovers nearby parents without a selected Shade. It covers
disk and cap perimeters, square corners, trimmed edges, all three large loss
families, both longitudinal/cross-fracture banks and authored small holes.
Boundary intervals and triangles are checked against the combined footprint,
so an intersection cannot introduce a second internal wall or bridge a hole.

Intact edges have a closed finished section. Broken edges expose upper/lower
layers, a recessed backing and crossed braces. The local 180 m section hangs
below the unchanged analytic skin; it does not raise the old walking deck or
give the whole Shade a 180 m thickness. This is edge construction, not a
finished environment across either face.

Fixed parent-local chunk keys survive movement and scrubbing. Residency uses
the existing edge worker and coarse/fine admission system. Preparation accounts
for camera motion and the measured sweep of the actual parent frames, with a
bounded extra range. Close coarse guards and resident contact meshes participate
in the same visible/collision representation. Heading does not select detail
or change speed.

## Connected walking

`ground-chunks.js` supplies nine 1.024 km fine cells with 64 subdivisions and
sixteen coarse cells. The coarse ring extends 16 km beyond the fine area and
smoothly reaches the analytic shell. Its inner borders consume the same 16 m
samples as fine terrain, including canonical rounding at zero coordinates.
Heights and normals use geographic samples; biome relief blends with the
geographic region weights. The original province supplies its own terrain and
gardens, while new relief starts smoothly outside its preserved border.

Sparse objects have geographic 128 m lattice addresses and geographic axes. Wound footprints reject
objects before emission and clip the terrain using the established matching
wall/end-profile generator. Chunk rim intervals are coalesced before requesting
the surrounding Wound geometry.

Ground generation runs in `ground-worker.js`. Packed collision data shares the
terrain BVH instead of duplicating it. Ground and edge uploads share the same
4 ms admission budget. The 64 MiB ground reservation includes active terrain,
replacements, cached collision/vertices and received worker packets; the edge
limits remain 192 MiB and three million vertices. GPU vertex storage is
additional and is recorded separately by renderer diagnostics.

The old support stays pinned until the complete replacement is uploaded. A
late worker holds movement at the prepared frontier; an actual Wound remains
an opening and permits falling back into flight. Ordinary joins do not show a
loading overlay. Initial landings and explicit preparation wait for support,
including an in-progress rebase. Both old coordinate clamps are absent only
for revision-2 terrain.

## Evidence and limits

The final [verification record](evidence/continuity-03/verification.json) records
28 passing numerical suites and 17 passing browser suites, with source hashes
and links to the local evidence.

Numerical evidence includes 90 original Wound fixtures and 42,954 exact seam
vertices; 21,774 local-border probes; 116 unselected Shade approaches across
shapes, eras and faces; 27,928 fracture/intersection triangles without false
footprint support; 24 chunk crossings and return; 780 exact fine/coarse border
vertices; and reoriented support probes at poles and longitude wrap. The latter
agree within 0.021 mm on the sampled overlapping triangles. Another 120
shared object vertices preserve position and orientation within 0.233 mm through
the same rebases.

The real walking controller completes 22 joins over an approximately 11.2 km
outward route and back, rebases once and preserves the arrival address. It
sidesteps one actual small obstacle, returning within 25 m of its starting
position. The final queue drains with zero support waits and about 62.3 MiB
reserved. Controller steps measured median 0.1 ms, p95 0.3 ms and maximum 1 ms
on this route; these are controller timings, not whole-frame latency.

Local evidence lives in `work/screenshots/continuity-03/`, `wound-ground/`,
`shade-edges/` and `connected-ground/`. Run `npm test` and the relevant browser
suites sequentially. `tools/run-browser-gates.cjs` gives each existing suite a
fresh isolated browser context while reusing the driver process. The video
review tool decodes the recording into time-labelled sheets; frame hashes alone
do not prove that a MediaRecorder video contains the intended motion.

Cold shader preparation remains substantially slower than warm rendering and
belongs behind preparation. The bounded tests do not certify every possible
whole-Sphere journey, arbitrary manual-speed teleport, or mixed shell/Shade
route. Persistent Hero Zones, detailed Shade-face environments and the joined
artistic variations in stage F remain separate work.
