# Endless Meadow / Biome Packs — isolated prototype P1

5 October 2026. Authorized by the user's instruction: “I authorize an isolated, versioned prototype under the existing requirements.”

## Conclusion

**The alternative has a measured GPU path worth continuing, but P1 is not a requirements-complete replacement.** A geometry-derived atlas canopy reduces the worst sampled complete incremental GPU p95 from 8.76 ms to 2.71 ms across seven controlled views. Corrected foreground coverage is 80.12%, above the unchanged 70% criterion. A separate compiled numeric coverage planner matches the current planner on 1,800 verbatim retained walk/turn poses, at 0.4 ms p95.

The atlas canopy is visibly flatter from elevation and has unresolved filtering, transition, depth and motion quality. The numeric planner is a shadow component: the renderer still executes the old receipt, planning, reference and commit paths. Actual preparation still exceeds 2 ms. CPU ownership, cadence, complete captures and rendered global continuity are unproved. No H/I/J/K/B1/M1 acceptance changes, production promotion or requirement relaxation have occurred.

**Decision supported by this prototype:** retain the compiled-product direction; continue only with a small volume/quality iteration and complete typed submission/receipt integration. Do not promote the current single-plane atlas as the finished meadow. These experiments provide more evidence that WebGL2 may meet the rendering budget; they do not establish overall feasibility or impossibility.

## Isolation, identity and deliverables

The implementation is [analysis/meadow-prototype-p1](../analysis/meadow-prototype-p1/README.md). Its render profile is `meadow-prototype-p1`, revision 2. The coverage planner's measured full replay is revision 1; its current revision 2 adds an intern-history cap and passes the controlled checks. The page compiler has its own revision-1 profile. Source and attempts are versioned by explicit profile/revision and SHA-256 manifests. No commit or branch change is claimed.

The [image comparison viewer](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/review.html) contains all seven valid pairs and their measurements. The review server exposes it at `http://127.0.0.1:60546/review` and the live isolated A/B app at `http://127.0.0.1:60546/demo` while owned PID 30568 is running. The [launcher](../analysis/meadow-prototype-p1/README.md) can start a new server if that process is later closed.

The owned runtime copy is `I:\Sphere\work\meadow-prototype-p1-2026-10-05T14-00-37-736Z\runtime`. All browser experiments use new localhost servers and browser contexts. Production port 8766 and existing user tabs were not controlled. Timing competition from unrelated host activity is not fully qualified.

The base remains:

| Identity | Value |
| --- | --- |
| Production commit | `6a52267ddf5d9d49b0f64bc75a6699f671232e77` |
| Production source SHA-256 | `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` |
| 45-asset set SHA-256 | `45f67a383ac6ec295844b3bc6ddc40e9a1d661f354d7f406bf82e6519410a91d` |
| Existing H1 fixture SHA-256 | `033caa8013b4c84feb8ef72272afb576a15128df845882796b6eb9a0828d8f71` |
| Main valid comparison | [browser-2026-10-05T14-35-40-665Z](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-35-40-665Z/run.json) |
| Evidence root | [meadow-prototype-p1-2026-10-05T14-00-37-736Z](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/) |

The snapshot reports the unchanged base build. That base hash alone does **not** identify P1: each attempt's source manifest and prototype/atlas identity identify the additional executed overlay. Saved production scene schemas and old appearance meanings were not rewritten. P1 images require their experiment metadata; they cannot be represented as accepted F2 output.

The earlier [architecture assessment](Observatory-Meadow-and-Biome-Architecture-Assessment-2026-10-05.md) and [HR09 continuation](Observatory-Meadow-HR09-Map-Preparation.md) remain intact. Applicable outer Unreal delivery gates remain separate.

## Existing requirements still govern

Authority remains the [bounded proof](Observatory-Meadow-Bounded-Proof-01.md), [redesign ledger](Observatory-Meadow-H-Redesign-Ledger.md), [Infinite Biomes ledger](Observatory-Infinite-Biomes-Ledger.md), [state ledger](Observatory-Infinite-Biomes-Ledger-STATE.md), [Biome Packs design](Observatory-Biome-Packs.md) and immutable fixtures.

H1 requires six matched 900-frame windows at 1920×1080 internal resolution, 80° HFOV, selected 60 fps, adaptive off, on RTX 5080. Limits remain full/incremental CPU p95 ≤6/2 ms, full/incremental GPU p95 ≤14/4 ms, ≥58 drawn fps, interval p95/MAX ≤18.5/33.4 ms, complete warm preparation MAX ≤2 ms and upload ≤2 MiB/frame with stationary zero. Detailed residency/submission remain ≤500,000/250,000, vegetation draws ≤32, GPU ≤32 MiB and CPU ≤64 MiB, with independent ground ≤64 MiB.

