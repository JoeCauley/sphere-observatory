'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{executable}=require('./biome-browser.cjs');
const {start}=require('./observatory-server.cjs');
const world='sphere-ed6a59ab491a9a08',id='infinite-new-york',viewport={width:1600,height:900};
const options={headless:true,executablePath:executable(),args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
async function mainReady(page){
  page.setDefaultTimeout(100000);
  await page.waitForFunction(()=>{if(document.querySelector('#loadingActions')?.hidden===false)throw Error(document.querySelector('#loadingStatus').textContent);return document.querySelector('#sceneLoading')?.hidden&&window.SphereBiomeLibrary?.world;},null,{timeout:180000});
}
async function selectSeed(page,params){
  await page.evaluate(async params=>{SphereApp.setPlaying(false);SphereApp.setState({...SphereApp.getState(),...params});await SphereBiomeLibrary.selectWorld();},params);
  await page.waitForFunction(world=>SphereBiomeLibrary.world?.key===world,world);
}
async function ready(page,which=id){
  await page.waitForFunction(id=>{const fr=document.querySelector('#stageFrame iframe'),b=fr?.contentWindow?.SphereBiome;
    return fr?.dataset.locationId===id&&b?.inspect?.().frames>2&&!b.inspect().scripted&&fr.parentElement.style.pointerEvents!=='none';},which,{timeout:180000});
  return (await page.locator('#stageFrame iframe').elementHandle()).contentFrame();
}
const pose=f=>f.evaluate(()=>SphereBiome.pose());
async function aim(f,yaw,pitch){
  const p=f.page(),b=await f.locator('canvas').first().boundingBox(),cx=b.x+b.width*.58,cy=b.y+b.height*.5;
  for(let i=0;i<12;i++){
    const q=await pose(f),d=Math.atan2(Math.sin(yaw-q.yaw),Math.cos(yaw-q.yaw)),v=pitch-q.pitch;
    if(Math.abs(d)<.004&&Math.abs(v)<.004)return;
    const dx=Math.max(-180,Math.min(180,Math.round(d/.004))),dy=Math.max(-110,Math.min(110,Math.round(-v/.004)));
    await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+dx,cy+dy,{steps:3});await p.mouse.up();
  }
  throw Error('Could not aim at '+[yaw,pitch]);
}
async function look(f,x,z,pitch=0){const p=await pose(f);await aim(f,Math.atan2(x-p.eastM,-(z-p.northM)),pitch);}
async function walk(f,x,z,{run=true,pitch=.0}={}){
  const p=f.page();await f.locator('#street').focus();
  for(let pass=0;pass<3;pass++){
    const from=await pose(f),dx=x-from.eastM,dz=z-from.northM,d=Math.hypot(dx,dz);if(d<.16)return from;
    await aim(f,Math.atan2(dx,-dz),pitch);
    if(run)await p.keyboard.down('ShiftLeft');await p.keyboard.down('KeyW');
    try{
      await f.waitForFunction(({from,dx,dz,d})=>{const p=SphereBiome.pose();
        return (p.eastM-from.eastM)*dx/d+(p.northM-from.northM)*dz/d>=d-.075;},{from,dx,dz,d},{polling:'raf',timeout:Math.max(3500,2000+d*850)});
    }catch(e){throw Error('Walk blocked '+JSON.stringify({from,target:[x,z],actual:await pose(f)})+' '+e.message);}
    finally{await p.keyboard.up('KeyW');if(run)await p.keyboard.up('ShiftLeft');}
  }
  const q=await pose(f);assert(Math.hypot(x-q.eastM,z-q.northM)<.25);return q;
}
async function shot(page,file){await page.screenshot({path:file,clip:await page.locator('#stageFrame iframe').boundingBox()});}
async function mark(page,name){
  await page.getByRole('tab',{name:'Explore'}).click();
  const det=page.locator('#atlasPlaces');
  if(!await det.evaluate(d=>d.open))await det.locator('summary').first().click();
  const old=await page.evaluate(n=>SphereBiomeLibrary.marks().findLast(m=>m.name===n)?.id??null,name);
  await page.locator('#atlasPlaceName').fill(name);await page.locator('#atlasMarkHere').click();
  await page.waitForFunction(({name,old})=>{const m=SphereBiomeLibrary.marks().findLast(i=>i.name===name);return m&&m.id!==old;},{name,old});
  return page.evaluate(n=>SphereBiomeLibrary.marks().findLast(m=>m.name===n),name);
}
async function returnMark(page,name,scene=id){
  await page.getByRole('tab',{name:'Explore'}).click();const d=page.locator('#atlasPlaces');
  if(!await d.evaluate(e=>e.open))await d.locator('summary').first().click();
  await page.locator('#atlasPlaceList').getByRole('button',{name,exact:true}).click();
  return ready(page,scene);
}
async function sample(f){
  return f.evaluate(async()=>{
    const start=SphereBiome.inspect(),at=SphereBiome.pose(),values=[],from=performance.now();
    let last=await new Promise(requestAnimationFrame);
    while(performance.now()-from<30000){const t=await new Promise(requestAnimationFrame);values.push(t-last);last=t;}
    values.sort((a,b)=>a-b);const end=SphereBiome.inspect();
    return {n:values.length,p50:values[Math.floor(values.length*.50)],p95:values[Math.floor(values.length*.95)],worst:values.at(-1),
      durationMs:performance.now()-from,eye:at,light:start.light,viewport:start.viewport,buffer:start.drawingBuffer,lens:start.horizontalFov,
      device:start.device,ownedBytes:end.ownedBytes,peakOwnedBytes:end.peakOwnedBytes,glErrors:end.glErrors,clockChange:end.light.time-start.light.time};
  });
}
module.exports={chromium,options,viewport,world,id,start,fs,path,assert,sleep,write,mainReady,selectSeed,ready,pose,aim,look,walk,shot,mark,returnMark,sample};
