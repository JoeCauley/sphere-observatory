/* Directed full-frustum coverage and CPU-projected triangle-stream bounds.
 * Conditional interpolation bounds are never native fragment authority. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),I=root.SphereBiomeIntervals||(node?require('../intervals.js'):null),M=root.SphereMath||(node?require('../../math.js'):null),L=root.SphereBiomeNativeLocalTransform||(node?require('./local-transform.js'):null),D=root.SphereBiomeNativeDistance||(node?require('./native-distance.js'):null);
const F=I.fromNumber,Z=I.rational(0n),ONE=I.rational(1n),PROFILE='main-cpu-clip-triangle-local-stream-v1',view=new DataView(new ArrayBuffer(4));
const upper=a=>I.toNumbers(a)[1],abs=a=>[0n,a[0]<0n?-a[0]>a[1]?-a[0]:a[1]:a[1]],dot=(a,b)=>a.reduce((s,v,k)=>I.add(s,I.mul(v,b[k])),Z),norm=a=>upper(I.sqrt(a.reduce((s,v)=>I.add(s,I.square(v)),Z)));
function fail(code,message,details={}){throw R.error(code,message,details,'local-stream-model');}
function inverse(rows){const [[a,b,c],[d,e,f],[g,h,i]]=rows,cof=[I.sub(I.mul(e,i),I.mul(f,h)),I.sub(I.mul(f,g),I.mul(d,i)),I.sub(I.mul(d,h),I.mul(e,g))],det=dot([a,b,c],cof);if(det[0]<=0n&&det[1]>=0n)fail('INVALID_VIEW','Projection is singular');return [[cof[0],I.sub(I.mul(c,h),I.mul(b,i)),I.sub(I.mul(b,f),I.mul(c,e))],[cof[1],I.sub(I.mul(a,i),I.mul(c,g)),I.sub(I.mul(c,d),I.mul(a,f))],[cof[2],I.sub(I.mul(b,g),I.mul(a,h)),I.sub(I.mul(a,e),I.mul(b,d))]].map(row=>row.map(v=>I.div(v,det)));}
function projectionRows(reference){return [0,1,3].map(row=>[0,1,2].map(k=>F(reference[k*4+row])));}
function ulpUpper(value){if(!Number.isFinite(value)||value<0||!Number.isFinite(Math.fround(value)))fail('INVALID_VIEW','Finite Float32 range required');let n=Math.fround(value);view.setFloat32(0,n);let word=view.getUint32(0);if(n<value)word++;const e=(word>>>23)&255;return e>0?2**(e-127-23):2**-126;}
function coverage({core,context,viewport,eye,minimumHeightM=0}){
 if(!viewport||!Number.isSafeInteger(viewport.width)||!Number.isSafeInteger(viewport.height)||viewport.width<1||viewport.height<1||viewport.width>16384||viewport.height>16384||eye?.xM!==0||eye?.yM!==0||!Number.isFinite(eye.heightM)||eye.heightM<=minimumHeightM||minimumHeightM<0)fail('UNPROVEN_VIEW_COVERAGE','The complete origin-centred nonnegative-height view profile is required');
 const projection=L.projection(core,viewport.width/viewport.height),rows=projectionRows(projection.reference),inv=inverse(rows),axes=[context.frame.east,context.frame.north,context.frame.inward.map(v=>-v)],coeff=axes.map(axis=>[0,1,2].map(k=>axis.reduce((s,v,j)=>I.add(s,I.mul(F(v),inv[j][k])),Z))),pad=1+4/Math.min(viewport.width,viewport.height),box=[F(-pad)[0],F(pad)[1]],ray=coeff.map(row=>I.add(I.add(I.mul(row[0],box),I.mul(row[1],box)),row[2]));
 if(ray[2][0]<=0n)fail('UNPROVEN_VIEW_COVERAGE','A horizon-crossing frustum needs a different coverage profile');
 const radius=F(context.radiusM),height=F(eye.heightM),factor=I.div(radius,I.sub(radius,height)),normalTravel=I.sub(height,F(minimumHeightM)),distance=I.mul(I.mul(factor,normalTravel),I.div(I.sqrt(I.add(I.square(ray[0]),I.square(ray[1]))),ray[2])),maximumChartRadiusM=upper(distance),requiredRadiusM=Math.ceil((maximumChartRadiusM+2)/4)*4;
 if(requiredRadiusM+Math.SQRT2*4>256)fail('COVERAGE_UNAVAILABLE','The complete current viewport exceeds the native patch capacity',{maximumChartRadiusM,requiredRadiusM});
 const q=D.chart(context.frame,context.radiusM,{x:[-requiredRadiusM-8,requiredRadiusM+8],y:[-requiredRadiusM-8,requiredRadiusM+8]}).q,cells=context.assignment.core.cells.map(c=>({...c,level:context.assignment.core.level}));
 if(D.insidePoint(q,cells)!=='inside')fail('UNPROVEN_VIEW_COVERAGE','The whole prepared patch is not inside one exact assigned core cell');
 return R.deepFreeze({format:'sphere-main-full-frustum-coverage/1',profile:PROFILE,viewport,eye,minimumHeightM,referenceMatrix:projection.reference,maximumChartRadiusM,requiredRadiusM,paddedClipExtent:pad,wholePatchCore:true,denominatorBounds:I.toNumbers(ray[2]),scope:'DIRECTED_CONTINUOUS_FRUSTUM_FOOTPRINT_INSIDE_ASSIGNED_CORE; NATIVE_FRAGMENT_INTERPOLATION_UNQUALIFIED'});
}
function encodeTriangle(positions,indices,reference,output,wordOffset){
 if(!(positions instanceof Float32Array)||!(output instanceof Float32Array)||indices.length!==3||reference.length!==16)fail('INVALID_INPUT','Exact retained positions, triangle and stream required');
 const origin=indices.map(index=>{if(!Number.isSafeInteger(index)||index<0||index*3+2>=positions.length)fail('INVALID_INDEX','Triangle index exceeds actual uploaded positions');return Array.from(positions.subarray(index*3,index*3+3));})[0];let maximumOffset=0,maximumOffsetRound=0;
 for(let j=0;j<3;j++){
  const p=Array.from(positions.subarray(indices[j]*3,indices[j]*3+3)),clip=[0,1,3].map(row=>p.reduce((s,v,k)=>s+reference[k*4+row]*v,0));if(![...p,...clip].every(Number.isFinite)||clip[2]<=0)fail('UNPROVEN_VIEW_COVERAGE','Every stream vertex must have finite positive homogeneous depth');
  const offset=p.map((v,k)=>v-origin[k]),rounded=offset.map(Math.fround);for(let k=0;k<3;k++){maximumOffset=Math.max(maximumOffset,Math.abs(rounded[k]));maximumOffsetRound=Math.max(maximumOffsetRound,Math.abs(offset[k]-rounded[k]));}
  output.set([clip[0],clip[1],clip[2],clip[2],...origin,...rounded],wordOffset+j*10);
 }
 return {maximumOffset,maximumOffsetRound};
}
function bounds({positionBounds,referenceMatrix,maximumOffsetM,maximumOffsetRoundM,coverage}){
 if(!Array.isArray(positionBounds)||positionBounds.length!==3||!Number.isFinite(maximumOffsetM)||maximumOffsetM<0||!Number.isFinite(maximumOffsetRoundM)||maximumOffsetRoundM<0)fail('UNPROVEN_LOCAL_TRANSFORM','Complete finite stream ranges required');
 const input=positionBounds.map(v=>{if(v.length!==2||!v.every(Number.isFinite)||v[0]>v[1])fail('UNPROVEN_LOCAL_TRANSFORM','Invalid complete position range');return [F(v[0])[0],F(v[1])[1]];}),rows=projectionRows(referenceMatrix),inv=inverse(rows),errors=rows.map(row=>{const magnitude=row.reduce((s,v,k)=>I.add(s,abs(I.mul(v,input[k]))),Z),cpu=I.mul(magnitude,F(8*Number.EPSILON)),round=F(ulpUpper(upper(I.add(magnitude,cpu))));return I.add(cpu,round);}),equivalent=inv.map(row=>row.reduce((s,v,k)=>I.add(s,I.mul(abs(v),errors[k])),Z)),projectionErrorM=norm(equivalent),maximumWorldMagnitude=Math.max(...positionBounds.flat().map(Math.abs)),reconstructionAxisM=ulpUpper(maximumWorldMagnitude+maximumOffsetM)+maximumOffsetRoundM;
 const vertex=L.radialCoverage(coverage,projectionErrorM),conditionalInterpolationAxisM=maximumOffsetM*2**-16,conditionalAdditionalM=projectionErrorM+Math.sqrt(3)*(reconstructionAxisM+conditionalInterpolationAxisM);let conditionalFragment;
 try{conditionalFragment=L.radialCoverage(coverage,conditionalAdditionalM);}catch(error){conditionalFragment={status:'REFUSED',code:error.code,details:error.details};}
 return R.deepFreeze({format:'sphere-local-stream-bound/1',profile:PROFILE,positionBounds,referenceMatrix,projectionClipErrors:errors.map(upper),projectionEquivalentAxisErrorM:equivalent.map(upper),projectionErrorM,vertex,maximumOffsetM,maximumOffsetRoundM,conditionalInterpolationBits:16,conditionalInterpolationAxisM,conditionalFragment,interpolationNativeQualified:false,visualCoverageReady:false,scope:'DIRECTED_CPU_F64_PROJECTION_PLUS_F32_CLIP_ROUNDING; INTERPOLATION_BOUND_CONDITIONAL_ONLY'});
}
const api=Object.freeze({PROFILE,coverage,encodeTriangle,bounds,ulpUpper});root.SphereBiomeLocalStreamModel=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
