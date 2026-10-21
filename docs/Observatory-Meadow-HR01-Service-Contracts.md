# HR-01 shared vegetation service, packets and allocation ownership

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

The HR-01 delivery history below retains its original scope; the current compact/GPU path is documented in the [HR-02](Observatory-Meadow-HR02-Compact-Generation.md) and [HR-03](Observatory-Meadow-HR03-Persistent-GPU.md) contracts.

1 October 2026 · HR-01 DONE · HR-02 next

The shared admission and ownership implementation is complete. The ordinary
bootstrap exposes the Meadow provider and worker dispatcher; the real browser
worker path prepares and transfers the unchanged parent-cell population through
the new service. Compact generation, persistent GPU storage and production
replacement remain HR-02/HR-03. Parent H is IN PROGRESS, its retained certification
is FAIL and complete CPU attribution is INCOMPLETE. A–G retain bounded completion;
I–K remain blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.

Read the [H redesign ledger](Observatory-Meadow-H-Redesign-Ledger.md),
[HR-00 baseline contract](Observatory-Meadow-HR00-Baseline-Contracts.md),
[delivery report](evidence/meadow-proof-01/hr01-service-v1-2026-10-01T09-43-25Z/hr01-report.md)
and [verification receipt](evidence/meadow-proof-01/hr01-service-v1-2026-10-01T09-43-25Z/hr01-verification.json).
Existing historical fixtures, sealed evidence, accepted requirements and source
snapshots retain their bytes. The source fingerprint and preservation audit are
in the receipt. The supported localhost server was absent at entry and was
started through `npm run start:managed`, PID 36792, port 8766.

## Integration and compatibility

[vegetation-service.js](../vegetation-service.js) implements the common service
and logical slot allocator. [meadow-provider.js](../meadow-provider.js) supplies
the first provider. [vegetation-worker-pool.js](../vegetation-worker-pool.js)
dispatches bounded jobs through [grass-worker.js](../grass-worker.js).
[meadow-field.js](../meadow-field.js) exposes `SphereMeadow.createResidencyService`;
[grass-stream.js](../grass-stream.js) exposes `SphereGrass.createVegetationWorkerPool`.
Both are available through the ordinary bootstrap.

The existing Meadow renderer and saved scenes retain resource/packet/selection
tuple `(1,1,1)`. The opt-in shared service uses runtime worker envelope
`packetRevision: 2` with the existing resource layout and selection contract 1.
This runtime envelope does not automatically upgrade a saved scene or claim a
resource-2 backend. Saved `packetRevision: 2` remains unsupported until a later
implemented scene/backend route explicitly supports it. Original legacy worker
requests, the material-descriptor route and F1/F2 payloads remain supported.

The provider uses the original 8 m parents in this step. It preserves fixed
chart coordinates, parent-root ownership, candidate lattice, accepted children,
support, exclusions, packed fields, F2 prototypes/materials and G wind. Its
radius adds a conservative validation envelope to the packet metadata; it does
not change records or production culling. HR-02 owns smaller geographic blocks.

## Provider and packet contract

Registration fixes a provider ID, positive recipe revision, schema
`sphere-instance32-v1`, 32-byte stride and `resident-chart-km` coordinates.
Provider methods define immutable configuration, bounded block normalization,
preparation estimates and payload validation. The service imposes no Meadow
prototype, botanical mesh, palette or shader on another registered provider.
The current browser worker implements the Meadow recipe; a later pack supplies
its own registered worker recipe and compatible references. Unsupported recipes
fail instead of falling through to an unbounded producer.

