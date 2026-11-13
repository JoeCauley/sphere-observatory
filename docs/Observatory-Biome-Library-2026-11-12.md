# Biome library: install, place, visit and draw

12 November 2026. Written by Claude at Joe's direction. Replaces the original biome service on the install path. That service remains in the tree and can be loaded with `?service` in the address.

## Why the original service was set aside

Measured on 12 November:

- **Installs did not survive a browser update.** World identity was a hash that included a numeric capture embedding the exact browser build (full Chromium version, platform version and user-agent string). When the build changed, the saved world was no longer recognised; storage was intact but the panel read "No biomes installed in this world".
- **Ceilings of 64 releases and 128 regions**, inside a digest every saved world referenced.
- **Over 40 seconds per install**, 820 operation rows and 945 resource rows for two installs, and a failure if the clock was running.
- **Boot.** With the service loading, Main was not ready until past 40 seconds. Without it, about 1 second warm.

## What exists now

| File | Role |
| --- | --- |
| `packs/biome-library.json` | One entry per installable biome: name, version, scene, save key, placement rule, footprint radius, look from above, travel behaviour. Adding a biome is adding an entry. |
| `biome-library.js` | Loads the library and the installed list, places and removes biomes, flies Main to one, and draws the Biomes panel. |
| `installed-biomes.json` | The installed list, written by the local server beside the app. Keyed by a world key derived only from the Sphere's parameters (seed, radius, axis, waist width, layout and shade geometry revisions). |
| `serve.cjs` | Adds `GET`/`PUT /api/installed-biomes`. Loopback host only, same origin only, JSON only, 1 MiB limit, written to a temporary file then renamed. |
| `biome-surface.js` | Draws installed biomes on the inner surface through a neutral overlay hook in `renderer.js` (`setSurfaceOverlay`). |
| `stage-frame.js` | Visit and Fly to, now driven by the library. |

Nothing above is digest-pinned. `bootstrap.js` and `renderer.js` were edited, so the original service's profile was regenerated (`node scripts/build-main-install-profiles-v10.cjs --both`) to keep its opt-in path valid.

## Placement

In layout 2 each shade route sweeps a band of latitude in the world frame: Verdant at -13.33 degrees, Opaline at 0, Amber at +13.33, each 5.87 degrees either side. A biome declares `within` (under a track), `outside` (the gaps between tracks or a 3.5 degree skirt beyond the outer two) or `anywhere`. Candidates come from a sequence seeded by the pack id; the first that clears the wounds, the breach, the polar entries (beyond 75 degrees) and every installed footprint wins. Same pack, same world, same place.

Infinite Meadow lands beneath the Verdant track at 17.16 S, 64.21 E. Infinite Industry lands in open light at 6.63 N, 34.88 W.

## Drawing on the surface

One RGBA32F texture, 512 wide. Rows 0 to 63 hold a 64 x 64 grid per cube face; each cell gives the start and length of its list of nearby biomes. Rows from 64 hold four texels per list entry: centre and chord radius, colour and pattern, accent, tangent. A pixel reads one cell and tests at most 12 entries, so per-pixel cost does not grow with the number installed. Distance is measured as a chord, because a 50,000 km footprint on a 1 AU sphere is too small for a dot product in 32-bit floats. A biome smaller than a few pixels is drawn as a marker.

## Measured

- Placement, headless against Main's real geometry modules: 600 biomes in 77 to 95 ms, worst single 7.6 ms, at most 3 candidates tried, no overlaps, no rule violations, nothing in a wound or at a pole, deterministic.
- Surface texture at 600 biomes: 656 KiB, built in 32 ms, no overfull cells.
- In the browser pane: both installs about 1 ms each; installed list 699 bytes; Visit opens in 361 ms; the full Meadow to Industry flight completes (crossing peaks near 21 million km above the surface now that the two sit about 100 degrees apart); a reload restores both biomes and the open scene within about 6 to 8 seconds.
- Overlay shader: 38.7 s to compile the first time, in the background without blocking the page; 67 ms on the next load once the browser has cached it.

## The atlas (added 12 November, after Joe described the full picture)

Joe's direction: biomes fill the entire inner surface; long thin border biomes divide them; Builder infrastructure has its own special biomes (the Docks, polar megalopoli, Sphere-wide transport, Ghost Radio); some areas are blank and some under construction. This replaces the scattered-disc model above. The Placement and Drawing sections above describe the first version and are superseded where they conflict.

`sphere-atlas.js` divides the surface into 890 plots: 22 rows of latitude in the world frame, 6.667 degrees tall, aligned to Main's geography so that the habitat waist is six rows, two under each shade track. Rows are cut into near-square plots, 54 at the equator down to 18 at the last row. 318 plots are in the waist, 572 in the shell works. An equatorial plot is about 17.4 million km across, roughly 590,000 Earth surfaces, which agrees with the World Document's figure of about 600 million Earth-surfaces for the whole Sphere.

