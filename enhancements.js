(function(){
 'use strict';if(!window.SphereApp)return;
 const A=SphereApp,M=SphereMath,$=id=>document.getElementById(id),canvas=$('view'),vp=$('viewport');
 let measuring=false,points=[],drawing=false,result=null,signature='',busy=false,cancelled=false;
 function clear(){points=[];result=null;signature='';$('surveyPath').setAttribute('d','');$('exportSurvey').disabled=true;$('surveyResult').textContent='Drag over the surface. Shades, star and open space are excluded.';}
 function traceOverlay(){const rect=vp.getBoundingClientRect();$('surveyOverlay').setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);const path=points.map((p,i)=>(i?'L':'M')+((p[0]+1)*.5*rect.width)+' '+((1-p[1])*.5*rect.height)).join(' ');$('surveyPath').setAttribute('d',path+(points.length>2?' Z':''));}
 function coord(e){const r=vp.getBoundingClientRect();return [M.clamp((e.clientX-r.left)/r.width*2-1,-1,1),M.clamp(1-(e.clientY-r.top)/r.height*2,-1,1)];}
 function toggleMeasure(){if(busy)return;measuring=!measuring;$('surveyControls').hidden=!measuring;$('measureButton').classList.toggle('active',measuring);canvas.classList.toggle('measuring',measuring);if(measuring){const s=A.getState();s.playing=false;A.setState(s);clear();A.toast('Area tool on. Drag a rectangle, or select freehand to trace a region.');}else clear();}
 $('measureButton').onclick=toggleMeasure;$('clearSurvey').onclick=clear;$('surveyShape').onchange=clear;
 canvas.addEventListener('pointerdown',e=>{if(!measuring)return;e.stopImmediatePropagation();e.preventDefault();clear();points=[coord(e)];drawing=true;A.setBusy(true);canvas.setPointerCapture(e.pointerId);},true);
 canvas.addEventListener('pointermove',e=>{if(!measuring||!drawing)return;e.stopImmediatePropagation();const p=coord(e);if($('surveyShape').value==='box'){const a=points[0];points=[a,[p[0],a[1]],p,[a[0],p[1]]];}else{const a=points[points.length-1];if(Math.hypot(p[0]-a[0],p[1]-a[1])>.009&&points.length<220)points.push(p);}traceOverlay();},true);
 canvas.addEventListener('pointerup',async e=>{if(!measuring||!drawing)return;e.stopImmediatePropagation();drawing=false;busy=true;$('surveyResult').textContent='Measuring the curved surface…';
  try{await new Promise(r=>setTimeout(r,20));const s=A.getState(),r=vp.getBoundingClientRect();result=SphereSurvey.measure(s,r.width/r.height,points);signature=JSON.stringify(s);const f=new Intl.NumberFormat(undefined,{maximumSignificantDigits:5});let earths=result.earths>=1e6?f.format(result.earths/1e6)+' million':f.format(result.earths);
   const excluded=result.gross?Math.round((1-result.area/result.gross)*100):0;$('surveyResult').textContent=`${earths} Earth surfaces · ${f.format(result.area)} km². ${excluded}% of the selected footprint is hidden or open space. Sampling difference: ${(result.relativeDifference*100).toFixed(2)}%. One Earth includes its oceans.`;$('exportSurvey').disabled=false;
  }catch(err){A.toast('Could not measure: '+err.message);}finally{busy=false;A.setBusy(false);}
 },true);
 canvas.addEventListener('pointercancel',()=>{drawing=false;A.setBusy(false);clear();});
 $('exportSurvey').onclick=()=>{if(result)A.download(new Blob([JSON.stringify({format:'sphere-area-survey',version:1,...result},null,2)],{type:'application/json'}),'sphere-area-measurement.json');};
 window.addEventListener('sphere-view-changed',()=>{if(!drawing&&result)clear();});
 window.addEventListener('keydown',e=>{if(measuring&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space'].includes(e.code)){e.stopImmediatePropagation();e.preventDefault();}},true);
 setInterval(()=>{if(document.hidden||busy||drawing)return;const s=A.getState(),hit=M.trace(s.position,s.forward,s),alt=s.radius-M.length(s.position);if(result&&JSON.stringify(s)!==signature)clear();
  const km=hit.distance,w=canvas.width;let fp=Infinity;if(hit.kind==='Inner surface'){const b=M.basis(s.forward,s.up),aspect=w/canvas.height;fp=Math.max(...[[2/w,0],[0,2/canvas.height]].map(([x,y])=>{const d=M.ray(x,y,aspect,s.fov,b,s.projection==='panorama'),t=M.shellDistance(s.position,d,s.radius);return M.length(M.sub(M.add(s.position,M.mul(d,t)),hit.point));}));}
  let context=hit.kind==='Inner surface'?(km>alt*3?'Across the cavity':'Nearby inner surface')+' · '+(fp>=1000?(fp/1000).toFixed(1)+' thousand km':fp>=1?fp.toFixed(1)+' km':(fp*1000).toFixed(1)+' m')+' per pixel near centre':hit.kind==='Shade'?'Shade in foreground · distant shell behind':hit.kind==='Open space'?'Through a breach into external space':hit.kind==='Stellar station'?'Stellar service structure · prescribed geometry':'Central star';
  $('viewContext').textContent=context;$('surfaceLegend').hidden=s.collection||s.surfaceStyle==='legacy'||s.viewMode!=='material';
  if(!$('camera').hidden&&!['cameraLat','cameraLon','cameraAltitude'].includes(document.activeElement.id)){const ll=M.latlon(s.position);$('cameraLat').value=ll[0].toFixed(5);$('cameraLon').value=ll[1].toFixed(5);$('cameraAltitude').value=alt.toFixed(3);}
 },600);
 function shot(name,start,t){const s=structuredClone(start);s.playing=false;
  if(name==='dawn'){s.time=0;s.shadeOffset=.985+.030*t;s.forward=M.norm([.24+.05*(t-.5),.07,-1]);}
  else if(name==='shade'){s.time=1800*t;s.forward=M.norm([-.78+.20*t,.025*Math.sin(t*Math.PI),-1]);s.shadeDamage=.5;}
  else{s.time=start.time+t*720;}
  return s;
 }
 async function recordClip(options={}){
  if(busy)return;busy=true;cancelled=false;if(measuring){measuring=false;$('surveyControls').hidden=true;$('measureButton').classList.remove('active');canvas.classList.remove('measuring');clear();}
  const original=A.getState(),originalTitle=$('viewTitle').textContent,originalPreset=document.querySelector('[data-preset].selected')?.dataset.preset,name=options.shot||$('clipShot').value,seconds=options.seconds||12,fps=24,width=options.width||3840,height=Math.round(width*9/16);
  const mime=['video/mp4;codecs=avc1.640033','video/webm;codecs=vp9','video/webm;codecs=vp8'].find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t));
  if(!mime){busy=false;A.toast('This browser does not offer a supported local video encoder.');return;}
  if(name!=='current')A.preset(name,{stage:true});const start=A.getState();start.antialias=original.antialias;start.shadowSamples=original.shadowSamples;start.stationSamples=original.stationSamples;start.surfaceStyle=options.surfaceStyle||original.surfaceStyle;A.setBusy(true);
  const disabled=[...document.querySelectorAll('button,input,select')].filter(e=>e.id!=='cancelClip');const oldDisabled=disabled.map(e=>e.disabled);disabled.forEach(e=>e.disabled=true);$('cancelClip').hidden=false;
  let recorder,stream,chunks=[],frames=0,wall=0;
  try{
   await A.renderer.prepare(start);A.renderer.draw(shot(name,start,0),width,height,{exportFrame:true});stream=canvas.captureStream(0);const track=stream.getVideoTracks()[0];if(!track.requestFrame)throw Error('Manual video capture is unavailable in this browser.');
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:40000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||Error('Video encoder failed'));});
   recorder.start();const begin=performance.now(),total=Math.round(seconds*fps);
   for(let i=0;i<total;i++){
    if(cancelled||document.hidden)throw Error(cancelled?'Recording cancelled.':'Recording stopped because the tab was hidden. Keep it visible while capturing.');
    const wait=begin+i*1000/fps-performance.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));
    A.renderer.draw(shot(name,start,i/(total-1)),width,height,{exportFrame:true});track.requestFrame();frames++;
    if(i%fps===0)$('recordClip').textContent=`Recording ${Math.floor(i/fps)+1} / ${seconds} s…`;
   }
   const remaining=begin+seconds*1000-performance.now();if(remaining>0)await new Promise(r=>setTimeout(r,remaining));wall=(performance.now()-begin)/1000;recorder.stop();await stopped;
   const blob=new Blob(chunks,{type:mime.split(';')[0]}),extension=mime.startsWith('video/mp4')?'mp4':'webm';
   const metadata={format:'sphere-motion-study',version:1,application:'Sphere Observatory 0.8',shot:name,width,height,render:{...A.renderer.renderInfo},targetFps:fps,requestedSeconds:seconds,captureSeconds:wall,submittedFrames:frames,mimeType:mime,colour:'SDR, browser canvas encoding; not HDR or calibrated photometry',start:shot(name,start,0),end:shot(name,start,1),assumptions:A.assumptions};
   if(options.returnBlob)return {blob,metadata,extension};
   const enc=new TextEncoder();A.download(SphereZip([['motion-study.'+extension,new Uint8Array(await blob.arrayBuffer())],['shot.json',enc.encode(JSON.stringify(metadata,null,2))]]),'sphere-'+name+'-4k-sdr.zip');A.toast('Clip and shot settings saved.');
  }catch(e){A.toast(e.message);if(options.returnBlob)throw e;}finally{if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop());disabled.forEach((el,i)=>el.disabled=oldDisabled[i]);$('recordClip').textContent='Record 4K SDR clip';$('cancelClip').hidden=true;A.setState(original);$('viewTitle').textContent=originalTitle;document.querySelectorAll('[data-preset]').forEach(e=>e.classList.toggle('selected',e.dataset.preset===originalPreset));A.setBusy(false);busy=false;}
 }
 $('recordClip').onclick=()=>recordClip();$('cancelClip').onclick=()=>cancelled=true;
 window.SphereEnhancements={recordClip,getMeasurement:()=>result,clearMeasurement:clear};
})();
