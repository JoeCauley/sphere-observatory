'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function sourceFingerprint(){
  const catalog='packs/biome-library.json',files=new Set([catalog]);
  const packs=JSON.parse(fs.readFileSync(path.join(root,catalog))).packs;
  const directories=new Set(['packs/kit','packs/runtime/v1','packs/infinite-meadow/1.0.0',...packs.map(p=>path.posix.dirname(p.entry))]);
  function walk(folder){
    for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
      const file=path.posix.join(folder,entry.name);
      if(entry.isDirectory())walk(file);else if(/\.(js|css|html|json)$/.test(file))files.add(file);
    }
  }
  for(const dir of directories)walk(dir);
  const hash=crypto.createHash('sha256');
  for(const file of [...files].sort())hash.update(file+'\0').update(fs.readFileSync(path.join(root,file)));
  return {files:files.size,sha256:hash.digest('hex')};
}
module.exports={sourceFingerprint};
