/* Exact current-host world codec. Geometry uses metres here and kilometres in core. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null),N=root.SphereBiomeNumericProfile||(typeof module!=='undefined'?require('./numeric-profile.js'):null);
const STATIC_KEYS=Object.freeze(['radius','seed','layoutVersion','collection','geographyRevision','terrainRevision','shadeGeometryRevision','axisLat','axisLon','waistWidth','transitionKm','shellThickness','surfaceStyle','biome','shadeShape','shadeTrim','provinceRevision','provinceSeed','provinceAnchor','packAddress','authoredSite']);
const PROFILE_ID='observatory-world-codec-v1',PROFILE_FORMAT='sphere-observatory-host-profile/1';
const ADDRESS_PROFILE='sphere-world-address-v2',NUMERIC_PROFILE='ecmascript-binary64-v1';
const MODULE_ORDER=Object.freeze(['world-address.js','world-topology.js','meadow-wind.js','math.js','collection.js','biomes.js','hero-textures.js','world-palette.js','biome-packs.js','world.js','watershed-network.js','field-sites.js','legacy-role-adapter.js','watershed-province.js','world-geography.js','watershed-neighbourhood.js','edge-stream.js','shade-edges.js','ground-chunks.js','biome-service/schema-validators.js','biome-service/records.js','biome-service/numeric-profile.js','biome-service/host-world.js']);
const encoder=new TextEncoder(),clone=v=>JSON.parse(R.canonicalJSON(v));
function fail(code,message,details={}){throw new R.ServiceError(code,message,details,'host-world');}
function exactKeys(v,keys){return v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function scalar(v,name,lo=-Infinity,hi=Infinity){if(!Number.isFinite(v)||Object.is(v,-0)||v<lo||v>hi)fail('INVALID_HOST_WORLD','Invalid '+name);return v;}
function vector(v,name,unit=false){if(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)||Object.is(x,-0))||Math.hypot(...v)===0||(unit&&Math.abs(Math.hypot(...v)-1)>1e-12))fail('INVALID_HOST_WORLD','Invalid '+name);return v.slice();}
function level(v){if(!Number.isInteger(v)||v<0||v>30)fail('INVALID_ADDRESS','World Address level must be 0 through 30');return v;}
function profileShape(body){
 if(!exactKeys(body,['format','id','addressProfile','numericProfile','numericQualification','timeProfile','staticParameterKeys','moduleOrder','closure','mandatoryExclusionProfiles','capabilities'])||body.format!==PROFILE_FORMAT||body.id!==PROFILE_ID||body.addressProfile!==ADDRESS_PROFILE||body.numericProfile!==NUMERIC_PROFILE||body.timeProfile!=='sphere-clock-v1'||R.canonicalJSON(body.staticParameterKeys)!==R.canonicalJSON(STATIC_KEYS))fail('UNSUPPORTED_HOST_PROFILE','Unsupported exact host codec');
 if(!N?.validate||!N?.verify||!exactKeys(body.numericQualification,['digest','body'])||!/^[0-9a-f]{64}$/.test(body.numericQualification.digest))fail('UNSUPPORTED_HOST_PROFILE','An exact host numerical qualification is required');N.validate(body.numericQualification.body);
 if(!Array.isArray(body.closure)||body.closure.length!==MODULE_ORDER.length||R.canonicalJSON(body.moduleOrder)!==R.canonicalJSON(MODULE_ORDER))fail('INVALID_HOST_WORLD','Invalid complete host dependency closure');
 let last='';for(const item of body.closure){if(!exactKeys(item,['path','bytes','sha256'])||typeof item.path!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(item.path)||item.path.split('/').some(p=>!p||p==='.'||p==='..')||item.path<=last||!Number.isSafeInteger(item.bytes)||item.bytes<1||!/^[0-9a-f]{64}$/.test(item.sha256))fail('INVALID_HOST_WORLD','Invalid host source identity');last=item.path;}
 if(body.moduleOrder.some(path=>!body.closure.some(item=>item.path===path))||!body.closure.some(item=>item.path==='biome-service/host-world.js'))fail('INVALID_HOST_WORLD','Host dependency closure is incomplete');
 if(R.canonicalJSON(body.mandatoryExclusionProfiles)!==R.canonicalJSON(['wound-apertures-v1','authored-sites-v1','polar-ports-v1'])||R.canonicalJSON(body.capabilities)!==R.canonicalJSON(['host.static-world','host.shell-address','host.fixed-frame','host.legacy-surface','host.physical-light']))fail('UNSUPPORTED_HOST_PROFILE','Unsupported host capabilities');
 return clone(body);
}
async function create({profileEnvelope,readSource,dependencies=root}={}){
 profileEnvelope=R.deepFreeze(R.clone(profileEnvelope));
 if(typeof readSource!=='function')fail('UNSUPPORTED_HOST_PROFILE','Exact host source verification is required');
 const verifiedProfileBody=await R.verifyEnvelope(profileEnvelope);profileEnvelope=R.deepFreeze({digest:profileEnvelope.digest,body:verifiedProfileBody});const admitted=profileShape(verifiedProfileBody);
 for(const item of admitted.closure){const bytes=await readSource(item.path);if(!(bytes instanceof Uint8Array)||bytes.byteLength!==item.bytes||await R.sha256(bytes)!==item.sha256)fail('HOST_PROFILE_MISMATCH','Host dependency bytes differ from the admitted codec',{path:item.path});}
 await N.verify(admitted.numericQualification,{dependencies});
 const M=dependencies.SphereMath,A=dependencies.SphereWorldAddress,W=dependencies.SphereWorld,C=dependencies.SphereCollection,G=dependencies.SphereGeography,S=dependencies.SphereSites;
 if(!M?.validate||!A?.shell||!W?.frame||!C?.routeFrame||!G?.query||!S?.noise)fail('UNSUPPORTED_HOST_PROFILE','Actual host codec dependencies are not loaded');
 const hostProfileRef=R.deepFreeze({id:admitted.id,digest:profileEnvelope.digest});
 const validated=new WeakMap();
 function staticFromCore(input){
  let core;try{core=M.validate(input);}catch(e){fail('INVALID_HOST_WORLD','Existing host codec rejected scene',{reason:e.message});}
  if(core.layoutVersion!==2||core.collection!==true)fail('UNSUPPORTED_HOST_PROFILE','This native codec requires the designed layout 2 collection world');
  if(!Number.isInteger(core.seed))fail('INVALID_HOST_WORLD','Fractional host seeds cannot identify a service world');
  const p={};for(const key of STATIC_KEYS)if(key!=='authoredSite')p[key]=clone(core[key]);
  // Revision 2 is the moving legacy ground patch, not an authored reservation.
  p.authoredSite=core.siteId&&core.siteRevision!==2&&!/^shade-|^rim$|^exterior-/.test(core.siteId)?{id:core.siteId,anchor:core.siteAnchor.slice(),revision:core.siteRevision,elevationKm:core.siteElevation}:null;
  R.canonicalJSON(p);return p;
 }
 function restoreStatic(p){
  if(!exactKeys(p,STATIC_KEYS))fail('INVALID_HOST_WORLD','Static host parameters must exactly match the admitted codec');
  const input={...M.defaultState(),...clone(p)};delete input.authoredSite;
  if(p.authoredSite!==null){if(!exactKeys(p.authoredSite,['id','anchor','revision','elevationKm'])||!/^(biome-[0-9]|port-[01])$/.test(p.authoredSite.id)||![0,1].includes(p.authoredSite.revision))fail('INVALID_HOST_WORLD','Unsupported authored host site');Object.assign(input,{siteId:p.authoredSite.id,siteAnchor:p.authoredSite.anchor,siteRevision:p.authoredSite.revision,siteElevation:p.authoredSite.elevationKm});}
  // Keep camera validation away from a changed shell radius and all transient sites.
  Object.assign(input,{position:[0,0,p.radius*.5],forward:[0,0,1],up:[0,1,0],walkMode:false,walkSurface:false,walkPosition:null,shadeAttachment:null});
  const round=staticFromCore(input);if(R.canonicalJSON(round)!==R.canonicalJSON(p))fail('INVALID_HOST_WORLD','Static parameters do not round-trip through exact host codec');return M.validate(input);
 }
 function geographyProfile(p){return {format:'sphere-host-geography-inputs/1',hostProfileRef,parameters:clone(p),addressMetadata:metadataFor(p),frame:clone(W.frame(p)),algorithm:'observatory-layout-2-static-v1'};}
 function trackProfile(p){
  return {format:'sphere-planned-track-inputs/1',hostProfileRef,worldFrame:clone(W.frame(p)),shape:p.shadeShape,trim:p.shadeTrim,tracks:C.routes.map((route,index)=>{
   const f=C.routeFrame(p,index,0);return {id:'shade-track-'+index,index,routeRadiusFraction:route.radius,count:route.count,normalAtLongitudeZero:f.normal.slice(),crossTrackAxisAtLongitudeZero:f.right.slice(),latitudeRad:f.latitude,across:f.across,gnomonicHalfWidthRatio:Math.tan(Math.PI/(2*route.count)),shape:p.shadeShape,trim:p.shadeTrim};
  }),plannedGeometry:'complete-intact-route-sweep-v1',physicalTimeAndDamageExcluded:true};
 }
 function protectionProfile(p){
  const reservations=[];
  if(p.provinceRevision===1&&p.provinceAnchor){const extentKm=p.packAddress?78000:320;reservations.push({id:p.packAddress?'watershed-neighbourhood':'watershed-province',kind:p.packAddress?'gnomonic-disc':'gnomonic-square',anchor:p.provinceAnchor.slice(),extentM:extentKm*1000,source:p.packAddress?'biome-packs.js:bounds.radiusKm':'watershed-province.js:EXTENT/2'});}
  if(p.authoredSite)reservations.push({id:'authored-'+p.authoredSite.id,kind:'gnomonic-square',anchor:p.authoredSite.anchor.slice(),extentM:S.SITE_RADIUS*1000,source:'field-sites.js:SITE_RADIUS'});
  return {format:'sphere-host-protection-inputs/1',hostProfileRef,worldAxis:W.frame(p).axis.slice(),wounds:C.wounds.map((w,index)=>({id:'wound-'+index,axis:w.axis.slice(),tangent:w.tangent.slice(),lengthRad:w.length,widthRad:w.width,jaggedWidth:{base:1,terms:[{amplitude:.13,frequency:71},{amplitude:.055,frequency:193}]},edgeBandM:W.woundBandKm*1000})),authoredReservations:reservations,polarReservations:{id:'polar-entry',minimumAbsoluteLatitudeRad:1.31},physicalDamageExcluded:true};
 }
 function metadataFor(p){return {worldSeed:p.seed,geographyRevision:p.geographyRevision??1,terrainRevision:p.terrainRevision,artRevision:p.packAddress?.artRevision??1,assetRevision:1,heroRevision:null};}
 async function targetId(snapshot){const tuple={};for(const key of ['hostProfileRef','worldSeed','validatedStaticWorldParameters','hostGeographyDigest','trackProfileDigest','protectionProfileDigest'])tuple[key]=snapshot[key];return 'world-'+(await R.sha256(encoder.encode('sphere-host-world-target/1\n'+R.canonicalJSON(tuple)))).slice(0,32);}
 async function captureCurrentWorld(coreScene){
  const parameters=staticFromCore(coreScene);restoreStatic(parameters);
  await N.verify(admitted.numericQualification,{dependencies});
  const geography=await R.envelope(geographyProfile(parameters)),tracks=await R.envelope(trackProfile(parameters)),protection=await R.envelope(protectionProfile(parameters));
  const snapshot={format:'sphere-host-world/1',worldId:'world-pending',worldSeed:parameters.seed,hostProfileRef,validatedStaticWorldParameters:parameters,hostGeographyDigest:geography.digest,trackProfileDigest:tracks.digest,protectionProfileDigest:protection.digest};snapshot.worldId=await targetId(snapshot);R.validateStructural('host-world',snapshot);
  const hostWorldEnvelope=await R.envelope(snapshot),retainedProfiles=R.deepFreeze({host:profileEnvelope,geography,tracks,protection});validated.set(hostWorldEnvelope.body,{core:restoreStatic(parameters),retainedProfiles});
  return R.deepFreeze({snapshot:hostWorldEnvelope.body,hostWorldEnvelope,retainedProfiles});
 }
 async function validateSnapshot(snapshot,retainedProfiles){
  // Own immutable values before the first asynchronous hash operation. Callers
  // must use the returned snapshot; a mutable input is never an admitted handle.
  snapshot=R.deepFreeze(clone(snapshot));retainedProfiles=retainedProfiles?R.deepFreeze(clone(retainedProfiles)):null;
  await N.verify(admitted.numericQualification,{dependencies});
  R.validateStructural('host-world',snapshot);
  if(snapshot.hostProfileRef.id!==hostProfileRef.id||snapshot.hostProfileRef.digest!==hostProfileRef.digest)fail('UNSUPPORTED_HOST_PROFILE','Saved world requires a different exact admitted host codec');
  const core=restoreStatic(snapshot.validatedStaticWorldParameters);
  if(snapshot.worldSeed!==core.seed||snapshot.worldId!==await targetId(snapshot))fail('HOST_WORLD_MISMATCH','Saved host world identity disagrees with retained inputs');
  if(!retainedProfiles||!exactKeys(retainedProfiles,['host','geography','tracks','protection']))fail('MISSING_HOST_INPUTS','Exact retained host input records are required');
  for(const key of ['host','geography','tracks','protection'])await R.verifyEnvelope(retainedProfiles[key]);
  if(retainedProfiles.host.digest!==hostProfileRef.digest)fail('HOST_PROFILE_MISMATCH','Retained codec reference differs');
  const expected={geography:await R.envelope(geographyProfile(snapshot.validatedStaticWorldParameters)),tracks:await R.envelope(trackProfile(snapshot.validatedStaticWorldParameters)),protection:await R.envelope(protectionProfile(snapshot.validatedStaticWorldParameters))};
  for(const [name,field] of [['geography','hostGeographyDigest'],['tracks','trackProfileDigest'],['protection','protectionProfileDigest']])if(expected[name].digest!==snapshot[field]||retainedProfiles[name].digest!==snapshot[field])fail('HOST_WORLD_MISMATCH','Retained '+name+' inputs disagree with exact host codec');
  validated.set(snapshot,{core,retainedProfiles});return R.deepFreeze({snapshot,coreScene:clone(core),retainedProfiles});
 }
 function context(snapshot){const value=validated.get(snapshot);if(!value)fail('UNVERIFIED_HOST_WORLD','Host snapshot must be captured or verified before use');return value;}
 function metadata(snapshot){context(snapshot);return R.deepFreeze(metadataFor(snapshot.validatedStaticWorldParameters));}
 function canonicalizeShellAddress(address,snapshot){
  context(snapshot);R.validateStructural('address',address);if(address.space!=='shell')fail('INVALID_ADDRESS','Service geometry requires the shell address space');
  const expected=metadata(snapshot);for(const key of Object.keys(expected))if(address[key]!==expected[key])fail('ADDRESS_WORLD_MISMATCH','Address metadata differs from retained host world',{key});
  const validatedAddress=A.validate(address),canonical=A.shell({...expected,direction:A.direction(validatedAddress),level:level(address.level)});R.validateAddress(canonical);return R.deepFreeze(canonical);
 }
 function addressForDirection(direction,snapshot,addressLevel=30){vector(direction,'shell direction');return R.deepFreeze(A.shell({...metadata(snapshot),direction,level:level(addressLevel)}));}
 function addressFromCorePose(coreScene,snapshot,options={}){
  context(snapshot);const core=M.validate(coreScene);if(R.canonicalJSON(staticFromCore(core))!==R.canonicalJSON(snapshot.validatedStaticWorldParameters))fail('HOST_WORLD_MISMATCH','Core pose belongs to another static world');
  const q=M.norm(vector(core.position,'core position')),altitudeM=(core.radius-M.length(core.position))*1000;
  return R.deepFreeze({address:addressForDirection(q,snapshot,options.level??30),altitudeM,forward:core.forward.slice(),up:core.up.slice(),movementProfile:options.movementProfile??'manual',selectedTime:core.time,presentationState:clone(options.presentationState??{mode:'none'}),hostWindSnapshot:clone(options.hostWindSnapshot??null)});
 }
 function corePoseFromAddress(observer,snapshot){
  const {core}=context(snapshot),address=canonicalizeShellAddress(observer.address,snapshot),altitudeM=scalar(observer.altitudeM,'inward altitude',-core.radius*1000,core.radius*1000);
  scalar(observer.selectedTime,'selected time',-1e9,1e9);const forward=vector(observer.forward,'observer forward',true),up=vector(observer.up,'observer up',true);if(Math.abs(M.dot(forward,up))>1e-10)fail('INVALID_VIEW','Observer orientation is not orthogonal');
  if(!['manual','terrain-following','level-flight','walking'].includes(observer.movementProfile))fail('UNSUPPORTED_MOVEMENT','Unknown movement profile');
  const q=A.direction(address),candidate={...clone(core),position:M.mul(q,core.radius-altitudeM/1000),forward,up,time:observer.selectedTime,playing:false,walkMode:false,walkSurface:false,walkPosition:null,shadeAttachment:null};
  const clean=M.validate(candidate);clean.playing=false;return clean;
 }
 function fixedRegionFrame(anchor,orientation,snapshot,limits={}){
  context(snapshot);const origin=canonicalizeShellAddress(anchor,snapshot),q0=A.direction(origin),wf=W.frame(snapshot.validatedStaticWorldParameters);scalar(orientation,'fixed orientation',-Math.PI*2,Math.PI*2);
  // Pole fallback uses the retained host right axis, never the camera.
  let east=M.cross(wf.axis,q0);if(M.length(east)<1e-12)east=M.sub(wf.right,M.mul(q0,M.dot(wf.right,q0)));east=M.norm(east);let north=M.norm(M.cross(q0,east));
  const e=M.add(M.mul(east,Math.cos(orientation)),M.mul(north,Math.sin(orientation))),n=M.add(M.mul(north,Math.cos(orientation)),M.mul(east,-Math.sin(orientation)));
  const maximumAngularRadiusRad=scalar(limits.maximumAngularRadiusRad??Math.PI/4,'maximum chart angle',Number.MIN_VALUE,Math.PI/4),radiusM=snapshot.validatedStaticWorldParameters.radius*1000;
  const maximumLocalRadiusM=scalar(limits.maximumLocalRadiusM??radiusM*Math.tan(maximumAngularRadiusRad),'maximum chart radius',Number.MIN_VALUE,1e12);
  if(maximumLocalRadiusM>radiusM*Math.tan(maximumAngularRadiusRad)*(1+8*Number.EPSILON))fail('INVALID_FRAME','Chart metric limit exceeds angular limit');
  const frame={id:limits.id??'region-frame-v1',profile:'region-gnomonic-metres-v1',origin,east:e.map(x=>x===0?0:x),inward:q0.map(x=>x===0?0:-x),north:n.map(x=>x===0?0:x),maximumAngularRadiusRad,maximumLocalRadiusM};R.validateFrame(frame,{direction:()=>q0,radiusM});return R.deepFreeze(frame);
 }
 function checkFrame(frame,snapshot){context(snapshot);const origin=canonicalizeShellAddress(frame.origin,snapshot),radiusM=snapshot.validatedStaticWorldParameters.radius*1000;R.validateFrame(frame,{direction:()=>A.direction(origin),radiusM});if(frame.maximumLocalRadiusM>radiusM*Math.tan(frame.maximumAngularRadiusRad)*(1+8*Number.EPSILON))fail('INVALID_FRAME','Retained chart metric limit exceeds angular limit');return A.direction(origin);}
 function generatorCoordinates(address,frame,snapshot){
  const q0=checkFrame(frame,snapshot),q=A.direction(canonicalizeShellAddress(address,snapshot)),den=M.dot(q,q0);if(!(den>0))fail('OUTSIDE_GENERATOR_FRAME','Address is beyond the fixed chart hemisphere');
  const radiusM=snapshot.validatedStaticWorldParameters.radius*1000,x=radiusM*M.dot(q,frame.east)/den,y=radiusM*M.dot(q,frame.north)/den,angular=Math.atan2(M.length(M.cross(q,q0)),den);
  if(angular>frame.maximumAngularRadiusRad||Math.hypot(x,y)>frame.maximumLocalRadiusM)fail('OUTSIDE_GENERATOR_FRAME','Address exceeds fixed chart bounds');return R.deepFreeze({xM:x===0?0:x,yM:y===0?0:y});
 }
 function directionFromGenerator(coordinates,frame,snapshot){
  const q0=checkFrame(frame,snapshot),x=scalar(coordinates.xM,'generator x'),y=scalar(coordinates.yM,'generator y'),radiusM=snapshot.validatedStaticWorldParameters.radius*1000;
  if(Math.hypot(x,y)>frame.maximumLocalRadiusM||Math.atan2(Math.hypot(x,y),radiusM)>frame.maximumAngularRadiusRad)fail('OUTSIDE_GENERATOR_FRAME','Generator coordinates exceed fixed chart bounds');return M.norm(M.add(q0,M.add(M.mul(frame.east,x/radiusM),M.mul(frame.north,y/radiusM))));
 }
 function surfacePointM(coordinates,heightM,frame,snapshot){const q=directionFromGenerator(coordinates,frame,snapshot),radiusM=snapshot.validatedStaticWorldParameters.radius*1000;scalar(heightM,'inward terrain height',-radiusM,radiusM);return M.mul(q,radiusM-heightM);}
 function gpuDelta(pointM,eyeM){for(const [name,value] of [['surface point',pointM],['render eye',eyeM]])if(!Array.isArray(value)||value.length!==3||value.some(item=>!Number.isFinite(item)))fail('INVALID_FRAME','Invalid '+name);const delta=pointM.map((value,index)=>value-eyeM[index]);if(delta.some(value=>Math.abs(value)>3.4028234663852886e38))fail('INVALID_FRAME','Render delta exceeds float range');return Float32Array.from(delta);}
 function legacySurface(address,snapshot,{representation='walking',selectedTime=0,physicalState={}}={}){const {core}=context(snapshot),canonical=canonicalizeShellAddress(address,snapshot);scalar(selectedTime,'selected time',-1e9,1e9);if(Object.keys(physicalState).some(k=>!['era','multipleWounds'].includes(k)))fail('INVALID_HOST_WORLD','Unknown legacy physical selection');const scene=M.validate({...clone(core),...physicalState,time:selectedTime}),field=G.query(canonical,{state:scene,representation,ecology:false});return {...field,elevationM:field.elevationKm*1000};}
 function lightAt(address,selectedTime,snapshot,physicalState={}){
  const {core}=context(snapshot),canonical=canonicalizeShellAddress(address,snapshot),q=A.direction(canonical);scalar(selectedTime,'selected time',-1e9,1e9);
  // These physical selections do not enter any retained placement profile.
  const allowed=['era','routeShades','multipleWounds','starStation','cycleScale','luminosity','starRadius','exposure','stationSamples'];if(Object.keys(physicalState).some(k=>!allowed.includes(k)))fail('INVALID_LIGHT_CONTEXT','Unknown physical lighting selection');const scene=M.validate({...clone(core),...physicalState,time:selectedTime}),p=M.mul(q,scene.radius);
  return {starDirection:M.mul(q,-1),sourceAngularRadiusRad:Math.asin(scene.starRadius/scene.radius),directVisibility:C.visibility(p,scene,scene.starStation?scene.stationSamples:19),receiverInward:M.mul(q,-1),lightingUnits:'host-relative-stellar-irradiance',luminosity:scene.luminosity,exposure:scene.exposure,cavityApproximation:{id:'observatory-cavity-192-v1',samples:192,color:C.cavity(scene).slice()},physicalShadeIds:C.plates(scene).map(plate=>plate.id),unsupportedPhysicalTerms:['spectral-radiometry','multiple-scattering']};
 }
 function windAt(address,selectedTime,windProfile,snapshot){context(snapshot);canonicalizeShellAddress(address,snapshot);scalar(selectedTime,'selected time',-1e9,1e9);fail('UNSUPPORTED_HOST_WIND','The existing host wind is scoped to a named bounded legacy scene; this exact world codec admits no global service wind profile',{requestedProfile:windProfile?.id??null});}
 return Object.freeze({hostProfileRef,profileEnvelope,captureCurrentWorld,validateSnapshot,canonicalizeShellAddress,addressForDirection,metadata,addressFromCorePose,corePoseFromAddress,fixedRegionFrame,generatorCoordinates,directionFromGenerator,surfacePointM,gpuDelta,legacySurface,lightAt,windAt,retainedInputs(snapshot){return context(snapshot).retainedProfiles;},targetId});
}
const api={PROFILE_ID,PROFILE_FORMAT,STATIC_KEYS,MODULE_ORDER,ADDRESS_PROFILE,NUMERIC_PROFILE,validateProfile:profileShape,create};root.SphereBiomeHostWorld=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