Every point is one of: a plot (installed, blank, or under construction), a border (20,000 km either side of every plot edge), a transport trunk (the two waist edges and six meridians, 60,000 km), or a polar megalopolis (beyond 73.33 degrees). Wounds and the breach remain Main's; plots they cut are not offered.

Installing gives a biome one free plot: `within` a plot in the waist, `outside` a plot in the shell works nearest the waist first, and `placement.prefer` may name a Main province. Infinite Meadow takes r12c35 beneath the Amber track in the Mycelium Sea; Infinite Industry takes r7c23 in the Air and water works. Installs recorded before the atlas are given plots automatically.

`biome-surface.js` now repeats the atlas arithmetic in the shader and reads one 64 x 44 float texture (45 KiB): a texel per plot for colour and state, a second for accent and pattern. Blank plots keep Main's ground drained of colour; declared construction plots carry amber striping; borders and trunks narrower than a pixel are drawn at about a pixel so the partition reads from any distance.

Measured: filling every eligible plot (291 waist, 519 shell works, with none under construction) takes about 0.6 s headless, each placement under 2.5 ms, all unique. In the browser the atlas shader compiled in 37.5 s in the background and drew with no GL error.

### Lore sources checked on 12 November, and what they changed

Read, inside `I:/Sphere`: `docs/Builders-Stewardship-Charter.md` (v0.3, 5 September), `docs/Sphere-Project-Living-Atlas.md`, `docs/Sphere-Project-Curator-Protocol.md`, `docs/Sphere-Project-Source-Register.json` (snapshot 10 November, 52 threads), and the raw session export `analysis/infinite-biomes-codex-sessions.csv` (20 September).

- The Charter describes the Sphere as a collection with isolation by distance as a design choice, "not evidence that the territory beyond their knowledge is empty", and says "bare structure need not be ruined". A blank plot is therefore bare Builder structure with no collection declared, not a dead zone. This is a different emphasis from the World Document's "mostly dead"; the Charter is the later document and itself notes version conflicts.
- The Charter requires that "the world generator ... must not invent definitive answers to the Builders' mysteries to fill empty data fields". The generated under-construction sprinkle did that and was removed. The plot grid, widths, trunk routes and polar boundary are labelled PROPOSED in `sphere-atlas.js`.
- "Where incompatible environments meet, the design must identify actual boundaries or explicitly declared Builder technologies." That is the lore basis for border biomes: a border has to do real containment work, not only draw a line.
- The Charter's list of what to record for a region (collection purpose; inhabitants and ecological relationships; physical conditions; containment; light and presented sky; service dependencies; resident permissions; maintenance behaviour; means of observation or access) is a ready-made outline for what a Foundry biome must declare.
- Article V makes sky concealment a standard Builder "duck blind" with a gradual fade whose altitude can differ by region. Infinite Meadow already has a Duck Blind height; it belongs in every biome's declaration.

Not found in anything readable: the Docks, polar megalopoli, border biomes, or "under construction". "Ghost Radio" appears only as a section title of the EX TERRA show bible.

Not readable from this session (outside the connected folder; the access prompt appears on ALPHA and timed out while Joe was remote):
- `C:/Users/Joe/Documents/Codex/2026-10-09/.../work/show_bible.md` and `conversation_transcript.txt` (EX TERRA show bible, 51 pages, 21 sections including Ghost Radio).
- `C:/Users/Joe/Documents/Codex/2026-09-25/.../outputs/Sphere_Biome_Foundry_Technical_Requirements.md` and `Sphere_Biome_Foundry_Contract.md` (87 requirements, 24 contract clauses, 21 conformance-test families, all PROPOSAL per the Living Atlas).
- Dated folders `2026-11-02` and `2026-11-04` under `C:/Users/Joe/Documents/Codex`, contents unknown.
- `C:/Users/Joe/.codex/sessions` (Codex session records).

Provisional, and Joe's to decide:
- Plot size and count (890). Border and trunk widths. That blank means "drained of colour" and not something starker.
- Which plots are under construction. None are, until declared in `packs/biome-library.json` under `atlas.underConstruction`. An earlier fixed 4 percent sprinkle was removed (see Lore sources).
- Where the Docks and Ghost Radio are. They are not placed: neither appears in the World Document or the Briefing, so nothing was invented for them. The same is true of polar megalopoli and Sphere-wide transport as names; the caps and trunks drawn here are a first reading.
- Canon: the World Document says the Sphere is "mostly dead", with living biomes as "archipelagos". The atlas is consistent with that only while most plots stay blank. A candidate for a formal session.
- Borders are drawn, but are not yet biomes: nothing can be installed on or visited in one.

## Background-tab start, and re-verification on the atlas (12 November, later)

**Cause.** A hidden or background tab never delivers `requestAnimationFrame` callbacks. The boot, the loading screen, Main's draw loop and the pack runtime all wait on them, so a hidden Observatory stopped at "Preparing your viewpoint" with only the first scripts loaded. In Claude's browser pane the page reported `visibilityState: visible` while delivering zero frames, so visibility could not be used as the test.

