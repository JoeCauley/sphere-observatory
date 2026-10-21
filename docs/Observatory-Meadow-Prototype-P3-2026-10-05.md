# Meadow prototype P3 — moving completeness and the 2 ms preparation target

Date: 2026-10-05 (local). Status: **DIAGNOSTIC ITERATION FINISHED; P3 TARGET UNMET; UNPROMOTED**.

The user authorized P3: keep the meadow complete while walking and turning, within the unchanged 2 ms preparation budget. This isolated pass implements reusable ordered storage and exact-window demand memoization, tests them against the original ordered implementation, and records actual movement images. It does **not** achieve the complete-moving target.

The final bounded cache has walking preparation p95 **8.50 ms**, MAX **16.80 ms**, with **0/900 complete moving frames**. Turning/elevation improves to **313/900 complete frames**, against 64/900 for the same-host P2 compiled control, but MAX is **9.10 ms** and the required result is 900/900. Walking's maximum worsens against the same-host control's 13.70 ms. These results justify neither an overall budget pass nor promotion. Required P3 work remains open.

## Identity, bounds and preservation

The prototype is in `analysis/meadow-prototype-p3`, with retained [configuration](../analysis/meadow-prototype-p3/last-run.json) and [reproduction instructions](../analysis/meadow-prototype-p3/README.md). Runtime: `I:\Sphere\work\meadow-prototype-p3-2026-10-05T23-49-03-706Z\runtime`. Evidence: `I:\Sphere\repositories\sphere-observatory\docs\evidence\meadow-prototype-p3-2026-10-05T23-49-03-706Z`.

The dirty local base is version 1.6.0 at commit `6a52267ddf5d9d49b0f64bc75a6699f671232e77`, source SHA-256 `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116`, 45-asset set SHA-256 `45f67a383ac6ec295844b3bc6ddc40e9a1d661f354d7f406bf82e6519410a91d`. New prototype modules run in an owned snapshot. Production code, fixtures, canonical samplers/root records, geographic wind, strict native rank tests, upload/fence transactions, readiness comparisons and numeric limits are unchanged. Current demand coordinates are not snapped to suppress jitter. No production appearance is promoted; the fixed 12-stem volume remains P2's experimental appearance.

The [baseline](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/baseline.json) pins 1,040 existing non-evidence repository files and the pre-existing tracked diff. A [separate inventory](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/previous-prototypes-baseline.json) pins 465 P1/P2 source/evidence files. Final [production preservation](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/preservation-final.json) and [prior-prototype preservation](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/previous-prototypes-preservation-final.json) verify those exact bytes and runtime/build identities. These are bounded inventories, not all-host or all-history preservation claims. Existing servers were retained. The owned diagnostic browser/server was closed; the visual viewer remains available.

The H1 fixture remains unchanged: complete vegetation preparation MAX ≤ 2 ms; detailed residents ≤ 500,000; total records ≤ 550,000; detailed submitted ≤ 250,000; upload ≤ 2 MiB; vegetation GPU ≤ 32 MiB; CPU ≤ 64 MiB. The existing instance uses three workers, one pending producer, 655,360 physical slots and a 65,536-reference work quantum. Its internal lifecycle deadline remains 1.5 ms; the separate complete-preparation gate remains 2 ms. No numeric budget was increased.

## What P3 changes

[submission-p3.js](../analysis/meadow-prototype-p3/submission-p3.js) replaces per-candidate Sets with typed membership and insertion-order arrays. Two candidate pools preserve committed/pending ownership; three plan pools reuse range/filter objects while excluding committed and pending plans. Packet group offsets remain compiled from validated original packets. Candidate region/handle/assignment order and per-plan family/range/filter order are retained. Original receipt/header/content validation, SHA work, native record predicates, reference-bank building/comparison/upload, fences, service commit and retirement still run inside preparation.

