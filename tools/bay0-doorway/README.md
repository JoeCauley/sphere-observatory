# Date Line Exchange doorway trial

Walk the 4 × 4 m Service opening toward The Sideways City at bay 0 between r13c0 and r13c51, seed 713. Opus built the direct City draw and shared destination lighting. This study compares those changes with the original doorway picture and the ordinary walking handoff.

## Walk the marks

On ALPHA, open `I:\Sphere\work\bay0-doorway-trial\Open-Bay0-Doorway.cmd`. It checks the study server, starts one when needed, and opens a private Chrome profile. To verify the endpoint without opening a window, run `.\tools\bay0-doorway\visit.ps1 -Check` from this checkout. The route opens on the City approach. Walk through the Service opening, then turn to face back toward the City. With the station holding the view, step left and right inside the jamb. The nearest apron lamp and the skyline provide two easy landmarks.

For exact repeatable marks, use the browser console in this tester. The first block pauses the clock and places the walker. The remaining lines are independent choices.

```js
const t = await import('/tools/bay0-doorway/trial-page.js');
t.settings({mode:'clipped', light:'sphere', holdBorder:true, farM:0});
await t.open('inside');
const {times} = t.lightSchedule({noon:424000, dusk:425000, night:426000});
t.setTime(times.dusk);
```

| What to see | Console action |
| --- | --- |
| From the hall, facing out at 60 m | `t.place('hall')` |
| At the jamb, 0.7 m inside | `t.place('inside')` |
| From the same eye in the walkable City | `await t.openCity('inside')` |
| Just outside in the walkable City, 0.8 m past the jamb | `await t.openCity('outside')` |
| Back in the station | `t.settings({holdBorder:true}); await t.open('inside')` |
| Compare the original picture under the same Shade | `t.settings({mode:'current', light:'sphere'}); t.place('inside')` |
| Show the original fixed light | `t.settings({light:'reference'}); t.place('hall'); t.place('inside')` |
| Set full light or full shade | `t.setTime(times.noon)` or `t.setTime(times.night)` |

Use `?crossing=city-marsh` for regular walking ownership. A full outward trace runs from 120 m inside the station through the Service opening to at least 1 m outside, at 1× travel pace. Holding the station deliberately extends its responsibility through the gallery. It lets the two doorway implementations be measured at exactly the same eye.

## Repeat the measurements

From the ALPHA trial checkout, run the following in PowerShell.

```powershell
.\tools\bay0-doorway\run.ps1
```

The runner uses the study’s copy of the City–Marsh register and a separate copy of the Bay 0 forest survey register. Each invocation writes a fresh evidence directory. The default run includes the photographs, six near-jamb timing samples, the three outward walks, the release check, and the established Bay 0 flight. It writes `table.md` when the stages validate. Individual stages use `-Stage Visual`, `Timing`, `Crossing`, or `Regression`. The 5-second `-Quick` setting is for a smoke test.

The recorded browser viewport is 1280 × 800 CSS pixels at device scale 1. The station canvas is 944 × 734 with a 75° horizontal field of view. Allow other GPU benchmarks to finish before timing. The six samples alternate their order across the three pairs. A six-second sinusoid repeats five times per sample. WebGL timer queries cover drawing callbacks. GPU-disjoint periods and missing coverage invalidate a sample. The flight has a separate 1024 × 640 draw target and a 20.8 ms frame-p95 budget.

## Read the evidence

The held current picture owns a color card and any capture scratch. The clipped mode draws the same procedural street shader through a WebGL scissor rectangle. The station walls mask the jamb. The optional skyline reduction is off for the measurements. The address counter estimates visible street cells in a horizontal wedge out to 960 m. The CPU retains keys for that opening. Street geometry comes from a per-pixel shader trace.

`trial.json` records poses, simulation seconds, host light readings, source file hashes, raw frame intervals and GPU timings. The crossing timer records both browser frames and gaps between advancing settled walker poses. The latter includes stage replacement and the harness transferring keyboard focus. Historical trials and the operator’s default pilot are independent of these private registers.

The measured ALPHA packet lives at `I:\Sphere\work\bay0-doorway-trial\field-packet`. Open `Bay0-Doorway-Report.pdf` for the decision and paired views, or `table.md` for per-run numbers. The route card gives the exact times for seed 713 with trimmed Shades.
