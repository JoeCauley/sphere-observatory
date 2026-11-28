'use strict';
// Native Date Line Exchange doorway trial. Arguments: a seed register, a new evidence directory,
// optional --quick and --part=visual|timing|crossing|all. Each part uses its own register and browser.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const {start}=require('../../tests/support/observatory-server.cjs'),{executable}=require('../../tests/support/biome-browser.cjs');
const {instrument}=require('./frame-probe.cjs'),{measuredSidestep,walkCrossing,percentile}=require('./native-route.cjs');
const args=process.argv.slice(2),[source,target]=args.filter(s=>!s.startsWith('--'));
if(!source||!target)throw Error('Usage: node tools/bay0-doorway/run-trial.cjs <seed register> <new evidence directory> [--quick] [--part=all]');
const quick=args.includes('--quick'),part=args.find(s=>s.startsWith('--part='))?.slice(7)??'all';
assert(['all','visual','timing','crossing'].includes(part));
const want=p=>part==='all'||part===p,runMs=quick?5000:30000,viewport={width:1280,height:800};
const out=path.resolve(target),img=path.join(out,'images'),store=path.join(out,'register.json');
if(fs.existsSync(path.join(out,'trial.json')))throw Error('Choose a new evidence directory');
fs.mkdirSync(img,{recursive:true});fs.copyFileSync(source,store);
if(fs.existsSync(source+'.border-atlas'))fs.cpSync(source+'.border-atlas',store+'.border-atlas',{recursive:true});
const SUGGESTED={noon:424000,dusk:425000,night:426000},delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve(__dirname,'../..'),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const files=['packs/border-transport/0.10.0/pack.mjs','packs/kit/frontage-window.mjs','packs/sideways-city/1.0.0/city.js',
  'packs/sideways-city/1.0.0/exterior.mjs','packs/sideways-city/1.0.0/streets.mjs','stage-frame.js','packs/kit/destination-light.mjs','packs/kit/doorway-trial.mjs',
  ...fs.readdirSync(__dirname).filter(f=>/\.(js|cjs)$/.test(f)).sort().map(f=>'tools/bay0-doorway/'+f)];
const log={started:new Date().toISOString(),base:git('rev-parse','HEAD'),branch:git('branch','--show-current'),sourceBlobs:Object.fromEntries(files.map(f=>[f,git('hash-object',f)])),
  viewport,quick,part,times:SUGGESTED,errors:[],marks:{},images:[],shown:{},sidestep:{},timing:{},crossing:{},release:{},sky:[]};
