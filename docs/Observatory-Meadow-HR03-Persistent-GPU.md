# HR-03 persistent WebGL2 vegetation storage and batching

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

1 October 2026 · HR-03 DONE · HR-04 was next at this delivery

HR-03 implements the shared GPU path from real Meadow workers through admitted
service packets and the production renderer. It adds persistent packed record
storage, immutable shared prototypes and compatible dense slot-reference batches.
The ordinary arrival keeps its preserved residency path pending HR-04 readiness
and HR-05 production selection. This delivery proves the explicit new backend;
it does not claim progressive foreground coverage or a new ordinary F/G review.
H remains IN PROGRESS, retained H1 certification FAIL and CPU attribution
INCOMPLETE. I–K remain blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.

## Runtime and revision contract

Bootstrap loads `vegetation-gpu.js` after the shared service. Configure/admit
compact Meadow requests using the HR-01/HR-02 interfaces and real worker pool.
Given their live service handles, bind the population through the public renderer:

```javascript
const population = SphereMeadow.createGpuPopulation(service, state, handles);
renderer.setVegetationPopulation(population);
```

The renderer refreshes frame/chart/camera and wind uniforms, validates scene
content identity and consumes the handles without preparing a second ordinary
Meadow window. Service objects/functions, request tokens, slot generations and
GPU ownership stay outside saved scene/state and worker clones. Clear a binding
with `renderer.setVegetationPopulation(null)`; the owning pass releases its GPU
backend. CPU packets remain caller-owned for later bounded backfill/rebinding.

Portable scene tuple (resident resource, packet, selection) stays (1,1,1).
Runtime service packet 2, compact metadata 1 and the 32-byte
`sphere-instance32-v1` / `resident-chart-km` schema retain their existing meaning.
`vegetation-chart` identifies a runtime submission adapter, not a portable
resource-2 migration. The backend ID is `rgba32ui-rg32f-slot-references-v1`.
Canonical parent/root/child identity, density, support, exclusions, prototype
geometry, quaternion attribute interpretation, materials and geographic wind
remain unchanged. No original fixture JSON or numerical target is retuned.

## Persistent layout and ownership

Two RGBA32UI texels retain each unchanged packed record. Float position/scale
bits are preserved; signed quaternion and byte colour fields follow the original
normalized attribute interpretation. The original phase/seed UNORM16 fields are
rounded through a bounded CPU Float32 scratch into a persistent RG32F cache.
Pure integer vertex decoding produced small seed/dither differences in exploratory
pixel comparisons. The cache preserves the actual native attribute values and
passed the original shader/pixel criteria. All cache storage/uploads are counted.

| Allocation at default service limits | Dimensions/capacity | Allocated bytes |
|---|---|---|
| Packed records, RGBA32UI | 2048 × 538 texels; 550,016 service slots; 896 padding slots | 17,629,184 |
| Normalized phase/seed, RG32F | 1024 × 538 texels, including the same padding | 4,407,296 |
| GPU references | One fixed 550,000-entry buffer, four bytes per reference | 2,200,000 |
| Fixed GPU backend total | Record, cache and reference capacity | 24,236,480 |
| Shared prototype vertex/index buffers in the F2 fixture | Four immutable families | 37,008 |
| CPU reference/current shadow arrays | Two 550,000-entry Uint32 arrays | 4,400,000 |
| Reused CPU parameter scratch | 8192 two-float entries | 65,536 |

Full capacity is charged, including unused slots and texture padding. Prototype
resources, generic/legacy environment buffers and other attached backends are
included in the pass inventory. The independent ground descriptor is included
when enforcing the physical GPU cap and remains separately reported by ground
telemetry to avoid double counting. Old and new resources cannot each hide behind
their own credit limit. Underfunded attachment/prototype acquisition is rejected.
The existing 32 MiB GPU and 64 MiB CPU limits remain unchanged.

