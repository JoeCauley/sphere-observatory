'use strict';
const fs=require('node:fs'),path=require('node:path'),{IDBFactory}=require('fake-indexeddb'),suite=require('./biome-service-store-suite.js');
(async()=>{
 const report=await suite.run({indexedDB:new IDBFactory(),databaseSuffix:'node-isolated',fixtureManifest:JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/biome-service/design-examples/fixture-open-industry/manifest.json'),'utf8')),recipeBytes:new Uint8Array(fs.readFileSync(path.join(__dirname,'fixtures/biome-service/design-examples/fixture-open-industry/assets/recipe.json'))),probeSource:new Uint8Array(fs.readFileSync(path.join(__dirname,'fixtures/biome-service/admission-probe.js')))});
 report.environment={engine:'fake-indexeddb',version:JSON.parse(fs.readFileSync(path.join(__dirname,'../node_modules/fake-indexeddb/package.json'),'utf8')).version,nativeIndexedDB:false};
 const out=process.env.SPHERE_BIOME_SERVICE_TEST_OUTPUT;if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'store-test-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify({status:report.status,cases:report.cases.length,rejected:report.rejected,nativeIndexedDB:false}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
