/* Geometry in kilometres and radians. CPU calculations use JavaScript doubles. */
(function(root) {
  'use strict';
  const W=root.SphereMeadowWind||(typeof require==='function'?require('./meadow-wind.js'):null);
  const VEGETATION_REVISIONS=Object.freeze({residentResourceRevision:1,packetRevision:1,selectionRevision:1});
  const PERSISTENT_VEGETATION_REVISIONS=Object.freeze({residentResourceRevision:2,packetRevision:2,selectionRevision:2});
  const VEGETATION_LIFETIME_FIELDS=Object.freeze(['requestGeneration','slotGeneration','renderFrame']);
  function validateVegetationRevisions(meadow){
    for(const field of VEGETATION_LIFETIME_FIELDS)if(field in meadow)throw Error('Runtime vegetation '+field+' cannot be saved in a meadow scene');
    const fields=Object.keys(VEGETATION_REVISIONS);
    if(!fields.some(field=>field in meadow))return {};
    if(meadow.schema!==1||meadow.representationRevision!==3||meadow.placementRevision!==2)throw Error('Explicit vegetation revisions require the fixed-chart meadow profile');
    const result={};
    const persistent=fields.every(field=>meadow[field]===PERSISTENT_VEGETATION_REVISIONS[field]);
    for(const field of fields){const value=field in meadow?meadow[field]:VEGETATION_REVISIONS[field];if(!Number.isSafeInteger(value)||value!==(persistent?PERSISTENT_VEGETATION_REVISIONS:VEGETATION_REVISIONS)[field])throw Error('Unsupported vegetation '+field);result[field]=value;}
    if(persistent&&(meadow.appearanceRevision!==4||meadow.canopyRevision!==2||meadow.materialRevision!==3))throw Error('Persistent vegetation requires the F2 profile');
    return result;
  }
  const AU = 149597870.7, SUN = 695700, PI = Math.PI;
  const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length=a=>Math.hypot(...a), norm=a=>mul(a,1/(length(a)||1)).map(v=>v===0?0:v);
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const radians=v=>v*PI/180, degrees=v=>v*180/PI;
  function axis(lat,lon) { lat=radians(lat);lon=radians(lon);return [Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)]; }
  function latlon(v) {const n=norm(v);return [degrees(Math.asin(clamp(n[1],-1,1))),degrees(Math.atan2(n[0],n[2]))];}
  function rotate(v,a,t) {a=norm(a);return add(add(mul(v,Math.cos(t)),mul(cross(a,v),Math.sin(t))),mul(a,dot(a,v)*(1-Math.cos(t))));}
  function basis(forward, up=[0,1,0]) {
    const f=norm(forward); if(Math.abs(dot(f,norm(up)))>.999) up=Math.abs(f[0])<.9?[1,0,0]:[0,1,0];
    const r=norm(cross(f,up)); return {f,r,u:norm(cross(r,f))};
  }
  // Stable inside-shell root, retaining small altitude separately from large radius.
  function shellDistance(p,d,R) {
    const r=length(p),h=R-r,b=dot(p,d),c=-h*(2*R-h),disc=b*b-c;
    if(disc<0)return Infinity;
    const s=Math.sqrt(disc);
    const far=b>0?-c/(b+s):-b+s;
    return far>0?far:Infinity;
  }
  function sphereDistance(p,d,center,radius) {
    const o=sub(p,center),b=dot(o,d),perp=cross(o,d),disc=radius*radius-dot(perp,perp);
    if(disc<0)return Infinity;
    const s=Math.sqrt(disc),near=-b-s,far=-b+s;
    return near>0?near:(far>0?far:Infinity);
  }
  function shade(s) {
    const offset=s.shadeOffset*s.shadeDiameter/2 + s.time*s.shadeSpeed;
    return {center:[offset,0,s.radius-s.shadeAltitude],radius:s.shadeDiameter/2,damage:s.shadeDamage};
  }
  function plateContains(x,y,p) {
    if(Math.hypot(x,y)>p.radius)return false;
    // A macroscopic circular notch cut out of the left edge.
    if(p.damage>0 && Math.hypot(x+p.radius*.86,y-p.radius*.18)<p.radius*.42*p.damage)return false;
    return true;
  }
  function plateDistance(p,d,plate) {
    if(Math.abs(d[2])<1e-15)return Infinity;
    const t=(plate.center[2]-p[2])/d[2];
    if(t<=0)return Infinity;
    return plateContains(p[0]+d[0]*t-plate.center[0],p[1]+d[1]*t-plate.center[1],plate)?t:Infinity;
  }
  function inBreach(q,s) {
    if(!s.breachEnabled)return false;
    const ax=axis(s.breachLat,s.breachLon),delta=sub(norm(q),ax),b=basis(ax),ang=Math.atan2(dot(delta,b.u),dot(delta,b.r));
    const edge=1+(s.breachRoughness||0)*(.12*Math.sin(5*ang)+.05*Math.sin(13*ang)+.03*Math.sin(29*ang));
    return length(delta) < 2*Math.sin(s.breachDiameter/(4*s.radius))*edge;
  }
  function trace(p,d,s) {
    let distance=s.layoutVersion===2&&length(p)<=s.starRadius?Infinity:sphereDistance(p,d,[0,0,0],s.starRadius),kind='Star';
    const sh=s.shadeEnabled?plateDistance(p,d,shade(s)):Infinity;
    if(sh<distance){distance=sh;kind='Shade';}
    const shell=shellDistance(p,d,s.radius),point=add(p,mul(d,shell));
    if(shell<distance&&!inBreach(point,s)){distance=shell;kind='Inner surface';}
    if(!Number.isFinite(distance))return {kind:'Open space',distance:Infinity,point:null};
    return {kind,distance,point:add(p,mul(d,distance))};
  }
  function sunVisibility(p,s,samples=256) {
    if(length(p)<=s.starRadius)return 1;
    if(!s.shadeEnabled)return 1;
    const st=basis(mul(p,-1)),dist=length(p),rad=Math.tan(Math.asin(s.starRadius/dist)),pl=shade(s);
    let visible=0;
    for(let i=0;i<samples;i++){
      const rho=Math.sqrt((i+.5)/samples)*rad,ang=i*2.399963229728653;
      const d=norm(add(st.f,add(mul(st.r,rho*Math.cos(ang)),mul(st.u,rho*Math.sin(ang))))),t=plateDistance(p,d,pl);
      if(t>=sphereDistance(p,d,[0,0,0],s.starRadius))visible++;
    }
    return visible/samples;
  }
  function ray(x,y,aspect,hfov,b,panorama=false) {
    if(panorama){const lon=x*PI,lat=y*PI/2;return norm(add(add(mul(b.f,Math.cos(lat)*Math.cos(lon)),mul(b.r,Math.cos(lat)*Math.sin(lon))),mul(b.u,Math.sin(lat))));}
    const t=Math.tan(radians(hfov)/2);return norm(add(add(b.f,mul(b.r,x*t)),mul(b.u,y*t/aspect)));
  }
  function defaultState() {return {
    version:1,radius:AU,starRadius:SUN,luminosity:1,
    position:[0,0,AU*.5],forward:[0,0,1],up:[0,1,0],fov:80,
    breachEnabled:true,breachLat:12,breachLon:-12,breachDiameter:35000000,breachRoughness:0,surfaceStyle:'atlas',
    shadeEnabled:true,shadeAltitude:100000,shadeDiameter:100000,shadeOffset:0,shadeSpeed:2,shadeDamage:0,
    time:0,playing:false,timeRate:60,exposure:.2,shellshine:.06,atmosphere:1,
    grid:false,viewMode:'material',projection:'perspective',speed:1000000,
    quality:1,seed:23,starfield:true
  };}
  const numeric={radius:[1e7,1e9],starRadius:[10000,2e6],luminosity:[.001,100],fov:[10,150],breachLat:[-90,90],breachLon:[-180,180],breachDiameter:[1000,1.5e8],breachRoughness:[0,1],shadeAltitude:[1000,1e7],shadeDiameter:[100,2e7],shadeOffset:[-20,20],shadeSpeed:[-100,100],shadeDamage:[0,1],time:[-1e9,1e9],timeRate:[.1,3600],exposure:[-10,12],shellshine:[0,.5],atmosphere:[0,1],speed:[1,3e7],quality:[.35,1],seed:[0,1000]};
  function validate(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('This is not a Sphere scene file.');
    const s=defaultState();
    for(const [k,[lo,hi]] of Object.entries(numeric))if(k in input){if(!Number.isFinite(input[k])||input[k]<(k==='speed'&&input.layoutVersion===2?.001:lo)||input[k]>hi)throw Error('Invalid value for '+k);s[k]=input[k];}
    for(const k of ['position','forward','up'])if(k in input){if(!Array.isArray(input[k])||input[k].length!==3||!input[k].every(Number.isFinite))throw Error('Invalid camera '+k);s[k]=[...input[k]];}
    if(length(s.position)>=(input.layoutVersion===2?s.radius*2:s.radius-0.5)||(input.layoutVersion!==2&&length(s.position)<=s.starRadius*1.01))throw Error(input.layoutVersion===2?'Camera must remain within two shell radii.':'Camera must be inside the shell and outside the star.');
    if(s.shadeAltitude>=s.radius-s.starRadius)throw Error('Shade altitude places it inside the star.');
    if(s.breachDiameter>PI*s.radius)throw Error('Breach is larger than the shell permits.');
    if(length(s.forward)<.1||length(s.up)<.1)throw Error('Camera orientation is missing.');
    const b=basis(s.forward,s.up);s.forward=b.f;s.up=b.u;
    for(const k of ['breachEnabled','shadeEnabled','grid','starfield'])if(typeof input[k]==='boolean')s[k]=input[k];
    if(['material','distance'].includes(input.viewMode))s.viewMode=input.viewMode;
    if(['perspective','panorama'].includes(input.projection))s.projection=input.projection;
    if(['atlas','legacy'].includes(input.surfaceStyle))s.surfaceStyle=input.surfaceStyle;
    if(input.grass&&typeof input.grass==='object'&&!Array.isArray(input.grass))s.grass={enabled:!!input.grass.enabled,radiusPatches:Number.isFinite(input.grass.radiusPatches)?input.grass.radiusPatches:2,rootsPerSubcell:Number.isFinite(input.grass.rootsPerSubcell)?input.grass.rootsPerSubcell:12,density:Number.isFinite(input.grass.density)?input.grass.density:1,windStrength:Number.isFinite(input.grass.windStrength)?input.grass.windStrength:.0015,worker:input.grass.worker!==false};
    if(input.meadow&&typeof input.meadow==='object'&&!Array.isArray(input.meadow)){
      const meadow=input.meadow,residentResourceRevisions=validateVegetationRevisions(meadow),versioned=('schema' in meadow)||('representationRevision' in meadow)||('profileId' in meadow)||('coverageId' in meadow);
      const base={enabled:!!meadow.enabled,nearRange:Number.isFinite(meadow.nearRange)?meadow.nearRange:.32,middleRange:Number.isFinite(meadow.middleRange)?meadow.middleRange:1.15,farRange:Number.isFinite(meadow.farRange)?meadow.farRange:2.8,rootsPerSubcell:Number.isFinite(meadow.rootsPerSubcell)?meadow.rootsPerSubcell:12,density:Number.isFinite(meadow.density)?meadow.density:1,windStrength:Number.isFinite(meadow.windStrength)?meadow.windStrength:.0015,windClock:Number.isFinite(meadow.windClock)?meadow.windClock:input.time,pausedClock:Number.isFinite(meadow.pausedClock)?meadow.pausedClock:input.time,worker:meadow.worker!==false,diagnostic:meadow.diagnostic==='grass-id'?'grass-id':null};
      if(versioned){
        if(meadow.schema!==1||meadow.representationRevision!==3||meadow.profileId!=='bounded-meadow-proof-v1'||meadow.coverageId!=='watershed-open-meadow-proof-v1')throw Error('Unsupported meadow representation revision or profile');
        const placementRevision=meadow.placementRevision??1;
        if(!Number.isInteger(placementRevision)||![1,2].includes(placementRevision))throw Error('Unsupported meadow placement revision');
        if(!Array.isArray(meadow.anchor)||meadow.anchor.length!==2||!meadow.anchor.every(Number.isFinite))throw Error('Invalid meadow coverage anchor');
        if(placementRevision===2&&(meadow.anchor[0]!==21500||meadow.anchor[1]!==-5000))throw Error('Meadow placement revision 2 is fixed to the named Open meadow anchor');
        if(!Number.isInteger(meadow.seed)||meadow.seed<0||meadow.seed>2147483647)throw Error('Invalid meadow seed');
        if(!Number.isInteger(meadow.ecologicalRevision)||meadow.ecologicalRevision!==1)throw Error('Unsupported meadow ecological revision');
        if(!Number.isFinite(meadow.densityBladesPerM2)||meadow.densityBladesPerM2<1||meadow.densityBladesPerM2>1000)throw Error('Invalid meadow density');
        if(typeof meadow.densityPreset!=='string'||!meadow.densityPreset.length||typeof meadow.qualityPreset!=='string'||!meadow.qualityPreset.length)throw Error('Invalid meadow quality contract');
        if(typeof meadow.appearancePreset!=='string'||!meadow.appearancePreset.length)throw Error('Invalid meadow appearance contract');
        const appearanceRevision=Number.isInteger(meadow.appearanceRevision)?meadow.appearanceRevision:1;
        if(![1,2,3,4].includes(appearanceRevision))throw Error('Unsupported meadow appearance revision');
        if(appearanceRevision===3&&(meadow.appearancePreset!=='meadow-proof-f1'||meadow.canopyRevision!==1||meadow.materialRevision!==2||placementRevision!==2))throw Error('Unsupported F canopy or material revision');
        if(appearanceRevision===4&&(meadow.appearancePreset!=='meadow-proof-f2'||meadow.canopyRevision!==2||meadow.materialRevision!==3||placementRevision!==2))throw Error('Unsupported F2 canopy or material revision');
        const wind=meadow.wind&&typeof meadow.wind==='object'&&!Array.isArray(meadow.wind)?meadow.wind:{};
        const windPhase=Number.isFinite(meadow.windPhaseSeconds)?meadow.windPhaseSeconds:Number.isFinite(wind.phaseSeconds)?wind.phaseSeconds:base.pausedClock;
        const windAnchor=Number.isFinite(meadow.windAnchorSceneTime)?meadow.windAnchorSceneTime:Number.isFinite(wind.anchorSceneTime)?wind.anchorSceneTime:input.time;
        const windScale=Number.isFinite(meadow.windSceneSecondsPerSecond)?meadow.windSceneSecondsPerSecond:Number.isFinite(wind.sceneSecondsPerSecond)?wind.sceneSecondsPerSecond:60;
        if(!Number.isFinite(windPhase)||!Number.isFinite(windAnchor)||!Number.isFinite(windScale)||windScale<=0)throw Error('Invalid meadow wind timeline');
        s.meadow={...base,schema:1,representationRevision:3,placementRevision,profileId:meadow.profileId,coverageId:meadow.coverageId,seed:meadow.seed,anchor:meadow.anchor.slice(),ecologicalRevision:1,densityBladesPerM2:meadow.densityBladesPerM2,densityPreset:meadow.densityPreset,qualityPreset:meadow.qualityPreset,appearancePreset:meadow.appearancePreset,appearanceRevision,windPhaseSeconds:windPhase,windAnchorSceneTime:windAnchor,windSceneSecondsPerSecond:windScale,wind:{phaseSeconds:windPhase,anchorSceneTime:windAnchor,sceneSecondsPerWindSecond:windScale}};
        Object.assign(s.meadow,W.validate(meadow,s.time,s.timeRate));
        if(appearanceRevision===3)Object.assign(s.meadow,{canopyRevision:1,materialRevision:2});
        if(appearanceRevision===4)Object.assign(s.meadow,{canopyRevision:2,materialRevision:3});
        Object.assign(s.meadow,residentResourceRevisions);
      }else s.meadow=base;
    }
    s.playing=false;return s;
  }
  function sceneRecord(s,extra={}) {return {format:'sphere-observatory',version:1,created:new Date().toISOString(),state:JSON.parse(JSON.stringify(W.snapshot(s))),...extra};}
  const api={AU,SUN,PI,add,sub,mul,dot,cross,length,norm,clamp,radians,degrees,axis,latlon,rotate,basis,shellDistance,sphereDistance,shade,plateContains,plateDistance,inBreach,trace,sunVisibility,ray,defaultState,validate,sceneRecord,VEGETATION_REVISIONS,PERSISTENT_VEGETATION_REVISIONS,VEGETATION_LIFETIME_FIELDS,validateVegetationRevisions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SphereMath=api;
})(typeof window!=='undefined'?window:globalThis);
