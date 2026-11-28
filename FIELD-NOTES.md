# Continuous Borders field notes

The default launch starts 4 km before the old positive endpoint. The player can fly across it, land, walk and return to Double Gallery. The two saved roof addresses belong to the expedition register.

## Observatory polish on ALPHA

The freight well used its vacuum flag to switch off the projected sky. At the same upward camera in the well, the previous build showed the distant shell through the crane opening. The revised build showed the local sky through that opening and a steel ceiling in the covered gallery. The well and roof still report vacuum to the physics system. The projected sky fades between 80 and 100 km as the pilot climbs.

At Violet's original grove, three gray faces came from a square recess in the Atlas wall. Both shoulders now taper along the border. Survey, rendered steel and collision use the same profile and a local shell frame. The nearest roof edge is 1.6 km from the grove centre, the 300 m continuous strip crosses the recess, and all 320 original spires clear it. The grove and the marked mineral fork kept their addresses.

The old **Return to the Sphere** view at 1,000 km reproduced the fine repeating purple lattice. Two mineral treatments covered the same plot, including a 16 km repeating pattern. Violet now draws local facets only at distances and pixel sizes where they resolve. At regional scale, the shell uses larger mineral beds. Both builds also flew the same fixed camera at 10,825,590 km. The reported lattice did not reproduce at that height and bearing. The 11.355 km fork descent, walking marks and fresh-browser return passed. One Violet entry failed while several Chrome test runs shared the GPU. Two subsequent single-browser runs opened the survey and passed the parked-view checks.

| Camera on ALPHA | Previous image | Polished image |
| --- | --- | --- |
| Cold station approach at 36 km, full quality | 720 x 434 stretched across the view | 1,614 x 974 in a 1,614 x 974 viewport |
| Parked approach after resizing | Fixed approach cap | 1,324 x 854 in a 1,324 x 854 viewport |
| Violet native approach, full quality | 1,440 x 869 in a wider viewport | 1,614 x 974 in a 1,614 x 974 viewport |

The opening screen gives a first-visit estimate. Its bar advances when the scripts load, the renderer links, the controls connect, and the view is prepared. A direct station launch keeps the screen up until the destination draws and accepts input. Earlier runs on this machine exposed the flight deck roughly half a minute after the old indicator vanished. To repeat the cold approach, resize and native-view checks, run `npm run test:observatory:polish`.

The Bay +1 launcher checks port 8808 and its remembered alternate for this checkout. If both are unavailable, it tries an adjacent port and then lets Windows assign a free one. The launcher uses the same expedition register for Atlas marks and installed packs on every port. Browser-only preferences belong to each browser origin. A fresh Chrome profile opened the flight deck in 55 seconds in the alternate-port trial.

## Identifying the defect

The starting checkout was `I:\Sphere\work\border-outfall-20261124\checkout`, branch `work/border-outfall-maintenance` at `c9cba02cbac64efaca5128641a3798b290cc5e5b`. Its three surveyed halls occupy chainages −200, 0 and +200 km, with half-lengths of 16 km. The last longitudinal connectors and both end halls exhausted the old geometry and occupancy queries at ±216 km. Flying through each old end dropped the previous Border owner. Outside those halls, the expeditions found no freight vehicle travelling in empty space. Distant freight alone is not evidence of a missing wall.

In the reconstructed roof comparison the horizontal lens was 103°, time 44,101.062 s, viewport 1,280 × 760, with weather and Meadow wind fixed. The deck eye was 1,746.7 m and the outside eye was 1,868.6 m. The outside along-wall bearing was estimated from the reported view. The ordinary controls test and the fixed-camera diagnostics are separate recordings.

The near Meadow mesh fades from 28 km to 65.536 km. Its former fallback also turned into sky colour by 80 km. The same pixel samples with the wall hidden showed where the ground disappeared. The new fallback carries the field and its atmospheric extinction out to the more distant shell horizon. The old and new pixels at 25 and 28 km match.

| Sightline distance | Before | Tester |
| --- | --- | --- |
| 25 and 28 km | Near terrain | Near terrain |
| 45 km | Terrain mixed with the distant pass | Terrain mixed with hazed ground |
| 64 and 66 km | Mostly sky | Mostly distant ground |
| 85 and 160 km | Sky | Distant ground, RGB 185, 200, 188 at both rays |

