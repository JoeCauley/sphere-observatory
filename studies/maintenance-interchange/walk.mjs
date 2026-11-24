import {makeView} from '../../packs/border-transport/0.10.0/view.mjs';
import {station,at,move,length,bridge,spans,startTime,buildHall} from './model.mjs';
const canvas=document.querySelector('canvas'),view=makeView(canvas,{buildHall});
view.load(station);
const keys=new Set();let pose,yaw,pitch,elapsed,mode,last=performance.now();
function reset(next){
  mode=next;
  const reverse=next.startsWith('jungle');
  const offset=next.endsWith('-ramp')?(reverse?jungleFoot:foot)-9:0;
  pose=at(reverse?length-offset:offset);
  if(next.endsWith('-summit'))pose=at(reverse?bridge.start+bridge.len+14:bridge.start-14);
  yaw=pose.yaw+(reverse?Math.PI:0);
  pitch=0;elapsed=0;keys.clear();
}
function draw(){
  if(mode==='air'){
    const t=Math.min(1,elapsed/15),range=66500*Math.pow(2500/66500,t);
    const height=36000*Math.pow(2450/36000,t);
    const tilt=(1-t)*26*Math.PI/180+t*Math.atan2(height-250,range);
    const focusZ=(1-t)*(station.widthM/2-445)+t*(station.widthM/2);
    view.draw(station,[8000-range,height,focusZ],Math.PI/2,-tilt,startTime+elapsed);
  }else view.draw(station,[pose.x,pose.y+1.7,pose.z],yaw,pitch,startTime+elapsed);
}
function loop(now){
  const dt=Math.min(.08,(now-last)/1000);last=now;
  if(!window.reviewing){
    elapsed+=dt;yaw+=dt*1.5*(keys.has('ArrowRight')-keys.has('ArrowLeft'));
    pitch=Math.min(1.4,Math.max(-1.4,pitch+dt*(keys.has('ArrowUp')-keys.has('ArrowDown'))));
    const f=keys.has('KeyW')-keys.has('KeyS'),s=keys.has('KeyD')-keys.has('KeyA'),v=(keys.has('ShiftLeft')?420:3)*dt/Math.max(1,Math.hypot(f,s));
    if(f||s)pose=move(pose,v*(f*Math.sin(yaw)+s*Math.cos(yaw)),v*(f*Math.cos(yaw)-s*Math.sin(yaw)));
    draw();
  }
  requestAnimationFrame(loop);
}
for(const b of document.querySelectorAll('button'))b.onclick=()=>{reset(b.dataset.mode);document.querySelector('details').open=false;canvas.focus();};
window.onkeydown=e=>{if(e.target===canvas){e.preventDefault();keys.add(e.code);}};window.onkeyup=e=>keys.delete(e.code);window.onblur=()=>keys.clear();

// Each cut starts in a walkable location. A second of film is a second in the scene.
const foot=spans.find(e=>e.a.y===0 && e.b.y>0).start;
const jungleSlope=spans.findLast(e=>e.a.y>0 && e.b.y===0);
const jungleFoot=length-jungleSlope.start-jungleSlope.len;
reset('meadow-summit');requestAnimationFrame(loop);
window.studyFrame=(side,seconds)=>{
  window.reviewing=true;
  document.querySelector('details').hidden=true;
  mode=side;
  elapsed=seconds;
  if(side!=='air'){
    const reverse=side==='jungle';
    const summit=reverse?bridge.start+bridge.len:bridge.start;
    const distance=1.5*(Math.min(32,seconds)-16);
    pose=at(summit+(reverse?-distance:distance));
    yaw=pose.yaw+(reverse?Math.PI:0);
    pitch=-.04;

  }
  draw();return {pose,mode,error:canvas.getContext('webgl2').getError()};
};
