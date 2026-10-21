# Infinite Industry — II-001

13 October 2026. Browser Observatory / The Final Museum. **II-001 implemented and locally verified.** The current-source deterministic, public browser, walking, save/revisit and bounded-residency gates pass. This is a delivery through the existing scene-pack library, with the performance and startup limitations below. Only II-001 is authorized; it does not promote Biome Pack Service, legacy Meadow H1 or outer application release status.

## The implemented place

One 150 m across-flats water-processing facility occupies axial hex `0,0`. This width supports a 57 m covered processing hall, two 22 m clarifier basins, two 21 m storage vessels, a recovery raceway, and a 9 m elevated inspection gallery while keeping exploration distances reasonable. Width remains an explicit recipe/boundary parameter; seam contracts are tested at 100, 150, 200 and 300 m. This milestone does not populate the six support hexes.

The process is **intake → treatment → storage → distribution**. A contextual routing wheel diverts the treatment output into a recovery raceway and return pipe. The wheel changes its visible position, the return circuit gains moving flow markers, the distribution markers stop, and the recovery basin fills. Only a walking visitor near the wheel can operate it. The clarifiers have slowly rotating sweep machinery. There are no inhabitants, drones, neon signs or holograms.

The open-front hall has steel roof trusses, a longitudinal skylight, pressure filters, connected manifolds, repeated flanges and column footings. A supported ramp reaches the gallery and its inspection view over treatment, intake and storage. Both service corridors extend through their actual shared hex boundaries to short receiving manifolds. These are connection continuations, not additional complete facilities.

## Actual library contract and reuse

Inspection found two distinct Meadow tracks. The older Watershed `SpherePacks` registry includes the bounded Meadow overlay and its unfinished HR-09/H1 certification. Delivered **Infinite Meadow 1.0.0** uses `SpherePackLibrary` and `packs/runtime/v1`, with an explicit full-document visit. Industry uses this newer contract. The empty Biome Pack Service ZIP catalogue remains separate; this work does not complete or release that service.

| Contract | Industry |
|---|---|
| Library entry | `pack-infinite-industry` |
| Pack identity / version | `infinite-industry` / `1.0.0` |
| Shared runtime | API 1, `packs/runtime/v1` |
| Geography | `industry-water-v1`, seed `9187` |
| Appearance | `builder-water-v1` |
| Stable site / address revision | `industry-water-0-0` / `industry-address-v1` |
| Coordinate frame | Existing `shell-tangent-metres-v1`, signed 256 m cell/local addresses |
| Storage | `sphere-pack:infinite-industry:1.0.0` |
| Facility geography | Axial `q,r`; width and six-step orientation explicit |
| Resident scenes | One scene and one WebGL context per document |
| Detail limit | Four prepared/rendered zones, one worker, 2 MiB packet credit |
| GPU limits | 16 MiB buffers, zero allocated textures |

Visit **Explore → Biome Packs → Infinite Industry → Arrival court / Above the water works / Continue → Visit**. Direct address: `http://127.0.0.1:8766/packs/infinite-industry/1.0.0/index.html`. The Observatory viewpoint and journey remain in their own store. Pack visits do not migrate saved Meadow or legacy worlds.

`IndustryRenderer` extends Meadow's existing renderer, which owns the WebGL2 context, sky, shell, lens, lighting, depth convention and GPU timer queries. The adapter retires unused Meadow terrain/landmark buffers in its own instance and supplies industrial geometry through the existing mesh shader. Meadow source files are not edited. Static repeated details are batched by zone with shared vertex materials; small machinery/flow batches change during operation. Paused processes reuse their mesh.

Industry imports the existing Meadow coordinate functions, AU-scale shell frame, camera basis and origin convention. Prepared geometry remains local to its facility. Double-precision geographic anchor deltas are calculated before GPU float conversion. Rendering never determines geographic identity.

The shared host retains manifest validation, exact asset integrity, versioned saves, independent bookmarks, eye-following stage, one context, listeners, clocks, recording streams, object URLs, checkpointing and GPU disposal. Twenty-one shared dependencies are pinned in the Industry manifest. Additive `runtime/v1/navigation.js` generalizes Meadow's movement integrator through support/collision callbacks; walking results and the flight-speed curve are checked against Meadow. Neither Meadow's controller nor the legacy controller is replaced.

## New modules and interfaces

