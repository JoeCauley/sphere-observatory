# HR-04 progressive vegetation coverage and readiness

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

2 October 2026 · HR-04 DONE · HR-05 next

HR-04 implements bounded preparation, complete geographic replacement and safe
resource retirement on the HR-01/HR-02/HR-03 path. Real workers feed the public
renderer binding; each prepared fine region can replace its coarse source once
records, prototypes and references are ready. The bounded fixture passes the
2 ms combined warm preparation criterion at **1.80 ms maximum**. Cold waits
remain separately recorded. H is IN PROGRESS; retained H1 certification FAIL,
complete CPU attribution INCOMPLETE and all downstream acceptance gates remain.

## Runtime contract

Bootstrap loads `vegetation-lifecycle.js` after the provider. Use F2 Meadow:

```javascript
const population = SphereMeadow.createProgressivePopulation(state, {
  limits: {maxWorkers: 3, maxAllocations: 512},
  maxPending: 6,
  maxUploadBytesPerFrame: 262144
});
population.lifecycle.setDemand({fallback: coarseRequests, detail: fineRequests});
renderer.setVegetationPopulation(population);
```

Each request supplies logical parent `x/z`, metre offsets `offsetX/offsetZ`,
`blockMetres: 1`, bounded `jobMetres` (normally 2, four regions) and optional
priority 0–3. The controller forces fallback/detail tiers, rejects overlapping
coarse ownership, and requires a coarse source for every detailed region.
Demand is limited to 4,096 requests and 524,288 serialized metadata bytes;
normalized descriptors exclude arbitrary caller object fields. Default admission
is twice worker concurrency; at most one receipt and one staging allocation are
processed per frame. Worker configuration leases and transferred packet owners
retain their existing bounded service accounting.

The fixed 256×256 m chart, half-open 8 m parent identity, area acceptance, density,
root/child identity, terrain/exclusions, geometry/material/shadow/AA rules and
geographic wind remain unchanged. Portable scene tuple **(1,1,1)**, packet **2**,
compact recipe **1**, GPU backend **v1** and runtime lifecycle **1** remain explicit.
Service handles include an issuing-service namespace, scene/config generation,
slot address and fresh slot generation. They stay outside saved scene data.
The adapter currently requires F2. F1 and older scenes retain their preserved
compatibility route. HR-05 still owns ordinary default demand and production
view/LOD selection; this delivery uses the explicit runtime binding.

## Coverage and frame-boundary replacement

The reported block lifecycle is:
`requested -> preparing -> CPU ready -> GPU staged -> active -> retired`.
The underlying service queue reports requested as queued. A validated CPU receipt
owns the transferred bytes; staging completes all packed records and phase/seed
parameters. A region becomes active only when shared prototypes, shader resources
and its complete submission references are ready. The service cannot activate a
progressive handle before those references are selected.

Every requested one-metre region has exactly one selected allocation source.
Fine sources are preferred as they become ready; coarse or overlapping previously
active sources bridge unfinished detail. An entire coarse target must be usable
before a disjoint target commits. Fine blocks then commit independently without
waiting for the whole fine window. `usableCoverage` and `foregroundReady` are
separate: retained clumps never count as foreground detail ready. Teleport tests
wait for destination coarse coverage before moving the camera. Exclusions can
produce a complete empty fine region without becoming a coverage hole.

Per-reference readiness uses a conservative **4 m** guard for clump footprints,
cross-boundary children and wind. A clump changes to its near-detail rule only
when every guarded region is fine-ready. Clumps remain usable at incomplete
boundaries. Coarse storage may coexist with fine storage and remains charged;
only one coarse source per region is submitted. Unchanged allocations survive
overlap/reversal and revisits reproduce canonical packed hashes. Independent
terrain/collision support remains untouched. Coverage plans are conservatively
uncropped while a transaction uploads, preserving turns/elevation; HR-05 will
introduce production culling and LOD submission policy.

## References, retirement and byte ownership

The progressive GPU backend owns two persistent reference banks. It builds and
compares bounded runs (default quantum 4,096), uploads only changed ranges to the
inactive bank and continues drawing the committed bank. There is no payload-wide
record repack or per-reference change-object list. A bank switches at a frame
boundary only after its complete list is uploaded. Four compatible F2 families
remain four actual native draws; geographic regions do not multiply draws.

