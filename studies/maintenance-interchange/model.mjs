import {mesh} from '../../packs/border-transport/0.10.0/view.mjs';
import {addressOf,generateStation,freightAt} from '../../packs/border-transport/0.10.0/station.mjs';

export const station=generateStation(addressOf('sphere-ed6a59ab491a9a08','r10c0','r10c1',0));
const mid=station.widthM/2, centerX=8000, radius=1050, halfDeck=12, rise=500;
const brass=[.85,.53,.20], green=[.32,.61,.54], stone=[.48,.52,.48], iron=[.24,.32,.33];
// Equal two-turn helices put the lower approach and summit on the same tangent.
const centerOffset=1750;
function approach(side){
  const x=centerX+radius;
  const nodes=[{x,z:mid+side*(mid+16),y:0}];
  const count=128;
  for(let i=0;i<=count;i++){
    const a=-4*Math.PI*i/count;
    // Keep two level bays per quarter-turn, including the summit landing.
    const ramps=Math.floor(i/16)*14+Math.min(i%16,14);
    // The end chords follow the exact straight approach and departure bearings.
    const dx=i===1 || i===count-1?radius:radius*Math.cos(a);
    nodes.push({x:centerX+dx,z:mid+side*(centerOffset+radius*Math.sin(a)),y:rise*ramps/112});
  }
  return nodes;
}
export const nodes=[...approach(-1),...approach(1).reverse()];
export const spans=[];
let distance=0;
for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  spans.push({a,b,dx,dz,len,start:distance});distance+=len;
}
export const length=distance;
export const bridge=spans.find(e=>e.a.z<mid && e.b.z>mid);
export function at(s){
  const e=spans.find(e=>s<=e.start+e.len)||spans.at(-1);
  const t=Math.max(0,Math.min(1,(s-e.start)/e.len));
  return {x:e.a.x+t*e.dx,z:e.a.z+t*e.dz,y:e.a.y+t*(e.b.y-e.a.y),yaw:Math.atan2(e.dx,e.dz)};
}
// A walker chooses a heading freely. Test the swept foot against the nearby
// ribbon at its current elevation so stacked turns cannot exchange walkers.
export function move(p,dx,dz){
  const steps=Math.ceil(Math.hypot(dx,dz)/1.2);
  for(let i=0;i<steps;i++){
    const x=p.x+dx/steps,z=p.z+dz/steps;
    let best=null,min=Infinity;
    for(const e of spans){
      const t=Math.max(0,Math.min(1,((x-e.a.x)*e.dx+(z-e.a.z)*e.dz)/(e.len*e.len)));
      const y=e.a.y+t*(e.b.y-e.a.y);
      if(Math.abs(y-p.y)>.25)continue;
      const gap=Math.hypot(x-e.a.x-t*e.dx,z-e.a.z-t*e.dz);
      if(gap<halfDeck-.7 && gap<min){min=gap;best={x,y,z};}
    }
    if(!best)break;
    p=best;
  }
  return p;
}
let sharedHall;
export function buildHall(){
  if(sharedHall)return sharedHall;
  const m=mesh(true);
  function ribbon(i,h,w){
    const p=nodes[i],prev=spans[Math.max(0,i-1)],next=spans[Math.min(i,spans.length-1)];
    const nx=prev.dz/prev.len+next.dz/next.len,nz=-prev.dx/prev.len-next.dx/next.len;
    const dot=nx*next.dz/next.len-nz*next.dx/next.len;
    return [p.x+w*nx/dot,p.y+h,p.z+w*nz/dot];
  }
  function beam(i,lo,hi,bottom,top,col){
    const q=(j,h,w)=>ribbon(i+j,h,w);
    m.quad(q(0,top,lo),q(1,top,lo),q(1,top,hi),q(0,top,hi),col);
    m.quad(q(0,bottom,lo),q(0,top,lo),q(1,top,lo),q(1,bottom,lo),col);
    m.quad(q(0,top,hi),q(0,bottom,hi),q(1,bottom,hi),q(1,top,hi),col);
    m.quad(q(0,bottom,hi),q(1,bottom,hi),q(1,bottom,lo),q(0,bottom,lo),iron);
  }
  m.box(centerX-16000,centerX+16000,-12,-1,mid-370,mid+370,iron);
  for(const z of [-323,323])m.box(centerX-16000,centerX+16000,-1,0,mid+z-2,mid+z+2,stone);
  for(let i=0;i<spans.length;i++){
    beam(i,-halfDeck,halfDeck,-12,0,stone);
    for(const sign of [-1,1]){
      const w=sign*halfDeck;
      const crossing=spans[i]===bridge;
      beam(i,w-.25,w+.25,0,1.12,iron);
      beam(i,w-.18,w+.18,1.12,1.22,sign<0?brass:green);
      if(crossing){
        for(const z of [-1350,-470,470,1350]){
          const x=centerX+radius+w;
          const pier=x+sign*8;
          m.box(pier-7,pier+7,0,548,mid+z-10,mid+z+10,iron);
        }
        // Suspension cables clear the train and leave the view from the crossing open.
        for(let k=-47;k<47;k++){
          const z=k*10,next=z+10,x=centerX+radius+w;
          const h=z=>505+43*(z/470)**2;
          m.quad([x,h(z),mid+z],[x,h(next),mid+next],[x,h(next)+2,mid+next],[x,h(z)+2,mid+z],brass);
          if(k%3===0)m.box(x-.32,x+.32,500,h(z),mid+z-.32,mid+z+.32,iron);
        }
      }
    }
    if(i%8===0 && nodes[i].y>20 && spans[i].len<150){
      const p=nodes[i],side=p.z<mid?-1:1,cz=mid+side*centerOffset;
      const px=p.x+22*(p.x-centerX)/radius,pz=p.z+22*(p.z-cz)/radius;
      m.box(px-5,px+5,0,p.y-12,pz-5,pz+5,iron);
      m.box(Math.min(px,p.x)-5,Math.max(px,p.x)+5,p.y-18,p.y-12,Math.min(pz,p.z)-5,Math.max(pz,p.z)+5,iron);
    }
    // A roof over each level landing frames the view out into the open court.
    if((nodes[i].z>mid || nodes[i].y>0) && i>0 && i<spans.length-1 && spans[i].len<150 && Math.abs(spans[i].a.y-spans[i].b.y)<.001){
      beam(i,-16,16,12,13.5,iron);
      for(const edge of [-11.6,11.6]){
        const [x,y,z]=ribbon(i,0,edge);
        m.box(x-.5,x+.5,y,y+12,z-.5,z+.5,stone);
      }
      beam(i,-15,-14,11.7,12,brass);
    }
  }
  for(const side of [-1,1]){
    const col=side<0?brass:green;
    const wall=mid+side*mid,door=centerX+radius;
    for(const [left,right] of [[door-1600,door-13],[door+13,door+1600]])
      m.box(left,right,-12,72,wall-4,wall+4,stone);
    m.box(door-13,door+13,8,72,wall-4,wall+4,stone);
    m.box(door-16,door+16,7.6,8,wall-6,wall+6,col);
    // Repeated portal frames give the long approach a direction and a scale.
    for(let inward=12;inward<mid-centerOffset;inward+=240){
      const frame=wall-side*inward;
      for(const x of [door-13,door+13])m.box(x-.5,x+.5,0,8,frame-.5,frame+.5,iron);
      m.box(door-13.5,door+13.5,8,8.5,frame-.5,frame+.5,col);
    }
  }
  sharedHall=new Float32Array(m.data);
  return sharedHall;
}
export const startTime=(centerX+radius)/station.traffic.speedMps-station.traffic.phaseS;
export {freightAt};
