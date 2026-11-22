// The WebGL 2 consumer of the industrial solids. All instance translations are
// relative to an addressed anchor. CPU double precision is retained up to upload.
import {cameraBasis} from '../../infinite-meadow/1.0.0/coordinates.js';
import {DATUM_M} from './facility.js';
import {district,hexAt,hexes,podsWithin,DISTRICT_M} from './pod.js';
import {plant,solidVertices} from './plant.js';
import {sectorKeys,cornerKey,worksModel} from './works.js';
import {meshVertex,detailVertex,materialFragment,floorVertex,floorFragment,shadowVertex,shadowFragment,FIELD_OUT,DETAIL_OUT} from './field-shaders.js';

// Link the field programs together. Chrome can compile the independent shaders
// concurrently, and the ordinary and instanced fittings share one fragment shader.
function programs(gl,recipes){
 const compiled=new Map(),pending=[];
 function shader(type,source){
  if(compiled.has(source))return compiled.get(source);
  const sh=gl.createShader(type);compiled.set(source,sh);gl.shaderSource(sh,source);gl.compileShader(sh);return sh;
 }
 try{
  for(const [vertex,fragment] of recipes){
   const p=gl.createProgram();pending.push(p);
   gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);
  }
  return pending.map(p=>{
   if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
    const log=gl.getAttachedShaders(p).map(s=>gl.getShaderInfoLog(s)).filter(Boolean).join('\n');
    throw Error(log||gl.getProgramInfoLog(p));
   }
   const u={},count=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
   for(let i=0;i<count;i++){const name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name);}
   return {p,u};
  });
 }catch(error){for(const p of pending)gl.deleteProgram(p);throw error;}
 finally{for(const s of compiled.values())gl.deleteShader(s);}
}
function buffer(gl,data,usage=gl.STATIC_DRAW){
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);return b;
}
function attribute(gl,loc,n,stride,offset,divisor=0){
 gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(loc,divisor);
}
function baseMesh(gl,data){
 const vertex=buffer(gl,data);return {vertex,count:data.length/9,bytes:data.byteLength};
}
// Share coincident corners within each reusable prototype, including cap
// normals and tint. One indexed draw then serves every placed copy.
function indexed(gl,data,stride){
 const seen=new Map(),points=[],indices=new Uint16Array(data.length/stride);
 for(let i=0;i<indices.length;i++){
  const v=data.subarray(i*stride,(i+1)*stride);
  const key=Array.from(v,x=>Math.round(x*100000)).join(',');
  let index=seen.get(key);
  if(index===undefined){index=seen.size;if(index>65535)throw Error('Industrial prototype exceeds 16-bit indices');seen.set(key,index);points.push(...v);}
  indices[i]=index;
 }
 const vertices=new Float32Array(points),vertex=buffer(gl,vertices),elements=gl.createBuffer();
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 return {vertex,elements,count:indices.length,bytes:vertices.byteLength+indices.byteLength};
}
function bindMesh(gl,mesh){
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertex);attribute(gl,0,3,36,0);attribute(gl,1,3,36,12);attribute(gl,5,3,36,24);
}
export class Batch{
 constructor(gl,data){this.gl=gl;this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.mesh=baseMesh(gl,data);bindMesh(gl,this.mesh);gl.bindVertexArray(null);}
 get bytes(){return this.mesh.bytes;}
 replace(data){
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh.vertex);
  if(this.bytes===data.byteLength)gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
  else gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
  this.mesh.count=data.length/9;this.mesh.bytes=data.byteLength;return this.bytes;
 }
 draw(){this.gl.bindVertexArray(this.vao);this.gl.drawArrays(this.gl.TRIANGLES,0,this.mesh.count);}
 dispose(){this.gl.deleteBuffer(this.mesh.vertex);this.gl.deleteVertexArray(this.vao);}
}

