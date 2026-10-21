# Meadow prototype P2 — sparse volume, integrated preparation and capture

Date: 2026-10-05. Status: **DIAGNOSTICS COMPLETE; REQUIREMENTS OPEN; UNPROMOTED**.

The interrupted conversation's next recommendation was recovered from “Challenge Meadow core design” and its retained [P1 report](Observatory-Meadow-Prototype-P1-2026-10-05.md): test a small volumetric canopy, integrate preparation, and prepare actual capture views under the existing limits. The user authorized this iteration and requested visual evidence. P2 completes those experiments in an isolated runtime.

The 12-stem volume is the strongest new GPU candidate: its worst seven-view incremental GPU p95 was **3.583 ms**, below the 4 ms diagnostic reference. The 18- and 24-stem volumes exceeded that reference. The compiled planner did **not** solve complete preparation: walking reached **23.1 ms**, against the unchanged 2 ms limit. Moving foreground readiness remained incomplete. Panorama capture prepared all six actual faces before encoding; 4K perspective capture exceeded the existing capacity and correctly rejected the transaction without a file. There is no production promotion, H1 certification, appearance acceptance or lifecycle advance.

## Isolation and retained identity

The prototype lives in `analysis/meadow-prototype-p2`; its owned runtime is `I:\Sphere\work\meadow-prototype-p2-2026-10-05T23-07-10-027Z\runtime`. Its [evidence baseline](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/baseline.json) is under `docs/evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z`; the authoritative configuration is [last-run.json](../analysis/meadow-prototype-p2/last-run.json). Each browser attempt freezes its experiment sources and source manifest.

The runtime base is the dirty local version 1.6.0 at commit `6a52267ddf5d9d49b0f64bc75a6699f671232e77`, source SHA-256 `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116`. Its 45-asset set SHA-256 is `45f67a383ac6ec295844b3bc6ddc40e9a1d661f354d7f406bf82e6519410a91d`. Existing production files, fixtures and historical evidence were read without modification. Final preservation receipts cover the 1,014 pinned existing non-evidence files, runtime/asset identities and pre-existing tracked diff, plus a separate 175-file P1 source/evidence inventory. This is a bounded inventory, not an all-host or all-history claim.

The test browser and server belonged to P2 and were closed at each attempt's end. Existing servers and user work were not stopped or reset. The visual evidence viewer has its own local server and remains available for review.

## Experiment and appearance

[canopy-p2.js](../analysis/meadow-prototype-p2/canopy-p2.js) retains the original F2 vertex buffer and selects original stem indices to form volumes of 12, 18 or 24 stems. Selected ribbon widths use factors 1.75, 1.60 and 1.35 respectively. Original stem numbers, heights, curves, normals, seeds, canonical root records, overlap order, geographic wind and depth/lighting implementation remain represented. Wider ribbons and fewer rendered stems constitute new experimental appearance; accepted F2 appearance is not inherited.

The retained P1 atlas and baseline are comparison controls. All comparison geometry and atlas resources stay physically allocated and are charged. Maximum observed vegetation-plus-ground GPU allocation was 33,466,930 bytes, below 33,554,432 by only **87,502 bytes**. This narrow headroom is not a complete memory-ownership result.

The browser was Chrome 154.0.8037.98 using ANGLE/NVIDIA GeForce RTX 5080 through D3D11. Entry used **Explore → Watershed / Open meadow → Meadow study / on foot → Visit**, seed 713, day, clear. Subsequent controlled diagnostics held the app and invoked its actual renderer at 1920 × 1080, the retained ordinary-route state, and seven specified camera/light/wind views. The wide-lens view used 110°; other views used 80°.

## Seven-view GPU and foreground evidence

Revision 2 retained 1,344 valid GPU samples: seven views × six modes × 32 samples. Vegetation-off samples were collected separately; enabled modes were counterbalanced. Incremental values subtract matching-index off samples, clip negative differences to zero, and use nearest-rank p95. Readback and PNG encoding were outside the native GPU query. This is a small component diagnostic, not an ordinary-app H1 off/on protocol.