**Fix.** `frame-fallback.js`, loaded first from `index.html`: every frame request also arms a 250 ms timer; whichever fires first runs the callback once and cancels the other. Nothing changes in a visible tab. `stage-frame.js` installs the same fallback into a scene's window as soon as it exists, before the scene's deferred scripts start. No pinned file was edited.

**Verified with the pane hidden throughout:**
- Main opened and listed both biomes; the atlas shader loaded from cache in 57 ms; 890 plots, 0 under construction, no GL error.
- Visit (panel button) opened Infinite Meadow at plot r12c35 in 504 ms, on the saved position, running on timer frames.
- Fly to Infinite Industry completed: all five ascent stages, crossing peaking near 47.3 million km above the surface, Main descent to 1,500 km, Industry revealed near 1,790 m and gliding to 116 m, arrival in FLIGHT mode, Meadow save equal to its bookmark, no console warnings.
- On timer frames the whole flight took about 160 s; on screen it is about 100 s.

Still not run: Industry to Meadow; a literal browser quit and relaunch; Chrome; the on-disk store in the real app (the server on 8881 predates the endpoint).

Cosmetic, seen in a narrow pane: the scene bar's address text wraps onto many lines and makes the bar tall.

## Not verified, or weak

- **The file store in the real app.** The server on port 8881 was started before the endpoint existed, so the browser runs used the browser-storage fallback. The endpoint itself was tested separately with curl (read, write, bad shape, wrong content type, foreign origin, foreign host). On the first load after a restart, installs held in browser storage are moved into the file.
- **The far-view marker.** Drawn, but not distinguishable by eye behind Main's centre reticle at 12 million km. Industry's footprint is low contrast (stone on grey).
- **Chrome**, and a literal browser quit and relaunch.
- **Hundreds of real biomes.** The scale numbers are from synthetic entries; only two real packs exist.
- Other layouts: placement by track needs layout 2.
- Authored field sites (about 1.2 km) are not excluded; the chance of collision is small but not zero.
- The first overlay compile after any change to Main's surface shader takes tens of seconds again.

## Unchanged limits

Still a portal: the scene you walk is not shaped or lit by its place on the Sphere, and the footprint drawn from above is the pack's declared look, not an image of the scene.

## Third biome through the library alone: The Sideways City (12 November, evening)

The test of "hundreds": a biome added with one library entry and no special case anywhere else. `packs/sideways-city/1.0.0/` (`index.html`, `city.js`) is self-contained, imports nothing from another pack, and implements contract `sphere-biome/1`. Its only registration is the entry in `packs/biome-library.json`. `stage-frame.js` knows it only through the generic contract branches.

**Run in Main after the server restart (browser pane, RTX 5080, pane displayed):**
- The on-disk store is live. `GET /api/installed-biomes` returned Meadow and Industry from the file, moved over from browser storage; the library reports persistence `file`.
- `SphereBiomeLibrary.install('sideways-city')`: 4 ms, plot r13c0, beneath the Amber track, written to the file, listed in the Biomes panel with Visit / View from above / Remove.
- Visit: frame open 368 ms after the call; `ready` 101 ms later; 120 frames in 2 s; all 289 cells built; no GL error, no console output.
- On foot: the ramp carries you from the street (1.7 m) onto the plinth (3.2 m); the building wall stops you. Space lifts off to 13.7 m; E climbs. Save this place writes the save.
- Return to the Sphere: frame removed, 0 buffers left. Visit again: identical pose, 468 ms.
- City to Industry (`SphereBiome.ascend()`): 16 s scripted rise to 3,000 m, dissolve, crossing, Industry revealed at 38 s, flight over by about 52 s. The city save was byte-identical before and after.
- Meadow to City (`?arrival=air`, `SphereBiome.arrived`): 85.8 s in all. The city loaded hidden at 2,396 m on approach, was revealed at about 811 m, and `arrived` resolved at 60 m. Meadow's save was back at its bookmark. The city's saved place was still the one last stood in, after the 5 s autosave had fired.

**Defects found and fixed in `city.js`:**
- Lighting. The box faces have mixed winding and most normals pointed inward, so roofs and plinth tops were lit as if from below. The mesh shader now turns the normal to face the viewer. Seen first in a headless browser (software GL), confirmed fixed on the real GPU.
- Save after an air arrival. The arrival cleared the kept place when it finished, so the autosave replaced the last place stood in with a hover at 60 m. Removed; the kept place now holds until the controls are taken.
- Plaza rails and the plaza monolith were drawn but not solid. They are now listed as collision boxes (not exercised in a browser yet).

