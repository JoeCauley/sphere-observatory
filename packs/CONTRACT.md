# The Sphere biome contract

Pack authors can attach a placed biome to a surveyed station using the [Biome Pack to Border Biome Contract](../docs/Builder-border-crossings.md#biome-pack-to-border-biome-contract).

The host opens each catalogued scene as a same-origin iframe. The pack advertises `sphere-biome/1` in its catalogue entry and exposes `window.SphereBiome` inside its own document. A pack can use its own renderer, coordinate convention and local save format. [Catalogue](biome-library.json)

| Member | Host expectation |
| --- | --- |
| `id`, `version`, `contract` | Match the offered catalogue entry. |
| `ready` | Resolve after the scene has drawn at least one complete frame. |
| `pose()` | Return finite `eastM`, `northM`, `altitudeM`, `yaw`, `pitch` and a `mode` of `walk` or `flight`. The public altitude is relative to the pack's datum. |
| `air()` | Return `haze` layers and a `blind` of `{baseM,topM,edgeM}`, or a null blind. |
| `inspect()` | Report `frames`, `veil` from 0 to 1, and the Boolean flags `scripted` and `held`. |
| `ascend({toAltitudeM,handoff})` | Lift from the current scene. Resolve `revealed` at the requested handoff altitude, or `taken-over` when the traveler takes control or the pack cannot find a safe exit. |
| `begin()`, `arrived` | Release a held approach and report its outcome. `arrived` settles on arrival, direct ground entry, or traveler takeover. |
| `save()`, `dispose()` | Keep the last manual viewpoint and the separate bookmark, including during a scripted flight. Dispose releases clocks, listeners and renderer resources. |

## Entering and leaving

Main can open `?arrival=air&hold=1&fromM=blind`. The destination first draws inside its own Duck Blind and waits. Main can then exchange the pictures under full cloud cover. It releases the destination with `begin()` and records the active scene when the approach settles. A failed load or arrival offers **Retry** and **Stay in the Sphere**. A held arrival ignores movement input. A traveler can take back an interruptible departure.

Standalone pages use the catalogue save key in local storage. In Main, read the iframe's `data-world-key` and obtain storage with `parent.SphereBiomeLibrary.saveStorage(key)`. A key belongs to the scene opened in that world, even if the parent changes worlds while a save is finishing. The install register stores plot or Border addresses on disk. Camera and machinery state belong to the traveler’s browser profile.

## Adding a destination

Give the pack a versioned entry page, a unique ID and save key, a placement rule and an overview material in the catalogue. Plot placement supports `within`, `outside` and `anywhere`. Border Biome owns an addressed freight district and the Outfall maintenance facility. Each facility keeps its own scene entry, save key and Atlas address under the parent installation. The Outfall retains both plots of its surveyed northern edge.

The offered Meadow and Industry also verify versioned asset manifests. Regenerate the relevant manifest after changing a published pack candidate. Run `npm run test:contract` to exercise each offered scene and `npm run test:stage-arrival` to exercise normal and failed handoffs in Main.
