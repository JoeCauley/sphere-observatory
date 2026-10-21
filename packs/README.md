# Observatory scene packs

Infinite Meadow 1.0.0 is the first full-scene pack derived from the accepted endless Meadow. Open it in Explore → Biome Packs, or visit `infinite-meadow/1.0.0/index.html` through the localhost Observatory server.

Infinite Industry 1.0.0 is the II-001 water-processing facility in the same library. Its hall, ramp, gallery, boundary corridors and recovery valve use the shared host and existing Meadow renderer. Open Explore → Biome Packs → Infinite Industry → Visit. Read [II-001 implementation and verification](../docs/Observatory-Infinite-Industry-II001.md) for the gate status and evidence.

`runtime/v1` owns pack validation, asset integrity, stable addresses, storage, the eye-following stage and resource lifecycle. Each versioned pack supplies `manifest.json`, required assets and an adapter exporting `mountPack(host)`. The adapter returns `snapshot()` and `dispose()`. Required source assets are checked before scene creation. A pack version is a pinned delivery; later changes need a new version and fresh evidence.

No runtime AI, remote assets or telemetry is required. Source and portable saves remain local. The first delivery uses a document transition, so the legacy Observatory and Meadow renderer are never intentionally co-resident in one document. Seamless biome joining is later work.

Read [Meadow Pack 01](../docs/Observatory-Meadow-Pack-01.md) for the contract, preserved floor, limits and the Infinite Industry extension path. `npm run test:pack` runs the reproducible contract checks.

`npm run test:industry` runs deterministic/interface/walking checks. `npm run test:industry:browser` uses actual Chrome, public controls, rendered video and 900-frame timing. Set `SPHERE_INDUSTRY_BROWSER_OUTPUT` to a fresh folder. `scripts/build-industry-manifest.cjs` updates Industry's source inventory after authorized changes; accepted Meadow files remain immutable.