CPU backing is 4,465,536 bytes plus admitted packets and existing service/worker
ownership. Record upload views share transferred packet backing; there is no
complete second record array. The parameter scratch is a real bounded cache
copy, reported separately. Reservation credit, retained payload, physical GPU
capacity and temporary comparison copies have separate counters. Full empirical
object/worker attribution remains HR-07; this inventory does not close it.

## Batching, staging and lifetimes

Batch compatibility includes prototype/revision/content hash, material/revision,
shader family, geometry LOD, pass, record schema and coordinate units. F1, F2
and opaque shader routing is explicit. Transparent sorted providers and other
schemas require supported adapters; no second Biome Pack is delivered here.
Each geographic region retains its conservative visibility bound. The high bit
of each four-byte reference carries detail readiness; the lower 31 bits address
the record slot. Compatible clumps with and without detail share a real draw
while keeping their original fragment behaviour.

Records/cache and changed reference ranges upload incrementally from one frame
budget. Actual staging costs 40 bytes per record, references four bytes each,
and new immutable prototype buffers their full byte lengths. CPU-ready records
cannot activate through an attached GPU service until their complete allocation
is staged. Only complete selected reference lists submit; partial reference
uploads wait. HR-04 must supply progressive coverage/commit/retirement rather
than treating this wait as foreground readiness.

Selection storage, textures and VAOs persist. Stationary animated wind changes
uniforms without record/prototype/reference uploads. Release, cancellation or
scene change invalidates staged identities and selection. Submission validates
scene/request/reservation/slot lifetimes. CPU-only address compaction is forbidden
after GPU attachment. Bounded physical compaction reuploads only a ready packet
to a nonoverlapping free range, changes slot generation and invalidates all old
references. Same-context ordered WebGL commands preserve earlier queued draws;
the broader progressive replacement/last-use/coverage contract remains HR-04.

## Actual GPU and worker evidence

The final run used Chrome 154.0.8037.92 on ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11). Three real workers prepared 193 jobs / 772 regions with 225,328 unique and submitted records. Intercepted `drawElementsInstanced` calls are **4**, one per compatible family, not one per block. The shared clump draw contains 16 fallback clumps and 3,072 clumps with detail.

Initial staged submission used 38 frames at at most 262,144 total upload bytes per frame. **24 stationary animated frames uploaded zero record/prototype/reference bytes** and reused the same storage/VAOs. Movement prepared 2 new worker jobs, uploaded 98,080 new record/cache bytes and stayed within 262,144 bytes per frame. 4 bounded relocations uploaded 187,160 bytes; obsolete handles were rejected.

Transform feedback compares all normalized packed fields and the production F2
blade/clump vertex outputs at wind phases 0, 2468 and 2472.5. Position/normal,
colour/parameters and geographic wind pass their original tolerances. The 512 ×
288 framebuffer comparison changes zero pixels against both the original per-
region packed path and a packed path with the same batch ordering. These are
backend regression fixtures, not the ordinary F/G acceptance protocol.

| Actual F2 mesh | Submitted / unique / repeated records | Matched pairs | Packed median ms | Slot median ms | Ratio |
|---|---|---|---|---|---|
| detailed-blade (48 vertices) | 200,000 / 102,233 / 97,767 | 40 | 3.1793 | 3.2869 | 1.0339 |
| large-clump (1152 vertices) | 8,192 / 3,088 / 5,104 | 40 | 1.6323 | 1.6811 | 1.0299 |

Native timer pairs alternate packed/slot order after warmup; disjoint/unavailable
samples fail. No readback, finish or encoding occurs inside timing. Pixel/transform
feedback and full-renderer coupling happen outside those windows. Repeated local
records are explicitly counted as submissions; unique populations are separate.
The comparison uses production F2 meshes/shading in the declared fixture with
its shadow fallback. Full renderer coupling separately exercises current lighting,
material revision and atmosphere composition. These local costs support backend
feasibility and do not replace H1's complete matched production frame protocol.

