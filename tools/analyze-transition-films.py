"""Decode every frame of every MP4, join it to the recorded camera trace and build review sheets."""
import argparse
import bisect
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

cv2.setNumThreads(1)
def frame_delta(a,b):
    return float(np.abs(a.astype(np.int16)-b).mean()/255)

def review(movie,out):
    receipt=json.loads(movie.with_suffix('.json').read_text(encoding='utf8'))
    sample=receipt['frames']
    ts=[(s['ms']-sample[0]['ms'])/1000 for s in sample]
    cap=cv2.VideoCapture(str(movie))
    if not cap.isOpened():raise ValueError('Cannot decode '+movie.name)
    fps=cap.get(cv2.CAP_PROP_FPS)
    count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    shot_set=set(np.linspace(0,max(0,count-1),12).astype(int))
    shots=[];previous=None;previous_hist=None;previous_thumb=None
    changes=[];events=[];worst=[];black=[];flat=[];longest=hold_start=0
    moving_hold=0; last_camera=None; held_motion=0; n=0
    while True:
        ok,frame=cap.read()
        if not ok:break
        sec=n/fps;idx=max(0,bisect.bisect_right(ts,sec)-1);camera=sample[idx]
        viewed=camera['owner']; local=camera.get('local')
        pos=local[:3] if local and (camera.get('stageOpacity') or 0)>.5 else (camera.get('main') or [])[1:4]
        pos=(viewed,tuple(pos)) if pos else None
        h,w=frame.shape[:2]
        # Measure the world image away from the fixed side controls and telemetry.
        crop=frame[int(.22*h):int(.80*h),int(.34*w):int(.94*w)]
        thumb=cv2.resize(crop,(128,72),interpolation=cv2.INTER_AREA)
        gray=cv2.cvtColor(thumb,cv2.COLOR_BGR2GRAY);mean=float(gray.mean())
        if mean<4 and float(gray.std())<3:black.append(round(sec,2))
        if float(gray.std())<4:flat.append(round(sec,2))
        hist=cv2.calcHist([gray],[0],None,[32],[0,256]);cv2.normalize(hist,hist,1,0,cv2.NORM_L1)
        if n in shot_set:shots.append((sec,frame.copy(),viewed))
        if previous is not None:
            change=frame_delta(thumb,previous)
            dist=cv2.compareHist(hist,previous_hist,cv2.HISTCMP_BHATTACHARYYA)
            changes.append(change)
            if change<.002:
                longest=max(longest,(n-hold_start)/fps)
                if pos and last_camera and pos!=last_camera:held_motion+=1
                if held_motion>1:moving_hold=max(moving_hold,(n-hold_start)/fps)
            else:hold_start=n;held_motion=0
            if change>=.15 and dist>=.32:
                events.append({'s':round(sec,2),'change':round(change,3),'histogram':round(dist,3),
                   'owner':viewed,'curtain':camera.get('curtain'),'cloud':round(camera.get('cloud') or 0,2)})
                if len(worst)<4 or change>worst[-1][0]:
                    worst.append((change,sec,previous_thumb.copy(),cv2.resize(frame,(300,178)),viewed))
                    worst.sort(key=lambda x:-x[0]);worst=worst[:4]
        previous=thumb;previous_hist=hist;previous_thumb=cv2.resize(frame,(300,178));last_camera=pos;n+=1
    cap.release()
    if not n or abs(n/fps-receipt['durationMs']/1000)>.55:raise ValueError('Video duration disagrees with trace: '+movie.name)
    errors=set(receipt.get('errors',[]))|{f['inspectError'] for f in sample if f.get('inspectError')}
    status={'id':movie.stem,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'bytes':movie.stat().st_size,
      'decodedFrames':n,'fps':fps,'seconds':round(n/fps,2),'cameraSamples':len(sample),
      'captureGapP95Ms':int(np.percentile(np.diff(ts)*1000,95)) if len(ts)>1 else 0,
      'maxCaptureGapMs':round(float(np.max(np.diff(ts)))*1000) if len(ts)>1 else 0,
      'blackFrames':len(black),'flatFrames':len(flat),'longestSimilarSeconds':round(longest,2),
      'similarWhileMovingSeconds':round(moving_hold,2),'maxDelta':round(max(changes,default=0),3),
      'candidateCuts':events,'lostContext':any(f.get('glLost') for f in sample),
      'glErrors':sorted({f['error'] for f in sample if f.get('error')}),'errors':sorted(errors),
      'oldHabitatRequests':[p for p in receipt['requests'] if p.startswith('/assets/biomes/')],
      'failure':receipt.get('failure'),'result':receipt.get('result'),
      'curtainSamples':sum(bool(s.get('curtain')) for s in sample),'owners':sorted({s['owner'] for s in sample})}
    if shots:
        canvas=Image.new('RGB',(1000,4*162),(22,24,28));draw=ImageDraw.Draw(canvas)
        for i,(t,f,owner) in enumerate(shots):
            x=i%3*333;y=i//3*162
            image=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));image.thumbnail((330,139))
            canvas.paste(image,(x,y));draw.text((x+4,y+142),f'{t:.1f} s  {owner}',fill='white')
        canvas.save(out/(movie.stem+'-sheet.jpg'),quality=84)
    if worst:
        pairs=Image.new('RGB',(600,len(worst)*199),(22,24,28));d=ImageDraw.Draw(pairs)
        for i,(delta,t,a,b,owner) in enumerate(worst):
            for j,f in enumerate((a,b)):pairs.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)),(j*300,i*199))
            d.text((4,i*199+179),f'{t:.2f} s   delta {delta:.2f}   {owner}',fill='white')
        pairs.save(out/(movie.stem+'-cuts.jpg'),quality=84)
    return status

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('--only',default='*.mp4');args=parser.parse_args()
    out=args.directory/'analysis';out.mkdir(exist_ok=True)
    for movie in sorted(args.directory.glob(args.only)):
        receipt=movie.with_suffix('.json');saved=out/(movie.stem+'.json')
        if not receipt.exists():continue
        if saved.exists() and saved.stat().st_mtime>=max(movie.stat().st_mtime,receipt.stat().st_mtime,Path(__file__).stat().st_mtime):continue
        r=review(movie,out);saved.write_text(json.dumps(r,indent=2)+'\n',encoding='utf8')
        print(r['id'],r['decodedFrames'],'frames',len(r['candidateCuts']),'cuts',r['blackFrames'],'black',r['errors'],r['failure'],flush=True)
