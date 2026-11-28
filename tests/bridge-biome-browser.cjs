'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

async function main() {
  const server = await session();
  const browser = await chromium.launch({headless: true, executablePath: executable()});
  const out = process.env.SPHERE_BRIDGE_OUTPUT;
  const errors = [], captures = [], checkpoints = [];
  let page;
  try {
    const context = await browser.newContext({viewport: {width: 1180, height: 740}});
    await server.attach(context);
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(180000);
    if (out) fs.mkdirSync(out, {recursive: true});
    await page.goto(server.origin + '/?border=wall', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereStageFrame &&
      SphereBiomeLibrary.entry('border-transport') && SphereBiomeLibrary.entry('infinite-meadow'));
    const fixture = await page.evaluate(async () => {
      const lib = SphereBiomeLibrary, stage = SphereStageFrame, border = lib.entry('border-transport');
      const row = stage.transportAddress().rows.find(r => r.site.bay === 0);
      const {station} = await stage.stationExterior(row.site.address,lib.persistence === 'file');
      const habitats = stage.stationHabitats(border.transport,station);
      if(habitats[0] !== 1 || SphereApp.getState().seed !== 713) throw Error('Expected seed 713 Meadow frontage');
      const geo = await import('./geographic-flight.js');
      const center = row.site.x + station.routes[0].nearDoor[0], lip = -station.widthM/2;
      const trunk=station.routes.find(route=>route.id==='trunk');
      SphereApp.setPlaying(false);
      SphereApp.setState({...SphereApp.getState(),time:44101.062,playing:false});
      stage.setMeadowWind({time:7.5,playing:false});
      window.bridgeTestOpen = async (owner,depth,dx=0,yaw=Math.PI,pitch=0,height=1.7) => {
        if(stage.current) stage.close();
        const p = {eastM:center+dx,northM:lip-depth,altitudeM:height,yaw,pitch,mode:height>2?'flight':'walk'};
        const world = geo.mainPose(SphereApp.getState(),border,p,SphereAtlas,SphereWorld);
        const pose = owner === 'border-transport' ? p :
          geo.packPose({...world,walkMode:p.mode==='walk'},lib.entry(owner),SphereAtlas,SphereWorld);
        const result=await stage.open(owner,{entry:{geographic:true,active:false,pose,horizontalFov:72}});
        if(!['arrived','taken-over'].includes(result?.status))throw Error('Doorway did not open: '+JSON.stringify(result));
      };
      const frameIds=new WeakMap();let maxId=0;
      window.bridgeTestRead = () => {
        const f=document.querySelector('#stageFrame iframe'),api=f?.contentWindow?.SphereBiome;
        if(!f?.surfaceEntry?.active || !api) return null;
        const p=api.pose(),report=api.inspect(),isBorder=api.id==='border-transport';
        const local=isBorder?p:row.locate(p.eastM,p.northM);
        if(!frameIds.has(f)) frameIds.set(f,++maxId);
        const canvas=f.contentDocument.querySelector('canvas');
        return {now:performance.now(),owner:api.id,frameId:frameIds.get(f),frame:report.frames,
          depth:lip-local.northM,side:local.eastM-center,altitude:p.altitudeM,yaw:p.yaw,windTime:stage.meadowWindTime(),
          gl:canvas?.getContext('webgl2')?.getError(),mode:p.mode,bridge:report.bridge??null};
      };
      window.bridgeTestTrail=[];
      function track(){
        const p=window.bridgeTestRead();if(p) bridgeTestTrail.push(p);
        if(bridgeTestTrail.length>6000) bridgeTestTrail.shift();
        requestAnimationFrame(track);
      }
      requestAnimationFrame(track);
      return {station:station.address.key,world:lib.world.key,lip,center,seed:SphereApp.getState().seed,
        trunkJamb:row.site.x+trunk.nearDoor[0]+trunk.door[0]/2-center};
    });
    const read=()=>page.evaluate(()=>bridgeTestRead());
    async function open(owner,depth,dx=0,yaw=Math.PI,pitch=0) {
      await page.evaluate(a=>bridgeTestOpen(...a),[owner,depth,dx,yaw,pitch]);
      await page.waitForFunction(id=>{const p=bridgeTestRead();return p?.owner===id&&p.frame>3;},owner,{timeout:12000});
      if(owner==='border-transport'){
        await page.waitForFunction(()=>{
          const b=bridgeTestRead()?.bridge;
          if(b?.error)throw Error(b.error);
          return b?.drawCount>0;
        },null,{timeout:15000});
      }
      console.log('Opened',owner,'metres beyond sill',depth);
    }
    async function picture(tag) {
      const canvas=page.frameLocator('#stageFrame iframe').locator('canvas').first();
      const bytes=await canvas.screenshot({type:'png',timeout:20000});
      if(out)fs.writeFileSync(path.join(out,tag+'.png'),bytes);
      captures.push({tag,sample:await read()});
      return bytes.toString('base64');
    }
    // Compare the actual destination at precisely the same survey address, eye and lens.
    // The frame covers the same screen rectangle on both sides of a geographic transfer.
    await open('border-transport',-17);
    const fromHall=await picture('hall-17m');
    await open('infinite-meadow',-17);
    const native=await picture('meadow-17m');
    async function compare(frames,aperture=true,patch=null){
      return page.evaluate(async ({frames,aperture,patch})=>{
        const images=await Promise.all(frames.map(async data=>{
          const raw=Uint8Array.from(atob(data),ch=>ch.charCodeAt(0));
          return createImageBitmap(new Blob([raw],{type:'image/png'}));
        }));
        const w=images[0].width,h=images[0].height;
        if(images.some(i=>i.width!==w||i.height!==h)) throw Error('Different display sizes');
        // Central 60% of the 4 m by 4 m doorway. Stay inside the aperture at both ends
        // and sample sky and approach ground independently so the surrounding concrete cannot mask a mismatch.
        const focal=w/(2*Math.tan(Math.PI/5)), half=2*focal/17;
        const left=Math.round(w/2-.6*half),width=Math.round(1.2*half);
        const grid=new OffscreenCanvas(w,h),ctx=grid.getContext('2d',{willReadFrequently:true});
        const rows=(from,to)=>images.map(i=>{
          ctx.drawImage(i,0,0);
          return ctx.getImageData(left,Math.round(h/2+from*half),width,Math.round((to-from)*half)).data;
        });
        function compare(band){
          const [a,b]=band, sums=[0,0,0];let count=0;
          for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)sums[c]+=Math.abs(a[i+c]-b[i+c]);count++;}
          return +(sums.reduce((x,y)=>x+y)/(count*3)).toFixed(3);
        }
        const result={width:w,height:h,skyMae:compare(rows(-.65,-.18)),groundMae:compare(rows(.12,.58))};
        if(patch){
          const [x,y,right,bottom]=patch.map((v,i)=>Math.round(v*(i%2?h:w)));
          result.patchMae=compare(images.map(image=>{
            ctx.drawImage(image,0,0);return ctx.getImageData(x,y,right-x,bottom-y).data;
          }));
        }
        if(!aperture){
          // The camera is looking across the grass verge. Compare the lower central view, away from the
          // crosshair, controls, doorway frame, and road. Record edge energy to reject an empty flat field.
          const ww=Math.floor(w*.5),hh=Math.floor(h*.21);
          const field=images.map(image=>{
            ctx.drawImage(image,0,0);
            return ctx.getImageData(Math.floor(w*.25),Math.floor(h*.52),ww,hh).data;
          });
          result.fieldMae=compare(field);
          result.fieldDetail=field.map(p=>{
            let total=0;
            for(let y=0;y<hh;y++)for(let x=1;x<ww;x++){
              const i=(y*ww+x)*4;total+=Math.abs(p[i+1]-p[i-3]);
            }
            return +(total/(hh*(ww-1))).toFixed(3);
          });
        }
        images.forEach(i=>i.close());return result;
      },{frames,aperture,patch});
    }
    const agreement=await compare([fromHall,native]);
    console.log('Measured same-pose aperture MAE',agreement);
    assert(agreement.skyMae<3 && agreement.groundMae<5,'Different daylight or soil at the same surveyed door: '+JSON.stringify(agreement));
    // At the service lane shoulder the close-set blades are visible in both renderers.
    const shoulder=[8,12,Math.PI*.55,-.18];
    await open('border-transport',...shoulder);
    const fromBridge=await picture('bridge-grass');
    const grass=(await read()).bridge?.provider;
    assert(grass?.submittedTufts>0 || grass?.clumpBlocks>0,'No vegetation submitted at the road shoulder');
    await open('infinite-meadow',...shoulder);
    const nativeGrass=await picture('native-grass');
    const grassAgreement=await compare([fromBridge,nativeGrass],false);
    console.log('Measured grass',grassAgreement,'bridge geometry',grass);
    assert(captures.every(c=>c.sample.windTime===7.5),'Both cameras must sample exactly the same frozen wind phase');
    assert(grassAgreement.fieldDetail.every(value=>value>1),'Grass verge contained no fine detail');
    // Allow small differences in raster precision across GPUs; the native blades agree to <.01 locally.
    assert(grassAgreement.fieldMae<1,'Bridge verge differs from native grass at the fixed wind phase: '+JSON.stringify(grassAgreement));

    // The broad truck apron is cut from Meadow soil. Sample its wearing course
    // at the two reported heights; the old picture filled it with olive sky.
    const roadAgreement=[];
    for(const [height,inside,fromJamb,turn,pitch,rect] of [
      [1.7,12,18,.21,-.035,[.35,.50,.75,.54]],
      [90.7,145,82,-.36,-.33,[.76,.47,.92,.60]]
    ]){
      const shots=[];
      for(const owner of ['border-transport','infinite-meadow']){
        await page.evaluate(args=>bridgeTestOpen(...args),[owner,-inside,fixture.trunkJamb-fromJamb,Math.PI+turn,pitch,height]);
        await page.waitForFunction(id=>{const p=bridgeTestRead();return p?.owner===id&&p.frame>3;},owner);
        if(owner==='border-transport' && height===1.7){
          const {bridge}=await read();
          assert(bridge?.activeKey?.endsWith('/trunk/-1') && bridge.phase==='live','The Monumental jamb needs the live Meadow slice');
        }
        shots.push(await picture('trunk-road-'+height+'-'+owner));
      }
      const {patchMae}=await compare(shots,true,rect);
      roadAgreement.push({height,patchMae});
      console.log('Monumental road agreement',height,patchMae);
      assert(patchMae<5,`Native pavement differs by ${patchMae} at ${height} m`);
    }

    await page.evaluate(()=>SphereStageFrame.setMeadowWind({time:7.5,playing:true}));
    await open('border-transport',-105);
    const far=(await read()).bridge;
    assert.equal(far.phase,'picture');
    assert(far.width>0 && far.width<128 && far.height<128,'Distant picture must scale to the service aperture');
    await page.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
    await page.keyboard.down('ArrowRight');
    try{await page.waitForFunction(before=>bridgeTestRead()?.bridge?.reuseCount>before,far.reuseCount,{timeout:10000});}
    finally{await page.keyboard.up('ArrowRight');}
    const reused=(await read()).bridge;
    await page.keyboard.down('ArrowRight');
    try{await page.waitForFunction(()=>{
      const b=bridgeTestRead()?.bridge;return b?.phase==='idle' && b.releaseCount>0;
    },null,{timeout:10000});}finally{await page.keyboard.up('ArrowRight');}
    const culled=(await read()).bridge;
    assert.equal(culled.residentBytes,0);assert.equal(culled.provider,null);
    await open('border-transport',-105);
    await page.evaluate(()=>{bridgeTestTrail.length=0;});
    await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
    await page.frameLocator('#stageFrame iframe').locator('canvas').first().focus();
    async function at(key,depth) {
      const before=await read();await page.keyboard.down(key);
      try{await page.waitForFunction(({depth,increasing})=>{
        const p=bridgeTestRead();return p && (increasing?p.depth>=depth:p.depth<=depth);
      },{depth,increasing:depth>before.depth},{timeout:35000,polling:'raf'});}
      finally{await page.keyboard.up(key);}
      const p=await read();checkpoints.push(p);return p;
    }
    await at('KeyW',-45);
    await page.evaluate(()=>SphereStageFrame.setSurfacePace(1));
    const pre=await read();
    assert.equal(pre.bridge.phase,'live');
    await page.keyboard.down('KeyD');
    try{await page.waitForFunction(x=>Math.abs(bridgeTestRead().side-x)>.38,pre.side);}
    finally{await page.keyboard.up('KeyD');}
    const side=await read();
    assert(Math.abs(side.side-pre.side)<1.1);
    await picture('oblique-step');
    await page.keyboard.down('KeyA');
    try{await page.waitForFunction(({start,sign})=>sign*(bridgeTestRead().side-start)<=.1,
      {start:pre.side,sign:Math.sign(side.side-pre.side)});}
    finally{await page.keyboard.up('KeyA');}
    const rect=await page.frameLocator('#stageFrame iframe').locator('canvas').first().boundingBox();
    const x=rect.x+rect.width*.5, y=rect.y+rect.height*.5;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+83,y);
    await page.waitForFunction(yaw=>Math.abs(bridgeTestRead().yaw-yaw)>.24,pre.yaw);
    await picture('oblique-look');
    await page.mouse.move(x,y);await page.mouse.up();
    assert(Math.abs((await read()).yaw-pre.yaw)<.01);
    await page.evaluate(()=>SphereStageFrame.setSurfacePace(16));
    const entered=await at('KeyW',2);
    assert.equal(entered.owner,'infinite-meadow');
    for(let i=0;i<3;i++){
      const inner=await at('KeyS',-2),outer=await at('KeyW',2);
      assert.equal(inner.frameId,entered.frameId,'Reversal unloaded the active renderer inside the door');
      assert.equal(outer.frameId,entered.frameId,'Reversal unloaded the active renderer outside the door');
      assert.equal(inner.mode,'walk');assert.equal(outer.mode,'walk');
    }
    const returned=await at('KeyS',-70);
    assert.equal(returned.owner,'border-transport');
    const second=await at('KeyW',5);assert.equal(second.owner,'infinite-meadow');
    const departed=await at('KeyW',90);
    assert.equal(departed.owner,'infinite-meadow');assert.equal(departed.mode,'walk');
    const trail=await page.evaluate(()=>bridgeTestTrail);
    assert(trail.every(p=>p.gl===0),'WebGL error on walking route');
    assert.deepEqual(errors,[]);
    const crossings=[];
    for(let i=1;i<trail.length;i++){
      const a=trail[i-1],b=trail[i];if(a.owner===b.owner)continue;
      const moved=Math.hypot(b.depth-a.depth,b.side-a.side,b.altitude-a.altitude);
      assert(moved<6,'Camera jumped '+moved+' m on '+a.owner+' to '+b.owner);
      assert(Math.abs(b.altitude-1.7)<.12,'Walking support lost at transfer');
      crossings.push({from:a.owner,to:b.owner,fromDepth:a.depth,toDepth:b.depth,
        displacementM:moved,readyIntervalMs:b.now-a.now});
    }
    assert.deepEqual(crossings.map(c=>c.to),['infinite-meadow','border-transport','infinite-meadow']);
    const peakBridgeBytes=Math.max(...trail.map(p=>p.bridge?.residentBytes??0));
    const report={fixture,agreement,grassAgreement,roadAgreement,far,reused,culled,peakBridgeBytes,
      crossings,checkpoints,captures,owners:[...new Set(trail.map(p=>p.owner))]};
    if(out)fs.writeFileSync(path.join(out,'bridge-report.json'),JSON.stringify(report,null,2));
    console.log('Walked seed 713 service door with three reversals',JSON.stringify({crossings,
      farPixels:[far.width,far.height],reused:culled.reuseCount,peakBridgeBytes,
      releasedBytes:culled.residentBytes,webglErrors:errors.length}));
  } catch(error) {
    console.error('Last visible view',await page?.evaluate(()=>({pose:window.bridgeTestRead?.(),status:document.querySelector('#biomeLibraryStatus')?.textContent,loading:document.querySelector('#loadingStatus')?.textContent})).catch(()=>null));
    throw error;
  } finally {await browser.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