The versioned pack's `facility.js` defines the deterministic recipe, process graph, axial anchor, six zone bounds, synchronous support/collision, columns and contextual control. `boundaries.js` defines axial centers, 60-degree rotations, edge identities, seam specifications and compatibility. `geometry.js` builds all representations from the same recipe. `prepare-worker.js` transfers zone packets. `renderer.js` supplies batched content. `model.js` validates industrial state and canonical addresses. `app.js`, `entry.js`, `index.html` and `style.css` supply the host adapter, movement conventions, public controls, recordings, saves and measurements.

Additive `runtime/v1/preparation.js` supplies bounded preparation under the existing host. It owns no renderer, camera, navigation, clock or animation loop. Stale/cancelled generation-tagged packets cannot become resident. Eviction removes near buffers; fallback structures remain available. Disposal terminates the adapter's worker, including after renderer construction failure.

`scripts/build-industry-manifest.cjs` freezes authorized source updates. `tests/industry.mjs` checks generation, interface geometry, walking, support, collision, save safety, movement parity, large anchors and failed/stale receipts. `tests/industry-browser.cjs` uses the public application and public controls, records the collision-driven route, downloads actual saves/video, collects 900-frame windows and repeats exits/revisits. It does not inject a synthetic scene or set a private camera state.

## Determinism and two real seams

The recipe hashes geography revision, seed, axial address and independent named selection keys. One hundred seeds exercise all six rotations, both restrained material treatments and both hall-bracing variants. The future grammar declares five facility models, five Big Plant models, ten treatments and five connection layouts; those are target capacities. Two structural variants, two treatments and one connected layout are implemented.

Each seam is identified by its sorted pair of axial cells, revision, seed and width. Its center, normal, pipe position/elevation, 4 m pedestrian width, 6 m corridor width, 4 m clearance, traversal status, purpose and opposing-flow requirements derive once. Both neighboring callers receive identical specifications. Actual pipe endpoints derive from the seam after rotation. Six potential interfaces exist; intake and distribution are enabled. No multi-pod solver is implemented.

Support is ready synchronously. Tanks, filters, columns, conservative roof clearance, railings, process pipes and rack supports do not depend on worker detail or visibility. The gallery is reachable from the ramp through open landings. The public inspection uses the same movement/collision path and pauses at meaningful viewpoints; WASD takes control immediately. Space + E lifts off, Q/E descends/climbs, and F lands near support.

## Verification results

| Current-source check | Result |
|---|---|
| `npm test` | All 61 existing Observatory suites PASS |
| `npm run test:pack` | All 16 original accepted-pack checks PASS |
| `npm run test:industry` | All 19 deterministic/interface/navigation/ownership groups PASS |
| `npm run test:industry:browser` | All 22 public browser groups PASS in final `native-04` |
| Separate visible Chrome full walk | All seven stops, control, gallery and both boundaries; 8,444 frames; zero page/worker/WebGL errors |
| Separate visible Chrome stationary timing | 900 complete frames at each of 1440 × 900 and 1280 × 720 |
| Owned-resource exit/revisit | Three real exits, zero GL resources/buffer bytes/listeners/frames/timers/streams/URLs; exact Observatory state and journey preserved |
| Meadow preservation | All 23 versioned Meadow files and all original shared runtime files remain byte exact to the starting inventory; public native Meadow Visit still works |

The deterministic tests walk the complete hall/ramp/gallery/both-boundary route in all six rotations, with an exactly 9 m traversed platform. Tests also cover all six authoritative seams at four widths, stale/cancelled/over-budget preparation, 100 seeds, large axial anchors, existing Meadow movement parity and stable rendering packets. Every near packet stays below 2 MiB. Unknown revisions, invalid bookmarks and unsafe positions fail before replacement. Rejected existing Industry saves are retained until an explicit new save or successful import.

The actual native route enters through **Explore → Biome Packs → Infinite Industry → Visit**, walks the hall and both boundary corridors, operates the nearby R control, reaches the gallery, returns to flight and revisits. It checks a changed rendered interaction, exact checkpoint/reload state and pixels, distinct saved-bookmark return, portable save import, explicit flying arrival and ordinary Q descent/landing. It also visits Meadow through the public library. The successful integration run uses installed Chrome in headless mode with the actual NVIDIA WebGL2 hardware renderer; the visible-window walk and timing runs below are separate. None sets a private camera pose or injects an alternative renderer.

