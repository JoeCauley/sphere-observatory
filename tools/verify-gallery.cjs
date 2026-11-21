// Dependency-free publication checks; usable locally and in GitHub Actions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'examples/observatory'),archive=path.join(root,'examples/archive/v1.5');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const shots=read(path.join(dir,'shots.json')),gallery=read(path.join(dir,'gallery.json')),ui=read(path.join(dir,'interface.json')),version='1.6.0';
assert.equal(shots.length,19);assert.equal(gallery.version,version);assert.equal(gallery.shots.length,shots.length);assert.deepEqual(gallery.errors,[]);
// The September guide is a preserved edition. Verify its original renderer in a full clone.
const release='e939312a3e367a5f74186b478a50a078d6d53376';
const {spawnSync}=require('node:child_process');
assert.equal(gallery.sourceContentSha256,'6ca1d61609c8f06dbbeef824db5cb87b0873bbf250b0c8d5f9b1a3a8da203938');
if(spawnSync('git',['cat-file','-e',release],{cwd:root}).status===0){
 const hash=crypto.createHash('sha256');
 for(const file of gallery.sourceFiles){
  const original=spawnSync('git',['show',release+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(original.status,0,file);hash.update(file+'\0').update(original.stdout.replace(/\r\n/g,'\n'));
 }
 assert.equal(hash.digest('hex'),gallery.sourceContentSha256);
}
for(const [id,title]of shots){
 const image=fs.readFileSync(path.join(dir,id+'.png')),record=gallery.shots.find(x=>x.id===id),scene=read(path.join(dir,id+'.json'));
 assert(record&&record.warmMatches&&record.error===0);assert.equal(record.sha256,sha(image));assert.equal(image.readUInt32BE(16),3840);assert.equal(image.readUInt32BE(20),2160);assert.equal(scene.build.version,version);assert.equal(scene.state.playing,false);assert(!title.includes('Â'));
 assert(fs.statSync(path.join(dir,id+'.jpg')).size>0);
 const old=path.join(archive,id+'.png');if(fs.existsSync(old))assert.notEqual(sha(fs.readFileSync(old)),record.sha256,'Every current photograph has a fresh composition: '+id);
}
assert.equal(ui.shots.length,3);assert.equal(ui.build.version,version);assert.deepEqual(ui.errors,[]);
for(const shot of ui.shots){assert.equal(sha(fs.readFileSync(path.join(dir,shot.file))),shot.sha256);assert(fs.existsSync(path.join(dir,shot.id+'.jpg')));}
const manifest=read(path.join(archive,'archive-manifest.json'));
for(const [file,expected]of Object.entries(manifest.canonicalFiles)){let bytes=fs.readFileSync(path.join(archive,file));if(/\.(json|md)$/.test(file))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));assert.equal(sha(bytes),expected,'Archive changed: '+file);if(/\.(png|jpg)$/.test(file))assert.equal(sha(bytes),manifest.files[file]);}
for(const file of ['README.md','examples/observatory/README.md','docs/releases/v1.6.0.md']){const markdown=fs.readFileSync(path.join(root,file),'utf8');for(const [,target]of markdown.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(target))continue;const destination=path.resolve(root,path.dirname(file),target.split('#')[0]);assert(fs.existsSync(destination),file+' has missing link '+target);}}
const biomeDir=path.join(root,'examples/biomes'),photos=read(path.join(biomeDir,'captures.json'));
const {sourceFingerprint}=require('./biome-gallery-source.cjs');
const revision = photos.metadataRevision;
if (revision) assert.equal(revision.captureSha256, photos.source.sha256, 'The metadata revision must identify its original capture');
const captureRelease=revision?.captureRelease??'ce926c3fa3a71f888768b262a2b3ca2a4a698476';
const captureHistory=spawnSync('git',['cat-file','-e',captureRelease],{cwd:root}).status===0;
if(captureHistory)assert.deepEqual(sourceFingerprint(captureRelease),photos.source,'Original biome gallery source');
const catalogAt=rev=>JSON.parse(require('node:child_process').execFileSync('git',['show',rev+':packs/biome-library.json'],{cwd:root})).packs;
const historicIds=['infinite-meadow','infinite-industry','sideways-city','border-outfall'];
const offered=captureHistory?catalogAt(captureRelease):read(path.join(root,'packs/biome-library.json')).packs.filter(p=>historicIds.includes(p.id));
assert.deepEqual(new Set(photos.views.map(v=>v.pack)),new Set(offered.map(p=>p.id)));
const digests=new Set();
for(const v of photos.views){
 const bytes=fs.readFileSync(path.join(biomeDir,v.file));
 assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(sha(bytes),v.sha256);assert(!digests.has(v.sha256));digests.add(v.sha256);
 assert.deepEqual(v.browserViewport,[1440,810]);assert.equal(v.version,offered.find(p=>p.id===v.pack).version);
 if(v.pan){const clip=fs.readFileSync(path.join(biomeDir,v.pan.file));assert.equal(clip.readUInt32BE(0),0x1a45dfa3);assert.equal(sha(clip),v.pan.sha256);}
}
const crossing=read(path.join(biomeDir,'meadow-outfall.json')),movie=fs.readFileSync(path.join(biomeDir,crossing.file));
assert.deepEqual(crossing.source,photos.source);
assert.equal(movie.readUInt32BE(0),0x1a45dfa3);assert.equal(sha(movie),crossing.sha256);
assert.equal(crossing.route,'surface');assert.equal(crossing.walkedThroughEntrance,true);
assert(crossing.durationSeconds>50 && crossing.endOfCruiseMetresFromWall===18);
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
assert(readme.includes('examples/biomes/'+crossing.file));
const shown=[...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
const walks=read(path.join(biomeDir,'surface-walks.json'));
if(captureHistory)for(const [file,expected] of Object.entries(walks.sourceFiles)){
 const original=spawnSync('git',['show',captureRelease+':'+file],{cwd:root});
 assert.equal(original.status,0,file);assert.equal(sha(original.stdout),expected,file);
}
assert.equal(walks.visitTimingsMs.release.webglError,0);assert.deepEqual(walks.pageErrors,[]);
assert.equal(walks.totals.circuits,walks.circuits.length);assert(walks.circuits.length>=7);
assert.equal(walks.totals.tunnels,walks.circuits.reduce((n,r)=>n+r.renderedTunnels,0));
assert(walks.installed.every(site=>walks.visited.includes(site.id)));
for(const id of [0,1,2,3,4,5,6,7,8,9,10,11,12,15])assert(walks.visited.includes('main-'+id));
for(const shot of walks.screenshots){
 const bytes=fs.readFileSync(path.join(biomeDir,shot.file));
 assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(sha(bytes),shot.sha256);
}
assert(walks.circuits.every(w=>Math.abs(w.liveDegrees-360)<1e-8 && w.liveClosureM<.5));
const illustrated=[...photos.views,...walks.screenshots].map(v=>'examples/biomes/'+v.file);
assert(shown.length>=4);assert(shown.every(p=>illustrated.includes(p)));
assert.deepEqual(new Set(photos.views.filter(v=>shown.includes('examples/biomes/'+v.file)).map(v=>v.pack)),new Set(offered.map(p=>p.id)));
const borderDir=path.join(root,'examples/border-crossing'),borderRecord=read(path.join(borderDir,'installed-0.10.json'));
const borderFilm=borderRecord.guidedFlight,borderClip=fs.readFileSync(path.join(borderDir,borderFilm.file));
assert.equal(borderClip.subarray(4,8).toString(),'ftyp');
assert.equal(sha(borderClip),borderFilm.sha256);assert.equal(borderClip.length,borderFilm.bytes);
assert(borderFilm.decodedFrames>0 && borderFilm.compositorPictures>0 && borderFilm.arrived);
assert.equal(borderFilm.blackFrames,0);assert.equal(borderFilm.lostContext,false);assert.deepEqual(borderFilm.candidateCutsSeconds,[]);
assert(readme.includes('examples/border-crossing/'+borderFilm.file));
assert.equal(sha(fs.readFileSync(path.join(borderDir,borderRecord.frame.file))),borderRecord.frame.sha256);
const audit=read(path.join(root,'examples/transitions/audit.json'));
const filmFingerprint=require('./transition-source.cjs').sourceFingerprint;
const filmCommit=audit.runtimeVerification.commit;
const hasFilmHistory=spawnSync('git',['cat-file','-e',filmCommit],{cwd:root}).status===0;
if(hasFilmHistory)assert.deepEqual(filmFingerprint(filmCommit),audit.source,'Source of the published transition films');
else assert.deepEqual(audit.source,{files:289,sha256:'07ae2faf1272dd51e97fb97459d6d46db57abbd392c2ad1e7e08ec0d3f21c15b'},'Published source receipt for shallow checkouts');
assert.equal(audit.films.length,48);
assert.equal(audit.films.length,new Set(audit.films.map(f=>f.id)).size);
const footFilms=audit.films.filter(f=>f.id.startsWith('walk-'));
assert.equal(footFilms.length,28);
assert(footFilms.every(f=>f.firstStepM>.25 && f.outletErrorM<.5));
const nativeEyes=footFilms.filter(f=>f.eyeAboveFloorM!==null);
assert.equal(nativeEyes.length,24);
assert(nativeEyes.every(f=>Math.abs(f.eyeAboveFloorM-1.7)<.10));
assert(audit.films.every(f=>f.sourcePictures>=8 && f.picturesPerSecond>0));
const guided=audit.films.filter(f=>f.id.startsWith('flight-'));
const flightIds=hasFilmHistory?catalogAt(filmCommit).map(p=>p.id):historicIds;
assert.deepEqual(new Set(guided.map(f=>f.from+'/'+f.to)),new Set(flightIds.flatMap(a=>flightIds.filter(b=>a!==b).map(b=>a+'/'+b))));
assert(audit.films.every(f=>f.outcome==='pass' && f.decodedFrames>0));
assert.equal(audit.demos.length,3);
if(audit.demoCaptureSourceSha256){
 assert.equal(sha(fs.readFileSync(path.join(root,'tools/compositor-film.cjs'))),audit.demoCaptureSourceSha256);
}
const cutTraces=read(path.join(root,'examples/transitions/camera-cuts.json'));
assert.equal(Object.values(cutTraces).flat().length,audit.totals.candidateCuts);
for(const film of audit.films){
 assert.equal((cutTraces[film.id]||[]).length,film.candidateCuts.length,film.id);
}
for(const demo of audit.demos){
 const clip=fs.readFileSync(path.join(root,'examples/transitions',demo.file));
 assert.equal(clip.subarray(4,8).toString(),'ftyp');assert.equal(sha(clip),demo.sha256);
 assert(readme.includes('examples/transitions/'+demo.file));
 const surveyed=audit.films.find(f=>f.id===demo.sourceFilm);
 assert(surveyed,'The demonstration must repeat a surveyed route');
 assert.equal(demo.capture,'compositor');
 assert.equal(demo.decodedFrames,surveyed.decodedFrames);
 assert.equal(demo.sourceSha256,surveyed.sha256);
 assert.equal(demo.sourcePictures,surveyed.sourcePictures);
}
const transitionDoc=fs.readFileSync(path.join(root,'docs/Transition-audit.md'),'utf8');
const comparison=fs.readFileSync(path.join(root,'examples/transitions/outlet-before-after.jpg'));
assert.equal(comparison.readUInt16BE(0),0xffd8);
assert.equal(sha(comparison),audit.groundComparison.sha256);
assert(transitionDoc.includes('outlet-before-after.jpg'));
for(const demo of audit.demos)assert(transitionDoc.includes('examples/transitions/'+demo.file));
assert(readme.includes('docs/Transition-audit.md'));
console.log('PASS '+audit.films.length+' transition films, three complete demo files and their recorded transition source');
console.log('PASS '+photos.views.length+' biome photographs, the Meadow pan and Outfall crossing, release source fingerprints, historical galleries and publication links');
