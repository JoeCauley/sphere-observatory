# IB-075-H production budget evidence

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

30 September 2026 · Measurement implementation complete; certification open

IB-075-H now has a reproducible production measurement gate. **H remains IN
PROGRESS**: the accepted F2 representation exceeds the fixed resource and GPU
targets. This document records implementation, measurements and the required
redesign. The authoritative ledger and state record retain final gate authority.

The structural redesign will now be implemented through the
[H redesign implementation sub-ledger](Observatory-Meadow-H-Redesign-Ledger.md),
integrated into parent IB-075-H. HR-00 through HR-08 are DONE; HR-09 is IN PROGRESS and HR-10
is NOT STARTED. The implementation status changes no measured result below: the original failed runs,
source/fixture identities and numerical limits remain preserved.

The new command is `npm run test:ib075:h`. It checks the assessment and GPU timer
logic, then opens an isolated Chrome context on a temporary localhost server,
selects **Explore → Watershed · Open meadow → Meadow study · on foot → Visit**,
and uses the real workers and production renderer. Every attempt needs a fresh
`IB075_H_OUTPUT` directory. The existing supported server is preserved. Joe later authorized closing his
competing browser session before the primary isolated run.

The versioned [H1 fixture](../tests/fixtures/meadow-performance-h1.json) pins the
E2, F2 and G2 source hashes and the existing design limits. No appearance,
density, placement, geography, material or wind contract is retuned.

The fixed protocol uses a 1920 × 1080 internal canvas, 80° horizontal FOV,
60 fps selection, quality 1, ordinary material/shadow/AA settings, and adaptive
scaling disabled. Three sequential windows per vegetation arm replay the same
900 indexed poses: stationary, a 2.8 m/s outward/return over 21 m, and a 360°
turn with a terrain-relative elevation excursion to 20 m. Scene/light time stays
2468; geographic wind advances in seconds. These public saved-state poses use
the actual app requestAnimationFrame loop; they are rendering/preparation
measurements, not keyboard walking-controller or automatic-landing acceptance.

Cold opening, arrival and pose settling are reported separately. Warm intervals
measure drawn frames; OS/compositor presentation is not inferred. The gate bounds
each window to 20 seconds and stops sustained overload below 35 fps after 120
frames. A slow or truncated run fails rather than acquiring an invented pass.

Full GPU elapsed queries cover the ordinary production render and resolve.
Completed queries carry source frame IDs and are consumed once. A disjoint event
invalidates outstanding queries; unavailable results remain incomplete. No
`gl.finish()`, image encoding or pixel readback occurs in a timing window.
Incremental CPU/GPU distributions use nonnegative differences between exactly
matched off/on frames, rather than subtracting unrelated aggregate percentiles.

CPU submission is the entire renderer call. Preparation includes the Meadow
request, resource/VAO/upload preparation and asynchronous packet reception since
the previous frame; worker generation and queue-to-completion latency are
separate. Telemetry records uploads, allocations, resident/submitted blade
counts, draw calls, pending cells, worker and GL errors, ground residency and its
independent budget. Vegetation GPU bytes include instances, prototypes and the
mipped terrain-canopy descriptor.

CDP reports main-page and dedicated-worker used heaps and backing storage
separately from retained grass typed-array bytes. The complete application heap
is only a conservative upper bound for grass; exceeding that bound cannot prove
grass alone exceeds 64 MiB. Without attribution or a sufficient bound, that CPU
criterion remains INCOMPLETE. Instrumentation objects are included in the bound.

The practical observation uses the measured dimensions of Joe's existing Chrome
tab: 1551 × 1426 browser viewport, DPR 1, ordinary view area 1215 × 1360. Its
three-second run selects 60 fps and permits live adaptive scaling in the isolated
context. Joe's original 30 fps/adaptive settings were observed without retuning his scene;
his competing session was subsequently closed with his authorization. This practical
run cannot replace the fixed-resolution gate.

## Evidence and results

The retained run directory is
`docs/evidence/meadow-proof-01/h-production-budget-v1-2026-09-30T22-58-49-690Z/`.
The first run is a calibration attempt: its paused wind phase was not advanced,
upload preparation was not yet included in the preparation counter, and CPU
regression checks overlapped part of it. Its raw observations are preserved and
excluded from certification. The `animated-wind-corrected/` successor fixes these
conditions without changing the appearance or budget fixture sources. It still
ran alongside Joe's live preview, so its timings are qualified as competing load.
The isolated successor is the primary evidence.

