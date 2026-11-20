# Walking the Sphere · Observatory 1.8.0

The default shell has a radius of 149,597,870.7 km. A great circle is almost 940 million kilometres around. At 2.8 m/s it takes more than ten thousand years to walk one lap. The regression clock advances that time in large strides and stops at every change of ground.

## Three engineering passes

| Pass | What the measurements or walks exposed | Shipped change | Regression |
| --- | --- | --- | --- |
| 1 · Opening and Visit | The HTTP process hashed the asset collection while requests waited. Main and the atlas linked separate copies of the shell shader. Violet’s first ground visit spent most of its wait preparing graphics. | Fingerprint in a worker, fetch ordered script groups together, share the shell program, and overlap ground, artwork and atmosphere preparation. The viewport names the destination and shows real preparation phases. | Cold opening and three public Visit clicks. Cancellation, injected failure, retry, renderer disposal and target identity. |
| 2 · Border handoffs | The Outfall’s service entrance and east–west gallery had no through route. | One fixed-size Outfall shell provides a straight 1,000 km aisle. The floor, walls and roof participate in collision. Its endpoints use the adjacent landscapes’ colours and their actual chart coordinates. | Keyboard entry and return, midpoint save and reload, swept wall and floor contacts, exact far-side placement, plus Meadow apron and Industry regressions. |
| 3 · Full laps | A map boundary and the point where terrain reports a new dominant material can differ by metres on a one-AU shell. A missed small pack would still leave a seemingly closed walk. | Find candidate intersections analytically, refine them against live habitat ownership, and integrate from the traveller’s last position. The circuit planner targets small installations alongside freely chosen bearings. The portal survey consults the same generated solids as City and Industry walking. Static resources support HTTP revalidation and Windows startup checks the local listener directly. | Signed revolutions, independent distance and closure checks, rendered crossings, alternate seeds, frame readiness, restart, and legacy flight tests. |

## What changes at a border

A footfall from one owner to another opens the Outfall aisle. The near mouth sits on the observed ownership change. The far mouth lies 1,000 km away along a chord of the Sphere. For a shell of radius R kilometres, the two radii enclose an angle of 2 × arcsin(500 / R). On the default shell the midpoint of that straight line is about 0.84 metres closer to the star than the shell arc. Your heading follows the same great-circle plane on the other side. The service installation in Meadow also retains its handwheel, apron and cross-gallery.

Before opening a passage to City or Industry, a survey checks the destination pack’s walking floor and solids. If a building blocks the proposed outlet, the near mouth stays fixed and the survey tries straight chords on either side. It checks every two metres of lateral offset up to 512 m. One recorded City building required a 22 m shift at the far end. The passage still measured 1,000 km, and the walker emerged on open City ground.

Both doors wait until the destination supports a walker. A failed handoff keeps the departure available for retry. A virtual tunnel has its own world-scoped save, separate from the installed Outfall’s manual pose. The developer clock offers real time, 1,000× and 10,000× in the aisle.

## What a circuit proves

Three bearings come directly from a seeded random generator. Further bearings pass through the installed plots and the Outfall service opening. The suite adds equatorial departures until it covers all ten original habitat IDs, the three structural areas and the polar surface. It rejects great circles that intersect an open wound or require the tunnel to turn aside for a building. Each planned landing inside a pack is also checked against its walking support and clearance. An accepted route follows one plane for its entire revolution.

Each numerical stride carries forward the position already reached. The native browser run also takes its next geographic stride from the active walking camera. It exercises a real walking surface at the middle and end of each ground leg, enters through the normal edge detector, reaches the halfway mark in the rendered tunnel and walks out to the far-side terrain. The independent pass measures signed angle, distance consumed and final displacement. Ground between those accelerated footfalls is represented by the shell model. Detailed local collision is checked along the tunnel and by the individual biome walking suites.

## Measurements

On the default one-AU world, **9 complete browser circuits** covered **159 rendered through-tunnels**, 168 ground legs and 8.46 billion kilometres. The largest measured difference between departure and return was **0.17 mm**. The browser reported zero page errors. Each route checked its WebGL contexts, its on-foot camera and a signed 360° revolution.

The following measurements used the public Explore and Visit controls at 1200 × 760 in headless Chrome 157 on an RTX 5080 with Direct3D 11. Each build started with a fresh browser profile and server after the other browser suites had finished. Elapsed time runs from navigation to the prepared frame, or from the click to a committed arrival. These are individual runs and respond to GPU-driver cache state and machine load.

| Operation | Previous local build | Observatory 1.8.0 |
| --- | ---: | ---: |
| Fresh navigation to the first prepared frame | 38.35 s | 38.38 s |
| First Visit to Violet Labyrinth on foot | 96.36 s | 42.27 s |
| Next Visit to Dark Age Forest on foot | 3.37 s | 3.49 s |
| Return to the prepared Violet ground | 4 ms | 34 ms |
| Reopen the saved place in the same profile | 5.54 s | 5.07 s |

An earlier matched pair isolated shader sharing during pass one. Opening took 40.36 s before and 39.60 s after. The first Violet Visit fell from 99.64 s to 42.64 s. A repeat Visit in an already prepared scene took milliseconds. The driver still does substantial work on a cold visit.

Across seven fresh local server starts per build, the median time to receive both the page and its bootstrap while fingerprinting fell from **239 ms to 8 ms**. The full fingerprint finished in 249 ms in the release. The browser could already load scripts during that interval.

The Windows launcher also checks that its own checkout answered before opening the browser. A fresh server answered in 2.19 s including PowerShell startup. Running the launcher a second time reached the same process in 0.93 s.

## Reproduce

Run from the repository root with Node.js 20 or later. Install the test dependencies with `npm ci`, then use `npx playwright install chromium` or set `SPHERE_NATIVE_BROWSER` to the installed Chrome executable. Each browser suite owns its server, profile and installation register.

| Command | Result |
| --- | --- |
| `npm test` | Core regressions, tunnel geometry and seeded numerical circuits |
| `npm run test:transit` | The travel card paints before expensive work. Cancel and retry through the public controls. |
| `npm run test:border:browser` | Walk inside Outfall, reload at 500 km, emerge and retrace the portal. |
| `npm run test:walks:browser` | Complete the full set of live-camera circuits against the actual installed library. |
| `node tools/measure-opening-http.cjs [baseline-checkout]` | Seven fresh server starts per checkout, alternating order. Time the page and bootstrap while the asset fingerprint is calculated. |
| `node tools/measure-visits.cjs sample.json` | Time a fresh opening, the first Violet and Forest visits, return to Violet, and reload in the same profile. |

Set `SPHERE_WALK_SEED` to a decimal integer to choose another reproducible set of bearings. Set `SPHERE_CIRCUIT_REPORT` to a filename to retain the browser’s measurements, or `SPHERE_WALK_HEADLESS=0` to watch the route in a browser window. GitHub runs the complete plan in three shards. [Recorded walks and screenshots](../examples/biomes/surface-walks.json) · [Back to the Observatory](../README.md)
