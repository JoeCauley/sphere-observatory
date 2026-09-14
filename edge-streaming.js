/* Preview residency: coarse coverage survives until its complete replacement is admitted. */
(function(root){
'use strict';const E=root.SphereEdges,S=root.SphereSites,M=root.SphereMath;
let prediction=null,criticalKeys=new Set();
let worker=null,failed=false,generation=0,revision=0,signature='',pending=null,wanted=new Set(),fine=[],coarse=[],state=null,lastCut=null;
const cache=new Map(),limited=new Set();let bytes=0,vertices=0,uploadMs=0,maxUploadMs=0,buildMs=0,cancelled=0,uploadBudgetMs=4;
function start(){
 if(worker||failed)return;
 try{worker=new Worker('edge-worker.js');worker.onmessage=({data})=>{
  if(data.generation!==generation){cancelled++;return;}
  if(data.error){fail(data.error);return;}pending=data;
 };worker.onerror=event=>{event.preventDefault();fail(event.message);};}catch(error){fail(String(error));}
}
function fail(message){failed=true;worker?.terminate();worker=null;pending=null;revision++;console.warn('Edge worker unavailable; using synchronous geometry:',message);}
function covers(parent,key){return parent===key||(parent.startsWith('rim:')&&key.startsWith(parent))||(parent.startsWith('shade:')&&parent.replace(/:far$/,':near')===key);}
function geometry(s){
 start();if(failed)return [...E.rimMeshes(s),...E.shadeMeshes(s)];
 const now=performance.now(),dt=prediction?Math.max(.001,(now-prediction.now)/1000):0,plates=root.SphereCollection.plates(s);
 // Bound the sweep of each actual moving parent frame. A time multiplier alone
 // cannot describe the different route radii, shapes and angular velocities.
 let prepare=0;if(prediction&&dt<1){const travel=M.length(M.sub(s.position,prediction.position))/dt;let parentSweep=0;
  for(const p of plates){const old=prediction.plates.find(q=>q.id===p.id);if(!old)continue;const sweep=s.radius*(M.length(M.sub(p.center,old.center))+p.size*((p.across||1)*M.length(M.sub(p.right,old.right))+M.length(M.sub(p.up,old.up))));parentSweep=Math.max(parentSweep,sweep/dt);}
  prepare=Math.min(E.readableRange(.18,s),Math.max(.12*(travel+parentSweep),(prediction.prepare||0)*Math.exp(-dt/.25)));
 }
 if(!prediction||now-prediction.now>8)prediction={now,position:s.position.slice(),plates,time:s.time,prepare};
 s={...s,_edgePrepareKm:prepare};state=s;
 // Capture uses the original deterministic generator. Preview planning is independent of mesh arrival.
 const cut=E.rimCut(s),retiringCut=lastCut?.key!==cut?.key?lastCut:null;lastCut=cut;
 const fineJobs=E.plan(s,E.viewWidth),coarseJobs=E.plan(s,E.viewWidth,{coarse:true}),nextFine=[...fineJobs.keys()],nextCoarse=[...coarseJobs.keys()];
 // At most four tiny coarse end neighbours seal the resident local wall even
 // before the worker starts. They participate in normal atomic replacement.
 // The player's floor/lip is already one synchronously prepared site mesh.
 // When the local patch retires (or changes address), fill its old interval in
 // the SAME frame. Waiting for a new uncut worker mesh would leave a slit.
 const restores=build=>retiringCut&&build.rimInterval?.[0]===retiringCut.index&&retiringCut.cuts.some(([a,b])=>build.rimInterval[1]<b&&build.rimInterval[2]>a);
 for(const [key,build]of coarseJobs)if((build.critical||restores(build))&&!cache.has(key)){
  const mesh=build();mesh.streamKey=key;mesh.bvh=S.packBVH(mesh.triangles);delete mesh.triangles;
  const size=mesh.vertices.byteLength+mesh.bvh.packedTriangles.byteLength+mesh.bvh.nodes.byteLength;
  cache.set(key,{mesh,bytes:size,critical:true});bytes+=size;vertices+=mesh.count;revision++;
 }
 const keys=[...new Set([...nextCoarse,...nextFine])],nextSignature=keys.join('|');
 fine=nextFine;coarse=nextCoarse;wanted=new Set(keys);criticalKeys=new Set([...fineJobs,...coarseJobs].filter(([,build])=>build.critical).map(([key])=>key));
 if(nextSignature!==signature){
  signature=nextSignature;limited.clear();generation++;if(pending){cancelled++;pending=null;}
  const priority=key=>coarseJobs.has(key)?coarseJobs.get(key).priority:fineJobs.get(key).priority*4+10;
  const missing=keys.filter(key=>!cache.has(key)).sort((a,b)=>priority(a)-priority(b));
  worker.postMessage({type:'plan',generation,state:{...s,_groundRimCut:E.rimCut(s)},width:E.viewWidth,keys:missing});
 }
 const selected=new Set(fine.filter(key=>cache.has(key)));
 // Use one coarse mesh over its whole interval until every requested child is available.
 for(const key of coarse){const children=fine.filter(child=>covers(key,child));if(children.some(child=>!cache.has(child))&&cache.has(key)){for(const child of children)selected.delete(child);selected.add(key);}}
 // A previously displayed parent also covers an approaching finer split.
 for(const key of cache.keys())if(key.startsWith('rim:')&&!selected.has(key)){
  const children=fine.filter(child=>covers(key,child));if(children.length&&children.some(child=>!cache.has(child))&&![...selected].some(parent=>covers(parent,key))){for(const child of [...selected])if(covers(key,child))selected.delete(child);selected.add(key);}
 }
 const out=[];
 for(const key of selected){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);const plate=Number.isInteger(entry.mesh.parentId)?plates.find(p=>p.id===entry.mesh.parentId):E.plateFor(s);out.push(entry.mesh.canonicalOrigin&&plate?E.transformMesh(entry.mesh,plate):entry.mesh);}
 trim();return out;
}
function trim(){
 // Prefer evicting old travel regions; enforce a hard cap even for extreme view budgets.
 for(const [key,entry]of cache){if(bytes<=192*1048576&&vertices<=3000000&&cache.size<=1200)break;if(wanted.has(key))continue;evict(key,entry);}
 while(bytes>192*1048576||vertices>3000000||cache.size>1200){const candidate=[...cache].find(([key,entry])=>!entry.critical||!wanted.has(key));if(!candidate)break;evict(...candidate);}
}
function evict(key,entry){if(wanted.has(key))limited.add(key);cache.delete(key);bytes-=entry.bytes;vertices-=entry.mesh.count;revision++;}
function pump(upload){
 uploadMs=0;const groundStart=performance.now();root.SphereGround?.pump(mesh=>{const remaining=uploadBudgetMs-(performance.now()-groundStart);return remaining>0&&upload(mesh,remaining);});uploadMs=performance.now()-groundStart;maxUploadMs=Math.max(maxUploadMs,uploadMs);if(uploadMs>=uploadBudgetMs||!pending)return;
 const packet=pending;
 if(wanted.has(packet.key)){
  const mesh=packet.hydrated||(packet.hydrated=Object.assign(Object.create(S.Mesh.prototype),packet.mesh)),start=performance.now();const complete=upload(mesh,Math.max(.01,uploadBudgetMs-(performance.now()-groundStart)));uploadMs=performance.now()-groundStart;maxUploadMs=Math.max(maxUploadMs,uploadMs);buildMs=packet.buildMs;if(!complete)return;
  const size=mesh.vertices.byteLength+mesh.bvh.packedTriangles.byteLength+mesh.bvh.nodes.byteLength;cache.set(packet.key,{mesh,bytes:size,critical:criticalKeys.has(packet.key)});bytes+=size;vertices+=mesh.count;revision++;trim();
 }
 pending=null;worker?.postMessage({type:'next',generation});
}
function cancel(){if(!signature&&!pending)return;signature='';wanted.clear();limited.clear();fine=[];coarse=[];pending=null;lastCut=null;generation++;worker?.postMessage({type:'plan',generation,state:state||M.defaultState(),width:E.viewWidth,keys:[]});revision++;}
const api={geometry,pump,cancel,has(mesh){return cache.get(mesh.streamKey)?.mesh===mesh||pending?.hydrated===mesh;},dispose(){worker?.terminate();worker=null;pending=null;cache.clear();bytes=vertices=0;prediction=null;signature='';wanted.clear();fine=[];coarse=[];lastCut=null;failed=false;},
 get revision(){return revision;},get needsFrame(){return !!root.SphereGround?.needsFrame||!failed&&(!!pending||[...wanted].some(key=>!cache.has(key)&&!limited.has(key)));},
 get uploadBudgetMs(){return uploadBudgetMs;},set uploadBudgetMs(value){uploadBudgetMs=Math.max(.25,Math.min(4,value));},
 get info(){return {worker:!!worker,failed,queue:[...wanted].filter(key=>!cache.has(key)&&!limited.has(key)).length,budgetLimited:limited.size,ready:pending?1:0,cache:cache.size,vertexMiB:vertices*44/1048576,collisionAndVertexMiB:bytes/1048576,uploadMs,maxUploadMs,uploadBudgetMs,buildMs,cancelled};}};
root.SphereEdgeStreaming=api;E.streaming=api;
})(window);
