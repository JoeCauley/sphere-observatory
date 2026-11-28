'use strict';

// Compare the actual composited frame, including the regional backdrop behind
// the transparent station. Then drive an ordinary lateral roof-edge crossing.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function main(){
  const server=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  const out=process.env.SPHERE_ROOF_OUTPUT,frames=[],pairs=[],errors=[];
  if(out)fs.mkdirSync(out,{recursive:true});
  try {
    const context=await browser.newContext({viewport:{width:1580,height:820}});
    await server.attach(context);
    const page=await context.newPage(), cdp=await context.newCDPSession(page);
    page.setDefaultTimeout(300000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install();
    await page.goto(server.origin+'/?border=wall',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows.length);
    const fixture=await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary,stage=SphereStageFrame;
      const geo=await import('/geographic-flight.js');
      const row=stage.transportAddress().rows.find(r=>r.site.bay===0);
      const meadow=lib.entry('infinite-meadow'),border=lib.entry('border-transport');
      const side=row.site.address.plots[0]===meadow.plotId?-1:1;
      const lip=side*row.site.widthM/2;
      if(SphereApp.getState().seed!==713 || side!==-1)throw Error('Expected seed 713 Bay 0 Meadow frontage');
      SphereApp.setPlaying(false);SphereApp.setState({...SphereApp.getState(),time:44101.062,playing:false,fov:103});
      SphereApp.chooseFlightSpeed(false,.05);stage.setMeadowWind({time:7.5,playing:false});
      window.openRoof=async ({owner,height,east,depth,yaw,pitch})=>{
        if(stage.current)stage.close();
        SphereApp.chooseFlightSpeed(false,.05);
        const p={eastM:east,northM:lip+side*depth,altitudeM:height,yaw,pitch,mode:'flight'};
        const pose=owner===meadow.id?geo.stationToMeadowPose(row,p):p;
        const result=await stage.open(owner,{entry:{geographic:true,active:false,pose,horizontalFov:103}});
        if(!['taken-over','arrived'].includes(result?.status))throw Error('Roof entry '+JSON.stringify(result));
      };
      window.roofRead=()=>Array.from(document.querySelectorAll('#departingStageFrame,#stageFrame'),s=>{
        const f=s.querySelector('iframe'),api=f?.contentWindow?.SphereBiome,pose=api?.pose(),id=api?.id;
        const loc=pose && (id===meadow.id?geo.meadowToStationPose(row,pose):pose);
        return {id:id??null,shell:s.id,opacity:Number(getComputedStyle(s).opacity),
          frameOpacity:f?Number(getComputedStyle(f).opacity):0,active:!!f?.surfaceEntry?.active,
          frames:api?.inspect()?.frames??null,mode:loc?.mode,yaw:loc?.yaw,pitch:loc?.pitch,
          east:loc?.eastM,height:loc?.altitudeM,depth:loc?side*(loc.northM-lip):null};
      });
      return {world:lib.world.key,address:row.site.address.key,corner:row.site.x+geo.hallHalfM,lip,roof:row.site.roofM+geo.roofSlabM};
    });
    const analysis=await context.newPage();
    await analysis.evaluate(()=>{
      let previous=null;
      const outbound=new Map();
      window.resetPair=()=>{previous=null;outbound.clear();};
      window.sampleRoof=async ({data,tag,key,depth})=>{
        const png=await createImageBitmap(new Blob([Uint8Array.from(atob(data),s=>s.charCodeAt(0))],{type:'image/png'}));
        const w=192,h=112,c=new OffscreenCanvas(w,h),ctx=c.getContext('2d');
        ctx.drawImage(png,0,0,w,h);png.close();
        const rgb=ctx.getImageData(0,0,w,h).data;
        const patches={sky:[.35,.07,.65,.21],leftHorizon:[.08,.32,.29,.50],rightHorizon:[.71,.32,.92,.50],
          leftSurface:[.13,.72,.31,.88],rightSurface:[.69,.72,.87,.88]};
        // At the surveyed exterior camera the large side panel fills the
        // right foreground. Select the slab above it separately.
        if(tag.startsWith('aloft-frontage'))patches.roofSteel=[.75,.27,.85,.32];
        if(tag.startsWith('aloft-end'))patches.roofSteel=[.03,.47,.08,.64];
        if(tag.startsWith('deck-frontage'))patches.roofSteel=[.72,.65,.82,.85];
        if(tag.startsWith('deck-end'))patches.roofSteel=[.08,.65,.15,.82];
        const summary={},sameDepth=Math.round(depth*10),reference=key==='KeyD'?outbound.get(sameDepth):null;
        if(key==='KeyA')outbound.set(sameDepth,rgb);
        for(const [label,[x0,y0,x1,y1]] of Object.entries(patches)){
          const sum=[0,0,0];let n=0,delta=0,returnDelta=0;
          for(let y=Math.floor(y0*h);y<y1*h;y++)for(let x=Math.floor(x0*w);x<x1*w;x++){
            const i=(y*w+x)*4;n++;
            for(let j=0;j<3;j++){
              sum[j]+=rgb[i+j];
              if(previous)delta+=Math.abs(rgb[i+j]-previous[i+j]);
              if(reference)returnDelta+=Math.abs(rgb[i+j]-reference[i+j]);
            }
          }
          summary[label]={rgb:sum.map(v=>+(v/n).toFixed(2)),mae:+(delta/(3*n)).toFixed(3)};
          if(reference)summary[label].returnMae=+(returnDelta/(3*n)).toFixed(3);
        }
        previous=rgb;return summary;
      };
    });
    await page.bringToFront();
    console.log('Bay 0 roof',fixture);
    async function open(owner,pose){
      await page.evaluate(p=>openRoof(p),{owner,...pose});
      await page.waitForFunction(id=>roofRead().some(l=>l.id===id && l.active && l.frames>3),owner);
      const c=page.frameLocator('#stageFrame iframe').locator('canvas').first();await c.focus();
      const b=await c.boundingBox();
      return {x:Math.ceil(b.x+.03*b.width),y:Math.ceil(b.y+.18*b.height),
        width:Math.floor(.94*b.width),height:Math.floor(.66*b.height),scale:.5};
    }
    async function record(clip,tag,key=null){
      const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip});
      const layers=await page.evaluate(()=>roofRead());
      const displayed=layers.findLast(l=>l.id && l.opacity*l.frameOpacity>=.5);
      assert(displayed,'No visible roof renderer '+tag);
      const row={tag,key,layers,displayed:displayed.id,depth:displayed.depth,
        patches:await analysis.evaluate(s=>sampleRoof(s),{data,tag,key,depth:displayed.depth})};
      if(out)fs.writeFileSync(path.join(out,tag+'.png'),Buffer.from(data,'base64'));
      frames.push(row);return row;
    }
    // Survey-field coordinates put the first camera on the slab at its corner
    // and the second 332 m outside. Estimate yaw and pitch from the vanishing lines.
    const fieldPoses=[
      {label:'deck',height:fixture.roof+1.7,east:fixture.corner-1.6,depth:-.8},
      {label:'aloft',height:1868.6,east:fixture.corner-45.9,depth:332}
    ];
    const bearings=[{label:'frontage',yaw:-Math.PI/2-.16,pitch:-.28},{label:'end',yaw:.76,pitch:-.17}];
    for(const field of fieldPoses)for(const bearing of bearings){
      const name=field.label+'-'+bearing.label,pose={...field,...bearing};
      await analysis.evaluate(()=>resetPair());
      for(const [owner,label] of [['border-transport','border'],['infinite-meadow','meadow']]){
        const clip=await open(owner,pose);
        const snap=await record(clip,name+'-'+label);
        const actual=snap.layers.find(l=>l.id===owner && l.active);
        assert(Math.abs(actual.height-pose.height)<.1 && Math.abs(actual.depth-pose.depth)<.05 &&
          Math.abs(actual.east-pose.east)<.05,'Station/Meadow roof pose mismatch '+JSON.stringify(actual));
        if(label==='meadow'){pairs.push(snap);console.log(name,JSON.stringify(snap.patches));}
      }
    }
    for(const height of [fixture.roof+1.7,1868.6]){
      const name=height<1800?'deck-route':'aloft-route',route=[];
      const clip=await open('border-transport',{height,east:fixture.corner-1.6,depth:-5,yaw:-Math.PI/2,pitch:-.17});
      const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(new Date(now+160));
      await analysis.evaluate(()=>resetPair());
      async function tick(key=null){
        await page.clock.runFor(16);
        const row=await record(clip,name+'-'+String(route.length).padStart(3,'0'),key);
        route.push(row);return row;
      }
      async function leg(key,owner,depth){
        await page.keyboard.down(key);
        try{
          for(let i=0;i<140;i++){
            const row=await tick(key);
            const pilot=row.layers.find(l=>l.id===owner && l.active && l.shell==='stageFrame');
            if(pilot && (key==='KeyA'?pilot.depth>=depth:pilot.depth<=depth))return;
          }
          throw Error('Roof crossing '+key+' missed '+owner+' at '+depth+' m: '+JSON.stringify(route.at(-1)));
        }finally{await page.keyboard.up(key);}
      }
      await tick();await leg('KeyA','infinite-meadow',6);await leg('KeyD','border-transport',-6);
      await page.clock.resume();
      const max=label=>Math.max(...route.map(r=>r.patches[label].mae)).toFixed(2);
      console.log(name,route.length,'frames, peak sky/left/right',max('sky'),max('leftSurface'),max('rightSurface'));
      const changes=route.map(row=>row.displayed).filter((id,index)=>!index || id!==route[index-1].displayed);
      assert.deepEqual(changes,['border-transport','infinite-meadow','border-transport'],name+' display ownership');
      assert(route.filter(row=>row.patches.sky.returnMae!=null).length>=12,name+' missed the outbound positions on return');
    }
    for(const pair of pairs) {
      for(const [label,patch] of Object.entries(pair.patches)){
        const tolerance=pair.tag==='deck-end-meadow' && label==='leftHorizon'?3:5;
        assert(patch.mae<tolerance,pair.tag+' '+label+' disagrees by '+patch.mae+' colour levels');
      }
    }
    for(const [i,frame] of frames.entries()){
      if(!frame.key)continue;
      assert(frame.patches.sky.mae<3,'Roof sky flashed at '+frame.tag);
      const previous=frames[i-1];
      const held=frame.layers.find(l=>l.shell==='departingStageFrame' && l.id===frame.displayed);
      const prior=previous.layers.find(l=>l.id===previous.displayed);
      if(held && prior && held.id===prior.id && held.frames===prior.frames)
        assert(Math.abs(held.frameOpacity-prior.frameOpacity)<.001,'Held canvas opacity changed at '+frame.tag);
      // At walking eye height the slab lip legitimately sweeps across a
      // foreground patch within a single sideways step. Compare that patch to
      // the outbound frame at the same camera position on the return trip.
      if(frame.tag.startsWith('aloft') || Math.abs(frame.depth-previous.depth)<.05 || frame.displayed!==previous.displayed)
        assert(Math.max(frame.patches.leftSurface.mae,frame.patches.rightSurface.mae)<18,'Roof or ground flashed at '+frame.tag);
      for(const [label,patch] of Object.entries(frame.patches))
        if(patch.returnMae!=null)assert(patch.returnMae<12,frame.tag+' '+label+' disagrees with the outbound frame by '+patch.returnMae);
    }
    assert.deepEqual(errors,[]);console.log('Passed',frames.length,'composited views');
  }finally{
    if(out)fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify({pairs,frames,errors},null,2));
    await browser.close();await server.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
