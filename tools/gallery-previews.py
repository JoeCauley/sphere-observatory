"""Make lightweight GitHub display copies; keep native 4K PNGs untouched."""
from pathlib import Path
from PIL import Image

gallery = Path(__file__).resolve().parents[1] / 'examples' / 'observatory'
for source in sorted(gallery.glob('*.png')):
    with Image.open(source) as image:
        image = image.convert('RGB')
        image.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
        image.save(source.with_suffix('.jpg'), quality=90, optimize=True, progressive=True)
    print(source.with_suffix('.jpg').name)
