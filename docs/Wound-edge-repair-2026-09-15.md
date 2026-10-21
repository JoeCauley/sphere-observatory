# Wound-edge repair · 2026-09-15

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

## Cause and change

A terrain section farther from a Wound contour than its own extent skipped clipping. That fast path treated sections wholly inside the opening as intact ground. The connected terrain ring could therefore draw detached floor slabs across the void and supply invisible collision support.

`SphereSites.woundGround` now distinguishes wholly missing sections from intact sections before taking that fast path. Missing sections emit no floor, wall or props and supply no ground support. Sections crossing the lip continue to use the existing shared floor/wall vertices.

## Verification

- The original implementation failed the new regression with 7,272 vertices in a section that should be empty. A separate near-lip scene contained 31,848 terrain triangles inside the opening before the fix and zero afterward.
- `npm test`: all 35 numerical suites pass, including the new `tests/wound-chunks.cjs` gate. It checks 474,665 triangle interiors across eight viewpoints on all six Wounds, including tips, 33 wholly empty sections, 69 sections crossing the rim, support queries, revisits and the older local-patch generators. Existing 90-fixture Wound seam tests also pass.
- `tests/wound-chunks-browser.cjs` exercises real worker-loaded terrain through the travel coordinator at the lip, over the opening and back at the lip. It checks rendered terrain ownership, completed arrivals and WebGL/page errors. Run against a local server with `SPHERE_URL`, `SPHERE_BROWSER` and `NODE_PATH` configured as appropriate. All three browser arrivals passed with zero page/WebGL errors and no terrain triangles inside the opening. Reviewed screenshots and results are retained in `docs/evidence/wound-edge-2026-09-15/`.

This is an unreleased local fix. Reloading the application loads the corrected geometry generator; the existing open view is left untouched.
