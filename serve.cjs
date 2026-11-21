// Local Observatory HTTP server. Tests can isolate installation data from the checkout.
'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { createHash } = require('node:crypto');

const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.cjs':'text/javascript', '.css':'text/css',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.webm':'video/webm',
  '.json':'application/json', '.md':'text/plain' };
const storeLimit = 1048576;
const emptyStore = () => ({ schema: 1, worlds: {} });
const validStore = value => value?.schema === 1 && value.worlds && typeof value.worlds === 'object' && !Array.isArray(value.worlds);
function reply(res, code, value, type='application/json', extra={}) {
  res.writeHead(code, {'Content-Type':type, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extra});
  res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
}
function createHandler({root=__dirname, storePath=path.join(root,'installed-biomes.json')}={}) {
  let writes = Promise.resolve(), fingerprint;
  const canonicalRoot=process.platform==='win32'?path.resolve(root).toUpperCase():path.resolve(root);
  const checkout=createHash('sha256').update(canonicalRoot).digest('hex');
  // A full source and asset fingerprint must never block the local HTTP listener.
  function buildInfo() {
    if (!fingerprint) fingerprint = new Promise((resolve,reject)=>{
      const worker = new Worker(path.join(__dirname,'build-info.cjs'), {workerData:{root}});
      worker.once('message',resolve);
      worker.once('error',reject);
      worker.once('exit',code=>{if(code)reject(Error('Build fingerprint worker exited '+code));});
    }).finally(()=>{fingerprint=null;});
    return fingerprint;
  }
  async function readStore() {
    try { const value=JSON.parse(await fs.readFile(storePath,'utf8')); if (!validStore(value)) throw Error('Invalid store'); return value; }
    catch (error) { if (error.code === 'ENOENT') return emptyStore(); throw error; }
  }
  async function installations(req,res) {
    const host=req.headers.host || '', origin=req.headers.origin;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (origin && origin!=='http://'+host)) return reply(res,403,{error:'This machine only'});
    if (req.method==='GET') { await writes; return reply(res,200,await readStore(),'application/json',{'Accept-Patch':'application/json'}); }
    if (!['PUT','PATCH'].includes(req.method)) return reply(res,405,{error:'GET, PATCH or PUT'});
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return reply(res,415,{error:'JSON required'});
    let bytes=0; const chunks=[];
    for await (const chunk of req) { bytes+=chunk.length; if(bytes>storeLimit)return reply(res,413,{error:'Too large'}); chunks.push(chunk); }
    let input;
    try { input=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(res,400,{error:'Invalid JSON'}); }
    const patch=req.method==='PATCH';
    if (patch ? !(/^sphere-[0-9a-f]{16}$/.test(input?.key) && input?.parameters && Array.isArray(input?.before) && Array.isArray(input?.installed)) : !validStore(input)) return reply(res,400,{error:'Invalid installation update'});
    const write=async()=>{
      let next=input;
      if(patch) {
        next=await readStore();
        if(JSON.stringify(next.worlds[input.key]?.installed ?? [])!==JSON.stringify(input.before)) return reply(res,409,next);
        next.worlds[input.key]={parameters:input.parameters,installed:input.installed};
      }
      const data=JSON.stringify(next,null,1)+'\n';
      if(Buffer.byteLength(data)>storeLimit)return reply(res,413,{error:'Store is full'});
      await fs.writeFile(storePath+'.writing',data);
      await fs.rename(storePath+'.writing',storePath);
      reply(res,200,patch ? next : {saved:true});
    };
    const pending=writes.then(write); writes=pending.catch(()=>{}); await pending;
  }
  return async function handle(req,res) {
    let name;
    try { name=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { return reply(res,400,'Invalid path','text/plain'); }
    try {
      if(name==='/api/health')return reply(res,200,{service:'sphere-observatory',checkout,pid:process.pid});
      if(name==='/api/installed-biomes')return await installations(req,res);
      if(name==='/api/border-stations'){
        const {stationEndpoint}=await import('./biome-service/border-station-store.mjs');
        return await stationEndpoint(req,res,storePath,reply,readStore);
      }
      if(name==='/build-info.json')return reply(res,200,await buildInfo());
      const file=path.resolve(root,'.'+((name==='/'||name==='/,')?'/index.html':name));
      if(!file.startsWith(root+path.sep))return reply(res,403,'Forbidden','text/plain');
      const type=types[path.extname(file)]||'application/octet-stream';
      const stat=await fs.stat(file,{bigint:true});
      if(!stat.isFile())return reply(res,404,'Not found','text/plain');
      const etag='W/"'+stat.size.toString(16)+'-'+stat.mtimeNs.toString(16)+'"';
      const headers={'Cache-Control':'no-cache',ETag:etag};
      const validators=(req.headers['if-none-match']||'').split(/,\s*/);
      if(['GET','HEAD'].includes(req.method) && validators.some(tag=>tag==='*'||tag.replace(/^W\//,'')===etag.slice(2))){
        res.writeHead(304,headers);return res.end();
      }
      if(req.method==='HEAD'){res.writeHead(200,{...headers,'Content-Type':type,'Content-Length':String(stat.size)});return res.end();}
      return reply(res,200,await fs.readFile(file),type,headers);
    } catch(error) { const gone=error.code==='ENOENT'||error.code==='EISDIR'; return reply(res,gone?404:500,gone?'Not found':'Observatory request failed','text/plain'); }
  };
}
module.exports={createHandler};
if(require.main===module) {
  const port=Number(process.argv[2] ?? 8766);
  const root=__dirname,storePath=process.env.SPHERE_INSTALL_STORE || path.join(root,'installed-biomes.json');
  const server=http.createServer(createHandler({root,storePath}));
  server.listen(port,'127.0.0.1',()=>{const address=server.address();console.log('Sphere Observatory: http://127.0.0.1:'+address.port);process.send?.({port:address.port});});
}
