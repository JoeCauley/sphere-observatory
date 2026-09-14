"""Sequential video audit and time-labelled contact sheets. Requires cv2/Pillow."""
import cv2
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

source, directory, label = sys.argv[1:]
directory = Path(directory)
directory.mkdir(parents=True, exist_ok=True)
capture = cv2.VideoCapture(source)
frames, timestamps, hashes = [], [], set()
while True:
    okay, frame = capture.read()
    if not okay:
        break
    hashes.add(hashlib.sha256(frame.tobytes()).hexdigest())
    frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((320, 180)))
    timestamps.append(capture.get(cv2.CAP_PROP_POS_MSEC) / 1000)
capture.release()
if len(frames) < 30 or len(hashes) < 20:
    raise RuntimeError(f"Recording lacks motion: {len(frames)} frames, {len(hashes)} unique")
for sheet in range(2):
    canvas = Image.new('RGB', (1280, 816))
    draw = ImageDraw.Draw(canvas)
    for tile in range(16):
        index = min(len(frames)-1, int((sheet*16+tile+.5)/32*len(frames)))
        x, y = tile % 4 * 320, tile // 4 * 204
        canvas.paste(frames[index], (x, y))
        draw.text((x+6, y+184), f'{timestamps[index]:.2f} s | frame {index}', fill='white')
    canvas.save(directory / f'{label}-{sheet}.png')
report = {'source': source, 'frames': len(frames), 'uniqueDecodedFrames': len(hashes), 'lastTimestampSeconds': timestamps[-1]}
(directory / f'{label}-decode.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
