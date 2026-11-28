import {transfer} from './transfer.js';
import {cycleMs} from '../../kit/rolling-mill.mjs';

const [x,z]=transfer.intake;
export const axis=[(x-transfer.outlet[0])/transfer.length,(z-transfer.outlet[1])/transfer.length];
export const at=(d,s)=>[x+d*axis[0]-(s-12.4)*axis[1],z+d*axis[1]+(s-12.4)*axis[0]];
export const rackD=[6.45,9.15],stackD=-4.45,standD=.55,mandrelD=3.65;
const deskD=2.6,deskS=4.8;
export const origin=at(0,0),panel=at(deskD,deskS);
export function millPlace(){
  const [eastM,northM]=at(1.32,8.15);
  return {eastM,northM,altitudeM:1.7,yaw:Math.atan2(axis[1],axis[0])+Math.atan2(.40,8.15),pitch:.042,mode:'walk'};
}
export function atPanel(pose,datum){
  return pose.mode==='walk' && pose.altitudeM<datum+3 && Math.hypot(pose.eastM-panel[0],pose.northM-panel[1])<3.8;
}

const iron=[.11,.16,.16], enamel=[.07,.26,.25], rim=[.43,.48,.43], oil=[.048,.064,.062];
const safety=[.91,.46,.055], ivory=[.90,.82,.63], red=[.75,.095,.035];
export function addMillSolids(hex,add){
  if(hex.id!==transfer.destination)return;
  const a=Math.atan2(axis[1],axis[0])-hex.rot;
  function xyz(d,y,s){const [x,z]=hex.toLocal(...at(d,s));return [x,y,z];}
  function box(d,y,s,hx,hy,hz,c,extra={}){
    const [x,,z]=xyz(d,y,s);add({k:'box',x,y,z,hx,hy,hz,rot:a,c,...extra});
  }
  function tube(d,y,s,d2,y2,s2,r,c,extra={}){
    add({k:'pipe',a:xyz(d,y,s),b:xyz(d2,y2,s2),r,c,...extra});
  }
  // Walking collision and rendering share the beds, housing, rack and desk.
  box(-2.7,.21,0,3.65,.21,1.20,iron);
  for(const s of [-1.04,1.04])box(-2.55,.90,s,3.65,.19,.115,enamel);
  for(let d=-5.9;d<-.2;d+=.54)tube(d,1.10,-1.10,d,1.10,1.10,.15,rim);
  for(const d of [-5.5,-3.1,-1.1,2.45])for(const s of [-.92,.92])box(d,.59,s,.16,.34,.15,iron);
  box(stackD,.98,0,1.61,.19,1.13,oil);
  box(standD,.20,0,1.14,.20,1.81,oil);
  for(const s of [-1.43,1.43]){
    for(const d of [standD-.74,standD+.74]){
      box(d,2.02,s,.215,1.66,.25,enamel);
      box(d,.49,s,.32,.16,.34,rim);
      box(d,3.55,s,.28,.16,.29,iron);
    }
    box(standD,3.83,s,1.13,.40,.36,enamel);
    box(standD,4.27,s,1.24,.12,.40,safety);
    box(standD,2.17,s,.35,.24,.30,iron);
  }
  for(const y of [1.02,2.05])tube(standD,y,-1.5,standD,y,1.50,.46,rim);
  tube(standD,4.20,-1.43,standD,4.20,1.43,.24,iron);
  for(const d of [standD-.63,standD+.63]){tube(d,4.07,0,d,4.78,0,.27,enamel);tube(d,4.73,0,d,4.86,0,.32,rim);}
  // Enamel R1 sign faces the operator. Strokes are physical paint on the plate.
  box(standD,3.87,1.83,.83,.36,.035,oil);
  const stroke=(u,v,uu,vv)=>tube(standD+u,3.87+v,1.878,standD+uu,3.87+vv,1.878,.044,ivory,{soft:true});
  for(const q of [[-.56,-.24,-.56,.24],[-.56,.24,-.27,.24],[-.27,.24,-.18,.13],[-.18,.13,-.25,.01],[-.25,.01,-.56,.01],[-.39,.01,-.15,-.24],[.20,.14,.36,.24],[.36,.24,.36,-.24],[.19,-.24,.55,-.24]])stroke(...q);
  box(2.16,.63,0,1.05,.28,1.12,enamel);
  for(const d of [1.78,2.30,2.82])tube(d,1.18,-1.02,d,1.18,1.02,.19,rim);
  box(mandrelD,.20,0,.97,.20,1.49,iron);
  box(mandrelD,1.18,-1.23,.69,.84,.33,enamel);
  tube(mandrelD,1.88,-1.54,mandrelD,1.88,.92,.235,rim);
  box(7.81,.19,0,2.85,.19,1.24,iron);
  for(const d of rackD)for(const off of [-.75,.75]){
    box(d+off,.46,0,.17,.24,1.08,safety);
    tube(d+off,.69,-.99,d+off,.69,.99,.16,oil);
  }
  // The low transfer bed connects the winding saddle to the two rack cradles.
  for(const s of [-.89,.89])box(5.02,.61,s,1.05,.14,.11,enamel);
  box(deskD,.16,deskS,.48,.16,.39,iron);
  box(deskD,.76,deskS,.18,.46,.18,enamel);
  box(deskD,1.31,deskS,.47,.15,.32,oil);
  tube(deskD-.22,1.45,deskS+.03,deskD-.22,1.53,deskS+.03,.092,[.17,.75,.36],{soft:true});
  tube(deskD+.22,1.45,deskS+.03,deskD+.22,1.53,deskS+.03,.092,safety,{soft:true});
  box(deskD+.35,1.82,deskS-.21,.04,.47,.04,rim);
  box(deskD+.35,2.26,deskS-.21,.10,.15,.10,red);
}

