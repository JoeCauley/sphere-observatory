# Shade boundary precision and material continuity

14 September 2026 · bounded follow-up to Continuity 3

The reported Shade edge obstruction takes priority over the joined
lake/reach/meadow work. This completes a correction to roadmap item 4, automatic
intact and damaged approaches, before expanding the Shade environments.

## Cause and change

The screenshot suggested a texture problem, but the large saw teeth were also
a coverage error. The primary ray intersection retained its small distance,
then reconstructed an AU-scale floating-point world position to decide whether
the Shade was solid. That reconstruction can lose kilometres near the camera.
The CPU footprint and structural edge therefore disagreed with the visible skin.
The older selected-strip precision path did not protect an unselected approach.

The renderer now uploads signed boundary residuals calculated in CPU double
precision about the camera address. Primary rays add only their small local
increments before testing the existing perimeter, trim, loss banks, fractures
and service holes. The silhouette sampler uses those same residuals. The local
path automatically follows the nearest parent within 10,000 km, bounds its UV
increment to 0.004 and retains the ordinary distant footprint outside that range.
It works across disk, square, spherical cap and trimmed cap, on either face.

There was a separate material discontinuity: repeated canvas reduction averaged
display-encoded artwork, and unresolved detail faded to an unrelated base colour.
The two Shade images now use a linear-radiance mip pyramid and fade to their
own measured linear mean. The means are available before image loading. Other
engineering layers retain their existing mip path. Texture-off mode retains its
simple material. Artwork addresses and source images are unchanged.

No geometry, collision, damage recipe, scene schema, clock policy or rendering
backend changed. The precision repair applies to modern scenes, including older
saved geometry revisions; it corrects rendering without changing their geometry.
No additional GPU textures, vertices or render passes were introduced. The mip
builder uses temporary CPU arrays while each of the two images is uploaded.

## Verification

The [verification record](evidence/shade-boundary-01/verification.json) contains
the final source hashes, test results and local artifact paths.

- The reproduced cap fracture changed from 25,087 CPU/GPU body-mask mismatches
  to zero across 294,912 sampled pixels. Of the original errors, 24,125 lay away
  from the actual boundary. This is a controlled reproduction of the failure
  class, not an exact reconstruction of the supplied screenshot's camera.
- A separate 41-scene matrix has zero mismatches across 944,640 pixels: all four
  shapes, both faces, intact perimeters, loss banks, both fracture directions and
  service holes. The comparison uses independent CPU tracing and rendered IDs.
- Real uploaded artwork passes mixed-object filtering, finite-difference
  footprints and linear-mean checks. The final mip differs from its source mean
  by at most 0.001581 in a linear channel, within 8-bit sRGB quantization.
- The numerical command passes 29 suites, including the new radiance reduction
  test. Existing automatic-edge browser coverage now runs with textures enabled.
- Four browser suites pass: boundary coverage, material filtering, eight textured
  automatic structural approaches, and both moving revision-1 deck contacts.
- The structural capture diagnostic renders a 3840 × 2160 photograph and a
  1920 × 960 six-face panorama with real artwork. The panorama repeats exactly;
  parent time changes the view and a saved-scene return repeats exactly.

Cold preparation remains slow on this Windows/ANGLE setup. These checks establish
the bounded edge and material correction, not general frame-rate improvements or
complete Shade-face environments. An early boundary-suite capture-repeat failure
did not recur in two isolated reruns; its strict comparison remains in the test.

**Cold 4K repeatability remains open.** The new capture diagnostic found 64,848
changed pixels out of 8,294,400, mostly one channel level, maximum 11. The same
fixture in a fresh browser using the unmodified `b80bd72` renderer also differs:
5,164 pixels, maximum 4. Direct GPU readback reproduces the issue; it is not just
PNG encoding. Later draws repeat exactly. The changed images differ in material
and edge coverage, so these counts do not isolate a performance or quality
regression. They establish that exact cold capture was not guaranteed by the
baseline and is not certified by this delivery.

`tools/inspect-shade-captures.cjs` records both images and decoded differences;
set `SPHERE_STRICT_CAPTURE=1` to make exact first/repeat equality a failing gate.
This is a diagnostic alongside the four passing browser suites, not a fifth
passing repeatability gate. No warm-up frame or relaxed pixel tolerance was
introduced into the renderer to conceal it. Cold capture deserves a separate
bounded follow-up.

## Continue

Refresh the local app to load the renderer changes, then revisit the reported
Shade approach with artwork enabled. The [saved fracture fixture](evidence/shade-boundary-01/fracture-scene.json)
also provides a repeatable skin-coverage view. Retain these boundary and capture tests
when extending either face. The next planned content item remains the joined
receiving lake, quiet reach and open meadow; finished Shade environments remain
roadmap item 8.
