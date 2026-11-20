import {valve} from './model.js';
import {borderSolids,pipes} from './border.js';

export function makeGallery(){
  const vertices=[],colliders=[];
  const stone=[.32,.37,.35],edge=[.44,.51,.47],iron=[.12,.205,.21],brass=[.57,.35,.17],light=[1,.64,.28],grass=[.16,.25,.18];
  const push=(p,n,c,m)=>vertices.push(...p,...n,...c,m);
  function tri(a,b,c,color,mat){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
    const normal=n.map(x=>x/len);for(const p of [a,b,c])push(p,normal,color,mat);}
  function quad(a,b,c,d,col,m){tri(a,b,c,col,m);tri(a,c,d,col,m);}
  function box(x,y,z,w,h,d,col,mat=0,solid=false){
    const a=x-w/2,b=x+w/2,f=z-d/2,g=z+d/2,l=y-h/2,t=y+h/2;
    quad([a,l,f],[a,t,f],[b,t,f],[b,l,f],col,mat);quad([b,l,g],[b,t,g],[a,t,g],[a,l,g],col,mat);
    quad([a,l,g],[a,t,g],[a,t,f],[a,l,f],col,mat);quad([b,l,f],[b,t,f],[b,t,g],[b,l,g],col,mat);
    quad([a,t,f],[a,t,g],[b,t,g],[b,t,f],col,mat);quad([a,l,g],[a,l,f],[b,l,f],[b,l,g],col,mat);
    if(solid)colliders.push([a,b,l,t,f,g]);
  }
  function tube(a,b,r,col,mat=2,sides=14){
    const ax=b.map((v,i)=>v-a[i]),len=Math.hypot(...ax);if(!len)return;
    const t=ax.map(v=>v/len),ref=Math.abs(t[1])<.92?[0,1,0]:[0,0,1];
    const cross=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
    let u=cross(t,ref);const ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=cross(t,u);
    const point=(p,i)=>p.map((x,k)=>x+r*(u[k]*Math.cos(i*2*Math.PI/sides)+v[k]*Math.sin(i*2*Math.PI/sides)));
    for(let i=0;i<sides;i++){const x=point(a,i),y=point(a,i+1),z=point(b,i+1),w=point(b,i);quad(x,y,z,w,col,mat);tri(a,y,x,col,mat);tri(b,w,z,col,mat);}
  }
  // The two outer wall volumes leave one service aperture. The transverse trunk
  // passes through the gap behind them and continues in both directions.
  for(const side of [-1,1])box(side*6.02,3.9,17,1.05,7.8,34,iron,2,true);
  // The dry centre aisle runs through the back of the gallery into the Border.
  // A sunken channel to the right of the walking grate.
  for(let j=0;j<3;j++){
    const z=6+j*8;box(3.85,.06,z,2.55,.12,7.91,[.055,.17,.17],2);
    box(3.85,.62,z,2.20,.045,7.85,[.12,.42,.40],10+j);
    for(const x of [2.64,5.06])box(x,.33,z,.18,.68,8.04,stone,0,true);
  }
  for(let z=1;z<34;z+=3.8){
    for(const s of [-1,1]){box(s*5.47,3.65,z,.30,7.3,.42,edge,0,true);
      box(s*5.25,4.95,z,.25,.75,.4,iron,2);box(s*5.08,4.99,z,.09,.42,.23,light,3);}
    box(0,7.33,z,11.2,.44,.55,edge,0,true);
    box(-1.22,.014,z,2.55,.028,.075,iron,2);
  }
  for(const s of [-1,1]){
    box(s*6.35,3.7,-.48,.92,7.4,1.22,edge,0,true);
    box(s*6.0,3.3,-1.14,.11,5.9,.1,light,3);
  }
  box(0,7.9,-.55,13.9,.95,1.7,edge,0,true);
  for(let z=1;z<35;z+=2.5){
    tube([-4.7,2.2,z-.09],[-4.7,2.2,z+.09],.79,brass);
    for(const x of [-4.15,-3.43])tube([x,6.45,z-.10],[x,6.45,z+.1],.38,brass);
  }
  tube([-4.7,2.2,-1.8],[-4.7,2.2,35],.66,iron);
  for(const x of [-4.15,-3.43])tube([x,6.45,-1],[x,6.45,35],.29,[.30,.39,.36]);
  for(const y of pipes)colliders.push([-Infinity,Infinity,y-.93,y+.93,40.57,42.43]);
  for(let z=-29;z<.3;z+=1.2){box(-.95,.024,z,1.36,.04,.09,[.31,.34,.25],5);}
  // A capillary sight tube and a handwheel stand beside the bypass.
  box(2.08,.57,12,.62,1.14,.65,iron,2,true);
  tube([1.97,.76,12.7],[1.97,2.50,12.7],.20,[.13,.26,.27]);
  tube([1.97,.86,12.53],[1.97,2.35,12.53],.125,[.30,.80,.71],13);
  for(const y of [.78,2.47])tube([1.97,y-.08,12.7],[1.97,y+.08,12.7],.29,brass);
  const {eastM:vx,northM:vz,heightM:vy}=valve;
  tube([vx,vy,vz],[2.13,vy,vz+.58],.16,brass);
  const pt=a=>[vx+.53*Math.cos(a),vy+.53*Math.sin(a),vz];
  for(let i=0;i<28;i++)tube(pt(i*2*Math.PI/28),pt((i+1)*2*Math.PI/28),.076,[.68,.28,.105],14,8);
  for(let i=0;i<5;i++)tube([vx,vy,vz],pt(i*2*Math.PI/5),.052,[.68,.28,.105],14,7);
  for(let z=4;z<28;z+=2.2){tube([2.5,.40,z],[2.5,1.00,z],.046,brass);}
  tube([2.5,1.0,3],[2.5,1,28],.045,brass);
  colliders.push([-5.43,-3.97,1.47,2.93,-1.8,35],[-4.52,-3.78,6.08,6.82,-1,35],[-3.80,-3.06,6.08,6.82,-1,35]);
  return {vertices:new Float32Array(vertices),colliders:[...borderSolids,...colliders]};
}
