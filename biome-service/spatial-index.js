/* Fixed SPBX ownership. Complete symbolic footprint verification precedes lookup admission. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const PROFILE='sparse-face-tree-u32-v1',CONSTRUCTION='sphere-spbx-partition-preorder-v1',MAX_NODES=262144,MAX_CELLS=65536,MAX_ASSIGNMENTS=128,MAX_METADATA_BYTES=33554432,HEADER_BYTES=40,NODE_BYTES=16,HIGH=0x80000000,FULL=1n<<60n;
const SOURCE_PATHS=Object.freeze(['biome-service/records.js','biome-service/schema-validators.js','biome-service/spatial-index.js','world-address.js','world-topology.js']);
const handles=new WeakMap();let aggregateHeldBytes=0,aggregatePeakBytes=0;
const ascii=(a,b)=>a<b?-1:a>b?1:0,encoder=new TextEncoder();
function fail(code,message,details={}){throw new R.ServiceError(code,message,details,'spatial-index');}
function abort(signal){if(signal?.aborted)throw new DOMException('Spatial index preparation cancelled','AbortError');}
function integer(value,name,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)fail('INVALID_INDEX','Invalid bounded '+name,{value,min,max});return value;}
async function buildProfile(readSource,{hostProfileEnvelope}={}){
 if(typeof readSource!=='function')fail('UNSUPPORTED_INDEX_PROFILE','Exact index source closure verification is required');hostProfileEnvelope=R.deepFreeze(R.clone(hostProfileEnvelope));const host=await R.verifyEnvelope(hostProfileEnvelope);
 if(host.format!=='sphere-observatory-host-profile/1'||typeof host.id!=='string'||!host.numericQualification?.digest||!Array.isArray(host.closure))fail('UNSUPPORTED_INDEX_PROFILE','Exact inherited host source and numeric profiles are required');
 await R.verifyEnvelope(host.numericQualification);const closure=[];for(const path of SOURCE_PATHS){const bytes=await readSource(path);if(!(bytes instanceof Uint8Array)||!bytes.length)fail('UNSUPPORTED_INDEX_PROFILE','Index dependency source is unavailable',{path});const entry={path,bytes:bytes.length,sha256:await R.sha256(bytes)},inherited=host.closure.find(v=>v.path===path);if(path!=='biome-service/spatial-index.js'&&(!inherited||R.canonicalJSON(entry)!==R.canonicalJSON(inherited)))fail('INDEX_PROFILE_MISMATCH','Index dependency differs from its inherited exact host source',{path});closure.push(entry);}
 return R.envelope({format:'sphere-spatial-index-source-profile/1',id:CONSTRUCTION,binaryProfile:PROFILE,hostProfileRef:{id:host.id,digest:hostProfileEnvelope.digest},numericQualificationDigest:host.numericQualification.digest,closure,construction:{roots:'six-distinct-preallocated-face-order-v1',nodes:'roots-then-quadrant-preorder-v1',collapse:'four-identical-leaves-v1',children:'xBit+2*yBit-msb-first-v1'},verification:{membership:'independent-low-bit-dyadic-union-v1',graph:'acyclic-uniform-summary-v1',sharedRootsAndSubgraphs:true},limits:{nodes:MAX_NODES,cells:MAX_CELLS,assignments:MAX_ASSIGNMENTS,metadataBytes:MAX_METADATA_BYTES,lookupLevels:30}});
}
async function verifyProfile(envelope,readSource,{hostProfileEnvelope}={}){
 envelope=R.deepFreeze(R.clone(envelope));const body=await R.verifyEnvelope(envelope),expected=await buildProfile(readSource,{hostProfileEnvelope});if(envelope.digest!==expected.digest||R.canonicalJSON(body)!==R.canonicalJSON(expected.body))fail('INDEX_PROFILE_MISMATCH','Exact derived-index source profile differs');return expected;
}
function metadataBytes(value){
 const active=new Set();let nodes=0;
 function size(v,depth){if(depth>64||++nodes>2097152)fail('RESOURCE_LIMIT','Index input metadata is not bounded');if(v===null)return 8;if(typeof v==='number')return 8;if(typeof v==='boolean')return 4;if(typeof v==='string')return 24+v.length*2;if(!v||typeof v!=='object'||active.has(v))fail('INVALID_INDEX','Unsupported or cyclic index metadata');active.add(v);let bytes;
  if(Array.isArray(v)){if(Reflect.ownKeys(v).length!==v.length+1||Object.keys(v).length!==v.length)fail('INVALID_INDEX','Unsupported array metadata');bytes=32+v.length*8;for(let k=0;k<v.length;k++){const d=Object.getOwnPropertyDescriptor(v,String(k));if(!d||!('value'in d))fail('INVALID_INDEX','Accessor index metadata is forbidden');bytes+=size(d.value,depth+1);if(bytes>MAX_METADATA_BYTES)fail('METADATA_BUDGET_EXCEEDED','Index input metadata exceeds its conservative reservation');}}
  else{if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('INVALID_INDEX','Unsupported object metadata');const keys=Object.keys(v);if(Reflect.ownKeys(v).length!==keys.length)fail('INVALID_INDEX','Hidden metadata is forbidden');bytes=48;for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d))fail('INVALID_INDEX','Accessor index metadata is forbidden');bytes+=32+key.length*2+size(d.value,depth+1);if(bytes>MAX_METADATA_BYTES)fail('METADATA_BUDGET_EXCEEDED','Index input metadata exceeds its conservative reservation');}}
  active.delete(v);return bytes;
 }return size(value,0);
}
function accounting(reserveMetadata){
 if(reserveMetadata!==undefined&&typeof reserveMetadata!=='function')fail('INVALID_INDEX','Metadata admission must be synchronous');
 const leases=new Set(),phases=new Map();let held=0,peak=0;
 function reserve(bytes,phase){integer(bytes,'metadata reservation',0,Number.MAX_SAFE_INTEGER);if(aggregateHeldBytes+bytes>MAX_METADATA_BYTES)fail('METADATA_BUDGET_EXCEEDED','All current, staging, retiring and copied indexes exceed the service reservation',{heldBytes:aggregateHeldBytes,requestedBytes:bytes,limit:MAX_METADATA_BYTES});let shared=null;if(reserveMetadata){shared=reserveMetadata(bytes,{owner:'biome-spatial-index',phase});if(!shared||typeof shared.release!=='function'||typeof shared.then==='function')fail('INVALID_INDEX','Metadata admission must return a synchronous releasable lease');}
  held+=bytes;aggregateHeldBytes+=bytes;peak=Math.max(peak,held);aggregatePeakBytes=Math.max(aggregatePeakBytes,aggregateHeldBytes);phases.set(phase,(phases.get(phase)||0)+bytes);let released=false;
  const lease={release(){if(released)return;released=true;leases.delete(lease);held-=bytes;aggregateHeldBytes-=bytes;phases.set(phase,phases.get(phase)-bytes);shared?.release();}};leases.add(lease);return lease;
 }
 return {reserve,closeAdmission(){reserveMetadata=null;},releaseAll(){for(const lease of [...leases])lease.release();},inspect:()=>({heldBytes:held,peakBytes:peak,aggregateHeldBytes,aggregatePeakBytes,phases:Object.fromEntries(phases),measurement:'CONSERVATIVE_LOGICAL_RESERVATION_NOT_NATIVE_HEAP'})};
}
function optionsContext(options={}){
 const {hostAdapter,snapshot,reserveMetadata,signal,yieldWork,readSource}=options;
 if(!hostAdapter?.metadata||!hostAdapter?.canonicalizeShellAddress||!hostAdapter?.retainedInputs||!snapshot||!Object.isFrozen(snapshot))fail('UNVERIFIED_HOST_WORLD','An exact admitted host adapter and opaque verified snapshot are required');
 if(!options.profileEnvelope||typeof readSource!=='function')fail('UNSUPPORTED_INDEX_PROFILE','A pinned exact derived-index source profile is required');
 const account=accounting(reserveMetadata);try{const contextLease=account.reserve(4096,'resident-context'),scratchLease=account.reserve(65536,'preparation-scratch'),metadata=R.deepFreeze(R.clone(hostAdapter.metadata(snapshot)));R.validateStructural('host-world',snapshot);abort(signal);
  if(yieldWork!==undefined&&typeof yieldWork!=='function')fail('INVALID_INDEX','Host work-yield adapter must be callable');
  const profileLease=account.reserve(metadataBytes(options.profileEnvelope)*4,'owned-index-source-profile'),profileEnvelope=R.deepFreeze(R.clone(options.profileEnvelope));return {hostAdapter,snapshot,metadata,signal,yieldWork,readSource,profileEnvelope,profileLease,maxNodes:integer(options.maxNodes??MAX_NODES,'node quota',2,MAX_NODES),maxCells:integer(options.maxCells??MAX_CELLS,'cell quota',0,MAX_CELLS),maxAssignments:integer(options.maxAssignments??MAX_ASSIGNMENTS,'assignment quota',0,MAX_ASSIGNMENTS),account,contextLease,scratchLease,expectedDescriptor:options.expectedDescriptor===undefined?null:R.deepFreeze(R.clone(options.expectedDescriptor)),work:{assignmentRecords:0,footprintCells:0,independentUnionCells:0,buildPartitions:0,structuralWords:0,symbolicPartitions:0,hashBytes:0,yields:0,lookupDescents:0}};
 }catch(error){account.releaseAll();throw error;}
}
async function yieldNow(ctx){abort(ctx.signal);ctx.work.yields++;if(ctx.yieldWork)await ctx.yieldWork({owner:'biome-spatial-index',work:R.deepFreeze(R.clone(ctx.work))});else await new Promise(resolve=>setTimeout(resolve,0));abort(ctx.signal);}
async function admitProfile(ctx){const hostProfileEnvelope=ctx.hostAdapter.retainedInputs(ctx.snapshot).host,entries=ctx.profileEnvelope.body?.closure;if(!Array.isArray(entries)||entries.length!==SOURCE_PATHS.length||entries.some(v=>!Number.isSafeInteger(v.bytes)||v.bytes<1||v.bytes>16777216))fail('UNSUPPORTED_INDEX_PROFILE','Exact bounded source closure is required');const maximum=Math.max(...entries.map(v=>v.bytes)),lease=ctx.account.reserve(maximum*3,'source-read-owned-copy-and-hash');try{const profile=await verifyProfile(ctx.profileEnvelope,async path=>{abort(ctx.signal);const source=await ctx.readSource(path);abort(ctx.signal);if(!(source instanceof Uint8Array)||source.length>maximum)fail('UNSUPPORTED_INDEX_PROFILE','Exact source reader exceeded its verified byte bound');const owned=Uint8Array.from(source);ctx.work.hashBytes+=owned.length;return owned;},{hostProfileEnvelope});if(R.canonicalJSON(profile.body.hostProfileRef)!==R.canonicalJSON(ctx.snapshot.hostProfileRef))fail('INDEX_PROFILE_MISMATCH','Derived index profile requires a different exact host');ctx.admittedProfile=profile;abort(ctx.signal);}finally{lease.release();}}
function morton(x,y,level){let result=0n;for(let k=level-1;k>=0;k--)result=(result<<2n)|BigInt((Math.floor(x/2**k)%2)+2*(Math.floor(y/2**k)%2));return result;}
function runAt(runs,at){let lo=0,hi=runs.length;while(lo<hi){const mid=(lo+hi)>>>1;if(runs[mid].end<=at)lo=mid+1;else hi=mid;}return lo;}
function uniformRange(runs,start,end){const k=runAt(runs,start),run=runs[k];return run&&run.start<=start&&run.end>=end?run.slot:-1;}
async function prepareAssignments(input,ctx){
 if(!Array.isArray(input)||input.length>ctx.maxAssignments)fail('RESOURCE_LIMIT','Index assignment quota exceeded');
 const estimate=metadataBytes(input),inputLease=ctx.account.reserve(estimate*4,'owned-assignments-and-record-verification'),owned=R.deepFreeze(R.clone(input));
 const table=[],intervals=Array.from({length:6},()=>[]),regionIds=new Set();let total=0;
 try{
  const assignments=[];for(const envelope of owned){abort(ctx.signal);const body=await R.verifyEnvelope(envelope);ctx.work.hashBytes+=encoder.encode('sphere-service-record/1\n').length+R.canonicalBytes(body).length;R.validateAssignment(body);ctx.work.assignmentRecords++;if(body.worldId!==ctx.snapshot.worldId||body.frame.origin.worldSeed!==ctx.snapshot.worldSeed)fail('INDEX_WORLD_MISMATCH','Assignment belongs to a different retained world');
   for(const key of ['trackProfileDigest','protectionProfileDigest'])if(body.eligibility[key]!==ctx.snapshot[key])fail('INDEX_WORLD_MISMATCH','Assignment geometry input identity differs',{key});
   if(regionIds.has(body.regionId))fail('INVALID_INDEX','Duplicate assignment region identity');regionIds.add(body.regionId);if(total+body.core.cells.length>ctx.maxCells)fail('RESOURCE_LIMIT','Index footprint cell quota exceeded');total+=body.core.cells.length;assignments.push({digest:envelope.digest,body});
  }
  assignments.sort((a,b)=>ascii(a.body.regionId,b.body.regionId));const intervalLease=ctx.account.reserve(total*512+6*192,'footprint-intervals-and-independent-union'),tableLease=ctx.account.reserve(assignments.length*256+64,'resident-assignment-table');
  try{
   for(let i=0;i<assignments.length;i++){const {body,digest}=assignments[i];table.push({regionId:body.regionId,assignmentDigest:digest});const level=body.core.level,shift=BigInt(2*(30-level)),length=1n<<shift;for(const cell of body.core.cells){const start=morton(cell.x,cell.y,level)<<shift;intervals[cell.face].push({start,end:start+length,slot:i+1});ctx.work.footprintCells++;if((ctx.work.footprintCells&1023)===0)await yieldNow(ctx);}}
   for(const face of intervals){face.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);for(let i=1;i<face.length;i++)if(face[i].start<face[i-1].end)fail('OVERLAPPING_ASSIGNMENTS','Exact mixed-level assignment footprints overlap');}
   // Independent expected ownership includes every base gap and merges only equal owners.
   function completeRuns(faces){return faces.map(face=>{const out=[];let at=0n;function append(start,end,slot){if(start===end)return;const previous=out[out.length-1];if(previous&&previous.end===start&&previous.slot===slot)previous.end=end;else out.push({start,end,slot});}for(const cell of face){append(at,cell.start,0);append(cell.start,cell.end,cell.slot);at=cell.end;}append(at,FULL,0);return out;});}
   const builderRuns=completeRuns(intervals),expectedIntervals=Array.from({length:6},()=>[]);
   // The verifier recomputes intervals from exact low-order x/y bit positions;
   // it does not use the builder's high-order quadrant conversion or nodes.
   for(let owner=0;owner<assignments.length;owner++){const core=assignments[owner].body.core;for(const cell of core.cells){const x=BigInt(cell.x)<<BigInt(30-core.level),y=BigInt(cell.y)<<BigInt(30-core.level);let start=0n;for(let bit=0n;bit<30n;bit++){start|=((x>>bit)&1n)<<(2n*bit);start|=((y>>bit)&1n)<<(2n*bit+1n);}const end=start+(1n<<BigInt(2*(30-core.level)));expectedIntervals[cell.face].push({start,end,slot:owner+1});ctx.work.independentUnionCells++;if((ctx.work.independentUnionCells&1023)===0)await yieldNow(ctx);}}
   for(const face of expectedIntervals){face.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);for(let k=1;k<face.length;k++)if(face[k].start<face[k-1].end)fail('OVERLAPPING_ASSIGNMENTS','Independent footprint union found overlapping ownership');}
   const runs=completeRuns(expectedIntervals);
   const footprintBody={format:'sphere-spbx-footprint-union/1',assignments:assignments.map(v=>({regionId:v.body.regionId,assignmentDigest:v.digest,level:v.body.core.level,cells:v.body.core.cells})),table},footprint=await R.envelope(footprintBody),hostWorld=await R.envelope(ctx.snapshot);ctx.work.hashBytes+=R.canonicalBytes(footprintBody).length+R.canonicalBytes(ctx.snapshot).length;
   return {table:R.deepFreeze(table),intervals,builderRuns,runs,footprintDigest:footprint.digest,hostWorldDigest:hostWorld.digest,total,temporaryLeases:[inputLease,intervalLease],residentLeases:[tableLease]};
  }catch(error){intervalLease.release();tableLease.release();throw error;}
 }catch(error){inputLease.release();throw error;}
}
function leaf(slot){return slot===0?0:HIGH+slot;}
function leafSlot(word,count){if(word===0)return 0;if(word>=HIGH){const slot=word-HIGH;if(slot<1||slot>count)fail('INVALID_INDEX','Index leaf names an unknown assignment slot',{word,assignmentCount:count});return slot;}return null;}
async function construct(data,ctx){
 let capacity=Math.min(1024,ctx.maxNodes),nodeCount=7,bufferLease=ctx.account.reserve(capacity*NODE_BYTES,'builder-child-array'),words=new Uint32Array(capacity*4);
 if(ctx.maxNodes<7){bufferLease.release();fail('RESOURCE_LIMIT','Canonical six-root construction exceeds node quota');}
 function ensure(){if(nodeCount<capacity)return;if(capacity>=ctx.maxNodes)fail('RESOURCE_LIMIT','Sparse index node quota exhausted',{nodeCount,maxNodes:ctx.maxNodes});const nextCapacity=Math.min(ctx.maxNodes,capacity*2),nextLease=ctx.account.reserve(nextCapacity*NODE_BYTES,'replacement-builder-child-array'),next=new Uint32Array(nextCapacity*4);next.set(words);bufferLease.release();bufferLease=nextLease;words=next;capacity=nextCapacity;}
 const rootsLease=ctx.account.reserve(24,'builder-face-roots'),roots=new Uint32Array([1,2,3,4,5,6]);
 try{
  async function writeNode(node,face,start,end,depth){const width=(end-start)/4n;for(let quadrant=0;quadrant<4;quadrant++){const a=start+BigInt(quadrant)*width,b=a+width,slot=uniformRange(data.builderRuns[face],a,b);ctx.work.buildPartitions++;if(slot>=0)words[node*4+quadrant]=leaf(slot);else{if(depth>=29)fail('INVALID_INDEX','Footprint cannot be represented within level30');ensure();const child=nodeCount++;words[node*4+quadrant]=child;await writeNode(child,face,a,b,depth+1);}if((ctx.work.buildPartitions&1023)===0)await yieldNow(ctx);}}
  for(let face=0;face<6;face++)await writeNode(roots[face],face,0n,FULL,0);
  const size=HEADER_BYTES+nodeCount*NODE_BYTES,bytesLease=ctx.account.reserve(size,'resident-spbx-bytes'),bytes=new Uint8Array(size),view=new DataView(bytes.buffer);bytes.set([83,80,66,88]);view.setUint32(4,1,true);view.setUint32(8,nodeCount,true);view.setUint32(12,data.table.length,true);for(let face=0;face<6;face++)view.setUint32(16+face*4,roots[face],true);for(let i=0;i<nodeCount*4;i++)view.setUint32(HEADER_BYTES+i*4,words[i],true);
  return {bytes,bytesLease};
 }finally{bufferLease.release();rootsLease.release();}
}
function header(bytes,ctx){
 if(bytes.length<HEADER_BYTES||bytes[0]!==83||bytes[1]!==80||bytes[2]!==66||bytes[3]!==88)fail('INVALID_INDEX','SPBX magic/header is missing');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),version=view.getUint32(4,true),nodeCount=view.getUint32(8,true),assignmentCount=view.getUint32(12,true);
 if(version!==1||nodeCount<2||nodeCount>ctx.maxNodes||assignmentCount>ctx.maxAssignments||bytes.length!==HEADER_BYTES+nodeCount*NODE_BYTES)fail('INVALID_INDEX','SPBX exact version, count or byte length differs',{version,nodeCount,assignmentCount,bytes:bytes.length});const roots=[];for(let face=0;face<6;face++){const rootRef=view.getUint32(16+face*4,true);if(rootRef===0||rootRef>=nodeCount||rootRef>=HIGH)fail('INVALID_INDEX','Face root is not a nonzero node',{face,rootRef});roots.push(rootRef);}for(let k=0;k<4;k++)if(view.getUint32(HEADER_BYTES+k*4,true)!==0)fail('INVALID_INDEX','Reserved node zero is not empty');return {view,nodeCount,assignmentCount,roots,word:(node,k)=>view.getUint32(HEADER_BYTES+node*NODE_BYTES+k*4,true)};
}
async function verifyComplete(bytes,data,ctx){
 const h=header(bytes,ctx);if(h.assignmentCount!==data.table.length)fail('INVALID_INDEX','Header assignment table count differs from exact envelopes');
 const graphLease=ctx.account.reserve(h.nodeCount*6+32*96,'independent-graph-summary-and-depth-stack'),state=new Uint8Array(h.nodeCount),height=new Uint8Array(h.nodeCount),uniform=new Int32Array(h.nodeCount);uniform.fill(-1);uniform[0]=0;
 let reachableNodes=0;
 try{
  // Validate every record, including unreachable records. Sharing is legal; cycles are not.
  for(let first=1;first<h.nodeCount;first++){
   if(state[first]===2)continue;const stack=[{node:first,next:0}];state[first]=1;
   while(stack.length){const top=stack[stack.length-1];if(top.next<4){const word=h.word(top.node,top.next++);ctx.work.structuralWords++;const slot=leafSlot(word,h.assignmentCount);if(slot===null){if(word>=h.nodeCount)fail('INVALID_INDEX','Child node reference exceeds the resource',{word,nodeCount:h.nodeCount});if(state[word]===1)fail('INVALID_INDEX','Child node cycle is forbidden',{node:top.node,word});if(state[word]===0){if(stack.length>=30)fail('INVALID_INDEX','Node path exceeds levels0 through29');state[word]=1;stack.push({node:word,next:0});}}if((ctx.work.structuralWords&2047)===0)await yieldNow(ctx);}
    else{let max=0,common=null;for(let k=0;k<4;k++){const word=h.word(top.node,k),slot=leafSlot(word,h.assignmentCount),resolved=slot===null?uniform[word]:slot;if(slot===null)max=Math.max(max,height[word]);common=common===null?resolved:common===resolved?common:-1;}height[top.node]=max+1;if(height[top.node]>30)fail('INVALID_INDEX','Node graph exceeds the supported address depth');uniform[top.node]=common;state[top.node]=2;stack.pop();}
   }
  }
  const reachLease=ctx.account.reserve(h.nodeCount*5,'reachable-node-accounting'),reached=new Uint8Array(h.nodeCount),pending=new Uint32Array(h.nodeCount);try{let at=0;for(const node of h.roots)if(!reached[node]){reached[node]=1;pending[at++]=node;}while(at){const node=pending[--at];reachableNodes++;for(let k=0;k<4;k++){const word=h.word(node,k);if(word>0&&word<HIGH&&!reached[word]){reached[word]=1;pending[at++]=word;}}if((reachableNodes&2047)===0)await yieldNow(ctx);}}finally{reachLease.release();}
  // Full expected ownership is independently derived from exact dyadic core cells.
  // Uniform graph summaries avoid exponential expansion of shared base subgraphs.
  const semanticLease=ctx.account.reserve(96*192,'independent-symbolic-partition-stack');try{for(let face=0;face<6;face++){
   const stack=[{node:h.roots[face],start:0n,end:FULL,depth:0}];
   while(stack.length){const patch=stack.pop(),expected=uniformRange(data.runs[face],patch.start,patch.end),actual=uniform[patch.node];ctx.work.symbolicPartitions++;
    if(expected>=0){if(actual!==expected)fail('INDEX_MEMBERSHIP_MISMATCH','Complete patch ownership differs from footprint union',{face,depth:patch.depth,expected,actual});}
    else{if(actual>=0)fail('INDEX_MEMBERSHIP_MISMATCH','Uniform index patch omits a footprint boundary',{face,depth:patch.depth});if(patch.depth>=30)fail('INDEX_MEMBERSHIP_MISMATCH','Unresolved exact ownership exceeds level30');const width=(patch.end-patch.start)/4n;for(let k=3;k>=0;k--){const a=patch.start+BigInt(k)*width,b=a+width,word=h.word(patch.node,k),slot=leafSlot(word,h.assignmentCount),owner=uniformRange(data.runs[face],a,b);if(slot!==null){if(owner!==slot)fail('INDEX_MEMBERSHIP_MISMATCH','Index leaf differs from the exact complete footprint',{face,depth:patch.depth+1,slot,expected:owner});}else stack.push({node:word,start:a,end:b,depth:patch.depth+1});}}
    if((ctx.work.symbolicPartitions&1023)===0)await yieldNow(ctx);
   }
  }}finally{semanticLease.release();}
  return {nodeCount:h.nodeCount,assignmentCount:h.assignmentCount,roots:h.roots,reachableNodes,unreachableNodes:h.nodeCount-1-reachableNodes};
 }finally{graphLease.release();}
}
async function admit(bytes,bytesLease,data,ctx,origin){
 const checked=await verifyComplete(bytes,data,ctx);abort(ctx.signal);const digest=await R.sha256(bytes);ctx.work.hashBytes+=bytes.length;const descriptor=R.deepFreeze({profile:PROFILE,digest,nodeCount:checked.nodeCount,assignmentCount:checked.assignmentCount});
 if(ctx.expectedDescriptor&&R.canonicalJSON(ctx.expectedDescriptor)!==R.canonicalJSON(descriptor))fail('INDEX_DESCRIPTOR_MISMATCH','Expected binding index descriptor differs from retained exact bytes');
 const proofBody={format:'sphere-spbx-verification/1',profile:PROFILE,sourceProfileRef:{id:CONSTRUCTION,digest:ctx.admittedProfile.digest},resource:descriptor,hostWorldDigest:data.hostWorldDigest,hostProfileRef:ctx.snapshot.hostProfileRef,footprintUnionDigest:data.footprintDigest,assignmentTable:data.table,structural:{complete:true,acyclic:true,reservedNodeZero:true,maximumLevels:30,roots:checked.roots,reachableNodes:checked.reachableNodes,unreachableNodes:checked.unreachableNodes},membership:{complete:true,method:'exact-dyadic-owner-runs-and-independent-graph-summary-v1',cells:data.total},construction:origin==='build'?CONSTRUCTION:'VERIFIED_FORMAT_WITHOUT_CONSTRUCTION_IDENTITY',work:R.clone(ctx.work)};
 const proofEstimate=metadataBytes(proofBody),proofLease=ctx.account.reserve(proofEstimate*4,'verification-record-preparation'),verificationEnvelope=await R.envelope(proofBody),residentProofLease=ctx.account.reserve(metadataBytes(verificationEnvelope),'resident-verification-record');proofLease.release();abort(ctx.signal);
 for(const lease of data.temporaryLeases)lease.release();ctx.scratchLease.release();const handle=Object.freeze({}),privateState={ctx,bytes,bytesLease,residentLeases:[ctx.contextLease,ctx.profileLease,...data.residentLeases,residentProofLease],descriptor,table:data.table,verificationEnvelope,disposed:false,copyLeases:new Set()};handles.set(handle,privateState);return Object.freeze({handle,descriptor,assignmentTable:data.table,verificationEnvelope,sourceProfileEnvelope:ctx.admittedProfile});
}
async function build(assignmentEnvelopes,options={}){
 const ctx=optionsContext(options);try{const data=await prepareAssignments(assignmentEnvelopes,ctx);await admitProfile(ctx);const resource=await construct(data,ctx);return await admit(resource.bytes,resource.bytesLease,data,ctx,'build');}catch(error){ctx.account.releaseAll();throw error;}
}
async function verify(raw,assignmentEnvelopes,options={}){
 const ctx=optionsContext(options);try{if(!(raw instanceof Uint8Array)||raw.length>HEADER_BYTES+ctx.maxNodes*NODE_BYTES)fail('RESOURCE_LIMIT','Exact index resource exceeds its byte quota');const bytesLease=ctx.account.reserve(raw.byteLength,'resident-spbx-bytes'),bytes=Uint8Array.from(raw);header(bytes,ctx);const data=await prepareAssignments(assignmentEnvelopes,ctx);await admitProfile(ctx);return await admit(bytes,bytesLease,data,ctx,'verify');}catch(error){ctx.account.releaseAll();throw error;}
}
function state(handle,allowDisposed=false){const value=handles.get(handle);if(!value)fail('UNVERIFIED_INDEX','Index handle was not independently admitted');if(value.disposed&&!allowDisposed)fail('INDEX_DISPOSED','Index handle is disposed');return value;}
function lookup(handle,address){
 const s=state(handle),scratch=s.ctx.account.reserve(4096,'synchronous-lookup-scratch');try{const owned=R.deepFreeze(R.clone(address)),canonical=s.ctx.hostAdapter.canonicalizeShellAddress(owned,s.ctx.snapshot);R.validateAddress(canonical,{metadata:s.ctx.metadata});
 for(const key of Object.keys(s.ctx.metadata))if(canonical[key]!==s.ctx.metadata[key])fail('ADDRESS_WORLD_MISMATCH','Lookup address differs from retained world',{key});
 // Extend the exact represented dyadic point to level30. The existing address
 // profile explicitly owns the closed +1 face endpoint with its final cell.
 const factor=2**(30-canonical.level),size=2**30,pointX=(canonical.x+canonical.local[0])*factor,pointY=(canonical.y+canonical.local[1])*factor;
 if(pointX<0||pointX>size||pointY<0||pointY>size)fail('INVALID_ADDRESS','Canonical coordinate is outside its face');const x=pointX===size?size-1:Math.floor(pointX),y=pointY===size?size-1:Math.floor(pointY),view=new DataView(s.bytes.buffer,s.bytes.byteOffset,s.bytes.byteLength);let node=view.getUint32(16+canonical.face*4,true);
 for(let depth=0;depth<30;depth++){const bit=29-depth,quadrant=Math.floor(x/2**bit)%2+2*(Math.floor(y/2**bit)%2),word=view.getUint32(HEADER_BYTES+node*NODE_BYTES+quadrant*4,true);s.ctx.work.lookupDescents++;if(word===0)return Object.freeze({kind:'base'});if(word>=HIGH){const assignmentIndex=word-HIGH,entry=s.table[assignmentIndex-1];return Object.freeze({kind:'assignment',assignmentIndex,regionId:entry.regionId,assignmentDigest:entry.assignmentDigest});}node=word;}
 fail('INVALID_INDEX','Admitted index exceeded the fixed30-level lookup bound');}finally{scratch.release();}
}
function copyBytes(handle){const s=state(handle),lease=s.ctx.account.reserve(s.bytes.byteLength+256,'borrowed-serialized-copy'),bytes=Uint8Array.from(s.bytes);let released=false;const copy=Object.freeze({bytes,release(){if(released)return;released=true;s.copyLeases.delete(copy);lease.release();}});s.copyLeases.add(copy);return copy;}
function inspect(handle){const s=state(handle,true);return R.deepFreeze({descriptor:s.descriptor,disposed:s.disposed,activeCopies:s.copyLeases.size,work:R.clone(s.ctx.work),accounting:s.ctx.account.inspect()});}
function dispose(handle){const s=state(handle,true);if(s.disposed)return;s.disposed=true;s.bytesLease.release();for(const lease of s.residentLeases)lease.release();s.bytes=null;s.table=null;s.verificationEnvelope=null;s.bytesLease=null;s.residentLeases=[];for(const key of ['hostAdapter','snapshot','metadata','profileEnvelope','admittedProfile','readSource','expectedDescriptor','signal','yieldWork','contextLease','profileLease','scratchLease'])s.ctx[key]=null;s.ctx.account.closeAdmission();}
const api=Object.freeze({PROFILE,CONSTRUCTION,SOURCE_PATHS,MAX_NODES,MAX_CELLS,MAX_ASSIGNMENTS,MAX_METADATA_BYTES,HEADER_BYTES,NODE_BYTES,buildProfile,verifyProfile,build,verify,lookup,copyBytes,inspect,dispose,metadataBytes,inspectAggregate:()=>({heldBytes:aggregateHeldBytes,peakBytes:aggregatePeakBytes,limitBytes:MAX_METADATA_BYTES,measurement:'CONSERVATIVE_LOGICAL_RESERVATION_NOT_NATIVE_HEAP'})});root.SphereBiomeSpatialIndex=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
