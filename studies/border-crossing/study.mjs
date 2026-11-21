import {classes,atDistance,distanceOf,advanceWalker,freightAt,surfaceAddress} from './station.mjs';
import {makeView} from './view.mjs';

const el=id=>document.getElementById(id);
const base=new URLSearchParams(location.search);
const canvas=el('scene'),keys=new Set();
let station=null,locked=false,clock=Date.now()/1000,walker={distanceM:0,transferDirection:0};
let direction=1,walking=false,paused=false,yawOffset=0,pitchOffset=0,request=0,last=0,drag=null,scene;
const route=()=>{const id=el('route').value;if(id==='lookout')return station.lookoutRoute;
  return id==='floor-service'?station.floorRoute:station.routes.find(r=>r.id===id);};
const body=()=>classes.find(g=>g.id===el('route').value)||classes[0];
const setText=(id,txt)=>{if(el(id).textContent!==txt)el(id).textContent=txt;};
const stationWorld=base.get('world')||'sphere-0000000000000017';

function resetRoute(){
  if(!station)return;
  walker={distanceM:direction===1?0:distanceOf(route()),transferDirection:0,waiting:false};
  yawOffset=0;pitchOffset=0;walking=false;keys.clear();
  el('walk').setAttribute('aria-pressed','false');
}
async function loadSite(enter){
  const serial=++request;
  if(!enter){station=null;locked=false;walking=false;setText('state','Surveying station…');}
  const q=new URLSearchParams({world:stationWorld,a:base.get('a')||'r10c0',b:base.get('b')||'r11c0',bay:el('bay').value});
  const result=await fetch('/api/border-stations?'+q,{method:enter?'POST':'GET'});
  const record=await result.json();
  if(!result.ok)throw Error(record.error||'Station unavailable');
  if(serial!==request)return;
  const changed=station?.address.key!==record.station.address.key;
  station=record.station;locked=record.locked;scene.load(station);
  el('route').querySelector('option[value="lookout"]').disabled=!station.lookout;
  if(!station.lookout&&el('route').value==='lookout')el('route').value='service';
  if(changed)resetRoute();
  el('enter').disabled=locked;
  setText('state',station.layout+' · '+(station.widthM/1000)+' km across · '+station.address.plots.join(' / ')+' · '+(locked?'Recorded in Atlas '+record.discoveredAt:'Survey preview. Enter to record this layout.'));
}
function report(e){setText('state',e.message);}
function camera(){
  const r=route(),mid=station.widthM/2,bridge=station.routes[0],bx=bridge.nearDoor[0],high=bridge.points[2][1];
  if(el('view').value==='bridge'){
    const bay=station.lookout;
    if(bay)return [[bay.x,bay.y+1.7,bay.z],.28+yawOffset,-.48+pitchOffset];
    return [[bx,high+1.7,mid-station.laneHalfM*.91],.32+yawOffset,-.34+pitchOffset];
  }
  if(el('view').value==='lane')return [[station.floorRoute.points[2][0],1.7,mid-station.laneHalfM-60],.40+yawOffset,.17+pitchOffset];
  const {position,forward}=atDistance(r,walker.distanceM);
  return [[position[0],position[1]+body().eye,position[2]],Math.atan2(forward[0],forward[2])+(direction===1?0:Math.PI)+yawOffset,pitchOffset];
}
function draw(){
  if(!station)return;
  const [eye,yaw,pitch]=camera();scene.draw(station,eye,yaw,Math.max(-1.45,Math.min(1.45,pitch)),clock);
  const length=distanceOf(route());
  el('distance').value=Math.round(1000*walker.distanceM/length);
  const view=el('view').selectedOptions[0].textContent;
  setText('readout',view+' · '+(walker.distanceM/1000).toFixed(2)+' / '+(length/1000).toFixed(2)+' km · eye '+eye[1].toFixed(1)+' m above slab'+(walker.waiting?' · holding for freight':''));
}
function tick(now){
  const dt=Math.min(.2,Math.max(0,(now-(last||now))/1000))*Number(el('rate').value);last=now;
  if(station&&!paused){
    const intent=walking||keys.has('KeyW')?1:keys.has('KeyS')?-1:0;
    if(locked)walker=advanceWalker(station,route(),walker,intent*direction,dt,clock);
    clock+=dt;
  }
  draw();requestAnimationFrame(tick);
}
function passClock(){
  // A named clock setting lets independent observers film the same scheduled load.
  const x=station.routes[0].nearDoor[0]+400;
  return (station.address.chainageM+x)/station.traffic.speedMps-station.traffic.phaseS;
}
el('settings').onsubmit=e=>e.preventDefault();
el('bay').onchange=()=>loadSite(false).catch(report);
el('enter').onclick=()=>loadSite(true).catch(report);
el('route').onchange=resetRoute;
el('view').onchange=()=>{yawOffset=0;pitchOffset=0;draw();};
el('turn').onclick=()=>{direction*=-1;yawOffset=0;};
el('pause').onclick=()=>{paused=!paused;el('pause').setAttribute('aria-pressed',String(paused));setText('pause',paused?'Resume clock':'Pause clock');};
el('walk').onclick=async()=>{try{
  if(!station)return;
  const key=station.address.key;if(!locked)await loadSite(true);
  if(station?.address.key!==key||!locked)return;
  walking=!walking;el('walk').setAttribute('aria-pressed',String(walking));
}catch(e){report(e);}};
el('pass').onclick=()=>{if(station)clock=passClock()-220;};
el('distance').oninput=()=>{if(station){walker={distanceM:Number(el('distance').value)/1000*distanceOf(route()),transferDirection:0,waiting:false};draw();}};
canvas.onkeydown=async e=>{
  if(!['KeyW','KeyS'].includes(e.code)||e.repeat||!station)return;
  e.preventDefault();keys.add(e.code);
  if(!locked)try{await loadSite(true);}catch(err){keys.delete(e.code);report(err);}
};
canvas.onkeyup=e=>keys.delete(e.code);window.addEventListener('blur',()=>keys.clear());
canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus();};
canvas.onpointermove=e=>{if(!drag)return;yawOffset+=(e.clientX-drag[0])*.004;pitchOffset=Math.max(-1.3,Math.min(1.3,pitchOffset-(e.clientY-drag[1])*.004));drag=[e.clientX,e.clientY];};
canvas.onlostpointercapture=()=>{drag=null;};
if(base.has('bay')&&Array.from(el('bay').options).some(o=>o.value===base.get('bay')))el('bay').value=base.get('bay');
try{
  scene=makeView(canvas);await loadSite(false);requestAnimationFrame(tick);
  window.BorderCrossingStudy={
    inspect:()=>({station,locked,clock,walker:{...walker},eye:camera()[0],surface:surfaceAddress(station,camera()[0]),glError:canvas.getContext('webgl2').getError()}),
    witness(view,timeOffset=0){
      if(!['bridge','lane'].includes(view))throw Error('Unknown witness');
      paused=true;el('pause').setAttribute('aria-pressed','true');setText('pause','Resume clock');
      el('view').value=view;yawOffset=0;pitchOffset=0;clock=passClock()+timeOffset;draw();
      return {clock,eye:camera()[0],train:freightAt(station,clock).train};
    },
    visibleFreight(){
      const [eye,yaw,pitch]=camera(),gl=canvas.getContext('webgl2');
      scene.draw(station,eye,yaw,pitch,clock,true);
      const w=canvas.width,h=canvas.height,rgba=new Uint8Array(w*h*4);
      gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      let count=0,sum=0,top=0,underside=0;
      for(let i=0;i<w*h;i++)if(rgba[i*4]>127){
        ++count;sum+=i%w;if(rgba[i*4+1]>127)++top;if(rgba[i*4+2]>127)++underside;
      }
      draw();
      return {pixels:count,fraction:count/(w*h),centroidX:count?sum/(count*w):null,
        topFraction:top/Math.max(count,1),undersideFraction:underside/Math.max(count,1),width:w,height:h};
    }
  };
}catch(e){report(e);}