const clamp01=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp01(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export function materialParts(view,draw){
  const {record,remainingMs}=view;
  const base=1.24,depth=.215,full=.95;
  for(let i=0;i<record.slabs;i++)draw('slab',stackD,base+i*depth,1,1,1,0,.15);
  for(let j=0;j<2;j++)if(record.rack[j])draw('coil',rackD[j],1.37,full,full,1,0,.18);
  if(!record.job)return;
  const t=1-remainingMs/cycleMs;
  // Slab clears the pile, enters the bite, then narrows as strip pays onto the mandrel.
  const lift=ease(t/.10),travel=ease((t-.085)/.155);
  const nose=mix(stackD+1.4,standD,travel),tail=nose-2.8*(1-ease((t-.24)/.38));
  if(nose-tail>.008)draw('slab',(tail+nose)/2,mix(base+record.slabs*depth,1.53,lift),(nose-tail)/2.8,mix(1,.53,travel),1,0,mix(.48,.99,lift));
  const wind=clamp01((t-.40)/.43),radius=mix(.37,full,Math.sqrt(wind));
  if(t>.24 && t<.84){
    // The strip takes the upper tangent from the roll bite to the growing coil.
    const run=mandrelD-standD,rise=1.88-1.53,distance=Math.hypot(run,rise);
    const angle=Math.atan2(rise,run)+Math.asin(radius/distance);
    const tangent=Math.sqrt(distance*distance-radius*radius);
    const front=tangent*ease((t-.24)/.16),back=tangent*ease((t-.72)/.12),middle=(front+back)/2;
    if(front-back>.005)draw('strip',standD+middle*Math.cos(angle),1.53+middle*Math.sin(angle),(front-back)/2.8,.35,.96,angle,.95);
  }
  if(t>=.40){
    const toRack=ease((t-.84)/.16),d=mix(mandrelD,rackD[record.job.slot],toRack);
    draw('coil',d,mix(1.88,1.37,toRack)+.19*Math.sin(Math.PI*toRack),radius,radius,1,wind*12+toRack*3,mix(.91,.18,ease((t-.75)/.25)));
  }
}