The 64 and 66 km rays land on the same pixel at this resolution. These two samples provide one independent observation.

## Geographic convention

The Atlas declares every plot edge a Border reservation. Its row and column intervals define the network. Procedural terrain cells, canopy changes and mineral seams add no new Border. The district’s installation still owns the three named facilities. Shared edges sort their two plots once. Meridian chainage increases northward and parallel chainage increases eastward. At a vertex the shared ID resolves equal distances, while its physically connected arms remain in the mesh. Longitude wrap, split neighboring rows and a second world were checked independently.

The seed-713 shared meridian `r10c0/r10c1` is about 17.4065 million km long. A 32 km render tile selects a maximum 1,600 km reach either way at production radius. Only nearby stations receive detailed interiors. The local strip includes a roof, its underside, sidewalls and ground contact. Distant visibility uses the shell representation. Both scales use the Atlas and its prototype roof width.

The historic Violet field lies exactly on `r8c31/r9c31`. Here a surveyed 3.2 km recess leaves the grove open from the native side and retains 300 m of continuous roof on the opposite side. The independent collision sweep checked the entire reference list of 320 mineral spires against the recess. The original native 11.355 km descent, selected spire 88, walking view and Shade view passed.

## Player evidence

| Route | Observation |
| --- | --- |
| Both earlier ends | Ordinary forward flight exceeded 305 km in each direction and crossed three tile boundaries each way. |
| Plain roof | First mark at +305.337 km and −430 m across the wall. Walking eye 1,746.7 m. Restart restored the camera and support. |
| Actual corner | Exact-address approach began 9 km before the geographic endpoint. The pilot flew into the junction, turned with the mouse, followed the eastern arm for 40 km and looked back. The second mark belongs to `r10c1/r11c1`. |
| Independent physics | 72 receiving-side probes across two world identities, including wrap and unequal rows. Landings and swept side impacts passed, including reversals. Tests also evaluated an empty station list. |
| Native Jungle | Bay 0 far threshold in the station chart is (−2,600, +24,000) m. The gap lies 411.5 m out and 6.0 m right. The marked mature tree lies 511.5 m out and 60.0 m left. Its native ID is `713:1094362494:944976:410252989` and its original height parameter is 42.1 m. |

## Measured rendering cost

These are 60 warm draws per position at 1,152 × 648, a 103° horizontal lens, fixed lighting and a fixed clock. Chrome reported ANGLE D3D11 on the RTX 5080. CPU submission measures JavaScript and driver submission. GPU times come from disjoint timer queries. Frame intervals include browser pacing. Resident bytes count the station view’s WebGL array buffers.

| Camera from Bay 0 | Build | Frame median / p95, ms | GPU median / p95, ms | Draw calls | Resident bytes | First draw and upload, ms |
| --- | --- | --- | --- | ---: | ---: | ---: |
| +212 km | Previous | 17.8 / 18.1 | 0.104 / 0.116 | 5 | 1,898,256 | 9.5 |
| +212 km | Tester | 17.7 / 18.1 | 0.108 / 0.120 | 6 | 1,926,000 | 10.6 |
| +305 km | Previous | 17.8 / 18.1 | 0.080 / 0.085 | 5 | 1,898,256 | 0.1 |
| +305 km | Tester | 17.7 / 18.7 | 0.062 / 0.078 | 3 | 284,376 | 1.9 |
| +2,212 km | Previous | 17.7 / 18.2 | 0.076 / 0.079 | 5 | 1,898,256 | 0.0 |
| +2,212 km | Tester | 17.7 / 18.1 | 0.063 / 0.069 | 2 | 36,408 | 0.3 |

The tester's warm CPU submission p95 ranged from 0.1 to 0.3 ms. Both builds made zero warm uploads, showed zero WebGL errors and released every instrumented array buffer. Four near/far reversals settled at 284,376 bytes in the tester. The previous renderer continued submitting the freight district at the two distant diagnostic cameras even though its player could not stay on the wall there.

