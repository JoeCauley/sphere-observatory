# Ground material correction 1

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

14 September 2026. Follow-up to the reported green/brown rim on snow, desert
and Machine Expanse walking patches.

## Cause and correction

The analytic shell and local geometry use separate GPU programs. Setting a
uniform on the shell does not initialize the equivalent geometry uniform.
`geometry-renderer.js` omitted `uBiomeOverride`, whose initial zero selected
the river-garden biome. A patch's centre used its explicit material ID, but
the geographic blend at the edge sampled that unrelated biome. Connected
terrain also uses the geographic material and was affected across its floor.

The geometry pass now sets the actual biome override (`-1` for geographic
selection), grid setting and shared collection settings each draw. Reusing
the collection upload also supplies the era, Wound enable flag and Wound
geometry used by surface material blending. It does not reuse the shell's
lighting: mesh illumination still uses its existing direct/fill inputs.

No texture files, terrain vertices, collision data, saved addresses or terrain
revisions are replaced. Reloading the app applies the corrected material
bindings to existing saved patches as well as connected terrain.

## Verification

`tests/ground-material-browser.cjs` renders Winter Hell, Ultra Desert,
Machine Expanse and The Ruin with both revision-1 patches and revision-2
connected ground. It replays the old unset uniform values for the before
images, then renders the correction at the identical camera with the same
geometry, texture bytes and lighting. These are controlled reproductions of
the bug, not reconstructed copies of the user's exact screenshots.

The test checks the actual linked mesh program's uniform values after
alternating explicit biome overrides, geographic selection, before/after
eras and Wound enable/disable. It retains before/after images, scene JSON and
graphics-error checks in `work/screenshots/ground-material/`. The final
run passes **8 cases and 24 state switches**, with zero graphics/page errors.
Visual inspection confirms removal of the unrelated border in the retained
snow, desert and machinery views. See the [verification receipt](evidence/ground-material-01/verification.json),
[full case report](evidence/ground-material-01/report.json),
[desert before](../examples/archive/pre-v1.5/docs/evidence/ground-material-01/2-r1-before.png) and
[desert after](../examples/archive/pre-v1.5/docs/evidence/ground-material-01/2-r1-after.png).

## Later bounded meadow material work · 30 September 2026

The [F2 reviewed continuation](evidence/meadow-proof-01/f-canopy-continuation-v2-2026-09-30T20-41-39-185Z/f-reviewed-report.md) adds the minimum meadow material subset authorized within IB-075-F. The actual terrain material receives shared coverage, wetness, blade palette and wind inputs through a retained filtered/mipped 64 × 64 RGBA8 descriptor: 16,384 initial upload bytes and 21,846 estimated resident mip bytes. Its dedicated texture-unit 15 binding preserves the production Wound-array binding on unit 14. Clumps and ground share a filtered middle-distance response; terrain retains actual depth and collision ownership, and far cards remain absent.

This later addition does not reinterpret the correction or measurements above. F2 material revision 3 preserves historical F1 material revision 2. IB-080 must inherit this bounded subset; broader terrain/material work remains queued. F is complete under its bounded criteria. G is DONE under its bounded wind/timeline criteria. H measurement implementation is PASS; fixed-resolution performance/resource certification is FAIL, retained CPU-memory attribution is INCOMPLETE and H remains IN PROGRESS. I export/UI certification remains PENDING and I–K remain blocked; B1/acceptedBy are NOT ACCEPTED and M1 is WITHDRAWN. The earlier F-only update stopped after F. See the [bounded proof](Observatory-Meadow-Bounded-Proof-01.md), [current ledgers](Observatory-Infinite-Biomes-Ledger-STATE.md) and [documentation index](README.md).
