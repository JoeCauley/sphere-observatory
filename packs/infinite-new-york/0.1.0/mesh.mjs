import {materials} from './materials.mjs';

const colors = new Map();
function rgb(color) {
  if(!colors.has(color)){const v=parseInt(color.slice(1),16);colors.set(color,[(v>>16)/255,((v>>8)&255)/255,(v&255)/255]);}
  return colors.get(color);
}
export function meshBuilder() {
  const vertices=[], colliders=[], floors=[];
  function quad(a,b,c,d,normal,material='plain',tint='#ffffff',customUV=false) {
    const m=materials[material],color=rgb(tint);
    const du=Math.hypot(...b.map((v,i)=>v-a[i]))/m.metres,dv=Math.hypot(...d.map((v,i)=>v-a[i]))/m.metres;
    const u=m.sign||customUV?1:du,v=m.sign||customUV?1:dv;
    const points=[a,b,c,a,c,d],uvs=[[0,v],[u,v],[u,0],[0,v],[u,0],[0,0]];
    for(let i=0;i<6;i++)vertices.push(...points[i],...normal,...uvs[i],m.index,...color);
  }
  function box(x0,y0,z0,x1,y1,z1,mat='plain',tint='#ffffff',role) {
    if(role==='solid'||role==='floor'){
      const bounds={x0,y0,z0,x1,y1,z1};(role==='solid'?colliders:floors).push(bounds);
    }
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],mat,tint);
    quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],mat,tint);
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],mat,tint);
    quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],mat,tint);
    quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],mat,tint);
    quad([x1,y0,z1],[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[0,-1,0],mat,tint);
  }
  function rod(a,b,r0,r1=r0,mat='iron',tint='#ffffff',sides=10) {
    const v=b.map((val,i)=>val-a[i]),len=Math.hypot(...v),[vx,vy,vz]=v.map(n=>n/len);
    const s=Math.hypot(vx,vz),u=s?[vz/s,0,-vx/s]:[1,0,0],w=[vy*u[2]-vz*u[1],vz*u[0]-vx*u[2],vx*u[1]-vy*u[0]];
    const ring=angle=>u.map((n,i)=>Math.cos(angle)*n+Math.sin(angle)*w[i]);
    const p=(o,n,r)=>o.map((x,i)=>x+n[i]*r);
    for(let i=0;i<sides;i++){
      const n=ring(i*2*Math.PI/sides),m=ring((i+1)*2*Math.PI/sides);
      const a0=p(a,n,r0),a1=p(a,m,r0),b0=p(b,n,r1),b1=p(b,m,r1);
      quad(a0,a1,b1,b0,ring((i+.5)*2*Math.PI/sides),mat,tint);
      quad(b,b0,b1,b,[vx,vy,vz],mat,tint);
    }
  }
  function sign(x,y,z,w,h,mat,dir=1) {
    const l=x-w*.5*dir,r=x+w*.5*dir;
    quad([l,y-h*.5,z],[r,y-h*.5,z],[r,y+h*.5,z],[l,y+h*.5,z],[0,0,dir],mat);
  }
  return {box,quad,rod,sign,colliders,floors,finish:()=>new Float32Array(vertices)};
}