| Field | Meaning and admission check |
|---|---|
| Provider / recipe / record schema | Must equal the registered recipe and dispatched job |
| Scene / content key / configuration SHA-256 | Must equal the live scene and immutable configuration |
| Parent / block | Must equal the reserved geographic job; parent roots keep half-open 8 m ownership |
| Runtime packet revision | Supported successor envelope 2; placement revision is a separate contract |
| Resource / selection revisions | Existing implemented revision 1; unsupported values fail |
| Request generation / reservation token | Must identify the live dispatched reservation |
| Slot start / capacity / generation | Must match the reservation; recycled generations cannot activate |
| Bounds | Finite sphere in chart-relative km; Meadow verifies the chart centre and packed origins/envelope |
| Prototype / material references | Must exist in the provider catalogue with compatible revisions/state |
| Counts / byte lengths / group ranges | Exact 32-byte count relationship, detail/coarse totals and complete ordered group coverage |
| Content SHA-256 | Binds immutable content metadata, geographic ownership, bounds, groups and every packed byte |
| Buffer ownership | One complete `ArrayBuffer` backing a `Uint8Array`, zero offset; hidden backing tails and shared buffers fail |

The content hash excludes request/slot lifetimes and preparation timing.
Activation separately validates those lifetimes and the content hash. Batch keys
include prototype ID/revision, material ID/revision, shader variant, geometry
LOD, pass, record schema and coordinate space. Geographic block identity does
not force another batch. Compatible providers can share a key; changed material
or prototype state separates them. Catalogue revision hashes identify declared
recipe/appearance references; they are not hashes of GPU mesh allocations.

Unknown metadata fields, oversized headers, unsupported groups, overlapping or
missing ranges, mismatched identities and corrupt bytes are rejected. Header
metadata is limited to 4096 bytes and at most 32 groups. The transferred payload
becomes a service-owned backing allocation without a second retained data copy.
`resolve` returns a borrowed packet for the active handle; consumers must not
modify it or retain it after retirement. Admission does not confer geographic
readiness or authorize a production draw.

## Reservations, queue limits and ownership

Every reservation precedes dispatch. It includes upper record/detail counts,
slot capacity, GPU byte credit, retained CPU bytes, packet bytes and worker
scratch allowance. All registered providers share one inventory. A denied
reservation allocates no slots and dispatches no producer. The current defaults
are 32 queued jobs, 2 preparing workers, 128 simultaneous allocations and 65,536
records per job. H1's 500,000-detail, 32 MiB GPU and 64 MiB CPU limits are retained
as shared credit limits; no production budget pass is claimed by this contract.

The Meadow recipe restricts work to one validated 8 m parent, 4–16 area steps,
and detail/clump tier. Its upper population is 6400 canonical candidates times
five children, plus at most 256 clumps. The reservation includes the legacy
generator's intermediate typed copies and an explicit conservative object
scratch allowance. A second legacy detailed-parent job exceeds the default
shared scratch limit and is denied before dispatch. These allowances bound
admitted work; complete empirical object/worker attribution remains HR-07.

Configurations are cloned once per worker/configuration generation, not once
per block. Snapshot SHA-256 and provider descriptors are checked before the
worker acknowledges configuration and receives a job. Validation preserves the
exact hashed snapshot instead of replacing it with newly normalized camera
vectors. Main configuration ownership and potential worker copies are reserved
using serialized byte length times an explicit object allowance. Worker leases
keep old configuration credit charged until replacement acknowledgement or
termination, including idle workers.

Queued cancellation releases credit immediately. Preparing cancellation keeps
its full reservation and concurrency position until the result is discarded or
the dispatcher terminates the worker and reports `producerStopped`. Scene or
provider changes invalidate old allocations; stale results cannot activate.
Duplicate prior arrivals do not consume a newer worker job. Worker failures,
configuration failures and transfer failures terminate that worker and release
its job/leases. There is no synchronous unbounded fallback. Retry/pump is explicit.

Transferred buffers are counted once by their backing allocation. Aliased views
are not second physical populations; independent copies would count separately.
Telemetry reports reserved credits, retained populations/backing bytes,
allocated/unused slots, context owners and peaks separately. CPU-ready and
active packets own their payload; pending/preparing jobs own their reservation.
Retirement invalidates the handle and releases the service's ownership. In-flight
GPU retirement and last-use fences are HR-04, after a physical backend exists.

## Allocation and submission interface

The logical allocator uses 64-record size classes. Initial rounding wastes at
most 63 slots relative to a producer's upper bound. On receipt it releases the
unused tail and retains at most 63 unused slots for a nonempty payload, or 64
for an empty packet. The retained capacity appears in telemetry. Shrinking keeps
the base/generation valid; the accepted handle reports its smaller capacity.
Reusing a freed range always assigns a new generation.

