"""Measure the visible roof edge during both handoffs in the standard clear-day flight."""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np


def left_roof_edge(frame):
    # On the standard heading this scanline crosses green land, then the blue-grey roof.
    blue, green, red = frame[int(frame.shape[0] * .76)].astype(np.int16).T
    mask = ((blue > green) & (blue > red + 4)).astype(np.uint8)[None, :]
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((1, 11), np.uint8))
    pixels = np.flatnonzero(mask[0])
    runs = np.split(pixels, np.where(np.diff(pixels) > 1)[0] + 1)
    roof = max(runs, key=len)
    if len(roof) < .2 * frame.shape[1]:
        raise ValueError('The roof edge is unidentifiable at the measurement row')
    return int(roof[0])


def measure_window(video, fps, second):
    first = math.floor((second - .35) * fps)
    last = math.floor((second + .35) * fps)
    video.set(cv2.CAP_PROP_POS_FRAMES, first)
    positions = []
    for n in range(first, last + 1):
        ok, image = video.read()
        if not ok:
            raise ValueError(f'Could not decode frame {n}')
        positions.append(left_roof_edge(image))
    moves = np.abs(np.diff(positions))
    index = int(np.argmax(moves))
    return {'stepPx': int(moves[index]), 'atSeconds': round((first + index + 1) / fps, 3),
            'fromPx': positions[index], 'toPx': positions[index + 1]}


def lower_horizon(video, fps, frames):
    # These low, upward sightlines stay clear of the roof on the recorded bearing.
    samples = []
    for height in (6000, 3600, 3000, 2600, 2300, 2000):
        f = min(frames, key=lambda f: abs(f['flight']['p']['altitudeM'] - height))
        video.set(cv2.CAP_PROP_POS_FRAMES, round(f['ms'] * fps / 1000))
        ok, image = video.read()
        if not ok:
            raise ValueError(f'Could not decode the horizon at {height} m')
        h, w = image.shape[:2]
        strip = image[round(h*.007):round(h*.028), round(w*.2):round(w*.78), ::-1]
        samples.append(np.median(strip, axis=(0, 1)).astype(int).tolist())
    return {'rgbAt6km': samples[0], 'rgbAt2km': samples[-1],
            'largestChannelRange': int(np.max(np.ptp(samples, axis=0)))}


def inspect(directory):
    stem = 'clear-day-border-round-trip'
    report = json.loads((directory / (stem + '.json')).read_text(encoding='utf8'))
    if report['failure'] or report['errors']:
        raise ValueError(f"Flight incomplete: {report['failure'] or report['errors']}")
    meta = report['result']['meta']
    if meta['seed'] != 713 or abs(math.degrees(meta['start']['pitch']) + 23) > .01:
        raise ValueError('This scanline is calibrated for the seed-713, 23-degree approach')
    frames = report['frames']
    inbound = next(f['ms'] for f in frames if f['flight']['owner'] == 'border-transport' and f['flight']['ready'])
    outbound = next(f['ms'] for f in frames if f['ms'] > inbound and f['flight']['owner'] == 'Main' and f['flight']['ready'])
    video = cv2.VideoCapture(str(directory / (stem + '.mp4')))
    try:
        if not video.isOpened():
            raise ValueError('Could not open the recorded flight')
        fps = video.get(cv2.CAP_PROP_FPS)
        edges = {name: measure_window(video, fps, time / 1000) for name, time in
                 [('inbound', inbound), ('outbound', outbound)]}
        landed = next(f['ms'] for f in frames if f['flight']['p'].get('mode') == 'walk')
        descending = [f for f in frames if inbound <= f['ms'] < landed and 'altitudeM' in f['flight']['p']]
        return edges, lower_horizon(video, fps, descending), report['width']
    finally:
        video.release()


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('directory', type=Path)
    result, horizon, width = inspect(cli.parse_args().directory)
    print(json.dumps({**result, 'lowerHorizon': horizon}, indent=2))
    # The matched flight moves a few pixels per frame even with a continuous lens.
    if any(edge['stepPx'] > .01 * width for edge in result.values()):
        raise SystemExit('The roof moved more than one percent of the frame width in one frame.')
    if horizon['largestChannelRange'] > 8:
        raise SystemExit('The clear lower horizon changed tint on a fixed bearing in fixed daylight.')