The [isolated final run](evidence/meadow-proof-01/h-production-budget-v1-2026-09-30T22-58-49-690Z/isolated-final/h-browser-report.json) is the primary result. Joe authorized closing his competing browser session because tests have priority; absence of the supported-URL tab was verified before launch. The previous headless test contexts had closed. All six fixed windows completed: **5,400 frames with 5,400 valid, uniquely attributed GPU samples**, exact matched indexed poses, no GL/worker/page errors, no resolution violations and no adaptive downscaling.

| Vegetation-on window | Frames / drawn fps | CPU p95 / incremental ms | GPU p95 / incremental ms | Interval p95 / max ms |
|---|---|---|---|---|
| stationary | 900 / 60.02 | 1.40 / 1.00 | 16.84 / 14.68 | 16.80 / 17.30 |
| walk | 900 / 60.02 | 1.40 / 1.00 | 15.54 / 13.39 | 16.80 / 17.00 |
| turn-elevation | 900 / 60.02 | 1.60 / 1.00 | 16.38 / 14.06 | 16.80 / 17.20 |

CPU submission and incremental CPU targets pass. Drawn cadence passes all three windows. Total and incremental GPU targets fail all three. This is drawn cadence in headless Chrome, not measured OS/compositor presentation. The GPU is NVIDIA RTX 5080 through ANGLE/D3D11; Chrome 154.0.8037.92, Windows 10.0.26200, driver 32.0.16.1074, Node v24.18.0. Build source fingerprint is `ef91b5e8683e222784577ace6ee62a9fe81061c635189483e555a9ebf5a9d9e2`, local-modified, release false. Cold opening was 89.51 s; ordinary arrival/settling 115.06 s, outside warm distributions.

| Resource / preparation criterion | Measured peak | Target | State |
|---|---|---|---|
| Resident detailed records, including pending replacements | 927,425 | 500,000 | FAIL |
| Submitted detailed instances | 445,190 | 250,000 | FAIL |
| Grass draws | 184 | 32 | FAIL |
| Vegetation GPU residency | 32,570,886 bytes / 31.06 MiB | 32 MiB | PASS |
| Grass CPU typed arrays | 32,569,376 bytes / 31.06 MiB | CPU cap includes metadata and workers | Attribution INCOMPLETE |
| Warm main-thread preparation | 2.80 ms | 2 ms | FAIL |
| Warm upload | 612,032 bytes | 2 MiB/frame | PASS |
| Stationary animated uploads | 0 | 0 | PASS |
| Ground cache budget / active bytes | 64 MiB / 0 | Independent 64 MiB budget | Preserved |

This named Meadow neighbourhood uses analytic inner-shell support, so active connected-ground cache bytes are zero here; this does not claim a new connected-ground traversal pass. Maximum walking queue and pending GPU target count were 68; queue-to-completion latency reached 3,379.30 ms and worker generation reached 1,294.70 ms. Those worker costs are separate from the warm main-thread preparation maximum. Old valid presentation remained active while the existing transaction prepared a new target; completion latency is not certified as seamless streaming. Per-frame cumulative allocation counters and prepared packet counts are retained in the raw JSON.

The corrected competing-load run stopped after 120 stationary frames at 33.87 drawn fps, with GPU p95 32.21 ms. The same first 120 indexed poses and wind phases in isolation had GPU p95 16.94 ms; the complete isolated stationary window reached 60.02 drawn fps with GPU p95 16.84 ms. Resource counts are unchanged by closing the other preview. The earlier load-sensitive timings are retained as qualified observations, not isolated certification.

The separate native-size observation recorded 180 frames in 3.00 s (59.98 drawn fps), browser viewport 1551 × 1426, output 1215x1360, 1093x1224, 984x1101, 886x992, internal raster 1361x1523, 1224x1371, 1102x1233, 993x1112, adaptive scale 0.730–1.000. Adaptive reduced the scale during this short observation; these changing raster sizes are separate from the fixed-resolution result. Native GPU values were not mapped into its raw records, so this practical observation makes no GPU timing certification claim.

[Final assessment](evidence/meadow-proof-01/h-production-budget-v1-2026-09-30T22-58-49-690Z/h-final-assessment.json), [source manifest](evidence/meadow-proof-01/h-production-budget-v1-2026-09-30T22-58-49-690Z/source-manifest.json) and [preservation receipt](evidence/meadow-proof-01/h-production-budget-v1-2026-09-30T22-58-49-690Z/preservation-receipt.json) retain exact provenance. All 1241 protected non-index files keep their original hashes; the fixture guide and evidence index are intentionally updated project documents. Source snapshots preserve the final measured renderer/worker implementation. No historical acceptance images, numeric reports or fixture JSON are replaced.

