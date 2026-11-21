'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function sourceFingerprint(commit){
  const git=(...args)=>require('node:child_process').execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
  const bytes=file=>commit?git('show',commit+':'+file):fs.readFileSync(path.join(root,file));
  const catalog='packs/biome-library.json',files=new Set([catalog]);
  const packs=JSON.parse(bytes(catalog)).packs;
  const directories=new Set(['packs/kit','packs/runtime/v1','packs/infinite-meadow/1.0.0',...packs.map(p=>path.posix.dirname(p.entry))]);
  function walk(folder){
    for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
      const file=path.posix.join(folder,entry.name);
      if(entry.isDirectory())walk(file);else if(/\.(js|css|html|json)$/.test(file))files.add(file);
    }
  }
  if(commit){
    for(const file of git('ls-tree','-r','--name-only',commit,'--',...directories).toString().trim().split('\n')){
      if(/\.(js|css|html|json)$/.test(file))files.add(file);
    }
  }else for(const dir of directories)walk(dir);
  const hash=crypto.createHash('sha256');
  for(const file of [...files].sort())hash.update(file+'\0').update(bytes(file));
  return {files:files.size,sha256:hash.digest('hex')};
}
module.exports={sourceFingerprint};
