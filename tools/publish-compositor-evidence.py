import base64,hashlib,json,os,pathlib,subprocess,sys,zipfile
import cv2,imageio_ffmpeg,numpy as np
from PIL import Image,ImageDraw
root,out=map(pathlib.Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
def blob(p):
 b=p.read_bytes();payload=json.dumps({'encoding':'base64','content':base64.b64encode(b).decode()}).encode()
 g=json.loads(subprocess.run(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/git/blobs','--input','-'],input=payload,check=True,capture_output=True).stdout)['sha']
 assert g==hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();return g
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
demos=[]
for id,name in [('flight-outfall-industry','outfall-to-industry'),('meadow-outfall-service-door','meadow-service-door'),('walk-installed-main-6-sideways-city','marsh-to-city')]:
 src=next(root.rglob(id+'.mp4'));tr=json.loads(src.with_suffix('.json').read_bytes());q=json.loads((src.parent/'analysis'/(id+'.json')).read_bytes())
 assert not any(q[k] for k in ['failure','lostContext','glErrors','errors','oldHabitatRequests']),(id,q)
 t=np.array(tr['sourcePictures']);assert len(t)>8
 p=out/(name+'.mp4')
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(src),'-an','-vf','scale=854:-2:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','medium','-threads','2','-crf','26','-maxrate','700k','-bufsize','1200k','-movflags','+faststart',str(p)],check=True)
 cap=cv2.VideoCapture(str(p));n=0
 while cap.grab():n+=1
 cap.release();assert n==q['decodedFrames']
 review=src.parent/'analysis'/(id+'-sheet.jpg')
 cuts=src.parent/'analysis'/(id+'-cuts.jpg')
 entry=dict(sourceFilm=id,file=p.name,seconds=q['seconds'],decodedFrames=n,sha256=sha(p),bytes=p.stat().st_size,blob=blob(p),capture='compositor',edit='Full real-time repetition of the same route',sourcePictures=len(t),picturesPerSecond=round(len(t)/(tr['durationMs']/1000),2),p95PictureIntervalMs=int(np.percentile(np.diff(t),95)),cameraSamples=q['cameraSamples'],blackFrames=q['blackFrames'],candidateCuts=q['candidateCuts'],sourceSha256=sha(src),sheetBlob=blob(review))
 if cuts.exists():entry['cutsBlob']=blob(cuts)
 demos.append(entry)
report={'demos':demos,'captureCodeSha256':sha(pathlib.Path('tools/compositor-film.cjs'))}
data=out/'demo-records.json';data.write_text(json.dumps(report,indent=2)+'\n')
print('COMPOSITOR_DEMO_RECEIPT '+json.dumps({'summaryBlob':blob(data),'demos':[{k:d[k] for k in ['file','blob','sourcePictures','picturesPerSecond','sheetBlob']} for d in demos]}),flush=True)
with zipfile.ZipFile(out/'Compositor-Demo-Recordings.zip','w') as z:
 for p in root.rglob('*'):
  if p.is_file() and (p.suffix in ['.mp4','.jpg'] or p.suffix=='.json' and not p.name.startswith('plan-')):z.write(p,str(p.relative_to(root)),compress_type=zipfile.ZIP_STORED if p.suffix!='.json' else zipfile.ZIP_DEFLATED)
 z.write(data,data.name)