These component diagnostics do not replace H1. Stable geographic 8 m parent identities, half-open ownership, ≤2 mm root/child support, geographic rooted wind, Sphere light/shadows/log depth/atmosphere, displayed-phase pause/capture, 4K photo/panorama and later moving global continuity are still required. Nine connected semantic art variants have not been authored by this experiment.

## What P1 implements

[canopy-p1.js](../analysis/meadow-prototype-p1/canopy-p1.js) uses the same production packed coarse records, support placement and near geometry. Each F2 coarse clump uses a four-vertex/two-triangle camera-aligned quad instead of 1,152 vertices/864 submitted triangles. The CPU baker rasterizes the actual F2 clump into eight 64×64 views: four azimuths at 0° and 70° elevation, with 4×4 coverage supersampling.

Two 256×128 RGBA8 atlas planes hold unlit botanical colour/coverage and octahedral normal/depth/height. Mips physically allocate 349,528 bytes. Four view samples blend in the fragment shader; alpha tests coverage, reconstructed normals use the production lighting bridge, approximate depth enters the existing logarithmic depth contract, and geographic wind bends the quad by rooted height. The coarse fade has explicit zero/one endpoints with an integer UV rank. Near geometry and old-profile programs remain available.

This changes appearance and shader context. Keeping root bytes and near geometry does not prove identical near material bits, full clump volume, vertex-root support of the impostor, or old visual acceptance. The approximate depth describes a baked surface behind one plane, not a true volume. View blending and rigid proxy wind are deliberate weaknesses to test.

The comparison physically charges both old and new geometry, the atlas, existing native masks and allocated record/reference capacity. P1 does not claim savings from masks that remain allocated. It also retains the old cold preparation path; startup is not improved by installing the overlay afterwards.

## Invalid attempts and the diagnosed initialization defect

All earlier attempts are retained:

| Attempt | Interpretation |
| --- | --- |
| `browser-2026-10-05T14-11-27-338Z` | Launch failed creating browser temporary storage. A later attempt used the owned temporary directory. |
| `browser-2026-10-05T14-12-10-315Z` | P1 r1 timing/coverage comparisons are invalid: normal, downward and wide-lens samples have GL 1282 errors in both on arms. The unmodified native comparison ran before the overlay and is separate. |
| `browser-2026-10-05T14-25-43-500Z` | Corrected depth observer isolates the depth read as error-free but records renderer errors; coverage PASS is withheld. |
| `browser-2026-10-05T14-29-56-786Z` | Untimed GL-call trace identifies the failing near draw after late quad creation. |
| `browser-2026-10-05T14-35-40-665Z` | P1 r2 comparison: all retained timed samples, trace and corrected coverage stages have zero GL errors. |
| `browser-2026-10-05T14-47-09-534Z` | Export driver timed out on a hidden resolution control before capture; this is no export-feasibility evidence. |
| `browser-2026-10-05T14-55-12-104Z` | Corrected actual capture driver: photo/panorama files encoded, but current demand/view preparation exposes capture-contract blockers. |

The diagnosis is concrete. The existing `residentPrototype` uploader binds a new `ELEMENT_ARRAY_BUFFER`. If it is invoked while a previous near family's VAO is bound, it changes that VAO's index binding. Creating the new six-index quad during a later coarse draw corrupted a near VAO; a subsequent 60-index draw of 18,915 blades raised `INVALID_OPERATION`. The tracing attempt records the actual calls.

Revision 2 preallocates the quad with no VAO bound during isolated installation. The same settled baseline/P1/material/ID trace then records no errors. Production source was not patched. This defect explains the invalid P1 comparisons; it is unrelated evidence to the retained first-canonical material mismatch. None of the r1 numerical results is used as a performance or coverage pass.

The first offline page-product attempt also remains as `pages-2026-10-05T14-40-27-679Z`. Its observer wrongly used a coarse instance's prototype-valued `id` instead of its unique `addressKey`. The corrected compiler uses logical addresses; no production identity was changed.

## D1 — error-free GPU and foreground comparison

