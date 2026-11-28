'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

const signature = Buffer.from([137,80,78,71,13,10,26,10]);
function pngSize(bytes) {
  if (bytes.length < 45 || !bytes.subarray(0,8).equals(signature) ||
      bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii',12,16) !== 'IHDR') return null;
  const width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20);
  if (!width || !height || width*height > 64*1024*1024) return null;
  let image=false;
  for (let offset=8; offset+12<=bytes.length;) {
    const size=bytes.readUInt32BE(offset), type=bytes.toString('ascii',offset+4,offset+8);
    offset+=12+size;
    if (offset>bytes.length) break;
    if (type==='IDAT' && size) image=true;
    if (type==='IEND') return !size && image && offset===bytes.length ? {width,height} : null;
  }
  return null;
}

async function saveScreenshot(req,res,root,reply) {
  const host=req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || req.headers.origin!=='http://'+host)
    return reply(res,403,{error:'Open the camera in the local Observatory.'});
  if (req.method!=='POST') return reply(res,405,{error:'POST required.'});
  if (req.headers['content-type']!=='image/png') return reply(res,415,{error:'A PNG is required.'});
  const chunks=[]; let bytes=0;
  for await (const chunk of req) {
    bytes+=chunk.length;
    if (bytes>128*1024*1024) return reply(res,413,{error:'The image exceeds the field camera limit.'});
    chunks.push(chunk);
  }
  const image=Buffer.concat(chunks), size=pngSize(image);
  if (!size) return reply(res,400,{error:'The PNG was incomplete or its dimensions are unsupported.'});
  const folder=path.join(root,'Screenshots');
  const name='Sphere-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.png';
  const temporary=path.join(folder,name+'.writing');
  let writing=false;
  try {
    await fs.mkdir(folder,{recursive:true});
    if ((await fs.lstat(folder)).isSymbolicLink()) throw Error('Screenshot directory is redirected.');
    const handle=await fs.open(temporary,'wx');
    writing=true;
    try {await handle.writeFile(image);} finally {await handle.close();}
    await fs.rename(temporary,path.join(folder,name));
    writing=false;
    return reply(res,201,{name,bytes:image.length,...size});
  } catch {
    return reply(res,500,{error:'Could not write Screenshots in the served checkout.'});
  } finally {
    if(writing)await fs.unlink(temporary).catch(()=>{});
  }
}
module.exports={saveScreenshot};