[supply-p3.js](../analysis/meadow-prototype-p3/supply-p3.js) memoizes only module-registered immutable generated requests and their exact normalized ordered targets. It preserves serialized identities, version changes, request priorities and current target coverage. The first retention policy kept four windows plus a one-metre forward lookahead under original service credits. It failed a return-to-origin warm-up: the retained state had 549,042 total records, admission denied at the 550,000 record limit, no worker failures, and incomplete current foreground. Cached packets prevented useful release. The goal was not made ready by relabeling this state.

The first warm-up rule also waited for unadmitted optional future jobs. That observer/control mistake was corrected to wait only for admitted unfinished prefetch work; current meadow readiness remained native. The subsequent failure snapshot confirmed that current resource admission still stalled. The [failed cache attempt](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/cached-oracle-v2/run.json) and its state remain preserved.

[bounded-supply-p3.js](../analysis/meadow-prototype-p3/bounded-supply-p3.js) narrows packet retention to at most two exact horizontal half-metre windows at the same geographic row. It has no forward prefetch and releases obsolete unpinned packets outside that retained set. It recovers the starting fixture and completes the diagnostic replay. The normalized-window cache and its preparation work remain charged. It changes no foreground/view flags and never declares an older view current.

At the final bounded quiet checkpoint, P3 planner typed backing was 2,427,168 bytes, packet tables 206,208 bytes and ordered membership 269,160 bytes. Explicit window metadata reservation was 1,310,032 bytes. The P2 comparison planner stays physically allocated and separately reserved. These figures do not cover the complete object graph or worker heaps; whole CPU ownership remains unqualified.

## Ordered oracle checks

The earlier [typed oracle](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-05T23-52-40-026Z/typed-oracle/run.json) checks invoked candidates, including null results, and submission plans on 1,800 retained walk/turn poses. The final [bounded oracle](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/bounded-oracle/run.json) repeats 1,800 poses and checks exact generated/normalized demand transitions as well.

In the final phase, counters increase by **543 candidate checks**, including **149 null results**, **763 plan checks** and **645 demand checks**, with **zero mismatches**. These deltas use the preceding retained failure-state checkpoint; they include initial/inter-route settling as well as replay. The final raw controller totals are cumulative across the host and are not all attributed to this phase. Candidates are checked when invoked, not once per every frame. Plans compare query/signature keys, ordered handles/regions/assignments, selected/support membership, families, validation handles, ranges, counts and filter offsets/tiers. Demand checks compare changed/version/serialization, request order and exact target mappings. This is scoped live-scene canonical-input evidence, not a universal public/foreign-contract proof.

Oracle passes contain duplicate work and cannot be used as performance evidence. The original candidate also writes its diagnostic footprint scratch grid during these observer checks; the quiet runs use only the selected implementation.

## Separate quiet moving tests

Browser: Chrome 154.0.8037.98; ANGLE / NVIDIA GeForce RTX 5080 / D3D11. Entry used **Explore → Watershed / Open meadow → Meadow study / on foot → Visit**, seed 713, day and clear. After entry, the app was held and the actual renderer replayed the retained H1 public camera/light/wind poses at 1920 × 1080 and 80° FOV. All arms use the same experimental 12-stem volume. These direct renderer replays are **not ordinary-app H1**.

The final same-host [P2 control](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/p2-paired-quiet/run.json) and [P3 bounded-cache run](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/bounded-quiet/run.json) each use three 900-draw windows. No duplicate oracle, method trace or PNG encoding runs inside them. All route-start work is retained; no initial unready draws or maxima were removed. The order was P3 then P2, not randomized/counterbalanced, and warmed allocation/cache histories differ. The figures are observed diagnostics, not a statistically isolated causal gain.

| Planner | Route | Preparation p95 (ms) | Preparation MAX (ms) | Meadow complete | View ready | Foreground ready |
|---|---|---:|---:|---:|---:|---:|
| P2 compiled | stationary | 0.20 | 5.50 | 893/900 | 893/900 | 900/900 |
| P3 bounded cache | stationary | 0.20 | 5.60 | 893/900 | 893/900 | 900/900 |
| P2 compiled | walk | 8.90 | 13.70 | 0/900 | 0/900 | 0/900 |
| P3 bounded cache | walk | 8.50 | 16.80 | 0/900 | 0/900 | 0/900 |
| P2 compiled | turn-elevation | 7.90 | 17.40 | 64/900 | 352/900 | 258/900 |
| P3 bounded cache | turn-elevation | 7.10 | 9.10 | 313/900 | 351/900 | 554/900 |

