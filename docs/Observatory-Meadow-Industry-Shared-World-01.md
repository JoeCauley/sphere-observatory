# Meadow ↔ Industry: the working shared world

**Current report — 20 October 2026.** The native Chrome test completed an ordinary on-foot walk from Meadow into Industry and back: **576.9 metres, two walking crossings, no flight**. The verified shared-world files have been adopted into the local Observatory checkout. The public Sphere shortcut now opens that LIVE shared scene.

This delivers the immediate two-pack walking route. It does **not** close formal P05, Meadow H1, full Frame/driver proof, performance qualification or human appearance acceptance. Biome Border is the next work scope and is not implemented yet. [Implementation 01](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/SHARED-WORLD-IMPLEMENTATION-01.md) remains unchanged as the earlier, native-pending record.

## Open it and walk

Open [the Sphere](http://127.0.0.1:9121/) and select **Walk Meadow ↔ Industry**. That actual public shortcut was clicked in Chrome and reached the ready LIVE shared world. For a direct on-foot Meadow arrival, use:

**[Walk from Meadow toward Industry](http://127.0.0.1:9121/packs/shared-world/1.0.0/index.html?pack=infinite-meadow&arrival=ground)**

The camera starts at the original Meadow home, facing the water works. Hold **W** to walk and **Shift** to move faster. The ground gradually rises through the apron into the Industry region. Use **Face Meadow** to turn back, then walk home through the same landscape. The bearing button turns the camera; it does not move it. It is a destination bearing, not an obstacle-avoiding route through the original pipes and tanks.

| Control | Action |
| --- | --- |
| W A S D; Shift | Move; move faster |
| Mouse drag; arrow keys | Look and turn |
| Space | Lift off |
| Q / E | Descend / climb in flight |
| F | Land near clear support |
| R | Operate the water-routing valve when nearby |
| H | Hide/show controls |
| Save this place / Return to saved place | Explicitly save or restore a viewpoint |

An explicit saved-place return is a separate user command; it was not used to qualify the walking crossings. The shared world has its own save key. The trial at port 9120 and LIVE at port 9121 have separate browser storage because they are different origins, so the trial bookmark does not automatically appear in LIVE. Original standalone pack saves remain separate.

The **Explore → Biome Packs → Infinite Meadow/Infinite Industry → arrival → Visit** choices are implemented and pass source/model routing checks. The complete Explore selection flow and the original Main renderer have not been promoted to native-qualified integration by the shortcut test. Use the verified shortcut or direct link above for this deliverable.

## One landscape, two complete original content sources

Both packs use one canvas, one WebGL2 context, one global camera pose and one input loop. Crossing between them keeps the same loaded world. There is no boundary page navigation, camera swap, pose injection or hidden test renderer.

Meadow retains its original terrain formula, home and landmarks, canonical grass construction/density, geographic wind and existing moving grass stage. Industry retains the actual **150 m facility**: its original selection, orientation, model and treatment, all six geometry zones, moving machinery, water process/routing, collision objects, ramp and gallery. Its original detailed-packet residency and middle/far content remain in use; the shared scene does not replace either pack with simplified placeholder scenery.

Industry's centre is fixed at **384 m east, 0 m north** in the same metre coordinate system. Its original facility geometry is translated, not rescaled. A **120 m radius** around that centre is the original Industry ground datum, **48 m**. A **128 m smooth apron** joins that platform to Meadow, ending at radius **248 m**. Every tested original facility packet fits within radius 95.814 m, inside the flat area.

Outside the assigned apron, ground height returns the original Meadow terrain value directly. The original home area and landmarks remain outside the transition. CPU walking support and the terrain/grass shaders use the same shared ground definition. Geographic cover changes only within the explicit Industry core/apron. The original ramp still reaches its nine-metre gallery in component controls.

The host keeps movement/reference updates separate from expensive preparation and drawing within each display callback. It processes real visible elapsed time in at most **twenty steps of at most 50 ms**, then prepares and draws once at the final pose. Existing collision substeps remain in use. Blur, visibility changes and explicit viewpoint restoration clear input/timing history; hidden time is not replayed. Delays above one second are dropped and reported rather than treated as an unlimited held-input backlog. Reference graphics samples are immutable and reused when their actual wind/process/routing/transition inputs are unchanged; static facility content is not rebuilt for every camera move. This is practical bounded scheduling, not a formal performance theorem.

## What the native test established

The archived candidate 04 contains **315 source files**. Its native registry verified **58 exact inputs**. The functional audit and its process receipt report:

| Check | Native result |
| --- | --- |
| Ordinary W/Shift walk | 576.8994 m; Meadow → Industry → Meadow |
| Crossings / flight | Two crossings in walking mode; 0 m flown |
| Return near home | 0.2994 m residual |
| Shared rendering | One canvas and one context |
| Errors / graphics events | No reported errors or native context events in this run |
| Save and reopen | Exact saved pose restored |
| Previous scene cleanup | Tracked owned resources and bytes 0; worker terminated; listeners and pending frame handles 0 |

The route used ordinary input and public controls. Face buttons rotated only. This was a real browser traversal, beyond the earlier successful combined-view boot and its short 5.4 m movement observation. The native walk validates crossing into the Industry region and returning; it does not certify every possible facility route, interaction or obstacle scenario.

Read first: [native04-functional-audit.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-functional-audit.json) and [native04-audit-exit-01.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-audit-exit-01.json). The numeric audit exit is 0, with eight functional audit groups. The report includes the exact candidate inventory and image hashes. [candidate04/source-inventory.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/candidate04/source-inventory.json) preserves the complete source identity; its registry SHA-256 is `823226b6db60a6bee4d0e719c342772b87c583db4cc9ce26fd21c0895e33f5ca`.

Visual records are [Meadow before the apron](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-meadow-before-apron.png), [the apron](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-apron.png), [Industry](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-industry.png), [return to Meadow](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-meadow-return.png) and [saved round trip](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-roundtrip-saved.png). Public scene facts are recorded in [Industry details](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-industry-details.json), [round-trip details](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-roundtrip-details.json) and [reopened details](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native04-reopened-details.json). These are inspectable evidence, not a claim that the user has accepted the combined world's appearance.

After adoption, [native-live-public-entry.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native-live-public-entry.json) records the actual Chrome click on **Walk Meadow ↔ Industry** at the LIVE Sphere root. [native-live-boot-details.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native-live-boot-details.json) and [native-live-ready.png](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/native-live-ready.png) show the resulting ready shared scene, both registered pack IDs, 58 exact inputs and one context. This is a native **public-shortcut entry** pass. It does not establish complete Main rendering, the full Explore selection flow or an original-Main restoration proof.

## Adoption and preserved work

The root adopted **14 new files** and **four public routing changes** into `I:/Sphere/repositories/sphere-observatory`. The new files are the shared-world implementation/registry and two version 1.1.0 adapter manifests. The routing files are `pack-library.js`, `places.js`, `places-ui.js` and `index.html`; their preimages are preserved in [adoption-originals-01](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/adoption-originals-01/).

Both adapters identify their original **contentVersion 1.0.0** and the new `sphere-shared-world-v1` runtime. Their registry verifies listed bytes and matching pack/world identities. This is a trusted custom application integration and content-pinning check; it is not a security boundary or formal service admission.

All **45 original pack/runtime/catalogue files** remain exact, including original version 1.0.0 content and runtime v1. The old formal catalogue is still its **51-byte empty catalogue**. Unrelated checkout work and previous servers were preserved. The new LIVE server uses port 9121; the earlier trial server was not stopped.

Read first for the deployed delta: [adoption-receipt-01.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/adoption-receipt-01.json) and [adoption-exit-01.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/adoption-exit-01.json). The adoption receipt records every added/changed file, exact before/after identity, backup and the 45-file preservation result. [frozen-original-pack-inventory.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/frozen-original-pack-inventory.json) is the original source inventory. No source or LIVE files were changed in preparing this document.

## Component evidence and remaining limits

Before native traversal, actual-source controls covered the joined ground, original geometry and shared host:

- **Renderer: 9 groups**, numeric exit 0. Original Meadow terrain/landmark buffers and grass draw counts retained; all original Industry LOD/motion inputs, rebasing, unchanged-view upload 0 and modeled cleanup 0. See [renderer-controls-02/process-receipt.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/renderer-controls-02/process-receipt.json).
- **Reference/navigation: 11 groups**, numeric exit 0. All 45 originals exact; strict original-ground equality outside the apron/home; translated support/collision checks, all 26 zone/LOD/motion packets, a 536.3 m model round trip, original ramp/gallery, save validation and water interaction. See [reference-navigation-execution-receipt-03.json](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/reference-navigation-execution-receipt-03.json) and [results](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/shared-reference-navigation-results-02.json).
- **Current host/clock: 35 reported groups across three successful runs**: 16 normal, 16 storage-quota and three gallery grass-invalidation groups. They exercise the actual App/Host/Renderer/navigation under modeled DOM/GL/Worker, elapsed-time substeps/drop policy, save success/failure, crossing, immutable graphics facts and cleanup receipts. See [normal](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/host04-normal-exit.json), [quota](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/host04-quota-exit.json), [gallery](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/host04-gallery-exit.json) and the [candidate review register](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/host-candidate04-review/review-register.json).
- The [read-only crossing review](I:/Sphere/work/meadow-industry-shared-world-2026-10-20T09-55-00/crossing-independent-review-04/REVIEW.md) found no additional ordinary crossing/cleanup blocker. Its actual-source CPU crossing/ramp observations are separate from native proof. It also records the original terrain-grid versus continuous-support difference, up to 8.22 mm on that tested route; this is not a P05 numerical bound.

Failed earlier fixtures, the initial refused load, the native 02 timing limitation and straight-bearing obstacle probes remain preserved. Candidate 04 repaired the host elapsed cap, flight-only grass demand invalidation and post-cleanup receipt reporting without editing original content.

**Formal P05 remains OPEN.** This explicitly authorized full-pair route does not retroactively satisfy the old frozen service/Frame contract, complete fragment/depth/AA/driver proof, full ownership/pricing graph or Meadow H1. Chrome supplied roughly one display callback per second during the trial; functional traversal under that condition is not performance acceptance. Tracked GL deletion is not a driver-heap measurement or GPU-completion certificate. No human appearance acceptance is inferred from the screenshots.

The immediate practical result is available: enter the shared scene and walk between the two packs. **Biome Border is next**, after this delivered route; no Border implementation or acceptance is claimed here.
