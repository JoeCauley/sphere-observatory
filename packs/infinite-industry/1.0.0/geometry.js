import {DATUM_M,createFacility} from './facility.js';
export function palette(config){return config.treatment===0?{stone:[.43,.40,.34],light:[.76,.74,.65],steel:[.055,.11,.12],pipe:[.16,.28,.27],trim:[.43,.28,.105],water:[.045,.30,.32],dark:[.045,.055,.055]}:{stone:[.36,.39,.40],light:[.64,.70,.70],steel:[.095,.12,.16],pipe:[.38,.16,.09],trim:[.55,.40,.19],water:[.035,.28,.32],dark:[.04,.05,.065]};}
export function geometry(config){
 const facility=createFacility(config),p=palette(config),out=[];
 const vertex=(v,c,n)=>{const at=facility.toWorld(v[0],v[2]),rn=facility.toWorld(n[0],n[2]),s=config.acrossFlatsM/150;out.push(at[0]-facility.center[0],v[1]+DATUM_M,at[1]-facility.center[1],...c,(rn[0]-facility.center[0])/s,n[1],(rn[1]-facility.center[1])/s);};
 const tri=(a,b,c,color,normal)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=normal??[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;for(const q of [a,b,c])vertex(q,color,n.map(x=>x/l));};
 const quad=(a,b,c,d,color,n)=>{tri(a,b,c,color,n);tri(a,c,d,color,n);};
 const box=(x,y,z,hx,hy,hz,c)=>{const pt=(a,b,d)=>[x+a*hx,y+b*hy,z+d*hz];for(const f of [[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]])quad(...f.map(v=>pt(...v)),c);};
 const pipe=(a,b,r,c,sides=12)=>{const d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d);if(l<1e-6)return;const n=d.map(v=>v/l),axis=Math.abs(n[1])>.9?[1,0,0]:[0,1,0],u=[n[1]*axis[2]-n[2]*axis[1],n[2]*axis[0]-n[0]*axis[2],n[0]*axis[1]-n[1]*axis[0]],ul=Math.hypot(...u),v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
  const point=(base,t)=>base.map((x,i)=>x+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t))/ul);
  for(let i=0;i<sides;i++){const t=i*Math.PI*2/sides,nt=(i+1)*Math.PI*2/sides;quad(point(a,t),point(a,nt),point(b,nt),point(b,t),c);tri(a,point(a,nt),point(a,t),c,n.map(x=>-x));tri(b,point(b,t),point(b,nt),c,n);}
 };
 const cylinder=(x,y,z,r,h,c,sides=20)=>pipe([x,y,z],[x,y+h,z],r,c,sides);
 const rail=(a,b)=>{pipe(a,b,.075,p.trim,6);pipe(a.map((v,i)=>i===1?v-.55:v),b.map((v,i)=>i===1?v-.55:v),.05,p.steel,6);const d=Math.hypot(b[0]-a[0],b[2]-a[2]);for(let i=0;i<=d;i+=2.2){const t=i/d;pipe([a[0]+(b[0]-a[0])*t,a[1]-1.1,a[2]+(b[2]-a[2])*t],[a[0]+(b[0]-a[0])*t,a[1],a[2]+(b[2]-a[2])*t],.06,p.steel,6);}};
 const ring=(x,y,z,r,c,th=.1,sides=28)=>{for(let i=0;i<sides;i++){const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;pipe([x+r*Math.cos(a),y,z+r*Math.sin(a)],[x+r*Math.cos(b),y,z+r*Math.sin(b)],th,c,6);}};
 return {p,tri,quad,box,pipe,cylinder,rail,ring,data:()=>new Float32Array(out)};
}
export function buildZone(config,key,lod='near'){
 const g=geometry(config),{p,box,pipe,cylinder,quad,tri,rail,ring}=g,near=lod==='near',far=lod==='far',sides=far?8:near?24:14;
 const floor=(x,z,hx,hz)=>{box(x,.05,z,hx,.05,hz,p.stone);if(near)for(let n=-hx;n<hx;n+=5)box(x+n,.11,z,.018,.004,hz,p.dark);};
 switch(key){
 case 'yard':{
  const radius=150/Math.sqrt(3);for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/3,b=(i+1.5)*Math.PI/3;tri([0,.015,0],[radius*Math.cos(b),.015,radius*Math.sin(b)],[radius*Math.cos(a),.015,radius*Math.sin(a)],p.stone);pipe([radius*Math.cos(a),.12,radius*Math.sin(a)],[radius*Math.cos(b),.12,radius*Math.sin(b)],.16,p.trim,6);}
  floor(0,43,11,20);floor(0,0,74,2);floor(26,14,5,19);
  if(near){for(let x=-65;x<70;x+=5)for(let z=-58;z<60;z+=5){if(Math.abs(z)<3||Math.abs(x)<11&&z>23)continue;box(x,.035,z,.012,.01,2.48,p.dark);}
   for(const x of [-13,13])for(const z of [35,54]){cylinder(x,0,z,.32,1.2,p.steel,8);ring(x,1.1,z,.36,p.trim,.07,10);}}
  // An open recovery raceway, reached by the return branch.
  box(42,.3,42,10,.3,7,p.dark);box(42,1.05,35.5,10,.65,.45,p.light);box(42,1.05,48.5,10,.65,.45,p.light);for(const x of [32.5,51.5])box(x,1.05,42,.45,.65,6.5,p.light);box(42,.72,42,9,.06,6,p.water);
  for(let x=35;x<50;x+=4)box(x,1.65,42,.12,.07,6,p.steel);
  break;}
 case 'hall':{
  floor(0,-6,20,29);box(0,.35,-35,20,.35,1.1,p.dark);box(0,10,-35,19,.3,.38,p.light);box(0,5.6,-35,19,5.6,.32,p.light);
  for(const z of [-29,-17,-5,7,19]){
   for(const x of [-19,19]){box(x,.3,z,1,.3,1,p.dark);box(x,11,z,.28,11,.45,p.steel);box(x,8,z,.45,.15,.52,p.trim);pipe([x,16,z],[0,26,z],.22,p.steel,4);pipe([x,12,z],[x-Math.sign(x)*4,18,z],.14,p.steel,4);}
   pipe([-19,22,z],[0,27,z],.3,p.steel,4);pipe([0,27,z],[19,22,z],.3,p.steel,4);pipe([-19,22,z],[19,22,z],.14,p.steel,4);
  }
  for(const side of [-1,1])quad([side*20,22,-35],[side*2,26.6,-35],[side*2,26.6,22],[side*20,22,22],p.light);
  for(const x of [-15,-9,9,15])pipe([x,27-Math.abs(x)*.25,-35],[x,27-Math.abs(x)*.25,22],.12,p.steel,6);
  // Skylight slot and stepped roof monitors keep the industrial silhouette.
  for(let z=-30;z<22;z+=8){box(0,27,z,2.1,.12,2.9,p.steel);if(near)for(const x of [-1,1])pipe([x,24.5,z-3],[x,27,z+3],.08,p.trim,6);}
  for(const z of [-21,-3,15])for(const x of [-10,10]){
   box(x,.4,z,4,.4,4,p.dark);cylinder(x,.8,z,3,9.5,p.light,sides);cylinder(x,10.3,z,2.3,.8,p.steel,sides);cylinder(x,11.1,z,.8,.8,p.trim,sides);
   pipe([x,3,z],[x,3,z+4.1],.44,p.pipe,sides);pipe([x,7,z],[x-Math.sign(x)*3.6,7,z],.4,p.pipe,sides);
   if(near){for(const y of [1.2,4.2,8.6])ring(x,y,z,3.05,p.steel,.08);for(let a=0;a<6;a++){const t=a*Math.PI/3;box(x+3.2*Math.cos(t),1.6,z+3.2*Math.sin(t),.15,.9,.15,p.steel);}cylinder(x,4.5,z+3.15,.3,.15,p.trim,12);}
  }
  for(const x of [-10,10]){pipe([x,5.6,-27],[x,5.6,19],.52,p.pipe,sides);for(const z of [-21,-3,15])pipe([x,3,z+4],[x,5.6,z+4],.4,p.pipe,sides);}
  floor(0,-6,2.4,28);
  // Ground-level routing control on the same treatment output manifold.
  box(4,.55,14,.7,.55,.55,p.light);box(4,1.18,14,.65,.08,.5,p.steel);pipe([4,1.4,14],[4,2,14],.12,p.trim,8);ring(4,2,14,.62,p.trim,.08,18);pipe([4,2,14],[4,2,14.6],.07,p.steel,6);
  if(config.model===1){for(const z of [-25,-7,11])pipe([-18,17,z],[18,17,z+6],.13,p.trim,4);} // Alternative bracing; support and process stay compatible.
  break;}
 case 'intake':{
  for(const z of [-15,13]){cylinder(-43,0,z,11,1,p.dark,sides);cylinder(-43,1,z,10.5,2.9,p.light,sides);cylinder(-43,3.94,z,9.85,.035,p.water,sides);ring(-43,4,z,10.5,p.trim,.20,sides);
   pipe([-54,5.3,z],[-32,5.3,z],.22,p.steel,4);cylinder(-43,4,z,.8,3,p.steel,sides);cylinder(-43,7,z,1.7,.7,p.light,sides);if(near){rail([-53.5,6.6,z-.9],[-32.5,6.6,z-.9]);rail([-53.5,6.6,z+.9],[-32.5,6.6,z+.9]);for(let a=0;a<12;a++){const t=a*Math.PI/6;cylinder(-43+10.8*Math.cos(t),1,z+10.8*Math.sin(t),.13,3,p.steel,6);}}}
  pipe([-43,5.6,-15],[-43,5.6,13],.6,p.pipe,sides);pipe([-60,5.6,13],[-43,5.6,13],.6,p.pipe,sides);floor(-60,0,3,30);
  break;}
 case 'gallery':{
  quad([23,0,32],[29,0,32],[29,9,-4],[23,9,-4],p.steel);quad([23,-.18,32],[23,0,32],[23,9,-4],[23,8.82,-4],p.light);quad([29,-.18,32],[29,8.82,-4],[29,9,-4],[29,0,32],p.light);
  if(!far){rail([22.8,1.1,32],[22.8,10.1,-4]);rail([29.2,1.1,32],[29.2,10.1,-4]);}
  box(20,8.85,-6,9,.15,2,p.steel);box(15,8.85,-4.5,4,.15,24.5,p.steel);
  for(const z of [-26,-14,-2,10,20])for(const x of [11,19]){box(x,4.4,z,.16,4.4,.16,p.steel);box(x,.15,z,.6,.15,.6,p.dark);}
  for(const z of [-4,8,20,30])box(26,Math.max(0,9*(32-z)/36)*.5,z,.16,Math.max(.08,9*(32-z)/36)*.5,.16,p.steel);
  if(near){for(const x of [11,18.7])for(const [a,b] of [[-29,-8],[-4,20]])rail([x,10.1,a],[x,10.1,b]);rail([11,10.1,-29],[19,10.1,-29]);rail([11,10.1,20],[19,10.1,20]);for(let z=-28;z<20;z+=.65)box(15,9.012,z,3.7,.01,.015,p.trim);for(let z=-3;z<32;z+=1.4)box(26,9*(32-z)/36+.01,z,2.8,.014,.018,p.trim);}
  break;}
 case 'storage':{
  for(const z of [-22,6]){cylinder(42,0,z,9,1,p.dark,sides);cylinder(42,1,z,8,18,p.light,sides);cylinder(42,19,z,8.05,1,p.steel,sides);cylinder(42,20,z,6.8,1,p.light,sides);cylinder(42,21,z,1.3,.8,p.trim,sides);
   if(near){for(const y of [3,8,13,18])ring(42,y,z,8.06,p.steel,.06);for(let y=1;y<20;y+=.42)pipe([49.7,y,z-.55],[49.7,y,z+.55],.04,p.trim,6);pipe([49.7,0,z-.6],[49.7,21,z-.6],.08,p.steel,6);pipe([49.7,0,z+.6],[49.7,21,z+.6],.08,p.steel,6);ring(42,20.9,z,7.5,p.trim,.09);}
  }
  pipe([42,5.6,-22],[42,5.6,6],.65,p.pipe,sides);floor(56,-10,4,27);break;}
 case 'connections':{
  const spec=createFacility(config);for(const link of spec.process.links)for(let i=1;i<link.route.length;i++){const a=link.route[i-1],b=link.route[i];pipe(a,b,link.activeWhen ? .35:.6,p.pipe,sides);if(near){const d=b.map((v,k)=>v-a[k]),l=Math.hypot(...d);for(let t=2;t<l;t+=6){const pt=a.map((v,k)=>v+d[k]*t/l),en=pt.map((v,k)=>v+d[k]*.16/l);pipe(pt,en,link.activeWhen ? .45:.73,p.steel,12);}}}for(const pt of spec.rackSupports)pipe([pt[0],0,pt[2]],[pt[0],pt[1]-.6,pt[2]],.16,p.steel,4);
  for(const x of [-75,75]){
   // Two sides and the short continuation are derived from the same boundary.
   const f=createFacility(config),port=f.interfaces[x<0?3:0].boundary.pipe.position,[px,pz]=f.toLocal(port[0],port[2]);
   floor(x,0,20,2);pipe([px-20,5.6,pz],[px+20,5.6,pz],.6,p.pipe,sides);
   for(const xx of [x-12,x,x+12]){box(xx,3,pz,.20,3,.22,p.steel);pipe([xx-2,6.4,pz],[xx+2,6.4,pz],.20,p.steel,4);if(near){cylinder(xx,0,-3,.24,1.1,p.steel,8);ring(xx,1.15,-3,.3,p.trim,.05,10);}}
   box(x+Math.sign(x)*19,1.2,pz,1.6,1.2,1.4,p.light);pipe([x+Math.sign(x)*19,1.2,pz],[x+Math.sign(x)*19,5.6,pz],.6,p.pipe,sides);
  }
  break;}
 default:throw Error('Unknown preparation zone '+key);
 }
 return g.data();
}
export function movingGeometry(config,time,routing,transition=1){
 const g=geometry(config),{p,pipe,cylinder,box}=g;
 for(const z of [-15,13]){const angle=time*.15;for(let a=0;a<3;a++){const t=angle+a*Math.PI*2/3;pipe([-43,4.2,z],[-43+9.2*Math.cos(t),4.2,z+9.2*Math.sin(t)],.18,p.steel,6);}}
 const links=createFacility(config).process.links;for(const link of links){const active=link.activeWhen?routing==='recovery':!(routing==='recovery'&&link.to==='distribution');if(!active)continue;
  const route=link.route;let total=0;const lengths=[];for(let i=1;i<route.length;i++){const l=Math.hypot(...route[i].map((v,k)=>v-route[i-1][k]));lengths.push(l);total+=l;}
  for(let offset=0;offset<total;offset+=7){let at=(offset+time*3.8)%total;let i=0;while(i<lengths.length-1&&at>lengths[i])at-=lengths[i++];const a=route[i],b=route[i+1],t=at/lengths[i],pt=a.map((v,k)=>v+(b[k]-v)*t);cylinder(pt[0],pt[1]+.62,pt[2],.16,.1,p.trim,6);}
 }
 // Recovery diversion changes both the visible flowing return and basin depth.
 box(42,.73+(routing==='recovery'?.55*transition:0),42,8.95,.045,5.9,routing==='recovery'?p.water:p.dark);
 const angle=routing==='recovery'?Math.PI/2:0;pipe([4,2.12,14],[4+Math.cos(angle)*.6,2.12,14+Math.sin(angle)*.6],.095,p.trim,8);
 return g.data();
}
