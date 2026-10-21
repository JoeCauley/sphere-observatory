/* Generic ownership/backend components. This runner does not qualify native geography. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const definitions=[
 {name:'resource-leases',format:'sphere-biome-work-only-resource-prototype-tests/1',report:'results.json',kind:'NODE_OWNED_ARRAYBUFFER_AND_INSTRUMENTED_GPU'},
 {name:'positions-backend',format:'sphere-biome-live-positions-backend-tests/1',report:'results.json',kind:'INSTRUMENTED_WEBGL2'},
 {name:'host-profile',format:'sphere-biome-host-draw-profile-component/1',report:'results.json',kind:'STATIC_HOST_LAYOUT_WITH_INSTRUMENTED_GL'},
 {name:'shader-assembly',format:'sphere-biome-overview-shader-assembly-component/1',report:'results.json',kind:'COMPLETE_HOST_SOURCE_ASSEMBLY'},
 {name:'overview-slot',format:'sphere-biome-overview-slot-component/1',report:'results.json',kind:'INSTRUMENTED_TYPED_TEXTURE_BINDING'},
 {name:'shared-profile',format:'sphere-biome-shared-host-draw-profile-component/1',report:'results.json',kind:'STATIC_COMPOSITE_LAYOUT_WITH_INSTRUMENTED_GL'},
 {name:'overview-ownership',format:'sphere-biome-work-only-overview-independent-review/1',report:'review.json',kind:'INSTRUMENTED_WEBGL2_OWNERSHIP_WITNESSES'},
 {name:'composition-and-slot',format:'sphere-biome-work-native-mapped-composition-independent-review/1',report:'review.json',kind:'COMMONJS_CLASSIC_BROWSER_VM_AND_INSTRUMENTED_SLOT'}
];
const runtimeNames=['resource-leases.js','positions-backend.js','overview-index.js','shared-gpu-backend.js','overview-banks.js','overview-shader.js'];
const hostNames=['math','meadow-wind','collection','biomes','world-palette','biome-packs','world','field-sites','watershed-network','watershed-province','watershed-neighbourhood','shaders','shader-sections','collection-shader','biome-shader','world-shader','neighbourhood-shader','surface-lighting','silhouette-aa','station-shader-performance','meadow-canopy','bootstrap'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function identity(file){const absolute=fs.realpathSync(file),bytes=fs.readFileSync(absolute);return {path:absolute,bytes:bytes.length,sha256:hash(bytes)};}
function count(values,label){if(Array.isArray(values)){assert(values.length>0||label==='refusals');for(const value of values)assert(value&&value.status==='PASS',label+' has a nonpassing entry');return values.length;}assert(Number.isSafeInteger(values)&&values>=0&&(values>0||label==='refusals'),label+' count is not exact');return values;}
function outputDirectory(){const requested=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;if(requested!==undefined){assert(requested&&path.isAbsolute(requested),'SPHERE_BIOME_SERVICE_TEST_OUTPUT must be a fresh absolute path');assert(!fs.existsSync(requested),'No evidence output path reuse');fs.mkdirSync(requested,{recursive:false});return {path:fs.realpathSync(requested),mode:'EXPLICIT_FRESH_PATH'};}return {path:fs.mkdtempSync(path.join(os.tmpdir(),'sphere-biome-native-components-')),mode:'ATOMIC_FRESH_OS_TEMP'};}
function run(){
 const destination=outputDirectory(),output=destination.path,runtime=fs.realpathSync(path.join(__dirname,'../biome-service/native')),repo=path.resolve(runtime,'../..'),testFolder=path.join(__dirname,'biome-service-native');
 const sourcePaths=[...runtimeNames.map(name=>path.join(runtime,name)),...hostNames.map(name=>path.join(repo,name+'.js')),...definitions.map(item=>path.join(testFolder,item.name+'.cjs')),path.join(repo,'tests/fixtures/biome-service/positions-copy-first.js'),__filename],sourceBefore=sourcePaths.map(identity),knownSources=new Map(sourceBefore.map(row=>[row.path,row]));
 fs.mkdirSync(path.join(output,'source'));for(let i=0;i<sourceBefore.length;i++){const row=sourceBefore[i];fs.copyFileSync(row.path,path.join(output,'source',String(i).padStart(3,'0')+'-'+path.basename(row.path)));}
 const results=[];let totalGroups=0,totalExpectedRefusals=0;
 for(const definition of definitions){
  const childOutput=path.join(output,definition.name),env={...process.env,SPHERE_BIOME_SERVICE_TEST_OUTPUT:childOutput},test=path.join(testFolder,definition.name+'.cjs'),invocation=[test,childOutput];
  const child=spawnSync(process.execPath,invocation,{cwd:repo,env,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:60000});
  fs.writeFileSync(path.join(output,definition.name+'.stdout.log'),child.stdout||'',{flag:'wx'});fs.writeFileSync(path.join(output,definition.name+'.stderr.log'),child.stderr||'',{flag:'wx'});
  let verification='FAIL',error=child.error?.message||null,groups=0,refusals=0,reportIdentity=null,sourceRows=0;
  try{
   assert(child.status===0&&!child.error,'Child process failed');const reportPath=path.join(childOutput,definition.report),report=JSON.parse(fs.readFileSync(reportPath,'utf8'));assert.equal(report.format,definition.format);assert.equal(report.status,'PASS');
   if('sourceBefore'in report)assert.deepEqual(report.sourceBefore,report.sourceAfter,'Embedded source before/after differs');if('sourceIntegrity'in report)assert.equal(report.sourceIntegrity,'PASS');
   const entries=report.sourceAfter||report.sources||(report.source?[report.source]:[]);assert(entries.length>0,'Child report omitted source identities');
   for(const row of entries){assert(path.isAbsolute(row.path),'Child source must be absolute');assert(Number.isSafeInteger(row.bytes)&&row.bytes>=0&&/^[a-f0-9]{64}$/.test(row.sha256),'Child source identity invalid');const actual=identity(row.path);assert.deepEqual(actual,row,'Child current source differs');assert.deepEqual(knownSources.get(actual.path),row,'Child source not retained in runner input closure');}
   groups=count(report.groups,'groups');refusals=count(report.refusals,'refusals');sourceRows=entries.length;reportIdentity=identity(reportPath);verification='PASS';
  }catch(e){error=error||e.message;}
  results.push({test:'tests/biome-service-native/'+definition.name+'.cjs',scope:definition.kind,status:verification,exitCode:child.status,error,report:reportIdentity,reportedSourceRows:sourceRows,groups,expectedRefusals:refusals,stdout:identity(path.join(output,definition.name+'.stdout.log')),stderr:identity(path.join(output,definition.name+'.stderr.log'))});
  totalGroups+=groups;totalExpectedRefusals+=refusals;console.log(definition.name+': '+verification);if(error)console.error(definition.name+': '+error);
 }
 const sourceAfter=sourcePaths.map(identity),integrity=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);const status=results.every(row=>row.status==='PASS')&&integrity?'PASS':'FAIL';
 const report={format:'sphere-biome-service-native-components-test-run/1',createdUtc:new Date().toISOString(),status,output,outputMode:destination.mode,node:{version:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch},actualRuntimeDirectory:runtime,tests:results,totalGroups,totalExpectedRefusals,sourceBefore,sourceAfter,sourceIntegrity:{status:integrity?'PASS':'FAIL',reason:integrity?'All actual admitted runtime, host shader closure, child test and runner bytes remain exact':'Source drift occurred; retain this attempt and rerun a frozen source'},qualification:{genericRepositoryComponents:'TESTED',actualBrowser:'NOT_RUN',mainRenderer:'NOT_RUN',nativeGeography:'NOT_RUN',supportAndVisualCoincidence:'NOT_RUN',publicRoutes:'NOT_RUN',BpsP05:'PENDING',fullBpsConformance:'NOT_RUN',nativeHeap:'UNMEASURED',wrapperAndEngineMemory:'UNMEASURED',gpuDriverPeak:'UNMEASURED',quietTiming:'UNMEASURED'},scope:['Eight bounded generic component/source/review suites using actual admitted repository modules','GPU/backend tests are explicitly instrumented WebGL2; classic browser checks use Node VM','Complete current source-only host material assembly includes existing meadow-canopy patch; no program compile or native draw qualification','Every child stdout/stderr/result and runner-wide source closure is retained under a fresh caller path or atomic OS temp','No historical output path, shader/provider profile admission, private main renderer injection or Phase One completion claim']};
 fs.writeFileSync(path.join(output,'native-components-tests.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status,componentSuites:results.length,groups:totalGroups,expectedRefusals:totalExpectedRefusals,nativeQualification:false,output}));if(status!=='PASS')process.exitCode=1;
}
try{run();}catch(error){console.error(error.stack);process.exitCode=1;}