The Jungle tests used the native walking triangles, the menu installer and the normal controls. They recorded the original tree ID in the resident mesh. The day route crossed the entire 48 km Bay 0 service gallery, circled the trunk, climbed above the crown and came down through the gap. A fresh server and browser restored the mark at 1.720 m. Under a real passing Shade, the return route ended on foot in installed Meadow. The local ground set settled at 25 chunks, about 27.2 MB after the bark update. Ground support beneath the crown was checked separately from the high canopy contact.

In the joined run the pilot returned from the 305 km plain-wall mark to Double Gallery at 20 km/s, crossed the Bay 0 roof, and landed on the Meadow apron. Meadow switched to walking as it reached ground. The pilot then walked the gallery, circled the tree, flew through the clearing, reloaded the mark under a Shade and walked all the way back to Meadow. The film uses real-time excerpts and labels the selected travel pace. Chrome reported `net::ERR_NO_BUFFER_SPACE` for one resource during the final gallery return. The run retained control, restored the mark and landed in Meadow with zero uncaught page errors. The release repeat covered all 19 recorded positions, restored the walking eye at 1.720 m, crossed back in full Shade and reached Meadow on foot. The release trace had zero page errors, failed requests or resource-buffer messages.

The habitat comparison used the saved tree and fork poses, the same 103° lens, 1,152 × 648 pixels and a frozen clock on the same GPU. Each row contains 60 warm draws. The preparation column includes native terrain, shader readiness and the first completed draw. Each build visited Jungle first, then Violet in the same new browser process.

| Habitat and build | Prepared frame, s | Frame median / p95, ms | CPU median / p95, ms | GPU median / p95, ms | Draws | Resident terrain bytes |
| --- | ---: | --- | --- | --- | ---: | ---: |
| Jungle, previous | 30.12 | 18.0 / 18.2 | 0.7 / 0.9 | 5.58 / 6.26 | 22 | 28,128,128 |
| Jungle, tester | 29.86 | 18.0 / 18.4 | 0.7 / 0.9 | 5.59 / 8.66 | 22 | 29,821,328 |
| Violet, previous | 3.27 | 17.9 / 18.1 | 0.5 / 0.7 | 3.66 / 3.71 | 27 | 53,237,872 |
| Violet, tester | 3.29 | 18.0 / 18.2 | 0.6 / 0.8 | 3.59 / 3.65 | 27 | 55,144,048 |

The first prepared tree frame made 306 buffer uploads (35,838,528 bytes). The first prepared fork frame made 259 (30,016,800 bytes). Each build settled at 25 active terrain chunks and zero warm uploads and WebGL errors. The Violet rows include retained Jungle terrain. The tester held 55,144,048 terrain bytes across four switches and released them to zero on disposal. The four returns took 1.7–2.7 ms from preparation to completed frame. They submitted 0 buffer uploads in total. Both performance tables compare c9cba02 with the final game code at 0082c39. Each capture ran alone on ALPHA's RTX 5080.

## Violet Labyrinth

The native reference grove is in r9c31. Its original camera points 0.046 radians down from 11.355 km. The expedition first reproduces that camera, then pans about 44° toward the surveyed fork. The saved approach points along the descent. The selected junction is an intersection of the two signed mineral waves already sampled by the far shell and streamed ground. Three surveyed arms follow those waves for about 2.34 km. Near the intersection, broken quartz faces enter the native ground mesh and collision BVH. The seed-713 fork is 26.18 km from the old grove. The seed-714 fork is 41.10 km away and has a different identity.

| Player check | Observed result |
| --- | --- |
| Seed 713 descent | The native camera held throughout. Ninety-nine trace samples cover the long incoming leg. Altitude at the first arm was 1,294 m, then 46 m, followed by a walking landing. |
| Ground | The local collision mesh at the fork contained 174 resident fragments from all three arms. The center of the incoming lane met a solid face 9 m sideways at eye height. The player walked through the junction and looked back from another arm. |
| Restart and ownership | A fresh server and Chrome restored the fork mark, pose and support. The pilot took off, crossed 24 km into Main, and descended geographically into Violet. Removing the pack opened the same mark in native terrain. Reinstallation restored the detailed occurrence while Jungle stayed installed. |
| Original save | A walking bookmark was recorded by the starting build against spire 88. The tester resolved the original mark within 1 m, retained walking support and the same spire mesh, and reproduced its forward vector with a dot product above 0.999. |
| Seed 714 | The second world produced its own fork and landing, restored its pre-upgrade spire 88 and passed the same removal and reinstall while Jungle stayed installed. Both worlds shared one physical register. Their mark lists and occurrence IDs stayed independent. |

