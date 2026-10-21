'use strict';
// Preserve the legacy test and its numerical assertions while directing its
// historical fixed output into the fresh verification run's evidence folder.
const fs=require('node:fs'),path=require('node:path'),repo=path.resolve(__dirname,'..'),historical=path.join(repo,'docs/evidence/meadow-proof-01/d-residency-cpu.json'),original=fs.writeFileSync;
fs.writeFileSync=function(file,data,options){
 if(typeof file==='string'&&path.resolve(file)===historical){
  if(!process.env.IB075_HR05_LEGACY_OUTPUT)throw Error('Fresh legacy receipt output is required');
  const directory=path.resolve(process.env.IB075_HR05_LEGACY_OUTPUT);fs.mkdirSync(directory,{recursive:true});
  return original.call(fs,path.join(directory,path.basename(historical)),data,{...(typeof options==='string'?{encoding:options}:options||{}),flag:'wx'});
 }
 return original.call(fs,file,data,options);
};
