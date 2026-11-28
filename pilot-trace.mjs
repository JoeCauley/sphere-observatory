// Loaded on demand from the Atlas. No frame callback runs between recordings.
const maxFrames=7200;
const idleLabel='Record flight or walk';
let recording=null;

function layer(shell,sceneId,passages){
  const frame=shell?.querySelector('iframe');
  if(!frame)return null;
  const api=frame.contentWindow?.SphereBiome;
  const id=sceneId??(api?.facility?api.id+'/'+api.facility:api?.id)??null;
  const result={id,version:api?.version??null,active:frame.surfaceEntry?.active??null,
    shellOpacity:Number(getComputedStyle(shell).opacity),frameOpacity:Number(getComputedStyle(frame).opacity),
    horizontalFov:frame.surfaceEntry?.horizontalFov??null,width:frame.clientWidth,height:frame.clientHeight};
  const passage=frame.surfaceEntry?.passage;
  if(passage){
    if(!passages.includes(passage))passages.push(passage);
    result.passage=passages.indexOf(passage);
  }
  // A newly mounted pack can publish its API before it has a camera or a first draw.
  if(!result.horizontalFov && result.height && (id==='border-transport'||id==='infinite-meadow'))
    result.horizontalFov=2*Math.atan(result.width/result.height/1.428148)*180/Math.PI;
  try{
    const p=api?.pose(),info=api?.inspect?.();
    if(p && Number.isFinite(p.eastM))result.pose=p;
    if(info){
      result.frame=info.frames;result.draws=info.draws;result.station=info.station??info.exteriorStation;result.group=info.group;
      result.bridge=info.bridge?.phase;result.error=info.error||info.bridge?.error||undefined;
    }
  }catch(error){result.error=error.message;}
  return result;
}

function begin(button,status){
  const app=window.SphereApp,stage=window.SphereStageFrame,lib=window.SphereBiomeLibrary;
  if(!lib?.world || !app || !stage)throw Error('Wait for the Observatory to open before recording.');
  const started=performance.now(),viewport=document.getElementById('viewport');
  const report={format:'sphere-pilot-trace',version:1,started:new Date().toISOString(),world:lib.world,
    build:window.SphereBuild,initial:app.snapshot(),viewport:{width:viewport.clientWidth,height:viewport.clientHeight,
      windowWidth:innerWidth,windowHeight:innerHeight,pixelRatio:devicePixelRatio},
    placements:lib.placed().map(({packId,version,plotId,edge,detailInstalled,footprint})=>
      ({packId,version,plotId,edgeId:edge?.id,detailInstalled,footprint})),passages:[],events:[],frames:[]};
  const events=new AbortController(),channel=new MessageChannel();
  const hostStatus=document.getElementById('biomeLibraryStatus');
  function captureStatus(){
    const message=hostStatus.textContent;
    if(message!==report.events.at(-1)?.message)report.events.push({ms:performance.now()-started,message});
  }
  const messages=new MutationObserver(captureStatus);
  if(hostStatus){captureStatus();messages.observe(hostStatus,{childList:true,characterData:true,subtree:true});}
  let raf=0,running=true;
  function stop(reason){
    if(!running)return;
    running=false;cancelAnimationFrame(raf);events.abort();messages.disconnect();channel.port1.close();channel.port2.close();
    report.endReason=reason;
    button.textContent='Save route trace';
    status.textContent='Stopped after '+report.frames.length+' samples. Save the trace to keep it.';
  }
  function sample(timestamp){
    const info=app.renderer.renderInfo;
    report.frames.push({ms:Math.max(0,timestamp-started),sampledMs:performance.now()-started,
      keys:stage.heldNavigation,pace:stage.surfacePace,main:app.cameraSample(),width:viewport.clientWidth,height:viewport.clientHeight,
      nativeStation:info?.walkingStation??null,nativeZone:info?.borderEnvironment?.zone??null,
      windTime:stage.currentMeadowWindTime,cloud:stage.cloudOpacity,
      stage:layer(document.getElementById('stageFrame'),stage.current?.id,report.passages),
      departing:layer(document.getElementById('departingStageFrame'),null,report.passages)});
    if(report.frames.length>=maxFrames)stop('frame-limit');
  }
  // Main's animation callbacks precede its child documents'. Read after that
  // animation update so the measured local pose includes the child's input.
  // Keep both timestamps and each pack's draw counter for slow or repeated frames.
  channel.port1.onmessage=event=>{if(running)sample(event.data);};
  function tick(timestamp){
    channel.port2.postMessage(timestamp);
    raf=requestAnimationFrame(tick);
  }
  window.addEventListener('sphere-biome-world-leaving',()=>stop('world-changed'),{signal:events.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('tab-hidden');},{signal:events.signal});
  button.textContent='Stop and save route trace';
  status.textContent='Recording camera, movement keys and scene layers. Stops at 7,200 samples or when the tab is hidden.';
  const child=document.querySelector('#stageFrame iframe');
  if(child)child.contentWindow.focus();else viewport.focus();
  sample(started);raf=requestAnimationFrame(tick);
  return {save(){
    stop('pilot');
    const file='sphere-pilot-trace-'+report.started.replace(/[:.]/g,'-')+'.json';
    app.download(new Blob([JSON.stringify(report)],{type:'application/json'}),file);
    status.textContent='Saved '+report.frames.length+' camera samples to '+file+'.';
    button.textContent=idleLabel;
  }};
}

export function toggleTrace(button,status){
  if(recording){recording.save();recording=null;}
  else recording=begin(button,status);
}
