# Observatory edge quality 07

<!-- current-meadow-progress-2026-10-03 -->
> **Current Meadow status (2026-10-05 bounded HR-09 map/preparation continuation):** Runtime `7ca67b137100b81c10c3ae173ffab90f0b9054aac99d1bf199fee7e145e59116` is unchanged. Ready-map winner reuse is rejected for observable object identity effects; SHA64 remains unpromoted with no dependable complete preparation gain. Fresh integrated regression/contracts/seven ownership states and independent thirteen-pair audit PASS in their scopes. Complete quiet H1 retains six 900-frame windows/5,400 unique valid GPU samples/protocol PASS and numerical FAIL with twelve unchanged-limit failures. Original-order raw native diagnosis repeats the elevated-turn first-canonical 376-row material mismatch; all 54 raw captures and every changed channel are retained, cause UNKNOWN/unwaived. Retained F/G media re-review is complete; fine-edge/shimmer/filter/shadow feedback and human acceptance remain open. HR09/H IN PROGRESS; HR10 NOT STARTED; I-K blocked; B1/acceptedBy NOT ACCEPTED; M1 WITHDRAWN. Current baseline bytes are preserved in the pre-docs audit; the historical missing PID/server and absent process/context qualifications remain INCOMPLETE/NOT_CONFIRMED/UNKNOWN. See [current map/preparation report](Observatory-Meadow-HR09-Map-Preparation.md) and its authoritative final after-docs audit/seal. Integrity sealing does not waive failed numerical/native/human/preservation gates.

Implemented 8 September 2026. This revision addresses image smoothing and quality-setting persistence. Dimensions, shell geometry and lighting transport models are unchanged.

## Findings

At the full 1920 x 1080 preview ray budget, the previous supersampling option had no headroom to trace extra rays. Its metadata correctly reported no supersampling. This limitation predates v0.6. The new linear-light resolve also produces different mixed-pixel brightness than display-colour averaging; that is expected, not evidence that ray counts fell. Original dawn scene staging still reset antialiasing to Off, an actual usability regression in the context of retaining quality choices.

## Changes

Full scene staging retains antialiasing, shadow samples and preview detail. Ordinary destinations still preserve every non-pose field. Importing a saved scene deliberately restores its quality values.

Antialiasing now has three choices. Off traces the base image. Supersampling only provides the v0.6 measured linear-light resolve. Smooth edges additionally detects display-contrast edges and samples along their estimated direction. Low-contrast pixels keep their original linear resolve. Edge interpolation operates in display colour to avoid expanding bright edges through nonlinear tone mapping. This is a visual reconstruction filter, not extra geometric samples or exact radiometry.

The filter runs on the floating-point rendering path. Compatibility rendering retains supersampling alone. Preview ray/frame budgets remain unchanged; extra image reads and tone-curve evaluations still add GPU cost. No hardware watt restriction is claimed. The new opening scene uses Smooth edges, while old scenes retain their stored settings. The render metadata distinguishes edge filtering, supersampling, or both.

## Verification and tradeoffs

At a full-budget 1920 x 1080 preview, the new mode reports edge filtering and no increase in internal dimensions. Staged dawn retains mode 3. A synthetic oblique edge produces 250 intermediate pixels and leaves distant flat regions unchanged. Against an independently supersampled display-coverage reference, squared error falls from 438,669 to 235,379, while absolute error rises from 6,694 to 6,841. Thus it reduces large edge errors but spreads smaller errors. This is evidence of a smoothing tradeoff, not uniformly improved physical accuracy. The initial test requiring lower absolute error failed; both metrics are retained explicitly.

The original linear resolve remains independently tested in Supersampling only mode. Matched scene images at full preview budget are saved in outputs/observatory-v0.7/edges-2.png and edges-3.png, with reproducible scene JSON. Fine structures may soften; select Supersampling only for the unfiltered output. The next higher-fidelity option would be bounded multi-frame sampling of a stationary camera, with explicit convergence and invalidation, rather than indefinite rendering.
