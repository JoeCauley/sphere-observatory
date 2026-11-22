// Meadow owns the shell, camera and sky. The replaceable field view draws solid
// Industry geometry into the same WebGL context and reads the simulation pose.
import {Renderer} from '../../infinite-meadow/1.0.0/renderer.js';
import {initialState as meadowEnvironment} from '../../infinite-meadow/1.0.0/model.js';
import {buildZone,movingGeometry} from './geometry.js';
import {DATUM_M} from './facility.js';
import {PALETTES} from './works.js';
import {Batch,FieldView} from './field-view.js';
import {transfer,barAt,barVertices} from './transfer.js';

export class IndustryRenderer extends Renderer {
 constructor(canvas,facility,preparation,lease){
  super(canvas);
  this.facility=facility;this.preparation=preparation;this.lease=lease;
  this.batchNear=new Map();this.batchMiddle=new Map();this.batchFar=new Map();
  const gl=this.gl;
  for(const key of ['terrainMesh','landmarkMesh','latticeMesh']){
   const m=this[key];gl.deleteBuffer(m.buffer);gl.deleteVertexArray(m.vao);this[key]={count:0,bytes:0,draw(){}};
  }
  this.field=new FieldView(gl);
  for(const z of facility.zones){
   this.batchMiddle.set(z.id,new Batch(gl,buildZone(facility.config,z.id,'middle')));
   this.batchFar.set(z.id,new Batch(gl,buildZone(facility.config,z.id,'far')));
  }
  const plane=[];
  for(const [x,z] of [[-1,-1],[-1,1],[1,1],[-1,-1],[1,1],[1,-1]])
   plane.push(x*450000,DATUM_M-.15,z*450000,.38,.40,.38,0,1,0);
  this.groundBatch=new Batch(gl,new Float32Array(plane));
  this.motionBatch=new Batch(gl,movingGeometry(facility.config,0,'distribution'));
  this.environment=meadowEnvironment();this.environment.grassbox=false;this.environment.concealment=true;
  this.emptyStage={ready:true,version:-1,tiles:new Map()};this.trianglesPeak=0;
  this.info.depth='logarithmic per-fragment distance, far 1000000 m';
  this.info.content='II-001 water processing, addressed factory envelopes and Outfall surfaces';
  this.info.coverage='Analytic district floors, instanced works and local fittings';
  // Count submitted bytes and CPU submission time at the WebGL boundary.
  // Preparation and triangulation are included separately in total render CPU.
  this.bufferMethods={};
  for(const method of ['bufferData','bufferSubData']){
   const original=this.bufferMethods[method]=gl[method];
   gl[method]=(...args)=>{
    const start=performance.now(),data=args[method==='bufferData'?1:2],result=original.apply(gl,args);
    this.uploadCpuMs+=performance.now()-start;
    if(data?.byteLength)this.frameUploads+=data.byteLength;
    return result;
   };
  }
  this.originalDrawArrays=gl.drawArrays;this.originalDrawInstanced=gl.drawArraysInstanced;
  this.originalDrawIndexed=gl.drawElementsInstanced;
  gl.drawElementsInstanced=(mode,count,type,offset,instances)=>{this.actualDrawCalls++;if(mode===gl.TRIANGLES)this.actualTriangles+=count*instances/3;return this.originalDrawIndexed.call(gl,mode,count,type,offset,instances);};
  gl.drawArrays=(mode,first,count)=>{this.actualDrawCalls++;if(mode===gl.TRIANGLES)this.actualTriangles+=count/3;return this.originalDrawArrays.call(gl,mode,first,count);};
  gl.drawArraysInstanced=(mode,first,count,instances)=>{this.actualDrawCalls++;if(mode===gl.TRIANGLES)this.actualTriangles+=count*instances/3;return this.originalDrawInstanced.call(gl,mode,first,count,instances);};
 }
 drawIndustry(state,sharedFrame){
  const started=performance.now(),p=state.pose,field=this.field,gl=this.gl;
  this.actualDrawCalls=0;this.actualTriangles=0;
  let motionPreparationMs=0;this.frameUploads=0;this.uploadCpuMs=0;
  for(const [key,b] of this.batchNear)if(!this.preparation.resident.has(key)){b.dispose();this.batchNear.delete(key);}
  for(const [key,packet] of this.preparation.resident)if(!this.batchNear.has(key)){
   const b=new Batch(gl,packet.vertices);this.batchNear.set(key,b);
  }
  this.environment.pose={...p};this.environment.windTime=state.processTime;
  const aspect=this.canvas.width/this.canvas.height,clearance=p.altitudeM-DATUM_M;
  // The slab pass is opaque. Restrict shell shading to rays that can reach the
  // horizon. The outermost screen corner is the longest ray for this lens.
  let skip=0;
  if(clearance>.2&&clearance<9000){
   const tangent=1/1.428148,longest=Math.hypot(1,tangent,aspect*tangent);
   const edge=(-clearance*longest/18000-Math.sin(p.pitch))/(Math.max(.00001,Math.cos(p.pitch))*tangent);
   skip=Math.max(0,Math.min(this.canvas.height,Math.floor((1+edge)*this.canvas.height*.5)-2));
  }
  if(skip){
   gl.disable(gl.SCISSOR_TEST);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.enable(gl.SCISSOR_TEST);gl.scissor(0,skip,this.canvas.width,this.canvas.height-skip);
  }
  let m;try{m=super.draw(this.environment,this.emptyStage,{inspection:'surface',timing:false});}
  finally{if(skip)gl.disable(gl.SCISSOR_TEST);}
  field.begin(p,this.canvas.width/this.canvas.height);
  const ground=field.meshAt([p.eastM,p.northM]);gl.uniform1f(ground.uFarBase,1);this.groundBatch.draw();field.ground();field.skyline();
  const f=this.facility,dist=Math.hypot(p.eastM-f.center[0],p.northM-f.center[1],p.altitudeM-DATUM_M);
  const far=dist>450;
  if(dist<7500){
   field.meshAt(f.center);
   for(const z of f.zones)(far?this.batchFar.get(z.id):this.batchNear.get(z.id)??this.batchMiddle.get(z.id)).draw();
   if(dist<250){
    const key=[state.processTime,state.routing,state.transition].join(':');
    if(this.motionKey!==key){
     const start=performance.now(),data=movingGeometry(f.config,state.processTime,state.routing,state.transition);
     motionPreparationMs=performance.now()-start;this.motionBatch.replace(data);this.motionKey=key;
    }
    this.motionBatch.draw();
   }
  }
  if(Math.hypot(p.eastM-transfer.center[0],p.northM-transfer.center[1],p.altitudeM-DATUM_M)<300){
   if(!this.transferBars){this.transferBars=new Batch(gl,barVertices(f.config,PALETTES.hot));}
   const u=field.meshAt(transfer.center);
   for(let i=0;i<3;i++){field.camera(u,barAt(state.processTime,i).position);this.transferBars.draw();}
  }else if(this.transferBars){this.transferBars.dispose();this.transferBars=null;}
  field.close(started);
  this.trianglesPeak=Math.max(this.trianglesPeak,this.actualTriangles);
  this.info.plants=field.sectors.length+' instanced factory types, '+(field.shown??0)+' detailed hexes in view';
  this.info.ownedGpuBufferBytes=this.lease.inspect().bufferBytes;
  return {...m,renderCpuMs:performance.now()-started,drawCalls:this.actualDrawCalls,triangles:this.actualTriangles,
   uploadBytes:this.frameUploads,uploadCpuMs:this.uploadCpuMs,motionPreparationMs,gpuBytes:this.info.ownedGpuBufferBytes,
   gpuTextureBytes:0,lod:far?'far':this.batchNear.size?'near / middle':'middle fallback',
   residentZones:this.batchNear.size,origin:sharedFrame.origin};
 }
 dispose(){
  this.transferBars?.dispose();this.field.dispose();
  for(const map of [this.batchNear,this.batchMiddle,this.batchFar]){for(const b of map.values())b.dispose();map.clear();}
  this.groundBatch.dispose();this.motionBatch.dispose();this.emptyStage.tiles.clear();this.queries.length=0;
  for(const [name,original] of Object.entries(this.bufferMethods))this.gl[name]=original;
  this.gl.drawElementsInstanced=this.originalDrawIndexed;this.gl.drawArrays=this.originalDrawArrays;this.gl.drawArraysInstanced=this.originalDrawInstanced;
 }
}
