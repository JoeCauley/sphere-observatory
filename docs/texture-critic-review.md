# Independent biome transition review

Requested 2026-09-09. The visual critic does not change the renderer or texture assets. Scores are based on captured renderings, not implementation promises. Up to three implementation attempts are allowed; the pre-change baseline does not count as an attempt.

## Scoring

The score for a biome is its worst supported result for visible repetition and the hero-to-distance transition at the tested views. Lower is better.

| Score | Visible result |
| --- | --- |
| 1 | No identifiable periodicity, mirror seam, or transition band in ordinary inspection; the surface reads as one continuous environment. |
| 2 | A weak recurring motif or blend can be found with deliberate scrutiny, but it does not announce itself during ordinary viewing. |
| 3 | Repeated motifs are immediately discernible, or the transition produces a conspicuous wash, ghosting, or change of terrain identity. |
| 4 | An obvious lattice, mirrored structures, or a distinct transition band interrupts the environment. |
| 5 | Small repeated tiles dominate the close surface appearance. |

A biome passes only at 1 or 2. Attractive colour, detail, or bump response cannot compensate for an obvious repeating pattern. Architectural regularity in Machine Expanse is plausible; repeated identical damage, conduits, or lighting motifs are still repetition artifacts. Similar considerations apply to intentionally geometric Violet Labyrinth.

## Evidence protocol

For each of the ten biomes, use matched heading, world state, exposure, and output resolution, with default atmosphere. Capture a 1 km oblique view, a 1 km wide/nadir view, a view at the hero fade midpoint, and a view just outside the hero fade. Include a lateral move of at least one hero tile width. Capture the weakest cases without atmosphere as a diagnostic; the ordinary atmosphere-on view determines the user-facing score.

Review the foreground for repeated landmarks, bilateral mirroring, rectangular or diagonal lattice, and implausible scale. Review the middle distance for broad blend bands, double-exposed landmarks, and abrupt changes of contrast or colour. Review successive frames around the fade and cell boundaries for popping and swimming. Still images establish spatial appearance only; temporal continuity requires motion or matched consecutive frames.

## Architecture before optimization

The existing three tiers cover 256 km, 16 km, and 1 km. Each is a 512-square runtime layer. Mirrored repetition gives the local map a 2 km period with alternating reflection. The near layer fades over 6–18 km of visible-ground distance. The tiers are independently authored images, so simple crossfading can change terrain identity instead of revealing a matching zoom. These are potential failure modes, not scored findings until screenshots are inspected.

## Results

### Baseline (not an attempt)

Inspected all ten `tests/artifacts/hero/baseline/{biome-id}-sheet.png` contact sheets, each containing six 1280 × 720 renders reduced into a 1920 × 1680 sheet. Row-major panels: 1 km oblique at 35 degrees downward / 70-degree FOV; 1 km nadir / 95-degree FOV; 10 km oblique; 20 km oblique; 1 km oblique after 8 km lateral travel; 1 km oblique without atmosphere. Lighting, pose and exposure are matched across fixed biome overrides. These captures establish spatial appearance, not temporal continuity.

| Biome | Baseline | Principal visible artifact |
| --- | ---: | --- |
| Dark Age Forest | 5 | Mirrored clearings and paths form repeated diamond cells with a central symmetry axis. |
| Super Jungle | 5 | Bright crowns and black waterways form a small repeating carpet; symmetrical palm pairs are conspicuous. |
| Ultra Desert | 5 | Dune ridges meet in repeated diamond rosettes; salt pans and dark rock patches repeat at short intervals. |
| Winter Hell | 5 | Crevasses form identical mirrored ice cells; symmetry remains prominent at district distances. |
| The Ruin | 5 | Identical broken plazas and damage become repeated kaleidoscopic motifs. |
| Machine Expanse | 4 | Plausible rectilinear construction partly disguises repetition, but identical conduit loops and tank groups repeat obviously. |
| Rustwater Marsh | 5 | Repeated paired black pools and reflected channels look ornamental rather than geographic. |
| Chalk Archipelago | 5 | Mirrored shorelines form repeated islands, with additional thin straight bright seam lines. |
| Mycelium Sea | 5 | Identical fungal crown clusters and reflected strand webs form a repeating carpet. |
| Violet Labyrinth | 5 | Identical large crystal crowns and mineral rings form repeated medallions. |

The atmosphere does not hide these patterns. Obvious symmetry survives the 10 and 20 km views, so a hero-only fix would expose the same problem in the district layer. The recommended first change is to remove mirrored periodicity from every visible tier and greatly enlarge the unique local image coverage. Avoid repairing this with blur: the detail itself is appealing.

### Attempt 1

