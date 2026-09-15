# The Sphere Observatory

**Explore a world wrapped around a star. Find a place in it. Return with a story.**

![The polar court beneath the inner shell, habitat bands, Wounds and moving Shades](examples/observatory/hero.jpg)

*The polar court, rendered in v1.5 with the camera composition of the project's reference photograph. [Original 4K image](examples/observatory/hero.png) · [Restore this scene](examples/observatory/hero.json).*

The Sphere is an inhabited Dyson shell enclosing a Sun-sized star at the radius of Earth's orbit. Its landscape surrounds you: nearby ground underfoot, distant continents overhead, and enormous moving Shades between the surface and the star.

The Observatory is a local exploration app for developing that world. Fly through its interior, walk through biome field sites, follow a Watershed from a regional map to a garden terrace, inspect the exposed edge of a megastructure, and photograph a place you can visit again. It is a laboratory for worldbuilding, visual storytelling and questions of scale, geography and light.

The ambition is a coherent, physically grounded world in which open-ended stories and journeys can take place. This is a working prototype: measured geometry, local terrain, travel and capture are implemented; finished environments across the entire shell and complete physical light transport remain goals.

**[Run the Observatory](#run-the-observatory)** · **[Take your first journey](#your-first-journey)** · **[Browse all 17 photographs and scenes](examples/observatory/README.md)**

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

These describe the mathematical shell before subtracting its openings. They do not imply finished terrain on every square metre. Light-crossing time is a scale reference; the renderer uses instantaneous light.

At low altitude, the ground below you can be close enough to walk on while the surface in your sky is hundreds of millions of kilometres away. The Observatory connects those views through a free camera, stable world addresses, procedural surface materials and local geometry.

## Choose a place and explore

### Biomes and living landscapes

Explore ten biome families: **Dark Age Forest, Super Jungle, Ultra Desert, Winter Hell, The Ruin, Machine Expanse, Rustwater Marsh, Chalk Archipelago, Mycelium Sea and Violet Labyrinth**. Their visual identities extend from distant habitat bands to nearby materials and deterministic field-site terrain.

Use **Explore → Places → Biomes** to arrive on the ground, near the clouds or high above the landscape. Walk among local structures and vegetation, lift off and look back, or fly toward another part of the shell. New landings prepare adjoining terrain as you walk. These are sample environments; the biome descriptions express a broader worldbuilding ambition than the current local meshes.

| Ultra Desert | Winter Hell |
|---|---|
| ![Dune-coloured ground and local formations in Ultra Desert](examples/observatory/ultra-desert.jpg) | ![Pale ice and local formations in Winter Hell](examples/observatory/winter-hell.jpg) |
| [4K photograph](examples/observatory/ultra-desert.png) · [Scene](examples/observatory/ultra-desert.json) | [4K photograph](examples/observatory/winter-hell.png) · [Scene](examples/observatory/winter-hell.json) |

### Watersheds, from catchments to a terrace

The Watershed neighbourhood surrounds a **640 km river-garden province** with connected catchments, receiving lakes and open country. Geography has a saved seed and address. Rivers, ground, water and regional materials describe the same landscape as you approach; the garden adds curved terraces, planted courts and Builder architecture.

Use the **Explore → Watershed** arrival selector to examine six scales. Heights below are the named camera presets; the terrace view is measured above its floor.

| Connected catchments · 40,000 km | Receiving reaches · 10,000 km |
|---|---|
| ![The Watershed neighbourhood from 40000 km](examples/observatory/watershed-40000.jpg) | ![Receiving reaches from 10000 km](examples/observatory/watershed-10000.jpg) |

| Province · 1,100 km | River country · 48 km |
|---|---|
| ![The original Watershed province from 1100 km](examples/observatory/watershed-1100.jpg) | ![An approach to river country from 48 km](examples/observatory/watershed-48.jpg) |

| Water garden · 1 km | Open terrace · 6 m above its floor |
|---|---|
| ![The garden and river from one kilometre above the landscape](examples/observatory/watershed-1.jpg) | ![Builder architecture on the open garden terrace](examples/observatory/terrace.jpg) |

The **receiving lake, quiet reach and open meadow** are three regional compositions in this connected neighbourhood. Visit their dry-bank arrivals through **Explore → Places → Watersheds**, or choose **Landscape view** for the compositions below. The original garden has the most developed local architecture; detailed shore planting and structures throughout the trio remain future work.

| Receiving lake | Quiet reach | Open meadow |
|---|---|---|
| ![Receiving lake regional composition](examples/observatory/lake.jpg) | ![Quiet reach regional composition](examples/observatory/reach.jpg) | ![Open meadow regional composition](examples/observatory/meadow.jpg) |

**[Open the Watershed photographs and restore any altitude](examples/observatory/README.md#watersheds-at-six-scales).** Water is a rendered surface over designed geography, not a flowing hydrodynamic simulation.

### Shades, eclipses and exposed engineering

Eighteen intact Shades occupy three maintained routes. Successive passages occur at 24, 36 and 60 hours; complete circuits take 8, 9 and 10 days. Advance the simulation to watch the finite stellar disk disappear behind a Shade, or study its shadow crossing the shell. Station and Shade occlusion share sampled stellar rays.

Approach a Shade to inspect its continuous body and automatically prepared edges. The current geometry has two faces **180 m apart**, finished layered panels along intact perimeters, and exposed braces and recessed layers around damaged boundaries. Close inspection can follow the moving parent. The dimensions are provisional engineering; full environments across the enormous Shade faces are still to be built.

| Intact perimeter | Broken edge |
|---|---|
| ![A finished layered perimeter on an intact Shade](examples/observatory/shade-intact.jpg) | ![Exposed layers and braces along a broken Shade](examples/observatory/shade-broken.jpg) |
| [4K photograph](examples/observatory/shade-intact.png) · [Scene](examples/observatory/shade-intact.json) | [4K photograph](examples/observatory/shade-broken.png) · [Scene](examples/observatory/shade-broken.json) |

### Wounds, history and the stellar conservatory

Switch between **Before the attack** and **After the attack** while retaining camera and time. Six vast Wounds open through the damaged shell. Travel along their exposed layers or through an opening to an exterior debris field. Visit the central star's service rings and the two polar entry complexes. These are authored historical states; the attack and destruction do not evolve dynamically.

| The edge of the shell | The stellar conservatory |
|---|---|
| ![Clouds above the exposed wall of a Wound](examples/observatory/wound.jpg) | ![The central star and its service rings](examples/observatory/interior.jpg) |

### Clouds and light

Choose a Place's scene and weather, adjust exposure, and explore layered volumetric clouds, approximate atmospheric scattering and coloured reflected **ShellShine**. Compare a location in clear conditions, under cloud cover or during a Shade passage. Light and quality controls let you trade preview cost against detail.

![Clouds above Super Jungle with the far interior beyond](examples/observatory/clouds.jpg)

*[Nine kilometres above Super Jungle](examples/observatory/clouds.png) · [Restore scene](examples/observatory/clouds.json).*

## Travel, measure and keep what you discover

- **Go somewhere deliberately.** Use Places, exact coordinates or a point selected in the view. Automatic speed responds to nearby surfaces; manual speed is available. Return history retraces your arrivals.
- **Walk and fly.** Land on prepared ground, walk across adjoining terrain, jump, lift off and descend again. Local structures participate in picking, collision and photographs. The free camera can exceed light speed; it is an exploration tool.
- **Measure a visible region.** Draw a rectangle or freehand outline. The survey integrates rays over the curved shell, excluding openings and foreground blockers, and reports square kilometres and Earth surfaces. It measures the visible outline on a smooth sphere, not mountain relief or an unseen connected region.
- **Save photographs.** Export clean HD, 4K or supported 8K PNG images, perspective views or 360° panoramas. The photograph package includes scene JSON with camera, time, seed, world settings and rendering metadata.
- **Record a motion study.** Capture local SDR video through the browser. Recording cadence depends on the machine and browser; this is real-time encoding.
- **Return to a scene.** Import a photograph's JSON through **Capture → Import scene**. Browser bookmarks and session restoration are convenient; exported scenes are the portable record.

Every image on this page is a fresh photograph from the **v1.5.0 renderer**. The hero restores the reference composition using current source and Shade geometry. The README displays smaller JPEG copies; the [gallery](examples/observatory/README.md) provides untouched 3840 × 2160 PNGs, importable scenes and capture metadata. No image was externally retouched or composited. Some in-app material artwork was created with AI assistance; the app performs no runtime image generation. Former public photographs and documentation images are in the [archive](examples/archive/README.md).

## Run the Observatory

Download this repository as a ZIP and extract it. Install **Node.js 20 or later**. On Windows, double-click **Launch Observatory.cmd** to start the local server and open the app; use **Stop Observatory.cmd** when finished.

Or run this command from the extracted folder:

```sh
npm start
```

Open [localhost:8766](http://127.0.0.1:8766/). Stop the terminal server with Ctrl+C. If the port is occupied, run `node serve.cjs 8767` and open that port instead.

Use a Chrome- or Edge-family browser with **hardware-accelerated WebGL 2**. Testing has primarily used Windows, Edge and an RTX 5080. Start with default quality and reduce preview detail or shadow samples if needed. Preview resolution and frame ceilings manage requested work; performance varies by hardware and scene. Cold scene preparation can take time.

There is no application compilation step, runtime package installation, account, API key, telemetry or cloud service requirement. Use the local server so workers and textures load correctly. Settings stay in this browser; export scenes to preserve them independently.

### Your first journey

1. Open **Explore → Places**. Choose a destination, arrival height, scene and weather, then visit it.
2. Drag to look. **W/A/S/D** move, **Q/E** descend/climb, **Z/X** turn and **Shift** accelerates. Scrolling chooses manual speed.
3. On foot, **Space** jumps and **Space + E** lifts off. In flight, **Space** controls simulation play/pause. Descending below about 100 m over solid ground eases into prepared walking terrain.
4. Point and press **G**, or click to mark a destination and choose **Go to pointer**. Use **Return to previous** to retrace arrivals. **H** toggles overlays.
5. Explore the Watershed arrival heights, compare the historical eras, then use **Capture** to save your view.

## What the model establishes

| Implemented foundation | Present boundary |
|---|---|
| Analytic shell and star; measured camera geometry, intersections and apparent sizes | Finite GPU precision and pixel resolution |
| Shared local geometry for rendering, picking and collision | Most of the shell remains an analytic surface with illustrative materials |
| Finite-source eclipse sampling and overlapping blockers | Sampled shadows and uniform stellar brightness |
| Coloured first-bounce ShellShine, atmosphere and volumetric weather | Approximate transport; no converged global illumination, climate or radiative equilibrium |
| Saved geography, camera, time and scene revisions | Bounded terrain residency; whole-Sphere authored environments remain future work |
| Maintained Shade routes and historical world states | Prescribed motion; no orbital solution, evolving attack or delayed light transport |

Artificial gravity, shell support, material strength, atmosphere retention, propulsion and heat disposal remain stipulated engineering. Exposure is artistic rather than calibrated photometry. Saved older scenes retain their geometry and art revisions, so they can differ from new scenes. GPU, browser and renderer changes can affect reproduced images. An intermittent capture-repeat diagnostic remains open; the gallery records its own repeat-frame checks without claiming a general fix.

## Development and further reading

This repository contains the runnable browser Observatory. The broader [Sphere project](https://github.com/JoeCauley/Sphere) holds adopted requirements and a separate Unreal application direction. This prototype does not establish that application's acceptance.

Run dependency-free numerical checks with `npm test`. Browser checks additionally require Playwright and a Chromium-family browser. Set `SPHERE_PLAYWRIGHT` to its module path and `SPHERE_BROWSER` to the executable, then run relevant `tests/*-browser.cjs` checks sequentially against the local app. Tests supporting another server accept `SPHERE_URL`.

- [v1.5.0 release and verification](docs/releases/v1.5.0.md)
- [Project roadmap](docs/Observatory-Roadmap.md)
- [Biome Pack programme](docs/Observatory-Biome-Packs.md) and [Watershed design](docs/Observatory-Watershed-Province.md)
- [Places and continuous travel](docs/Observatory-Places-Travel.md)
- [Shade bodies and edge geometry](docs/Observatory-Shade-Body-03.md)
- [Lighting, materials and shadows](docs/Observatory-Materials-13.md)
- [Technical evidence](docs/evidence/) and [previous photographs](examples/archive/README.md)

Created by **Joe Cauley**, with AI-assisted development. Reproducible rendering reports, scientific corrections and hardware/browser results are welcome; include a saved scene when possible.

No reuse license has been selected. Public repository access does not itself grant a software license.
