/* Build one pinned raw decoder. ZIP structure and admission remain service-owned. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'biome-service'),sourcePath='node_modules/fflate/esm/browser.js';
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex'),raw=fs.readFileSync(path.join(repo,sourcePath));
if(JSON.parse(fs.readFileSync(path.join(repo,'node_modules/fflate/package.json'),'utf8')).version!=='0.8.2')throw Error('Pinned decoder version differs');
const needle='this.ondata(slc(dt, bts, this.s.b), this.d);';
const replacement='var emitted = slc(dt, bts, this.s.b); if (this.onmemory) this.onmemory({outputBufferBytes:dt.byteLength, emittedBytes:emitted.byteLength, pendingBufferBytes:this.p.byteLength, previousOutputBytes:this.o.byteLength}); this.ondata(emitted, this.d);';
if(raw.toString().split(needle).length!==2)throw Error('Reviewed decoder metering location differs');
const transformed=raw.toString().replace(needle,replacement)+'\nexport function retainedDecoderBytes(){const buffers=new Set([fleb,fdeb,clim,fl,fd,revfl,revfd,rev,flt,fdt,flrm,fdrm,et].map(value=>value.buffer));return Array.from(buffers).reduce((sum,value)=>sum+value.byteLength,0);}\n';
(async()=>{
const bundled=await esbuild.build({stdin:{contents:"export { Inflate, retainedDecoderBytes } from 'sphere-metered-inflate';",resolveDir:repo,loader:'js'},plugins:[{name:'exact-metered-inflate',setup(b){b.onResolve({filter:/^sphere-metered-inflate$/},()=>({path:sourcePath,namespace:'metered'}));b.onLoad({filter:/.*/,namespace:'metered'},()=>({contents:transformed,loader:'js',resolveDir:path.join(repo,'node_modules/fflate/esm')}));}}],bundle:true,write:false,format:'iife',globalName:'SphereBiomeZipCodec',platform:'browser',target:'es2020',treeShaking:true,legalComments:'inline',banner:{js:'/* fflate 0.8.2: pinned raw Inflate with byte-only accounting instrumentation. */'},footer:{js:'if(typeof module!=="undefined"&&module.exports)module.exports=SphereBiomeZipCodec;'}});
const output=bundled.outputFiles[0].contents;
fs.writeFileSync(path.join(dir,'zip-codec.js'),output);
const license=fs.readFileSync(path.join(repo,'node_modules/fflate/LICENSE'));fs.writeFileSync(path.join(dir,'vendor-licenses/fflate.txt'),license);
const lock=JSON.parse(fs.readFileSync(path.join(repo,'package-lock.json'),'utf8')),manifest={format:'sphere-biome-zip-build/1',decoder:{name:'fflate',version:'0.8.2',integrity:lock.packages['node_modules/fflate'].integrity,sourcePath,sourceBytes:raw.length,sourceSha256:sha(raw)},instrumentation:{replacement,transformedSha256:sha(transformed),semanticChange:false,purpose:'Expose actual typed-array buffer bytes before decoder callback'},bundler:{name:'esbuild',version:esbuild.version},scriptSha256:sha(fs.readFileSync(__filename)),generated:{path:'biome-service/zip-codec.js',bytes:output.length,sha256:sha(output)},license:{path:'biome-service/vendor-licenses/fflate.txt',bytes:license.length,sha256:sha(license)}};
fs.writeFileSync(path.join(dir,'zip-build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.generated));
})().catch(cause=>{console.error(cause);process.exitCode=1;});
