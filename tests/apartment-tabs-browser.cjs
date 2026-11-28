'use strict';
const h=require('./support/apartment-field.cjs'),{fixture}=require('./support/apartment-register.cjs');
const {assert,fs,path,world,id,walk,ready,mainReady}=h;
(async()=>{
 const {dir,file}=fixture(process.env.SPHERE_APARTMENT_SEED),host=await h.start({storePath:file}),browser=await h.chromium.launch(h.options);
 const report={pass:false,errors:[],operations:[]},out=process.env.SPHERE_APARTMENT_EVIDENCE;
 try{
   const ctx=await browser.newContext({viewport:h.viewport});
   const tabs=[];
   for(let n=0;n<2;n++){
     const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
     await page.goto(host.origin+'/?apartment=1A');await mainReady(page);const f=await ready(page);
     await walk(f,-1.55,-1.65);await walk(f,-1.46,-3.50);await f.locator('#chairButton').click();
     await walk(f,-1.34,-1.69);await walk(f,1.35,-1.13);tabs.push({page,f});
   }
   const both=Promise.withResolvers();let pending=0;
   for(const [index,tab] of tabs.entries()){
     await tab.page.route('**/api/furnishings?**',async route=>{
       if(route.request().method()!=='POST')return route.continue();
       const request=route.request().postDataJSON();
       if(request.expected===0){if(++pending===2)both.resolve();await both.promise;}
       const reply=await route.fetch();report.operations.push({index,request,status:reply.status(),result:await reply.json(),url:route.request().url()});
       await route.fulfill({response:reply});
     });
   }
   await Promise.all(tabs.map(t=>t.f.locator('#chairButton').click()));
   for(const t of tabs)await t.f.waitForFunction(()=>SphereBiome.inspect().chair.revision===1&&!SphereBiome.inspect().carrying);
   const pair=report.operations.slice();assert.deepEqual(pair.map(v=>v.status).sort(),[200,409]);
   assert.notEqual(pair[0].request.actionId,pair[1].request.actionId);assert.deepEqual(pair[0].result.chair,pair[1].result.chair);
   const winner=pair.find(op=>op.status===200),{page,f}=tabs[winner.index],down=Promise.withResolvers(),release=Promise.withResolvers();
   let capture=true;
   await page.route('**/api/furnishings?**',async route=>{
     if(capture&&route.request().method()==='GET'){
       capture=false;const res=await route.fetch();assert.equal((await res.json()).chair.revision,1);
       down.resolve();await release.promise;await route.fulfill({response:res});return;
     }
     await route.fallback();
   });
   // Delay an actual read taken at B while the active walker puts the chair back at A.
   await f.evaluate(()=>window.dispatchEvent(new Event('focus')));await down.promise;
   await f.locator('#chairButton').click();await walk(f,-1.38,-1.72);await walk(f,-1.41,-3.50);
   await f.locator('#chairButton').click();await f.waitForFunction(()=>SphereBiome.inspect().chair.revision===2&&!SphereBiome.inspect().carrying);
   const replay=async cmd=>{const r=await fetch(winner.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cmd)});return {status:r.status,...await r.json()};};
   report.lateRetry=await replay(winner.request);assert.equal(report.lateRetry.status,200);assert(report.lateRetry.duplicate);
   assert.deepEqual(report.lateRetry.receipt,winner.result.receipt);assert.equal(report.lateRetry.chair.revision,2);
   report.reusedId=await replay({...winner.request,target:'A'});assert.equal(report.reusedId.status,409);
   const finished=page.waitForResponse(r=>r.url()===winner.url&&r.request().method()==='GET');
   release.resolve();await finished;await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   for(const t of tabs){await t.f.waitForFunction(()=>SphereBiome.inspect().chair.revision===2);assert.equal((await t.f.evaluate(()=>SphereBiome.inspect().chair)).target,'A');}
   report.disk=(await (await fetch(winner.url)).json()).chair;assert.equal(report.disk.revision,2);assert.equal(report.disk.target,'A');assert.deepEqual(report.errors,[]);
   report.pass=true;console.log('PASS two real competing tabs, one commit and one conflict, return to A, original receipt on late retry, delayed GET ignored by both screens, mismatched action rejected');
 }finally{if(out)h.write(path.join(out,'competing-tabs.json'),report);await browser.close();await host.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