The source-qualified logs are `checks/standard-tests.log`, `checks/pack/pack-tests.json`, `checks/final/industry-tests.json` and `evidence/native-04/browser-results.json` under the work directory. The Service's own 40-component frozen results are separate evidence and are not counted as II-001 checks.

## Performance measurements

Hardware renderer: NVIDIA GeForce RTX 5080, installed Chrome, WebGL2. Values below are frame intervals from complete browser frames, not average FPS. Each stationary row contains 900 frames. The full walk keeps machinery running, traverses both seams and three floating origins, and includes the causal routing interaction. It has no recording, screenshots or full-inspection polling while walking.

| Observation | Median frame ms | p95 frame ms | Worst frame ms | GPU p95 ms |
|---|---:|---:|---:|---:|
| Visible Chrome, full 8,444-frame walk, 1440 × 900 | 16.70 | 16.80 | 17.20 | 0.287 |
| Visible Chrome, stationary 1440 × 900 | 16.70 | 16.80 | 33.30 | 0.279 |
| Visible Chrome, stationary 1280 × 720 | 16.70 | 16.80 | 66.70 | 0.208 |
| Hardware headless Chrome, cold exterior 1440 × 900 | 16.70 | 16.80 | 16.90 | 0.289 |
| Hardware headless Chrome, warm hall 1440 × 900 | 16.70 | 16.80 | 16.90 | 0.285 |
| Hardware headless Chrome, warm hall 1280 × 720 | 16.70 | 16.80 | 17.70 | 0.202 |
| Hardware headless Chrome, distant flight 1440 × 900 | 16.70 | 16.80 | 17.40 | 0.246 |

The quiet full walk's render CPU median/p95/worst is **2.20 / 2.40 / 4.60 ms**, including the animated geometry preparation (**2.00 / 2.30 / 4.30 ms**). Main preparation is **0 / 0 / 0.60 ms**. Collision is **0 / 0.10 / 0.30 ms**. CPU upload commands are **0 / 0.10 / 2.40 ms**. Twelve worker build events have median **14.70 ms**, p95/worst **31.80 ms**; this work occurs asynchronously, with synchronous support and middle geometry retained. These are actual job durations, not repeated last-job values mislabeled as per-frame preparation.

There are **9 actual draw calls** near the facility and **8** far away. Quiet walking triangles are median **43,611**, p95 **43,635**, maximum **44,535**; the distant view has **6,727**. Owned GPU buffers peak at **6,870,060 bytes (6.55 MiB)** during walking, under the 16 MiB admission limit. The far visit drops near residency to zero and GPU buffers to **2,403,828 bytes**. Prepared packet residency peaks at **4,466,232 bytes**, with a separate **2,097,152-byte worker reservation**. Four zones is the enforced maximum; the walk prepares twelve packets and evicts eight. GPU texture residency is zero. These byte counts measure owned arrays/buffers, not the whole browser or graphics driver heap.

A separate instrumented public walk measures actual `bufferData`/`bufferSubData` GPU commands with non-nested elapsed queries. Nine allocation uploads and 8,492 update uploads resolve; there are zero disjoint/skipped samples and zero GL errors. Both command classes have GPU p95 **0.000032 ms** at the driver's query precision. Update worst is **16.311 ms**; allocation worst is **0.000032 ms**. CPU command p95 is **0.20 / 0.10 ms** respectively. Two unresolved end-of-run query samples are released and excluded. This command measurement does not establish isolated physical transfer latency; the complete-frame GPU measurements above retain the cost of normal drawing and uploads. The instrumented run is excluded from cadence claims.

Cold public Industry host readiness is **1,160 ms**; measured warm visits are **185–205 ms**, followed by collision-safe fallback/detail readiness. No unacceptable seam traversal stalls occur in the quiet full walk. Separate stationary visible windows contain the reported 33.3/66.7 ms outliers, so the result is responsive local exploration, not a universal locked-60-FPS promise. Complete-frame GPU worst during the quiet walk is **16.634 ms** and remains in the raw evidence.

The recorded 8,981-frame route has a **399.9 ms** worst interval while screenshots/full inspection/encoding are active. It is retained as visual evidence, not quiet traversal certification. `evidence/quiet-walk.json`, `evidence/headed-performance.json`, `evidence/gpu-uploads.json` and `evidence/native-04/browser-results.json` contain the raw measurements.

## Browser evidence and review

Work/evidence root: **`I:/Sphere/work/infinite-industry-ii001-2026-10-13`**. Open the review at **http://127.0.0.1:8970/**. It displays the real screenshots, measured timing, original recording and a seekable review copy; no AI concept imagery is used.

