// Addressed factory envelopes. Offsets are metres along and across one sector.
// Both the walker and the skyline consume these solids, including elevated roofs.
import {hash32} from '../../infinite-meadow/1.0.0/coordinates.js';


export const PALETTES={
 ambient:{glass:[.08,.25,.25],ground:[.43,.40,.34],body:[.76,.74,.65],steel:[.055,.11,.12],pipe:[.16,.28,.27],trim:[.43,.28,.105],dark:[.045,.055,.055],liquid:[.045,.30,.32],solid:[.55,.50,.42]},
 hot:{glass:[.34,.13,.045],ground:[.30,.27,.24],body:[.21,.18,.16],steel:[.10,.09,.09],pipe:[.42,.18,.08],trim:[.86,.42,.10],dark:[.05,.04,.04],liquid:[.72,.30,.08],solid:[.78,.36,.12]},
 cold:{glass:[.12,.34,.46],ground:[.50,.54,.57],body:[.86,.90,.93],steel:[.16,.22,.28],pipe:[.30,.48,.62],trim:[.55,.80,.92],dark:[.06,.08,.10],liquid:[.35,.62,.80],solid:[.80,.88,.92]}
};
const SIZE={small:.7,medium:1,large:1.35};
// What fills the six sectors, by role. 'flow' is a pipe rack or a belt, 'store' vessels or stock, by phase.
const SECTORS={
 intake:['receive','flow','store','yard','receive','flow'],
 process:['hall','flow','hall','towers','store','flow'],
 forming:['hall','store','flow','store','hall','flow'],
 conditioning:['towers','flow','towers','store','towers','yard'],
 storage:['store','store','flow','store','store','yard'],
 dispatch:['dock','store','flow','dock','yard','flow'],
 core:['hall','store','hall','store','hall','store']
};

export function sectorKeys(hex){
 const p=hex.pod, kinds=SECTORS[hex.role];
 const turn=hex.role==='core'?0:(hash32(hex.id+':turn')>>>9)%6;
 return Array.from({length:6},(_,k)=>{
  const kind=kinds[(k+turn)%6];
  let form=kind;
  if(kind==='store')form=p.phase==='solid'?'stock':p.shape+'-'+p.size;
  if(['receive','flow'].includes(kind))form+='-'+p.phase;
  return p.temperature+'/'+form;
 });
}

// Each sector has two utility corners. The main shaft is shared at every
// distance. The same address chooses the height of the access tower or silos.
const cornerStyles={
 yard:['mast'],hot:['flare','tower','silos','mast'],cold:['coldbox','tower','silos','mast'],ambient:['tower','silos','mast','silos']
};
// FNV-1a can continue from the hex prefix. Reuse it for the twelve corners.
function cornerPick(h,suffix,n){
 let v=h.cornerHash??=hash32(h.id+':');
 for(let i=0;i<suffix.length;i++)v=Math.imul(v^suffix.charCodeAt(i),16777619);
 return (v>>>9)%n;
}
const cornerTags=Array.from({length:12},(_,i)=>{
 const k=i>>1,side=(i%2)*2-1,where='69:'+21*side+':'+((k+.5)*Math.PI/3).toFixed(2);
 return ['tall'+k+':'+side,'lv:'+where,'sh:'+where];
});
export function cornerKey(hex,sector,key,side){
 const heat=hex.pod.temperature,styles=cornerStyles[key.endsWith('/yard')?'yard':heat];
 const tags=cornerTags[2*sector+(side+1)/2],name=styles[cornerPick(hex,tags[0],styles.length)];
 const height=name==='tower'?3+cornerPick(hex,tags[1],3):name==='silos'?20+5*cornerPick(hex,tags[2],3):'';
 return heat+'/corner-'+name+height;
}