function primitive(kind){
 const out=[],add=(p,n)=>out.push(...p,...n),quad=(a,b,c,d)=>{for(const [p,n] of [a,b,c,a,c,d])add(p,n);};
 if(kind==='box'){
  for(const [axis,a,b] of [[0,1,2],[1,2,0],[2,0,1]])for(const s of [-1,1]){
   const n=[0,0,0];n[axis]=s;const corner=(u,v)=>{const p=[0,0,0];p[axis]=s;p[a]=u*s;p[b]=v;return [p,n];};
   quad(corner(-1,-1),corner(1,-1),corner(1,1),corner(-1,1));
  }
 }else{
  const slices=kind==='tor'?12:kind==='sph'?12:10,rings=kind==='tor'||kind==='sph'?6:1;
  const point=(i,j)=>{
   const t=i*Math.PI*2/slices,c=Math.cos(t),s=Math.sin(t);
   if(kind==='cyl')return [[c,j*2-1,s],[c,0,s]];
   const v=j*Math.PI*(kind==='tor'?2:1)/rings,cv=Math.cos(v),sv=Math.sin(v);
   if(kind==='tor')return [[c,0,s],[cv*c,sv,cv*s]];
   const n=[sv*c,cv,sv*s];return [n,n];
  };
  for(let i=0;i<slices;i++){
   for(let j=0;j<rings;j++)quad(point(i,j),point(i,j+1),point(i+1,j+1),point(i+1,j));
   if(kind==='cyl')for(const y of [-1,1]){
    const n=[0,y,0];add([0,y,0],n);for(const step of y<0?[i,i+1]:[i+1,i])add(point(step,(y+1)/2)[0],n);
   }
  }
 }
 return new Float32Array(out);
}

// Each fitting carries an affine transform and a tint. A pipe uses the cylinder
// primitive along its own endpoints. A torus carries its minor/major radius.
function fitting(o,rot,rows){
 const c=Math.cos(rot),s=Math.sin(rot),rotate=([x,y,z])=>[x*c-z*s,y,x*s+z*c];
 let axes,pos,kind=o.k,ratio=0;
 if(kind==='pipe'){
  const v=o.b.map((b,i)=>b-o.a[i]),len=Math.hypot(...v);if(len<.0001)return;
  const y=v.map(x=>x/len),h=Math.hypot(y[0],y[2]),x=h?[-y[2]/h,0,y[0]/h]:[1,0,0];
  const z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
  axes=[x.map(t=>t*o.r),v.map(t=>t*.5),z.map(t=>t*o.r)];pos=o.a.map((x,i)=>x+v[i]*.5);kind='cyl';
 }else{
  pos=[o.x,o.y,o.z];
  if(kind==='box'){const c=Math.cos(o.rot),s=Math.sin(o.rot);axes=[[c*o.hx,0,s*o.hx],[0,o.hy,0],[-s*o.hz,0,c*o.hz]];}
  else if(kind==='cyl'){axes=[[o.r,0,0],[0,o.h*.5,0],[0,0,o.r]];pos[1]+=o.h*.5;}
  else{
   const r=kind==='tor'?o.R:o.r;axes=[[r,0,0],[0,r,0],[0,0,r]];
   if(kind==='tor'){ratio=o.r/r;if(o.upright!==undefined){
    const c=Math.cos(o.upright),s=Math.sin(o.upright);axes=[[-s*r,0,c*r],[c*r,0,s*r],[0,r,0]];
   }}
  }
 }
 pos=rotate(pos);pos[1]+=DATUM_M;
 const row=rows[kind];
 for(let i=0;i<3;i++)row.push(...rotate(axes[i]),pos[i]);row.push(...o.c,ratio);
}

// Project large solids onto the service slab. Each shadow uses the same
// footprint and elevations as its caster, including the column under a roof.
function footprint(o,rot,rows){
 if(o.soft||o.k==='tor'||o.k==='pipe')return;
 let hx,hz,bottom,top,axis=rot,round=0;
 if(o.k==='box'){hx=o.hx;hz=o.hz;bottom=o.y-o.hy;top=o.y+o.hy;axis+=o.rot;}
 else{hx=hz=o.r;bottom=o.k==='sph'?o.y-o.r:o.y;top=o.k==='sph'?o.y+o.r:o.y+o.h;round=1;}
 if(Math.min(hx,hz)<.36||top<.6)return;
 const c=Math.cos(rot),s=Math.sin(rot);
 rows.push(o.x*c-o.z*s,o.x*s+o.z*c,Math.cos(axis),Math.sin(axis),hx,hz,Math.max(0,bottom),top,round);
}