| Required view | Native-04 artifact |
|---|---|
| Exterior | `01-exterior.png` |
| Ground approach | `02-ground-approach.png`, `03-hall-approach.png` |
| Covered processing hall | `04-processing-hall.png` |
| Elevated viewpoint | `07-elevated-gallery.png` |
| Actual distribution/intake seams | `08-distribution-boundary.png`, `09-intake-boundary.png` |
| Interaction before/after | `05-interaction-before.png`, `06-interaction-after.png` |
| Distant representation | `11-distant-overview.png` |
| Unchanged Meadow | `12-meadow-regression.png` |
| Responsive controls | `responsive-390x844.png`, `responsive-844x390.png` |
| Actual walking motion | `walking-route.webm` original; `walking-review.webm` seekable copy |

The 150.814-second review preserves all **4,488 encoded packets**, timestamps and keyframes; `media-remux.json` proves encoded-payload equality. The original remains intact. Its encoded payload SHA-256 is `8473b670a27f35059dafe6a3281c6d37bc7da809f039f4d79225f2211765b6bd`. A separate read-only range endpoint on port 8971 enables reliable video seeking without replacing the original port 8970 listener. Browser QA decodes the 1440 × 900 video after a seek to 100 seconds and verifies all ten gallery images and seventeen review links. Browser playback and screenshots are inspected separately from quiet timing. `walking-evidence.json`, `portable-save.json` and `release-1.json` through `release-3.json` retain route/state/cleanup evidence.

Earlier attempts remain intact. `native-01` and `native-02` time out during visible Main startup; `native-03` exposes the repeated ground-arrival query on reload. Consuming that one-time query fixes the latter; final native-04 proves exact reload. An isolated hardware Main startup succeeds without page/WebGL errors, and the user subsequently observes the loading/error screens gone. The earlier startup timeout causes remain unestablished; no Main renderer rewrite or broad cold-start reliability certification is claimed.

## Recent session and documentation context

At the user's request, five recent chats were read: **Complete Biome Pack Service Phase**, **Complete rendering and Main wiring**, two **Continue BPS Phase One** chats and **Assess the last seven sessions**. The current Meadow/pack documents, frozen Service Phase-01 design, reports 08/09 and continuation ledger 08 were checked against executable source. `context-review.md` records the exact chat IDs and the distinction between the two integration tracks.

The documents confirm the delivered Meadow scene contract as the reusable Industry foundation. The Service's small Industry/Track test fixtures are distinct from this water facility. Service P05 is still in progress; P06–P08 remain unstarted and Phase One remains unaccepted/unreleased. The Service's complete-view/native fragment/Main aggregate ownership/catalogue gates are not closed by this scene delivery.

Current README, pack README, document index, queue, biome ledger, Meadow-pack and Biome-Pack references receive additive II-001 pointers. Existing dated reports, frozen Phase-01, failed evidence and acceptance states are preserved. The original dirty checkout, shared server and the other active chat's changes are retained. All 23 Meadow files and five original runtime files match the initial hashes. The final 1,223-entry source/document comparison has zero missing files and no unowned production-source differences; all 31 manifest source pins are exact. All eight relevant starting listeners (8766, 8890, 8891, 8892, 9020, 9021, 9026, 9027) retain their observed PIDs. `preservation-final.json`, `documentation-preservation.json` and `listeners-final.json` retain these bounded observations. Final preservation distinguishes own additive changes from observed concurrent project-document changes; it does not claim an atomic whole-machine seal or remove older unresolved preservation gates.

## Limits and the next decision

One finite facility occupies an enormous existing coordinate domain. Near/middle/far views agree about it. Connected support plants, complete pods, continuous multi-pod industry, an industrial atlas, high-altitude industrial continents and Biome Under Construction are not implemented. No atlas refactor, replacement renderer, external assets or full process simulation is included.

Materials use geometry and existing directional shading. Browser/driver heap totals and a long-duration soak are distinct from measured owned buffers. Legacy Watershed Meadow's historical H1 failure, acceptance state and evidence remain unchanged. Biome Pack Service acceptance is also unchanged.

For **II-002**, the next action is a feedwater/intake support facility and a storage/distribution support facility using the tested opposite-side seam specification. Reuse this complete water facility and verify three linked facilities before attempting a seven-hex pod. II-002 through II-006 remain not started and require their own authorization.
