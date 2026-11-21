import base64,hashlib,json,os,pathlib,subprocess,sys
import cv2,imageio_ffmpeg
p=pathlib.Path(sys.argv[1])
src=p/'walk-installed-main-10-main-9.mp4'
report=json.loads((p/'analysis'/(src.stem+'.json')).read_bytes())
tr=json.loads(src.with_suffix('.json').read_bytes())
out=p/'into-violet-labyrinth.mp4'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(src),'-an','-vf','scale=854:-2:flags=lanczos,format=yuv420p','-c:v','libx264','-threads','2','-preset','medium','-crf','26','-maxrate','700k','-bufsize','1200k','-movflags','+faststart',str(out)],check=True)
cap=cv2.VideoCapture(str(out));n=0
while cap.grab():n+=1
cap.release();assert n==report['decodedFrames']
b=out.read_bytes();req=json.dumps({'encoding':'base64','content':base64.b64encode(b).decode()}).encode()
blob=json.loads(subprocess.run(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/git/blobs','--input','-'],input=req,capture_output=True,check=True).stdout)['sha']
assert blob==hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
times=tr['sourcePictures'];g=sorted(b-a for a,b in zip(times,times[1:]));from math import ceil
data=dict(file=out.name,sourceFilm=src.stem,seconds=report['seconds'],decodedFrames=n,sourceSha256=report['sha256'],sha256=hashlib.sha256(b).hexdigest(),blob=blob,bytes=len(b),sourcePictures=len(times),picturesPerSecond=round(len(times)/(tr['durationMs']/1000),2),p95PictureIntervalMs=g[ceil(.95*len(g))-1],cameraSamples=report['cameraSamples'],capture='compositor',edit='Uncut downscale of the complete surveyed route')
print('VIOLET_DEMO '+json.dumps(data),flush=True)