const kinds=['box','cyl','sph','tor'];
class Detail{
 constructor(gl,shapes,h,now){
  this.center=h.center;this.radius=h.pod.hexM*.77;this.born=now;this.parts=[];
  const rows={box:[],cyl:[],sph:[],tor:[]};
  const shades=[];
  for(const o of plant(h).solids){if(!o.works||o.trim)fitting(o,h.rot,rows);footprint(o,h.rot,shades);}
  this.shadowCount=shades.length/9;this.shadowVao=gl.createVertexArray();gl.bindVertexArray(this.shadowVao);
  const footprints=new Float32Array(shades);this.shadowData=buffer(gl,footprints);
  attribute(gl,2,4,36,0,1);attribute(gl,3,4,36,16,1);attribute(gl,4,1,36,32,1);
  for(const kind of kinds){
   if(!rows[kind].length)continue;
   const shape=shapes[kind],vao=gl.createVertexArray();gl.bindVertexArray(vao);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,shape.elements);gl.bindBuffer(gl.ARRAY_BUFFER,shape.vertex);attribute(gl,0,3,24,0);attribute(gl,5,3,24,12);
   const data=new Float32Array(rows[kind]),instances=buffer(gl,data);
   for(let i=0;i<4;i++)attribute(gl,i+1,4,64,i*16,1);
   this.parts.push({kind,vao,instances,count:data.length/16,verts:shape.count});
  }
  gl.bindVertexArray(null);
 }
 dispose(gl){gl.deleteBuffer(this.shadowData);gl.deleteVertexArray(this.shadowVao);for(const p of this.parts){gl.deleteVertexArray(p.vao);gl.deleteBuffer(p.instances);}}
}
const cs=Array.from({length:6},(_,k)=>Math.cos((k+.5)*Math.PI/3));
const sn=Array.from({length:6},(_,k)=>Math.sin((k+.5)*Math.PI/3));

