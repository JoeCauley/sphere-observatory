// Browser checks share the GPU and deliberately run sequentially.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'work/screenshots/neighbourhood/regressions');fs.mkdirSync(dir,{recursive:true});
const suites=process.argv.slice(2);if(!suites.length)suites.push('watershed-browser','watershed-entry-browser','continuous-flight-browser','places-browser','pointer-browser','measure-browser','asset-loading-browser','shade-deck-browser','weather-depth-browser','ascent-browser','atmosphere-release-browser');
const results=[];
for(const name of suites){if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid test name');console.log('Starting '+name);const start=Date.now(),r=spawnSync(process.execPath,[path.join(root,'tests',name+'.cjs')],{cwd:root,env:process.env,encoding:'utf8',timeout:900000,maxBuffer:16*1024*1024});fs.writeFileSync(path.join(dir,name+'.log'),(r.stdout||'')+(r.stderr||''));const record={name,exitCode:r.status,elapsedMs:Date.now()-start,error:r.error?.message||null};results.push(record);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(record));if(r.status!==0)console.log((r.stderr||r.stdout||'').slice(-3000));}
if(results.some(r=>r.exitCode!==0))process.exitCode=1;
