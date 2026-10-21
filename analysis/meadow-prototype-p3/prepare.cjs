'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..'),stamp=new Date().toISOString().replace(/[:.]/g,'-'),name='meadow-prototype-p3-'+stamp;
const work=path.resolve(repo,'../../work',name),evidence=path.join(repo,'docs/evidence',name);
assert(!fs.existsSync(work)&&!fs.existsSync(evidence),'Use fresh owned directories');
fs.mkdirSync(work,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inventory(dir=repo){
 const files=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name),relative=path.relative(repo,file).replaceAll('\\','/');
  if(entry.isSymbolicLink())continue;
  if(entry.isDirectory()){
   if(['.git','node_modules','work'].includes(entry.name)||relative==='docs/evidence'||relative==='analysis/meadow-prototype-p3')continue;
   files.push(...inventory(file));
  }else {const bytes=fs.readFileSync(file);files.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});}
 }
 return files;
}
const files=inventory(),build=require(path.join(repo,'build-info.cjs'))(repo);
const diff=execFileSync('git',['diff','--no-ext-diff','--binary'],{cwd:repo,stdio:['ignore','pipe','ignore']});
const baseline={schema:1,createdAt:new Date().toISOString(),files,build,trackedDiffSha256:sha(diff),scope:'All existing non-evidence files excluding .git, node_modules, work and the newly owned prototype directory. Historical evidence is read-only; no all-host/process claim.'};
fs.writeFileSync(path.join(evidence,'baseline.json'),JSON.stringify(baseline,null,2)+'\n',{flag:'wx'});
const runtime=path.join(work,'runtime');fs.mkdirSync(runtime);
for(const entry of fs.readdirSync(repo,{withFileTypes:true}))if(entry.isFile()&&(/\.(js|cjs|css|html)$/.test(entry.name)||entry.name==='package.json'))fs.copyFileSync(path.join(repo,entry.name),path.join(runtime,entry.name));
fs.cpSync(path.join(repo,'assets'),path.join(runtime,'assets'),{recursive:true,errorOnExist:true,force:false});
fs.mkdirSync(path.join(runtime,'tests/fixtures'),{recursive:true});
for(const name of fs.readdirSync(path.join(repo,'tests/fixtures')))if(name.endsWith('.json'))fs.copyFileSync(path.join(repo,'tests/fixtures',name),path.join(runtime,'tests/fixtures',name));
const config={schema:1,profile:'meadow-prototype-p3',repo,work,runtime,evidence,baselineBuild:build,createdAt:new Date().toISOString()};
fs.writeFileSync(path.join(work,'config.json'),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'last-run.json'),JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({work,evidence,baselineFiles:files.length,sourceSha256:build.sourceSha256}));
