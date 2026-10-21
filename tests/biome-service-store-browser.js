/* Public test-page runner. It never touches the production service database. */
'use strict';
let reportURL=null;addEventListener('pagehide',()=>{if(reportURL)URL.revokeObjectURL(reportURL);});
document.getElementById('run').addEventListener('click',async()=>{
 const button=document.getElementById('run'),status=document.getElementById('status'),output=document.getElementById('report');button.disabled=true;status.textContent='Running isolated checks';
 try{
  const read=async path=>{const response=await fetch(path,{cache:'no-store',redirect:'error'});if(!response.ok)throw Error('Test fixture unavailable: '+path);return new Uint8Array(await response.arrayBuffer());};
  const fixtureManifest=SphereBiomeRecords.parse(await read('fixtures/biome-service/design-examples/fixture-open-industry/manifest.json'),{schemaName:'manifest'}),recipeBytes=await read('fixtures/biome-service/design-examples/fixture-open-industry/assets/recipe.json'),probeSource=await read('fixtures/biome-service/admission-probe.js');
  const report=await SphereBiomeStoreTestSuite.run({indexedDB,fixtureManifest,recipeBytes,probeSource,databaseSuffix:'browser-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8)});
  report.environment={nativeIndexedDB:true,userAgent:navigator.userAgent,origin:location.origin,sourceRoute:location.pathname,dateUtc:new Date().toISOString(),sourceIdentity:'Retain source manifest separately; this page is component evidence only.'};output.textContent=JSON.stringify(report,null,2);status.textContent='PASS — '+report.cases.length+' cases, '+report.rejected+' expected refusals';
  if(reportURL)URL.revokeObjectURL(reportURL);reportURL=URL.createObjectURL(new Blob([output.textContent+'\n'],{type:'application/json'}));const download=document.getElementById('download');download.href=reportURL;download.hidden=false;
 }catch(error){status.textContent='FAIL — '+(error.code||error.name);output.textContent=JSON.stringify({status:'FAIL',message:error.message,code:error.code||null,stack:error.stack},null,2);}
 finally{button.disabled=false;}
});
