import assert from 'node:assert/strict';
import {IndustryDisplay} from '../packs/shared-world/1.1.0/industry-display.js';
import {vertexBounds,cameraView,boundsVisible} from '../packs/shared-world/1.1.0/industry-visibility.js';
import {createReference} from '../packs/shared-world/1.1.0/reference.js';
import {buildZone} from '../packs/infinite-industry/1.0.0/geometry.js';
import {renderOrigin} from '../packs/infinite-meadow/1.0.0/coordinates.js';
import {ZonePreparation} from '../packs/runtime/v1/preparation.js';
const facility=createReference().facility,display=Object.create(IndustryDisplay.prototype);
Object.assign(display,{facility,culling:true,closed:false,view:null,middle:new Map(facility.zones.map(z=>[z.id,{bounds:vertexBounds(buildZone(facility.config,z.id,'middle'))}]))});
const wanted=['intake','hall','gallery','yard','storage','connections'];let pose=null;
for(let i=0;i<72;i++){const p={eastM:facility.center[0]+108,northM:facility.center[1]-49,altitudeM:49.7,yaw:i*Math.PI/36,pitch:.04},view=cameraView(p,1575,1616,renderOrigin(p)),flags=wanted.slice(0,4).map(id=>boundsVisible(display.middle.get(id).bounds,facility.center,view));if(!flags[0]&&flags.some(Boolean)){pose=p;break;}}
assert(pose,'fixture must exercise an actual visible/hidden priority difference');
const ordered=display.prioritize(wanted,pose,1575,1616,renderOrigin(pose));assert.notDeepEqual(ordered,wanted);assert.deepEqual(ordered.slice(0,4).slice().sort(),wanted.slice(0,4).slice().sort());assert.deepEqual(ordered.slice(4),wanted.slice(4));
const view=cameraView(pose,1575,1616,renderOrigin(pose)),flags=ordered.slice(0,4).map(id=>boundsVisible(display.middle.get(id).bounds,facility.center,view));assert(!flags.slice(flags.indexOf(false)).some(Boolean),'visible work must precede hidden work');
const previous=globalThis.Worker;class FixtureWorker{constructor(){this.messages=[];}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}}
globalThis.Worker=FixtureWorker;let queue;
try{
 queue=new ZonePreparation('fixture',{build:facility.config,maxResident:4,maxPacketBytes:1024});queue.update(ordered);const pending=queue.pending,generation=queue.generation;
 const turned={...pose,yaw:pose.yaw+Math.PI},afterTurn=display.prioritize(wanted,turned,1575,1616,renderOrigin(turned));queue.update(afterTurn);
 assert.equal(queue.pending,pending);assert.equal(queue.generation,generation);assert.equal(queue.worker.messages.length,1);
 for(let i=0;i<4;i++){const key=queue.pending;assert(key);queue.receive({generation:queue.generation,key,vertices:new Float32Array(9),buildMs:1});queue.update(afterTurn);}
 assert.equal(queue.pending,null);assert.deepEqual([...queue.resident.keys()].sort(),wanted.slice(0,4).slice().sort());
 queue.dispose();assert(queue.worker.terminated);assert.equal(queue.resident.size,0);
}finally{queue?.dispose();globalThis.Worker=previous;}
console.log(JSON.stringify({pass:true,groups:3,scope:'Actual fallback visibility orders real preparation without changing required residency, cancelling a turn-time job or dropping hidden requests.'}));