Both arms fail the 2 ms MAX requirement on all three routes. Both fail complete moving readiness. Turning's readiness gain is useful evidence of the narrower retention policy; it is insufficient for the goal. A walking p50 near 2 ms cannot substitute for the worst-frame limit.

All **5,400 final paired quiet draws** have unique, valid associated GPU samples. They have exact retained pose order, zero GL errors and recorded 1920 × 1080 internal dimensions with matching wind phases. There are no matched vegetation-off windows here, so incremental CPU/GPU or full H1 certification is not inferred. Their direct-draw cadence is roughly 56–57 fps; it does not resolve ordinary-app/native cadence acceptance or OS presentation.

Earlier same-iteration quiet results remain retained:

| Experiment | Route | Preparation p95 (ms) | Preparation MAX (ms) | Meadow complete | View ready | Foreground ready |
|---|---|---:|---:|---:|---:|---:|
| p2-quiet | stationary | 0.20 | 6.30 | 893/900 | 893/900 | 900/900 |
| p2-quiet | walk | 10.30 | 19.00 | 0/900 | 1/900 | 0/900 |
| p2-quiet | turn-elevation | 8.10 | 12.70 | 44/900 | 351/900 | 237/900 |
| typed-quiet | stationary | 0.20 | 5.20 | 893/900 | 893/900 | 900/900 |
| typed-quiet | walk | 8.90 | 22.10 | 0/900 | 0/900 | 0/900 |
| typed-quiet | turn-elevation | 8.10 | 13.20 | 65/900 | 352/900 | 269/900 |

The earlier typed stationary replay uploaded **268 bytes**, despite mostly stationary reuse; this exception remains visible and was not removed. Final paired stationary uploads are zero. The earlier P2 quiet turn replay has one missing/invalid GPU sample; it is retained and cannot be described as complete GPU protocol evidence.

Maximum physical vegetation-plus-ground GPU allocation is 33,466,930 bytes, only 87,502 below 33,554,432. Final P3 bounded residents peak at 456,895 detailed records; submitted detailed peaks at 190,007. Maximum bounded quiet upload is 312,384 bytes. Those observed component counts remain within their caps, while preparation/completeness fail. Whole heap ownership and appearance acceptance remain separate and unproved.

## Why the complete-moving target is still open

The [demand-key trace](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-05T23-52-40-026Z/demand-key-trace/run.json) captures nearly zero chart-x coordinates whose signs alternate by micrometres. Floor-based half-metre buckets switch between horizontal centers +0.25 and −0.25 m. The walking trace performs 535 demand updates in 900 draws. Exact memoization reduces repeated normalization, but current versions still advance and readiness must compare the latest target. This observed churn is a contributor; it is not a proof of a sole cause or license to change the frozen geographic contract.

The final [method trace](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/bounded-trace/run.json) finds a walking median of 131 unadmitted requested jobs, p95 166 and maximum 177, with one unstaged job and no per-frame admission denial. Current/committed version lag has median 4, p95 9 and maximum 16. A single pending producer and unfinished reference banks still fall behind the changing target. Turning has a median of zero missing jobs, but its exact view/reference transaction still lags.

| Method | Walk calls | Walk invocation p95 (ms) | Walk invocation MAX (ms) | Turn invocation p95 (ms) |
|---|---:|---:|---:|---:|
| lifecycle.updateDemand | 535 | 1.30 | 2.40 | 1.20 |
| lifecycle.candidate | 255 | 2.50 | 6.70 | 2.70 |
| backend.plan | 147 | 3.20 | 5.50 | 2.80 |
| service.receive | 271 | 4.20 | 14.40 | 4.40 |
| backend.selectProgressive | 780 | 2.60 | 5.00 | 2.50 |

