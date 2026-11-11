'use strict';
// Package the compiled fixture through the same exact directory catalogue used by ingestion.
const fs=require('node:fs/promises'),path=require('node:path');
const repo=path.resolve(__dirname,'..'),R=require('../biome-service/records.js'),P=require('../biome-service/provider-profiles.js'),B=require('../biome-service/binding-builder.js'),C=require('../biome-service/commonboundary-adapter.js'),H=require('../biome-service/host-world.js');
const factory=require('../biome-service/native/providers/fixture-track-meadow.js');
const nativePaths=['binary64-sampler','boundary-shader','composition-model','direction-halo','fixture-definition','fixture-recipe','legacy-base','native-distance','positions-backend','provider-host','resource-leases','static-geometry','surface-bounds','surface-differential','surface-kernel','terrain-mesh'].map(p=>'biome-service/native/'+p+'.js');
async function build(){
 const template=JSON.parse(await fs.readFile(path.join(repo,'tests/fixtures/biome-service/native/fixture-track-meadow.manifest-shape.json'),'utf8'));
 const recipe=JSON.parse(await fs.readFile(path.join(repo,'tests/fixtures/biome-service/native/fixture-track-meadow.recipe.json'),'utf8'));
 const paths=[...new Set([...B.SOURCE_PATHS,...C.NATIVE_SOURCE_PATHS,...nativePaths,'biome-service/native/providers/fixture-track-meadow.js','biome-service/native/source-admission.js'])].sort(),closure=[];
 for(const p of paths){const bytes=new Uint8Array(await fs.readFile(path.join(repo,p)));closure.push({path:p,bytes:bytes.length,sha256:await R.sha256(bytes)});}
 const provider=await P.makeProfile({format:P.PROFILE,id:factory.extensionId,abi:factory.abi,backendProfile:factory.backendProfile,entryPath:'biome-service/native/providers/fixture-track-meadow.js',closure,recipeSchemaIds:[factory.recipeSchemaId],capabilities:factory.supportedCapabilities,representationProfiles:template.representations.map(r=>r.profileId),fallbackProfiles:[template.fallback.profileId],revealProfiles:[template.presentation.revealProfileId],stateCodecs:[template.persistence]});
 const configured=factory.configure(provider),codec=await R.envelope(C.validateProfile({format:C.FORMAT,id:factory.extensionId+'-support-v1',abi:C.ABI,provider:configured.reference,recipeSchemaId:factory.recipeSchemaId,entryPath:provider.body.entryPath,closure,boundaryProfile:C.NATIVE_BOUNDARY,supportedConnectors:['terrain.heightfield','structure.box','structure.triangle'],maximumRecipeBytes:65536,stateCodecs:[template.persistence],presentationModes:[template.presentation.mode]}));
 const manifest={...template,version:'1.0.0',name:'Track Meadow',description:'A shade-track meadow with three landmarks. The Sphere assigns its place when installed.',provider:configured.reference};
 const recipeBytes=R.canonicalBytes(recipe);manifest.assets[0]={...manifest.assets[0],bytes:recipeBytes.length,sha256:await R.sha256(recipeBytes)};
 factory.validateRecipe(recipe,manifest);R.validateManifest(manifest);
 const raw=R.canonicalBytes(manifest),release={format:'sphere-biome-release/1',descriptorFormat:'sphere-biome-pack/1',manifestPath:'manifest.json',manifestBytes:raw.length,manifestSha256:await R.sha256(raw),payloadDigest:await R.payloadDigest(raw)};
 const directory='packs/fixture-track-meadow/1.0.0/',releaseBytes=R.canonicalBytes(release);
 await fs.mkdir(path.join(repo,directory,'assets'),{recursive:true});
 await fs.writeFile(path.join(repo,directory,'manifest.json'),raw);await fs.writeFile(path.join(repo,directory,'release.json'),releaseBytes);await fs.writeFile(path.join(repo,directory,manifest.assets[0].path),recipeBytes);
 const catalogue=JSON.parse(await fs.readFile(path.join(repo,'packs/catalogue.v1.json'),'utf8'));
 const existing=catalogue.entries.find(e=>e.packId===manifest.packId&&e.version===manifest.version);
 const entry={packId:manifest.packId,version:manifest.version,payloadDigest:release.payloadDigest,manifestPath:directory+'manifest.json',manifestBytes:raw.length,manifestSha256:release.manifestSha256,releasePath:directory+'release.json',releaseBytes:releaseBytes.length,releaseSha256:await R.sha256(releaseBytes)};
 if(existing&&existing.payloadDigest!==entry.payloadDigest)throw Error('An existing exact version must not be replaced; select a new version.');
 if(!existing)catalogue.entries.push(entry);
 await fs.writeFile(path.join(repo,'packs/catalogue.v1.json'),R.canonicalBytes(catalogue));
 await fs.writeFile(path.join(repo,'biome-service/main-install-profiles.v1.json'),R.canonicalBytes({format:'sphere-main-install-profiles/1',provider,codec,hostClosure:closure.filter(e=>H.MODULE_ORDER.includes(e.path))}));
 console.log(JSON.stringify({packId:manifest.packId,version:manifest.version,payloadDigest:release.payloadDigest,providerDigest:provider.digest,sourceEntries:closure.length}));
}
module.exports={build};if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
