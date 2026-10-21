/* Directed halfspace ownership of the unique positive exit from a unit shell.
 * Whole ray boxes are enclosed. This is a CPU geometry theorem, not a native
 * viewport, discrete SPBX, physical receiver, or fragment admission receipt. */
(function(root){'use strict';
const node=typeof module!=='undefined',I=root.SphereBiomeIntervals||(node?require('../intervals.js'):null);
const PROFILE='sphere-interior-ray-halfspace-b192-v1',ZERO=I.rational(0n),ONE=I.rational(1n),TWO=I.rational(2n);
function fail(code,message){throw Object.assign(Error(message),{code,phase:'interior-ray-halfspace'});}
function data(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'))||Object.keys(v).sort().join('|')!==keys.slice().sort().join('|'))fail('INVALID_INPUT','Exact ordinary data fields required');}
function array(v,n){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==n||Reflect.ownKeys(v).length!==n+1)fail('INVALID_INPUT','Exact dense ordinary array fields required');for(let k=0;k<n;k++)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(k))||{},'value'))fail('INVALID_INPUT','Indexed getters and array holes refuse');return v;}
function vector(v,name){array(v,3);if(!v.every(Number.isFinite))fail('INVALID_INPUT',name+' must contain three finite binary64 values');return v.map(I.fromNumber);}
function interval(v){array(v,2);if(!v.every(Number.isFinite)||v[0]>v[1])fail('INVALID_INPUT','Finite ordered complete ray bounds required');return [I.fromNumber(v[0])[0],I.fromNumber(v[1])[1]];}
const dot=(a,b)=>a.reduce((s,v,k)=>I.add(s,I.mul(v,b[k])),ZERO),length2=v=>v.reduce((s,x)=>I.add(s,I.square(x)),ZERO);
function sign(v){return v[0]>0n?1:v[1]<0n?-1:v[0]===0n&&v[1]===0n?0:null;}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function classify(input){
 data(input,['camera','rayBounds','plane']);const camera=vector(input.camera,'Camera'),plane=vector(input.plane,'Plane');
 if(!input.plane.some(x=>x!==0))fail('INVALID_INPUT','A nonzero halfspace plane is required');
 array(input.rayBounds,3);
 const ray=input.rayBounds.map(interval),eye2=length2(camera),a=dot(plane,camera),b=dot(plane,ray),D=length2(ray),C=dot(camera,ray),E=I.sub(eye2,ONE);
 if(E[1]>=0n)fail('INTERIOR_EYE_REQUIRED','The complete exact eye must lie strictly inside the unit shell');
 if(D[0]<=0n)fail('NONZERO_RAY_REQUIRED','The complete ray box must exclude the zero direction');
 const H=I.add(I.sub(I.mul(I.square(a),D),I.mul(TWO,I.mul(I.mul(a,b),C))),I.mul(E,I.square(b)));
 const sa=sign(a),sb=sign(b),sh=sign(H);let result=null,reason='DIRECTED_INTERVAL_UNRESOLVED';
 if(sa===0&&sb!==null){result=sb;reason='EYE_ON_PLANE';}
 else if(sb===0&&sa!==null){result=sa;reason='RAY_PARALLEL_TO_PLANE';}
 else if(sa!==null&&sb!==null&&sa===sb){result=sa;reason='NO_POSITIVE_PLANE_CROSSING';}
 else if(sa!==null&&sb!==null&&sa!==sb){if(sh===-1){result=sb;reason='PLANE_CROSSED_BEFORE_SHELL_EXIT';}else if(sh===1){result=sa;reason='SHELL_EXIT_BEFORE_PLANE_CROSSING';}else if(sh===0){result=0;reason='EXACT_SHELL_PLANE_BOUNDARY';}}
 const raw=v=>v.map(x=>x.toString());
 return freeze({format:'sphere-interior-ray-halfspace-proof/1',profile:PROFILE,classification:result===null?'UNKNOWN':result===0?'BOUNDARY':result>0?'POSITIVE':'NEGATIVE',sign:result,reason,camera:input.camera.slice(),rayBounds:input.rayBounds.map(v=>v.slice()),plane:input.plane.slice(),intervalProfile:I.PROFILE,fractionBits:Number(I.BITS),directedBounds:{eyeSquared:raw(eye2),planeEye:raw(a),planeRay:raw(b),raySquared:raw(D),eyeRay:raw(C),conic:raw(H)},scope:'DIRECTED_COMPLETE_CPU_RAY_BOX_HALFSPACE_ONLY',nativeViewport:'UNQUALIFIED',physicalReceivers:'UNQUALIFIED',discreteOwnership:'UNQUALIFIED'});
}
function perspectiveRayBox(input){
 data(input,['forward','right','up','screenX','screenY']);const f=vector(input.forward,'Forward'),r=vector(input.right,'Right'),u=vector(input.up,'Up'),x=interval(input.screenX),y=interval(input.screenY);
 // Screen bounds include the actual lens/aspect/AA displacement before this
 // operation. No normalization, tan, trigonometric or native ULP assumption.
 return freeze(f.map((v,k)=>I.toNumbers(I.add(v,I.add(I.mul(x,r[k]),I.mul(y,u[k]))))));
}
function classifyPerspective(input){
 data(input,['camera','forward','right','up','screenX','screenY','plane']);
 const camera=vector(input.camera,'Camera'),plane=vector(input.plane,'Plane'),basis=[vector(input.forward,'Forward'),vector(input.right,'Right'),vector(input.up,'Up')],x=interval(input.screenX),y=interval(input.screenY);
 if(!input.plane.some(v=>v!==0))fail('INVALID_INPUT','A nonzero halfspace plane is required');
 const E=I.sub(length2(camera),ONE);if(E[1]>=0n)fail('INTERIOR_EYE_REQUIRED','The complete exact eye must lie strictly inside the unit shell');
 const f2=length2(basis[0]);if(f2[0]<=0n)fail('NONZERO_RAY_REQUIRED','The forward vector must be provably nonzero');
 const ray=basis[0].map((v,k)=>I.add(v,I.add(I.mul(x,basis[1][k]),I.mul(y,basis[2][k]))));
 let D=length2(ray);
 // Cauchy-Schwarz: |d|^2 >= (dot(d,f))^2 / |f|^2. This keeps
 // all affine rays nonzero even when their Cartesian enclosure contains zero.
 const df=I.add(f2,I.add(I.mul(x,dot(basis[1],basis[0])),I.mul(y,dot(basis[2],basis[0]))));
 if(df[0]>0n||df[1]<0n){const lower=I.div(I.square(df),f2)[0];if(lower>D[0])D=[lower,D[1]];}
 if(D[0]<=0n)fail('NONZERO_RAY_REQUIRED','The complete correlated perspective domain has no proven nonzero bound');
 const a=dot(plane,camera),b0=basis.map(v=>dot(plane,v)),c0=basis.map(v=>dot(camera,v)),b=I.add(b0[0],I.add(I.mul(x,b0[1]),I.mul(y,b0[2]))),C=I.add(c0[0],I.add(I.mul(x,c0[1]),I.mul(y,c0[2])));
 // Expand H as an exact quadratic in x/y before interval evaluation. No
 // independent centre/corner classifications replace its whole-domain bound.
 const coefficient=(i,j)=>I.add(I.sub(I.mul(I.square(a),dot(basis[i],basis[j])),I.mul(a,I.add(I.mul(b0[i],c0[j]),I.mul(b0[j],c0[i])))),I.mul(E,I.mul(b0[i],b0[j])));
 const terms=[coefficient(0,0),I.mul(TWO,coefficient(0,1)),I.mul(TWO,coefficient(0,2)),coefficient(1,1),I.mul(TWO,coefficient(1,2)),coefficient(2,2)],monomials=[ONE,x,y,I.square(x),I.mul(x,y),I.square(y)],H=terms.reduce((s,v,k)=>I.add(s,I.mul(v,monomials[k])),ZERO);
 const sa=sign(a),sb=sign(b),sh=sign(H);let result=null,reason='DIRECTED_INTERVAL_UNRESOLVED';
 if(sa===0&&sb!==null){result=sb;reason='EYE_ON_PLANE';}
 else if(sb===0&&sa!==null){result=sa;reason='RAY_PARALLEL_TO_PLANE';}
 else if(sa!==null&&sb!==null&&sa===sb){result=sa;reason='NO_POSITIVE_PLANE_CROSSING';}
 else if(sa!==null&&sb!==null&&sa!==sb){if(sh===-1){result=sb;reason='PLANE_CROSSED_BEFORE_SHELL_EXIT';}else if(sh===1){result=sa;reason='SHELL_EXIT_BEFORE_PLANE_CROSSING';}else if(sh===0){result=0;reason='EXACT_SHELL_PLANE_BOUNDARY';}}
 const raw=v=>v.map(String);
 return freeze({format:'sphere-interior-perspective-halfspace-proof/1',profile:'sphere-interior-perspective-halfspace-b192-v1',classification:result===null?'UNKNOWN':result===0?'BOUNDARY':result>0?'POSITIVE':'NEGATIVE',sign:result,reason,camera:input.camera.slice(),forward:input.forward.slice(),right:input.right.slice(),up:input.up.slice(),screenX:input.screenX.slice(),screenY:input.screenY.slice(),plane:input.plane.slice(),intervalProfile:I.PROFILE,fractionBits:Number(I.BITS),directedBounds:{eyeSquared:raw(I.add(E,ONE)),planeEye:raw(a),planeRay:raw(b),raySquared:raw(D),eyeRay:raw(C),forwardDotRay:raw(df),conic:raw(H),quadraticCoefficients:terms.map(raw)},scope:'DIRECTED_COMPLETE_CPU_AFFINE_PERSPECTIVE_DOMAIN_ONLY',nativeViewport:'UNQUALIFIED',physicalReceivers:'UNQUALIFIED',discreteOwnership:'UNQUALIFIED'});
}
const api=Object.freeze({PROFILE,classify,classifyPerspective,perspectiveRayBox});root.SphereBiomeInteriorRayHalfspace=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
