'use strict';
// New service source profile; the catalogue and every released pack byte stay intact.
const fs=require('node:fs/promises'),path=require('node:path'),R=require('../biome-service/records.js'),B=require('../biome-service/binding-builder.v2.js');
const repo=path.resolve(__dirname,'..');
async function build(){
 const old=JSON.parse(await fs.readFile(path.join(repo,'biome-service/main-install-profiles.v1.json'),'utf8'));
 for(const envelope of [old.provider,old.codec])await R.verifyEnvelope(envelope);
 for(const e of old.provider.body.closure){const bytes=new Uint8Array(await fs.readFile(path.join(repo,e.path)));if(bytes.length!==e.bytes||await R.sha256(bytes)!==e.sha256)throw Error('Original provider dependency changed: '+e.path);}
 const paths=[...new Set([...B.SOURCE_PATHS,'biome-service/publication.v2.js','biome-service/bounded-storage.v1.js','biome-service/main-install.v3.js'])].sort(),serviceClosure=[];
 for(const p of paths){const b=new Uint8Array(await fs.readFile(path.join(repo,p)));serviceClosure.push({path:p,bytes:b.length,sha256:await R.sha256(b)});}
 const profile={format:'sphere-main-install-profiles/3',provider:old.provider,codec:old.codec,hostClosure:old.hostClosure,serviceClosure};
 await fs.writeFile(path.join(repo,'biome-service/main-install-profiles.v3.json'),R.canonicalBytes(profile));
 console.log(JSON.stringify({status:'GENERATED',providerDigest:old.provider.digest,serviceEntries:serviceClosure.length,packReleaseBytes:'UNCHANGED',builderProfile:B.PROFILE_ID}));return profile;
}
module.exports={build};if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
