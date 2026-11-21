'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{session,executable}=require('../tests/support/biome-browser.cjs');
const {record}=require('./transition-recorder.cjs');
const output=path.resolve(process.argv[2]||'work/transition-audit');
const catalogue=require('../packs/biome-library.json').packs;
const ids=catalogue.map(p=>p.id),short=id=>id.replace(/^infinite-|^border-|^sideways-/,'');
function routes(){
  const remaining=new Map(ids.map(id=>[id,ids.filter(other=>other!==id)])),stack=[ids[0]],trail=[];
  while(stack.length){const next=remaining.get(stack.at(-1)).pop();if(next)stack.push(next);else trail.push(stack.pop());}
  return trail.reverse().slice(1).map((to,i)=>({from:trail[i],to}));
}
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true,args:['--mute-audio']});
  const rows=[];
  try{
    const ctx=await browser.newContext({viewport:{width:1104,height:680}});await host.attach(ctx);
    const page=await ctx.newPage();page.setDefaultTimeout(150000);
    page.on('pageerror',e=>console.error('PAGE',e.message));
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    if(await page.locator('#togglePanel').isVisible())await page.locator('#togglePanel').click();
    await page.evaluate(async()=>{for(const p of SphereBiomeLibrary.packs())await SphereBiomeLibrary.install(p.id);});
    const filter=(process.env.SPHERE_CLIPS||'').split(',').filter(Boolean);
    const cases=routes();assert.equal(new Set(cases.map(x=>x.from+'/'+x.to)).size,ids.length*(ids.length-1));
    for(const {from,to} of cases){
      const id='flight-'+short(from)+'-'+short(to);
      if(filter.length&&!filter.includes(id))continue;
      if(process.env.SPHERE_RESUME==='1'&&fs.existsSync(path.join(output,id+'.json'))){
        const recovered=JSON.parse(fs.readFileSync(path.join(output,id+'.json')));if(!recovered.failure&&!recovered.errors.length&&recovered.result?.arrival?.status==='arrived')continue;
      }
      console.log('START',id,new Date().toISOString());
      const state=await page.evaluate(()=>SphereStageFrame.current?.id);
      if(state!==from){
        await page.evaluate(async from=>{SphereStageFrame.showMain();await SphereStageFrame.open(from);},from);
        await page.waitForFunction(from=>SphereStageFrame.current?.id===from&&!SphereStageFrame.flying&&document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.inspect()?.frames>0,from);
      }
      const r=await record(page,output,id,async()=>{
        const toName=catalogue.find(p=>p.id===to).name;
        await page.getByRole('button',{name:'Fly to '+toName,exact:true}).click();
        await page.waitForFunction(to=>{const s=SphereStageFrame;return !s.flying && s.lastArrival?.to===to && s.lastArrival.route==='fly';},to,{timeout:185000,polling:200});
        const result=await page.evaluate(()=>({arrival:SphereStageFrame.lastArrival,flight:SphereStageFrame.lastFlight,
          camera:document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBiome?.pose()}));
        assert.equal(result.arrival.status,'arrived',JSON.stringify(result));assert.equal(result.arrival.from,from);assert.equal(result.arrival.to,to);
        return result;
      });
      rows.push({id,frames:r.frames.length,seconds:Math.round(r.durationMs/1000),errors:r.errors,failure:r.failure});
      console.log(JSON.stringify(rows.at(-1)));
      fs.writeFileSync(path.join(output,'flight-run.json'),JSON.stringify({browser:browser.version(),expected:cases,rows},null,2)+'\n');
      if(r.failure)break;
    }
  }finally{await browser.close();await host.close();}
  if(rows.some(r=>r.failure||r.errors.length))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
