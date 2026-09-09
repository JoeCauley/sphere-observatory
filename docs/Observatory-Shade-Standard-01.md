# Observatory shade standard 01

8 September 2026 · v0.4 implemented study

This extends Collection Study 01. Layout dimensions remain provisional. The changes affect the WebGL prototype in web-observatory, not the Unreal project.

## Motion and noncollision

Individual shade circuits take 192, 216 and 240 hours: eight, nine and ten days. Successive shades pass a point every 24, 36 or 60 hours. At the default speed the complete labelled fleet returns to its initial configuration after 8,640 hours, or 360 days. The intact arrangement of indistinguishable shades can repeat sooner. Cycle-duration control scales all these times together.

The motion is prescribed and maintained; there is no gravitational orbit integration. The clearance proof uses geometry bounds that apply at every phase, rather than sampling a few animation frames.

For centre radius r, number of shades N and planar half-size a = r tan(pi / (2N)), a square is contained within a ball of radius sqrt(2) a about its centre. Circular disks have a smaller bound. Spherical caps of angular radius pi / (2N) fit within that bound too. Adjacent shade-centre separation is 2r sin(pi/N); it exceeds twice the bounding radius on every route.

The largest square's radial envelope extends from r to sqrt(r² + 2a²). Each route's outer limit is below the next route's inner limit. The outermost limit is below the inhabited shell.

| Route | Largest outer extent / shell radius | Conservative same-route clearance at 1 AU |
|---|---:|---:|
| Verdant | 0.644064 | 18.806 million km |
| Opaline | 0.791348 | 26.804 million km |
| Amber | 0.996690 | 31.217 million km |

This establishes nonintersection of the current thin shapes for all route phases. It does not guarantee clearance for future drifting fragments, new structural thickness, changed route dimensions or an enlarged stellar installation. Removed pieces currently remain subsets of those moving surfaces. The current default stellar installation also lies well inside the innermost route.

## Three implementations of one shade family

- **Circular plane:** the existing planar disk footprint.
- **Square plane:** the same half-size along two tangent axes. Corners add shadow coverage and surface area; this is not an equal-area comparison.
- **Curved sphere section:** a true spherical cap concentric with the star, at the route radius. Its angular footprint as seen from the star matches the circular plane. Both sphere roots are checked so either side of a cap can be seen.

Shapes share route centres, object identities, material vocabulary and damage pattern parameters. The selector is in Layout & light. It persists in scene records and bookmarks; older records default to circular planes. Geometry, HUD, finite-star visibility, and area exclusion all use the selected shape.

## Construction texture

The previous implementation put a fixed count of grid squares on every shade. That stretched physical module sizes with shade diameter and was unsuitable as a scale cue.

The replacement defines pitches in kilometres across the entire fleet:

| Layer | Pitch | Appearance |
|---|---:|---|
| Main structural divisions | 1,000,000 km | Restrained warm ribs |
| Service divisions | 100,000 km | Low-contrast transverse seams |
| Skin subdivision | 1,000 km | Fine material modulation |

These are speculative aggregation scales, not validated engineering spans or individual solid beams. The hierarchy is a common visual construction vocabulary for enormous assemblies. Planar coordinates are distances along shade-fixed tangent axes. Caps use longitude and latitude arc coordinates multiplied by physical radius; longitude spacing has the expected latitude contraction away from the cap centre, rather than uniform geodesic-square spacing everywhere.

The projected pixel footprint filters each layer. Unresolvable ribs approach their average contribution instead of remaining one-pixel lines. No layer is rescaled to retain a fixed square count on the disk. Apparent scale still depends on distance, perspective and surface angle, as it should. Near-surface centimetre precision is not a claim of this shader.

## Shade-on-shade shadows

Sun-facing shade surfaces now query direct stellar visibility, excluding their own receiver index. Other shades and the stellar structure can block them. Curved caps use the local radial normal; planar shades use their plane normal and the appropriate incidence cosine. Shadowed regions retain the existing approximate cavity fill.

Seven shared samples of the finite stellar disk are tested. Occlusion is the union of blocked samples across casters, not the product of separate partial-visibility fractions. Broad geometric bounds skip irrelevant casters. The same implementation also updates direct shell illumination. Seven samples are a preview approximation: penumbrae can show discrete steps and this is not converged cinematic transport.

The stellar angular slope is calculated algebraically as starRadius / sqrt(distance² - starRadius²), avoiding small-angle inverse-trigonometric error observed on the GPU during testing. The CPU reference independently uses the angular construction.

Reflected light remains the earlier 192-sample macro-albedo approximation. It does not solve shade-to-shade indirect reflection or shadowing of that reflected light. No thermal emission or heat balance is added.

## Verification

- Conservative all-phase clearance bounds pass for all three shapes.
- Shape-specific tests cover square corners, cap intersections, known fully eclipsed and clear intervals, serialization and invalid shape rejection.
- GPU/CPU object classification agrees across 92,160 rays, three shapes, four views and both eras.
- Independent stellar-visibility comparison covers 10,632 sun-facing shade probes: fully lit, eclipsed and penumbral cases agree within 8-bit output quantization. No boundary exception was required.
- Original geometry, area, and collection tests remain passing.

The new **A shade eclipsed · intact fleet** viewpoint sets an intact scene at eight simulated hours and provides a repeatable visual test. Play from there to watch illumination evolve. The shape selector preserves the viewpoint and time.
