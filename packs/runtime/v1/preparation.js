// Bounded content preparation within PackHost; no clock, camera or GL owner.
export class ZonePreparation {
 constructor(url,{build,fallbacks,maxResident=4,maxPacketBytes=2097152}){
  this.build=build;this.fallbacks=fallbacks;this.maxResident=maxResident;this.maxPacketBytes=maxPacketBytes;this.resident=new Map();this.pending=null;this.generation=1;this.disposed=false;this.prepared=0;this.evicted=0;this.peakBytes=0;this.errors=[];this.lastBuildMs=0;this.history=[];
  this.worker=new Worker(url,{type:'module'});this.worker.onmessage=e=>this.receive(e.data);this.worker.onerror=e=>{this.errors.push(e.message);this.pending=null;};
 }
 receive(packet){if(this.disposed||packet.generation!==this.generation||packet.key!==this.pending)return;if(packet.error){this.errors.push(packet.error);this.pending=null;return;}
  const bytes=packet.vertices?.byteLength;if(!(packet.vertices instanceof Float32Array)||bytes>this.maxPacketBytes){this.errors.push('Invalid or over-budget zone packet');this.pending=null;return;}
  this.resident.set(packet.key,packet);this.lastBuildMs=packet.buildMs;this.history.push({key:packet.key,buildMs:packet.buildMs,bytes});if(this.history.length>128)this.history.shift();this.prepared++;this.pending=null;this.peakBytes=Math.max(this.peakBytes,this.bytes());
 }
 update(wanted){
  const keep=new Set(wanted.slice(0,this.maxResident)),removed=[];for(const key of this.resident.keys())if(!keep.has(key)){this.resident.delete(key);this.evicted++;removed.push(key);}
  if(this.pending&&!keep.has(this.pending)){this.generation++;this.pending=null;}
  if(!this.pending){const key=[...keep].find(k=>!this.resident.has(k));if(key){this.pending=key;this.worker.postMessage({generation:this.generation,key,build:this.build});}}
  return removed;
 }
 bytes(){return [...this.resident.values()].reduce((n,p)=>n+p.vertices.byteLength,0);}
 inspect(){return {residentZones:this.resident.size,maximumZones:this.maxResident,pending:this.pending,prepared:this.prepared,evicted:this.evicted,bytes:this.bytes(),peakBytes:this.peakBytes,workerReservationBytes:this.maxPacketBytes,lastBuildMs:this.lastBuildMs,builds:[...this.history],errors:[...this.errors],disposed:this.disposed};}
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this.worker.terminate();this.worker.onmessage=this.worker.onerror=null;this.pending=null;this.resident.clear();}
}