The valid run used Chrome 154.0.8037.95 with the native RTX 5080 renderer, ordinary UI arrival, exact 1920×1080 draws, current source/assets, fixed scene time/light and the specified per-pose wind phases. Each pose has 32 off samples and 32 alternating, counterbalanced samples per on representation: **672 retained native disjoint-query samples**. All are valid and error-free. Timed scopes contain the complete renderer draw, with no readPixels or finish. Capture and GL-call tracing are outside timing.

Off/on differences are paired by sample index, clipped at zero as in H. These short per-pose diagnostics are not six H1 windows or certification of 60 fps movement.

| Pose | Current incremental GPU p95 (ms) | P1 incremental GPU p95 (ms) | P1 full GPU p95 (ms) |
| --- | ---: | ---: | ---: |
| Normal | 8.738 | 2.662 | 4.796 |
| Grazing | 8.708 | 2.710 | 4.846 |
| Downward | 0.942 | 0.930 | 3.510 |
| Overlap turn | 8.437 | 2.585 | 4.931 |
| Elevated turn | 6.486 | 0.481 | 2.797 |
| Changed light | 8.759 | 2.679 | 4.805 |
| 110° lens | 4.126 | 1.327 | 4.489 |

Normal submitted triangles fall from 31,559,240 to 3,863,180 with unchanged reported near/coarse counts and four draws. The sampled vegetation allocation is 33,380,098 bytes, only 174,334 bytes below 32 MiB; this is limited headroom, not a general lifecycle memory qualification. All retained stationary timed uploads are zero. The return inventory contains 722 packets; comparisons of shared geographic IDs find no packet content-hash changes.

Corrected F protocol 2 uses matching terrain-depth texels, exact 24-bit uint packing, pixel-centre ROI/exclusions and the unchanged 2–15 m depth band. Grass IDs use green 190–192, blue ≤1 and nonzero red. All read/draw stages are error-free:

| Representation | Eligible pixels | Grass pixels | Coverage |
| --- | ---: | ---: | ---: |
| Current | 528,432 | 424,841 | 80.3965% |
| P1 | 528,432 | 423,358 | 80.1159% |

This establishes the measured foreground criterion only. It does not establish 200–300 blades/m² across a new global provider, motion quality, no empty eligible metre cells or human acceptance.

The seven pairs of saved images are the reviewable appearance evidence. The [normal P1 view](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-35-40-665Z/normal-p1.png) retains detailed foreground blades. [Elevated current](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-35-40-665Z/elevated-turn-baseline.png) versus [elevated P1](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-35-40-665Z/elevated-turn-p1.png) shows a flatter, mottled proxy surface and altered band/colour response. I do not count the simple plane as visually accepted. Alpha coverage alone would conceal this distinction.

## D2 — compiled numeric coverage shadow

[tile-planner-p1.js](../analysis/meadow-prototype-p1/tile-planner-p1.js) compiles canonical one-metre packet regions once into fixed numeric incidence tables. Changed requests, prepared allocations, activation, retirement and slot-generation changes mark affected cells. Winner selection preserves detailed/fallback/retained-active precedence and service insertion-order ties. A numeric 9×9 support guard updates only centres affected by changed detailed cells. Stationary input performs no region-winner rebuild.

The prototype rejects noncanonical regions and physical metadata exhaustion; it does not silently trim. It uses at most 2,048 allocations and 65,536 region incidences. After the measured revision-1 replay, revision 2 added a cap of 8,191 interned block identities before requiring rebuild/eviction. Controlled tests pass on the current source, but that small hardening change has not received another full movement replay. The long-term intern-table retirement policy is unimplemented. Typed backing is measured; JS maps/sets/entry objects still require ownership attribution.

The replay reads the **exact poseKey strings** from the retained HR09 H1 on-walk and on-turn-elevation raw files; the new attempt records their SHA-256. The real renderer draws those poses, the shadow planner observes current validated packets, and the unmodified production `candidate()` is the oracle. Every comparable winner, packet region index, missing/extra region and support flag matches across both 900-frame routes. Eligibility/readiness also matches; a null oracle is recorded rather than invented as complete coverage.

| Shadow result | Walk | Turn/elevation |
| --- | ---: | ---: |
| Planner p95 | 0.4 ms | 0.4 ms |
| Planner warm maximum after first compilation | 0.9 ms | 0.6 ms |
| First full-table compilation | 14.6 ms | Already compiled |
| Production candidate-oracle p95 | 2.2 ms | 2.7 ms |
| Maximum typed metadata backing | 2,430,368 B | 2,427,120 B |
| Real renderer preparation p95/MAX | 8.8 / 19.8 ms | 8.0 / 13.3 ms |

