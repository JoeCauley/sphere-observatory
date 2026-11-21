"""Compare the exit pictures in the two recorded, seeded walks at matched elapsed action time."""
import base64,hashlib,json,os,pathlib,subprocess,sys,zipfile
import cv2
from PIL import Image,ImageDraw
root=pathlib.Path(sys.argv[1]);rows=[]
ids=[('walk-installed-main-11-main-4','Ruin'),('walk-installed-main-10-main-9','Violet Labyrinth')]
board=Image.new('RGB',(1120,570),(24,28,33));draw=ImageDraw.Draw(board)
for r,(name,label) in enumerate(ids):
    for col,phase in enumerate(['before','after']):
        with zipfile.ZipFile(root/phase/'Sphere-Transition-Films.zip') as archive:
            movie=pathlib.Path(archive.extract(name+'.mp4',root/phase))
            report=json.loads(archive.read('analysis/'+name+'.json'))
            streamed=json.loads(archive.read(name+'.json'))
        capture=cv2.VideoCapture(str(movie));seconds=max(0,report['seconds']-.85)
        capture.set(cv2.CAP_PROP_POS_MSEC,seconds*1000);ok,frame=capture.read();capture.release()
        if not ok:raise RuntimeError((name,phase,seconds))
        im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));w,h=im.size
        im=im.crop((int(.015*w),int(.10*h),int(.985*w),int(.88*h)))
        im.thumbnail((548,252));x=col*560;y=r*285
        board.paste(im,(x+(560-im.width)//2,y+25));draw.text((x+8,y+6),label+'  |  '+('Before' if col==0 else 'Corrected ground contact'),fill=(245,248,252))
        rows.append(dict(route=name,phase=phase,seconds=round(seconds,2),filmSha256=report['sha256'],eyeM=streamed['result']['end'].get('eyeAboveFloorM')))
out=root/'outlet-before-after.jpg';board.save(out,quality=89)
b=out.read_bytes();req=json.dumps({'encoding':'base64','content':base64.b64encode(b).decode()}).encode()
sha=json.loads(subprocess.run(['gh','api','repos/'+os.environ['GITHUB_REPOSITORY']+'/git/blobs','--input','-'],input=req,capture_output=True,check=True).stdout)['sha']
assert sha==hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
print('OUTLET_COMPARISON '+json.dumps(dict(blob=sha,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),frames=rows)),flush=True)
