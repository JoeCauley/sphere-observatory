"""Measure linear-sRGB mean albedo. Reads originals; never edits source artwork."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
biomes = ['dark-age-forest','super-jungle','ultra-desert','winter-hell','ruined-shell','machine-expanse','rust-marsh','chalk-archipelago','mycelium-sea','violet-labyrinth']
engineering = ['thermal-fields','circulation-fields','fabrication-fields','shade-sunward','shade-shellward']
paths = [root/'assets/biomes/hero'/f'{name}.png' for name in biomes] + [root/'assets/engineering'/f'{name}.png' for name in engineering]
lut = [(v/255/12.92 if v/255 <= .04045 else ((v/255+.055)/1.055)**2.4) for v in range(256)]
palette = []
for path in paths:
    image = Image.open(path).convert('RGB')
    h = image.histogram()
    palette.append([round(sum(h[c*256+v]*lut[v] for v in range(256))/(image.width*image.height),6) for c in range(3)])
palette.append(palette[14])
(root/'world-palette.js').write_text('/* Measured linear-sRGB means of the original albedo artwork. */\n(typeof window === "undefined" ? globalThis : window).SpherePalette = '+json.dumps(palette)+';\n')
print('Measured',len(paths),'original images; wrote world-palette.js')