const save=()=>fs.writeFileSync(path.join(out,'trial.json'),JSON.stringify(log,null,2));
function gpuSystem(){try{return execFileSync('nvidia-smi',['--query-gpu=utilization.gpu,clocks.current.graphics,memory.used','--format=csv,noheader'],{encoding:'utf8',windowsHide:true}).trim();}catch{return null;}}
(async()=>{
  const host=await start({storePath:store});let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:executable(),args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--ignore-gpu-blocklist']});
    const ctx=await browser.newContext({viewport,deviceScaleFactor:1});await ctx.addInitScript(instrument);
    const page=await ctx.newPage();page.setDefaultTimeout(180000);page.on('pageerror',err=>{log.errors.push(err.message);console.error('PAGE',err.message);});
    const T=(fn,arg)=>page.evaluate(fn,arg);
    await page.goto(host.origin+'/?crossing=city-marsh&hold=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{if(window.SphereLoading?.error)throw Error(SphereLoading.error);return window.SphereLoading?.ready&&document.querySelector('#sceneLoading')?.hidden;});
    await T(async()=>{window.trial=await import('/tools/bay0-doorway/trial-page.js');if(window.SphereStageSound?.on)SphereStageSound.toggle();});
    log.build=await T(async()=>await(await fetch('/build-info.json')).json());
    const set=s=>T(s=>trial.settings(s),s),time=t=>T(t=>trial.setTime(t),t),place=m=>T(m=>trial.place(m),m),sample=()=>T(()=>trial.sample());
    const hall=async()=>{await set({holdBorder:true});await T(()=>trial.open('hall'));await page.waitForFunction(()=>trial.location().settled&&!!document.querySelector('#stageFrame iframe')?.contentWindow?.SphereBorderTrial);};
    const native=async mark=>{await set({holdBorder:false});await T(m=>trial.openCity(m),mark);await page.waitForFunction(()=>trial.location().owner==='sideways-city'&&trial.location().settled);await delay(550);};
    const shot=async(name,mark)=>{
      await delay(350);const s=await sample();assert.equal(s.gl,0,'WebGL error at '+name);assert(s.location.settled,'Unsettled image '+name);
      if(mark){const expected=await T(m=>trial.local(trial.MARKS[m]),mark),v=s.location.stationPose;
        const error=Math.hypot(v.eastM-expected.eastM,v.northM-expected.northM,v.altitudeM-expected.altitudeM);
        assert(error<.12,'Unmatched camera '+name+' '+error);s.positionErrorM=error;}
      await page.locator('#stageFrame').screenshot({path:path.join(img,name+'.png')});log.images.push(name);log.shown[name]=s;return s;
    };
    await set({mode:'current',light:'reference',holdBorder:true,farM:0});await time(SUGGESTED.noon);await hall();
    const calibration=await T(times=>trial.lightSchedule(times),SUGGESTED),TIMES=calibration.times;
    log.lightCalibration=calibration;log.times=TIMES;await time(TIMES.noon);
    console.log('Shade at marks',calibration.atMarks,'Sphere seconds',TIMES,'original marks',calibration.atSuggested);
    log.device=await T(()=>{const gl=document.querySelector('#stageFrame iframe').contentDocument.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null;});
    assert(/RTX 5080/i.test(log.device),'Expected ALPHA hardware, got '+log.device);log.chrome=browser.version();console.log('Device',log.device,log.chrome,part);save();
    if(want('visual')){
      for(const mark of ['hall','inside','outside']){await place(mark);await delay(700);log.marks[mark]=await shot('original-reference-'+mark,mark);}
      for(const [light,period] of [['reference','noon'],['sphere','noon'],['sphere','dusk'],['sphere','night']]){
        console.log('Matched views',light,period);await hall();await time(TIMES[period]);
        for(const mode of ['current','clipped']){
          await set({mode,light,holdBorder:true});
          for(const mark of ['hall','inside']){await place(mark);await delay(350);const s=await shot([light,period,mode,mark].join('-'),mark);
            assert.equal(s.picture.mode,mode==='clipped'?'clipped':'live','Incorrect picture in '+mark);
            assert(Math.abs(s.light.direct-calibration.atMarks[period])<=.04,'Station Shade mismatch at '+period+': expected '+calibration.atMarks[period]+' measured '+s.light.direct+' at '+s.sphereTime);}
        }
        for(const mark of ['inside','outside']){await native(mark);const s=await shot([light,period,'city-native',mark].join('-'),mark);
          assert(Math.abs(s.light.direct-calibration.atMarks[period])<=.04,'City Shade mismatch at '+period+': expected '+calibration.atMarks[period]+' measured '+s.light.direct+' at '+s.sphereTime);log.marks['city-'+light+'-'+period+'-'+mark]=s;}
        save();
      }
      await hall();await time(TIMES.noon);
      for(const mode of ['current','clipped']){
        await time(TIMES.noon);
        await set({mode,light:'sphere',holdBorder:true});await place('inside');await delay(600);
        log.sidestep[mode]=await T(quick=>trial.sidestep({seconds:quick?1:6,steps:quick?12:60}),quick);
        for(const [name,east] of [['left',2598.8],['mid',2600],['right',2601.2]]){await place({depth:.7,east,yaw:Math.PI,pitch:.04});const s=await shot('sidestep-'+mode+'-'+name);
          assert.equal(s.sphereTime,TIMES.noon,'Sidestep must start under the same full daylight');assert.equal(s.light.direct,1);}
        await place('inside');
        for(const t of calibration.sweep){await time(t);await delay(400);const s=await shot('sky-'+mode+'-'+t);log.sky.push({mode,t,direct:s.light?.direct,pose:s.location.stationPose});}
        save();
      }
    }
    if(want('timing')){
      await hall();await time(TIMES.noon);
      const rows={current:[],clipped:[]};
      for(let round=0;round<3;round++){
        const order=round===1?['clipped','current']:['current','clipped'];
        for(const mode of order){
          await set({mode,light:'sphere',holdBorder:true});await place('inside');await delay(1200);
          const startAt=new Date().toISOString(),systemBefore=gpuSystem();
          const r=await measuredSidestep(page,runMs);assert.equal(r.mode,mode==='clipped'?'clipped':'live');
          Object.assign(r,{round:round+1,startAt,endAt:new Date().toISOString(),systemBefore,systemAfter:gpuSystem()});rows[mode].push(r);
          const a=rows[mode];log.timing[mode]={runs:a,medianP95:percentile(a.map(x=>x.p95),.5),medianGpuP95:r.gpuAvailable===false||r.gpuP95==null?null:percentile(a.map(x=>x.gpuP95),.5),
            worst:Math.max(...a.map(x=>x.worst)),peakBytes:Math.max(...a.map(x=>x.peakBytes))};
          console.log('SAMPLE',mode,round+1,r.frames,'GPU p95',r.gpuP95,'frame p95',r.p95,'picture',r.pictureBytes);save();
        }
      }
      for(const mode of ['current','clipped']){
        await set({mode,holdBorder:true});await place('inside');await delay(550);
        const before=await sample();await place({depth:.7,east:2600,pitch:.025,yaw:0});await delay(1800);
        const after=await sample();log.release[mode]={before:before.picture,picture:after.picture,liveBytesAfterTurn:await T(()=>document.querySelector('#stageFrame iframe').contentWindow.__alloc.live)};save();
      }
    }
    if(want('crossing')){
      await time(TIMES.noon);
      for(const [name,mode,hold] of [['current-held','current',true],['clipped-held','clipped',true],['switch','current',false]]){
        await hall();await set({mode,light:'sphere',holdBorder:true});
        console.log('Crossing',name);log.crossing[name]=await walkCrossing(page,hold,quick);const s=log.crossing[name];
        console.log('CROSS',name,s.owners,s.worstHitchMs,s.worstMotionGapMs,s.positions.map(p=>p.depth));save();
      }
    }
    assert.deepEqual(log.errors,[]);log.passed=true;
  }catch(e){log.errors.push(e.stack||e.message);console.error(e);process.exitCode=1;}
  finally{log.finished=new Date().toISOString();save();await browser?.close().catch(()=>{});await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