The cold compilation is **not** hidden as a ≤2 ms operation. It belongs in worker/offline compilation or an explicitly staged admission process in a real replacement. The recorded first frame includes it, with 21,248 dirty regions.

The real draw continues to use the old planner. The observer and duplicate oracle run outside its draw timer; they add frame work and may affect transient cache/GC history. Consequently these rows are not H1 cadence or complete CPU-budget evidence. No statistical subtraction of the oracle time from total preparation establishes a replacement pass.

The [14 current controlled checks](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/planner-unit-2026-10-05T15-06-34-209Z.json) compare the production candidate oracle through fine admission, support erosion, retirement/coarse retention, cancellation, obsolete context exclusion, slot relocation, partial pressure and chart edges, and verify the revision-2 intern-history bound. GPU fences, reference-bank submission and receipt validation still belong to the untouched service. Typed selection ranges, demand normalization, receipt/hash work, cancellation/commit integration and full warm preparation are the remaining D2 work.

## D3 — bounded products and address coordinates

[page-products-p1.cjs](../analysis/meadow-prototype-p1/page-products-p1.cjs) compiles two actual adjacent 8 m sampler parents into sorted packed products. The [successful page evidence](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/pages-2026-10-05T14-41-34-727Z/pages.json) retains the packed records and address/prototype indices:

| Parent | Roots | Detailed blades | Clumps | Records | Packed bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| (15,16), chart [-8,0,0,8] m | 3,676 | 18,380 | 256 | 18,636 | 596,352 |
| (16,16), chart [0,0,8,8] m | 3,728 | 18,640 | 256 | 18,896 | 604,672 |

There are no duplicate logical records across the two parents. Reverse generation order, moved/rotated camera and changed scene time preserve each packed product SHA. Each parent also equals the union of sixteen actual production compact 2 m storage jobs. Child world origins are checked against the real support query; maximum packed chart-origin rounding error is below 0.000001 m.

Seventeen shared-edge samples use the same support and semantic owner from either product. This demonstrates shared bounded input, not rendered river/road or feature-LOD continuity. A separate World Address level-30 +x/+z cube-edge fixture checks canonical tie ownership and matching reconstructed directions within 2 mm. That coordinate fixture is **not** a meadow planted/rendered across a cube seam.

Moving GPU page admission, eviction, reverse crossing, render rebase, actual neighbouring global terrain/feature products, shade ownership and nine connected art variants remain unimplemented. This is a useful D3 compiler/topology smoke test, not the decisive rendered-global D3 exit or J/K/M1 acceptance.

## D0 — cadence and native first-capture uncertainty

Minimal no-op headless RAF loops in these fresh contexts measure roughly 55.3–56.1 fps before loading the application. The short first-run app ABBA arms measured 48.24, 54.93, 56.93 and 56.78 fps for off/on/on/off. The first arm differs markedly; its cause is not established. Off/no-op results show that a cadence shortfall exists independently of grass workload here. They do not identify the foreground supported-browser mechanism or waive ≥58 fps.

The unmodified nine-pose native comparison passed before the P1 overlay in the first context. A [fresh native-only context without the cadence warm-up](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-41-36-634Z/native-original-order.json) also passed all nine poses, including elevated canonical first/repeat.

Thus a cadence warm-up is not necessary to obtain a pass in this setup. These contexts still have different startup/ordinary-arrival/settling histories from the retained HR09 native failure. A reproduced divergent producer or controlled causal counterfactual has not been found. The original 376-row/131,205-pixel first-canonical green-channel mismatch remains **CAUSE UNKNOWN, UNWAIVED**. New passes do not certify P1 material equivalence or rewrite old evidence.

## Captures and memory

The [actual capture run](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-55-12-104Z/run.json) invokes the ordinary `SphereApp.capture` API and retains its original photograph/scene ZIPs. The [unpacked PNG/metadata audit](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/browser-2026-10-05T14-55-12-104Z/export-readback.json) verifies actual 3840×2160 perspective and 3840×1920 panorama images, zero capture GL errors, and the six panorama face phases all equal to 1.2 seconds. The output is new experimental P1 appearance; keep its profile/source sidecar with the original ZIP, whose production scene/build labels alone do not encode the overlay.

**Encoding succeeded; complete capture readiness did not.** The 4K photograph uses 7680×4320 internally under the existing 2× supersampling. The unchanged resolution-scaled LOD/demand law requests 6,348 jobs and reports `demand-capacity` against the 4,096 request limit, while retaining previous committed references. The general foregroundReady flag remains true for the old demand, so that flag is not a proof of the latest export. There is no hidden trimming or new cap waiver.