This is inclusive method attribution with observer overhead; percentiles from different methods must not be summed and are not quiet gates. It identifies remaining candidate/plan scans, atomic receipt work and reference filtering/build/comparison costs. The adapter preserves the native full transaction: changing views can need several 65,536-reference quanta before their exact view key is committed. Reusing allocation objects does not make that transaction current or complete within 2 ms.

Required P3 work is a bounded incremental admission/validation and geographic/view-reference implementation with exact semantic checks, keeping enough current coverage supplied under all unchanged credits. Receipt validation and reference work must stay counted; readiness must remain truthful. That implementation is **not present in this pass**. No downstream milestone has been started or authorized by diagnostic completion.

## Visual evidence and retained attempts

The user-facing gallery is in `C:\Users\Joe\Documents\Codex\2026-10-05\he\outputs\meadow-p3`. It contains **120 original, unedited 1920 × 1080 PNGs**: 30 samples per route × two routes × P2/P3. The [P2 image run](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/p2-images/run.json) and [P3 image run](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/host-2026-10-06T00-25-03-287Z/bounded-images/run.json) retain identical camera pose and wind phase for each comparison, the actual readiness flags, original image bytes and SHA-256 identities. Every thirtieth draw is shown. PNG encoding between samples invalidates image-run timing/cadence inference. The gallery can reveal presentation differences and incomplete coverage; it cannot establish human acceptance, unseen-frame quality or complete moving coverage from stills.

All attempts are retained:

- `host-2026-10-05T23-52-01-011Z`: startup MIME/download failure, no completed rendering proof or startup source freeze.
- `host-2026-10-05T23-52-40-026Z`: baseline/corrected attribution, quiet P2/typed storage and typed oracle; later cache installation failed while assigning a getter-only property. The failure is preserved. The original baseline trace's final walking method object was later mutated by settling; use `baseline-trace-corrected` for attribution. Raw draw timings/readiness are separately retained.
- `host-2026-10-06T00-13-56-662Z`: cache warm-up timeout before recorded moving routes, no completed replay claim. It predates the later state-snapshot mechanism; its exact resource cause was not captured.
- `host-2026-10-06T00-25-03-287Z`: cache return-warm failure with a retained state snapshot, followed by completed bounded oracle, quiet paired tests, trace and separate PNG runs. The failed cache phase's console showed walking progress, but its browser evaluation failed before returning raw routes; those progress logs are not promoted to independently audited replay evidence. A queued cache quiet command was archived without execution after the warm failure, rather than silently counted as a test.

Each started phase freezes helper/module sources and a hash manifest. The host driver is the startup-frozen `run-p3.cjs`; phase freezes record available modules and the explicit newly loaded module. Frozen directory presence alone does not imply every module was executed. Loaded P2/P3 controllers persist within the owned host, and raw phase commands define selection and observers.

The [independent raw-data audit](evidence/meadow-prototype-p3-2026-10-05T23-49-03-706Z/independent-audit-2026-10-06T00-42-52-764Z.json) verifies source hashes, exact historical pose sequences, unique quiet frame/sample association, finite timings, recomputed statistics/readiness counts, recorded resolutions/wind and all PNG dimensions/hash/labels/matching poses. Across retained completed phases there are **10,800 quiet draws**, **10,799 valid quiet GPU samples** and **1 missing/invalid sample**, plus **120 PNGs**. Audit status is `DIAGNOSTIC_EVIDENCE_VERIFIED_REQUIREMENTS_OPEN`; it verifies the evidence, not success of P3.

The historical 376-row first-capture material mismatch was not retested and remains unknown/unwaived. Native equivalence, complete ownership, human appearance/motion acceptance, global joins and release readiness remain open. HR-09/H remains open with failed H1; HR-10 remains unstarted; I–K remain blocked; B1 remains not accepted; M1 remains withdrawn.
