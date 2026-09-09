# Observatory station lighting 08

Implemented 8 September 2026. Geometry and prescribed trajectories are unchanged. This pass improves integration of the star as an extended light source.

Station-enabled direct lighting uses a common 19, 64, 128 or 256-ray stellar sample set for all station and shade blockers. A blocked ray is counted once even with overlapping blockers. Receiver self-exclusion remains. Whole shade bounds are culled once before sample integration. The default is 64 rays; the station-disabled case retains the original 7/19 options. No random per-frame rotation or temporal shimmer is introduced.

Station hits are compared to the actual near stellar intersection for each ray, replacing the previous shortest centreline distance approximation. Ring-plane intersections use closest-approach coordinates to reduce cancellation. The existing macro-region ShellShine estimate uses the selected sample count when the station is enabled, instead of a single ray per macro-region. ShellShine is still a uniform one-bounce estimate, not directional transport.

## Reference check

320 nearly uniform surface directions spanning intact and damaged states, with shades disabled, were compared to 8,192 CPU rays per location. There were 280 partially shadowed cases.

| Rays | Mean absolute error, percentage points | Maximum error, percentage points |
| --- | ---: | ---: |
| 19 | 1.1664 | 7.2915 |
| 64 | 0.7951 | 4.5654 |
| 128 | 0.4363 | 3.1860 |
| 256 | 0.3025 | 1.5015 |

This is a sampled reference, not an exact integral or a universal worst-case bound. Narrow members remain challenging. The stellar disk is sampled with uniform projected brightness rather than limb darkening.

The GPU check covers 10,710 surface probes at 64/128 samples, both eras, with and without shades. Six probes differ beyond output quantization, all by one ray at 128 samples; maximum difference is 0.007874. The initial exact-agreement check failed. The retained check explicitly bounds error by one source ray plus one output-code value and reports all larger-than-quantization differences. It does not relabel the six disagreements as exact matches. The shade-only check retains 28,350 probes with zero discrepancies at its output tolerance.

## Use and limits

Light > Station shadow integration controls the workload. 64 is the opening default, 128 is a finer study, and 256 is a costly capture option. Turning off the station returns to the original sample count. Quality survives staged scenes and named motion studies; saved scenes carry the chosen value. Missing settings in old scenes default to 64.

Existing preview pixel and frame ceilings remain, but the new integration adds work per ray and can reduce actual frame rate. It is not a watt cap. There is no automatic high-resolution video run in this pass. The improved images should show less quantized station shadowing; recognizable fine bands may remain until integration converges further. Broad physical dimming is retained rather than erased by an artistic blur.

Matched intact, station-only comparison images and scenes are stored in outputs/observatory-v0.8/station-19.png/.json and station-128.png/.json.
