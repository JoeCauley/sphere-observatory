// Inventory the display-only successor without changing any original release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'packs/shared-world/1.1.0');
const prior=JSON.parse(fs.readFileSync(path.join(root,'packs/shared-world/1.0.0/registry.json')));
const record=relative=>{const bytes=fs.readFileSync(path.resolve(folder,relative));return {path:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};};
const registry={...prior,worldVersion:'1.1.0',displayRevision:'industry-display-demand-v1',
 packs:prior.packs.map(pack=>({...pack,version:'1.2.0',manifest:pack.manifest.replace('/1.1.0/','/1.2.0/')})),
 sharedAssets:fs.readdirSync(folder).filter(name=>name!=='registry.json'&&fs.statSync(path.join(folder,name)).isFile()).sort().map(record),
 dependencies:prior.dependencies.map(item=>record(item.path.replace(/(infinite-(?:meadow|industry))\/1\.1\.0\/manifest\.json$/,'$1/1.2.0/manifest.json'))),
 scope:'Preserved Meadow/Industry content and simulation with conservative display demand. Formal P05 and Meadow H1 gates remain open.'};
fs.writeFileSync(path.join(folder,'registry.json'),JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({worldVersion:registry.worldVersion,packs:registry.packs.map(p=>p.id+'@'+p.version),files:registry.sharedAssets.length+registry.dependencies.length}));
