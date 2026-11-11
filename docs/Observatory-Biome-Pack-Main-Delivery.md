# Biome packs in Observatory Main

> **Bounded P05 replacement follow-up · 10 November 2026.** Industry now replaces its centre native view with a complete view four metres east while retaining the old ready geometry/support until a real replacement draw. Both full geometry/material rasters and changed support identity pass; old and final native resources retire under unchanged caps. Logical peak is 33,533,342 / 33,554,432 B, with only 21,090 B spare. Current-source Meadow, broader approach/tiers/geometry and visual acceptance remain unqualified. **P05 OPEN; safe pause requested by Joe.** [Verified result and pause handoff](Observatory-Main-P05-View-Replacement-2026-11-10.md).

**Owner decision · 2 November 2026.** Joe will call this push done when he can install Infinite Meadow and Infinite Industry in Observatory Main, visit the places the Sphere assigned them, close the browser, reopen Main, and return to his saved place. This is the current work order for the browser Observatory.

**Current bounded goal · 10 November 2026.** Joe authorized continued work toward P-05, including design changes. Both fixed native fixture views now feed Main's normal altitude instruments from the same verified uploaded triangles. Industry reports its overhead beam at 156.000007 m and Meadow reports ground at 159.999998 m; both return and retire their local resources and funded query caches. Complete geometry/material rasters retain terrain bounds below 1 mm, with a logical metadata peak of 31,789,274 B and common prospective GPU capacity of 4,202,496 B under unchanged caps. General approach, changed-view replacement, matched tiers, movement/contact qualification, overview silhouettes, remaining geometry cases and visual fixture acceptance stay open. Earlier installation orders and saved assigned places retain their separate evidence. Formal P-05, full Visit and the four-milestone finish line remain open; native current-view persistence, real Meadow/Industry adaptation and a fresh dedicated profile are unproved. [Latest Main support result](Observatory-Main-P05-Installed-Surface-Queries-2026-11-10.md) · [Two-fixture native views and installation orders](Observatory-Main-P05-Two-Fixture-Native-Views-2026-11-10.md) · [Installation result](Observatory-Main-P05-Transaction-Buffer-Ownership-2026-11-10.md) · [Main overview](Observatory-Main-P05-Published-Overview-2026-11-10.md)

## What to build on

