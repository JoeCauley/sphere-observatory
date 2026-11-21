"""Assemble completed browser runs. The caller selects the directory and release tag."""
from collections import Counter
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

import cv2
import imageio_ffmpeg
from PIL import Image,ImageDraw

root=Path.cwd()
incoming=Path(sys.argv[1])
export=Path(sys.argv[2])
archive=export/'evidence'
media=export/'publication'
archive.mkdir(parents=True,exist_ok=True)
media.mkdir(parents=True,exist_ok=True)
(archive/'analysis').mkdir(exist_ok=True)
def read(p):return json.loads(p.read_bytes())
def write(p,obj):p.write_text(json.dumps(obj,indent=2,ensure_ascii=True)+'\n',encoding='utf-8')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git_blob(p):
    request=json.dumps({'content':base64.b64encode(p.read_bytes()).decode('ascii'),'encoding':'base64'}).encode()
    receipt=subprocess.run(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/git/blobs','--input','-'],input=request,capture_output=True,check=True)
    sha=json.loads(receipt.stdout)['sha']
    b=p.read_bytes()
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==sha
    return sha
def group(id):
    if id.startswith('walk-'):return id.split('-')[1]+' walks'
    if id.startswith('free-'):return 'manual flight'
    if id.startswith('flight-'):return 'guided flight'
    if id.startswith('outfall-'):return 'roof walk and liftoff'
    return 'Violet descent' if id.startswith('violet-') else 'Meadow service route'
films=[]; plans={}; browsers=set()
from importlib.util import spec_from_file_location,module_from_spec
cut_spec=spec_from_file_location('camera_cut_review',root/'tools/transition-cut-traces.py')
cut_module=module_from_spec(cut_spec);cut_spec.loader.exec_module(cut_module)
all_cuts={}
for directory in sorted(incoming.iterdir()):
    if not directory.is_dir():continue
    for f in directory.glob('plan-*.json'):
        d=read(f);plans[d['configuration']]={'worldSeed':d['worldSeed'],'bearingSeeds':d['circuitSeeds'],'completedLaps':len(d['laps']),'passages':sum(v['tunnels'] for v in d['laps']),'distinctDirectedPairs':len(d['pairs']),'worstClosureM':max(v['closureM'] for v in d['laps']),'pairs':d['pairs']}
        shutil.copy2(f,archive/f.name)
    if (directory/'flight-run.json').exists():browsers.add(read(directory/'flight-run.json')['browser'])
    for f in sorted((directory/'analysis').glob('*.json')):
        r=read(f);name=r['id'];movie=directory/(name+'.mp4');trace=read(directory/(name+'.json'))
        assert movie.is_file() and digest(movie)==r['sha256'],name
        assert not any(r[k] for k in ['failure','errors','glErrors','lostContext','oldHabitatRequests']),(name,r['failure'],r['errors'])
        assert r['decodedFrames']>0 and r['cameraSamples']>=3,(name,r['cameraSamples'])
        end=r['result'];frames=trace['frames'];extra={}
        pics=trace['sourcePictures'];assert len(pics)>=8 and all(b>=a for a,b in zip(pics,pics[1:])),name
        gaps=sorted(b-a for a,b in zip(pics,pics[1:]))
        extra.update(sourcePictures=len(pics),picturesPerSecond=round(len(pics)/(trace['durationMs']/1000),2),p95PictureIntervalMs=gaps[math.ceil(.95*len(gaps))-1])
        all_cuts[name]=cut_module.nearest_camera(trace,r)
        if name.startswith('walk-'):
            assert end['end']['walking'] and end['end']['slipM']<.5 and end['to']==end['end']['owner'],name
            assert end['end']['firstStepM']>.25,name
            extra['firstStepM']=end['end']['firstStepM'];extra['outletErrorM']=end['end']['slipM'];extra['from']=end['from'];extra['to']=end['to']
            lit=[s['direct'] for s in frames if s.get('owner')=='border-outfall' and s.get('local') and abs(s['local'][1]-1000043)<30 and s.get('direct') is not None]
            extra['portalDirect']=lit[-1] if lit else None
            extra['destinationDirect']=end['end']['exitDirect']
            if lit:assert abs(lit[-1]-extra['destinationDirect'])<.05,(name,lit[-1],extra)
        if name.startswith('flight-'):
            assert end['arrival']['status']=='arrived' and end['arrival']['to']!=end['arrival']['from'],name
            extra.update({k:end['arrival'][k] for k in ['to','from']})
        if name.startswith('free-'):
            assert 0<end['near']<1 and abs(end['held']['altitudeM']-end['still']['altitudeM'])<.05,name
            extra['hoverLocalOpacity']=end['near']
        if name.startswith('outfall-'):assert abs(end['roof']['altitudeM']-1401.7)<.1,name
        if name.startswith('violet-'):assert abs(end['eyeM']-1.7)<.005,name
        if name=='meadow-outfall-service-door':assert end['end']['pose']['mode']=='walk',name
        film={k:r[k] for k in ['id','seconds','sha256','bytes','decodedFrames','cameraSamples','captureGapP95Ms','blackFrames','flatFrames','maxDelta','longestSimilarSeconds','candidateCuts']}
        film.update(group=group(name),outcome='pass',fullScreenTransitSamples=sum(s['curtain'] and not s.get('crossingStatus') for s in frames),compactTransitSamples=sum(bool(s.get('crossingStatus')) for s in frames),**extra);films.append(film)
        for other in [movie,directory/(name+'.json')]:shutil.copy2(other,archive/other.name)
        for other in [f,*f.parent.glob(name+'-*.jpg')]:shutil.copy2(other,archive/'analysis'/other.name)
counts=dict(Counter(item['group'] for item in films))
assert len({f['id'] for f in films})==48 and counts=={'guided flight':12,'manual flight':4,'roof walk and liftoff':2,'Violet descent':1,'installed walks':22,'empty walks':4,'placed walks':2,'Meadow service route':1},counts
flights=[(f['from'],f['to']) for f in films if f['group']=='guided flight'];assert len(set(flights))==12
for key,value in plans.items():value['sampledFilms']=counts[key+' walks']
demos=[];refer={}
for source,name in [('flight-outfall-industry','outfall-to-industry'),('meadow-outfall-service-door','meadow-service-door'),('walk-installed-main-6-sideways-city','marsh-to-city')]:
    target=media/(name+'.mp4')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(archive/(source+'.mp4')),'-an','-vf','scale=854:-2:flags=lanczos,format=yuv420p','-c:v','libx264','-threads','2','-preset','medium','-crf','27','-maxrate','550k','-bufsize','900k','-movflags','+faststart',str(target)],check=True)
    cap=cv2.VideoCapture(str(target));n=0
    while cap.grab():n+=1
    cap.release();f=next(f for f in films if f['id']==source);assert n==f['decodedFrames']
    demos.append(dict(sourceFilm=source,file=target.name,seconds=f['seconds'],decodedFrames=n,sha256=digest(target),bytes=target.stat().st_size,capture='compositor',edit='Uncut downscale of the complete surveyed route',sourceSha256=f['sha256'],sourcePictures=f['sourcePictures'],picturesPerSecond=f['picturesPerSecond'],p95PictureIntervalMs=f['p95PictureIntervalMs'],cameraSamples=f['cameraSamples']))
    refer[target.name]=git_blob(target)
