// Plants: what stands on one hex of a pod, as a list of solids.
//
// plant(hex) returns { solids, palette, blocked(), cover(), vertices(lod, shift) }. The solids are the single
// account of the place: the mesh is drawn from them and walking is stopped by them (rule 8 in
// pod.js). Everything is laid out on a 150 m hex and then scaled by the pod's scale.
//
// A hex has six lanes from its centre to its edges (rule 6) and so six sectors between them.
// Each sector is filled by one unit, chosen by the hex's role and the pod's product. Units are
// written in the sector's own frame: u outward along the sector's middle, v across it.
import {addTransferSolids} from './transfer.js';
import {addMillSolids} from './mill-site.js';
import {hash32} from '../../infinite-meadow/1.0.0/coordinates.js';
import {LANE_HALF_M,LANE_MARGIN_M,CARRY_M,HEX_M,locate} from './pod.js';
export const DATUM_M=48;

import {PALETTES,sectorKeys,cornerKey,placeWorks} from './works.js';
export {PALETTES} from './works.js';
const SIZE={small:.7,medium:1,large:1.35};
// The ground of one hex and nothing else: the cheapest account of a pod, for the far distance. No solids are made.
export function carpet(hex,shift=[0,0]){
 const c=PALETTES[hex.pod.temperature].ground,R=(HEX_M/Math.sqrt(3))*hex.pod.scale,cr=Math.cos(hex.rot??0),sr=Math.sin(hex.rot??0),out=[];
 for(let i=0;i<6;i++)for(const [x,z] of [[0,0],[R*Math.cos((i+1.5)*Math.PI/3),R*Math.sin((i+1.5)*Math.PI/3)],[R*Math.cos((i+.5)*Math.PI/3),R*Math.sin((i+.5)*Math.PI/3)]])out.push(x*cr-z*sr+shift[0],DATUM_M+2.5,x*sr+z*cr+shift[1],c[0],c[1],c[2],0,1,0);
 return out;
}
export function plant(hex){
 const p=hex.pod,s=p.scale,c=PALETTES[p.temperature],f=SIZE[p.size],product=c[p.phase],hot=p.temperature==='hot',cold=p.temperature==='cold',liquid=p.phase==='liquid';
 const pick=(name,n)=>(hash32(`${hex.id}:${name}`)>>>9)%n,solids=[];
 // Solids are kept in hex-local metres, already scaled. y is height above the datum.
 const add=o=>{solids.push(o);return o;};
 const frame=k=>{const a=(k+.5)*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a),at=(u,v)=>[(u*ca-v*sa)*s,(u*sa+v*ca)*s];
  return {a,at,
   box:(u,v,y,hu,hy,hv,col,o={})=>{const [x,z]=at(u,v);return add({k:'box',x,y:y*s,z,hx:hu*s,hy:hy*s,hz:hv*s,rot:a,c:col,...o});},
   cyl:(u,v,y,r,h,col,o={})=>{const [x,z]=at(u,v);return add({k:'cyl',x,y:y*s,z,r:r*s,h:h*s,c:col,...o});},
   sph:(u,v,y,r,col,o={})=>{const [x,z]=at(u,v);return add({k:'sph',x,y:y*s,z,r:r*s,c:col,...o});},
   tor:(u,v,y,R,r,col,o={})=>{const [x,z]=at(u,v);return add({k:'tor',x,y:y*s,z,R:R*s,r:r*s,c:col,...o});},
   pipe:(a0,b0,r,col,o={})=>{const [ax,az]=at(a0[0],a0[1]),[bx,bz]=at(b0[0],b0[1]);return add({k:'pipe',a:[ax,a0[2]*s,az],b:[bx,b0[2]*s,bz],r:r*s,c:col,...o});}};
 };
 const legs=(F,u,v,hu,hv,h)=>{for(const du of [-hu,hu])for(const dv of [-hv,hv])F.cyl(u+du,v+dv,0,.22,h,c.steel);};
 // One piece of product, standing on y0.
 const piece=(F,u,v,y0,g=f)=>{switch(p.shape){
  case 'bar':return F.box(u,v,y0+.45*g,.9*g,.45*g,4.2*g,product);
  case 'slab':return F.box(u,v,y0+.2*g,2.9*g,.2*g,2.9*g,product);
  case 'sphere':return F.sph(u,v,y0+1.5*g,1.5*g,product);
  case 'ring':return F.tor(u,v,y0+.5*g,2.5*g,.5*g,product);
  default:return null;}};
 const rise={bar:.9,slab:.42,sphere:2.6,ring:1}[p.shape]??1;
 const unit={
  yard(F){for(const v of [-12,0,12]){F.cyl(48,v,0,.3,1.1,c.steel);F.tor(48,v,1.1,.34,.07,c.trim,{soft:true});}F.box(50,0,.04,10,.04,16,c.dark,{soft:true});},
  flow(F){ // a rack out along the sector: pipes for liquids, a belt for solids, both carried overhead
   for(let u=22;u<=62;u+=8)for(const v of [-1.6,1.6])F.cyl(u,v,0,.18,CARRY_M,c.steel);
   if(liquid){for(let u=26;u<64;u+=12)F.tor(u,.9,CARRY_M,.62,.1,c.trim,{soft:true,upright:F.a});}
   else{for(let u=24;u<62;u+=9)piece(F,u,0,CARRY_M+.14,.42*f);}
   F.box(42,0,.04,22,.04,2.2,c.dark,{soft:true});},
  store(F){ if(liquid){
    if(p.shape==='column'){const r=Math.min(6,4.4*f),h=(hot?19:13)*f;for(const v of [-13,0,13]){F.cyl(50,v,0,r+.6,.8,c.dark);if(cold)for(const y of [.3,.6,.9])F.tor(50,v,.8+h*y,r+.05,.22,c.trim,{soft:true});}}
    else if(p.shape==='sphere'){const r=Math.min(8.4,6.6*f);for(const v of [-11,11]){legs(F,50,v,r*.55,r*.55,r+1.2);F.tor(50,v,r+2,r+.05,.2,cold?c.trim:c.steel,{soft:true});}}
    else{const r=Math.min(3.6,2.9*f);for(const v of [-12,0,12]){for(const u of [43,57])F.box(u,v,(r+.8)*.5,.5,(r+.8)*.5,r*.9,c.dark);if(cold)for(const u of [44,50,56])F.tor(u,v,r+1.6,r+.05,.2,c.trim,{soft:true,upright:F.a});}}
    F.pipe([38,-13,CARRY_M],[38,13,CARRY_M],.5,c.pipe);for(const v of [-13,13])F.cyl(38,v,0,.18,CARRY_M,c.steel);}
   else{ // stock: the product, stacked the way its shape allows
    for(const u of [45,53,61])for(const v of [-11.5,0,11.5]){const n=p.shape==='sphere'?1:2+pick(`stack:${F.a.toFixed(2)}:${u}:${v}`,p.shape==='slab'?5:3);
     if(p.shape==='sphere'){F.tor(u,v,.35,1.3*f,.35,c.steel);piece(F,u,v,.3,1.7);}   // one sphere to a cradle
     else for(let i=0;i<n;i++)piece(F,u,v,.15+i*rise*f);
     F.box(u,v,.075,3.2*f,.075,p.shape==='bar'?4.4*f:3.2*f,c.dark,{soft:true});}}},
  receive(F){ if(liquid){for(const v of [-10.5,10.5]){F.cyl(50,v,0,9,.9,c.dark);F.cyl(50,v,3.4,8,.06,product,{soft:true});F.tor(50,v,3.5,8.5,.2,c.trim,{soft:true});}F.pipe([40,-10.5,CARRY_M],[40,10.5,CARRY_M],.5,c.pipe);for(const v of [-10.5,10.5])F.cyl(40,v,0,.18,CARRY_M,c.steel);}
   else for(const v of [-13,0,13]){legs(F,50,v,3.2,3.2,6);F.box(50,v,10.2,4.3,.2,4.3,c.trim,{soft:true});piece(F,50,v,.15,.5*f);}},
  hall(F){const h=hot?16:12;for(const [u,w] of [[41,15],[51,19],[62,19]])for(const v of [-w,w])F.cyl(u,v,0,.45,h,c.steel);
   if(liquid)for(const v of [-11,0,11]){F.cyl(51,v,0,2.9,.6,c.dark);F.cyl(51,v,.6,2.4,8,c.body);F.cyl(51,v,8.6,1.4,.8,c.trim);F.pipe([51,v,4],[45,v,4],.35,c.pipe);}
   else for(const v of [-10,10]){
    // Four posts carry a hydraulic press over a visible die and feed table.
    F.box(51,v,.65,3.5,.65,3.45,c.dark);F.box(51,v,1.48,2.9,.19,2.72,c.steel);
    for(const u of [48.3,53.7])for(const side of [-1,1]){
     F.cyl(u,v+side*2.65,1.3,.35,5.75,c.steel);
     F.cyl(u,v+side*2.65,1.3,.52,.35,c.trim);
    }
    F.box(51,v,7.2,3.5,.68,3.4,c.body);F.cyl(51,v,7.85,1.3,1.9,c.pipe);
    F.cyl(51,v,4.2,.78,2.36,c.steel);F.box(51,v,4.12,2.2,.23,2,c.body);
    F.box(51,v,1.82,1.9,.16,1.4,c.trim);
    F.pipe([54.3,v-2,2],[54.3,v-2,7.8],.17,c.pipe);
    F.box(47.35,v+2.6,2.7,.38,.7,.52,c.steel);F.box(46.94,v+2.6,2.9,.06,.15,.32,c.glass,{soft:true,fine:true});
    piece(F,44,v,1.2,.5*f);F.box(44,v,.6,2,.6,2,c.dark);
   }
   if(hot)for(const v of [-9,9]){F.cyl(64,v,0,1.9,2,c.dark);F.tor(64,v,34,1.4,.25,c.trim,{soft:true});}
   if(cold){F.box(64,0,11,2.6,11,2.6,c.body);for(const y of [5,11,17])F.box(64,0,y,2.75,.25,2.75,c.trim,{soft:true});}},
  towers(F){ if(hot)for(const v of [-10.5,10.5]){F.cyl(50,v,0,8.4,1,c.dark);F.tor(50,v,16,6.3,.35,c.trim,{soft:true});}
   else if(cold)for(const u of [43,51,59]){for(const v of [-5,5])F.box(u,v,4.7,2.25,.12,1.4,c.trim,{soft:true});}
   else{for(const v of [-10,0,10])F.box(51,v,1.4,7,1.4,2.2,c.body);}},
  dock(F){for(const v of [-10,10]){F.box(51,v,.3,5,.3,5,c.dark);if(liquid){F.pipe([47,v,2.3],[55,v,2.3],1.7,c.body);}else{piece(F,51,v,.6,.8*f);piece(F,51,v,.6+rise*.8*f,.8*f);}}}
 };
 // Slim tall things for the two outer corners of a sector: the skyline.
 const tall={
  tower(F,u,v){const n=3+pick(`lv:${u}:${v}:${F.a.toFixed(2)}`,3),H=6.5;for(const du of [-2.6,2.6])for(const dv of [-2.6,2.6])F.cyl(u+du,v+dv,0,.28,n*H+1.2,c.steel);
   for(let i=1;i<=n;i++){if(i<n)F.box(u,v,i*H,3.1,.12,3.1,c.steel,{soft:true});for(const [du,dv,hu,hv] of [[0,-3,3,.05],[0,3,3,.05],[-3,0,.05,3],[3,0,.05,3]])F.box(u+du,v+dv,i*H+.6,hu,.05,hv,c.trim,{soft:true,fine:true});
    for(const side of [-1,1]){F.pipe([u-2.6,v+2.6*side,(i-1)*H],[u+2.6,v+2.6*side,i*H],.09,c.steel,{soft:true,fine:true});F.pipe([u+2.6*side,v-2.6,(i-1)*H],[u+2.6*side,v+2.6,i*H],.09,c.steel,{soft:true,fine:true});}}
   for(const side of [-1,1])F.box(u+3.3,v+side*.52,n*H*.5,.065,n*H*.5,.065,c.steel,{soft:true,fine:true});
   for(let y=.8;y<n*H;y+=1.15)F.box(u+3.3,v,y,.08,.055,.53,c.trim,{soft:true,fine:true});},
  silos(F,u,v){const h=20+pick(`sh:${u}:${v}:${F.a.toFixed(2)}`,3)*5;for(const dv of [-2.5,2.5]){F.cyl(u,v+dv,0,.5,3,c.steel);}F.box(u,v,3+h+1.6,.7,.1,3.6,c.trim,{soft:true});},
  flare(F,u,v){F.cyl(u,v,0,1.5,2.5,c.dark);F.tor(u,v,30,1.9,.18,c.steel,{soft:true});F.box(u,v,30,1.9,.08,1.9,c.steel,{soft:true});},
  mast(F,u,v){for(const dv of [-2.6,2.6])F.box(u,v+dv,21.6,.5,.25,.5,c.trim,{soft:true});},
  coldbox(F,u,v){for(const y of [6,13,20])F.box(u,v,y,2.55,.25,2.55,c.trim,{soft:true});}
 };
 // Small plant for the inner end of a sector, by the plaza.
 const inner={
  skid(F){F.box(27,0,.25,3.4,.25,2,c.dark);for(const v of [-.9,.9]){F.cyl(26,v,.5,.55,1.1,c.steel);F.pipe([27,v,1.1],[29.6,v,1.1],.28,c.pipe);}F.pipe([29.6,-.9,1.1],[29.6,.9,1.1],.28,c.pipe,{soft:true});},
  cabin(F){
   F.box(27,0,1.5,2.4,1.5,1.8,c.body);F.box(27,0,3.1,2.8,.1,2.2,c.steel,{soft:true});
   F.cyl(28.6,1.2,3.2,.08,4,c.steel,{soft:true,fine:true});
   F.box(24.55,.75,1.36,.065,1.36,.66,c.steel,{soft:true});
   F.box(24.46,.75,1.81,.04,.45,.47,c.glass,{soft:true});F.box(24.46,-.89,1.9,.04,.48,.61,c.glass,{soft:true});
   F.box(24.40,-.89,2.45,.15,.06,.76,c.trim,{soft:true});
   F.box(24.41,.27,1.15,.065,.045,.14,c.trim,{soft:true,fine:true});
   for(const u of [26,28])for(const side of [-1,1]){
    F.box(u,side*1.82,1.69,.65,.66,.04,c.steel,{soft:true});
    for(let y=1.19;y<2.25;y+=.26)F.box(u,side*1.91,y,.61,.055,.09,c.pipe,{soft:true,fine:true});
   }
  },
  drums(F){for(const [du,dv] of [[-1.6,-1.2],[1.6,-1.2],[0,1.4]]){F.cyl(27+du,dv,0,1.25,3.6,c.body);F.cyl(27+du,dv,3.6,.8,.3,c.steel);}},
  transformers(F){for(const dv of [-2.2,2.2]){F.box(27,dv,1.1,1.5,1.1,1.1,c.steel);for(const du of [-1,0,1])F.box(27+du,dv,2.5,.12,.3,.9,c.trim,{soft:true,fine:true});}}
 };
 const keys=sectorKeys(hex);
 for(let k=0;k<6;k++){const F=frame(k),key=keys[k],form=key.split('/')[1].split('-')[0];
  const kind=['column','sphere','bullet','stock'].includes(form)?'store':form;
  for(const o of placeWorks(key,F.a,s))add(o);
  unit[kind](F);F.cyl(15,0,0,.4,3.2+2.2*(k%2),c.trim);   // a ring of pylons marks the plaza
  if(kind!=='flow'&&kind!=='yard')inner[['skid','cabin','drums','transformers'][pick('inner'+k,4)]](F);
  for(const side of [-1,1]){
   const corner=cornerKey(hex,k,key,side),style=corner.split('-')[1].replace(/[0-9]/g,'');
   for(const o of placeWorks(corner,F.a,s,69,21*side))add(o);
   tall[style](F,69,21*side);
  }
  // A bridge over the lane to the next sector, so the six sectors read as one works around the plaza.
  const p1=F.at(33,11),p2=frame((k+1)%6).at(33,-11),y=8.4*s;for(const q of [p1,p2])add({k:'cyl',x:q[0],y:0,z:q[1],r:.25*s,h:y,c:c.steel});
  if(liquid)add({k:'pipe',a:[p1[0],y,p1[1]],b:[p2[0],y,p2[1]],r:.5*s,c:c.pipe});
  else add({k:'box',x:(p1[0]+p2[0])/2,y,z:(p1[1]+p2[1])/2,hx:Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/2,hy:.7*s,hz:.9*s,rot:Math.atan2(p2[1]-p1[1],p2[0]-p1[0]),c:c.body});}
 // On a core, a tripod over the plaza carries one giant piece of what the pod makes: its sign, seen from the next pod.
 if(hex.index===0){for(const k of [0,2,4]){const F=frame(k),a=F.at(12.5,0),b=F.at(1.6,0);add({k:'pipe',a:[a[0],0,a[1]],b:[b[0],34*s,b[1]],r:.45*s,c:c.steel});}
  const F=frame(0);F.tor(0,0,33.6,2.4,.3,c.trim,{soft:true});if(liquid)F.sph(0,0,38,3.6,product,{soft:true});else{const e=piece(F,0,0,34.4,2.6);if(e)e.soft=true;}}
 // The trunk: product carried overhead beside the lane that leads to the pod's core (all six lanes, on the core).
 const lanes=hex.index===0?[0,1,2,3,4,5]:[(hex.index-1+3)%6],half=HEX_M/2;
 for(const e of lanes){const a=e*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a),at=(d,o,y)=>[(d*ca-o*sa)*s,y*s,(d*sa+o*ca)*s],o=LANE_HALF_M+1.2;
  add(liquid?{k:'pipe',a:at(11,o,CARRY_M),b:at(half,o,CARRY_M),r:.6*s,c:c.pipe}:{k:'box',x:at((11+half)/2,o,0)[0],y:CARRY_M*s,z:at((11+half)/2,o,0)[2],hx:(half-11)/2*s,hy:.14*s,hz:1.0*s,rot:a,c:c.steel});
  for(let d=14;d<half;d+=10){const q=at(d,o,0);add({k:'cyl',x:q[0],y:0,z:q[2],r:.2*s,h:CARRY_M*s,c:c.steel});}}

 addTransferSolids(hex,add,c);
 addMillSolids(hex,add);
 const R=(HEX_M/Math.sqrt(3))*s;
 // Does anything stop a body here? eye is the eye's height above the datum; the body is 1.7 m below it and 30 cm wide.
 function blocked(x,z,eye){const feet=eye-1.7,head=feet+1.65,pad=.3;
  for(const o of solids){if(o.soft)continue;
   if(o.k==='box'){if(head<o.y-o.hy||feet>o.y+o.hy)continue;const dx=x-o.x,dz=z-o.z,cr=Math.cos(o.rot),sr=Math.sin(o.rot),lu=dx*cr+dz*sr,lv=-dx*sr+dz*cr;if(Math.abs(lu)<o.hx+pad&&Math.abs(lv)<o.hz+pad)return true;}
   else if(o.k==='cyl'){if(head<o.y||feet>o.y+o.h)continue;if(Math.hypot(x-o.x,z-o.z)<o.r+pad)return true;}
   else if(o.k==='sph'){if(head<o.y-o.r||feet>o.y+o.r)continue;const mid=Math.max(feet,Math.min(head,o.y)),rr=Math.sqrt(Math.max(0,o.r*o.r-(mid-o.y)**2));if(Math.hypot(x-o.x,z-o.z)<rr+pad)return true;}
   else if(o.k==='tor'){if(head<o.y-o.r||feet>o.y+o.r)continue;if(Math.hypot(x-o.x,z-o.z)<o.R+o.r+pad)return true;}
   else{const dx=o.b[0]-o.a[0],dz=o.b[2]-o.a[2],den=dx*dx+dz*dz,t=den?Math.max(0,Math.min(1,((x-o.a[0])*dx+(z-o.a[2])*dz)/den)):0,yt=o.a[1]+(o.b[1]-o.a[1])*t,lo=(den>1e-6?yt:Math.min(o.a[1],o.b[1]))-o.r,hi=(den>1e-6?yt:Math.max(o.a[1],o.b[1]))+o.r;if(head<lo||feet>hi)continue;if(Math.hypot(x-o.a[0]-dx*t,z-o.a[2]-dz*t)<o.r+pad)return true;}
  }return false;}
 // Height of the highest thing overhead that would stop a climb (a roof), or Infinity under open sky.
 const cover=(x,z)=>{let low=Infinity;for(const o of solids)if(o.roof){const dx=x-o.x,dz=z-o.z,cr=Math.cos(o.rot),sr=Math.sin(o.rot);if(Math.abs(dx*cr+dz*sr)<o.hx&&Math.abs(-dx*sr+dz*cr)<o.hz)low=Math.min(low,o.y-o.hy);}return low;};

 const vertices=(lod='near',shift=[0,0])=>solidVertices(solids,lod,hex.rot,s,c,shift,true);
 return {hex,scale:s,palette:c,solids,blocked,cover,vertices,circumradiusM:R};
}

 // The mesh: nine floats a vertex (place relative to the hex centre with y above the shell datum, colour, normal), as geometry.js.
 // lod: near, middle, far, then skyline and horizon (the ground and the 28 or 8 largest solids as plain boxes, for pods seen from a long way off).
 // The hex's angle is baked in; shift moves the whole plant, so the seven plants of a pod can share one buffer.
