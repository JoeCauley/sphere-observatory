'use strict';
const h=require('./support/apartment-field.cjs'),{fixture}=require('./support/apartment-register.cjs');
const {assert,fs,path,pose,walk,aim,ready,mainReady,sleep}=h;
const out=process.env.SPHERE_APARTMENT_EVIDENCE;
(async()=>{
 const {dir,file}=fixture(process.env.SPHERE_APARTMENT_SEED),host=await h.start({storePath:file});
 const log={errors:[],cases:[]};let browser;
 async function enter(){
   browser=await h.chromium.launch(h.options);const p=await browser.newPage({viewport:h.viewport});
   p.on('pageerror',e=>log.errors.push(e.message));await p.goto(host.origin+'/?apartment=1A');await mainReady(p);return ready(p);
 }
 const info=f=>f.evaluate(()=>SphereBiome.inspect());
 async function atSeat(f){await walk(f,-1.55,-1.65);await walk(f,-1.46,-3.5);}
 async function press(f,key){await f.locator('#street').focus();await f.page().keyboard.press(key);}
 async function windowSpot(f){await walk(f,-1.23,-1.69);await walk(f,1.35,-1.13);}
 async function bump(f){
   const from=await pose(f);await aim(f,Math.PI/2,0);const p=f.page();await f.locator('#street').focus();
   await p.keyboard.down('KeyW');try{await sleep(900);}finally{await p.keyboard.up('KeyW');}return {from,to:await pose(f)};
 }
 try{
   let f=await enter();await atSeat(f);
   const before=await info(f);assert.equal(before.chair.target,'A');assert.equal(before.chair.revision,0);
   log.cases.push({case:'table stops walker',...await bump(f)});
   assert(log.cases.at(-1).to.eastM<-.87);
   await f.locator('#chairButton').click();assert((await info(f)).carrying);
   await f.locator('#cancelChair').click();assert(!(await info(f)).carrying);
   await press(f,'KeyE');await walk(f,-1.50,-5.8);await press(f,'KeyE');
   assert((await info(f)).carrying);assert(!fs.existsSync(file+'.furnishings'));
   await browser.close();browser=null;
   f=await enter();assert.equal((await info(f)).chair.revision,0);assert(!fs.existsSync(file+'.furnishings'));
   log.cases.push({case:'cancel, out-of-reach drop and interrupted carry',records:0});
   await atSeat(f);await press(f,'KeyE');await windowSpot(f);
   // Drop one accepted HTTP response. A retry through the same player control must reuse its action ID.
   const requests=[];
   await f.page().route('**/api/furnishings?**',async route=>{
     if(route.request().method()!=='POST')return route.continue();
     requests.push(route.request().postDataJSON());if(requests.length===1){const res=await route.fetch();assert.equal(res.status(),200);return route.abort('failed');}
     return route.continue();
   });
   await f.locator('#chairButton').click();await f.getByRole('button',{name:/Retry placement/}).waitFor();
   await press(f,'KeyE');await f.waitForFunction(()=>SphereBiome.inspect().chair.revision===1&&!SphereBiome.inspect().carrying);
   assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);
   assert.equal((await info(f)).chair.target,'B');log.cases.push({case:'lost acknowledgement',requests,chair:(await info(f)).chair});
   await walk(f,1.35,-1.03);const blocked=await bump(f);assert(blocked.to.eastM>1.79&&blocked.to.eastM<1.90,JSON.stringify(blocked));
   await walk(f,-1.50,-1.75);await walk(f,-1.48,-3.50);const vacated=await walk(f,-.42,-3.50);
   assert(Math.hypot(vacated.eastM+.42,vacated.northM+3.5)<.18);
   log.cases.push({case:'collision moves with the chair',blocked,vacated});
   assert.deepEqual(log.errors,[]);log.pass=true;console.log('PASS visible pickup and cancel, interrupted carry and out-of-reach placement, lost acknowledgement retry, vacated and blocked footprints');
 }finally{if(out)h.write(path.join(out,'handling.json'),log);await browser?.close();await host.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
