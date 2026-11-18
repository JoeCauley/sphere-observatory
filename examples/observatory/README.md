# Photographs from Observatory v1.6

**Nineteen new 3840 × 2160 photographs and three interface screenshots**, captured from the running app. Every photograph has a fresh composition and an importable scene. The PNGs are untouched renderer output; JPEGs are smaller display copies.

To return to a photograph, download its scene JSON and open **Journey → Saved viewpoints & scene files → Import scene**. Camera, world, time, seed, place identity, build and rendering settings travel with the file. Later renderer, GPU or browser changes may affect exact reproduction.

### The Sphere from the polar court

![The Sphere from the polar court](hero.jpg)

A new framing of the polar court beneath the habitat waist, moving Shades and Wounds. The scene begins from the project’s reference staging and is freshly composed in the current renderer.

[Original 4K PNG](hero.png) · [Restore scene](hero.json)

### On foot in Dark Age Forest

![On foot in Dark Age Forest](forest-ground.jpg)

A settled walking viewpoint in Dark Age Forest. Connected terrain shares the surrounding geographic material; the enormous interior remains visible above the local horizon.

[Original 4K PNG](forest-ground.png) · [Restore scene](forest-ground.json)

### Walking beside the opening

![Walking beside the opening](wound-ground.jpg)

On foot beside a Wound in Chalk Archipelago. Surviving ground meets the opening; terrain and collision support are absent from the void.

[Original 4K PNG](wound-ground.png) · [Restore scene](wound-ground.json)

### Ultra Desert

![Ultra Desert](ultra-desert.jpg)

A low aerial view over warm desert materials and sparse formations. This is an implemented field site, not a fully authored desert ecosystem.

[Original 4K PNG](ultra-desert.png) · [Restore scene](ultra-desert.json)

### Winter Hell

![Winter Hell](winter-hell.jpg)

Pale ice terrain and scattered local formations below the distant shell. The camera uses the same relative altitude and lens family as the desert view.

[Original 4K PNG](winter-hell.png) · [Restore scene](winter-hell.json)

## Watersheds at six scales

Explore → Watersheds → Watershed · the river gardens offers these six views and a separate On foot arrival. Heights are above the shell for regional views, above the garden landscape for the 1 km view, and above the floor for the terrace.

### Connected catchments · 40,000 km

![Connected catchments · 40,000 km](watershed-40000.jpg)

The connected neighbourhood at the 40,000 km arrival, showing regional catchments around the original province.

[Original 4K PNG](watershed-40000.png) · [Restore scene](watershed-40000.json)

### Receiving reaches · 10,000 km

![Receiving reaches · 10,000 km](watershed-10000.jpg)

Receiving country at the 10,000 km arrival, where regional drainage meets the wider neighbourhood.

[Original 4K PNG](watershed-10000.png) · [Restore scene](watershed-10000.json)

### The province · 1,100 km

![The province · 1,100 km](watershed-1100.jpg)

The 640 km river-garden province at the 1,100 km arrival. Geography and art revisions are stored with the scene.

[Original 4K PNG](watershed-1100.png) · [Restore scene](watershed-1100.json)

### River country · 48 km

![River country · 48 km](watershed-48.jpg)

An approach to river country at 48 km. Water is a designed rendered surface, not a fluid simulation.

[Original 4K PNG](watershed-48.png) · [Restore scene](watershed-48.json)

### The water garden · 1 km

![The water garden · 1 km](watershed-1.jpg)

One kilometre above the garden landscape: curved terraces, an island court, planting and the nearby river.

[Original 4K PNG](watershed-1.png) · [Restore scene](watershed-1.json)

### The open terrace · 6 m above its floor

![The open terrace · 6 m above its floor](terrace.jpg)

A view six metres above the terrace floor. Builder architecture frames the sky of the interior at a more familiar scale.

[Original 4K PNG](terrace.png) · [Restore scene](terrace.json)

## Regional compositions

### The receiving lake

