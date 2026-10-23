from pathlib import Path
import json,hashlib,re,subprocess,datetime
W=Path(__file__).parent.parent;H=W/'main-startup-draw-helper-2026-10-22-01'
repo=Path('I:/Sphere/repositories/sphere-observatory');backup=Path('I:/Sphere/checkpoints/observatory-main-joint80-2026-10-21')
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
manifest=read(backup/'manifest.json');verification=read(backup/'verification.json');prior=read(backup/'manifest-cutoff-08.json')
assert manifest['format']=='sphere-main-joint80-checkpoint/9' and verification['pass'] and verification['snapshots']==26
assert verification['archiveEntriesVerified']==13452 and verification['restorerUnchanged']
assert manifest['snapshots'][:len(prior['snapshots'])]==prior['snapshots'] and manifest['records'][:len(prior['records'])]==prior['records']
assert sha((backup/'materialize.py').read_bytes())=='5918ffddc55d9aea4ad2b570e47ebe2ca49b1d40b9df2c83936b4466e2c10eb3'
assert len(manifest['records'])==verification['recordsVerified']
author=W/'main-ordinary-bridge-work-2026-10-22-01';peer=W/'main-ordinary-bridge-work-review-2026-10-22-01'
assert sha((author/'CHECK.json').read_bytes())=='60aa0a234480b752531ab2f7046864e7b83f79182ae0bb2ed09b6c6dc08b0dd4'
assert sha((peer/'CHECK-02.json').read_bytes())=='b7db692e9fa94911ff6c774d6eff193ac9d58bb70d6a668d437a3dc12f76a1d1'
final=read(peer/'CHECK-02.json');assert final['historicalRecoveryComplete'] and final['sourceFilesStillExact']==521
record_count=0
for folder in [repo/'analysis/main-reuse-2026-10-22/startup-helper-02',repo/'analysis/main-reuse-2026-10-22/bridge-work-03']:
 for row in read(folder/'copied-record-pins-01.json'):
  b=(folder/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
  assert b==Path(row['source']).read_bytes();record_count+=1
 for p in folder.rglob('*.json'):read(p)
historical=read(H/'public-document-baseline-15.json')
for row in historical:
 before=subprocess.check_output(['git','show','0ac172e5ff7f9153f3d29867abe98ae3e7aee19d:'+row['path']],cwd=repo)
 assert len(before)==row['bytes'] and sha(before)==row['sha256']
 current=(repo/row['path']).read_bytes()
 if row['path']=='docs/Observatory-Main-Reuse-Progress-2026-10-21.md':assert current.startswith(before)
 elif row['path']!='docs/Observatory-Current-Work-Plan.md':assert current.endswith(before)
links=[]
for name in ['docs/Observatory-Main-Startup-2026-10-22.md','docs/Observatory-Current-Work-Plan.md']:
 p=repo/name
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf8')):
  if '://' in target or target.startswith('#'):continue
  assert (p.parent/target.split('#')[0]).is_file(),target
  links.append(dict(document=name,target=target))
changed=subprocess.check_output(['git','diff','--name-only'],cwd=repo,text=True).splitlines()
assert all(n=='README.md' or n.startswith('docs/') or n.startswith('analysis/') for n in changed)
result=dict(format='sphere-main-startup-safety-preservation/1',utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='PASS_CURRENT_STARTUP_COMPONENT_AND_PRESERVATION',privateCheckpoint=backup.as_posix(),manifestSha256=sha((backup/'manifest.json').read_bytes()),verification=verification,earlierSnapshotAndRecordRowsExact=True,publicCopiedRecordsVerified=record_count,historicalPublicBodiesExact=True,localReportLinksVerified=len(links),sourcePreservation=read(H/'source-preservation-after-20.json'),currentStartup=read(H/'main-startup-stage-candidate-04/combined-component-receipt-14.json'),currentBridgeReview=dict(author=sha((author/'CHECK.json').read_bytes()),independent=sha((peer/'CHECK-02.json').read_bytes()),historicalInputsRecovered=3,conditionalV7SchedulingObstruction=True,pricesSelected=False),deliveredWalk='UNCHANGED',independentSimulation='UNCHANGED',publicRuntimeSourceChanges=0,unrelatedPrivateAtlas='NOT_OPERATED',rawArchives='PRESERVED_LOCALLY',P05='OPEN',P06_P08='NOT_STARTED',PhaseOne='NOT_ACCEPTED_NOT_RELEASED',next='Exact-profile readiness/retention scheduling successor with fresh validity checks and independently qualified work partition; then remaining current-content/Main host integration and required native P05 proof.')
out=repo/'analysis/main-reuse-2026-10-22/safety-preservation-04.json';assert not out.exists();out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({k:v for k,v in result.items() if k not in {'sourcePreservation','currentStartup','verification'}}))
