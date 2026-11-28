// Fly a normal, reversible Meadow flight through the former exterior draw boundary.
// Compare a patch on the same upper facade in every consecutive Meadow frame.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

async function main() {
  const host = await session();
  const browser = await chromium.launch({headless:true, executablePath:executable()});
  try {
    const context = await browser.newContext({viewport:{width:1100,height:720}});
    await host.attach(context);
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(180000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host.origin+'/?border=wall', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows?.length);
    await page.evaluate(()=>{document.querySelector('#exactPosition').open=true;});
    await page.locator('#speedMode').selectOption('manual');
    await page.locator('#speed').selectOption('10');
    const geometry = await page.evaluate(async()=>{
      const stage=SphereStageFrame,row=stage.transportAddress().rows.find(r=>r.site.bay===0);
      const meadow=SphereBiomeLibrary.entry('infinite-meadow'), side=row.site.address.plots[0]===meadow.plotId?-1:1;
      const wall=row.site.widthM/2,face=side*wall,far=160000;
      // Aim at the unbroken center panels, level at mid-height above the terrain.
      const start=row.at(row.site.x,face+side*far),ahead=row.at(row.site.x,face+side*(far-100));
      const altitudeM=row.site.roofM*.45;
      SphereApp.setPlaying(false);
      SphereApp.setState({...SphereApp.getState(),time:44101.062,playing:false});
      stage.setMeadowWind({time:7.5,playing:false});
      if(stage.current)stage.close();
      const result=await stage.open(meadow.id,{entry:{geographic:true,active:false,horizontalFov:80,
        pose:{...start,altitudeM,yaw:Math.atan2(ahead.eastM-start.eastM,start.northM-ahead.northM),pitch:0,mode:'flight'}}});
      if(!['arrived','taken-over'].includes(result?.status))
        throw Error('Failed to start Meadow flight: '+JSON.stringify(result)+' '+document.querySelector('#biomeLibraryStatus').textContent);
      return {side,face,roof:row.site.roofM,start:far};
    });
    console.log('Flying the central Meadow facade',geometry);
    const canvas=page.frameLocator('#stageFrame iframe').locator('#world');
    await canvas.focus();
    await canvas.evaluate((source,g)=>{
      const row=parent.SphereStageFrame.transportAddress().rows.find(r=>r.site.bay===0);
      const sample=new OffscreenCanvas(32,5),ctx=sample.getContext('2d',{willReadFrequently:true});
      const shots={},frames=[];
      let running=true,last=-1;
      function tick(){
        if(!running)return;
        const frame=SphereBiome.inspect().frames;
        if(frame!==last){
          const p=SphereBiome.pose(),z=row.locate(p.eastM,p.northM).northM;
          const distance=(z-g.face)*g.side,w=source.width,h=source.height;
          const focal=w/(2*Math.tan(80*Math.PI/360));
          // Left or right of center (depending on chart handedness), well above the door.
          const x=w*.5+1500*focal/distance,y=h*.5-(.72*g.roof-p.altitudeM)*focal/distance;
          const width=Math.max(2,3000*focal/distance),height=Math.max(1,.12*g.roof*focal/distance);
          ctx.drawImage(source,x,y,width,height,0,0,32,5);
          const data=ctx.getImageData(0,0,32,5).data,rgb=[0,0,0];
          for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)rgb[c]+=data[i+c]/160;
          frames.push({frame,distance:Math.round(distance),rgb:rgb.map(v=>+v.toFixed(2))});
          if(parent.wallEvidence)for(const km of [150,100,60,35,24,23,18]){
            if(shots[km] || Math.abs(distance/1000-km)>.55)continue;
            const picture=document.createElement('canvas');picture.width=640;picture.height=Math.round(640*h/w);
            picture.getContext('2d').drawImage(source,0,0,picture.width,picture.height);
            shots[km]=picture.toDataURL('image/png').split(',')[1];
          }
          last=frame;
        }
        requestAnimationFrame(tick);
      }
      window.wallPass={frames,stop(){running=false;return {frames,shots};}};
      requestAnimationFrame(tick);
    },geometry);
    const out=process.env.SPHERE_WALL_OUTPUT;
    if(out)await page.evaluate(()=>window.wallEvidence=true);
    const pilot=page.frames().find(f=>f.url().includes('/infinite-meadow/1.3.0/'));
    assert(pilot,'Meadow pilot');
    async function leg(key, predicate){
      await page.keyboard.down(key);
      try{await pilot.waitForFunction(predicate,null,{timeout:180000});}
      finally{await page.keyboard.up(key);}
    }
    await leg('KeyW',()=>window.wallPass?.frames.at(-1)?.distance<17000);
    await leg('KeyS',()=>window.wallPass?.frames.at(-1)?.distance>155000);
    const {frames,shots}=await pilot.evaluate(()=>wallPass.stop());
    const changes=frames.slice(1).map((next,i)=>{
      const prev=frames[i];
      assert.equal(next.frame-prev.frame,1,'Missed a Meadow frame during the flythrough');
      const delta=next.rgb.map((v,c)=>Math.abs(v-prev.rgb[c]));
      return {frame:next.frame,from:prev.distance,to:next.distance,delta:+(delta.reduce((a,b)=>a+b)/3).toFixed(2)};
    });
    const peak=list=>list.reduce((a,b)=>a.delta>b.delta?a:b);
    const approach=peak(changes.filter(c=>c.from>c.to)),retreat=peak(changes.filter(c=>c.from<c.to));
    // A uniformly missing wall would also score zero from frame to frame.
    // On this fixed noon bearing, its upper facade darkens against the sky.
    const sampleAt=distance=>frames.reduce((best,sample)=>
      Math.abs(sample.distance-distance)<Math.abs(best.distance-distance)?sample:best);
    const background=sampleAt(155000).rgb;
    const contrastAt=distance=>sampleAt(distance).rgb.reduce((sum,v,c)=>sum+background[c]-v,0)/3;
    const summary={geometry,frames:frames.length,approach,retreat};
    if(out){
      fs.mkdirSync(out,{recursive:true});
      fs.writeFileSync(path.join(out,'wall-flight.json'),JSON.stringify({...summary,samples:frames},null,2));
      for(const [km,bytes] of Object.entries(shots))fs.writeFileSync(path.join(out,'wall-'+km+'km.png'),Buffer.from(bytes,'base64'));
    }
    console.log(JSON.stringify(summary));
    assert(frames.length>100 && approach.delta<8 && retreat.delta<8,'Wall appeared or disappeared in one frame');
    assert(contrastAt(45000)>8 && contrastAt(18000)>30,'The facade must be visible before the old cutoff and gain contrast during approach');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
