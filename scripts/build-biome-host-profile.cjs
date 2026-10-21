/* Generate exact admitted current-host source identity. Never writes old evidence. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const repo=path.resolve(__dirname,'..'),R=require('../biome-service/records.js'),H=require('../biome-service/host-world.js'),N=require('../biome-service/numeric-profile.js');
// The complete admitted codec/query closure. Browser startup must retain this order.
const moduleOrder=[...H.MODULE_ORDER];
async function buildProfile({numericQualification}={}){
 numericQualification=numericQualification??await N.capture();numericQualification=R.deepFreeze({digest:numericQualification.digest,body:await R.verifyEnvelope(numericQualification)});N.validate(numericQualification.body);
 const closure=[];for(const entry of [...moduleOrder].sort()){const bytes=new Uint8Array(await fs.readFile(path.join(repo,entry)));closure.push({path:entry,bytes:bytes.byteLength,sha256:await R.sha256(bytes)});}
 const body={format:H.PROFILE_FORMAT,id:H.PROFILE_ID,addressProfile:H.ADDRESS_PROFILE,numericProfile:H.NUMERIC_PROFILE,numericQualification,timeProfile:'sphere-clock-v1',staticParameterKeys:[...H.STATIC_KEYS],moduleOrder,closure,mandatoryExclusionProfiles:['wound-apertures-v1','authored-sites-v1','polar-ports-v1'],capabilities:['host.static-world','host.shell-address','host.fixed-frame','host.legacy-surface','host.physical-light']};
 H.validateProfile(body);return R.envelope(body);
}
async function main(){
 const args=process.argv.slice(2),output=args.shift();if(!output||!path.isAbsolute(output))throw Error('Provide an absolute fresh output directory');let numericQualification;
 if(args.length){if(args.length!==2||args[0]!=='--numeric-qualification'||!path.isAbsolute(args[1]))throw Error('Use --numeric-qualification followed by an absolute retained qualification path');numericQualification=R.parse(new Uint8Array(await fs.readFile(args[1])));}
 const dir=path.resolve(output);await fs.mkdir(dir,{recursive:true});const profile=await buildProfile({numericQualification}),json=R.canonicalJSON(profile)+'\n';
 await fs.writeFile(path.join(dir,'observatory-host-profile.json'),json,{flag:'wx'});
 await fs.writeFile(path.join(dir,'observatory-host-profile.js'),'/* Generated exact native host profile; source closure is verified before admission. */\n(function(root){"use strict";const profile='+R.canonicalJSON(profile)+';root.SphereBiomeHostProfile=profile;if(typeof module!=="undefined")module.exports=profile;})(typeof window==="undefined"?globalThis:window);\n',{flag:'wx'});
 console.log(JSON.stringify({status:'GENERATED',digest:profile.digest,numericQualificationDigest:profile.body.numericQualification.digest,numericEngine:profile.body.numericQualification.body.engine,runtimeAdmission:'NOT_PERFORMED_BY_PROFILE_GENERATOR',entries:profile.body.closure.length,bytes:profile.body.closure.reduce((sum,item)=>sum+item.bytes,0),directory:dir}));
}
module.exports={buildProfile,moduleOrder};if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
