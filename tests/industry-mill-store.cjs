'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {start}=require('./support/observatory-server.cjs');
(async()=>{
 const {millAddress,counts,millAt,remainingMs}=await import('../packs/kit/rolling-mill.mjs');
 const {transfer}=await import('../packs/infinite-industry/1.4.1/transfer.js');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sphere-mill-')),file=path.join(dir,'installed.json');
 const world='sphere-ed6a59ab491a9a08',other='sphere-aa6a59ab491a9a08',instance='infinite-industry';
 const installed=[instance,'annex'].map(id=>({id,packId:instance,version:'1.4.1'}));
 await fs.writeFile(file,JSON.stringify({schema:1,worlds:{[world]:{installed},[other]:{installed}}}));
 const address=millAddress(world,instance,transfer.destination);let server=await start({storePath:file}),seq=0;
 async function request(body,which=world,status=200){
  const resp=await fetch(server.origin+'/api/industry-mills?world='+which,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const result=await resp.json();assert.equal(resp.status,status,JSON.stringify(result));return result;
 }
 const op=(verb,atMs,expected)=>({verb,atMs,expected,address,instance,id:'op-'+(++seq)});
 const record=state=>millAt(state.machines[address],state.atMs);
 try{
  for(const w of [world,other])assert.deepEqual((await request(null,w)).state.machines,{});
  assert.equal(await fs.stat(file+'.industry-mills').catch(()=>null),null);
  const first=op('feed',0,0);const begun=await request(first);assert.deepEqual(counts(record(begun.state)),[2,1,0,0]);
  assert((await request(first)).duplicate);
  const paused=await request(op('pause',22500,1));assert.equal(remainingMs(record(paused.state),22500),22500);
  await server.close();server=await start({storePath:file});
  const again=await request();assert.deepEqual(again.state,paused.state);
  await request(op('resume',22500,2));const one=await request({verb:'clock',atMs:45000});
  assert.deepEqual(counts(record(one.state)),[2,0,1,0]);
  const shipped=await request(op('dispatch',45000,3));const disk=path.join(file+'.industry-mills',world+'.json'),good=await fs.readFile(disk,'utf8');
  assert((await request(first)).duplicate);assert.equal((await request(op('feed',44999,0),world,409)).state.atMs,45000);
  await request({...op('feed',45001,4),address:'invalid'},world,400);await request({verb:'clock',atMs:-1},world,400);
  for(const id of [undefined,null,12,true,['valid-looking']])await request({...op('feed',45001,4),id},world,400);
  assert.equal(await fs.readFile(disk,'utf8'),good);
  const next=op('feed',45000,4);await Promise.all([request(next),request(next)]);
  const last=record((await request({verb:'clock',atMs:90000})).state);assert.deepEqual(counts(last),[1,0,1,1]);
  assert.deepEqual(shipped.state.machines[address].shipped,last.shipped);
  const annex=millAddress(world,'annex',transfer.destination);
  await request({...op('feed',90000,0),instance:'annex',address:annex});
  assert.equal(Object.keys((await request()).state.machines).length,2);
  assert.deepEqual((await request(null,other)).state.machines,{});
  console.log('PASS service restart at 22.500 s, atomic actions, concurrent retry, stale and invalid writes, distinct worlds and instances');
 }finally{await server.close();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
