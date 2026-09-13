# Places and assisted travel

12 September 2026 · local development following Watershed province 1.

## Controls and travel

Space + E lifts off from walking. Either key can be pressed first. The camera
climbs 45 metres over two seconds, eases its look above the horizon, and remains
at the same local address. The visible Lift off button performs the same action.
Space alone jumps on foot and controls play/pause in flight. E climbs away from
the nearby surface; Q descends. Landing pads and their corner bollards are removed.

Automatic speed is enabled by default. It responds to nearby shell terrain,
both Shade faces and local structures, including geometry beside the
flight path. A shared distance curve accelerates on departure and slows on
approach. Dense biomes and Builder structures use gentler local speeds; open
desert permits a faster local pace. The maximum is 10 million km/s, consistent
with the Observatory's free-camera travel model. Acceleration and orientation
are eased; swept collision remains the final surface boundary.

The star is passable during free survey and does not reduce automatic speed.
Movement continues through its interior in ordinary steps, including the exact
centre. Holding E or Q retains the departure direction until release, so a
cross-cavity ascent cannot reverse when the local radial direction changes.
The designed shell accepts saved camera positions inside the star; historical
layout-one scene validation is unchanged. Playback remains under user control.
An arrival at the exact opposite point creates that destination's ground patch.
Patch reuse checks all three dimensions; matching tangent coordinates alone
cannot identify a place on a sphere.

Manual mode is available in **Go to Exact Position** and **Flight console**.
The manual speed remains a separate preference; automatic movement and landing
do not continually rewrite it. Scrolling deliberately switches to manual speed.
The existing 100 m walking handoff completes the approach to supported ground.

**Go to pointer** is one way. Click the view to pin a destination; the ring
stays there while the mouse moves to the button. Point and press **G** to travel
immediately. Without a pin, the button uses the centre marker. Dragging to look
or travelling clears the pin. It stores an actual world address; Shade marks
follow the moving plate. Ground, Wound centres/edges, visible local geometry
and the selected side of the star have suitable arrivals. Ground arrival keeps
the selected point centred rather than turning toward unrelated ground.

From inside the cavity, a central Wound still leads to its Breach spill.
Looking back inward from that spill, the empty entry aperture is transparent
to selection: the pointer reaches the visible far shell, Shade, star or local
geometry. A ray through two empty openings has no destination. This avoids
reselecting the same nearby Wound and looping back when trying to leave.
Pressing G over empty space leaves the camera in place; it does not substitute
the centre marker for the missing pointer destination.

**Return to previous** replaces the old bottom-right Biomes shortcut and steps
through up to 24 arrivals. Places, pointer jumps, bottom-bar destinations,
coordinate jumps, bookmarks and imported views share the history. Return keeps
the current play choice and speed-control preference. History is session-only.

## Explore

The expandable **Places** browser contains Biomes, Watersheds, Shell works,
Polar entries, Shades, and Wounds & beyond. The selected category stays
highlighted and filters the Place list. Entries have stable IDs and descriptions
so future Biome Packs can extend the catalogue without another navigation layout.

Arrival choices are presented from low to high:

- **Ground level:** on foot where walking is supported; close service-skin flight
  for Shades, and a local spill arrival for Wounds.
- **Beneath the Clouds:** just below the biome's cloud base, accounting for the
  local terrain elevation. Shades instead offer a labelled 700 m service view.
- **Atmosphere:** 256,267 km above the shell, reduced only if the world is too
  small to keep that viewpoint outside its central star. Wounds retain their
  dedicated spill arrival rather than showing misleading ground/cloud choices.