boards=[];review=sorted(films,key=lambda f:f['id'])
for begin in range(0,len(review),6):
    items=review[begin:begin+6];board=Image.new('RGB',(1460,3*395),(19,23,27));draw=ImageDraw.Draw(board)
    for i,entry in enumerate(items):
        x=(i%2)*730;y=(i//2)*395;draw.text((x+4,y+3),entry['id']+' | '+str(len(entry['candidateCuts']))+' candidate cuts',fill='white')
        id=entry['id'];im=Image.open(archive/'analysis'/(id+'-sheet.jpg'));im.thumbnail((414,360));board.paste(im,(x,y+23))
        ct=archive/'analysis'/(id+'-cuts.jpg')
        if ct.exists():
            im=Image.open(ct);im.thumbnail((310,360));board.paste(im,(x+417,y+23))
    b=archive/('review-'+str(begin//6+1)+'.jpg');board.save(b,quality=86);boards.append({'file':b.name,'blob':git_blob(b)})
totals={'routes':len(films),'seconds':round(sum(f['seconds'] for f in films),2),'frames':sum(f['decodedFrames'] for f in films),'samples':sum(f['cameraSamples'] for f in films),'blackFrames':sum(f['blackFrames'] for f in films),'candidateCuts':sum(len(f['candidateCuts']) for f in films),'maxSlipM':max(f.get('outletErrorM',0) for f in films),'portalLightComparisons':sum(f.get('portalDirect') is not None for f in films),'fullScreenTransitSamples':sum(f['fullScreenTransitSamples'] for f in films)}
a={'source':json.loads(subprocess.check_output(['node','tools/transition-source.cjs'])),'browser':sorted(browsers),'captureEnvironment':'GitHub-hosted macOS Chrome using ANGLE Metal on Apple Paravirtual graphics, separate from the Windows desktop campaign','plans':plans,'totals':totals,'demos':demos,'films':review}
totals['sourcePictures']=sum(f['sourcePictures'] for f in films)
totals['minimumFirstStepM']=min(f['firstStepM'] for f in films if 'firstStepM' in f)
totals['maximumFirstStepM']=max(f['firstStepM'] for f in films if 'firstStepM' in f)
a['demoCaptureSourceSha256']=digest(root/'tools/compositor-film.cjs')
a['captureMethod']='Chrome native compositor images and independent timestamped camera samples, presented on a 24 Hz timeline'
write(archive/'camera-cuts.json',all_cuts);refer['camera-cuts.json']=git_blob(archive/'camera-cuts.json')
write(archive/'audit.json',a);refer['audit.json']=git_blob(archive/'audit.json')
movie=export/'Sphere-Transition-Films.zip'
with zipfile.ZipFile(movie,'w') as z:
    for p in sorted(archive.rglob('*')):
        if p.is_file():z.write(p,str(p.relative_to(archive)),compress_type=zipfile.ZIP_STORED if p.suffix in ['.mp4','.jpg'] else zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(movie) as z:assert z.testzip() is None
result={'files':refer,'boards':boards,'totals':totals,'archiveSha256':digest(movie),'archiveBytes':movie.stat().st_size}
write(export/'receipt.json',result)
print('TRANSITION_AUDIT_RECEIPT '+json.dumps(result),flush=True)
