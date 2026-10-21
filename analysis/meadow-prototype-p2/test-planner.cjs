'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cfg=require('./last-run.json'),P=require('./tile-planner-p1.js'),L=require(path.join(cfg.runtime,'vegetation-lifecycle.js'));
const context={id:17},allocations=new Map(),service={current:new Map([['fixture',context]]),allocations,
 handle:r=>({reservationToken:r.token,slotStart:r.start||0,slotGeneration:r.generation||1,requestGeneration:r.context.id}),
 prepared:h=>{const r=allocations.get(h.reservationToken);return r&&r.context===context&&r.generation===h.slotGeneration&&['GPU staged','active'].includes(r.status)&&r.packet;}},
life=Object.assign(Object.create(L.ProgressiveVegetation.prototype),{service,providerId:'fixture',target:new Map(),requests:new Map(),version:1,options:{footprintMetres:4},grid:new Uint8Array(65536),gridBits:new Uint32Array(2048),footprintRows:new Uint32Array(2048),footprintBits:new Uint32Array(2048),committed:null,lastDenial:null});
const planner=new P.TilePlanner(),checks=[];
function block(id,x,z,size,tier){const regions=[];for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++)regions.push([x+dx,z+dz,x+dx+1,z+dz+1]);return {id,tier,regions};}
function request(b){life.requests.set(b.id,{block:b,regionIds:b.regions.map(bounds=>(bounds[1]+128)*256+bounds[0]+128)});for(const bounds of b.regions){const id=(bounds[1]+128)*256+bounds[0]+128;if(b.tier==='clump')life.target.set(id,{bounds,fallback:b.id,detail:null});else life.target.get(id).detail=b.id;}life.version++;}
function allocation(token,b,status='GPU staged'){const r={token,block:b,status,context,generation:1,packet:{contentHash:token}};allocations.set(token,r);return r;}
function check(name){const snapshot=planner.sync(service,life),candidate=life.candidate(),comparison=planner.compare(candidate);assert.equal(snapshot.candidateEligible,!!candidate,name+' eligibility');if(candidate){assert(comparison.matched,name+' owners/support '+JSON.stringify(comparison));assert.equal(snapshot.foregroundReady,candidate.foregroundReady,name+' readiness');}checks.push({name,snapshot,comparison});}
for(let z=-16;z<16;z+=8)for(let x=-16;x<16;x+=8){const b=block('coarse:'+x+':'+z,x,z,8,'clump');request(b);allocation('c:'+x+':'+z,b);}
check('complete cold coarse');
for(let z=-6;z<6;z+=2)for(let x=-6;x<6;x+=2){const b=block('detail:'+x+':'+z,x,z,2,'detail');request(b);allocation('d:'+x+':'+z,b);}
check('fine admission and 4m support erosion');
const stationary=planner.sync(service,life);assert.equal(stationary.dirtyRegions,0);checks.push({name:'stationary no region work',snapshot:stationary});
for(const r of allocations.values())r.status='active';life.committed={};check('activation preference');
const removed=allocations.get('d:0:0');removed.status='retired';check('fine retirement preserves coarse');
removed.status='cancelled';check('cancelled generation excluded');
removed.status='GPU staged';removed.generation++;removed.start=4096;check('slot move recompiles metadata');
const obsolete=allocation('obsolete',block('obsolete',0,0,2,'detail'),'active');obsolete.context={id:16};check('obsolete context excluded');
const corner=block('corner',124,124,4,'clump');request(corner);life.lastDenial='records limit';check('partial coverage under explicit pressure');
allocation('corner-ready',corner);check('chart edge support stays false');
const activeFallback=allocation('old-active',block('old-active',1,1,2,'clump'),'active');check('lower priority overlapping retained fallback');
allocations.delete('old-active');check('allocation released');
const invalid=new P.TilePlanner();const old=allocations.values().next().value,backup=old.block;old.block={...backup,regions:[[.5,0,1.5,1]]};assert.throws(()=>invalid.sync(service,life),/canonical/);old.block=backup;checks.push({name:'foreign noncanonical bounds rejected',pass:true});
const bounded=new P.TilePlanner();for(let i=0;i<P.limits.internedBlocks;i++)bounded.id('history:'+i);assert.throws(()=>bounded.id('overflow'),/exhausted/);checks.push({name:'interned block history cannot exceed declared physical bound',pass:true,limit:P.limits.internedBlocks});
const result={schema:1,profile:P.profile,revision:P.revision,status:'PASS_BOUNDED_SHADOW',scope:'Production candidate oracle on controlled prepared/cancelled/retired/generation fixtures; no actual GPU fences or receipt validation replaced',checks,backingBytes:planner.backingBytes,sources:[__filename,path.join(__dirname,'tile-planner-p1.js'),path.join(cfg.runtime,'vegetation-lifecycle.js')].map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
const out=path.join(cfg.evidence,'planner-unit-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,status:result.status,checks:checks.length,bytes:result.backingBytes}));
