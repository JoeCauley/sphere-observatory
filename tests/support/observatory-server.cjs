'use strict';
const {fork}=require('node:child_process');
const {Readable}=require('node:stream');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {once}=require('node:events');
const root=path.resolve(__dirname,'../..');

if(require.main===module) {
  // Restricted runners can exercise the identical handler and on-disk store over IPC.
  // The real loopback transport remains the default for the restart test.
  const handler=require('../../serve.cjs').createHandler({root,storePath:process.env.SPHERE_INSTALL_STORE});
  process.on('message',async m=>{
    try{
      const req=Readable.from(m.body ? [Buffer.from(m.body,'base64')] : []);
      Object.assign(req,{url:m.path,method:m.method,headers:m.headers});
      const res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},
        end(data){process.send({id:m.id,status:this.status,headers:this.headers,body:Buffer.from(data||'').toString('base64')});}};
      await handler(req,res);
    }catch(e){process.send({id:m.id,error:e.message});}
  });
  process.send({ready:true});
}
async function start({transport='http',port=0,storePath}={}) {
  if(!storePath)throw Error('A disposable install store is required');
  const ipc=transport==='ipc';
  const child=fork(ipc?__filename:path.join(root,'serve.cjs'),ipc?[]:[String(port)],{
    cwd:root,stdio:['ignore','ignore','inherit','ipc'],windowsHide:true,env:{...process.env,SPHERE_INSTALL_STORE:storePath}});
  const waiting=new Map();let next=0;
  const initial=await Promise.race([once(child,'message').then(v=>v[0]),once(child,'exit').then(([code])=>{throw Error('Test server exited '+code);})]);
  const origin='http://127.0.0.1:'+(ipc?(port||18766):initial.port);
  child.on('message',m=>{const listener=waiting.get(m.id);if(!listener)return;waiting.delete(m.id);
    if(m.error)listener.reject(Error(m.error));else listener.resolve({status:m.status,headers:m.headers,body:Buffer.from(m.body,'base64')});});
  child.on('exit',()=>{for(const w of waiting.values())w.reject(Error('Test server exited'));waiting.clear();});
  function dispatch(url,method='GET',headers={},body=null) {
    const u=new URL(url,origin);
    if(u.origin!==origin)throw Error('Unexpected fixture origin');
    if(!ipc)return fetch(u,{method,headers,body}).then(async r=>({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())}));
    return new Promise((resolve,reject)=>{const id=++next;waiting.set(id,{resolve,reject});child.send({id,path:u.pathname+u.search,method,headers:{...headers,host:u.host},body:body?.toString('base64')});});
  }
  return {origin,port:Number(new URL(origin).port),dispatch,
    async attach(context){if(ipc)await context.route(origin+'/**',async route=>{const q=route.request();try{await route.fulfill(await dispatch(q.url(),q.method(),q.headers(),q.postDataBuffer()));}catch(e){await route.abort().catch(()=>{});}});},
    async close(){if(child.exitCode!==null||child.signalCode)return;const closed=once(child,'exit');child.kill();await closed;}
  };
}
async function disposable(transport='ipc') {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sphere-fixture-'));
  const host=await start({transport,storePath:path.join(dir,'installed.json')});
  return {...host,async close(){await host.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
module.exports={start,disposable};
