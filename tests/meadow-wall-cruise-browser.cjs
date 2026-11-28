// Cross both seed 713 station boundaries through Meadow's actual WebGL resource budget.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {disposable}=require('./support/observatory-server.cjs');
const {executable}=require('./support/biome-browser.cjs');

(async()=>{
  const host=await disposable('http'),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const page=await browser.newPage({viewport:{width:1050,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(180000);
    await page.goto(host.origin+'/?border=wall');
    await page.waitForFunction(()=>window.SphereLoading?.ready && document.querySelector('canvas[data-station]'));
    await page.evaluate(()=>{document.querySelector('#exactPosition').open=true;});
    await page.locator('#speedMode').selectOption('manual');await page.locator('#speed').selectOption('10');
    for(const heading of [1,-1]){
      const route=await page.evaluate(async heading=>{
        const lib=SphereBiomeLibrary,meadow=lib.entry('infinite-meadow'),survey=SphereStageFrame.transportAddress();
        const home=survey.rows.find(row=>row.site.bay===0),next=survey.rows.find(row=>row.site.bay===heading);
        const midpoint=(home.site.x+next.site.x)/2,start=midpoint-heading*6000;
        const side=next.site.address.plots[0]===meadow.plotId?-1:1,north=side*2050;
        const p=next.at(start,north),ahead=next.at(start+heading*100,north);
        const pose={...p,altitudeM:45,yaw:Math.atan2(ahead.eastM-p.eastM,p.northM-ahead.northM),pitch:0,mode:'flight'};
        window.wallReading=()=>{
          const api=document.querySelector('#stageFrame iframe')?.contentWindow.SphereBiome;
          if(!api || api.id!==meadow.id)return {};
          const pose=api.pose();
          return {...next.locate(pose.eastM,pose.northM),station:api.inspect().exteriorStation};
        };
        await SphereStageFrame.open(meadow.id,{entry:{geographic:true,active:false,pose}});
        return {first:home.site.address.key,last:next.site.address.key,frontage:next.site.x-heading*16000,north};
      },heading);
      await page.waitForFunction(key=>wallReading().station===key,route.first);
      const canvas=page.frameLocator('#stageFrame iframe').locator('canvas').first();
      await canvas.focus();await page.keyboard.down('KeyW');
      try{
        await page.waitForFunction(([sign,end])=>sign*(wallReading().eastM-end)>-1200,[heading,route.frontage]);
      }finally{await page.keyboard.up('KeyW');}
      await page.waitForFunction(key=>wallReading().station===key,route.last,{timeout:15000});
      const arrived=await page.evaluate(()=>wallReading());
      assert(Math.abs(arrived.northM-route.north)<15,'Cruising parallel drifted away from the frontage');
      console.log('PASS held flight along the Meadow wall to',arrived.station,'at chainage',arrived.eastM);
      await page.evaluate(()=>SphereStageFrame.close());
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await host.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
