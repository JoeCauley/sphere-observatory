import {buildZone,movingGeometry} from '../../infinite-industry/1.0.0/geometry.js';
import {DATUM_M} from '../../infinite-industry/1.0.0/facility.js';
import {SharedIndustryBatch} from './renderer-batch.js';
import {vertexBounds,motionBounds,cameraView,boundsVisible} from './industry-visibility.js';

// This owner reads graphics inputs. It never advances time, polls controls,
// changes reference state, or participates in collision/support decisions.
export class IndustryDisplay {
  constructor(gl,facility,preparation,{culling=true}={}){
    const started=performance.now();
    this.gl=gl;this.facility=facility;this.preparation=preparation;this.culling=culling;
    this.near=new Map();this.packetBounds=new Map();this.middle=new Map();this.far=new Map();
    this.motion=null;this.motionKey=null;this.motionEnvelope=motionBounds(facility.config);this.view=null;this.closed=false;
    this.totals={nearUploads:0,motionBuilds:0,vertexBoundsBuilds:0};
    try{
      // Keep all original fallback content ready for an immediate turn. Detail
      // uploads and animated representation are optional until they contribute.
      for(const zone of facility.zones)for(const [lod,map]of [['middle',this.middle],['far',this.far]]){
        const vertices=buildZone(facility.config,zone.id,lod),bounds=vertexBounds(vertices);
        map.set(zone.id,{batch:new SharedIndustryBatch(gl,vertices,facility.center),bounds});this.totals.vertexBoundsBuilds++;
      }
    }catch(error){this.dispose();throw error;}
    this.startupPreparationMs=performance.now()-started;
  }
  get bytes(){let bytes=this.motion?.bytes??0;for(const map of [this.near,this.middle,this.far])for(const r of map.values())bytes+=r.batch.bytes;return bytes;}
  prioritize(wanted,pose,width,height,origin,maximum=4){
    if(!this.culling||this.closed)return wanted;
    this.view=cameraView(pose,width,height,origin,this.view);
    // Reuse the already verified fallback bounds only for job ORDER. Keep the
    // exact original proximity-selected set and never cancel an in-flight job
    // on a turn. Near detail still uses its own complete vertex bounds to draw.
    const keep=wanted.slice(0,maximum),seen=id=>boundsVisible(this.middle.get(id)?.bounds,this.facility.center,this.view);
    return [...keep.filter(seen),...keep.filter(id=>!seen(id)),...wanted.slice(maximum)];
  }
  draw(state,{width,height,origin}){
    if(this.closed)throw Error('Industry display disposed');
    const started=performance.now(),facility=this.facility,p=state.pose;
    const distanceM=Math.hypot(p.eastM-facility.center[0],p.northM-facility.center[1],p.altitudeM-DATUM_M),far=distanceM>450;
    this.view=cameraView(p,width,height,origin,this.view);
    const visible=bounds=>!this.culling||boundsVisible(bounds,facility.center,this.view);
    let uploads=0,uploadMs=0,motionPreparationMs=0,staticTriangles=0,motionTriangles=0,drawCalls=0,culledZones=0,deferredNearUploads=0,boundsTests=0;
    for(const [key,r]of this.near)if(!this.preparation.resident.has(key)){r.batch.dispose();this.near.delete(key);}
    for(const key of this.packetBounds.keys())if(!this.preparation.resident.has(key))this.packetBounds.delete(key);
    for(const [key,packet]of this.preparation.resident){
      if(this.packetBounds.get(key)?.packet!==packet){this.packetBounds.set(key,{packet,bounds:vertexBounds(packet.vertices)});this.totals.vertexBoundsBuilds++;}
      // A replaced hidden packet must not retain an obsolete CPU array/GPU
      // buffer alongside its successor. Complete fallback content stays ready.
      const old=this.near.get(key);if(old&&old.packet!==packet&&(distanceM>=7500||far||!visible(this.packetBounds.get(key).bounds))){old.batch.dispose();this.near.delete(key);}
    }
    if(distanceM<7500)for(const zone of facility.zones){
      const packet=this.preparation.resident.get(zone.id),detail=!far&&packet;
      const bounds=detail?this.packetBounds.get(zone.id)?.bounds:(far?this.far:this.middle).get(zone.id).bounds;
      boundsTests++;
      if(!visible(bounds)){culledZones++;if(detail&&!this.near.has(zone.id))deferredNearUploads++;continue;}
      let r=(far?this.far:this.middle).get(zone.id);
      if(detail){
        r=this.near.get(zone.id);
        if(!r){const t=performance.now();r={packet,bounds,batch:new SharedIndustryBatch(this.gl,packet.vertices,facility.center)};this.near.set(zone.id,r);uploads+=packet.vertices.byteLength;uploadMs+=performance.now()-t;this.totals.nearUploads++;}
        else if(r.packet!==packet){const t=performance.now();uploads+=r.batch.replace(packet.vertices,origin);uploadMs+=performance.now()-t;r.packet=packet;r.bounds=bounds;this.totals.nearUploads++;}
      }
      const t=performance.now();uploads+=r.batch.rebase(origin);uploadMs+=performance.now()-t;r.batch.draw();drawCalls++;staticTriangles+=r.batch.count/3;
    }
    let motionVisible=false;
    if(distanceM<250){
      boundsTests++;motionVisible=visible(this.motionEnvelope);
      if(motionVisible){
        const motionKey=[state.processTime,state.routing,state.transition].join(':');
        if(!this.motion||this.motionKey!==motionKey){
          const t=performance.now(),data=movingGeometry(facility.config,state.processTime,state.routing,state.transition);motionPreparationMs=performance.now()-t;
          const u=performance.now();if(this.motion)uploads+=this.motion.replace(data,origin);else{this.motion=new SharedIndustryBatch(this.gl,data,facility.center);uploads+=data.byteLength;uploads+=this.motion.rebase(origin);}
          uploadMs+=performance.now()-u;this.motionKey=motionKey;this.totals.motionBuilds++;
        }else{const t=performance.now();uploads+=this.motion.rebase(origin);uploadMs+=performance.now()-t;}
        this.motion.draw();drawCalls++;motionTriangles=this.motion.count/3;
      }
    }
    this.last={distanceM,lod:far?'far':this.near.size?'near / middle':'middle fallback',residentZones:this.near.size,facilityCenter:[...facility.center],staticTriangles,motionTriangles,drawCalls,uploadBytes:uploads,uploadCpuMs:uploadMs,motionPreparationMs,displayPreparationMs:performance.now()-started,culling:this.culling,boundsTests,culledZones,deferredNearUploads,motionVisible,motionDeferred:distanceM<250&&!motionVisible,ownedGpuBufferBytes:this.bytes};
    return this.last;
  }
  inspect(){return {...this.last,startupPreparationMs:this.startupPreparationMs,ownedGpuBufferBytes:this.bytes,totals:{...this.totals},boundedPacketEntries:this.packetBounds.size,disposed:this.closed};}
  dispose(){
    if(this.closed)return;this.closed=true;const failures=[];
    for(const map of [this.near,this.middle,this.far]){for(const r of map.values())try{r.batch.dispose();}catch(error){failures.push(error);}map.clear();}
    this.packetBounds.clear();try{this.motion?.dispose();}catch(error){failures.push(error);}
    this.motion=null;this.motionKey=null;this.view=null;this.motionEnvelope=null;
    this.gl=null;this.facility=null;this.preparation=null;
    if(failures.length)throw new AggregateError(failures,'Industry display cleanup failed');
  }
}
