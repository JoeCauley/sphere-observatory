# Meadow prototype P1

This is the authorized isolated prototype of the alternative in [the architecture assessment](../../docs/Observatory-Meadow-and-Biome-Architecture-Assessment-2026-10-05.md). Production source, fixtures, acceptance and historical evidence stay unchanged.

P1 render revision 2 replaces the 864-triangle coarse F2 clump with a two-triangle view-dependent atlas quad. The atlas is baked from the existing geometry, with unlit colour/coverage and normal/depth/height textures. Actual geographic packed roots, the existing service, near geometry, Sphere light/depth and geographic wind inputs remain in use. This is new experimental appearance; it inherits no F2 visual or native-bit acceptance.

The separate tile planner is a shadow implementation of numeric coverage winners and the 4 m support guard. It never replaces production commits, references, worker validation or fences. The offline page compiler checks two actual adjacent 8 m parents and compact storage partitions; its cube-edge test covers address coordinates only.

## Review

From the repository directory in PowerShell:

```powershell
node analysis/meadow-prototype-p1/serve.cjs
```

Open the printed localhost `/demo` URL. Use **Explore → Watershed → Open meadow → Meadow study → Visit**. The overlay switches between the current and P1 canopy. This uses its own origin and owned snapshot, and does not use or reconfigure the production server on port 8766. Close the terminal with Ctrl+C to stop only this server.

The snapshot is recorded in [last-run.json](last-run.json), currently under `I:\Sphere\work\meadow-prototype-p1-2026-10-05T14-00-37-736Z\runtime`. The source directory and evidence are durable repository additions; the large runtime copy is owned local work.

## Experiments

Each browser run creates a new evidence directory and freezes the experiment sources before execution:

```powershell
# Seven-view alternating GPU comparison plus existing cadence/native diagnostics
node analysis/meadow-prototype-p1/run.cjs

# GPU and 1,800 retained-pose shadow planning, without large native observers
$env:MEADOW_P1_SKIP_D0 = '1'
$env:MEADOW_P1_PLANNER = '1'
node analysis/meadow-prototype-p1/run.cjs

# Fresh original native comparison without cadence warm-up
$env:MEADOW_P1_SKIP_D0 = $null
$env:MEADOW_P1_PLANNER = $null
$env:MEADOW_P1_NATIVE_ONLY = '1'
$env:MEADOW_P1_NO_CADENCE = '1'
node analysis/meadow-prototype-p1/run.cjs
```

Experiment switches apply to that shell only. Clear prior switches before choosing another mode. `MEADOW_P1_ONLY=probe` traces GL calls and coverage; `MEADOW_P1_ONLY=exports` uses the real photograph/panorama export API. `test-planner.cjs` runs controlled lifetime/coverage-oracle checks. `page-products-p1.cjs` produces the two bounded page products. `prepare.cjs` creates a completely fresh owned snapshot and baseline; do not run it merely to review the existing result. `bake.cjs` is for a fresh snapshot with no existing prototype directory.

Review the [results report](../../docs/Observatory-Meadow-Prototype-P1-2026-10-05.md) before interpreting numbers. Earlier P1 revision 1 comparisons contain a diagnosed VAO initialization error and are invalid comparison evidence. P1 revision 2 has error-free GPU/coverage diagnostics, but full preparation, CPU ownership, cadence, all-angle appearance, export completeness and global continuity remain separate requirements. No candidate is promoted.
