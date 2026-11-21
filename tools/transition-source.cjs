'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function sourceFingerprint(){
  const files=new Set();
  function scan(dir,deep){
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
      if(entry.name.startsWith('.') || (!dir && entry.name.endsWith('.json')))continue;
      const file=path.posix.join(dir,entry.name);
      if(entry.isDirectory()){if(deep)scan(file,true);continue;}
      if(/\.(js|css|html|json|glsl|vert|frag)$/.test(file))files.add(file);
    }
  }
  scan('',false);scan('packs',true);
  for(const file of ['analyze-transition-films.py','capture-transition-flights.cjs','capture-transition-pilots.cjs','capture-transition-walks.cjs','transition-recorder.cjs','transition-walk-plan.mjs'])files.add('tools/'+file);
  for(const file of ['support/surface-circuits.mjs','support/biome-browser.cjs','surface-architecture-browser.cjs','surface-architecture.mjs','border-passage-browser.cjs'])files.add('tests/'+file);
  const hash=crypto.createHash('sha256');
  for(const name of [...files].sort())hash.update(name+'\0').update(fs.readFileSync(path.join(root,name)));
  return {files:files.size,sha256:hash.digest('hex')};
}
module.exports={sourceFingerprint};
if(require.main===module)process.stdout.write(JSON.stringify(sourceFingerprint())+'\n');
