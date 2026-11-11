# Installed native terrain preparation in Main

**10 November 2026 · bounded native support/transform result PASS · formal P-05 OPEN.**

Later current Main work adds a complete-viewport 216 m patch and a new triangle-local/CPU-projected stream; see the [full-viewport result](Observatory-Main-P05-Full-Viewport-Stream-2026-11-10.md). The evidence below remains the earlier 144 m preparation and its original source identity.

Ordinary Main can prepare the actual installed Track Meadow terrain in its existing WebGL2 context, inspect every uploaded vertex through the fixed linked native program, query support from the retained terrain triangles, reuse the preparation, and retire it completely. The canvas continues to show the installed overview. The proposed local pose is a proof input; no local camera arrival or fragment draw has been committed.

The [browser evidence and verifier](evidence/p05-main-local-20261110-072849/README.md) retain the exact final source, failures and result. Full WORK is `I:\Sphere\work\p05-main-local-20261110-072849`.

## Actual result

The existing world, release, binding, region and all 59 assigned cells are unchanged. The binding is `d804c1e5bf5abae3a1de2dcd39ed96a322138d11e2c09f4396ed88f5336d73bb`; release is `82d3def0955d5f042ad4e41569ad400cc2d47e55be7c008ec4d63a8377da87ce`; region is `region-5a0b0af51532e115d553154106a5c8d1`. No service-storage writes occurred.

The bounded patch uses the assigned generator origin, a prospective eye at 160 m inward height, and a 144 m support disk. It contains 4,397 terrain vertices plus 512 population vertices, 8,656 total triangles and all 64 passable population features. All 4,909 uploaded vertices were read back and checked through transform feedback on the actual fixed native program. The directed whole-facet radial bound including the root transform is **0.0009851298554200733 m**, below 1 mm. This bound is specific to the retained pose, viewport, complete vertex ranges and exact shader sources.

West, north and east landmark semantic heights are 2, 3 and 4 m. Retained-triangle support differs by at most `8.881784197001252e-16 m` at those three queried points. The whole-facet proof, rather than these three samples, supplies the numerical error enclosure.

The observed common logical metadata peak is **27,075,253 B** under the unchanged **33,554,432 B** limit. Main's 8 MiB install working slot remains charged throughout; it was not retired to make this fit. The common prospective GPU capacity peak is **6,299,648 B** under **10,485,760 B**. This includes a full 6 MiB native resource-host loan and the installed overview's 8,192 B ownership texture. The loan is a conservative capacity reservation, not a physical driver-memory measurement or a sum of independently observed peaks. Native heap, compiler/driver memory and quiet performance remain unmeasured.

A repeated check has identical proof and resource counters: no new native allocations, jobs or upload work. Explicit release waits two browser turns for fence status and reaches zero physical local resources, logical leases, CPU/GPU readers, retiring resources and jobs before refunding the native capacity. CPU buffers are actually detached. Program, VAO and admitted source readers retire. The 8,192 B overview remains, and the common logical held budget returns to its pre-check value.

## Versioned design

`main-install.v5.js`, browser boot v6 and profiles v5 select this route. `service-resources.v1.js` owns one common GPU capacity allowance and prospectively charged CPU buffers. Native R receives CPU allocation/detachment hooks and enforces its entire 6 MiB child GPU capacity, including factory-created resources, staging and fenced retirement. No extra independent native GPU allowance is introduced.

`main-overview.v2.js` keeps the original 512-wide shader addressing and all 262,144 supported nodes. It allocates every row required by the complete verified index, rather than materializing unused maximum-capacity rows. The actual 39-node binding needs one 8,192 B row. Maximum supported ownership geography is unchanged; an overlapping replacement that exceeds the parent limit still refuses.

The original binding owner correctly rejected the newer registry preparation profile with `INVALID_REGISTRY`. The current route uses versioned `surface-kernel.v2.js`, `terrain-mesh.v2.js`, `provider-host.v2.js` and `local-field.v2.js` under distinct namespaces, with the authentic preparation-v2 binding owner. The old files and old checks are preserved. The new Main host adapter validates the exact fixed recipe through the original compiled semantic factory, verifies provider negotiation/reference identity, and constructs its versioned host provider bridge. Its additional host code is pinned in the new Main source profile. This is a new host integration result, not a claim that the original native runtime closure has been qualified unchanged.

The original released pack, provider envelope, codec envelope, host closure and every source file in that provider closure are byte-preserved. The final source manifest contains 143 files and the new service closure contains 83 entries. Fixed linked native shader hashes are vertex `3384bd6625545bc53f7052dac9b5508e248febd957c9fe0a838b6f4c7e588339` and fragment `099a1db5802d2f0841c7dc5694288c04489e686903155faf9b090c5428f19e75`.

## Preserved failures and checks

- Original-owner reuse refused the genuine preparation-v2 registry. No registry, profile identity or owner brand was rewritten to pass it.
- The first native GL attempt refused an unbound scratch VAO. Binding and restoring that exclusive VAO fixed its actual WebGL admission. Its retained reservations were released.
- The first retirement tried to start a frame after R had closed. A subsequent synchronous drain still observed pending fences. Both attempts retained the entire GPU capacity and remaining physical resources. The final asynchronous retirement waits for observable completion; it does not refund on intent to delete.
- One repeated-check UI click timed out. Fresh visible state was inspected before a successful documented click. The final cached and retirement records passed.

Current scoped controls pass: common resources 10 checks; classic boot 56 modules and 60 missing-namespace refusals; installed binding/overview 12 controls and 35 assigned component cells; cross-version/fixed-recipe ownership 7 controls. Unchanged resource-leases tests pass 55 groups/92 refusals/61 owner closures; positions backend passes 13 groups/15 refusals.

The frozen `biome-service-native-fixed-program.cjs` test remains **FAIL** at its historical host-source pin. `pack-library.js` differs from the frozen golden but matches this batch's before snapshot. `places.js` also differs from that golden; it was not in this batch's before snapshot and was not edited here. Neither file nor the golden was changed to obtain a pass. The failed attempt and exact mismatch list remain retained. Current Main source-admitted shader evidence is separately scoped and does not erase that failure.

## Remaining boundary

`NATIVE_FRAGMENT_FIELD_UNQUALIFIED` remains the actual whole-view refusal. The native result explicitly has `visualCoverageReady: false`, `nativeCoefficientVerified: false`, `fragmentTransportQualification: NOT_RUN` and `travelCommitted: false`. The generic native resource ledger's historical `NOT_GPU` label is retained; actual WebGL program/readback evidence is supplied separately, without relabeling the ledger or claiming physical memory measurement.

The next bounded implementation must admit the actual fragment field and coherent Main uniform/texture transport, establish complete viewport/terrain coverage, and connect a held local view to the normal commit owner. The current 144 m disk must not be assumed to cover the full 160 m-high view. Do not expose walking or local Go/landing as qualified based on this preparation alone.

Actual local rendering, the overview's 2-physical-pixel geographic bound, required boundary/seam/pole cases, Open Industry, and remaining qualification are open. The stricter fresh dedicated browser profile is still NOT DEMONSTRATED. This result does not close P-05, P06–P08, Phase One, acceptance or release.
