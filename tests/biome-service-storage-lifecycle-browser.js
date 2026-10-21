/* Public component runner. Each run retains a fresh test database; production storage is untouched. */
'use strict';
let reportURL=null;
addEventListener('pagehide',()=>{if(reportURL)URL.revokeObjectURL(reportURL);});
document.getElementById('run').addEventListener('click',async()=>{
 const button=document.getElementById('run'),status=document.getElementById('status'),output=document.getElementById('report');
 button.disabled=true;status.textContent='Running isolated retention checks';
 const environment={nativeIndexedDB:true,userAgent:navigator.userAgent,origin:location.origin,sourceRoute:location.pathname,dateUtc:new Date().toISOString(),sourceIdentity:'Retain exact source hashes and bytes separately; this is component evidence.'};
 let report;
 try{
  const read=async path=>{const response=await fetch(path,{cache:'no-store',redirect:'error'});if(!response.ok)throw Error('Test fixture unavailable: '+path);const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>1048576)throw Error('Test fixture exceeds the retained fixture read limit');return bytes;};
  const fixtureManifest=SphereBiomeRecords.parse(await read('fixtures/biome-service/design-examples/fixture-open-industry/manifest.json'),{schemaName:'manifest'}),recipeBytes=await read('fixtures/biome-service/design-examples/fixture-open-industry/assets/recipe.json');
  report=await SphereBiomeStorageLifecycleTestSuite.run({indexedDB,fixtureManifest,recipeBytes,databaseSuffix:'browser-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8)});
  report.environment=environment;status.textContent='PASS — '+report.cases.length+' groups, '+report.refusals.length+' expected refusals';
 }catch(error){
  report={format:'sphere-biome-storage-lifecycle-test/1',status:'FAIL',environment,code:error.code||null,message:error.message,stack:error.stack,scope:'Actual IndexedDB component attempt; retained databases may contain a partial test run.'};
  status.textContent='FAIL — '+(error.code||error.name);
 }finally{
  output.textContent=JSON.stringify(report,null,2);if(reportURL)URL.revokeObjectURL(reportURL);
  reportURL=URL.createObjectURL(new Blob([output.textContent+'\n'],{type:'application/json'}));
  const download=document.getElementById('download');download.href=reportURL;download.hidden=false;button.disabled=false;
 }
});
