'use strict';

// Pause the simulation between frames so reading the compositor cannot skip an
// ownership change. SPHERE_REPLAY_OUTPUT also preserves every PNG and its pose.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { session, executable } = require('./support/biome-browser.cjs');

async function main() {
  const server = await session();
  const browser = await chromium.launch({ executablePath: executable(), headless: true });
  const out = process.env.SPHERE_REPLAY_OUTPUT;
  const errors = [], frames = [];
  try {
    if (out) fs.mkdirSync(out, {recursive:true});
    const context = await browser.newContext({viewport:{width:1180,height:740}});
    await server.attach(context);
    const page = await context.newPage();
    page.setDefaultTimeout(240000);
    page.on('pageerror', err => errors.push(err.message));
    page.on('console',message=>{if(message.type()==='error') console.error(message.text());});
    const cdp = await context.newCDPSession(page);
    await page.clock.install();
    await page.goto(server.origin+'/?border=wall', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereStageFrame?.transportAddress()?.rows.length);
    const fixture = await page.evaluate(async () => {
      const lib = SphereBiomeLibrary, stage = SphereStageFrame, border = lib.entry('border-transport');
      const row = stage.transportAddress().rows.find(r => r.site.bay === 0);
      const {station} = await stage.stationExterior(row.site.address,lib.persistence==='file');
      const route = station.routes.find(r => r.id === 'trunk');
      const lip = -station.widthM/2, center = row.site.x+route.nearDoor[0];
      if (SphereApp.getState().seed !== 713 || stage.stationHabitats(border.transport,station)[0] !== 1)
        throw Error('Expected seed 713 with the near door facing Meadow');
      SphereApp.setPlaying(false);
      SphereApp.setState({...SphereApp.getState(),time:44101.062,playing:false});
      stage.setMeadowWind({time:7.5,playing:false});
      window.openWallRoute = async ({mode,height,depth,inside,pitch,speed}) => {
        if (stage.current) stage.close();
        if(mode==='flight')SphereApp.chooseFlightSpeed(false,speed);
        const pose = {eastM:center-route.door[0]/2+inside,northM:lip-depth,
          altitudeM:height,yaw:Math.PI,pitch,mode};
        const result = await stage.open(border.id,{entry:{geographic:true,active:false,pose,horizontalFov:72}});
        if (!['arrived','taken-over'].includes(result?.status)) throw Error('Could not open Bay 0 '+JSON.stringify(result));
        stage.setSurfacePace(mode==='flight'?4:16);
      };
      const frameIds = new WeakMap();
      let nextFrameId=1;
      window.wallRouteLayers = () => {
        return Array.from(document.querySelectorAll('#stageFrame,#departingStageFrame'), shell => {
          const iframe=shell.querySelector('iframe'), api=iframe?.contentWindow?.SphereBiome;
          const pose=api?.pose(), id=api?.id ?? null;
          const local = !pose ? null : id===border.id ? pose : row.locate(pose.eastM,pose.northM);
          const shellStyle=getComputedStyle(shell), frameStyle=iframe && getComputedStyle(iframe);
          if(iframe && !frameIds.has(iframe))frameIds.set(iframe,nextFrameId++);
          const doc=iframe?.contentDocument, issue=doc?.querySelector('#error:not([hidden]),#packRetry:not([hidden])');
          const loading=doc?.querySelector('#packLoadingStatus')?.textContent||'';
          return {id,instance:frameIds.get(iframe)??null,stage:shell.id,opacity:Number(shellStyle.opacity),
            pending:id?null:{url:iframe?.src,loading,error:issue?.textContent||''},
            frameOpacity:frameStyle?Number(frameStyle.opacity):0,active:!!iframe?.surfaceEntry?.active,
            frames:api?.inspect()?.frames??null,pose,depth:local?lip-local.northM:null,
            jamb:local?local.eastM-center+route.door[0]/2:null};
        });
      };
      return {world:lib.world.key,address:station.address.key,door:route.door,center,lip};
    });
    // Browser image decoding is independent of the application renderers.
    const analysis = await context.newPage();
    await analysis.evaluate(() => {
      let previous;
      window.resetImagePair = () => {previous=null;};
      window.scoreImage = async data => {
        const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
        const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
        const w=160,h=96, canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d');
        ctx.drawImage(image,0,0,w,h);image.close();
        const rgba=ctx.getImageData(0,0,w,h).data;
        let sum=0,changed=0,green=0,wall=0,sky=0,dark=0,samples=0;
        let wallPixels=0,vinePixels=0,deckPixels=0,deckGreenMinusBlue=0;
        for(let i=0;i<rgba.length;i+=4){
          const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
          const x=(i/4%w+.5)/w,y=(Math.floor(i/(4*w))+.5)/h;
          if(y<.13 && (x<.27 || x>.50))continue; // Native pack control hints.
          samples++;
          // These patches are semantically fixed in the prescribed starting pose:
          // grey wall to the right of the gold jamb, paved apron to the left.
          if (x>.85 && x<.98 && y>.55 && y<.98){
            wallPixels++;if(g-Math.max(r,b)>7)vinePixels++;
          }
          if (x>.21 && x<.32 && y>.55 && y<.73){
            deckPixels++;deckGreenMinusBlue+=g-b;
          }
          if(g>r*1.20 && g>b*1.20 && g-r>8)green++;
          if(Math.max(r,g,b)-Math.min(r,g,b)<28 && g>22 && g<125)wall++;
          if(b>g && b-r>12 && b>100)sky++;
          if(Math.max(r,g,b)<10)dark++;
          if(previous){
            const delta=(Math.abs(r-previous[i])+Math.abs(g-previous[i+1])+Math.abs(b-previous[i+2]))/3;
            sum+=delta;if(delta>30)changed++;
          }
        }
        previous=rgba;
        return {meanDelta:sum/samples,changedFraction:changed/samples,green:green/samples,
          wall:wall/samples,sky:sky/samples,dark:dark/samples,
          wallGreenFraction:vinePixels/wallPixels,deckGreenMinusBlue:deckGreenMinusBlue/deckPixels};
      };
    });
    await page.bringToFront();
    console.log('Bay 0 route fixture',fixture);
    const routes=[
      {name:'walk-jamb',mode:'walk',height:1.7,depth:-50,inside:4,pitch:0},
      {name:'flight-jamb',mode:'flight',height:90.7,depth:-76,inside:12,pitch:-.22,speed:1.8},
      {name:'flight-inspect',mode:'flight',height:90.7,depth:-76,inside:12,pitch:-.22,speed:.060}
    ];
    const selected=routes.filter(route=>!process.env.SPHERE_REPLAY_ROUTE || route.name===process.env.SPHERE_REPLAY_ROUTE);
    assert(selected.length,'Unknown replay route');
    for (const route of selected) {
      await page.evaluate(r=>openWallRoute(r),route);
      const canvas = page.frameLocator('#stageFrame iframe').locator('canvas').first();
      await canvas.focus();
      const rect=await canvas.boundingBox();
      // Exclude both the pack HUD and DOM title bars while preserving the entire jamb.
      const clip={x:Math.ceil(rect.x+rect.width*.03), y:Math.ceil(rect.y+rect.height*.12),
        width:Math.floor(rect.width*.94),height:Math.floor(rect.height*.69),scale:.5};
      const now=await page.evaluate(()=>Date.now());
      await page.clock.pauseAt(new Date(now+160));
      await analysis.evaluate(()=>resetImagePair());
      const rows=[];
      async function frame(key) {
        await page.clock.runFor(16);
        const layers=await page.evaluate(()=>wallRouteLayers());
        const status=await page.locator('#biomeLibraryStatus').textContent();
        if(status?.startsWith('Surface crossing paused')) throw Error(status+' '+JSON.stringify(rows.slice(-3).map(r=>r.layers)));
        // Paint through Chromium's compositor, including the parked source or any fade.
        const {data}=await cdp.send('Page.captureScreenshot',{format:'png',clip,fromSurface:true,captureBeyondViewport:false});
        const score=await analysis.evaluate(data=>scoreImage(data),data);
        let uncovered=1;
        const visible=[];
        for(const layer of layers.slice().reverse()){
          const weight=uncovered*layer.opacity*layer.frameOpacity;
          if(weight>.001)visible.push({id:layer.id,weight});
          uncovered-=weight;
        }
        if(uncovered>.001)visible.push({id:'observatory',weight:uncovered});
        const row={route:route.name,frame:rows.length,ms:rows.length*16,key,layers,visible,score};
        rows.push(row); frames.push(row);
        if(out) fs.writeFileSync(path.join(out,route.name+'-'+String(row.frame).padStart(4,'0')+'.png'),Buffer.from(data,'base64'));
        if(rows.length===1 || rows.at(-2).layers.map(l=>l.stage+':'+l.id).join()!==layers.map(l=>l.stage+':'+l.id).join())
          console.log(route.name,row.frame,'layers',layers.map(l=>[l.stage,l.id,l.opacity,l.frameOpacity,l.depth]));
        return row;
      }
      async function travel(key,done,max=180) {
        await page.keyboard.down(key);
        try {
          for (let i=0;i<max;i++){
            const row=await frame(key);
            if(done(row.layers.find(l=>l.stage==='stageFrame'&&l.active),i))return;
          }
          throw Error(route.name+' '+key+' did not reach waypoint: '+JSON.stringify(rows.at(-1)));
        } finally {await page.keyboard.up(key);}
      }
      await frame(null);
      // Aim across the gold jamb before facing straight out of the large door.
      await travel('ArrowRight',(_,i)=>i>=9);
      await travel('ArrowLeft',(_,i)=>i>=9);
      await travel('KeyW',l=>l?.id==='infinite-meadow' && l.depth>=1);
      await travel('KeyS',l=>l?.id==='infinite-meadow' && l.depth<=-4);
      await travel('KeyW',l=>l?.id==='infinite-meadow' && l.depth>=1);
      await travel('KeyS',l=>l?.id==='border-transport' && l.depth<=-45);
      console.log(route.name,rows.length,'frames; largest changes',
        [...rows].sort((a,b)=>b.score.changedFraction-a.score.changedFraction).slice(0,5)
        .map(r=>[r.frame,r.score.changedFraction.toFixed(3),r.score.meanDelta.toFixed(2)]));
      await page.clock.resume();
    }
    // Small camera motions and crossing the sill can change individual pixels.
    // Flag a broad colour jump or a nearly black image, including the actual swap.
    for(const [i,row] of frames.entries()) {
      assert(row.score.dark<.95, 'Black display at '+row.route+' frame '+row.frame);
      assert(row.score.sky>.07 && row.score.sky<.82,'Lost the expected sky/ground horizon at '+row.route+' frame '+row.frame);
      if(row.frame<=20) {
        assert(row.score.wallGreenFraction<.005,'Green growth on inner wall at '+row.route+' frame '+row.frame);
        if(row.route.startsWith('flight'))assert(row.score.deckGreenMinusBlue<24,'Olive soil covers the paved apron at '+row.route+' frame '+row.frame);
      }
      if(!row.frame)continue;
      const front=r=>r.layers.findLast(l=>l.id && l.opacity*l.frameOpacity>=.5);
      const a=front(frames[i-1]),b=front(row);
      if(a && b){
        // A 1.8 km/s pilot can pass the entire jamb in one tick. Count the
        // actual translation before judging the extent of moving geometry.
        const translation=Math.hypot(a.depth-b.depth,a.jamb-b.jamb);
        if(translation<3)assert(row.score.changedFraction<.25, 'Abrupt image change at '+row.route+' frame '+row.frame);
        if(a.instance===b.instance && Number.isInteger(a.frames) && Number.isInteger(b.frames))
          assert(b.frames-a.frames<=1,'A renderer frame was skipped at '+row.route+' frame '+row.frame);
      }
    }
    assert.deepEqual(errors,[]);
    console.log('Passed',frames.length,'rendered frames');
  } finally {
    if(out) fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify({frames,errors},null,2));
    await browser.close(); await server.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