`submissionRanges` accepts active handles, groups compatible batches and includes
only live record spans. It skips holes and rejects retired/recycled handles.
This is a submission interface, not new GPU draw accounting. `compactionPlan`
requires explicit maximum moved records and bytes and returns only fitting
moves. It never rebuilds or copies an entire arena. HR-03 implements physical
storage/copies and HR-04 supplies retirement fences before plans can be applied.

At HR-01 delivery, GPU slots/bytes were reservation credit and
`physicalGpuBytes` was zero. HR-03/HR-04 now report the attached arena.
The legacy renderer remains the ordinary production path. HR-03 must include
all real arenas, references, prototypes, padding and simultaneous old/new
resources in physical accounting before connecting this service to production.

## Verification and continuation

`npm run test:ib075:hr01` runs the common service CPU checks, Meadow provider
parity and real-browser worker checks. The full `npm test` includes both new
CPU suites. Use a fresh `IB075_HR01_OUTPUT` directory for reports and optional
`IB075_HR01_BASE_URL` for the supported localhost server.

The final HR-01 suite, HR-00 compatibility/legacy-worker suite and full regression
all PASS on one stable source fingerprint. Service checks cover 31 malformed
packet variants, admission limits, cancellation, duplicate arrivals, obsolete
scenes, slot reuse, transfer ownership, collective provider/batch compatibility,
hole skipping, bounded compaction planning and idle worker configuration leases.
At density 290 the accepted parent has 18,640 detailed records and 256 clumps,
604,672 packed bytes, byte-identical to the current CPU and browser-worker path.
Ordinary bootstrap loading also passes with saved-scene revision 1 preserved.

This evidence establishes the HR-01 service contracts. It does not establish
HR-02 granularity/throughput, HR-03 physical GPU storage, complete CPU attribution,
new F/G visual acceptance or a fresh H certification. At that delivery HR-02
was next and HR-02 through HR-10 were NOT STARTED. The current progress note
and redesign ledger supersede that continuation; HR-00 through HR-08 are DONE; HR-09 is next
and parent/downstream states remain open.

## HR-05 continuation - 2 October 2026

The dated contracts above retain their original delivery scope. [HR-05](Observatory-Meadow-HR05-Selection.md) now supplies ordinary tuple (2,2,2) demand and production selection; the preserved tuple (1,1,1)/untagged route remains. HR-00 through HR-08 are DONE; HR-08 integrated admission/lifecycle and repeated ordinary-app F/G review are DONE; HR-09 certification is next. HR-09 and HR-10 remain NOT STARTED. Bounded HR-07 retained/replacement CPU attribution PASS; the retained H1 run remains historically INCOMPLETE for CPU attribution and FAIL for certification. H remains IN PROGRESS; I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.


## HR-06 historical GPU layout - 2 October 2026

[HR-06 GPU optimisation](Observatory-Meadow-HR06-GPU-Optimisation.md) is DONE. The canonical F2/worker prototypes remain unchanged; the equivalent GPU adapter retains winning ribbon faces and the native zero-weight stem table. Its new masks, arrays, cold uploads/readbacks and measured GPU costs are recorded there. The dated measurements above retain their original sources and scopes. [HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. Continue at HR-09 for fresh unchanged-limit H1 certification.

## HR-07 historical CPU ownership - 2 October 2026

[HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. Continue at HR-09 for fresh unchanged-limit H1 certification. Read the [verification receipt](evidence/meadow-proof-01/hr07-cpu-v1-2026-10-02T23-09-18Z/hr07-verification.json) for the source-pinned scope and retained admission-stall observations. HR-00 through HR-08 are DONE; HR-08 integrated admission/lifecycle and repeated ordinary-app F/G review are DONE; HR-09 certification is next. HR-09 and HR-10 remain NOT STARTED. Bounded HR-07 retained/replacement CPU attribution PASS; the retained H1 run remains historically INCOMPLETE for CPU attribution and FAIL for certification. H remains IN PROGRESS; I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.
