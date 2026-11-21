import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {addressOf,generateStation} from '../packs/border-transport/0.10.0/station.mjs';

export async function resolveStation(directory,address,enter=false,generate=generateStation) {
  const hash=createHash('sha256').update(address.key).digest('hex');
  const bucket=path.join(directory,hash+'.station'),legacy=path.join(directory,hash+'.json');
  const read=async()=>{
    for(const file of [path.join(bucket,'record.json'),legacy]){
      let value;
      try{value=await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
      const record=JSON.parse(value);
      if(record.station?.schema!==1 || record.station.address.key!==address.key)throw Error('Invalid station record');
      return {...record,locked:true};
    }
    return null;
  };
  const previous=await read();if(previous)return previous;
  const station=generate(address);
  if(!enter)return {station,locked:false,discoveredAt:null};
  await fs.mkdir(directory,{recursive:true});
  const temp=path.join(directory,randomUUID()+'.pending'),file=path.join(temp,'record.json');
  await fs.mkdir(temp);
  let published=false;
  try{
    await fs.writeFile(file,JSON.stringify({station,discoveredAt:new Date().toISOString()}),{flag:'wx'});
    // A nonempty directory cannot replace another nonempty directory. A complete record wins atomically
    // even on installation volumes that prohibit hard links. Readers never observe the temporary file.
    try{await fs.rename(temp,bucket);published=true;}
    catch(e){const winner=await read();if(winner)return winner;throw e;}
    return await read();
  }finally{
    if(!published){await fs.rm(file,{force:true});await fs.rmdir(temp);}
  }
}

export async function stationEndpoint(req,res,storePath,reply,readStore) {
  const host=req.headers.host||'',origin=req.headers.origin;
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||(origin&&origin!=='http://'+host))
    return reply(res,403,{error:'This machine only'});
  if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'Use GET to preview or POST to enter'});
  const q=new URL(req.url,'http://localhost').searchParams;
  let address;
  try{
    const ordinal=q.get('bay');
    if(!/^-?(0|[1-9]\d*)$/.test(ordinal??''))throw Error('Invalid station index');
    const world=q.get('world'),params=(await readStore()).worlds[world]?.parameters;
    address=addressOf(world,q.get('a'),q.get('b'),Number(ordinal),params?.radius>0?params.radius*1000:undefined);
  }catch(e){return reply(res,400,{error:e.message});}
  const entry=await resolveStation(storePath+'.border-atlas',address,req.method==='POST');
  return reply(res,200,entry);
}
