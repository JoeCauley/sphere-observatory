/* Compile the frozen design schemas; imported packs never supply executable validators. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Ajv=require('ajv/dist/2020').default,standalone=require('ajv/dist/standalone').default,esbuild=require('esbuild');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'biome-service'),schemaDir=path.join(dir,'schemas');
const names=['core','manifest','release','host-world','world-policy','assignment','world-binding','installation-plan','session'];
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const schemaInputs=names.map(name=>{const raw=fs.readFileSync(path.join(schemaDir,name+'.schema.json'));return {name,raw,schema:JSON.parse(raw),sha256:sha(raw)};});
// strictTypes/strictRequired are lint restrictions, not validation semantics. The sealed
// plan uses conditional properties without restating type and required in every branch.
const ajv=new Ajv({allErrors:false,strict:true,strictTypes:false,strictRequired:false,ownProperties:true,code:{source:true},schemas:schemaInputs.map(row=>row.schema)});
const exportsMap=Object.fromEntries(schemaInputs.filter(row=>row.name!=='core').map(row=>[row.name,row.schema.$id]));
for(const name of ['address','frame','grid','cell','provider','head']){const id='urn:sphere:biome-service:1:validation-'+name;ajv.addSchema({$id:id,$ref:'urn:sphere:biome-service:1:core#/$defs/'+name});exportsMap[name]=id;}
const source=standalone(ajv,exportsMap);
const bundled=esbuild.buildSync({stdin:{contents:source,resolveDir:repo,sourcefile:'schema-validators.generated.cjs',loader:'js'},bundle:true,write:false,format:'iife',globalName:'SphereBiomeSchemaValidators',platform:'browser',target:'es2020',legalComments:'inline',banner:{js:'/* Generated from nine exact Phase One design schemas. Do not edit. */'},footer:{js:'if(typeof module!=="undefined"&&module.exports)module.exports=SphereBiomeSchemaValidators;'},metafile:true});
const output=bundled.outputFiles[0].contents;
fs.writeFileSync(path.join(dir,'schema-validators.js'),output);
const lock=JSON.parse(fs.readFileSync(path.join(repo,'package-lock.json'),'utf8'));
const closure=Object.keys(bundled.metafile.inputs).filter(file=>file.startsWith('node_modules/')).sort().map(file=>({path:file,bytes:fs.statSync(path.join(repo,file)).size,sha256:sha(fs.readFileSync(path.join(repo,file)))}));
const packages=Object.entries(lock.packages).filter(([key])=>key&&key!=='node_modules/playwright'&&key!=='node_modules/playwright-core'&&key!=='node_modules/fsevents').map(([key,value])=>({path:key,version:value.version,integrity:value.integrity||null,resolved:value.resolved||null}));
const buildToolSources=Object.keys(require.cache).filter(file=>file.startsWith(path.join(repo,'node_modules')+path.sep)).sort().map(file=>({path:path.relative(repo,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
const binaries=['node_modules/@esbuild/win32-x64/esbuild.exe','node_modules/@esbuild/win32-arm64/esbuild.exe','node_modules/@esbuild/linux-x64/bin/esbuild'].filter(file=>fs.existsSync(path.join(repo,file))).map(file=>({path:file,bytes:fs.statSync(path.join(repo,file)).size,sha256:sha(fs.readFileSync(path.join(repo,file)))}));
const licenses=['ajv','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string','esbuild'].map(name=>{const source=path.join(repo,'node_modules',name,name==='esbuild'?'LICENSE.md':'LICENSE'),target=path.join(dir,'vendor-licenses',name+'.txt'),raw=fs.readFileSync(source);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);return {package:name,path:path.relative(repo,target).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};});
const manifest={format:'sphere-biome-schema-build/1',engine:{name:'ajv',version:require('ajv/package.json').version,draft:'2020-12'},bundler:{name:'esbuild',version:esbuild.version},regenerationScript:{path:'scripts/build-biome-service-schemas.cjs',sha256:sha(fs.readFileSync(__filename))},schemaInputs:schemaInputs.map(({name,raw,sha256})=>({name,bytes:raw.length,sha256})),options:{allErrors:false,strict:true,strictTypes:false,strictRequired:false,ownProperties:true,coerceTypes:false,useDefaults:false,removeAdditional:false},generated:{path:'biome-service/schema-validators.js',bytes:output.length,sha256:sha(output)},runtimeClosure:closure,buildToolSources,binaries,licenses,packages};
fs.writeFileSync(path.join(dir,'schema-build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({engine:manifest.engine,bundler:manifest.bundler,schemas:manifest.schemaInputs.length,generated:manifest.generated,runtimeClosure:closure.length}));