Each submitted bank receives a native WebGL2 last-use fence. Zero-timeout polling
does not block the main thread. Retired slots retain records, CPU/GPU credit and
generations until no current, pending or in-flight reference can read them.
Recycling or relocation of referenced progressive records is forbidden. Disposing
an entire arena also retains its byte charge until its last-use fences signal;
nonblocking cleanup continues after frames stop. The renderer waits before
allocating a replacement arena. A disposed or foreign service handle cannot
resolve against a new service. Context loss releases the unusable arena.

| Ownership | Progressive default allocation |
|---|---:|
| RGBA32UI packed records, including padding | 17,629,184 bytes |
| RG32F phase/seed cache, including padding | 4,407,296 bytes |
| Two 550,000-entry GPU reference banks | 4,400,000 bytes |
| Fixed GPU arena total | 26,436,480 bytes |
| Shared four-family prototypes in native fixture | 37,008 bytes |
| Native fixture vegetation GPU total | 26,473,488 bytes |
| CPU reference work array plus two bank shadows and parameter scratch | 6,665,536 bytes |
| Exact readiness grid | 65,536 bytes |
| Demand metadata reservation | Serialized bytes × 8 |

The full renderer also charges its **21,846 byte** terrain descriptor through the aggregate
GPU-capacity check. Actual arena capacity, unused slots, retained packets,
preparing/cancelled/retired credit, configuration/cache allowances and all three
CPU reference arrays are reported separately. CPU reservations and explicit
metadata/configuration allowances enforce admission but do not establish complete
object/worker attribution; HR-07 remains INCOMPLETE.

## Cancellation, failures and timing

Cancelled queued or received work releases ownership; preparing producers are
terminated before credit is released. Received backing bytes are counted as
discarded. Work terminated before producing a packet has no invented output byte
count; its elapsed wall time and ownership release are recorded separately.
Native worker failures, corrupt hashes, stale generations and malformed ownership
cannot replace usable coverage or trigger a synchronous main-thread rebuild.
Failed blocks and failed worker creation await explicit `retryFailed()`.
`reconfigure(state, {sceneKey})` terminates old workers, invalidates old references
and starts a new configuration while retaining the physical arena and safe old
slot retirement. Lifecycle disposal stops workers/receipts and cancels allocations;
service disposal also owns lifecycle cleanup.

Complete frame preparation includes API demand/cancellation/reconfiguration work
carried into the next frame, deferred worker callback costs, receipt/validation,
admission, coverage/selection, prototypes/shader preparation and record/reference
upload submission. Work is not removed from telemetry by moving it outside the
draw callback. Atomic receipt/staging operations are scheduled with staging
headroom after heavy receipts. Cold context/shader/configuration/teleport waits
are recorded apart from warm movement. This bounds the tested lifecycle fixture;
it is not the complete H1 production timing/cadence certification.

## Verification and continuation

`npm run test:ib075:hr04` runs controlled CPU failure/fence checks and real Chrome
worker/native WebGL2 evidence over the supported localhost server. Use fresh
`IB075_HR04_OUTPUT`, optionally `IB075_HR04_BASE_URL`. On this Windows runner,
`TEMP`/`TMP` point to a writable workspace directory for browser profiles.
The full `npm test` includes CPU lifecycle checks. Final verification also runs
HR-00 through HR-03 and canopy/continuity/terrain/wind/residency regressions
sequentially. Every command passes on one stable runtime fingerprint.

| Native lifecycle evidence | Result |
|---|---:|
| Combined warm preparation maximum | 1.80 ms, PASS ≤2 ms |
| Detailed record credit peak | 86,435 ≤500,000 |
| Allocated slot peak | 94,848 |
| GPU peak, including prototypes | 26,473,488 bytes ≤32 MiB |
| CPU credit peak, including allowances | 17,515,320 bytes ≤64 MiB |
| Animated stationary record/reference uploads | 0 bytes over 24 frames |
| Committed uncovered/duplicate regions | 0 / 0 |
| Received cancellation backing | 35,712 bytes counted |
| Final disposed CPU/GPU ownership | 0 bytes |

Partial commits, native worker failure/retry, corrupt/stale arrivals, rapid motion,
turn/elevation, bounded teleport/revisit, configuration, cancellation and pending
disposal pass. A separate 640×360 full-renderer fixture verifies four draws,
lighting integration, zero extra legacy-window preparation, independent terrain,
service replacement within 32 MiB and final byte release. CPU tests deliberately
hold a last-use fence unsignalled through whole-arena disposal and reject foreign
handles. Earlier failed/partial attempts remain in the evidence directory.

