'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {executable,session}=require('./support/biome-browser.cjs');
const entry=require('../packs/biome-library.json').packs.find(p=>p.id==='infinite-industry').entry;
async function main(){
  const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable(),args:['--mute-audio']});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:590}});
    await host.attach(page.context());const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host.origin+'/'+entry);await page.waitForFunction(()=>window.SphereBiome?.inspect().frames>10);
    await page.locator('#transfer').click();
    const start=await page.evaluate(async()=>{
      const {locate}=await import('./pod.js');const p=SphereBiome.pose(),s=SphereIndustry.inspect();
      return {pose:p,hex:locate(p.eastM,p.northM).hex.id,transfer:s.transfer,process:s.state.processPlaying};
    });
    assert.equal(start.hex,start.transfer.source);assert(start.process);
    await page.waitForFunction(along=>Math.abs(SphereIndustry.inspect().transfer.bar.along-along)>.9,start.transfer.bar.along);
    // Steer parallel to the deck so the on-foot crossing uses ordinary input.
    const [ex,ez]=start.transfer.intake.map((v,i)=>(v-start.transfer.outlet[i])/start.transfer.length);
    const wanted=Math.atan2(ex,-ez);
    const turn=((wanted-start.pose.yaw+3*Math.PI)%(2*Math.PI))-Math.PI;
    const canvas=page.locator('#world');await canvas.focus();
    // A frame-delayed key release can miss a narrow deck on a software renderer.
    // The normal drag control has a fixed gain independent of the render clock.
    const box=await canvas.boundingBox(),centerX=box.x+box.width*.65,centerY=box.y+box.height*.60;
    const segments=Math.max(1,Math.ceil(Math.abs(turn/.004)/(box.width*.2)));
    for(let i=0;i<segments;i++){
      await page.mouse.move(centerX,centerY);await page.mouse.down();
      try{await page.mouse.move(centerX+turn/.004/segments,centerY);}
      finally{await page.mouse.up();}
    }
    const heading=await page.evaluate(()=>SphereBiome.pose().yaw);
    assert(Math.abs(Math.atan2(Math.sin(heading-wanted),Math.cos(heading-wanted)))<.012,'Walk must start parallel to the conveyor');
    await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
    try{
      await page.waitForFunction(({outlet,ex,ez,length})=>{const p=SphereBiome.pose();return (p.eastM-outlet[0])*ex+(p.northM-outlet[1])*ez>length-1;},{outlet:start.transfer.outlet,ex,ez,length:start.transfer.length},{timeout:150000,polling:100});
    }finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
    const end=await page.evaluate(async()=>{const {locate}=await import('./pod.js');const p=SphereBiome.pose();return {pose:p,hex:locate(p.eastM,p.northM).hex.id};});
    assert.equal(end.hex,start.transfer.destination);assert.equal(end.pose.mode,'walk');assert(Math.abs(end.pose.altitudeM-start.pose.altitudeM)<.002);
    await page.getByText('Place & inspection',{exact:true}).click();
    await page.locator('#pauseProcess').check();
    const saved=await page.evaluate(()=>{SphereBiome.save();const s=SphereIndustry.inspect();return {time:s.state.processTime,bar:s.transfer.bar,pose:SphereBiome.pose()};});
    await page.reload();await page.waitForFunction(()=>window.SphereBiome?.inspect().frames>10);
    const again=await page.evaluate(()=>{const s=SphereIndustry.inspect();return {time:s.state.processTime,bar:s.transfer.bar,pose:SphereBiome.pose()};});
    assert.deepEqual(again,saved);assert.deepEqual(errors,[]);
    const result={from:start.hex,to:end.hex,walkedM:Math.hypot(end.pose.eastM-start.pose.eastM,end.pose.northM-start.pose.northM),spanM:start.transfer.length,outlet:start.transfer.outlet,intake:start.transfer.intake,saved,restored:again,errors};
    if(process.env.SPHERE_TRANSFER_OUTPUT)fs.writeFileSync(process.env.SPHERE_TRANSFER_OUTPUT,JSON.stringify(result,null,2)+'\n');
    console.log('PASS Hot bars moved over one shared edge. Walked from process to forming and reopened at the same product phase and place.');
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
