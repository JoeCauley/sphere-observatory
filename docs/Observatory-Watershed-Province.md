# Watershed province 1: the river gardens

12 September 2026 · local Next Leap development branch · published baseline remains v1.4.0

The user approved the Watershed network and asked that the Builders prioritize its art. The first representative province is now live: a 640 km catchment landscape with receiving basins, branching rivers and service gardens. Ivory crescents, copper colonnades, planted courts and a sheltered island tree establish its architectural language. Storage courts, fabrication shelters and heat-transfer elements use that language for different jobs.

Open the Observatory and choose **Explore → Watershed · the river gardens → Enter the province**. The default arrival is the water garden. Four arrivals share one saved world address:

| View | Camera |
|---|---|
| Whole watershed | 1,100 km above the shell, framing the complete province |
| River country | 48 km above the shell, looking along the receiving river |
| Water garden | 1 km above the landscape, showing its terraces and planting |
| Open terrace | 6 m above the terrace floor, looking into the garden |

**Return to previous view** restores the complete state from before entry, including whether the province was present. The atlas comparison now links directly to the live garden. Entering and capturing it use the existing Observatory renderer; the comparison page remains a separate cartographic study.

## Versioning and shared geography

The bounded addition has its own `provinceRevision: 1`, `provinceSeed` (default 713) and `provinceAnchor` (a normalized world direction). These fields are validated and saved in scene photographs and browser sessions. Shell layouts 1 and 2 retain their existing paths. Missing province fields import as revision 0, with no new geometry and no camera migration. This is an independent province revision on layout 2, not a wholesale replacement of the shell atlas.

`watershed-network.js` supplies the same deterministic priority-flood catchment graph to the comparison study and live province. Every inland graph cell drains to a boundary outlet and contributes to conserved catchment area. The live river ribbons soften the grid paths while retaining junction endpoints. Receiving-basin triangles are clipped at their shorelines. A tapered perimeter joins the original shell appearance.

The province sampler keeps **original biome**, **terrain height**, **water**, **service role**, **attack damage** and **missing shell** distinct. Wounds remain openings; damage does not rewrite the catchment or its original biome. Wreckage remains in the existing independent system. The saved anchor is a fixed world address; this pass does not retile the entire shell when its authored axis changes.

Land and water are curved, camera-relative triangles. Local structures and the terrain use the same geometry for rendering, ray inspection and flight contact. Site selection uses coordinates rather than facility names, because names can repeat. No new walking controller or game level is introduced.

## Readiness and limits

On entry, a worker builds the bounded province and its packed collision index before moving the camera. Vertex buffers are staged in approximately 4 ms batches. The cache retains at most two provinces. Scene capture awaits province preparation; worker timing never selects a partial landscape for a photograph. If the user changes the scene while an arrival prepares, that arrival is cancelled.

This is a static landscape and architectural prototype. Water has a reflective finish, but no hydrodynamic simulation or water-level animation. The regional terrain remains a finite catchment mesh; detailed planting is concentrated around the gardens. It does not demonstrate continuous game-level detail throughout 640 km, physically solved heat rejection, or a complete service transport network. Existing light transport and local shadow approximations still apply.

## Verification

`npm test` includes historical scene migration, invalid revision/seed/anchor rejection, session round trips, twelve coordinate probes across three radii, six catchment seeds, 340 packed/original collision comparisons, all four arrivals, the terrace's flight clearance, identical worker/capture vertex bytes, shared river-bank joins and independent damage sampling.

The browser check records all four rendered views, exact return-state restoration, GL errors, saved scene fields and live depth-buffer comparisons against CPU collision. Its depth comparison accounts for the GPU's reported subpixel raster precision, Float32 coordinates and a 10 cm surface-normal tolerance (below the existing 2 m flight clearance, with the corresponding depth tolerance at grazing angles), and preserves central-ray error measurements. Native screenshots and capture diagnostics are kept under `work/screenshots/watershed` and `work/screenshots/watershed-exports`; [portable numerical evidence](evidence/watershed/verification.json) is retained in the repository. The four views covered 26,939 depth probes with no mismatches beyond the stated raster and numerical tolerances. The measured province contains 308,565 triangles in seven meshes, with 38.84 MiB of vertex buffers and 26.20 MiB of packed collision data.

Actual 3840 x 2160 photographs and 3840 x 1920 six-face panoramas each matched byte-for-byte across two exports in this run, retaining province revision 1, seed 713 and the exact anchor in the downloaded scene. See [capture evidence](evidence/watershed/captures.json). Both saved images were visually reviewed.

The [direct-entry and expedition check](evidence/watershed/entry.json) passed: the link reaches the intended garden, the original forest sample remains outside the province with 250 m arrival clearance, and returning preserves the camera and settings (orientation normalization differed by less than 1e-12). The atlas study also passed its 20 location/layer, settings-download and mobile-layout checks after sharing the catchment module.

The existing intermittent cold 4K repeatability issue remains open. A passing province capture run does not establish that its previously observed cause has been resolved.