Validation: the initial full `npm test` passed; eight final focused contract suites passed, including timer/assessment, instancing, grass, Meadow, wind and canopy/lifecycle checks. The final full `npm test` also passed (exit 0), including the new H assessment/timer checks. `git diff --check` passes in both repositories. `npm run test:ib075:h` exits 1 for the primary run because the production budgets fail; this is an expected gate rejection, not a hidden runner success.

**H is IN PROGRESS.** Measurement implementation is PASS; fixed-resolution performance/resource certification is FAIL and retained CPU-memory attribution remains INCOMPLETE. The following redesign is necessary before another closure attempt.


## Required redesign before H can close

1. Replace whole-cell detailed overretention with a versioned compact resident
   selection that preserves every eligible foreground root and the accepted
   density/identity. Count old presentation plus pending replacements together;
   their peak must remain at most 500,000 detailed records.
2. Submit at most 250,000 detailed instances by filtering the shared candidate
   population before drawing, with stable overlap and clump substitution. A
   vertex/fragment discard after submission does not satisfy the instance cap.
3. Batch retained instances by prototype/material with persistent resources and
   budgeted incremental updates, reducing the observed per-cell/per-width draw
   fanout to at most 32 calls. Include temporary duplication in GPU accounting;
   retain zero uploads while stationary, including animated wind.
4. Preserve usable active presentation during progressive replacement without
   duplicating an entire detailed window. Measure packet receipt plus GPU upload
   preparation against the 2 ms warm bound, and expose queue latency and stale
   work. Preserve the independent ground support/cache budget.
5. Establish attributable retained CPU memory, including worker ownership and
   metadata. Then rerun the same H1 off/on protocol. Any representation change
   must also repeat F's ordinary-app continuity review and G's wind/root checks.

Do not lower the accepted near density, remove detailed material/shadow/AA
features, silently move LOD distances, use adaptive scaling to certify the fixed
run, or revise the frozen numerical limits to hide the failure. Any accepted
appearance tradeoff needs an explicit versioned preset and evidence.

I export/UI certification remains PENDING and I–K remain blocked. B1/acceptedBy
is NOT ACCEPTED; M1 is WITHDRAWN. Overall IB-075 remains IN PROGRESS.

## Planned redesign implementation

The [H redesign sub-ledger](Observatory-Meadow-H-Redesign-Ledger.md) translates
the five requirements above into eleven dependent implementation/evidence
items. It selects small geographic rendering blocks, shared persistent record
storage, compact submission references, prototype/material batching and bounded
progressive replacement, with Meadow as the first reusable Biome Pack provider.
It includes independent GPU diagnosis, attributable CPU ownership and repeated
F/G review before unchanged-limit H certification. HR-00 through HR-08 are DONE;
HR-09 and HR-10 are NOT STARTED. The completed generation and service work
does not supersede the failed production measurements.
HR-07 now supplies bounded CPU attribution and complete telemetry. Continue at HR-09 for fresh unchanged-limit H1 certification. H remains IN
PROGRESS until the implemented design and complete fresh evidence pass.

## HR-00 delivery · 30 September 2026

HR-00 is **DONE**: source/fixture/evidence baseline verified, independent
resource/packet/selection revisions and saved-state validation implemented,
legacy compatibility preserved and measurement meanings frozen. The full
`npm test` and `npm run test:ib075:hr00` PASS, including seven CPU/browser
compatibility cases and real F1/F2 worker packed-byte parity.
Read [baseline contracts](Observatory-Meadow-HR00-Baseline-Contracts.md) and [delivery evidence](evidence/meadow-proof-01/hr00-baseline-v1-2026-10-01T00-42-18Z/hr00-report.md).
HR-01 is next; HR-01 through HR-10 remain NOT STARTED. Parent H is IN PROGRESS
with retained certification FAIL and CPU attribution INCOMPLETE. A–G retain
their bounded completion; I–K remain blocked, B1/acceptedBy NOT ACCEPTED and
M1 WITHDRAWN. No appearance, shader, population or numerical limit is retuned.

## HR-01 delivery · 1 October 2026

