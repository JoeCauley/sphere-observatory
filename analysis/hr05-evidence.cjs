'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const repo=path.resolve(__dirname,'..'),sphere=path.resolve(repo,'../..'),mode=process.argv[2],out=path.resolve(process.argv[3]);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),rel=file=>path.relative(sphere,file).replaceAll('\\','/');
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const git=args=>cp.execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true});
function scan(dir,files=[]){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(file===out||['.git','node_modules'].includes(item.name))continue;if(item.isDirectory())scan(file,files);else files.push(file);}return files;}
if(mode==='baseline'){
 fs.mkdirSync(out,{recursive:true});
 const files=scan(repo),receipt=JSON.parse(fs.readFileSync(path.join(repo,'docs/evidence/meadow-proof-01/hr04-lifecycle-v1-2026-10-02T10-50-14-898Z/documentation-audit.json'),'utf8'));
 for(const name of receipt.documents){const file=path.join(sphere,name);if(fs.existsSync(file)&&!files.includes(file))files.push(file);}
 const inventory=files.map(file=>({path:rel(file),bytes:fs.statSync(file).size,sha256:sha(file)}));
 for(const file of files.filter(f=>!f.includes(path.sep+'evidence'+path.sep)&&/\.(js|cjs|json|md|html)$/.test(f)&&fs.statSync(f).size<1048576)){const dest=path.join(out,'before',rel(file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}
 write('baseline-inventory.json',{createdUtc:new Date().toISOString(),files:inventory,documents:receipt.documents,build:require('../build-info.cjs')(repo)});
 fs.writeFileSync(path.join(out,'git-status-before.txt'),git(['status','--short']));
 console.log(JSON.stringify({output:out,protectedFiles:inventory.length,documents:receipt.documents.length,build:require('../build-info.cjs')(repo)}));
}else if(mode==='audit'){
 const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline-inventory.json'),'utf8')),changed=[],missing=[];
 for(const entry of baseline.files){const file=path.join(sphere,entry.path);if(!fs.existsSync(file))missing.push(entry.path);else if(sha(file)!==entry.sha256)changed.push(entry.path);}
 const protectedChanges=changed.filter(name=>name.includes('/evidence/')||name.includes('/assets/')||name.includes('/fixtures/')&&!name.endsWith('/fixtures/README.md'));
 write('preservation-audit.json',{status:missing.length||protectedChanges.length?'FAIL':'PASS',originalFiles:baseline.files.length,missing,protectedChanges,changed});
 fs.writeFileSync(path.join(out,'git-status-final.txt'),git(['status','--short']));
 write('source-fixture-manifest.json',{build:require('../build-info.cjs')(repo),files:scan(repo).filter(f=>path.dirname(f)===repo||f.includes(path.sep+'tests'+path.sep)).map(file=>({path:rel(file),sha256:sha(file)}))});
 console.log(JSON.stringify({originalFiles:baseline.files.length,changed:changed.length,missing,protectedChanges,build:require('../build-info.cjs')(repo)}));
 if(missing.length||protectedChanges.length)process.exitCode=1;
}else throw Error('Use baseline or audit');
