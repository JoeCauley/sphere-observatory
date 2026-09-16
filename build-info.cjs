/* Served locally with each fresh page. Never infer a release from a version string. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
module.exports=function buildInfo(root=__dirname){
 const hash=crypto.createHash('sha256'),files=fs.readdirSync(root).filter(f=>/\.(js|cjs|css|html)$/.test(f)||f==='package.json').sort();
 for(const file of files){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file)));}
 const git=args=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}};
 const commit=git(['rev-parse','HEAD']),changes=git(['status','--porcelain','--untracked-files=normal']);
 const manifests=[],assetSet=crypto.createHash('sha256');let assetCount=0;function scan(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(folder,item.name);if(item.isDirectory())scan(file);else{const name=path.relative(root,file).replaceAll('\\','/'),sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assetSet.update(name+'\0'+sha256+'\n');assetCount++;if(item.name==='manifest.json')manifests.push({path:name,sha256});}}}
 scan(path.join(root,'assets'));
 return {version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,commit,sourceSha256:hash.digest('hex'),status:changes===null?'unverified-local':changes?'local-modified':'clean-checkout',release:false,assets:manifests,assetSetSha256:assetSet.digest('hex'),assetCount};
};