**Not verified, or weak:**
- Curb-as-wall was confirmed in the headless run only (stopped at the plinth edge at street height). In Main the attempt was spoiled when Joe took the view mid-test.
- Plaza collision, landing with F in Main (headless only), Industry to City, City to Meadow, Industry to Meadow.
- Placement prediction. The headless run on 12 November predicted plot r13c4; the app gave r13c0. Cause not found. Until it is, "same pack, same world, same place" is shown within the app (file and panel agree) but not between the headless tool and the app.
- The province under plot r13c0 is Rustwater Marsh. Placement follows the track rule only; nothing checks that a biome suits the province it lands in.

**Findings for the contract (item 4):**
- An air arrival starts its clock when the page loads, not when it is revealed, so the first 4.5 s of a 13 s approach ran unseen. The contract needs either a start signal from the host or a rule that the host reveals as soon as `ready` resolves.
- `inspect()` (frames, cells built, buffers, scripted) was what made the biome testable from Main. It should be required, not optional.
- The host calls `groundSave` on any scene's save key when leaving by air. It is a no-op on the city's save shape; the contract should state that the biome owns its save and the host does not edit it.
- A biome that draws must be testable without a visible tab; the host's frame fallback covers that only when the biome is opened through Main.

## Stagecraft: hiding the joins between Main and a biome (12 November, night)

Joe's direction: the transitions read as loading screens; hide them with every stage trick available.

**What the "loading screen" was.** Main has a preparation gate (`loading-screen.js`). Whenever its camera enters a view whose assets are not prepared, it raises the "Preparing your view" card and holds its frames until `renderer.prepare` finishes. A flight sends Main's camera to views it has never shown (low over a plot), so the card could appear at the join. Seen directly on 12 November: Main placed at 1,500 km put the card up with "Lighting the view".

**The tricks, all in `stage-frame.js` unless noted:**
- **Rehearsal.** While the departing scene still covers Main (during its lift-off), Main is sent to the low view at the destination and then at the origin, and prepares both unseen (`rehearse`).
- **Ask before showing.** Before Main is shown low over a plot, its own gate is asked (`SphereLoading.needs`) at twelve heights on the way up; Main is never shown below the lowest height it can hold without stopping (`floorKm`).
- **No card in flight.** While a scene covers Main, or a flight is running, the card is invisible (`body.stage-quiet`). A missed case is a held frame, not a card.
- **Same-height exchange.** A contract biome is asked to climb to 1,500 km looking straight down (`ascend({ toAltitudeM, handoff })`), where its ground is a flat field of colour. Main enters at the same height over the same plot, looking straight down. Arrival is the mirror image: the biome waits at 1,500 km (`?arrival=air&hold=1&fromM=1500000`) and starts down on `begin()`.
- **Motion through the cut.** The biome's climb gathers pace to the end and Main's rise starts at full pace; Main's descent gathers pace and the biome's starts at full pace. Main's durations are set from the height ratio (`paceMs`).
- **Soft-focus cross-dissolve.** Both pictures are blurred while they exchange (`dissolve`), 1.6 s in flight. Needs nothing declared by a biome, so it also covers Meadow and Industry.
- **Preload during the crossing.** The destination opens unseen as soon as the origin closes. The city builds the cells at the end of its approach while it waits (`city.js`).
- **Visit, Return and reopen** use the same dissolve (0.7 s in, 0.5 s out). The scene is opened unseen and shown once it has drawn, so there is no black frame.
- City: buildings fade out between 1.5 and 2.5 km instead of vanishing; cells wholly behind the eye are not drawn (180 of 289 on foot).

**Measured in Main (browser pane displayed, RTX 5080), four flights, each run once:**