HR-01 is **DONE**. Implemented shared provider/service contracts, capacity
reservations before dispatch, bounded queues/workers, immutable configuration
reuse and worker ownership leases, successor packet admission, transferred
buffer ownership, generation-safe slots, size-class tail release, compatible
batch ranges and bounded compaction planning. The ordinary bootstrap exposes
the service factories and the real browser worker uses the new envelope.

Full `npm test`, `npm run test:ib075:hr01` and `npm run test:ib075:hr00` PASS
on the final stable source. The HR-01 service suite has 107 checks, including
31 malformed packet cases. CPU and real-worker payloads remain byte-identical
at 290 blades/m²: 18,640 detailed records, 256 clumps and 604,672 bytes in the
selected parent. Read [HR-01 contracts](Observatory-Meadow-HR01-Service-Contracts.md),
[delivery report](evidence/meadow-proof-01/hr01-service-v1-2026-10-01T09-43-25Z/hr01-report.md) and [verification receipt](evidence/meadow-proof-01/hr01-service-v1-2026-10-01T09-43-25Z/hr01-verification.json).

The ordinary saved-scene/renderer route and all historical fixtures/evidence
are preserved. Runtime packet revision 2 is opt-in; saved-scene tuple (1,1,1)
remains supported. GPU slots/bytes in this service are reservation credit,
not physical GPU storage. Complete CPU attribution remains INCOMPLETE.
HR-02 is next; HR-02 through HR-10 remain NOT STARTED. H stays IN PROGRESS
with its retained certification FAIL. A–G retain bounded completion; I–K
remain blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.

## HR-02 compact generation delivery · 1 October 2026

HR-02 is DONE under [its compact generation contract](Observatory-Meadow-HR02-Compact-Generation.md). The measured
three-worker pipeline and foreground replay establish generation/CPU storage
feasibility. These results are not H1 frame timings, physical GPU residency or
complete CPU attribution. The retained fixed-resolution certification remains
FAIL and H IN PROGRESS. Continue at HR-03; HR-09 owns fresh H certification.

## HR-03 persistent GPU delivery · 1 October 2026

HR-03 is DONE under [its GPU contract](Observatory-Meadow-HR03-Persistent-GPU.md). Real-worker
records batch 772 regions into four draws with identical comparison pixels and
zero stationary uploads. Fixed backend capacity is 24,236,480 bytes; prototypes
and concurrent resources are counted separately. Actual blade/clump matched
GPU costs are recorded in [the new report](evidence/meadow-proof-01/hr03-gpu-v1-2026-10-01T23-13-35Z/hr03-report.md). These are local
backend comparisons, with declared repeated records, not H1 frame measurements.
The ordinary arrival remains on its preserved path pending HR-04/HR-05. The
retained certification remains FAIL, complete CPU attribution INCOMPLETE and
H IN PROGRESS. HR-04 readiness was next at that delivery; HR-09 owns fresh H certification.

## HR-04 delivery · 2 October 2026

HR-04 is **DONE**. [Progressive readiness contracts](Observatory-Meadow-HR04-Progressive-Readiness.md),
[delivery report](evidence/meadow-proof-01/hr04-lifecycle-v1-2026-10-02T10-50-14-898Z/hr04-report.md) and
[verification receipt](evidence/meadow-proof-01/hr04-lifecycle-v1-2026-10-02T10-50-14-898Z/hr04-verification.json) record the
requested/preparing/CPU-ready/GPU-staged/active/retired lifecycle. Each committed
one-metre region has a single selected source. Prepared fine blocks activate
without waiting for the whole fine window; a conservative 4 m footprint/child/
wind guard retains usable clumps at incomplete boundaries. Unchanged allocations
are shared. Two charged reference banks preserve the old draw while the new
references upload; nonblocking last-use fences pin retired slots and whole arenas.
Renderer rebinding waits before allocating a replacement arena, and handles
identify their issuing service.

Real Chrome workers and native WebGL2 exercise partial coverage, rapid forward/
reverse motion, turns/elevation, teleport/revisit, configuration changes,
corrupt/stale packets, producer failures, explicit retry, received-packet
cancellation and disposal with work pending. Complete preparation includes API
demand/cancellation work, worker callbacks, receipt/validation, selection,
prototype/shader preparation and uploads; bounded warm maximum **1.80 ms**
passes the 2 ms criterion. Cold waits are recorded separately. Peaks are
**86,435** detailed record credits,
**94,848** slots,
**26,473,488 bytes** physical vegetation GPU and
**17,515,320 bytes** CPU credit including explicit allowances.
Stationary animated record/reference uploads are zero. Full renderer integration
uses four draws, retains independent terrain support and releases all owned bytes.
The complete regression, HR-00 through HR-04, canopy, wind and residency checks PASS.