| View | Current canopy | P1 atlas | 12 stems | 18 stems | 24 stems |
|---|---:|---:|---:|---:|---:|
| Normal | 9.391 | 3.181 | 3.583 | 4.208 | 4.738 |
| Grazing | 9.292 | 3.176 | 3.496 | 4.108 | 4.596 |
| Downward | 0.947 | 1.157 | 0.777 | 1.023 | 1.053 |
| Overlap turn | 8.785 | 2.850 | 3.180 | 3.736 | 4.324 |
| Elevated turn | 6.713 | 0.496 | 1.345 | 1.988 | 2.659 |
| Changed light | 9.017 | 3.003 | 3.380 | 3.943 | 4.267 |
| 110° lens | 4.121 | 1.327 | 1.474 | 1.681 | 1.920 |

Values are incremental GPU p95 in milliseconds. All seven sampled 12-stem views fall below 4 ms. The 18-stem version fails normal and grazing views; 24 stems fails additional views. Neither is a sampled solution under that limit. Root/record hash checks, static zero-upload checks and GL-error checks passed in this diagnostic.

Corrected foreground protocol 2 used same-pixel DEPTH24 terrain references, integer-packed grass IDs, pixel-centre exclusions/ROI and the 2–15 metre terrain-depth band. Of 528,432 eligible pixels, current canopy coverage was 80.3965%, P1 80.1159%, 12 stems 80.1789%, and 24 stems 80.2130%. These four exceed the 70% reference for this pose. **18-stem foreground coverage was not measured.** A coverage number does not establish acceptable thickness, lighting, angular behavior or motion appearance.

The gallery contains original, unedited matching PNGs. The sparse volume shows actual stems and angular variation, while its reduced body and mottling remain reviewable appearance differences. No human acceptance judgment was obtained. Sampled movement images also reveal the actual incomplete foreground state and must not be treated as complete moving coverage proof.

## Integrated planner and complete preparation

[submission-p2.js](../analysis/meadow-prototype-p2/submission-p2.js) installs a compiled winner planner and packet group/region tables on one isolated lifecycle/backend instance. It preserves original ready-Map insertion, handle and range order. The production prototype/public methods remain untouched. Receipt validation and hashes, record uploads, per-record view tests, fenced reference banks, commits and retirement remain within complete preparation timing.

An independent oracle replay used 1,800 recorded walk/turn poses. It checked 396 eligible non-null candidates and 744 invoked submission plans against the original ordered implementation, with zero mismatches. Cached or null candidates were not independently compared on every frame. This is scoped order evidence, not a universal foreign/public-contract proof. One missing GPU sample in this oracle-only replay is retained and is not counted as quiet performance evidence.

Revision 2 then ran six quiet 900-frame replays, with no duplicate oracle or PNG encoding inside them. Both planner paths used the **18-stem** volume. All 5,400 actual draws have unique, valid associated GPU samples; the independent audit checks the exact source pose sequence, frame IDs and sample validity.

| Route | Planner | Preparation p95 | Preparation max | Full draw CPU p95 |
|---|---|---:|---:|---:|
| Stationary | Original | 0.2 | 5.9 | 1.2 |
| Walk | Original | 9.0 | 18.9 | 10.5 |
| Turn/elevation | Original | 8.1 | 11.9 | 9.6 |
| Stationary | Compiled | 0.2 | 5.3 | 1.2 |
| Walk | Compiled | 8.8 | 23.1 | 10.4 |
| Turn/elevation | Compiled | 7.7 | 12.3 | 9.4 |

Times are milliseconds. The unchanged complete-preparation limit is 2 ms. Route-start view/bank work remains charged; it was not deleted from these maxima. Small percentile changes do not establish a dependable full preparation gain, and the compiled walking maximum worsened. The full draw CPU column is not an incremental CPU certification.

Both walk replays had 899/900 unready view frames and 900/900 unready foreground frames. Turn/elevation had 548 unready view frames, with 660 original and 658 compiled unready foreground frames. Stationary had seven initial unready view frames, but no unready foreground frames. These results prevent a complete moving-readiness claim even when draws occur.

Maximum observed upload was 311,984 bytes; stationary uploads were zero. Resident detailed records reached 454,180 against 500,000; submitted detailed records reached 190,007 against 250,000. Numeric planner backing was 2,427,072 bytes plus 206,080 bytes of packet tables, retained through the service's CPU owner mechanism. JS assignments, Maps/Sets/ranges and original native record filtering remain. Fully typed banks/admission and whole main/worker heap/lifetime attribution are unfinished. The collected main-heap checkpoints include observers and omit worker heaps; the 64 MiB ownership gate remains unqualified.

