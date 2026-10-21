import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {selection,createFacility,SEED} from '../packs/infinite-industry/1.0.0/facility.js';
import {buildZone,movingGeometry} from '../packs/infinite-industry/1.0.0/geometry.js';
import {createReference} from '../packs/shared-world/1.1.0/reference.js';
import {cameraBasis,renderOrigin} from '../packs/infinite-meadow/1.0.0/coordinates.js';
import {IndustryDisplay} from '../packs/shared-world/1.1.0/industry-display.js';
import {vertexBounds,motionBounds,cameraView,boundsVisible} from '../packs/shared-world/1.1.0/industry-visibility.js';
import {readCheckpoint,writeCheckpoint} from '../packs/shared-world/1.1.0/host.js';
import {readCheckpoint as readOriginalCheckpoint,writeCheckpoint as writeOriginalCheckpoint} from '../packs/shared-world/1.0.0/host.js';
import {initialState,saveState,parseState} from '../packs/shared-world/1.1.0/navigation.js';

const groups=[],check=(name,detail={})=>groups.push({name,...detail}),hash=a=>createHash('sha256').update(a).digest('hex');
const inside=(data,b)=>{assert(b);for(let i=0;i<data.length;i+=9)for(let k=0;k<3;k++)assert(data[i+k]>=b.min[k]&&data[i+k]<=b.max[k],`vertex ${i/9} axis ${k} outside envelope`);};
let staticCases=0,motionCases=0,vertices=0;
for(const width of [40,100,150,300,1000])for(let orientation=0;orientation<6;orientation++)for(const model of [0,1]){
  const config=selection(SEED,{q:0,r:0},{acrossFlatsM:width,orientation,model});
  for(const zone of createFacility(config).zones)for(const lod of ['near','middle','far']){const data=buildZone(config,zone.id,lod);inside(data,vertexBounds(data));staticCases++;vertices+=data.length/9;}
  const envelope=motionBounds(config);for(const time of [0,.013,1,7.317,41.8879,1e6])for(const routing of ['distribution','recovery'])for(const transition of [0,.5,1]){inside(movingGeometry(config,time,routing,transition),envelope);motionCases++;}
}
for(const address of [{q:1000000,r:2000000},{q:-1000000,r:2000000}])for(let orientation=0;orientation<6;orientation++){
 const config=selection(SEED,address,{orientation});for(const time of [0,11.37])for(const routing of ['distribution','recovery']){inside(movingGeometry(config,time,routing,.73),motionBounds(config));motionCases++;}
}
check('Complete actual static buffers enclosed; analytic all-phase motion envelope checked against supported extremes and large addresses',{staticCases,motionCases,vertices});
assert.equal(vertexBounds(new Float32Array([NaN,0,0,0,0,0,0,0,0])),null);
assert.equal(motionBounds({...selection(),artRevision:'unknown'}),null);
assert.equal(boundsVisible(null,[0,0],null),true);
check('Unknown/invalid bounds fail open');