This is bounded lifecycle evidence. Production selection remains HR-05, complete
CPU attribution HR-07, ordinary-app F/G review HR-08 and full unchanged H1
certification HR-09. H remains IN PROGRESS with retained certification FAIL and
attribution INCOMPLETE; downstream and acceptance states remain unchanged.



## HR-06 historical GPU layout - 2 October 2026

[HR-06 GPU optimisation](Observatory-Meadow-HR06-GPU-Optimisation.md) is DONE. The canonical F2/worker prototypes remain unchanged; the equivalent GPU adapter retains winning ribbon faces and the native zero-weight stem table. Its new masks, arrays, cold uploads/readbacks and measured GPU costs are recorded there. The dated measurements above retain their original sources and scopes. [HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. HR-08 admission/readiness cases and repeated ordinary-app F/G review are DONE under [integrated review contracts](Observatory-Meadow-HR08-Integrated-Review.md). Continue at HR-09 for fresh unchanged-limit H1 certification.

## HR-07 attribution update - 2 October 2026

**Completion - 2 October 2026.** HR-07 is DONE. [CPU ownership contracts](Observatory-Meadow-HR07-CPU-Ownership.md), [delivery report](evidence/meadow-proof-01/hr07-cpu-v1-2026-10-02T23-09-18Z/hr07-report.md) and [verification receipt](evidence/meadow-proof-01/hr07-cpu-v1-2026-10-02T23-09-18Z/hr07-verification.json) record an exact backing/lifetime inventory, all three worker heaps, true alias/copy and canonical duplicate accounting, received/cancelled/retired ownership, shared caches and conservative preparation/staging. Maximum retained/replacement upper bounds are **59627205 / 65697625 bytes (56.87 / 62.66 MiB)** below 64 MiB. Full regression and focused native checks PASS. Earlier direct-jump records denial and return-path slot fragmentation remain explicit HR-08 revalidation work. This closes bounded HR-07 CPU attribution; retained H1 attribution remains historically INCOMPLETE, its certification FAIL and parent H IN PROGRESS. I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.

The original measurements, failed H1 budgets and original INCOMPLETE CPU attribution above remain immutable history. New retained/replacement CPU evidence has its own source and scope; it does not turn that run into a pass. Read the HR-07 contracts before using its bounded engine-specific inventory for HR-09.

## HR-08 integrated update - 3 October 2026

**Completion - 3 October 2026.** HR-08 is DONE. [Integrated contracts and F/G review](Observatory-Meadow-HR08-Integrated-Review.md), [delivery report](evidence/meadow-proof-01/hr08-integration-v1-2026-10-03T12-41-49Z/hr08-report.md) and [verification receipt](evidence/meadow-proof-01/hr08-integration-v1-2026-10-03T12-41-49Z/hr08-verification.json) record bounded record-pressure replacement, pinned-reader fragmentation/splitting, cancellation, corruption/worker failure, backing aliases, incremental compaction, stale generations and full disposal. Real production workers complete a direct 21 m jump, the metre-by-metre return, turn/elevation and 722 packed-byte revisits without reconfiguration. The repeated F density/coverage, 37 frozen still conditions, 381 motion requests and retained native/lossless review pass their bounded criteria. G live motion, frozen/far-only negative controls, roots, rate/scrub/save and latched capture phases pass. Fresh retained/replacement CPU upper bounds are 57.95 / 63.74 MiB under the recorded scope. Full regressions and focused native checks PASS. This is integrated regression evidence, not fresh H1 certification or I/B1 acceptance; HR-09 is next.

## HR-09 certification attempt - 3 October 2026

The [integrated H1 certification runner](Observatory-Meadow-HR09-Certification.md) is implemented and full regressions PASS. The [fresh production result](evidence/meadow-proof-01/hr09-certification-v1-2026-10-03T20-14-59Z/hr09-report.md) is **FAIL**, with all 5400 matched frames, valid unique GPU samples, complete CPU ownership and no page/worker/GL/resolution errors. Resource limits and the measured 63.77 MiB CPU replacement bound pass; CPU, preparation, frame intervals and incremental GPU limits fail. **HR-09 and parent H remain IN PROGRESS; HR-10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.** The current certification entry point is `npm run test:ib075:hr09` with a fresh `IB075_HR09_OUTPUT`. H1 and E/F/G fixture bytes and numerical limits remain unchanged.