export function solidVertices(solids,lod,rotation,s,c,shift=[0,0],ground=false){
  const R=HEX_M/Math.sqrt(3)*s;
  const near=lod==='near',horizon=lod==='horizon'||lod==='skyline',far=lod==='far'||horizon,sides=horizon?4:far?5:near?14:8,least=(horizon?9:far?2.2:near?0:.6)*s,out=[],cr0=Math.cos(rotation),sr0=Math.sin(rotation);
  const V=(q,col,n)=>out.push(q[0]*cr0-q[2]*sr0+shift[0],q[1]+DATUM_M,q[0]*sr0+q[2]*cr0+shift[1],col[0],col[1],col[2],n[0]*cr0-n[2]*sr0,n[1],n[0]*sr0+n[2]*cr0);
  const tri=(a,b,d,col,n)=>{if(!n){const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n)||1;n=n.map(x=>x/l);}V(a,col,n);V(b,col,n);V(d,col,n);};
  const quad=(a,b,d,e,col,n)=>{tri(a,b,d,col,n);tri(a,d,e,col,n);};
  const tube=(a,b,r,col,n)=>{const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);if(l<1e-6)return;const w=d.map(x=>x/l),ax=Math.abs(w[1])>.9?[1,0,0]:[0,1,0],u=[w[1]*ax[2]-w[2]*ax[1],w[2]*ax[0]-w[0]*ax[2],w[0]*ax[1]-w[1]*ax[0]],ul=Math.hypot(...u),v=[w[1]*u[2]-w[2]*u[1],w[2]*u[0]-w[0]*u[2],w[0]*u[1]-w[1]*u[0]];
   const pt=(base,t)=>base.map((x,i)=>x+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t))/ul);
   for(let i=0;i<n;i++){const t=i*2*Math.PI/n,nt=(i+1)*2*Math.PI/n;quad(pt(a,t),pt(a,nt),pt(b,nt),pt(b,t),col);tri(a,pt(a,nt),pt(a,t),col,w.map(x=>-x));tri(b,pt(b,t),pt(b,nt),col,w);}};
  // The ground of the hex, its rim, and the lanes marked on it.
  // The ground of a hex lies just above the open ground beneath it. The further off it is drawn from, the higher it is lifted,
  // so that a depth buffer of any precision keeps it on top.
  const GY=lod==='horizon'?1.2:lod==='skyline'?.6:far?.2:near?.015:.05;
  if(ground)for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/3,b=(i+1.5)*Math.PI/3;tri([0,GY,0],[R*Math.cos(b),GY,R*Math.sin(b)],[R*Math.cos(a),GY,R*Math.sin(a)],c.ground);if(!far)tube([R*Math.cos(a),.12,R*Math.sin(a)],[R*Math.cos(b),.12,R*Math.sin(b)],.16*s,c.trim,4);
   if(near){const e=i*Math.PI/3,ce=Math.cos(e),se=Math.sin(e),L=HEX_M/2*s,w=LANE_HALF_M*s;for(const side of [-1,1]){const o=side*w,t=.12*s;quad([-se*(o-t),.03,ce*(o-t)],[ce*L-se*(o-t),.03,se*L+ce*(o-t)],[ce*L-se*(o+t),.03,se*L+ce*(o+t)],[-se*(o+t),.03,ce*(o+t)],c.dark,[0,1,0]);}}}
  if(horizon){   // the largest solids, as plain boxes
   const big=[];for(const o of solids){if(o.soft&&!o.roof)continue;const q=o.k==='box'?{x:o.x,y:o.y,z:o.z,hx:o.hx,hy:o.hy,hz:o.hz,rot:o.rot,c:o.c}:o.k==='cyl'?{x:o.x,y:o.y+o.h/2,z:o.z,hx:o.r*.85,hy:o.h/2,hz:o.r*.85,rot:0,c:o.c}:o.k==='sph'?{x:o.x,y:o.y,z:o.z,hx:o.r*.8,hy:o.r*.8,hz:o.r*.8,rot:0,c:o.c}:null;if(q){q.size=q.hx*q.hy*q.hz;big.push(q);}}
   big.sort((m,n)=>n.size-m.size);
   for(const o of big.slice(0,lod==='skyline'?28:8)){const cr=Math.cos(o.rot),sr=Math.sin(o.rot),pt=(a,b,d)=>[o.x+a*o.hx*cr-d*o.hz*sr,o.y+b*o.hy,o.z+a*o.hx*sr+d*o.hz*cr];
    for(const F of [[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]])quad(...F.map(v=>pt(...v)),o.c);}
   return new Float32Array(out);}
  for(const o of solids){if(o.fine&&!near)continue;
   if(o.k==='box'){if(Math.max(o.hx,o.hy,o.hz)*2<least)continue;const cr=Math.cos(o.rot),sr=Math.sin(o.rot),pt=(a,b,d)=>[o.x+a*o.hx*cr-d*o.hz*sr,o.y+b*o.hy,o.z+a*o.hx*sr+d*o.hz*cr];
    for(const F of [[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]])quad(...F.map(v=>pt(...v)),o.c);}
   else if(o.k==='cyl'){if(Math.max(o.r*2,o.h)<least)continue;tube([o.x,o.y,o.z],[o.x,o.y+o.h,o.z],o.r,o.c,o.r<.6*s?Math.min(sides,6):sides);}
   else if(o.k==='pipe'){if(horizon||far&&o.r*2<.8*s)continue;tube(o.a,o.b,o.r,o.c,Math.min(sides,10));}
   else if(o.k==='sph'){if(o.r*2<least)continue;const n=horizon?4:far?6:near?12:8,m=n>>1,P=(i,j)=>{const th=i*2*Math.PI/n,ph=j*Math.PI/m,sp=Math.sin(ph);return [[o.x+o.r*sp*Math.cos(th),o.y+o.r*Math.cos(ph),o.z+o.r*sp*Math.sin(th)],[sp*Math.cos(th),Math.cos(ph),sp*Math.sin(th)]];};
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const A=P(i,j),B=P(i+1,j),C=P(i+1,j+1),D=P(i,j+1);for(const [q,w] of [A,C,B])V(q,o.c,w);for(const [q,w] of [A,D,C])V(q,o.c,w);}}
   else{if(horizon||(o.R+o.r)*2<least)continue;const n=far?6:near?12:8,m=far?3:near?6:4,up=o.upright,cu=up===undefined?0:Math.cos(up),su=up===undefined?0:Math.sin(up);   // an upright ring wraps a horizontal pipe that runs along `upright`
    const P=(i,j)=>{const th=i*2*Math.PI/n,ph=j*2*Math.PI/m,rr=o.R+o.r*Math.cos(ph),h=o.r*Math.sin(ph),ex=Math.cos(th),ez=Math.sin(th),nx=Math.cos(ph)*ex,ny=Math.sin(ph),nz=Math.cos(ph)*ez;
     return up===undefined?[[o.x+rr*ex,o.y+h,o.z+rr*ez],[nx,ny,nz]]:[[o.x+h*cu-rr*ex*su,o.y+rr*ez,o.z+h*su+rr*ex*cu],[ny*cu-nx*su,nz,ny*su+nx*cu]];};
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const A=P(i,j),B=P(i+1,j),C=P(i+1,j+1),D=P(i,j+1);for(const [q,w] of [A,C,B])V(q,o.c,w);for(const [q,w] of [A,D,C])V(q,o.c,w);}}
  }
  return new Float32Array(out);
 }

// Shared by the live walker and the survey that locates an unobstructed portal mouth.
export function walkingContent(facility){
  const cache=new Map();
  function plantAt(hex){
    let made=cache.get(hex.id);
    if(!made){if(cache.size>48)cache.clear();made=plant(hex);cache.set(hex.id,made);}
    return made;
  }
  return {plantAt,support:(e,n,foot)=>facility.support(e,n,foot),blocked(e,n,eye,walking){
    if(facility.blocked(e,n,eye,walking))return true;
    const hex=locate(e,n).hex;
    return !!hex && !hex.waterWorks && plantAt(hex).blocked(...hex.toLocal(e,n),eye-DATUM_M);
  }};
}
