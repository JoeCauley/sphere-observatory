// Hold an actual station record while a flying Meadow camera passes its prefetch
// boundary. Re-request the same address and deliver the canceled response first.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');
async function main(){
  const server=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext({viewport:{width:1040,height:650}});
    await server.attach(context);const page=await context.newPage();page.setDefaultTimeout(180000);
    await page.goto(server.origin+'/?border=wall',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows.length);
    await page.evaluate(()=>{document.querySelector('#exactPosition').open=true;});
    await page.locator('#speedMode').selectOption('manual');await page.locator('#speed').selectOption('10');
    await page.evaluate(async()=>{
      const stage=SphereStageFrame,row=stage.transportAddress().rows.find(row=>row.site.bay===0);
      const meadow=SphereBiomeLibrary.entry('infinite-meadow'),side=row.site.address.plots[0]===meadow.plotId?-1:1;
      const face=side*row.site.widthM/2,start=row.at(row.site.x+2800,face+side*190000),aim=row.at(row.site.x+2800,face+side*189900);
      const held=window.coldWall={requests:[],delivered:[],painted:[],range:()=>{const api=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;
        const p=api.pose();return side*(row.locate(p.eastM,p.northM).northM-face);}};
      const wrapped=Object.create(stage);
      Object.defineProperty(wrapped,'stationExterior',{value:async(...args)=>{
        let release;const gate=new Promise(r=>{release=r;});
        const index=held.requests.push(release)-1;
        const payload=await stage.stationExterior(...args);await gate;held.delivered.push(index);
        return {...payload,makeView(...args){held.painted.push(index);return payload.makeView(...args);}};
      }});
      window.SphereStageFrame=wrapped;
      SphereApp.setPlaying(false);SphereApp.setState({...SphereApp.getState(),time:44101.062,playing:false});
      if(stage.current)stage.close();
      const result=await stage.open(meadow.id,{entry:{geographic:true,active:false,horizontalFov:80,pose:{
        ...start,altitudeM:row.site.roofM*.45,yaw:Math.atan2(aim.eastM-start.eastM,start.northM-aim.northM),pitch:0,mode:'flight'}}});
      if(!['arrived','taken-over'].includes(result?.status))throw Error('Could not start the cold flight: '+JSON.stringify(result)+' '+document.querySelector('#biomeLibraryStatus').textContent);
    });
    console.log('Cold flight ready at the 190 km approach');
    const canvas=page.frameLocator('#stageFrame iframe').locator('#world');await canvas.focus();
    await page.keyboard.down('KeyW');
    try{await page.waitForFunction(()=>coldWall.range()<39000,null,{timeout:180000});}
    finally{await page.keyboard.up('KeyW');}
    await page.waitForFunction(()=>coldWall.requests.length===1);
    console.log('Wall response held to',Math.round(await page.evaluate(()=>coldWall.range())),'m');
    await page.evaluate(()=>window.dispatchEvent(new Event('sphere-biomes-changed')));
    await page.waitForFunction(()=>coldWall.requests.length===2);
    await page.evaluate(()=>coldWall.requests[0]());
    await canvas.evaluate(source=>{
      const gl=source.getContext('webgl2'),pixel=new Uint8Array(4);
      window.wallSamples=[];
      function step(){
        gl.readPixels(source.width>>1,source.height>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        wallSamples.push({frame:SphereBiome.inspect().frames,rgb:[...pixel.slice(0,3)]});
        if(wallSamples.length<110)requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    const pilot=page.frames().find(frame=>frame.url().includes('/infinite-meadow/1.3.0/'));
    await pilot.waitForFunction(()=>wallSamples.length>=6);
    assert.deepEqual(await page.evaluate(()=>coldWall.painted),[],'A canceled same-address request touched the renderer');
    await page.evaluate(()=>coldWall.requests[1]());
    await pilot.waitForFunction(()=>wallSamples.length>=105);
    assert.deepEqual(await page.evaluate(()=>coldWall.painted),[1],'Only the live response can allocate the exterior');
    const samples=await pilot.evaluate(()=>wallSamples);
    let peak=0;for(let i=1;i<samples.length;i++){
      assert.equal(samples[i].frame,samples[i-1].frame+1);
      peak=Math.max(peak,...samples[i].rgb.map((v,c)=>Math.abs(v-samples[i-1].rgb[c])));
    }
    const distance=Math.round(await page.evaluate(()=>coldWall.range()));
    const first=samples[0].rgb,last=samples.at(-1).rgb;
    console.log(JSON.stringify({distance,samples:samples.length,first,last,peak}));
    assert(Math.max(...last.map((v,c)=>Math.abs(v-first[c])))>12,'The delayed wall must eventually appear');
    assert(peak<12,'The first late silhouette must reveal over multiple presented frames');
    await page.evaluate(()=>window.dispatchEvent(new Event('sphere-biomes-changed')));
    await page.waitForFunction(()=>coldWall.requests.length===3);
    await page.evaluate(()=>{SphereStageFrame.close();coldWall.requests[2]();});
    await page.waitForFunction(()=>coldWall.delivered.includes(2));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.deepEqual(await page.evaluate(()=>coldWall.painted),[1],'A disposed Meadow must ignore its late response');
  }finally{await browser.close();await server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
