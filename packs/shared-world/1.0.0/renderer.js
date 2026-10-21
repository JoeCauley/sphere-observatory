import {Renderer} from '../../infinite-meadow/1.0.0/renderer.js';
import {renderOrigin} from '../../infinite-meadow/1.0.0/coordinates.js';
import {EYE} from '../../infinite-meadow/1.0.0/model.js';
import {buildZone,movingGeometry} from '../../infinite-industry/1.0.0/geometry.js';
import {DATUM_M} from '../../infinite-industry/1.0.0/facility.js';
import {SharedIndustryBatch} from './renderer-batch.js';
import {programSources,sharedTerrainShaders,sharedCanopyShaders,compileSharedProgram} from './renderer-shaders.js';

export class SharedWorldRenderer extends Renderer {
  constructor(canvas,reference,preparation,lease) {
    super(canvas);
    this.reference=reference;this.facility=reference.facility;this.preparation=preparation;this.lease=lease;
    this.batchNear=new Map();this.nearPackets=new Map();this.batchMiddle=new Map();this.batchFar=new Map();this.motionBatch=null;this.closed=false;
    this.meadowGpuBytes=this.gpuBytes;this.motionKey=null;
    const replacements=[];
    try {
      const terrain=sharedTerrainShaders(...(()=>{const s=programSources(this.gl,this.terrainProgram);return [s.vertex,s.fragment];})());
      const grass=sharedCanopyShaders();
      for(const [key,vertex,fragment] of [['terrainProgram',terrain.vertex,terrain.fragment],['grass',grass.nearVS,grass.nearFS],['grassbox',grass.boxVS,grass.boxFS]])
        replacements.push({key,program:compileSharedProgram(this.gl,vertex,fragment)});
      for(const {key,program} of replacements){this.gl.deleteProgram(this[key]);this[key]=program;}
      replacements.length=0;this.uniforms.clear();
      for(const zone of this.facility.zones) {
        this.batchMiddle.set(zone.id,new SharedIndustryBatch(this.gl,buildZone(this.facility.config,zone.id,'middle'),this.facility.center));
        this.batchFar.set(zone.id,new SharedIndustryBatch(this.gl,buildZone(this.facility.config,zone.id,'far'),this.facility.center));
      }
      this.motionBatch=new SharedIndustryBatch(this.gl,movingGeometry(this.facility.config,0,'distribution'),this.facility.center);
      this.updateOwnedBytes();
      this.info.content='Infinite Meadow + Infinite Industry · one geographic world, camera, sky, clock and Meadow WebGL2 context';
      this.info.coverage+='; full original 150 m Industry facility, six original fallback zones and original detailed-zone residency';
      this.info.assignment={industryCenter:[...this.facility.center],flatRadiusM:reference.flatRadiusM??120,apronM:reference.apronM??128};
    } catch(error) {
      for(const {program} of replacements)this.gl.deleteProgram(program);
      this.dispose();throw error;
    }
  }
  common(program,pose) {
    super.common(program,pose);
    if(this.facility)this.uniform(program,'uIndustryRelative',2,[this.facility.center[0]-pose.eastM,this.facility.center[1]-pose.northM]);
  }
  coverUniforms(program,state) {
    super.coverUniforms(program,state);
    this.uniform(program,'uClearance',1,state.pose.altitudeM-this.reference.groundHeight(state.pose.eastM,state.pose.northM)-EYE);
  }
  resize(width,height) {
    if(this.closed)return;
    if(Number.isFinite(width)&&width>0)this.canvas.width=Math.floor(width);
    if(Number.isFinite(height)&&height>0)this.canvas.height=Math.floor(height);
  }
  updateOwnedBytes() {
    let bytes=this.meadowGpuBytes;
    for(const map of [this.batchNear,this.batchMiddle,this.batchFar])for(const batch of map.values())bytes+=batch.bytes;
    bytes+=this.motionBatch?.bytes??0;this.gpuBytes=bytes;this.info.ownedGpuBufferBytes=bytes;
    return bytes;
  }
  drawShared(state,meadowResidency,sharedFrame={}) {
    if(this.closed)throw Error('Shared renderer disposed');
    const started=performance.now(),gl=this.gl,p=state.pose,origin=sharedFrame.origin??renderOrigin(p);
    let uploads=0,uploadMs=0,motionPreparationMs=0,query=null;
    // The combined timing query includes every Meadow and Industry submission.
    if(this.ext&&this.queries.length<8){query=gl.createQuery();gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);}
    try {
      for(const [key,batch] of this.batchNear)if(!this.preparation.resident.has(key)){batch.dispose();this.batchNear.delete(key);this.nearPackets.delete(key);}
      for(const [key,packet] of this.preparation.resident) {
        if(this.nearPackets.get(key)===packet)continue;
        const t=performance.now(),existing=this.batchNear.get(key);
        if(existing)uploads+=existing.replace(packet.vertices,origin);
        else{this.batchNear.set(key,new SharedIndustryBatch(gl,packet.vertices,this.facility.center));uploads+=packet.vertices.byteLength;}
        this.nearPackets.set(key,packet);uploadMs+=performance.now()-t;
      }
      const meadow=super.draw(state,meadowResidency,{timing:false});
      this.common(this.mesh,p);
      for(const [key,value] of [['uNormalized',0],['uDaylight',meadow.interiorDaylight],['uReveal',meadow.reveal],['uGround',0],['uAlpha',1],['uScale',1],['uOffsetY',0]])this.uniform(this.mesh,key,1,value);
      this.uniform(this.mesh,'uCamera',3,[p.eastM-origin.eastM,p.altitudeM,p.northM-origin.northM]);
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(true);
      const distanceM=Math.hypot(p.eastM-this.facility.center[0],p.northM-this.facility.center[1],p.altitudeM-DATUM_M),far=distanceM>450;
      let industryCalls=0,staticTriangles=0,motionTriangles=0;
      if(distanceM<7500) {
        for(const zone of this.facility.zones) {
          const batch=far?this.batchFar.get(zone.id):this.batchNear.get(zone.id)??this.batchMiddle.get(zone.id),t=performance.now();
          uploads+=batch.rebase(origin);uploadMs+=performance.now()-t;batch.draw();industryCalls++;staticTriangles+=batch.count/3;
        }
        if(distanceM<250) {
          const motionKey=[state.processTime,state.routing,state.transition].join(':');
          if(this.motionKey!==motionKey) {
            const t=performance.now(),data=movingGeometry(this.facility.config,state.processTime,state.routing,state.transition);motionPreparationMs=performance.now()-t;
            const u=performance.now();uploads+=this.motionBatch.replace(data,origin);uploadMs+=performance.now()-u;this.motionKey=motionKey;
          } else {const t=performance.now();uploads+=this.motionBatch.rebase(origin);uploadMs+=performance.now()-t;}
          this.motionBatch.draw();industryCalls++;motionTriangles=this.motionBatch.count/3;
        }
      }
      this.updateOwnedBytes();
      return {...meadow,renderCpuMs:performance.now()-started,drawCalls:meadow.drawCalls+industryCalls,triangles:meadow.triangles+staticTriangles+motionTriangles,
        uploadBytes:meadow.uploadBytes+uploads,uploadCpuMs:uploadMs,motionPreparationMs,gpuBytes:this.gpuBytes,
        gpuQueryPending:this.queries.length+(query?1:0),origin,
        industry:{distanceM,lod:far?'far':this.batchNear.size?'near / middle':'middle fallback',residentZones:this.batchNear.size,facilityCenter:[...this.facility.center],staticTriangles,motionTriangles},
        sharedWorld:true};
    } finally {
      if(query){gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.queries.push({query,frame:this.frame});}
    }
  }
  dispose() {
    if(this.closed)return;this.closed=true;const gl=this.gl;
    for(const map of [this.batchNear,this.batchMiddle,this.batchFar]){for(const batch of map.values())batch.dispose();map.clear();}
    this.nearPackets.clear();this.motionBatch?.dispose();
    for(const key of ['terrainMesh','landmarkMesh','latticeMesh','beltMesh']){const mesh=this[key];if(mesh?.buffer)gl.deleteBuffer(mesh.buffer);if(mesh?.vao)gl.deleteVertexArray(mesh.vao);}
    for(const key of ['bladeBuffer','outerBuffer'])if(this[key])gl.deleteBuffer(this[key]);
    for(const key of ['grassVAO','outerVAO'])if(this[key])gl.deleteVertexArray(this[key]);
    for(const key of ['screen','mesh','grass','grassbox','terrainProgram'])if(this[key])gl.deleteProgram(this[key]);
    for(const {query} of this.queries)gl.deleteQuery(query);this.queries.length=0;this.uniforms.clear();this.gpuBytes=0;
    this.info.ownedGpuBufferBytes=0;
  }
}
