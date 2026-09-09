# The Sphere Observatory

**Fly inside a Dyson shell at Earth's orbital radius. Explore its light, measure its scale, and save reproducible photographs.**

A local WebGL 2 instrument inspired by **The Sphere** worldbuilding project. The shell has a radius of 149,597,870.7 km around a Sun-sized star: approximately **551 million Earth surface areas** on the inside.

![Designed regions on the inner surface](examples/collection.png)

Current version: **0.8**. This is a working visualization prototype, not a finished game or a complete physics simulator.

## Run locally

Download this repository as a ZIP and extract it. Open **index.html** in desktop Chrome or Edge. On Windows, **Launch Observatory.cmd** opens it for you. Hardware acceleration and WebGL 2 are required.

Alternatively, with Node.js 20 or later:

```sh
npm start
```

Open **http://127.0.0.1:8766/**. If the port is occupied, use `node serve.cjs 8767`. Stop the server with Ctrl+C. It listens only on localhost.

**No build step or runtime package installation.** No account, API key, cloud service, telemetry or runtime image generation. Testing has primarily used Windows, Edge and an RTX 5080; performance on other systems may differ substantially.

## First exploration

1. Choose a destination under **Camera**. Destinations move and rotate the camera while preserving world, time, lens and lighting settings.
2. Use **World → Before / After the attack** to compare the same location and time. Regions & shade engineering controls the layout and fleet.
3. Use **Camera → Complete scene studies** for explicitly staged conditions, including original First Light and an eclipsed shade.
4. Adjust exposure and sampling under **Light**. Save images and complete scenes under **Capture**.

Drag to look. **W/A/S/D** fly, **Q/E** move down/up, **Shift** accelerates, and the wheel changes speed. **Space** starts or pauses shade motion. **H** hides view overlays. Camera controls also provide discrete yaw, pitch and roll.

Altitude describes the nearest surface below you. Looking into the sky can mean looking hundreds of millions of kilometres across the cavity. **Inspect the surface below** turns toward nearby material.

## Features

- Analytic shell, stellar disk and shade intersections at a one-AU scale.
- Before/after views of designed region belts, six wounds, service rings and a shade fleet.
- Planar, square, curved-cap and trimmed-cap shade designs with kilometre-based construction detail.
- Three prescribed routes containing 8, 6 and 4 intact shades. Successive passages are 24, 36 and 60 hours apart; full circuits take 8, 9 and 10 days.
- Shadows integrated over the stellar disk, with overlapping station and shade blockers.
- Approximate coloured ShellShine, atmosphere and procedural surface materials.
- Curved-surface area measurement in square kilometres and **Earth surfaces**, including freehand outlines.
- HD/4K/8K PNG photographs with scene JSON, panoramas, bookmarks and local SDR motion studies.

![A trimmed shade and its shadow](examples/shade-eclipse.png)

These images come from the renderer. Import companion JSON files from [examples](examples/) using **Capture → Import scene**.

## Quality and workload

Preview rays are capped at approximately 2.07 million pixels, with selectable 15/30/60 fps ceilings. Still views stop rendering and hidden tabs pause. These are workload controls, not watt limits or guaranteed frame rates.

Antialiasing offers supersampling alone or additional contrast-edge filtering. At the full preview ray budget there is no supersampling headroom; the optional edge filter still operates on supported GPUs and can soften fine details. Material rendering uses a half-float light buffer when available, with a compatibility fallback. Output is **SDR**.

Station shadow integration defaults to **64 rays**, with 19/128/256 available. Higher values reduce false bands and cost GPU work. The original 7/19 setting applies with the station disabled. A 4K photograph can render internally at 7680 × 4320; metadata records the actual pipeline and dimensions.

Start with defaults. Reduce preview detail or use 19 station rays if interaction is slow. Video recording is real-time and may miss its target frame rate at demanding settings.

## Scientific boundaries

**Geometric scale is the foundation; the entire world is not physically solved.**

CPU geometry uses double precision; GPU calculations use normalized floating point with finite precision limits. Surface patterns are illustrative materials on a smooth shell, not resolved terrain or ecosystems. Wounds have no resolved deck thickness.

Shade motion is prescribed, not gravitational orbital motion. Gravity, shell support, heat disposal, propulsion and atmosphere retention are assumed. Light travel time, climate, material strength, evolving debris and station thermal emission are not simulated. The stellar disk has uniform brightness rather than limb darkening. Atmosphere and ShellShine are approximations, not converged global transport.

Sampling artifacts remain. In the station study, mean error against 8,192 CPU rays fell from 1.17 percentage points at 19 rays to 0.44 at 128. Six of 10,710 GPU/CPU probes differed by one ray at 128 samples. This is tested evidence, not universal accuracy certification.

## Tests and notes

Run dependency-free numerical checks:

```sh
npm test
```

Browser tests additionally require a locally installed Playwright package and a Chromium-family browser. These are development dependencies only. Set `SPHERE_PLAYWRIGHT` to the package's absolute path if it is not resolvable as `playwright`, and `SPHERE_BROWSER` to the browser executable. HTTP tests default to port 8766 and accept `SPHERE_URL`; some original tests load the HTML file directly. Run browser tests sequentially to avoid GPU contention.

```sh
node tests/collection-browser.cjs
node tests/shade-light-browser.cjs
node tests/station-browser.cjs
node tests/visual-quality-browser.cjs
node tests/edge-filter-browser.cjs
```

The station test reports finite-precision discrepancies and checks a one-source-ray-plus-quantization bound. Edge filtering records both squared and absolute errors because smoothing does not improve every metric.

- [Collection layout](docs/Observatory-Collection-Study-01.md)
- [Shade design and clearance](docs/Observatory-Shade-Standard-01.md)
- [Linear lighting and UI](docs/Observatory-Visual-Quality-06.md)
- [Edge-filter tradeoffs](docs/Observatory-Visual-Quality-07.md)
- [Station integration results](docs/Observatory-Station-Light-08.md)

Historical notes describe their named version; this README describes the current release.

## Project

Created by Joe Cauley with AI-assisted development. Scientific corrections, reproducible rendering issues and hardware/browser test results are welcome. A scene JSON helps reproduce an issue.

## License

No reuse license has been selected for this initial public release. Public visibility does not itself grant a software license.