export class FieldView{
 constructor(gl){
  this.gl=gl;this.msaa=Number(gl.getParameter(gl.SAMPLES)>1);[this.mesh,this.parts,this.floor,this.shade]=programs(gl,[
   [meshVertex,materialFragment],[detailVertex,materialFragment],[floorVertex,floorFragment],[shadowVertex,shadowFragment]
  ]);
  this.shapes={};this.prototypes=new Map();this.detail=new Map();this.sectors=[];
  for(const k of kinds){const data=primitive(k);this.shapes[k]=indexed(gl,data,6);}
  const tile=[],r=DISTRICT_M/Math.sqrt(3);
  for(let k=0;k<6;k++){tile.push(0,0);for(const j of [k+1,k])tile.push(r*cs[j%6],r*sn[j%6]);}
  this.floorVao=gl.createVertexArray();gl.bindVertexArray(this.floorVao);
  this.tileVertices=buffer(gl,new Float32Array(tile));attribute(gl,0,2,8,0);
  this.tiles=buffer(gl,0);attribute(gl,2,4,32,0,1);attribute(gl,3,4,32,16,1);gl.bindVertexArray(null);
 }
 begin(p,aspect){
  this.p=p;this.aspect=aspect;this.basis=cameraBasis(p);
 }
 use(program,center){
  const gl=this.gl,u=program.u,b=this.basis;gl.useProgram(program.p);
  gl.uniform3fv(u.uRight,b.right);gl.uniform3fv(u.uUp,b.up);gl.uniform3fv(u.uForward,b.forward);gl.uniform1f(u.uAspect,this.aspect);
  this.camera(u,center);return u;
 }
 camera(u,[e,n]){this.gl.uniform3f(u.uCamera,this.p.eastM-e,this.p.altitudeM,this.p.northM-n);}
 ground(){
  const gl=this.gl,p=this.p,[i,j]=hexAt(p.eastM,p.northM,DISTRICT_M),d=district(i,j);
  if(this.floorAt!==d.key){
   const rows=[];
   for(let dj=-6;dj<=6;dj++)for(let di=Math.max(-6,-6-dj);di<=Math.min(6,6-dj);di++){
    const t=district(i+di,j+dj);rows.push(t.center[0]-d.center[0],t.center[1]-d.center[1],t.cos,t.sin,t.scale,t.shift,Number(t.home),0);
   }
   const data=new Float32Array(rows);gl.bindBuffer(gl.ARRAY_BUFFER,this.tiles);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
   this.floorAt=d.key;this.tileCount=data.length/8;
  }
  this.use(this.floor,d.center);gl.bindVertexArray(this.floorVao);gl.drawArraysInstanced(gl.TRIANGLES,0,18,this.tileCount);
 }
 meshAt(anchor){
  const gl=this.gl,u=this.use(this.mesh,anchor);
  gl.uniform1f(u.uFarBase,0);gl.uniform1f(u.uMSAA,this.msaa);gl.uniform1f(u.uKit,0);gl.uniform1f(u.uLocal,0);gl.uniform1f(u.uAge,1);return u;
 }
 updateField(){
  const gl=this.gl,p=this.p,anchor=[p.eastM,p.northM],groups=new Map();
  const list=podsWithin(...anchor,FIELD_OUT+880);
  const instance=(key,x,z,c,s)=>{
   let a=groups.get(key);if(!a){a=[];groups.set(key,a);}a.push(x,z,c,s);
  };
  const {forward,right,up}=this.basis,tan=1/1.428148,wide=tan*this.aspect;
  for(const {pod:q} of list){
   // Enclose the entire pod, the translation before recentering and the angular
   // slack before reselecting. A sharp turn rebuilds before its first draw.
   const dx=q.center[0]-anchor[0],dz=q.center[1]-anchor[1],dy=DATUM_M+24*q.scale-p.altitudeM;
   const depth=dx*forward[0]+dy*forward[1]+dz*forward[2];
   const radius=q.district.podRadiusM+520+.30*Math.hypot(dx,dy,dz);
   if(depth < -radius || Math.abs(dx*right[0]+dz*right[2])>depth*wide+radius*Math.hypot(1,wide) ||
      Math.abs(dx*up[0]+dy*up[1]+dz*up[2])>depth*tan+radius*Math.hypot(1,tan))continue;
   for(const h of hexes(q)){
   if(h.waterWorks)continue;
   h.worksKeys??=sectorKeys(h);
   const x=h.center[0]-anchor[0],z=h.center[1]-anchor[1],d=q.district;
   for(let k=0;k<6;k++){
    const key=h.worksKeys[k],c=(d.cos*cs[k]-d.sin*sn[k])*d.scale,s=(d.sin*cs[k]+d.cos*sn[k])*d.scale;
    instance(key,x,z,c,s);
    h.corners??=[];
    for(const side of [-1,1]){
     const index=k*2+(side+1)/2,corner=h.corners[index]??=cornerKey(h,k,key,side);
     instance(corner,x+69*c-21*side*s,z+69*s+21*side*c,c,s);
    }
   }
  }
  }
  const next=[];
  for(const [key,values] of groups){
   let m=this.prototypes.get(key);
   if(!m){
    const solids=worksModel(key).filter(o=>!o.trim);
    const data=solidVertices(solids,'middle',0,1,null);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const mesh=indexed(gl,data,9);bindMesh(gl,mesh);
    const instances=buffer(gl,0);attribute(gl,2,4,16,0,1);m={vao,mesh,instances};this.prototypes.set(key,m);
   }
   const data=new Float32Array(values);gl.bindBuffer(gl.ARRAY_BUFFER,m.instances);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
   next.push({m,count:data.length/4});
  }
  this.fieldAt=anchor;this.fieldHeight=p.altitudeM;this.fieldYaw=p.yaw;this.fieldPitch=p.pitch;this.fieldAspect=this.aspect;this.sectors=next;gl.bindVertexArray(null);
 }
 skyline(){
  const gl=this.gl,p=this.p;
  if(p.altitudeM-DATUM_M>FIELD_OUT+75)return;
  const yawTravel=Math.acos(Math.max(-1,Math.min(1,Math.cos(p.yaw-this.fieldYaw))));
  if(!this.fieldAt||Math.hypot(p.eastM-this.fieldAt[0],p.northM-this.fieldAt[1])>400 ||
   Math.abs(p.altitudeM-this.fieldHeight)>230 || this.aspect!==this.fieldAspect ||
   yawTravel+Math.abs(p.pitch-this.fieldPitch)>.28)this.updateField();
  if(this.msaa)gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  const u=this.meshAt(this.fieldAt);gl.uniform1f(u.uKit,1);
  for(const {m,count} of this.sectors){gl.bindVertexArray(m.vao);gl.drawElementsInstanced(gl.TRIANGLES,m.mesh.count,gl.UNSIGNED_SHORT,0,count);}
  if(this.msaa)gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
 }
 close(now){
  const gl=this.gl,p=this.p,high=p.altitudeM-DATUM_M,edge=DETAIL_OUT+210;
  if(high>edge){if(this.detail.size)this.releaseDetails();return;}
  const at=this.detailAt;
  if(!at||Math.hypot(p.eastM-at[0],p.northM-at[1])>54||Math.abs(high-at[2])>65){
   const list=[];
   for(const {pod:q} of podsWithin(p.eastM,p.northM,edge+430))for(const h of hexes(q)){
    const d=Math.hypot(p.eastM-h.center[0],p.northM-h.center[1],high);
    if(!h.waterWorks&&d<DETAIL_OUT+q.hexM*.77+95)list.push({h,d});
   }
   list.sort((a,b)=>a.d-b.d);this.detailList=list;
   const wanted=new Set(list.map(v=>v.h.id));for(const [id,b] of this.detail)if(!wanted.has(id)){b.dispose(gl);this.detail.delete(id);}
   this.detailAt=[p.eastM,p.northM,high];
  }
  if(this.msaa)gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  const u=this.use(this.parts,[p.eastM,p.northM]);gl.uniform1f(u.uMSAA,this.msaa);gl.uniform1f(u.uLocal,1);
  let builds=0,shown=0;const shadows=[];
  const forward=this.basis.forward,right=this.basis.right,up=this.basis.up,tan=1/1.428148,wide=this.aspect*tan;
  for(const {h} of this.detailList){
   const x=h.center[0]-p.eastM,z=h.center[1]-p.northM,y=18*h.pod.scale-high;
   const r=h.pod.hexM*.77,d=Math.hypot(x,y,z),depth=x*forward[0]+y*forward[1]+z*forward[2];
   if(depth < -r || Math.abs(x*right[0]+z*right[2])>depth*wide+r*Math.hypot(1,wide)||
    Math.abs(x*up[0]+y*up[1]+z*up[2])>depth*tan+r*Math.hypot(1,tan)||d>DETAIL_OUT+r)continue;
   let b=this.detail.get(h.id);
   if(!b){
    if(builds>=2)continue;
    b=new Detail(gl,this.shapes,h,now);this.detail.set(h.id,b);builds++;
   }
   const age=Math.min(1,(now-b.born)/550);this.camera(u,b.center);gl.uniform1f(u.uAge,age);shown++;
   if(d<235+r)shadows.push({b,age});
   for(const t of b.parts){gl.uniform1f(u.uRing,Number(t.kind==='tor'));gl.bindVertexArray(t.vao);gl.drawElementsInstanced(gl.TRIANGLES,t.verts,gl.UNSIGNED_SHORT,0,t.count);}
  }
  if(this.msaa)gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  if(shadows.length){
   const shade=this.use(this.shade,[p.eastM,p.northM]);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
   for(const {b,age} of shadows){
    this.camera(shade,b.center);gl.uniform1f(shade.uAge,age);gl.bindVertexArray(b.shadowVao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,b.shadowCount);
   }
   gl.depthMask(true);gl.disable(gl.BLEND);
  }
  this.shown=shown;
 }
 releaseDetails(){for(const b of this.detail.values())b.dispose(this.gl);this.detail.clear();this.detailAt=null;this.detailList=[];this.shown=0;}
 dispose(){
  const gl=this.gl;this.releaseDetails();
  for(const m of this.prototypes.values()){gl.deleteBuffer(m.instances);gl.deleteBuffer(m.mesh.vertex);gl.deleteBuffer(m.mesh.elements);gl.deleteVertexArray(m.vao);}
  for(const shape of Object.values(this.shapes)){gl.deleteBuffer(shape.vertex);gl.deleteBuffer(shape.elements);}
  gl.deleteBuffer(this.tiles);gl.deleteBuffer(this.tileVertices);gl.deleteVertexArray(this.floorVao);
  for(const s of [this.mesh,this.parts,this.floor,this.shade])gl.deleteProgram(s.p);
 }
}
