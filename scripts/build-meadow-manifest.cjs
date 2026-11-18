// Freeze a versioned Meadow delivery after authorized source changes. The accepted 1.0.0 is immutable and refused.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const version=process.argv[2];if(!/^\d+\.\d+\.\d+$/.test(version||'')||version==='1.0.0')throw Error('Give a Meadow version other than the accepted 1.0.0, for example 1.3.0');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'packs/infinite-meadow',version),file=path.join(dir,'manifest.json');
const hash=relative=>{const b=fs.readFileSync(path.resolve(dir,relative));return {path:relative,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};};
const m=JSON.parse(fs.readFileSync(file));m.assets=m.assets.map(a=>hash(a.path));m.dependencies=(m.dependencies??[]).map(d=>hash(d.path));fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');console.log(`Meadow ${version} manifest: ${m.assets.length} assets, ${m.dependencies.length} pinned shared sources`);