![The receiving lake](lake.jpg)

The receiving lake in its regional composition. Use Explore → Watersheds for the dry-bank arrival or regional view.

[Original 4K PNG](lake.png) · [Restore scene](lake.json)

### The quiet reach

![The quiet reach](reach.jpg)

The quiet reach and its banks within the connected neighbourhood. Detailed shore environments remain future work.

[Original 4K PNG](reach.png) · [Restore scene](reach.json)

### The open meadow

![The open meadow](meadow.jpg)

The open meadow in its regional composition, retaining the same saved geographic address as its arrival.

[Original 4K PNG](meadow.png) · [Restore scene](meadow.json)

## Engineering, light and weather

### The finished Shade perimeter

![The finished Shade perimeter](shade-intact.jpg)

Layered panels and vertical members along Shade 4’s intact perimeter. The body’s two faces are 180 m apart.

[Original 4K PNG](shade-intact.png) · [Restore scene](shade-intact.json)

### The broken Shade edge

![The broken Shade edge](shade-broken.jpg)

Recessed layers and exposed braces follow a broken boundary on Shade 0. The simulation is paused for the photograph.

[Original 4K PNG](shade-broken.png) · [Restore scene](shade-broken.json)

### At the edge of a world

![At the edge of a world](wound.jpg)

An oblique inspection of the exposed shell wall with surviving surface and clouds above. Shell thickness and structural dimensions are provisional.

[Original 4K PNG](wound.png) · [Restore scene](wound.json)

### The stellar conservatory

![The stellar conservatory](interior.jpg)

The Sun-sized star and damaged service rings. The exposure is an artistic display choice, not calibrated photometry.

[Original 4K PNG](interior.png) · [Restore scene](interior.json)

### Above the Super Jungle

![Above the Super Jungle](clouds.jpg)

Nine kilometres above Super Jungle, with local cloud banks and the far interior beyond. Weather and atmospheric transport are approximate.

[Original 4K PNG](clouds.png) · [Restore scene](clouds.json)

## The interface in use

These 1600 × 1000 screenshots were taken after journeys made through the app’s visible controls. They show the actual interface, including its persistent location and clock.

### Explore · a prepared forest arrival

![Explore · a prepared forest arrival](interface-explore.jpg)

[Original screenshot](interface-explore.png)

### Journey · places already visited

![Journey · places already visited](interface-journey.jpg)

[Original screenshot](interface-journey.png)

### Capture · a named 4K photograph

![Capture · a named 4K photograph](interface-capture.jpg)

[Original screenshot](interface-capture.png)

## Capture and provenance

[Gallery metadata](gallery.json) records the source fingerprint, GPU, every PNG hash and all adjacent-frame comparisons. All 19 photographs finished with two identical prepared frames, with no WebGL or page errors. Earlier nonmatching pairs occurred in ultra-desert, clouds; those comparisons are retained. This is evidence for these prepared photographs, not a solution to the separately documented cold-capture diagnostic.

[Interface metadata](interface.json) records the three UI screenshots. No picture was externally retouched, composited or replaced with generated imagery. Some material artwork used inside the app was created with AI assistance.

The [v1.5 gallery](../archive/v1.5/README.md) preserves the previous photographs and saved scenes. Its archive manifest verifies the original image bytes. [Older photographs and studies](../archive/README.md) remain available too.

With the server running, configure Playwright, `SPHERE_BROWSER` and `SPHERE_URL` as described in the [project README](../../README.md). Recreate compositions and captures sequentially:

```sh
node tools/compose-gallery.cjs
node tools/capture-gallery.cjs
node tools/capture-interface.cjs
python tools/gallery-previews.py
node tools/verify-gallery.cjs
```

The preview helper needs Pillow. Capture selected photographs with IDs, for example `node tools/capture-gallery.cjs hero shade-broken`. `SPHERE_PROFILE` optionally selects an isolated persistent browser profile for warm shader caching. The composition helper intentionally replaces the current gallery scenes.
