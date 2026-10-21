// The accepted Meadow renderer owns WebGL, shell, sky, lens and lighting.
// This content adapter replaces only the inactive Meadow terrain/landmark passes.
import {Renderer} from '../../infinite-meadow/1.0.0/renderer.js';
import {initialState as meadowEnvironment} from '../../infinite-meadow/1.0.0/model.js';
import {buildZone,movingGeometry,palette} from './geometry.js';
import {DATUM_M} from './facility.js';
class Batch {
 constructor(gl,data,anchor=[0,0]){this.gl=gl;this.source=data;this.anchor=anchor;this.count=data.length/9;this.bytes=data.byteLength;this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();this.origin=null;gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);for(const [loc,offset] of [[0,0],[1,12],[5,24]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}gl.bindVertexArray(null);}
 rebase(origin){if(this.origin?.eastM===origin.eastM&&this.origin?.northM===origin.northM)return 0;const data=this.source.slice(),eastDelta=this.anchor[0]-origin.eastM,northDelta=this.anchor[1]-origin.northM;for(let i=0;i<data.length;i+=9){data[i]=this.source[i]+eastDelta;data[i+2]=this.source[i+2]+northDelta;}const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);this.origin={...origin};return data.byteLength;}
 replace(data,origin){this.source=data;const gl=this.gl;let allocatedUpload=0;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);if(data.byteLength!==this.bytes){gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);this.bytes=data.byteLength;allocatedUpload=data.byteLength;}this.count=data.length/9;this.origin=null;return allocatedUpload+this.rebase(origin);}
 draw(){const gl=this.gl;gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,this.count);}
 dispose(){this.gl.deleteBuffer(this.buffer);this.gl.deleteVertexArray(this.vao);this.source=null;}
}
export class IndustryRenderer extends Renderer {
 constructor(canvas,facility,preparation,lease){
  super(canvas);this.facility=facility;this.preparation=preparation;this.lease=lease;this.batchNear=new Map();this.batchMiddle=new Map();this.batchFar=new Map();this.frameUploads=0;this.lastUploadMs=0;
  for(const key of ['terrainMesh','landmarkMesh','latticeMesh']){const m=this[key];this.gl.deleteBuffer(m.buffer);this.gl.deleteVertexArray(m.vao);this[key]={count:0,bytes:0,draw(){}};}
  for(const z of facility.zones){this.batchMiddle.set(z.id,new Batch(this.gl,buildZone(facility.config,z.id,'middle'),facility.center));this.batchFar.set(z.id,new Batch(this.gl,buildZone(facility.config,z.id,'far'),facility.center));}
  const c=palette(facility.config).stone,ground=[];for(const v of [[-8192,DATUM_M-.015,-8192],[-8192,DATUM_M-.015,8192],[8192,DATUM_M-.015,8192],[-8192,DATUM_M-.015,-8192],[8192,DATUM_M-.015,8192],[8192,DATUM_M-.015,-8192]])ground.push(...v,...c,0,1,0);
  this.groundBatch=new Batch(this.gl,new Float32Array(ground));this.motionBatch=new Batch(this.gl,movingGeometry(facility.config,0,'distribution'),facility.center);
  this.environment=meadowEnvironment();this.environment.grassbox=false;this.environment.concealment=true;this.emptyStage={ready:true,version:-1,tiles:new Map()};this.trianglesPeak=0;
  this.info.content='II-001 water processing · same Meadow WebGL2 renderer and mesh lighting';this.info.coverage='One addressed facility; six fallback zones, at most four detailed zones; same process and boundary geometry in every representation';this.info.ownedGpuBufferBytes=lease.inspect().bufferBytes;
  // Count actual GL submissions, excluding retired no-op Meadow passes.
  const gl=this.gl;this.originalDrawArrays=gl.drawArrays;this.originalDrawInstanced=gl.drawArraysInstanced;
  gl.drawArrays=(mode,first,count)=>{this.actualDrawCalls++;this.actualTriangles+=mode===gl.TRIANGLES?count/3:0;return this.originalDrawArrays.call(gl,mode,first,count);};
  gl.drawArraysInstanced=(mode,first,count,instances)=>{this.actualDrawCalls++;this.actualTriangles+=mode===gl.TRIANGLES?count*instances/3:0;return this.originalDrawInstanced.call(gl,mode,first,count,instances);};
 }
 drawIndustry(state,sharedFrame){
  const started=performance.now(),p=state.pose,origin=sharedFrame.origin;let uploads=0,uploadMs=0;this.actualDrawCalls=0;this.actualTriangles=0;this.motionPreparationMs=0;
  for(const [key,b] of this.batchNear)if(!this.preparation.resident.has(key)){b.dispose();this.batchNear.delete(key);}
  for(const [key,packet] of this.preparation.resident)if(!this.batchNear.has(key)){const t=performance.now();this.batchNear.set(key,new Batch(this.gl,packet.vertices,this.facility.center));uploads+=packet.vertices.byteLength;uploadMs+=performance.now()-t;}
  // Base draw owns all sky/shell transforms. No alternate context or render loop.
  this.environment.pose={...p};this.environment.windTime=state.processTime;
  const m=super.draw(this.environment,this.emptyStage,{inspection:'surface',timing:false});
  const gl=this.gl;this.common(this.mesh,p);this.uniform(this.mesh,'uNormalized',1,0);this.uniform(this.mesh,'uDaylight',1,1);this.uniform(this.mesh,'uReveal',1,0);this.uniform(this.mesh,'uGround',1,0);this.uniform(this.mesh,'uAlpha',1,1);this.uniform(this.mesh,'uScale',1,1);this.uniform(this.mesh,'uOffsetY',1,0);
  // The plane follows the eye; content uses CPU double precision deltas first.
  this.uniform(this.mesh,'uCamera',3,[0,p.altitudeM,0]);this.groundBatch.draw();let calls=m.drawCalls+1,triangles=m.triangles+2;
  this.uniform(this.mesh,'uCamera',3,[p.eastM-origin.eastM,p.altitudeM,p.northM-origin.northM]);
  const dist=Math.hypot(p.eastM-this.facility.center[0],p.northM-this.facility.center[1],p.altitudeM-DATUM_M),far=dist>450;
  if(dist<7500){for(const z of this.facility.zones){const b=far?this.batchFar.get(z.id):this.batchNear.get(z.id)??this.batchMiddle.get(z.id),t=performance.now();uploads+=b.rebase(origin);uploadMs+=performance.now()-t;b.draw();calls++;triangles+=b.count/3;}
   if(dist<250){const motionKey=[state.processTime,state.routing,state.transition].join(':');if(this.motionKey!==motionKey){const buildStart=performance.now(),data=movingGeometry(this.facility.config,state.processTime,state.routing,state.transition);this.motionPreparationMs=performance.now()-buildStart;const t=performance.now();uploads+=this.motionBatch.replace(data,origin);uploadMs+=performance.now()-t;this.motionKey=motionKey;}else{this.motionPreparationMs=0;const t=performance.now();uploads+=this.motionBatch.rebase(origin);uploadMs+=performance.now()-t;}this.motionBatch.draw();calls++;triangles+=this.motionBatch.count/3;}}
  this.trianglesPeak=Math.max(this.trianglesPeak,triangles);this.lastUploadMs=uploadMs;this.info.ownedGpuBufferBytes=this.lease.inspect().bufferBytes;
  return {...m,renderCpuMs:performance.now()-started,drawCalls:this.actualDrawCalls,triangles:this.actualTriangles,uploadBytes:uploads,uploadCpuMs:uploadMs,motionPreparationMs:this.motionPreparationMs??0,gpuBytes:this.lease.inspect().bufferBytes,gpuTextureBytes:0,lod:far?'far':this.batchNear.size?'near / middle':'middle fallback',residentZones:this.batchNear.size,origin:sharedFrame.origin};
 }
 dispose(){for(const map of [this.batchNear,this.batchMiddle,this.batchFar]){for(const b of map.values())b.dispose();map.clear();}this.groundBatch.dispose();this.motionBatch.dispose();this.emptyStage.tiles.clear();this.queries.length=0;this.gl.drawArrays=this.originalDrawArrays;this.gl.drawArraysInstanced=this.originalDrawInstanced;}
}