The 31-second Violet film shows real-time excerpts from one descent. The survey leg used 1.2 km/s, the low approach 42 m/s and the walk 8x. The final shot turns back toward the fork from the other arm. A second flight saved another mark under the same name and verified the new bookmark after restart.

On the first seed-713 run the overhead native flight crossed into the remote Border chart. Its surface map exaggerated movement that far from Bay 0. The final build keeps the native camera above a distant ordinary roof and measures distant Border movement on the actual shell. The regression checks 500 m steps in four headings, straight and sideways, within 4 mm of their geographic length. The same test requires the roof to retain ownership at landing height.

## More routes from the same Atlas

The pilot used **Atlas places** to travel directly from the Bay 0 tree to the Violet fork. In a disposable copy of the same world, **Install reference grove** added a second Super Jungle occurrence at r9c7, 108,984,677 km from the first. Its native tree is `713:1085074549:141713829:-410448645`. The pilot walked up to the tree, saved a mark, switched between both groves and returned to the old plain-wall mark. Removing and reinstalling the second grove preserved the first tree, Violet, the original special-site save key and both existing marks. Each active grove had one frame and its own saved pose. For cold Atlas travel between two native scenes, the outgoing image holds while the common terrain renderer prepares the destination. A deliberately delayed Violet preparation held the outgoing image. Pressing S cancelled it and moved the walker backwards at the tree. A second click completed the Atlas trip.

Ordinary biome lookup can choose a currently sunlit site. A physical field landmark now uses a fixed geographic candidate. A cold-start test moved a Shade over the Violet grove at 47,280 s, where ordinary lookup selects r9c32, then resolved the original grove, mineral fork and roof shoulder in r9c31. The second Jungle tree also retains its identity under that Shade.

### Candidate for a second staffed Border

Ten candidates around the installed City and Industry plots were sampled. The proposed frontage is the longitude-wrap meridian shared by **r13c0 and r13c51**, near 16.666668° N, 180° longitude. The standard Bay 0 layout at that address has a 48 km hall and service doors at +2,600 m along its axis. The native terrain on both sides samples as Rustwater Marsh. The installed Sideways City occupies its side of the shared edge.

| Proposed approach | Physical result |
| --- | --- |
| City side, r13c0 | Samples at 4, 120, 300 and 400 m belong to City. Its walking solids gave a clear 400 m approach with 0.8 m of lateral clearance. |
| Marsh side, r13c51 | All four samples belong to native Rustwater Marsh. Three eye-level collision rays checked each 2 m interval along the 400 m approach. |
| Nearest installed footprints | The candidate touches City. The nearest points of the stored Meadow, Bay 0 Jungle, Violet and Industry footprints lie about 43.52, 54.98, 378.89 and 398.16 million km away. |

The three older special-site records in this register omit a footprint. The current Atlas assigns each of those legacy records its whole cell. New installs can carry smaller rectangles or ellipses. The distances above use the stored ownership. The authored buildings have their own physical locations inside those cells.

A future second staffed installation would need to select the district by edge identity, retain separate station and freight records, and decide which district owns each doorway and survey renderer. The candidate is a survey. The tester has one staffed network district.

### Industry–City Span concept

The Industry water works have an open terminal approach to their existing arrival at local (+55.43, −32.00) m. The collision survey found an 87 m clear lane. The nearest open City plaza to its local origin is at (−200, 0) m, with a checked 100 m approach. The great-circle distance between these two specific terminals is **397,671,124 km**. Their straight chord through the cavity is **290,501,534 km**. Those distances inform a future route study. A Span still needs a surveyed alignment, clearance and terminals.

## Release checks

