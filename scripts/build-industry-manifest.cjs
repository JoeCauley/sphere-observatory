// Freeze the versioned Industry delivery after authorized source changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'packs/infinite-industry/1.0.0'),file=path.join(dir,'manifest.json');
const hash=relative=>{const b=fs.readFileSync(path.resolve(dir,relative));return {path:relative,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};};
const m=JSON.parse(fs.readFileSync(file));m.assets=fs.readdirSync(dir).filter(n=>!['manifest.json','package.json'].includes(n)&&fs.statSync(path.join(dir,n)).isFile()).sort().map(hash);m.dependencies=m.dependencies.map(d=>hash(d.path));fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');console.log(`Industry manifest: ${m.assets.length} assets, ${m.dependencies.length} pinned shared sources`);
