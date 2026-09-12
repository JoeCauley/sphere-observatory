# Wound-edge artwork

Ten original biome-specific shattered-shell ground albedos, generated with the built-in image-generation tool on 11 September 2026. The native outputs are **1254 × 1254 PNGs**. The prompt requested 2048 square; the delivered native resolution is retained without artificial enlargement.

| Biome | Edge character |
|---|---|
| Dark Age Forest | Broken roots, logs, dark soil and subdued moss among fractured foundations |
| Super Jungle | Crushed tropical growth and roots around collapsed terraces |
| Ultra Desert | Sand drifts, dust, black foundation plates and exposed service channels |
| Winter Hell | Ice-split plates, blue-grey ice debris and windpacked snow |
| The Ruin | Barren ash, broken districts and conduits, without green patches |
| Machine Expanse | Steel, ceramic fragments, severed copper and wrecked machinery |
| Rustwater Marsh | Drained rusty channels, peat and mineral staining |
| Chalk Archipelago | Broken chalk, porous limestone and turquoise mineral deposits |
| Mycelium Sea | Torn cyan-teal fungal crowns and pale networks on grey ruined construction |
| Violet Labyrinth | Shattered amethyst maze fragments, mineral dust and broken foundations |

Each biome has its own image and composition. These are not recolours of the old Ruin map. The final fungal image was revised using the intact Mycelium Sea image as a colour and biology reference. Original generation outputs remain in the generated-image archive.

The renderer places these materials on surviving ground next to Wounds. Damage rises smoothly across a **240 km** band, from the original biome at its inland limit to the corresponding edge image at the lip. The world fixes the damage location; camera distance changes only the level of visible texture detail. The upper **40 m** of the exposed wall blends into the matching deposit; deeper construction retains its structural material.

Texture sampling uses a **640 m** domain, stochastic overlapping patches, triplanar projection, anisotropic filtering and linear-light mipmaps. The artwork suggests local structure; individual drawn objects are not surveyed geometry. The source prompt's 2.5 km description is superseded by this renderer scale, chosen for the local inspection views. Terrain displacement, tree collision and new debris meshes are not encoded by these albedos.

The array occupies about **80 MiB** once allocated. Normal preview decodes adjoining biome images as needed; all ten array layers are reserved together. Close export prepares every layer for deterministic capture. The ten source PNGs total roughly 35 MiB on disk.

[manifest.json](manifest.json) records every final path, original source, prompt, dimensions, SHA-256, measured linear colour and a green-pixel diagnostic. `tools/import-wound-art.cjs` measures the original images and updates the shared CPU/GPU mean colours without editing any PNG.