The CPU suite and the separate file-backed installation test passed. The store survived a server restart and concurrent world updates. All six browser suites passed their existing thresholds. These covered the bridge, the pack contract, 94 composited roof views, a 410-frame wall replay, failed arrivals with pilot takeover, and the 11.355 km native Violet approach. Each new habitat passed all 26 pack-contract checks. The live tester on port 8808 opened at +212 km with all six installations and six expedition marks. Reopening its launcher reused the same server.

## Limits and next experiment

Only the final 9 km into the remote corner were flown for the junction proof. The intervening millions of kilometres are covered by geographic queries and local streaming tests. One repeat of the full Meadow return logged a Chrome resource-buffer warning. The release repeat reached the destination with a clean browser log, and the dedicated doorway recovery and crossing suites passed. The first prepared Jungle tree frame took 29.9 s on ALPHA. The Jungle GPU median was 5.59 ms. Its p95 rose from 6.26 ms in the previous build to 8.66 ms in this 60-frame run. The next rendering experiment is to time cold shader readiness and terrain uploads separately, then repeat the tree sightline to identify the slower warm frames.

## Reproduce on ALPHA

The committed launcher starts port 8808, opens its own Chrome profile and reads the register one directory above the tester checkout. The existing launcher uses its own checkout and register on 8799. When a proof edits marks, give it a copy of the expedition register. The field packet includes the six installations and six starting marks for seed 713 in `restore/installed-biomes.json`. To seed another fresh tester checkout, place that file one directory above it before the first launch.

```powershell
Set-Location I:\Sphere\work\geographic-borders-expedition\checkout
$env:NODE_PATH = 'I:\Sphere\repositories\sphere-observatory\node_modules'
$env:SPHERE_CONTRACT_HEADLESS = '1'
npm.cmd test
npm.cmd run test:meadow:roof
npm.cmd run test:meadow:transitions
npm.cmd run test:bridge
npm.cmd run test:contract
npm.cmd run test:stage-arrival
npm.cmd run test:violet:browser
node tests/geographic-wall.mjs
node tests/wall-mineral-frontage.mjs
node tests/jungle-survey.mjs
node tests/violet-fork.mjs
$env:SPHERE_WALL_FIELD = '..\evidence\repeat-wall'
node tests/geographic-wall-browser.cjs
$env:SPHERE_FIELD_REGISTER = '..\installed-biomes.json'
$env:SPHERE_JUNGLE_FIELD = '..\evidence\repeat-jungle'
$env:SPHERE_FULL_TRANSECT = '1'
$env:SPHERE_WALL_TRANSECT = '1'
node tests/jungle-expedition-browser.cjs
$env:SPHERE_FIELD_SEED = '713'
$env:SPHERE_VIOLET_FIELD = '..\evidence\repeat-violet'
$env:SPHERE_VIOLET_FILM = '1'
node ..\capture-old-grove.cjs
node tests/violet-expedition-browser.cjs
python ..\expedition-film.py violet $env:SPHERE_VIOLET_FIELD
$env:SPHERE_VIOLET_FILM = '0'
$env:SPHERE_VIOLET_FIELD = '..\evidence\repeat-violet-714'
$env:SPHERE_FIELD_SEED = '714'
node ..\capture-old-grove.cjs
node tests/violet-expedition-browser.cjs
$env:SPHERE_FIELD_SEED = '713'
$env:SPHERE_GROVE_FIELD = '..\evidence\repeat-groves'
node tests/jungle-occurrences-browser.cjs
node scripts/survey-adjacent-frontages.mjs ..\installed-biomes.json ..\evidence\repeat-frontages.json
```

The paired camera harness, movie encoder, frame schedules and complete traces are in `I:\Sphere\work\geographic-borders-expedition`. Each invocation of the field harness starts its own loopback server and native Chrome. It uses exact camera placement for fixed-camera and GPU comparisons.

```powershell
$previous = 'I:\Sphere\work\border-outfall-20261124\checkout'
$tester = (Get-Location).Path
foreach ($task in 'ends','ground','film') {
    node ..\field-capture.cjs $previous before $task
    node ..\field-capture.cjs $tester after $task
}
python ..\compare-crossings.py
node ..\wall-bench.cjs $previous before
node ..\wall-bench.cjs $tester after
node ..\habitat-bench.cjs $previous before
node ..\habitat-bench.cjs $tester after
```
