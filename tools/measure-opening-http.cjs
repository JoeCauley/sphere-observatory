// Time the HTML and bootstrap responses that compete with the build fingerprint at launch.
'use strict';
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const {fork}=require('node:child_process');
const {once}=require('node:events');

async function opening(root,scratch){
  const child=fork(path.join(root,'serve.cjs'),['0'],{cwd:root,stdio:['ignore','ignore','inherit','ipc'],
    windowsHide:true,env:{...process.env,SPHERE_INSTALL_STORE:path.join(scratch,'installed.json')}});
  try{
    const [message]=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('Server exited before listening');})]);
    const origin='http://127.0.0.1:'+message.port,start=performance.now();
    async function request(file){
      const response=await fetch(origin+file);if(!response.ok)throw Error(file+' returned '+response.status);
      if(!(await response.arrayBuffer()).byteLength)throw Error('Empty response for '+file);
      return performance.now()-start;
    }
    const [fingerprintMs,htmlMs,bootstrapMs]=await Promise.all([request('/build-info.json'),request('/'),request('/bootstrap.js')]);
    return {shellMs:Math.max(htmlMs,bootstrapMs),fingerprintMs};
  }finally{if(child.exitCode===null){const closed=once(child,'exit');child.kill();await closed;}}
}
(async()=>{
  const root=path.resolve(__dirname,'..'),roots=process.argv[2]?[path.resolve(process.argv[2]),root]:[root];
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'observatory-http-timing-'));
  try{
    const results=roots.map(()=>[]),med=xs=>xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)];
    for(let trial=0;trial<7;trial++){
      const order=roots.map((_,i)=>i);if(trial%2)order.reverse();
      for(const i of order)results[i].push(await opening(roots[i],scratch));
    }
    const report=results.map(samples=>({medianShellMs:med(samples.map(s=>s.shellMs)),medianFingerprintMs:med(samples.map(s=>s.fingerprintMs)),samples}));
    console.log(JSON.stringify(report,null,2));
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
