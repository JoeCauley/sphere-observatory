const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {world}=require('./apartment-field.cjs');
const parameters={seed:713,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2,shadeGeometryRevision:3};
// Minimal commissioned seed for repeatable browser checks on any checkout.
const installed=[
  {id:'infinite-meadow',name:'Infinite Meadow',version:'1.3.0',plot:391,plotId:'r10c0',direction:[.9166362018512472,-.02545488185708365,.3989111711212927],relation:'within'},
  {id:'infinite-new-york',name:'Infinite New York',version:'0.1.0',plot:618,plotId:'r14c14',direction:[.08598416040211447,.7566745777741876,-.6481128817653592],relation:'outside'}
].map(i=>({...i,packId:i.id,radiusKm:8703251.325625846}));
function fixture(source,{empty=false}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orchard-pilot-')),file=path.join(dir,'installed.json');
  if(source){fs.copyFileSync(source,file);if(fs.existsSync(source+'.border-atlas'))fs.cpSync(source+'.border-atlas',file+'.border-atlas',{recursive:true});}
  else if(!empty)fs.writeFileSync(file,JSON.stringify({schema:1,worlds:{[world]:{parameters,installed,marks:[]}}}));
  return {dir,file};
}
module.exports={fixture,parameters};
