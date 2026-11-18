'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');
const root=path.resolve(__dirname,'..');
const offered=require('../packs/biome-library.json').packs.find(p=>p.id==='infinite-industry');
const directory=path.posix.dirname(offered.entry)+'/';
const load=file=>import(pathToFileURL(path.join(root,file)).href);
async function main(){
  const [P,M,F,C,G]=await Promise.all([load(directory+'pod.js'),load(directory+'model.js'),load(directory+'facility.js'),load('packs/runtime/v1/contract.js'),load(directory+'plant.js')]);
  const manifest=require(path.join(root,directory,'manifest.json'));
  const store=C.createStore(manifest,{}),host=await session();
  const browser=await chromium.launch({headless:true,executablePath:executable(),args:['--mute-audio']});
  const checks=[],errors=[],report=(name,value)=>{checks.push({name,value});console.log('PASS',name);};
  const stateAt=(eastM,northM,yaw)=>{const s=M.initialState();s.pose={...s.pose,eastM,northM,yaw,pitch:0,altitudeM:F.DATUM_M+1.7,mode:'walk'};return M.saveState(s);};
  async function open(key,raw){
    const context=await browser.newContext({viewport:{width:960,height:540}});
    await host.attach(context);
    await context.addInitScript(([key,s])=>{if(!localStorage.getItem(key))localStorage.setItem(key,s);},[key,raw]);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host.origin+'/'+offered.entry);
    await page.waitForFunction(()=>window.SphereBiome?.inspect().frames>=3);
    return {context,page};
  }
  try{
    const district=P.district(1,1),hex=P.hexes(P.pod(district,0,0))[1];
    const offset=district.hexM/2-3;
    const start=stateAt(hex.center[0]+offset*district.cos,hex.center[1]+offset*district.sin,Math.atan2(district.cos,-district.sin));
    const lane=await open(manifest.storageKey,store.encode({state:start,bookmark:start}));
    const before=await lane.page.evaluate(()=>SphereBiome.pose());
    await lane.page.locator('#world').focus();await lane.page.keyboard.down('KeyW');
    try{await lane.page.waitForFunction(p=>Math.hypot(SphereBiome.pose().eastM-p.eastM,SphereBiome.pose().northM-p.northM)>8,before,{timeout:25000});}
    finally{await lane.page.keyboard.up('KeyW');}
    const end=await lane.page.evaluate(()=>SphereBiome.pose()),next=P.locate(end.eastM,end.northM).hex;
    assert.notEqual(hex.id,next?.id);assert.equal(end.mode,'walk');assert(Math.abs(end.altitudeM-before.altitudeM)<.002);
    report('Crossed the 54-degree seam on foot',{scale:district.scale,from:hex.id,to:next.id,before,end});await lane.context.close();
    const east=7138.267928,north=4102.578459,hall=stateAt(east,north,0);
    const roof=await open(manifest.storageKey,store.encode({state:hall,bookmark:hall}));
    const result=await roof.page.evaluate(async()=>{
      const trace=[];let done=false;
      function sample(){if(!done){trace.push(SphereBiome.pose());requestAnimationFrame(sample);}}
      sample();const status=await SphereBiome.ascend({toAltitudeM:7750,handoff:true});done=true;
      SphereBiome.save();return {trace,status,finish:SphereBiome.pose(),events:SphereIndustry.inspect().events.map(v=>v.type)};
    });
    const elevated=result.trace.filter(p=>p.altitudeM>2),startHex=P.locate(east,north).hex;
    const roofs=new Map(),cover=p=>{const h=P.locate(p.eastM,p.northM).hex;if(!h||h.waterWorks)return Infinity;
      if(!roofs.has(h.id))roofs.set(h.id,G.plant(h));return roofs.get(h.id).cover(...h.toLocal(p.eastM,p.northM));};
    assert.equal(cover({eastM:east,northM:north}),20);
    assert.equal(result.status,'revealed');assert(result.events.includes('contract-ascent-from-cover'));
    assert(elevated.length>3);assert(elevated.every(p=>!Number.isFinite(cover(p))));
    const stored=await roof.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),manifest.storageKey);
    assert.deepEqual(stored.state.pose,hall.pose);assert.deepEqual(stored.bookmark.pose,hall.pose);
    report('Left the generated hall before gaining height',{hex:startHex.id,undersideM:20,frames:result.trace.length,climbUnderRoof:0,finish:result.finish,saved:stored.state.pose});await roof.context.close();
    for(const v of ['1.3.0','1.4.0']){
      const old=require(path.join(root,'packs/infinite-industry',v,'manifest.json')),oldStore=C.createStore(old,{});
      const current=stateAt(4800,0,.12),bookmark=stateAt(5200,15,-.48);const source=oldStore.encode({state:current,bookmark});
      const migration=await open(old.storageKey,source);
      const migrated=await migration.page.evaluate(([key,previous])=>{SphereBiome.save();return {next:JSON.parse(localStorage.getItem(key)),old:localStorage.getItem(previous)};},[manifest.storageKey,old.storageKey]);
      assert.deepEqual(migrated.next.state.pose,current.pose);assert.deepEqual(migrated.next.bookmark.pose,bookmark.pose);assert.equal(migrated.old,source);
      report(v+' current viewpoint and distinct bookmark migrated',{state:current.pose,bookmark:bookmark.pose});await migration.context.close();
    }
    assert.deepEqual(errors,[]);
    if(process.env.SPHERE_ROOF_OUTPUT)fs.writeFileSync(process.env.SPHERE_ROOF_OUTPUT,JSON.stringify({checks,errors},null,2)+'\n');
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
