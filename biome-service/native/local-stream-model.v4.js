/* Directed full-frustum coverage and CPU-projected triangle-stream bounds.
 * Conditional interpolation bounds are never native fragment authority. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),I=root.SphereBiomeIntervals||(node?require('../intervals.js'):null),M=root.SphereMath||(node?require('../../math.js'):null),L=root.SphereBiomeNativeLocalTransform||(node?require('./local-transform.js'):null),D=root.SphereBiomeNativeDistance||(node?require('./native-distance.js'):null);
const A=root.SphereWorldAddress||(node?require('../../world-address.js'):null);
const F=I.fromNumber,Z=I.rational(0n),ONE=I.rational(1n),PROFILE='main-chart-eye-local-clip-triangle-stream-v4',view=new DataView(new ArrayBuffer(4));
const upper=a=>I.toNumbers(a)[1],abs=a=>[0n,a[0]<0n?-a[0]>a[1]?-a[0]:a[1]:a[1]],dot=(a,b)=>a.reduce((s,v,k)=>I.add(s,I.mul(v,b[k])),Z),norm=a=>upper(I.sqrt(a.reduce((s,v)=>I.add(s,I.square(v)),Z)));
function fail(code,message,details={}){throw R.error(code,message,details,'local-stream-model');}
function inverse(rows){const [[a,b,c],[d,e,f],[g,h,i]]=rows,cof=[I.sub(I.mul(e,i),I.mul(f,h)),I.sub(I.mul(f,g),I.mul(d,i)),I.sub(I.mul(d,h),I.mul(e,g))],det=dot([a,b,c],cof);if(det[0]<=0n&&det[1]>=0n)fail('INVALID_VIEW','Projection is singular');return [[cof[0],I.sub(I.mul(c,h),I.mul(b,i)),I.sub(I.mul(b,f),I.mul(c,e))],[cof[1],I.sub(I.mul(a,i),I.mul(c,g)),I.sub(I.mul(c,d),I.mul(a,f))],[cof[2],I.sub(I.mul(b,g),I.mul(a,h)),I.sub(I.mul(a,e),I.mul(b,d))]].map(row=>row.map(v=>I.div(v,det)));}
function projectionRows(reference){return [0,1,3].map(row=>[0,1,2].map(k=>F(reference[k*4+row])));}
function ulpUpper(value){if(!Number.isFinite(value)||value<0||!Number.isFinite(Math.fround(value)))fail('INVALID_VIEW','Finite Float32 range required');let n=Math.fround(value);view.setFloat32(0,n);let word=view.getUint32(0);if(n<value)word++;const e=(word>>>23)&255;return e>0?2**(e-127-23):2**-126;}
function coverage({core,context,viewport,eye,minimumHeightM=0}){
 if(!viewport||!Number.isSafeInteger(viewport.width)||!Number.isSafeInteger(viewport.height)||viewport.width<1||viewport.height<1||viewport.width>16384||viewport.height>16384||!eye||![eye.xM,eye.yM,eye.heightM,minimumHeightM].every(Number.isFinite)||Math.abs(eye.xM)>64||Math.abs(eye.yM)>64||eye.heightM<=minimumHeightM||minimumHeightM<0)fail('UNPROVEN_VIEW_COVERAGE','A bounded chart eye and nonnegative-height view profile are required');
 const projection=L.projection(core,viewport.width/viewport.height),inv=inverse(projectionRows(projection.reference)),axes=[context.frame.east,context.frame.north,A.direction(context.frame.origin)],dual=inverse([0,1,2].map(k=>axes.map(axis=>F(axis[k])))),coeff=dual.map(axis=>[0,1,2].map(k=>dot(axis,inv.map(row=>row[k])))),pad=1+4/Math.min(viewport.width,viewport.height),box=[F(-pad)[0],F(pad)[1]],ray=coeff.map(row=>I.add(I.add(I.mul(row[0],box),I.mul(row[1],box)),row[2]));
 if(ray[2][0]<=0n)fail('UNPROVEN_VIEW_COVERAGE','A horizon-crossing frustum needs a different coverage profile');
 const radius=F(context.radiusM),height=F(eye.heightM),eyeDirection=D.chart(context.frame,context.radiusM,{x:[eye.xM,eye.xM],y:[eye.yM,eye.yM]}).q,idealEye=eyeDirection.map(v=>I.mul(I.sub(radius,height),v)),eyeChart=dual.map(axis=>dot(axis,idealEye)),dualZNorm=I.sqrt(dot(dual[2],dual[2])),zMaximum=I.mul(I.sub(radius,F(minimumHeightM)),dualZNorm);
 if(eyeChart[2][0]<=0n||I.sub(zMaximum,eyeChart[2])[0]<=0n)fail('UNPROVEN_VIEW_COVERAGE','The exact chart depth must increase toward the bounded surface');
 // The dual basis is inverted from the actual binary64 frame; orthogonality
 // is never assumed. A nonnegative-height sphere point has dual-z <=
 // (R-minHeight)*||dualZ||. Along each positive-z ray, chart x/z and y/z
 // are monotone, so their extrema lie at the eye or that far z-plane.
 const chartBounds=[0,1].map(k=>{const start=I.div(I.mul(radius,eyeChart[k]),eyeChart[2]),end=I.mul(I.div(radius,zMaximum),I.add(eyeChart[k],I.mul(I.sub(zMaximum,eyeChart[2]),I.div(ray[k],ray[2]))));return [start[0]<end[0]?start[0]:end[0],start[1]>end[1]?start[1]:end[1]];}),offsets=chartBounds.map((v,k)=>I.sub(v,F(k?eye.yM:eye.xM))),maximumChartRadiusM=upper(I.sqrt(I.add(I.square(offsets[0]),I.square(offsets[1])))),requiredRadiusM=Math.ceil((maximumChartRadiusM+2)/4)*4;
 const mainEyeBridge=core.position.map((value,k)=>I.sub(I.mul(F(value),F(1000)),idealEye[k])),maximumMainEyeBridgeM=norm(mainEyeBridge);
 if(!Number.isFinite(maximumMainEyeBridgeM)||maximumMainEyeBridgeM>=.001)fail('UNPROVEN_MAIN_EYE','Actual Main kilometre pose does not meet the native generator eye within1mm',{maximumMainEyeBridgeM});
 if(requiredRadiusM+Math.SQRT2*4>256)fail('COVERAGE_UNAVAILABLE','The complete current viewport exceeds the native patch capacity',{maximumChartRadiusM,requiredRadiusM});
 const q=D.chart(context.frame,context.radiusM,{x:[eye.xM-requiredRadiusM-8,eye.xM+requiredRadiusM+8],y:[eye.yM-requiredRadiusM-8,eye.yM+requiredRadiusM+8]}).q,cells=context.assignment.core.cells.map(c=>({...c,level:context.assignment.core.level}));
 if(D.insidePoint(q,cells)!=='inside')fail('UNPROVEN_VIEW_COVERAGE','The whole prepared patch is not inside one exact assigned core cell');
 return R.deepFreeze({format:'sphere-main-chart-frustum-coverage/2',profile:PROFILE,viewport,eye,minimumHeightM,referenceMatrix:projection.reference,maximumChartRadiusM,requiredRadiusM,paddedClipExtent:pad,wholePatchCore:true,maximumMainEyeBridgeM,mainEyeBridgeAxisBoundsM:mainEyeBridge.map(I.toNumbers),denominatorBounds:I.toNumbers(ray[2]),chartBounds:chartBounds.map(I.toNumbers),dualZNorm:I.toNumbers(dualZNorm),surfaceChartZMaximumM:I.toNumbers(zMaximum),scope:'DIRECTED_DUAL_BASIS_WHOLE_FRUSTUM_CHART_FOOTPRINT_AND_ACTUAL_MAIN_EYE_BRIDGE; NATIVE_FRAGMENT_INTERPOLATION_UNQUALIFIED'});
}
function encodeTriangle(positions,indices,reference,output,wordOffset,triangleId=0,rasterLayout){
 if(!(positions instanceof Float32Array)||!(output instanceof Float32Array)||indices.length!==3||reference.length!==16||!Number.isSafeInteger(rasterLayout?.rw)||rasterLayout.rw<1||!Number.isSafeInteger(rasterLayout?.rh)||rasterLayout.rh<1)fail('INVALID_INPUT','Exact retained triangle and complete raster required');
 const vertices=indices.map(index=>{if(!Number.isSafeInteger(index)||index<0||index*3+2>=positions.length)fail('INVALID_INDEX','Triangle index exceeds actual uploaded positions');return Array.from(positions.subarray(index*3,index*3+3));}),origin=[0,1,2].map(k=>Math.fround((vertices[0][k]+vertices[1][k]+vertices[2][k])/3)),clips=vertices.map(p=>[0,1,3].map(row=>Math.fround(p.reduce((s,v,k)=>s+reference[k*4+row]*v,0))));
 if(clips.some(c=>!c.every(Number.isFinite)||c[2]<=0))fail('UNPROVEN_VIEW_COVERAGE','Finite positive actual binary32 clips required');
 const rasterOrigin=[rasterLayout.rw,rasterLayout.rh].map((size,k)=>Math.round((clips.reduce((sum,c)=>sum+c[k]/c[2],0)/3*.5+.5)*size));if(rasterOrigin.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>16777216))fail('UNPROVEN_VIEW_COVERAGE','Each raster origin must be an exact binary32 integer');let maximumOffset=0,maximumOffsetRound=0;
 for(let j=0;j<3;j++){
  const offset=vertices[j].map((v,k)=>v-origin[k]),rounded=offset.map(Math.fround),localClip=[rasterLayout.rw,rasterLayout.rh].map((size,k)=>Math.fround(clips[j][k]-(2*rasterOrigin[k]/size-1)*clips[j][2]));for(let k=0;k<3;k++){maximumOffset=Math.max(maximumOffset,Math.abs(rounded[k]));maximumOffsetRound=Math.max(maximumOffsetRound,Math.abs(offset[k]-rounded[k]));}
  output.set([...clips[j],...origin,...rounded,...rasterOrigin,...localClip],wordOffset+j*13);
 }
 return {maximumOffset,maximumOffsetRound};
}
function expectedTransform(packet,at,output,outAt,vertex){if(!Number.isSafeInteger(vertex)||vertex<0)fail('INVALID_INDEX','Exact stream vertex required');output.set([packet[at],packet[at+1],packet[at+2],packet[at+2],...packet.subarray(at+3,at+9),Math.floor(vertex/3),...packet.subarray(at+9,at+13)],outAt);}
const SUB_TRIANGLES=Object.freeze([[0,3,5],[3,1,4],[5,4,2],[3,4,5]].map(Object.freeze));
function subdivide(positions,indices,child,output){
 if(!(positions instanceof Float32Array)||!(output instanceof Float32Array)||output.length!==18||!Number.isSafeInteger(child)||child<0||child>3||indices.length!==3)fail('INVALID_INPUT','One bounded affine child of an authentic source triangle required');
 for(let j=0;j<3;j++){const index=indices[j];if(!Number.isSafeInteger(index)||index<0||index*3+2>=positions.length)fail('INVALID_INDEX','Exact parent source triangle required');for(let k=0;k<3;k++)output[j*3+k]=positions[index*3+k];}
 for(let edge=0;edge<3;edge++)for(let k=0;k<3;k++)output[(3+edge)*3+k]=Math.fround((output[edge*3+k]+output[((edge+1)%3)*3+k])/2);
 return SUB_TRIANGLES[child];
}
function subdivisionBound(positionBounds){const maximum=Math.max(...positionBounds.flat().map(Math.abs)),axis=ulpUpper(maximum)+16*Number.EPSILON*(maximum+1);return Math.sqrt(3)*axis*1.00000001+1e-12;}
function facetDomain(context,meshBounds,coverage){
 if(!Number.isFinite(coverage?.maximumActualVertexBridgeM)||coverage.maximumActualVertexBridgeM<0||!Number.isFinite(coverage.canonicalCellM)||coverage.canonicalCellM<=0)fail('UNPROVEN_FACET_NORMAL','Authentic complete source-vertex and cell envelopes required');
 const radial=D.chart(context.frame,context.radiusM,meshBounds).q,cell=F(coverage.canonicalCellM),edgeError=I.div(I.mul(F(2),F(coverage.maximumActualVertexBridgeM)),cell);
 return {radial,cell,edgeError,sourceVertexErrorM:coverage.maximumActualVertexBridgeM,sourceCellM:coverage.canonicalCellM,radialDirectionBounds:radial.map(I.toNumbers)};
}
function facetBounds(positions,indices,domain){
 if(!(positions instanceof Float32Array)||indices.length!==3||indices.some(index=>!Number.isSafeInteger(index)||index<0||index*3+2>=positions.length))fail('INVALID_INDEX','Three exact authenticated source vertices required');
 const p=indices.map(index=>[0,1,2].map(k=>F(positions[index*3+k]))),expand=value=>I.add(value,[-domain.edgeError[1],domain.edgeError[1]]),e1=[0,1,2].map(k=>expand(I.div(I.sub(p[1][k],p[0][k]),domain.cell))),e2=[0,1,2].map(k=>expand(I.div(I.sub(p[2][k],p[0][k]),domain.cell))),e3=e1.map((v,k)=>I.sub(e2[k],v)),normal=[I.sub(I.mul(e1[1],e2[2]),I.mul(e1[2],e2[1])),I.sub(I.mul(e1[2],e2[0]),I.mul(e1[0],e2[2])),I.sub(I.mul(e1[0],e2[1]),I.mul(e1[1],e2[0]))],signed=dot(normal,domain.radial),positive=signed[0]>0n?signed:signed[1]<0n?I.neg(signed):null;
 if(!positive)fail('UNPROVEN_FACET_NORMAL','The complete true source facet has no proven radial orientation');
 return {minimumChordRadialNumerator:I.toNumbers(positive)[0],maximumChordNormalMagnitude:norm(normal),maximumChordEdgeMagnitude:Math.max(norm(e1),norm(e2),norm(e3))};
}
// The independent pixel oracle inverts the actual binary32 clip triangle,
// rather than assuming a native interpolation precision. It stores 12 binary64
// rational coefficients, the exact source origin, four directed forward-error
// bounds, and the positive clip-W range: 21 binary64 words per triangle.
const ORACLE_WORDS=21;
function oracleTriangle(positions,indices,packet,wordOffset,output,at){
 if(!(output instanceof Float64Array)||at<0||at+ORACLE_WORDS>output.length)fail('INVALID_INPUT','Prospectively funded complete oracle table required');
 const clips=[0,1,2].map(j=>[packet[wordOffset+j*13],packet[wordOffset+j*13+1],packet[wordOffset+j*13+2]]),matrix=[0,1,2].map(k=>clips.map(c=>F(c[k])));let inv;
 try{inv=inverse(matrix);}catch(error){if(error.code!=='INVALID_VIEW')throw error;output.fill(NaN,at,at+ORACLE_WORDS);return {degenerate:true};}
 const p=indices.map(index=>Array.from(positions.subarray(index*3,index*3+3))),origin=p[0],offset=[1,2].map(j=>p[j].map((v,k)=>I.sub(F(v),F(origin[k])))),rows=[0,1,2].map(k=>[0,1,2].map(j=>I.add(I.mul(offset[0][k],inv[1][j]),I.mul(offset[1][k],inv[2][j]))));
 rows.push([0,1,2].map(j=>I.add(I.add(inv[0][j],inv[1][j]),inv[2][j])));
 const numeric=rows.map(row=>row.map(v=>{const [lo,hi]=I.toNumbers(v);return lo+(hi-lo)/2;})),errors=rows.map((row,k)=>{
  const exact=row.reduce((s,v,j)=>I.add(s,abs(I.sub(v,F(numeric[k][j])))),Z),magnitude=numeric[k].reduce((s,v)=>I.add(s,F(Math.abs(v))),Z);
  // Encloses NDC division/subtraction (4 eps), coefficient evaluation,
  // arbitrary JS multiplication/add association, and minimum normal flush.
  return upper(I.add(exact,I.add(I.mul(magnitude,F(32*Number.EPSILON)),F(2**-1022))));
 });
 output.set([...numeric.flat(),...origin,...errors,Math.min(...clips.map(v=>v[2])),Math.max(...clips.map(v=>v[2]))],at);
 if(!Array.from(output.subarray(at,at+ORACLE_WORDS)).every(Number.isFinite))fail('UNPROVEN_PIXEL_ORACLE','Finite directed clip oracle required');
 return {degenerate:false};
}
function oraclePixel(table,triangle,x,y,width,height,out){
 if(!(table instanceof Float64Array)||!Number.isSafeInteger(triangle)||triangle<0||triangle*ORACLE_WORDS+ORACLE_WORDS>table.length||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||x>=width||y<0||y>=height)fail('INVALID_PIXEL','Exact fragment address and actual triangle identity required');
 const at=triangle*ORACLE_WORDS,nx=(2*x+1)/width-1,ny=(2*y+1)/height-1,d=table[at+9]*nx+table[at+10]*ny+table[at+11],de=table[at+18],minD=1/table[at+20];
 if(!Number.isFinite(d)||!(d-de>minD*.5))fail('UNPROVEN_PIXEL_ORACLE','Actual fragment has no positive bounded clip denominator',{triangle,x,y,d,de});
 let square=0;
 for(let k=0;k<3;k++){
  const n=table[at+k*3]*nx+table[at+k*3+1]*ny+table[at+k*3+2],offset=n/d,origin=table[at+12+k];out[k]=origin+offset;
  // Positive-error arithmetic is inflated beyond all binary64 elementary
  // roundings. The exact denominator lies in [d-de,d+de].
  const error=((table[at+15+k]+Math.abs(offset)*de)/(d-de)+8*Number.EPSILON*(Math.abs(offset)+Math.abs(origin)+1))*1.00000001+1e-12;square+=error*error;
 }
 out[3]=Math.sqrt(square)*1.00000001+1e-12;return out;
}
function bounds({positionBounds,referenceMatrix,maximumOffsetM,maximumOffsetRoundM,coverage,maximumMainEyeBridgeM=0,maximumSubdivisionPositionErrorM=0}){
 if(!Array.isArray(positionBounds)||positionBounds.length!==3||!Number.isFinite(maximumOffsetM)||maximumOffsetM<0||!Number.isFinite(maximumOffsetRoundM)||maximumOffsetRoundM<0)fail('UNPROVEN_LOCAL_TRANSFORM','Complete finite stream ranges required');
 const input=positionBounds.map(v=>{if(v.length!==2||!v.every(Number.isFinite)||v[0]>v[1])fail('UNPROVEN_LOCAL_TRANSFORM','Invalid complete position range');return [F(v[0])[0],F(v[1])[1]];}),rows=projectionRows(referenceMatrix),inv=inverse(rows),errors=rows.map(row=>{const magnitude=row.reduce((s,v,k)=>I.add(s,abs(I.mul(v,input[k]))),Z),cpu=I.mul(magnitude,F(8*Number.EPSILON)),round=F(ulpUpper(upper(I.add(magnitude,cpu))));return I.add(cpu,round);}),equivalent=inv.map(row=>row.reduce((s,v,k)=>I.add(s,I.mul(abs(v),errors[k])),Z)),projectionErrorM=norm(equivalent),maximumWorldMagnitude=Math.max(...positionBounds.flat().map(Math.abs)),reconstructionAxisM=ulpUpper(maximumWorldMagnitude+maximumOffsetM)+maximumOffsetRoundM;
 if(!Number.isFinite(maximumMainEyeBridgeM)||maximumMainEyeBridgeM<0||!Number.isFinite(maximumSubdivisionPositionErrorM)||maximumSubdivisionPositionErrorM<0)fail('UNPROVEN_MAIN_EYE','Finite directed Main eye and affine-subdivision bridges required');
 const vertex=L.radialCoverage(coverage,projectionErrorM+maximumMainEyeBridgeM+maximumSubdivisionPositionErrorM),conditionalInterpolationAxisM=maximumOffsetM*2**-16,conditionalAdditionalM=projectionErrorM+maximumMainEyeBridgeM+maximumSubdivisionPositionErrorM+Math.sqrt(3)*(reconstructionAxisM+conditionalInterpolationAxisM);let conditionalFragment;
 try{conditionalFragment=L.radialCoverage(coverage,conditionalAdditionalM);}catch(error){conditionalFragment={status:'REFUSED',code:error.code,details:error.details};}
 return R.deepFreeze({format:'sphere-local-stream-bound/1',profile:PROFILE,positionBounds,referenceMatrix,projectionClipErrors:errors.map(upper),projectionEquivalentAxisErrorM:equivalent.map(upper),projectionErrorM,maximumMainEyeBridgeM,maximumSubdivisionPositionErrorM,vertex,maximumOffsetM,maximumOffsetRoundM,conditionalInterpolationBits:16,conditionalInterpolationAxisM,conditionalFragment,interpolationNativeQualified:false,visualCoverageReady:false,scope:'DIRECTED_CPU_F64_PROJECTION_PLUS_F32_CLIP_ROUNDING_AND_MAIN_EYE_BRIDGE; INTERPOLATION_BOUND_CONDITIONAL_ONLY'});
}
const api=Object.freeze({PROFILE,coverage,encodeTriangle,expectedTransform,bounds,ulpUpper,ORACLE_WORDS,oracleTriangle,oraclePixel,subdivide,subdivisionBound,facetDomain,facetBounds});root.SphereBiomeLocalStreamModelV4=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
