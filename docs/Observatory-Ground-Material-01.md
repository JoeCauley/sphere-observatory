# Ground material correction 1

14 September 2026. Follow-up to the reported green/brown rim on snow, desert
and Machine Expanse walking patches.

## Cause and correction

The analytic shell and local geometry use separate GPU programs. Setting a
uniform on the shell does not initialize the equivalent geometry uniform.
`geometry-renderer.js` omitted `uBiomeOverride`, whose initial zero selected
the river-garden biome. A patch's centre used its explicit material ID, but
the geographic blend at the edge sampled that unrelated biome. Connected
terrain also uses the geographic material and was affected across its floor.

The geometry pass now sets the actual biome override (`-1` for geographic
selection), grid setting and shared collection settings each draw. Reusing
the collection upload also supplies the era, Wound enable flag and Wound
geometry used by surface material blending. It does not reuse the shell's
lighting: mesh illumination still uses its existing direct/fill inputs.

No texture files, terrain vertices, collision data, saved addresses or terrain
revisions are replaced. Reloading the app applies the corrected material
bindings to existing saved patches as well as connected terrain.

## Verification

`tests/ground-material-browser.cjs` renders Winter Hell, Ultra Desert,
Machine Expanse and The Ruin with both revision-1 patches and revision-2
connected ground. It replays the old unset uniform values for the before
images, then renders the correction at the identical camera with the same
geometry, texture bytes and lighting. These are controlled reproductions of
the bug, not reconstructed copies of the user's exact screenshots.

The test checks the actual linked mesh program's uniform values after
alternating explicit biome overrides, geographic selection, before/after
eras and Wound enable/disable. It retains before/after images, scene JSON and
graphics-error checks in `work/screenshots/ground-material/`. The final
run passes **8 cases and 24 state switches**, with zero graphics/page errors.
Visual inspection confirms removal of the unrelated border in the retained
snow, desert and machinery views. See the [verification receipt](evidence/ground-material-01/verification.json),
[full case report](evidence/ground-material-01/report.json),
[desert before](../examples/archive/pre-v1.5/docs/evidence/ground-material-01/2-r1-before.png) and
[desert after](../examples/archive/pre-v1.5/docs/evidence/ground-material-01/2-r1-after.png).