The atmosphere height is two-thirds of the Moon's mean 384,400 km distance
from Earth, following the requested reference scale ([NASA Moon facts](https://science.nasa.gov/moon/facts/)).

Choose one scene and one weather preset, then **Visit Place**. The checkbox
groups keep exactly one choice selected. Scenes are First Light, Darkness
Arrives, Day, and Dark. These are artistic illumination studies, saved separately
from the star's configured power and the calculated eclipse geometry; they do
not stage a new clock time or silently pause the simulation. Weather offers
Clear, Mixed, Cover, Precipitation, and Storm. Its cloud cover, falling weather
and storm flashes follow the simulation clock and freeze when paused.

**Go to Exact Position** retains coordinate, speed, lens, rotation, level and
walking-assistance controls. Original Study Viewpoints and Staged Lighting
Studies are removed from the Explore interface. Old scene/import handlers remain
compatible. The Watershed deep link still opens the versioned province.

## Area measurement

The measurement result now keeps its own scene and simulation time. Clock ticks,
weather changes and play/pause no longer delete the selection. Rectangles and
freehand outlines remain visible while the viewpoint is unchanged; closing and
reopening the tool retains the result. A different viewpoint hides the old
outline and labels the retained result as belonging to the previous view. Save
measurement exports the original scene and time. Clear explicitly removes it.

While drawing, the tool owns the pointer and blocks flight/walking controls.
Pointer travel cannot consume a measurement stroke. Travel closes the tool while
retaining its result. Playback ownership stays with the user.

## Loading the current view

An opening screen paints before renderer initialization and remains until the
restored or linked view is prepared. Whole-shell views use the numeric world
palette and request no image collections. The current viewing frustum and the
materials' distance bands select landscape, close detail, Builder and Wound
artwork. Hidden legacy previews no longer fetch images. Distant saved provinces
and local sites are not constructed just because their addresses are saved.

Entering uncached detail temporarily holds the frame and shows progress. It
does not change play/pause, and held flight keys resume after preparation.
Completed imagery is reused on a return visit. An obsolete preparation cannot
reveal a newer viewpoint's old scene. Failed artwork offers Retry and an explicit
Use simpler surface option; that choice turns off image detail until re-enabled.
Photographs prepare their output aspect, and panoramas sample all directions.
Prepared rendering components are also reused across combinations of views.
Leaving a saved province or passing the centre does not need a new loading
screen merely because the view's label or combination of components changed.

This is selective image loading with fixed-size texture arrays allocated on
first use. It does not yet page individual GPU layers or replace the hard-coded
ten-biome material tables with a fully extensible pack registry.

## Rendering and current bounds

The far cloud representation has three curved layers: low banks, middle cloud
fields and a thin upper veil. Six fixed geographic wavelengths provide broad
fronts and nested billows. Each layer has a different pattern and an independent
alpha mask, evolving over 12, 19 and 30 scene hours. Pausing the scene freezes
every layer, including repeat photographs and panorama faces.

The latest art adjustment reduces every cloud feature wavelength by one third
(a scale multiplier of 2/3), including local billows and all six distant bands.
CPU phase anchors and shader wavelengths share that factor. Layer heights,
local atmospheric reach, mask periods and the distance fade stay unchanged.

Across longer sight lines, broad clumps lose weight to smaller fixed weather
fields, and opacity and contrast recede. The coordinates themselves never scale
with the camera. All octaves and mask transforms preserve the periodic anchor's
wrap, avoiding a weather jump when crossing the centre. A thin aerial veil also
increases toward grazing views. Cavity haze attenuates both remote cloud light
and the surface behind it; nearby air is composed in front of that distant view.

A generated 256 by 128 climate map carries muted regional tints and coverage,
with broad blends at geography boundaries. It follows the receiving landscape,
not the departure Place. The map is numeric data, costs about 171 KiB including
mips, requests no image assets, and is reused until the geography changes.
Low banks retain more regional colour; upper veils become cooler and thinner.
Density-dependent lighting, inter-layer shading and softened broad Shade shadows
break up even brightness. Cloud shadows approximate the large silhouettes and
fracture families; fine cracks and stellar service structures are not sampled.

The far pass is compiled on demand and uses the existing bounded weather render
resolution. Clouds remain illustrative weather, not a climate simulation or
nine authored province textures. Lighting and weather settings travel in scene
files and photograph metadata. This does not change the interim shell atlas.

Local coverage and aerosol density influence resolved regional weather, fading
to the distant weather field between 300,000 and 3,000,000 km of receiver
distance. Full local cloud cover cannot cover every other region in cloud.
From below the deck, remote weather sits behind the local volume; above it,
the transition follows viewing distance as well as altitude. The thin cavity
dust remains separately controlled by Cavity haze. Local air over a Wound is
clipped without removing the weather on surviving ground in the distance.

Distant cloud thickness is integrated analytically at each layer's middle surface;
subtracting two AU-sized depths cannot resolve a thin cloud deck reliably.
All noise frequencies use mip filtering. The layer is clipped to the visible
inner shell, with tolerance for grazing-ray and log-depth precision. Wounds,
foreground Shades and the star do not receive a cloud layer from behind them.
The atmosphere uses the surface camera's output aspect, while addressing depth
with the internal raster dimensions. Fractional preview supersampling must not
change the camera rays or create a horizontal band of valid cloud pixels.

Walking remains a bounded 2.4 km patch. Seamless replacement of walking patches,
nine interlocking province variations per biome, full Shade walking environments,
the complex geometry benchmark and persistent Hero Zones remain in the
[Biome Pack programme](Observatory-Biome-Packs.md). This pass makes departure,
flight and arrival work together; it does not complete that streamed world.

## Verification

The numerical suite covers defaults and validation, monotonic automatic speed,
manual speed preservation, the reversible departure/approach curve, collision,
both takeoff states, and 27 catalogue/height combinations. A simulated chord
across the default cavity takes about 65 seconds, reaches maximum speed, and
ends in a walking arrival facing the new horizon.

Browser verification also checks that rectangle/freehand measurements survive
clock ticks, tool close/reopen, snapshot export, navigation and explicit Clear.

Browser verification exercises both takeoff chord orders, retained play status,
category highlighting, one-way off-centre pointer selection, consecutive return
history, auto/manual controls, and high and low atmosphere rendering. Existing
geometry, Watershed, walking and two-sided Shade collision checks remain required.

The loading browser check verifies zero image requests and no local geometry at
cold overview, a delayed selected image, cached return, failed-image retry,
explicit fallback, superseded arrivals, and restoration of only the saved
place's artwork. The pointer browser check traverses the actual mouse path to
the button, tests G at an off-centre point, invalidates pins after a drag, and
transports a marked Shade address through time. Numerical picking also checks
all six Wound spills and exits to the far shell, star and Shades, plus rays
through two empty openings and surviving exterior ground. The live button
route enters a spill, leaves through its aperture for the far wall, returns,
and visits a different Place with playback unchanged and old markers cleared.
Other picking checks retain ten biome targets, both faces of four Shade shapes,
local terrain and an approach to the selected side of the star.

Ascent checks sample 70 km through 70 million km and detect isolated opacity
spikes. Release checks separate local cloud coverage from distant weather,
compare fractional preview and export proportions, and inspect open Wounds.
The continuous browser check begins at Mycelium Sea ground level, lifts off
with Space + E, holds E across the centre, and ends on foot in Ultra Desert.
It records actual flight frames and a video with full local cloud coverage,
100% atmosphere and 1.5 stops exposure; no camera jumps advance the journey.
Auto and manual star crossings are also checked with the live keyboard path.

The weather depth check compares matched before/after cavity views and the same
physical patch from three distances. It verifies independent contributions from
all three layers, subtle clock evolution, frozen photographs and stable weather
across camera phase rebasing. The ascent, atmosphere release and complete flight
checks also run against the layered representation.
