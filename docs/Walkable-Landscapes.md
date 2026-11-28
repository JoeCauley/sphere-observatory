# Walkable landscapes of the Sphere

## The first half-kilometre

Start on foot in Bay 0 at the four-metre Service doorway. In seed 713, the opening in the canopy lies 412 m outside the threshold. From the opening, the surveyed tree stands another 100 m outward and 66 m to the left. Its crown rises to about 42 m. This is the tree to spend the first art budget on. A player should recognize the same split in the crown from above, follow the light through it from the doorway, then recognize a particular root while circling the trunk. Save a mark at that root, fly away, and return to it after restarting.

The current build gives this tree folded buttresses, branching limbs, irregular crown lobes with shaded undersides, furrowed bark and an attached bromeliad. Broadleaf fans and fallen leaves give the walker details at ground level. Its address, trunk footprint, canopy opening and saved marks come from the existing survey. The following art direction and budgets are proposals for the next production pass.

## Three places to walk

| Place | What the pilot sees | What the walker sees | What determines placement |
| --- | --- | --- | --- |
| **Super Jungle** | An uneven roof of emergent crowns with dark openings between them. One notched, sunlit crown marks the way back to Bay 0. | A massive fluted trunk blocks the view, then a few steps reveal a fern-lit opening. Lianas hang from actual branches. Bromeliads collect in forks. Damp litter, fallen leaf fans and exposed roots meet the soil. | Stand age and available light set the canopy. Shade and drainage control the understory. The local tree supplies sockets for epiphytes and the path keeps its walking clearance. |
| **Dark Age Forest** | A serrated line of near-black firs around a broad-crowned old oak. Small pale clearings interrupt the ridge. | Tall, open spaces between trunks alternate with sapling thickets. A broken trunk frames a mossy nurse log. Its uphill side is dry and furrowed, its shaded side carries moss. | Exposure selects fir, shelter selects oak. Fallen wood casts a local shade field. Saplings cluster at its edges and leave openings a walker can thread. |
| **Infinite Meadow** | Grassland with long views, small groups of trees on higher ground and flower drifts along moist swales. The freight hall stays legible across the grass. | A leaning edge tree, grass seed heads and unevenly spaced flowers give three scales at eye level. Petals show their shape against dark grass. Under the tree, scattered leaves interrupt the grass. | Drainage and exposure place tree islands. Flower species grow in patches with mixed heights and gaps. Wear thins grass along paths and fades flowers toward the service apron. |

For the first production reference, author one exceptional specimen per landscape. For the jungle, make the buttress cross-section, branch forks, hanging leaf clusters and bark grooves agree at arm’s length. Give the forest oak a recognizable broken limb. Give the meadow tree an asymmetric crown that reads from the opposite side of the clearing. Derive several age, lean and crown variants from those forms. Review them at walking height, in silhouette and under a passing Shade before populating a larger area.

## Keeping the whole world walkable

1. **An address owns a plant.** Use the existing world seed, geography revision, surface cell, species and instance slot. A tree keeps its anchor, crown outline, trunk collision and rotation through camera changes, worker restarts and return visits. Store authored variations and player marks against that identity. Small flowers can regenerate as a patch. A camera-facing tile, local tangent frame or random draw order must never choose their positions.
2. **Decide ground and access first.** Sample the same supported ground triangle for planting and walking. Apply the Atlas wall, door, paving, water and wound exclusions before spawning trunks or ground cover. Test a plant’s occupied radius against the road shoulder. Root tips and fallen wood touch that ground. Keep the surveyed door-to-clearing route passable using a body-sized capsule.
3. **Build outward from the plant.** Near the camera, give landmark trunks, roots and major branches geometry with stable collision. Use leaf clusters with authored silhouettes, two-sided lighting and filtered normals. Pin the wind at the branch and root, increasing motion toward the tip. Let small leaves, fronds and flowers move without moving contact points or standing height.
4. **Spend pixels where players can resolve them.** Choose representation from projected size. As a crown shrinks, merge overlapping leaves into branch clusters, then a crown silhouette, then the same stand’s coverage in the ground shader. Preserve the characteristic notch, hue and position at each handoff. Use foliage masks with coverage-preserving mipmaps and depth testing. Cap overlapping layers, particularly when looking into a sunlit understory at a grazing angle.
5. **Put a ceiling on resident work.** Stream a camera-centred working set through the existing worker, instance and upload budgets. Keep a nearby ring resident behind the player for turns. Share prototype meshes and texture pages across cells. Reserve collision and a coarse silhouette before spending memory on leaves. Measure bytes uploaded, draw calls, GPU time and time from first ground frame to resolved foliage after a cold start.

