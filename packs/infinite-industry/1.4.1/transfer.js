// One operating cross-hex link in the hot bar pod. Its two hoods meet the
// existing 64 m ends of the process and forming belts in their own sectors.
import {pod,district,hexes,CARRY_M} from './pod.js';
import {geometry} from './geometry.js';
const works=pod(district(0,0),-1,1);
const [,source,destination]=hexes(works);
function end(hex,sector){
  const a=hex.rot+(sector+.5)*Math.PI/3;
  return [hex.center[0]+64*Math.cos(a),hex.center[1]+64*Math.sin(a)];
}
const outlet=end(source,1),intake=end(destination,5);
const dx=intake[0]-outlet[0],dz=intake[1]-outlet[1],length=Math.hypot(dx,dz);
const ex=dx/length,ez=dz/length,angle=Math.atan2(ez,ex);
const point=(d,side=0)=>[outlet[0]+ex*d-ez*side,outlet[1]+ez*d+ex*side];
export const transfer=Object.freeze({source:source.id,destination:destination.id,outlet,intake,length,center:point(length/2),height:CARRY_M});
export function transferPlace(){
  const [eastM,northM]=point(1,-6.5),[e,n]=point(14);
  return {eastM,northM,yaw:Math.atan2(e-eastM,-(n-northM)),pitch:.19,mode:'walk'};
}
export function barAt(time,index=0){
  const d=((time*1.65+index*length/3)%length+length)%length;
  return {along:d,position:point(d)};
}
export function addTransferSolids(hex,add,palette){
  const first=hex.id===source.id;
  if(!first&&hex.id!==destination.id)return;
  const middle=length/2;
  function box(d,side,y,hx,hy,hz,c,detail={}){
    const [x,z]=hex.toLocal(...point(d,side));
    add({k:'box',x,y,z,hx,hy,hz,rot:angle-hex.rot,c,...detail});
  }
  const d=first?middle/2:middle*1.5,half=length/4;
  box(d,0,CARRY_M,half,.15,1.2,palette.steel);
  for(const side of [-1,1]){
    box(d,side*1.22,CARRY_M-.38,half,.27,.14,palette.trim);
    box(d,side*1.18,CARRY_M+.17,half,.14,.12,palette.dark);
  }
  // The hoods conceal a bar as it leaves the process line and enters forming.
  const hood=first?0:length;
  for(const side of [-1,1])box(hood,side*2.65,CARRY_M+1.05,2.85,1.13,.14,palette.body);
  box(hood,0,CARRY_M+2.24,2.85,.15,2.8,palette.steel,{roof:true});
  for(const side of [-1,1]){
    box(hood,side*2.65,CARRY_M/2,.18,CARRY_M/2,.18,palette.steel);
    box(hood,side*2.83,CARRY_M+1.45,.92,.14,.06,palette.trim);
  }
}
export function barVertices(config,palette){
  const g=geometry(config),scale=.42*1.35; // the large bar used by this pod's stock and belts
  g.box(0,CARRY_M+.15+.45*scale,0,.9*scale,.45*scale,4.2*scale,palette.solid);
  const vertices=g.data();
  for(let i=0;i<vertices.length;i+=9){
    for(const j of [i,i+6]){
      const x=vertices[j],z=vertices[j+2];vertices[j]=x*ex-z*ez;vertices[j+2]=x*ez+z*ex;
    }
  }
  return vertices;
}