Inspected the corresponding ten six-panel sheets in `tests/artifacts/hero/attempt1/`. The reported implementation uses dedicated native 1254-square hero images, an 8 km stochastic lattice, non-mirrored stochastic sampling in all tiers, a hero fade over 8–32 km of ray distance, and approximate albedo-derived bump shading.

| Biome | Attempt 1 | Finding |
| --- | ---: | --- |
| Dark Age Forest | 2 | Mirror carpet is gone. Middle-distance canopy stays broadly coherent; source magnification is visibly soft. |
| Super Jungle | 3 | No obvious tile lattice, but oversized foreground leaves become a different, much finer canopy through the blend. |
| Ultra Desert | 2 | Larger irregular dune/rock areas blend plausibly; the foreground remains too soft for a high-detail hero result. |
| Winter Hell | 3 | Blue-black foreground ice changes to much paler fractured district ice, exposing the material change across distance. |
| The Ruin | 3 | Close rubble/plans dissolve into a substantially different density and arrangement of broken districts. |
| Machine Expanse | 3 | Dense, rotated hero blocks crossfade into larger orthogonal conduit loops; both layouts are visible in the transition. |
| Rustwater Marsh | 3 | Hero channels and the coarse island/channel pattern overlap like a double exposure in the transition. |
| Chalk Archipelago | 3 | Close and district coastlines disagree visibly through the fade. Bright straight seam lines are gone. |
| Mycelium Sea | 3 | Hero strands and mushroom groupings dissolve into a differently scaled network; the overlap is apparent. |
| Violet Labyrinth | 3 | Close irregular plates change into conspicuous district bullseye motifs, announcing the tier change. |

**Decision: does not pass all ten biomes.** The small mirror repeat problem is substantially solved. The next change should address coherent identity through the fade and sharpness at the lowest altitude. With a 0.38 source-coordinate multiplier, an 8 km lattice stretches the complete source over roughly 21 km, approximately 17 metres per source texel. All nadir views show enlarged soft pixels. This softness is a separate image-quality problem and was not used to increase repetition scores on the two otherwise passing biomes.

Keep world-stable aperiodic coverage, but restore plausible feature scale and source texel density. Use the same hero mapping and its mip chain through the local/medium-distance view when practical; delay the independently authored atlas blend until hero landmarks are less distinguishable. Do not merely broaden the crossfade between incompatible coastlines or machine plans. Approximate relief is restrained in these captures; no severe water embossing or edge ringing is apparent, but the soft foreground limits assessment of fine bump quality.

### Attempt 2

Inspected all ten corresponding sheets in `tests/artifacts/hero/attempt2/`. The hero lattice is now 2.5 km, colour-neutral fine detail is retained, and the same hero coordinates/image persist through the nearby views. The independent remote atlas blend is reported at 600–1800 km. Consequently, the sheets' inherited `10km-transition` and `20km-district` captions now describe receding hero landmarks rather than the former LOD switch.

| Biome | Attempt 2 | Finding |
| --- | ---: | --- |
| Dark Age Forest | 2 | Coherent, adequately detailed canopy; no conspicuous repeated near landmark or local material swap. |
| Super Jungle | 2 | Better feature scale and sharpness; the canopy recedes continuously. Bright crowns remain stylistically uniform. |
| Ultra Desert | 3 | Good close surface, but similarly sized rock/dune patches recur at a visible cadence at 10–20 km. |
| Winter Hell | 4 | Good close surface; rows of similarly sized blue-dark ice cells form an obvious lattice at 10–20 km. |
| The Ruin | 2 | The dense broken districts maintain their identity through distance; no conspicuous repeated close medallion. |
| Machine Expanse | 2 | Manufactured organization stays coherent through distance. Fine overlay is somewhat busy, but the old changing-plan crossfade is gone. |
| Rustwater Marsh | 2 | Channels now retain a coherent material family through distance; no overt local fade boundary. |
| Chalk Archipelago | 3 | Close coastlines are coherent, but many similarly sized islands recur in rows farther out. |
| Mycelium Sea | 3 | Close strands are attractive; similarly sized web-ring colonies recur conspicuously in the middle distance. |
| Violet Labyrinth | 3 | Rounded dark maze loops recur in a conspicuously uniform distribution at 10–20 km. |

**Decision: five of ten pass the complete spatial test; all ten close 1 km views are approximately score 2.** Sharpness and local continuity are substantially improved. Persisting the smaller hero lattice makes the remaining regular patch cadence visible from higher viewpoints. The final attempt should decorrelate placement, scale and source crops, retaining a continuous world-stable mapping. Four rotations and a small source offset do not sufficiently disguise repeated source-center silhouettes. Broad coordinate variation can break rows, but must not create swimming or severe distortion. Relief remains restrained and material-compatible in these still images.

