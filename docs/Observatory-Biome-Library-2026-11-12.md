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
