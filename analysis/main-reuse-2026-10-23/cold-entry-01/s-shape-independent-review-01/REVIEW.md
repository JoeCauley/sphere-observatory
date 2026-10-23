# Independent review of the narrow S.shape scan counter

Reviewed frozen candidate `initializer-01/cold-shape-candidate-01/source/biome-service/native/source-admission.js`, SHA256 `15495ba84a47113bcc10c2e5b2fba4057ead1a420222f016c45b886fe222fea3` (16948 bytes), against selected C03 parent `d1676c985688bb3330ae2e35e1194c8b2c05116652939e1b183e0047751d8a7f` (16839 bytes). Both full 521-row source trees were copied to this fresh review folder. Original T/C03 and author candidate remain untouched.

**The two-hunk implementation correctly closes the explicit inherited-row loop gap.** There is no additional blocking defect in this bounded change. It does not establish a complete cold work/storage contract and must not be installed under stale source profiles.

## Actual reproduced defect and correction

The old `S.ownRecord` accepts an empty ordinary object after 4097 inherited `for-in` rows, although its own-node limit is 4096. The old two-array nested case accepts after 4098 total observed rows. These are actual copied S/Q/Records calls, not a replacement shape implementation.

The candidate initializes one `scannedKeys` cell in the existing shape activation and increments it before `Object.hasOwn` or inherited-row skip. It is shared by all recursive visits. At most `maxNodes` rows reach `hasOwn`; the next yielded row fails before the descriptor/child work. This is a bound on explicit JavaScript loop-body observations, not native enumeration-engine work.

Independent controls pass 14 groups:

* Old inherited overflow and nested shared-counter witnesses reproduced.
* Exact 4096 inherited rows accepted; row 4097 refused. Inherited accessors were never invoked.
* Two empty arrays with 2047 inherited rows each plus their two root properties use exactly 4096 rows and pass. With 2048 each, the shared counter refuses after 4096 `hasOwn` calls. A per-object reset would incorrectly pass this test.
* Clean exact 4096 own-node array remains accepted; 4097 own nodes refuse.
* Depth 32 acceptance/depth 33 refusal, own accessors, hidden/symbol properties, sparse arrays, cycles and foreign ordinary-record prototypes preserve their previous outcomes, with no getter invocation.
* Genuine Q pressure refuses before inspecting input. Every successful record charge and every refused scratch path returns to the original Q base; actual Q disposal then reaches zero.
* Ordinary null-prototype/extension/array values preserve their exact canonical result.

The author's exact source controls were independently replayed from fresh copies, with only their two source-directory paths changed. All 11 groups pass. They independently reproduce the smaller `maxNodes:4`/8192 inherited-row witness, preserve exact clean object and array limits, check the three actual C03 bootstrap envelopes (883/37/57 nodes; 30422/1196/1899 canonical bytes), and prove that unchanged C03 graph source admission refuses the changed S foundation with Q/S rolled back. The old graph was not repinned or accepted as the new source.

## Accepted data and source-policy boundary

For clean ordinary records/arrays, each enumerable own property leads to exactly one recursive child visit. Therefore successful own rows are `nodes - 1`, at most 4095 under the original 4096-node limit. The new scan guard cannot reject previously admitted clean data solely because of its own rows. It adds refusal for excessive ambient inherited enumeration, including repeated inherited rows across nested objects. Node/depth/string/array/descriptor/cycle/hidden/symbol guards are byte-exact unchanged.

The counter has no per-key allocation and adds no new function/callable. It adds one numeric cell to the existing invocation/recursive closure and one bounded increment/comparison/possible existing-failure call per yielded row. Under validated ownRecord ceilings it cannot approach unsafe integer arithmetic. The cell does not escape successful or failed shape execution. The new error text is a module/source literal; the existing `fail`/error path is reused.

This structural observation is **not a fee or an ownership waiver**. A future complete cold contract must explicitly attribute the additional scalar activation/module increment, every added row check and the new failure path to its actual pre-reserved caller/scratch/module account. No price can be inferred from residual4096 capacity or from these test counts. Existing Records/Q/S startup foundations, script/module/API births, retained errors and full instance/native-VM storage remain in their declared wider boundary; this review does not silently qualify them.

The fix also does not bound native `for-in` key enumeration, a large native `Reflect.ownKeys` result, or arbitrary caller Proxy traps. Those declared wider cold/input gaps remain open. Do not broaden this repair into an unrelated hostile-runtime attestation exercise or call it full S.shape/whole-Main qualification.

## Disposition

Suitable as a **narrow functional source repair proposal**, after root's exact source/work/activation disposition and coherent reprofiling. Preserve T/C03, its handoff receipt and the failed old witnesses. Do not change Base/Main gates or inherited tariffs merely because these source controls pass. No Main, browser, server, native, Frame, physical heap or P05 promotion occurred here.
