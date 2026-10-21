/* Scoped component runner. A successful run is never native Phase One qualification. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),output=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;
const tests=['biome-service-records.cjs','biome-service-numeric-profile.cjs','biome-service-host.cjs','biome-service-numeric-integration.cjs','biome-service-providers.cjs','biome-service-ingestion.cjs','biome-service-store.cjs','biome-service-registry.cjs','biome-service-geometry.cjs','biome-service-eligibility.cjs','biome-service-allocator.cjs','biome-service-spatial-index.cjs','biome-service-storage-lifecycle.cjs','biome-service-view.cjs','biome-service-bindings.cjs','biome-service-view-binding.cjs','biome-service-binding-reissue-identity.cjs','biome-service-publication.cjs','biome-service-publication-ownership.cjs','biome-service-publication-faults.cjs','biome-service-publication-existing-faults.cjs','biome-service-publication-races.cjs','biome-service-publication-dependencies.cjs','biome-service-diagnostic-export.cjs','biome-service-native.cjs','biome-service-metadata-policy.cjs','biome-service-native-fixtures.cjs',"biome-service-native-fixed-program.cjs","biome-service-native-local-ownership.cjs","biome-service-native-local-field.cjs","biome-service-native-state.cjs","biome-service-root-target.cjs","biome-service-state-contexts.cjs","biome-service-source-owner.cjs","biome-service-host-coordinator.cjs","biome-service-owned-record-intake.cjs","biome-service-world-input.cjs","biome-service-interior-ray-halfspace.cjs","biome-service-surface-uniform-transport.cjs","biome-service-interior-ray-cell.cjs"];
if(output){if(!path.isAbsolute(output))throw Error('Evidence output must be an absolute fresh path');fs.mkdirSync(output,{recursive:false});}
const source=[];
function inventory(folder,entries=source){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
 const name=path.join(folder,entry.name);if(entry.isDirectory())inventory(name,entries);else{const raw=fs.readFileSync(name);entries.push({path:path.relative(repo,name).replaceAll('\\','/'),bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')});}
}}
inventory(path.join(repo,'biome-service'));
inventory(path.join(repo,'tests/fixtures/biome-service'));
inventory(path.join(repo,'tests/biome-service-native'));
function ownedPaths(){const paths=['package.json','package-lock.json','packs/catalogue.v1.json'];for(const folder of ['tests','scripts'])for(const entry of fs.readdirSync(path.join(repo,folder),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0))if(entry.isFile()&&(entry.name.includes('biome-service')||entry.name.startsWith('build-biome-')||entry.name.includes('biome-host')||entry.name.includes('biome-registry')||entry.name.includes('biome-catalogue')))paths.push(folder+'/'+entry.name);return paths;}
const owned=ownedPaths();
for(const name of owned){
 const raw=fs.readFileSync(path.join(repo,name));source.push({path:name,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
const results=[];
for(const test of tests){
 const env={...process.env};if(output)env.SPHERE_BIOME_SERVICE_TEST_OUTPUT=path.join(output,test.replace('.cjs',''));else delete env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;
 // Fresh evidence logs stream child progress while the source-locked suite runs.
 let run;const childOptions={cwd:repo,env,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024};
 if(output){const logFd=fs.openSync(path.join(output,test+'.log'),'wx');try{run=spawnSync(process.execPath,[path.join(__dirname,test)],{...childOptions,stdio:['ignore',logFd,logFd]});}finally{fs.closeSync(logFd);}}else run=spawnSync(process.execPath,[path.join(__dirname,test)],childOptions);
 const status=run.status===0&&!run.error?'PASS':'FAIL';results.push({test,status,exitCode:run.status,error:run.error?.message||null});
 console.log(test+': '+status);if(status==='FAIL')console.error(output?fs.readFileSync(path.join(output,test+'.log'),'utf8').slice(-32768):run.stderr||run.error?.message||run.stdout);
}
const sourceAfter=[];
inventory(path.join(repo,'biome-service'),sourceAfter);
inventory(path.join(repo,'tests/fixtures/biome-service'),sourceAfter);
inventory(path.join(repo,'tests/biome-service-native'),sourceAfter);
for(const name of ownedPaths()){const raw=fs.readFileSync(path.join(repo,name));sourceAfter.push({path:name,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')});}
const sourceIntegrity=JSON.stringify(sourceAfter)===JSON.stringify(source);
const report={format:'sphere-biome-service-test-run/1',dateUtc:new Date().toISOString(),scope:'BPS-P01/P02/P03/P04 plus eight P05 generic resource/backend/source-assembly components. P05 GPU calls are instrumented, browser-global checks use Node VM, and complete host shader assembly is source-only. Node storage/fault tests use fake-indexeddb; actual browser IndexedDB and separate-tab evidence are retained separately. Binding preparation uses source-admitted component support codecs. Portable fixed-program source identity, native resource/position lifetime, same-linked transform interruption and exact retained-state creation components (instrumented backend, no main readiness), plus actual compiled native fixture ABI/recipe/state/presentation/fixed numerical support components and shared metadata/policy admission are tested in isolated fake IndexedDB with instrumented nonnative buffers. Shared private source-owner and prospective complete-view/exact-state/support/root-target coupling are additional instrumented components; complete-demand native readiness and arrival explicitly refuse. Directed complete CPU ray-box and correlated-perspective cell/SPBX controls retain canonical half-open ownership and charged exact index parents; actual viewport/AA/resolve, native arithmetic and the two-pixel criterion remain unqualified. Main renderer/travel/full sessions/export/public routes remain NOT_RUN, and native heap/driver/quiet performance remain UNMEASURED.',status:results.every(r=>r.status==='PASS')&&sourceIntegrity?'PASS':'FAIL',tests:results,source,sourceAfter,sourceIntegrity:{status:sourceIntegrity?'PASS':'FAIL',reason:sourceIntegrity?'Exact tested source bytes unchanged throughout run':'Source changed during qualification; retain this attempt and rerun a frozen candidate'}};
if(output)fs.writeFileSync(path.join(output,'service-tests.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,componentSuites:results.length,nativeQualification:false}));if(report.status!=='PASS')process.exitCode=1;
