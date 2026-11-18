// The accepted Meadow renderer owns WebGL, shell, sky, lens and lighting.
// This content adapter replaces only the inactive Meadow terrain/landmark passes.
import {Renderer} from '../../infinite-meadow/1.0.0/renderer.js';
import {initialState as meadowEnvironment} from '../../infinite-meadow/1.0.0/model.js';
import {buildZone,movingGeometry,palette} from './geometry.js';
import {DATUM_M} from './facility.js';
import {podsWithin,hexes} from './pod.js';
import {plant,carpet,PALETTES} from './plant.js';
import {transfer,barAt,barVertices} from './transfer.js';
class Batch {
 constructor(gl,data,anchor=[0,0]){this.gl=gl;this.source=data;this.anchor=anchor;this.count=data.length/9;this.bytes=data.byteLength;this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();this.origin=null;gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);for(const [loc,offset] of [[0,0],[1,12],[5,24]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}gl.bindVertexArray(null);}
 rebase(origin){if(this.origin?.eastM===origin.eastM&&this.origin?.northM===origin.northM)return 0;const data=this.source.slice(),eastDelta=this.anchor[0]-origin.eastM,northDelta=this.anchor[1]-origin.northM;for(let i=0;i<data.length;i+=9){data[i]=this.source[i]+eastDelta;data[i+2]=this.source[i+2]+northDelta;}const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);this.origin={...origin};return data.byteLength;}
 replace(data,origin){this.source=data;const gl=this.gl;let allocatedUpload=0;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);if(data.byteLength!==this.bytes){gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);this.bytes=data.byteLength;allocatedUpload=data.byteLength;}this.count=data.length/9;this.origin=null;return allocatedUpload+this.rebase(origin);}
 draw(){const gl=this.gl;gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,this.count);}
 dispose(){this.gl.deleteBuffer(this.buffer);this.gl.deleteVertexArray(this.vao);this.source=null;}
}
// Depth precision. The shared Meadow mesh shader uses a 5 cm near plane and an
// effectively infinite far plane, so a 24-bit buffer resolves about 1.2e-6 * d^2
// metres: 1 cm at 100 m, 30 cm at 500 m. This facility stacks differently
// coloured surfaces millimetres to centimetres apart (water on tank caps, basin
// lids, floor joints), which flashed between colours in motion. Industry draws
// its own geometry with the same shader plus one line: logarithmic depth from
// the true per-fragment distance (about 0.1 mm at 100 m). Meadow is not edited.
const DEPTH_FAR_M=1e6,DEPTH_MARK='float opacity=uAlpha*edgeAlpha;';
function logarithmicMesh(gl,shared){
 const source={};for(const s of gl.getAttachedShaders(shared)??[])source[gl.getShaderParameter(s,gl.SHADER_TYPE)]=gl.getShaderSource(s);
 const vs=source[gl.VERTEX_SHADER],fs=source[gl.FRAGMENT_SHADER];if(!vs||!fs||fs.split(DEPTH_MARK).length!==2)return null;
 const depth='gl_FragDepth=clamp(log2(1.+length(position-uCamera))*'+(1/Math.log2(1+DEPTH_FAR_M)).toFixed(12)+',0.,1.);';
 const make=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;};
 const v=make(gl.VERTEX_SHADER,vs),f=make(gl.FRAGMENT_SHADER,fs.replace(DEPTH_MARK,depth+DEPTH_MARK));if(!v||!f){if(v)gl.deleteShader(v);if(f)gl.deleteShader(f);return null;}
 const program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}return program;
}
export class IndustryRenderer extends Renderer {
 constructor(canvas,facility,preparation,lease){
  super(canvas);this.facility=facility;this.preparation=preparation;this.lease=lease;this.batchNear=new Map();this.batchMiddle=new Map();this.batchFar=new Map();this.plantBatches=new Map();this.frameUploads=0;this.lastUploadMs=0;
  for(const key of ['terrainMesh','landmarkMesh','latticeMesh']){const m=this[key];this.gl.deleteBuffer(m.buffer);this.gl.deleteVertexArray(m.vao);this[key]={count:0,bytes:0,draw(){}};}
  for(const z of facility.zones){this.batchMiddle.set(z.id,new Batch(this.gl,buildZone(facility.config,z.id,'middle'),facility.center));this.batchFar.set(z.id,new Batch(this.gl,buildZone(facility.config,z.id,'far'),facility.center));}
  const c=palette(facility.config).stone,ground=[];for(const v of [[-8192,DATUM_M-.015,-8192],[-8192,DATUM_M-.015,8192],[8192,DATUM_M-.015,8192],[-8192,DATUM_M-.015,-8192],[8192,DATUM_M-.015,8192],[8192,DATUM_M-.015,-8192]])ground.push(...v,...c,0,1,0);
  this.groundBatch=new Batch(this.gl,new Float32Array(ground));this.motionBatch=new Batch(this.gl,movingGeometry(facility.config,0,'distribution'),facility.center);
  let depthMesh=null;try{depthMesh=logarithmicMesh(this.gl,this.mesh);}catch{}this.industryMesh=depthMesh??this.mesh;this.info.depth=depthMesh?'logarithmic per-fragment distance, far '+DEPTH_FAR_M+' m':'shared Meadow projection (near 0.05 m)';
  this.environment=meadowEnvironment();this.environment.grassbox=false;this.environment.concealment=true;this.emptyStage={ready:true,version:-1,tiles:new Map()};this.trianglesPeak=0;
  this.info.content='II-001 water processing · same Meadow WebGL2 renderer and mesh lighting';this.info.coverage='One addressed facility; six fallback zones, at most four detailed zones; same process and boundary geometry in every representation';this.info.ownedGpuBufferBytes=lease.inspect().bufferBytes;
  // Count actual GL submissions, excluding retired no-op Meadow passes.
  const gl=this.gl;this.originalDrawArrays=gl.drawArrays;this.originalDrawInstanced=gl.drawArraysInstanced;
  gl.drawArrays=(mode,first,count)=>{this.actualDrawCalls++;this.actualTriangles+=mode===gl.TRIANGLES?count/3:0;return this.originalDrawArrays.call(gl,mode,first,count);};
  gl.drawArraysInstanced=(mode,first,count,instances)=>{this.actualDrawCalls++;this.actualTriangles+=mode===gl.TRIANGLES?count*instances/3:0;return this.originalDrawInstanced.call(gl,mode,first,count,instances);};
 }
 // The base class caches uniform locations for its own programs only.
 location(program,key){if(program!==this.industryMesh||program===this.mesh)return super.location(program,key);this.industryUniforms??=new Map();let at=this.industryUniforms.get(key);if(at===undefined){at=this.gl.getUniformLocation(program,key);this.industryUniforms.set(key,at);}return at;}
 drawIndustry(state,sharedFrame){
  const started=performance.now(),p=state.pose,origin=sharedFrame.origin;let uploads=0,uploadMs=0;this.actualDrawCalls=0;this.actualTriangles=0;this.motionPreparationMs=0;
  for(const [key,b] of this.batchNear)if(!this.preparation.resident.has(key)){b.dispose();this.batchNear.delete(key);}
  for(const [key,packet] of this.preparation.resident)if(!this.batchNear.has(key)){const t=performance.now();this.batchNear.set(key,new Batch(this.gl,packet.vertices,this.facility.center));uploads+=packet.vertices.byteLength;uploadMs+=performance.now()-t;}
  // Base draw owns all sky/shell transforms. No alternate context or render loop.
  this.environment.pose={...p};this.environment.windTime=state.processTime;
  const m=super.draw(this.environment,this.emptyStage,{inspection:'surface',timing:false});
  const gl=this.gl,mesh=this.industryMesh;this.common(mesh,p);this.uniform(mesh,'uNormalized',1,0);this.uniform(mesh,'uDaylight',1,1);this.uniform(mesh,'uReveal',1,0);this.uniform(mesh,'uGround',1,0);this.uniform(mesh,'uAlpha',1,1);this.uniform(mesh,'uScale',1,1);this.uniform(mesh,'uOffsetY',1,0);
  // The plane follows the eye; content uses CPU double precision deltas first.
  this.uniform(mesh,'uCamera',3,[0,p.altitudeM,0]);this.groundBatch.draw();let calls=m.drawCalls+1,triangles=m.triangles+2;
  this.uniform(mesh,'uCamera',3,[p.eastM-origin.eastM,p.altitudeM,p.northM-origin.northM]);
  const dist=Math.hypot(p.eastM-this.facility.center[0],p.northM-this.facility.center[1],p.altitudeM-DATUM_M),far=dist>450;
  if(dist<7500){for(const z of this.facility.zones){const b=far?this.batchFar.get(z.id):this.batchNear.get(z.id)??this.batchMiddle.get(z.id),t=performance.now();uploads+=b.rebase(origin);uploadMs+=performance.now()-t;b.draw();calls++;triangles+=b.count/3;}
   if(dist<250){const motionKey=[state.processTime,state.routing,state.transition].join(':');if(this.motionKey!==motionKey){const buildStart=performance.now(),data=movingGeometry(this.facility.config,state.processTime,state.routing,state.transition);this.motionPreparationMs=performance.now()-buildStart;const t=performance.now();uploads+=this.motionBatch.replace(data,origin);uploadMs+=performance.now()-t;this.motionKey=motionKey;}else{this.motionPreparationMs=0;const t=performance.now();uploads+=this.motionBatch.rebase(origin);uploadMs+=performance.now()-t;}this.motionBatch.draw();calls++;triangles+=this.motionBatch.count/3;}}
  const closeToTransfer=Math.hypot(p.eastM-transfer.center[0],p.northM-transfer.center[1],p.altitudeM-DATUM_M)<300;
  if(closeToTransfer){
    if(!this.transferBars){
      const started=performance.now();
      this.transferBars=new Batch(gl,barVertices(this.facility.config,PALETTES.hot));
      uploads+=this.transferBars.bytes;uploadMs+=performance.now()-started;
    }
    for(let i=0;i<3;i++){
      const [e,n]=barAt(state.processTime,i).position;
      this.uniform(mesh,'uCamera',3,[p.eastM-e,p.altitudeM,p.northM-n]);
      this.transferBars.draw();calls++;triangles+=this.transferBars.count/3;
    }
  }else if(this.transferBars){this.transferBars.dispose();this.transferBars=null;}
  // Pods (pod.js, plant.js). The pods around the eye are drawn hex by hex at near, middle or far detail; every pod beyond them
  // is one buffer of its seven plants at skyline or horizon detail, or beyond 3.6 km its seven grounds alone (carpet). Vertices are kept relative to their own hex or pod centre and
  // never moved; the camera is given relative to that centre instead, in double precision here. Building is rationed by the frame,
  // and a pod whose hexes are not all built yet is shown by its own skyline until they are.
  if(p.altitudeM-DATUM_M<9000){const high=p.altitudeM-DATUM_M,was=this.podAt;
   if(!was||Math.hypot(p.eastM-was[0],p.northM-was[1])>Math.max(80,high*.3)||Math.abs(high-was[2])>Math.max(40,was[2]*.2)){this.podAt=[p.eastM,p.northM,high];this.podList=podsWithin(p.eastM,p.northM,Math.min(9000,2200+high*2.2));
    this.closePods=[];const groups=new Map();
    for(const hit of this.podList){
     if(hit.distance<3600){this.closePods.push(hit);continue;}
     const d=hit.pod.district;
     if(!groups.has(d.key))groups.set(d.key,{district:d,pods:[]});
     groups.get(d.key).pods.push(hit.pod);
    }
    this.groundGroups=[...groups.values()];
    for(const group of this.groundGroups)group.signature=group.pods.map(q=>q.key).sort().join(';');
   }
   const wanted=new Set();let builds=0,carpets=0,shown=0;
   const show=(b,anchor)=>{this.uniform(mesh,'uCamera',3,[p.eastM-anchor[0],p.altitudeM,p.northM-anchor[1]]);b.draw();calls++;triangles+=b.count/3;shown++;};
   const make=(q,lod)=>{const t=performance.now(),parts=hexes(q).filter(h=>!h.waterWorks).map(h=>{const shift=[h.center[0]-q.center[0],h.center[1]-q.center[1]];return lod==='carpet'?carpet(h,shift):plant(h).vertices(lod,shift);}),data=new Float32Array(parts.reduce((n,a)=>n+a.length,0));let at=0;for(const a of parts){data.set(a,at);at+=a.length;}
    const b=new Batch(gl,data,q.center);this.plantBatches.set(q.key+'|'+lod,b);uploads+=b.bytes;uploadMs+=performance.now()-t;return b;};
   // The buffer for a whole pod at the detail wanted; failing that whatever it already has; failing that its carpet, made now, so no pod is ever a hole.
   const whole=(q,lod)=>{let b=this.plantBatches.get(q.key+'|'+lod);
    if(!b&&(lod==='carpet'?carpets<24:builds<2)){if(lod==='carpet')carpets++;else builds++;b=make(q,lod);for(const other of ['skyline','horizon','carpet'])if(other!==lod){const old=this.plantBatches.get(q.key+'|'+other);if(old){old.dispose();this.plantBatches.delete(q.key+'|'+other);}}}
    b??=this.plantBatches.get(q.key+'|skyline')??this.plantBatches.get(q.key+'|horizon')??this.plantBatches.get(q.key+'|carpet');
    if(!b&&carpets<24){carpets++;b=make(q,'carpet');}
    return b;};
   // Distant ground has identical material and one district-relative origin.
   // Keep the exact membership of the requested disc, in one draw per district.
   let districtBuilds=0;
   for(const group of this.groundGroups){
    const d=group.district,tag='ground/'+d.key,key=tag+'|district';
    wanted.add(tag);let batch=this.plantBatches.get(key);
    if(batch?.membership!==group.signature){
     if(batch){batch.dispose();this.plantBatches.delete(key);batch=null;}
     if(districtBuilds<2){
      const parts=[];const t=performance.now();
      for(const q of group.pods)for(const h of hexes(q))if(!h.waterWorks)parts.push(carpet(h,[h.center[0]-d.center[0],h.center[1]-d.center[1]]));
      const data=new Float32Array(parts.reduce((count,part)=>count+part.length,0));
      let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}
      batch=new Batch(gl,data,d.center);batch.membership=group.signature;this.plantBatches.set(key,batch);
      districtBuilds++;uploads+=batch.bytes;uploadMs+=performance.now()-t;
     }
    }
    if(batch)show(batch,d.center);
   }
   for(const {pod:q,distance} of this.closePods){const pitch=q.district.podPitchM;wanted.add(q.key);
    if(distance>=pitch*1.25){const b=whole(q,distance<pitch*3?'skyline':distance<3600?'horizon':'carpet');if(b)show(b,q.center);continue;}
    const ready=[];let all=true;
    for(const h of hexes(q)){if(h.waterWorks)continue;wanted.add(h.id);
     const d=Math.hypot(p.eastM-h.center[0],p.northM-h.center[1],high),lod=d<q.hexM*1.3?'near':d<q.hexM*3?'middle':'far';
     let b=this.plantBatches.get(h.id+'|'+lod);
     if(!b&&builds<2){builds+=2;const t=performance.now();b=new Batch(gl,plant(h).vertices(lod),h.center);this.plantBatches.set(h.id+'|'+lod,b);uploads+=b.bytes;uploadMs+=performance.now()-t;}
     if(b){for(const other of ['near','middle'])if(other!==lod){const old=this.plantBatches.get(h.id+'|'+other);if(old){old.dispose();this.plantBatches.delete(h.id+'|'+other);}}}
     else b=this.plantBatches.get(h.id+'|far')??this.plantBatches.get(h.id+'|middle')??this.plantBatches.get(h.id+'|near');
     if(b)ready.push([b,h.center]);else all=false;}
    if(all)for(const [b,anchor] of ready)show(b,anchor);else{const b=whole(q,'skyline');if(b)show(b,q.center);}}
   for(const [key,b] of this.plantBatches)if(!wanted.has(key.slice(0,key.lastIndexOf('|')))){b.dispose();this.plantBatches.delete(key);}
   this.info.plants=this.podList.length+' pods in reach, '+shown+' buffers drawn, '+this.plantBatches.size+' held';
  }
  this.trianglesPeak=Math.max(this.trianglesPeak,triangles);this.lastUploadMs=uploadMs;this.info.ownedGpuBufferBytes=this.lease.inspect().bufferBytes;
  return {...m,renderCpuMs:performance.now()-started,drawCalls:this.actualDrawCalls,triangles:this.actualTriangles,uploadBytes:uploads,uploadCpuMs:uploadMs,motionPreparationMs:this.motionPreparationMs??0,gpuBytes:this.lease.inspect().bufferBytes,gpuTextureBytes:0,lod:far?'far':this.batchNear.size?'near / middle':'middle fallback',residentZones:this.batchNear.size,origin:sharedFrame.origin};
 }
 dispose(){this.transferBars?.dispose();if(this.industryMesh!==this.mesh)this.gl.deleteProgram(this.industryMesh);for(const map of [this.batchNear,this.batchMiddle,this.batchFar]){for(const b of map.values())b.dispose();map.clear();}for(const b of this.plantBatches.values())b.dispose();this.plantBatches.clear();this.groundBatch.dispose();this.motionBatch.dispose();this.emptyStage.tiles.clear();this.queries.length=0;this.gl.drawArrays=this.originalDrawArrays;this.gl.drawArraysInstanced=this.originalDrawInstanced;}
}
