/* Whole-patch arithmetic and spherical area certificates. Content independent. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null),I=root.SphereBiomeIntervals||(typeof module!=='undefined'?require('./intervals.js'):null),A=root.SphereWorldAddress||(typeof module!=='undefined'?require('../world-address.js'):null),T=root.SphereWorldTopology||(typeof module!=='undefined'?require('../world-topology.js'):null);
const NUMERIC_PROFILE='sphere-cube-area-b192-v1',DOMAIN_PROFILE='sphere-gnomonic-domain-b192-v1';
function fail(code,message,details={}){throw new R.ServiceError(code,message,details,'cell-geometry');}
function validateCell(input){input=R.clone(input);if(Object.keys(input).length!==4||!['face','level','x','y'].every(key=>Object.hasOwn(input,key))||!Number.isInteger(input.level)||input.level<0||input.level>30)fail('INVALID_GEOMETRY_PROOF','Invalid level-bearing geometry cell');R.validateStructural('cell',{face:input.face,x:input.x,y:input.y});const c=T.validateCell(input);return Object.freeze(c);}
function compareCells(a,b){return a.face-b.face||a.level-b.level||a.x-b.x||a.y-b.y;}
const cellKey=c=>{c=validateCell(c);return [c.face,c.level,c.x,c.y].join('/');};
function radius(snapshot){const n=snapshot?.validatedStaticWorldParameters?.radius*1000;if(!Number.isFinite(n)||n<=0||n>1e15)fail('INVALID_HOST_WORLD','Invalid retained shell radius');return n;}
function cornersRaw(cell){const c=validateCell(cell),f=A.faces[c.face],span=1n<<BigInt(c.level);return [[0,0],[1,0],[1,1],[0,1]].map(([dx,dy])=>{const u=-span+2n*BigInt(c.x+dx),v=-span+2n*BigInt(c.y+dy);return f.normal.map((n,k)=>BigInt(n)*span+BigInt(f.u[k])*u+BigInt(f.v[k])*v);});}
function centreDirection(cell){return T.cellDirection(validateCell(cell));}
function neighbours(cell){return Object.values(T.neighbors(validateCell(cell))).map(validateCell).sort(compareCells);}
function dotRaw(a,b){return a.reduce((sum,x,k)=>sum+x*b[k],0n);}
function determinant(a,b,c){return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);}
function triangleAngle(a,b,c){
 const aa=I.rational(dotRaw(a,a)),bb=I.rational(dotRaw(b,b)),cc=I.rational(dotRaw(c,c));
 const denominator=I.add(I.add(I.sqrt(I.mul(I.mul(aa,bb),cc)),I.mul(I.rational(dotRaw(a,b)),I.sqrt(cc))),I.add(I.mul(I.rational(dotRaw(b,c)),I.sqrt(aa)),I.mul(I.rational(dotRaw(c,a)),I.sqrt(bb))));
 let det=determinant(a,b,c);if(det<0n)det=-det;if(denominator[0]<=0n||det===0n)fail('UNPROVEN_AREA','Solid-angle denominator/determinant cannot be certified');
 return I.mul(I.rational(2n),I.atan(I.div(I.rational(det),denominator)));
}
function areaInterval(cell,radiusM){
 if(!Number.isFinite(radiusM)||radiusM<=0||radiusM>1e15)fail('INVALID_HOST_WORLD','Invalid radius in area proof');
 const [a,b,c,d]=cornersRaw(cell),angle=I.add(triangleAngle(a,b,c),triangleAngle(a,c,d));return I.mul(angle,I.square(I.fromNumber(radiusM)));
}
function intervalReport(interval){const [lowerM2,upperM2]=I.toNumbers(interval),estimateM2=lowerM2+(upperM2-lowerM2)/2,errorBoundM2=I.nextUp(Math.max(estimateM2-lowerM2,upperM2-estimateM2));return {estimateM2,lowerM2,upperM2,errorBoundM2};}
function areaOfCell(cell,radiusM){cell=validateCell(cell);const bounds=areaInterval(cell,radiusM),report=intervalReport(bounds);if(report.lowerM2<=0)fail('UNPROVEN_AREA','Area interval cannot establish positive area');return R.deepFreeze({...report,numericProfile:NUMERIC_PROFILE,proof:{algorithm:'two-oriented-spherical-triangles',roundingProfile:I.PROFILE,cornerVectors:cornersRaw(cell).map(v=>v.map(String)),fixedFractionBits:Number(I.BITS)}});}
function globalCellAreaBounds(level,radiusM){if(!Number.isInteger(level)||level<0||level>30||!Number.isFinite(radiusM)||radiusM<=0||radiusM>1e15)fail('INVALID_GEOMETRY_PROOF','Invalid global area bound input');const parametricArea=I.rational(4n,1n<<BigInt(2*level)),scaled=I.mul(parametricArea,I.square(I.fromNumber(radiusM))),minimum=I.div(scaled,I.mul(I.rational(3n),I.sqrt(I.rational(3n))));return R.deepFreeze({format:'sphere-global-cell-area-bound/1',profile:NUMERIC_PROFILE,level,radiusM,lowerM2:I.toNumbers(minimum)[0],upperM2:I.toNumbers(scaled)[1],roundingProfile:I.PROFILE,proof:'gnomonic-jacobian-between-one-over-three-root-three-and-one-v1'});}
function verifyGlobalCellAreaBound(value,level,radiusM){const expected=globalCellAreaBounds(level,radiusM);if(R.canonicalJSON(value)!==R.canonicalJSON(expected))fail('INVALID_AREA_PROOF','Global cell area bound differs from exact Jacobian interval');return true;}
function sortedCells(cells,maximum=65536){if(!Number.isInteger(maximum)||maximum<1||maximum>65536||!Array.isArray(cells)||!cells.length||cells.length>maximum)fail('INVALID_ASSIGNMENT','Cell-set quota exceeded');const sorted=R.clone(cells).map(validateCell).sort(compareCells);if(sorted.some(cell=>cell.level!==sorted[0].level))fail('INVALID_ASSIGNMENT','Area certificates require one fixed allocation level');for(let k=1;k<sorted.length;k++)if(compareCells(sorted[k-1],sorted[k])===0)fail('INVALID_ASSIGNMENT','Duplicate area cell');return sorted;}
async function areaOfCells(cells,snapshot,{maximumCells=65536,signal}={}){
 const sorted=sortedCells(cells,maximumCells),radiusM=radius(snapshot);let total=[0n,0n],largest=[0n,0n],logicalAreaCells=0;for(const cell of sorted){if(signal?.aborted)fail('CANCELLED','Area proof cancelled',{logicalAreaCells});const area=areaInterval(cell,radiusM);total=I.add(total,area);largest=[largest[0]>area[0]?largest[0]:area[0],largest[1]>area[1]?largest[1]:area[1]];logicalAreaCells++;if(logicalAreaCells%32===0)await new Promise(resolve=>setTimeout(resolve,0));}
 const cellSet=await R.envelope({format:'sphere-area-cell-set/1',cells:sorted});
 if(signal?.aborted)fail('CANCELLED','Area proof cancelled',{logicalAreaCells});const envelope=await R.envelope({format:'sphere-area-proof/1',profile:NUMERIC_PROFILE,cellSetDigest:cellSet.digest,radiusM,numericProfile:I.PROFILE,cellCount:sorted.length,...intervalReport(total),largestCellBoundsM2:I.toNumbers(largest),work:{triangles:sorted.length*2,logicalAreaCells:sorted.length}});if(signal?.aborted)fail('CANCELLED','Area proof cancelled',{logicalAreaCells});return envelope;
}
async function verifyAreaCertificate(envelope,cells,snapshot,options){envelope=R.clone(envelope);cells=R.clone(cells);snapshot=R.clone(snapshot);const signal=options?.signal;options=options?{...R.clone(Object.fromEntries(Object.entries(options).filter(([k])=>k!=='signal'))),signal}:undefined;const owned=await R.verifyEnvelope(envelope),expected=await areaOfCells(cells,snapshot,options);if(expected.digest!==envelope.digest||R.canonicalJSON(owned)!==R.canonicalJSON(expected.body))fail('INVALID_AREA_PROOF','Area certificate disagrees with recomputed whole cell set');return true;}
function patchIntervals(cell,{depth=0,x=0,y=0}={}){
 const c=validateCell(cell);if(!Number.isInteger(depth)||depth<0||depth>20||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=2**depth||y>=2**depth)fail('INVALID_GEOMETRY_PROOF','Invalid internal interval patch');
 const parts=1n<<BigInt(depth),span=(1n<<BigInt(c.level))*parts,ix=BigInt(c.x)*parts+BigInt(x),iy=BigInt(c.y)*parts+BigInt(y);
 return {u:[I.rational(-span+2n*ix,span)[0],I.rational(-span+2n*(ix+1n),span)[1]],v:[I.rational(-span+2n*iy,span)[0],I.rational(-span+2n*(iy+1n),span)[1]]};
}
function dotPatchInterval(cell,axis,patch={}){
 if(!Array.isArray(axis)||axis.length!==3||axis.some(v=>!Number.isFinite(v)))fail('INVALID_GEOMETRY_PROOF','Invalid axis in interval proof');
 const c=validateCell(cell),f=A.faces[c.face],{u,v}=patchIntervals(c,patch);let numerator=[0n,0n];
 for(let k=0;k<3;k++){const coordinate=I.add(I.rational(BigInt(f.normal[k])),I.add(I.mul(I.rational(BigInt(f.u[k])),u),I.mul(I.rational(BigInt(f.v[k])),v)));numerator=I.add(numerator,I.mul(coordinate,I.fromNumber(axis[k])));}
 return I.div(numerator,I.sqrt(I.add(I.ONE,I.add(I.square(u),I.square(v)))));
}
function axisNorm(axis){let norm=[0n,0n];for(const value of axis)norm=I.add(norm,I.square(I.fromNumber(value)));if(norm[0]<=0n)fail('INVALID_GEOMETRY_PROOF','Zero axis');return I.sqrt(norm);}
function normalizedDotPatchInterval(cell,axis,patch={}){const interval=I.div(dotPatchInterval(cell,axis,patch),axisNorm(axis));return [interval[0]<-I.SCALE?-I.SCALE:interval[0],interval[1]>I.SCALE?I.SCALE:interval[1]];}
function directionBounds(cell,patch={}){return [[1,0,0],[0,1,0],[0,0,1]].map(axis=>I.toNumbers(normalizedDotPatchInterval(cell,axis,patch)));}
function frameInput(cell,frame,haloM,snapshot){
 cell=validateCell(cell);frame=R.clone(frame);R.validateStructural('frame',frame);if(!Number.isFinite(haloM)||haloM<0||haloM>2e9+1000)fail('INVALID_GEOMETRY_PROOF','Invalid frame halo');
 const radiusM=radius(snapshot),origin=A.direction(frame.origin),parameters=snapshot.validatedStaticWorldParameters,metadata={worldSeed:snapshot.worldSeed,geographyRevision:parameters.geographyRevision??1,terrainRevision:parameters.terrainRevision,artRevision:parameters.packAddress?.artRevision??1,assetRevision:1,heroRevision:null};R.validateFrame(frame,{direction:()=>origin,radiusM,metadata});return {cell,frame,haloM,radiusM,origin};
}
function domainKernel(input,{maxRefinements=8,maxProofNodes=256,signal}={}){
 if(!Number.isInteger(maxRefinements)||maxRefinements<0||maxRefinements>20||!Number.isInteger(maxProofNodes)||maxProofNodes<1||maxProofNodes>65536)fail('INVALID_GEOMETRY_PROOF','Invalid domain work quota');
 const {cell,frame,haloM,radiusM,origin}=input,halo=I.div(I.fromNumber(haloM),I.fromNumber(radiusM)),limit=I.sub(I.fromNumber(frame.maximumAngularRadiusRad),halo),metricLimit=I.sub(I.atan(I.div(I.fromNumber(frame.maximumLocalRadiusM),I.fromNumber(radiusM))),halo);
 const angularLimit=[limit[0]<metricLimit[0]?limit[0]:metricLimit[0],limit[1]<metricLimit[1]?limit[1]:metricLimit[1]];
 if(angularLimit[0]<=0n)return {classification:'ineligible',work:{proofNodes:0,refinements:0},reason:'halo-exceeds-chart'};
 const threshold=I.cos(angularLimit),queue=[{depth:0,x:0,y:0}],leaves=[];let proofNodes=0,refinements=0;
 while(queue.length){
  if(signal?.aborted)fail('CANCELLED','Domain proof cancelled',{proofNodes,refinements});
  if(proofNodes>=maxProofNodes)return {classification:'uncertain',reason:'domain-proof-quota',work:{proofNodes,refinements}};
  const patch=queue.shift();proofNodes++;const dot=normalizedDotPatchInterval(cell,origin,patch);
  const expanded=axis=>{const value=dotPatchInterval(cell,axis,patch),change=I.mul(axisNorm(axis),halo);return [value[0]-change[1],value[1]+change[1]];};
  const den=expanded(origin),east=expanded(frame.east),north=expanded(frame.north),metric=den[0]>0n?I.mul(I.fromNumber(radiusM),I.div(I.sqrt(I.add(I.square(east),I.square(north))),den)):null;
  if(dot[0]>=threshold[1]&&metric&&metric[1]<=I.fromNumber(frame.maximumLocalRadiusM)[0]){leaves.push({patch,dot:I.toNumbers(dot),localRadiusBoundsM:I.toNumbers(metric)});continue;}
  if(dot[1]<threshold[0])return {classification:'ineligible',reason:'outside-chart',work:{proofNodes,refinements}};
  if(patch.depth>=maxRefinements)return {classification:'uncertain',reason:'domain-rounding-or-bound',work:{proofNodes,refinements}};
  refinements++;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)queue.push({depth:patch.depth+1,x:patch.x*2+dx,y:patch.y*2+dy});
 }
 return {classification:'eligible',work:{proofNodes,refinements},leaves,permittedAngularIntervalRad:I.toNumbers(angularLimit)};
}
async function certifyDomain(cell,frame,haloM,snapshot,quotas){
 const input=frameInput(cell,frame,haloM,snapshot),result=domainKernel(input,quotas);if(result.classification!=='eligible')return R.deepFreeze(result);
 const proofInput=await R.envelope({format:'sphere-domain-proof-input/1',worldId:snapshot.worldId,hostGeographyDigest:snapshot.hostGeographyDigest,...input,quotas:{maxRefinements:quotas?.maxRefinements??8,maxProofNodes:quotas?.maxProofNodes??256}});
 if(quotas?.signal?.aborted)fail('CANCELLED','Domain proof cancelled',result.work);const certificate=await R.envelope({format:'sphere-domain-proof/1',profile:DOMAIN_PROFILE,proofInputDigest:proofInput.digest,cell:input.cell,worldId:proofInput.body.worldId,haloM,frame:input.frame,...result});if(quotas?.signal?.aborted)fail('CANCELLED','Domain proof cancelled',result.work);return R.deepFreeze({classification:'eligible',certificate,proofInput,work:result.work});
}
async function verifyDomainCertificate(envelope,cell,frame,haloM,snapshot,quotas){envelope=R.clone(envelope);cell=R.clone(cell);frame=R.clone(frame);snapshot=R.clone(snapshot);const signal=quotas?.signal;quotas=quotas?{...R.clone(Object.fromEntries(Object.entries(quotas).filter(([k])=>k!=='signal'))),signal}:undefined;await R.verifyEnvelope(envelope);const expected=await certifyDomain(cell,frame,haloM,snapshot,quotas);if(expected.classification!=='eligible'||expected.certificate.digest!==envelope.digest)fail('INVALID_DOMAIN_PROOF','Domain certificate disagrees with recomputed whole patch');return true;}
const api=Object.freeze({NUMERIC_PROFILE,DOMAIN_PROFILE,validateCell,cellKey,compareCells,cornersRaw,rawCorners:cornersRaw,centreDirection,neighbours,neighbors:neighbours,areaOfCell,globalCellAreaBounds,verifyGlobalCellAreaBound,areaOfCells,verifyAreaCertificate,patchIntervals,dotPatchInterval,normalizedDotPatchInterval,directionBounds,certifyDomain,verifyDomainCertificate});root.SphereBiomeCellGeometry=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