const models=new Map();
export function worksModel(key){
 if(models.has(key))return models.get(key);
 const [heat,form]=key.split('/'),[kind,variant]=form.split('-');
 const c=PALETTES[heat],hot=heat==='hot',cold=heat==='cold',f=SIZE[variant],solids=[];
 const box=(x,z,y,hx,hy,hz,color,flags={})=>solids.push({k:'box',x,y,z,hx,hy,hz,rot:0,c:color,...flags});
 const cyl=(x,z,y,r,h,color,flags={})=>solids.push({k:'cyl',x,y,z,r,h,c:color,...flags});
 const pipe=(a,b,r,color,flags={})=>solids.push({k:'pipe',a,b,r,c:color,...flags});
 const panel={soft:true,trim:true};
 if(kind==='corner'){
  if(variant.startsWith('tower')){
   const h=6.5*Number(variant.slice(5));
   cyl(0,0,.5,1.7,h-2,c.body);cyl(0,0,h-1.5,1.1,2.4,c.trim);
   box(0,0,h,3.1,.13,3.1,c.steel);
  }else if(variant.startsWith('silos')){
   const h=Number(variant.slice(5));
   for(const z of [-2.5,2.5]){cyl(0,z,3,2.2,h,c.body);cyl(0,z,3+h,1.2,1.4,c.steel);}
  }else if(variant==='flare'){cyl(0,0,2.5,.75,44,c.body);cyl(0,0,46.5,1.05,1.6,c.trim);}
  else if(variant==='coldbox'){box(0,0,13,2.4,13,2.4,c.body);cyl(0,0,26,.5,4,c.steel);}
  else{cyl(0,0,0,.30,22,c.steel);box(0,0,22,.2,.2,3,c.steel);}
 }else if(kind==='hall'){
  const h=hot?16:12;
  box(51,0,h+.5,12,.5,20,c.body,{roof:true});
  for(const x of [41,61])for(const z of [-16,16])box(x,z,h/2,.55,h/2,.62,c.steel);
  // Raised longitudinal monitor, with a recessed glazed strip and a folded cap.
  box(51,0,h+2.25,3.6,1.25,17,c.steel);
  box(51,0,h+3.65,4,.16,17.5,c.body);
  for(const side of [-1,1]){
   box(51+side*3.61,0,h+2.35,.04,.68,16.8,c.glass,panel);
   for(let z=-15;z<=15;z+=3)box(51+side*3.69,z,h+2.35,.09,.8,.085,c.trim,panel);
   if(hot)cyl(64,side*9,2,1.3,32,c.body);
  }
 }else if(kind==='towers'){
  if(hot)for(const z of [-10.5,10.5]){cyl(50,z,1,7.6,6,c.body);cyl(50,z,7,6.2,9,c.body);}
  else if(cold)for(const x of [43,51,59]){
   box(x,0,2.3,2.2,2.3,14.5,c.body);
   for(const z of [-10,0,10]){cyl(x,z,4.6,1.7,.95,c.steel);cyl(x,z,5.52,.6,.27,c.trim,panel);}
  }else{box(51,0,7.3,11,.3,19,c.body,{roof:true});for(const x of [42,61])for(const z of [-15,15])box(x,z,3.5,.42,3.5,.42,c.steel);}
 }else if(kind==='column'){
  const r=Math.min(6,4.4*f),h=(hot?19:13)*f;
  for(const z of [-13,0,13]){
   cyl(50,z,.8,r,h,c.body);cyl(50,z,.8+h,r*.8,.9,c.steel);
   for(const t of [.25,.65])cyl(50,z,.8+h*t,r+.09,.23,c.trim,panel);
  }
 }else if(kind==='sphere'){
  const r=Math.min(8.4,6.6*f);
  for(const z of [-11,11])solids.push({k:'sph',x:50,y:r+2,z,r,c:c.body});
 }else if(kind==='bullet'){
  const r=Math.min(3.6,2.9*f);
  for(const z of [-12,0,12])pipe([39,r+1.6,z],[61,r+1.6,z],r,c.body);
 }else if(kind==='receive'){
  if(variant==='liquid')for(const z of [-10.5,10.5])cyl(50,z,.9,8.5,2.6,c.body);
  else for(const z of [-13,0,13]){box(50,z,8,4,2,4,c.body);box(50,z,5.2,1.6,.9,1.6,c.steel);}
 }else if(kind==='stock'||kind==='dock'){
  // Overhead travelling crane. The hoist clears the pedestrian and material routes.
  const h=kind==='dock'?13:15;
  for(const x of [43,60]){
   for(const z of [-16,16])box(x,z,h/2,.52,h/2,.66,c.steel);
   box(x,0,h+.4,.7,.6,17,c.steel);
  }
  box(51.5,0,h-.5,9.2,.65,1.3,c.trim);
  box(51.5,0,h-2,1.45,1.0,1.15,c.dark,panel);
  for(const z of [-1.1,1.1])for(let x=44;x<59;x+=3)
   pipe([x,h-.94,z],[x+2.8,h-.08,z],.10,c.body,panel);
 }else if(kind==='flow'){
  if(variant==='liquid')for(const z of [-.9,.9])pipe([20,5.6,z],[64,5.6,z],.55,c.pipe);
  else box(42,0,5.6,22,.14,1.1,c.steel);
 }else if(kind==='yard'){
  // A louvred switch house with two extraction cowls and a recessed service door.
  box(53,7,2.85,6.6,2.85,4.8,c.body,{roof:true});
  box(53,7,5.82,7.05,.13,5.15,c.steel);
  for(const x of [50,56]){cyl(x,7,5.95,1.45,1.05,c.pipe);cyl(x,7,7,1.57,.22,c.steel,panel);}
  box(46.35,7,1.8,.07,1.8,1.3,c.steel,panel);
  for(const x of [51,55,59])for(let y=1.6;y<4.9;y+=.46)box(x,2.13,y,1.2,.09,.12,c.pipe,panel);
 }
 models.set(key,solids);return solids;
}

// Convert a module to the same hex-local metres as the walking and roof solver.
export function placeWorks(key,angle,scale,u=0,v=0){
 const cos=Math.cos(angle),sin=Math.sin(angle);
 const at=([x,y,z])=>[((x+u)*cos-(z+v)*sin)*scale,y*scale,((x+u)*sin+(z+v)*cos)*scale];
 return worksModel(key).map(o=>{
  const q={...o,works:true};
  if(o.k==='pipe'){q.a=at(o.a);q.b=at(o.b);}
  else{[q.x,q.y,q.z]=at([o.x,o.y,o.z]);if(o.k==='box')q.rot=angle;}
  for(const k of ['hx','hy','hz','h','r'])if(k in o)q[k]=o[k]*scale;
  return q;
 });
}
