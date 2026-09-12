# Observatory 1.3 — materials and local structure shadows

September 11, 2026

This pass improves the Shade fracture inspection and exposed Wound wall. The existing geometry, camera attachment, moving detail region and weather remain the foundation. Light response and local shadows now make the deck, braces and structural strata read as separate surfaces.

## What changed

- Shade skin and Wound structures use roughness, metalness and normal detail. Four original, procedurally authored periodic material maps describe ceramic, service metal, fractured composite and weathered exposed metal. They contain surface properties, not baked illumination. Normals are derived from periodic height fields with irregular pits and directional scoring. Their fine detail repeats at a physical 64 m pitch and is filtered with mipmaps and anisotropic sampling.
- Direct illumination uses a GGX distribution, Schlick Fresnel and a roughness-dependent visibility approximation. Metallic regions use an authored reflection colour derived from the existing dark artwork; material properties are illustrative rather than measured engineering samples.
- Analytic Shade skin and the nearby deck share the same finish, texture coordinates and light response. The material basis handles mirrored frames and either face. Fine colour noise that restarted at mesh boundaries is removed from these structures.
- Two directional shadow regions follow the camera. Braces, plates and torn members cast shadows on nearby geometry and the analytic surface. The same directional system replaces the fixed overhead shadow projection at field sites.
- The near region resolves small details; the outer region covers a larger area. Sampling blends between them and fades at the outer boundary. Map centres snap to their texel grid, and CPU double-precision transforms supply small light-relative offsets to the GPU.
- Filtering estimates penumbra width from local blocker depth and the star's apparent angular radius. This is an inexpensive local approximation, not full finite-source ray tracing of the mesh.
- **Light → Surface materials & shadows** and **Flight console** expose Detailed/Simple materials and Off/Balanced/Fine structure shadows. Those choices are saved in scene files and photographs.

## Resource and performance bounds

The four 256 × 256 RGBA material layers, including mipmaps, occupy about 1.33 MiB. Balanced uses two 1024² depth regions (about 8 MiB at four bytes per depth texel); Fine and photographs use two 2048² regions (about 32 MiB). These figures describe the new resources, not total application memory.

The nearest useful shadow region varies with distance to geometry. At the default Shade inspection, its width is 1 km: about 0.98 m per texel in Balanced or 0.49 m in Fine. At the default Wound inspection, it is 16 km wide: about 15.6 m or 7.8 m per texel. Fine detail on a distant Wound remains limited by that footprint. Geometry beyond 300 km does not initiate this local shadow pass.

Only overlapping geometry is submitted to each map. Unchanged maps are reused. Moving Shades and camera travel update the transforms; these updates do not suspend the simulation. GPU timings from the attached Shade and Wound tests are recorded in `work/screenshots/materials/verification.json`.

On the test RTX 5080 through Edge/ANGLE D3D11, the sampled 1280 × 720 previews (internally 1920 × 1080, including the existing atmosphere pass) had medians of approximately 3.7–5.1 ms across the Shade and Wound views with shadows enabled. Individual samples had higher spikes. A clean headless-browser start took about 33 seconds to initialize; these warm frame timings exclude initialization. The tests are representative views on one machine, not a universal frame-rate guarantee or a reliable subtraction of the isolated cost of shadows. CPU work and presentation also contribute to the total frame time.

## Verification

- `npm test` includes shadow-coordinate checks across three shell radii and three orientations, bounded caster selection, settings validation, and scene round trips, alongside the existing geometry, flight, area, route and walking tests.
- An independent GPU fixture uses a raised rectangular blocker above a plane. Away from the soft edge, all 1,391 shadowed and 28,477 lit receiver samples agree with the expected geometry; there are no incorrect classifications.
- Five material comparisons use identical camera and exposure settings. Shadowing never increases the direct-lit result, and repeated captures agree exactly. A directly backlit test remains finite even when view and light directions oppose one another. The comparisons disable atmosphere to isolate the surfaces.
- Close-boundary regression checks retain zero disagreements for 432,000 Wound rays and 73,728 Shade rays. All 19 destinations, walking, moving Shade attachment, scrubbing, collision, fullscreen controls, panoramas and weather checks pass.
- The finite-star regression retains the four pre-existing one-sample differences within its tolerance. Linear-light resolve and the display-colour fallback pass.
- `tools/capture-materials.cjs` captures four native 3840 × 2160 reference views (internally 7680 × 4320) and exercises the material controls in actual fullscreen. The final captures have zero WebGL errors. Capture-plus-PNG-encoding times are recorded separately and are not gameplay frame rates. `tests/materials-browser.cjs` creates the comparison captures and GPU timing report. `tools/review-materials.cjs` creates the local comparison slider; `tests/materials-ui-browser.cjs` checks the relief/texture switches, fullscreen controls and all five comparison images.

## Remaining approximations

ShellShine still estimates coarse first-bounce illumination. It supplies a broad reflection proxy for these materials; local reflection captures, spatial irradiance probes and converged multiple-bounce light transport are absent. Shadows cover the generated local geometry, with existing analytic eclipse visibility handling the large bodies. Small gaps and soft edges remain limited by shadow resolution, bias and the local blocker search.

The new finishes do not add bent plates, cables or new fracture topology. Geometry generation is still synchronous, so large jumps can briefly pause while uncached chunks are built. Temporal antialiasing, background geometry generation and expanded weather modelling remain future work. Additional graveyard ships remain deferred.