| Existing work | Use in this delivery |
| --- | --- |
| Watershed river gardens | Reference for how Main moves from a regional view to walkable ground using one saved world address. Preserve its legacy places and saves. [Watershed province](Observatory-Watershed-Province.md) |
| Track Meadow and Open Industry | Small service fixtures for integration. Track Meadow has three landmarks and belongs within a shade track. Open Industry has a passage and overhead beam and belongs outside the tracks. [Fixture definitions](Observatory-Biome-Pack-Service-Phase-01.md#required-fixture-families) |
| Infinite Meadow and II-001 | Keep the original 1.0.0 releases as content references. Adapt Meadow's terrain, landmarks, wind and grass, and Industry's water works, gallery and valve, through versioned providers. [Meadow](Observatory-Meadow-Pack-01.md) · [Industry](Observatory-Infinite-Industry-II001.md) |
| Shared world | Keep the working walk and save available for comparison. That scene locates the water works 384 m east of Meadow. Main must read both placements from the published world binding. [Shared walk](Observatory-Meadow-Industry-Shared-World-01.md) · [Successor](Observatory-Industry-Display-Preparation-2026-10-20.md) |
| Existing service | P01–P04 have historical scoped results for verified releases, deterministic allocation and atomic publication. Reuse their implementations and check the paths exercised by Main. [Service ledger](Observatory-Biome-Pack-Service-Implementation-Ledger.md) |

## Four milestones

| Milestone | Browser-visible pass |
| --- | --- |
| 1. Install Track Meadow and find it again | In a fresh browser profile, open normal Main and click Install. Main shows the allocator-selected place in an eligible shade-track area. Close the tab and reopen the ordinary Main URL in the same profile. The same world, exact release, published binding and assignment load from storage. Click Install again. There is still one installation with the original assignment. A location listing with a readable address is sufficient here. |
| 2. Visit the fixtures | Use Main's overview to choose an installed place, descend and walk to a recognizable landmark. The overview and local support resolve the same assignment. Repeat for Open Industry outside the shade tracks, without Duck Blind. Both visits use Main's renderer, camera and travel controls. |
| 3. Visit the real content | Install versioned adapters for the original Meadow and II-001 through the same controls. Walk through the accepted Meadow grass to a known landmark. Visit the Industry water works, climb the gallery and operate the valve. Each provider takes its location from its published assignment. Compare the result with the preserved walk. |
| 4. Joe's acceptance walk | From a clean profile Joe installs both packs, visits both, saves a place, closes the browser and reopens the normal Main URL in that same profile. Both places keep their releases and assignments. Returning restores his saved view. Record his actual verdict and stop this push. |

## Scorecard

Count only ordinary browser behavior in Main. Record the tested revision and a small evidence link beside each demonstrated behavior. Keep the fixture result distinct from the real-pack result.

| Behavior | Track Meadow / Open Industry | Real Meadow / II-001 |
| --- | --- | --- |
| Install | PASS* / OPEN | OPEN / OPEN |
| Locate assigned place | PASS* / OPEN | OPEN / OPEN |
| Visit in Main | OPEN / OPEN | OPEN / OPEN |
| Reopen | PASS* / OPEN | OPEN / OPEN |

*The [10 November ordinary Main record](evidence/p05-publication-20261110-060541/README.md) starts with no installed assignment, then records one installation, one region and the same 59 cells after install, tab close/reopen and a repeated Install request. The repeat made zero storage writes. These are observed browser behaviors on a fresh unused origin in the existing Chrome Work profile; a newly created dedicated profile remains NOT DEMONSTRATED. Visit, saved local-view restoration and formal P-05 remain open.

The later [Main overview integration](Observatory-Main-P05-Published-Overview-2026-11-10.md) displays that same installed footprint and uses the existing travel transaction for View assigned region. Main's draw record and CPU location lookup identify the same region and binding. This is an overview result at approximately 202,997.5 km altitude, not a local fixture visit. Visit stays OPEN until the actual landmarks and solid support are demonstrated. Native silhouette/fragment bounds and full qualification remain open.

Milestone 1 can credit Track Meadow for a persistent installation and assigned location. Restoring a saved local view is a separate check in milestone 4.

The [first milestone 1 implementation record](evidence/track-meadow-install-20261102-091541/README.md) is **FAIL**: one Install click in ordinary Main reached publication and failed with `STORAGE_UNAVAILABLE` when the lifecycle validator was null. Read-only storage observation found no published world head or binding. The table remains open. Reopen, repeat-install handling, Visit and saved-view restoration were not demonstrated; milestone 2 was not started.

The [one authorized follow-up](evidence/track-meadow-followup-20261102-115402/README.md) is also **FAIL**. The browser dependency was corrected and checked. One Install click in a new dedicated Chrome profile reached publication, where the unchanged metadata cap refused a charge that would exceed it by 9,845 bytes. Native read-only storage observation again found zero world heads and zero bindings. This repeats the publication boundary: the implementation loop has ended and the metadata ownership architecture decision returns to Joe. All scorecard entries remain open; milestone 2 is untouched.

Those failures remain preserved. Joe subsequently selected a durable completed-allocation handoff, then authorized further design changes on 10 November. The versioned transaction adapter now counts the same source buffer once and separately pays for every write copy until complete/abort. Ordinary Main installation, readback and repeat-install behavior passed with a logical metadata peak of 21,422,637 B under the unchanged 33,554,432 B cap. Physical memory is UNMEASURED. This later scoped result updates the scorecard above; it does not close formal P-05 or qualify assigned-surface rendering.

## Engineering decision and stop rule

Keep the 32 MiB service metadata limit, including simultaneous work and replacement. A versioned implementation may release or transfer finished working storage once it proves who can still observe it. Preserve durable records, active readers, pending operations, cancellation, rollback and retry behavior. Charge overlapping lifetimes through the transition. If the only way forward requires a higher cap, weakened integrity, or an unproved early release, stop for an architecture decision.

Give each implementation session one observable pass condition. On failure, save the first failing operation on that route, the evidence, one materially different design explanation and the observation that would disprove it. At most one follow-up attempt may test that explanation. If it reaches the same boundary again, stop and bring the choice to Joe. Additional controls, a later decoder read or a successful handoff do not earn another attempt.

## Relationship to the formal programme

This decision brings the install and reload behaviors forward and schedules the real packs before full formal qualification. The dated P05 continuation prompts are historical records. The last sealed private run stopped at read 41, 33,085 bytes short, before binding preparation or native Main. P05 stays **OPEN**, P06–P08 have no formal exits, and Phase One remains **NOT_ACCEPTED / NOT_RELEASED**. Record formal results only against their original criteria. Export/import, full native certification, Meadow H1, creator tooling and Biome Border remain separately tracked. [Formal design and exit criteria](Observatory-Biome-Pack-Service-Phase-01.md#24-phase-one-implementation-sequence) · [Sealed November 2 checkpoint](../../../work/biome-pack-service-p05-2026-11-02-011328-618ae4c2/reports/checkpoint-7am-final-02.json)
