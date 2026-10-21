/* Conservative guard reservations over exact retained footprints. No connector inference. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null),I=root.SphereBiomeIntervals||(typeof module!=='undefined'?require('./intervals.js'):null),G=root.SphereBiomeCellGeometry||(typeof module!=='undefined'?require('./cell-geometry.js'):null);
const PROFILE='sphere-guard-bvh-b192-v1',handles=new WeakMap();
function fail(code,message,details={}){throw new R.ServiceError(code,message,details,'reservations');}
function radius(snapshot){const r=snapshot?.validatedStaticWorldParameters?.radius*1000;if(!Number.isFinite(r)||r<=0||r>1e15)fail('INVALID_HOST_WORLD','Invalid guard radius');return r;}
function bounds(cell,guardM,radiusM){const halo=I.div(I.fromNumber(guardM),I.fromNumber(radiusM));return [[1,0,0],[0,1,0],[0,0,1]].flatMap(axis=>{const value=G.normalizedDotPatchInterval(cell,axis);return I.toNumbers([value[0]-halo[1],value[1]+halo[1]]);});}
function cap(cell,guardM,radiusM){const centre=G.centreDirection(cell),dot=G.normalizedDotPatchInterval(cell,centre),angle=I.add(I.acos([dot[0],dot[0]]),I.div(I.fromNumber(guardM),I.fromNumber(radiusM)));return {centre,radiusUpperRad:I.toNumbers(angle)[1]};}
function coreIntersects(a,b){if(a.face!==b.face)return false;const lo=a.level<=b.level?a:b,hi=a.level<=b.level?b:a,scale=2**(hi.level-lo.level);return Math.floor(hi.x/scale)===lo.x&&Math.floor(hi.y/scale)===lo.y;}
function separated(a,b){let dot=[0n,0n],aa=[0n,0n],bb=[0n,0n];for(let k=0;k<3;k++){dot=I.add(dot,I.mul(I.fromNumber(a.centre[k]),I.fromNumber(b.centre[k])));aa=I.add(aa,I.square(I.fromNumber(a.centre[k])));bb=I.add(bb,I.square(I.fromNumber(b.centre[k])));}dot=I.div(dot,I.sqrt(I.mul(aa,bb)));dot=[dot[0]<-I.SCALE?-I.SCALE:dot[0],dot[1]>I.SCALE?I.SCALE:dot[1]];const distance=I.acos(dot),sum=I.add(I.fromNumber(a.radiusUpperRad),I.fromNumber(b.radiusUpperRad));return distance[0]>sum[1];}
async function prepareReservations(assignments,snapshot,{maxCells=65536,maxRegions=128,oldPaddingByRegion={},signal}={}){
 if(!Array.isArray(assignments)||assignments.length>maxRegions||!Number.isInteger(maxCells)||maxCells<1||maxCells>65536||!Number.isInteger(maxRegions)||maxRegions<1||maxRegions>128)fail('INVALID_ASSIGNMENT','Reservation quota exceeded');
 const owned=R.clone(assignments),padding=R.clone(oldPaddingByRegion),radiusM=radius(snapshot),worldId=snapshot.worldId,geographyDigest=snapshot.hostGeographyDigest,trackProfileDigest=snapshot.trackProfileDigest,protectionProfileDigest=snapshot.protectionProfileDigest,hostProfileRef=R.clone(snapshot.hostProfileRef),records=[],regionIds=new Set();
 if(signal?.aborted)fail('CANCELLED','Reservation input verification cancelled',{chargedCpuBytes:0,boundCells:0,bvhNodes:0});
 if(!padding||Array.isArray(padding)||Object.getPrototypeOf(padding)!==Object.prototype||Object.values(padding).some(v=>!Number.isFinite(v)||v<0||v>1e9))fail('INVALID_ASSIGNMENT','Unknown retained clearance padding');
 for(const envelope of owned){if(signal?.aborted)fail('CANCELLED','Reservation input verification cancelled',{chargedCpuBytes:0,boundCells:0,bvhNodes:0});const body=await R.verifyEnvelope(envelope);R.validateStructural('assignment',body);if(body.worldId!==worldId||regionIds.has(body.regionId))fail('HOST_WORLD_MISMATCH','Reservation world/region identity differs');regionIds.add(body.regionId);const guardM=body.guardWidthM+(padding[body.regionId]??0);if(guardM>2e9)fail('RESOURCE_LIMIT','Retained expanded guard exceeds admitted guard plus clearance maximum');for(const cell of body.core.cells){if(records.length>=maxCells)fail('RESOURCE_LIMIT','Reservation cell quota exceeded');records.push({cell:G.validateCell({...cell,level:body.core.level}),guardM,assignmentDigest:envelope.digest,regionId:body.regionId});}}
 if(Object.keys(padding).some(regionId=>!regionIds.has(regionId)))fail('INVALID_ASSIGNMENT','Clearance padding names an absent retained region');
 records.sort((a,b)=>G.compareCells(a.cell,b.cell)|| (a.regionId<b.regionId?-1:a.regionId>b.regionId?1:0));
 for(let k=1;k<records.length;k++)if(G.compareCells(records[k-1].cell,records[k].cell)===0)fail('INVALID_ASSIGNMENT','Retained cores have duplicate ownership');
 const count=records.length,nodeCapacity=Math.max(2,2*count),leafBounds=new Float64Array(count*6),nodeBounds=new Float64Array(nodeCapacity*6),children=new Int32Array(nodeCapacity*2),order=new Uint32Array(count),caps=new Float64Array(count*4),cells=new Uint32Array(count*4);
 const chargedCpuBytes=leafBounds.byteLength+nodeBounds.byteLength+children.byteLength+order.byteLength+caps.byteLength+cells.byteLength;
 for(let k=0;k<count;k++){if(signal?.aborted)fail('CANCELLED','Reservation bound preparation cancelled',{chargedCpuBytes,boundCells:k,bvhNodes:0});order[k]=k;leafBounds.set(bounds(records[k].cell,records[k].guardM,radiusM),k*6);const c=cap(records[k].cell,records[k].guardM,radiusM);caps.set([...c.centre,c.radiusUpperRad],k*4);cells.set([records[k].cell.face,records[k].cell.level,records[k].cell.x,records[k].cell.y],k*4);if(k%32===31)await new Promise(resolve=>setTimeout(resolve,0));}
 let nextNode=1;
 function build(start,end){
  const node=nextNode++,box=Array.from({length:6},(_,k)=>k%2===0?Infinity:-Infinity);
  for(let j=start;j<end;j++){const ordinal=order[j];for(let k=0;k<6;k++)box[k]=k%2===0?Math.min(box[k],leafBounds[ordinal*6+k]):Math.max(box[k],leafBounds[ordinal*6+k]);}nodeBounds.set(box,node*6);
  if(end-start===1){children[node*2]=-1;children[node*2+1]=order[start];return node;}
  const spans=[box[1]-box[0],box[3]-box[2],box[5]-box[4]],axis=spans.indexOf(Math.max(...spans)),offset=axis*2;
  order.subarray(start,end).sort((a,b)=>(leafBounds[a*6+offset]+leafBounds[a*6+offset+1])-(leafBounds[b*6+offset]+leafBounds[b*6+offset+1])||a-b);
  const mid=start+Math.floor((end-start)/2);children[node*2]=build(start,mid);children[node*2+1]=build(mid,end);return node;
 }
 const rootNode=count?build(0,count):0,footprints=await R.envelope({format:'sphere-reservation-input/1',worldId,geographyDigest,trackProfileDigest,protectionProfileDigest,hostProfileRef,radiusM,oldPaddingByRegion:padding,assignments:owned.map(e=>({digest:e.digest,body:e.body}))});
 if(signal?.aborted)fail('CANCELLED','Reservation preparation cancelled before lease creation',{chargedCpuBytes,boundCells:count,bvhNodes:nextNode-1});
 const handle=Object.freeze({format:'sphere-reservation-index/1',profile:PROFILE,inputDigest:footprints.digest,worldId,geographyDigest,trackProfileDigest,protectionProfileDigest,hostProfileRef:Object.freeze(hostProfileRef),radiusM,cellCount:count,nodeCount:nextNode,chargedCpuBytes,accountingScope:'Owned index typed arrays; retained assignment records and engine heap require aggregate host accounting',work:Object.freeze({boundCells:count,capCells:count,bvhNodes:nextNode-1})});
 handles.set(handle,{records,leafBounds,nodeBounds,children,order,caps,cells,rootNode,footprints,disposed:false});return handle;
}
function context(index,snapshot){const data=handles.get(index);if(!data||data.disposed)fail('INVALID_RESERVATION_INDEX','Reservation lease unavailable');if(index.worldId!==snapshot.worldId||index.radiusM!==radius(snapshot)||index.geographyDigest!==snapshot.hostGeographyDigest||index.trackProfileDigest!==snapshot.trackProfileDigest||index.protectionProfileDigest!==snapshot.protectionProfileDigest||R.canonicalJSON(index.hostProfileRef)!==R.canonicalJSON(snapshot.hostProfileRef))fail('HOST_WORLD_MISMATCH','Guard index differs from retained world');return data;}
function overlaps(a,b,offset){for(let k=0;k<6;k+=2)if(a[k+1]<b[offset+k]||a[k]>b[offset+k+1])return false;return true;}
function kernel(cell,guardM,index,data,{maxNodeVisits=4096,signal}={}){
 if(!Number.isInteger(maxNodeVisits)||maxNodeVisits<1||maxNodeVisits>262144||!Number.isFinite(guardM)||guardM<0||guardM>2e9+1000)fail('INVALID_GEOMETRY_PROOF','Invalid reservation work/guard quota');
 const candidateBox=bounds(cell,guardM,index.radiusM),candidateCap=cap(cell,guardM,index.radiusM),stack=data.rootNode?[data.rootNode]:[],decisions=[];let nodeVisits=0,capChecks=0;
 while(stack.length){
  if(signal?.aborted)fail('CANCELLED','Reservation query cancelled',{nodeVisits,capChecks});
  if(nodeVisits>=maxNodeVisits)return {classification:'uncertain',reason:'reservation-proof-quota',work:{nodeVisits,capChecks}};
  const node=stack.pop();nodeVisits++;if(!overlaps(candidateBox,data.nodeBounds,node*6)){decisions.push({node,result:'aabb-disjoint'});continue;}
  const left=data.children[node*2],right=data.children[node*2+1];if(left!==-1){stack.push(right,left);continue;}
  const retained=data.records[right];if(coreIntersects(cell,retained.cell))return {classification:'ineligible',reason:'core-owned',assignmentDigest:retained.assignmentDigest,work:{nodeVisits,capChecks}};
  capChecks++;const start=right*4,retainedCap={centre:Array.from(data.caps.subarray(start,start+3)),radiusUpperRad:data.caps[start+3]};
  if(!separated(candidateCap,retainedCap))return {classification:'uncertain',reason:'guard-separation-unproven',assignmentDigest:retained.assignmentDigest,work:{nodeVisits,capChecks}};
  decisions.push({node,result:'caps-disjoint'});
 }
 return {classification:'eligible',work:{nodeVisits,capChecks},decisions,candidateBounds:candidateBox,conservativeCap:candidateCap};
}
async function certifyReservations(cell,guardM,index,snapshot,quotas){cell=G.validateCell(cell);const data=context(index,snapshot);if(quotas?.signal?.aborted)fail('CANCELLED','Reservation query cancelled',{nodeVisits:0,capChecks:0});const result=kernel(cell,guardM,index,data,quotas);if(result.classification!=='eligible')return R.deepFreeze(result);const input=await R.envelope({format:'sphere-guard-proof-input/1',cell,guardM,indexInputDigest:index.inputDigest,worldId:index.worldId,maxNodeVisits:quotas?.maxNodeVisits??4096});context(index,snapshot);if(quotas?.signal?.aborted)fail('CANCELLED','Reservation query cancelled',result.work);const certificate=await R.envelope({format:'sphere-guard-proof/1',profile:PROFILE,proofInputDigest:input.digest,cell,guardM,indexInputDigest:index.inputDigest,worldId:index.worldId,...result});context(index,snapshot);if(quotas?.signal?.aborted)fail('CANCELLED','Reservation query cancelled',result.work);return R.deepFreeze({classification:'eligible',certificate,proofInput:input,work:result.work});}
async function verifyReservations(envelope,cell,guardM,index,snapshot,quotas){envelope=R.clone(envelope);cell=R.clone(cell);snapshot=R.clone(snapshot);const signal=quotas?.signal;quotas=quotas?{...R.clone(Object.fromEntries(Object.entries(quotas).filter(([k])=>k!=='signal'))),signal}:undefined;await R.verifyEnvelope(envelope);const expected=await certifyReservations(cell,guardM,index,snapshot,quotas);if(expected.classification!=='eligible'||expected.certificate.digest!==envelope.digest)fail('INVALID_GUARD_PROOF','Reservation certificate differs from recomputed guard/index');return true;}
function inspect(index){const data=handles.get(index);if(!data)fail('INVALID_RESERVATION_INDEX','Unknown reservation index');return {disposed:data.disposed,chargedCpuBytes:data.disposed?0:index.chargedCpuBytes,cellCount:index.cellCount,nodeCount:index.nodeCount,inputDigest:index.inputDigest};}
function dispose(index){const data=handles.get(index);if(!data||data.disposed)return {releasedCpuBytes:0,idempotent:true};data.disposed=true;for(const key of ['records','leafBounds','nodeBounds','children','order','caps','cells','footprints'])data[key]=null;return {releasedCpuBytes:index.chargedCpuBytes,idempotent:false};}
const api=Object.freeze({PROFILE,prepareReservations,certifyReservations,verifyReservations,inspect,dispose});root.SphereBiomeReservations=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
