/* Explicit verified release directories, never server directory enumeration. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),R=require('../biome-service/records.js'),Registry=require('../biome-service/registry.js');
const repo=path.resolve(__dirname,'..');
async function buildCatalogue(directories,{readSource=async entry=>new Uint8Array(await fs.readFile(path.join(repo,entry))),allowedPrefixes=['packs/']}={}){
 if(!Array.isArray(directories)||directories.length>Registry.MAX_ENTRIES||new Set(directories).size!==directories.length)throw Error('Provide bounded explicit release directory paths');const entries=[];
 for(const directory of directories){Registry.permittedURL(directory+'/manifest.json','http://127.0.0.1/',allowedPrefixes);
  const [rawManifest,rawRelease]=await Promise.all([readSource(directory+'/manifest.json'),readSource(directory+'/release.json')]);const manifest=R.parse(rawManifest,{schemaName:'manifest'}),release=R.parse(rawRelease,{schemaName:'release'}),resources=new Map();
  for(const asset of manifest.assets)resources.set(asset.path,await readSource(directory+'/'+asset.path));await R.verifyRelease(rawManifest,release,resources);
  entries.push({packId:manifest.packId,version:manifest.version,payloadDigest:release.payloadDigest,manifestPath:directory+'/manifest.json',manifestBytes:rawManifest.length,manifestSha256:await R.sha256(rawManifest),releasePath:directory+'/release.json',releaseBytes:rawRelease.length,releaseSha256:await R.sha256(rawRelease)});
 }
 entries.sort((a,b)=>a.packId<b.packId?-1:a.packId>b.packId?1:a.version<b.version?-1:a.version>b.version?1:a.payloadDigest<b.payloadDigest?-1:1);return Registry.validateCatalogue({format:Registry.FORMAT,entries});
}
async function main(){const input=process.argv[2],output=process.argv[3];if(!input||!output||!path.isAbsolute(input)||!path.isAbsolute(output))throw Error('Provide absolute input plan and fresh catalogue output paths');const plan=R.parse(new Uint8Array(await fs.readFile(input)));if(!plan||Object.keys(plan).sort().join(',')!=='directories,format'||plan.format!=='sphere-biome-catalogue-build/1')throw Error('Invalid explicit catalogue build plan');const catalogue=await buildCatalogue(plan.directories);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,R.canonicalJSON(catalogue)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'GENERATED',entries:catalogue.entries.length,path:output,sha256:await R.sha256(R.bytes(R.canonicalJSON(catalogue)+'\n'))}));}
module.exports={buildCatalogue};if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