These held-camera direct draws were paced by requestAnimationFrame. Their approximately 60 fps cadence does not certify ordinary-app H1 or resolve the earlier headless cadence uncertainty. No new full H1 off/on windows were run.

## Capture transactions and visual delivery

[capture-p2.js](../analysis/meadow-prototype-p2/capture-p2.js) prepares each actual requested view at its actual internal resolution. It waits for matching current/committed versions, view and foreground readiness, resources and ground; detects capacity conflicts and GL errors; and locks wind phase before copying a view. Panorama faces are prepared and copied sequentially, then resolved and encoded.

Both complete attempts produced a **3840 × 1920 panorama**, with six ready **1920 × 1920 internal faces**, no capacity conflicts or GL errors, and shared wind phase **1.2 seconds**. Revision 1 used 12 stems; revision 2 used 18 stems. First-face final preparation was respectively 2.5 and 2.6 ms, so this successful capture does not imply a 2 ms complete lifecycle pass. The retained face transactions establish readiness; they are not a dense all-face pixel-acceptance test.

Both perspective requests targeted 3840 × 2160 output. Existing 2× internal antialiasing requested 7680 × 4320 and 6,348 vegetation jobs, above the existing 4,096 limit. Transactions returned `REJECTED_NO_FILE`; no PNG was encoded and no successful completion was reported. No cap, quality or LOD policy was relaxed to manufacture completion.

Panorama SHA-256 identities:

- Revision 1 / 12 stems: `0084ba270f6d2c222ba60cfb73deb79e7052fcebbb3743ada5be0815668e59b0`.
- Revision 2 / 18 stems: `57d0b074ddb23a435d463e096a781961d0e1b3d4a747e43afd4c1e8ba4b191c8`.

The user-facing gallery and report copies are under `C:\Users\Joe\Documents\Codex\2026-10-05\he\outputs\meadow-experiments`. It contains 199 original PNGs across P1 and P2, seven-pose comparisons, 60 movement samples for each P2 revision, original panoramas, raw reports, hashes and capture reproduction sidecars. Revision 2 motion recording is separate from quiet preparation; every thirtieth frame is shown. PNG encoding between those sampled draws invalidates motion-run timing/cadence inference. The sidecars derive the capture state from the retained base state and frozen driver call; they are **not native production scene-export ZIPs**.

## Evidence, preservation and remaining work

All attempts remain retained:

- [Startup failure, 23:14 UTC](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/browser-2026-10-05T23-14-11-557Z/run.json): driver reference error, fixed before rendering evidence; no rendering proof claimed.
- [Revision 1, 23:15 UTC](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/browser-2026-10-05T23-15-02-054Z/run.json): valid GPU/coverage/oracle/capture evidence; PNG collection between compiled movement draws prevents a fair timing/cadence comparison.
- [Revision 2, 23:26 UTC](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/browser-2026-10-05T23-26-33-618Z/run.json): refined volume, separate quiet preparation and movement collection; final browser errors empty and GL error zero.
- [Independent raw-data audit](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/independent-audit-2026-10-05T23-38-06-057Z.json): recomputed statistics and coverage; validated source freezes, exact quiet pose sequences, GPU samples, images and capture transactions. Status `DIAGNOSTIC_EVIDENCE_VERIFIED_REQUIREMENTS_OPEN`.
- [P1 preservation](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/p1-preservation-final.json) and [production preservation](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/preservation-final.json): bounded byte/identity receipts.
- [Revision 1 capture sidecar](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/capture-sidecar-r1.json) and [revision 2 capture sidecar](evidence/meadow-prototype-p2-2026-10-05T23-07-10-027Z/capture-sidecar-r2.json): experimental reproduction recipes and face transactions.

The next technical recommendation is to keep the 12-stem volume as an experimental appearance/GPU candidate while replacing remaining assignment/range allocation and record admission/filtering with ordered typed banks, then remeasure complete moving preparation and readiness under unchanged limits. Capture needs an explicitly valid complete perspective policy within the same capacity contract. These are recommendations, not authorization to start P3.

The historical 376-row first-capture material mismatch was not retested here and remains unknown/unwaived. Near/native equivalence, whole ownership, human visual/motion acceptance and rendered global joins/rebase remain unproved. HR-09/H remains open with failed H1; HR-10 remains unstarted; I–K remain blocked; B1 remains not accepted; M1 remains withdrawn. P2's diagnostic completion changes none of those states.
