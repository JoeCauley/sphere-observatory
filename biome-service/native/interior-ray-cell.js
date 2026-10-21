/* Complete CPU ray-box ownership against canonical half-open cube cells.
 * These certificates do not admit a native viewport, fragment or arrival. */
(function(root){'use strict';
const node=typeof module!=='undefined',I=root.SphereBiomeIntervals||(node?require('../intervals.js'):null),H=root.SphereBiomeInteriorRayHalfspace||(node?require('./interior-ray-halfspace.js'):null),A=root.SphereWorldAddress||(node?require('../../world-address.js'):null),X=root.SphereBiomeSpatialIndex||(node?require('../spatial-index.js'):null),Q=root.SphereBiomeMetadataBudget||(node?require('../metadata-budget.js'):null),S=root.SphereBiomeNativeSourceAdmission||(node?require('./source-admission.js'):null);
const PROFILE='sphere-interior-ray-cell-b192-v1',INDEX_PROFILE='sphere-interior-spbx-ray-box-b192-v1',HIGH=0x80000000,WORK_BYTES=262144;
function fail(code,message,details={}){throw Object.assign(Error(message),{code,phase:'interior-ray-cell',details});}
function data(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'))||Object.keys(v).sort().join('|')!==keys.slice().sort().join('|'))fail('INVALID_INPUT','Exact ordinary own-data fields required');}
function dense(v,n){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==n||Reflect.ownKeys(v).length!==n+1)fail('INVALID_INPUT','Exact dense ordinary arrays required');for(let k=0;k<n;k++)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(k))||{},'value'))fail('INVALID_INPUT','Array getters and holes refuse');return v;}
function cell(v){data(v,['face','level','x','y']);if(![v.face,v.level,v.x,v.y].every(Number.isSafeInteger)||v.face<0||v.face>5||v.level<0||v.level>30||v.x<0||v.y<0||v.x>=2**v.level||v.y>=2**v.level)fail('INVALID_INPUT','Exact legal level0-30 canonical cell required');return v;}
function rayInput(camera,rayBounds){dense(camera,3);dense(rayBounds,3);if(!camera.every(Number.isFinite))fail('INVALID_INPUT','Finite exact binary64 eye required');for(const v of rayBounds){dense(v,2);if(!v.every(Number.isFinite)||v[0]>v[1])fail('INVALID_INPUT','Finite ordered complete ray bounds required');}}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const clean=v=>v===0?0:v;
function constraints(c){
 const f=A.faces[c.face],axis=Math.floor(c.face/2),n=f.normal,planes=[{id:'positive-face-denominator',plane:n.slice(),strict:true}],size=2**c.level;
 // Canonical face ties prefer X, then Y, then Z, for both axis signs.
 for(let other=0;other<3;other++)if(other!==axis)for(const sign of [-1,1])planes.push({id:'face-'+other+'-'+sign,plane:n.map((v,k)=>clean(v-(k===other?sign:0))),strict:other<axis});
 for(const [name,index,tangent]of [['x',c.x,f.u],['y',c.y,f.v]]){
  const lower=-1+2*index/size,upper=-1+2*(index+1)/size;
  planes.push({id:name+'-lower',plane:tangent.map((v,k)=>clean(v-lower*n[k])),strict:false});
  // +1 is the canonical final cell endpoint; internal upper edges are open.
  planes.push({id:name+'-upper',plane:n.map((v,k)=>clean(upper*v-tangent[k])),strict:index!==size-1});
 }
 return planes;
}
function classify(input){
 data(input,['camera','rayBounds','cell']);rayInput(input.camera,input.rayBounds);const c=cell(input.cell),checks=[];let unknown=false;
 for(const p of constraints(c)){
  const proof=H.classify({camera:input.camera,rayBounds:input.rayBounds,plane:p.plane});
  const accepted=proof.sign===1||proof.sign===0&&!p.strict,rejected=proof.sign===-1||proof.sign===0&&p.strict;
  checks.push({id:p.id,plane:p.plane,strict:p.strict,relation:proof.classification,accepted,rejected,proof});
  if(rejected)return freeze({format:'sphere-interior-ray-cell-proof/1',profile:PROFILE,cell:{...c},classification:'OUTSIDE',planeTests:checks.length,checks,scope:'COMPLETE_CPU_RAY_BOX_ONLY',nativeView:'UNQUALIFIED'});
  if(!accepted)unknown=true;
 }
 return freeze({format:'sphere-interior-ray-cell-proof/1',profile:PROFILE,cell:{...c},classification:unknown?'UNKNOWN':'INSIDE',planeTests:checks.length,checks,scope:'COMPLETE_CPU_RAY_BOX_ONLY',nativeView:'UNQUALIFIED'});
}
function classifyPerspective(input){
 data(input,['camera','forward','right','up','screenX','screenY','cell']);const c=cell(input.cell),checks=[];let unknown=false;
 for(const p of constraints(c)){
  const proof=H.classifyPerspective({camera:input.camera,forward:input.forward,right:input.right,up:input.up,screenX:input.screenX,screenY:input.screenY,plane:p.plane}),accepted=proof.sign===1||proof.sign===0&&!p.strict,rejected=proof.sign===-1||proof.sign===0&&p.strict;
  checks.push({id:p.id,plane:p.plane,strict:p.strict,relation:proof.classification,accepted,rejected,proof});
  if(rejected)return freeze({format:'sphere-interior-perspective-cell-proof/1',profile:PROFILE,cell:{...c},classification:'OUTSIDE',planeTests:checks.length,checks,scope:'COMPLETE_CPU_AFFINE_PERSPECTIVE_DOMAIN_ONLY',nativeView:'UNQUALIFIED'});
  if(!accepted)unknown=true;
 }
 return freeze({format:'sphere-interior-perspective-cell-proof/1',profile:PROFILE,cell:{...c},classification:unknown?'UNKNOWN':'INSIDE',planeTests:checks.length,checks,scope:'COMPLETE_CPU_AFFINE_PERSPECTIVE_DOMAIN_ONLY',nativeView:'UNQUALIFIED'});
}
function proveIndex(input,affine){
 const domainKeys=affine?['camera','forward','right','up','screenX','screenY']:['camera','rayBounds'];
 data(input,['indexHandle','metadataOwner',...domainKeys,'maximumCellVisits']);
 const indexHandle=input.indexHandle,metadataOwner=input.metadataOwner;
 if(!Q.isOwner(metadataOwner))fail('FOREIGN_OWNER','Authentic Q must admit CPU proof work');
 const maximum=input.maximumCellVisits;if(!Number.isSafeInteger(maximum)||maximum<1||maximum>262144)fail('INVALID_INPUT','An explicit bounded complete-tree cell-visit quota is required');
 const work=metadataOwner.reserve(WORK_BYTES,{owner:'biome-interior-ray-cell',phase:'complete-tree-proof-work'});
 let owned,copy,retained;const release=()=>{retained?.charge.release();copy?.release();owned?.charge.release();};
 try{
  owned=S.buildRecord(()=>Object.fromEntries(domainKeys.map(k=>[k,input[k]])),{metadataOwner,label:'biome-interior-ray-cell',phase:'owned-ray-domain',maxBytes:2048,maxNodes:64});
  if(!affine)rayInput(owned.value.camera,owned.value.rayBounds);
  // Validity of a ray and strict interior eye is independent of which cell wins.
  if(affine)H.classifyPerspective({...owned.value,plane:[1,0,0]});else H.classify({...owned.value,plane:[1,0,0]});
  const observation=X.inspect(indexHandle);if(observation.disposed)fail('INDEX_DISPOSED','Exact admitted ownership index is disposed');
  copy=X.copyBytes(indexHandle);const bytes=copy.bytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),descriptor=observation.descriptor;
  if(bytes.length!==40+descriptor.nodeCount*16||descriptor.nodeCount<7||descriptor.nodeCount>262144||descriptor.assignmentCount>128)fail('INVALID_INDEX','Actual admitted SPBX descriptor differs');
  const pending=[],possible=new Set();let cellVisits=0,planeTests=0,rejectedCells=0,possibleLeaves=0;
  for(let face=5;face>=0;face--)pending.push({face,level:0,x:0,y:0,ref:view.getUint32(16+face*4,true)});
  while(pending.length){
   if(cellVisits>=maximum)fail('VIEW_PROOF_QUOTA_EXHAUSTED','Full ray demand remains unproved; no cropped or partial certificate',{cellVisits,maximumCellVisits:maximum,remaining:pending.length});
   const p=pending.pop(),relation=(affine?classifyPerspective:classify)({...owned.value,cell:{face:p.face,level:p.level,x:p.x,y:p.y}});cellVisits++;planeTests+=relation.planeTests;
   if(relation.classification==='OUTSIDE'){rejectedCells++;continue;}
   if(p.ref===0||p.ref>=HIGH){const slot=p.ref===0?0:p.ref-HIGH;if(slot>descriptor.assignmentCount)fail('INVALID_INDEX','Actual assignment slot differs');possible.add(slot);possibleLeaves++;continue;}
   if(p.ref>=descriptor.nodeCount||p.level>=30)fail('INVALID_INDEX','Actual tree node/depth differs');
   for(let child=3;child>=0;child--)pending.push({face:p.face,level:p.level+1,x:p.x*2+(child&1),y:p.y*2+(child>>1),ref:view.getUint32(40+p.ref*16+child*4,true)});
  }
  if(!possible.size)fail('UNPROVEN_OWNERSHIP','Complete nonzero rays require at least one canonical owner');
  const owners=Array.from(possible).sort((a,b)=>a-b),proof={format:'sphere-interior-spbx-ray-box-proof/1',profile:INDEX_PROFILE,intervalProfile:I.PROFILE,indexDescriptor:descriptor,rayDomain:affine?'AFFINE_PERSPECTIVE_RECTANGLE':'CARTESIAN_BOX',...owned.value,maximumCellVisits:maximum,classification:owners.length===1?'HOMOGENEOUS':'UNKNOWN_DISTINCT_OWNERS_POSSIBLE',possibleAssignmentSlots:owners,ownerAssignmentSlot:owners.length===1?owners[0]:null,completeCanonicalCover:true,work:{cellVisits,planeTests,rejectedCells,possibleLeaves},scope:'DIRECTED_COMPLETE_CPU_RAY_DOMAIN_WITH_AUTHENTIC_SPBX_ONLY',actualViewport:'UNQUALIFIED',nativeArithmetic:'UNQUALIFIED',nativePixelError:'UNQUALIFIED',physicalReceivers:'UNQUALIFIED',visualCoverageReady:false};
  retained=S.ownRecord(proof,{metadataOwner,label:'biome-interior-ray-cell',phase:'retained-ray-box-proof',maxBytes:8192,maxNodes:128});
  let open=true;return Object.freeze({get proof(){if(!open)fail('STALE_LEASE','CPU proof was released');if(X.inspect(indexHandle).disposed)fail('INDEX_DISPOSED','CPU proof index is no longer live');return retained.value;},release(){if(!open)return false;release();open=false;return true;}});
 }catch(error){release();throw error;}finally{work.release();}
}
const api=Object.freeze({PROFILE,INDEX_PROFILE,WORK_BYTES,classify,classifyPerspective,proveIndexRayBox:input=>proveIndex(input,false),proveIndexPerspective:input=>proveIndex(input,true)});root.SphereBiomeInteriorRayCell=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
