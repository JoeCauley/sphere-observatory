# Four-biome demo · Observatory 1.7.0

The current build adds on-screen Visit progress, straight Outfall passages and measured great-circle walks. [Surface walking release](Surface-maturity.md)

## Persistence and travel

The install register belongs to the server. Plot allocations are keyed by the world seed, radius, axis latitude and longitude, waist width, layout version and shade-geometry revision. Each profile owns its active-scene marker, viewpoint, bookmark and local machinery state. A write finishes against the world that started it. Concurrent changes to one world's installation list are reconciled before another write can replace it.

A fresh seed-23 run installed Meadow, Industry and City, repeated an install, flew Meadow → Industry, moved the camera, then quit Chrome and the server. Both processes reopened at the same origin. The installed records and serialized manual pose matched exactly. Another profile shared the three plots and began without a saved camera. A delayed seed-24 installation finished after the traveler had switched back to seed 23. Its two records stayed in seed 24.

During one prepared Meadow → Industry flight, 2,477 frame samples included 746 with Main visible. Both picture exchanges occurred at full veil opacity. The probe observed zero visible loading-card frames and zero visible Main-camera samples reaching the outermost shade shell. Cold startup includes preparation. The arrival suite also exercised 20 healthy, interrupted, failed and retried host cases. Each of the four packs passed its 28 contract checks.

The local browser run used a real Chrome process, a separately restarted server process and a disk-backed temporary store. ALPHA’s restricted browser transport delivered requests to that handler over IPC. The supplied commands and GitHub workflow use a loopback TCP listener by default. [Reproducible tests and measured values](../examples/biomes/field-checks.json)

## What to investigate

**The Outfall.** The seed-23 installation addresses the edge between `r12c35` and `r13c34`. A visitor can walk from outside to the valve. The bypass has three successive reservoirs. The first responds to the handwheel, the second to the first, and the third to the second. The test follows the water in both directions, leaves via the public scene bar, returns through the service opening, and restarts both processes. It compares the actual manual position and valve setting each time.

**Industry.** The home district's hot bar pod at `(-1, 1)` has a 39.15 m transfer between its process and forming hexes. Three bars follow the saved machinery clock. The belts and hoods use the plant generator's solids. The moving bars use a single small mesh. The walker crossed the shared edge, paused the machine, reloaded and found the same bar and camera position. A separate test crossed the 54° grid in district `(1, 1)` on foot. Starting under its 20 m roof, the camera left the footprint before rising. The Industry upgrade preserves distinct current viewpoints and bookmarks from 1.3.0 and 1.4.0.

**Meadow.** Four matched views and a low pan show how the local grass changes with clearance. Read the two-metre and ten-metre views together, then watch the same foreground turning in the pan. [Meadow field study](../examples/biomes/README.md)

## Industry rendering measurements

A fixed 9 km disc around the water works contains **1,383** generated pod cores. Industry 1.4.0 returned 667. The new bounded search agrees with an independent wider enumeration at the origin, on a district edge and at negative coordinates. Faraway pod floors are grouped by district. The 9 km drawing limit still produces a visible horizon at sufficient altitude.

Both builds ran in focused Chrome 157 on an RTX 5080 at 1280 × 720. Each row represents at least 30 seconds of uninterrupted sampling after warm-up. The last row uses the same local camera at the transfer site in each version. The 1.4.0 world predates the working transfer.

| Eye height or viewpoint | Median frame interval, 1.4.0 → 1.4.1 | Median draw calls, 1.4.0 → 1.4.1 | Peak resident buffers, 1.4.1 |
| --- | --- | --- | --- |
| 1.7 m | 17.7 → 17.7 ms | 150 → 150 | 42.7 MiB |
| 400 m | 17.7 → 17.6 ms | 191 → 191 | 36.4 MiB |
| 2,600 m | 17.6 → 17.6 ms | 716 → 261 | 41.9 MiB |
| 3,100 m | 17.6 → 17.6 ms | 716 → 263 | 43.5 MiB |
| Beside the bar transfer | 17.9 → 17.6 ms | 137 → 140 | 33.5 MiB |

The p95 frame interval was 18.1 ms at every station in both versions. Every sampled interval exceeded the 16.7 ms reference for 60 Hz. Neither version recorded a hitch over 50 ms or a post-warm-up buffer upload in these stationary runs. Expanded coverage reduced high-altitude draw calls while keeping the measured cadence. The peak of 43.5 MiB stayed within the renderer's 192 MiB buffer budget. Timing on other browsers, moving viewpoints and GPUs can differ.

## Reproduce

From the repository root, install the development dependencies with `npm ci` and Chromium with `npx playwright install chromium`. Browser tests use isolated temporary state. `SPHERE_NATIVE_BROWSER` may point to another installed Chrome executable.

| Command | Observation |
| --- | --- |
| `npm run test:http-restart` | Real server, concurrent writes, conflict recovery and disk state after a process restart |
| `npm run test:restart` | Public install and travel controls, profile and server restart, worlds and profile isolation |
| `npm run test:outfall` | Edge address, walk-in, valve response, return trip and cold reopen |
| `npm run test:contract` | All four pack contracts |
| `npm run test:stage-arrival` | Host arrival, failures, retry, takeover and restored scene |
| `npm run test:pods` | Hex coverage, six walking lanes, roof distinction and independent search |
| `npm run test:industry:roof` | Generated hall exit, rotated seam and save migration |
| `npm run test:industry:transfer` | Moving product, walk across the seam and repeatable saved state |
| `node tools/measure-industry.cjs 1.4.1 industry-samples.json` | Five fixed-camera, visible-browser samples with frame and buffer counters |
| `npm run test:gallery` | Current gallery, media hashes, archived galleries and documentation links |

[Back to the Observatory](../README.md)