Comparison peak GPU ownership is 31,520,992 bytes, including packed/reference/prototype comparison copies; temporary CPU record copies peak at 7,200,000 bytes. Comparison resources are disposed before incompatible temporary allocations. Full-renderer coupling reports 24,273,488 vegetation bytes including shared prototypes, four actual draws and zero prepared default-window cells. The run ends with zero WebGL/worker/page errors and zero disposed GPU backend bytes.

## Verification and next work

Run `npm run test:ib075:hr03` with a fresh `IB075_HR03_OUTPUT` and the supported
localhost server, optionally `IB075_HR03_BASE_URL` / `SPHERE_BROWSER`. Hardware
GPU timers are required for the GPU comparison; software-only timing is rejected.
Final full `npm test`, HR-00 through HR-03, canopy, canopy continuity/ground,
geographic wind GPU and resident GPU regressions all PASS sequentially on one
runtime source. Exploratory failures, snapshots and all prior evidence remain.

At HR-03 delivery, HR-04 partial arrivals, coverage/commit, cancellation, reversal
and last-use ownership was next. HR-04 and HR-05 are now DONE; HR-05 supplies production selection
and submission caps, HR-06 further GPU diagnosis, HR-07 complete CPU attribution,
HR-08 repeated ordinary-app F/G review, HR-09 fresh unchanged-limit certification
and HR-10 closeout. No H/I/B1/J/K/M1 acceptance state is advanced.

Read [H redesign ledger](Observatory-Meadow-H-Redesign-Ledger.md), [delivery report](evidence/meadow-proof-01/hr03-gpu-v1-2026-10-01T23-13-35Z/hr03-report.md) and [verification receipt](evidence/meadow-proof-01/hr03-gpu-v1-2026-10-01T23-13-35Z/hr03-verification.json).

## HR-05 continuation - 2 October 2026

The dated contracts above retain their original delivery scope. [HR-05](Observatory-Meadow-HR05-Selection.md) now supplies ordinary tuple (2,2,2) demand and production selection; the preserved tuple (1,1,1)/untagged route remains. HR-00 through HR-08 are DONE; HR-08 integrated admission/lifecycle and repeated ordinary-app F/G review are DONE; HR-09 certification is next. HR-09 and HR-10 remain NOT STARTED. Bounded HR-07 retained/replacement CPU attribution PASS; the retained H1 run remains historically INCOMPLETE for CPU attribution and FAIL for certification. H remains IN PROGRESS; I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.


## HR-06 historical GPU layout - 2 October 2026

[HR-06 GPU optimisation](Observatory-Meadow-HR06-GPU-Optimisation.md) is DONE. The canonical F2/worker prototypes remain unchanged; the equivalent GPU adapter retains winning ribbon faces and the native zero-weight stem table. Its new masks, arrays, cold uploads/readbacks and measured GPU costs are recorded there. The dated measurements above retain their original sources and scopes. [HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. Continue at HR-09 for fresh unchanged-limit H1 certification.

## HR-07 historical CPU ownership - 2 October 2026

[HR-07 CPU ownership](Observatory-Meadow-HR07-CPU-Ownership.md) is DONE, with explicit buffer/copy/cache lifetimes, complete measured main/worker metadata and retained/replacement upper bounds of 56.87 / 62.66 MiB below 64 MiB under the recorded scope. Continue at HR-09 for fresh unchanged-limit H1 certification. Read the [verification receipt](evidence/meadow-proof-01/hr07-cpu-v1-2026-10-02T23-09-18Z/hr07-verification.json) for the source-pinned scope and retained admission-stall observations. HR-00 through HR-08 are DONE; HR-08 integrated admission/lifecycle and repeated ordinary-app F/G review are DONE; HR-09 certification is next. HR-09 and HR-10 remain NOT STARTED. Bounded HR-07 retained/replacement CPU attribution PASS; the retained H1 run remains historically INCOMPLETE for CPU attribution and FAIL for certification. H remains IN PROGRESS; I-K blocked, B1/acceptedBy NOT ACCEPTED and M1 WITHDRAWN.