// Independent homogeneous triangle clipping oracle. It emulates the pinned
// vertex shader float32 arithmetic; it does not use the culler's plane formulas.
const f=Math.fround,dot=(a,b)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
function projected(data,anchor,pose,origin,width,height){
 const b=cameraBasis(pose),camera=[pose.eastM-origin.eastM,pose.altitudeM,pose.northM-origin.northM].map(f),basis=[b.right,b.up,b.forward].map(v=>v.map(f)),scale=f(1.428148),aspect=f(width/height),out=[];
 for(let i=0;i<data.length;i+=9){const p=[f(f(data[i]+anchor[0]-origin.eastM)-camera[0]),f(data[i+1]-camera[1]),f(f(data[i+2]+anchor[1]-origin.northM)-camera[2])],w=dot(p,basis[2]);out.push([f(f(dot(p,basis[0])*scale)/aspect),f(dot(p,basis[1])*scale),f(w-f(.1)),w]);}return out;
}
function triangleSurvives(points){
 let polygon=points;for(const plane of [v=>v[3]+v[0],v=>v[3]-v[0],v=>v[3]+v[1],v=>v[3]-v[1],v=>v[3]+v[2],v=>v[3]-v[2]]){
  const next=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane(a),db=plane(b);if(da>=0)next.push(a);if((da<0)!==(db<0)){const t=da/(da-db);next.push(a.map((v,k)=>v+(b[k]-v)*t));}}
  polygon=next;if(!polygon.length)return false;
 }return true;
}
let rejectedChecks=0;
const reference=createReference(),facility=reference.facility,anchor=facility.center;
for(const zone of facility.zones){const data=buildZone(facility.config,zone.id,'near'),bounds=vertexBounds(data);
 for(const [width,height]of [[1920,1080],[640,960]])for(const [de,dn]of [[0,180],[120,180],[-180,-30],[0,1]])for(const yaw of [0,.53,1.57,2.64,3.14159,4.73])for(const pitch of [-1.2,0,.9]){
  const pose={eastM:anchor[0]+de,northM:anchor[1]+dn,altitudeM:61,yaw,pitch},origin=renderOrigin(pose),view=cameraView(pose,width,height,origin);
  if(boundsVisible(bounds,anchor,view))continue;rejectedChecks++;const clips=projected(data,anchor,pose,origin,width,height);for(let i=0;i<clips.length;i+=3)assert(!triangleSurvives(clips.slice(i,i+3)),zone.id+' falsely rejected visible triangle');
 }
}
const cameraPose={eastM:anchor[0],northM:180,altitudeM:61,yaw:0,pitch:0},origin=renderOrigin(cameraPose),first=cameraView(cameraPose,1920,1080,origin);
assert.equal(boundsVisible({min:Array(3),max:Array(3)},anchor,first),true,'sparse bounds must fail open');
assert.equal(cameraView(cameraPose,1920,1080,origin,first),first);assert.notEqual(cameraView({...cameraPose,yaw:.01},1920,1080,origin,first),first);
check('Rejected actual geometry has no surviving triangle under independent float32 clipping; exact camera keys reuse and invalidate',{rejectedChecks});

