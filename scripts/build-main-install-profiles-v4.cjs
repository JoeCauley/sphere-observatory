'use strict';
// New service source profile; the catalogue and every released pack byte stay intact.
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),R=require('../biome-service/records.js'),B=require('../biome-service/binding-builder.v2.js'),Overview=require('../biome-service/native/overview-shader.js');
const repo=path.resolve(__dirname,'..');
const SHADERS=['math','meadow-wind','collection','biomes','world-palette','biome-packs','world','field-sites','watershed-network','watershed-province','watershed-neighbourhood','shaders','shader-sections','collection-shader','biome-shader','world-shader','neighbourhood-shader','surface-lighting','silhouette-aa','station-shader-performance','meadow-canopy'].map(p=>p+'.js');
async function build(){
 const old=JSON.parse(await fs.readFile(path.join(repo,'biome-service/main-install-profiles.v1.json'),'utf8'));
 for(const envelope of [old.provider,old.codec])await R.verifyEnvelope(envelope);
 for(const e of old.provider.body.closure){const bytes=new Uint8Array(await fs.readFile(path.join(repo,e.path)));if(bytes.length!==e.bytes||await R.sha256(bytes)!==e.sha256)throw Error('Original provider dependency changed: '+e.path);}
 const sourcePaths=[...SHADERS,'renderer.js','location-identity.js','biome-service/main-overview.v1.js','biome-service/native/overview-index.js','biome-service/native/overview-shader.js'];
 const context={console,performance,Uint8Array,Uint32Array,Float32Array,Float64Array,Map,Set,Math};context.window=context;context.globalThis=context;vm.createContext(context);
 for(const file of SHADERS)vm.runInContext(await fs.readFile(path.join(repo,file),'utf8'),context,{filename:file});
 const overview={sourcePaths,vertexSha256:await R.sha256(new TextEncoder().encode(context.SphereShaders.vertex)),fragmentSha256:await R.sha256(new TextEncoder().encode(Overview.assemble(context.SphereShaders.fragment)))};
 const paths=[...new Set([...B.SOURCE_PATHS,'biome-service/publication.v2.js','biome-service/bounded-storage.v1.js','biome-service/main-install.v4.js',...sourcePaths])].sort(),serviceClosure=[];
 for(const p of paths){const b=new Uint8Array(await fs.readFile(path.join(repo,p)));serviceClosure.push({path:p,bytes:b.length,sha256:await R.sha256(b)});}
 const profile={format:'sphere-main-install-profiles/4',provider:old.provider,codec:old.codec,hostClosure:old.hostClosure,serviceClosure,overview};
 await fs.writeFile(path.join(repo,'biome-service/main-install-profiles.v4.json'),R.canonicalBytes(profile));
 console.log(JSON.stringify({status:'GENERATED',providerDigest:old.provider.digest,serviceEntries:serviceClosure.length,packReleaseBytes:'UNCHANGED',builderProfile:B.PROFILE_ID}));return profile;
}
module.exports={build,SHADERS};if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