| Flight | Total | Main enters at | Main leaves at | Card on screen | Main preparing |
| --- | --- | --- | --- | --- | --- |
| Industry to City | 37.4 s | overview (Industry has no ascent) | 1,500 km | 0 ms | 0.1 s, behind the scene |
| City to Meadow | 47.5 s | 1,500 km | 1,500 km | 0 ms | 0.1 s, behind the scene |
| Meadow to City | 92.3 s | overview (after Meadow's own journey) | 1,500 km | 0 ms | 0 |
| City to Industry | 61.7 s | 1,500 km | 1,500 km | 0 ms | 0 |

In the City to Meadow exchange, a screenshot at the midpoint showed one flat field of pale stone across the whole viewport (city at 1,500 km, Main near 6,700 km). The city save was byte-identical across both city departures; Meadow's save was at its bookmark after Meadow to City. No console output in any run. Industry to City and City to Meadow had not been run before today.

**Cost.** Flights from the city are about 10 s longer than before (City to Industry 52 s to 62 s; Meadow to City 86 s to 92 s), because Main now rises from and sinks to 1,500 km at a matched pace. Visit takes about 1.2 s instead of 0.4 s (wait for the first frame, then 0.7 s dissolve).

**Not verified, or weak:**
- **Cold start.** Every run above had Main's low views already in the browser's cache from earlier in the session, so preparation took 0.1 s. In a fresh browser the rehearsal has up to 12 s per end; whether that is enough, and whether the floor check then keeps Main high, has not been seen.
- **The crossing itself.** Main's gate can still fire mid-crossing. With the card hidden that would show as a held frame. None was recorded (preparing time was 0 during every crossing), on warm caches.
- Meadow and Industry are not contract biomes. Arriving at Meadow is still a cut from 1,500 km to standing in grass, softened only by the dissolve; arriving at Industry is 1,500 km to about 1.9 km. Meadow 1.0.0 is immutable, so closing that needs a decision from Joe.
- Main's own chrome (the place label at the top and the toolbar at the bottom of the viewport) appears as the scene leaves. It was left alone.
- The exchange is flat colour to flat colour, but the two colours are not matched by any rule; they happened to be close for the city. A biome whose high view differs strongly from its declared overview colour would show a colour shift.
- Whether a human eye reads the result as seamless. The numbers say no card and no stop; Joe has not yet watched the new flights.
- The cover gate in `app.js` (Main skips drawing while a scene covers it) saves nothing measurable: with the clock playing Main drew 0.3 frames a second under a scene even with the gate off. Kept as a guard.

**For the contract (item 4), added to the findings above:** `ascend` options and held arrival with `begin()` are now what the host uses; the earlier finding about the arrival clock is closed for the city. Still needed: a declared high-view colour (or a rule that it equals the overview colour), and a statement that a biome must be a flat field by the handoff height.

**Files changed:** `stage-frame.js`, `packs/sideways-city/1.0.0/city.js`, `app.js` (one condition; profiles regenerated with `--both`, provider digests unchanged), `.gitignore` (`/installed-biomes.json`).

## Measurements for seamless movement (13 November)

Joe's goal: seamless movement point to point anywhere on the Sphere, no visible dissolves or teleports, the camera moves even for Visit; hide the tricks in "deep in atmosphere" places. The viewpoint is a lens, not a vehicle (Joe, 13 November), so flight speed is unconstrained for now. Nothing below is built; these are the measurements the plan rests on. Browser pane, RTX 5080.

**Main can go low.** Main accepted 1,500, 150 and 15 km over all three installed plots. At 15 km looking down it draws pale ground with cloud mottling; looking toward the horizon it draws a warm haze band with the inner surface, a shade and its track above. Frame cost at 15 km: 2.7 ms on the GPU.

**Main already has an atmosphere.** `asset-plan.js` keys Main's pipeline on weather: `local` below 160 km, `far` above, `dust` for cavity haze. `atmosphere.js` holds a volume march with noise and climate textures. State at the time: `atmosphere` 1, `cavityHaze` 0.28.

**What the card costs when Main is not ready** (after a reload; first visit to each view in that page load):

| Plot | 1,500 km | 150 km | 15 km |
| --- | --- | --- | --- |
| Sideways City | 0 (restored at boot) | 3.8 s | 2.9 s |
| Infinite Meadow | 1.3 s | 0 | 1.1 s |
| Infinite Industry | 1.3 s | 0 | 0 |

The cost follows the view plan, not the height: the first drop below 160 km builds the low-air program (`SphereVolume.march`), and each new region loads artwork.

**Main can be made ready ahead of time, unseen.** After a reload parked at 30.6 million km (only the `far` program built):
- `renderer.prepare(state)` for a view Main was not at ran with no card, no hold and no error, 68 to 123 ms per height, and left Main's own view intact. Alone it was not enough: the gate still fired on arrival (1.25 s).
- Building the low-air program first, with the renderer's own call (`weather.program ??= SphereGLProgram(gl, SphereShaders.vertex, SphereVolume.march)`), returned in 12 ms.
- With both done, Main was sent through 1,500, 150 and 15 km over the city: the gate did not fire at any of them and the card was on screen for 0 ms.

**Not shown by these runs:**
- The 12 ms is the time the build call took to return. Whether the driver defers work to the first draw, and how long that first frame takes, was not measured.
- One page load each; shader and HTTP caches from earlier loads were present. A browser that has never opened the Observatory was not tested.
- Only the three installed plots, straight down, plus one horizon view. Provinces with their own artwork, wounds and authored sites were not probed.
- Whether `prepare` for many views evicts earlier ones.

## The reveal without pop-in: the far city traced from the city's own function (13 November)

Joe's direction: the critical moment is when the dense air thins and the infinite biome comes into view; complex structure should be visible without pop-in; any trick is acceptable as long as the Atlas is the actual Sphere.

**Why it popped.** The city was drawn two ways: meshes within 1.6 km of the eye and a painted street grid beyond. Two representations pop where they meet.

**What replaced it (`packs/sideways-city/1.0.0/city.js`).** The city is a function of cell index. The ground shader now steps each pixel's ray through the street grid and, for every cell crossed, rebuilds that cell from the same hash the meshes use (plinth, ramps, up to three tiers, doors, tower shaft and cap, pool, plaza rails and marker) and intersects it. Meshes are kept only below 600 m and only for the widest complete ring of cells around the eye; the shader skips exactly those cells, so each cell is drawn once. Where a building would be narrower than a pixel it fades into the average colour of its block (6 to 30 m per pixel), which is what makes the city emerge gradually on a descent instead of appearing. `?far=1` forces the traced version everywhere, as a test aid.

**Verified, headless (software GL, 800 x 450):**
- Mesh and trace of the same view agree building for building, including in negative cell coordinates, so the shader hash matches the JavaScript hash. Mean difference 0.25 to 0.73 out of 255 over three views; 0.1 to 0.7 percent of pixels differ by more than 40, on edges (the meshes are antialiased, the trace is not) and ramp sides.
- The comparison exposed a mesh bug: pool water was drawn beneath its own plinth top and never seen. Fixed.
- Stills at 15 km, 5 km, 1.5 km and 300 m: fine-grained field, then grid with blocks emerging toward the nearer ground, then the full city into haze, then meshes near with trace beyond and no visible boundary.

**Verified in Main (RTX 5080, pane hidden, 1165 x 1259):**
- No shader or GL errors in eight views from the street to 15 km.
- Industry to City flight: traced from 1,500 km to 600 m, then the meshes appear as one complete ring (built while the biome waited); no card; saved place kept.
- Frame cost 0.2 to 0.5 ms measured around the draw with `gl.finish()`. Treat as a lower bound: the pane was hidden, and whether the browser's finish waits for the GPU was not established.

**Not verified, or weak:**
- Nobody has watched it move. Shimmer on fine detail in motion (the trace has no antialiasing) is the most likely complaint, and stills cannot show it.
- The mesh-to-trace switch at 600 m was compared in stills at fixed views, not watched during a descent.
- The shader hash was checked by picture, not exhaustively. A float rounding difference could flip one cell in millions; none was seen.
- Cost on a weaker GPU. The ray may cross up to 96 cells per pixel.
- Three Canvas2D `getImageData` warnings appeared in Main's console during the timing runs; the city uses no 2D canvas, and their source was not traced.

**What this is for the contract (item 4).** A biome's far field must be the same function as its near field, and a biome should provide a way to render one view both ways so the agreement can be measured. This is the first requirement that speaks to "infinite" directly. It suits biomes that are functions of position (a city, a works); grass and trees are a different problem and nothing here claims to solve them.

## Air and the Duck Blind: what the lore says, and a declared-air prototype (13 November)

Joe's direction: go on Meadow 1.1.0 and Industry 1.1.0; the air decision depends on whether different atmospheric transitions can be implemented; there will be thick and thin atmospheres; keep the technology open for variety, including floating islands.

**Lore read** (import at `I:/Sphere/work/lore-import-20261112/Documents-Codex`, 1,208 text files outside dependency folders; searched, not read in full):
- Show bible, 9 October, marked CANON: "Above the Duck Blind, obscuring cloud can give way over a few seconds to a fast fall away of concealment and the first discernible meadow below. Different regions have different presented skies." Joe in the source conversation: "It is a fast fall away after a few seconds in obscuring cloud."
- Show bible glossary: Duck Blind is "Regional concealment and managed daylight vocabulary; sky presentation and light supply have separate functions"; status "Canon and repository established; mechanism open".
- Design Requirements DR-12: regional altitude fade; concealment and daylight have separate parameters; the fictional mechanism remains open; "no inherited kilometre value becomes canon". The grass transition test plan (30 September) adds: gradual reveal "with no camera teleport", and lists as an open decision for Joe which behaviour is essential (physical crossing surface, optical concealment, fade interval, deck altitude, or a combination); "The older 1-3 km fade and 4 km deck values are explicitly not canon."
- Atmosphere: needs "a retention and compartment account"; pressure boundaries or declared containment between differing regions.
- Not found in the import: floating islands, megalopoli, border biomes, "under construction". "The Docks" and "Ghost Radio" appear in the 9 October transcript and show bible; those passages were not read today.
- Correction to an earlier note in this document: the blind is not strictly one-way. Canon has the ground discernible from above and a few seconds of obscuring cloud while crossing.

**Prototype (`city.js`).** The air is declared, not built in: `haze` is a list of level layers (base, top, dimming per kilometre of path), integrated exactly along each pixel's ray; `blind` is a band (base, top, edge) that veils the eye only while the eye is inside it, with wisps that stream as the eye climbs. Two declarations exist, chosen with `?air=thin` (default) or `?air=thick`. The pack reports its declaration (`SphereBiome.air()`) and how veiled the view is now (`inspect().veil`, 0 to 1). Every height in both declarations is PROPOSED.

**Verified.** Headless, twelve stills (two airs, six heights), no errors: in thin air the city is crisp at 1 km and a faint grid at 5 km; in thick air it is half lost at 1 km and gone by 5 km; inside the blind both are fully veiled and `veil` reads 1; above it `veil` reads 0. In Main on the RTX 5080: no shader or GL error; a contract ascent to 20 km passed through the blind with `veil` at 1 from about 9.4 to 10.2 km.

**What this answers.** Different atmospheric transitions are implementable: thickness, layering and blind height are data. `veil` gives a host the moment at which a lens swap cannot be seen.

**Not shown:**
- Motion. The wisps were judged from stills only. The ascent crossed the blind in about one second; canon says a few seconds, which is a pacing choice for the flight director.
- Main drawing the same veil. Until the host owns one veil layer over both pictures, the swap is not continuous.
- Structures at height. The traced far field assumes everything stands within 262 m of the ground. That is the city's implementation, not the contract, but floating islands would need a biome whose function is evaluated in height as well; not attempted.
- Cloud that is seen from outside (a deck below you, a storm ahead). The blind here is felt only from inside.

**Meadow 1.1.0 and Industry 1.1.0: scoped, not started.** Meadow 1.0.0 already has its own Duck Blind (a blind-height control, a concealment setting and the guided journey that crosses it), so 1.1.0 is largely exposing what exists. Both packs hold their camera state privately (Industry exposes `SphereIndustry.inspect` only; Meadow exposes nothing), in about 200 KB of code across the two and the shared runtime.

## Lenses change places inside the cloud (13 November, last sprint of the session)

`stage-frame.js` now draws one host-owned cloud layer over the viewport (`cloud()`), with the same wisps and opacity law as a contract biome's own blind. In a flight, Main and a scene change places only while that layer is opaque; the soft-focus dissolve is no longer used in flight (Visit and Return still use it). A biome that declares a blind climbs into the middle of it and stops there (`ascend({ toAltitudeM: middle of blind })`), and arrives held in the middle of it (`?arrival=air&hold=1&fromM=blind`), so the host's cloud arrives over a picture that is already cloud.

**Run in Main (RTX 5080, pane hidden), once each:**

| Flight | Total | Pictures exchanged outside cloud | Card | Host cloud on screen |
| --- | --- | --- | --- | --- |
| Industry to City | about 41 s | 0 | 0 ms | 6.5 s over two crossings |
| City to Meadow | 49.9 s | 0 | 0 ms | 5.8 s over two crossings |

City to Meadow: the city reached 9,750 m with `veil` 1 at 16.3 s, the host cloud came over it at 16.6 s, the scene closed at 17.1 s, the cloud cleared by 19.5 s with Main rising. Industry to City: the city was placed at 9,750 m, held, `veil` 1, behind the cloud, then released. City save byte-identical in both; no errors.

**Weak, or not shown:**
- Nobody has watched it. All of the above is logs.
- Pacing. The city leaves its own blind within a fraction of a second of release, so by the time the host cloud clears it is already near 2 km. Canon wants a few seconds of cloud and then the fall away with the ground first discernible; that needs the flight director to pace the descent, not a script inside the biome.
- Main is still far from the biome's height at the exchange (Main 1,500 km, city under 10 km). The cloud hides it; a height readout would not.
- Meadow 1.0.0 and Industry 1.0.0: arriving at Meadow is cloud, then standing in grass. Hidden, but it is a teleport behind a curtain. Leaving Industry has no ascent, so the cloud arrives over a ground-level view. Both are what the 1.1.0 packs are for.
- Using cloud on every flight is a pattern a player can learn to read. Other occluders have not been tried.

## Pacing the Duck Blind crossing in the city (13 November, evening)

This supersedes the "Pacing" weakness in the section above, for the city. `city.js` scripts may now pace height and view separately (`script.shape`).
- **Arrival from its own blind** (`?arrival=air&fromM=blind`), 15 s: 1.5 s descending inside the blind, fully veiled; 1.5 s in which the concealment falls away, looking straight down; then the descent and the turn toward the approach.
- **Ascent into its own blind** (`ascend` to a height inside the blind with `handoff`), 16 s: the rise beneath the ordinary sky, then the last 3.2 s climbing as the cloud gathers.

**Verified.** Headless, stepped at 12 frames a second of scene time: fully veiled until 1.6 s, veil gone at 2.9 s at about 8.2 km with the street grid first showing, meshes from 9.3 s, settled at 60 m at 14.9 s, no errors. In Main (RTX 5080, pane hidden), Industry to City once: the city was placed behind the host cloud with `veil` 1; the host cloud cleared 1.5 s later while the city's own veil was still 1; the veil began to fall at 8.9 km and was gone at 8.2 km, 3.0 s after release; arrival at 60 m 15.4 s after release; card 0 ms; saved place kept.

**Not shown.** The paced ascent was not flown in Main after this change (City to Meadow or City to Industry). Nobody has watched either in motion on ALPHA. A 16 s clip of the descent, rendered headless on software GL from this code, was sent to Joe; it is a render of the city alone, not a capture of the app.

## First report from a human eye (13 November)

Joe watched the city in motion: "Glorious. Shimmer seen on pool faces, but glorious." This is the first observation of any of this work moving that did not come from logs or stills.

**The defect:** shimmer on pool faces. Cause not established. Two candidates, not yet told apart:
- Far pools, in the traced field: the trace has no antialiasing, and pool water is the strongest colour contrast in the city, so sub-pixel pools would sparkle as the eye moves. This is the weakness predicted in "The reveal without pop-in".
- Near pools, in the meshes: the water is a separate sheet 3 cm above the plinth top (added on 13 November so the water shows); two close surfaces can flicker against each other.

**To settle it:** whether the shimmer is on distant pools or nearby ones, and on foot or in flight. If distant, the fix is in the trace (fade water into the block average earlier, or soften edges by pixel footprint). If near, colour the plinth top as water inside the pool outline and remove the separate sheet.

**Joe's answer and the change (13 November):** the shimmer is on nearby pools and begins only below about 100 m above the ground; above that every visible pool is steady. He watched several times. That points at the meshes, where the water was a separate sheet 3 cm above the plinth top. `city.js` now builds a pool's top as one level surface with nothing stacked: a stone rim of four panels around a water panel at the same height. Headless, after the change: no errors; water still shows in the mesh render; mesh and trace differ by a mean of 0.29 to 0.45 out of 255 on two low views with pools (0.03 to 0.07 percent of pixels by more than 40), closer than before. Whether the shimmer is gone has NOT been seen: it only shows in motion on the real GPU, and the cause was inferred from where it appears, not proven. Joe's eye is the test.

Joe also said the buildings will be walked inside soon. Their doors are currently dark panels on solid boxes; interiors do not exist yet.

## Infinite Industry 1.3.0: the second contract biome (13 November, evening session)

**Version numbers, corrected.** Earlier notes speak of "Meadow 1.1.0" and "Industry 1.1.0". Those numbers are taken: `packs/infinite-industry/1.1.0` and `1.2.0`, and the same for Meadow, each hold one shared-world adapter manifest committed on 20 October. The contract versions are therefore **1.3.0**. (This was found by colliding with them: a copy landed inside the existing `1.1.0` folder. Nothing tracked was changed; the stray copy was moved to become `1.3.0`.)

**What 1.3.0 is.** A full copy of Industry 1.0.0 beside it, with its own manifest and save (`sphere-pack:infinite-industry:1.3.0`), and one file changed: `app.js`, where the private camera lives. Added there: `window.SphereBiome` (`sphere-biome/1`): `ready`, `arrived`, `pose()` (height above the works' ground), `ascend(options)`, held air arrival (`?arrival=air&hold=1&fromM=blind`) with `begin()`, `save()`, `dispose()`, `air()`, `inspect()` with `veil`. A script moves the eye with height and view paced separately, as in the city; the place last stood in is what is saved while a script runs and until the controls are taken. Its renderer is unchanged. 1.0.0, 1.1.0 and 1.2.0 are untouched.

**Kit.** `packs/kit/veil.js` (new, optional): draws a Duck Blind veil as an overlay for a pack whose own renderer does not draw one, with the same wisps and opacity law as the Observatory's cloud. Industry 1.3.0 uses it and pins it in its manifest. Industry declares a blind at 7,000 to 8,500 m (PROPOSED) and no haze layers, because its renderer does not draw declared haze.

**Other changes.** `packs/biome-library.json`: the Industry entry now points at 1.3.0, declares the contract, and drops the old glide. `scripts/build-industry-manifest.cjs` takes a version argument (default 1.0.0): `node scripts/build-industry-manifest.cjs 1.3.0`. `stage-frame.js`: the host no longer edits a contract biome's save on leaving by air. Both packs: `ascend` returns at once if the eye is already at the height asked for.

**Verified in Main (RTX 5080, pane displayed), once each:**
- 1.3.0 loads through Visit, passes its manifest check, 60 frames a second, no GL errors.
- Contract ascent on its own: 16 s to 7,750 m; the renderer steps through "middle fallback" and "far"; veil begins near 6.4 km and is full at 7 km; the save still holds the place on the ground (walk, 1.7 m).
- Industry to City: 0 exchanges of picture outside cloud, card 0 ms, both saved places kept.
- City to Industry: Industry placed in its blind (7,750 m, `veil` 1, held) behind the host cloud, released, veil gone at 6,300 m, settled at 65 m on its approach line 15 s after release; 0 exchanges outside cloud, card 0 ms, no GL errors, both saved places kept.

**Not verified, or weak:**
- Nobody has watched Industry's flights. What Sol's renderer shows between 100 m and 6 km (its "far" level) was not looked at, only that it draws without error.
- A lift-off from inside the covered treatment hall would pass through the roof; the script does not check for cover.
- The installed record still says version 1.0.0 in the panel (it was installed before); the scene opened is 1.3.0. A place saved in 1.0.0 is not carried over: 1.3.0 has its own save.
- Meadow 1.3.0 is not started.
