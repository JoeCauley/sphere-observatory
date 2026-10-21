import json, pathlib, hashlib, subprocess
import imageio_ffmpeg

out=pathlib.Path(r'C:\Users\Joe\Documents\Codex\2026-10-05\he\outputs\meadow-p4')
data=json.loads((out/'evidence.json').read_text(encoding='utf-8'))
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
report={'method':'WebM container remux with -c copy; original compressed video packets and their timing are retained. Adds seekable container metadata. No pixels generated, interpolated, retimed or re-encoded. Original recordings remain in media and raw.','ffmpegVersion':subprocess.run([ffmpeg,'-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0],'files':[]}
for video in data['videos']:
 original=out/video['file'];dest=original.with_name(original.stem+'-view.webm')
 if dest.exists():raise RuntimeError('Fresh remux path required')
 command=[ffmpeg,'-nostdin','-loglevel','error','-i',str(original),'-map','0:v:0','-c','copy',str(dest)]
 subprocess.run(command,capture_output=True,text=True,check=True)
 row={'original':video['file'],'originalSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'view':dest.relative_to(out).as_posix(),'viewSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'command':command}
 report['files'].append(row);video['originalFile']=video['file'];video['originalSha256']=video['sha256'];video['file']=row['view'];video['sha256']=row['viewSha256'];video['containerRemux']=True
(out/'video-provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(out/'evidence.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
(out/'evidence-data.js').write_text('window.P4_EVIDENCE='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps({'videos':len(report['files']),'method':'packet-copy container remux'}))
