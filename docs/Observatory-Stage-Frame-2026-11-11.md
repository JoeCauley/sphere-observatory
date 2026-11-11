# Stage frame: visiting real packs from Main

11 November 2026. Written by Claude at Joe's direction. Status: **implemented and verified in a browser on Joe's machine** (scope below). This is outside the formal P05 programme and closes none of its gates.

## What it does

Joe's finish line (2 November) is: install Meadow and Industry in Main, visit the places the Sphere assigned them, close the browser, reopen, return to the saved place.

The biome service already decides where a pack lives and remembers it. The stage frame supplies the visit. Beside each installed place Main shows a Visit button. It flies Main to the assigned region with the existing travel transaction, then opens the accepted pack scene in a same-origin frame over Main's viewport. Return to the Sphere saves the scene's place, releases its GPU resources and removes the frame. Main is never reloaded. If the page closes while a scene is open, Main reopens it on the next start and the scene restores its own saved pose.

| Installed placement | Scene opened |
| --- | --- |
| Track Meadow 1.0.0 (inside a shade track) | Infinite Meadow 1.0.0 |
| Open Industry 1.0.0 (outside the tracks) | Infinite Industry 1.0.0 |

## What changed

- `stage-frame.js`: new, self-contained, not pinned. Also pauses the world clock before an Install click reaches the service (see below).
- `index.html`: one script tag after `bootstrap.js`.
- `packs/shared-world/1.1.0/registry.json`: removed `../../catalogue.v1.json` from the integrity inventory. The service grows that catalogue whenever a release is registered, which made the shared world refuse to open ("World file changed"). The scene never read the catalogue.
- `biome-service/metadata-budget.v2.js`: new. Owner decision (Joe): the 32 MiB logical admission gate is lifted. Ceilings are now 1 GiB and 65,536 reservations, there only to catch a runaway. Accounting and `inspect()` are unchanged. v1 is byte-identical because released provider envelopes pin it.
- `biome-service/main-install-bootstrap.v12.js`: new; v11 with the budget module switched to v2.
- `bootstrap.js`: loads bootstrap v12.
- `scripts/build-main-install-profiles-v10.cjs`: lists the two new files; re-run with `--both`.
- `biome-service/main-install-profiles.v10*.json`: regenerated. Provider digests are unchanged; 405 pinned rows match the files on disk; service entries 149 -> 150.

## Verified (built-in browser pane, fresh storage, 127.0.0.1:8881, RTX 5080)

- Install Track Meadow, then Open Industry: 2 installations, 2 regions, 123 cells. Both recover from storage across reloads.
- Visit Infinite Meadow: Main travels to the Track Meadow region, the Meadow opens about 430 ms after the click, 60 draws/s.
- Visit Infinite Industry opens the water works.
- Return: pack host goes ready -> disposed, release receipt written with 0 live GPU resources, frame removed, no reload.
- Reload while in the Meadow after walking 11.2 m: Main reopens the Meadow unprompted; saved position identical before and after (east -0.3743705170034806 m, north -11.240247288489648 m).
- The shared world opens again.

Not verified: a literal browser quit and relaunch (a page reload was used; the storage is the same), Chrome, the valve and gallery in Industry, and a fresh dedicated profile.

## Service faults found on the way

- **Install fails while the clock is playing**: `INVALID_CORE_SCENE`, field `playing`, and the panel stays failed until reload. Worked around in `stage-frame.js`; the fault itself is still in the service.
- **The 32 MiB gate refused an ordinary second install**: logical peak 35,363,556 B against 33,554,432 B, in a world where Track Meadow drew 67 cells.
- `tests/main-install-two-families-v10.cjs` fails under Node 22 on Linux with a 1 MiB storage-row limit (row 1,122,158 B). It fails identically on the untouched snapshot commit `5fb5255`, so it predates these changes. Not checked under Sol's Node 24 on Windows.

## What this is not

- **A portal, not a surface.** The scene is not shaped by the assigned cells, lit by that region's sun and shade geometry, or bounded by its neighbours. The address and overview are real; the ground is the pack's own tangent plane.
- **Not a release registration.** The real packs ride on the two fixture placements, so the Install buttons still carry the fixture names. Registering them as their own service releases needs a schema-valid manifest, a catalogue pin and a provider admitted through the pinned extension profiles.
- **Not P05.** The native renderer and ownership ledgers are untouched and unused by this path. Its other limits (GPU capacity, per-frame hosts, the 1 MiB storage row) are unchanged.

## Open

- Meadow and Industry are separate places here. The shared world still puts Industry 384 m east of Meadow. Joe has not yet chosen which is canon.
- Main's cold start takes roughly a minute.
