'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function sourceFingerprint(revision){
  const files=new Set();
  const included=file=>/\.(js|css|html|json|glsl|vert|frag)$/.test(file);
  function scan(dir,deep){
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
      if(entry.name.startsWith('.') || (!dir && entry.name.endsWith('.json')))continue;
      const file=path.posix.join(dir,entry.name);
      if(entry.isDirectory()){if(deep)scan(file,true);continue;}
      if(included(file))files.add(file);
    }
  }
  const git=(args,input)=>require('node:child_process').execFileSync('git',args,{cwd:root,input,maxBuffer:64*1024*1024});
  if(revision){
    if(!/^[a-f0-9]{40}$/.test(revision))throw Error('The film revision must be a full commit ID.');
    const names=git(['ls-tree','-r','--name-only','-z',revision]).toString().split('\0');
    for(const file of names){
      if(!included(file)||file.split('/').some(s=>s.startsWith('.')))continue;
      if(file.startsWith('packs/')||(!file.includes('/')&&!file.endsWith('.json')))files.add(file);
    }
  }else{scan('',false);scan('packs',true);}
  for(const file of ['analyze-transition-films.py','compositor-film.cjs','capture-transition-flights.cjs','capture-transition-pilots.cjs','capture-transition-walks.cjs','transition-recorder.cjs','transition-walk-plan.mjs'])files.add('tools/'+file);
  for(const file of ['support/surface-circuits.mjs','support/biome-browser.cjs','surface-architecture-browser.cjs','surface-architecture.mjs','border-passage-browser.cjs'])files.add('tests/'+file);
  const hash=crypto.createHash('sha256');
  const names=[...files].sort();
  if(revision){
    const contents=git(['cat-file','--batch'],names.map(f=>revision+':'+f+'\n').join(''));
    let offset=0;
    for(const name of names){
      const end=contents.indexOf(10,offset),header=contents.toString('utf8',offset,end);
      const match=/^[a-f0-9]+ blob (\d+)$/.exec(header);
      if(!match)throw Error('Missing film source '+name+' at '+revision);
      const length=Number(match[1]);
      hash.update(name+'\0').update(contents.subarray(end+1,end+1+length));offset=end+2+length;
    }
  }else for(const name of names)hash.update(name+'\0').update(fs.readFileSync(path.join(root,name)));
  return {files:files.size,sha256:hash.digest('hex')};
}
module.exports={sourceFingerprint};
if(require.main===module)process.stdout.write(JSON.stringify(sourceFingerprint())+'\n');
