// Dependency-free publication checks; usable locally and in GitHub Actions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'examples/observatory'),archive=path.join(root,'examples/archive/v1.5');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const shots=read(path.join(dir,'shots.json')),gallery=read(path.join(dir,'gallery.json')),ui=read(path.join(dir,'interface.json')),version=read(path.join(root,'package.json')).version;
assert.equal(shots.length,19);assert.equal(gallery.version,version);assert.equal(gallery.shots.length,shots.length);assert.deepEqual(gallery.errors,[]);
const hash=crypto.createHash('sha256');for(const file of gallery.sourceFiles){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'));}assert.equal(hash.digest('hex'),gallery.sourceContentSha256,'Gallery must record the current rendering source');
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
console.log('PASS 19 fresh 4K photographs, 3 interface screenshots, source fingerprint, archived image hashes and publication links');