Guerrilla’s *Horizon Zero Dawn* placement talk shows artists defining rules for a treeline or a road and the runtime assembling the surrounding environment. For the Sphere, the concrete application is giving the Bay 0 clearing, wall and trees explicit placement relationships that every rendering distance can query. [Guerrilla’s presentation](https://www.guerrilla-games.com/read/gpu-based-procedural-placement-in-horizon-zero-dawn)

## What the bridge could become

The Atlas can answer a repeatable question about a world address. The camera gives us another question, which parts of that answer do we need in time for this particular view or the player's next step? Keep the world revision and address in the first question. Put position, velocity, lens, visible openings and available frame time in the second. That division lets a player bank, stop or reverse while the same tree stays put.

Consider the four-metre Service door. Deep inside, one green opening may cover six pixels. A cached color sample with an appropriate silhouette can be adequate. When the pilot aims at it and accelerates, request the clearing, tree silhouettes and the supported ground on the far side. While the pilot is still inside, a camera aimed through the opening can already see the fork in one crown. On crossing, use the same tree anchors, light, depth and ground triangles. A bark upload can finish while the player stands still. Do not let an unfinished leaf texture hold the doorway or the player's feet hostage.

| A possible Atlas request | A useful result |
| --- | --- |
| What covers these distant pixels? | Stand coverage, mean material, approximate canopy height and light response. The pixel footprint determines when a roof or clearing is resolvable. |
| What silhouettes will this opening expose? | A short list of locally positioned tree or structure instances. The opening clips the visible region and limits how much needs to be drawn. |
| Where can a walker arrive in the next few seconds? | Resident support triangles, wall clearances, landmark identities and a lower-detail visible neighborhood. An unseen landing floor can have a tighter deadline than visible bark. |
| What can improve this frame with the time left? | Higher-detail meshes, leaf clusters or material pages for already visible objects. A completed upload invalidates the still frame as well as a moving one. |

The engine already clips some doorway views to their projected pixel area, budgets ground tiles and uploads, and keeps a local window of the geographic wall. The Jungle window can already render the destination's native camera. Those systems make their decisions in different places. A plausible next experiment is to let an existing doorway submit advance requests to those same providers and give them a common deadline. Estimate time to the opening from distance and closing speed, then compare it with recent generation and upload times. Keep a small area behind the player warm for reversals. At high speed, narrow the area of speculative detail to the likely route.

A finished color image is a useful answer for a distant, framed view. For two spaces that overlap on screen, use the same camera and depth buffer where possible. A separately rendered view needs matching projection, depth and exposure to place a branch on the correct side of concrete. An image also cannot answer where a boot lands. Keep that answer reachable even off screen.

A small experiment can decide whether the generalized bridge pays for itself. Replay the same cold doorway approach with advance requests on and off, then repeat with a sudden turn away and a stop facing the tree. Compare the time to a recognizable crown, time to a supported step, worst frame and bytes generated for places the player never visited. Expand the system after it improves the walk and the missed turn remains cheap.

## Art and performance acceptance

| Playable review | What to look for |
| --- | --- |
| Cold approach from 12 km, then 835 m | Recognize the canopy opening, see the road meet ground on the Jungle side, and watch detail resolve while holding still. Sweep the camera along the doorway at a grazing angle. |
| Walk from the doorway to the buttress and around it | Read bark direction, branch attachments, leaf overlap and contact shade. See sky between lobes. Step behind the root and look back through the same gap. |
| Repeat at a forest clearing and a meadow swale | Navigate each place by its unique silhouette. Check that the meadow still reads as open grassland and a dense flower patch leaves room to walk. |
| Fly through several residency windows, turn 180°, return and reload | Revisit the same trunk and flower patch. Inspect the nearest surface, roots and canopy during the turn. Log worker queue, texture/mesh residency and worst frame. |
| Repeat in direct light and under a Shade | Retain readable leaf masses and material separation in shadow. Check masked foliage against a bright sky for shimmer and scene contrast for clipped highlights. |

Proposed ALPHA review target is a 2560 × 1440 viewport, sustained 60 Hz with the 95th-percentile GPU frame at or below 16.7 ms after warm-up. Record cold loading time, first useful frame, time to fine detail and the worst streaming hitch separately. Establish the actual baseline on ALPHA before fixing a polygon, leaf or memory budget. Keep the geometry-backed path and landmark silhouette intact when reducing detail on slower machines.

First art milestone is the Bay 0 half-kilometre in daylight and Shade. The second is one representative forest clearing. The third is a meadow grass-to-flower-to-tree transect. Promote each to a world-wide placement recipe only after its walk, flight and save-and-return look like the same place.
