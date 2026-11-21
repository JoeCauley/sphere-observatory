import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {addressOf,generateStation} from './station.mjs';

export async function resolveStation(directory,address,enter=false,generate=generateStation) {
  const filename=createHash('sha256').update(address.key).digest('hex')+'.json';
  const target=path.join(directory,filename);
  const read=async()=>{
    const record=JSON.parse(await fs.readFile(target,'utf8'));
    if(record.station?.schema!==1 || record.station.address.key!==address.key)throw Error('Invalid station record');
    return record;
  };
  try{return {...await read(),locked:true};}catch(e){if(e.code!=='ENOENT')throw e;}
  const station=generate(address);
  if(!enter)return {station,locked:false,discoveredAt:null};
  await fs.mkdir(directory,{recursive:true});
  const temp=path.join(directory,randomUUID()+'.tmp');
  const record={station,discoveredAt:new Date().toISOString()};
  try{
    await fs.writeFile(temp,JSON.stringify(record),{flag:'wx'});
    // Publishing a fully written inode by link is atomic, including across local server processes.
    try{await fs.link(temp,target);}catch(e){if(e.code!=='EEXIST')throw e;}
    return {...await read(),locked:true};
  }finally{await fs.rm(temp,{force:true});}
}

export async function stationEndpoint(req,res,storePath,reply) {
  const host=req.headers.host||'',origin=req.headers.origin;
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||(origin&&origin!=='http://'+host))
    return reply(res,403,{error:'This machine only'});
  if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'Use GET to preview or POST to enter'});
  const q=new URL(req.url,'http://localhost').searchParams;
  let address;
  try{
    const ordinal=q.get('bay');
    if(!/^-?(0|[1-9]\d*)$/.test(ordinal??''))throw Error('Invalid station index');
    address=addressOf(q.get('world'),q.get('a'),q.get('b'),Number(ordinal));
  }catch(e){return reply(res,400,{error:e.message});}
  const entry=await resolveStation(storePath+'.border-atlas',address,req.method==='POST');
  return reply(res,200,entry);
}
