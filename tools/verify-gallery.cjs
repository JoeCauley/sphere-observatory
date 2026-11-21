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
assert.deepEqual(sourceFingerprint(), revision?.source ?? photos.source, 'Offered pack files differ from the verified gallery source');
const offered=read(path.join(root,'packs/biome-library.json')).packs;
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
for(const [file,expected] of Object.entries(walks.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),expected,file);
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
console.log('PASS '+photos.views.length+' biome photographs, the Meadow pan and Outfall crossing, release source fingerprints, historical galleries and publication links');