### Attempt 3 (final allowed optimization)

Inspected all ten corresponding six-panel sheets in `tests/artifacts/hero/attempt3/`, then the full 1280 × 720 oblique originals for Ultra Desert, Chalk Archipelago and Mycelium Sea. The five previously failing biomes now use smoothly varied world coordinates, jittered compact-support patches and more varied source crops/scales. The five previously passing biomes retain their mapping.

| Biome | Baseline | Attempt 1 | Attempt 2 | Attempt 3 | Final finding |
| --- | ---: | ---: | ---: | ---: | --- |
| Dark Age Forest | 5 | 2 | 2 | 2 | Coherent canopy; minor recurring source character only on scrutiny. |
| Super Jungle | 5 | 3 | 2 | 2 | Large lush crowns recede coherently, without the old mirror carpet or local material switch. |
| Ultra Desert | 5 | 2 | 3 | 2 | Irregular patch distribution removes the middle-distance cadence; detail is slightly mottled but plausible. |
| Winter Hell | 5 | 3 | 4 | 2 | The conspicuous dark-cell rows are gone; ice fields read as an irregular continuous surface. |
| The Ruin | 5 | 3 | 2 | 2 | Broken districts retain coherent density and appearance with distance. |
| Machine Expanse | 4 | 3 | 2 | 2 | Regular construction is plausible; occasional source similarities and busy fine overlay remain. |
| Rustwater Marsh | 5 | 3 | 2 | 2 | Dark waterways and rust vegetation retain coherent character without a visible local LOD switch. |
| Chalk Archipelago | 5 | 3 | 3 | 3 | Repetition is now inconspicuous, but blended patches visibly superimpose land/coast detail across the central water channel. |
| Mycelium Sea | 5 | 3 | 3 | 3 | Repeated ring cadence is reduced, but crowns and strands overlap as visibly translucent/doubled imagery in the close view. |
| Violet Labyrinth | 5 | 3 | 3 | 2 | Loop size and distribution are varied enough to read as an alien mineral landscape. |

**Final spatial decision: eight of ten biomes meet the strict combined target of 1 or 2.** All ten reach approximately 2 for repetition alone. Chalk Archipelago and Mycelium Sea remain 3 for overall natural blending because patch overlap has replaced periodicity with visible ghosting. This limitation is apparent in full-resolution original captures and is not caused by contact-sheet downsampling. The third attempt improves the overall result but does not justify claiming a clean pass on every biome.

The strongest visual gains are removal of mirror symmetry, coherent detail through the former local LOD transition, and breakup of the mid-distance lattice. The remaining tradeoff is softened or superimposed features where multiple source patches blend. Approximate bump is restrained in the ordinary screenshots; it does not produce prominent embossed outlines, but it does not turn the surface into geometric terrain.

### Supplemental final evidence

Inspected all ten `-motion.png` sheets, all ten `-grazing.png` images, and all ten `-remote.png` sheets beside the attempt 3 results. Across baseline and the three attempts, this review covers 370 rendered panels/images, with additional full-resolution inspection of the weakest close views.

The motion sheets contain six consecutive lateral positions from 2.30 through 2.70 km in 80-metre increments. Recognizable landmarks shift coherently in every biome, including through the neighborhood of the 2.5 km patch spacing. No obvious patch reset or sudden replacement appears between these sampled positions. This is evidence for local world anchoring; it is not a continuous video or proof of every possible flight path. The two blended-image caveats remain visible during translation.

The 1 km grazing views support the same eight passes and two caveats. Atmospheric recession helps the distance read naturally, without revealing the old mirrored carpet. The mathematical shell retains a smooth silhouette and lacks geometric occlusion/parallax; this is expected for bump shading and should not be presented as displaced terrain. No conspicuous embossed water edge or extreme relief outline appears in these views.

The remote series at 100, 300, 600, 900, 1200 and 1800 km exposes a **separate remote-atlas limitation**. Fine near imagery becomes a recognizably different large-scale atlas around the 300 km view; spatially broad blends can be seen. At 600 km and above, a sharp vertical two-colour division is visible near the center of the captured view in all biomes, becoming especially clear as detailed textures fade out. The repeated macro motifs and colour boundary should be investigated in a future remote-view pass. These observations do not change the user's low-altitude hero-transition scores, but they rule out claiming seamless transitions across the entire altitude range.

No fourth visual optimization attempt was performed. Final combined scores remain **2 for eight biomes; 3 for Chalk Archipelago and Mycelium Sea**. The practical result is a major improvement in close texture repetition, with two honestly documented patch-blending weaknesses and a separate remote-atlas issue.
