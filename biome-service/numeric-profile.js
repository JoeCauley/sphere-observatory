/* Exact runtime qualification for native numeric operations. No world or live state. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null);
const FORMAT='sphere-host-numeric-qualification/1',ID='sphere-host-numeric-probes-v1',SOURCE='biome-service/numeric-profile.js';
const MAX_BYTES=65536,LEVELS=Object.freeze([0,1,14,30]);
const ENGINE_KEYS=Object.freeze(['kind','name','version','runtimeVersion','platform','architecture','bitness','platformVersion','userAgent','brands','identitySource']);
const PRIMITIVE_INPUTS=R.deepFreeze({
 sin:[[-Math.PI],[-1.31],[-1],[-.722901755422479],[-.16044869521108313],[-.5],[0],[Number.MIN_VALUE],[.5],[1],[1.31],[Math.PI/2],[Math.PI],[16]],
 cos:[[-Math.PI],[-1.31],[-1],[-.722901755422479],[-.16044869521108313],[-.5],[0],[Number.MIN_VALUE],[.5],[1],[1.31],[Math.PI/2],[Math.PI],[16]],
 asin:[[-1],[-.5],[-.16044869521108313],[0],[Number.MIN_VALUE],[.5],[1]],
 atan:[[-16],[-Math.PI],[-1],[-.5],[0],[Number.MIN_VALUE],[.5],[1],[1.31],[Math.PI],[16]],
 sqrt:[[0],[Number.MIN_VALUE],[2**-1022],[.5],[1],[2],[3],[1e21],[Number.MAX_VALUE]],
 hypot:[[3,4,0],[1,1,1],[Number.MIN_VALUE,0,0],[1e300,1e-300,1e300],[.7402573908528642,-.15976115471612445,.6530661289115217]],
 tan:[[-Math.PI],[-1.31],[-.7],[0],[.5],[1],[1.31],[Math.PI]],
 atan2:[[0,1],[1,0],[-1,0],[0,-1],[1,-1],[-1,-1],[Number.MIN_VALUE,1],[1,Number.MIN_VALUE]]
});
const VECTORS=R.deepFreeze([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,1],[-1,-1,-1],[1,1,0],[1,1-2**-52,0],[.7402573908528642,-.15976115471612445,.6530661289115217],[1e-150,2e-150,-3e-150]]);
const SAMPLES=R.deepFreeze([{latitudeRad:-.16044869521108313,longitudeRad:-.722901755422479},{latitudeRad:.73,longitudeRad:-2.1},{latitudeRad:-1.31,longitudeRad:Math.PI}]);
const METADATA=R.deepFreeze({worldSeed:23,geographyRevision:1,terrainRevision:2,artRevision:1,assetRevision:1,heroRevision:null});
function fail(code,message,details={}){throw new R.ServiceError(code,message,details,'numeric-profile');}
function exact(value,keys){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function finite(value){return typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0);}
function scalar(value){if(!Number.isFinite(value))fail('UNSUPPORTED_NUMERIC_ENVIRONMENT','Numeric probe returned a non-finite value');return value===0?0:value;}
function vector(value){if(!Array.isArray(value)||value.length!==3||value.some(v=>!finite(v)))fail('INVALID_NUMERIC_QUALIFICATION','Numeric qualification has an invalid vector');}
function text(value,maximum,empty=false){return typeof value==='string'&&value.length<=maximum&&(empty||value.length>0)&&!/[\u0000-\u001f\u007f]/.test(value);}
function clean(value){if(typeof value==='number')return scalar(value);if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)]));return value;}
function dependencies(options){const d=options?.dependencies??root,A=d.SphereWorldAddress??root.SphereWorldAddress??(typeof module!=='undefined'?require('../world-address.js'):null),M=d.SphereMath??root.SphereMath??(typeof module!=='undefined'?require('../math.js'):null);if(!A?.shell||!A?.direction||!M?.norm||!M?.length)fail('UNSUPPORTED_NUMERIC_ENVIRONMENT','Exact static address and math modules are required');return {A,M};}
async function engineIdentity(){
 if(typeof process!=='undefined'&&process.versions?.node){
  const os=typeof require==='function'?require('node:os'):process.getBuiltinModule?.('node:os');if(!os?.release)fail('UNSUPPORTED_NUMERIC_ENVIRONMENT','Node platform identity is unavailable');
  return {kind:'node',name:'v8',version:process.versions.v8,runtimeVersion:process.version,platform:process.platform,architecture:process.arch,bitness:/64/.test(process.arch)?'64':'32',platformVersion:os.release(),userAgent:'',brands:[],identitySource:'node-process-and-os-v1'};
 }
 const n=root.navigator;if(!n?.userAgentData?.getHighEntropyValues)fail('UNSUPPORTED_NUMERIC_ENVIRONMENT','An exact Chromium build/platform identity is required');
 const values=await n.userAgentData.getHighEntropyValues(['architecture','bitness','fullVersionList','platformVersion']);
 if(!Array.isArray(values.fullVersionList))fail('UNSUPPORTED_NUMERIC_ENVIRONMENT','Full Chromium version identity is unavailable');
 const brands=values.fullVersionList.map(v=>({brand:v.brand,version:v.version})).sort((a,b)=>a.brand<b.brand?-1:a.brand>b.brand?1:0),chromium=brands.find(v=>v.brand==='Chromium');
 if(!chromium||!/^\d+\.\d+\.\d+\.\d+$/.test(chromium.version)||chromium.version.split('.').slice(1).every(v=>v==='0'))fail('UNSUPPORTED_NUMERIC_ENVIRONMENT','Reduced Chromium versions cannot qualify native numeric behavior');
 return {kind:'browser',name:'chromium',version:chromium.version,runtimeVersion:chromium.version,platform:values.platform,architecture:values.architecture,bitness:values.bitness,platformVersion:values.platformVersion,userAgent:n.userAgent,brands,identitySource:'chromium-high-entropy-v1'};
}
function primitiveProbes(){return Object.entries(PRIMITIVE_INPUTS).map(([operation,inputs])=>({operation,inputs:R.clone(inputs),values:inputs.map(args=>scalar(Math[operation](...args)))}));}
function addressProbes(input,A){return LEVELS.map(level=>{const address=clean(A.shell({...METADATA,direction:input,level}));return {level,address,direction:clean(A.direction(address))};});}
function conversions({A,M}){
 const vectors=VECTORS.map(input=>({input:input.slice(),length:scalar(M.length(input)),normalized:clean(M.norm(input)),addresses:addressProbes(input,A)}));
 const sampledDirections=SAMPLES.map(input=>{const c=Math.cos(input.latitudeRad),x=c*Math.cos(input.longitudeRad),y=Math.sin(input.latitudeRad),z=c*Math.sin(input.longitudeRad),directions=clean([[x,y,-z],[y,-z,x]]);return {...input,directions,addresses:directions.map(q=>addressProbes(q,A))};});
 return {levels:LEVELS.slice(),metadata:R.clone(METADATA),vectors,sampledDirections};
}
function validate(body){
 if(!exact(body,['format','id','engine','primitives','conversions'])||body.format!==FORMAT||body.id!==ID)fail('INVALID_NUMERIC_QUALIFICATION','Unsupported numeric qualification format');
 const e=body.engine;if(!exact(e,ENGINE_KEYS)||!['node','browser'].includes(e.kind)||!text(e.name,64)||!text(e.version,128)||!text(e.runtimeVersion,128)||!text(e.platform,64)||!text(e.architecture,64)||!['32','64'].includes(e.bitness)||!text(e.platformVersion,128)||!text(e.userAgent,1024,true)||!Array.isArray(e.brands)||e.brands.length>8)fail('INVALID_NUMERIC_QUALIFICATION','Invalid exact engine/platform identity');
 let previous='';for(const b of e.brands){if(!exact(b,['brand','version'])||!text(b.brand,128)||!text(b.version,128)||b.brand<=previous)fail('INVALID_NUMERIC_QUALIFICATION','Invalid bounded engine brand identity');previous=b.brand;}
 if(e.kind==='node'){if(e.name!=='v8'||e.identitySource!=='node-process-and-os-v1'||e.userAgent!==''||e.brands.length||!/^v\d+\.\d+\.\d+/.test(e.runtimeVersion))fail('INVALID_NUMERIC_QUALIFICATION','Invalid Node qualification identity');}
 else{const b=e.brands.find(b=>b.brand==='Chromium');if(e.name!=='chromium'||e.identitySource!=='chromium-high-entropy-v1'||!e.userAgent||!b||b.version!==e.version||e.runtimeVersion!==e.version||!/^\d+\.\d+\.\d+\.\d+$/.test(e.version)||e.version.split('.').slice(1).every(v=>v==='0'))fail('INVALID_NUMERIC_QUALIFICATION','Invalid exact Chromium qualification identity');}
 const expected=Object.entries(PRIMITIVE_INPUTS);if(!Array.isArray(body.primitives)||body.primitives.length!==expected.length)fail('INVALID_NUMERIC_QUALIFICATION','Numeric primitive corpus differs');
 for(let k=0;k<expected.length;k++){const row=body.primitives[k],[operation,inputs]=expected[k];if(!exact(row,['operation','inputs','values'])||row.operation!==operation||!Array.isArray(row.values)||row.values.length!==inputs.length||row.values.some(v=>!finite(v))||R.canonicalJSON(row.inputs)!==R.canonicalJSON(inputs))fail('INVALID_NUMERIC_QUALIFICATION','Numeric primitive inputs/results differ',{operation});}
 const c=body.conversions;if(!exact(c,['levels','metadata','vectors','sampledDirections'])||R.canonicalJSON(c.levels)!==R.canonicalJSON(LEVELS)||R.canonicalJSON(c.metadata)!==R.canonicalJSON(METADATA)||!Array.isArray(c.vectors)||c.vectors.length!==VECTORS.length||!Array.isArray(c.sampledDirections)||c.sampledDirections.length!==SAMPLES.length)fail('INVALID_NUMERIC_QUALIFICATION','Numeric conversion corpus differs');
 function addresses(rows){if(!Array.isArray(rows)||rows.length!==LEVELS.length)fail('INVALID_NUMERIC_QUALIFICATION','Address probe level count differs');for(let j=0;j<rows.length;j++){const row=rows[j];if(!exact(row,['level','address','direction'])||row.level!==LEVELS[j])fail('INVALID_NUMERIC_QUALIFICATION','Address probe level differs');vector(row.direction);R.validateStructural('address',row.address);if(row.address.space!=='shell'||row.address.level!==row.level||Object.keys(METADATA).some(k=>row.address[k]!==METADATA[k]))fail('INVALID_NUMERIC_QUALIFICATION','Address probe metadata differs');}}
 for(let k=0;k<VECTORS.length;k++){const row=c.vectors[k];if(!exact(row,['input','length','normalized','addresses'])||R.canonicalJSON(row.input)!==R.canonicalJSON(VECTORS[k])||!finite(row.length)||row.length<=0)fail('INVALID_NUMERIC_QUALIFICATION','Normalized-vector probe differs');vector(row.normalized);addresses(row.addresses);}
 for(let k=0;k<SAMPLES.length;k++){const row=c.sampledDirections[k];if(!exact(row,['latitudeRad','longitudeRad','directions','addresses'])||row.latitudeRad!==SAMPLES[k].latitudeRad||row.longitudeRad!==SAMPLES[k].longitudeRad||!Array.isArray(row.directions)||row.directions.length!==2||!Array.isArray(row.addresses)||row.addresses.length!==2)fail('INVALID_NUMERIC_QUALIFICATION','Closed sampler conversion probe differs');row.directions.forEach(vector);row.addresses.forEach(addresses);}
 const bytes=new TextEncoder().encode(R.canonicalJSON(body)).byteLength;if(bytes>MAX_BYTES)fail('INVALID_NUMERIC_QUALIFICATION','Numeric qualification byte limit exceeded',{bytes});return R.deepFreeze(R.clone(body));
}
async function capture(options={}){const held=dependencies(options),engine=await engineIdentity(),body={format:FORMAT,id:ID,engine,primitives:primitiveProbes(),conversions:conversions(held)};return R.envelope(validate(body));}
async function verify(envelope,options={}){envelope=R.deepFreeze(R.clone(envelope));const body=validate(await R.verifyEnvelope(envelope)),actual=await capture(options);if(envelope.digest!==actual.digest||R.canonicalJSON(body)!==R.canonicalJSON(actual.body))fail('NUMERIC_PROFILE_MISMATCH','Actual runtime numeric qualification differs from the exact admitted profile',{expected:envelope.digest,actual:actual.digest});return R.deepFreeze({digest:envelope.digest,body});}
const api=Object.freeze({FORMAT,ID,SOURCE,MAX_BYTES,capture,validate,verify});root.SphereBiomeNumericProfile=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