The panorama records six latched phases, but its final face reports `viewReady:false`. Its metadata exposes only the last face's vegetation diagnostics; this is not a complete six-face coverage-union proof. Both captures emit the app's “Photograph and scene exported” completion message despite these conditions.

This is an implementation/capture-contract finding, not a WebGL limit. Source inspection confirms `renderer.prepare` prepares terrain/artwork rather than a complete meadow/view-selection transaction; capture then draws twice. A replacement must define a capture representation policy that meets the actual physical/quality limits and prepare/fence every required view before encoding. Simply reusing a preview bank or raising request/submission limits would not satisfy the existing requirements. I/B1 remain open.

The valid comparison's CDP whole-application heap plus backing upper bound is 166,353,528 bytes before large comparison observers, 166,848,872 after atlas installation and 197,120,330 after the full diagnostics. These include application/worker allocations and transient garbage; the later checkpoint includes observer activity. They exceed 64 MiB, so CPU residency remains **INCOMPLETE** under the existing H1 rule. They do not prove vegetation alone exceeds the limit. There is no new full owner/lifetime/peak audit, and the old 13-pair audit is not borrowed for new allocations.

The valid run separately records startup 81.5 s, ordinary arrival 47.2 s and the controlled normal-settle interval 47.7 s/5,075 draws. They are distinct intervals, not one warm preparation statistic. P1 installed after this old cold path; it has not solved cold startup or exhaustive native-mask probing.

## Next engineering work and stop conditions

1. **Preserve the measured triangle reduction while restoring volume.** Test a small depth-layer or sparse crossed-card canopy, with a padded/filterable atlas and explicit support/root constraints. Keep the same seven views, then add phase/turn/transition motion review and actual capture. Reject a candidate that meets alpha coverage but remains flat, changes brightness in view blending, shimmers or exposes a ring. More atlas resolution must fit physically charged memory; the current A/B allocation has only 174 KB headroom.
2. **Complete typed submission and admission, not only coverage winners.** Compile group/region range tables with packets, carry generation-stamped handles, and update bounded dirty ranges into the existing fenced banks. Include real receipt verification, hashes, demand changes, uploads, validation, retirement and callback work inside the complete preparation scope. Require warm MAX ≤2 ms and full/incremental CPU p95 ≤6/2 ms; preserve supported public/foreign-input behavior rather than changing it by accidental cache mutation.
3. **Resolve cadence/native diagnostics independently.** Compare a controlled supported foreground browser with the no-op/app-off clocks, and reproduce the retained first-capture mismatch using source-bound state/resource tapes. Keep old failures open until their actual cause is demonstrated.
4. **Only then do rendered global page joins.** Reuse the stable page-product inputs, but test actual support/feature/LOD joins, repeated crossing, eviction/cold revisit and rebase. Run unchanged H1 and affected fresh visual/wind/export/ownership regressions before any promotion proposal. The protected 11.2 km/22-join/one-rebase route and outer Unreal gates still require their own evidence.

The next small iteration can distinguish an adequate WebGL representation from a quality limitation and a remaining CPU scheduling limitation. A broad nine-province authoring effort or backend migration is not yet justified by P1.

## Preservation and current decision

The prototype [baseline](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/baseline.json) pins 996 existing non-evidence files, base source/assets and the pre-existing tracked diff. Its exclusions are .git, node_modules, work, docs/evidence and the newly owned prototype directory. Historical evidence was read only. Failed attempts are not deleted or relabelled as accepted results.

The [independent prototype review](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/prototype-review.json) rechecks all 672 retained valid GPU samples, 1,800 shadow rows, corrected coverage, capture dimensions/phase/conflicts and eight browser-attempt source freezes. The [final preservation receipt](evidence/meadow-prototype-p1-2026-10-05T14-00-37-736Z/preservation-final.json) verifies the protected bytes and identities, and inventories the new deliverables at that checkpoint. It does not claim a complete all-host process audit or retrospective repair of the older missing PID/process/context qualifications.

**Current decision:** P1 is a retained experimental implementation and evidence package. The component measurements support continuing the alternative within the authorized isolated scope. The single-plane appearance, full preparation, CPU attribution, capture completeness and global runtime remain blockers. Production and HR09/H/I/J/K/B1/M1 statuses remain unchanged.
