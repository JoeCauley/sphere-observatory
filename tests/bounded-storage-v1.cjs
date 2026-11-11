'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
const IO=require('../biome-service/bounded-storage.v1.js'),S=require('../biome-service/storage.js'),Q=require('../biome-service/metadata-budget.js'),R=require('../biome-service/records.js');
async function main(){
 const raw=await S.open({indexedDB:new IDBFactory()}),budget=Q.create(),workspace=budget.reserve(IO.WORKSPACE,{owner:'main-install',phase:'bounded-working-slot'}),baseline=budget.inspect().heldBytes;
 const io=IO.create(raw,(bytes,details)=>budget.reserve(bytes,details)),storage=io.storage;
 const bytes=new ArrayBuffer(400000),seed={bytes,tag:'original'};
 await raw.transaction(['resources'],'readwrite',ctx=>ctx.store('resources').put(seed,'seed'));
 let during,delivered;
 await storage.transaction(['resources'],'readwrite',ctx=>ctx.request(ctx.store('resources').get('seed'),row=>{
  delivered=row;const before=budget.inspect().heldBytes;ctx.store('resources').put({...row,tag:'updated'},'seed');
  during=budget.inspect().heldBytes;assert(during>before+bytes.byteLength*2,'write clone has its own reservation');
  assert(during<before+bytes.byteLength*3,'same source buffer is shared by identity');
  ctx.setResult(row);assert(budget.inspect().heldBytes>=during,'setResult cannot retire earlier owners');
 }));
 assert.equal(budget.inspect().heldBytes,baseline);assert.equal(io.inspect().sourceBufferBytes,bytes.byteLength);assert.equal(io.inspect().writeCopyBytes,bytes.byteLength);assert(io.inspect().bufferAliasUses>=2);
 assert.equal((await raw.get('resources','seed')).tag,'updated');assert.equal(delivered.tag,'original','retained caller read remains intact');
 const heldBeforeAbort=budget.inspect().heldBytes;
 await assert.rejects(()=>storage.transaction(['resources'],'readwrite',ctx=>{ctx.store('resources').put(seed,'aborted');assert(budget.inspect().heldBytes>heldBeforeAbort);ctx.abort(R.error('CANCELLED','test cancellation'));}),e=>e.code==='CANCELLED');
 assert.equal(await raw.get('resources','aborted'),undefined);assert.equal(budget.inspect().heldBytes,baseline);
 await assert.rejects(()=>storage.transaction(['resources'],'readwrite',ctx=>{
  for(let i=0;i<40;i++)ctx.store('resources').put({bytes},'cap-'+i);
 }),e=>e.code==='RESOURCE_LIMIT'&&e.details.limitBytes===33554432);
 assert.equal(await raw.get('resources','cap-0'),undefined,'cap failure rolls back the complete transaction');assert.equal(budget.inspect().heldBytes,baseline);
 const slice=new Uint8Array(new ArrayBuffer(IO.MAX_ROW+1),0,1);
 await assert.rejects(()=>storage.transaction(['resources'],'readwrite',ctx=>ctx.store('resources').put({slice},'slice')),e=>e.code==='RESOURCE_LIMIT');
 assert.equal(await raw.get('resources','slice'),undefined,'a small view cannot hide its larger backing buffer');
 await assert.rejects(()=>storage.transaction(['resources'],'readwrite',ctx=>{ctx.store('resources').put({bytes:bytes.slice(0)},'distinct-a');ctx.store('resources').put({bytes:bytes.slice(0)},'distinct-b');throw R.error('VERSION_CONFLICT','test rollback');}),e=>e.code==='VERSION_CONFLICT');
 assert.equal(await raw.get('resources','distinct-a'),undefined);assert.equal(budget.inspect().heldBytes,baseline);
 let alias=IO.measure({a:bytes,b:bytes});assert.equal(alias.bufferBytes,bytes.byteLength);assert.equal(IO.measure({a:bytes,b:bytes.slice(0)}).bufferBytes,bytes.byteLength*2);
 assert.equal(io.inspect().activeTransactions,0);workspace.release();budget.dispose();assert.equal(budget.inspect().heldBytes,0);raw.close();
 console.log(JSON.stringify({status:'PASS',revision:IO.REVISION,checks:['source identity retained once','each write clone separately paid','all charges retained until complete','retained reader unchanged','abort rollback and charge release','unchanged aggregate cap refuses repeated writes','cap failure atomically rolls back','view pays complete backing buffer','different buffers remain distinct','all owners close to zero'],observed:io.inspect(),scope:'LOGICAL_OWNERSHIP_NATIVE_HEAP_UNMEASURED'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
