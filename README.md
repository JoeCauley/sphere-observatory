# The Sphere Observatory

**Explore a world wrapped around a star. Find a place in it. Return with a story.**

![The polar court beneath habitat bands, enormous Shades and openings in the far shell](examples/observatory/hero.jpg)

*The Sphere from the polar court, freshly photographed in v1.6. [Original 4K image](examples/observatory/hero.png) · [Return to this scene](examples/observatory/hero.json).*

The Sphere is an inhabited Dyson shell enclosing a Sun-sized star at the radius of Earth's orbit. Stand on its inner surface and a world curves above you: continents across the cavity, vast moving Shades between land and star, and Wounds opening into space.

The Observatory is a local exploration app for developing that world. Walk through biome field sites, follow a river from its catchment to a garden terrace, fly beside exposed megastructure engineering, and save a photograph that remembers where you were. It brings worldbuilding, visual storytelling and questions of scale into one navigable instrument.

**v1.6 makes those journeys easier to keep and smoother to explore.** Explore, Journey, World and Capture now share a persistent location strip and clock. Arrivals prepare their destination before committing, Return survives a reload, Wound openings stay clear of stray terrain, and the rendering and traversal pipeline does less repeated work.

**[Download the current build](https://github.com/JoeCauley/sphere-observatory/archive/refs/heads/main.zip)** · **[Run the Observatory](#run-the-observatory)** · **[Take your first journey](#your-first-journey)** · **[Browse the new photographs](examples/observatory/README.md)**

## A journey you can return to

Choose a category, destination and arrival in **Explore**, then Visit. Browsing is a draft: changing a selector does not redirect the trip already being prepared. Cancel stops that trip; Retry keeps the submitted destination. Normal visits preserve your world and lighting choices.

**Journey** remembers committed arrivals, including their world and time. Return retraces them while keeping your current playback and speed preference. Up to 24 earlier visits survive a browser reload, and reopening pauses the clock. Named viewpoints and exported scene files let you keep the places that matter.

| Choose an arrival | Keep the journey |
|---|---|
| ![Explore in the running v1.6 app, with a prepared forest arrival](examples/observatory/interface-explore.jpg) | ![Journey history in the running app beside the river gardens](examples/observatory/interface-journey.jpg) |

The location strip tells you where you are and whether you are walking, flying or following a Shade. Return stays beside it. The clock owns time, playback, rate and historical era. **Instruments** holds speed, altitude, measurement and rendering diagnostics. **Quiet** clears the view; Show controls or Escape brings the interface back.

## Ten landscapes under one sky

The habitat waist contains **Dark Age Forest, Super Jungle, Ultra Desert, Winter Hell, The Ruin, Machine Expanse, Rustwater Marsh, Chalk Archipelago, Mycelium Sea and Violet Labyrinth**. Their geographic regions, surface materials, local formations and atmospheric colours give each a distinct identity.

Arrive **on the ground**, **near the clouds** or **high above the landscape**. Walk across adjoining terrain, jump, lift off and look back. Ground, nearby structures, picking and collision share local geometry; terrain is prepared as you move. These are procedural sample environments, not finished environments across the whole Sphere.

![Walking beneath the far shell in Dark Age Forest](examples/observatory/forest-ground.jpg)

*[On foot in Dark Age Forest](examples/observatory/forest-ground.png) · [Restore the viewpoint](examples/observatory/forest-ground.json).*

| Ultra Desert | Winter Hell |
|---|---|
| ![Warm desert material and sparse formations beneath the interior sky](examples/observatory/ultra-desert.jpg) | ![Pale ice terrain beneath the far shell in Winter Hell](examples/observatory/winter-hell.jpg) |
| [4K photograph](examples/observatory/ultra-desert.png) · [Scene](examples/observatory/ultra-desert.json) | [4K photograph](examples/observatory/winter-hell.png) · [Scene](examples/observatory/winter-hell.json) |

## Follow a Watershed down to the garden

A connected neighbourhood surrounds the **640 km river-garden province**. Catchments lead toward receiving reaches, river country, water gardens and curved Builder terraces. Geography has a saved address and seed, so moving between scales brings you back to the same country.

Choose **Explore → Watersheds → Watershed · the river gardens**, then an arrival. The six view presets descend through 40,000 km, 10,000 km, 1,100 km, 48 km, 1 km and a terrace view 6 m above its floor. **On foot** is a separate seventh arrival.

| Connected catchments · 40,000 km | Receiving reaches · 10,000 km |
|---|---|
| ![Connected Watershed catchments viewed from 40000 kilometres](examples/observatory/watershed-40000.jpg) | ![Receiving reaches viewed from 10000 kilometres](examples/observatory/watershed-10000.jpg) |

| Province · 1,100 km | River country · 48 km |
|---|---|
| ![The river-garden province from 1100 kilometres](examples/observatory/watershed-1100.jpg) | ![River country during the 48 kilometre approach](examples/observatory/watershed-48.jpg) |

| Water garden · 1 km | Open terrace · 6 m above its floor |
|---|---|
| ![Terraces, river and planting in the water garden](examples/observatory/watershed-1.jpg) | ![Builder architecture at the open garden terrace](examples/observatory/terrace.jpg) |

The **receiving lake, quiet reach and open meadow** provide three more regional compositions and dry-bank arrivals in that connected neighbourhood. The original garden has the most developed local architecture; detailed shore environments throughout the wider country remain future work.

| Receiving lake | Quiet reach | Open meadow |
|---|---|---|
| ![The receiving lake in its regional composition](examples/observatory/lake.jpg) | ![The quiet reach in its regional composition](examples/observatory/reach.jpg) | ![The open meadow in its regional composition](examples/observatory/meadow.jpg) |

**[Restore any of these photographs and arrival heights](examples/observatory/README.md#watersheds-at-six-scales).** Water is a rendered surface over designed geography, not a flowing hydrodynamic simulation.

## Walk beside a Wound. Fly beside a Shade.

Six enormous **Wounds** open through the damaged shell. Surviving terrain stops at the opening; the exposed wall reveals the shell's layered structure. The v1.6 repair removes detached ground slabs and collision floors from the void, while traversal keeps the adjoining terrain prepared.

| On foot beside the opening | Across the exposed shell wall |
|---|---|
| ![Surviving ground beside a Wound opening](examples/observatory/wound-ground.jpg) | ![An oblique inspection of a Wound wall and the surviving surface](examples/observatory/wound.jpg) |
| [4K photograph](examples/observatory/wound-ground.png) · [Scene](examples/observatory/wound-ground.json) | [4K photograph](examples/observatory/wound.png) · [Scene](examples/observatory/wound.json) |

**Shades** bring a different kind of scale. Eighteen intact positions occupy three maintained routes, with successive passages at 24, 36 and 60 hours. A Shade's continuous body has two faces **180 m apart**, layered intact perimeters, and exposed braces and recessed layers around damaged boundaries. Edge detail prepares automatically during close flight, including approaches that are not attached to a Shade.

| Finished perimeter | Broken boundary |
|---|---|
| ![Layered engineering along the intact perimeter of Shade 4](examples/observatory/shade-intact.jpg) | ![Exposed layers and braces along a broken Shade boundary](examples/observatory/shade-broken.jpg) |
| [4K photograph](examples/observatory/shade-intact.png) · [Scene](examples/observatory/shade-intact.json) | [4K photograph](examples/observatory/shade-broken.png) · [Scene](examples/observatory/shade-broken.json) |

Close inspection can follow the moving parent. Full landscapes and walking across both Shade faces remain later work. The current Shade arrival is close flight, and the engineering dimensions are provisional.

Switch **Before the attack** and **After the attack** on the clock to compare the maintained and damaged collection. These are authored historical states. The attack itself does not unfold dynamically. Beyond the openings are exterior debris studies; toward the centre are the star's service rings, and at the poles are bounded entry complexes.

![The Sun-sized star and its damaged service rings within the cavity](examples/observatory/interior.jpg)

*[The stellar conservatory](examples/observatory/interior.png) · [Restore scene](examples/observatory/interior.json).*

## Light, weather and the far side of the world

Watch the finite stellar disk disappear behind a Shade, or follow its shadow across the shell. Station and Shade occlusion share sampled stellar rays. Coloured first-bounce **ShellShine**, atmospheric scattering and volumetric weather give distant surfaces and local air a changing presence.

In **World**, choose weather or an artistic illumination study, adjust exposure, or open the rendering controls. Ordinary travel keeps those choices. An illumination study changes rendered brightness without changing eclipse geometry.

![Cloud banks above Super Jungle with the far interior beyond](examples/observatory/clouds.jpg)

*[Nine kilometres above Super Jungle](examples/observatory/clouds.png) · [Restore scene](examples/observatory/clouds.json).*

## A smoother Observatory

This build fixes preview-frame pacing and terrain-worker restarts at chunk boundaries. It reuses identical lighting and readiness calculations, skips off-camera meshes in the colour pass, and reduces unnecessary station-shading work. Shadow casters, geometry detail, lighting samples and photograph resolution are preserved.

The measured traversal pass used Chrome with hardware-accelerated WebGL 2 on an **RTX 5080**:

| Test | Before | Optimized build |
|---|---:|---:|
| Mycelium Sea ground traversal, 1600 × 900 window | 44 fps | 60 fps |
| All 10 biomes, 6 Wounds and 8 Shade approaches, same window | Some routes missed the target | 59.8–60.1 fps |
| Wound route, fixed-resolution 4K window | 48 fps | 55 fps |
| Heavy inner Shade view, fixed-resolution 4K window | 40 fps | 47 fps |
| Four representative 4K-window routes with adaptive resolution | — | About 60 fps after settling |

These are warm preview draw rates on the tested machine. The 4K window's scene raster was 3504 × 2094 because the controls occupy part of the window. Adaptive preview trades internal resolution for frame rate; exports keep their selected resolution. Cold shader preparation can still take tens of seconds or longer, and the most demanding fixed-resolution views remain GPU-limited.

**[Read the complete evaluation, every route and the remaining limits](docs/Observatory-Performance-2026-09-15.md).** Quality defaults were not lowered to obtain the fixed-resolution results.

## Keep the photograph—and the place

**Capture** can save clean HD, 4K and supported 8K photographs, 360° panoramas, browser-recorded motion studies and named viewpoints. A photograph package contains the image and a scene file with camera, world, time, seed, place identity and build metadata. Capture prepares its assets before drawing, and offers cancellation while preparing.

![The Capture panel beside the river gardens, with a title and 4K export selected](examples/observatory/interface-capture.jpg)

Save portable scenes through **Journey → Saved viewpoints & scene files**. Import a scene there to restore it. Browser history and bookmarks are convenient, but exported JSON is the independent record. Hardware and later renderer changes can affect exact image reproduction.

The [new gallery](examples/observatory/README.md) contains **19 freshly rendered 3840 × 2160 photographs**, their importable scenes, and **three new interface screenshots**. Smaller JPEGs keep this README light; linked PNG originals are untouched app output. Every accepted photograph finishes with two identical prepared frames, and its metadata records all earlier comparisons. This does not claim a general solution to cold-capture repeatability.

No photograph was externally retouched, composited or replaced with a generated image. Some material artwork used inside the app was made with AI assistance; the app performs no runtime image generation. The [v1.5 photographs](examples/archive/v1.5/README.md) and [earlier galleries](examples/archive/README.md) remain available.

## Run the Observatory

Download the [current repository ZIP](https://github.com/JoeCauley/sphere-observatory/archive/refs/heads/main.zip) and extract it. Install **Node.js 20 or later**. On Windows, double-click **Launch Observatory.cmd** to start the server and open the app. Use **Stop Observatory.cmd** when finished.

Or, from the extracted folder:

```sh
npm start
```

Open [localhost:8766](http://127.0.0.1:8766/). Stop the terminal server with Ctrl+C. For another port, run `node serve.cjs 8767` and open that port instead.

Use Chrome or Edge with **hardware-accelerated WebGL 2**. Start at default quality and allow the first view to prepare. World contains preview quality, the frame limit and adaptive resolution. Settled views stop drawing and hidden tabs pause.

There is no application compilation step, runtime dependency installation, account, API key, telemetry or cloud-service requirement. Serve the app over localhost so workers and textures load correctly. Settings stay in this browser; exported scenes preserve them separately.

### Your first journey

1. In **Explore**, choose **Biomes → Dark Age Forest → On foot**, then Visit. Wait for the prepared arrival.
2. Drag to look. **W/A/S/D** move; **Shift** runs or accelerates. In flight, **Q/E** descend/climb and **Z/X** turn. Scrolling selects manual speed.
3. On foot, **Space** jumps and **Space + E** lifts off. In flight, **Space** controls the clock. Descending below about 100 m over solid ground prepares a walking arrival.
4. Click to mark a place and use the pointer action, or press **G** toward the centre ray. Marks retain their geographic or moving-Shade address as you look around. Use **Return** to retrace an arrival.
5. Visit the river gardens at several scales. Compare the eras on the clock, then give your photograph a title in **Capture** and save it.

**Instruments** also offers surface measurements. A rectangle or freehand outline integrates rays over the curved shell, excluding openings and foreground blockers, and reports square kilometres and Earth surfaces. It measures a visible outline on the smooth shell, not mountain relief or unseen connected land.

## A world on an extraordinary scale

| At the default scale | Dimension |
|---|---:|
| Star to inner shell | 149,597,870.7 km — one astronomical unit |
| Across the cavity | 299.2 million km |
| Around a great circle | 940 million km |
| Inner spherical surface | 281 quadrillion km² |
| Equivalent Earth surfaces, including land and oceans | About 551 million |
| Central star's diameter | 1,391,400 km |
| Light crossing the cavity | 16 minutes 38 seconds |

These dimensions describe the mathematical shell before subtracting its openings. They do not imply finished terrain on every square metre. Light-crossing time is a scale reference; the renderer evaluates light instantaneously. The free camera can exceed light speed because it is an exploration tool.

## What is established, and what remains

| Implemented foundation | Present boundary |
|---|---|
| Analytic shell, star and measured intersections | Finite GPU precision and pixel resolution |
| Shared local geometry for rendering, picking and collision | Most of the shell is still an analytic surface with illustrative materials |
| Finite-source eclipses and overlapping blockers | Sampled shadows and uniform stellar brightness |
| Coloured ShellShine, atmosphere and volumetric weather | Approximate transport; no converged global illumination, climate or radiative equilibrium |
| Saved geography, scene revisions and recoverable journeys | Bounded terrain residency; complete authored environments remain future work |
| Maintained Shade routes and historical eras | Prescribed motion; no orbital solution or evolving destruction |

Artificial gravity, shell support, material strength, atmosphere retention, propulsion and heat disposal remain stipulated engineering. Exposure is artistic rather than calibrated photometry. Older scenes keep their saved geometry and art revisions. Strict cold-capture repeatability remains an open diagnostic; prepared gallery repeat checks are narrower evidence.

## Development and further reading

This repository is the runnable browser Observatory. The broader [Sphere project](https://github.com/JoeCauley/Sphere) holds adopted requirements and a separate Unreal application direction. This prototype does not establish that application's acceptance.

Run `npm test` for **36 dependency-free numerical suites**. Browser checks additionally need Playwright and a Chromium-family browser. Configure `SPHERE_URL`, `SPHERE_BROWSER` and, when needed, `SPHERE_PLAYWRIGHT` or `NODE_PATH`. Run GPU checks sequentially.

- `npm run test:integration` — actual journeys, anchored marks, Return and Retry, saved history and responsive controls.
- `npm run test:performance` — all-biome, Wound and unattached Shade traversal measurements.
- `npm run test:performance-visual` — station-ray parity and culling image comparisons.
- [v1.6 build notes and verification](docs/releases/v1.6.0.md)
- [Performance evaluation](docs/Observatory-Performance-2026-09-15.md), [travel integration](docs/Integration-2026-09-15.md) and [Wound repair](docs/Wound-edge-repair-2026-09-15.md)
- [Roadmap](docs/Observatory-Roadmap.md), [Biome Packs](docs/Observatory-Biome-Packs.md) and [Watershed design](docs/Observatory-Watershed-Province.md)
- [Shade bodies](docs/Observatory-Shade-Body-03.md), [lighting and materials](docs/Observatory-Materials-13.md), and [technical evidence](docs/evidence/)

Created by **Joe Cauley**, with AI-assisted development. Reproducible rendering reports, scientific corrections and hardware/browser results are welcome; include a saved scene when possible.

No reuse license has been selected. Public repository access does not itself grant a software license.