Read the [delivery report](evidence/meadow-proof-01/hr04-lifecycle-v1-2026-10-02T10-50-14-898Z/hr04-report.md),
[verification receipt](evidence/meadow-proof-01/hr04-lifecycle-v1-2026-10-02T10-50-14-898Z/hr04-verification.json),
[H redesign ledger](Observatory-Meadow-H-Redesign-Ledger.md) and
[state record](Observatory-Infinite-Biomes-Ledger-STATE.md). At HR-04 delivery, continue at **HR-05**
production demand/view/LOD submission selection. HR-06 diagnosis, HR-07 complete
attribution, HR-08 ordinary-app F/G review, HR-09 unchanged H1 certification and
HR-10 parent closeout remain NOT STARTED. No density/material/geometry reduction,
new F/G acceptance, H pass, I/B1, moving global meadow or J/K/M1 result is claimed.

## HR-05 continuation - 2 October 2026

The dated contracts above retain their original delivery scope. [HR-05](Observatory-Meadow-HR05-Selection.md) now supplies ordinary tuple (2,2,2) demand and production selection; the preserved tuple (1,1,1)/untagged route remains. HR-00 through HR-08 are DONE; HR-08 integrated admission/lifecycle and repeated ordinary-app F/G review are DONE; HR-09 certification is next. HR-09 and HR-10 remain NOT STARTED. Bounded HR-07 retained/replacement CPU attribution PASS; the retained H1 run remains historically INCOMPLETE for CPU attribution and FAIL for certification. H remains IN PROGRESS; I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.


## HR-06 historical GPU layout - 2 October 2026

[HR-06 GPU optimisation](Observatory-Meadow-HR06-GPU-Optimisation.md) is DONE. The canonical F2/worker prototypes remain unchanged; the equivalent GPU adapter retains winning ribbon faces and the native zero-weight stem table. Its new masks, arrays, cold uploads/readbacks and measured GPU costs are recorded there. The dated measurements above retain their original sources and scopes. [HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. Continue at HR-09 for fresh unchanged-limit H1 certification.

## HR-07 historical CPU ownership - 2 October 2026

[HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. Continue at HR-09 for fresh unchanged-limit H1 certification. Read the [verification receipt](evidence/meadow-proof-01/hr07-cpu-v1-2026-10-02T23-09-18Z/hr07-verification.json) for the source-pinned scope and retained admission-stall observations. HR-00 through HR-08 are DONE; HR-08 integrated admission/lifecycle and repeated ordinary-app F/G review are DONE; HR-09 certification is next. HR-09 and HR-10 remain NOT STARTED. Bounded HR-07 retained/replacement CPU attribution PASS; the retained H1 run remains historically INCOMPLETE for CPU attribution and FAIL for certification. H remains IN PROGRESS; I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.

## HR-08 current integration - 3 October 2026

**Completion - 3 October 2026.** HR-08 is DONE. [Integrated contracts and F/G review](Observatory-Meadow-HR08-Integrated-Review.md), [delivery report](evidence/meadow-proof-01/hr08-integration-v1-2026-10-03T12-41-49Z/hr08-report.md) and [verification receipt](evidence/meadow-proof-01/hr08-integration-v1-2026-10-03T12-41-49Z/hr08-verification.json) record bounded record-pressure replacement, pinned-reader fragmentation/splitting, cancellation, corruption/worker failure, backing aliases, incremental compaction, stale generations and full disposal. Real production workers complete a direct 21 m jump, the metre-by-metre return, turn/elevation and 722 packed-byte revisits without reconfiguration. The repeated F density/coverage, 37 frozen still conditions, 381 motion requests and retained native/lossless review pass their bounded criteria. G live motion, frozen/far-only negative controls, roots, rate/scrub/save and latched capture phases pass. Fresh retained/replacement CPU upper bounds are 57.95 / 63.74 MiB under the recorded scope. Full regressions and focused native checks PASS. This is integrated regression evidence, not fresh H1 certification or I/B1 acceptance; HR-09 is next.

The earlier dated delivery and its measurements retain their original source/scope. New controller pressure/splitting and empirical heap results are recorded in HR-08. Frozen historical JSON fixtures and sealed evidence are unchanged.
