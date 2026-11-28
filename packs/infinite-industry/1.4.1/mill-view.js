import {Batch,programs} from './field-view.js';
import {materialFragment,viewProjection} from './field-shaders.js';
import {DATUM_M} from './facility.js';
import {axis,origin,materialParts} from './mill-site.js';

const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 point; layout(location=1) in vec3 tint; layout(location=5) in vec3 norm;
uniform vec2 uAxis,uSpin; uniform vec3 uScale,uOffset; uniform float uHeat,uCoil;
${viewProjection}
out vec3 color,normal,local,delta;
vec3 orient(vec3 q){
 vec2 xy=mat2(uSpin.x,uSpin.y,-uSpin.y,uSpin.x)*q.xy;
 return vec3(xy.x*uAxis.x-q.z*uAxis.y,xy.y,xy.x*uAxis.y+q.z*uAxis.x);
}
void main(){
 vec3 q=point*uScale;
 if(uCoil>.5){float r=length(point.xy);q.xy=point.xy*mix(.305,uScale.x,(r-.42)/.58)/r;}
 local=orient(q)+uOffset;normal=normalize(orient(norm/uScale));
 delta=local-uCamera;color=mix(tint,vec3(1.,.24,.032)*(.32+.9*tint.r),uHeat);
 gl_Position=project(delta);
}`;

function mesh(kind) {
  const out=[];
  const add=(a,b,c,col)=>{
    const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
    for(const p of [a,b,c])out.push(...p,...col,n[0]/l,n[1]/l,n[2]/l);
  };
  const quad=(a,b,c,d,col)=>{add(a,b,c,col);add(a,c,d,col);};
  if(kind==='slab'){
    const top=[.57,.32,.19],side=[.33,.19,.13],h=.091,z=.89,x=1.4;
    quad([-x,h,z],[x,h,z],[x,h,-z],[-x,h,-z],top);
    quad([-x,-h,z],[-x,h,z],[-x,h,-z],[-x,-h,-z],side);
    quad([x,-h,-z],[x,h,-z],[x,h,z],[x,-h,z],side);
    quad([-x,-h,z],[x,-h,z],[x,h,z],[-x,h,z],side);
    quad([x,-h,-z],[-x,-h,-z],[-x,h,-z],[x,h,-z],side);
    quad([-x,-h,-z],[x,-h,-z],[x,-h,z],[-x,-h,z],side);
  }else{
    // A hollow wound strip. The open bore, cut edge and layered end faces
    // stay visible from both aisles, even after cooling on the rack.
    const outer=[.42,.32,.245],edge=[.53,.43,.33],inner=[.12,.13,.128],seam=[.16,.115,.085];
    const point=(r,t,z)=>[r*Math.cos(t),r*Math.sin(t),z],n=48,bore=.42,w=.88;
    for(let i=0;i<n;i++){
      const a=2*Math.PI*i/n,b=2*Math.PI*(i+1)/n;
      quad(point(1,a,-w),point(1,b,-w),point(1,b,w),point(1,a,w),i===1?seam:outer);
      quad(point(bore,a,w),point(bore,b,w),point(bore,b,-w),point(bore,a,-w),inner);
      for(const sign of [-1,1]){
        for(let k=0;k<5;k++){
          const r=bore+(1-bore)*k/5,r2=r+(1-bore)/5;
          const face=(lo,hi,col)=>{const q=[point(lo,a,sign*w),point(hi,a,sign*w),point(hi,b,sign*w),point(lo,b,sign*w)];if(sign<0)q.reverse();quad(...q,col);};
          face(r,r+.012,seam);face(r+.012,r2,edge);
        }
      }
    }
  }
  return new Float32Array(out);
}

export class MillView {
  constructor(gl) {
    this.gl=gl;[this.material]=programs(gl,[[vertex,materialFragment]]);
    this.slab=new Batch(gl,mesh('slab'));this.coil=new Batch(gl,mesh('coil'));
  }
  draw(field,view){
    const gl=this.gl,u=field.use(this.material,origin);
    gl.uniform1f(u.uKit,0);gl.uniform1f(u.uLocal,0);gl.uniform1f(u.uFarBase,0);
    gl.uniform2fv(u.uAxis,axis);
    materialParts(view,(kind,d,y,sx,sy,sz,angle,heat)=>{
      gl.uniform1f(u.uCoil,kind==='coil'?1:0);gl.uniform3f(u.uOffset,d*axis[0],DATUM_M+y,d*axis[1]);gl.uniform3f(u.uScale,sx,sy,sz);
      gl.uniform2f(u.uSpin,Math.cos(angle),Math.sin(angle));gl.uniform1f(u.uHeat,heat);
      (kind==='coil'?this.coil:this.slab).draw();
    });
  }
  dispose(){this.slab.dispose();this.coil.dispose();this.gl.deleteProgram(this.material.p);}
}