class FakeGL{
 constructor(){this.ARRAY_BUFFER=1;this.DYNAMIC_DRAW=2;this.FLOAT=3;this.TRIANGLES=4;this.buffers=new Map();this.vaos=new Set();this.current=null;this.uploaded=0;this.drawn=0;this.peak=0;}
 createVertexArray(){const v={};this.vaos.add(v);return v;}createBuffer(){const b={};this.buffers.set(b,new Uint8Array());return b;}
 bindVertexArray(){}bindBuffer(t,b){this.current=b;}enableVertexAttribArray(){}vertexAttribPointer(){}
 bufferData(t,data){const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice();this.buffers.set(this.current,bytes);this.uploaded+=bytes.length;this.peak=Math.max(this.peak,this.bytes);}
 bufferSubData(t,at,data){const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);this.buffers.get(this.current).set(bytes,at);this.uploaded+=bytes.length;}
 drawArrays(){this.drawn++;}deleteBuffer(b){this.buffers.delete(b);}deleteVertexArray(v){this.vaos.delete(v);}get bytes(){return [...this.buffers.values()].reduce((n,b)=>n+b.byteLength,0);}
}
const gl=new FakeGL(),resident=new Map(facility.zones.slice(0,4).map(z=>[z.id,{vertices:buildZone(facility.config,z.id)}])),display=new IndustryDisplay(gl,facility,{resident});
const requests=['hall','yard','intake','gallery','storage','connections'],priorityPose={eastM:anchor[0]+120,northM:anchor[1]+180,altitudeM:61,yaw:1.4,pitch:0},ordered=display.prioritize(requests,priorityPose,1920,1080,renderOrigin(priorityPose));
assert.deepEqual(ordered.slice(0,4).slice().sort(),requests.slice(0,4).slice().sort());assert.deepEqual(ordered.slice(4),requests.slice(4));
const state={pose:{eastM:anchor[0],northM:anchor[1]+180,altitudeM:61,yaw:Math.PI,pitch:0},processTime:1,routing:'distribution',transition:1},dimensions={width:1920,height:1080};
const frame=()=>display.draw(state,{...dimensions,origin:renderOrigin(state.pose)});
const untouched=structuredClone(state),uploaded=gl.uploaded,hidden=frame();assert.equal(hidden.culledZones,6);assert.equal(hidden.uploadBytes,0);assert.equal(gl.uploaded,uploaded);assert.equal(display.motion,null);assert.equal(display.near.size,0);assert.deepEqual(state,untouched);
state.pose.yaw=0;const shown=frame();assert.equal(shown.culledZones,0);assert.equal(display.near.size,4);assert.equal(display.totals.motionBuilds,1);assert.equal(frame().uploadBytes,0);
state.pose.yaw=Math.PI;state.processTime=35;state.routing='recovery';state.transition=.7;const before=gl.uploaded;assert(frame().motionDeferred);assert.equal(gl.uploaded,before);assert.equal(display.totals.motionBuilds,1);
state.pose.eastM+=90;state.pose.yaw=Math.atan2(90,-180);assert(frame().motionDeferred);assert.equal(gl.uploaded,before);
state.pose.yaw=Math.atan2(-90,180);frame();assert.equal(display.totals.motionBuilds,2);assert.equal(hash(display.motion.source),hash(movingGeometry(facility.config,35,'recovery',.7)));
for(const r of display.near.values()){const at=renderOrigin(state.pose),expected=r.batch.source.slice();for(let i=0;i<expected.length;i+=9){expected[i]=r.batch.source[i]+anchor[0]-at.eastM;expected[i+2]=r.batch.source[i+2]+anchor[1]-at.northM;}assert.deepEqual(gl.buffers.get(r.batch.buffer),new Uint8Array(expected.buffer));}
state.pose.yaw=Math.atan2(90,-180);const key='hall',replacement={vertices:buildZone({...facility.config,model:1-facility.config.model},key)};resident.set(key,replacement);const old=display.near.get(key).batch.buffer;const noUpload=gl.uploaded;frame();assert(!gl.buffers.has(old));assert.equal(gl.uploaded,noUpload);assert(!display.near.has(key));state.pose.yaw=Math.atan2(-90,180);frame();assert.equal(display.near.get(key).packet,replacement);
for(let i=0;i<64;i++){state.pose.yaw=i%2?0:Math.PI;state.processTime++;resident.set('yard',{vertices:resident.get('yard').vertices});frame();assert(display.packetBounds.size<=4);assert(display.near.size<=4);assert(gl.bytes<=25165824);}
display.dispose();display.dispose();assert.equal(gl.bytes,0);assert.equal(gl.vaos.size,0);assert.equal(display.packetBounds.size,0);assert.equal(display.gl,null);assert.equal(display.facility,null);assert.equal(display.preparation,null);assert.equal(display.inspect().ownedGpuBufferBytes,0);
check('Hidden graphics prepare zero uploads/motion; return refreshes current simulation once; origin/replacement and repeated retirement stay bounded',{peakFakeGpuBytes:gl.peak});

const world=createReference(),s=initialState(world,'meadow'),storage=new Map(),adapter={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
writeCheckpoint(adapter,s,s,saveState);assert.deepEqual(readOriginalCheckpoint(adapter,parseState,world).state,s);
writeOriginalCheckpoint(adapter,s,s,saveState);assert.deepEqual(readCheckpoint(adapter,parseState,world).state,s);
check('Original and successor read one another\'s exact saved-pose format');
const report={date:new Date().toISOString(),pass:true,groups,scope:'Source bounds, independent clipping oracle and instrumented GL ownership controls; native image/walking/performance qualification is separate.'};
if(process.env.SPHERE_INDUSTRY_DISPLAY_OUTPUT){if(fs.existsSync(process.env.SPHERE_INDUSTRY_DISPLAY_OUTPUT))throw Error('Select a fresh report path');fs.writeFileSync(process.env.SPHERE_INDUSTRY_DISPLAY_OUTPUT,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
