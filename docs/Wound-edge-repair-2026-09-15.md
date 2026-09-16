# Wound-edge repair · 2026-09-15

## Cause and change

A terrain section farther from a Wound contour than its own extent skipped clipping. That fast path treated sections wholly inside the opening as intact ground. The connected terrain ring could therefore draw detached floor slabs across the void and supply invisible collision support.

`SphereSites.woundGround` now distinguishes wholly missing sections from intact sections before taking that fast path. Missing sections emit no floor, wall or props and supply no ground support. Sections crossing the lip continue to use the existing shared floor/wall vertices.

## Verification

- The original implementation failed the new regression with 7,272 vertices in a section that should be empty. A separate near-lip scene contained 31,848 terrain triangles inside the opening before the fix and zero afterward.
- `npm test`: all 35 numerical suites pass, including the new `tests/wound-chunks.cjs` gate. It checks 474,665 triangle interiors across eight viewpoints on all six Wounds, including tips, 33 wholly empty sections, 69 sections crossing the rim, support queries, revisits and the older local-patch generators. Existing 90-fixture Wound seam tests also pass.
- `tests/wound-chunks-browser.cjs` exercises real worker-loaded terrain through the travel coordinator at the lip, over the opening and back at the lip. It checks rendered terrain ownership, completed arrivals and WebGL/page errors. Run against a local server with `SPHERE_URL`, `SPHERE_BROWSER` and `NODE_PATH` configured as appropriate. All three browser arrivals passed with zero page/WebGL errors and no terrain triangles inside the opening. Reviewed screenshots and results are retained in `docs/evidence/wound-edge-2026-09-15/`.

This is an unreleased local fix. Reloading the application loads the corrected geometry generator; the existing open view is left untouched.
