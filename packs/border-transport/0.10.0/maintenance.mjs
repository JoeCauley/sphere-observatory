// Local gallery coordinates in metres, looking into either service entrance.
// The gallery begins 2 m inside the wall. At 42 m the crew can operate the
// handwheel after walking through the full 35 m habitat-facing entrance.
export const wheel={x:-2.15,y:1.48,z:40};
export const gaugeBottom=.82,gaugeTop=1.89;
const dark=[.13,.23,.23],iron=[.34,.42,.39],brass=[.70,.42,.16];
export const feedPipe=[[-4.7,2.2,35],[-4.7,2.2,wheel.z+21],.66,[.12,.205,.21]];
const channelZ=index=>wheel.z+12+3.3*index;
const full=[1,1,1,1], empty=[0,0,0,0];
// Boxes use the same local drawing and collision coordinates as the gallery ribs.
export const plantBoxes=[
  [-2.82,1.17,wheel.z+.68,2.32,2.20,.53,iron],
  // The crossbar ends at the brass union. Overlapping their front faces
  // made the two metals fight for the same depth at walking distance.
  [-3.31,1.1,wheel.z+.98,1.80,.38,.40,dark],
  [-4.42,1.58,wheel.z+.98,.42,1.14,.40,brass],
  [wheel.x,wheel.y,wheel.z+.33,.18,.18,.62,brass],
];
for(let index=0;index<3;index++){
  const x=-3.56+.37*index;
  plantBoxes.push([x,1.35,wheel.z+.33,.26,1.23,.13,dark],
    [x,1.355,wheel.z+.24,.16,gaugeTop-gaugeBottom,.06,[-1-index,0,0]]);
  const z=channelZ(index);
  // Fit the tray between the sidewalls. Its exposed ends have a single finish.
  plantBoxes.push([-3.1,.17,z,1.33,.21,3.22,dark]);
  for(const edge of [-3.83,-2.37])plantBoxes.push([edge,.48,z,.13,.82,3.22,iron]);
  plantBoxes.push([-3.1,.33,z+1.55,1.47,.45,.14,brass]);
}
export const plantSolids=plantBoxes.map(([x,y,z,w,h,d])=>[x-w/2,x+w/2,y-h/2,y+h/2,z-d/2,z+d/2]);
plantSolids.push([wheel.x-.44,wheel.x+.44,wheel.y-.44,wheel.y+.44,wheel.z-.09,wheel.z+.09]);

export function drawPlant(mesh,place){
  for(const [x,y,z,w,h,d,tint] of plantBoxes){
    const [cx,cy,cz]=place([x,y,z]);
    mesh.box(cx-w/2,cx+w/2,cy-h/2,cy+h/2,cz-d/2,cz+d/2,tint);
  }
  const rim=(angle,r,depth)=>place([wheel.x+r*Math.cos(angle),wheel.y+r*Math.sin(angle),wheel.z+depth]);
  const segments=48;
  for(let i=0;i<segments;i++){
    const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
    mesh.quad(rim(a,.44,-.08),rim(a,.35,-.08),rim(b,.35,-.08),rim(b,.44,-.08),brass);
    mesh.quad(rim(a,.44,.08),rim(b,.44,.08),rim(b,.35,.08),rim(a,.35,.08),brass);
    mesh.quad(rim(a,.44,.08),rim(a,.44,-.08),rim(b,.44,-.08),rim(b,.44,.08),brass);
    mesh.quad(rim(a,.35,-.08),rim(a,.35,.08),rim(b,.35,.08),rim(b,.35,-.08),brass);
  }
  const face=(x,y)=>place([wheel.x+x,wheel.y+y,wheel.z]);
  mesh.quad(face(-.38,-.38),face(.38,-.38),face(.38,.38),face(-.38,.38),[-4,0,0]);
  for(let i=0;i<3;i++){
    const z=channelZ(i),corner=(x,d)=>place([x,.3,z+d]);
    mesh.quad(corner(-3.76,-1.48),corner(-3.76,1.48),corner(-2.44,1.48),corner(-2.44,-1.48),[-5-i,0,0]);
  }
}

export function reachableValve(station,pose,group){
  if(!station || pose?.mode!=='walk' || group!=='service')return null;
  const far=pose.northM>0,sign=far?-1:1;
  const dx=(pose.eastM-station.address.chainageM-station.routes[0].nearDoor[0])*sign-wheel.x;
  const dz=station.widthM/2-Math.abs(pose.northM)-2-wheel.z;
  return Math.hypot(dx,dz,pose.altitudeM-wheel.y)<=2.75 ? (far?'far':'near') : null;
}

// Exact response of three serial channel sections. A single valve event is
// sufficient to recover the levels at any later instant, even after a restart.
export function channelLevels(open,levels,dt){
  const target=Number(open);
  if(dt<=0)return levels;
  const [inlet,sump,outlet]=levels;
  if(dt>=60 || (inlet===target && sump===target && outlet===target))return [target,target,target];
  const a=Math.exp(-dt/1.15),b=Math.exp(-dt/2.4),gain=1.15/(1.15-2.4);
  const fast=gain*(inlet-target),slow=sump-target-fast,down=fast*gain;
  return [target+(inlet-target)*a,target+fast*a+slow*b,
    target+down*a+(outlet-target-down+dt/2.4*slow)*b].map(x=>Math.max(0,Math.min(1,x)));
}
export function sampleDrain(event,now){
  if(!event)return full;
  const target=Number(event.open),dt=Math.max(0,now-event.at);
  if(dt>=60)return target?full:empty;
  const levels=channelLevels(event.open,event.levels,dt);
  return [levels[0],levels[1],levels[2],target+(event.levels[3]-target)*Math.exp(-dt*5)];
}
export function drainBank(address,storage){
  const cache=new Map();
  function event(face){
    const raw=storage.getItem('sphere-drain:'+address+':'+face);
    const old=cache.get(face);
    if(old && old.raw===raw)return old.event;
    let value=null;
    try{
      const v=JSON.parse(raw);
      if(v?.schema===1 && typeof v.open==='boolean' && Number.isFinite(v.at) &&
         v.levels?.length===4 && v.levels.every(x=>Number.isFinite(x)&&x>=0&&x<=1))value=v;
    }catch{}
    cache.set(face,{raw,event:value});
    return value;
  }
  return {
    read(face,now){const v=event(face);return {open:v?.open??true,levels:sampleDrain(v,now)};},
    toggle(face,now){
      const prior=event(face),next={schema:1,open:!(prior?.open??true),at:now,levels:sampleDrain(prior,now)};
      storage.setItem('sphere-drain:'+address+':'+face,JSON.stringify(next));
    }
  };
}
