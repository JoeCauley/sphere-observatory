# Bounded Meadow P4 feasibility experiment

This is an isolated two-hour decision experiment, starting at 2026-10-06 09:48:22 UTC and ending by 11:48:22 UTC. Production and prior evidence are preserved. Read `last-run.json`, the delivered P4 report and `attempt-provenance.json` before interpreting a phase.

The final comparison uses the unshared `geographic` variant, experimental 12-stem volume, exact retained 900-pose walking and turning/elevation routes, and declared preparation arms of 2, 4 and 6 ms. Ordinary UI entry is Explore → Watershed / Open meadow → Meadow study / on foot → Visit. `app` runs use the ordinary application preview scheduler at fixed 1920 × 1080. Direct renderer replay, quiet app measurements, validation observers and image/video capture are separate. The real camera and all canonical plant bytes remain unchanged.

The controller resumes native receipt validation/SHA, staging hash, submission planning and reference building/comparison across frames. Native demand normalization and candidate construction still contain atomic work. Complete preparation telemetry includes receipt, callback, demand, candidate, plan, staging and reference work; there is no all-work-is-resumable claim. The geometric envelope includes conservative translation, vertical and horizontal margins and tests near vertices and rays of the actual expanded render frustum before declaring it usable.

The final geographic proof requires every cell and detailed tier in the exact current native demand. Readiness of additional conservative buffer cells and exact legacy demand/view versions is reported separately. Earlier experiments required the entire superset and are retained with that qualification. This experimental current-coverage rule is explicit; it is not formal native equivalence or acceptance.

The shared/forecast branch strips only byte-identical duplicate clumps and tries canonical one-metre storage partitions. It passed record-byte checks but failed a native GPU reference ownership check in moving use. It is abandoned for this pass and must not be selected as usable or merged. Its failures and setup costs remain in the evidence.

No canonical roots, density, support, exclusions, geographic wind, strict rank, record/resident/submission/upload/GPU/CPU caps or worker limits are relaxed. The historical H1 preparation gate remains MAX ≤ 2 ms. The 4/6 ms arms are separately authorized feasibility measurements. No full H1, whole heap ownership, pixel equivalence, accepted appearance, release or downstream milestone is promoted.

For a fresh reproduction using the retained runtime, do not rerun `prepare.cjs` over these owned directories, reuse an existing phase name, or replace evidence. The host freezes helper sources and pins its executed driver. All prior services remain untouched.

```powershell
node analysis/meadow-feasibility-p4/run-p4.cjs --skip-baseline
```

Wait for `P4 READY` and issue commands one at a time, waiting for `P4 READY` between them. Budget order is recorded and is not randomized; warm allocation histories differ.

```powershell
node analysis/meadow-feasibility-p4/command-p4.cjs quiet-app-6 p3 budget=6 variant=geographic routes=walk,turn-elevation frames=900 app
node analysis/meadow-feasibility-p4/command-p4.cjs quiet-app-4 p3 budget=4 variant=geographic routes=walk,turn-elevation frames=900 app
node analysis/meadow-feasibility-p4/command-p4.cjs quiet-app-2 p3 budget=2 variant=geographic routes=walk,turn-elevation frames=900 app
node analysis/meadow-feasibility-p4/command-p4.cjs visual-app-6 p3 budget=6 variant=geographic routes=walk,turn-elevation frames=900 app images video
node analysis/meadow-feasibility-p4/command-p4.cjs visual-app-2 p3 budget=2 variant=geographic routes=walk,turn-elevation frames=900 app images video
node analysis/meadow-feasibility-p4/command-p4.cjs finish
```

Video records actual canvas motion in wall-clock time with browser MediaRecorder. PNGs sample every thirtieth draw. Both observers invalidate timing and cadence qualification. They are not generated images, interpolated animations or a claim that visible stills establish coverage completeness.

Validation scripts compare native and resumed receipts against each other and independent SHA-256; compare clump/detail and split record bytes; sample actual-frustum subset containment including strict zero-rank exceptions; and compare native demand and current-required masks at 242 boundary/resolution cases. Their output uses exclusive creation: run under a fresh evidence configuration or use a fresh supported output filename rather than replacing sealed results.

The decision requires actual moving completeness on every draw, preparation MAX within the declared budget and smooth ordinary-app cadence. A reduction in p95, a still image, or protocol completion alone cannot satisfy it. Failed warm-ups, missing GPU samples, partial windows and ownership failures remain visible.
