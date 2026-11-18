import {valve} from './model.js';

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
  box(0,-.23,-270,1900,.4,550,grass,1);
  for(const s of [-1,1]){
    box(s*505,700,13,998,1400,26,stone,0,true);
    box(s*505,700,58,998,1400,30,stone,0,true);
    box(s*6.02,3.9,17,1.05,7.8,34,iron,2,true);
  }
  box(0,704,19,13,1392,39,stone,0,true);
  box(0,4.2,49,12,8.4,3,iron,2,true);
  box(0,8.35,39,1200,1.1,10,stone,0,true);
  box(0,-.15,30,14,.29,62,[.29,.33,.29],5);
  box(0,-.15,39,1300,.29,10,[.28,.31,.28],5);
  // A sunken channel to the right of the walking grate.
  for(let j=0;j<3;j++){
    const z=6+j*8;box(3.85,.06,z,2.55,.12,7.91,[.055,.17,.17],2);
    box(3.85,.62,z,2.20,.045,7.85,[.12,.42,.40],10+j);
    for(const x of [2.64,5.06])box(x,.33,z,.18,.68,8.04,stone,0,true);
  }
  for(let z=1;z<34;z+=3.8){
    for(const s of [-1,1]){box(s*5.47,3.65,z,.30,7.3,.42,edge,0,true);
      box(s*5.25,4.95,z,.25,.75,.4,iron,2);box(s*5.08,4.99,z,.09,.42,.23,light,3);}
    box(0,7.33,z,11.2,.44,.55,edge,0);
    box(-1.22,.014,z,2.55,.028,.075,iron,2);
  }
  for(const s of [-1,1]){
    box(s*6.35,3.7,-.48,.92,7.4,1.22,edge,0,true);
    box(s*6.0,3.3,-1.14,.11,5.9,.1,light,3);
  }
  box(0,7.9,-.55,13.9,.95,1.7,edge,0,true);
  for(let x=-360;x<=360;x+=18)if(Math.abs(x)>6){
    box(x,53,0,1.45,106,2.1,[.24,.30,.295],0,true);
    box(x,17,-1.15,.45,34,1.35,edge,0,true);
  }
  for(let z=1;z<35;z+=2.5){
    tube([-4.7,2.2,z-.09],[-4.7,2.2,z+.09],.79,brass);
    for(const x of [-4.15,-3.43])tube([x,6.45,z-.10],[x,6.45,z+.1],.38,brass);
  }
  tube([-4.7,2.2,-1.8],[-4.7,2.2,35],.66,iron);
  for(const x of [-4.15,-3.43])tube([x,6.45,-1],[x,6.45,35],.29,[.30,.39,.36]);
  for(let x=-212;x<212;x+=7){
    for(const y of [3.8,5.8])tube([x-.12,y,41.5],[x+.12,y,41.5],1.08,brass);
    box(x,7.45,39,.8,.23,.42,light,3);
  }
  for(const y of [3.8,5.8])tube([-240,y,41.5],[240,y,41.5],.93,[.18,.32,.32]);
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
  let seed=19311;const rand=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
  for(let i=0;i<14500;i++){
    const x=(rand()-.5)*125,z=-rand()*73;
    if(Math.abs(x+1.15+.024*z)<1.35||Math.abs(x)<6&&z>-2)continue;
    const h=.15+rand()*.50,r=.026+rand()*.04,k=.64+rand()*.45;
    const col=grass.map(v=>v*k);tri([x-r,-.025,z],[x+r,-.025,z+.017],[x+.08,h,z+.065],col,7);
  }
  return {vertices:new Float32Array(vertices),colliders};
}
export function solidAt(boxes,x,y,z) {
  return boxes.some(([l,r,b,t,f,g])=>x>l-.22&&x<r+.22&&z>f-.22&&z<g+.22&&y> b+.08&&y-1.48<t);
}
