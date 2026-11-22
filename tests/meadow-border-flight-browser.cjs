// Prove that the player can see and walk back to the service door from Meadow.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {disposable}=require('./support/observatory-server.cjs');
const {executable}=require('./support/biome-browser.cjs');
const meadow='infinite-meadow',border='border-transport';

async function main(){
  const server=await disposable('http'),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const page=await browser.newPage({viewport:{width:1180,height:740}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(150000);
    await page.goto(server.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereBiomeLibrary?.world&&window.SphereStageFrame);
    await page.evaluate(()=>SphereApp.setPlaying(false));
    for(const [id,name] of [[meadow,'Infinite Meadow'],[border,'Border Biome']]){
      const row=page.locator('#biomeLibraryList article').filter({has:page.getByRole('heading',{name:new RegExp('^'+name+' ')})});
      await row.getByRole('button',{name:'Install',exact:true}).click();
      await page.waitForFunction(id=>!!SphereBiomeLibrary.entry(id),id);
    }
    await page.evaluate(id=>SphereStageFrame.open(id),meadow);
    await page.evaluate(()=>{
      const heights=window.descentHeights=[],overlap=window.overlapErrors=[];
      function sample(){
        const f=document.querySelector('#stageFrame iframe');
        if(SphereStageFrame.current?.id==='border-transport' && document.getElementById('biomeLibraryStatus').textContent==='Descending toward Border Biome'){
          const core=SphereApp.getState(),api=f.contentWindow.SphereBiome;
          const km=f.parentElement.style.opacity==='1'&&api?api.pose().altitudeM/1000:core.radius-Math.hypot(...core.position);
          heights.push(km);
          if(f.parentElement.style.opacity==='1' && km>18.3 && km<23.7){
            const u=(24-km)/6;overlap.push(Math.abs(+f.style.opacity-u*u*(3-2*u)));
          }
          const roof=document.querySelector('#viewport canvas[data-station]');
          if(km>25 && km<140 && roof && !roof.hidden && +roof.style.opacity>.95)window.regionalRoof=roof.dataset.station;
        }
        if(!SphereStageFrame.lastArrival || SphereStageFrame.lastArrival.to!=='border-transport')requestAnimationFrame(sample);
      }sample();
    });
    await page.locator('#stageFrame').getByRole('button',{name:'Fly to Border Biome',exact:true}).click();
    await page.waitForFunction(()=>SphereStageFrame.lastArrival?.to==='border-transport'&&!SphereStageFrame.flying);
    const flight=await page.evaluate(()=>({result:SphereStageFrame.lastArrival,h:descentHeights,overlap:overlapErrors,exchange:SphereStageFrame.lastFlight.arriveKm}));
    assert.equal(flight.result.status,'arrived');assert.equal(flight.exchange,24);
    assert(flight.h.length>10&&flight.h[0]>500&&flight.h.at(-1)<.02,'Record the overview, exchange and final approach');
    assert(flight.overlap.length>3 && Math.max(...flight.overlap)<.15,'The two pictures must follow the flying camera through the overlap');
    for(let i=1;i<flight.h.length;i++)assert(flight.h[i]-flight.h[i-1]<.005,'Guided descent climbed '+(flight.h[i]-flight.h[i-1])+' km');

    const frame=page.frameLocator('#stageFrame iframe');
    const info=()=>frame.locator('canvas').first().evaluate(()=>({pose:SphereBiome.pose(),...SphereBiome.inspect()}));
    const pad=await info();
    assert.equal(await page.evaluate(()=>window.regionalRoof),pad.station,'The regional roof must appear above the clear-air overlap');
    await frame.getByRole('button',{name:'Walk',exact:true}).click();
    await frame.locator('#pace').selectOption('16');await frame.locator('#scene').focus();
    async function walk(key,until){
      await page.keyboard.down(key);
      try{await page.waitForFunction(until,null,{timeout:40000});}finally{await page.keyboard.up(key);}
    }
    await walk('KeyW',()=>{const b=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;return b?.inspect().locked;});
    await walk('KeyS',()=>SphereStageFrame.current?.id==='infinite-meadow'&&!document.querySelector('#departingStageFrame'));
    const witness=await frame.locator('#world').evaluate(async canvas=>{
      const p=SphereBiome.pose(),table=parent.SphereStageFrame.transportAddress();
      const g=await import('./landscape.js'),a=g.stationApron(p.eastM,p.northM);
      const data=await parent.SphereStageFrame.stationExterior(a.row.site.address,table.fileBacked);
      const s=data.station,route=s.routes[0],x=route.nearDoor[0],eyeZ=a.z+s.widthM/2;
      const gl=canvas.getContext('webgl2'),w=canvas.width,h=canvas.height,f=1.428148;
      const ax=a.row.axes,e=Math.sin(p.yaw),n=-Math.cos(p.yaw),yaw=Math.atan2(ax[0]*e+ax[1]*n,ax[2]*e+ax[3]*n);
      const hand=table.district.origin.axis==='meridian'?table.district.origin.acrossSign:-1;
      function pixel(xOffset){
        const dx=x+xOffset-a.x,dz=-1.22-eyeZ,dy=2.4-p.altitudeM;
        const right=hand*(dx*Math.cos(yaw)-dz*Math.sin(yaw)),ahead=dx*Math.sin(yaw)+dz*Math.cos(yaw);
        const depth=ahead*Math.cos(p.pitch)+dy*Math.sin(p.pitch),up=dy*Math.cos(p.pitch)-ahead*Math.sin(p.pitch);
        const u=Math.round(w/2+f*h/2*right/depth),v=Math.round(h/2+f*h/2*up/depth),rgba=new Uint8Array(4);
        gl.readPixels(u,v,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return Array.from(rgba).slice(0,3);
      }
      return {id:SphereBiome.inspect().exteriorStation,height:p.altitudeM,eyeZ,
        jambs:[pixel(-2.24),pixel(2.24)],walls:[pixel(-3.3),pixel(3.3)]};
    });
    assert.equal(witness.id,pad.station);assert(Math.abs(witness.height-1.7)<.015);
    assert(witness.eyeZ < -14 && witness.eyeZ > -70);
    const amber=([r,g,b])=>r>16&&r>1.25*g&&g>1.45*b;
    assert(witness.jambs.every(amber)&&!witness.walls.some(amber),'Exterior portal pixels '+JSON.stringify(witness));
    await frame.locator('#world').focus();
    await walk('KeyW',()=>{const f=document.querySelector('#stageFrame iframe');return SphereStageFrame.current?.id==='border-transport'&&f.surfaceEntry?.active;});
    const back=await info();assert.equal(back.station,pad.station);assert(back.locked);assert(Math.abs(back.pose.altitudeM-1.7)<.015);
    await page.locator('#stageFrame').getByRole('button',{name:'Fly to Infinite Meadow',exact:true}).click();
    await page.waitForFunction(()=>SphereStageFrame.lastArrival?.to==='infinite-meadow'&&!SphereStageFrame.flying);
    const reverse=await page.evaluate(()=>({result:SphereStageFrame.lastArrival,flight:SphereStageFrame.lastFlight}));
    assert.equal(reverse.result.status,'arrived');assert.equal(reverse.flight.departKm,24);
    assert.deepEqual(errors,[]);console.log('PASS two flights, projected roof, monotone descent and two visible exterior jambs',JSON.stringify(witness));
  }finally{await browser.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
