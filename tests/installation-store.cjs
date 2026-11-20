'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {start}=require('./support/observatory-server.cjs');
async function main(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'observatory-register-')),storePath=path.join(dir,'installed.json');
  const transport=process.env.SPHERE_TEST_TRANSPORT||'http';let port=0,host;
  const key='sphere-0123456789abcdef',other='sphere-0011223344556677';
  const params={seed:23},item=id=>({id,packId:id});
  const send=(method,data)=>host.dispatch('/api/installed-biomes',method,{'content-type':'application/json'},data?Buffer.from(JSON.stringify(data)):null);
  const patch=(world,parameters,before,installed)=>send('PATCH',{key:world,parameters,before,installed});
  const result=r=>JSON.parse(r.body);
  try{
    host=await start({port,transport,storePath});port=host.port;
    const health=result(await host.dispatch('/api/health'));assert.equal(health.service,'sphere-observatory');
    assert.match(health.checkout,/^[a-f0-9]{64}$/);assert(health.pid>0);
    const page=await host.dispatch('/');assert.equal(page.status,200);
    const tag=page.headers.etag??page.headers.ETag;assert(tag);
    const reused=await host.dispatch('/','GET',{'if-none-match':tag});
    assert.equal(reused.status,304);assert.equal(reused.body.length,0);
    assert.equal((await host.dispatch('/','GET',{'if-none-match':'"older"'})).status,200);
    const head=await host.dispatch('/','HEAD',{'if-none-match':'*'});assert.equal(head.status,304);assert.equal(head.body.length,0);
    const catalog=result(await host.dispatch('/packs/biome-library.json'));assert.equal(catalog.packs.length,4);
    assert.deepEqual(result(await send('GET')),{schema:1,worlds:{}});
    const a=item('infinite-meadow'),b=item('sideways-city');
    const [first,second]=await Promise.all([patch(key,params,[],[a]),patch(key,params,[],[b])]);
    assert.deepEqual([first.status,second.status].sort(),[200,409]);
    const seen=result(first.status===409?first:second).worlds[key].installed;
    const missing=seen[0].id===a.id?b:a;
    assert.equal((await patch(key,params,seen,[...seen,missing])).status,200);
    const [left,right]=await Promise.all([patch(other,{seed:24},[],[b]),patch(key,params,[...seen,missing],[...seen,missing,item('infinite-industry')])]);
    assert.equal(left.status,200);assert.equal(right.status,200);
    const snapshot=result(await send('GET'));
    assert.equal(snapshot.worlds[key].installed.length,3);assert.equal(snapshot.worlds[other].installed.length,1);
    assert.deepEqual(JSON.parse(fs.readFileSync(storePath)),snapshot);
    await host.close();host=null;
    host=await start({port,transport,storePath});assert.deepEqual(result(await send('GET')),snapshot);
    assert.equal((await send('PATCH',{key:'invalid',parameters:params,before:[],installed:[]})).status,400);
    assert.deepEqual(result(await send('GET')),snapshot);
    console.log('PASS '+transport+' server restart, four public entry points, concurrent world updates, conflict retry and disk round trip.');
  }finally{if(host)await host.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
