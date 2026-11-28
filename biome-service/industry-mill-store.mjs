import fs from 'node:fs/promises';
import path from 'node:path';
import {emptyProduction,millAddress} from '../packs/kit/rolling-mill.mjs';
import {transact} from '../packs/kit/mill-transaction.mjs';
import {transfer} from '../packs/infinite-industry/1.4.1/transfer.js';

export function millEndpoint(storePath, readInstallations, reply) {
  let writes = Promise.resolve();
  const directory = storePath + '.industry-mills';
  async function load(file) {
    try {
      const state = JSON.parse(await fs.readFile(file,'utf8'));
      if (state.schema !== 1 || !Number.isSafeInteger(state.atMs) || state.atMs < 0 ||
          !state.machines || Array.isArray(state.machines) || typeof state.machines !== 'object') throw Error('Invalid mill journal');
      return state;
    } catch (e) { if (e.code === 'ENOENT') return emptyProduction(); throw e; }
  }
  return async (req,res) => {
    const host=req.headers.host,origin=req.headers.origin;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (origin && origin !== 'http://'+host)) return reply(res,403,{error:'Local tester only'});
    const url = new URL(req.url,'http://localhost'), world = url.searchParams.get('world');
    if (!/^sphere-[0-9a-f]{16}$/.test(world)) return reply(res,400,{error:'Unknown world address'});
    const file = path.join(directory,world+'.json');
    const installed = (await readInstallations()).worlds[world]?.installed ?? [];
    if (!installed.some(i=>i.packId==='infinite-industry')) return reply(res,404,{error:'Industry is not installed in this world'});
    if (req.method === 'GET') { await writes; return reply(res,200,{state:await load(file)}); }
    if (req.method !== 'POST') return reply(res,405,{error:'GET or POST required'});
    if (!/^application\/json\b/.test(req.headers['content-type']||'')) return reply(res,415,{error:'JSON required'});
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)return reply(res,413,{error:'Command exceeds 4 KiB'});chunks.push(chunk);}
    let request;
    try { request=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(res,400,{error:'Invalid JSON'}); }
    if (!request || typeof request !== 'object') return reply(res,400,{error:'Invalid command'});
    const item = installed.find(i=>i.id===request.instance && i.packId==='infinite-industry' && i.detailInstalled!==false);
    const address = item && millAddress(world,item.id,transfer.destination);
    if (request.verb!=='clock' && (!address || request.address!==address)) return reply(res,400,{error:'Unknown mill address'});
    async function update(){
      const previous=await load(file);
      let result;
      try { result=transact(previous,request,address); } catch(e){return reply(res,400,{error:e.message});}
      if(result.state!==previous){
        await fs.mkdir(directory,{recursive:true});
        const tmp=file+'.writing';
        await fs.writeFile(tmp,JSON.stringify(result.state)+'\n');
        await fs.rename(tmp,file);
      }
      return reply(res,result.rejected?409:200,result);
    }
    const pending=writes.then(update);writes=pending.catch(()=>{});await pending;
  };
}
