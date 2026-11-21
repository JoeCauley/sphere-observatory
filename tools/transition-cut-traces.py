"""Locate every decoded cut in the original camera trace, including the preceding sample."""
import argparse
import bisect
import json
from pathlib import Path

def nearest_camera(movie_trace, review):
    frames=movie_trace['frames']
    times=[(f['ms']-frames[0]['ms'])/1000 for f in frames]
    def position(frame):
        pack=frame.get('local')
        return {'owner':frame['owner'],'mode':frame.get('mode'),
            'localM':[round(n,2) for n in pack[:3]] if pack else None,
            'mainAltitudeKm':round(frame['main'][0],4) if frame.get('main') else None,
            'nearOpacity':round(frame.get('nearOpacity',0),3),
            'stageOpacity':round(frame.get('stageOpacity',0),3),
            'direct':frame.get('direct'),'cloud':round(frame.get('cloud',0),3),
            'crossingStatus':bool(frame.get('crossingStatus'))}
    rows=[]
    for event in review['candidateCuts']:
        i=max(0,bisect.bisect_right(times,event['s'])-1)
        rows.append({'seconds':event['s'],'change':event['change'],'histogram':event['histogram'],
            'before':position(frames[max(0,i-1)]),'at':position(frames[i]),
            'after':position(frames[min(len(frames)-1,i+1)]),'cameraTimeErrorMs':round(1000*(event['s']-times[i]))})
    return rows

if __name__=='__main__':
    args=argparse.ArgumentParser()
    args.add_argument('root',type=Path)
    args.add_argument('output',type=Path)
    opts=args.parse_args()
    reports={}
    for p in sorted(opts.root.rglob('analysis/*.json')):
        movie=p.parent.parent/(p.stem+'.json')
        if movie.is_file():reports[p.stem]=nearest_camera(json.loads(movie.read_bytes()),json.loads(p.read_bytes()))
    opts.output.write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
